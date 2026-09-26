/**
 * SillyTavern.getContext() 的完整兼容面。
 *
 * 设计要点：
 * - 整个宿主只维护**一个** context 对象：每次 getContext() 先把动态字段（chat/name1/name2/
 *   characters/chatId…）刷成最新，再返回同一个引用。这样扩展缓存 context 也不会拿到陈旧快照；
 * - extensionSettings / chatMetadata 都是**稳定对象**（扩展直接改字段），内容来自 localStorage，
 *   saveSettingsDebounced / saveMetadataDebounced 防抖 500ms 后写回并通知酒馆面板；
 * - 所有可能抛异常的地方都 try/catch + onWarn 降级，绝不让酒馆面板崩；
 * - generateRaw / Generate / stopGeneration / executeSlashCommands 明确抛错并 toast（本宿主没有生成链路与命令管线）。
 */

import type { StEventSource } from './emitter.ts'
import { event_types } from './emitter.ts'
import type { StLibs } from './libs.ts'
import type { StMirror, StToastKind } from './types.ts'
import { debounce, toStringValue } from './libs-pure.ts'
import type { StSkeleton } from './dom.ts'
import { setLoader } from './dom.ts'
import type { StSlashCommandClass, StSlashCommandParserFace, StPopupClass } from './slash.ts'
import {
  ARGUMENT_TYPE,
  POPUP_RESULT,
  POPUP_TYPE,
  callGenericPopup,
  createPopupClass,
  createSlashCommandClass,
  createSlashCommandParser,
} from './slash.ts'

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 扩展可以直接塞进 characters[] 的角色对象（字段是 ST 的常见形状）。 */
export interface StCharacter extends Record<string, unknown> {
  /** 角色名。 */
  name: string
  /** 头像文件名（本宿主没有头像资源，给一个占位常量）。 */
  avatar: string
  /** 角色卡 data 对象（V2/V3 的 data）。 */
  data: Record<string, unknown>
}

/** 宿主传给 context 的依赖。 */
export interface StContextDeps {
  /** 事件总线。 */
  eventSource: StEventSource
  /** libs（Handlebars / DOMPurify 等）。 */
  libs: StLibs
  /** 读取酒馆面板的实时镜像。 */
  getMirror(): StMirror
  /** 扩展要求以 {{user}} 身份发言。 */
  onSend(text: string): void
  /** 非致命问题上报。 */
  onWarn(message: string): void
  /** toast（宿主的 toastr 走这里）。 */
  onToast(message: string, kind?: StToastKind): void
  /** 稳定的 extension_settings 对象（宿主持有）。 */
  extensionSettings: Record<string, unknown>
  /** 稳定的 chat_metadata 对象（宿主持有）。 */
  chatMetadata: Record<string, unknown>
  /** 立即持久化 extension_settings。 */
  persistSettings(): void
  /** 立即持久化 chat_metadata。 */
  persistMetadata(): void
  /** 取 DOM 骨架（loader 用；install 之前返回 null）。 */
  getSkeleton(): StSkeleton | null
  /** 已加载扩展 id 列表。 */
  loadedExtensions(): string[]
  /** 扩展清单缓存（Node 半安装时给的 manifest 若已缓存则命中）。 */
  manifestFor(id: string): Record<string, unknown> | undefined
  /** 请求扩展清单（getExtensionManifest 未命中时后台预热）。 */
  requestManifest(id: string): void
  /** 是否移动端（libs.Bowser 派生）。 */
  isMobile: boolean
}

/** getContext() 返回的面（额外字段通过索引签名放行）。 */
export interface StContext {
  /** 当前对话（ST 形状）。 */
  chat: unknown[]
  /** 角色列表（本宿主最多一个）。 */
  characters: StCharacter[]
  /** 当前角色下标（没有角色时 undefined）。 */
  characterId: number | undefined
  /** ST 的老字段名，等于 characterId。 */
  this_chid: number | undefined
  /** 群聊列表（本宿主恒为空数组）。 */
  groups: unknown[]
  /** 当前群聊 id（本宿主恒为 null）。 */
  groupId: null
  /** 会话 id。 */
  chatId: string
  /** {{user}} 显示名。 */
  name1: string
  /** {{char}} 显示名。 */
  name2: string
  /** API 标签（恒为 'dsh'）。 */
  mainApi: string
  /** ST 的老字段名，等于 mainApi。 */
  main_api: string
  /** 在线状态。 */
  onlineStatus: string
  /** 会话元数据（稳定对象）。 */
  chatMetadata: Record<string, unknown>
  /** ST 的老字段名，等于 chatMetadata。 */
  chat_metadata: Record<string, unknown>
  /** 扩展设置（稳定对象）。 */
  extensionSettings: Record<string, unknown>
  /** 扩展设置（老字段名）。 */
  extension_settings: Record<string, unknown>
  /** 事件总线。 */
  eventSource: StEventSource
  /** 事件常量表。 */
  eventTypes: typeof event_types
  /** 事件常量表（老字段名）。 */
  event_types: typeof event_types
  /** 请求头。 */
  getRequestHeaders(): Record<string, string>
  /** 宏替换。 */
  substituteParams(text: unknown, extra?: Record<string, unknown>): string
  /** 宏替换 + 额外宏表。 */
  substituteParamsExtended(text: unknown, additional?: Record<string, unknown>): string
  /** 渲染扩展模板。 */
  renderExtensionTemplateAsync(extensionName: string, templateId: string, data?: unknown): Promise<string>
  /** 渲染内置模板（尽力而为，失败返回空串）。 */
  renderTemplateAsync(templateId: string, data?: unknown): Promise<string>
  /** 取扩展清单（未缓存时返回轻量占位并后台预热）。 */
  getExtensionManifest(extensionName: string): Record<string, unknown>
  /** 翻译（查已注册的本地化词典）。 */
  t(text: unknown): string
  /** 翻译（t 的别名）。 */
  translate(text: unknown): string
  /** 注册本地化数据。 */
  addLocaleData(nameOrData: unknown, dataOrName?: unknown): void
  /** 当前语言。 */
  getCurrentLocale(): string
  /** 是否移动端。 */
  isMobile: boolean
  /** 加载遮罩。 */
  loader: { show(): void; hide(): void }
  /** 通用弹窗。 */
  callGenericPopup: typeof callGenericPopup
  /** Popup 类。 */
  Popup: StPopupClass
  /** 弹窗类型常量。 */
  POPUP_TYPE: typeof POPUP_TYPE
  /** 弹窗结果常量。 */
  POPUP_RESULT: typeof POPUP_RESULT
  /** 注册调试函数。 */
  registerDebugFunction(name: string, description: string, fn: (...args: any[]) => unknown): (...args: any[]) => unknown
  /** 命令解析器（注册表）。 */
  SlashCommandParser: StSlashCommandParserFace
  /** 命令类。 */
  SlashCommand: StSlashCommandClass
  /** 参数类型常量。 */
  ARGUMENT_TYPE: typeof ARGUMENT_TYPE
  /** 执行斜杠命令：本宿主抛清晰错误。 */
  executeSlashCommands(command: string): never
  /** 执行斜杠命令（带选项）：本宿主抛清晰错误。 */
  executeSlashCommandsWithOptions(command: string): never
  /** 生成（抛清晰错误）。 */
  generate(...args: unknown[]): never
  /** 生成原文（抛清晰错误）。 */
  generateRaw(...args: unknown[]): never
  /** Generate 别名（抛清晰错误）。 */
  Generate(...args: unknown[]): never
  /** 停止生成（抛清晰错误）。 */
  stopGeneration(...args: unknown[]): never
  /** 以 {{user}} 身份发言。 */
  sendMessageAsUser(text: string): void
  /** 立即保存 extension_settings。 */
  saveSettings(): void
  /** 防抖保存 extension_settings。 */
  saveSettingsDebounced(): void
  /** 防抖保存 chat_metadata。 */
  saveMetadataDebounced(): void
  /** 粗略 token 估算。 */
  getTokenCount(text: unknown): number
  /** 粗略 token 估算（Promise 版）。 */
  getTokenCountAsync(text: unknown): Promise<number>
  /** 账号存储（localStorage 包装）。 */
  accountStorage: Record<string, unknown>
  /** power_user 对象（稳定）。 */
  powerUser: Record<string, unknown>
  /** power_user（老字段名）。 */
  power_user: Record<string, unknown>
  /** 其余字段。 */
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 两位补零。 */
function pad2(value: number): string {
  return value < 10 ? '0' + value : String(value)
}

/** 'YYYY-MM-DD'。 */
function dateText(now: Date): string {
  return String(now.getFullYear()) + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate())
}

/** 'HH:mm'。 */
function timeText(now: Date): string {
  return pad2(now.getHours()) + ':' + pad2(now.getMinutes())
}

/** 粗略 token 估算（中文按字、英文按 4 字符一个 token）。 */
export function estimateTokens(text: unknown): number {
  const value = toStringValue(text)
  if (!value) return 0
  let cjk = 0
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code >= 0x2e80 && code <= 0x9fff) cjk += 1
  }
  return cjk + Math.ceil((value.length - cjk) / 4)
}

// ---------------------------------------------------------------------------
// context 句柄
// ---------------------------------------------------------------------------

/** 宿主拿到的 context 句柄。 */
export interface StContextHandle {
  /** 刷新动态字段后返回同一个 context 对象。 */
  get(): StContext
  /** 不刷新，直接取当前 context。 */
  peek(): StContext
  /** 写入扩展清单缓存（安装/首次读取后调用）。 */
  cacheManifest(id: string, manifest: Record<string, unknown>): void
  /** 命令解析器（宿主诊断用）。 */
  slashParser: StSlashCommandParserFace
}

/** 空镜像兜底（面板还没装好或读镜像抛错时用）。 */
function emptyMirror(): StMirror {
  return { chat: [], name1: '你', name2: '', character: null, chatMetadata: {}, mainApi: 'dsh', onlineStatus: 'online', chatRootId: 'pt-chat-log' }
}

/** 从数组里随机取一个。 */
function pickOne(list: string[]): string {
  if (list.length === 0) return ''
  return list[Math.floor(Math.random() * list.length)]
}

/** 造一个“函数对象”版账号存储：既能当 no-op 函数调用，也有 Promise 方法。 */
export function createAccountStorage(localforage: StLibs['localforage']): Record<string, unknown> {
  const storage = (() => undefined) as unknown as Record<string, unknown>
  storage.getItem = (key: string) => localforage.getItem(key)
  storage.setItem = (key: string, value: unknown) => localforage.setItem(key, value)
  storage.removeItem = (key: string) => localforage.removeItem(key)
  storage.clear = () => localforage.clear()
  storage.keys = () => localforage.keys()
  return storage
}

/** power_user 的稳定对象（本宿主没有这套设置，给常用字段的合理默认值）。 */
export function createPowerUser(): Record<string, unknown> {
  return {
    personas: {},
    persona_descriptions: {},
    default_persona: null,
    active_persona: null,
    custom_persona: null,
    context: { preset: 'default', allow_rearrange: false },
    instruct: { enabled: false, preset: 'default' },
    world_info_depth: 2,
    world_info_budget: 25,
    world_info_recursive: false,
    world_info_case_sensitive: false,
    world_info_whole_words: false,
    world_info_include_names: true,
    author_notes_prompt: '',
    prefer_character_prompt: true,
    prefer_character_jailbreak: true,
    show_avatar: false,
    fast_ui_mode: true,
    quiet_prompt: '',
    quick_continue: false,
    auto_connect: false,
  }
}

// ---------------------------------------------------------------------------
// 创建 context
// ---------------------------------------------------------------------------

/**
 * 创建 ST 兼容 context（整个宿主只调一次）。
 *
 * @param deps 宿主依赖（事件总线 / libs / 镜像读取 / 持久化 / DOM 骨架…）。
 */
export function createStContext(deps: StContextDeps): StContextHandle {
  const { extensionSettings, chatMetadata } = deps
  const characters: StCharacter[] = []
  const groups: unknown[] = []
  const locales: Record<string, Record<string, string>> = {}
  const manifests: Record<string, Record<string, unknown>> = {}
  const debugFunctions: Record<string, (...args: any[]) => unknown> = {}
  const notified = new Set<string>()
  const slashParser = createSlashCommandParser(deps.onWarn)
  const SlashCommand = createSlashCommandClass()
  const Popup = createPopupClass()
  const powerUser = createPowerUser()
  const accountStorage = createAccountStorage(deps.libs.localforage)
  let currentLocale = 'zh-cn'

  /** 读镜像，失败返回空镜像（绝不让面板崩）。 */
  const safeMirror = (): StMirror => {
    try {
      const mirror = deps.getMirror()
      if (mirror && typeof mirror === 'object') return mirror
    } catch (e) {
      console.error('[portable-tavern/st] getContext 读取酒馆镜像失败', e)
    }
    return emptyMirror()
  }

  /** 不支持的能力：toast 一次 + 抛清晰错误。 */
  const unsupported = (feature: string, reason: string): never => {
    if (!notified.has(feature)) {
      notified.add(feature)
      try { deps.onToast(reason, 'warning') } catch { /* toast 失败也要把错误抛出去 */ }
    }
    throw new Error('便携酒馆：' + reason + '（' + feature + '）')
  }

  /** 立即保存设置。 */
  const saveSettings = (): void => {
    try { deps.persistSettings() } catch (e) { console.error('[portable-tavern/st] 保存 extension_settings 失败', e) }
  }

  /** 防抖 500ms 保存设置。 */
  const saveSettingsDebounced = debounce(saveSettings, 500)

  /** 防抖 500ms 保存会话元数据。 */
  const saveMetadataDebounced = debounce((): void => {
    try { deps.persistMetadata() } catch (e) { console.error('[portable-tavern/st] 保存 chat_metadata 失败', e) }
  }, 500)

  /** 宏替换实现。 */
  const substitute = (text: unknown, extra?: Record<string, unknown>): string => {
    let out = toStringValue(text)
    if (!out) return out
    if (out.indexOf('{{') < 0) return out
    const mirror = safeMirror()
    const card = (mirror.character || {}) as Record<string, unknown>
    const chat = Array.isArray(mirror.chat) ? mirror.chat : []
    const now = new Date()
    const first = chat.length > 0 ? chat[0] : null
    const last = chat.length > 0 ? chat[chat.length - 1] : null
    const field = (key: string): string => toStringValue(card[key])
    const table: Record<string, string> = {
      user: mirror.name1 || '你',
      char: mirror.name2 || '',
      time: timeText(now),
      date: dateText(now),
      weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()],
      isotime: now.toISOString(),
      newline: '\n',
      input: '',
      persona: '',
      description: field('description'),
      personality: field('personality'),
      scenario: field('scenario'),
      mesExamples: field('mes_example'),
      example_dialogue: field('mes_example'),
      charPrompt: '',
      charJailbreak: '',
      charVersion: field('character_version'),
      charCreator: field('creator'),
      creator_notes: field('creator_notes'),
      first_mes: field('first_mes'),
      model: 'dsh',
      maxPrompt: '2048',
      maxContext: '8192',
      maxResponse: '1024',
      lastMessage: last ? toStringValue((last as { mes?: unknown }).mes) : '',
      firstMessage: first ? toStringValue((first as { mes?: unknown }).mes) : '',
      original: '',
      group: '',
      idle_duration: '',
      isMobile: deps.isMobile ? 'true' : 'false',
      toggles: '',
    }
    // {{random:a,b}} / {{pick:a,b}}：ST 常用的随机宏
    out = out.replace(/\{\{\s*(random|pick)\s*:\s*([^}]*)\}\}/gi, (_match, _kind, list) => {
      const options = String(list).split(',').map((item) => item.trim()).filter((item) => item !== '')
      return pickOne(options)
    })
    // 已知宏替换；未知宏原样保留（与 ST 行为一致）
    out = out.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.-]*)\s*\}\}/g, (match, name: string) => {
      if (extra && Object.prototype.hasOwnProperty.call(extra, name)) return toStringValue(extra[name])
      if (Object.prototype.hasOwnProperty.call(table, name)) return table[name]
      return match
    })
    return out
  }

  /** 拉取并渲染扩展模板；任何失败都返回空串（不抛）。 */
  const renderExtensionTemplateAsync = async (extensionName: string, templateId: string, data?: unknown): Promise<string> => {
    try {
      const name = toStringValue(extensionName)
      const id = toStringValue(templateId)
      if (!name || !id) return ''
      const file = /\.html?$/i.test(id) ? id : id + '.html'
      const path = file.split('/').map((part) => encodeURIComponent(part)).join('/')
      const url = '/tavern-ext/' + encodeURIComponent(name) + '/' + path
      const response = await fetch(url)
      if (!response.ok) {
        deps.onWarn('扩展模板不存在：' + url + '（HTTP ' + response.status + '），已返回空串')
        return ''
      }
      const text = await response.text()
      const template = deps.libs.Handlebars.compile(text)
      return template(data === undefined || data === null ? {} : data)
    } catch (e) {
      deps.onWarn('扩展模板渲染失败：' + String(e instanceof Error ? e.message : e))
      return ''
    }
  }

  /** 合并所有已注册词典后的查表翻译。 */
  const translate = (text: unknown): string => {
    const key = toStringValue(text)
    if (!key) return key
    try {
      const current = locales[currentLocale]
      if (current && Object.prototype.hasOwnProperty.call(current, key)) return toStringValue(current[key])
      for (const name of Object.keys(locales)) {
        const dict = locales[name]
        if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return toStringValue(dict[key])
      }
    } catch (e) { console.error('[portable-tavern/st] translate 失败', e) }
    return key
  }

  const context: StContext = {
    chat: [],
    characters,
    characterId: undefined,
    this_chid: undefined,
    groups,
    groupId: null,
    chatId: '',
    name1: '你',
    name2: '',
    mainApi: 'dsh',
    main_api: 'dsh',
    onlineStatus: 'online',
    chatMetadata,
    chat_metadata: chatMetadata,
    extensionSettings,
    extension_settings: extensionSettings,
    eventSource: deps.eventSource,
    eventTypes: event_types,
    event_types,
    getRequestHeaders: (): Record<string, string> => ({ 'Content-Type': 'application/json' }),
    substituteParams: (text: unknown, extra?: Record<string, unknown>): string => substitute(text, extra),
    substituteParamsExtended: (text: unknown, additional?: Record<string, unknown>): string => substitute(text, additional),
    renderExtensionTemplateAsync,
    renderTemplateAsync: (templateId: string, data?: unknown): Promise<string> => renderExtensionTemplateAsync('template', templateId, data),
    getExtensionManifest: (extensionName: string): Record<string, unknown> => {
      const name = toStringValue(extensionName)
      if (manifests[name]) return manifests[name]
      const cached = deps.manifestFor(name)
      if (cached) { manifests[name] = cached; return cached }
      const placeholder: Record<string, unknown> = { display_name: name, js: 'index.js', css: 'style.css', version: '', author: '', stubbed: true }
      manifests[name] = placeholder
      try { deps.requestManifest(name) } catch { /* 预热失败无所谓 */ }
      return placeholder
    },
    t: translate,
    translate,
    addLocaleData: (nameOrData: unknown, dataOrName?: unknown): void => {
      try {
        const name = typeof nameOrData === 'string' ? nameOrData : (typeof dataOrName === 'string' ? dataOrName : 'default')
        const data = typeof nameOrData === 'string' ? dataOrName : nameOrData
        if (!data || typeof data !== 'object') return
        const dict = locales[name] || (locales[name] = {})
        for (const key of Object.keys(data as Record<string, unknown>)) dict[key] = toStringValue((data as Record<string, unknown>)[key])
      } catch (e) { console.error('[portable-tavern/st] addLocaleData 失败', e) }
    },
    getCurrentLocale: (): string => currentLocale,
    isMobile: deps.isMobile,
    loader: {
      show: (): void => { const skel = deps.getSkeleton(); if (skel) { try { setLoader(skel, true) } catch { /* 忽略 */ } } },
      hide: (): void => { const skel = deps.getSkeleton(); if (skel) { try { setLoader(skel, false) } catch { /* 忽略 */ } } },
    },
    callGenericPopup,
    Popup,
    POPUP_TYPE,
    POPUP_RESULT,
    registerDebugFunction: (name: string, description: string, fn: (...args: any[]) => unknown): (...args: any[]) => unknown => {
      const safeFn = typeof fn === 'function' ? fn : (): void => { /* 空实现 */ }
      debugFunctions[toStringValue(name)] = safeFn
      void description
      return safeFn
    },
    SlashCommandParser: slashParser,
    SlashCommand,
    ARGUMENT_TYPE,
    executeSlashCommands: (command: string): never => {
      deps.onWarn('扩展请求执行斜杠命令 /' + toStringValue(command).replace(/^\//, '') + '，本宿主没有 ST 的命令管线')
      return unsupported('executeSlashCommands', '该扩展需要 ST 的斜杠命令管线，本宿主暂不支持')
    },
    executeSlashCommandsWithOptions: (command: string): never => unsupported('executeSlashCommandsWithOptions', '该扩展需要 ST 的斜杠命令管线（' + toStringValue(command).slice(0, 40) + '），本宿主暂不支持'),
    generate: (): never => unsupported('generate', '该扩展需要生成链路，本宿主暂不支持'),
    generateRaw: (): never => unsupported('generateRaw', '该扩展需要生成链路，本宿主暂不支持'),
    Generate: (): never => unsupported('Generate', '该扩展需要生成链路，本宿主暂不支持'),
    stopGeneration: (): never => unsupported('stopGeneration', '该扩展需要生成链路，本宿主暂不支持'),
    sendMessageAsUser: (text: string): void => {
      try { deps.onSend(toStringValue(text)) } catch (e) { console.error('[portable-tavern/st] sendMessageAsUser 失败', e) }
    },
    saveSettings,
    saveSettingsDebounced,
    saveMetadataDebounced,
    getTokenCount: (text: unknown): number => estimateTokens(text),
    getTokenCountAsync: (text: unknown): Promise<number> => Promise.resolve(estimateTokens(text)),
    accountStorage,
    powerUser,
    power_user: powerUser,
  }

  /** 把角色卡刷进 characters[]（保持数组引用稳定，扩展可以直接持有）。 */
  const syncCharacters = (mirror: StMirror): void => {
    characters.length = 0
    const card = mirror.character
    if (!card || typeof card !== 'object') return
    let json = ''
    try { json = JSON.stringify(card) } catch { json = '' }
    const entry = Object.assign({}, card, {
      name: toStringValue(card.name) || mirror.name2 || '角色',
      avatar: 'portable-tavern.png',
      chat: mirror.chatRootId,
      data: card,
      fav: false,
      talkativeness: 0.5,
      json_data: json,
    }) as unknown as StCharacter
    characters.push(entry)
  }

  /** 从镜像补充 chatMetadata 的新键（保持对象引用不变）。 */
  const syncMetadata = (mirror: StMirror): void => {
    const incoming = mirror.chatMetadata
    if (!incoming || typeof incoming !== 'object') return
    for (const key of Object.keys(incoming)) {
      if (!Object.prototype.hasOwnProperty.call(chatMetadata, key)) chatMetadata[key] = incoming[key]
    }
  }

  /** 刷新动态字段。 */
  const refresh = (): StContext => {
    const mirror = safeMirror()
    syncCharacters(mirror)
    syncMetadata(mirror)
    context.chat = Array.isArray(mirror.chat) ? mirror.chat : []
    context.name1 = toStringValue(mirror.name1) || '你'
    context.name2 = toStringValue(mirror.name2)
    context.mainApi = toStringValue(mirror.mainApi) || 'dsh'
    context.main_api = context.mainApi
    context.onlineStatus = toStringValue(mirror.onlineStatus) || 'online'
    context.chatId = toStringValue(mirror.chatId) || ('tavern-' + (context.name2 || 'nochar'))
    const hasCharacter = !!mirror.character && typeof mirror.character === 'object'
    context.characterId = hasCharacter ? 0 : undefined
    context.this_chid = context.characterId
    context.isMobile = deps.isMobile
    return context
  }

  return {
    get: refresh,
    peek: (): StContext => context,
    cacheManifest: (id: string, manifest: Record<string, unknown>): void => { if (id) manifests[id] = manifest },
    slashParser,
  }
}


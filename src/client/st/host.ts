/**
 * 兼容宿主实现：createStHost()。
 *
 * 对外契约（酒馆面板只用这些）：install / load / unload / emit / setThemeVars / toast / loaded / dispose。
 *
 * 注入的全局（install 时建立，dispose 时按原样还原）：
 * - window.SillyTavern = { libs, getContext, eventSource, event_types, eventTypes, ... }
 * - window.__tavernSt  ← 桩模块取值入口（Node 半改写的 import 会读它，键名必须完全一致）：
 *     eventSource, event_types, eventTypes, extension_settings, power_user, saveSettingsDebounced,
 *     saveMetadataDebounced, getRequestHeaders, renderTemplateAsync, renderExtensionTemplateAsync,
 *     substituteParams, substituteParamsExtended, chat_metadata, chatMetadata, isMobile, DOMPurify,
 *     Bowser, accountStorage, SlashCommandParser, SlashCommand, ARGUMENT_TYPE, executeSlashCommands,
 *     callGenericPopup, Popup, POPUP_TYPE, POPUP_RESULT, toastr, getContext, characters, this_chid,
 *     name1, name2, main_api, onlineStatus, getSlideToggleOptions, initMovingUI, favsToHotswap
 *     说明：有真实实现的挂真实对象；没有真实实现的挂**函数型 no-op**（返回 undefined），
 *     保证扩展的 typeof x === 'function' 判断不会失败。extension_settings / power_user /
 *     chat_metadata 与 getContext() 返回的是同一个稳定对象。
 * - window.toastr = { info, success, warning, error, clear }
 * - window.$ / window.jQuery = 迷你 jQuery（页面已有 jQuery 时不覆盖）
 * - window._ = 自带 lodash 子集（页面已有 lodash 时不覆盖）
 * - window.__tavernStStub(path)：未实现时给一个保守默认（Node 半可覆盖）
 *
 * 健壮性：所有对外方法都 try/catch；扩展加载窗口内的异常会归因到该扩展并写进 load() 的 error。
 */

import type { StExtensionSource, StHost, StHostOptions, StLoadResult, StMessage, StMirror, StToastKind, StToastr } from './types.ts'
import { createEventSource, event_types } from './emitter.ts'
import type { StEventSource } from './emitter.ts'
import { createStLibs } from './libs.ts'
import type { StLibs } from './libs.ts'
import { createJQuery } from './jquery.ts'
import {
  addedChildrenSince,
  applyThemeVars,
  captureMounts,
  clearToasts,
  createDomWatcher,
  disposeSkeleton,
  installSkeleton,
  removeHeadBodyNodes,
  showToast,
  syncChatMirror,
} from './dom.ts'
import type { StDomWatcher, StSkeleton } from './dom.ts'
import { createStContext } from './context.ts'
import type { StContext, StContextHandle } from './context.ts'
import {
  ARGUMENT_TYPE,
  POPUP_RESULT,
  POPUP_TYPE,
  callGenericPopup,
  createPopupClass,
  createSlashCommandClass,
  createSlashCommandParser,
} from './slash.ts'
import { toStringValue } from './libs-pure.ts'

// ---------------------------------------------------------------------------
// 全局声明
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    /** ST 兼容全局（libs + getContext）。 */
    SillyTavern?: Record<string, unknown>
    /** 桩模块取值入口（Node 半改写的 import 读它）。 */
    __tavernSt?: Record<string, unknown>
    /** ST 的 toastr 契约。 */
    toastr?: StToastr
    /** 迷你 jQuery（页面没有 jQuery 时才写入）。 */
    $?: unknown
    /** 迷你 jQuery 别名。 */
    jQuery?: unknown
    /** 深链模块兜底 URL 工厂（Node 半可覆盖）。 */
    __tavernStStub?: (path: string) => string
    /** 页面已有的 lodash（存在则复用）。 */
    _?: unknown
    /** 页面已有的 lodash（别名）。 */
    lodash?: unknown
  }
}

// ---------------------------------------------------------------------------
// 常量与内部类型
// ---------------------------------------------------------------------------

/** extension_settings 的 localStorage 键。 */
export const ST_SETTINGS_KEY = 'dsh.portable-tavern.st.extension-settings.v1'

/** chat_metadata 的 localStorage 键。 */
export const ST_METADATA_KEY = 'dsh.portable-tavern.st.chat-metadata.v1'

/** 加载归因窗口上限（毫秒）。 */
const LOAD_WINDOW_MS = 3000

/** 脚本 settle 之后再等一小段，收集异步异常（毫秒）。 */
const LOAD_GRACE_MS = 800

/** 镜像轮询间隔（毫秒）：面板没显式 emit 时扩展也能拿到新对话。 */
const MIRROR_INTERVAL_MS = 900

/** 一个扩展的加载记录（unload 时需要的一切）。 */
interface StExtensionRecord {
  /** 扩展 id。 */
  id: string
  /** 加载来源。 */
  source: StExtensionSource
  /** 我们插入的 script / link 节点。 */
  nodes: Node[]
  /** load 前被跟踪挂载点的子节点快照。 */
  mountSnapshot: Array<[Element, Node[]]>
  /** 加载窗口内该扩展插进 head/body 的节点。 */
  domNodes: Node[]
  /** 归因到的错误。 */
  errors: string[]
  /** 疑似需要 stub 的上游模块（从 import 失败信息里提取）。 */
  stubs: string[]
  /** 加载时间戳。 */
  loadedAt: number
}

/** 当前加载窗口（全局错误归因的目标）。 */
interface StActiveLoad {
  /** 扩展 id。 */
  id: string
  /** 归因到的错误。 */
  errors: string[]
  /** 疑似 stub 目标。 */
  stubs: string[]
  /** 脚本是否已 settle。 */
  settled: boolean
  /** 收尾（ok / 错误文案）。 */
  finish(ok: boolean, error?: string): void
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 读取一个 JSON 对象（失败返回空对象）。 */
function loadJsonObject(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch { return {} }
}

/** 写入一个 JSON 对象。 */
function saveJsonObject(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) {
    console.error('[portable-tavern/st] 写入 localStorage 失败: ' + key, e)
  }
}

/** 把相对 URL 解析成绝对 URL（失败原样返回）。 */
function resolveUrl(src: string): string {
  try { return new URL(src, window.location.href).toString() } catch { return src }
}

/** 从错误信息里抠出模块 URL / specifier。 */
function extractModuleRefs(message: string): string[] {
  const out: string[] = []
  const re = /(https?:\/\/[^\s"')]+|\/[A-Za-z0-9_\-./@]+\.m?js)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(message)) !== null) {
    const value = match[1]
    if (out.indexOf(value) < 0) out.push(value)
  }
  return out
}

/** 判断一条错误是不是“模块导入失败”。 */
function isModuleImportError(message: string): boolean {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|does not provide an export named|Failed to resolve module specifier|Cannot find module|The requested module/i.test(message)
}

/** 函数型 no-op（桩模块要 typeof === 'function'）。 */
function noopFunction(): (...args: unknown[]) => undefined {
  return (..._args: unknown[]): undefined => undefined
}

// ---------------------------------------------------------------------------
// 宿主实现
// ---------------------------------------------------------------------------

/**
 * 创建兼容宿主。酒馆面板只创建一个（useState(() => createStHost())[0]），
 * install() 可以在 React StrictMode 下被 install → dispose → install 反复调用。
 */
export function createStHost(): StHost {
  // ---- 与 install 无关的状态（install 之前也能安全存在） ----
  const eventSource: StEventSource = createEventSource()
  const libs: StLibs = createStLibs()
  const extensionSettings: Record<string, unknown> = loadJsonObject(ST_SETTINGS_KEY)
  const chatMetadata: Record<string, unknown> = loadJsonObject(ST_METADATA_KEY)
  const extensions = new Map<string, StExtensionRecord>()
  const watcher: StDomWatcher = createDomWatcher()
  const stubHost: Record<string, unknown> = {}
  const ownedGlobals: string[] = []
  const previousGlobals = new Map<string, unknown>()
  const notified = new Set<string>()
  let skeleton: StSkeleton | null = null
  let options: StHostOptions | null = null
  let installed = false
  let activeLoad: StActiveLoad | null = null
  let mirrorTimer: number | null = null
  let loadChain: Promise<unknown> = Promise.resolve()
  let seenChatLength = -1
  let seenCharacter = '\u0000'
  let seenChatId = ''

  // ---- 上报 ----
  /** 非致命问题上报：面板日志 + 控制台（同一条只 toast 一次）。 */
  const warn = (message: string): void => {
    const text = toStringValue(message)
    try { console.warn('[portable-tavern/st] ' + text) } catch { /* 无 console */ }
    try { if (options) options.onWarn(text) } catch (e) { console.error('[portable-tavern/st] onWarn 回调异常', e) }
  }

  /** 致命但被吞掉的错误（写控制台 + 面板日志）。 */
  const reportError = (message: string, error?: unknown): void => {
    try { console.error('[portable-tavern/st] ' + message, error) } catch { /* 无 console */ }
    try { if (options) options.onWarn(message + '：' + String(error instanceof Error ? error.message : error)) } catch { /* 忽略 */ }
  }

  /** toast（宿主骨架里的 toast 容器）。 */
  const toast = (message: string, kind: StToastKind = 'info'): void => {
    const text = toStringValue(message)
    try {
      if (skeleton) showToast(skeleton, text, kind)
      else console.info('[portable-tavern/st] toast(' + kind + ')：' + text)
    } catch (e) { console.error('[portable-tavern/st] toast 失败', e) }
  }

  /** 只提示一次的能力缺失（避免扩展循环调用刷屏）。 */
  const notifyOnce = (key: string, message: string): void => {
    if (notified.has(key)) return
    notified.add(key)
    warn(message)
    toast(message, 'warning')
  }

  // ---- settings / metadata 持久化 ----
  /** 立即持久化 extension_settings 并通知面板。 */
  const persistSettings = (): void => {
    saveJsonObject(ST_SETTINGS_KEY, extensionSettings)
    try { if (options) options.onSettings(extensionSettings) } catch (e) { console.error('[portable-tavern/st] onSettings 回调异常', e) }
  }

  /** 立即持久化 chat_metadata。 */
  const persistMetadata = (): void => {
    saveJsonObject(ST_METADATA_KEY, chatMetadata)
  }

  // ---- context ----
  const contextHandle: StContextHandle = createStContext({
    eventSource,
    libs,
    getMirror: (): StMirror => {
      if (!options) return { chat: [], name1: '你', name2: '', character: null, chatMetadata: {}, mainApi: 'dsh', onlineStatus: 'online', chatRootId: 'pt-chat-log' }
      return options.getContext()
    },
    onSend: (text: string): void => {
      try {
        if (options) options.onSend(text)
        else warn('扩展尝试以用户身份发言，但酒馆面板还没接上 onSend')
      } catch (e) { reportError('onSend 回调异常', e) }
    },
    onWarn: warn,
    onToast: toast,
    extensionSettings,
    chatMetadata,
    persistSettings,
    persistMetadata,
    getSkeleton: (): StSkeleton | null => skeleton,
    loadedExtensions: (): string[] => Array.from(extensions.keys()),
    manifestFor: (): Record<string, unknown> | undefined => undefined,
    requestManifest: (id: string): void => { void primeManifest(id) },
    isMobile: !!(libs.Bowser && libs.Bowser.mobile === true),
  })

  /** 取 context（每次刷新动态字段，并同步桩模块入口）。 */
  const getContext = (): StContext => {
    const ctx = contextHandle.get()
    refreshStubHost(ctx)
    return ctx
  }

  /** 桩模块入口的动态字段（name1/name2/this_chid/characters…）。 */
  const refreshStubHost = (ctx: StContext): void => {
    try {
      stubHost.characters = ctx.characters
      stubHost.chat = ctx.chat
      stubHost.chatId = ctx.chatId
      stubHost.this_chid = ctx.characterId
      stubHost.name1 = ctx.name1
      stubHost.name2 = ctx.name2
      stubHost.main_api = ctx.mainApi
      stubHost.mainApi = ctx.mainApi
      stubHost.onlineStatus = ctx.onlineStatus
      stubHost.isMobile = ctx.isMobile
      stubHost.extension_settings = ctx.extensionSettings
      stubHost.chat_metadata = ctx.chatMetadata
    } catch (e) { console.error('[portable-tavern/st] 刷新桩模块入口失败', e) }
  }

  /** 后台预热扩展清单（getExtensionManifest 未命中时调用）。 */
  const primeManifest = async (id: string): Promise<void> => {
    try {
      const response = await fetch('/tavern-ext/' + encodeURIComponent(id) + '/manifest.json')
      if (!response.ok) return
      const data: unknown = await response.json()
      if (data && typeof data === 'object') contextHandle.cacheManifest(id, data as Record<string, unknown>)
    } catch { /* 没有清单不影响功能 */ }
  }

  // ---- 镜像轮询：面板没显式 emit 时，扩展也能拿到新对话 ----
  /** 同步 #chat 镜像。 */
  const syncMirror = (ctx: StContext): void => {
    if (!skeleton) return
    try {
      const mirror: StMirror = {
        chat: Array.isArray(ctx.chat) ? ctx.chat as StMessage[] : [],
        name1: ctx.name1,
        name2: ctx.name2,
        character: ctx.characters.length > 0 ? ctx.characters[0].data : null,
        chatMetadata: ctx.chatMetadata,
        mainApi: ctx.mainApi,
        onlineStatus: ctx.onlineStatus,
        chatRootId: 'pt-chat-log',
      }
      syncChatMirror(skeleton, mirror, (html: unknown) => libs.DOMPurify.sanitize(html))
    } catch (e) { console.error('[portable-tavern/st] 同步 #chat 镜像失败', e) }
  }

  /** 轮询一次：同步镜像 + 推断事件（对话增长 / 换角色）。 */
  const pollMirror = (): void => {
    if (!installed) return
    const ctx = getContext()
    syncMirror(ctx)
    const chat = Array.isArray(ctx.chat) ? ctx.chat as StMessage[] : []
    const character = ctx.name2 || ''
    if (character !== seenCharacter) {
      const previous = seenCharacter
      seenCharacter = character
      seenChatLength = chat.length
      seenChatId = ctx.chatId
      if (previous !== '\u0000') {
        void emit(event_types.CHAT_CHANGED, ctx.chatId)
        void emit(event_types.CHAT_LOADED, ctx.chatId)
      } else if (character) {
        void emit(event_types.CHAT_CREATED, ctx.chatId)
      }
      return
    }
    if (seenChatLength < 0) { seenChatLength = chat.length; return }
    if (chat.length > seenChatLength) {
      const fresh = chat.slice(seenChatLength)
      seenChatLength = chat.length
      for (let i = 0; i < fresh.length; i++) {
        const message = fresh[i]
        const index = chat.length - fresh.length + i
        const isUser = message && message.is_user === true
        void emit(isUser ? event_types.MESSAGE_SENT : event_types.MESSAGE_RECEIVED, index, 'normal')
        void emit(isUser ? event_types.USER_MESSAGE_RENDERED : event_types.CHARACTER_MESSAGE_RENDERED, index, 'normal')
      }
      return
    }
    if (chat.length < seenChatLength) {
      seenChatLength = chat.length
      void emit(event_types.CHAT_CHANGED, ctx.chatId)
      void emit(event_types.CHAT_LOADED, ctx.chatId)
    }
  }

  /** 启动轮询（install 时）。 */
  const startMirror = (): void => {
    stopMirror()
    seenChatLength = -1
    seenCharacter = '\u0000'
    seenChatId = ''
    try {
      mirrorTimer = window.setInterval(() => { try { pollMirror() } catch (e) { console.error('[portable-tavern/st] 镜像轮询异常', e) } }, MIRROR_INTERVAL_MS)
    } catch (e) { reportError('启动镜像轮询失败', e) }
  }

  /** 停止轮询（dispose 时）。 */
  const stopMirror = (): void => {
    if (mirrorTimer !== null) {
      try { window.clearInterval(mirrorTimer) } catch { /* 忽略 */ }
      mirrorTimer = null
    }
  }

  // ---- 全局注入 / 还原 ----
  /** 写一个全局；force=false 时页面已有同名值就不覆盖。 */
  const setGlobal = (name: string, value: unknown, force: boolean): void => {
    try {
      const win = window as unknown as Record<string, unknown>
      const existing = win[name]
      if (!force && existing !== undefined && existing !== null) {
        notifyOnce('global:' + name, '页面已有 window.' + name + '，兼容宿主不覆盖它')
        return
      }
      if (!previousGlobals.has(name)) previousGlobals.set(name, existing)
      win[name] = value
      if (ownedGlobals.indexOf(name) < 0) ownedGlobals.push(name)
    } catch (e) { reportError('注入全局 ' + name + ' 失败', e) }
  }

  /** dispose 时把全局还原成注入前的样子。 */
  const restoreGlobals = (): void => {
    try {
      const win = window as unknown as Record<string, unknown>
      for (const name of ownedGlobals) {
        const previous = previousGlobals.get(name)
        if (previous === undefined) {
          try { delete win[name] } catch { win[name] = undefined }
        } else {
          win[name] = previous
        }
      }
    } catch (e) { console.error('[portable-tavern/st] 还原全局失败', e) }
    ownedGlobals.length = 0
    previousGlobals.clear()
  }

  /** 组装 window.__tavernSt（桩模块取值入口，键名与 Node 半的约定逐字一致）。 */
  const buildStubHost = (toastr: StToastr): void => {
    const first = contextHandle.peek()
    Object.assign(stubHost, {
      eventSource,
      event_types,
      eventTypes: event_types,
      extension_settings: extensionSettings,
      extensionSettings,
      power_user: first.power_user,
      powerUser: first.powerUser,
      saveSettings: first.saveSettings,
      saveSettingsDebounced: first.saveSettingsDebounced,
      saveMetadata: persistMetadata,
      saveMetadataDebounced: first.saveMetadataDebounced,
      getRequestHeaders: first.getRequestHeaders,
      renderTemplateAsync: first.renderTemplateAsync,
      renderExtensionTemplateAsync: first.renderExtensionTemplateAsync,
      substituteParams: first.substituteParams,
      substituteParamsExtended: first.substituteParamsExtended,
      chat_metadata: chatMetadata,
      chatMetadata,
      isMobile: first.isMobile,
      DOMPurify: libs.DOMPurify,
      Bowser: libs.Bowser,
      accountStorage: first.accountStorage,
      SlashCommandParser: first.SlashCommandParser,
      SlashCommand: first.SlashCommand,
      ARGUMENT_TYPE,
      executeSlashCommands: first.executeSlashCommands,
      callGenericPopup,
      Popup: first.Popup,
      POPUP_TYPE,
      POPUP_RESULT,
      toastr,
      getContext: (): StContext => getContext(),
      libs,
      eventSourceVersion: 'portable-tavern-st',
    })
    // 没有真实实现的：函数型 no-op，保证 typeof x === 'function' 成立
    stubHost.getSlideToggleOptions = noopFunction()
    stubHost.initMovingUI = noopFunction()
    stubHost.favsToHotswap = noopFunction()
    stubHost.renderTemplate = first.renderTemplateAsync
    refreshStubHost(first)
  }

  /** 建立全部兼容全局。 */
  const installGlobals = (): void => {
    try {
      const jq = createJQuery(window, warn)
      setGlobal('$', jq, false)
      setGlobal('jQuery', jq, false)
    } catch (e) { reportError('迷你 jQuery 注入失败', e) }
    setGlobal('_', libs.lodash, false)
    setGlobal('lodash', libs.lodash, false)
    const toastr: StToastr = {
      info: (message: string, title?: string) => toast(joinTitle(title, message), 'info'),
      success: (message: string, title?: string) => toast(joinTitle(title, message), 'success'),
      warning: (message: string, title?: string) => toast(joinTitle(title, message), 'warning'),
      error: (message: string, title?: string) => toast(joinTitle(title, message), 'error'),
      clear: () => { if (skeleton) { try { clearToasts(skeleton) } catch { /* 忽略 */ } } },
    }
    setGlobal('toastr', toastr, true)
    // 深链模块兜底：只在缺失时给一个保守默认（Node 半可以覆盖成自己的桩路由）
    setGlobal('__tavernStStub', (path: string): string => '/api/dsh-portable-tavern/ext/stub?path=' + encodeURIComponent(String(path)), false)
    buildStubHost(toastr)
    setGlobal('__tavernSt', stubHost, true)
    setGlobal('SillyTavern', {
      libs,
      getContext: (): StContext => getContext(),
      eventSource,
      event_types,
      eventTypes: event_types,
      version: 'portable-tavern-st',
    }, true)
  }

  // ---- 全局错误归因 ----
  /** 把加载窗口内的异常归因到正在加载的扩展。 */
  const attributeError = (message: string): void => {
    const load = activeLoad
    if (!load) return
    const text = toStringValue(message)
    if (load.errors.indexOf(text) < 0) load.errors.push(text)
    if (isModuleImportError(text)) {
      const refs = extractModuleRefs(text)
      for (const ref of refs) if (load.stubs.indexOf(ref) < 0) load.stubs.push(ref)
      const exportMatch = /does not provide an export named '?([^'\s]+)'?/.exec(text)
      const detail = exportMatch ? ('缺少导出 ' + exportMatch[1]) : (refs.length > 0 ? ('模块 ' + refs[0]) : '上游模块')
      notifyOnce('import:' + load.id + ':' + detail, '扩展 ' + load.id + ' 的 import 失败：' + detail + '（该上游模块可能没有被 stub，功能会缺失）')
    }
    if (load.settled) load.finish(false, '扩展运行期异常：' + text)
  }

  /** window 'error' 监听。 */
  const onWindowError = (event: ErrorEvent): void => {
    try {
      const error = event && event.error
      const message = (event && event.message) || (error instanceof Error ? error.message : '') || '脚本错误'
      attributeError(String(message))
    } catch (e) { console.error('[portable-tavern/st] error 监听异常', e) }
  }

  /** window 'unhandledrejection' 监听。 */
  const onWindowRejection = (event: PromiseRejectionEvent): void => {
    try {
      const reason = event ? event.reason : undefined
      const message = reason instanceof Error ? reason.message : toStringValue(reason)
      attributeError(message || '未处理的 Promise 拒绝')
    } catch (e) { console.error('[portable-tavern/st] unhandledrejection 监听异常', e) }
  }

  // ---- 加载 / 卸载 ----
  /** 插入扩展样式表（失败只告警，不影响脚本）。 */
  const loadStylesheet = (record: StExtensionRecord, href: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      let done = false
      const finish = (ok: boolean): void => { if (!done) { done = true; resolve(ok) } }
      try {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = resolveUrl(href)
        link.dataset.tavernStExtension = record.id
        link.addEventListener('load', () => finish(true))
        link.addEventListener('error', () => { warn('扩展 ' + record.id + ' 的样式表加载失败：' + href); finish(false) })
        document.head.appendChild(link)
        record.nodes.push(link)
        window.setTimeout(() => finish(true), LOAD_WINDOW_MS)
      } catch (e) {
        reportError('插入扩展样式表失败', e)
        finish(false)
      }
    })
  }

  /** 插入扩展模块脚本并等它 settle（含 3s 归因窗口）。 */
  const loadScript = (record: StExtensionRecord, src: string): Promise<{ ok: boolean; error?: string }> => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      let done = false
      let graceTimer: number | null = null
      let windowTimer: number | null = null
      const settle = (ok: boolean, error?: string): void => {
        if (done) return
        done = true
        if (graceTimer !== null) { try { window.clearTimeout(graceTimer) } catch { /* 忽略 */ } }
        if (windowTimer !== null) { try { window.clearTimeout(windowTimer) } catch { /* 忽略 */ } }
        resolve({ ok, error })
      }
      const state: StActiveLoad = {
        id: record.id,
        errors: record.errors,
        stubs: record.stubs,
        settled: false,
        finish: (ok: boolean, error?: string): void => settle(ok, error),
      }
      activeLoad = state
      const startGrace = (): void => {
        state.settled = true
        graceTimer = window.setTimeout(() => {
          settle(record.errors.length > 0 ? false : true, record.errors.length > 0 ? record.errors[0] : undefined)
        }, LOAD_GRACE_MS)
      }
      try {
        const script = document.createElement('script')
        script.type = 'module'
        script.src = resolveUrl(src)
        script.async = false
        script.dataset.tavernStExtension = record.id
        script.addEventListener('load', () => {
          if (record.errors.length > 0) { settle(false, record.errors[0]); return }
          startGrace()
        })
        script.addEventListener('error', () => {
          const detail = record.errors.length > 0 ? record.errors[0] : ('脚本加载失败（404 / 语法错误 / CSP 拦截）：' + src)
          settle(false, detail)
        })
        document.head.appendChild(script)
        record.nodes.push(script)
        windowTimer = window.setTimeout(() => {
          if (record.errors.length > 0) settle(false, record.errors[0])
          else settle(true)
        }, LOAD_WINDOW_MS)
      } catch (e) {
        reportError('插入扩展脚本失败', e)
        settle(false, '插入脚本失败：' + String(e instanceof Error ? e.message : e))
      }
    })
  }

  /** 加载一个扩展（内部实现，已被串行化）。 */
  const loadOne = async (ext: StExtensionSource): Promise<StLoadResult> => {
    const id = toStringValue(ext && ext.id)
    if (!id) return { ok: false, error: '缺少扩展 id', stubs: [] }
    if (!installed) return { ok: false, error: '兼容宿主尚未 install()，无法加载扩展', stubs: [] }
    if (extensions.has(id)) unload(id)
    const record: StExtensionRecord = {
      id,
      source: { id, js: toStringValue(ext.js), css: toStringValue(ext.css), base: toStringValue(ext.base) },
      nodes: [],
      mountSnapshot: captureMounts(),
      domNodes: [],
      errors: [],
      stubs: [],
      loadedAt: Date.now(),
    }
    extensions.set(id, record)
    eventSource.beginScope(id)
    watcher.begin(id)
    let ok = true
    let error: string | undefined
    try {
      if (record.source.css) {
        const cssOk = await loadStylesheet(record, record.source.css)
        if (!cssOk) warn('扩展 ' + id + ' 的样式表没加载成功（脚本继续）')
      }
      if (!installed || extensions.get(id) !== record) {
        return { ok: false, error: '加载过程中宿主被 dispose', stubs: record.stubs.slice() }
      }
      if (record.source.js) {
        const result = await loadScript(record, record.source.js)
        ok = result.ok
        error = result.error
      }
    } catch (e) {
      ok = false
      error = '加载异常：' + String(e instanceof Error ? e.message : e)
      reportError('加载扩展 ' + id + ' 失败', e)
    } finally {
      activeLoad = null
      watcher.end()
      eventSource.endScope()
      record.domNodes = watcher.nodesOf(id).slice()
      watcher.forget(id)
    }
    if (!ok) warn('扩展 ' + id + ' 加载失败：' + (error || '未知原因'))
    else if (record.errors.length > 0) warn('扩展 ' + id + ' 加载完成，但捕获到 ' + record.errors.length + ' 条异常')
    return { ok, error, stubs: record.stubs.slice() }
  }

  /** 卸载一个扩展（内部实现，install 前的调用被忽略）。 */
  const unload = (id: string): void => {
    const key = toStringValue(id)
    const record = extensions.get(key)
    if (!record) return
    extensions.delete(key)
    try {
      const removedListeners = eventSource.removeByOwner(key)
      let removedNodes = 0
      for (const node of record.nodes) {
        try { if (node.parentNode) { node.parentNode.removeChild(node); removedNodes += 1 } } catch { /* 已移除 */ }
      }
      removedNodes += removeHeadBodyNodes(record.domNodes)
      for (const node of addedChildrenSince(record.mountSnapshot)) {
        try { if (node.parentNode) { node.parentNode.removeChild(node); removedNodes += 1 } } catch { /* 已移除 */ }
      }
      if (skeleton) skeleton.chatSignature = ''
      try { window.dispatchEvent(new CustomEvent('tavern_st_unload', { detail: { id: key } })) } catch { /* 无 CustomEvent */ }
      console.info('[portable-tavern/st] 已卸载扩展 ' + key + '（注销监听器 ' + removedListeners + ' 个，移除节点 ' + removedNodes + ' 个）')
    } catch (e) { reportError('卸载扩展 ' + key + ' 时出错', e) }
  }

  /** 派发一个 ST 事件（消息类事件前先同步 #chat 镜像）。 */
  const emit = async (event: string, ...args: unknown[]): Promise<void> => {
    if (typeof event !== 'string' || !event) return
    try {
      if (event === event_types.MESSAGE_RECEIVED || event === event_types.USER_MESSAGE_RENDERED ||
        event === event_types.CHARACTER_MESSAGE_RENDERED || event === event_types.MESSAGE_SENT) {
        const ctx = getContext()
        syncMirror(ctx)
        if (Array.isArray(ctx.chat)) seenChatLength = ctx.chat.length
      }
      await eventSource.emit(event, ...args)
    } catch (e) { reportError('派发事件 ' + event + ' 失败', e) }
  }

  /** 启动时序事件（settings_* → extension_settings_loaded → extensions_first_load → app_ready）。 */
  const emitInitialEvents = async (): Promise<void> => {
    const sequence: Array<[string, unknown[]]> = [
      [event_types.SETTINGS_LOADED_BEFORE, []],
      [event_types.SETTINGS_LOADED, []],
      [event_types.SETTINGS_LOADED_AFTER, []],
      [event_types.EXTENSION_SETTINGS_LOADED, []],
      [event_types.EXTENSIONS_FIRST_LOAD, []],
      [event_types.MAIN_API_CHANGED, ['dsh']],
      [event_types.ONLINE_STATUS_CHANGED, ['online']],
      [event_types.APP_INITIALIZED, []],
      [event_types.APP_READY, []],
    ]
    for (const entry of sequence) {
      if (!installed) return
      try { await eventSource.emit(entry[0], ...entry[1]) } catch (e) { console.error('[portable-tavern/st] 启动事件派发失败: ' + entry[0], e) }
    }
  }

  // ---- 对外方法 ----
  /** 安装：建骨架、注入全局、启动镜像轮询、补发启动事件（幂等）。 */
  const install = (next: StHostOptions): void => {
    options = next
    if (installed) return
    if (typeof document === 'undefined' || !document.body) {
      reportError('安装兼容宿主失败', new Error('没有 document.body'))
      return
    }
    installed = true
    try {
      skeleton = installSkeleton({
        onSend: (text: string): void => {
          try { if (options) options.onSend(text) } catch (e) { reportError('onSend 回调异常', e) }
        },
        onWarn: warn,
      })
    } catch (e) {
      reportError('创建 DOM 骨架失败（扩展挂载点不可用）', e)
      skeleton = null
    }
    try { installGlobals() } catch (e) { reportError('注入兼容全局失败', e) }
    try { window.addEventListener('error', onWindowError) } catch (e) { reportError('注册 window error 监听失败', e) }
    try { window.addEventListener('unhandledrejection', onWindowRejection) } catch (e) { reportError('注册 unhandledrejection 监听失败', e) }
    startMirror()
    try {
      const ctx = getContext()
      syncMirror(ctx)
      seenChatLength = Array.isArray(ctx.chat) ? ctx.chat.length : 0
    } catch (e) { reportError('首次同步镜像失败', e) }
    window.setTimeout(() => { void emitInitialEvents() }, 0)
  }

  /** 加载：串行化执行（错误归因需要同一时刻只有一个加载窗口）。 */
  const load = (ext: StExtensionSource): Promise<StLoadResult> => {
    const run = loadChain.then(() => loadOne(ext), () => loadOne(ext))
    loadChain = run.then(() => undefined, () => undefined)
    return run
  }

  /** 应用美化主题的 --SmartTheme* 变量块。 */
  const setThemeVars = (css: string | null): void => {
    if (!skeleton) return
    try { applyThemeVars(skeleton, css) } catch (e) { reportError('写入主题变量失败', e) }
  }

  /** 当前已接管的扩展 id。 */
  const loaded = (): string[] => Array.from(extensions.keys())

  /** 卸载全部扩展、还原全局、拆掉骨架。 */
  const dispose = (): void => {
    const wasInstalled = installed
    installed = false
    stopMirror()
    for (const id of Array.from(extensions.keys())) unload(id)
    try { window.removeEventListener('error', onWindowError) } catch { /* 忽略 */ }
    try { window.removeEventListener('unhandledrejection', onWindowRejection) } catch { /* 忽略 */ }
    activeLoad = null
    restoreGlobals()
    try {
      const win = window as unknown as Record<string, unknown>
      if (win.__tavernSt === stubHost) delete win.__tavernSt
    } catch { /* 忽略 */ }
    if (skeleton) {
      try { disposeSkeleton(skeleton) } catch (e) { reportError('拆除 DOM 骨架失败', e) }
      skeleton = null
    }
    options = null
    seenChatLength = -1
    seenCharacter = '\u0000'
    seenChatId = ''
    if (wasInstalled) console.info('[portable-tavern/st] 兼容宿主已卸载')
  }

  return { install, load, unload, emit, setThemeVars, toast, loaded, dispose }
}

/** 拼接 toastr 的 title + message。 */
function joinTitle(title: string | undefined, message: string): string {
  const text = toStringValue(message)
  const head = toStringValue(title)
  return head ? head + '：' + text : text
}




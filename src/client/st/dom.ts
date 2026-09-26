/**
 * 兼容宿主的 DOM 骨架：ST 扩展会 querySelector 一大堆固定 id，这里一次性把挂载点建齐。
 *
 * 结构：
 * - #tavern-st-root（隐藏）          扩展需要但用户不必看见的挂载点（输入框、模板、左右面板…）
 * - #tavern-st-ext-panel（可见）     真正的“扩展面板”，含 #extensionsMenu / #extensions_settings /
 *                                    #extensions_settings2 / #chat 镜像 / #movingDivs；
 *                                    优先挂进酒馆面板提供的 #pt-ext-mount，不存在时降级为右下角浮动坞；
 *                                    MutationObserver 会在 #pt-ext-mount 稍后出现时自动接管。
 * - #tavern-st-toasts                宿主 toast（toastr 契约的落点）
 * - #tavern-theme-vars               setThemeVars 的落点
 *
 * 另外提供加载期 DOM 归属追踪（createDomWatcher）：扩展在加载窗口内插到 head/body/挂载点上的
 * 节点会被记到它名下，unload 时精准移除。
 */

import type { StMirror, StMessage, StToastKind } from './types.ts'
import { escapeHtml } from './libs-pure.ts'

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 酒馆面板提供的扩展挂载容器 id（面板没提供时降级为浮动坞）。 */
export const PT_EXT_MOUNT_ID = 'pt-ext-mount'

/** 隐藏骨架容器 id。 */
export const ST_ROOT_ID = 'tavern-st-root'

/** 可见扩展面板 id。 */
export const ST_EXT_PANEL_ID = 'tavern-st-ext-panel'

/** 降级浮动坞 id。 */
export const ST_EXT_DOCK_ID = 'tavern-st-ext-dock'

/** toast 容器 id。 */
export const ST_TOASTS_ID = 'tavern-st-toasts'

/** 主题变量 style 元素 id。 */
export const ST_THEME_VARS_ID = 'tavern-theme-vars'

/** 骨架样式 style 元素 id。 */
export const ST_STYLE_ID = 'dsh-portable-tavern-st'

/** 骨架 loader 元素 id。 */
export const ST_LOADER_ID = 'tavern-st-loader'

/** 需要快照/清理的挂载点 id（unload 时只清这些容器里的新增子节点）。 */
export const TRACKED_MOUNT_IDS = ['extensions_settings', 'extensions_settings2', 'extensionsMenu', 'movingDivs']

/** 骨架引用集合（宿主内部使用）。 */
export interface StSkeleton {
  /** 隐藏骨架容器。 */
  root: HTMLElement
  /** 可见扩展面板。 */
  extPanel: HTMLElement
  /** 扩展面板的折叠体。 */
  extBody: HTMLElement
  /** 降级浮动坞（只有接管失败时存在）。 */
  dock: HTMLElement | null
  /** #extensions_settings。 */
  extSettings: HTMLElement
  /** #extensions_settings2。 */
  extSettings2: HTMLElement
  /** #extensionsMenu。 */
  extMenu: HTMLElement
  /** #chat 镜像。 */
  chat: HTMLElement
  /** #movingDivs。 */
  movingDivs: HTMLElement
  /** #send_form。 */
  sendForm: HTMLElement
  /** #send_textarea。 */
  sendTextarea: HTMLTextAreaElement
  /** #message_template。 */
  messageTemplate: HTMLElement
  /** #customCSS（style 元素）。 */
  customCss: HTMLStyleElement
  /** #right-nav-panel。 */
  rightNavPanel: HTMLElement
  /** #left-nav-panel。 */
  leftNavPanel: HTMLElement
  /** #top-settings-holder。 */
  topSettingsHolder: HTMLElement
  /** loader 遮罩。 */
  loader: HTMLElement
  /** toast 容器。 */
  toasts: HTMLElement
  /** 主题变量 style 元素。 */
  themeVars: HTMLStyleElement
  /** 骨架样式 style 元素。 */
  style: HTMLStyleElement
  /** #chat 镜像的内容签名（避免每帧重建 DOM）。 */
  chatSignature: string
  /** 面板是否已折叠。 */
  collapsed: boolean
  /** MutationObserver（等 #pt-ext-mount 出现）。 */
  observer: MutationObserver | null
  /** 宿主自己创建的节点（dispose 时逐个移除）。 */
  owned: Node[]
  /** 挂载点点击委托（inline-drawer 展开/收起）。 */
  onClick: (event: Event) => void
  /** 输入镜像的 submit 监听。 */
  onSubmit: (event: Event) => void
  /** 输入镜像的 Enter 监听。 */
  onKeydown: (event: Event) => void
  /** 扩展通过 #send_form 发消息的回调。 */
  onSend: (text: string) => void
}

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

/** 骨架样式文本（数组拼装，避免模板字符串）。 */
function skeletonCss(): string {
  return [
    '#tavern-st-root{position:fixed;left:0;top:0;width:0;height:0;overflow:visible;z-index:0;display:none}',
    '#tavern-st-ext-panel{display:flex;flex-direction:column;gap:8px;font-size:13px;color:#e8e9ec;box-sizing:border-box;',
    '  --SmartThemeBodyColor:#e8e9ec;--SmartThemeEmColor:#9aa0ab;--SmartThemeQuoteColor:#c3c7cf;',
    '  --SmartThemeBlurTintColor:rgba(22,24,29,0.85);--SmartThemeBorderColor:#2e323d;--SmartThemeUserMesBlurTintColor:#2a2f3a;',
    '  --SmartThemeBotMesBlurTintColor:#262b36;--SmartThemeShadowColor:rgba(0,0,0,0.35);--SmartThemeUnderlineColor:#4f7cff;',
    '  --SmartThemeFontSize:13px;--mainFontSize:13px;--white30:rgba(255,255,255,0.3);--black50:rgba(0,0,0,0.5)}',
    '#tavern-st-ext-dock{position:fixed;right:16px;bottom:16px;width:420px;max-width:92vw;max-height:64vh;overflow:auto;',
    '  z-index:1002;background:#16181d;border:1px solid #2e323d;border-radius:12px;padding:10px;box-shadow:0 12px 36px rgba(0,0,0,0.45)}',
    '.tavern-st-ext-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:6px;border-bottom:1px solid #262932}',
    '.tavern-st-ext-title{font-weight:700;font-size:13px}',
    '.tavern-st-ext-hint{color:#6f7683;font-size:11px;flex:1;min-width:120px}',
    '.tavern-st-ext-toggle{background:#2a2f3a;border:1px solid #3a404d;color:#e8e9ec;border-radius:7px;padding:4px 10px;font-size:12px;cursor:pointer}',
    '.tavern-st-ext-body{display:flex;flex-direction:column;gap:8px}',
    '.tavern-st-ext-body.tavern-st-collapsed{display:none}',
    '#extensionsMenu{display:flex;flex-wrap:wrap;gap:6px}',
    '#extensionsMenu:empty{display:none}',
    '#extensions_settings,#extensions_settings2{display:flex;flex-direction:column;gap:8px}',
    '#extensions_settings:empty,#extensions_settings2:empty{display:none}',
    '.tavern-st-mirror{border:1px solid #262932;border-radius:8px;padding:6px 8px;background:#12141a}',
    '.tavern-st-mirror>summary{cursor:pointer;color:#9aa0ab;font-size:12px;user-select:none}',
    '#chat{display:flex;flex-direction:column;gap:8px;padding:8px 0;max-height:46vh;overflow:auto}',
    '.tavern-st-chat-empty{color:#6f7683;font-size:12px;padding:6px 2px}',
    '#chat .mes{display:flex;gap:8px;align-items:flex-start}',
    '#chat .mes .mes_avatar{width:26px;height:26px;border-radius:50%;background:#2a2f3a;color:#fff;font-size:12px;font-weight:700;',
    '  display:flex;align-items:center;justify-content:center;flex:none}',
    '#chat .mes .mes_block{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '#chat .mes .ch_name{font-size:12px;color:#9aa0ab}',
    '#chat .mes .mes_text{white-space:pre-wrap;word-break:break-word;background:#262b36;border-radius:10px;padding:7px 10px;line-height:1.6}',
    '#chat .mes[is_user="true"] .mes_text{background:#2f3b57}',
    '#chat .mes .mes_buttons{display:flex;gap:6px;opacity:0.5}',
    '#chat .mes .mes_buttons>div{width:14px;height:14px;border:1px solid #3a404d;border-radius:4px;cursor:pointer}',
    '#movingDivs{display:flex;flex-direction:column;gap:6px}',
    '#movingDivs:empty{display:none}',
    '.inline-drawer{border:1px solid #262932;border-radius:8px;background:#1b1e25;overflow:hidden;margin-bottom:6px}',
    '.inline-drawer-toggle,.inline-drawer-header{display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:pointer;background:#20242c}',
    '.inline-drawer-content{padding:10px;display:flex;flex-direction:column;gap:8px;color:#d7d9de}',
    '.tavern-st-ext-body .menu_button,#tavern-st-ext-dock .menu_button{background:#2a2f3a;border:1px solid #3a404d;color:#e8e9ec;',
    '  border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer}',
    '.tavern-st-ext-body .menu_button:hover,#tavern-st-ext-dock .menu_button:hover{background:#333947}',
    '.tavern-st-ext-body .text_pole,#tavern-st-ext-dock .text_pole,#tavern-st-ext-body input[type="text"],#tavern-st-ext-dock input[type="text"],',
    '  #tavern-st-ext-body textarea,#tavern-st-ext-dock textarea,#tavern-st-ext-body select,#tavern-st-ext-dock select{',
    '  background:#12141a;border:1px solid #2e323d;color:#e8e9ec;border-radius:7px;padding:6px 9px;font-size:12px;max-width:100%}',
    '.tavern-st-ext-body .checkbox_label,#tavern-st-ext-dock .checkbox_label{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#c3c7cf}',
    '.tavern-st-ext-body .flex-container,#tavern-st-ext-dock .flex-container{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.tavern-st-ext-body .flexBasis48p,#tavern-st-ext-dock .flexBasis48p{flex:1 1 46%;min-width:140px}',
    '.tavern-st-ext-body .gap10,#tavern-st-ext-dock .gap10{gap:10px}',
    '.tavern-st-ext-body .opacity50p,#tavern-st-ext-dock .opacity50p{opacity:0.5}',
    '.tavern-st-ext-body .range-block,#tavern-st-ext-dock .range-block{display:flex;flex-direction:column;gap:4px}',
    '#tavern-st-toasts{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;z-index:2147483000;pointer-events:none}',
    '.tavern-st-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:8px;max-width:360px;background:#1b1e25;color:#e8e9ec;',
    '  border:1px solid #2e323d;border-left-width:3px;border-radius:8px;padding:9px 11px;font-size:12px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,0.4)}',
    '.tavern-st-toast-info{border-left-color:#4f7cff}',
    '.tavern-st-toast-success{border-left-color:#3fbf7f}',
    '.tavern-st-toast-warning{border-left-color:#ffb84d}',
    '.tavern-st-toast-error{border-left-color:#ff6b6b}',
    '.tavern-st-toast-text{flex:1;min-width:0;word-break:break-word}',
    '.tavern-st-toast-close{background:transparent;border:0;color:#9aa0ab;cursor:pointer;font-size:13px;padding:0 2px}',
    '#tavern-st-loader{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(8,9,12,0.45);z-index:2147483001}',
    '#tavern-st-loader.tavern-st-loader-on{display:flex}',
    '.tavern-st-loader-box{background:#16181d;border:1px solid #2e323d;border-radius:10px;padding:14px 18px;color:#e8e9ec;font-size:13px}',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 建一个元素并可选设置 id / class。 */
function mk<K extends keyof HTMLElementTagNameMap>(tag: K, id?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (id) node.id = id
  if (className) node.className = className
  return node
}

/** 取一个已存在的元素，没有就按需创建并挂到 parent（外部同名节点沿用并告警一次）。 */
function ensure(id: string, parent: Element, tag?: string, className?: string, onWarn?: (message: string) => void): HTMLElement {
  const found = document.getElementById(id)
  if (found) {
    if (!parent.contains(found) && onWarn) onWarn('页面已有 #' + id + '（不是兼容宿主建的），沿用该节点作为挂载点')
    return found
  }
  const node = document.createElement(tag || 'div')
  node.id = id
  if (className) node.className = className
  parent.appendChild(node)
  return node
}

// ---------------------------------------------------------------------------
// 骨架安装 / 卸载
// ---------------------------------------------------------------------------

/** installSkeleton 的选项。 */
export interface StSkeletonOptions {
  /** 扩展通过 #send_form 发消息时的回调。 */
  onSend(text: string): void
  /** 非致命问题上报。 */
  onWarn(message: string): void
}

/** 把扩展面板挂进 #pt-ext-mount；不存在时（且允许时）挂进浮动坞。 */
function adoptMount(skel: StSkeleton, createDock: boolean): boolean {
  const mount = document.getElementById(PT_EXT_MOUNT_ID)
  if (mount) {
    if (skel.extPanel.parentNode !== mount) mount.appendChild(skel.extPanel)
    if (skel.dock && skel.dock.parentNode) skel.dock.remove()
    skel.dock = null
    return true
  }
  if (createDock && !skel.dock) {
    const dock = mk('div', ST_EXT_DOCK_ID, 'tavern-st-ext-dock')
    dock.appendChild(skel.extPanel)
    document.body.appendChild(dock)
    skel.dock = dock
    return false
  }
  return false
}

/** 建面板骨架（幂等：已存在则复用并把内容补齐）。 */
export function installSkeleton(options: StSkeletonOptions): StSkeleton {
  const head = document.head
  const body = document.body
  // 1) 样式
  let style = document.getElementById(ST_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = mk('style', ST_STYLE_ID) as HTMLStyleElement
    style.dataset.plugin = 'dsh-portable-tavern-st'
    style.textContent = skeletonCss()
    head.appendChild(style)
  }
  // 2) 隐藏骨架
  const root = ensure(ST_ROOT_ID, body, 'div', undefined, options.onWarn)
  const sendForm = ensure('send_form', root, 'div', undefined, options.onWarn)
  let sendTextarea = document.getElementById('send_textarea') as HTMLTextAreaElement | null
  if (!sendTextarea) {
    sendTextarea = mk('textarea', 'send_textarea') as HTMLTextAreaElement
    sendTextarea.rows = 2
    sendForm.appendChild(sendTextarea)
  }
  const messageTemplate = ensure('message_template', root, 'div', undefined, options.onWarn)
  const customCss = ensure('customCSS', root, 'style', undefined, options.onWarn) as HTMLStyleElement
  const rightNavPanel = ensure('right-nav-panel', root, 'div', undefined, options.onWarn)
  const leftNavPanel = ensure('left-nav-panel', root, 'div', undefined, options.onWarn)
  const topSettingsHolder = ensure('top-settings-holder', root, 'div', undefined, options.onWarn)
  // 3) 可见扩展面板
  let extPanel = document.getElementById(ST_EXT_PANEL_ID)
  if (!extPanel) {
    extPanel = mk('div', ST_EXT_PANEL_ID, 'tavern-st-ext-panel')
    body.appendChild(extPanel)
  }
  extPanel.innerHTML = ''
  const extHead = mk('div', undefined, 'tavern-st-ext-head')
  const extTitle = mk('span', undefined, 'tavern-st-ext-title')
  extTitle.textContent = '扩展面板'
  const extHint = mk('span', undefined, 'tavern-st-ext-hint')
  extHint.textContent = '社区扩展（SillyTavern 兼容）的设置与面板挂载在这里'
  const extToggle = mk('button', undefined, 'tavern-st-ext-toggle')
  extToggle.type = 'button'
  extToggle.textContent = '收起'
  extHead.appendChild(extTitle)
  extHead.appendChild(extHint)
  extHead.appendChild(extToggle)
  const extBody = mk('div', undefined, 'tavern-st-ext-body')
  const extMenu = mk('div', 'extensionsMenu')
  const extSettings = mk('div', 'extensions_settings')
  const extSettings2 = mk('div', 'extensions_settings2')
  const mirror = mk('details', undefined, 'tavern-st-mirror')
  const mirrorSummary = mk('summary')
  mirrorSummary.textContent = '对话镜像 / 浮动挂载点（#chat、#movingDivs）'
  const chat = mk('div', 'chat')
  const movingDivs = mk('div', 'movingDivs')
  mirror.appendChild(mirrorSummary)
  mirror.appendChild(chat)
  mirror.appendChild(movingDivs)
  extBody.appendChild(extMenu)
  extBody.appendChild(extSettings)
  extBody.appendChild(extSettings2)
  extBody.appendChild(mirror)
  extPanel.appendChild(extHead)
  extPanel.appendChild(extBody)
  // 4) toast / loader / 主题变量
  const toasts = ensure(ST_TOASTS_ID, body, 'div', undefined, options.onWarn)
  const loader = ensure(ST_LOADER_ID, body, 'div', undefined, options.onWarn)
  if (!loader.firstChild) {
    const box = mk('div', undefined, 'tavern-st-loader-box')
    box.textContent = '正在加载扩展…'
    loader.appendChild(box)
  }
  let themeVars = document.getElementById(ST_THEME_VARS_ID) as HTMLStyleElement | null
  if (!themeVars) {
    themeVars = mk('style', ST_THEME_VARS_ID) as HTMLStyleElement
    head.appendChild(themeVars)
  }
  const skel: StSkeleton = {
    root,
    extPanel,
    extBody,
    dock: document.getElementById(ST_EXT_DOCK_ID),
    extSettings,
    extSettings2,
    extMenu,
    chat,
    movingDivs,
    sendForm,
    sendTextarea,
    messageTemplate,
    customCss,
    rightNavPanel,
    leftNavPanel,
    topSettingsHolder,
    loader,
    toasts,
    themeVars,
    style,
    chatSignature: '',
    collapsed: false,
    observer: null,
    onSend: options.onSend,
    owned: [root, extPanel, toasts, loader],
    onClick: () => { /* 占位，下面覆盖 */ },
    onSubmit: () => { /* 占位，下面覆盖 */ },
    onKeydown: () => { /* 占位，下面覆盖 */ },
  }
  // 5) inline-drawer 展开/收起（ST 的折叠块靠这个类名）
  skel.onClick = (event: Event): void => {
    const target = event.target as Element | null
    if (!target || typeof target.closest !== 'function') return
    const toggle = target.closest('.inline-drawer-toggle, .inline-drawer-header')
    if (!toggle) return
    const drawer = toggle.parentElement
    if (!drawer) return
    const content = drawer.querySelector('.inline-drawer-content')
    if (!content) return
    const box = content as HTMLElement
    const hidden = box.style.display === 'none' || box.style.display === ''
    box.style.display = hidden ? 'flex' : 'none'
    event.preventDefault()
  }
  document.addEventListener('click', skel.onClick, true)
  // 6) 收起按钮
  extToggle.addEventListener('click', () => {
    skel.collapsed = !skel.collapsed
    extBody.className = skel.collapsed ? 'tavern-st-ext-body tavern-st-collapsed' : 'tavern-st-ext-body'
    extToggle.textContent = skel.collapsed ? '展开' : '收起'
  })
  // 7) 输入镜像：扩展往 #send_textarea 写值并触发 #send_form 的 submit / Enter
  skel.onSubmit = (event: Event): void => {
    event.preventDefault()
    const text = String(skel.sendTextarea.value || '')
    if (!text.trim()) return
    skel.sendTextarea.value = ''
    try { skel.onSend(text) } catch (e) { console.error('[portable-tavern/st] #send_form 回调异常', e) }
  }
  skel.onKeydown = (event: Event): void => {
    const key = (event as KeyboardEvent).key
    if (key !== 'Enter' || (event as KeyboardEvent).shiftKey) return
    event.preventDefault()
    skel.onSubmit(event)
  }
  sendForm.addEventListener('submit', skel.onSubmit)
  sendTextarea.addEventListener('keydown', skel.onKeydown)
  // 8) 面板容器晚出现时自动接管
  adoptMount(skel, true)
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => {
      if (document.getElementById(PT_EXT_MOUNT_ID)) {
        if (adoptMount(skel, false)) observer.disconnect()
      }
    })
    observer.observe(body, { childList: true, subtree: true })
    skel.observer = observer
  }
  return skel
}

/** 拆掉整个骨架（宿主 dispose 时调用）。 */
export function disposeSkeleton(skel: StSkeleton): void {
  try { document.removeEventListener('click', skel.onClick, true) } catch { /* 忽略 */ }
  try { skel.sendForm.removeEventListener('submit', skel.onSubmit) } catch { /* 忽略 */ }
  try { skel.sendTextarea.removeEventListener('keydown', skel.onKeydown) } catch { /* 忽略 */ }
  if (skel.observer) {
    try { skel.observer.disconnect() } catch { /* 忽略 */ }
    skel.observer = null
  }
  for (const node of skel.owned) {
    try { if (node.parentNode) node.parentNode.removeChild(node) } catch { /* 忽略 */ }
  }
  const dock = document.getElementById(ST_EXT_DOCK_ID)
  if (dock && dock.parentNode) { try { dock.parentNode.removeChild(dock) } catch { /* 忽略 */ } }
  for (const id of [ST_THEME_VARS_ID, ST_STYLE_ID]) {
    const node = document.getElementById(id)
    try { if (node && node.parentNode) node.parentNode.removeChild(node) } catch { /* 忽略 */ }
  }
}

// ---------------------------------------------------------------------------
// #chat 镜像
// ---------------------------------------------------------------------------

/** 构造一条 ST 形状的 .mes 节点 HTML（属性名与 ST 一致，扩展的选择器能直接命中）。 */
function mesHtml(msg: StMessage, index: number, mirror: StMirror, sanitize: (html: unknown) => string): string {
  const name = String(msg && msg.name ? msg.name : (msg && msg.is_user ? mirror.name1 : mirror.name2))
  const isUser = msg && msg.is_user === true
  const isSystem = msg && msg.is_system === true
  const raw = msg && typeof msg.mes === 'string' ? msg.mes : ''
  let body = ''
  try { body = sanitize(raw) } catch { body = escapeHtml(raw) }
  const avatar = escapeHtml(name.slice(0, 1) || '?')
  const sendDate = escapeHtml(msg && msg.send_date ? msg.send_date : '')
  const extra = msg && msg.extra && typeof msg.extra === 'object' ? escapeHtml(JSON.stringify(msg.extra)) : '{}'
  return [
    '<div class="mes" mesid="' + index + '" data-mesid="' + index + '" is_user="' + (isUser ? 'true' : 'false') +
      '" is_system="' + (isSystem ? 'true' : 'false') + '" name="' + escapeHtml(name) + '" ch_name="' + escapeHtml(name) +
      '" send_date="' + sendDate + '" mes_extra="' + extra + '">',
    '  <div class="mes_avatar">' + avatar + '</div>',
    '  <div class="mes_block">',
    '    <div class="ch_name"><span class="name_text">' + escapeHtml(name) + '</span></div>',
    '    <div class="mes_text">' + body + '</div>',
    '    <div class="mes_buttons"><div class="mes_edit" title="编辑"></div><div class="mes_delete" title="删除"></div><div class="mes_swipe" title="滑动"></div></div>',
    '  </div>',
    '</div>',
  ].join('\n')
}

/** 计算镜像签名：变了才重建 DOM（避免每帧重排）。 */
function chatSignatureOf(chat: StMessage[], name1: string, name2: string): string {
  const shape = chat.map((msg) => {
    const text = msg && typeof msg.mes === 'string' ? msg.mes : ''
    return (msg && msg.is_user ? 'u' : 'a') + text.length
  }).join(',')
  return [String(chat.length), name1, name2, shape].join('|')
}

/**
 * 把酒馆对话同步进 #chat 镜像节点。
 * 宿主在 emit('message_received' / 'user_message_rendered' / 'character_message_rendered') 前调用；
 * 轮询器也会调用它（面板没显式 emit 时扩展也能看到最新对话）。
 */
export function syncChatMirror(skel: StSkeleton, mirror: StMirror, sanitize: (html: unknown) => string): void {
  const host = skel.chat
  if (!host) return
  const chat = mirror && Array.isArray(mirror.chat) ? mirror.chat : []
  const signature = chatSignatureOf(chat, mirror ? mirror.name1 : '', mirror ? mirror.name2 : '')
  if (signature === skel.chatSignature) return
  skel.chatSignature = signature
  const parts: string[] = []
  for (let i = 0; i < chat.length; i++) parts.push(mesHtml(chat[i], i, mirror, sanitize))
  if (parts.length === 0) {
    parts.push('<div class="tavern-st-chat-empty">暂无对话：在酒馆面板开始聊天后，这里会同步成 ST 形状的 #chat 镜像。</div>')
  }
  host.innerHTML = parts.join('\n')
}

// ---------------------------------------------------------------------------
// toast / loader / 主题变量
// ---------------------------------------------------------------------------

/** 弹一条宿主 toast（toastr 契约的落点），ttl 毫秒后自动消失。 */
export function showToast(skel: StSkeleton, message: string, kind: StToastKind = 'info', ttl = 4200): void {
  try {
    const node = mk('div', undefined, 'tavern-st-toast tavern-st-toast-' + kind)
    const text = mk('span', undefined, 'tavern-st-toast-text')
    text.textContent = String(message === undefined || message === null ? '' : message)
    const close = mk('button', undefined, 'tavern-st-toast-close')
    close.type = 'button'
    close.textContent = '×'
    close.addEventListener('click', () => { if (node.parentNode) node.parentNode.removeChild(node) })
    node.appendChild(text)
    node.appendChild(close)
    skel.toasts.appendChild(node)
    if (ttl > 0) {
      window.setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node) }, ttl)
    }
  } catch (e) {
    console.error('[portable-tavern/st] toast 渲染失败', e)
  }
}

/** 清空全部 toast。 */
export function clearToasts(skel: StSkeleton): void {
  try { skel.toasts.innerHTML = '' } catch { /* 忽略 */ }
}

/** 显示/隐藏骨架 loader（ST 的 loader.show/hide 落点）。 */
export function setLoader(skel: StSkeleton, visible: boolean): void {
  try { skel.loader.className = visible ? 'tavern-st-loader-on' : '' } catch { /* 忽略 */ }
}

/** 写入主题变量块（null 清空）。 */
export function applyThemeVars(skel: StSkeleton, css: string | null): void {
  try { skel.themeVars.textContent = css ? String(css) : '' } catch { /* 忽略 */ }
}

// ---------------------------------------------------------------------------
// 加载期 DOM 归属追踪
// ---------------------------------------------------------------------------

/** 加载期 DOM 归属追踪器：把扩展插到 head/body 的节点记到它名下，unload 时移除。 */
export interface StDomWatcher {
  /** 开启加载窗口。 */
  begin(owner: string): void
  /** 关闭加载窗口。 */
  end(): void
  /** 当前归属（'' = 无）。 */
  owner(): string
  /** owner 名下记录到的节点。 */
  nodesOf(owner: string): Node[]
  /** 清掉 owner 的记录。 */
  forget(owner: string): void
}

/** 当前加载窗口归属的扩展 id。 */
let watcherOwner = ''

/** owner -> 它插入 head/body 的节点。 */
const watcherNodes = new Map<string, Node[]>()

/** DOM 插入补丁是否已打过（全局只打一次）。 */
let domPatched = false

/** 只有 head / body 直接子节点才算“扩展塞进页面的东西”。 */
function isRecordableParent(parent: Node | null): boolean {
  if (!parent || typeof document === 'undefined') return false
  return parent === document.head || parent === document.body
}

/** 记录一个归属节点（内部）。 */
function recordNode(node: unknown, parent: Node | null): void {
  if (!watcherOwner) return
  if (!node || typeof node !== 'object') return
  if ((node as Node).nodeType !== 1) return
  if (!isRecordableParent(parent)) return
  const list = watcherNodes.get(watcherOwner) || []
  if (list.length >= 500) return
  if (list.indexOf(node as Node) >= 0) return
  list.push(node as Node)
  watcherNodes.set(watcherOwner, list)
}

/** 给一个 DOM 方法打补丁，把新插入的节点记入归属（内部）。 */
function wrapMethod(proto: any, key: string, pick: (args: any[]) => unknown[]): void {
  if (!proto) return
  const orig = proto[key]
  if (typeof orig !== 'function' || orig.__tavernStWrapped === true) return
  const wrapped = function (this: any, ...args: any[]): any {
    const result = orig.apply(this, args)
    try {
      const picked = pick(args)
      for (const node of picked) recordNode(node, this as Node)
    } catch { /* 记录失败不能影响 DOM 操作本身 */ }
    return result
  }
  wrapped.__tavernStWrapped = true
  proto[key] = wrapped
}

/** 打一次补丁：appendChild / insertBefore / append / prepend / after / before / insertAdjacentElement。 */
function patchDomOnce(): void {
  if (domPatched) return
  domPatched = true
  try {
    const nodeProto = typeof Node !== 'undefined' ? (Node.prototype as any) : undefined
    const elementProto = typeof Element !== 'undefined' ? (Element.prototype as any) : undefined
    const documentProto = typeof Document !== 'undefined' ? (Document.prototype as any) : undefined
    wrapMethod(nodeProto, 'appendChild', (args) => [args[0]])
    wrapMethod(nodeProto, 'insertBefore', (args) => [args[0]])
    wrapMethod(nodeProto, 'replaceChild', (args) => [args[0]])
    for (const proto of [elementProto, documentProto]) {
      wrapMethod(proto, 'append', (args) => args)
      wrapMethod(proto, 'prepend', (args) => args)
      wrapMethod(proto, 'replaceChildren', (args) => args)
    }
    wrapMethod(elementProto, 'after', (args) => args)
    wrapMethod(elementProto, 'before', (args) => args)
    wrapMethod(elementProto, 'insertAdjacentElement', (args) => [args[1]])
  } catch (e) {
    console.error('[portable-tavern/st] DOM 归属追踪补丁失败', e)
  }
}

/** 创建一个 DOM 归属追踪器（页面级单例状态，宿主只需要一个）。 */
export function createDomWatcher(): StDomWatcher {
  patchDomOnce()
  return {
    begin: (owner: string): void => { watcherOwner = owner || '' },
    end: (): void => { watcherOwner = '' },
    owner: (): string => watcherOwner,
    nodesOf: (owner: string): Node[] => (watcherNodes.get(owner) || []).slice(),
    forget: (owner: string): void => { watcherNodes.delete(owner) },
  }
}

/** 移除一批节点中“直接挂在 head/body 上”的那些，返回移除数量。 */
export function removeHeadBodyNodes(nodes: Node[]): number {
  let removed = 0
  for (const node of nodes) {
    try {
      if (node.parentNode && isRecordableParent(node.parentNode)) {
        node.parentNode.removeChild(node)
        removed += 1
      }
    } catch { /* 已被移除 */ }
  }
  return removed
}

/** 快照被跟踪挂载点的子节点（load 前调用）。 */
export function captureMounts(): Array<[Element, Node[]]> {
  const out: Array<[Element, Node[]]> = []
  for (const id of TRACKED_MOUNT_IDS) {
    const node = document.getElementById(id)
    if (!node) continue
    const children: Node[] = []
    for (let i = 0; i < node.childNodes.length; i++) children.push(node.childNodes[i])
    out.push([node, children])
  }
  return out
}

/** 相对快照新增的子节点（unload 时调用，涵盖 innerHTML / insertAdjacentHTML 写法）。 */
export function addedChildrenSince(snapshot: Array<[Element, Node[]]>): Node[] {
  const out: Node[] = []
  for (const entry of snapshot) {
    const node = entry[0]
    const before = entry[1]
    try {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i]
        if (before.indexOf(child) < 0) out.push(child)
      }
    } catch { /* 容器已被移除 */ }
  }
  return out
}



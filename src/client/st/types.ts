/**
 * 兼容宿主的公共类型面：StMessage / StMirror / StHostOptions / StLoadResult / StHost / StToastr。
 *
 * 这里只放类型与常量，不含运行时逻辑；文件路径 src/client/st/types.ts。
 * 接口文档与任务书逐字对齐（英文原文即契约），中文补充说明实现细节。
 */

/** 一条 ST 形态的聊天记录（宿主把酒馆对话映射成这个形状）。 */
export interface StMessage {
  /** 显示名（{{user}} 或角色名）。 */
  name: string
  /** 消息正文（可含 HTML，宿主渲染前会过一遍 DOMPurify）。 */
  mes: string
  /** 是否用户消息。 */
  is_user: boolean
  /** 是否系统消息。 */
  is_system: boolean
  /** 发送时间；宿主使用 'YYYY-MM-DD HH:mm' 形态的字符串。 */
  send_date: string
  /** 附加数据（扩展常往里塞东西，宿主原样保留）。 */
  extra: Record<string, unknown>
}

/** Live mirror of the tavern's own state that extensions read through getContext(). */
export interface StMirror {
  /** Chat transcript, ST shape: { name, mes, is_user, is_system, send_date, extra }. */
  chat: StMessage[]
  /** Display name of {{user}}. */
  name1: string
  /** Display name of the current character. */
  name2: string
  /** Current character card data (ST 'characters[this_chid].data' shape) or null. */
  character: Record<string, unknown> | null
  /** Free-form metadata bag persisted with the session. */
  chatMetadata: Record<string, unknown>
  /** API label, always 'dsh' here. */
  mainApi: string
  /** Always true; the tavern is local. */
  onlineStatus: string
  /** DOM id of the tavern chat log used as the #chat mirror. */
  chatRootId: string
  /**
   * 可选：会话稳定标识。酒馆面板可以不提供，宿主会用角色名派生一个；
   * 提供了就原样透传给 getContext().chatId。
   */
  chatId?: string
}

/** 宿主 toast 的种类。 */
export type StToastKind = 'info' | 'success' | 'warning' | 'error'

/** 宿主回调集合：酒馆面板通过它把实时状态与副作用接进来。 */
export interface StHostOptions {
  /** Read the live mirror; called on every getContext(). */
  getContext(): StMirror
  /** An extension asked to send a chat message as {{user}}. */
  onSend(text: string): void
  /** Persist extension_settings (debounced by the host). */
  onSettings(settings: Record<string, unknown>): void
  /** Report a non-fatal problem to the tavern UI. */
  onWarn(message: string): void
}

/** Result of loading one extension. */
export interface StLoadResult {
  /** 是否加载成功（脚本 load 事件到达且未捕获到归因异常）。 */
  ok: boolean
  /** 失败原因（含归因到的模块导入错误）。 */
  error?: string
  /** Upstream ST modules the extension imported that were replaced by stubs. */
  stubs: string[]
}

/** 一个扩展的加载描述。 */
export interface StExtensionSource {
  /** 扩展 id（目录名）。 */
  id: string
  /** 入口脚本 URL（相对页面或绝对；空串 = 纯 CSS 扩展）。 */
  js: string
  /** 样式表 URL（空串 = 无样式）。 */
  css: string
  /** 扩展根 URL，模板/清单请求基于它。 */
  base: string
}

/** ST 的 toastr 契约（转发到宿主 toast）。 */
export interface StToastr {
  /** 普通提示。 */
  info(message: string, title?: string): void
  /** 成功提示。 */
  success(message: string, title?: string): void
  /** 警告提示。 */
  warning(message: string, title?: string): void
  /** 错误提示。 */
  error(message: string, title?: string): void
  /** 清空全部提示。 */
  clear(): void
  /** toastr 的兼容字段（扩展偶尔会读）。 */
  options?: Record<string, unknown>
}

/** 宿主实例面（酒馆面板只依赖这一组方法）。 */
export interface StHost {
  /** Create globals + DOM skeleton. Idempotent. */
  install(options: StHostOptions): void
  /** Load one extension (js/css are URLs relative to the page). */
  load(ext: StExtensionSource): Promise<StLoadResult>
  /** Unload one extension: dispose its event listeners, styles and panels. */
  unload(id: string): void
  /** Emit one SillyTavern event to every loaded extension. */
  emit(event: string, ...args: unknown[]): Promise<void>
  /** Apply the --SmartTheme* variable block of the active beautification theme. */
  setThemeVars(css: string | null): void
  /** Show a toast (ST's toastr contract). */
  toast(message: string, kind?: StToastKind): void
  /** Ids currently loaded. */
  loaded(): string[]
  /** Remove every global, style and DOM node this host created. */
  dispose(): void
}

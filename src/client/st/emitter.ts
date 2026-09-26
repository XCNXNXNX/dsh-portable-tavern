/**
 * SillyTavern eventSource 的完整复刻（纯逻辑，不依赖 DOM，可被 node 直接 import）。
 *
 * 关键语义（与上游 ST 对齐）：
 * - emit 是 async 的：按注册顺序逐个 await 监听器；
 * - 单个监听器抛错只走 console.error，不影响其他监听器，也不会 reject 调用方；
 * - APP_READY / APP_INITIALIZED 记住最后一次参数，之后任何 on/once 注册都会立刻
 *   用该参数调用一次（晚加载的扩展因此也能拿到初始化时机）；
 * - makeFirst 的监听器永远排在最前，makeLast 的永远排在最后，普通 on 插在两者之间；
 * - emit 期间新注册的监听器不参与本轮派发（与 ST 的 slice 行为一致）。
 *
 * 本文件只含可擦除语法，node --experimental-strip-types 可直接 import（见 __selftest.mjs）。
 */

/** 事件监听器签名；返回值会被 emitAndWait 收集。 */
export type StEventListener = (...args: any[]) => any

/**
 * ST 事件名常量表。键为 ST 的真实常量名，值为 ST 的真实字符串事件名；
 * 同时包含历史别名（如 CHAT_CHANGED / CHATCREATED），保证扩展两种写法都能用。
 */
export const event_types = {
  APP_READY: 'app_ready',
  APP_INITIALIZED: 'app_initialized',
  EXTRAS_CONNECTED: 'extras_connected',
  CHAT_CHANGED: 'chat_id_changed',
  CHAT_ID_CHANGED: 'chat_id_changed',
  CHAT_LOADED: 'chatLoaded',
  CHAT_CREATED: 'chat_created',
  CHATCREATED: 'chat_created',
  CHAT_RENAMED: 'chat_renamed',
  CHAT_DELETED: 'chat_deleted',
  GROUP_CHAT_DELETED: 'group_chat_deleted',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_UPDATED: 'message_updated',
  MESSAGE_SWIPED: 'message_swiped',
  MESSAGE_FILE_EMBEDDED: 'message_file_embedded',
  USER_MESSAGE_RENDERED: 'user_message_rendered',
  CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
  IMPERSONATE_READY: 'impersonate_ready',
  GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
  GENERATION_STARTED: 'generation_started',
  GENERATION_STOPPED: 'generation_stopped',
  GENERATION_ENDED: 'generation_ended',
  STREAM_TOKEN_RECEIVED: 'stream_token_received',
  TOOL_CALLS_PERFORMED: 'tool_calls_performed',
  TOOL_CALLS_RENDERED: 'tool_calls_rendered',
  SETTINGS_LOADED: 'settings_loaded',
  SETTINGS_LOADED_BEFORE: 'settings_loaded_before',
  SETTINGS_LOADED_AFTER: 'settings_loaded_after',
  SETTINGS_UPDATED: 'settings_updated',
  EXTENSION_SETTINGS_LOADED: 'extension_settings_loaded',
  EXTENSIONS_FIRST_LOAD: 'extensions_first_load',
  GROUP_UPDATED: 'group_updated',
  WORLDINFO_UPDATED: 'worldinfo_updated',
  WORLDINFO_ENTRIES_LOADED: 'worldinfo_entries_loaded',
  CHARACTER_EDITED: 'character_edited',
  CHARACTER_DELETED: 'character_deleted',
  CHARACTER_DUPLICATED: 'character_duplicated',
  CHARACTER_MANAGEMENT_OPENED: 'character_management_opened',
  PERSONA_CHANGED: 'persona_changed',
  MAIN_API_CHANGED: 'main_api_changed',
  ONLINE_STATUS_CHANGED: 'online_status_changed',
  FORCE_SET_BACKGROUND: 'force_set_background',
  MOVABLE_PANELS_RESET: 'movable_panels_reset',
  PRESET_CHANGED: 'preset_changed',
} as const

/** event_types 的别名（部分扩展用 eventTypes 这个名字）。 */
export const eventTypes = event_types

/** 需要“补发最后一次参数”的事件（晚加载扩展的初始化时机）。 */
export const REPLAY_EVENTS: readonly string[] = [event_types.APP_READY, event_types.APP_INITIALIZED]

/** 一条监听器记录（导出仅为测试与调试用）。 */
export interface StListenerRecord {
  /** 监听函数。 */
  fn: StEventListener
  /** 是否只触发一次。 */
  once: boolean
  /** 归属的扩展 id（空串表示宿主自身）。 */
  owner: string
  /** makeFirst 注册的监听器。 */
  first: boolean
  /** makeLast 注册的监听器。 */
  last: boolean
}

/** 计算监听器列表的插入位置：first 段之后、last 段之前。 */
function insertRecord(records: StListenerRecord[], rec: StListenerRecord): void {
  if (rec.first) {
    let i = 0
    while (i < records.length && records[i].first) i++
    records.splice(i, 0, rec)
    return
  }
  if (rec.last) {
    records.push(rec)
    return
  }
  let at = records.length
  for (let i = 0; i < records.length; i++) {
    if (records[i].last) { at = i; break }
  }
  records.splice(at, 0, rec)
}

/**
 * 与 ST 同语义的事件总线。宿主全局只用一个实例，扩展通过
 * getContext().eventSource 拿到它。
 */
export class StEventSource {
  /** 事件名 -> 监听器列表。 */
  _records: Record<string, StListenerRecord[]> = {}
  /** onAny 注册的监听器。 */
  _any: StListenerRecord[] = []
  /** 需要补发的事件 -> 最后一次 emit 的参数。 */
  _last: Record<string, unknown[]> = {}
  /** 当前加载窗口归属的扩展 id；期间注册的监听器都记在它名下。 */
  _owner = ''

  /** 注册一个持久监听器。 */
  on(event: string, listener: StEventListener, once = false): void {
    if (typeof event !== 'string' || typeof listener !== 'function') return
    const rec: StListenerRecord = { fn: listener, once, owner: this._owner, first: false, last: false }
    const list = this._records[event] || (this._records[event] = [])
    if (once && this._last[event] && REPLAY_EVENTS.indexOf(event) >= 0) {
      // 补发场景下 once 只调用一次，不再进列表
      void this._call(rec, event, this._last[event])
      return
    }
    insertRecord(list, rec)
    this._replay(event, rec)
  }

  /** 注册只触发一次的监听器。 */
  once(event: string, listener: StEventListener): void {
    this.on(event, listener, true)
  }

  /** 注册监听器并排到所有普通监听器之前。 */
  makeFirst(event: string, listener: StEventListener): void {
    if (typeof event !== 'string' || typeof listener !== 'function') return
    const list = this._records[event] || (this._records[event] = [])
    const rec: StListenerRecord = { fn: listener, once: false, owner: this._owner, first: true, last: false }
    insertRecord(list, rec)
    this._replay(event, rec)
  }

  /** 注册监听器并排到所有普通监听器之后。 */
  makeLast(event: string, listener: StEventListener): void {
    if (typeof event !== 'string' || typeof listener !== 'function') return
    const list = this._records[event] || (this._records[event] = [])
    const rec: StListenerRecord = { fn: listener, once: false, owner: this._owner, first: false, last: true }
    insertRecord(list, rec)
    this._replay(event, rec)
  }

  /** 注册一个“任何事件都会收到”的监听器（参数为 event 名 + 原参数）。 */
  onAny(listener: StEventListener): void {
    if (typeof listener !== 'function') return
    this._any.push({ fn: listener, once: false, owner: this._owner, first: false, last: false })
  }

  /** 注销 onAny 监听器。 */
  offAny(listener: StEventListener): void {
    this._any = this._any.filter((rec) => rec.fn !== listener)
  }

  /** 注销一个监听器（on / once / makeFirst / makeLast 注册的都能注销）。 */
  removeListener(event: string, listener: StEventListener): void {
    const list = this._records[event]
    if (!list) return
    this._records[event] = list.filter((rec) => rec.fn !== listener)
  }

  /** removeListener 的别名。 */
  off(event: string, listener: StEventListener): void {
    this.removeListener(event, listener)
  }

  /** 清空监听器；带 event 只清该事件。 */
  removeAllListeners(event?: string): void {
    if (typeof event === 'string') {
      delete this._records[event]
      return
    }
    this._records = {}
    this._any = []
  }

  /** 派发一个事件；按注册顺序逐个 await，异常全部吞掉并 console.error。 */
  async emit(event: string, ...args: unknown[]): Promise<void> {
    await this.emitAndWait(event, ...args)
  }

  /** 与 emit 相同，但返回每个监听器的返回值数组。 */
  async emitAndWait(event: string, ...args: unknown[]): Promise<unknown[]> {
    if (typeof event !== 'string') return []
    const results: unknown[] = []
    if (REPLAY_EVENTS.indexOf(event) >= 0) this._last[event] = args.slice()
    const list = (this._records[event] || []).slice()
    for (const rec of list) {
      if (rec.once) this._removeRecord(event, rec)
      results.push(await this._call(rec, event, args))
    }
    for (const rec of this._any.slice()) {
      results.push(await this._call(rec, event, ([event] as unknown[]).concat(args)))
    }
    return results
  }

  /**
   * 等待某个事件满足条件（predicate 可省略 = 第一次触发即完成）。
   * timeout > 0 时超时会 reject；否则一直等。
   */
  waitUntil(event: string, predicate?: (...args: any[]) => boolean, timeout?: number): Promise<unknown[]> {
    return new Promise<unknown[]>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      const cleanup = (): void => {
        this.removeListener(event, handler)
        if (timer !== null) clearTimeout(timer)
      }
      const handler: StEventListener = (...args: unknown[]) => {
        if (typeof predicate === 'function') {
          let ok = false
          try { ok = !!predicate(...args) } catch { ok = false }
          if (!ok) return
        }
        cleanup()
        resolve(args)
      }
      this.on(event, handler)
      if (typeof timeout === 'number' && timeout > 0) {
        timer = setTimeout(() => {
          cleanup()
          reject(new Error('waitUntil 超时：' + event))
        }, timeout)
      }
    })
  }

  /** 该事件当前监听器数量。 */
  listenerCount(event: string): number {
    return (this._records[event] || []).length
  }

  /** 当前有监听器的事件名列表。 */
  eventNames(): string[] {
    return Object.keys(this._records)
  }

  /** 该事件是否已经 emit 过（用于判断补发是否可用）。 */
  hasEmitted(event: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._last, event)
  }

  /** 该事件最后一次 emit 的参数（没有则 null）。 */
  lastArgs(event: string): unknown[] | null {
    return this._last[event] || null
  }

  /** 开启加载窗口：期间注册的监听器归属 owner（扩展 id）。 */
  beginScope(owner: string): void {
    this._owner = owner || ''
  }

  /** 关闭加载窗口。 */
  endScope(): void {
    this._owner = ''
  }

  /** 按归属批量注销（unload 一个扩展时调用），返回注销条数。 */
  removeByOwner(owner: string): number {
    let removed = 0
    for (const event of Object.keys(this._records)) {
      const before = this._records[event].length
      this._records[event] = this._records[event].filter((rec) => rec.owner !== owner)
      removed += before - this._records[event].length
    }
    const anyBefore = this._any.length
    this._any = this._any.filter((rec) => rec.owner !== owner)
    removed += anyBefore - this._any.length
    return removed
  }

  /** 归属统计，诊断用。 */
  ownerStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    const bump = (owner: string): void => { stats[owner || '(host)'] = (stats[owner || '(host)'] || 0) + 1 }
    for (const event of Object.keys(this._records)) for (const rec of this._records[event]) bump(rec.owner)
    for (const rec of this._any) bump(rec.owner)
    return stats
  }

  /** 内部：补发最后一次参数（仅 REPLAY_EVENTS）。 */
  _replay(event: string, rec: StListenerRecord): void {
    if (REPLAY_EVENTS.indexOf(event) < 0) return
    const last = this._last[event]
    if (!last) return
    void this._call(rec, event, last)
  }

  /** 内部：调用一个监听器，异常吞掉并 console.error。 */
  async _call(rec: StListenerRecord, event: string, args: unknown[]): Promise<unknown> {
    try {
      return await rec.fn(...args)
    } catch (e) {
      try { console.error('[portable-tavern/st] 事件监听器异常 (' + event + ')', e) } catch { /* 无 console */ }
      return undefined
    }
  }

  /** 内部：从列表移除一条记录。 */
  _removeRecord(event: string, rec: StListenerRecord): void {
    const list = this._records[event]
    if (!list) return
    const i = list.indexOf(rec)
    if (i >= 0) list.splice(i, 1)
  }
}

/** 创建一个新的事件总线（宿主全局只用一个）。 */
export function createEventSource(): StEventSource {
  return new StEventSource()
}

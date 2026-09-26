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
export type StEventListener = (...args: any[]) => any;
/**
 * ST 事件名常量表。键为 ST 的真实常量名，值为 ST 的真实字符串事件名；
 * 同时包含历史别名（如 CHAT_CHANGED / CHATCREATED），保证扩展两种写法都能用。
 */
export declare const event_types: {
    readonly APP_READY: "app_ready";
    readonly APP_INITIALIZED: "app_initialized";
    readonly EXTRAS_CONNECTED: "extras_connected";
    readonly CHAT_CHANGED: "chat_id_changed";
    readonly CHAT_ID_CHANGED: "chat_id_changed";
    readonly CHAT_LOADED: "chatLoaded";
    readonly CHAT_CREATED: "chat_created";
    readonly CHATCREATED: "chat_created";
    readonly CHAT_RENAMED: "chat_renamed";
    readonly CHAT_DELETED: "chat_deleted";
    readonly GROUP_CHAT_DELETED: "group_chat_deleted";
    readonly MESSAGE_SENT: "message_sent";
    readonly MESSAGE_RECEIVED: "message_received";
    readonly MESSAGE_EDITED: "message_edited";
    readonly MESSAGE_DELETED: "message_deleted";
    readonly MESSAGE_UPDATED: "message_updated";
    readonly MESSAGE_SWIPED: "message_swiped";
    readonly MESSAGE_FILE_EMBEDDED: "message_file_embedded";
    readonly USER_MESSAGE_RENDERED: "user_message_rendered";
    readonly CHARACTER_MESSAGE_RENDERED: "character_message_rendered";
    readonly IMPERSONATE_READY: "impersonate_ready";
    readonly GENERATION_AFTER_COMMANDS: "GENERATION_AFTER_COMMANDS";
    readonly GENERATION_STARTED: "generation_started";
    readonly GENERATION_STOPPED: "generation_stopped";
    readonly GENERATION_ENDED: "generation_ended";
    readonly STREAM_TOKEN_RECEIVED: "stream_token_received";
    readonly TOOL_CALLS_PERFORMED: "tool_calls_performed";
    readonly TOOL_CALLS_RENDERED: "tool_calls_rendered";
    readonly SETTINGS_LOADED: "settings_loaded";
    readonly SETTINGS_LOADED_BEFORE: "settings_loaded_before";
    readonly SETTINGS_LOADED_AFTER: "settings_loaded_after";
    readonly SETTINGS_UPDATED: "settings_updated";
    readonly EXTENSION_SETTINGS_LOADED: "extension_settings_loaded";
    readonly EXTENSIONS_FIRST_LOAD: "extensions_first_load";
    readonly GROUP_UPDATED: "group_updated";
    readonly WORLDINFO_UPDATED: "worldinfo_updated";
    readonly WORLDINFO_ENTRIES_LOADED: "worldinfo_entries_loaded";
    readonly CHARACTER_EDITED: "character_edited";
    readonly CHARACTER_DELETED: "character_deleted";
    readonly CHARACTER_DUPLICATED: "character_duplicated";
    readonly CHARACTER_MANAGEMENT_OPENED: "character_management_opened";
    readonly PERSONA_CHANGED: "persona_changed";
    readonly MAIN_API_CHANGED: "main_api_changed";
    readonly ONLINE_STATUS_CHANGED: "online_status_changed";
    readonly FORCE_SET_BACKGROUND: "force_set_background";
    readonly MOVABLE_PANELS_RESET: "movable_panels_reset";
    readonly PRESET_CHANGED: "preset_changed";
};
/** event_types 的别名（部分扩展用 eventTypes 这个名字）。 */
export declare const eventTypes: {
    readonly APP_READY: "app_ready";
    readonly APP_INITIALIZED: "app_initialized";
    readonly EXTRAS_CONNECTED: "extras_connected";
    readonly CHAT_CHANGED: "chat_id_changed";
    readonly CHAT_ID_CHANGED: "chat_id_changed";
    readonly CHAT_LOADED: "chatLoaded";
    readonly CHAT_CREATED: "chat_created";
    readonly CHATCREATED: "chat_created";
    readonly CHAT_RENAMED: "chat_renamed";
    readonly CHAT_DELETED: "chat_deleted";
    readonly GROUP_CHAT_DELETED: "group_chat_deleted";
    readonly MESSAGE_SENT: "message_sent";
    readonly MESSAGE_RECEIVED: "message_received";
    readonly MESSAGE_EDITED: "message_edited";
    readonly MESSAGE_DELETED: "message_deleted";
    readonly MESSAGE_UPDATED: "message_updated";
    readonly MESSAGE_SWIPED: "message_swiped";
    readonly MESSAGE_FILE_EMBEDDED: "message_file_embedded";
    readonly USER_MESSAGE_RENDERED: "user_message_rendered";
    readonly CHARACTER_MESSAGE_RENDERED: "character_message_rendered";
    readonly IMPERSONATE_READY: "impersonate_ready";
    readonly GENERATION_AFTER_COMMANDS: "GENERATION_AFTER_COMMANDS";
    readonly GENERATION_STARTED: "generation_started";
    readonly GENERATION_STOPPED: "generation_stopped";
    readonly GENERATION_ENDED: "generation_ended";
    readonly STREAM_TOKEN_RECEIVED: "stream_token_received";
    readonly TOOL_CALLS_PERFORMED: "tool_calls_performed";
    readonly TOOL_CALLS_RENDERED: "tool_calls_rendered";
    readonly SETTINGS_LOADED: "settings_loaded";
    readonly SETTINGS_LOADED_BEFORE: "settings_loaded_before";
    readonly SETTINGS_LOADED_AFTER: "settings_loaded_after";
    readonly SETTINGS_UPDATED: "settings_updated";
    readonly EXTENSION_SETTINGS_LOADED: "extension_settings_loaded";
    readonly EXTENSIONS_FIRST_LOAD: "extensions_first_load";
    readonly GROUP_UPDATED: "group_updated";
    readonly WORLDINFO_UPDATED: "worldinfo_updated";
    readonly WORLDINFO_ENTRIES_LOADED: "worldinfo_entries_loaded";
    readonly CHARACTER_EDITED: "character_edited";
    readonly CHARACTER_DELETED: "character_deleted";
    readonly CHARACTER_DUPLICATED: "character_duplicated";
    readonly CHARACTER_MANAGEMENT_OPENED: "character_management_opened";
    readonly PERSONA_CHANGED: "persona_changed";
    readonly MAIN_API_CHANGED: "main_api_changed";
    readonly ONLINE_STATUS_CHANGED: "online_status_changed";
    readonly FORCE_SET_BACKGROUND: "force_set_background";
    readonly MOVABLE_PANELS_RESET: "movable_panels_reset";
    readonly PRESET_CHANGED: "preset_changed";
};
/** 需要“补发最后一次参数”的事件（晚加载扩展的初始化时机）。 */
export declare const REPLAY_EVENTS: readonly string[];
/** 一条监听器记录（导出仅为测试与调试用）。 */
export interface StListenerRecord {
    /** 监听函数。 */
    fn: StEventListener;
    /** 是否只触发一次。 */
    once: boolean;
    /** 归属的扩展 id（空串表示宿主自身）。 */
    owner: string;
    /** makeFirst 注册的监听器。 */
    first: boolean;
    /** makeLast 注册的监听器。 */
    last: boolean;
}
/**
 * 与 ST 同语义的事件总线。宿主全局只用一个实例，扩展通过
 * getContext().eventSource 拿到它。
 */
export declare class StEventSource {
    /** 事件名 -> 监听器列表。 */
    _records: Record<string, StListenerRecord[]>;
    /** onAny 注册的监听器。 */
    _any: StListenerRecord[];
    /** 需要补发的事件 -> 最后一次 emit 的参数。 */
    _last: Record<string, unknown[]>;
    /** 当前加载窗口归属的扩展 id；期间注册的监听器都记在它名下。 */
    _owner: string;
    /** 注册一个持久监听器。 */
    on(event: string, listener: StEventListener, once?: boolean): void;
    /** 注册只触发一次的监听器。 */
    once(event: string, listener: StEventListener): void;
    /** 注册监听器并排到所有普通监听器之前。 */
    makeFirst(event: string, listener: StEventListener): void;
    /** 注册监听器并排到所有普通监听器之后。 */
    makeLast(event: string, listener: StEventListener): void;
    /** 注册一个“任何事件都会收到”的监听器（参数为 event 名 + 原参数）。 */
    onAny(listener: StEventListener): void;
    /** 注销 onAny 监听器。 */
    offAny(listener: StEventListener): void;
    /** 注销一个监听器（on / once / makeFirst / makeLast 注册的都能注销）。 */
    removeListener(event: string, listener: StEventListener): void;
    /** removeListener 的别名。 */
    off(event: string, listener: StEventListener): void;
    /** 清空监听器；带 event 只清该事件。 */
    removeAllListeners(event?: string): void;
    /** 派发一个事件；按注册顺序逐个 await，异常全部吞掉并 console.error。 */
    emit(event: string, ...args: unknown[]): Promise<void>;
    /** 与 emit 相同，但返回每个监听器的返回值数组。 */
    emitAndWait(event: string, ...args: unknown[]): Promise<unknown[]>;
    /**
     * 等待某个事件满足条件（predicate 可省略 = 第一次触发即完成）。
     * timeout > 0 时超时会 reject；否则一直等。
     */
    waitUntil(event: string, predicate?: (...args: any[]) => boolean, timeout?: number): Promise<unknown[]>;
    /** 该事件当前监听器数量。 */
    listenerCount(event: string): number;
    /** 当前有监听器的事件名列表。 */
    eventNames(): string[];
    /** 该事件是否已经 emit 过（用于判断补发是否可用）。 */
    hasEmitted(event: string): boolean;
    /** 该事件最后一次 emit 的参数（没有则 null）。 */
    lastArgs(event: string): unknown[] | null;
    /** 开启加载窗口：期间注册的监听器归属 owner（扩展 id）。 */
    beginScope(owner: string): void;
    /** 关闭加载窗口。 */
    endScope(): void;
    /** 按归属批量注销（unload 一个扩展时调用），返回注销条数。 */
    removeByOwner(owner: string): number;
    /** 归属统计，诊断用。 */
    ownerStats(): Record<string, number>;
    /** 内部：补发最后一次参数（仅 REPLAY_EVENTS）。 */
    _replay(event: string, rec: StListenerRecord): void;
    /** 内部：调用一个监听器，异常吞掉并 console.error。 */
    _call(rec: StListenerRecord, event: string, args: unknown[]): Promise<unknown>;
    /** 内部：从列表移除一条记录。 */
    _removeRecord(event: string, rec: StListenerRecord): void;
}
/** 创建一个新的事件总线（宿主全局只用一个）。 */
export declare function createEventSource(): StEventSource;

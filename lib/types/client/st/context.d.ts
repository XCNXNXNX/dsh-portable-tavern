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
import type { StEventSource } from './emitter.ts';
import { event_types } from './emitter.ts';
import type { StLibs } from './libs.ts';
import type { StMirror, StToastKind } from './types.ts';
import type { StSkeleton } from './dom.ts';
import type { StSlashCommandClass, StSlashCommandParserFace, StPopupClass } from './slash.ts';
import { ARGUMENT_TYPE, POPUP_RESULT, POPUP_TYPE, callGenericPopup } from './slash.ts';
/** 扩展可以直接塞进 characters[] 的角色对象（字段是 ST 的常见形状）。 */
export interface StCharacter extends Record<string, unknown> {
    /** 角色名。 */
    name: string;
    /** 头像文件名（本宿主没有头像资源，给一个占位常量）。 */
    avatar: string;
    /** 角色卡 data 对象（V2/V3 的 data）。 */
    data: Record<string, unknown>;
}
/** 宿主传给 context 的依赖。 */
export interface StContextDeps {
    /** 事件总线。 */
    eventSource: StEventSource;
    /** libs（Handlebars / DOMPurify 等）。 */
    libs: StLibs;
    /** 读取酒馆面板的实时镜像。 */
    getMirror(): StMirror;
    /** 扩展要求以 {{user}} 身份发言。 */
    onSend(text: string): void;
    /** 非致命问题上报。 */
    onWarn(message: string): void;
    /** toast（宿主的 toastr 走这里）。 */
    onToast(message: string, kind?: StToastKind): void;
    /** 稳定的 extension_settings 对象（宿主持有）。 */
    extensionSettings: Record<string, unknown>;
    /** 稳定的 chat_metadata 对象（宿主持有）。 */
    chatMetadata: Record<string, unknown>;
    /** 立即持久化 extension_settings。 */
    persistSettings(): void;
    /** 立即持久化 chat_metadata。 */
    persistMetadata(): void;
    /** 取 DOM 骨架（loader 用；install 之前返回 null）。 */
    getSkeleton(): StSkeleton | null;
    /** 已加载扩展 id 列表。 */
    loadedExtensions(): string[];
    /** 扩展清单缓存（Node 半安装时给的 manifest 若已缓存则命中）。 */
    manifestFor(id: string): Record<string, unknown> | undefined;
    /** 请求扩展清单（getExtensionManifest 未命中时后台预热）。 */
    requestManifest(id: string): void;
    /** 是否移动端（libs.Bowser 派生）。 */
    isMobile: boolean;
}
/** getContext() 返回的面（额外字段通过索引签名放行）。 */
export interface StContext {
    /** 当前对话（ST 形状）。 */
    chat: unknown[];
    /** 角色列表（本宿主最多一个）。 */
    characters: StCharacter[];
    /** 当前角色下标（没有角色时 undefined）。 */
    characterId: number | undefined;
    /** ST 的老字段名，等于 characterId。 */
    this_chid: number | undefined;
    /** 群聊列表（本宿主恒为空数组）。 */
    groups: unknown[];
    /** 当前群聊 id（本宿主恒为 null）。 */
    groupId: null;
    /** 会话 id。 */
    chatId: string;
    /** {{user}} 显示名。 */
    name1: string;
    /** {{char}} 显示名。 */
    name2: string;
    /** API 标签（恒为 'dsh'）。 */
    mainApi: string;
    /** ST 的老字段名，等于 mainApi。 */
    main_api: string;
    /** 在线状态。 */
    onlineStatus: string;
    /** 会话元数据（稳定对象）。 */
    chatMetadata: Record<string, unknown>;
    /** ST 的老字段名，等于 chatMetadata。 */
    chat_metadata: Record<string, unknown>;
    /** 扩展设置（稳定对象）。 */
    extensionSettings: Record<string, unknown>;
    /** 扩展设置（老字段名）。 */
    extension_settings: Record<string, unknown>;
    /** 事件总线。 */
    eventSource: StEventSource;
    /** 事件常量表。 */
    eventTypes: typeof event_types;
    /** 事件常量表（老字段名）。 */
    event_types: typeof event_types;
    /** 请求头。 */
    getRequestHeaders(): Record<string, string>;
    /** 宏替换。 */
    substituteParams(text: unknown, extra?: Record<string, unknown>): string;
    /** 宏替换 + 额外宏表。 */
    substituteParamsExtended(text: unknown, additional?: Record<string, unknown>): string;
    /** 渲染扩展模板。 */
    renderExtensionTemplateAsync(extensionName: string, templateId: string, data?: unknown): Promise<string>;
    /** 渲染内置模板（尽力而为，失败返回空串）。 */
    renderTemplateAsync(templateId: string, data?: unknown): Promise<string>;
    /** 取扩展清单（未缓存时返回轻量占位并后台预热）。 */
    getExtensionManifest(extensionName: string): Record<string, unknown>;
    /** 翻译（查已注册的本地化词典）。 */
    t(text: unknown): string;
    /** 翻译（t 的别名）。 */
    translate(text: unknown): string;
    /** 注册本地化数据。 */
    addLocaleData(nameOrData: unknown, dataOrName?: unknown): void;
    /** 当前语言。 */
    getCurrentLocale(): string;
    /** 是否移动端。 */
    isMobile: boolean;
    /** 加载遮罩。 */
    loader: {
        show(): void;
        hide(): void;
    };
    /** 通用弹窗。 */
    callGenericPopup: typeof callGenericPopup;
    /** Popup 类。 */
    Popup: StPopupClass;
    /** 弹窗类型常量。 */
    POPUP_TYPE: typeof POPUP_TYPE;
    /** 弹窗结果常量。 */
    POPUP_RESULT: typeof POPUP_RESULT;
    /** 注册调试函数。 */
    registerDebugFunction(name: string, description: string, fn: (...args: any[]) => unknown): (...args: any[]) => unknown;
    /** 命令解析器（注册表）。 */
    SlashCommandParser: StSlashCommandParserFace;
    /** 命令类。 */
    SlashCommand: StSlashCommandClass;
    /** 参数类型常量。 */
    ARGUMENT_TYPE: typeof ARGUMENT_TYPE;
    /** 执行斜杠命令：本宿主抛清晰错误。 */
    executeSlashCommands(command: string): never;
    /** 执行斜杠命令（带选项）：本宿主抛清晰错误。 */
    executeSlashCommandsWithOptions(command: string): never;
    /** 生成（抛清晰错误）。 */
    generate(...args: unknown[]): never;
    /** 生成原文（抛清晰错误）。 */
    generateRaw(...args: unknown[]): never;
    /** Generate 别名（抛清晰错误）。 */
    Generate(...args: unknown[]): never;
    /** 停止生成（抛清晰错误）。 */
    stopGeneration(...args: unknown[]): never;
    /** 以 {{user}} 身份发言。 */
    sendMessageAsUser(text: string): void;
    /** 立即保存 extension_settings。 */
    saveSettings(): void;
    /** 防抖保存 extension_settings。 */
    saveSettingsDebounced(): void;
    /** 防抖保存 chat_metadata。 */
    saveMetadataDebounced(): void;
    /** 粗略 token 估算。 */
    getTokenCount(text: unknown): number;
    /** 粗略 token 估算（Promise 版）。 */
    getTokenCountAsync(text: unknown): Promise<number>;
    /** 账号存储（localStorage 包装）。 */
    accountStorage: Record<string, unknown>;
    /** power_user 对象（稳定）。 */
    powerUser: Record<string, unknown>;
    /** power_user（老字段名）。 */
    power_user: Record<string, unknown>;
    /** 其余字段。 */
    [key: string]: unknown;
}
/** 粗略 token 估算（中文按字、英文按 4 字符一个 token）。 */
export declare function estimateTokens(text: unknown): number;
/** 宿主拿到的 context 句柄。 */
export interface StContextHandle {
    /** 刷新动态字段后返回同一个 context 对象。 */
    get(): StContext;
    /** 不刷新，直接取当前 context。 */
    peek(): StContext;
    /** 写入扩展清单缓存（安装/首次读取后调用）。 */
    cacheManifest(id: string, manifest: Record<string, unknown>): void;
    /** 命令解析器（宿主诊断用）。 */
    slashParser: StSlashCommandParserFace;
}
/** 造一个“函数对象”版账号存储：既能当 no-op 函数调用，也有 Promise 方法。 */
export declare function createAccountStorage(localforage: StLibs['localforage']): Record<string, unknown>;
/** power_user 的稳定对象（本宿主没有这套设置，给常用字段的合理默认值）。 */
export declare function createPowerUser(): Record<string, unknown>;
/**
 * 创建 ST 兼容 context（整个宿主只调一次）。
 *
 * @param deps 宿主依赖（事件总线 / libs / 镜像读取 / 持久化 / DOM 骨架…）。
 */
export declare function createStContext(deps: StContextDeps): StContextHandle;

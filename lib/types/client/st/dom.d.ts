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
import type { StMirror, StToastKind } from './types.ts';
/** 酒馆面板提供的扩展挂载容器 id（面板没提供时降级为浮动坞）。 */
export declare const PT_EXT_MOUNT_ID = "pt-ext-mount";
/** 隐藏骨架容器 id。 */
export declare const ST_ROOT_ID = "tavern-st-root";
/** 可见扩展面板 id。 */
export declare const ST_EXT_PANEL_ID = "tavern-st-ext-panel";
/** 降级浮动坞 id。 */
export declare const ST_EXT_DOCK_ID = "tavern-st-ext-dock";
/** toast 容器 id。 */
export declare const ST_TOASTS_ID = "tavern-st-toasts";
/** 主题变量 style 元素 id。 */
export declare const ST_THEME_VARS_ID = "tavern-theme-vars";
/** 骨架样式 style 元素 id。 */
export declare const ST_STYLE_ID = "dsh-portable-tavern-st";
/** 骨架 loader 元素 id。 */
export declare const ST_LOADER_ID = "tavern-st-loader";
/** 需要快照/清理的挂载点 id（unload 时只清这些容器里的新增子节点）。 */
export declare const TRACKED_MOUNT_IDS: string[];
/** 骨架引用集合（宿主内部使用）。 */
export interface StSkeleton {
    /** 隐藏骨架容器。 */
    root: HTMLElement;
    /** 可见扩展面板。 */
    extPanel: HTMLElement;
    /** 扩展面板的折叠体。 */
    extBody: HTMLElement;
    /** 降级浮动坞（只有接管失败时存在）。 */
    dock: HTMLElement | null;
    /** #extensions_settings。 */
    extSettings: HTMLElement;
    /** #extensions_settings2。 */
    extSettings2: HTMLElement;
    /** #extensionsMenu。 */
    extMenu: HTMLElement;
    /** #chat 镜像。 */
    chat: HTMLElement;
    /** #movingDivs。 */
    movingDivs: HTMLElement;
    /** #send_form。 */
    sendForm: HTMLElement;
    /** #send_textarea。 */
    sendTextarea: HTMLTextAreaElement;
    /** #message_template。 */
    messageTemplate: HTMLElement;
    /** #customCSS（style 元素）。 */
    customCss: HTMLStyleElement;
    /** #right-nav-panel。 */
    rightNavPanel: HTMLElement;
    /** #left-nav-panel。 */
    leftNavPanel: HTMLElement;
    /** #top-settings-holder。 */
    topSettingsHolder: HTMLElement;
    /** loader 遮罩。 */
    loader: HTMLElement;
    /** toast 容器。 */
    toasts: HTMLElement;
    /** 主题变量 style 元素。 */
    themeVars: HTMLStyleElement;
    /** 骨架样式 style 元素。 */
    style: HTMLStyleElement;
    /** #chat 镜像的内容签名（避免每帧重建 DOM）。 */
    chatSignature: string;
    /** 面板是否已折叠。 */
    collapsed: boolean;
    /** MutationObserver（等 #pt-ext-mount 出现）。 */
    observer: MutationObserver | null;
    /** 宿主自己创建的节点（dispose 时逐个移除）。 */
    owned: Node[];
    /** 挂载点点击委托（inline-drawer 展开/收起）。 */
    onClick: (event: Event) => void;
    /** 输入镜像的 submit 监听。 */
    onSubmit: (event: Event) => void;
    /** 输入镜像的 Enter 监听。 */
    onKeydown: (event: Event) => void;
    /** 扩展通过 #send_form 发消息的回调。 */
    onSend: (text: string) => void;
}
/** installSkeleton 的选项。 */
export interface StSkeletonOptions {
    /** 扩展通过 #send_form 发消息时的回调。 */
    onSend(text: string): void;
    /** 非致命问题上报。 */
    onWarn(message: string): void;
}
/** 建面板骨架（幂等：已存在则复用并把内容补齐）。 */
export declare function installSkeleton(options: StSkeletonOptions): StSkeleton;
/** 拆掉整个骨架（宿主 dispose 时调用）。 */
export declare function disposeSkeleton(skel: StSkeleton): void;
/**
 * 把酒馆对话同步进 #chat 镜像节点。
 * 宿主在 emit('message_received' / 'user_message_rendered' / 'character_message_rendered') 前调用；
 * 轮询器也会调用它（面板没显式 emit 时扩展也能看到最新对话）。
 */
export declare function syncChatMirror(skel: StSkeleton, mirror: StMirror, sanitize: (html: unknown) => string): void;
/** 弹一条宿主 toast（toastr 契约的落点），ttl 毫秒后自动消失。 */
export declare function showToast(skel: StSkeleton, message: string, kind?: StToastKind, ttl?: number): void;
/** 清空全部 toast。 */
export declare function clearToasts(skel: StSkeleton): void;
/** 显示/隐藏骨架 loader（ST 的 loader.show/hide 落点）。 */
export declare function setLoader(skel: StSkeleton, visible: boolean): void;
/** 写入主题变量块（null 清空）。 */
export declare function applyThemeVars(skel: StSkeleton, css: string | null): void;
/** 加载期 DOM 归属追踪器：把扩展插到 head/body 的节点记到它名下，unload 时移除。 */
export interface StDomWatcher {
    /** 开启加载窗口。 */
    begin(owner: string): void;
    /** 关闭加载窗口。 */
    end(): void;
    /** 当前归属（'' = 无）。 */
    owner(): string;
    /** owner 名下记录到的节点。 */
    nodesOf(owner: string): Node[];
    /** 清掉 owner 的记录。 */
    forget(owner: string): void;
}
/** 创建一个 DOM 归属追踪器（页面级单例状态，宿主只需要一个）。 */
export declare function createDomWatcher(): StDomWatcher;
/** 移除一批节点中“直接挂在 head/body 上”的那些，返回移除数量。 */
export declare function removeHeadBodyNodes(nodes: Node[]): number;
/** 快照被跟踪挂载点的子节点（load 前调用）。 */
export declare function captureMounts(): Array<[Element, Node[]]>;
/** 相对快照新增的子节点（unload 时调用，涵盖 innerHTML / insertAdjacentHTML 写法）。 */
export declare function addedChildrenSince(snapshot: Array<[Element, Node[]]>): Node[];

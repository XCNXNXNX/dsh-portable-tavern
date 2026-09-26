/**
 * 迷你 jQuery：ST 扩展大量使用 $('#extensions_settings').append(...) 这类写法，
 * 宿主必须提供 window.$ / window.jQuery（仅当页面没有 jQuery 时才写入）。
 *
 * 覆盖范围：append/prepend/after/before/remove/empty/html/text/val/attr/removeAttr/
 * addClass/removeClass/toggleClass/hasClass/css/show/hide/toggle/fadeIn/fadeOut/
 * on/off/one/click/change/input/trigger/triggerHandler/find/closest/parent/children/
 * eq/first/last/length/each/get/index/data，以及 $.extend/$.each/$.map/$.grep/$.inArray/$.ajax。
 *
 * 选择器不做完整实现：交给原生 querySelectorAll；jQuery 专有伪类尽量降级处理
 * （:visible/:hidden/:first/:last/:eq/:contains/:has/:selected/:input 等），实在不支持的
 * 伪类返回空集合且只 onWarn 一次。
 */
/** jQuery 风格集合（类数组）。 */
export interface StJQueryCollection {
    /** 命中元素个数。 */
    length: number;
    /** 下标访问。 */
    [index: number]: Element;
    /** 遍历并在回调返回 false 时中断。 */
    each(fn: (this: Element, index: number, element: Element) => unknown): StJQueryCollection;
    /** 取原生元素（无参返回数组）。 */
    get(index?: number): any;
    /** 首元素在兄弟中的下标。 */
    index(): number;
    /** 取第 i 个（支持负数）。 */
    eq(index: number): StJQueryCollection;
    /** 第一个。 */
    first(): StJQueryCollection;
    /** 最后一个。 */
    last(): StJQueryCollection;
    /** 追加子节点（HTML 字符串 / 元素 / 集合）。 */
    append(content: unknown): StJQueryCollection;
    /** 前插子节点。 */
    prepend(content: unknown): StJQueryCollection;
    /** 插到后面（同级）。 */
    after(content: unknown): StJQueryCollection;
    /** 插到前面（同级）。 */
    before(content: unknown): StJQueryCollection;
    /** 把选中的元素挂到目标下面。 */
    appendTo(target: unknown): StJQueryCollection;
    /** 从 DOM 移除。 */
    remove(selector?: string): StJQueryCollection;
    /** 清空子节点。 */
    empty(): StJQueryCollection;
    /** 读/写 innerHTML。 */
    html(value?: unknown): any;
    /** 读/写 textContent。 */
    text(value?: unknown): any;
    /** 读/写表单值。 */
    val(value?: unknown): any;
    /** 读/写属性。 */
    attr(name: unknown, value?: unknown): any;
    /** 删属性。 */
    removeAttr(name: string): StJQueryCollection;
    /** 加 class。 */
    addClass(names: string): StJQueryCollection;
    /** 删 class。 */
    removeClass(names?: string): StJQueryCollection;
    /** 切换 class。 */
    toggleClass(names: string, state?: boolean): StJQueryCollection;
    /** 是否有 class。 */
    hasClass(name: string): boolean;
    /** 读/写内联样式（支持 kebab / camel 两种写法）。 */
    css(name: unknown, value?: unknown): any;
    /** 显示。 */
    show(): StJQueryCollection;
    /** 隐藏。 */
    hide(): StJQueryCollection;
    /** 切换显示。 */
    toggle(force?: boolean): StJQueryCollection;
    /** 淡入。 */
    fadeIn(duration?: number, callback?: () => void): StJQueryCollection;
    /** 淡出。 */
    fadeOut(duration?: number, callback?: () => void): StJQueryCollection;
    /** 绑定事件（支持委托与事件名映射对象）。 */
    on(events: unknown, selectorOrHandler?: unknown, handler?: unknown): StJQueryCollection;
    /** 解绑事件。 */
    off(events?: string, selectorOrHandler?: unknown, handler?: unknown): StJQueryCollection;
    /** 只触发一次。 */
    one(events: unknown, selectorOrHandler?: unknown, handler?: unknown): StJQueryCollection;
    /** click 简写。 */
    click(handler?: unknown): StJQueryCollection;
    /** change 简写。 */
    change(handler?: unknown): StJQueryCollection;
    /** input 简写。 */
    input(handler?: unknown): StJQueryCollection;
    /** 触发事件（会冒泡）。 */
    trigger(event: string, extra?: unknown): StJQueryCollection;
    /** 触发已绑定处理器（不冒泡），返回最后一个处理器的返回值。 */
    triggerHandler(event: string, extra?: unknown): any;
    /** 在后代里查找。 */
    find(selector: string): StJQueryCollection;
    /** 最近的祖先（含自身）。 */
    closest(selector: string): StJQueryCollection;
    /** 直接父元素。 */
    parent(): StJQueryCollection;
    /** 直接子元素。 */
    children(selector?: string): StJQueryCollection;
    /** 是否匹配选择器。 */
    is(selector: string): boolean;
    /** 读/写 data-*（含 jQuery .data() 缓存语义）。 */
    data(key?: string, value?: unknown): any;
}
/** $.ajax 的参数（只支持同源 GET）。 */
export interface StAjaxOptions {
    /** 目标 URL（相对当前页面解析）。 */
    url?: string;
    /** 请求方法；只支持 GET，其它会走 error 回调。 */
    type?: string;
    /** type 的别名。 */
    method?: string;
    /** GET 查询参数（对象会序列化）。 */
    data?: unknown;
    /** 'json' | 'text'。 */
    dataType?: string;
    /** 额外请求头。 */
    headers?: Record<string, string>;
    /** 成功回调。 */
    success?: (data: any, textStatus: string, xhr: StJQueryXhr) => void;
    /** 失败回调。 */
    error?: (xhr: StJQueryXhr, textStatus: string, errorThrown: string) => void;
    /** 完成回调（无论成败）。 */
    complete?: (xhr: StJQueryXhr, textStatus: string) => void;
    /** 超时毫秒。 */
    timeout?: number;
    /** 是否走缓存（默认 true，与 jQuery 一致）。 */
    cache?: boolean;
}
/** $.ajax 的返回值：既是 thenable，也有 jQuery 的 done/fail/always。 */
export interface StJQueryXhr extends Promise<unknown> {
    /** 成功回调（可链）。 */
    done(callback: (data: any, textStatus: string, xhr: StJQueryXhr) => unknown): StJQueryXhr;
    /** 失败回调（可链）。 */
    fail(callback: (xhr: StJQueryXhr, textStatus: string, errorThrown: string) => unknown): StJQueryXhr;
    /** 完成回调（可链）。 */
    always(callback: (xhr: StJQueryXhr, textStatus: string) => unknown): StJQueryXhr;
    /** 中断请求。 */
    abort(): void;
    /** HTTP 状态码（0 = 未完成/被中断）。 */
    status: number;
    /** 响应文本。 */
    responseText: string;
    /** 响应头。 */
    getResponseHeader(name: string): string | null;
    /** readyState。 */
    readyState: number;
}
/** jQuery 静态面。 */
export interface StJQueryStatic {
    (selector?: unknown, context?: unknown): StJQueryCollection;
    /** 原型（扩展常用 $.fn.myPlugin = ...）。 */
    fn: Record<string, unknown>;
    /** 深/浅合并；$.extend(true, target, src) 支持深合并。 */
    extend(...args: unknown[]): any;
    /** 遍历对象/数组。 */
    each(collection: unknown, callback: (index: any, value: any) => unknown): unknown;
    /** 映射。 */
    map(collection: unknown, callback: (value: any, index: any) => unknown): unknown[];
    /** 过滤。 */
    grep(list: unknown[], callback: (value: any, index: number) => unknown, invert?: boolean): unknown[];
    /** 下标查找。 */
    inArray(value: unknown, list: unknown[], fromIndex?: number): number;
    /** 同源 GET（thenable）。 */
    ajax(options: StAjaxOptions | string): StJQueryXhr;
    /** 同源 GET 简写。 */
    get(url: string, data?: unknown, success?: (data: any) => void): StJQueryXhr;
    /** 对象序列化成查询串。 */
    param(value: unknown): string;
    /** HTML -> 元素数组。 */
    parseHTML(html: string): Element[];
    /** 去空白。 */
    trim(value: unknown): string;
    /** 是否数组。 */
    isArray(value: unknown): boolean;
    /** 是否函数。 */
    isFunction(value: unknown): boolean;
    /** 是否数字（含数字字符串）。 */
    isNumeric(value: unknown): boolean;
    /** a 是否包含 b。 */
    contains(a: Node, b: Node): boolean;
    /** 空函数。 */
    noop(): void;
    /** 当前时间戳。 */
    now(): number;
    /** 类数组 -> 真数组。 */
    makeArray(value: unknown): unknown[];
    /** DOM 就绪回调。 */
    ready(callback: () => void): void;
}
/**
 * 创建迷你 jQuery（$ / jQuery）。
 *
 * @param win 目标 window（默认全局 window）。
 * @param onWarn 降级/不支持时的上报回调（去重，同一条只报一次）。
 */
export declare function createJQuery(win?: Window, onWarn?: (message: string) => void): StJQueryStatic;

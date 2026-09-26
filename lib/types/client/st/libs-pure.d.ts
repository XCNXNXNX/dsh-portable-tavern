/**
 * 纯逻辑库集合：SillyTavern 的 libs 里需要“真实现”的那几个。
 *
 * 包含：lodash 常用子集、Handlebars 模板子集、Fuse 模糊搜索子集、Bowser UA 解析子集、
 * hljs 空壳、localforage（注入 storage，可跑在内存里）、DOMPurify 的正则降级版。
 *
 * 本文件刻意不碰任何浏览器 API（DOM/localStorage/window 全部由调用方注入），
 * 这样 node --experimental-strip-types 能直接 import 做语义断言（见 __selftest.mjs）；
 * 浏览器专属部分（DOMParser 版 sanitize、真实 localStorage 绑定、jQuery）在 libs.ts / jquery.ts。
 */
/** 迭代器参数：函数、属性路径（'a.b[0]' 或段数组）、或对象匹配简写。 */
export type StIteratee = ((value: any, key: any, collection?: any) => any) | string | number | ReadonlyArray<string | number> | Record<string, unknown> | null | undefined;
/** 把任意值渲染成字符串；null / undefined 变成空串。 */
export declare function toStringValue(value: unknown): string;
/** HTML 转义（与 Handlebars 的 escapeExpression 对齐）。 */
export declare function escapeHtml(value: unknown): string;
/** 路径（'a.b[0].c' 或段数组）拆成段数组。 */
export declare function toPath(path: unknown): Array<string | number>;
/** 深拷贝：数组 / 普通对象 / Date / RegExp / Map / Set，带循环引用保护。 */
export declare function cloneDeep<T>(value: T, seen?: WeakMap<object, unknown>): T;
/** 判断是否是“可继续深合并”的普通对象。 */
export declare function isPlainObject(value: unknown): boolean;
/** 深合并（数组按索引合并，纯对象递归，其余直接覆盖）；返回 target。 */
export declare function mergeDeep(target: any, ...sources: unknown[]): any;
/** 取属性路径的值；取不到时返回 defaultValue。 */
export declare function getPath(object: unknown, path: unknown, defaultValue?: unknown): unknown;
/** 设置属性路径的值（中间层缺失时自动建对象/数组）；返回被设置的对象。 */
export declare function setPath(object: any, path: unknown, value: unknown): any;
/** 判断属性路径是否存在（含原型链）。 */
export declare function hasPath(object: unknown, path: unknown): boolean;
/** 把 iteratee 简写归一成函数。 */
export declare function baseIteratee(iteratee: StIteratee): (value: any, key: any, collection?: any) => any;
/** 把集合归一成 [key, value] 数组（数组用下标当 key）。 */
export declare function entriesOf(collection: unknown): Array<[any, any]>;
/** 深比较（lodash isEqual 的常用子集）。 */
export declare function isEqual(a: unknown, b: unknown): boolean;
/** 防抖函数的附加控制面。 */
export interface StDebounced {
    (...args: any[]): any;
    /** 取消尚未执行的调用。 */
    cancel(): void;
    /** 立刻执行尚未执行的调用并返回其结果。 */
    flush(): any;
}
/** libs.lodash 的类型面（实现为常用子集）。 */
export interface StLodash {
    get(object: unknown, path: unknown, defaultValue?: unknown): any;
    set(object: unknown, path: unknown, value: unknown): any;
    has(object: unknown, path: unknown): boolean;
    cloneDeep<T>(value: T): T;
    clone<T>(value: T): T;
    merge<T>(target: T, ...sources: unknown[]): T;
    debounce(fn: (...args: any[]) => any, wait?: number, options?: {
        leading?: boolean;
        trailing?: boolean;
    }): StDebounced;
    throttle(fn: (...args: any[]) => any, wait?: number, options?: {
        leading?: boolean;
        trailing?: boolean;
    }): StDebounced;
    isEmpty(value: unknown): boolean;
    isObject(value: unknown): boolean;
    isArray(value: unknown): value is unknown[];
    isString(value: unknown): value is string;
    isFunction(value: unknown): value is (...args: any[]) => any;
    isNil(value: unknown): boolean;
    isEqual(a: unknown, b: unknown): boolean;
    forEach(collection: unknown, iteratee: StIteratee): unknown;
    map(collection: unknown, iteratee?: StIteratee): unknown[];
    filter(collection: unknown, predicate?: StIteratee): unknown[];
    find(collection: unknown, predicate?: StIteratee): unknown;
    uniqBy(collection: unknown, iteratee?: StIteratee): unknown[];
    sortBy(collection: unknown, ...iteratees: StIteratee[]): unknown[];
    groupBy(collection: unknown, iteratee?: StIteratee): Record<string, unknown[]>;
    keyBy(collection: unknown, iteratee?: StIteratee): Record<string, unknown>;
    keys(object: unknown): string[];
    values(object: unknown): unknown[];
    escape(value: unknown): string;
    random(min?: number, max?: number, floating?: boolean): number;
    range(start?: number, end?: number, step?: number): number[];
    clamp(value: number, min?: number, max?: number): number;
    kebabCase(value: unknown): string;
    camelCase(value: unknown): string;
    startCase(value: unknown): string;
    capitalize(value: unknown): string;
    omit(object: unknown, ...paths: unknown[]): Record<string, unknown>;
    pick(object: unknown, ...paths: unknown[]): Record<string, unknown>;
    assign<T>(target: T, ...sources: unknown[]): T;
    defaults<T>(target: T, ...sources: unknown[]): T;
    flatten(collection: unknown): unknown[];
    shuffle<T>(collection: unknown): T[];
    sample<T>(collection: unknown): T | undefined;
    sumBy(collection: unknown, iteratee?: StIteratee): number;
    times(n: number, iteratee?: StIteratee): unknown[];
    uniqueId(prefix?: string): string;
    noop(): void;
    identity<T>(value: T): T;
}
/** 防抖实现（支持 leading / trailing，与 lodash 语义一致）。 */
export declare function debounce(fn: (...args: any[]) => any, wait?: number, options?: {
    leading?: boolean;
    trailing?: boolean;
}): StDebounced;
/** 节流实现（支持 leading / trailing）。 */
export declare function throttle(fn: (...args: any[]) => any, wait?: number, options?: {
    leading?: boolean;
    trailing?: boolean;
}): StDebounced;
/** lodash 常用子集的默认实现（window._ 存在时 libs.ts 会优先复用页面上的 lodash）。 */
export declare const lodashSubset: StLodash;
/** Handlebars 编译产物：传入数据返回渲染后的字符串。 */
export interface StHandlebarsTemplate {
    (data?: unknown): string;
}
/** Handlebars 运行时的最小实现面。 */
export interface StHandlebars {
    compile(template: string): StHandlebarsTemplate;
    registerHelper(name: string, fn: (...args: any[]) => unknown): void;
    unregisterHelper(name: string): void;
    registerPartial(name: string, template: string): void;
    escapeExpression(value: unknown): string;
    SafeString: {
        new (value: unknown): {
            toString(): string;
            toHTML(): string;
        };
    };
    helpers: Record<string, (...args: any[]) => unknown>;
    templates: Record<string, StHandlebarsTemplate>;
}
/** 创建 Handlebars 子集实例（compile 失败时返回空串模板，不抛异常）。 */
export declare function createHandlebars(): StHandlebars;
/** Fuse 的构造参数（子集）。 */
export interface StFuseOptions {
    /** 参与搜索的字段路径。 */
    keys?: Array<string | {
        name: string;
        weight?: number;
    }>;
    /** 0..1 的匹配阈值，默认 0.6。 */
    threshold?: number;
    /** 结果是否带 score。 */
    includeScore?: boolean;
    /** 是否大小写敏感。 */
    isCaseSensitive?: boolean;
    /** 是否排序（默认 true）。 */
    shouldSort?: boolean;
}
/** Fuse 的一条结果。 */
export interface StFuseResult {
    /** 命中的原始条目。 */
    item: unknown;
    /** 在集合里的下标。 */
    refIndex: number;
    /** 0 = 完全命中，1 = 完全不命中。 */
    score: number;
}
/** Fuse 实例面。 */
export interface StFuseInstance {
    /** 搜索。 */
    search(pattern: string, options?: {
        limit?: number;
    }): StFuseResult[];
    /** 替换整个集合。 */
    setCollection(list: unknown[]): void;
    /** 追加一条。 */
    add(item: unknown): void;
    /** 取回当前集合。 */
    getCollection(): unknown[];
}
/** 创建 Fuse 类（构造签名与上游一致，供 libs.Fuse 使用）。 */
export declare function createFuseClass(): new (list: unknown[], options?: StFuseOptions) => StFuseInstance;
/** UA 解析结果。 */
export interface StUaInfo {
    /** 浏览器信息。 */
    browser: {
        name: string;
        version: string;
    };
    /** 操作系统信息。 */
    os: {
        name: string;
        version: string;
    };
    /** 平台信息（desktop / mobile / tablet / bot）。 */
    platform: {
        type: string;
        vendor: string;
        model: string;
    };
    /** 渲染引擎信息。 */
    engine: {
        name: string;
        version: string;
    };
}
/** Bowser 的 getParser() 面。 */
export interface StBowserParser {
    getBrowser(): {
        name: string;
        version: string;
    };
    getBrowserName(): string;
    getBrowserVersion(): string;
    getOS(): {
        name: string;
        version: string;
    };
    getOSName(): string;
    getOSVersion(): string;
    getPlatform(): {
        type: string;
        vendor: string;
        model: string;
    };
    getPlatformType(): string;
    getEngine(): {
        name: string;
        version: string;
    };
    getEngineName(): string;
    /** 只做最简 name/version 匹配。 */
    satisfies(check: Record<string, unknown>): boolean;
    /** 只做最简 name 匹配。 */
    is(check: string): boolean;
    parse(): StUaInfo;
}
/** libs.Bowser 的面。 */
export interface StBowser {
    parse(ua?: string): StUaInfo;
    getParser(ua?: string): StBowserParser;
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
    bot: boolean;
    browser: {
        name: string;
        version: string;
    };
    os: {
        name: string;
        version: string;
    };
    platform: {
        type: string;
        vendor: string;
        model: string;
    };
    satisfies(check: Record<string, unknown>): boolean;
}
/** 解析一个 UA 字符串（纯字符串处理，浏览器/测试里都能跑）。 */
export declare function parseUserAgent(ua: string): StUaInfo;
/** 是否移动端 UA（context.isMobile 用）。 */
export declare function detectIsMobile(ua?: string): boolean;
/** 创建 Bowser 子集实例。 */
export declare function createBowser(userAgent?: string): StBowser;
/** hljs.highlight 的返回结构。 */
export interface StHljsResult {
    /** 已转义的 HTML。 */
    value: string;
    /** 语言名。 */
    language: string;
    /** 相关度（空壳恒为 0）。 */
    relevance: number;
    /** 标记这是空壳实现，方便诊断。 */
    stubbed: true;
}
/** hljs 空壳的面。 */
export interface StHljs {
    highlight(code: string, options?: {
        language?: string;
        ignoreIllegals?: boolean;
    }): StHljsResult;
    highlightAuto(code: string, languageSubset?: string[]): StHljsResult;
    highlightElement(element: {
        innerHTML: string;
        classList?: {
            add(name: string): void;
        };
    }): void;
    getLanguage(name: string): {
        name: string;
        aliases?: string[];
    } | undefined;
    listLanguages(): string[];
    registerLanguage(name: string, definition?: unknown): void;
    unregisterLanguage(name: string): void;
    configure(options?: Record<string, unknown>): void;
    versionString: string;
}
/** 创建 hljs 空壳（点亮代码块用，明确不做语法着色）。 */
export declare function createHljs(): StHljs;
/** 宿主注入的存储后端（浏览器传 localStorage；测试传内存实现）。 */
export interface StStorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    /** 第 index 个键（无则 null）。 */
    key(index: number): string | null;
    /** 键总数。 */
    readonly length: number;
    /** 清空。 */
    clear(): void;
}
/** localforage 的面（子集）。 */
export interface StLocalforage {
    INDEXEDDB: string;
    WEBSQL: string;
    LOCALSTORAGE: string;
    ready(callback?: () => void): Promise<void>;
    driver(callback?: (driver: string) => void): Promise<string>;
    setDriver(driver?: string | string[], callback?: () => void): Promise<void>;
    config(options?: Record<string, unknown>): Record<string, unknown>;
    getItem<T>(key: string, callback?: (err: unknown, value: T | null) => void): Promise<T | null>;
    setItem<T>(key: string, value: T, callback?: (err: unknown, value: T) => void): Promise<T>;
    removeItem(key: string, callback?: (err: unknown) => void): Promise<void>;
    clear(callback?: (err: unknown) => void): Promise<void>;
    length(callback?: (err: unknown, n: number) => void): Promise<number>;
    key(index: number, callback?: (err: unknown, key: string | null) => void): Promise<string | null>;
    keys(callback?: (err: unknown, keys: string[]) => void): Promise<string[]>;
    iterate<T, U>(iterator: (value: T, key: string, iterationNumber: number) => U, callback?: (err: unknown, result: U | undefined) => void): Promise<U | undefined>;
    createInstance(options?: Record<string, unknown>): StLocalforage;
    dropInstance(options?: unknown): Promise<void>;
    supports(driverName?: string): boolean;
}
/** 用任意 StorageLike 造一个 localforage 兼容对象（值走 JSON 序列化）。 */
export declare function createLocalforage(storage: StStorageLike): StLocalforage;
/** sanitize 选项（DOMPurify 的常用子集）。 */
export interface StSanitizeOptions {
    /** 白名单标签（给定时不在表内的标签会被剥掉，内容保留）。 */
    ALLOWED_TAGS?: string[];
    /** 白名单属性（给定时不在表内的属性会被剥掉）。 */
    ALLOWED_ATTR?: string[];
    /** 额外禁用的标签。 */
    FORBID_TAGS?: string[];
    /** 额外禁用的属性。 */
    FORBID_ATTR?: string[];
    /** 是否保留被剥标签的内部内容，默认 true。 */
    KEEP_CONTENT?: boolean;
    /** 是否允许 data-* 属性，默认 true。 */
    ALLOW_DATA_ATTR?: boolean;
}
/** 无 DOM 环境下的 sanitize 降级实现（正则白名单剥离）。 */
export declare function sanitizeHtmlFallback(html: unknown, options?: StSanitizeOptions): string;

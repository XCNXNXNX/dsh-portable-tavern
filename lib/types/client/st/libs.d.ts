/**
 * 浏览器侧的 libs 装配：把 libs-pure.ts 的纯逻辑实现和浏览器能力（DOMParser 版 sanitize、
 * 真实 localStorage）拼成 window.SillyTavern.libs。
 *
 * 设计取舍：
 * - lodash 优先复用页面上已有的 window._ / window.lodash（若缺方法则用自带子集补齐）；
 * - DOMPurify 在浏览器里走 DOMParser 白名单实现，无 DOM 时降级为正则版；
 * - hljs 是“只转义、不着色”的安全空壳（字段与类型正确，行为明确）；
 * - css 是安全空壳（escape 是真实现，parse/stringify 返回空结构）。
 */
import type { StBowser, StFuseInstance, StFuseOptions, StHandlebars, StHljs, StLocalforage, StLodash, StSanitizeOptions, StStorageLike } from './libs-pure.ts';
/** DOMPurify 的面（sanitize 是唯一被大量使用的入口）。 */
export interface StDOMPurify {
    /** 白名单剥离 script / on* / javascript: 之后返回 HTML 字符串。 */
    sanitize(html: unknown, options?: StSanitizeOptions): string;
    /** 注册净化钩子（afterSanitizeAttributes 会拿到每个元素节点）。 */
    addHook(name: string, hook: (node: Element) => void): void;
    /** 移除单个钩子。 */
    removeHook(name: string, hook: (node: Element) => void): void;
    /** 移除某类钩子（不传名字则清空）。 */
    removeHooks(name?: string): void;
    /** 浏览器里恒为 true。 */
    isSupported: boolean;
    /** 版本标记，便于诊断这是宿主实现。 */
    version: string;
    /** 记录默认配置（本实现只记住，不深合并）。 */
    setConfig(options?: StSanitizeOptions): void;
    /** 清空默认配置。 */
    clearConfig(): void;
}
/** libs.Fuse 的构造签名。 */
export interface StFuseConstructor {
    new (list: unknown[], options?: StFuseOptions): StFuseInstance;
}
/** libs.css 的面（安全空壳）。 */
export interface StCssLib {
    /** CSS 字符串转义（真实现）。 */
    escape(value: unknown): string;
    /** 解析 CSS（空壳：返回空的 stylesheet 结构）。 */
    parse(input?: string): {
        type: string;
        stylesheet: {
            rules: unknown[];
        };
    };
    /** 序列化 CSS AST（空壳：返回空串）。 */
    stringify(ast?: unknown): string;
    /** 压缩 CSS（空壳：原样返回）。 */
    compress(input?: string): string;
}
/** SillyTavern.libs 的面：字段必须齐全（扩展会直接摸这些字段）。 */
export interface StLibs {
    /** lodash 常用子集（优先复用页面已有的 window._）。 */
    lodash: StLodash;
    /** 模糊搜索。 */
    Fuse: StFuseConstructor;
    /** HTML 净化。 */
    DOMPurify: StDOMPurify;
    /** 代码高亮空壳（只转义）。 */
    hljs: StHljs;
    /** localStorage 的 Promise 包装。 */
    localforage: StLocalforage;
    /** 模板引擎子集。 */
    Handlebars: StHandlebars;
    /** CSS 工具空壳。 */
    css: StCssLib;
    /** UA 解析。 */
    Bowser: StBowser;
    /** 其余字段（扩展可能塞自定义 lib）。 */
    [key: string]: unknown;
}
/** 内存版 StorageLike：localStorage 不可用（隐私模式/配额）时的兜底。 */
export declare function createMemoryStorage(): StStorageLike;
/** 拿一个可用的存储：优先 localStorage，抛异常（隐私模式）时退回内存实现。 */
export declare function resolveStorage(win?: Window): StStorageLike;
/** 创建 DOMPurify 兼容对象（有 DOM 走 DOM 版，没 DOM 走正则版）。 */
export declare function createDOMPurify(win?: Window): StDOMPurify;
/** 创建 libs.css（安全空壳；escape 是真实现）。 */
export declare function createCssLib(): StCssLib;
/**
 * 组装 window.SillyTavern.libs：字段齐全、类型正确，缺失能力用安全空壳而不是 undefined。
 *
 * @param win 目标 window（默认全局 window；测试可注入假 window）。
 */
export declare function createStLibs(win?: Window): StLibs;

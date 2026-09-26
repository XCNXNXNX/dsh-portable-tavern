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

import type {
  StBowser,
  StFuseInstance,
  StFuseOptions,
  StHandlebars,
  StHljs,
  StLocalforage,
  StLodash,
  StSanitizeOptions,
  StStorageLike,
} from './libs-pure.ts'
import {
  createBowser,
  createFuseClass,
  createHandlebars,
  createHljs,
  createLocalforage,
  lodashSubset,
  sanitizeHtmlFallback,
  toStringValue,
} from './libs-pure.ts'

// ---------------------------------------------------------------------------
// 面（类型）
// ---------------------------------------------------------------------------

/** DOMPurify 的面（sanitize 是唯一被大量使用的入口）。 */
export interface StDOMPurify {
  /** 白名单剥离 script / on* / javascript: 之后返回 HTML 字符串。 */
  sanitize(html: unknown, options?: StSanitizeOptions): string
  /** 注册净化钩子（afterSanitizeAttributes 会拿到每个元素节点）。 */
  addHook(name: string, hook: (node: Element) => void): void
  /** 移除单个钩子。 */
  removeHook(name: string, hook: (node: Element) => void): void
  /** 移除某类钩子（不传名字则清空）。 */
  removeHooks(name?: string): void
  /** 浏览器里恒为 true。 */
  isSupported: boolean
  /** 版本标记，便于诊断这是宿主实现。 */
  version: string
  /** 记录默认配置（本实现只记住，不深合并）。 */
  setConfig(options?: StSanitizeOptions): void
  /** 清空默认配置。 */
  clearConfig(): void
}

/** libs.Fuse 的构造签名。 */
export interface StFuseConstructor {
  new (list: unknown[], options?: StFuseOptions): StFuseInstance
}

/** libs.css 的面（安全空壳）。 */
export interface StCssLib {
  /** CSS 字符串转义（真实现）。 */
  escape(value: unknown): string
  /** 解析 CSS（空壳：返回空的 stylesheet 结构）。 */
  parse(input?: string): { type: string; stylesheet: { rules: unknown[] } }
  /** 序列化 CSS AST（空壳：返回空串）。 */
  stringify(ast?: unknown): string
  /** 压缩 CSS（空壳：原样返回）。 */
  compress(input?: string): string
}

/** SillyTavern.libs 的面：字段必须齐全（扩展会直接摸这些字段）。 */
export interface StLibs {
  /** lodash 常用子集（优先复用页面已有的 window._）。 */
  lodash: StLodash
  /** 模糊搜索。 */
  Fuse: StFuseConstructor
  /** HTML 净化。 */
  DOMPurify: StDOMPurify
  /** 代码高亮空壳（只转义）。 */
  hljs: StHljs
  /** localStorage 的 Promise 包装。 */
  localforage: StLocalforage
  /** 模板引擎子集。 */
  Handlebars: StHandlebars
  /** CSS 工具空壳。 */
  css: StCssLib
  /** UA 解析。 */
  Bowser: StBowser
  /** 其余字段（扩展可能塞自定义 lib）。 */
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// 存储
// ---------------------------------------------------------------------------

/** 内存版 StorageLike：localStorage 不可用（隐私模式/配额）时的兜底。 */
export function createMemoryStorage(): StStorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)) },
    removeItem: (key: string) => { map.delete(key) },
    key: (index: number) => {
      const list = Array.from(map.keys())
      return index >= 0 && index < list.length ? list[index] : null
    },
    get length(): number { return map.size },
    clear: () => { map.clear() },
  }
}

/** 拿一个可用的存储：优先 localStorage，抛异常（隐私模式）时退回内存实现。 */
export function resolveStorage(win?: Window): StStorageLike {
  try {
    const storage = (win || (typeof window !== 'undefined' ? window : undefined))?.localStorage
    if (storage) {
      const probe = '__tavern_st_probe__'
      storage.setItem(probe, '1')
      storage.removeItem(probe)
      return storage
    }
  } catch { /* 隐私模式 */ }
  return createMemoryStorage()
}

// ---------------------------------------------------------------------------
// DOMPurify
// ---------------------------------------------------------------------------

/** 默认禁用的危险标签（DOMParser 版与正则版共用同一张表）。 */
const FORBID_CONTENT_TAGS = ['script', 'style', 'template', 'noscript']

/** 默认禁用的危险标签。 */
const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'template', 'noscript', 'frame', 'frameset', 'applet']

/** 属性值看起来是危险 URL（javascript: / 非图片 data:）。 */
function isDangerousUrl(name: string, value: string): boolean {
  if (name !== 'href' && name !== 'src' && name !== 'xlink:href' && name !== 'action' && name !== 'formaction' && name !== 'srcset') return false
  const bare = String(value).replace(/\s+/g, '').toLowerCase()
  if (bare.indexOf('javascript:') >= 0) return true
  if (bare.indexOf('vbscript:') >= 0) return true
  if (bare.indexOf('data:') >= 0 && bare.indexOf('data:image/') < 0) return true
  return false
}

/** 剥离一个元素上的危险属性（on* / javascript: / 白名单外）。 */
function cleanAttributes(el: Element, options: StSanitizeOptions): void {
  const allowedAttrs = options.ALLOWED_ATTR ? options.ALLOWED_ATTR.map((a) => a.toLowerCase()) : null
  const forbidAttrs = (options.FORBID_ATTR || []).map((a) => a.toLowerCase())
  const allowDataAttr = options.ALLOW_DATA_ATTR !== false
  const names: string[] = []
  for (let i = 0; i < el.attributes.length; i++) names.push(el.attributes[i].name)
  for (const name of names) {
    const lower = name.toLowerCase()
    const value = el.getAttribute(name) || ''
    let keep = true
    if (lower.indexOf('on') === 0 && lower.length > 2) keep = false
    else if (forbidAttrs.indexOf(lower) >= 0) keep = false
    else if (lower.indexOf('data-') === 0 && !allowDataAttr) keep = false
    else if (allowedAttrs !== null && allowedAttrs.indexOf(lower) < 0 && lower.indexOf('data-') !== 0) keep = false
    else if (isDangerousUrl(lower, value)) keep = false
    else if (lower === 'style' && /expression\(|javascript:/i.test(value)) keep = false
    if (!keep) el.removeAttribute(name)
  }
}

/** 用 DOM 树做白名单净化（DOMPurify 的正经实现面）。 */
function sanitizeWithDom(doc: Document, html: unknown, options: StSanitizeOptions): string {
  const host = doc.createElement('div')
  host.innerHTML = toStringValue(html)
  const allowedTags = options.ALLOWED_TAGS ? options.ALLOWED_TAGS.map((t) => t.toLowerCase()) : null
  const forbidTags = FORBID_TAGS.concat(options.FORBID_TAGS || []).map((t) => t.toLowerCase())
  const keepContent = options.KEEP_CONTENT !== false
  const walk = (parent: Element): void => {
    const children: Element[] = []
    for (let i = 0; i < parent.children.length; i++) children.push(parent.children[i])
    for (const el of children) {
      const tag = el.tagName.toLowerCase()
      const blocked = forbidTags.indexOf(tag) >= 0 || (allowedTags !== null && allowedTags.indexOf(tag) < 0)
      if (blocked) {
        if (FORBID_CONTENT_TAGS.indexOf(tag) >= 0 || !keepContent) {
          el.remove()
        } else {
          const grand: Element[] = []
          for (let i = 0; i < el.children.length; i++) grand.push(el.children[i])
          for (const child of grand) parent.insertBefore(child, el)
          el.remove()
        }
        continue
      }
      cleanAttributes(el, options)
      walk(el)
    }
  }
  walk(host)
  return host.innerHTML
}

/** 创建 DOMPurify 兼容对象（有 DOM 走 DOM 版，没 DOM 走正则版）。 */
export function createDOMPurify(win?: Window): StDOMPurify {
  const hooks: Record<string, Array<(node: Element) => void>> = {}
  let defaultOptions: StSanitizeOptions = {}
  const sanitize = (html: unknown, options?: StSanitizeOptions): string => {
    const merged: StSanitizeOptions = Object.assign({}, defaultOptions, options || {})
    const source = toStringValue(html)
    if (!source) return ''
    try {
      const doc = win && win.document ? win.document : (typeof document !== 'undefined' ? document : undefined)
      if (doc && typeof doc.createElement === 'function') {
        const host = doc.createElement('div')
        const out = sanitizeWithDom(doc, source, merged)
        host.innerHTML = out
        // 钩子：afterSanitizeAttributes 拿到每个元素（与 DOMPurify 用法一致）
        const list = hooks.afterSanitizeAttributes || []
        if (list.length > 0) {
          const all: Element[] = []
          const collect = (root: Element): void => {
            for (let i = 0; i < root.children.length; i++) { all.push(root.children[i]); collect(root.children[i]) }
          }
          collect(host)
          for (const el of all) {
            for (const hook of list) {
              try { hook(el) } catch (e) { console.error('[portable-tavern/st] DOMPurify 钩子异常', e) }
            }
            cleanAttributes(el, merged)
          }
        }
        return host.innerHTML
      }
    } catch (e) {
      console.error('[portable-tavern/st] DOMPurify(DOM) 失败，降级为正则版', e)
    }
    return sanitizeHtmlFallback(source, merged)
  }
  return {
    sanitize,
    addHook: (name: string, hook: (node: Element) => void): void => {
      if (typeof hook !== 'function') return
      const list = hooks[name] || (hooks[name] = [])
      list.push(hook)
    },
    removeHook: (name: string, hook: (node: Element) => void): void => {
      hooks[name] = (hooks[name] || []).filter((h) => h !== hook)
    },
    removeHooks: (name?: string): void => {
      if (name) delete hooks[name]
      else for (const key of Object.keys(hooks)) delete hooks[key]
    },
    isSupported: true,
    version: '3.1.6-portable-tavern',
    setConfig: (options?: StSanitizeOptions) => { defaultOptions = Object.assign({}, options || {}) },
    clearConfig: () => { defaultOptions = {} },
  }
}

// ---------------------------------------------------------------------------
// lodash / css 装配
// ---------------------------------------------------------------------------

/** 取页面已有的 lodash，用它的同名方法补齐自带子集（优先复用页面 lodash）。 */
function composeLodash(win?: Window): StLodash {
  const merged: StLodash = Object.assign({}, lodashSubset)
  try {
    const target = win || (typeof window !== 'undefined' ? window : undefined)
    const external = (target as unknown as { _?: unknown; lodash?: unknown } | undefined)
    const candidate = (external && (external._ || external.lodash)) as Record<string, unknown> | undefined
    if (candidate && typeof candidate === 'object') {
      for (const key of Object.keys(lodashSubset)) {
        if (typeof candidate[key] === 'function') (merged as unknown as Record<string, unknown>)[key] = candidate[key]
      }
    }
  } catch (e) {
    console.error('[portable-tavern/st] 复用页面 lodash 失败，使用自带子集', e)
  }
  return merged
}

/** 创建 libs.css（安全空壳；escape 是真实现）。 */
export function createCssLib(): StCssLib {
  return {
    escape: (value: unknown): string => toStringValue(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\' + ch),
    parse: () => ({ type: 'stylesheet', stylesheet: { rules: [] } }),
    stringify: () => '',
    compress: (input?: string) => toStringValue(input),
  }
}

// ---------------------------------------------------------------------------
// 总装
// ---------------------------------------------------------------------------

/**
 * 组装 window.SillyTavern.libs：字段齐全、类型正确，缺失能力用安全空壳而不是 undefined。
 *
 * @param win 目标 window（默认全局 window；测试可注入假 window）。
 */
export function createStLibs(win?: Window): StLibs {
  const target = win || (typeof window !== 'undefined' ? window : undefined)
  const userAgent = target && target.navigator ? String(target.navigator.userAgent || '') : ''
  return {
    lodash: composeLodash(target),
    Fuse: createFuseClass(),
    DOMPurify: createDOMPurify(target),
    hljs: createHljs(),
    localforage: createLocalforage(resolveStorage(target)),
    Handlebars: createHandlebars(),
    css: createCssLib(),
    Bowser: createBowser(userAgent),
  }
}


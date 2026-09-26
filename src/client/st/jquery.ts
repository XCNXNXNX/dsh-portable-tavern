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

import { debounce, toStringValue } from './libs-pure.ts'

// ---------------------------------------------------------------------------
// 类型面
// ---------------------------------------------------------------------------

/** jQuery 风格集合（类数组）。 */
export interface StJQueryCollection {
  /** 命中元素个数。 */
  length: number
  /** 下标访问。 */
  [index: number]: Element
  /** 遍历并在回调返回 false 时中断。 */
  each(fn: (this: Element, index: number, element: Element) => unknown): StJQueryCollection
  /** 取原生元素（无参返回数组）。 */
  get(index?: number): any
  /** 首元素在兄弟中的下标。 */
  index(): number
  /** 取第 i 个（支持负数）。 */
  eq(index: number): StJQueryCollection
  /** 第一个。 */
  first(): StJQueryCollection
  /** 最后一个。 */
  last(): StJQueryCollection
  /** 追加子节点（HTML 字符串 / 元素 / 集合）。 */
  append(content: unknown): StJQueryCollection
  /** 前插子节点。 */
  prepend(content: unknown): StJQueryCollection
  /** 插到后面（同级）。 */
  after(content: unknown): StJQueryCollection
  /** 插到前面（同级）。 */
  before(content: unknown): StJQueryCollection
  /** 把选中的元素挂到目标下面。 */
  appendTo(target: unknown): StJQueryCollection
  /** 从 DOM 移除。 */
  remove(selector?: string): StJQueryCollection
  /** 清空子节点。 */
  empty(): StJQueryCollection
  /** 读/写 innerHTML。 */
  html(value?: unknown): any
  /** 读/写 textContent。 */
  text(value?: unknown): any
  /** 读/写表单值。 */
  val(value?: unknown): any
  /** 读/写属性。 */
  attr(name: unknown, value?: unknown): any
  /** 删属性。 */
  removeAttr(name: string): StJQueryCollection
  /** 加 class。 */
  addClass(names: string): StJQueryCollection
  /** 删 class。 */
  removeClass(names?: string): StJQueryCollection
  /** 切换 class。 */
  toggleClass(names: string, state?: boolean): StJQueryCollection
  /** 是否有 class。 */
  hasClass(name: string): boolean
  /** 读/写内联样式（支持 kebab / camel 两种写法）。 */
  css(name: unknown, value?: unknown): any
  /** 显示。 */
  show(): StJQueryCollection
  /** 隐藏。 */
  hide(): StJQueryCollection
  /** 切换显示。 */
  toggle(force?: boolean): StJQueryCollection
  /** 淡入。 */
  fadeIn(duration?: number, callback?: () => void): StJQueryCollection
  /** 淡出。 */
  fadeOut(duration?: number, callback?: () => void): StJQueryCollection
  /** 绑定事件（支持委托与事件名映射对象）。 */
  on(events: unknown, selectorOrHandler?: unknown, handler?: unknown): StJQueryCollection
  /** 解绑事件。 */
  off(events?: string, selectorOrHandler?: unknown, handler?: unknown): StJQueryCollection
  /** 只触发一次。 */
  one(events: unknown, selectorOrHandler?: unknown, handler?: unknown): StJQueryCollection
  /** click 简写。 */
  click(handler?: unknown): StJQueryCollection
  /** change 简写。 */
  change(handler?: unknown): StJQueryCollection
  /** input 简写。 */
  input(handler?: unknown): StJQueryCollection
  /** 触发事件（会冒泡）。 */
  trigger(event: string, extra?: unknown): StJQueryCollection
  /** 触发已绑定处理器（不冒泡），返回最后一个处理器的返回值。 */
  triggerHandler(event: string, extra?: unknown): any
  /** 在后代里查找。 */
  find(selector: string): StJQueryCollection
  /** 最近的祖先（含自身）。 */
  closest(selector: string): StJQueryCollection
  /** 直接父元素。 */
  parent(): StJQueryCollection
  /** 直接子元素。 */
  children(selector?: string): StJQueryCollection
  /** 是否匹配选择器。 */
  is(selector: string): boolean
  /** 读/写 data-*（含 jQuery .data() 缓存语义）。 */
  data(key?: string, value?: unknown): any
}

/** $.ajax 的参数（只支持同源 GET）。 */
export interface StAjaxOptions {
  /** 目标 URL（相对当前页面解析）。 */
  url?: string
  /** 请求方法；只支持 GET，其它会走 error 回调。 */
  type?: string
  /** type 的别名。 */
  method?: string
  /** GET 查询参数（对象会序列化）。 */
  data?: unknown
  /** 'json' | 'text'。 */
  dataType?: string
  /** 额外请求头。 */
  headers?: Record<string, string>
  /** 成功回调。 */
  success?: (data: any, textStatus: string, xhr: StJQueryXhr) => void
  /** 失败回调。 */
  error?: (xhr: StJQueryXhr, textStatus: string, errorThrown: string) => void
  /** 完成回调（无论成败）。 */
  complete?: (xhr: StJQueryXhr, textStatus: string) => void
  /** 超时毫秒。 */
  timeout?: number
  /** 是否走缓存（默认 true，与 jQuery 一致）。 */
  cache?: boolean
}

/** $.ajax 的返回值：既是 thenable，也有 jQuery 的 done/fail/always。 */
export interface StJQueryXhr extends Promise<unknown> {
  /** 成功回调（可链）。 */
  done(callback: (data: any, textStatus: string, xhr: StJQueryXhr) => unknown): StJQueryXhr
  /** 失败回调（可链）。 */
  fail(callback: (xhr: StJQueryXhr, textStatus: string, errorThrown: string) => unknown): StJQueryXhr
  /** 完成回调（可链）。 */
  always(callback: (xhr: StJQueryXhr, textStatus: string) => unknown): StJQueryXhr
  /** 中断请求。 */
  abort(): void
  /** HTTP 状态码（0 = 未完成/被中断）。 */
  status: number
  /** 响应文本。 */
  responseText: string
  /** 响应头。 */
  getResponseHeader(name: string): string | null
  /** readyState。 */
  readyState: number
}

/** jQuery 静态面。 */
export interface StJQueryStatic {
  (selector?: unknown, context?: unknown): StJQueryCollection
  /** 原型（扩展常用 $.fn.myPlugin = ...）。 */
  fn: Record<string, unknown>
  /** 深/浅合并；$.extend(true, target, src) 支持深合并。 */
  extend(...args: unknown[]): any
  /** 遍历对象/数组。 */
  each(collection: unknown, callback: (index: any, value: any) => unknown): unknown
  /** 映射。 */
  map(collection: unknown, callback: (value: any, index: any) => unknown): unknown[]
  /** 过滤。 */
  grep(list: unknown[], callback: (value: any, index: number) => unknown, invert?: boolean): unknown[]
  /** 下标查找。 */
  inArray(value: unknown, list: unknown[], fromIndex?: number): number
  /** 同源 GET（thenable）。 */
  ajax(options: StAjaxOptions | string): StJQueryXhr
  /** 同源 GET 简写。 */
  get(url: string, data?: unknown, success?: (data: any) => void): StJQueryXhr
  /** 对象序列化成查询串。 */
  param(value: unknown): string
  /** HTML -> 元素数组。 */
  parseHTML(html: string): Element[]
  /** 去空白。 */
  trim(value: unknown): string
  /** 是否数组。 */
  isArray(value: unknown): boolean
  /** 是否函数。 */
  isFunction(value: unknown): boolean
  /** 是否数字（含数字字符串）。 */
  isNumeric(value: unknown): boolean
  /** a 是否包含 b。 */
  contains(a: Node, b: Node): boolean
  /** 空函数。 */
  noop(): void
  /** 当前时间戳。 */
  now(): number
  /** 类数组 -> 真数组。 */
  makeArray(value: unknown): unknown[]
  /** DOM 就绪回调。 */
  ready(callback: () => void): void
}

// ---------------------------------------------------------------------------
// 选择器引擎
// ---------------------------------------------------------------------------

/** 原生支持的伪类（交给 querySelectorAll）。 */
const NATIVE_PSEUDOS = [
  'not', 'is', 'where', 'has', 'nth-child', 'nth-of-type', 'nth-last-child', 'nth-last-of-type',
  'first-child', 'last-child', 'first-of-type', 'last-of-type', 'only-child', 'only-of-type',
  'checked', 'disabled', 'enabled', 'required', 'optional', 'focus', 'focus-visible', 'focus-within',
  'root', 'empty', 'target', 'scope', 'placeholder-shown', 'read-only', 'read-write', 'default', 'indeterminate',
]

/** jQuery 专有伪类：能降级的降级，降不了就空集合 + onWarn。 */
const JQ_PSEUDOS = ['visible', 'hidden', 'first', 'last', 'eq', 'even', 'odd', 'contains', 'selected', 'input', 'parent', 'header', 'animated', 'button', 'text', 'submit', 'password', 'radio', 'checkbox', 'file', 'image', 'reset']

/** 选择器解析结果。 */
interface StParsedSelector {
  /** 去掉 jQuery 伪类后的原生选择器（空串表示 '*'）。 */
  base: string
  /** 需要后置过滤的伪类。 */
  filters: Array<{ name: string; arg: string }>
  /** 是否包含无法支持的伪类。 */
  unsupported: string[]
}

/** 判断元素是否可见（jQuery :visible 的近似实现）。 */
function isVisible(el: Element): boolean {
  try {
    if (typeof (el as HTMLElement).getClientRects === 'function' && (el as HTMLElement).getClientRects().length > 0) return true
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
    }
    return (el as HTMLElement).offsetParent !== null
  } catch { return true }
}

/** 把选择器拆成“原生部分 + 后置过滤伪类”。 */
function parseSelector(selector: string): StParsedSelector {
  const filters: Array<{ name: string; arg: string }> = []
  const unsupported: string[] = []
  let base = ''
  let i = 0
  while (i < selector.length) {
    const ch = selector.charAt(i)
    if (ch !== ':' || selector.charAt(i + 1) === ':') {
      base += ch
      if (ch === ':' && selector.charAt(i + 1) === ':') { base += ':'; i += 2; continue }
      i += 1
      continue
    }
    const match = /^:([a-zA-Z-]+)/.exec(selector.slice(i))
    if (!match) { base += ch; i += 1; continue }
    const name = match[1].toLowerCase()
    let end = i + match[0].length
    let arg = ''
    if (selector.charAt(end) === '(') {
      let depth = 0
      let j = end
      for (; j < selector.length; j++) {
        const c = selector.charAt(j)
        if (c === '(') depth += 1
        else if (c === ')') { depth -= 1; if (depth === 0) break }
      }
      arg = selector.slice(end + 1, j)
      end = j + 1
    }
    if (NATIVE_PSEUDOS.indexOf(name) >= 0) {
      base += selector.slice(i, end)
      i = end
      continue
    }
    if (JQ_PSEUDOS.indexOf(name) >= 0) {
      filters.push({ name, arg })
      i = end
      continue
    }
    unsupported.push(name)
    i = end
  }
  return { base: base.trim() === '' ? '*' : base.trim(), filters, unsupported }
}

/** 按伪类过滤一组元素。 */
function applyFilters(elements: Element[], parsed: StParsedSelector): Element[] {
  let out = elements
  for (const filter of parsed.filters) {
    const name = filter.name
    const arg = filter.arg
    if (name === 'visible') out = out.filter((el) => isVisible(el))
    else if (name === 'hidden') out = out.filter((el) => !isVisible(el))
    else if (name === 'first') out = out.slice(0, 1)
    else if (name === 'last') out = out.slice(-1)
    else if (name === 'eq') {
      const n = Number(arg)
      out = Number.isNaN(n) ? [] : (n < 0 ? out.slice(n) : out.slice(n, n + 1))
    } else if (name === 'even') out = out.filter((_el, i) => i % 2 === 0)
    else if (name === 'odd') out = out.filter((_el, i) => i % 2 === 1)
    else if (name === 'contains') out = out.filter((el) => String(el.textContent || '').indexOf(arg.trim().replace(/^["']|["']$/g, '')) >= 0)
    else if (name === 'has') out = out.filter((el) => { try { return el.querySelector(arg) !== null } catch { return false } })
    else if (name === 'selected') out = out.filter((el) => (el as HTMLOptionElement).selected === true)
    else if (name === 'input') out = out.filter((el) => ['input', 'select', 'textarea', 'button'].indexOf(el.tagName.toLowerCase()) >= 0)
    else if (['button', 'text', 'submit', 'password', 'radio', 'checkbox', 'file', 'image', 'reset'].indexOf(name) >= 0) {
      out = out.filter((el) => {
        const tag = el.tagName.toLowerCase()
        if (name === 'button') return tag === 'button' || (tag === 'input' && String((el as HTMLInputElement).type) === 'button')
        return tag === 'input' && String((el as HTMLInputElement).type) === name
      })
    } else if (name === 'parent') out = out.filter((el) => el.childNodes.length > 0)
    else if (name === 'header') out = out.filter((el) => /^h[1-6]$/.test(el.tagName.toLowerCase()))
    else out = []
  }
  return out
}

// ---------------------------------------------------------------------------
// 集合内部状态
// ---------------------------------------------------------------------------

/** 元素 -> jQuery .data() 缓存。 */
const elementData = new WeakMap<Element, Record<string, unknown>>()

/** 元素 -> 已绑定事件记录。 */
const eventRegistry = new WeakMap<Element, StEventHandler[]>()

/** 元素 -> hide() 之前的 display 值。 */
const displayStore = new WeakMap<Element, string>()

/** 已经 onWarn 过的降级点（避免刷屏）。 */
const warnedKeys = new Set<string>()

/** 一条事件绑定记录。 */
interface StEventHandler {
  type: string
  fn: EventListener
  orig: (...args: any[]) => any
  selector: string
  once: boolean
}

/** 数值型不需要单位的 CSS 属性。 */
const UNITLESS_PROPS = ['opacity', 'zIndex', 'z-index', 'flex', 'flexGrow', 'flexShrink', 'fontWeight', 'font-weight', 'lineHeight', 'line-height', 'order', 'zoom', 'columnCount', 'orphans', 'widows']

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** camelCase -> kebab-case。 */
function kebab(name: string): string {
  return String(name).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
}

/** 把 HTML 字符串变成节点数组。 */
function parseHtmlNodes(doc: Document, html: string): Node[] {
  const template = doc.createElement('template')
  template.innerHTML = html
  const out: Node[] = []
  const content = template.content
  for (let i = 0; i < content.childNodes.length; i++) out.push(content.childNodes[i])
  return out
}

/** 把任意“内容”参数变成一组节点（HTML 字符串 / 元素 / 节点 / 集合 / 数组）。 */
function resolveContent(doc: Document | undefined, content: unknown): Node[] {
  if (content === null || content === undefined || content === false) return []
  if (typeof content === 'string') {
    if (doc && content.indexOf('<') >= 0) return parseHtmlNodes(doc, content)
    return doc ? [doc.createTextNode(content)] : []
  }
  if (typeof content === 'number' || typeof content === 'boolean') {
    return doc ? [doc.createTextNode(String(content))] : []
  }
  if (typeof content === 'object' && (content as Node).nodeType) return [content as Node]
  if (Array.isArray(content)) {
    const out: Node[] = []
    for (const item of content) for (const node of resolveContent(doc, item)) out.push(node)
    return out
  }
  const list = content as ArrayLike<unknown>
  if (typeof list.length === 'number') {
    const out: Node[] = []
    for (let i = 0; i < list.length; i++) for (const node of resolveContent(doc, list[i])) out.push(node)
    return out
  }
  return []
}

/** 造一个集合（Object.create 到共享原型，保证 $.fn 扩展可用）。 */
function makeCollection(proto: Record<string, unknown>, elements: Element[]): StJQueryCollection {
  const obj = Object.create(proto) as StJQueryCollection
  for (let i = 0; i < elements.length; i++) (obj as unknown as Record<number, Element>)[i] = elements[i]
  obj.length = elements.length
  return obj
}

/** 去重（保持顺序）。 */
function uniqueElements(list: Element[]): Element[] {
  const out: Element[] = []
  for (const el of list) if (out.indexOf(el) < 0) out.push(el)
  return out
}

// ---------------------------------------------------------------------------
// 原型方法
// ---------------------------------------------------------------------------

/** 创建迷你 jQuery 原型（$.fn）。 */
function createPrototype(deps: {
  doc: Document | undefined
  win: Window | undefined
  warn(key: string, message: string): void
}): Record<string, unknown> {
  const { doc, win, warn } = deps
  const proto: Record<string, unknown> = {}

  proto.each = function (this: StJQueryCollection, fn: (this: Element, index: number, element: Element) => unknown): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      if (fn.call(this[i], i, this[i]) === false) break
    }
    return this
  }

  proto.get = function (this: StJQueryCollection, index?: number): any {
    if (index === undefined) {
      const out: Element[] = []
      for (let i = 0; i < this.length; i++) out.push(this[i])
      return out
    }
    const i = index < 0 ? this.length + index : index
    return i >= 0 && i < this.length ? this[i] : undefined
  }

  proto.index = function (this: StJQueryCollection): number {
    const el = this[0]
    if (!el || !el.parentElement) return -1
    return Array.prototype.indexOf.call(el.parentElement.children, el)
  }

  proto.eq = function (this: StJQueryCollection, index: number): StJQueryCollection {
    const i = index < 0 ? this.length + index : index
    return makeCollection(proto, i >= 0 && i < this.length ? [this[i]] : [])
  }

  proto.first = function (this: StJQueryCollection): StJQueryCollection {
    return makeCollection(proto, this.length > 0 ? [this[0]] : [])
  }

  proto.last = function (this: StJQueryCollection): StJQueryCollection {
    return makeCollection(proto, this.length > 0 ? [this[this.length - 1]] : [])
  }

  proto.append = function (this: StJQueryCollection, content: unknown): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      for (const node of resolveContent(doc, content)) this[i].appendChild(node)
    }
    return this
  }

  proto.prepend = function (this: StJQueryCollection, content: unknown): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      const first = this[i].firstChild
      for (const node of resolveContent(doc, content)) this[i].insertBefore(node, first)
    }
    return this
  }

  proto.after = function (this: StJQueryCollection, content: unknown): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      const el = this[i]
      const parent = el.parentNode
      if (!parent) continue
      const next = el.nextSibling
      for (const node of resolveContent(doc, content)) parent.insertBefore(node, next)
    }
    return this
  }

  proto.before = function (this: StJQueryCollection, content: unknown): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      const el = this[i]
      const parent = el.parentNode
      if (!parent) continue
      for (const node of resolveContent(doc, content)) parent.insertBefore(node, el)
    }
    return this
  }

  proto.appendTo = function (this: StJQueryCollection, target: unknown): StJQueryCollection {
    const targets = toElements(target, doc, warn)
    for (const node of targets) {
      for (let i = 0; i < this.length; i++) node.appendChild(this[i])
    }
    return this
  }

  proto.remove = function (this: StJQueryCollection, selector?: string): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      const el = this[i]
      if (selector) {
        let matched = false
        try { matched = el.matches(selector) } catch { matched = false }
        if (!matched) continue
      }
      if (el.parentNode) el.parentNode.removeChild(el)
    }
    return this
  }

  proto.empty = function (this: StJQueryCollection): StJQueryCollection {
    for (let i = 0; i < this.length; i++) this[i].innerHTML = ''
    return this
  }

  proto.html = function (this: StJQueryCollection, value?: unknown): any {
    if (value === undefined) return this.length > 0 ? this[0].innerHTML : undefined
    for (let i = 0; i < this.length; i++) this[i].innerHTML = toStringValue(value)
    return this
  }

  proto.text = function (this: StJQueryCollection, value?: unknown): any {
    if (value === undefined) return this.length > 0 ? String(this[0].textContent || '') : undefined
    for (let i = 0; i < this.length; i++) this[i].textContent = toStringValue(value)
    return this
  }

  proto.val = function (this: StJQueryCollection, value?: unknown): any {
    if (value === undefined) {
      const el = this[0] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined
      return el ? el.value : undefined
    }
    for (let i = 0; i < this.length; i++) {
      const el = this[i] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      if (typeof value === 'boolean' && 'checked' in el) {
        (el as HTMLInputElement).checked = value
        continue
      }
      try { el.value = toStringValue(value) } catch (e) { console.error('[portable-tavern/st] .val() 写入失败', e) }
    }
    return this
  }

  proto.attr = function (this: StJQueryCollection, name: unknown, value?: unknown): any {
    if (name && typeof name === 'object') {
      for (const key of Object.keys(name as Record<string, unknown>)) {
        for (let i = 0; i < this.length; i++) this[i].setAttribute(key, toStringValue((name as Record<string, unknown>)[key]))
      }
      return this
    }
    const key = toStringValue(name)
    if (value === undefined) return this.length > 0 ? this[0].getAttribute(key) : undefined
    for (let i = 0; i < this.length; i++) {
      if (value === null) this[i].removeAttribute(key)
      else this[i].setAttribute(key, toStringValue(value))
    }
    return this
  }

  proto.removeAttr = function (this: StJQueryCollection, name: string): StJQueryCollection {
    const names = String(name).split(/\s+/).filter(Boolean)
    for (let i = 0; i < this.length; i++) for (const key of names) this[i].removeAttribute(key)
    return this
  }

  proto.addClass = function (this: StJQueryCollection, names: string): StJQueryCollection {
    const list = String(names).split(/\s+/).filter(Boolean)
    for (let i = 0; i < this.length; i++) for (const name of list) this[i].classList.add(name)
    return this
  }

  proto.removeClass = function (this: StJQueryCollection, names?: string): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      if (names === undefined || names === '') { this[i].className = ''; continue }
      const list = String(names).split(/\s+/).filter(Boolean)
      for (const name of list) this[i].classList.remove(name)
    }
    return this
  }

  proto.toggleClass = function (this: StJQueryCollection, names: string, state?: boolean): StJQueryCollection {
    const list = String(names).split(/\s+/).filter(Boolean)
    for (let i = 0; i < this.length; i++) {
      for (const name of list) {
        if (state === undefined) this[i].classList.toggle(name)
        else if (state) this[i].classList.add(name)
        else this[i].classList.remove(name)
      }
    }
    return this
  }

  proto.hasClass = function (this: StJQueryCollection, name: string): boolean {
    return this.length > 0 ? this[0].classList.contains(name) : false
  }

  proto.css = function (this: StJQueryCollection, name: unknown, value?: unknown): any {
    if (name && typeof name === 'object') {
      for (const key of Object.keys(name as Record<string, unknown>)) this.css(key, (name as Record<string, unknown>)[key])
      return this
    }
    const prop = toStringValue(name)
    if (value === undefined) {
      const el = this[0] as HTMLElement | undefined
      if (!el) return undefined
      try {
        if (win && typeof win.getComputedStyle === 'function') {
          const computed = win.getComputedStyle(el)
          const found = computed.getPropertyValue(kebab(prop))
          if (found) return found
        }
      } catch { /* 取不到就用内联值 */ }
      const style = (el as HTMLElement).style as unknown as Record<string, unknown>
      return style[prop] !== undefined ? style[prop] : (el as HTMLElement).style.getPropertyValue(kebab(prop))
    }
    const text = typeof value === 'number' && UNITLESS_PROPS.indexOf(prop) < 0 ? String(value) + 'px' : toStringValue(value)
    for (let i = 0; i < this.length; i++) {
      const el = this[i] as HTMLElement
      try { el.style.setProperty(kebab(prop), text) } catch (e) { console.error('[portable-tavern/st] .css() 写入失败', e) }
    }
    return this
  }

  proto.show = function (this: StJQueryCollection): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      const el = this[i] as HTMLElement
      const prev = displayStore.get(el)
      el.style.display = prev !== undefined && prev !== 'none' ? prev : ''
    }
    return this
  }

  proto.hide = function (this: StJQueryCollection): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      const el = this[i] as HTMLElement
      if (el.style.display !== 'none') displayStore.set(el, el.style.display)
      el.style.display = 'none'
    }
    return this
  }

  proto.toggle = function (this: StJQueryCollection, force?: boolean): StJQueryCollection {
    const shouldShow = force === undefined ? (this.length > 0 ? (this[0] as HTMLElement).style.display === 'none' : false) : force
    const showFn = proto.show as (this: StJQueryCollection) => StJQueryCollection
    const hideFn = proto.hide as (this: StJQueryCollection) => StJQueryCollection
    return shouldShow ? showFn.call(this) : hideFn.call(this)
  }

  proto.fadeIn = function (this: StJQueryCollection, duration?: number, callback?: () => void): StJQueryCollection {
    for (let i = 0; i < this.length; i++) fadeElement(this[i] as HTMLElement, 0, 1, duration, callback)
    return this
  }

  proto.fadeOut = function (this: StJQueryCollection, duration?: number, callback?: () => void): StJQueryCollection {
    for (let i = 0; i < this.length; i++) fadeElement(this[i] as HTMLElement, 1, 0, duration, callback)
    return this
  }

  proto.on = function (this: StJQueryCollection, events: unknown, selectorOrHandler?: unknown, handlerArg?: unknown): StJQueryCollection {
    if (events && typeof events === 'object' && !Array.isArray(events)) {
      for (const key of Object.keys(events as Record<string, unknown>)) this.on(key, (events as Record<string, unknown>)[key])
      return this
    }
    const types = String(events || '').split(/\s+/).filter(Boolean)
    let selector = ''
    let handler: unknown = selectorOrHandler
    if (typeof selectorOrHandler === 'string') {
      selector = selectorOrHandler
      handler = handlerArg
    }
    if (typeof handler !== 'function') return this
    for (let i = 0; i < this.length; i++) bindEvent(this[i], types, selector, handler as (...args: any[]) => any, false, warn)
    return this
  }

  proto.one = function (this: StJQueryCollection, events: unknown, selectorOrHandler?: unknown, handlerArg?: unknown): StJQueryCollection {
    const types = String(events || '').split(/\s+/).filter(Boolean)
    let selector = ''
    let handler: unknown = selectorOrHandler
    if (typeof selectorOrHandler === 'string') {
      selector = selectorOrHandler
      handler = handlerArg
    }
    if (typeof handler !== 'function') return this
    for (let i = 0; i < this.length; i++) bindEvent(this[i], types, selector, handler as (...args: any[]) => any, true, warn)
    return this
  }

  proto.off = function (this: StJQueryCollection, events?: string, selectorOrHandler?: unknown, handlerArg?: unknown): StJQueryCollection {
    const types = events ? String(events).split(/\s+/).filter(Boolean) : []
    let selector: string | null = null
    let handler: unknown = selectorOrHandler
    if (typeof selectorOrHandler === 'string') {
      selector = selectorOrHandler
      handler = handlerArg
    }
    for (let i = 0; i < this.length; i++) unbindEvent(this[i], types, selector, typeof handler === 'function' ? handler as (...args: any[]) => any : null)
    return this
  }

  proto.click = function (this: StJQueryCollection, handler?: unknown): StJQueryCollection {
    if (typeof handler === 'function') return this.on('click', handler)
    return this.trigger('click')
  }

  proto.change = function (this: StJQueryCollection, handler?: unknown): StJQueryCollection {
    if (typeof handler === 'function') return this.on('change', handler)
    return this.trigger('change')
  }

  proto.input = function (this: StJQueryCollection, handler?: unknown): StJQueryCollection {
    if (typeof handler === 'function') return this.on('input', handler)
    return this.trigger('input')
  }

  proto.trigger = function (this: StJQueryCollection, event: string, extra?: unknown): StJQueryCollection {
    for (let i = 0; i < this.length; i++) {
      const node = this[i] as HTMLElement
      try {
        const evt = createEvent(win, node, event, extra)
        node.dispatchEvent(evt)
      } catch (e) { console.error('[portable-tavern/st] .trigger() 失败: ' + event, e) }
    }
    return this
  }

  proto.triggerHandler = function (this: StJQueryCollection, event: string, extra?: unknown): any {
    const el = this[0]
    if (!el) return undefined
    const records = (eventRegistry.get(el) || []).filter((rec) => rec.type === event)
    let result: any
    const fake = {
      type: event,
      target: el,
      currentTarget: el,
      defaultPrevented: false,
      preventDefault: () => { /* 直接调用没有默认行为 */ },
      stopPropagation: () => { /* 直接调用不冒泡 */ },
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      __stExtra: extra === undefined ? [] : [extra],
    }
    for (const rec of records) {
      try { result = rec.orig.apply(el, ([fake] as unknown[]).concat(fake.__stExtra)) } catch (e) { console.error('[portable-tavern/st] triggerHandler 处理器异常: ' + event, e) }
    }
    return result
  }

  proto.find = function (this: StJQueryCollection, selector: string): StJQueryCollection {
    const found: Element[] = []
    const parsed = parseSelector(String(selector))
    if (parsed.unsupported.length > 0) {
      warn('pseudo:' + parsed.unsupported.join(','), 'jQuery 伪类 :' + parsed.unsupported.join(', :') + ' 暂不支持，已返回空集合')
      return makeCollection(proto, [])
    }
    for (let i = 0; i < this.length; i++) {
      let list: Element[] = []
      try { list = Array.prototype.slice.call(this[i].querySelectorAll(parsed.base)) as Element[] } catch (e) {
        warn('selector:' + parsed.base, '选择器无法交给原生引擎（' + parsed.base + '），已返回空集合')
        continue
      }
      for (const el of applyFilters(list, parsed)) found.push(el)
    }
    return makeCollection(proto, uniqueElements(found))
  }

  proto.closest = function (this: StJQueryCollection, selector: string): StJQueryCollection {
    const found: Element[] = []
    for (let i = 0; i < this.length; i++) {
      try {
        const hit = this[i].closest(selector)
        if (hit) found.push(hit)
      } catch (e) {
        warn('closest:' + selector, 'closest 无法匹配选择器 ' + selector)
      }
    }
    return makeCollection(proto, uniqueElements(found))
  }

  proto.parent = function (this: StJQueryCollection): StJQueryCollection {
    const found: Element[] = []
    for (let i = 0; i < this.length; i++) {
      const parent = this[i].parentElement
      if (parent) found.push(parent)
    }
    return makeCollection(proto, uniqueElements(found))
  }

  proto.children = function (this: StJQueryCollection, selector?: string): StJQueryCollection {
    const found: Element[] = []
    for (let i = 0; i < this.length; i++) {
      const el = this[i]
      for (let j = 0; j < el.children.length; j++) {
        const child = el.children[j]
        if (selector) {
          let matched = false
          try { matched = child.matches(selector) } catch { matched = false }
          if (!matched) continue
        }
        found.push(child)
      }
    }
    return makeCollection(proto, uniqueElements(found))
  }

  proto.is = function (this: StJQueryCollection, selector: string): boolean {
    if (this.length === 0) return false
    try { return this[0].matches(selector) } catch (e) {
      warn('is:' + selector, 'is() 无法匹配选择器 ' + selector)
      return false
    }
  }

  proto.data = function (this: StJQueryCollection, key?: string, value?: unknown): any {
    const el = this[0]
    if (!el) return undefined
    const store = elementData.get(el) || {}
    if (key === undefined) {
      const out: Record<string, unknown> = {}
      const dataset = (el as HTMLElement).dataset || {}
      for (const k of Object.keys(dataset)) out[k] = (dataset as Record<string, unknown>)[k]
      return Object.assign(out, store)
    }
    if (value === undefined) {
      if (Object.prototype.hasOwnProperty.call(store, key)) return store[key]
      const attr = (el as HTMLElement).dataset ? (el as HTMLElement).dataset[key] : undefined
      return attr
    }
    store[key] = value
    elementData.set(el, store)
    return this
  }

  return proto
}

// ---------------------------------------------------------------------------
// 事件绑定内部实现
// ---------------------------------------------------------------------------

/** 从事件对象里取 trigger 附加参数。 */
function extraArgsOf(event: Event): unknown[] {
  const extra = (event as unknown as { __stExtra?: unknown[] }).__stExtra
  return Array.isArray(extra) ? extra : []
}

/** 造一个事件对象（click/keydown 等用具体构造器，其余用 CustomEvent）。 */
function createEvent(win: Window | undefined, el: Element, type: string, extra?: unknown): Event {
  const payload = extra === undefined ? [] : [extra]
  let event: Event
  const target = win as unknown as Record<string, any> | undefined
  try {
    if (target && ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'contextmenu'].indexOf(type) >= 0) {
      event = new target.MouseEvent(type, { bubbles: true, cancelable: true, view: win })
    } else if (target && ['keydown', 'keyup', 'keypress'].indexOf(type) >= 0) {
      event = new target.KeyboardEvent(type, { bubbles: true, cancelable: true })
    } else if (target && typeof target.CustomEvent === 'function') {
      event = new target.CustomEvent(type, { bubbles: true, cancelable: true, detail: extra })
    } else {
      event = new Event(type, { bubbles: true, cancelable: true })
    }
  } catch (e) {
    event = new Event(type, { bubbles: true, cancelable: true })
  }
  try { (event as unknown as { __stExtra?: unknown[] }).__stExtra = payload } catch { /* 只读事件对象 */ }
  void el
  return event
}

/** 绑定一个事件（支持委托与 once），处理器异常一律吞掉。 */
function bindEvent(
  el: Element,
  types: string[],
  selector: string,
  handler: (...args: any[]) => any,
  once: boolean,
  warn: (key: string, message: string) => void,
): void {
  const list = eventRegistry.get(el) || []
  for (const type of types) {
    const record: StEventHandler = { type, fn: () => { /* 下面覆盖 */ }, orig: handler, selector, once }
    record.fn = (event: Event): void => {
      let thisArg: Element = el
      if (selector) {
        const targetEl = event.target as Element | null
        if (!targetEl || typeof targetEl.closest !== 'function') return
        let matched: Element | null = null
        try { matched = targetEl.closest(selector) } catch { matched = null }
        if (!matched || !el.contains(matched)) return
        thisArg = matched
      }
      if (once) unbindEvent(el, [], null, handler, type)
      try {
        const result = handler.apply(thisArg, ([event] as unknown[]).concat(extraArgsOf(event)))
        if (result === false && event.cancelable) {
          event.preventDefault()
          event.stopPropagation()
        }
      } catch (e) {
        console.error('[portable-tavern/st] 事件处理器异常 (' + type + ')', e)
      }
    }
    list.push(record)
    try { el.addEventListener(type, record.fn) } catch (e) {
      warn('bind:' + type, '事件 ' + type + ' 绑定失败：' + String(e))
    }
  }
  eventRegistry.set(el, list)
}

/** 解绑事件（可按 type / selector / handler 过滤）。 */
function unbindEvent(
  el: Element,
  types: string[],
  selector: string | null,
  handler: ((...args: any[]) => any) | null,
  onlyType?: string,
): void {
  const list = eventRegistry.get(el) || []
  const keep: StEventHandler[] = []
  for (const record of list) {
    const typeMatch = (types.length === 0 || types.indexOf(record.type) >= 0) && (onlyType === undefined || record.type === onlyType)
    const selectorMatch = selector === null || record.selector === selector
    const handlerMatch = handler === null || record.orig === handler
    if (typeMatch && selectorMatch && handlerMatch) {
      try { el.removeEventListener(record.type, record.fn) } catch { /* 忽略 */ }
      continue
    }
    keep.push(record)
  }
  eventRegistry.set(el, keep)
}

/** 淡入/淡出（尊重 prefers-reduced-motion）。 */
function fadeElement(el: HTMLElement, from: number, to: number, duration?: number, callback?: () => void): void {
  if (!el || !el.style) return
  const ms = Math.max(0, typeof duration === 'number' ? duration : 200)
  const finish = (): void => {
    el.style.opacity = String(to)
    if (to === 0) {
      if (el.style.display !== 'none') displayStore.set(el, el.style.display)
      el.style.display = 'none'
    } else {
      const prev = displayStore.get(el)
      el.style.display = prev !== undefined && prev !== 'none' ? prev : ''
    }
    if (typeof callback === 'function') { try { callback() } catch (e) { console.error('[portable-tavern/st] fade 回调异常', e) } }
  }
  try {
    if (ms === 0) { finish(); return }
    el.style.transition = 'opacity ' + ms + 'ms linear'
    el.style.opacity = String(from)
    void el.offsetWidth
    el.style.opacity = String(to)
    const timer = typeof window !== 'undefined' ? window.setTimeout : setTimeout
    timer(() => { el.style.transition = ''; finish() }, ms + 30)
  } catch (e) {
    console.error('[portable-tavern/st] fade 动画失败', e)
    finish()
  }
}

// ---------------------------------------------------------------------------
// 选择器 -> 元素
// ---------------------------------------------------------------------------

/** 判断是不是元素/文档/窗口级节点。 */
function isElementLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const nodeType = (value as Node).nodeType
  return nodeType === 1 || nodeType === 9 || nodeType === 11
}

/** 把任意选择器/元素/集合解析成元素数组。 */
function toElements(
  selector: unknown,
  doc: Document | undefined,
  warn: (key: string, message: string) => void,
  context?: unknown,
): Element[] {
  if (selector === null || selector === undefined || selector === false) return []
  if (typeof selector === 'string') {
    const text = selector.trim()
    if (!text) return []
    if (text.charAt(0) === '<') return parseHtmlNodes(doc as Document, text).filter(isElementLike) as Element[]
    const parsed = parseSelector(text)
    if (parsed.unsupported.length > 0) {
      warn('pseudo:' + parsed.unsupported.join(','), 'jQuery 伪类 :' + parsed.unsupported.join(', :') + ' 暂不支持，已返回空集合')
      return []
    }
    const roots: Array<Document | Element> = []
    if (context !== undefined) {
      for (const el of toElements(context, doc, warn)) roots.push(el as unknown as Element)
    } else if (doc) {
      roots.push(doc)
    }
    const out: Element[] = []
    for (const root of roots) {
      try {
        const list = Array.prototype.slice.call((root as Element).querySelectorAll(parsed.base)) as Element[]
        for (const el of applyFilters(list, parsed)) out.push(el)
      } catch (e) {
        warn('selector:' + parsed.base, '选择器无法交给原生引擎（' + parsed.base + '），已返回空集合')
      }
    }
    return uniqueElements(out)
  }
  if (isElementLike(selector)) return [selector as Element]
  if (typeof selector === 'object' && selector !== null && (selector as { nodeType?: number }).nodeType === undefined) {
    const list = selector as ArrayLike<unknown>
    if (typeof list.length === 'number') {
      const out: Element[] = []
      for (let i = 0; i < list.length; i++) for (const el of toElements(list[i], doc, warn)) out.push(el)
      return out
    }
  }
  return []
}

// ---------------------------------------------------------------------------
// 静态工具
// ---------------------------------------------------------------------------

/** 把一个值序列化成查询串。 */
function serializeParam(value: unknown, prefix?: string): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return encodeURIComponent(toStringValue(prefix)) + '=' + encodeURIComponent(toStringValue(value))
  }
  if (Array.isArray(value)) {
    const parts: string[] = []
    for (const item of value) parts.push(serializeParam(item, prefix))
    return parts.filter(Boolean).join('&')
  }
  if (typeof value === 'object') {
    const parts: string[] = []
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const next = prefix ? prefix + '[' + key + ']' : key
      parts.push(serializeParam((value as Record<string, unknown>)[key], next))
    }
    return parts.filter(Boolean).join('&')
  }
  return ''
}

/**
 * 创建迷你 jQuery（$ / jQuery）。
 *
 * @param win 目标 window（默认全局 window）。
 * @param onWarn 降级/不支持时的上报回调（去重，同一条只报一次）。
 */
export function createJQuery(win?: Window, onWarn?: (message: string) => void): StJQueryStatic {
  const target = win || (typeof window !== 'undefined' ? window : undefined)
  const doc = target && target.document ? target.document : (typeof document !== 'undefined' ? document : undefined)
  const warn = (key: string, message: string): void => {
    if (warnedKeys.has(key)) return
    warnedKeys.add(key)
    try {
      if (onWarn) onWarn(message)
      else console.warn('[portable-tavern/st] ' + message)
    } catch { /* 上报失败不影响功能 */ }
  }
  const proto = createPrototype({ doc, win: target, warn })
  proto.extend = function (this: Record<string, unknown>, obj?: unknown): Record<string, unknown> {
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj as Record<string, unknown>)) this[key] = (obj as Record<string, unknown>)[key]
    }
    return this
  }
  proto.jquery = '3.7.1-portable-tavern'

  const ready = (callback: () => void): void => {
    if (typeof callback !== 'function') return
    try {
      if (!doc || doc.readyState === 'complete' || doc.readyState === 'interactive') {
        const timer = typeof setTimeout === 'function' ? setTimeout : undefined
        if (timer) timer(callback, 0)
        else callback()
        return
      }
      doc.addEventListener('DOMContentLoaded', () => { try { callback() } catch (e) { console.error('[portable-tavern/st] ready 回调异常', e) } }, { once: true })
    } catch (e) { console.error('[portable-tavern/st] ready 注册失败', e) }
  }

  const extend = (...args: unknown[]): any => {
    let deep = false
    let i = 0
    if (typeof args[0] === 'boolean') { deep = args[0] as boolean; i = 1 }
    const targetObj = (args[i] && typeof args[i] === 'object' ? args[i] : {}) as Record<string, unknown>
    i += 1
    for (; i < args.length; i++) {
      const source = args[i]
      if (!source || typeof source !== 'object') continue
      for (const key of Object.keys(source as Record<string, unknown>)) {
        const from = (source as Record<string, unknown>)[key]
        const current = targetObj[key]
        if (deep && from && typeof from === 'object' && !Array.isArray(from) && current && typeof current === 'object' && !Array.isArray(current)) {
          extend(true, current, from)
        } else if (from !== undefined) {
          targetObj[key] = from
        }
      }
    }
    return targetObj
  }

  const each = (collection: unknown, callback: (index: any, value: any) => unknown): unknown => {
    if (collection === null || collection === undefined || typeof callback !== 'function') return collection
    if (Array.isArray(collection) || typeof collection === 'string') {
      const list = collection as ArrayLike<unknown>
      for (let i = 0; i < list.length; i++) {
        if (callback(i, list[i]) === false) break
      }
      return collection
    }
    if (typeof collection === 'object') {
      for (const key of Object.keys(collection as Record<string, unknown>)) {
        if (callback(key, (collection as Record<string, unknown>)[key]) === false) break
      }
    }
    return collection
  }

  const map = (collection: unknown, callback: (value: any, index: any) => unknown): unknown[] => {
    const out: unknown[] = []
    if (typeof callback !== 'function') return out
    each(collection, (index: any, value: any) => {
      const mapped = callback(value, index)
      if (Array.isArray(mapped)) for (const item of mapped) out.push(item)
      else if (mapped !== null && mapped !== undefined) out.push(mapped)
    })
    return out
  }

  const grep = (list: unknown[], callback: (value: any, index: number) => unknown, invert?: boolean): unknown[] => {
    const out: unknown[] = []
    if (!Array.isArray(list) || typeof callback !== 'function') return out
    for (let i = 0; i < list.length; i++) {
      const hit = !!callback(list[i], i)
      if (hit !== !!invert) out.push(list[i])
    }
    return out
  }

  const inArray = (value: unknown, list: unknown[], fromIndex?: number): number => {
    if (!Array.isArray(list)) return -1
    return list.indexOf(value, typeof fromIndex === 'number' ? fromIndex : 0)
  }

  const parseHTML = (html: string): Element[] => {
    if (!doc) return []
    return parseHtmlNodes(doc, String(html)).filter(isElementLike) as Element[]
  }

  const makeArray = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value.slice()
    if (value === null || value === undefined) return []
    if (typeof value === 'object' && typeof (value as ArrayLike<unknown>).length === 'number') {
      return Array.prototype.slice.call(value as ArrayLike<unknown>)
    }
    return [value]
  }

  /** 构造一个 jQuery 风格的 thenable xhr。 */
  const makeXhr = (): { xhr: StJQueryXhr; done: Array<(data: any, textStatus: string, xhr: StJQueryXhr) => void>; fail: Array<(xhr: StJQueryXhr, textStatus: string, errorThrown: string) => void>; always: Array<(xhr: StJQueryXhr, textStatus: string) => void>; settle: (ok: boolean, data: unknown, textStatus: string, errorThrown: string) => void; isSettled: () => boolean; setAbort: (fn: () => void) => void } => {
    const doneCbs: Array<(data: any, textStatus: string, xhr: StJQueryXhr) => void> = []
    const failCbs: Array<(xhr: StJQueryXhr, textStatus: string, errorThrown: string) => void> = []
    const alwaysCbs: Array<(xhr: StJQueryXhr, textStatus: string) => void> = []
    let settled = false
    let settleResolve: (value: unknown) => void = () => { /* 占位 */ }
    let settleReject: (reason?: unknown) => void = () => { /* 占位 */ }
    const promise = new Promise<unknown>((resolve, reject) => { settleResolve = resolve; settleReject = reject })
    void promise.catch(() => { /* 失败由 fail 回调体现，避免 unhandled rejection */ })
    const xhr = {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
      status: 0,
      responseText: '',
      readyState: 0,
      getResponseHeader: (_name: string) => null,
      abort: (): void => { abortFn() },
      done: (cb: (data: any, textStatus: string, self: StJQueryXhr) => void): StJQueryXhr => { doneCbs.push(cb); return xhr as unknown as StJQueryXhr },
      fail: (cb: (self: StJQueryXhr, textStatus: string, errorThrown: string) => void): StJQueryXhr => { failCbs.push(cb); return xhr as unknown as StJQueryXhr },
      always: (cb: (self: StJQueryXhr, textStatus: string) => void): StJQueryXhr => { alwaysCbs.push(cb); return xhr as unknown as StJQueryXhr },
    }
    let abortFn: () => void = () => { /* 未发起请求 */ }
    const settle = (ok: boolean, data: unknown, textStatus: string, errorThrown: string): void => {
      if (settled) return
      settled = true
      if (ok) {
        for (const cb of doneCbs) { try { cb(data, textStatus, xhr as unknown as StJQueryXhr) } catch (e) { console.error('[portable-tavern/st] ajax done 回调异常', e) } }
        settleResolve(data)
      } else {
        for (const cb of failCbs) { try { cb(xhr as unknown as StJQueryXhr, textStatus, errorThrown) } catch (e) { console.error('[portable-tavern/st] ajax fail 回调异常', e) } }
        settleReject(new Error(errorThrown || textStatus || 'ajax error'))
      }
      for (const cb of alwaysCbs) { try { cb(xhr as unknown as StJQueryXhr, textStatus) } catch (e) { console.error('[portable-tavern/st] ajax always 回调异常', e) } }
    }
    return {
      xhr: xhr as unknown as StJQueryXhr,
      done: doneCbs,
      fail: failCbs,
      always: alwaysCbs,
      settle,
      isSettled: () => settled,
      setAbort: (fn: () => void) => { abortFn = fn },
    } as any
  }

  /** 同源 GET（其它方法/跨域一律走 error 回调并给出清晰原因）。 */
  const ajax = (options: StAjaxOptions | string): StJQueryXhr => {
    const opts: StAjaxOptions = typeof options === 'string' ? { url: options } : (options || {})
    const box = makeXhr()
    const xhr = box.xhr
    if (opts.success) box.done.push(opts.success)
    if (opts.error) box.fail.push(opts.error)
    if (opts.complete) box.always.push(opts.complete)
    const method = String(opts.type || opts.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      warn('ajax:method:' + method, '$.ajax 只支持同源 GET，收到 ' + method + '，已按失败处理')
      box.settle(false, null, 'error', 'portable-tavern：$.ajax 仅支持 GET')
      return xhr
    }
    if (!target || !target.location || typeof target.fetch !== 'function' || typeof URL !== 'function') {
      box.settle(false, null, 'error', 'portable-tavern：当前环境没有 fetch/window')
      return xhr
    }
    let url: URL
    try {
      url = new URL(String(opts.url || ''), target.location.href)
    } catch (e) {
      box.settle(false, null, 'error', 'portable-tavern：URL 非法（' + toStringValue(opts.url) + '）')
      return xhr
    }
    if (url.origin !== target.location.origin) {
      warn('ajax:cross-origin', '$.ajax 只支持同源请求，跨域 ' + url.origin + ' 已按失败处理')
      box.settle(false, null, 'error', 'portable-tavern：$.ajax 仅支持同源请求')
      return xhr
    }
    const query = opts.data === undefined || opts.data === null || opts.data === ''
      ? ''
      : (typeof opts.data === 'string' ? opts.data : serializeParam(opts.data))
    const finalUrl = query ? url.toString() + (url.search ? '&' : '?') + query : url.toString()
    if (typeof AbortController !== 'function') {
      box.settle(false, null, 'error', 'portable-tavern：当前环境没有 AbortController')
      return xhr
    }
    const controller = new AbortController()
    box.setAbort(() => { try { controller.abort() } catch { /* 忽略 */ } })
    let timer: number | null = null
    if (typeof opts.timeout === 'number' && opts.timeout > 0) {
      timer = target.setTimeout(() => { try { controller.abort() } catch { /* 忽略 */ } }, opts.timeout)
    }
    const headers: Record<string, string> = Object.assign({ Accept: 'application/json, text/plain, */*' }, opts.headers || {})
    target.fetch(finalUrl, { method: 'GET', headers, signal: controller.signal, credentials: 'same-origin', cache: opts.cache === false ? 'no-store' : 'default' })
      .then((response) => {
        xhr.status = response.status
        xhr.readyState = 4
        const contentType = response.headers.get('content-type') || ''
        xhr.getResponseHeader = (name: string) => response.headers.get(name)
        return response.text().then((text) => ({ response, text, contentType }))
      })
      .then((payload) => {
        xhr.responseText = payload.text
        if (!payload.response.ok) {
          box.settle(false, null, 'error', 'HTTP ' + payload.response.status)
          return
        }
        const wantsJson = opts.dataType === 'json' || (opts.dataType === undefined && payload.contentType.indexOf('json') >= 0)
        if (!wantsJson) { box.settle(true, payload.text, 'success', ''); return }
        try {
          box.settle(true, payload.text ? JSON.parse(payload.text) : null, 'success', '')
        } catch (e) {
          box.settle(false, null, 'parsererror', 'JSON 解析失败')
        }
      })
      .catch((e) => {
        box.settle(false, null, 'error', String(e && (e as Error).message ? (e as Error).message : e))
      })
      .then(() => { if (timer !== null) target.clearTimeout(timer) })
    return xhr
  }

  const jq = function (selector?: unknown, context?: unknown): StJQueryCollection {
    if (typeof selector === 'function') {
      ready(selector as () => void)
      return makeCollection(proto, [])
    }
    return makeCollection(proto, toElements(selector, doc, warn, context))
  } as unknown as StJQueryStatic

  jq.fn = proto
  jq.extend = extend
  jq.each = each
  jq.map = map
  jq.grep = grep
  jq.inArray = inArray
  jq.ajax = ajax
  jq.get = (url: string, data?: unknown, success?: (data: any) => void): StJQueryXhr => {
    const options: StAjaxOptions = { url, data, success }
    return ajax(options)
  }
  jq.param = (value: unknown): string => serializeParam(value)
  jq.parseHTML = parseHTML
  jq.trim = (value: unknown): string => toStringValue(value).trim()
  jq.isArray = (value: unknown): boolean => Array.isArray(value)
  jq.isFunction = (value: unknown): boolean => typeof value === 'function'
  jq.isNumeric = (value: unknown): boolean => {
    if (typeof value === 'number') return !Number.isNaN(value) && Number.isFinite(value)
    if (typeof value === 'string' && value.trim() !== '') return !Number.isNaN(Number(value))
    return false
  }
  jq.contains = (a: Node, b: Node): boolean => {
    try { return !!a && !!b && a.contains(b) } catch { return false }
  }
  jq.noop = (): void => { /* 有意为空 */ }
  jq.now = (): number => Date.now()
  jq.makeArray = makeArray
  jq.ready = ready
  Object.assign(jq as unknown as Record<string, unknown>, { jquery: '3.7.1-portable-tavern' })
  return jq
}





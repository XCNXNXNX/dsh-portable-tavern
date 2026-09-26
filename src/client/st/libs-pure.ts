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

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

/** 迭代器参数：函数、属性路径（'a.b[0]' 或段数组）、或对象匹配简写。 */
export type StIteratee =
  | ((value: any, key: any, collection?: any) => any)
  | string
  | number
  | ReadonlyArray<string | number>
  | Record<string, unknown>
  | null
  | undefined

/** 把任意值渲染成字符串；null / undefined 变成空串。 */
export function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

/** HTML 转义（与 Handlebars 的 escapeExpression 对齐）。 */
export function escapeHtml(value: unknown): string {
  return toStringValue(value)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#x27;')
    .split('=').join('&#x3D;')
    .split(String.fromCharCode(96)).join('&#x60;')
}

/** 路径（'a.b[0].c' 或段数组）拆成段数组。 */
export function toPath(path: unknown): Array<string | number> {
  if (Array.isArray(path)) return path.map((p) => (typeof p === 'number' ? p : String(p)))
  if (typeof path === 'number') return [path]
  const text = typeof path === 'string' ? path : String(path === null || path === undefined ? '' : path)
  const parts: Array<string | number> = []
  for (const chunk of text.split('.')) {
    if (!chunk) continue
    let rest = chunk
    const head = rest.split('[')[0]
    if (head) parts.push(head)
    rest = rest.slice(head.length)
    while (rest.length > 1 && rest.charAt(0) === '[') {
      const close = rest.indexOf(']')
      if (close < 0) break
      const inner = rest.slice(1, close)
      const n = Number(inner)
      parts.push(inner !== '' && String(n) === inner ? n : inner)
      rest = rest.slice(close + 1)
    }
  }
  return parts
}

/** 深拷贝：数组 / 普通对象 / Date / RegExp / Map / Set，带循环引用保护。 */
export function cloneDeep<T>(value: T, seen?: WeakMap<object, unknown>): T {
  if (value === null || typeof value !== 'object') return value
  const map = seen || new WeakMap<object, unknown>()
  const known = map.get(value as unknown as object)
  if (known !== undefined) return known as T
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as unknown as T
  if (value instanceof Map) {
    const out = new Map<unknown, unknown>()
    map.set(value as unknown as object, out)
    value.forEach((v, k) => out.set(cloneDeep(k, map), cloneDeep(v, map)))
    return out as unknown as T
  }
  if (value instanceof Set) {
    const out = new Set<unknown>()
    map.set(value as unknown as object, out)
    value.forEach((v) => out.add(cloneDeep(v, map)))
    return out as unknown as T
  }
  if (Array.isArray(value)) {
    const out: unknown[] = []
    map.set(value as unknown as object, out)
    for (const item of value) out.push(cloneDeep(item, map))
    return out as unknown as T
  }
  const out: Record<string, unknown> = {}
  map.set(value as unknown as object, out)
  for (const key of Object.keys(value as unknown as Record<string, unknown>)) {
    out[key] = cloneDeep((value as unknown as Record<string, unknown>)[key], map)
  }
  return out as unknown as T
}

/** 判断是否是“可继续深合并”的普通对象。 */
export function isPlainObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** 深合并（数组按索引合并，纯对象递归，其余直接覆盖）；返回 target。 */
export function mergeDeep(target: any, ...sources: unknown[]): any {
  for (const source of sources) {
    if (source === null || typeof source !== 'object') continue
    for (const key of Object.keys(source as Record<string, unknown>)) {
      const from = (source as Record<string, unknown>)[key]
      const current = target[key]
      if (Array.isArray(from) && Array.isArray(current)) {
        for (let i = 0; i < from.length; i++) {
          const item = from[i]
          if (isPlainObject(item) && isPlainObject(current[i])) current[i] = mergeDeep(current[i], item)
          else if (item !== undefined) current[i] = cloneDeep(item)
        }
      } else if (isPlainObject(from) && isPlainObject(current)) {
        mergeDeep(current, from)
      } else if (from !== undefined) {
        target[key] = cloneDeep(from)
      }
    }
  }
  return target
}

/** 取属性路径的值；取不到时返回 defaultValue。 */
export function getPath(object: unknown, path: unknown, defaultValue?: unknown): unknown {
  const parts = toPath(path)
  if (parts.length === 0) return object === undefined ? defaultValue : object
  let current: any = object
  for (const part of parts) {
    if (current === null || current === undefined) return defaultValue
    current = current[part as any]
  }
  return current === undefined ? defaultValue : current
}

/** 设置属性路径的值（中间层缺失时自动建对象/数组）；返回被设置的对象。 */
export function setPath(object: any, path: unknown, value: unknown): any {
  const parts = toPath(path)
  if (parts.length === 0) return object
  if (object === null || typeof object !== 'object') return object
  let current: any = object
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const nextKey = parts[i + 1]
    if (current[key] === null || current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = typeof nextKey === 'number' ? [] : {}
    }
    current = current[key]
  }
  current[parts[parts.length - 1] as any] = value
  return object
}

/** 判断属性路径是否存在（含原型链）。 */
export function hasPath(object: unknown, path: unknown): boolean {
  const parts = toPath(path)
  if (parts.length === 0) return false
  let current: any = object
  for (const part of parts) {
    if (current === null || current === undefined) return false
    if (!(part as any in Object(current))) return false
    current = current[part as any]
  }
  return true
}

/** 把 iteratee 简写归一成函数。 */
export function baseIteratee(iteratee: StIteratee): (value: any, key: any, collection?: any) => any {
  if (typeof iteratee === 'function') return iteratee as (value: any, key: any, collection?: any) => any
  if (iteratee === null || iteratee === undefined) return (value: any) => value
  if (typeof iteratee === 'object' && !Array.isArray(iteratee)) {
    const source = iteratee as Record<string, unknown>
    return (value: any) => {
      for (const key of Object.keys(source)) {
        if ((value === null || value === undefined ? undefined : value[key]) !== source[key]) return false
      }
      return true
    }
  }
  return (value: any) => getPath(value, iteratee)
}

/** 把集合归一成 [key, value] 数组（数组用下标当 key）。 */
export function entriesOf(collection: unknown): Array<[any, any]> {
  if (collection === null || collection === undefined) return []
  if (Array.isArray(collection) || typeof collection === 'string') {
    return Array.from(collection as ArrayLike<any>).map((value, i) => [i, value] as [any, any])
  }
  if (collection instanceof Map) return Array.from(collection.entries())
  if (collection instanceof Set) return Array.from(collection.values()).map((v, i) => [i, v] as [any, any])
  if (typeof collection === 'object') {
    return Object.keys(collection as Record<string, unknown>).map((k) => [k, (collection as Record<string, unknown>)[k]] as [any, any])
  }
  return []
}

/** 深比较（lodash isEqual 的常用子集）。 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object') {
    return typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b)
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as Record<string, unknown>)
  const kb = Object.keys(b as Record<string, unknown>)
  if (ka.length !== kb.length) return false
  for (const key of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// lodash 子集
// ---------------------------------------------------------------------------

/** 防抖函数的附加控制面。 */
export interface StDebounced {
  (...args: any[]): any
  /** 取消尚未执行的调用。 */
  cancel(): void
  /** 立刻执行尚未执行的调用并返回其结果。 */
  flush(): any
}

/** libs.lodash 的类型面（实现为常用子集）。 */
export interface StLodash {
  get(object: unknown, path: unknown, defaultValue?: unknown): any
  set(object: unknown, path: unknown, value: unknown): any
  has(object: unknown, path: unknown): boolean
  cloneDeep<T>(value: T): T
  clone<T>(value: T): T
  merge<T>(target: T, ...sources: unknown[]): T
  debounce(fn: (...args: any[]) => any, wait?: number, options?: { leading?: boolean; trailing?: boolean }): StDebounced
  throttle(fn: (...args: any[]) => any, wait?: number, options?: { leading?: boolean; trailing?: boolean }): StDebounced
  isEmpty(value: unknown): boolean
  isObject(value: unknown): boolean
  isArray(value: unknown): value is unknown[]
  isString(value: unknown): value is string
  isFunction(value: unknown): value is (...args: any[]) => any
  isNil(value: unknown): boolean
  isEqual(a: unknown, b: unknown): boolean
  forEach(collection: unknown, iteratee: StIteratee): unknown
  map(collection: unknown, iteratee?: StIteratee): unknown[]
  filter(collection: unknown, predicate?: StIteratee): unknown[]
  find(collection: unknown, predicate?: StIteratee): unknown
  uniqBy(collection: unknown, iteratee?: StIteratee): unknown[]
  sortBy(collection: unknown, ...iteratees: StIteratee[]): unknown[]
  groupBy(collection: unknown, iteratee?: StIteratee): Record<string, unknown[]>
  keyBy(collection: unknown, iteratee?: StIteratee): Record<string, unknown>
  keys(object: unknown): string[]
  values(object: unknown): unknown[]
  escape(value: unknown): string
  random(min?: number, max?: number, floating?: boolean): number
  range(start?: number, end?: number, step?: number): number[]
  clamp(value: number, min?: number, max?: number): number
  kebabCase(value: unknown): string
  camelCase(value: unknown): string
  startCase(value: unknown): string
  capitalize(value: unknown): string
  omit(object: unknown, ...paths: unknown[]): Record<string, unknown>
  pick(object: unknown, ...paths: unknown[]): Record<string, unknown>
  assign<T>(target: T, ...sources: unknown[]): T
  defaults<T>(target: T, ...sources: unknown[]): T
  flatten(collection: unknown): unknown[]
  shuffle<T>(collection: unknown): T[]
  sample<T>(collection: unknown): T | undefined
  sumBy(collection: unknown, iteratee?: StIteratee): number
  times(n: number, iteratee?: StIteratee): unknown[]
  uniqueId(prefix?: string): string
  noop(): void
  identity<T>(value: T): T
}

/** 把 'FooBar-baz qux' 拆成词数组。 */
function wordsOf(value: unknown): string[] {
  const text = toStringValue(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  return text.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 0)
}

/** 防抖实现（支持 leading / trailing，与 lodash 语义一致）。 */
export function debounce(fn: (...args: any[]) => any, wait = 0, options?: { leading?: boolean; trailing?: boolean }): StDebounced {
  const leading = !!(options && options.leading)
  const trailing = !(options && options.trailing === false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  let lastThis: any = null
  let result: any
  const invoke = (): any => {
    const args = lastArgs || []
    const ctx = lastThis
    lastArgs = null
    lastThis = null
    result = fn.apply(ctx, args)
    return result
  }
  const debounced = function (this: any, ...args: any[]): any {
    const idle = timer === null
    lastArgs = args
    lastThis = this
    if (timer !== null) clearTimeout(timer)
    if (leading && idle) invoke()
    timer = setTimeout(() => {
      timer = null
      if (trailing && lastArgs) invoke()
    }, Math.max(0, wait))
    return result
  } as StDebounced
  debounced.cancel = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    lastArgs = null
    lastThis = null
  }
  debounced.flush = (): any => {
    if (timer !== null && lastArgs) {
      clearTimeout(timer)
      timer = null
      return invoke()
    }
    return result
  }
  return debounced
}

/** 节流实现（支持 leading / trailing）。 */
export function throttle(fn: (...args: any[]) => any, wait = 0, options?: { leading?: boolean; trailing?: boolean }): StDebounced {
  const leading = !(options && options.leading === false)
  const trailing = !(options && options.trailing === false)
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: any[] | null = null
  let lastThis: any = null
  let result: any
  const invoke = (): any => {
    last = Date.now()
    const args = lastArgs || []
    const ctx = lastThis
    lastArgs = null
    lastThis = null
    result = fn.apply(ctx, args)
    return result
  }
  const throttled = function (this: any, ...args: any[]): any {
    const now = Date.now()
    if (last === 0 && !leading) last = now
    const remaining = wait - (now - last)
    lastArgs = args
    lastThis = this
    if (remaining <= 0 || remaining > wait) {
      if (timer !== null) { clearTimeout(timer); timer = null }
      invoke()
    } else if (timer === null && trailing) {
      timer = setTimeout(() => {
        timer = null
        last = leading ? Date.now() : 0
        invoke()
      }, remaining)
    }
    return result
  } as StDebounced
  throttled.cancel = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    last = 0
    lastArgs = null
    lastThis = null
  }
  throttled.flush = (): any => {
    if (timer !== null && lastArgs) {
      clearTimeout(timer)
      timer = null
      return invoke()
    }
    return result
  }
  return throttled
}

/** 收集 omit/pick 的可变参数（字符串、数组、嵌套数组都拍平一层）。 */
function collectPaths(paths: unknown[]): Array<string | number> {
  const out: Array<string | number> = []
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      if (value.length > 0 && value.every((v) => typeof v === 'number')) {
        for (const v of value) out.push(v as number)
      } else if (value.length > 0 && value.every((v) => typeof v === 'string' && v.indexOf('.') < 0 && v.indexOf('[') < 0)) {
        for (const v of value) {
          // 数组里全是短字符串时按“一个路径的段”处理（lodash 的 ['a','b'] 是 a.b）
          out.push(String(v))
        }
      } else {
        for (const v of value) walk(v)
      }
      return
    }
    for (const part of toPath(value)) out.push(part)
  }
  for (const p of paths) walk(p)
  return out
}

/** lodash 常用子集的默认实现（window._ 存在时 libs.ts 会优先复用页面上的 lodash）。 */
export const lodashSubset: StLodash = {
  get: getPath,
  set: setPath,
  has: hasPath,
  cloneDeep,
  clone: <T>(value: T): T => {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return (value as unknown[]).slice() as unknown as T
    if (value instanceof Date) return new Date(value.getTime()) as unknown as T
    if (value instanceof RegExp) return new RegExp(value.source, value.flags) as unknown as T
    return Object.assign({}, value as unknown as Record<string, unknown>) as unknown as T
  },
  merge: <T>(target: T, ...sources: unknown[]): T => mergeDeep(target, ...sources),
  debounce,
  throttle,
  isEmpty: (value: unknown): boolean => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string' || Array.isArray(value)) return value.length === 0
    if (value instanceof Map || value instanceof Set) return value.size === 0
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0
    return true
  },
  isObject: (value: unknown): boolean => value !== null && (typeof value === 'object' || typeof value === 'function'),
  isArray: Array.isArray,
  isString: (value: unknown): value is string => typeof value === 'string',
  isFunction: (value: unknown): value is (...args: any[]) => any => typeof value === 'function',
  isNil: (value: unknown): boolean => value === null || value === undefined,
  isEqual,
  forEach: (collection: unknown, iteratee: StIteratee): unknown => {
    const fn = baseIteratee(iteratee)
    for (const [key, value] of entriesOf(collection)) {
      if (fn(value, key, collection) === false) break
    }
    return collection
  },
  map: (collection: unknown, iteratee?: StIteratee): unknown[] => {
    const fn = baseIteratee(iteratee)
    return entriesOf(collection).map(([key, value]) => fn(value, key, collection))
  },
  filter: (collection: unknown, predicate?: StIteratee): unknown[] => {
    const fn = baseIteratee(predicate)
    const out: unknown[] = []
    for (const [key, value] of entriesOf(collection)) if (fn(value, key, collection)) out.push(value)
    return out
  },
  find: (collection: unknown, predicate?: StIteratee): unknown => {
    const fn = baseIteratee(predicate)
    for (const [key, value] of entriesOf(collection)) if (fn(value, key, collection)) return value
    return undefined
  },
  uniqBy: (collection: unknown, iteratee?: StIteratee): unknown[] => {
    const fn = baseIteratee(iteratee)
    const seen = new Set<string>()
    const out: unknown[] = []
    for (const [key, value] of entriesOf(collection)) {
      const mark = toStringValue(fn(value, key, collection))
      if (seen.has(mark)) continue
      seen.add(mark)
      out.push(value)
    }
    return out
  },
  sortBy: (collection: unknown, ...iteratees: StIteratee[]): unknown[] => {
    const fns = iteratees.length > 0 ? iteratees.map(baseIteratee) : [baseIteratee(undefined)]
    return entriesOf(collection)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => {
        for (const fn of fns) {
          const va = fn(a.value, a.key, collection)
          const vb = fn(b.value, b.key, collection)
          if (va === vb) continue
          if (va === undefined || va === null) return 1
          if (vb === undefined || vb === null) return -1
          return va > vb ? 1 : -1
        }
        return 0
      })
      .map((entry) => entry.value)
  },
  groupBy: (collection: unknown, iteratee?: StIteratee): Record<string, unknown[]> => {
    const fn = baseIteratee(iteratee)
    const out: Record<string, unknown[]> = {}
    for (const [key, value] of entriesOf(collection)) {
      const group = toStringValue(fn(value, key, collection))
      if (!out[group]) out[group] = []
      out[group].push(value)
    }
    return out
  },
  keyBy: (collection: unknown, iteratee?: StIteratee): Record<string, unknown> => {
    const fn = baseIteratee(iteratee)
    const out: Record<string, unknown> = {}
    for (const [key, value] of entriesOf(collection)) out[toStringValue(fn(value, key, collection))] = value
    return out
  },
  keys: (object: unknown): string[] => (object === null || typeof object !== 'object' ? [] : Object.keys(object as Record<string, unknown>)),
  values: (object: unknown): unknown[] => (object === null || typeof object !== 'object' ? [] : Object.keys(object as Record<string, unknown>).map((k) => (object as Record<string, unknown>)[k])),
  escape: escapeHtml,
  random: (min?: number, max?: number, floating?: boolean): number => {
    let lower = min
    let upper = max
    let isFloat = floating
    if (lower === undefined && upper === undefined) {
      return isFloat ? Math.random() : (Math.random() < 0.5 ? 0 : 1)
    }
    if (upper === undefined) { upper = lower; lower = 0 }
    const lo = lower === undefined ? 0 : lower
    const hi = upper === undefined ? 0 : upper
    if (isFloat === undefined) isFloat = lo % 1 !== 0 || hi % 1 !== 0
    if (isFloat) return Math.random() * (hi - lo) + lo
    return Math.floor(Math.random() * (Math.floor(hi) - Math.ceil(lo) + 1)) + Math.ceil(lo)
  },
  range: (start?: number, end?: number, step?: number): number[] => {
    let from = start === undefined ? 0 : start
    let to = end === undefined ? (start === undefined ? 0 : start) : end
    if (end === undefined) from = 0
    const by = step === undefined ? (to < from ? -1 : 1) : step
    const out: number[] = []
    if (by === 0) return out
    if (by > 0) for (let i = from; i < to; i += by) out.push(i)
    else for (let i = from; i > to; i += by) out.push(i)
    return out
  },
  clamp: (value: number, min?: number, max?: number): number => {
    let out = value
    if (max !== undefined && out > max) out = max
    if (min !== undefined && out < min) out = min
    return out
  },
  kebabCase: (value: unknown): string => wordsOf(value).map((w) => w.toLowerCase()).join('-'),
  camelCase: (value: unknown): string => wordsOf(value).map((w, i) => {
    const lower = w.toLowerCase()
    return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join(''),
  startCase: (value: unknown): string => wordsOf(value).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
  capitalize: (value: unknown): string => {
    const text = toStringValue(value).toLowerCase()
    return text.charAt(0).toUpperCase() + text.slice(1)
  },
  omit: (object: unknown, ...paths: unknown[]): Record<string, unknown> => {
    const out: Record<string, unknown> = Object.assign({}, object as Record<string, unknown>)
    for (const path of collectPaths(paths)) {
      const parts = toPath(path)
      if (parts.length <= 1) { delete out[String(parts[0])]; continue }
      const parent = getPath(out, parts.slice(0, -1))
      if (parent && typeof parent === 'object') delete (parent as Record<string, unknown>)[String(parts[parts.length - 1])]
    }
    return out
  },
  pick: (object: unknown, ...paths: unknown[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const path of collectPaths(paths)) {
      const value = getPath(object, path, undefined)
      if (value !== undefined) setPath(out, path, value)
    }
    return out
  },
  assign: <T>(target: T, ...sources: unknown[]): T => {
    for (const source of sources) {
      if (source === null || typeof source !== 'object') continue
      for (const key of Object.keys(source as Record<string, unknown>)) {
        (target as Record<string, unknown>)[key] = (source as Record<string, unknown>)[key]
      }
    }
    return target
  },
  defaults: <T>(target: T, ...sources: unknown[]): T => {
    for (const source of sources) {
      if (source === null || typeof source !== 'object') continue
      for (const key of Object.keys(source as Record<string, unknown>)) {
        if ((target as Record<string, unknown>)[key] === undefined) (target as Record<string, unknown>)[key] = (source as Record<string, unknown>)[key]
      }
    }
    return target
  },
  flatten: (collection: unknown): unknown[] => {
    const out: unknown[] = []
    for (const value of entriesOf(collection).map((entry) => entry[1])) {
      if (Array.isArray(value)) for (const item of value) out.push(item)
      else out.push(value)
    }
    return out
  },
  shuffle: <T>(collection: unknown): T[] => {
    const out = entriesOf(collection).map((entry) => entry[1]) as T[]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = out[i]
      out[i] = out[j]
      out[j] = tmp
    }
    return out
  },
  sample: <T>(collection: unknown): T | undefined => {
    const list = entriesOf(collection).map((entry) => entry[1]) as T[]
    if (list.length === 0) return undefined
    return list[Math.floor(Math.random() * list.length)]
  },
  sumBy: (collection: unknown, iteratee?: StIteratee): number => {
    const fn = baseIteratee(iteratee)
    let sum = 0
    for (const [key, value] of entriesOf(collection)) {
      const n = Number(fn(value, key, collection))
      if (!Number.isNaN(n)) sum += n
    }
    return sum
  },
  times: (n: number, iteratee?: StIteratee): unknown[] => {
    const fn = baseIteratee(iteratee)
    const count = Math.max(0, Math.floor(n))
    const out: unknown[] = []
    for (let i = 0; i < count; i++) out.push(fn(i, i, undefined))
    return out
  },
  uniqueId: (() => {
    let counter = 0
    return (prefix?: string): string => {
      counter += 1
      return toStringValue(prefix === undefined ? '' : prefix) + counter
    }
  })(),
  noop: (): void => { /* 故意为空 */ },
  identity: <T>(value: T): T => value,
}

// ---------------------------------------------------------------------------
// Handlebars 子集（ST 扩展用 renderExtensionTemplateAsync 渲染设置面板）
// ---------------------------------------------------------------------------

/** Handlebars 编译产物：传入数据返回渲染后的字符串。 */
export interface StHandlebarsTemplate {
  (data?: unknown): string
}

/** Handlebars 运行时的最小实现面。 */
export interface StHandlebars {
  compile(template: string): StHandlebarsTemplate
  registerHelper(name: string, fn: (...args: any[]) => unknown): void
  unregisterHelper(name: string): void
  registerPartial(name: string, template: string): void
  escapeExpression(value: unknown): string
  SafeString: { new (value: unknown): { toString(): string; toHTML(): string } }
  helpers: Record<string, (...args: any[]) => unknown>
  templates: Record<string, StHandlebarsTemplate>
}

/** 模板 AST 节点。 */
interface HbNode {
  kind: 'text' | 'var' | 'block'
  text?: string
  expr?: string
  raw?: boolean
  name?: string
  children?: HbNode[]
  inverse?: HbNode[]
}

/** 词法单元。 */
interface HbToken {
  t: 'text' | 'var' | 'raw' | 'open' | 'inv' | 'close' | 'else'
  v: string
  elseIf?: string
  stripBefore?: boolean
  stripAfter?: boolean
}

/** 渲染帧：一层上下文 + 该层的 @ 局部变量。 */
interface HbFrame {
  data: unknown
  locals: Record<string, unknown>
}

/** 把一个 mustache 标签体切成词（支持引号字面量）。 */
function splitTokens(input: string): string[] {
  const out: string[] = []
  let current = ''
  let quote = ''
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)
    if (quote) {
      if (ch === quote) { quote = ''; continue }
      current += ch
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; current += '\u0000'; continue }
    if (/\s/.test(ch)) {
      if (current) { out.push(current); current = '' }
      continue
    }
    current += ch
  }
  if (current) out.push(current)
  return out
}

/** 把模板字符串切成词法单元（含 ~ 空白控制与注释）。 */
function tokenizeTemplate(src: string): HbToken[] {
  const tokens: HbToken[] = []
  let i = 0
  const pushText = (text: string, stripAfter?: boolean, stripBefore?: boolean): void => {
    if (stripBefore && tokens.length > 0) {
      const prev = tokens[tokens.length - 1]
      if (prev.t === 'text') prev.v = prev.v.replace(/[ \t\r\n]+$/, '')
    }
    let value = text
    if (stripAfter) value = value.replace(/^[ \t\r\n]+/, '')
    if (value) tokens.push({ t: 'text', v: value })
  }
  let pendingStripAfter = false
  while (i < src.length) {
    const open = src.indexOf('{{', i)
    if (open < 0) { pushText(src.slice(i), pendingStripAfter); break }
    if (open > i) pushText(src.slice(i, open), pendingStripAfter)
    pendingStripAfter = false
    const triple = src.charAt(open + 2) === '{'
    const closeSeq = triple ? '}}}' : '}}'
    const close = src.indexOf(closeSeq, open + (triple ? 3 : 2))
    if (close < 0) { pushText(src.slice(open)); break }
    let inner = src.slice(open + (triple ? 3 : 2), close).trim()
    i = close + closeSeq.length
    let stripBefore = false
    let stripAfter = false
    if (inner.charAt(0) === '~') { stripBefore = true; inner = inner.slice(1).trim() }
    if (inner.charAt(inner.length - 1) === '~') { stripAfter = true; inner = inner.slice(0, -1).trim() }
    if (stripBefore && tokens.length > 0) {
      const prev = tokens[tokens.length - 1]
      if (prev.t === 'text') prev.v = prev.v.replace(/[ \t\r\n]+$/, '')
    }
    pendingStripAfter = stripAfter
    if (!inner) continue
    if (inner.charAt(0) === '!') continue
    if (triple) { tokens.push({ t: 'raw', v: inner }); continue }
    if (inner.charAt(0) === '#') { tokens.push({ t: 'open', v: inner.slice(1).trim() }); continue }
    if (inner.charAt(0) === '^') { tokens.push({ t: 'inv', v: inner.slice(1).trim() }); continue }
    if (inner.charAt(0) === '/') { tokens.push({ t: 'close', v: inner.slice(1).trim() }); continue }
    if (inner === 'else' || inner.indexOf('else ') === 0) {
      const rest = inner === 'else' ? '' : inner.slice(5).trim()
      const elseIf = rest.indexOf('if ') === 0 ? rest.slice(3).trim() : rest
      tokens.push({ t: 'else', v: inner, elseIf: elseIf || undefined })
      continue
    }
    if (inner.charAt(0) === '&') { tokens.push({ t: 'raw', v: inner.slice(1).trim() }); continue }
    tokens.push({ t: 'var', v: inner })
  }
  return tokens
}

/** 词法单元 -> AST（支持 {{else if}} 链）。 */
function parseTemplate(src: string): HbNode[] {
  const tokens = tokenizeTemplate(src)
  const root: HbNode[] = []
  const frames: Array<{ node: HbNode | null; list: HbNode[]; chained: boolean }> = [{ node: null, list: root, chained: false }]
  for (const tok of tokens) {
    const frame = frames[frames.length - 1]
    if (tok.t === 'text') { frame.list.push({ kind: 'text', text: tok.v }); continue }
    if (tok.t === 'var' || tok.t === 'raw') {
      let expr = tok.v
      let raw = tok.t === 'raw'
      if (expr.charAt(0) === '&') { raw = true; expr = expr.slice(1).trim() }
      frame.list.push({ kind: 'var', expr, raw })
      continue
    }
    if (tok.t === 'open' || tok.t === 'inv') {
      const parts = splitTokens(tok.v)
      const node: HbNode = { kind: 'block', name: parts[0] || 'if', expr: parts.slice(1).join(' '), children: [], inverse: [] }
      frame.list.push(node)
      frames.push({ node, list: node.children as HbNode[], chained: false })
      continue
    }
    if (tok.t === 'else') {
      if (!frame.node) continue
      if (tok.elseIf) {
        const node: HbNode = { kind: 'block', name: 'if', expr: tok.elseIf, children: [], inverse: [] }
        frame.node.inverse = [node]
        frames.push({ node, list: node.children as HbNode[], chained: true })
      } else {
        frames.push({ node: frame.node, list: frame.node.inverse as HbNode[], chained: true })
      }
      continue
    }
    if (tok.t === 'close') {
      while (frames.length > 1 && frames[frames.length - 1].chained) frames.pop()
      if (frames.length > 1) frames.pop()
    }
  }
  return root
}

/** Handlebars 值 -> 字符串（SafeString 走 toHTML，数组按 JS 语义逗号连接）。 */
function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if (typeof (value as { toHTML?: unknown }).toHTML === 'function') {
      try { return String((value as { toHTML(): string }).toHTML()) } catch { return '' }
    }
    if (Array.isArray(value)) return value.map((item) => stringifyValue(item)).join(',')
    return String(value)
  }
  return String(value)
}

/** 是否是 SafeString（{{{ }}} 语义：不再转义）。 */
function isSafeString(value: unknown): boolean {
  return !!value && typeof value === 'object' && typeof (value as { toHTML?: unknown }).toHTML === 'function'
}

/** Handlebars 的假值规则（空数组也算假）。 */
function hbIsFalsy(value: unknown): boolean {
  if (value === false || value === null || value === undefined) return true
  if (value === 0 || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'number' && Number.isNaN(value)) return true
  return false
}

/** 解析一个表达式路径：返回 { frames: 需要向父级回溯的层数, path: 段数组 }。 */
function parseRef(expr: string): { depth: number; parts: Array<string | number>; special: string } {
  let rest = expr.trim()
  let depth = 0
  while (rest.indexOf('../') === 0) { depth += 1; rest = rest.slice(3) }
  rest = rest.replace(/^\.\//, '')
  if (rest === '.' || rest === 'this') return { depth, parts: [], special: 'this' }
  if (rest.charAt(0) === '@') return { depth, parts: toPath(rest.slice(1)), special: 'at' }
  if (rest === 'true') return { depth, parts: [], special: 'true' }
  if (rest === 'false') return { depth, parts: [], special: 'false' }
  if (/^-?\d+(\.\d+)?$/.test(rest)) return { depth, parts: [], special: 'num:' + rest }
  return { depth, parts: toPath(rest), special: '' }
}

/** 从上下文栈里按 ST/Handlebars 规则解析一个引用。 */
function resolveRef(expr: string, stack: HbFrame[]): unknown {
  const ref = parseRef(expr)
  if (ref.special === 'true') return true
  if (ref.special === 'false') return false
  if (ref.special.indexOf('num:') === 0) return Number(ref.special.slice(4))
  const current = stack[stack.length - 1]
  if (ref.special === 'at') {
    const key = ref.parts.length > 0 ? String(ref.parts[0]) : ''
    if (key === 'root') return stack[0].data
    for (let i = stack.length - 1; i >= 0; i--) {
      if (Object.prototype.hasOwnProperty.call(stack[i].locals, key)) return stack[i].locals[key]
    }
    return undefined
  }
  let index = stack.length - 1 - ref.depth
  if (index < 0) index = 0
  if (ref.parts.length === 0) return stack[index].data
  // 先在当前层找第一段，找不到再沿父级向上找（Handlebars 的上下文回溯）
  for (let i = index; i >= 0; i--) {
    const data = stack[i].data
    if (data === null || data === undefined) continue
    const head = ref.parts[0]
    const container = Object(data)
    if (!(head in container)) continue
    let value: any = container[head as any]
    for (let p = 1; p < ref.parts.length; p++) {
      if (value === null || value === undefined) return undefined
      value = value[ref.parts[p] as any]
    }
    return value
  }
  void current
  return undefined
}

/** 渲染一批节点。 */
function renderNodes(nodes: HbNode[], stack: HbFrame[], helpers: Record<string, (...args: any[]) => unknown>): string {
  let out = ''
  for (const node of nodes) {
    if (node.kind === 'text') { out += node.text || ''; continue }
    if (node.kind === 'var') {
      const expr = (node.expr || '').trim()
      const words = splitTokens(expr)
      const helperName = words[0]
      // 单名 mustache 也会命中已注册 helper（与 Handlebars 一致）；this./@ 前缀除外
      const useHelper = !!helpers[helperName] && expr.charAt(0) !== '.' && expr.charAt(0) !== '@' && expr.indexOf('this.') !== 0
      if (useHelper) {
        const args = words.slice(1).map((w) => resolveRef(w, stack))
        const produced = helpers[helperName].apply(stack[stack.length - 1].data, args)
        out += node.raw || isSafeString(produced) ? stringifyValue(produced) : escapeHtml(produced)
        continue
      }
      const value = resolveRef(expr, stack)
      out += node.raw || isSafeString(value) ? stringifyValue(value) : escapeHtml(value)
      continue
    }
    const name = node.name || ''
    const argExpr = (node.expr || '').trim()
    if (name === 'if' || name === 'unless') {
      let value = resolveRef(argExpr, stack)
      if (typeof value === 'function') { try { value = (value as () => unknown).call(stack[stack.length - 1].data) } catch { value = undefined } }
      let truthy = !hbIsFalsy(value)
      if (name === 'unless') truthy = !truthy
      out += renderNodes(truthy ? (node.children || []) : (node.inverse || []), stack, helpers)
      continue
    }
    if (name === 'with') {
      const value = resolveRef(argExpr, stack)
      if (hbIsFalsy(value)) { out += renderNodes(node.inverse || [], stack, helpers); continue }
      stack.push({ data: value, locals: {} })
      out += renderNodes(node.children || [], stack, helpers)
      stack.pop()
      continue
    }
    if (name === 'each') {
      const value = resolveRef(argExpr, stack)
      const pairs: Array<[any, any]> = entriesOf(value)
      if (pairs.length === 0) { out += renderNodes(node.inverse || [], stack, helpers); continue }
      const isArrayLike = Array.isArray(value)
      for (let i = 0; i < pairs.length; i++) {
        const key = pairs[i][0]
        const item = pairs[i][1]
        stack.push({
          data: item,
          locals: {
            index: isArrayLike ? i : key,
            key,
            first: i === 0,
            last: i === pairs.length - 1,
          },
        })
        out += renderNodes(node.children || [], stack, helpers)
        stack.pop()
      }
      continue
    }
    if (helpers[name]) {
      const options = {
        fn: (ctx: unknown) => {
          stack.push({ data: ctx, locals: {} })
          const text = renderNodes(node.children || [], stack, helpers)
          stack.pop()
          return text
        },
        inverse: (ctx: unknown) => {
          stack.push({ data: ctx, locals: {} })
          const text = renderNodes(node.inverse || [], stack, helpers)
          stack.pop()
          return text
        },
        hash: {} as Record<string, unknown>,
        data: stack[stack.length - 1].locals,
      }
      try {
        out += stringifyValue(helpers[name].call(stack[stack.length - 1].data, resolveRef(argExpr, stack), options))
      } catch (e) {
        try { console.error('[portable-tavern/st] Handlebars 块助手异常: ' + name, e) } catch { /* 无 console */ }
      }
      continue
    }
    // 未知块：按 if 处理，尽量把内容渲染出来而不是丢空
    const fallback = resolveRef(argExpr, stack)
    out += renderNodes(hbIsFalsy(fallback) ? (node.inverse || []) : (node.children || []), stack, helpers)
  }
  return out
}

/** 创建 Handlebars 子集实例（compile 失败时返回空串模板，不抛异常）。 */
export function createHandlebars(): StHandlebars {
  const helpers: Record<string, (...args: any[]) => unknown> = {}
  const templates: Record<string, StHandlebarsTemplate> = {}
  class StSafeString {
    value: string
    constructor(value: unknown) { this.value = toStringValue(value) }
    toString(): string { return this.value }
    toHTML(): string { return this.value }
  }
  const compile = (template: string): StHandlebarsTemplate => {
    let ast: HbNode[] = []
    try {
      ast = parseTemplate(typeof template === 'string' ? template : '')
    } catch (e) {
      try { console.error('[portable-tavern/st] Handlebars 模板解析失败', e) } catch { /* 无 console */ }
    }
    return (data?: unknown): string => {
      try {
        const stack: HbFrame[] = [{ data: data === undefined ? {} : data, locals: {} }]
        return renderNodes(ast, stack, helpers)
      } catch (e) {
        try { console.error('[portable-tavern/st] Handlebars 渲染失败', e) } catch { /* 无 console */ }
        return ''
      }
    }
  }
  return {
    compile,
    registerHelper: (name: string, fn: (...args: any[]) => unknown): void => { helpers[name] = fn },
    unregisterHelper: (name: string): void => { delete helpers[name] },
    registerPartial: (name: string, template: string): void => { templates[name] = compile(template) },
    escapeExpression: escapeHtml,
    SafeString: StSafeString,
    helpers,
    templates,
  }
}

// ---------------------------------------------------------------------------
// Fuse（模糊搜索子集）
// ---------------------------------------------------------------------------

/** Fuse 的构造参数（子集）。 */
export interface StFuseOptions {
  /** 参与搜索的字段路径。 */
  keys?: Array<string | { name: string; weight?: number }>
  /** 0..1 的匹配阈值，默认 0.6。 */
  threshold?: number
  /** 结果是否带 score。 */
  includeScore?: boolean
  /** 是否大小写敏感。 */
  isCaseSensitive?: boolean
  /** 是否排序（默认 true）。 */
  shouldSort?: boolean
}

/** Fuse 的一条结果。 */
export interface StFuseResult {
  /** 命中的原始条目。 */
  item: unknown
  /** 在集合里的下标。 */
  refIndex: number
  /** 0 = 完全命中，1 = 完全不命中。 */
  score: number
}

/** Fuse 实例面。 */
export interface StFuseInstance {
  /** 搜索。 */
  search(pattern: string, options?: { limit?: number }): StFuseResult[]
  /** 替换整个集合。 */
  setCollection(list: unknown[]): void
  /** 追加一条。 */
  add(item: unknown): void
  /** 取回当前集合。 */
  getCollection(): unknown[]
}

/** 把任意值转成可搜索字符串。 */
function searchableText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(searchableText).join(' ')
  if (typeof value === 'object') {
    const out: string[] = []
    for (const key of Object.keys(value as Record<string, unknown>)) out.push(searchableText((value as Record<string, unknown>)[key]))
    return out.join(' ')
  }
  return String(value)
}

/** 单字段打分：0 最好，1 最差。 */
function scoreField(text: string, query: string): number {
  if (!query) return 0
  if (text === query) return 0
  const at = text.indexOf(query)
  if (at >= 0) return 0.05 + Math.min(0.35, (at / Math.max(1, text.length)) * 0.35)
  // 子序列匹配：query 的字符按序出现即为命中，间隔越大分越差
  let i = 0
  let gaps = 0
  let lastHit = -1
  for (let p = 0; p < text.length && i < query.length; p++) {
    if (text.charAt(p) === query.charAt(i)) {
      if (lastHit >= 0) gaps += p - lastHit - 1
      lastHit = p
      i += 1
    }
  }
  if (i < query.length) return 1
  return Math.min(0.95, 0.4 + gaps / Math.max(1, text.length))
}

/** 创建 Fuse 类（构造签名与上游一致，供 libs.Fuse 使用）。 */
export function createFuseClass(): new (list: unknown[], options?: StFuseOptions) => StFuseInstance {
  return class Fuse {
    _list: unknown[]
    _options: StFuseOptions
    constructor(list: unknown[], options?: StFuseOptions) {
      this._list = Array.isArray(list) ? list.slice() : []
      this._options = options || {}
    }
    setCollection(list: unknown[]): void { this._list = Array.isArray(list) ? list.slice() : [] }
    add(item: unknown): void { this._list.push(item) }
    getCollection(): unknown[] { return this._list.slice() }
    search(pattern: string, options?: { limit?: number }): StFuseResult[] {
      const query = typeof pattern === 'string' ? pattern : String(pattern === null || pattern === undefined ? '' : pattern)
      const caseSensitive = this._options.isCaseSensitive === true
      const needle = caseSensitive ? query : query.toLowerCase()
      const threshold = typeof this._options.threshold === 'number' ? this._options.threshold : 0.6
      const results: StFuseResult[] = []
      for (let i = 0; i < this._list.length; i++) {
        const item = this._list[i]
        let best = 1
        if (!needle) {
          best = 0
        } else if (this._options.keys && this._options.keys.length > 0) {
          for (const key of this._options.keys) {
            const path = typeof key === 'string' ? key : key.name
            const value = searchableText(getPath(item, path))
            const hay = caseSensitive ? value : value.toLowerCase()
            const score = scoreField(hay, needle)
            if (score < best) best = score
          }
        } else {
          const value = searchableText(item)
          best = scoreField(caseSensitive ? value : value.toLowerCase(), needle)
        }
        if (best <= threshold) results.push({ item, refIndex: i, score: best })
      }
      if (this._options.shouldSort !== false) results.sort((a, b) => a.score - b.score)
      const limit = options && typeof options.limit === 'number' ? options.limit : 0
      return limit > 0 ? results.slice(0, limit) : results
    }
  }
}

// ---------------------------------------------------------------------------
// Bowser（UA 解析子集）
// ---------------------------------------------------------------------------

/** UA 解析结果。 */
export interface StUaInfo {
  /** 浏览器信息。 */
  browser: { name: string; version: string }
  /** 操作系统信息。 */
  os: { name: string; version: string }
  /** 平台信息（desktop / mobile / tablet / bot）。 */
  platform: { type: string; vendor: string; model: string }
  /** 渲染引擎信息。 */
  engine: { name: string; version: string }
}

/** Bowser 的 getParser() 面。 */
export interface StBowserParser {
  getBrowser(): { name: string; version: string }
  getBrowserName(): string
  getBrowserVersion(): string
  getOS(): { name: string; version: string }
  getOSName(): string
  getOSVersion(): string
  getPlatform(): { type: string; vendor: string; model: string }
  getPlatformType(): string
  getEngine(): { name: string; version: string }
  getEngineName(): string
  /** 只做最简 name/version 匹配。 */
  satisfies(check: Record<string, unknown>): boolean
  /** 只做最简 name 匹配。 */
  is(check: string): boolean
  parse(): StUaInfo
}

/** libs.Bowser 的面。 */
export interface StBowser {
  parse(ua?: string): StUaInfo
  getParser(ua?: string): StBowserParser
  mobile: boolean
  tablet: boolean
  desktop: boolean
  bot: boolean
  browser: { name: string; version: string }
  os: { name: string; version: string }
  platform: { type: string; vendor: string; model: string }
  satisfies(check: Record<string, unknown>): boolean
}

/** 从 UA 字符串里抠出版本号。 */
function pickVersion(ua: string, re: RegExp): string {
  const m = re.exec(ua)
  return m && m[1] ? m[1] : ''
}

/** 解析一个 UA 字符串（纯字符串处理，浏览器/测试里都能跑）。 */
export function parseUserAgent(ua: string): StUaInfo {
  const text = typeof ua === 'string' ? ua : ''
  let browserName = 'Unknown'
  let browserVersion = ''
  if (/Edg\//.test(text)) { browserName = 'Edge'; browserVersion = pickVersion(text, /Edg\/([\d.]+)/) }
  else if (/OPR\/|Opera/.test(text)) { browserName = 'Opera'; browserVersion = pickVersion(text, /(?:OPR|Opera)[\/ ]([\d.]+)/) }
  else if (/Firefox\//.test(text)) { browserName = 'Firefox'; browserVersion = pickVersion(text, /Firefox\/([\d.]+)/) }
  else if (/Chrome\//.test(text)) { browserName = 'Chrome'; browserVersion = pickVersion(text, /Chrome\/([\d.]+)/) }
  else if (/Safari\//.test(text) && /Version\//.test(text)) { browserName = 'Safari'; browserVersion = pickVersion(text, /Version\/([\d.]+)/) }
  else if (/MSIE|Trident/.test(text)) { browserName = 'Internet Explorer'; browserVersion = pickVersion(text, /(?:MSIE |rv:)([\d.]+)/) }
  let osName = 'Unknown'
  let osVersion = ''
  if (/Windows NT/.test(text)) {
    osName = 'Windows'
    const nt = pickVersion(text, /Windows NT ([\d.]+)/)
    osVersion = nt === '10.0' ? '10' : nt
  } else if (/Android/.test(text)) { osName = 'Android'; osVersion = pickVersion(text, /Android ([\d.]+)/) }
  else if (/iPhone|iPad|iPod/.test(text)) { osName = 'iOS'; osVersion = pickVersion(text, /OS ([\d_]+)/).split('_').join('.') }
  else if (/Mac OS X/.test(text)) { osName = 'macOS'; osVersion = pickVersion(text, /Mac OS X ([\d_.]+)/).split('_').join('.') }
  else if (/CrOS/.test(text)) { osName = 'Chrome OS' }
  else if (/Linux/.test(text)) { osName = 'Linux' }
  const isTablet = /iPad|Tablet|PlayBook|Silk/.test(text) || (/Android/.test(text) && !/Mobile/.test(text))
  const isMobile = !isTablet && /Mobile|iPhone|iPod|Android|Windows Phone|IEMobile/.test(text)
  const isBot = /bot|crawler|spider|crawling/i.test(text)
  const platformType = isBot ? 'bot' : isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'
  let engine = 'Unknown'
  if (/Gecko\//.test(text) && /Firefox/.test(text)) engine = 'Gecko'
  else if (/AppleWebKit/.test(text)) engine = /Chrome|Edg|OPR/.test(text) ? 'Blink' : 'WebKit'
  else if (/Trident/.test(text)) engine = 'Trident'
  return {
    browser: { name: browserName, version: browserVersion },
    os: { name: osName, version: osVersion },
    platform: { type: platformType, vendor: '', model: '' },
    engine: { name: engine, version: '' },
  }
}

/** 是否移动端 UA（context.isMobile 用）。 */
export function detectIsMobile(ua?: string): boolean {
  const info = parseUserAgent(typeof ua === 'string' ? ua : '')
  return info.platform.type === 'mobile' || info.platform.type === 'tablet'
}

/** 创建 Bowser 子集实例。 */
export function createBowser(userAgent?: string): StBowser {
  const initial = typeof userAgent === 'string' ? userAgent : ''
  const parserOf = (ua?: string): StBowserParser => {
    const info = parseUserAgent(typeof ua === 'string' ? ua : initial)
    return {
      getBrowser: () => info.browser,
      getBrowserName: () => info.browser.name,
      getBrowserVersion: () => info.browser.version,
      getOS: () => info.os,
      getOSName: () => info.os.name,
      getOSVersion: () => info.os.version,
      getPlatform: () => info.platform,
      getPlatformType: () => info.platform.type,
      getEngine: () => info.engine,
      getEngineName: () => info.engine.name,
      parse: () => info,
      satisfies: (check: Record<string, unknown>) => satisfiesUa(info, check),
      is: (check: string) => {
        const parts = String(check).split(' ').filter(Boolean)
        const name = parts[0] || ''
        return info.browser.name.toLowerCase() === name.toLowerCase() || info.os.name.toLowerCase() === name.toLowerCase()
      },
    }
  }
  const info = parseUserAgent(initial)
  return {
    parse: (ua?: string) => parseUserAgent(typeof ua === 'string' ? ua : initial),
    getParser: parserOf,
    mobile: info.platform.type === 'mobile',
    tablet: info.platform.type === 'tablet',
    desktop: info.platform.type === 'desktop',
    bot: info.platform.type === 'bot',
    browser: info.browser,
    os: info.os,
    platform: info.platform,
    satisfies: (check: Record<string, unknown>) => satisfiesUa(info, check),
  }
}

/** 最简 satisfies：只比对 platform.type / browser.name / os.name。 */
function satisfiesUa(info: StUaInfo, check: Record<string, unknown>): boolean {
  if (!check || typeof check !== 'object') return true
  const platform = check.platform as { type?: string } | undefined
  if (platform && platform.type && platform.type !== info.platform.type) return false
  const browser = check.browser as { name?: string } | undefined
  if (browser && browser.name && browser.name.toLowerCase() !== info.browser.name.toLowerCase()) return false
  const os = check.os as { name?: string } | undefined
  if (os && os.name && os.name.toLowerCase() !== info.os.name.toLowerCase()) return false
  return true
}

// ---------------------------------------------------------------------------
// hljs（安全空壳：只做 HTML 转义，不做语法着色）
// ---------------------------------------------------------------------------

/** hljs.highlight 的返回结构。 */
export interface StHljsResult {
  /** 已转义的 HTML。 */
  value: string
  /** 语言名。 */
  language: string
  /** 相关度（空壳恒为 0）。 */
  relevance: number
  /** 标记这是空壳实现，方便诊断。 */
  stubbed: true
}

/** hljs 空壳的面。 */
export interface StHljs {
  highlight(code: string, options?: { language?: string; ignoreIllegals?: boolean }): StHljsResult
  highlightAuto(code: string, languageSubset?: string[]): StHljsResult
  highlightElement(element: { innerHTML: string; classList?: { add(name: string): void } }): void
  getLanguage(name: string): { name: string; aliases?: string[] } | undefined
  listLanguages(): string[]
  registerLanguage(name: string, definition?: unknown): void
  unregisterLanguage(name: string): void
  configure(options?: Record<string, unknown>): void
  versionString: string
}

/** 创建 hljs 空壳（点亮代码块用，明确不做语法着色）。 */
export function createHljs(): StHljs {
  const languages: Record<string, { name: string; aliases?: string[] }> = { plaintext: { name: 'Plain text', aliases: ['text', 'txt'] } }
  const result = (code: string, language: string): StHljsResult => ({ value: escapeHtml(code), language, relevance: 0, stubbed: true })
  return {
    highlight: (code: string, options?: { language?: string }) => result(code, (options && options.language) || 'plaintext'),
    highlightAuto: (code: string) => result(code, 'plaintext'),
    highlightElement: (element: { innerHTML: string }) => {
      try {
        if (element && typeof element === 'object') element.innerHTML = escapeHtml(element.innerHTML)
      } catch (e) {
        try { console.error('[portable-tavern/st] hljs.highlightElement 失败', e) } catch { /* 无 console */ }
      }
    },
    getLanguage: (name: string) => languages[name],
    listLanguages: () => Object.keys(languages),
    registerLanguage: (name: string, definition?: unknown) => {
      languages[name] = { name, aliases: (definition && typeof definition === 'object' ? (definition as { aliases?: string[] }).aliases : undefined) }
    },
    unregisterLanguage: (name: string) => { delete languages[name] },
    configure: () => { /* 空壳无需配置 */ },
    versionString: '11.9.0-portable-tavern-stub',
  }
}

// ---------------------------------------------------------------------------
// localforage（localStorage 包装，Promise 化）
// ---------------------------------------------------------------------------

/** 宿主注入的存储后端（浏览器传 localStorage；测试传内存实现）。 */
export interface StStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /** 第 index 个键（无则 null）。 */
  key(index: number): string | null
  /** 键总数。 */
  readonly length: number
  /** 清空。 */
  clear(): void
}

/** localforage 的面（子集）。 */
export interface StLocalforage {
  INDEXEDDB: string
  WEBSQL: string
  LOCALSTORAGE: string
  ready(callback?: () => void): Promise<void>
  driver(callback?: (driver: string) => void): Promise<string>
  setDriver(driver?: string | string[], callback?: () => void): Promise<void>
  config(options?: Record<string, unknown>): Record<string, unknown>
  getItem<T>(key: string, callback?: (err: unknown, value: T | null) => void): Promise<T | null>
  setItem<T>(key: string, value: T, callback?: (err: unknown, value: T) => void): Promise<T>
  removeItem(key: string, callback?: (err: unknown) => void): Promise<void>
  clear(callback?: (err: unknown) => void): Promise<void>
  length(callback?: (err: unknown, n: number) => void): Promise<number>
  key(index: number, callback?: (err: unknown, key: string | null) => void): Promise<string | null>
  keys(callback?: (err: unknown, keys: string[]) => void): Promise<string[]>
  iterate<T, U>(iterator: (value: T, key: string, iterationNumber: number) => U, callback?: (err: unknown, result: U | undefined) => void): Promise<U | undefined>
  createInstance(options?: Record<string, unknown>): StLocalforage
  dropInstance(options?: unknown): Promise<void>
  supports(driverName?: string): boolean
}

/** 用任意 StorageLike 造一个 localforage 兼容对象（值走 JSON 序列化）。 */
export function createLocalforage(storage: StStorageLike): StLocalforage {
  const safe = (fn: () => void): void => {
    try { fn() } catch (e) { console.error('[portable-tavern/st] localforage 写失败', e) }
  }
  const keysOf = (): string[] => {
    const out: string[] = []
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (typeof k === 'string') out.push(k)
      }
    } catch (e) { console.error('[portable-tavern/st] localforage 枚举失败', e) }
    return out
  }
  const instance: StLocalforage = {
    INDEXEDDB: 'asyncStorage',
    WEBSQL: 'webSQLStorage',
    LOCALSTORAGE: 'localStorageWrapper',
    ready: (callback?: () => void) => { if (callback) callback(); return Promise.resolve() },
    driver: (callback?: (driver: string) => void) => { if (callback) callback(instance.LOCALSTORAGE); return Promise.resolve(instance.LOCALSTORAGE) },
    setDriver: (_driver?: string | string[], callback?: () => void) => { if (callback) callback(); return Promise.resolve() },
    config: (options?: Record<string, unknown>) => Object.assign({ driver: [instance.LOCALSTORAGE], name: 'portable-tavern', storeName: 'tavern_st' }, options || {}),
    getItem: <T>(key: string, callback?: (err: unknown, value: T | null) => void): Promise<T | null> => {
      let value: T | null = null
      try {
        const raw = storage.getItem(key)
        value = raw === null || raw === undefined ? null : JSON.parse(raw) as T
      } catch (e) { console.error('[portable-tavern/st] localforage.getItem 解析失败: ' + key, e) }
      if (callback) callback(null, value)
      return Promise.resolve(value)
    },
    setItem: <T>(key: string, value: T, callback?: (err: unknown, value: T) => void): Promise<T> => {
      safe(() => storage.setItem(key, JSON.stringify(value === undefined ? null : value)))
      if (callback) callback(null, value)
      return Promise.resolve(value)
    },
    removeItem: (key: string, callback?: (err: unknown) => void): Promise<void> => {
      safe(() => storage.removeItem(key))
      if (callback) callback(null)
      return Promise.resolve()
    },
    clear: (callback?: (err: unknown) => void): Promise<void> => {
      safe(() => storage.clear())
      if (callback) callback(null)
      return Promise.resolve()
    },
    length: (callback?: (err: unknown, n: number) => void): Promise<number> => {
      let n = 0
      try { n = storage.length } catch { n = 0 }
      if (callback) callback(null, n)
      return Promise.resolve(n)
    },
    key: (index: number, callback?: (err: unknown, key: string | null) => void): Promise<string | null> => {
      let value: string | null = null
      try { value = storage.key(index) } catch { value = null }
      if (callback) callback(null, value)
      return Promise.resolve(value)
    },
    keys: (callback?: (err: unknown, keys: string[]) => void): Promise<string[]> => {
      const list = keysOf()
      if (callback) callback(null, list)
      return Promise.resolve(list)
    },
    iterate: <T, U>(iterator: (value: T, key: string, iterationNumber: number) => U, callback?: (err: unknown, result: U | undefined) => void): Promise<U | undefined> => {
      let result: U | undefined
      const list = keysOf()
      for (let i = 0; i < list.length; i++) {
        let value: T | null = null
        try { const raw = storage.getItem(list[i]); value = raw === null ? null : JSON.parse(raw) as T } catch { value = null }
        result = iterator(value as T, list[i], i + 1)
      }
      if (callback) callback(null, result)
      return Promise.resolve(result)
    },
    createInstance: () => instance,
    dropInstance: () => { safe(() => storage.clear()); return Promise.resolve() },
    supports: () => true,
  }
  return instance
}

// ---------------------------------------------------------------------------
// DOMPurify 的正则降级版（浏览器里 libs.ts 会用 DOMParser 白名单版）
// ---------------------------------------------------------------------------

/** sanitize 选项（DOMPurify 的常用子集）。 */
export interface StSanitizeOptions {
  /** 白名单标签（给定时不在表内的标签会被剥掉，内容保留）。 */
  ALLOWED_TAGS?: string[]
  /** 白名单属性（给定时不在表内的属性会被剥掉）。 */
  ALLOWED_ATTR?: string[]
  /** 额外禁用的标签。 */
  FORBID_TAGS?: string[]
  /** 额外禁用的属性。 */
  FORBID_ATTR?: string[]
  /** 是否保留被剥标签的内部内容，默认 true。 */
  KEEP_CONTENT?: boolean
  /** 是否允许 data-* 属性，默认 true。 */
  ALLOW_DATA_ATTR?: boolean
}

/** 默认禁用的危险标签。 */
const DEFAULT_FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'template', 'noscript', 'frame', 'frameset', 'applet']

/** 无 DOM 环境下的 sanitize 降级实现（正则白名单剥离）。 */
export function sanitizeHtmlFallback(html: unknown, options?: StSanitizeOptions): string {
  let text = toStringValue(html)
  if (!text) return ''
  const opts = options || {}
  const keepContent = opts.KEEP_CONTENT !== false
  const allowDataAttr = opts.ALLOW_DATA_ATTR !== false
  const forbidTags = DEFAULT_FORBID_TAGS.concat(opts.FORBID_TAGS || []).map((t) => t.toLowerCase())
  const allowedTags = opts.ALLOWED_TAGS ? opts.ALLOWED_TAGS.map((t) => t.toLowerCase()) : null
  const allowedAttrs = opts.ALLOWED_ATTR ? opts.ALLOWED_ATTR.map((a) => a.toLowerCase()) : null
  const forbidAttrs = (opts.FORBID_ATTR || []).map((a) => a.toLowerCase())
  text = text.split(/<!--[\s\S]*?-->/g).join('')
  // 逐个标签处理：剥掉禁用/非白名单标签（默认保留内部内容）
  text = text.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (match: string, rawName: string, rawAttrs: string) => {
    const name = String(rawName).toLowerCase()
    const closing = match.charAt(1) === '/'
    const blocked = forbidTags.indexOf(name) >= 0 || (allowedTags !== null && allowedTags.indexOf(name) < 0)
    if (blocked) return keepContent ? '' : ''
    if (closing) return '</' + name + '>'
    const attrs = String(rawAttrs || '')
    let cleaned = ''
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(attrs)) !== null) {
      const attrName = m[1].toLowerCase()
      const attrValue = m[2]
      if (attrName.indexOf('on') === 0) continue
      if (forbidAttrs.indexOf(attrName) >= 0) continue
      if (attrName.indexOf('data-') === 0 && !allowDataAttr) continue
      if (allowedAttrs !== null && allowedAttrs.indexOf(attrName) < 0 && attrName.indexOf('data-') !== 0 && attrName !== 'class') continue
      const bare = attrValue.replace(/^["']|["']$/g, '').replace(/\s+/g, '').toLowerCase()
      if ((attrName === 'href' || attrName === 'src' || attrName === 'xlink:href' || attrName === 'action') && bare.indexOf('javascript:') === 0) continue
      if ((attrName === 'src' || attrName === 'href') && bare.indexOf('data:') === 0 && bare.indexOf('data:image/') !== 0) continue
      cleaned += ' ' + attrName + '=' + attrValue
    }
    const selfClosing = /\/>$/.test(attrs.trim()) ? ' /' : ''
    return '<' + name + cleaned + selfClosing + '>'
  })
  return text
}



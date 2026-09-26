/**
 * 兼容宿主纯逻辑自检（不需要浏览器）：eventSource 语义、Handlebars 子集、lodash 子集、
 * sanitize 降级、localforage、Fuse、Bowser、hljs、debounce/throttle。
 *
 * 跑法（Node 24 自带类型剥离；显式加上标志兼容更老的版本）：
 *   node --experimental-strip-types src/client/st/__selftest.mjs
 *
 * 只 import 不碰 DOM 的两个文件：emitter.ts 与 libs-pure.ts。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { StEventSource, createEventSource, event_types, REPLAY_EVENTS } from './emitter.ts'
import {
  cloneDeep,
  createFuseClass,
  createHandlebars,
  createHljs,
  createLocalforage,
  debounce,
  detectIsMobile,
  escapeHtml,
  isEqual,
  lodashSubset,
  mergeDeep,
  parseUserAgent,
  sanitizeHtmlFallback,
  throttle,
} from './libs-pure.ts'

/** 等一小会儿。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 造一个内存版 StorageLike（给 localforage 用）。 */
function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: (key) => { map.delete(key) },
    key: (index) => {
      const list = Array.from(map.keys())
      return index >= 0 && index < list.length ? list[index] : null
    },
    get length() { return map.size },
    clear: () => { map.clear() },
  }
}

// ---------------------------------------------------------------------------
// event_types
// ---------------------------------------------------------------------------

test('event_types 覆盖任务书要求的全部事件名且值与 ST 一致', () => {
  const required = {
    APP_READY: 'app_ready',
    APP_INITIALIZED: 'app_initialized',
    CHAT_CHANGED: 'chat_id_changed',
    CHAT_LOADED: 'chatLoaded',
    CHAT_CREATED: 'chat_created',
    CHAT_RENAMED: 'chat_renamed',
    CHAT_DELETED: 'chat_deleted',
    MESSAGE_SENT: 'message_sent',
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    MESSAGE_UPDATED: 'message_updated',
    MESSAGE_SWIPED: 'message_swiped',
    USER_MESSAGE_RENDERED: 'user_message_rendered',
    CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
    GENERATION_STARTED: 'generation_started',
    GENERATION_STOPPED: 'generation_stopped',
    GENERATION_ENDED: 'generation_ended',
    STREAM_TOKEN_RECEIVED: 'stream_token_received',
    SETTINGS_LOADED: 'settings_loaded',
    SETTINGS_LOADED_BEFORE: 'settings_loaded_before',
    SETTINGS_LOADED_AFTER: 'settings_loaded_after',
    EXTENSION_SETTINGS_LOADED: 'extension_settings_loaded',
    EXTENSIONS_FIRST_LOAD: 'extensions_first_load',
    GROUP_UPDATED: 'group_updated',
    WORLDINFO_UPDATED: 'worldinfo_updated',
    CHARACTER_EDITED: 'character_edited',
    PERSONA_CHANGED: 'persona_changed',
    MAIN_API_CHANGED: 'main_api_changed',
    ONLINE_STATUS_CHANGED: 'online_status_changed',
    FORCE_SET_BACKGROUND: 'force_set_background',
    MOVABLE_PANELS_RESET: 'movable_panels_reset',
    PRESET_CHANGED: 'preset_changed',
  }
  for (const [key, value] of Object.entries(required)) {
    assert.equal(event_types[key], value, 'event_types.' + key + ' 应为 ' + value)
  }
  assert.equal(event_types.CHATCREATED, event_types.CHAT_CREATED)
  assert.equal(event_types.CHAT_ID_CHANGED, event_types.CHAT_CHANGED)
  assert.deepEqual(REPLAY_EVENTS, ['app_ready', 'app_initialized'])
})

// ---------------------------------------------------------------------------
// eventSource
// ---------------------------------------------------------------------------

test('emit 按注册顺序逐个 await 监听器（串行，不是并发）', async () => {
  const bus = createEventSource()
  const order = []
  bus.on('evt', async () => { order.push('a:start'); await sleep(20); order.push('a:end') })
  bus.on('evt', async () => { order.push('b:start'); await sleep(5); order.push('b:end') })
  const started = Date.now()
  await bus.emit('evt')
  const elapsed = Date.now() - started
  assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end'])
  assert.ok(elapsed >= 24, '串行执行总耗时应 >= 25ms，实际 ' + elapsed + 'ms')
})

test('监听器抛错/拒绝会被吞掉：不影响其它监听器，也不会 reject 调用方', async () => {
  const bus = createEventSource()
  const originalError = console.error
  const logged = []
  console.error = (...args) => { logged.push(args[0]) }
  try {
    const seen = []
    bus.on('boom', () => { throw new Error('同步炸') })
    bus.on('boom', async () => { throw new Error('异步炸') })
    bus.on('boom', () => { seen.push('后面照跑') })
    await bus.emit('boom')
    assert.deepEqual(seen, ['后面照跑'])
    assert.equal(logged.length, 2)
    assert.ok(String(logged[0]).includes('boom'))
  } finally {
    console.error = originalError
  }
})

test('APP_READY / APP_INITIALIZED 自动补发：晚注册的监听器立刻拿到最后一次参数', async () => {
  const bus = createEventSource()
  await bus.emit(event_types.APP_READY, 'boot', 42)
  const got = []
  bus.on(event_types.APP_READY, (...args) => { got.push(args) })
  assert.deepEqual(got, [['boot', 42]], 'on 应立刻补发')
  const onceGot = []
  bus.once(event_types.APP_INITIALIZED, (...args) => { onceGot.push(args) })
  assert.deepEqual(onceGot, [], '没 emit 过的补发事件不应触发')
  await bus.emit(event_types.APP_INITIALIZED, 'init')
  assert.deepEqual(onceGot, [['init']], '正常 emit 会触发已注册的 once')
  bus.once(event_types.APP_INITIALIZED, (...args) => { onceGot.push(args) })
  assert.deepEqual(onceGot, [['init'], ['init']], 'once 的补发只多调用一次')
  assert.equal(bus.listenerCount(event_types.APP_INITIALIZED), 0, 'once 补发后不应留在监听表里')
  const plain = []
  await bus.emit('some_other_event', 1)
  bus.on('some_other_event', (...args) => { plain.push(args) })
  assert.deepEqual(plain, [], '非补发事件不应被补发')
  assert.equal(bus.hasEmitted(event_types.APP_READY), true)
  assert.deepEqual(bus.lastArgs(event_types.APP_READY), ['boot', 42])
})

test('once 只触发一次；removeListener / off 能注销；removeAllListeners 能清空', async () => {
  const bus = createEventSource()
  let onceCount = 0
  bus.once('e', () => { onceCount += 1 })
  await bus.emit('e')
  await bus.emit('e')
  assert.equal(onceCount, 1)
  let count = 0
  const handler = () => { count += 1 }
  bus.on('e2', handler)
  await bus.emit('e2')
  bus.removeListener('e2', handler)
  await bus.emit('e2')
  assert.equal(count, 1)
  bus.on('e3', handler)
  bus.off('e3', handler)
  assert.equal(bus.listenerCount('e3'), 0)
  bus.on('e4', handler)
  bus.removeAllListeners()
  assert.deepEqual(bus.eventNames(), [])
})

test('makeFirst / makeLast 决定先后顺序', async () => {
  const bus = createEventSource()
  const order = []
  bus.on('seq', () => order.push('normal-1'))
  bus.on('seq', () => order.push('normal-2'))
  bus.makeLast('seq', () => order.push('last'))
  bus.makeFirst('seq', () => order.push('first'))
  bus.on('seq', () => order.push('normal-3'))
  await bus.emit('seq')
  assert.deepEqual(order, ['first', 'normal-1', 'normal-2', 'normal-3', 'last'])
})

test('onAny 收到事件名 + 参数；emitAndWait 收集返回值；emit 期间的注册不参与本轮', async () => {
  const bus = createEventSource()
  const anySeen = []
  bus.onAny((event, ...args) => { anySeen.push([event, args]) })
  bus.on('sum', () => 1)
  bus.on('sum', async () => 2)
  let late = 0
  bus.on('sum', () => { bus.on('sum', () => { late += 1 }) })
  const results = await bus.emitAndWait('sum', 'x')
  assert.deepEqual(results.slice(0, 2), [1, 2])
  assert.equal(late, 0, 'emit 期间注册的监听器不应参与本轮')
  assert.deepEqual(anySeen, [['sum', ['x']]], 'onAny 每次 emit 调用一次（参数是事件名 + 原参数）')
  await bus.emit('sum', 'y')
  assert.equal(late, 1, '下一轮应触发')
  bus.offAny(anySeen.handler || (() => {}))
})

test('waitUntil 满足条件即返回，超时则 reject', async () => {
  const bus = createEventSource()
  const waiting = bus.waitUntil('tick', (n) => n >= 3, 500)
  await bus.emit('tick', 1)
  await bus.emit('tick', 2)
  await bus.emit('tick', 3)
  assert.deepEqual(await waiting, [3])
  assert.equal(bus.listenerCount('tick'), 0, 'waitUntil 完成后应注销自己')
  await assert.rejects(() => bus.waitUntil('never', undefined, 20))
})

test('加载窗口归属：beginScope 期间注册的监听器可被 removeByOwner 批量注销', async () => {
  const bus = createEventSource()
  bus.beginScope('ext-a')
  bus.on('x', () => {})
  bus.onAny(() => {})
  bus.endScope()
  bus.on('x', () => {})
  assert.deepEqual(bus.ownerStats(), { 'ext-a': 2, '(host)': 1 })
  assert.equal(bus.removeByOwner('ext-a'), 2)
  assert.equal(bus.listenerCount('x'), 1)
})

// ---------------------------------------------------------------------------
// Handlebars 子集
// ---------------------------------------------------------------------------

test('Handlebars：变量 / raw / 转义 / 缺失变量', () => {
  const hb = createHandlebars()
  assert.equal(hb.compile('<p>{{name}}</p>')({ name: '爱丽丝' }), '<p>爱丽丝</p>')
  assert.equal(hb.compile('{{html}}')({ html: '<b>x</b>' }), '&lt;b&gt;x&lt;/b&gt;')
  assert.equal(hb.compile('{{{html}}}')({ html: '<b>x</b>' }), '<b>x</b>')
  assert.equal(hb.compile('{{missing}}')({}), '')
  assert.equal(hb.compile('{{a.b.c}}')({ a: { b: { c: 'deep' } } }), 'deep')
  assert.equal(hb.compile('{{! 注释 }}ok')({}), 'ok')
  assert.equal(escapeHtml("<&'\">"), '&lt;&amp;&#x27;&quot;&gt;')
})

test('Handlebars：#if / #unless / else / else if', () => {
  const hb = createHandlebars()
  const tpl = hb.compile('{{#if on}}开{{else}}关{{/if}}')
  assert.equal(tpl({ on: true }), '开')
  assert.equal(tpl({ on: false }), '关')
  assert.equal(tpl({ on: [] }), '关', '空数组按 Handlebars 规则算假')
  assert.equal(hb.compile('{{#unless off}}亮{{/unless}}')({ off: false }), '亮')
  assert.equal(hb.compile('{{#if a}}A{{else if b}}B{{else}}C{{/if}}')({ a: false, b: true }), 'B')
  assert.equal(hb.compile('{{#if a}}A{{else if b}}B{{else}}C{{/if}}')({ a: false, b: false }), 'C')
})

test('Handlebars：#each（数组 / 对象 / @index / @key / @first / @last / 父级 / this）', () => {
  const hb = createHandlebars()
  const list = hb.compile('{{#each items}}{{@index}}:{{this}}{{#unless @last}},{{/unless}}{{/each}}')
  assert.equal(list({ items: ['a', 'b', 'c'] }), '0:a,1:b,2:c')
  const obj = hb.compile('{{#each map}}{{@key}}={{this}};{{/each}}')
  assert.equal(obj({ map: { x: 1, y: 2 } }), 'x=1;y=2;')
  const parent = hb.compile('{{#each list}}{{../title}}-{{name}} {{/each}}')
  assert.equal(parent({ title: 'T', list: [{ name: 'a' }, { name: 'b' }] }), 'T-a T-b ')
  const nested = hb.compile('{{#each rows}}{{#each this}}{{this}}{{/each}}|{{/each}}')
  assert.equal(nested({ rows: [[1, 2], [3]] }), '12|3|')
  assert.equal(hb.compile('{{#each empty}}x{{else}}空{{/each}}')({ empty: [] }), '空')
  assert.equal(hb.compile('{{#with user}}{{name}}{{/with}}')({ user: { name: 'u' } }), 'u')
  assert.equal(hb.compile('{{~#if on~}}  紧  {{~/if~}}')({ on: true }), '紧')
})

test('Handlebars：registerHelper 与 SafeString', () => {
  const hb = createHandlebars()
  hb.registerHelper('upper', (value) => String(value).toUpperCase())
  assert.equal(hb.compile('{{upper name}}')({ name: 'abc' }), 'ABC')
  hb.registerHelper('bold', (value, options) => '<b>' + options.fn(value) + '</b>')
  assert.equal(hb.compile('{{#bold name}}{{this}}!{{/bold}}')({ name: 'x' }), '<b>x!</b>')
  hb.registerHelper('raw', () => new hb.SafeString('<i>i</i>'))
  assert.equal(hb.compile('{{{raw}}}')({}), '<i>i</i>')
  assert.equal(hb.compile('{{raw}}')({}), '<i>i</i>', 'SafeString 与 {{{ }}} 一样不转义')
  assert.equal(hb.compile('{{#if x}}')[0] === undefined ? typeof hb.compile('') : 'fn', 'function')
})

// ---------------------------------------------------------------------------
// lodash 子集
// ---------------------------------------------------------------------------

test('lodash：get / set / has 支持路径与数组下标', () => {
  const _ = lodashSubset
  const obj = { a: { b: [{ c: 1 }] } }
  assert.equal(_.get(obj, 'a.b[0].c'), 1)
  assert.equal(_.get(obj, ['a', 'b', '0', 'c']), 1)
  assert.equal(_.get(obj, 'a.x.y', '默认'), '默认')
  const target = {}
  _.set(target, 'a.b[1].c', 9)
  assert.equal(target.a.b.length, 2, 'set 会自动建数组')
  assert.equal(target.a.b[1].c, 9)
  assert.equal(0 in target.a.b, false, '空洞与 lodash 行为一致')
  assert.equal(_.has(obj, 'a.b[0].c'), true)
  assert.equal(_.has(obj, 'a.zzz'), false)
})

test('lodash：cloneDeep / merge / isEqual / isEmpty / isObject', () => {
  const _ = lodashSubset
  const source = { a: 1, b: { c: [1, 2, { d: new Date(0) }] } }
  const copy = _.cloneDeep(source)
  assert.notEqual(copy, source)
  assert.notEqual(copy.b.c, source.b.c)
  assert.equal(copy.b.c[2].d.getTime(), 0)
  copy.b.c[0] = 99
  assert.equal(source.b.c[0], 1)
  const cyclic = { name: 'x' }
  cyclic.self = cyclic
  assert.equal(_.cloneDeep(cyclic).self.name, 'x', '循环引用不应该爆栈')
  assert.deepEqual(_.merge({ a: { x: 1 }, list: [1, 2] }, { a: { y: 2 }, list: [9] }), { a: { x: 1, y: 2 }, list: [9, 2] })
  assert.equal(_.isEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true)
  assert.equal(_.isEqual({ a: 1 }, { a: 2 }), false)
  assert.equal(_.isEmpty([]), true)
  assert.equal(_.isEmpty({ a: 1 }), false)
  assert.equal(_.isEmpty(''), true)
  assert.equal(_.isObject({}), true)
  assert.equal(_.isObject(null), false)
})

test('lodash：foreach / map / filter / find / uniqBy / sortBy / groupBy / keyBy', () => {
  const _ = lodashSubset
  const list = [{ id: 2, name: 'b', tags: ['x'] }, { id: 1, name: 'a', tags: [] }, { id: 2, name: 'c', tags: [] }]
  const visited = []
  _.forEach(list, (item, index) => { visited.push(index + ':' + item.name) })
  assert.deepEqual(visited, ['0:b', '1:a', '2:c'])
  assert.deepEqual(_.map(list, 'name'), ['b', 'a', 'c'])
  assert.deepEqual(_.filter(list, (item) => item.id === 2).length, 2)
  assert.equal(_.find(list, { id: 1 }).name, 'a')
  assert.deepEqual(_.uniqBy(list, 'id').map((item) => item.id), [2, 1])
  assert.deepEqual(_.sortBy(list, 'id').map((item) => item.id), [1, 2, 2])
  assert.deepEqual(Object.keys(_.groupBy(list, 'id')), ['1', '2'])
  assert.equal(_.keyBy(list, 'name').a.id, 1)
})

test('lodash：字符串与数值工具', () => {
  const _ = lodashSubset
  assert.equal(_.escape("<a href='x'>&"), '&lt;a href&#x3D;&#x27;x&#x27;&gt;&amp;')
  assert.equal(_.kebabCase('Foo Bar_baz'), 'foo-bar-baz')
  assert.equal(_.startCase('fooBar baz'), 'Foo Bar Baz')
  assert.equal(_.camelCase('foo-bar baz'), 'fooBarBaz')
  assert.equal(_.capitalize('hELLO'), 'Hello')
  assert.deepEqual(_.range(3), [0, 1, 2])
  assert.deepEqual(_.range(1, 6, 2), [1, 3, 5])
  assert.equal(_.clamp(12, 0, 10), 10)
  assert.equal(_.clamp(-3, 0, 10), 0)
  const n = _.random(1, 3)
  assert.ok(n >= 1 && n <= 3 && Number.isInteger(n))
})

test('lodash：omit / pick / assign / defaults / flatten / times', () => {
  const _ = lodashSubset
  const obj = { a: 1, b: 2, c: 3 }
  assert.deepEqual(_.omit(obj, 'b'), { a: 1, c: 3 })
  assert.deepEqual(_.omit(obj, ['a', 'c']), { b: 2 })
  assert.deepEqual(_.pick(obj, ['a', 'c']), { a: 1, c: 3 })
  assert.deepEqual(_.assign({ a: 1 }, { b: 2 }, { a: 3 }), { a: 3, b: 2 })
  assert.deepEqual(_.defaults({ a: 1 }, { a: 9, b: 2 }), { a: 1, b: 2 })
  assert.deepEqual(_.flatten([[1, 2], [3], 4]), [1, 2, 3, 4])
  assert.deepEqual(_.times(3, (i) => i * 2), [0, 2, 4])
  assert.ok(_.uniqueId('id-') !== _.uniqueId('id-'))
})

test('lodash：debounce / throttle 语义', async () => {
  const calls = []
  const debounced = debounce((value) => { calls.push(value) }, 20)
  debounced(1)
  debounced(2)
  debounced(3)
  assert.deepEqual(calls, [], '防抖期间不应该立即执行（无 leading）')
  await sleep(45)
  assert.deepEqual(calls, [3], '只执行最后一次')
  debounced(4)
  debounced.cancel()
  await sleep(45)
  assert.deepEqual(calls, [3])
  const leadingCalls = []
  const leading = debounce((value) => { leadingCalls.push(value) }, 20, { leading: true, trailing: false })
  leading('a')
  leading('b')
  assert.deepEqual(leadingCalls, ['a'], 'leading 立即执行一次')
  const throttled = []
  const fn = throttle((value) => { throttled.push(value) }, 30)
  fn(1)
  fn(2)
  fn(3)
  assert.deepEqual(throttled, [1], '节流首次立即执行')
  await sleep(60)
  assert.deepEqual(throttled, [1, 3], '尾部补一次最新值')
})

// ---------------------------------------------------------------------------
// sanitize / localforage / Fuse / Bowser / hljs
// ---------------------------------------------------------------------------

test('sanitizeHtmlFallback 剥离 script / on* / javascript: / 非图片 data:', () => {
  const dirty = '<div onclick="evil()">a<img src="x" onerror="evil()"></div><script>evil()</script><a href="javascript:evil()">l</a>'
  const clean = sanitizeHtmlFallback(dirty)
  assert.ok(!/script/i.test(clean), '不应保留 script 标签：' + clean)
  assert.ok(!/onclick/i.test(clean))
  assert.ok(!/onerror/i.test(clean))
  assert.ok(!/javascript:/i.test(clean))
  assert.ok(clean.includes('<img src="x">'), '普通属性应保留：' + clean)
  assert.ok(clean.includes('a'), '内容应保留')
  assert.equal(sanitizeHtmlFallback('<b>x</b>', { ALLOWED_TAGS: ['i'] }), 'x')
  assert.equal(sanitizeHtmlFallback(null), '')
})

test('localforage 包装：getItem / setItem / keys / removeItem / clear / iterate', async () => {
  const storage = memoryStorage()
  const lf = createLocalforage(storage)
  assert.equal(await lf.getItem('missing'), null)
  await lf.setItem('a', { n: 1 })
  assert.deepEqual(await lf.getItem('a'), { n: 1 })
  assert.deepEqual(await lf.keys(), ['a'])
  assert.equal(await lf.length(), 1)
  await lf.setItem('b', 'text')
  assert.deepEqual((await lf.keys()).sort(), ['a', 'b'])
  const seen = []
  await lf.iterate((value, key) => { seen.push(key + '=' + String(value)) })
  assert.deepEqual(seen.sort(), ['a=[object Object]', 'b=text'])
  await lf.removeItem('a')
  assert.equal(await lf.getItem('a'), null)
  await lf.clear()
  assert.equal(await lf.length(), 0)
  assert.equal(await lf.driver(), 'localStorageWrapper')
  assert.equal(lf.createInstance(), lf)
})

test('Fuse 子集：按 keys 搜索并排序', () => {
  const Fuse = createFuseClass()
  const fuse = new Fuse([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Alicia' }], { keys: ['name'] })
  const hits = fuse.search('alice')
  assert.equal(hits.length, 1, 'Fuse 语义：查询字符必须全部命中（Alicia 没有 e）')
  assert.equal(hits[0].item.name, 'Alice', '完全命中应排第一')
  const prefixHits = fuse.search('ali')
  assert.equal(prefixHits.length, 2)
  assert.ok(prefixHits[0].score <= prefixHits[1].score)
  assert.deepEqual(fuse.search('zzz'), [])
  assert.equal(fuse.search('', { limit: 1 }).length, 1)
  fuse.add({ name: 'Carol' })
  assert.equal(fuse.getCollection().length, 4)
})

test('Bowser 子集：UA 解析与移动端判断', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const info = parseUserAgent(iphone)
  assert.equal(info.browser.name, 'Safari')
  assert.equal(info.os.name, 'iOS')
  assert.equal(info.platform.type, 'mobile')
  assert.equal(detectIsMobile(iphone), true)
  const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  assert.equal(parseUserAgent(desktop).browser.name, 'Chrome')
  assert.equal(parseUserAgent(desktop).platform.type, 'desktop')
  assert.equal(detectIsMobile(desktop), false)
})

test('hljs 空壳：只转义不着色', () => {
  const hljs = createHljs()
  const result = hljs.highlight('<b>x</b>', { language: 'xml' })
  assert.equal(result.value, '&lt;b&gt;x&lt;/b&gt;')
  assert.equal(result.stubbed, true)
  assert.ok(hljs.listLanguages().includes('plaintext'))
  const el = { innerHTML: '<i>y</i>' }
  hljs.highlightElement(el)
  assert.equal(el.innerHTML, '&lt;i&gt;y&lt;/i&gt;')
})

test('mergeDeep 与 cloneDeep 组合（稳定对象模式）', () => {
  const stable = { a: 1, nested: { x: 1 } }
  mergeDeep(stable, { nested: { y: 2 } })
  assert.deepEqual(stable, { a: 1, nested: { x: 1, y: 2 } })
  const copy = cloneDeep(stable)
  assert.ok(isEqual(copy, stable))
  assert.notEqual(copy.nested, stable.nested)
})

test('StEventSource 可直接 new（扩展偶尔会自己造一个）', async () => {
  const bus = new StEventSource()
  let hits = 0
  bus.on('ping', () => { hits += 1 })
  await bus.emit('ping')
  assert.equal(hits, 1)
})

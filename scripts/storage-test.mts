import assert from 'node:assert/strict'
import test from 'node:test'

/** Drive request success and transaction completion independently. */
let harnessId = 0
async function storageHarness(options: { manual?: boolean; abortWrites?: boolean; quota?: boolean; unavailable?: boolean } = {}) {
  const records = new Map<string, unknown>()
  const local = new Map<string, string>()
  const transactions: any[] = []
  const db = {
    transaction(_store: string, mode: string) {
      const request: any = { result: undefined, error: null }
      let operation = ''
      let key = ''
      let value: unknown
      const tx: any = {
        error: null,
        objectStore: () => ({
          get(k: string) { operation = 'get'; key = k; return request },
          put(v: unknown, k: string) { operation = 'put'; key = k; value = v; return request },
          delete(k: string) { operation = 'delete'; key = k; return request },
        }),
        succeed() {
          request.result = operation === 'get' ? records.get(key) : operation === 'put' ? key : undefined
          request.onsuccess?.()
        },
        complete() {
          if (operation === 'put') records.set(key, value)
          if (operation === 'delete') records.delete(key)
          tx.oncomplete?.()
        },
        abort() {
          tx.error = new DOMException('Transaction aborted', 'AbortError')
          tx.onabort?.()
        },
      }
      transactions.push(tx)
      if (!options.manual) queueMicrotask(() => {
        tx.succeed()
        queueMicrotask(() => options.abortWrites && mode === 'readwrite' ? tx.abort() : tx.complete())
      })
      return tx
    },
    close() {},
  }
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: options.unavailable ? undefined : {
    open() {
      const request: any = { result: db, error: null }
      queueMicrotask(() => request.onsuccess?.())
      return request
    },
  } })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem(key: string, value: string) {
      if (options.quota) throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
      local.set(key, value)
    },
    removeItem: (key: string) => local.delete(key),
  } })
  const storage = await import('../src/client/storage.ts?case=' + ++harnessId)
  const issues: unknown[] = []
  storage.onStorageIssue((issue: unknown) => issues.push(issue))
  return { storage, records, local, transactions, issues }
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

test('a successful put is not saved until its transaction commits', async () => {
  const h = await storageHarness({ manual: true })
  h.local.set('team', JSON.stringify({ name: 'legacy' }))
  let settled = false
  const saving = h.storage.saveRecord('team', { name: 'updated' }).then((ok: boolean) => { settled = true; return ok })
  await tick()
  h.transactions[0].succeed()
  await tick()
  const beforeCommit = { settled, legacy: h.local.has('team') }
  h.transactions[0].complete()
  assert.equal(await saving, true)
  assert.deepEqual(beforeCommit, { settled: false, legacy: true })
  assert.deepEqual(h.records.get('team'), { name: 'updated' })
  assert.equal(h.local.has('team'), false)
})

test('an abort after put success keeps the legacy copy and reports failed fallback', async (t) => {
  t.mock.method(console, 'warn', () => {})
  const h = await storageHarness({ manual: true, quota: true })
  h.local.set('team', JSON.stringify({ name: 'legacy' }))
  const saving = h.storage.saveRecord('team', { name: 'updated' })
  await tick()
  h.transactions[0].succeed()
  await tick()
  h.transactions[0].abort()
  assert.equal(await saving, false)
  assert.equal(h.local.has('team'), true)
  assert.equal(h.records.has('team'), false)
  assert.equal(h.issues.length, 1)
})

test('a newer fallback write wins over an older IndexedDB record', async () => {
  const h = await storageHarness({ abortWrites: true })
  h.records.set('team', { name: 'old' })
  assert.equal(await h.storage.saveRecord('team', { name: 'new' }), true)
  assert.deepEqual(await h.storage.loadRecord('team', 'team'), { name: 'new' })
  assert.deepEqual(h.records.get('team'), { name: 'old' })
  assert.deepEqual(JSON.parse(h.local.get('team')!), { name: 'new' })
})

test('records saved without IndexedDB can be loaded and deleted without a migration key', async () => {
  const h = await storageHarness({ unavailable: true })
  assert.equal(await h.storage.saveRecord('team', { name: 'offline' }), true)
  assert.deepEqual(await h.storage.loadRecord('team'), { name: 'offline' })
  await h.storage.deleteRecord('team')
  assert.equal(await h.storage.loadRecord('team', 'team'), null)
})

test('migration waits for commit before deleting a distinct legacy key', async () => {
  const h = await storageHarness()
  h.local.set('legacy-team', JSON.stringify({ name: 'migrated' }))
  assert.deepEqual(await h.storage.loadRecord('team', 'legacy-team'), { name: 'migrated' })
  assert.deepEqual(h.records.get('team'), { name: 'migrated' })
  assert.equal(h.local.has('legacy-team'), false)
})

test('a failed delete preserves its fallback copy', async (t) => {
  t.mock.method(console, 'warn', () => {})
  const h = await storageHarness({ abortWrites: true })
  h.records.set('team', { name: 'stored' })
  h.local.set('team', JSON.stringify({ name: 'fallback' }))
  await h.storage.deleteRecord('team')
  assert.equal(h.local.has('team'), true)
  assert.equal(h.issues.length, 1)
})

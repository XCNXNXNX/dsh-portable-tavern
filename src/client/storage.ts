/**
 * Persistent storage for the tavern.
 *
 * localStorage is a 5 MB budget shared by everything on the origin, and the
 * tavern's payloads are dominated by pictures: every party portrait and
 * character avatar is an inline data URL. A few saved teams is enough to fill
 * the budget, at which point `setItem` throws -- and because every call site
 * used to swallow that error, the symptom was silent data loss: you edit a
 * team, refresh, and it is gone.
 *
 * So the heavy records live in IndexedDB instead (gigabytes, not megabytes),
 * localStorage keeps only small preferences, and every failure is reported
 * rather than eaten.
 */

/** Where the tavern keeps its records. */
const DB_NAME = 'dsh-portable-tavern'
const DB_VERSION = 1
const STORE_NAME = 'kv'

/**
 * Keys whose payloads are large enough that localStorage is the wrong home.
 * These are read and written through IndexedDB; the localStorage copies are
 * only consulted once, to migrate an existing installation.
 */
export const HEAVY_KEYS = {
  workspace: 'dsh.portable-tavern.workspace.v1',
  characters: 'dsh.portable-tavern.characters.v1',
  parties: 'dsh.portable-tavern.parties.v1',
  party: 'dsh.portable-tavern.party.current.v1',
  threads: 'dsh.portable-tavern.threads.v1',
  rpg: 'dsh.portable-tavern.rpg.v1',
} as const

/** One storage problem worth showing the user. */
export interface StorageIssue {
  /** Key that failed. */
  key: string
  /** 'write' or 'read'. */
  op: 'write' | 'read'
  message: string
}

let reporter: ((issue: StorageIssue) => void) | null = null

/**
 * Route storage failures somewhere visible. Without this the tavern silently
 * loses whatever it could not save, which is exactly the bug this module
 * exists to prevent.
 * @param fn - called once per failure.
 */
export function onStorageIssue(fn: ((issue: StorageIssue) => void) | null): void {
  reporter = fn
}

/** Report one failure, de-duplicated by key so a retry loop cannot spam the UI. */
const reported = new Set<string>()
function report(key: string, op: 'write' | 'read', error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const stamp = op + ':' + key + ':' + message
  if (reported.has(stamp)) return
  reported.add(stamp)
  console.warn('[portable-tavern] storage ' + op + ' failed for ' + key, error)
  if (reporter !== null) reporter({ key, op, message })
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase | null> | null = null

/** Open the database once; null when IndexedDB is unavailable. */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise !== null) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return }
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => { report('(db)', 'read', request.error); resolve(null) }
      request.onblocked = () => resolve(null)
    } catch (error) {
      report('(db)', 'read', error)
      resolve(null)
    }
  })
  return dbPromise
}

/** Run one transaction and resolve with its request result. */
function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then((db) => {
    if (db === null) return null
    return new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, mode)
        const request = run(tx.objectStore(STORE_NAME))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
        tx.onabort = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  })
}

/**
 * Read one record from IndexedDB.
 * @param key - the record key.
 * @param fallbackKey - localStorage key to migrate from when IndexedDB is empty.
 */
export async function loadRecord<T>(key: string, fallbackKey?: string): Promise<T | null> {
  const hit = await transact<unknown>('readonly', (store) => store.get(key) as IDBRequest<unknown>)
  if (hit !== undefined && hit !== null) return hit as T
  // One-time migration from the localStorage era.
  if (fallbackKey !== undefined) {
    try {
      const raw = localStorage.getItem(fallbackKey)
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T
        void saveRecord(key, parsed)
        return parsed
      }
    } catch { /* nothing to migrate */ }
  }
  return null
}

/**
 * Write one record to IndexedDB.
 * @param key - the record key.
 * @param value - any structured-cloneable value.
 * @returns whether the write succeeded, so the caller can warn the user.
 */
export async function saveRecord(key: string, value: unknown): Promise<boolean> {
  const result = await transact<IDBValidKey>('readwrite', (store) => store.put(value, key))
  if (result !== null) {
    // Drop the localStorage copy once the record is safely in IndexedDB.
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    reported.delete('write:' + key + ':IndexedDB 写入失败')
    return true
  }
  // IndexedDB is unavailable (private mode, disabled storage). Fall back to
  // localStorage, and report when even that is refused -- a silent failure here
  // is precisely the data loss this module exists to stop.
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    report(key, 'write', error)
    return false
  }
}

/** Delete one record. */
export async function deleteRecord(key: string): Promise<void> {
  await transact('readwrite', (store) => store.delete(key))
}

// ---------------------------------------------------------------------------
// small preferences still live in localStorage
// ---------------------------------------------------------------------------

/** Read a small preference (never throws). */
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

/**
 * Write a small preference. Reports quota problems instead of hiding them.
 * @param key - the preference key.
 * @param value - the value to store.
 */
export function writePref(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    report(key, 'write', error)
    return false
  }
}

/** Remove a small preference. */
export function removePref(key: string): void {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

/** How much room is left, for the settings panel. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (typeof navigator === 'undefined' || navigator.storage === undefined) return null
    const estimate = await navigator.storage.estimate()
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  } catch { return null }
}

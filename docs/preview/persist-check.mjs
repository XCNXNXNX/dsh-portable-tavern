/**
 * Reproduce the "team is gone after a refresh" report end to end.
 *
 * Loads the preview harness twice against the SAME browser profile: the first
 * pass adds a member through the UI, the second pass reloads and reports what
 * the panel restored. IndexedDB lives in the profile, so this is a real
 * refresh, not a simulation.
 *
 * Usage: node docs/preview/persist-check.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))
if (browser === undefined) throw new Error('no Edge/Chrome found')

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

/** Probe lines the page reported, newest last. */
const probeLines = []
let waiters = []

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname === '/__probe') {
    probeLines.push(url.searchParams.get('line') ?? '')
    const pending = waiters
    waiters = []
    for (const done of pending) done()
    res.writeHead(204); res.end(); return
  }
  let path = decodeURIComponent(url.pathname)
  if (path === '/vendor/react.development.js') path = '/node_modules/react/umd/react.development.js'
  else if (path === '/vendor/react-dom.development.js') path = '/node_modules/react-dom/umd/react-dom.development.js'
  const target = resolve(root, normalize(path).replace(/^[/\\]+/, ''))
  if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404); res.end('not found'); return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream' })
  res.end(readFileSync(target))
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const port = server.address().port

const profile = join(tmpdir(), 'pt-persist-profile')
rmSync(profile, { recursive: true, force: true })
mkdirSync(profile, { recursive: true })

/** One headless pass; resolves with the line the page reported over HTTP. */
async function pass(phase) {
  const before = probeLines.length
  const url = 'http://127.0.0.1:' + port + '/docs/preview/preview.html?tab=party&test=persist&phase=' + phase
  const child = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--user-data-dir=' + profile,
    '--virtual-time-budget=12000', url,
  ], { detached: true, stdio: 'ignore' })
  child.unref()
  // Wait for the *result* line, not merely any line: the page also pings on
  // boot, and returning on that would report nothing useful.
  const deadline = Date.now() + 45_000
  for (;;) {
    const hit = probeLines.slice(before).filter((line) => /^(PHASE=|PREVIEW ERROR)/.test(line))
    if (hit.length > 0) return hit[hit.length - 1]
    if (Date.now() > deadline) break
    await new Promise((done) => setTimeout(done, 200))
  }
  const seen = probeLines.slice(before)
  return '(no result; page reported: ' + (seen.length === 0 ? 'nothing' : seen.join(' | ')) + ')'
}

console.log('pass 1 (add a member, then read back what was stored):')
const first = await pass('edit')
console.log('  ' + first)
// Let the first browser finish and release the profile lock.
await new Promise((done) => setTimeout(done, 4000))
console.log('pass 2 (fresh page load, same profile):')
const second = await pass('check')
console.log('  ' + second)

const stored = Number(/storedMembers=(\d+)/.exec(second)?.[1] ?? -1)
const shown = Number(/shownOnLoad=(\d+)/.exec(second)?.[1] ?? -1)
const firstStored = Number(/storedMembers=(\d+)/.exec(first)?.[1] ?? -1)
console.log('')
console.log(stored > 0 && stored === firstStored ? 'OK: the edit survived the reload' : 'FAIL: the edit did not survive')
console.log('restored into the panel: ' + (shown === stored ? 'yes' : 'NO (panel shows ' + shown + ', storage has ' + stored + ')'))
server.close()

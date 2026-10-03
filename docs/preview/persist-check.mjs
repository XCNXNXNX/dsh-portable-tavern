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
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
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

const profile = mkdtempSync(join(tmpdir(), 'pt-persist-profile-'))

/** One headless pass; resolves with the line the page reported over HTTP. */
async function pass(phase) {
  const before = probeLines.length
  const url = 'http://127.0.0.1:' + port + '/docs/preview/preview.html?tab=party&test=persist&phase=' + phase
  const child = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    // Keep Edge in the process we own, rather than its compatibility relauncher.
    '--edge-skip-compat-layer-relaunch',
    '--disable-extensions', '--user-data-dir=' + profile,
    // Real time: virtual time can advance timers before IndexedDB hydration.
    url,
  ], { windowsHide: true, stdio: 'ignore' })
  let exited = false
  let launchError = ''
  child.on('close', () => { exited = true })
  child.on('error', (error) => { launchError = error.message; exited = true })
  // Wait for the *result* line, not merely any line: the page also pings on
  // boot, and returning on that would report nothing useful.
  const deadline = Date.now() + 45_000
  let result
  for (;;) {
    const hit = probeLines.slice(before).filter((line) => /^(PHASE=|PREVIEW ERROR)/.test(line))
    if (hit.length > 0) { result = hit[hit.length - 1]; break }
    if (launchError !== '') { result = 'PREVIEW ERROR ' + launchError; break }
    if (Date.now() > deadline) break
    await new Promise((done) => setTimeout(done, 200))
  }
  if (!exited && child.pid !== undefined) {
    if (process.platform === 'win32') {
      await new Promise((done) => execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => done()))
    } else child.kill()
  }
  const exitDeadline = Date.now() + 3000
  while (!exited && Date.now() < exitDeadline) await new Promise((done) => setTimeout(done, 100))
  if (result !== undefined) return result
  const seen = probeLines.slice(before)
  return '(no result; page reported: ' + (seen.length === 0 ? 'nothing' : seen.join(' | ')) + ')'
}

try {
  console.log('pass 1 (add a member and save an unfinished workspace):')
  const first = await pass('edit')
  console.log('  ' + first)
  console.log('pass 2 (fresh page load, same profile):')
  const second = await pass('check')
  console.log('  ' + second)

  const stored = Number(/storedMembers=(\d+)/.exec(second)?.[1] ?? -1)
  const shown = Number(/shownOnLoad=(\d+)/.exec(second)?.[1] ?? -1)
  const firstStored = Number(/storedMembers=(\d+)/.exec(first)?.[1] ?? -1)
  const partyOk = /clickedAdd=true/.test(first) && stored > 0 && stored === firstStored && shown === stored
  const workspaceOk = /workspaceRestored=true/.test(second) && /shownDraft=true/.test(second)
  console.log(partyOk ? 'OK: the team edit survived and was restored into the panel' : 'FAIL: team persistence')
  console.log(workspaceOk ? 'OK: unfinished draft, V3, model, prompt, chat and worldbook survived' : 'FAIL: workspace persistence')
  if (!partyOk || !workspaceOk) process.exitCode = 1
} finally {
  server.close()
  // mkdtemp created this directory for this run; verify its parent before removal.
  if (dirname(profile) !== resolve(tmpdir())) throw new Error('unexpected test profile directory')
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) } catch (error) { console.warn('test profile cleanup failed:', error.message) }
}

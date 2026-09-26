/**
 * Static server + headless-Edge driver used to regenerate the README
 * screenshots from the real client bundle.
 *
 * Usage: node docs/preview/shots.mjs
 *
 * It serves the plugin directory plus the two React UMD builds on a loopback
 * port, then asks the installed Edge for one screenshot per tab. Nothing here
 * ships with the plugin; it exists so the effect images can be rebuilt whenever
 * the UI changes instead of going stale.
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const outDir = join(root, 'assets')
mkdirSync(outDir, { recursive: true })

const REACT = join(root, 'node_modules', 'react', 'umd', 'react.development.js')
const REACT_DOM = join(root, 'node_modules', 'react-dom', 'umd', 'react-dom.development.js')
for (const file of [REACT, REACT_DOM]) {
  if (!existsSync(file)) throw new Error('missing React UMD build: ' + file)
}

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]
const browser = EDGE_CANDIDATES.find((p) => existsSync(p))
if (browser === undefined) throw new Error('no Edge/Chrome found for headless screenshots')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

/**
 * The model list and the theme catalogue come from the live harness when it is
 * running, so the screenshots show real model names and the real bundled
 * themes. Falls back to an empty body when DSH is not up.
 */
async function proxyToDsh(path, res) {
  try {
    const upstream = await fetch('http://127.0.0.1:3080' + path, { headers: { 'user-agent': 'dsh-preview' } })
    const body = Buffer.from(await upstream.arrayBuffer())
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' })
    res.end(body)
  } catch {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(path.endsWith('/models') ? '{"options":[],"current":null}' : '{"installed":[],"builtin":[]}')
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  let path = decodeURIComponent(url.pathname)
  if (path.startsWith('/api/dsh-portable-tavern/')) { void proxyToDsh(path, res); return }
  if (path === '/vendor/react.development.js') path = '/node_modules/react/umd/react.development.js'
  else if (path === '/vendor/react-dom.development.js') path = '/node_modules/react-dom/umd/react-dom.development.js'
  else if (path === '/') path = '/docs/preview/preview.html'
  const target = resolve(root, normalize(path).replace(/^[/\\]+/, ''))
  if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream' })
  res.end(readFileSync(target))
})

/** Tabs worth a picture, with the window size that frames the panel. */
/**
 * The window is a little wider than the panel so the panel reads as a panel,
 * and the panel is configured the way the maintainer actually runs it: glass
 * theme, the Dcat wallpaper, and a widened panel.
 */
const PANEL_WIDTH = Number(process.env.PT_WIDTH || 760)
const THEME = process.env.PT_THEME || 'glass'

const SHOTS = [
  { name: 'chat', tab: 'chat', width: PANEL_WIDTH + 60, height: 1000 },
  { name: 'adventure', tab: 'rpg', width: PANEL_WIDTH + 60, height: 1120 },
  { name: 'party', tab: 'party', width: PANEL_WIDTH + 60, height: 1120 },
  { name: 'themes', tab: 'plugins', width: PANEL_WIDTH + 60, height: 1120 },
  { name: 'character', tab: 'character', width: PANEL_WIDTH + 60, height: 1000 },
]

await new Promise((done) => server.listen(0, '127.0.0.1', done))
const port = server.address().port
console.log('preview server on http://127.0.0.1:' + port)

/** Wait for a file to appear and stop growing, up to a deadline. */
async function waitForFile(path, timeoutMs, notOlderThan) {
  const deadline = Date.now() + timeoutMs
  let lastSize = -1
  while (Date.now() < deadline) {
    if (existsSync(path)) {
      const info = statSync(path)
      // Only a file this run actually wrote counts.
      if (info.mtimeMs >= notOlderThan) {
        if (info.size > 0 && info.size === lastSize) return info.size
        lastSize = info.size
      }
    }
    await new Promise((done) => setTimeout(done, 150))
  }
  return 0
}

for (const shot of SHOTS) {
  const out = join(outDir, shot.name + '.png')
  // A stale file from a previous run would satisfy the wait below instantly.
  rmSync(out, { force: true })
  const startedAt = Date.now()
  const profile = join(tmpdir(), 'pt-shot-' + shot.name + '-' + process.pid)
  const url = 'http://127.0.0.1:' + port + '/docs/preview/preview.html?tab=' + shot.tab
    + '&theme=' + THEME + '&width=' + PANEL_WIDTH
  // Edge's launcher hands off to a child process and returns immediately, so
  // neither the exit code nor a synchronous wait says anything. Spawn it
  // detached and wait for the file this run actually wrote.
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--user-data-dir=' + profile,
    '--force-device-scale-factor=2',
    '--window-size=' + shot.width + ',' + shot.height,
    '--virtual-time-budget=6000',
    '--screenshot=' + out,
    url,
  ], { detached: true, stdio: 'ignore' })
  child.unref()
  const size = await waitForFile(out, 90_000, startedAt)
  if (size === 0) throw new Error('screenshot was not produced: ' + shot.name)
  console.log('  wrote assets/' + shot.name + '.png (' + Math.round(size / 1024) + ' KB)')
}

server.close()
console.log('done')

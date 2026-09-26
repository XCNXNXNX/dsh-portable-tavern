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
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const outDir = join(root, 'screenshots')
mkdirSync(outDir, { recursive: true })

/** Page gutter left of the right-docked panel, in CSS pixels. */
const GUTTER = 60

/**
 * Trim the page gutter off a capture so the image is the panel and nothing
 * else. Done through System.Drawing because Node has no image library, and
 * losslessly, because a re-encode is exactly what makes these look mushy.
 * @param file - png to crop in place.
 * @param leftDevicePx - pixels to remove from the left at the capture scale.
 */
function cropToPanel(file, leftDevicePx) {
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    '$src = [System.Drawing.Image]::FromFile(' + JSON.stringify(file) + ')',
    '$w = $src.Width - ' + String(leftDevicePx),
    '$rect = New-Object System.Drawing.Rectangle(' + String(leftDevicePx) + ', 0, $w, $src.Height)',
    '$bmp = New-Object System.Drawing.Bitmap($w, $src.Height)',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $w, $src.Height)), $rect, [System.Drawing.GraphicsUnit]::Pixel)',
    '$g.Dispose(); $bmp.Dispose(); $src.Dispose()',
    // Image.FromFile keeps the source locked, so write beside it and swap.
    '$bmp.Save(' + JSON.stringify(file + '.crop.png') + ', [System.Drawing.Imaging.ImageFormat]::Png)',
    'Move-Item -LiteralPath ' + JSON.stringify(file + '.crop.png') + ' -Destination ' + JSON.stringify(file) + ' -Force',
  ].join('; ')
  try {
    execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'pipe' })
  } catch (error) {
    // A failed crop must be loud: silently shipping an uncropped frame is how
    // the previous run looked fine and was wrong.
    throw new Error('crop failed for ' + file + ': ' + (error instanceof Error ? error.message : String(error)))
  }
}

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
  // Both the API and the extension carrier live on the running harness; the
  // theme stylesheet is served from /tavern-ext/<id>/theme.css, so without this
  // the preview silently renders the unthemed panel.
  if (path.startsWith('/api/dsh-portable-tavern/') || path.startsWith('/tavern-ext/')) {
    void proxyToDsh(path, res)
    return
  }
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

/**
 * The window is a little wider than the panel so the panel reads as a panel,
 * and the panel is configured the way the maintainer actually runs it: the
 * glass theme, their own wallpaper, and a widened panel.
 */
const PANEL_WIDTH = Number(process.env.PT_WIDTH || 760)
const THEME = process.env.PT_THEME || 'glass'

/**
 * The panel is capped at 94vw, so the window is sized to make the panel come
 * out exactly PANEL_WIDTH -- that leaves no page gutter, and the image is the
 * panel rather than a screenshot with a border.
 */
const WINDOW_WIDTH = PANEL_WIDTH + 60

const SHOTS = [
  { name: 'chat', tab: 'chat', width: WINDOW_WIDTH, height: 1000 },
  { name: 'adventure', tab: 'rpg', width: WINDOW_WIDTH, height: 1120 },
  { name: 'party', tab: 'party', width: WINDOW_WIDTH, height: 1120 },
  { name: 'themes', tab: 'plugins', width: WINDOW_WIDTH, height: 1120 },
  { name: 'character', tab: 'character', width: WINDOW_WIDTH, height: 1000 },
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

/**
 * Ask headless Edge for one screenshot and return immediately.
 *
 * Edge's launcher hands off to a child process and returns at once, so neither
 * its exit code nor a synchronous wait says anything useful.
 * @param shot - the shot descriptor (name and window size).
 * @param out - destination png path.
 * @param url - the page to capture.
 * @param tag - distinguishes retry profiles.
 */
function shoot(shot, out, url, tag) {
  const profile = join(tmpdir(), 'pt-shot-' + shot.name + '-' + tag + '-' + process.pid)
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
    // Generous: the harness fetches its fixtures before it boots, and a budget
    // that expires early yields a blank page rather than a partial one.
    '--virtual-time-budget=30000',
    // Virtual time can tear the capture mid-composite: the longest tab came out
    // with half its tab bar and a slab of unpainted panel. This makes the
    // screenshot wait for every compositor stage instead of whatever was ready.
    '--run-all-compositor-stages-before-draw',
    '--disable-new-content-rendering-timeout',
    '--disable-features=PaintHolding,CalculateNativeWinOcclusion',
    '--screenshot=' + out,
    url,
  ], { detached: true, stdio: 'ignore' })
  child.unref()
}

for (const shot of SHOTS) {
  const out = join(outDir, shot.name + '.png')
  // A stale file from a previous run would satisfy the wait below instantly.
  rmSync(out, { force: true })
  const startedAt = Date.now()
  const url = 'http://127.0.0.1:' + port + '/docs/preview/preview.html?tab=' + shot.tab
    + '&theme=' + THEME + '&width=' + PANEL_WIDTH
  shoot(shot, out, url, 'a')
  let size = await waitForFile(out, 90_000, startedAt)
  // A blank capture (the page never booted) compresses to almost nothing; take
  // it again rather than shipping an empty picture.
  for (let attempt = 0; attempt < 3 && size > 0 && size < 40 * 1024; attempt++) {
    console.log('  retry ' + shot.name + ' (previous capture was blank)')
    rmSync(out, { force: true })
    shoot(shot, out, url, String(attempt + 1))
    size = await waitForFile(out, 90_000, Date.now())
  }
  if (size === 0) throw new Error('screenshot was not produced: ' + shot.name)
  if (size < 40 * 1024) throw new Error('screenshot came out blank: ' + shot.name)
  console.log('  wrote screenshots/' + shot.name + '.png ('
    + Math.round(statSync(out).size / 1024) + ' KB)')
}

server.close()
console.log('done')

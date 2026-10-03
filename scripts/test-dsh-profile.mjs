/** Real official-CLI and browser smoke test in a disposable web Profile.
 * Usage: node scripts/test-dsh-profile.mjs /path/to/dsh/lib/bin.js /path/to/plugin.tgz
 * Requires Edge/Chrome (or DSH_TEST_BROWSER), Node 22.18+/24.2+ and no API credentials.
 */
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
if (!process.argv[2] || !process.argv[3]) throw new Error('Pass an official DSH CLI and a packed plugin archive')
const cli = resolve(process.argv[2])
const archive = resolve(process.argv[3])
assert.ok(existsSync(cli), 'official DSH CLI does not exist')
assert.ok(existsSync(archive), 'pack the plugin before passing its archive')
const browser = [process.env.DSH_TEST_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(path => path && existsSync(path))
assert.ok(browser, 'Edge/Chrome is required for the real frontend check')
const root = await mkdtemp(join(tmpdir(), 'tavern-dsh-profile-'))
const env = Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => !/(TOKEN|SECRET|PASSWORD|API_KEY|AUTH|CREDENTIAL)/i.test(key)))
Object.assign(env, {
  DSH_HOME: join(root, 'home'), DSH_AGENTS_HOME: join(root, 'agents'),
  DSH_TELEMETRY_DISABLED: '1', npm_config_cache: join(root, 'npm-cache'),
  npm_config_userconfig: join(root, '.npmrc'), npm_config_registry: 'https://registry.npmjs.org/', CI: 'true',
})
let host, chromium, socket
let stage = 'prepare'
let hostLog = ''
let browserErrors = []
const pause = ms => new Promise(done => setTimeout(done, ms))
async function run(args) {
  const { stdout } = await exec(process.execPath, [cli, ...args], {
    cwd: root, env, windowsHide: true, timeout: 180_000, maxBuffer: 6 * 1024 * 1024,
  })
  return stdout
}
async function unusedPort() {
  const server = createServer()
  await new Promise((done, reject) => server.once('error', reject).listen(0, '127.0.0.1', done))
  const port = server.address().port
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done()))
  return port
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  let timer
  const closed = new Promise(done => {
    child.once('close', () => { clearTimeout(timer); done() })
    timer = setTimeout(done, 10_000)
  })
  if (process.platform === 'win32') {
    await exec('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => {})
  } else child.kill('SIGTERM')
  await closed
  clearTimeout(timer)
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
}
function safeMessage(value) {
  return String(value).replace(/https?:\/\/[^\s"']+/g, '[url]').replace(/(token|key|secret|password)[=:][^\s,]+/gi, '$1=[redacted]').slice(0, 400)
}

try {
  await mkdir(env.DSH_HOME, { recursive: true })
  await writeFile(env.npm_config_userconfig, '', { mode: 0o600 })
  const dshVersion = (await run(['--version'])).trim()
  assert.match(dshVersion, /^\d+\.\d+\.\d+/, 'official DSH CLI must dispatch and print its version (Node import.meta.main is required)')
  stage = 'baseline-profile'
  const baseline = await run(['--profile', 'web', '--dump-config'])
  stage = 'install'
  await run(['plugin', '--profile', 'web', 'add', '--ignore-scripts', '--config.auto-install-peers=false', `file:${archive}`])
  const installed = await run(['--profile', 'web', '--dump-config'])
  assert.ok(installed.includes('portable-tavern'), 'installed Profile must contain the plugin row')
  stage = 'cold-start'
  host = spawn(process.execPath, [cli, 'web', '--no-open', '--port', String(await unusedPort())], {
    cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const launchUrl = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('host-startup-timeout')), 90_000)
    const append = chunk => {
      hostLog = (hostLog + chunk.toString()).slice(-131_072)
      const match = /dsh web: (http:\/\/[^\s]+)/.exec(hostLog)
      if (match) { clearTimeout(timer); done(match[1]) }
    }
    host.stdout.on('data', append); host.stderr.on('data', append)
    host.once('error', () => { clearTimeout(timer); reject(new Error('host-spawn-failed')) })
    host.once('exit', code => { clearTimeout(timer); reject(new Error(`host-exited-${code}`)) })
  })
  stage = 'authenticated-http'
  const login = await fetch(launchUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
  assert.ok([302, 303].includes(login.status), 'launch token must exchange for a session')
  const cookies = login.headers.getSetCookie().map(value => value.split(';')[0])
  assert.ok(cookies.length, 'host must issue an authentication cookie')
  const base = new URL(launchUrl).origin
  const get = path => fetch(base + path, { headers: { cookie: cookies.join('; ') }, signal: AbortSignal.timeout(10_000) })
  assert.equal((await get('/')).status, 200, 'official UI must be served')
  for (const path of ['/api/dsh-portable-tavern/models', '/api/dsh-portable-tavern/ext/catalog']) {
    const response = await get(path)
    assert.equal(response.status, 200, `${path} must be registered`)
    await response.json()
  }
  stage = 'browser-boot'
  const debugPort = await unusedPort()
  chromium = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--edge-skip-compat-layer-relaunch', '--disable-extensions',
    '--user-data-dir=' + join(root, 'browser'), '--remote-debugging-port=' + debugPort, 'about:blank',
  ], { env, windowsHide: true, stdio: 'ignore' })
  chromium.on('error', () => {})
  let target
  for (let i = 0; i < 100 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(tab => tab.type === 'page') } catch {}
    if (!target) await pause(100)
  }
  assert.ok(target, 'browser debugging endpoint must start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let id = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) pending.get(message.id)?.(message)
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(safeMessage(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text))
  })
  async function cdp(method, params = {}) {
    const requestId = ++id
    return new Promise((done, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('browser-command-timeout')) }, 10_000)
      pending.set(requestId, message => {
        clearTimeout(timer); pending.delete(requestId)
        if (message.error) reject(new Error(safeMessage(message.error.message)))
        else done(message.result)
      })
      socket.send(JSON.stringify({ id: requestId, method, params }))
    })
  }
  await cdp('Runtime.enable'); await cdp('Network.enable')
  for (const cookie of cookies) {
    const split = cookie.indexOf('=')
    await cdp('Network.setCookie', { name: cookie.slice(0, split), value: cookie.slice(split + 1), url: base, httpOnly: true })
  }
  await cdp('Page.navigate', { url: base })
  stage = 'browser-tavern'
  let visible = false
  for (let i = 0; i < 150; i++) {
    const result = await cdp('Runtime.evaluate', { expression: "!!document.querySelector('.stTrigger')", returnByValue: true })
    if (result.result.value) { visible = true; break }
    await pause(200)
  }
  assert.equal(visible, true, 'portable tavern launcher must render in the official DSH UI')
  const opened = await cdp('Runtime.evaluate', {
    expression: "document.querySelector('.stTrigger').click(); true", returnByValue: true,
  })
  assert.equal(opened.result.value, true)
  await pause(500)
  const panel = await cdp('Runtime.evaluate', { expression: "!!document.querySelector('.stPanel')", returnByValue: true })
  assert.equal(panel.result.value, true, 'clicking the launcher must open the tavern')
  assert.deepEqual(browserErrors, [], 'frontend must boot without uncaught JavaScript errors')
  stage = 'stop'
  socket.close(); socket = null
  await stop(chromium); chromium = null
  await stop(host); host = null
  stage = 'uninstall'
  await run(['plugin', '--profile', 'web', 'remove', 'dsh-portable-tavern'])
  const removed = await run(['--profile', 'web', '--dump-config'])
  assert.equal(removed, baseline, 'uninstall must restore the exact original Profile composition')
  console.log(JSON.stringify({ status: 'passed', dshVersion, node: process.version, install: true, coldStart: true, authenticatedHttp: true, browserLauncher: true, browserPanel: true, uninstall: true, profileRestored: true, disposableProfile: true }))
} catch (error) {
  const diagnostics = hostLog.split(/\r?\n/).filter(line => /portable-tavern|client-runtime|\berror\b/i.test(line)).map(safeMessage).slice(-8)
  console.error(JSON.stringify({ status: 'failed', stage, reason: safeMessage(error.message), browserErrors, diagnostics }))
  process.exitCode = 1
} finally {
  socket?.close()
  await stop(chromium); await stop(host)
  // root is exclusively created by this process, beneath the OS temporary directory.
  await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
}

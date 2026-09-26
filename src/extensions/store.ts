/**
 * Host-side SillyTavern extension store.
 *
 * A SillyTavern extension is a directory with a manifest.json plus a JS entry,
 * an optional stylesheet and optional templates. This module installs such a
 * package (from GitHub, a manifest URL, a host directory or an uploaded zip),
 * rewrites the imports that only make sense inside SillyTavern itself, and
 * serves the files back to the browser half under /tavern-ext/<id>/.
 *
 * Why the rewrite matters: community extensions routinely reach into the
 * SillyTavern source tree ("../../../RossAscends-mods.js", "../../script.js").
 * Those modules do not exist here. Rather than let the browser fail the import
 * and kill the whole extension, install records exactly which symbols each
 * escaped import wanted and writes a per-extension stub module exporting them,
 * so the extension links and then degrades at the call site instead of at load.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import type { StExtension, StManifest } from '../protocol.ts'
import { BUILTIN_THEMES } from './builtin.ts'

// ---------------------------------------------------------------------------
// locations
// ---------------------------------------------------------------------------

/** Root that holds every installed extension. */
export function extensionsRoot(): string {
  const home = process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, 'portable-tavern', 'extensions')
}

/** Directory of one installed extension. */
export function extensionDir(id: string): string {
  return join(extensionsRoot(), safeId(id))
}

/** Make an id safe to use as a single directory name. */
export function safeId(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return cleaned === '' ? 'extension' : cleaned
}

// ---------------------------------------------------------------------------
// minimal zip reader (GitHub zipballs and uploaded packages)
// ---------------------------------------------------------------------------

/** One extracted archive member. */
interface ZipEntry { name: string; data: Buffer }

/**
 * Read a zip archive. Supports stored (0) and deflate (8) members, which is
 * everything GitHub's zipball writer and every desktop zip tool produce.
 * @param buffer - the whole archive.
 */
export function unzip(buffer: Buffer): ZipEntry[] {
  const eocd = findEocd(buffer)
  if (eocd < 0) throw new Error('不是有效的 zip 文件（未找到中央目录）')
  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  const entries: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) continue
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const raw = buffer.subarray(dataStart, dataStart + compressedSize)
    try {
      entries.push({ name, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) })
    } catch { /* skip unreadable member */ }
  }
  return entries
}

/** Locate the end-of-central-directory record. */
function findEocd(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 66000)
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}

/** Strip the single wrapper directory GitHub zipballs add. */
function stripWrapper(entries: ZipEntry[]): ZipEntry[] {
  if (entries.length === 0) return entries
  const first = entries[0].name
  const slash = first.indexOf('/')
  if (slash < 0) return entries
  const prefix = first.slice(0, slash + 1)
  if (!entries.every((e) => e.name.startsWith(prefix))) return entries
  return entries.map((e) => ({ name: e.name.slice(prefix.length), data: e.data }))
}

// ---------------------------------------------------------------------------
// import rewriting
// ---------------------------------------------------------------------------

/** One import specifier an extension used that ST provides but we do not. */
interface Escape { specifier: string; names: string[] }

/** Parse the binding clause of an import statement into exported names. */
function bindingsOf(clause: string): { names: string[]; hasDefault: boolean } {
  const names: string[] = []
  let hasDefault = false
  const trimmed = clause.trim()
  if (trimmed === '') return { names, hasDefault }
  const braces = /\{([^}]*)\}/.exec(trimmed)
  if (braces) {
    for (const part of braces[1].split(',')) {
      const piece = part.trim()
      if (piece === '') continue
      const aliased = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(piece)
      names.push(aliased ? aliased[2] : piece)
    }
  }
  const star = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(trimmed)
  if (star) names.push(star[1])
  const head = trimmed.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, '').replace(/,/g, '').trim()
  if (head !== '' && /^[A-Za-z_$][\w$]*$/.test(head)) hasDefault = true
  return { names, hasDefault }
}

/** True when a relative specifier climbs out of the extension directory. */
function escapesRoot(specifier: string, depth: number): boolean {
  if (!specifier.startsWith('.')) return false
  const parts = specifier.split('/')
  let up = 0
  for (const part of parts) {
    if (part === '..') up++
    else break
  }
  return up > depth
}

/**
 * Tokenize every string literal so import scanning never looks inside comments,
 * strings or templates. A community extension with "import ... from <quoted>"
 * in a comment previously produced a bogus escape with a code fragment as its
 * "specifier"; masking makes that impossible.
 * @param source - the raw file text.
 * @returns the masked text plus the literal table.
 */
function tokenizeLiterals(source: string): { masked: string; literals: { raw: string; content: string }[] } {
  const literals: { raw: string; content: string }[] = []
  let masked = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const ch = source[i]
    const next = i + 1 < n ? source[i + 1] : ''
    // line comment
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') { masked += ' '; i++ }
      continue
    }
    // block comment
    if (ch === '/' && next === '*') {
      masked += '  '
      i += 2
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) { masked += source[i] === '\n' ? '\n' : ' '; i++ }
      if (i < n) { masked += '  '; i += 2 }
      continue
    }
    // string / template literal
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      let raw = ch
      let content = ''
      i++
      while (i < n) {
        const c = source[i]
        if (c === '\\') {
          raw += c
          if (i + 1 < n) { raw += source[i + 1]; content += source[i + 1] }
          i += 2
          continue
        }
        if (c === quote) break
        raw += c
        content += c
        i++
      }
      if (i < n) { raw += quote; i++ }
      masked += '\u0000' + literals.length + '\u0000'
      literals.push({ raw, content })
      continue
    }
    masked += ch
    i++
  }
  return { masked, literals }
}

/** Rebuild the file body, substituting every literal token with its current text. */
function rebuildLiterals(masked: string, literals: { raw: string }[]): string {
  return masked.replace(/\u0000(\d+)\u0000/g, (_whole, digits: string) => literals[Number(digits)].raw)
}

/** One module reference found in a source file. */
interface ModuleRef {
  specifier: string
  clause: string
  /** Token text of the literal, used to rewrite it in place. */
  token: string
}

/**
 * Collect every module specifier a source file actually uses: static imports,
 * re-exports, side-effect imports and dynamic import() calls.
 * @param masked - literal-masked source text.
 * @param literals - the literal table produced alongside the mask.
 */
function specifiersOf(masked: string, literals: { content: string }[]): ModuleRef[] {
  const found: ModuleRef[] = []
  const take = (indexText: string): { specifier: string; token: string } => ({
    specifier: literals[Number(indexText)]?.content ?? '',
    token: '\u0000' + indexText + '\u0000',
  })
  const patterns: { re: RegExp; kind: 'from' | 'bare' }[] = [
    { re: /(?:^|[^\w$.])import\s+([^;]*?)\s+from\s*\u0000(\d+)\u0000/g, kind: 'from' },
    { re: /(?:^|[^\w$.])export\s+([^;]*?)\s+from\s*\u0000(\d+)\u0000/g, kind: 'from' },
    { re: /(?:^|[^\w$.])import\s*\u0000(\d+)\u0000/g, kind: 'bare' },
    { re: /(?:^|[^\w$.])import\s*\(\s*\u0000(\d+)\u0000\s*\)/g, kind: 'bare' },
  ]
  for (const { re, kind } of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(masked)) !== null) {
      if (kind === 'bare') {
        const hit = take(m[1])
        if (hit.specifier !== '') found.push({ ...hit, clause: '' })
      } else {
        const hit = take(m[2])
        if (hit.specifier !== '') found.push({ ...hit, clause: m[1] })
      }
    }
  }
  return found
}

/**
 * Names the browser compatibility host publishes on window.__tavernSt. When a
 * community extension imports one of these from a SillyTavern internal module,
 * the generated stub hands it the *real* implementation rather than a no-op --
 * the difference between an extension that merely loads and one that works.
 */
const HOST_PROVIDED = new Set([
  'eventSource', 'event_types', 'eventTypes', 'extension_settings', 'power_user',
  'saveSettingsDebounced', 'saveMetadataDebounced', 'getRequestHeaders', 'renderTemplateAsync',
  'renderExtensionTemplateAsync', 'substituteParams', 'substituteParamsExtended', 'chat_metadata',
  'chatMetadata', 'isMobile', 'DOMPurify', 'Bowser', 'accountStorage', 'SlashCommandParser',
  'SlashCommand', 'ARGUMENT_TYPE', 'executeSlashCommands', 'callGenericPopup', 'Popup',
  'POPUP_TYPE', 'POPUP_RESULT', 'toastr', 'getContext', 'characters', 'this_chid', 'name1', 'name2',
  'main_api', 'onlineStatus', 'getSlideToggleOptions', 'initMovingUI', 'favsToHotswap',
])

/** Literal defaults for host names whose type is not a function. */
const STUB_FALLBACKS: Record<string, string> = {
  event_types: '{}',
  eventTypes: '{}',
  extension_settings: '{}',
  power_user: '{}',
  chat_metadata: '{}',
  chatMetadata: '{}',
  characters: '[]',
  this_chid: 'undefined',
  name1: '"You"',
  name2: '""',
  main_api: '"dsh"',
  onlineStatus: '"online"',
  isMobile: 'false',
  POPUP_TYPE: '{}',
  POPUP_RESULT: '{}',
  ARGUMENT_TYPE: '{}',
}

/** The generated stub module for one escaped import. */
function stubModule(names: string[], label: string): string {
  const lines: string[] = []
  lines.push('/* Auto-generated by dsh-portable-tavern: the SillyTavern module ' + JSON.stringify(label) + ' has no counterpart here. */')
  lines.push('const host = (typeof window !== "undefined" && window.__tavernSt) || {}')
  lines.push('const noop = function () { return undefined }')
  lines.push('const missing = function () {')
  lines.push('  if (!missing.warned) { missing.warned = true; console.warn(' + JSON.stringify('[便携酒馆] 扩展依赖的酒馆内部模块 ' + label + ' 在本宿主中不存在，已用空实现替代。') + ') }')
  lines.push('  return undefined')
  lines.push('}')
  lines.push('export const __stubLabel = ' + JSON.stringify(label))
  const seen = new Set<string>(['__stubLabel', 'host', 'noop', 'missing'])
  for (const raw of names) {
    const name = String(raw || '').trim()
    if (!/^[A-Za-z_$][\w$]*$/.test(name) || seen.has(name)) continue
    seen.add(name)
    const fallback = STUB_FALLBACKS[name] ?? 'noop'
    if (HOST_PROVIDED.has(name)) {
      lines.push('export const ' + name + ' = (host.' + name + ' !== undefined ? host.' + name + ' : ' + fallback + ')')
    } else {
      lines.push('export const ' + name + ' = ' + fallback)
    }
  }
  lines.push('const stub = new Proxy({}, { get: function (_t, key) { return key === Symbol.toPrimitive ? function (v) { return v } : noop } })')
  lines.push('export default stub')
  lines.push('export { missing, host }')
  return lines.join('\n')
}

/**
 * Rewrite one JS source so escaping imports point at generated stubs.
 * @param source - original file text.
 * @param depth - how many directories deep the file sits in the extension.
 * @param extId - the extension id, used to build absolute stub URLs.
 * @param escapes - collected escape records (mutated).
 * @param stubs - collected stub modules by file name (mutated).
 */
function rewriteSource(
  source: string,
  depth: number,
  extId: string,
  escapes: Escape[],
  stubs: Map<string, string>,
): string {
  const { masked, literals } = tokenizeLiterals(source)
  let body = masked
  const seen = new Map<string, string>()
  for (const { specifier, clause, token } of specifiersOf(masked, literals)) {
    if (specifier.startsWith('http:') || specifier.startsWith('https:') || specifier.startsWith('data:')) continue
    const bare = !specifier.startsWith('.') && !specifier.startsWith('/')
    const climbs = escapesRoot(specifier, depth)
    if (!bare && !climbs) continue
    let file = seen.get(specifier)
    if (file === undefined) {
      const { names } = bindingsOf(clause)
      const index = escapes.length + 1
      file = '__tavern_stub_' + index + '.js'
      seen.set(specifier, file)
      escapes.push({ specifier, names })
      stubs.set(file, stubModule(names, specifier))
    }
    // Swap the literal behind this exact token, so an identical string
    // elsewhere in the file is never touched.
    const replacement = "'" + '/tavern-ext/' + extId + '/' + file + "'"
    const newIndex = literals.length
    literals.push({ raw: replacement, content: replacement })
    body = body.split(token).join('\u0000' + newIndex + '\u0000')
  }
  return rebuildLiterals(body, literals)
}

// ---------------------------------------------------------------------------
// install
// ---------------------------------------------------------------------------

/** Non-fatal notes produced while installing. */
export interface InstallReport {
  warnings: string[]
  stubs: string[]
}

/**
 * Write one entry tree to disk. Archive member names are untrusted: absolute
 * paths, drive letters and any '..' segment are dropped rather than resolved.
 * @param root - the extension directory.
 * @param entries - members to write.
 */
function writeEntries(root: string, entries: { name: string; data: Buffer }[]): void {
  for (const entry of entries) {
    const name = String(entry.name ?? '').replace(/\\/g, '/')
    if (name === '' || name.startsWith('/') || /^[A-Za-z]:/.test(name)) continue
    if (name.split('/').some((segment) => segment === '..' || segment === '')) continue
    const target = join(root, name)
    const rel = relative(root, target)
    if (rel === '' || rel.startsWith('..') || normalize(rel).startsWith('..')) continue
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, entry.data)
  }
}

/** Read a host directory into memory, skipping VCS metadata and huge files. */
function readDirEntries(root: string): { name: string; data: Buffer }[] {
  const out: { name: string; data: Buffer }[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === '.git' || name === 'node_modules') continue
      const full = join(dir, name)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walk(full)
        continue
      }
      if (!stat.isFile() || stat.size >= 8 * 1024 * 1024) continue
      out.push({ name: relative(root, full).split(sep).join('/'), data: readFileSync(full) })
    }
  }
  walk(root)
  return out
}

/** Find the manifest.json that identifies the package root. */
function locateRoot(entries: { name: string }[]): string {
  const candidates = entries
    .filter((e) => e.name === 'manifest.json' || e.name.endsWith('/manifest.json'))
    .map((e) => (e.name === 'manifest.json' ? '' : e.name.slice(0, -'manifest.json'.length)))
    .sort((a, b) => a.length - b.length)
  return candidates.length > 0 ? candidates[0] : ''
}

/** Derive a readable extension id from a source label. */
function idFromLabel(label: string): string {
  const tail = label.replace(/\/+$/, '').split('/').pop() ?? 'extension'
  return safeId(tail.replace(/\.git$/, '').replace(/^SillyTavern-/, ''))
}

/** Download a URL into a Buffer, failing readably. */
async function download(url: string): Promise<Buffer> {
  let response: Response
  try {
    response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'dsh-portable-tavern' } })
  } catch (error) {
    throw new Error('下载失败（网络不可达）：' + (error instanceof Error ? error.message : String(error)))
  }
  if (!response.ok) throw new Error('下载失败：HTTP ' + response.status + ' ' + url)
  return Buffer.from(await response.arrayBuffer())
}

/** Expand a GitHub repo reference into a zipball URL. */
function githubZipball(url: string): string | null {
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/#?]+))?\/?$/.exec(url.trim())
  if (!m) return null
  const ref = m[3] ?? 'HEAD'
  return 'https://codeload.github.com/' + m[1] + '/' + m[2] + '/zip/' + ref
}

/**
 * Install one extension into the store.
 * @param request - where the package comes from.
 * @returns the installed record plus install-time notes.
 */
export async function installExtension(request: {
  url?: string
  zipBase64?: string
  id?: string
  overwrite?: boolean
}): Promise<{ extension: StExtension; report: InstallReport }> {
  const warnings: string[] = []
  let entries: { name: string; data: Buffer }[] = []
  let label = ''
  let source = ''

  if (typeof request.zipBase64 === 'string' && request.zipBase64 !== '') {
    const buffer = Buffer.from(request.zipBase64, 'base64')
    entries = stripWrapper(unzip(buffer))
    label = request.id ?? 'uploaded'
    source = '本地上传（zip）'
  } else if (typeof request.url === 'string' && request.url.trim() !== '') {
    const url = request.url.trim()
    label = idFromLabel(url)
    if (existsSync(url) && statSync(url).isDirectory()) {
      entries = readDirEntries(url)
      source = '本机目录 ' + url
    } else if (/\.json(\?|$)/i.test(url)) {
      const manifestBuffer = await download(url)
      const manifest = JSON.parse(manifestBuffer.toString('utf8')) as StManifest
      entries.push({ name: 'manifest.json', data: manifestBuffer })
      const base = url.slice(0, url.lastIndexOf('/') + 1)
      const wanted: string[] = []
      if (typeof manifest.js === 'string') wanted.push(manifest.js)
      if (typeof manifest.css === 'string') wanted.push(manifest.css)
      for (const value of Object.values(manifest.i18n ?? {})) if (typeof value === 'string') wanted.push(value)
      for (const rel of wanted) {
        try {
          entries.push({ name: rel.replace(/^\.\//, ''), data: await download(base + rel.replace(/^\.\//, '')) })
        } catch {
          warnings.push('清单声明的文件下载失败：' + rel)
        }
      }
      source = '清单地址 ' + url
    } else {
      const zip = githubZipball(url)
      if (zip === null) throw new Error('无法识别的地址：请填 GitHub 仓库地址、manifest.json 直链、本机目录路径，或上传 zip')
      entries = stripWrapper(unzip(await download(zip)))
      source = 'GitHub ' + url
    }
  } else {
    throw new Error('未提供安装来源')
  }

  if (entries.length === 0) throw new Error('包内没有任何文件')

  const root = locateRoot(entries)
  const scoped = root === '' ? entries : entries.map((e) => ({ name: e.name.slice(root.length), data: e.data }))
  const manifestEntry = scoped.find((e) => e.name === 'manifest.json')
  if (manifestEntry === undefined) warnings.push('包内没有 manifest.json，将按约定猜测入口文件')
  let manifest: StManifest = {}
  if (manifestEntry !== undefined) {
    try {
      manifest = JSON.parse(manifestEntry.data.toString('utf8')) as StManifest
    } catch {
      warnings.push('manifest.json 不是合法 JSON，已忽略')
    }
  }

  const id = safeId(request.id ?? manifest.display_name ?? label)
  const dir = extensionDir(id)
  if (existsSync(dir)) {
    if (request.overwrite !== true) throw new Error('同名扩展已存在：' + id + '（勾选覆盖可重装）')
    rmSync(dir, { recursive: true, force: true })
  }
  mkdirSync(dir, { recursive: true })
  writeEntries(dir, scoped)

  // Entry point: manifest first, then the usual file names.
  let js = typeof manifest.js === 'string' ? manifest.js.replace(/^\.\//, '') : ''
  if (js === '' || !existsSync(join(dir, js))) {
    const guess = ['index.js', 'main.js', 'script.js'].find((name) => existsSync(join(dir, name)))
    if (guess !== undefined) {
      if (js !== '') warnings.push('清单声明的入口 ' + js + ' 不存在，已改用 ' + guess)
      js = guess
    } else {
      js = ''
      warnings.push('未找到 JS 入口，该扩展将仅加载样式')
    }
  }
  let css = typeof manifest.css === 'string' ? manifest.css.replace(/^\.\//, '') : ''
  if (css !== '' && !existsSync(join(dir, css))) {
    warnings.push('清单声明的样式 ' + css + ' 不存在，已忽略')
    css = ''
  }
  if (css === '') {
    const guess = ['style.css', 'styles.css'].find((name) => existsSync(join(dir, name)))
    if (guess !== undefined) css = guess
  }

  // Import rewrite pass over every JS file.
  const escapes: Escape[] = []
  const stubs = new Map<string, string>()
  const walkJs = (current: string): void => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) {
        if (name === '.git' || name === 'node_modules') continue
        walkJs(full)
        continue
      }
      if (extname(name) !== '.js' && extname(name) !== '.mjs') continue
      if (name.startsWith('__tavern_stub_')) continue
      const rel = relative(dir, full).split(sep).join('/')
      const depth = rel.split('/').length - 1
      const text = readFileSync(full, 'utf8')
      const next = rewriteSource(text, depth, id, escapes, stubs)
      if (next !== text) writeFileSync(full, next)
    }
  }
  walkJs(dir)
  for (const [file, body] of stubs) writeFileSync(join(dir, file), body)

  writeFileSync(join(dir, '.tavern-source.json'), JSON.stringify({
    source,
    installedAt: Date.now(),
    escapes: escapes.map((e) => e.specifier),
  }, null, 2))

  const files: string[] = []
  const collect = (current: string): void => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) collect(full)
      else files.push(relative(dir, full).split(sep).join('/'))
    }
  }
  collect(dir)

  const extension = describeInstalled(id, {
    manifest,
    js,
    css,
    source,
    files,
  })
  return {
    extension,
    report: { warnings, stubs: [...new Set(escapes.map((e) => e.specifier))] },
  }
}

/** Build the public record for one on-disk extension. */
function describeInstalled(
  id: string,
  meta: { manifest: StManifest; js: string; css: string; source: string; files: string[] },
): StExtension {
  let description = ''
  try {
    const readme = meta.files.find((f) => /^readme\.md$/i.test(f))
    if (readme !== undefined) {
      description = readFileSync(join(extensionDir(id), readme), 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
        .slice(0, 2)
        .join(' ')
        .slice(0, 200)
    }
  } catch { /* optional */ }
  return {
    id,
    name: meta.manifest.display_name ?? id,
    author: meta.manifest.author ?? '未知',
    version: meta.manifest.version ?? '0.0.0',
    homePage: meta.manifest.homePage ?? '',
    js: meta.js,
    css: meta.css,
    loadingOrder: typeof meta.manifest.loading_order === 'number' ? meta.manifest.loading_order : 100,
    source: meta.source,
    builtin: false,
    base: '/tavern-ext/' + id + '/',
    description,
    files: meta.files,
  }
}

/** Every extension installed on disk. */
export function listInstalled(): StExtension[] {
  const root = extensionsRoot()
  if (!existsSync(root)) return []
  const out: StExtension[] = []
  for (const id of readdirSync(root)) {
    const dir = join(root, id)
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
    try {
      let manifest: StManifest = {}
      const manifestPath = join(dir, 'manifest.json')
      if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as StManifest
      let js = typeof manifest.js === 'string' ? manifest.js : ''
      if (js !== '' && !existsSync(join(dir, js))) js = ''
      if (js === '') js = ['index.js', 'main.js', 'script.js'].find((n) => existsSync(join(dir, n))) ?? ''
      let css = typeof manifest.css === 'string' ? manifest.css : ''
      if (css !== '' && !existsSync(join(dir, css))) css = ''
      if (css === '') css = ['style.css', 'styles.css'].find((n) => existsSync(join(dir, n))) ?? ''
      let source = ''
      const sourcePath = join(dir, '.tavern-source.json')
      if (existsSync(sourcePath)) {
        try { source = String((JSON.parse(readFileSync(sourcePath, 'utf8')) as { source?: unknown }).source ?? '') } catch { /* ignore */ }
      }
      const files: string[] = []
      const collect = (current: string): void => {
        for (const name of readdirSync(current)) {
          const full = join(current, name)
          if (statSync(full).isDirectory()) collect(full)
          else files.push(relative(dir, full).split(sep).join('/'))
        }
      }
      collect(dir)
      out.push(describeInstalled(id, { manifest, js, css, source: source || '本地安装', files }))
    } catch { /* skip a broken directory */ }
  }
  return out.sort((a, b) => a.loadingOrder - b.loadingOrder || a.id.localeCompare(b.id))
}

/**
 * Pull a few representative colours out of a theme stylesheet, so the store can
 * show a real preview instead of inventing one. Only literal hex values are
 * read; anything exotic is simply skipped.
 * @param css - the theme stylesheet.
 */
function paletteOf(css: string): string[] {
  const wanted = ['--st-bg', '--st-panel', '--st-accent', '--st-text', '--SmartThemeEmColor']
  const out: string[] = []
  for (const name of wanted) {
    const m = new RegExp(name.replace(/[-]/g, '\\-') + '\\s*:\\s*(#[0-9A-Fa-f]{3,8})').exec(css)
    if (m !== null && !out.includes(m[1])) out.push(m[1])
  }
  return out
}

/** The bundled beautification themes, presented in the same shape. */
export function listBuiltin(): StExtension[] {
  return BUILTIN_THEMES.map((theme) => ({
    id: theme.id,
    name: theme.display_name,
    author: theme.author,
    version: theme.version,
    homePage: '',
    js: '',
    css: 'theme.css',
    loadingOrder: 0,
    source: '内置主题包',
    builtin: true,
    tags: theme.tags,
    palette: paletteOf(theme.css),
    base: '/tavern-ext/' + theme.id + '/',
    description: theme.description,
    files: ['theme.css'],
  }))
}

/** Remove one installed extension. */
export function removeExtension(id: string): boolean {
  const dir = extensionDir(id)
  if (!existsSync(dir)) return false
  rmSync(dir, { recursive: true, force: true })
  return true
}

/**
 * Resolve a request path inside an extension, refusing traversal.
 *
 * Separators are unified to '/' before normalizing and converted back
 * afterwards: on Windows path.normalize rewrites every '/' to '\\', which would
 * otherwise make a plain 'theme.css' lookup miss its own file.
 * @param id - extension directory name.
 * @param relativePath - path below the extension root, from the URL.
 */
export function readExtensionFile(id: string, relativePath: string): { body: Buffer; type: string } | null {
  const unified = String(relativePath ?? '').replace(/\\/g, '/')
  const clean = normalize(unified).split(sep).join('/').replace(/^\/+/, '')
  if (clean === '') return null
  if (clean.split('/').includes('..')) return null
  const theme = BUILTIN_THEMES.find((t) => t.id === id)
  if (theme !== undefined) {
    if (clean === 'theme.css') return { body: Buffer.from(theme.css, 'utf8'), type: 'text/css; charset=utf-8' }
    if (clean === 'manifest.json') {
      return {
        body: Buffer.from(JSON.stringify({
          display_name: theme.display_name,
          author: theme.author,
          version: theme.version,
          css: 'theme.css',
        }, null, 2), 'utf8'),
        type: 'application/json; charset=utf-8',
      }
    }
    return null
  }
  const dir = extensionDir(id)
  if (!existsSync(dir)) return null
  const target = resolve(dir, clean)
  const rel = relative(dir, target)
  if (rel.startsWith('..') || resolve(target) === resolve(dir)) return null
  if (!existsSync(target) || !statSync(target).isFile()) return null
  return { body: readFileSync(target), type: contentTypeOf(target) }
}

/** Content type by extension, with a safe default for extension assets. */
export function contentTypeOf(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.js': case '.mjs': return 'text/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.html': case '.htm': return 'text/html; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.png': return 'image/png'
    case '.jpg': case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.webp': return 'image/webp'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    case '.ttf': return 'font/ttf'
    case '.otf': return 'font/otf'
    case '.md': case '.txt': return 'text/plain; charset=utf-8'
    default: return 'application/octet-stream'
  }
}

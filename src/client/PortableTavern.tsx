/**
 * Portable Tavern browser surface: the draggable floating entry plus the
 * three-tab panel (character card / chat / settings). Pure React; all data
 * goes through the TavernApi fetch client. No emoji, per repo rules.
 */

import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import type { ChatMessage, CharCard, Party, RpgState, StExtension, TavernSpec, WorldbookEntry } from '../protocol.ts'
import { TavernApi } from './api.ts'
import { loadCustomLlm, saveCustomLlm, clearCustomLlm, loadSampling, saveSampling } from './llm-custom.ts'
import { Btn, Chips, ColorSwatches, CustomAdd, Field, RadioGroup, Section, Slider, cx, downloadFile } from './ui.tsx'
import { ChatPanel } from './panels/ChatPanel.tsx'
import { ExtPanel } from './panels/ExtPanel.tsx'
import { PartyPanel } from './panels/PartyPanel.tsx'
import { RpgPanel } from './panels/RpgPanel.tsx'
import { cardFromMember, memberFromCard } from './character-bridge.ts'
import {
  HEAVY_KEYS,
  loadRecord,
  onStorageIssue,
  readPref,
  saveRecord,
  storageEstimate,
  writePref,
  type StorageIssue,
} from './storage.ts'
import {
  loadActivePartyId,
  loadCurrentParty,
  loadParties,
  loadRpgState,
  makeParty,
  makeRpgState,
  saveActivePartyId,
  saveCurrentParty,
  saveParties,
  saveRpgState,
} from './party.ts'
import { createStHost } from './st/index.ts'
import { css } from './styles.ts'

// ---------------------------------------------------------------------------
// option libraries
// ---------------------------------------------------------------------------

const RACES = ['人类', '精灵', '兽人', '机械', '天使', '恶魔', '龙族', '半兽人', '吸血鬼', '人鱼', '自定义']
const JOBS = ['战士', '法师', '盗贼', '牧师', '吟游诗人', '商人', '工匠', '猎人', '骑士', '学者', '自定义']
const BUILDS = ['纤细', '匀称', '健壮', '丰满']
const HAIR_STYLES = ['短发', '中发', '长发', '卷发', '扎发', '马尾', '双马尾', '光头', '及肩', '盘发']
const HAIR_COLORS = ['#1a1a1a', '#5a3a1a', '#8b5a2b', '#c19a6b', '#e6c48c', '#ffd700', '#b22222', '#8b0000', '#4b0082', '#2e8b57', '#1e90ff', '#f5f5f5']
const EYE_COLORS = ['#1a1a1a', '#5a3a1a', '#8b5a2b', '#2e8b57', '#1e90ff', '#4a90d9', '#8a2be2', '#b22222', '#ff8c00', '#808080', '#e63946', '#20b2aa']
const SKIN_COLORS = ['#f2c9a0', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#ffe0bd', '#f1c27d', '#a47551', '#7d5a3c', '#3b2a1a']
const FEATURES = ['疤痕', '纹身', '胎记', '义肢', '角', '翅膀', '尾巴', '兽耳', '异色瞳', '面纱', '面具', '饰品']
const TRAITS = ['勇敢', '狡诈', '忠诚', '叛逆', '温柔', '毒舌', '幽默', '忧郁', '傲慢', '谦逊', '天真', '世故', '冷静', '冲动', '好奇', '谨慎']
const ABILITIES = ['剑术', '魔法', '潜行', '说服', '炼金', '驯兽', '工程', '医术', '占卜', '烹饪', '音乐', '骑术', '箭术', '格斗', '追踪', '外交']
const ORIGINS = ['贵族', '平民', '流浪者', '被遗忘者', '孤儿', '战士世家', '商人之家', '宗教世家', '皇族', '隐世家族']
const DIALOG_STYLES = ['正式典雅', '随性口语', '古风文言', '科幻术语', '萌系可爱', '暗黑哥特']
const TONES = ['温柔', '强势', '戏谑', '冷淡', '热情', '神秘']
const SCENE_TEMPLATES = ['酒馆', '森林', '城堡', '太空站', '学院', '地下城', '宫廷', '战场', '海边小镇', '废墟都市']
const OPENER_STYLES = ['简短', '详细', '诗意', '行动派']
const GENDERS = [{ value: '男', label: '男' }, { value: '女', label: '女' }, { value: '非二元', label: '非二元' }, { value: '其他', label: '其他' }]
const PERSON_OPTS = [{ value: 'first', label: '第一人称（我）' }, { value: 'third', label: '第三人称（她/他）' }]
const RACE_OPTS = RACES.map((r) => ({ value: r, label: r }))
const JOB_OPTS = JOBS.map((j) => ({ value: j, label: j }))
const STYLE_OPTS = DIALOG_STYLES.map((s) => ({ value: s, label: s }))

const DEFAULT_SPEC: TavernSpec = {
  basic: { name: '', age: 24, ageUnknown: false, gender: '女', race: '人类', raceCustom: '', job: '法师', jobCustom: '' },
  appearance: { height: 165, heightUnit: 'cm', build: '匀称', hairColor: '#8b5a2b', hairStyle: '长发', eyeColor: '#1e90ff', skinColor: '#f2c9a0', features: [] },
  personality: { extroversion: 5, agreeableness: 6, conscientiousness: 5, stability: 5, openness: 7, traits: [] },
  background: { origin: '', experience: '', world: '' },
  abilities: [],
  dialogue: { style: '随性口语', tone: '温柔', person: 'first' },
  scenario: { scene: '', sceneTemplate: '', openerStyle: '简短' },
}

// ---------------------------------------------------------------------------
// small utils
// ---------------------------------------------------------------------------

function cleanPlaceholders(s: string | undefined, name: string | undefined): string {
  return String(s ?? '').split('{{char}}').join(name || '角色').split('{{user}}').join('你')
}

// ---------------------------------------------------------------------------
// shared open/close store (wired in index.ts)
// ---------------------------------------------------------------------------

export interface TavernStore {
  get(): boolean
  set(value: boolean): void
  subscribe(listener: () => void): () => void
}

export function makeStore(initial: boolean): TavernStore {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (v) => { value = v; listeners.forEach((l) => l()) },
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l) } },
  }
}

function useStoreValue(store: TavernStore): boolean {
  const [v, setV] = useState(store.get())
  useEffect(() => store.subscribe(() => setV(store.get())), [store])
  return v
}

// ---------------------------------------------------------------------------
// persistence (localStorage + IndexedDB)
// ---------------------------------------------------------------------------

/** How strongly the user's own wallpaper shows through the panel. */
const DEFAULT_BG_OPACITY = 0.16

function loadTavernSettings(): { width: number; accent: string; showTrigger: boolean; bgOpacity: number } {
  try {
    const raw = localStorage.getItem('dsh.portable-tavern.settings.v1')
    const s = raw ? JSON.parse(raw) : {}
    return {
      width: s.width || 540,
      accent: s.accent || '#4f7cff',
      showTrigger: s.showTrigger !== false,
      bgOpacity: typeof s.bgOpacity === 'number' ? Math.min(0.7, Math.max(0, s.bgOpacity)) : DEFAULT_BG_OPACITY,
    }
  } catch { return { width: 540, accent: '#4f7cff', showTrigger: true, bgOpacity: DEFAULT_BG_OPACITY } }
}
function saveTavernSettings(s: { width: number; accent: string; showTrigger?: boolean; bgOpacity?: number }): void {
  try { localStorage.setItem('dsh.portable-tavern.settings.v1', JSON.stringify(s)) } catch { /* quota */ }
}

/**
 * Floating-trigger visibility, shared between TavernRoot (renders it) and the
 * settings tab (toggles it); persists through the tavern settings key.
 */
const triggerStore: TavernStore = makeStore(loadTavernSettings().showTrigger)
function setTriggerVisible(value: boolean): void {
  triggerStore.set(value)
  const s = loadTavernSettings()
  saveTavernSettings({ ...s, showTrigger: value })
}
function loadBgImage(): string {
  try { return localStorage.getItem('dsh.portable-tavern.bgimage.v1') || '' } catch { return '' }
}
function saveBgImage(v: string): void {
  try { if (v) localStorage.setItem('dsh.portable-tavern.bgimage.v1', v); else localStorage.removeItem('dsh.portable-tavern.bgimage.v1') } catch { /* quota */ }
}
/** Human-readable byte size for the storage panel. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const MUSIC_KEY = 'dsh.portable-tavern.music.v1'

/** Where the playlist left off, so reopening the tavern resumes instead of restarting. */
interface MusicState { index: number; position: number; playing: boolean }

/** Read the saved playback position (never throws). */
function loadMusicState(): MusicState {
  const saved = readPref<Partial<MusicState>>(MUSIC_KEY, {})
  return {
    index: typeof saved.index === 'number' && saved.index >= 0 ? saved.index : 0,
    position: typeof saved.position === 'number' && saved.position >= 0 ? saved.position : 0,
    playing: saved.playing === true,
  }
}

/** Persist the playback position. */
function saveMusicState(state: MusicState): void {
  writePref(MUSIC_KEY, state)
}

const THREADS_KEY = 'dsh.portable-tavern.threads.v1'

/** Per-member conversation threads, keyed by member id. */
function loadMemberThreads(): Record<string, ChatMessage[]> {
  try {
    const raw = localStorage.getItem(THREADS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Record<string, ChatMessage[]> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) out[key] = value as ChatMessage[]
    }
    return out
  } catch { return {} }
}

/** Persist the member threads (the card thread lives in the workspace). */
function saveMemberThreads(threads: Record<string, ChatMessage[]>): void {
  try { localStorage.setItem(THREADS_KEY, JSON.stringify(threads)) } catch { /* quota */ }
}

const EXT_ENABLED_KEY = 'dsh.portable-tavern.ext.enabled.v1'
const EXT_THEME_KEY = 'dsh.portable-tavern.ext.theme.v1'

/** Extension ids the user enabled on a previous visit. */
function loadEnabledExt(): string[] {
  try {
    const raw = localStorage.getItem(EXT_ENABLED_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

/** Persist the enabled extension set. */
function saveEnabledExt(list: string[]): void {
  try { localStorage.setItem(EXT_ENABLED_KEY, JSON.stringify(list)) } catch { /* quota */ }
}

/** The built-in theme currently applied, '' for none. */
function loadActiveTheme(): string {
  try { return localStorage.getItem(EXT_THEME_KEY) ?? '' } catch { return '' }
}

/** Persist the applied theme. */
function saveActiveTheme(id: string): void {
  try {
    if (id === '') localStorage.removeItem(EXT_THEME_KEY)
    else localStorage.setItem(EXT_THEME_KEY, id)
  } catch { /* quota */ }
}

function loadTemplates(): { name: string; spec: TavernSpec }[] {
  try {
    const raw = localStorage.getItem('dsh.portable-tavern.templates.v1')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function saveTemplates(list: { name: string; spec: TavernSpec }[]): void {
  try { localStorage.setItem('dsh.portable-tavern.templates.v1', JSON.stringify(list)) } catch { /* quota */ }
}

// ---------------------------------------------------------------------------
// workspace (current session) + character library persistence
// ---------------------------------------------------------------------------

interface SavedCharacter {
  id: string
  name: string
  savedAt: number
  card: CharCard
  worldbook: { entries: WorldbookEntry[] } | null
  chat: ChatMessage[]
  avatar: string
}

interface WorkspaceState {
  spec: TavernSpec
  card: CharCard | null
  worldbook: { entries: WorldbookEntry[] } | null
  chat: ChatMessage[]
  version: string
  chatModel: string
  globalPrompt: string
  avatar: string
}

const WS_KEY = 'dsh.portable-tavern.workspace.v1'
const CHARS_KEY = 'dsh.portable-tavern.characters.v1'

function loadWorkspace(): Partial<WorkspaceState> {
  try {
    const raw = localStorage.getItem(WS_KEY)
    return raw ? JSON.parse(raw) as Partial<WorkspaceState> : {}
  } catch { return {} }
}
function saveWorkspace(ws: WorkspaceState): void {
  try { localStorage.setItem(WS_KEY, JSON.stringify(ws)) } catch { /* quota */ }
}

function loadCharacters(): SavedCharacter[] {
  try {
    const raw = localStorage.getItem(CHARS_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list as SavedCharacter[] : []
  } catch { return [] }
}
function saveCharacters(list: SavedCharacter[]): void {
  try { localStorage.setItem(CHARS_KEY, JSON.stringify(list)) } catch { /* quota */ }
}

function musicDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('dsh-portable-tavern-music', 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('tracks')) req.result.createObjectStore('tracks', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    } catch (e) { reject(e) }
  })
}
function saveMusic(list: { id: string; name: string; blob: Blob }[]): void {
  void musicDb().then((db) => {
    try {
      const tx = db.transaction('tracks', 'readwrite')
      const store = tx.objectStore('tracks')
      store.clear()
      for (const t of list) store.put({ id: t.id, name: t.name, blob: t.blob })
    } catch { /* ignore */ }
  }).catch(() => undefined)
}
function loadMusic(): Promise<{ id: string; name: string; blob: Blob }[]> {
  return musicDb().then((db) => new Promise<{ id: string; name: string; blob: Blob }[]>((resolve) => {
    try {
      const req = db.transaction('tracks', 'readonly').objectStore('tracks').getAll()
      req.onsuccess = () => resolve((req.result ?? []) as { id: string; name: string; blob: Blob }[])
      req.onerror = () => resolve([])
    } catch { resolve([]) }
  })).catch(() => [])
}

// ---------------------------------------------------------------------------
// PNG chara chunk decode (for importing PNG character cards)
// ---------------------------------------------------------------------------

function bytesToAscii(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}
function b64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
function decodePngChara(bytes: Uint8Array): string | null {
  try {
    if (bytes.length < 8) return null
    const sig = [137, 80, 78, 71, 13, 10, 26, 10]
    for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null
    let off = 8
    while (off + 8 <= bytes.length) {
      const len = (bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]
      const type = bytesToAscii(bytes.subarray(off + 4, off + 8))
      const dataStart = off + 8
      const dataEnd = dataStart + len
      if (dataEnd > bytes.length) break
      if (type === 'tEXt') {
        const data = bytes.subarray(dataStart, dataEnd)
        let nul = -1
        for (let i = 0; i < data.length; i++) if (data[i] === 0) { nul = i; break }
        if (nul >= 0) {
          const keyword = bytesToAscii(data.subarray(0, nul))
          if (keyword === 'chara') return bytesToAscii(data.subarray(nul + 1))
        }
      }
      if (type === 'IEND') break
      off = dataEnd + 4
    }
    return null
  } catch { return null }
}

function normalizeWorldbook(obj: unknown): WorldbookEntry[] {
  if (Array.isArray(obj)) return obj as WorldbookEntry[]
  if (obj && typeof obj === 'object' && 'entries' in obj) {
    const entries = (obj as { entries: unknown }).entries
    if (Array.isArray(entries)) return entries as WorldbookEntry[]
    if (entries && typeof entries === 'object') return Object.values(entries as Record<string, unknown>) as WorldbookEntry[]
  }
  return []
}

function avatarGradient(spec: TavernSpec): string {
  const a = spec.appearance
  return 'linear-gradient(135deg,' + (a.hairColor || '#8b5a2b') + ',' + (a.skinColor || '#f2c9a0') + ')'
}

/** Read an image file and downscale it to a compact JPEG data URL for the avatar. */
function fileToAvatar(file: File, cb: (dataUrl: string) => void): void {
  const reader = new FileReader()
  reader.onload = () => {
    const src = String(reader.result)
    const img = new Image()
    img.onload = () => {
      try {
        const max = 256
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (!w || !h) { cb(src); return }
        const scale = Math.min(1, max / Math.max(w, h))
        w = Math.max(1, Math.round(w * scale))
        h = Math.max(1, Math.round(h * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const g = canvas.getContext('2d')
        if (!g) { cb(src); return }
        g.drawImage(img, 0, 0, w, h)
        cb(canvas.toDataURL('image/jpeg', 0.85))
      } catch { cb(src) }
    }
    img.onerror = () => cb(src)
    img.src = src
  }
  reader.onerror = () => cb('')
  reader.readAsDataURL(file)
}

function describeSpec(spec: TavernSpec): string {
  const b = spec.basic; const a = spec.appearance; const p = spec.personality
  const bg = spec.background; const d = spec.dialogue; const sc = spec.scenario
  const lines: string[] = []
  lines.push('- 名称：' + (b.name || '未命名'))
  lines.push('- 年龄：' + (b.ageUnknown ? '未知/永生' : b.age + ' 岁'))
  lines.push('- 性别：' + b.gender)
  lines.push('- 种族：' + (b.race === '自定义' ? (b.raceCustom || '自定义') : b.race))
  lines.push('- 职业：' + (b.job === '自定义' ? (b.jobCustom || '自定义') : b.job))
  lines.push('- 外貌：' + a.height + (a.heightUnit === 'ft' ? '英尺' : 'cm') + ' · ' + a.build + ' · ' + a.hairColor + '发 · ' + a.hairStyle + ' · ' + a.eyeColor + '瞳')
  if (a.features.length) lines.push('- 特征：' + a.features.join('、'))
  lines.push('- 性格五维：外向 ' + p.extroversion + ' / 友善 ' + p.agreeableness + ' / 尽责 ' + p.conscientiousness + ' / 稳定 ' + p.stability + ' / 开放 ' + p.openness)
  if (p.traits.length) lines.push('- 关键词：' + p.traits.join('、'))
  if (bg.origin) lines.push('- 出身：' + bg.origin)
  if (bg.experience) lines.push('- 经历：' + bg.experience)
  if (bg.world) lines.push('- 世界：' + bg.world)
  if (spec.abilities.length) lines.push('- 能力：' + spec.abilities.join('、'))
  lines.push('- 对话：' + d.style + ' · ' + d.tone + ' · ' + (d.person === 'third' ? '第三人称' : '第一人称'))
  if (sc.scene || sc.sceneTemplate) lines.push('- 场景：' + (sc.scene || sc.sceneTemplate))
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// tiny form primitives now live in ./ui.tsx so every panel shares them
/** The panel's top-level navigation, in display order. */
const TABS: { id: string; label: string; title: string }[] = [
  { id: 'character', label: '角色卡', title: '塑造 / 导入角色卡' },
  { id: 'chat', label: '聊天', title: '与角色单独对话' },
  { id: 'rpg', label: '冒险', title: '跑团模式：系统判定，AI 叙述' },
  { id: 'party', label: '队伍', title: '队伍与每个成员的独立模型' },
  { id: 'plugins', label: '插件', title: '酒馆扩展与美化主题' },
  { id: 'settings', label: '设置', title: '外观、模型接入、采样与音乐' },
]

// ---------------------------------------------------------------------------
// main panel
// ---------------------------------------------------------------------------

function CardPreview(props: { card: CharCard; avatar: string }): React.ReactElement {
  const d = props.card.data
  const items: [keyof CharCard['data'], string][] = [
    ['description', '描述'], ['personality', '性格'], ['scenario', '场景'], ['first_mes', '首条问候'],
    ['mes_example', '示例对话'], ['creator_notes', '创作者备注'], ['system_prompt', '系统提示'],
  ]
  return (
    <div className={css.stCardPreview}>
      <div className={css.stCardHead}>
        {props.avatar ? <img className={css.stCardAvatar} src={props.avatar} alt={d.name} /> : null}
        <div className={css.stCardName}>{d.name || '未命名角色'}</div>
      </div>
      {d.tags.length ? <div className={css.stCardTags}>{d.tags.map((t) => <span key={t} className={css.stCardTag}>{t}</span>)}</div> : null}
      {items.map(([key, label]) => {
        const v = d[key] as string
        if (!v) return null
        return (
          <div key={key} className={css.stCardBlock}>
            <div className={css.stCardBlockLabel}>{label}</div>
            <div className={css.stCardBlockText}>{v}</div>
          </div>
        )
      })}
      {d.alternate_greetings.length
        ? (
          <div className={css.stCardBlock}>
            <div className={css.stCardBlockLabel}>替代问候</div>
            {d.alternate_greetings.map((g, i) => <div key={i} className={css.stCardBlockText}>{g}</div>)}
          </div>
        )
        : null}
    </div>
  )
}

function PortableTavern(props: { store: TavernStore; open: boolean }): React.ReactElement {
  const api = useState(() => new TavernApi())[0]
  const [ws] = useState(loadWorkspace)
  const [spec, setSpec] = useState<TavernSpec>(() => (ws.spec ?? DEFAULT_SPEC))
  const [card, setCard] = useState<CharCard | null>(() => (ws.card ?? null))
  const [version, setVersion] = useState(() => (ws.version ?? 'v2'))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [fallback, setFallback] = useState(false)
  const [rawText, setRawText] = useState('')
  const [charTab, setCharTab] = useState('preview')
  const [jsonDraft, setJsonDraft] = useState('')
  const [worldbook, setWorldbook] = useState<{ entries: WorldbookEntry[] } | null>(() => (ws.worldbook ?? null))
  const [wbGenerating, setWbGenerating] = useState(false)
  const [wbError, setWbError] = useState('')
  const [templates, setTemplates] = useState(loadTemplates)
  const [templateName, setTemplateName] = useState('')
  const [tab, setTab] = useState('character')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => (ws.chat ?? []))
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [modelOptions, setModelOptions] = useState<{ provider: string; model: string; label: string }[]>([])
  const [chatModel, setChatModel] = useState(() => (ws.chatModel ?? ''))
  const [globalPrompt, setGlobalPrompt] = useState(() => (ws.globalPrompt ?? ''))
  const [avatar, setAvatar] = useState(() => (ws.avatar ?? ''))
  const [savedChars, setSavedChars] = useState(loadCharacters)
  const [tavern, setTavern] = useState(loadTavernSettings)
  const [showTrigger, setShowTrigger] = useState(() => triggerStore.get())
  const [llmDraft, setLlmDraft] = useState(loadCustomLlm)
  const [sampling, setSampling] = useState(loadSampling)
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState('')
  const [bgImage, setBgImage] = useState(loadBgImage)
  const [playlist, setPlaylist] = useState<{ id: string; name: string; url: string; blob?: Blob }[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  // --- tabletop RPG ---
  const [parties, setParties] = useState<Party[]>(loadParties)
  const [party, setParty] = useState<Party>(() => {
    // Prefer the working copy: it carries edits the user never explicitly saved.
    const working = loadCurrentParty()
    if (working !== null) return working
    const id = loadActivePartyId()
    const found = loadParties().find((p) => p.id === id)
    return found ?? makeParty()
  })
  const [rpg, setRpg] = useState<RpgState>(() => loadRpgState() ?? makeRpgState())
  // --- SillyTavern extension host ---
  const stHost = useState(() => createStHost())[0]
  const [extInstalled, setExtInstalled] = useState<StExtension[]>([])
  const [extBuiltin, setExtBuiltin] = useState<StExtension[]>([])
  const [extEnabled, setExtEnabled] = useState<string[]>(loadEnabledExt)
  const [extLog, setExtLog] = useState<string[]>([])
  const [extTheme, setExtTheme] = useState<string>(loadActiveTheme)
  // --- conversations: the card thread plus one thread per party member ---
  const [memberThreads, setMemberThreads] = useState<Record<string, ChatMessage[]>>(loadMemberThreads)
  const [chatTarget, setChatTarget] = useState('card')
  /** A plan carried from the chat window into the adventure window. */
  const [carryPlan, setCarryPlan] = useState('')
  /**
   * False until the IndexedDB records have been read. Every autosave waits for
   * it, otherwise the first debounce tick would write the empty defaults over
   * the user's real data.
   */
  const [hydrated, setHydrated] = useState(false)
  /** The last storage failure, surfaced instead of swallowed. */
  const [storageIssue, setStorageIssue] = useState<StorageIssue | null>(null)
  /** Bytes used by this origin, read lazily for the settings panel. */
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null)
  // --- playback position bookkeeping (so reopening resumes, not restarts) ---
  const audioRef = useRef<HTMLAudioElement | null>(null)
  /** Where to seek once the next track's metadata arrives. */
  const seekRef = useRef(0)
  const positionRef = useRef(0)
  /** Whether the element is producing sound right now. */
  const playingRef = useRef(false)
  /**
   * Whether the user wants sound. Kept apart from playingRef because changing
   * track tears the source down (which pauses the element) and that pause must
   * not be mistaken for the user pressing pause.
   */
  const wantPlayRef = useRef(false)
  /** True while a track is being swapped in. */
  const loadingRef = useRef(false)
  const indexRef = useRef(0)

  const patch = (key: keyof TavernSpec, value: unknown): void => setSpec((prev) => ({ ...prev, [key]: value }))
  const patchN = <K extends keyof TavernSpec>(section: K, key: string, value: unknown): void =>
    setSpec((prev) => ({ ...prev, [section]: { ...(prev[section] as unknown as Record<string, unknown>), [key]: value } }))

  // Derived live from the drafts — the stored `configured` flag only refreshes
  // on save, which left the chat dropdown's custom option hidden while typing.
  const customConfigured = llmDraft.baseUrl.trim() !== '' && llmDraft.apiKey.trim() !== '' && llmDraft.model.trim() !== ''

  useEffect(() => {
    void api.models().then((res) => {
      setModelOptions(res.options)
      if (!chatModel && res.current?.provider && res.current?.model) {
        setChatModel(res.current.provider + '::' + res.current.model)
      }
    }).catch(() => undefined)
  }, [])
  useEffect(() => {
    void loadMusic().then((tracks) => {
      if (tracks.length === 0) return
      setPlaylist(tracks.map((t) => ({ id: t.id, name: t.name, url: URL.createObjectURL(t.blob) })))
      // Resume where the last visit stopped rather than restarting the list.
      const saved = loadMusicState()
      setCurrentIndex(Math.min(saved.index, tracks.length - 1))
      seekRef.current = saved.position
      // Resume the intent as well: restoring the position but not "was playing"
      // is why reopening the tavern came back silent.
      wantPlayRef.current = saved.playing
    })
  }, [])
  useEffect(() => {
    const el = document.getElementById('pt-chat-log')
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages, chatSending])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      void saveRecord(HEAVY_KEYS.workspace, { spec, card, worldbook, chat: chatMessages, version, chatModel, globalPrompt, avatar })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [spec, card, worldbook, chatMessages, version, chatModel, globalPrompt, avatar, hydrated])


  // -------------------------------------------------------------------------
  // tabletop persistence + SillyTavern extension host wiring
  // -------------------------------------------------------------------------

  /** Latest chat/character state, read by the extension context on demand. */
  const liveRef = useRef<{ chat: ChatMessage[]; card: CharCard | null }>({ chat: [], card: null })
  liveRef.current = { chat: chatMessages, card }

  /** Lets an extension push a message through the normal send path. */
  const stSendRef = useRef<(text: string) => void>(() => undefined)

  /** Append one line to the extension log, capped. */
  const pushExtLog = (message: string): void => {
    setExtLog((prev) => [...prev.slice(-199), new Date().toLocaleTimeString() + ' ' + message])
  }

  /** Re-read the extension lists from the host. */
  const refreshExt = (): void => {
    void api.extList().then((res) => {
      setExtInstalled(res.installed)
      setExtBuiltin(res.builtin)
    }).catch((e) => pushExtLog('扩展列表读取失败：' + (e instanceof Error ? e.message : String(e))))
  }

  useEffect(() => {
    onStorageIssue(setStorageIssue)
    return () => onStorageIssue(null)
  }, [])

  useEffect(() => {
    void storageEstimate().then(setStorageUsage)
  }, [storageIssue])

  useEffect(() => { indexRef.current = Math.max(0, currentIndex) }, [currentIndex])

  /**
   * Browsers refuse to start audio before the page has been interacted with.
   * If the saved state says "playing", try again on the first gesture instead
   * of silently staying mute.
   */
  useEffect(() => {
    const retry = (): void => {
      const el = audioRef.current
      if (el !== null && wantPlayRef.current && el.paused && el.getAttribute('src') !== null) {
        void el.play().catch(() => undefined)
      }
    }
    document.addEventListener('pointerdown', retry)
    document.addEventListener('keydown', retry)
    return () => {
      document.removeEventListener('pointerdown', retry)
      document.removeEventListener('keydown', retry)
    }
  }, [])

  /**
   * Swap the source in place instead of remounting the element.
   *
   * `key={currentIndex}` used to remount <audio> on every track change, and the
   * teardown pause arrived after the new element mounted -- so advancing a
   * track stopped the music dead.
   */
  useEffect(() => {
    const el = audioRef.current
    const item = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null
    if (el === null || item === null) return
    const seek = seekRef.current
    const resume = wantPlayRef.current
    seekRef.current = 0
    loadingRef.current = true
    const onMeta = (): void => {
      loadingRef.current = false
      if (seek > 0 && Number.isFinite(el.duration) && seek < el.duration) {
        try { el.currentTime = seek } catch { /* ignore */ }
      }
      if (resume) void el.play().catch(() => undefined)
      el.removeEventListener('loadedmetadata', onMeta)
    }
    el.addEventListener('loadedmetadata', onMeta)
    el.src = item.url
    el.load()
    return () => {
      loadingRef.current = false
      el.removeEventListener('loadedmetadata', onMeta)
    }
  }, [currentIndex, playlist])

  /**
   * Keep the playback position on disk. A periodic tick covers long listening,
   * and the cleanup covers closing the panel mid-song.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (playingRef.current) {
        saveMusicState({ index: indexRef.current, position: positionRef.current, playing: true })
      }
    }, 5000)
    return () => {
      window.clearInterval(timer)
      saveMusicState({ index: indexRef.current, position: positionRef.current, playing: playingRef.current })
    }
  }, [])

  /**
   * Read the heavy records out of IndexedDB once, migrating anything an older
   * build left in localStorage. Until this resolves, nothing is written back.
   */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [storedParty, storedParties, storedChars, storedThreads, storedRpg, storedWs] = await Promise.all([
        loadRecord<Party>(HEAVY_KEYS.party, HEAVY_KEYS.party),
        loadRecord<Party[]>(HEAVY_KEYS.parties, HEAVY_KEYS.parties),
        loadRecord<SavedCharacter[]>(HEAVY_KEYS.characters, HEAVY_KEYS.characters),
        loadRecord<Record<string, ChatMessage[]>>(HEAVY_KEYS.threads, HEAVY_KEYS.threads),
        loadRecord<RpgState>(HEAVY_KEYS.rpg, HEAVY_KEYS.rpg),
        loadRecord<Partial<WorkspaceState>>(HEAVY_KEYS.workspace, HEAVY_KEYS.workspace),
      ])
      if (cancelled) return
      if (storedParty !== null) setParty(storedParty)
      if (storedParties !== null) setParties(storedParties)
      if (storedChars !== null) setSavedChars(storedChars)
      if (storedThreads !== null) setMemberThreads(storedThreads)
      if (storedRpg !== null) setRpg(storedRpg)
      if (storedWs !== null && storedWs.card !== undefined && storedWs.card !== null) {
        setCard(storedWs.card)
        setWorldbook(storedWs.worldbook ?? null)
        setChatMessages(storedWs.chat ?? [])
        if (typeof storedWs.avatar === 'string') setAvatar(storedWs.avatar)
      }
      setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => { void saveRecord(HEAVY_KEYS.rpg, rpg) }, 400)
    return () => window.clearTimeout(timer)
  }, [rpg, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => { void saveRecord(HEAVY_KEYS.threads, memberThreads) }, 400)
    return () => window.clearTimeout(timer)
  }, [memberThreads, hydrated])

  useEffect(() => {
    saveActivePartyId(party.id)
  }, [party.id])

  // Continuous autosave of the team on the table, so nothing is lost just
  // because the user never pressed 保存到队伍库.
  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => { void saveRecord(HEAVY_KEYS.party, party) }, 400)
    return () => window.clearTimeout(timer)
  }, [party, hydrated])

  useEffect(() => {
    refreshExt()
  }, [])

  // Install the compatibility globals once. The host reads live state through
  // a ref so extensions never see a stale snapshot after a re-render.
  useEffect(() => {
    stHost.install({
      getContext: () => {
        const name = liveRef.current.card?.data.name ?? ''
        return {
          chat: liveRef.current.chat.map((m) => ({
            name: m.role === 'user' ? '你' : (name || '角色'),
            mes: m.content,
            is_user: m.role === 'user',
            is_system: false,
            send_date: String(Date.now()),
            extra: {},
          })),
          name1: '你',
          name2: name,
          character: liveRef.current.card ? { ...liveRef.current.card.data } as unknown as Record<string, unknown> : null,
          chatMetadata: {},
          mainApi: 'dsh',
          onlineStatus: 'online',
          chatRootId: 'pt-chat-log',
        }
      },
      onSend: (text) => stSendRef.current(text),
      onSettings: () => undefined,
      onWarn: (message) => { pushExtLog(message) },
    })
    pushExtLog('兼容宿主已启动（SillyTavern API 兼容层就绪）')
    return () => stHost.dispose()
  }, [])

  // Keep the loaded set in step with the enabled set.
  useEffect(() => {
    const all = extBuiltin.concat(extInstalled)
    for (const ext of all) {
      const wanted = extEnabled.includes(ext.id)
      const loaded = stHost.loaded().includes(ext.id)
      if (!wanted && loaded) {
        stHost.unload(ext.id)
        continue
      }
      if (!wanted || loaded) continue
      void stHost.load({
        id: ext.id,
        js: ext.js === '' ? '' : ext.base + ext.js,
        css: ext.css === '' ? '' : ext.base + ext.css,
        base: ext.base,
      }).then((res) => {
        if (res.ok) pushExtLog('已加载扩展：' + ext.name)
        else pushExtLog('扩展加载失败：' + ext.name + ' — ' + (res.error ?? '未知原因'))
        for (const stub of res.stubs) pushExtLog('  · 已用空实现替代酒馆内部模块：' + stub)
      }).catch((e) => pushExtLog('扩展加载异常：' + ext.name + ' — ' + (e instanceof Error ? e.message : String(e))))
    }
  }, [extEnabled, extBuiltin, extInstalled])

  // A bundled theme only paints when html[data-tavern-theme] names it, so
  // switching themes is a single attribute write plus the stylesheet already
  // being loaded.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (extTheme === '') delete document.documentElement.dataset.tavernTheme
    else document.documentElement.dataset.tavernTheme = extTheme
  }, [extTheme])

  /** Toggle one extension on or off. */
  const onToggleExt = (id: string, on: boolean): void => {
    setExtEnabled((prev) => {
      const next = on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
      saveEnabledExt(next)
      return next
    })
  }

  /** Apply or clear the active beautification theme. */
  const onTheme = (id: string): void => {
    setExtTheme(id)
    saveActiveTheme(id)
    if (id === '') return
    setExtEnabled((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      saveEnabledExt(next)
      return next
    })
  }

  // Keep the extension send hook pointing at the current render's closure, so
  // an extension calling sendMessage() uses the same path as the send button.
  useEffect(() => {
    stSendRef.current = (text: string) => onSend(text)
  })

  const onGenerate = (): void => {
    setGenerating(true); setError(''); setFallback(false); setRawText('')
    void api.generate(spec, version).then((res) => {
      setCard(res.card); setFallback(res.fallback); setRawText(res.rawText); setCharTab('preview')
      const d = res.card.data
      const greeting = cleanPlaceholders(d.first_mes, d.name)
      setChatMessages(greeting ? [{ role: 'assistant', content: greeting }] : [])
    }).catch((e) => setError(e instanceof Error ? e.message : '生成失败')).finally(() => setGenerating(false))
  }

  const onWorldbook = (fromCard: boolean): void => {
    setWbGenerating(true); setWbError('')
    void api.worldbook(spec, fromCard ? card : null).then((res) => {
      setWorldbook({ entries: res.entries as WorldbookEntry[] }); setCharTab('worldbook')
    }).catch((e) => setWbError(e instanceof Error ? e.message : '世界书生成失败')).finally(() => setWbGenerating(false))
  }

  const onSend = (override?: string): void => {
    const text = (override ?? chatInput).trim()
    if (!text || chatSending || !card) return
    const parts = (chatModel || '').split('::')
    const isCustom = parts[0] === 'custom'
    if (isCustom && !customConfigured) {
      setChatError('请先到「设置 → 模型接入」填写自定义接口（地址 / API Key / 模型）')
      setTab('settings')
      return
    }
    const next = [...chatMessages, { role: 'user' as const, content: text }]
    setChatMessages(next); setChatInput(''); setChatSending(true); setChatError('')
    const provider = isCustom ? 'custom' : parts.length >= 2 && parts[0] ? parts[0] : undefined
    const model = isCustom ? llmDraft.model : parts.length >= 2 ? parts.slice(1).join('::') : undefined
    void api.chat(card, next, provider, model, globalPrompt).then((res) => {
      setChatMessages([...next, { role: 'assistant', content: res.reply }])
    }).catch((e) => setChatError(e instanceof Error ? e.message : '回复失败')).finally(() => setChatSending(false))
  }

  const onClearChat = (): void => {
    const g = card ? cleanPlaceholders(card.data.first_mes, card.data.name) : ''
    setChatMessages(g ? [{ role: 'assistant', content: g }] : [])
    setChatError('')
  }

  const updateTavern = (key: 'width' | 'accent' | 'bgOpacity', value: number | string): void => {
    setTavern((prev) => { const n = { ...prev, [key]: value }; saveTavernSettings(n); return n })
  }

  const onToggleTrigger = (value: boolean): void => {
    setShowTrigger(value)
    setTriggerVisible(value)
  }

  const onTestLlm = (): void => {
    const baseUrl = llmDraft.baseUrl.trim()
    const apiKey = llmDraft.apiKey.trim()
    const model = llmDraft.model.trim()
    if (baseUrl === '' || apiKey === '' || model === '') { setLlmTestResult('请先填写完整：接口地址 / API Key / 模型名称'); return }
    setLlmTesting(true); setLlmTestResult('')
    saveCustomLlm({ baseUrl, apiKey, model })
    setLlmDraft(loadCustomLlm())
    void api.test({ baseUrl, apiKey, model }).then((res) => {
      const temp = res.temperature ? '｜采样温度：' + res.temperature : ''
      setLlmTestResult('连接成功（' + res.latencyMs + 'ms）：' + res.reply + temp)
    }).catch((e) => setLlmTestResult('连接失败：' + (e instanceof Error ? e.message : String(e)))).finally(() => setLlmTesting(false))
  }

  const onClearLlm = (): void => {
    clearCustomLlm()
    setLlmDraft(loadCustomLlm())
    setLlmTestResult('')
  }

  const onBgImageFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { const u = String(reader.result); setBgImage(u); saveBgImage(u) }
    reader.readAsDataURL(file)
  }

  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    fileToAvatar(file, (dataUrl) => { if (dataUrl) setAvatar(dataUrl) })
  }

  const onClearAvatar = (): void => setAvatar('')

  const onMusicFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const t = { id: 't' + Date.now() + '-' + Math.floor(Math.random() * 100000), name: file.name, url: URL.createObjectURL(file), blob: file }
    const list = [...playlist, t]
    setPlaylist(list); setCurrentIndex(list.length - 1)
    saveMusic(list.map((x) => ({ id: x.id, name: x.name, blob: x.blob as Blob })))
  }

  const onMusicFolder = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.prototype.slice.call(e.target.files ?? []) as File[]
    e.target.value = ''
    const audioFiles = files.filter((f) => /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm|mp4)$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name))
    if (!audioFiles.length) { setError('文件夹中未找到音频文件'); return }
    const list = audioFiles.map((f, i) => ({ id: 't' + Date.now() + '-' + i, name: f.name, url: URL.createObjectURL(f), blob: f }))
    setPlaylist(list); setCurrentIndex(0)
    saveMusic(list.map((x) => ({ id: x.id, name: x.name, blob: x.blob as Blob })))
  }

  /** Advancing deliberately means the user wants to hear the next one. */
  const nextTrack = (): void => {
    wantPlayRef.current = true
    positionRef.current = 0
    setCurrentIndex((i) => (playlist.length ? (i + 1) % playlist.length : -1))
  }
  const prevTrack = (): void => {
    wantPlayRef.current = true
    positionRef.current = 0
    setCurrentIndex((i) => (playlist.length ? (i - 1 + playlist.length) % playlist.length : -1))
  }
  const stopMusic = (): void => {
    wantPlayRef.current = false
    playingRef.current = false
    saveMusicState({ index: 0, position: 0, playing: false })
    setPlaylist([])
    setCurrentIndex(-1)
    saveMusic([])
  }

  const applyImportedCard = (obj: unknown): void => {
    const cardObj = (obj && typeof obj === 'object' && 'spec' in obj && 'data' in obj ? obj : { spec: 'chara_card_v2', spec_version: '2.0', data: obj }) as CharCard
    setCard(cardObj); setCharTab('preview'); setError('')
    const ext = cardObj.data.extensions
    if (ext && typeof ext.avatar === 'string') setAvatar(ext.avatar)
    const greeting = cleanPlaceholders(cardObj.data.first_mes, cardObj.data.name)
    setChatMessages(greeting ? [{ role: 'assistant', content: greeting }] : [])
  }

  const onImportCardFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const isPng = /\.png$/i.test(file.name) || file.type === 'image/png'
    if (isPng) {
      const reader = new FileReader()
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result as ArrayBuffer)
        const b64 = decodePngChara(bytes)
        if (!b64) { setError('PNG 中未找到角色卡数据（chara 块）'); return }
        try { applyImportedCard(JSON.parse(b64ToUtf8(b64))) } catch (err) { setError('角色卡解析失败：' + (err as Error).message) }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        try { applyImportedCard(JSON.parse(String(reader.result))) } catch (err) { setError('角色卡 JSON 解析失败：' + (err as Error).message) }
      }
      reader.readAsText(file)
    }
  }

  const onImportWorldbookFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const entries = normalizeWorldbook(JSON.parse(String(reader.result)))
        if (entries.length) { setWorldbook({ entries }); setCharTab('worldbook'); setWbError('') }
        else setWbError('未找到世界书条目')
      } catch (err) { setWbError('世界书解析失败：' + (err as Error).message) }
    }
    reader.readAsText(file)
  }

  const onSaveTemplate = (): void => {
    const name = templateName.trim() || spec.basic.name || ('模板 ' + (templates.length + 1))
    const list = [...templates, { name, spec: JSON.parse(JSON.stringify(spec)) }]
    setTemplates(list); saveTemplates(list); setTemplateName('')
  }

  const onSaveCharacter = (): void => {
    if (!card) return
    const name = card.data.name || '未命名角色'
    const entry: SavedCharacter = {
      id: 'c' + Date.now() + '-' + Math.floor(Math.random() * 100000),
      name,
      savedAt: Date.now(),
      card: JSON.parse(JSON.stringify(card)) as CharCard,
      worldbook: worldbook ? JSON.parse(JSON.stringify(worldbook)) : null,
      chat: JSON.parse(JSON.stringify(chatMessages)) as ChatMessage[],
      avatar,
    }
    const existing = savedChars.find((c) => c.name === name)
    const list = existing ? savedChars.map((c) => (c.name === name ? entry : c)) : [...savedChars, entry]
    setSavedChars(list); void saveRecord(HEAVY_KEYS.characters, list); setError('')
  }

  const onLoadCharacter = (c: SavedCharacter): void => {
    setCard(JSON.parse(JSON.stringify(c.card)) as CharCard)
    setWorldbook(c.worldbook ? JSON.parse(JSON.stringify(c.worldbook)) : null)
    setChatMessages(JSON.parse(JSON.stringify(c.chat)) as ChatMessage[])
    setAvatar(c.avatar || '')
    setCharTab('preview'); setError('')
  }

  const onDeleteCharacter = (id: string): void => {
    const list = savedChars.filter((c) => c.id !== id)
    setSavedChars(list); void saveRecord(HEAVY_KEYS.characters, list)
  }

  /**
   * Turn the character being edited into a party member and jump to the party
   * tab. The card, its avatar and the builder state all travel across, so the
   * same person can be chatted with and can join an adventure.
   */
  const onJoinParty = (): void => {
    const member = memberFromCard(card, spec, avatar, party.members.length)
    setParty({ ...party, members: [...party.members, member] })
    setChatTarget(member.id)
    setTab('party')
  }

  const onApplyJson = (): void => {
    try {
      const parsed = JSON.parse(jsonDraft) as CharCard | Record<string, unknown>
      setCard(('spec' in parsed && 'data' in parsed ? parsed : { spec: version === 'v3' ? 'chara_card_v3' : 'chara_card_v2', spec_version: version === 'v3' ? '3.0' : '2.0', data: parsed }) as CharCard)
      setError('')
    } catch (e) { setError('JSON 解析失败：' + (e as Error).message) }
  }

  const exportJson = (): void => {
    const base = card ?? { spec: version === 'v3' ? 'chara_card_v3' : 'chara_card_v2', spec_version: version === 'v3' ? '3.0' : '2.0', data: { name: spec.basic.name || '未命名角色', description: describeSpec(spec), personality: '', scenario: '', first_mes: '', mes_example: '', creator_notes: '', system_prompt: '', post_history_instructions: '', alternate_greetings: [], tags: [], creator: 'dsh-portable-tavern', character_version: '1.0', extensions: {} } }
    const obj = JSON.parse(JSON.stringify(base)) as CharCard
    if (avatar) obj.data.extensions = { ...obj.data.extensions, avatar }
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
    downloadFile((obj.data.name || 'character') + '.json', blob)
  }

  const CARD_FIELDS: { key: keyof CharCard['data']; label: string; area: boolean }[] = [
    { key: 'name', label: '名称', area: false },
    { key: 'description', label: '描述', area: true },
    { key: 'personality', label: '性格', area: true },
    { key: 'scenario', label: '场景', area: true },
    { key: 'first_mes', label: '首条问候', area: true },
    { key: 'mes_example', label: '示例对话', area: true },
    { key: 'creator_notes', label: '创作者备注', area: true },
    { key: 'system_prompt', label: '系统提示', area: true },
    { key: 'alternate_greetings', label: '替代问候（每行一条）', area: true },
    { key: 'tags', label: '标签（逗号分隔）', area: false },
  ]

  const cardFieldValue = (key: keyof CharCard['data']): string => {
    const v = card?.data[key]
    if (Array.isArray(v)) return key === 'tags' ? (v as string[]).join(', ') : (v as string[]).join('\n')
    return (v as string) ?? ''
  }
  const onCardFieldChange = (key: keyof CharCard['data'], str: string): void => {
    let value: unknown = str
    if (key === 'alternate_greetings') value = str.split('\n').map((s) => s.trim()).filter(Boolean)
    else if (key === 'tags') value = str.split(',').map((s) => s.trim()).filter(Boolean)
    setCard((prev) => (prev ? { ...prev, data: { ...prev.data, [key]: value } } : prev))
  }

  const secAvatar = (
    <Section title="角色头像" hint="自定义聊天头像，可选" defaultOpen>
      <div className={css.stAvatarRow}>
        <div className={css.stAvatarPreview} style={avatar ? undefined : { background: avatarGradient(spec) }}>
          {avatar ? <img className={css.stAvatarPreviewImg} src={avatar} alt="头像预览" /> : (spec.basic.name || '?').slice(0, 1)}
        </div>
        <div className={css.stAvatarActions}>
          <label className={css.stBtn}>上传图片<input type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatarFile} /></label>
          {avatar ? <Btn onClick={onClearAvatar}>清除</Btn> : null}
        </div>
      </div>
    </Section>
  )

  const secBasic = (
    <Section title="一、基础信息" hint="必填" defaultOpen>
      <Field label="角色名称"><input className={css.stInput} value={spec.basic.name} onChange={(e) => patchN('basic', 'name', e.target.value)} placeholder="角色的唯一标识" /></Field>
      <Field label="年龄">
        <div className={css.stRow}>
          <Slider min={10} max={999} value={spec.basic.age} left="10" right="999" onChange={(v) => patchN('basic', 'age', v)} />
          <label className={css.stCheck}><input type="checkbox" checked={spec.basic.ageUnknown} onChange={(e) => patchN('basic', 'ageUnknown', e.target.checked)} /><span>未知/永生</span></label>
        </div>
      </Field>
      <Field label="性别"><RadioGroup options={GENDERS} value={spec.basic.gender} onChange={(v) => patchN('basic', 'gender', v)} /></Field>
      <Field label="种族">
        <select className={css.stInput} value={spec.basic.race} onChange={(e) => patchN('basic', 'race', e.target.value)}>{RACE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        {spec.basic.race === '自定义' ? <input className={css.stInput} value={spec.basic.raceCustom} onChange={(e) => patchN('basic', 'raceCustom', e.target.value)} placeholder="自定义种族" /> : null}
      </Field>
      <Field label="职业">
        <select className={css.stInput} value={spec.basic.job} onChange={(e) => patchN('basic', 'job', e.target.value)}>{JOB_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        {spec.basic.job === '自定义' ? <input className={css.stInput} value={spec.basic.jobCustom} onChange={(e) => patchN('basic', 'jobCustom', e.target.value)} placeholder="自定义职业" /> : null}
      </Field>
    </Section>
  )

  const secAppearance = (
    <Section title="二、外貌特征" hint="多选 + 填空">
      <Field label="身高"><Slider min={120} max={260} value={spec.appearance.height} left="矮小" right="高大" onChange={(v) => patchN('appearance', 'height', v)} /></Field>
      <Field label="体型"><Chips options={BUILDS} values={spec.appearance.build} onChange={(v) => patchN('appearance', 'build', v)} /></Field>
      <Field label="发色"><ColorSwatches palette={HAIR_COLORS} value={spec.appearance.hairColor} onChange={(v) => patchN('appearance', 'hairColor', v)} /></Field>
      <Field label="发型"><Chips options={HAIR_STYLES} values={spec.appearance.hairStyle} onChange={(v) => patchN('appearance', 'hairStyle', v)} /></Field>
      <Field label="瞳色"><ColorSwatches palette={EYE_COLORS} value={spec.appearance.eyeColor} onChange={(v) => patchN('appearance', 'eyeColor', v)} /></Field>
      <Field label="肤色"><ColorSwatches palette={SKIN_COLORS} value={spec.appearance.skinColor} onChange={(v) => patchN('appearance', 'skinColor', v)} /></Field>
      <Field label="显著特征">
        <Chips options={FEATURES} values={spec.appearance.features} multiple onChange={(v) => patchN('appearance', 'features', v)} />
        <CustomAdd values={spec.appearance.features} onAdd={(v) => patchN('appearance', 'features', v)} placeholder="自定义特征…" />
      </Field>
    </Section>
  )

  const secPersonality = (
    <Section title="三、性格与行为" hint="滑块矩阵 + 关键词">
      <Field label="外向性"><Slider min={1} max={10} value={spec.personality.extroversion} left="内向" right="外向" onChange={(v) => patchN('personality', 'extroversion', v)} /></Field>
      <Field label="友善度"><Slider min={1} max={10} value={spec.personality.agreeableness} left="冷漠" right="热情" onChange={(v) => patchN('personality', 'agreeableness', v)} /></Field>
      <Field label="尽责性"><Slider min={1} max={10} value={spec.personality.conscientiousness} left="随性" right="严谨" onChange={(v) => patchN('personality', 'conscientiousness', v)} /></Field>
      <Field label="情绪稳定性"><Slider min={1} max={10} value={spec.personality.stability} left="敏感" right="沉稳" onChange={(v) => patchN('personality', 'stability', v)} /></Field>
      <Field label="开放性"><Slider min={1} max={10} value={spec.personality.openness} left="保守" right="好奇" onChange={(v) => patchN('personality', 'openness', v)} /></Field>
      <Field label="性格关键词"><Chips options={TRAITS} values={spec.personality.traits} multiple onChange={(v) => patchN('personality', 'traits', v)} /></Field>
    </Section>
  )

  const secBackground = (
    <Section title="四、背景与世界观" hint="填空 + 快捷模板">
      <Field label="出身">
        <Chips options={ORIGINS} values={spec.background.origin} onChange={(v) => patchN('background', 'origin', v)} />
        <input className={css.stInput} value={spec.background.origin} onChange={(e) => patchN('background', 'origin', e.target.value)} placeholder="或自定义出身" />
      </Field>
      <Field label="重要经历"><textarea className={cx(css.stInput, css.stTextarea)} rows={3} value={spec.background.experience} onChange={(e) => patchN('background', 'experience', e.target.value)} placeholder="影响角色性格的关键事件" /></Field>
      <Field label="世界观设定"><textarea className={cx(css.stInput, css.stTextarea)} rows={3} value={spec.background.world} onChange={(e) => patchN('background', 'world', e.target.value)} placeholder="故事发生的世界背景" /></Field>
    </Section>
  )

  const secAbilities = (
    <Section title="五、能力与特长" hint="标签多选 + 自定义">
      <Chips options={ABILITIES} values={spec.abilities} multiple onChange={(v) => patch('abilities', v)} />
      <CustomAdd values={spec.abilities} onAdd={(v) => patch('abilities', v)} placeholder="自定义能力…" />
    </Section>
  )

  const secDialogue = (
    <Section title="六、对话风格" hint="单选 + 引导">
      <Field label="风格预设"><select className={css.stInput} value={spec.dialogue.style} onChange={(e) => patchN('dialogue', 'style', e.target.value)}>{STYLE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
      <Field label="语气"><Chips options={TONES} values={spec.dialogue.tone} onChange={(v) => patchN('dialogue', 'tone', v)} /></Field>
      <Field label="人称"><RadioGroup options={PERSON_OPTS} value={spec.dialogue.person} onChange={(v) => patchN('dialogue', 'person', v)} /></Field>
    </Section>
  )

  const secScenario = (
    <Section title="七、场景与开场" hint="可选">
      <Field label="场景模板"><Chips options={SCENE_TEMPLATES} values={spec.scenario.sceneTemplate} onChange={(v) => patchN('scenario', 'sceneTemplate', v)} /></Field>
      <Field label="初始场景"><textarea className={cx(css.stInput, css.stTextarea)} rows={2} value={spec.scenario.scene} onChange={(e) => patchN('scenario', 'scene', e.target.value)} placeholder="自定义初始场景描述" /></Field>
      <Field label="开场白风格"><Chips options={OPENER_STYLES} values={spec.scenario.openerStyle} onChange={(v) => patchN('scenario', 'openerStyle', v)} /></Field>
    </Section>
  )

  const renderPreview = (): React.ReactElement => {
    if (generating) return <div className={css.stEmpty}><div className={css.stSpinner} /><div>正在生成角色卡…</div></div>
    if (card) {
      return (
        <div>
          {fallback ? <div className={css.stNotice}>注意：模型输出未能解析，已使用设定直接组装（降级模式）。可在「编辑」页微调。</div> : null}
          {fallback && rawText
            ? <details className={css.stRaw}><summary className={css.stRawSummary}>查看模型原始输出</summary><pre className={css.stRawPre}>{rawText}</pre></details>
            : null}
          <CardPreview card={card} avatar={avatar} />
        </div>
      )
    }
    return (
      <div>
        <div className={css.stLiveHint}>实时预览（基于当前设定，生成后替换为完整角色卡）</div>
        <pre className={css.stLivePre}>{describeSpec(spec)}</pre>
      </div>
    )
  }

  const renderEdit = (): React.ReactElement => {
    if (!card) return <div className={css.stEmpty}>请先点击「生成角色卡」</div>
    return (
      <div className={css.stEdit}>
        {CARD_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.area
              ? <textarea className={cx(css.stInput, css.stTextarea)} rows={4} value={cardFieldValue(f.key)} onChange={(e) => onCardFieldChange(f.key, e.target.value)} />
              : <input className={css.stInput} value={cardFieldValue(f.key)} onChange={(e) => onCardFieldChange(f.key, e.target.value)} />}
          </Field>
        ))}
      </div>
    )
  }

  const renderJson = (): React.ReactElement => (
    <div>
      <textarea className={cx(css.stInput, css.stTextarea, css.stJsonArea)} value={jsonDraft} onChange={(e) => setJsonDraft(e.target.value)} />
      <div className={cx(css.stRow, css.stGap)}>
        <Btn variant="primary" onClick={onApplyJson}>应用修改</Btn>
        <Btn onClick={exportJson}>导出 JSON</Btn>
      </div>
    </div>
  )

  const renderWorldbook = (): React.ReactElement => (
    <div>
      <div className={cx(css.stRow, css.stGap)}>
        <Btn variant="primary" disabled={wbGenerating} onClick={() => onWorldbook(false)}>{wbGenerating ? '生成中…' : '生成世界书'}</Btn>
        {worldbook && worldbook.entries.length === 0 ? <Btn disabled={wbGenerating} onClick={() => onWorldbook(true)}>补全世界书</Btn> : null}
        <label className={css.stBtn}>导入世界书<input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportWorldbookFile} /></label>
      </div>
      {wbError ? <div className={css.stNotice}>{wbError}</div> : null}
      {worldbook && worldbook.entries.length === 0 ? <div className={css.stNotice}>未能解析出世界书条目。可点「补全世界书」根据已生成的人物卡重新生成，或导入已有世界书 JSON。</div> : null}
      {worldbook?.entries.map((en, i) => (
        <div key={i} className={css.stWbEntry}>
          <div className={css.stWbKeys}>{(en.keys ?? []).map((k) => <span key={k} className={css.stWbKey}>{k}</span>)}</div>
          <div className={css.stCardBlockText}>{en.content}</div>
          {en.comment ? <div className={css.stWbComment}>{en.comment}</div> : null}
        </div>
      ))}
      {worldbook && worldbook.entries.length > 0
        ? <Btn onClick={() => downloadFile((spec.basic.name || 'character') + '.worldbook.json', new Blob([JSON.stringify({ entries: worldbook.entries }, null, 2)], { type: 'application/json' }))}>导出世界书 JSON</Btn>
        : null}
    </div>
  )

  const renderCharacter = (): React.ReactElement => {
    const resultBody = charTab === 'preview' ? renderPreview() : charTab === 'edit' ? renderEdit() : charTab === 'json' ? renderJson() : renderWorldbook()
    return (
      <div className={css.stChar}>
        {secAvatar}
        {secBasic}
        {secAppearance}
        {secPersonality}
        {secBackground}
        {secAbilities}
        {secDialogue}
        {secScenario}
        <div className={css.stActions}>
          <Btn variant="primary" disabled={generating} onClick={onGenerate}>{generating ? '生成中…' : '生成角色卡'}</Btn>
          <Btn onClick={exportJson}>导出 JSON</Btn>
          <Btn onClick={onJoinParty} title="把当前角色变成队伍成员；属性由角色卡推导，之后可在队伍页调整">加入队伍</Btn>
          <label className={css.stBtn}>导入角色卡<input type="file" accept=".json,.png,application/json,image/png" style={{ display: 'none' }} onChange={onImportCardFile} /></label>
          <span className={css.stVerToggle}>
            <button type="button" className={cx(css.stVerBtn, version === 'v2' && css.stVerActive)} onClick={() => setVersion('v2')}>V2</button>
            <button type="button" className={cx(css.stVerBtn, version === 'v3' && css.stVerActive)} onClick={() => setVersion('v3')}>V3</button>
          </span>
          {error ? <div className={css.stNotice}>{error}</div> : null}
        </div>
        <div className={css.stTpl}>
          <div className={css.stTplHead}>模板（保存/载入当前设定）</div>
          <div className={css.stCustomAdd}>
            <input className={css.stInput} value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="模板名称" />
            <Btn onClick={onSaveTemplate}>保存模板</Btn>
          </div>
          {templates.length
            ? (
              <div className={css.stChipWrap}>
                {templates.map((t, i) => (
                  <span key={i} className={css.stTplItem}>
                    <button type="button" className={css.stChip} onClick={() => setSpec(JSON.parse(JSON.stringify(t.spec)))}>{t.name}</button>
                    <button type="button" className={css.stTplDel} title="删除" onClick={() => { const list = templates.filter((_, j) => j !== i); setTemplates(list); saveTemplates(list) }}>x</button>
                  </span>
                ))}
              </div>
            )
            : null}
        </div>
        <div className={css.stLib}>
          <div className={css.stLibHead}>角色库（本地保存角色卡与对话记录）</div>
          <div className={css.stCustomAdd}>
            <Btn variant="primary" disabled={!card} onClick={onSaveCharacter}>保存当前角色到库</Btn>
          </div>
          {savedChars.length
            ? savedChars.map((c) => (
                <div key={c.id} className={css.stLibItem}>
                  {c.avatar ? <img className={css.stLibAvatar} src={c.avatar} alt={c.name} /> : <span className={css.stLibAvatarFallback}>{(c.name || '?').slice(0, 1)}</span>}
                  <div className={css.stLibName}>{c.name}</div>
                  <span className={css.stLibMeta}>{c.chat.length} 条 · {new Date(c.savedAt).toLocaleDateString()}</span>
                  <Btn onClick={() => onLoadCharacter(c)}>载入</Btn>
                  <button type="button" className={css.stTplDel} title="删除" onClick={() => onDeleteCharacter(c.id)}>x</button>
                </div>
              ))
            : <div className={css.stLibMeta}>暂无保存的角色</div>}
        </div>
        <div className={css.stResultWrap}>
          <div className={css.stResultTabs}>
            {[{ id: 'preview', label: '预览' }, { id: 'edit', label: '编辑' }, { id: 'json', label: 'JSON' }, { id: 'worldbook', label: '世界书' }].map((t) => (
              <button key={t.id} type="button" className={cx(css.stTab, charTab === t.id && css.stTabActive)} onClick={() => setCharTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className={css.stResultBody}>{resultBody}</div>
        </div>
      </div>
    )
  }

  const renderSettings = (): React.ReactElement => (
    <div className={css.stChar}>
      <Section title="对话系统提示词" hint="每次对话前注入，类似 SillyTavern 的 System Prompt" defaultOpen>
        <Field label="全局指令（注入到角色设定之前，支持 {{char}} / {{user}} 占位符）">
          <textarea className={cx(css.stInput, css.stTextarea)} rows={5} value={globalPrompt} onChange={(e) => setGlobalPrompt(e.target.value)} placeholder="例如：你是一位专业的故事叙述者，始终沉浸角色、不跳出、不提及任何设定与规则，使用中文回复……" />
        </Field>
      </Section>
      <Section title="外观" defaultOpen>
        <Field label={'面板宽度：' + tavern.width + 'px'}><Slider min={360} max={820} value={tavern.width} left="窄" right="宽" onChange={(v) => updateTavern('width', v)} /></Field>
        <Field label="悬浮按钮">
          <label className={css.stCheck}>
            <input type="checkbox" checked={showTrigger} onChange={(e) => onToggleTrigger(e.target.checked)} />
            {showTrigger ? '显示（可拖动停靠）' : '隐藏（从 DSH 设置页打开酒馆）'}
          </label>
        </Field>
        <Field label="主题色">
          <div className={css.stSwatches}>
            <input type="color" value={tavern.accent} onChange={(e) => updateTavern('accent', e.target.value)} className={css.stColorInput} />
            <input className={cx(css.stInput, css.stColorText)} value={tavern.accent} onChange={(e) => updateTavern('accent', e.target.value)} />
          </div>
        </Field>
        <Field label="背景图片">
          <div className={cx(css.stRow, css.stGap)}>
            <label className={css.stBtn}>选择图片<input type="file" accept="image/*" style={{ display: 'none' }} onChange={onBgImageFile} /></label>
            {bgImage ? <Btn onClick={() => { setBgImage(''); saveBgImage('') }}>清除</Btn> : null}
          </div>
        </Field>
        {bgImage
          ? (
            <Field label={'背景图强度：' + Math.round(tavern.bgOpacity * 100) + '%'}>
              <Slider
                min={0}
                max={70}
                value={Math.round(tavern.bgOpacity * 100)}
                left="几乎看不见"
                right="很明显"
                onChange={(v) => updateTavern('bgOpacity', v / 100)}
              />
              <div className={css.stLabel}>
                用玻璃拟态这类半透明主题时调高一点，壁纸才会真的透出来；调太高会影响文字可读性。
              </div>
            </Field>
          )
          : null}
      </Section>
      <Section title="模型接入" hint="默认直接使用 DSH 当前配置的模型与密钥；填写后可改走你自己的 OpenAI 兼容接口">
        <Field label="接口地址（Base URL，自动拼接 /chat/completions）">
          <input className={css.stInput} value={llmDraft.baseUrl} onChange={(e) => setLlmDraft({ ...llmDraft, baseUrl: e.target.value })} placeholder="https://api.deepseek.com" />
        </Field>
        <Field label="API Key（仅保存在本浏览器，密码框遮蔽显示）">
          <input className={css.stInput} type="password" value={llmDraft.apiKey} onChange={(e) => setLlmDraft({ ...llmDraft, apiKey: e.target.value })} placeholder="sk-…" autoComplete="off" />
        </Field>
        <Field label="模型名称">
          <input className={css.stInput} value={llmDraft.model} onChange={(e) => setLlmDraft({ ...llmDraft, model: e.target.value })} placeholder="deepseek-chat" />
        </Field>
        <Field label={'当前状态：' + (customConfigured ? '已启用自定义接口（角色卡 / 世界书 / 聊天可用）' : '未启用（使用 DSH 默认模型）')}>
          <div className={cx(css.stRow, css.stGap)}>
            <Btn variant="primary" disabled={llmTesting} onClick={onTestLlm}>{llmTesting ? '测试中…' : '保存并测试连接'}</Btn>
            {customConfigured ? <Btn onClick={onClearLlm}>清除配置</Btn> : null}
          </div>
        </Field>
        {llmTestResult ? <div className={css.stNotice}>{llmTestResult}</div> : null}
        <div className={css.stLabel}>API Key 只存在本机浏览器 localStorage，仅发送给本机酒馆路由转发请求，不写入任何日志；聊天页的模型下拉中选择「自定义」即可切换到该接口。</div>
      </Section>
      <Section title="采样温度" hint="修复部分模型固定 temperature 导致的 400 报错">
        <Field label="发送方式">
          <RadioGroup
            options={[
              { value: 'auto', label: '自动（推荐）' },
              { value: 'fixed', label: '固定数值' },
              { value: 'omit', label: '不发送该字段' },
            ]}
            value={sampling.mode}
            onChange={(v) => { const next = { ...sampling, mode: v as 'auto' | 'fixed' | 'omit' }; setSampling(next); saveSampling(next) }}
          />
        </Field>
        {sampling.mode === 'fixed'
          ? (
            <Field label={'温度值：' + sampling.value.toFixed(2)}>
              <Slider
                min={0}
                max={2}
                value={sampling.value}
                left="稳定"
                right="发散"
                onChange={(v) => { const next = { ...sampling, value: v }; setSampling(next); saveSampling(next) }}
              />
            </Field>
          )
          : null}
        <div className={css.stLabel}>
          自动模式按每次任务给出默认温度（角色卡 0.85 / 世界书 0.7 / 聊天 0.9）。若某个模型只接受固定温度（例如 KIMI K3 只允许 1）或直接拒绝该字段，宿主会从上游报错里读出限制并自动记住，接下来对该模型一律按限制发送，用户不会再看到这条 400。选择「不发送」可手动强制省略。
        </div>
      </Section>
      <Section title="扩展设置面板" hint="社区扩展把自己的设置界面挂在这里" defaultOpen={false}>
        <div className={css.stLabel}>
          已启用的扩展会把它们的设置面板插入下面的「扩展面板」区域（对应 SillyTavern 的 #extensions_settings
          与 #extensions_settings2 挂载点）。如果那里是空的，说明当前没有启用任何需要设置界面的扩展。
        </div>
      </Section>
      {/*
        The mount is deliberately NOT inside a collapsible Section: the
        compatibility host looks for it by id the moment the tavern mounts, and
        a collapsed section renders no children -- which is exactly why the host
        used to give up and park its panel in a floating dock over the chat box.
      */}
      <div id="pt-ext-mount" className={css.stExtMount} />
      <Section title="存储" hint="角色卡、队伍、对话都存在本机浏览器里" defaultOpen={false}>
        <div className={css.stLabel}>
          {storageUsage === null
            ? '正在读取占用…'
            : '本机已用 ' + formatBytes(storageUsage.usage) + '，浏览器给这个站点分配了 ' + formatBytes(storageUsage.quota) + '。'
              + '角色卡和队伍的图片是主要占用，存在 IndexedDB 里（不是 5MB 的 localStorage）。'}
        </div>
        <div className={css.stLabel}>
          IndexedDB 里保存的是：当前工作区、角色库、队伍库、桌面上的队伍、每个人的对话、当前这局冒险。
        </div>
        {storageIssue !== null
          ? <div className={css.stNotice}>最近一次失败（{storageIssue.op === 'write' ? '写入' : '读取'}）：{storageIssue.message}</div>
          : <div className={css.stLabel}>最近没有保存失败。</div>}
      </Section>
      <Section title="本地音乐" defaultOpen>
        <Field label="本地音乐（支持文件夹、按顺序播放）">
          <div className={cx(css.stRow, css.stGap)}>
            <label className={css.stBtn}>打开文件夹<input type="file" {...{ webkitdirectory: 'true', directory: 'true' } as any} multiple accept="audio/*" style={{ display: 'none' }} onChange={onMusicFolder} /></label>
            <label className={css.stBtn}>选择单曲<input type="file" accept="audio/*" style={{ display: 'none' }} onChange={onMusicFile} /></label>
            {playlist.length ? <Btn onClick={stopMusic}>停止并清空</Btn> : null}
          </div>
          {playlist.length ? <div className={css.stLabel}>播放列表（{playlist.length} 首）</div> : null}
        </Field>
      </Section>
    </div>
  )


  /**
   * Every conversation the panel can show: the character card's thread under
   * the key 'card', plus one per party member. The card thread keeps living in
   * the workspace record, so this is a view rather than a second store.
   */
  const threads: Record<string, ChatMessage[]> = { card: chatMessages, ...memberThreads }

  /** Split an edited thread map back into the two stores. */
  const onThreads = (next: Record<string, ChatMessage[]>): void => {
    setChatMessages(next.card ?? [])
    const rest: Record<string, ChatMessage[]> = {}
    for (const key of Object.keys(next)) {
      if (key !== 'card') rest[key] = next[key]
    }
    setMemberThreads(rest)
  }

  /** What a party member needs to know about the adventure in progress. */
  const adventureContext = (rpg.scene !== '' || rpg.encounter !== null || rpg.log.length > 0)
    ? {
      scene: rpg.scene,
      beat: [...rpg.log].reverse().find((e) => e.kind === 'scene')?.text ?? '',
      encounter: rpg.encounter === null
        ? null
        : {
          title: rpg.encounter.title,
          description: rpg.encounter.description,
          options: rpg.encounter.options.map((o) => o.label),
        },
    }
    : undefined

  const renderChatPanel = (): React.ReactElement => (
    <ChatPanel
      api={api}
      card={card}
      cardAvatar={avatar}
      spec={spec}
      party={party}
      threads={threads}
      onThreads={onThreads}
      target={chatTarget}
      onTarget={setChatTarget}
      globalPrompt={globalPrompt}
      chatModel={chatModel}
      onModel={setChatModel}
      modelOptions={modelOptions}
      customConfigured={customConfigured}
      customModel={llmDraft.model}
      adventure={adventureContext}
      onCarryPlan={(plan) => { setCarryPlan(plan); setTab('rpg') }}
      onGotoCharacter={() => setTab('character')}
    />
  )

  const renderRpg = (): React.ReactElement => (
    <RpgPanel
      api={api}
      party={party}
      onParty={setParty}
      state={rpg}
      onState={setRpg}
      chatModel={chatModel}
      customConfigured={customConfigured}
      customModel={llmDraft.model}
      onGotoParty={() => setTab('party')}
      incomingAction={carryPlan}
      onIncomingConsumed={() => setCarryPlan('')}
    />
  )

  const renderParty = (): React.ReactElement => (
    <PartyPanel
      party={party}
      onChange={setParty}
      library={parties}
      onSave={() => {
        const entry: Party = { ...JSON.parse(JSON.stringify(party)) as Party, savedAt: Date.now() }
        const list = parties.some((p) => p.id === entry.id)
          ? parties.map((p) => (p.id === entry.id ? entry : p))
          : [...parties, entry]
        setParties(list)
        void saveRecord(HEAVY_KEYS.parties, list)
      }}
      onLoad={(id) => {
        const found = parties.find((p) => p.id === id)
        if (found) setParty(JSON.parse(JSON.stringify(found)) as Party)
      }}
      onDelete={(id) => {
        const list = parties.filter((p) => p.id !== id)
        setParties(list)
        void saveRecord(HEAVY_KEYS.parties, list)
      }}
      modelOptions={modelOptions}
      customConfigured={customConfigured}
      customModel={llmDraft.model}
      onExportCard={(member) => {
        // The reverse of 加入队伍: a companion becomes a standard card.
        const exported = cardFromMember(member)
        downloadFile((member.name || 'companion') + '.json', new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }))
      }}
    />
  )

  const renderPlugins = (): React.ReactElement => (
    <ExtPanel
      api={api}
      enabled={extEnabled}
      onToggle={onToggleExt}
      onChanged={refreshExt}
      log={extLog}
      theme={extTheme}
      onTheme={onTheme}
    />
  )

  const track = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null

  return (
    <div className={css.stPanel} style={{ width: tavern.width, '--st-accent': tavern.accent, visibility: props.open ? 'visible' : 'hidden', pointerEvents: props.open ? 'auto' : 'none' } as React.CSSProperties}>
      {bgImage
        ? (
          <div
            className={css.stPanelBg}
            style={{ backgroundImage: 'url(' + bgImage + ')', opacity: tavern.bgOpacity }}
          />
        )
        : null}
      <div className={css.stPanelHead}>
        <span className={css.stPanelTitle}>便携酒馆</span>
        {storageIssue !== null
          ? <span className={css.stStorageWarn} title={storageIssue.message}>存储告警</span>
          : null}
        <button type="button" className={css.stClose} onClick={() => props.store.set(false)}>×</button>
      </div>
      {storageIssue !== null
        ? (
          <div className={css.stNotice} style={{ margin: '8px 14px 0' }}>
            保存失败（{storageIssue.op === 'write' ? '写入' : '读取'}）：{storageIssue.message}。
            这次的改动可能不会在刷新后保留 —— 详情见「设置 → 存储」。
          </div>
        )
        : null}
      <div className={css.stTabbar}>
        {TABS.map((t) => (
          <button key={t.id} type="button" className={cx(css.stTab, tab === t.id && css.stTabActive)} onClick={() => setTab(t.id)} title={t.title}>{t.label}</button>
        ))}
      </div>
      <div className={css.stPanelBody}>
        {tab === 'chat' ? renderChatPanel()
          : tab === 'rpg' ? renderRpg()
            : tab === 'party' ? renderParty()
              : tab === 'plugins' ? renderPlugins()
                : tab === 'settings' ? null
                  : renderCharacter()}
        {/*
          The settings pane is always mounted and merely hidden when another tab
          is active. It owns #pt-ext-mount, and an installed extension's settings
          panel has to have somewhere to live from the moment the tavern opens --
          unmounting it made the compatibility host fall back to its floating
          dock, which then lingered after switching to 设置.
        */}
        <div style={{ display: tab === 'settings' ? 'block' : 'none', height: '100%' }}>
          {renderSettings()}
        </div>
      </div>
      {track
        ? (
          <div className={css.stMusicBar}>
            <audio
              ref={audioRef}
              className={css.stAudio}
              controls
              onTimeUpdate={(e) => { positionRef.current = e.currentTarget.currentTime }}
              onPlay={() => {
                playingRef.current = true
                wantPlayRef.current = true
                saveMusicState({ index: indexRef.current, position: positionRef.current, playing: true })
              }}
              onPause={() => {
                playingRef.current = false
                // A pause caused by swapping in the next track is not the user
                // asking for silence.
                if (!loadingRef.current) wantPlayRef.current = false
                saveMusicState({ index: indexRef.current, position: positionRef.current, playing: wantPlayRef.current })
              }}
              onEnded={nextTrack}
            />
            <div className={css.stMusicInfo} title={track.name}>{(currentIndex + 1) + '/' + playlist.length + ' · ' + track.name}</div>
            <Btn onClick={prevTrack} title="上一首">上一首</Btn>
            <Btn onClick={nextTrack} title="下一首">下一首</Btn>
            <Btn onClick={stopMusic} title="停止">停止</Btn>
          </div>
        )
        : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// floating trigger + panel root
// ---------------------------------------------------------------------------

let dragState: { sx: number; sy: number; ox: number; oy: number } | null = null
let dragged = false

export function TavernRoot(props: { store: TavernStore }): React.ReactElement {
  const open = useStoreValue(props.store)
  const showTrigger = useStoreValue(triggerStore)
  const [pos, setPos] = useState(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    return { left: Math.max(0, vw - 60), top: Math.round(vh * 0.44) }
  })

  const onDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    dragState = { sx: e.clientX, sy: e.clientY, ox: pos.left, oy: pos.top }
    dragged = false
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (!dragState) return
    const dx = e.clientX - dragState.sx
    const dy = e.clientY - dragState.sy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const maxX = Math.max(0, vw - 60)
    const maxY = Math.max(0, vh - 60)
    setPos({ left: Math.max(0, Math.min(maxX, dragState.ox + dx)), top: Math.max(0, Math.min(maxY, dragState.oy + dy)) })
  }
  const onUp = (): void => { dragState = null }
  const onClick = (): void => { if (dragged) { dragged = false; return } props.store.set(true) }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const dock = pos.left < 12 ? 'left' : (pos.left > vw - 90 ? 'right' : 'none')
  const shared = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onClick }

  const trigger = dock === 'left'
    ? <button type="button" className={cx(css.stTrigger, css.stTriggerDockedLeft)} style={{ left: 0, top: pos.top }} {...shared}>便携酒馆</button>
    : dock === 'right'
      ? <button type="button" className={cx(css.stTrigger, css.stTriggerDockedRight)} style={{ right: 0, top: pos.top }} {...shared}>便携酒馆</button>
      : <button type="button" className={cx(css.stTrigger, css.stTriggerFloat)} style={{ left: pos.left, top: pos.top }} {...shared}>便携酒馆</button>

  return (
    <div className={css.stRoot}>
      {showTrigger ? <div style={{ display: open ? 'none' : 'block' }}>{trigger}</div> : null}
      <PortableTavern store={props.store} open={open} />
    </div>
  )
}

export function SettingsEntry(props: { onOpen: () => void }): React.ReactElement {
  const showTrigger = useStoreValue(triggerStore)
  return (
    <div className={css.stSettingsEntry}>
      <div className={css.stSettingsTitle}>便携酒馆</div>
      <p className={css.stSettingsDesc}>RPG 角色卡生成 + 酒馆聊天一体。通过可视化面板塑造角色，一键生成 SillyTavern 角色卡，并直接在右侧与角色对话。</p>
      <div className={cx(css.stRow, css.stGap)}>
        <button type="button" className={cx(css.stBtn, css.stBtnPrimary)} onClick={props.onOpen}>打开便携酒馆</button>
        <label className={css.stCheck}>
          <input type="checkbox" checked={showTrigger} onChange={(e) => setTriggerVisible(e.target.checked)} />
          悬浮按钮
        </label>
      </div>
      <span className={css.stSectionHint}>关闭悬浮按钮后，仍可从此页打开酒馆</span>
    </div>
  )
}

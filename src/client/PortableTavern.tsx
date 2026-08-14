/**
 * Portable Tavern browser surface: the draggable floating entry plus the
 * three-tab panel (character card / chat / settings). Pure React; all data
 * goes through the TavernApi fetch client. No emoji, per repo rules.
 */

import { useEffect, useState } from 'react'
import type * as React from 'react'
import type { ChatMessage, CharCard, TavernSpec, WorldbookEntry } from '../protocol.ts'
import { TavernApi } from './api.ts'
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

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ')
}

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

function loadTavernSettings(): { width: number; accent: string } {
  try {
    const raw = localStorage.getItem('dsh.portable-tavern.settings.v1')
    const s = raw ? JSON.parse(raw) : {}
    return { width: s.width || 540, accent: s.accent || '#4f7cff' }
  } catch { return { width: 540, accent: '#4f7cff' } }
}
function saveTavernSettings(s: { width: number; accent: string }): void {
  try { localStorage.setItem('dsh.portable-tavern.settings.v1', JSON.stringify(s)) } catch { /* quota */ }
}
function loadBgImage(): string {
  try { return localStorage.getItem('dsh.portable-tavern.bgimage.v1') || '' } catch { return '' }
}
function saveBgImage(v: string): void {
  try { if (v) localStorage.setItem('dsh.portable-tavern.bgimage.v1', v); else localStorage.removeItem('dsh.portable-tavern.bgimage.v1') } catch { /* quota */ }
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
// tiny form primitives
// ---------------------------------------------------------------------------

function Section(props: { title: string; hint?: string; defaultOpen?: boolean; children: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(props.defaultOpen !== false)
  return (
    <div className={css.stSection}>
      <button type="button" className={css.stSectionHead} onClick={() => setOpen(!open)}>
        <span className={css.stSectionTitle}>{props.title}</span>
        {props.hint ? <span className={css.stSectionHint}>{props.hint}</span> : null}
        <span className={css.stSectionCaret}>{open ? '-' : '+'}</span>
      </button>
      {open ? <div className={css.stSectionBody}>{props.children}</div> : null}
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={css.stField}>
      <div className={css.stLabel}>{props.label}</div>
      {props.children}
    </div>
  )
}

function Slider(props: { min: number; max: number; value: number; left: string; right: string; onChange: (v: number) => void }): React.ReactElement {
  return (
    <div className={css.stSliderRow}>
      <span className={css.stSliderEnd}>{props.left}</span>
      <input type="range" min={props.min} max={props.max} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} className={css.stSlider} />
      <span className={css.stSliderEnd}>{props.right}</span>
      <span className={css.stSliderVal}>{props.value}</span>
    </div>
  )
}

function RadioGroup(props: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }): React.ReactElement {
  return (
    <div className={css.stRadioGroup}>
      {props.options.map((o) => (
        <label key={o.value} className={cx(css.stRadio, props.value === o.value && css.stRadioActive)}>
          <input type="radio" checked={props.value === o.value} onChange={() => props.onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

function Chips(props: { options: string[]; values: string[] | string; multiple?: boolean; onChange: (v: string[] | string) => void }): React.ReactElement {
  const multiple = props.multiple === true
  const values = multiple ? (props.values as string[]) : [props.values as string]
  return (
    <div className={css.stChipWrap}>
      {props.options.map((o) => {
        const active = values.includes(o)
        return (
          <button
            key={o}
            type="button"
            className={cx(css.stChip, active && css.stChipActive)}
            onClick={() => {
              if (multiple) props.onChange(active ? values.filter((v) => v !== o) : [...values, o])
              else props.onChange(o)
            }}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function ColorSwatches(props: { palette: string[]; value: string; onChange: (v: string) => void }): React.ReactElement {
  return (
    <div className={css.stSwatches}>
      {props.palette.map((c) => (
        <button key={c} type="button" className={cx(css.stSwatch, props.value === c && css.stSwatchActive)} style={{ background: c }} title={c} onClick={() => props.onChange(c)} />
      ))}
      <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} className={css.stColorInput} title="自定义颜色" />
      <input className={cx(css.stInput, css.stColorText)} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  )
}

function CustomAdd(props: { values: string[]; onAdd: (v: string[]) => void; placeholder: string }): React.ReactElement {
  const [v, setV] = useState('')
  const submit = (): void => {
    const t = v.trim()
    if (t && !props.values.includes(t)) props.onAdd([...props.values, t])
    setV('')
  }
  return (
    <div className={css.stCustomAdd}>
      <input className={css.stInput} value={v} onChange={(e) => setV(e.target.value)} placeholder={props.placeholder} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
      <button type="button" className={cx(css.stBtn, css.stBtnSm)} onClick={submit}>添加</button>
    </div>
  )
}

function Btn(props: { children: React.ReactNode; variant?: 'primary' | 'ghost'; disabled?: boolean; onClick?: () => void; title?: string }): React.ReactElement {
  return (
    <button
      type="button"
      className={cx(css.stBtn, props.variant === 'primary' && css.stBtnPrimary, props.variant === 'ghost' && css.stBtnGhost, props.disabled && css.stBtnDisabled)}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
    >
      {props.children}
    </button>
  )
}

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

function downloadFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
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
  const [bgImage, setBgImage] = useState(loadBgImage)
  const [playlist, setPlaylist] = useState<{ id: string; name: string; url: string; blob?: Blob }[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  const patch = (key: keyof TavernSpec, value: unknown): void => setSpec((prev) => ({ ...prev, [key]: value }))
  const patchN = <K extends keyof TavernSpec>(section: K, key: string, value: unknown): void =>
    setSpec((prev) => ({ ...prev, [section]: { ...(prev[section] as unknown as Record<string, unknown>), [key]: value } }))

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
      if (tracks.length) {
        setPlaylist(tracks.map((t) => ({ id: t.id, name: t.name, url: URL.createObjectURL(t.blob) })))
        setCurrentIndex(0)
      }
    })
  }, [])
  useEffect(() => {
    const el = document.getElementById('pt-chat-log')
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages, chatSending])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveWorkspace({ spec, card, worldbook, chat: chatMessages, version, chatModel, globalPrompt, avatar })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [spec, card, worldbook, chatMessages, version, chatModel, globalPrompt, avatar])

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

  const onSend = (): void => {
    const text = chatInput.trim()
    if (!text || chatSending || !card) return
    const next = [...chatMessages, { role: 'user' as const, content: text }]
    setChatMessages(next); setChatInput(''); setChatSending(true); setChatError('')
    const parts = (chatModel || '').split('::')
    const provider = parts.length >= 2 && parts[0] ? parts[0] : undefined
    const model = parts.length >= 2 ? parts.slice(1).join('::') : undefined
    void api.chat(card, next, provider, model, globalPrompt).then((res) => {
      setChatMessages([...next, { role: 'assistant', content: res.reply }])
    }).catch((e) => setChatError(e instanceof Error ? e.message : '回复失败')).finally(() => setChatSending(false))
  }

  const onClearChat = (): void => {
    const g = card ? cleanPlaceholders(card.data.first_mes, card.data.name) : ''
    setChatMessages(g ? [{ role: 'assistant', content: g }] : [])
    setChatError('')
  }

  const updateTavern = (key: 'width' | 'accent', value: number | string): void => {
    setTavern((prev) => { const n = { ...prev, [key]: value }; saveTavernSettings(n); return n })
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

  const nextTrack = (): void => setCurrentIndex((i) => (playlist.length ? (i + 1) % playlist.length : -1))
  const prevTrack = (): void => setCurrentIndex((i) => (playlist.length ? (i - 1 + playlist.length) % playlist.length : -1))
  const stopMusic = (): void => { setPlaylist([]); setCurrentIndex(-1); saveMusic([]) }

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
    setSavedChars(list); saveCharacters(list); setError('')
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
    setSavedChars(list); saveCharacters(list)
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

  const renderChat = (): React.ReactElement => {
    if (!card) {
      return (
        <div className={css.stEmpty}>
          <div className={css.stEmptyEmoji}>Tavern</div>
          <div>还没有角色。请先到「角色卡」页设定/导入角色，再来开聊。</div>
          <Btn variant="primary" onClick={() => setTab('character')}>去创建角色</Btn>
        </div>
      )
    }
    const d = card.data
    return (
      <div className={css.stChat}>
        <div className={css.stChatHead}>
          <div className={css.stChatAvatar} style={avatar ? undefined : { background: avatarGradient(spec) }}>
            {avatar ? <img className={css.stChatAvatarImg} src={avatar} alt={d.name} /> : (d.name || '?').slice(0, 1)}
          </div>
          <div className={css.stChatMeta}>
            <div className={css.stChatName}>{d.name || '未命名角色'}</div>
            <select className={cx(css.stInput, css.stChatModel)} value={chatModel} onChange={(e) => setChatModel(e.target.value)}>
              {modelOptions.length === 0 ? <option value="">加载模型…</option> : null}
              {modelOptions.map((o) => <option key={o.provider + '::' + o.model} value={o.provider + '::' + o.model}>{o.label}</option>)}
            </select>
          </div>
          <Btn onClick={onClearChat} title="清空对话">清空</Btn>
        </div>
        <div id="pt-chat-log" className={css.stChatLog}>
          {chatMessages.map((m, i) => (
            <div key={i} className={cx(css.stMsg, m.role === 'assistant' ? css.stMsgChar : css.stMsgUser)}>
              {m.role === 'assistant'
                ? (
                  <div className={css.stMsgAvatar} style={avatar ? undefined : { background: avatarGradient(spec) }}>
                    {avatar ? <img className={css.stMsgAvatarImg} src={avatar} alt={d.name} /> : (d.name || '?').slice(0, 1)}
                  </div>
                )
                : null}
              <div className={css.stMsgBubble}>{m.content}</div>
            </div>
          ))}
        </div>
        {chatError ? <div className={cx(css.stNotice, css.stChatError)}>{chatError}</div> : null}
        <div className={css.stChatInput}>
          <textarea className={cx(css.stInput, css.stTextarea)} rows={2} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="输入对白或动作…（Enter 发送，Shift+Enter 换行）" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }} />
          <Btn variant="primary" disabled={chatSending || !chatInput.trim()} onClick={onSend}>{chatSending ? '…' : '发送'}</Btn>
        </div>
      </div>
    )
  }

  const track = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null

  return (
    <div className={css.stPanel} style={{ width: tavern.width, '--st-accent': tavern.accent, visibility: props.open ? 'visible' : 'hidden', pointerEvents: props.open ? 'auto' : 'none' } as React.CSSProperties}>
      {bgImage ? <div className={css.stPanelBg} style={{ backgroundImage: 'url(' + bgImage + ')' }} /> : null}
      <div className={css.stPanelHead}>
        <span className={css.stPanelTitle}>便携酒馆</span>
        <button type="button" className={css.stClose} onClick={() => props.store.set(false)}>×</button>
      </div>
      <div className={css.stTabbar}>
        <button type="button" className={cx(css.stTab, tab === 'character' && css.stTabActive)} onClick={() => setTab('character')}>角色卡</button>
        <button type="button" className={cx(css.stTab, tab === 'chat' && css.stTabActive)} onClick={() => setTab('chat')}>聊天</button>
        <button type="button" className={cx(css.stTab, tab === 'settings' && css.stTabActive)} onClick={() => setTab('settings')}>设置</button>
      </div>
      <div className={css.stPanelBody}>
        {tab === 'chat' ? renderChat() : tab === 'settings' ? renderSettings() : renderCharacter()}
      </div>
      {track
        ? (
          <div className={css.stMusicBar}>
            <audio key={currentIndex} className={css.stAudio} src={track.url} controls autoPlay onEnded={nextTrack} />
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
      <div style={{ display: open ? 'none' : 'block' }}>{trigger}</div>
      <PortableTavern store={props.store} open={open} />
    </div>
  )
}

export function SettingsEntry(props: { onOpen: () => void }): React.ReactElement {
  return (
    <div className={css.stSettingsEntry}>
      <div className={css.stSettingsTitle}>便携酒馆</div>
      <p className={css.stSettingsDesc}>RPG 角色卡生成 + 酒馆聊天一体。通过可视化面板塑造角色，一键生成 SillyTavern 角色卡，并直接在右侧与角色对话。</p>
      <button type="button" className={cx(css.stBtn, css.stBtnPrimary)} onClick={props.onOpen}>打开便携酒馆</button>
    </div>
  )
}

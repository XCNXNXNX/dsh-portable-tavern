/**
 * Party model and persistence for the tavern's tabletop mode.
 *
 * A team is a plain JSON document -- members, their portraits, their stats and,
 * crucially, their individual model routes -- so saving, loading, exporting and
 * sharing one is just reading and writing that document. Nothing here talks to
 * the network.
 */

import {
  INHERIT_ROUTE,
  type MemberRoute,
  type Party,
  type PartyMember,
  type RpgState,
} from '../protocol.ts'

const PARTIES_KEY = 'dsh.portable-tavern.parties.v1'
const ACTIVE_KEY = 'dsh.portable-tavern.activeParty.v1'
const SESSION_KEY = 'dsh.portable-tavern.rpg.v1'

/** Attribute display metadata (mirrors the engine table for UI use). */
export const PARTY_ATTRS: { id: keyof PartyMember['attributes']; label: string; short: string; blurb: string }[] = [
  { id: 'str', label: '力量', short: 'STR', blurb: '近战、负重、蛮力破障' },
  { id: 'dex', label: '敏捷', short: 'DEX', blurb: '闪避、潜行、逃跑、先手' },
  { id: 'con', label: '体质', short: 'CON', blurb: '抗毒、耐痛、长途跋涉' },
  { id: 'int', label: '智力', short: 'INT', blurb: '学识、解谜、法术解析' },
  { id: 'wis', label: '感知', short: 'WIS', blurb: '察觉、直觉、追踪' },
  { id: 'cha', label: '魅力', short: 'CHA', blurb: '说服、谈判、威吓' },
]

/** Pick-from list for the role line. */
export const ROLE_PRESETS = ['剑士', '法师', '游侠', '盗贼', '牧师', '吟游诗人', '炼金术士', '骑士', '斥候', '术士', '武僧', '驯兽师']

/** Pick-from list for skills; the bonus is a starting suggestion. */
export const SKILL_PRESETS: { name: string; attr: PartyMember['skills'][number]['attr']; bonus: number }[] = [
  { name: '剑术', attr: 'str', bonus: 6 },
  { name: '格斗', attr: 'str', bonus: 6 },
  { name: '攀爬', attr: 'str', bonus: 4 },
  { name: '潜行', attr: 'dex', bonus: 6 },
  { name: '闪避', attr: 'dex', bonus: 6 },
  { name: '开锁', attr: 'dex', bonus: 4 },
  { name: '耐力', attr: 'con', bonus: 5 },
  { name: '抗毒', attr: 'con', bonus: 4 },
  { name: '博学', attr: 'int', bonus: 5 },
  { name: '法术', attr: 'int', bonus: 7 },
  { name: '炼金', attr: 'int', bonus: 5 },
  { name: '察觉', attr: 'wis', bonus: 6 },
  { name: '追踪', attr: 'wis', bonus: 5 },
  { name: '医术', attr: 'wis', bonus: 4 },
  { name: '说服', attr: 'cha', bonus: 6 },
  { name: '威吓', attr: 'cha', bonus: 5 },
  { name: '表演', attr: 'cha', bonus: 5 },
]

/** Skill-name autocomplete pool. */
export const SKILL_NAMES = SKILL_PRESETS.map((s) => s.name)

/** Total attribute points a member may distribute (6 attributes, min 6 each). */
export const ATTR_BUDGET = 66
/** Floor for a single attribute. */
export const ATTR_MIN = 6
/** Ceiling for a single attribute. */
export const ATTR_MAX = 18

/** Sum of a member's attribute scores. */
export function attrTotal(attributes: PartyMember['attributes']): number {
  return Object.values(attributes).reduce((a, b) => a + b, 0)
}

/** Build a fresh member with a sensible spread. */
export function makeMember(index: number, patch?: Partial<PartyMember>): PartyMember {
  const base: PartyMember = {
    id: 'm' + Date.now().toString(36) + '-' + index + '-' + Math.floor(Math.random() * 100000).toString(36),
    name: '队员 ' + (index + 1),
    role: '',
    avatar: '',
    prompt: '',
    attributes: { str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11 },
    skills: [],
    hp: 20,
    maxHp: 20,
    status: [],
    llm: { ...INHERIT_ROUTE },
  }
  if (!patch) return base
  return {
    ...base,
    ...patch,
    attributes: { ...base.attributes, ...(patch.attributes ?? {}) },
    skills: patch.skills ?? base.skills,
    status: patch.status ?? base.status,
    llm: { ...base.llm, ...(patch.llm ?? {}) },
  }
}

/** Build a fresh empty team. */
export function makeParty(name = '新的队伍'): Party {
  return {
    id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 100000).toString(36),
    name,
    members: [makeMember(0)],
    narratorPrompt: '',
    narrator: { ...INHERIT_ROUTE },
    savedAt: Date.now(),
  }
}

/** A fresh adventure state for a party. */
export function makeRpgState(): RpgState {
  return { scene: '', turn: 0, log: [], encounter: null, pending: null, inventory: [], facts: [] }
}

/** Human label for a member's model route. */
export function routeLabel(route: MemberRoute): string {
  if (route.mode === 'dsh') return route.model === '' ? 'DSH 指定模型' : route.model
  if (route.mode === 'custom') return route.customModel === '' ? '自定义接口' : '自定义 · ' + route.customModel
  return '跟随全局'
}

/** Deep-copy a JSON document (used for save/load so edits stay isolated). */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

/** Every saved team. */
export function loadParties(): Party[] {
  try {
    const raw = localStorage.getItem(PARTIES_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return (list as Party[]).map((p) => ({ ...p, members: Array.isArray(p.members) ? p.members : [] }))
  } catch { return [] }
}

/** Persist the team library. */
export function saveParties(list: Party[]): void {
  try { localStorage.setItem(PARTIES_KEY, JSON.stringify(list)) } catch { /* quota */ }
}

/** Id of the team currently on the table. */
export function loadActivePartyId(): string {
  try { return localStorage.getItem(ACTIVE_KEY) ?? '' } catch { return '' }
}

/** Remember which team is on the table. */
export function saveActivePartyId(id: string): void {
  try { localStorage.setItem(ACTIVE_KEY, id) } catch { /* quota */ }
}

/** The in-progress adventure. */
export function loadRpgState(): RpgState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<RpgState>
    return {
      scene: typeof parsed.scene === 'string' ? parsed.scene : '',
      turn: typeof parsed.turn === 'number' ? parsed.turn : 0,
      log: Array.isArray(parsed.log) ? parsed.log : [],
      encounter: parsed.encounter ?? null,
      pending: parsed.pending ?? null,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    }
  } catch { return null }
}

/** Persist the in-progress adventure. */
export function saveRpgState(state: RpgState): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)) } catch { /* quota */ }
}

/** Drop the in-progress adventure. */
export function clearRpgState(): void {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

/** Normalize an imported team document, filling in every missing field. */
export function normalizeParty(raw: unknown): Party | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.members)) return null
  const members = record.members
    .map((m, i) => {
      if (typeof m !== 'object' || m === null) return null
      return makeMember(i, m as Partial<PartyMember>)
    })
    .filter((m): m is PartyMember => m !== null)
  if (members.length === 0) return null
  return {
    id: typeof record.id === 'string' ? record.id : 'p' + Date.now().toString(36),
    name: typeof record.name === 'string' ? record.name : '导入的队伍',
    members,
    narratorPrompt: typeof record.narratorPrompt === 'string' ? record.narratorPrompt : '',
    narrator: { ...INHERIT_ROUTE, ...(typeof record.narrator === 'object' && record.narrator !== null ? record.narrator as Partial<MemberRoute> : {}) },
    savedAt: typeof record.savedAt === 'number' ? record.savedAt : Date.now(),
  }
}

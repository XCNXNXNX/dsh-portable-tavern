/**
 * The /api/dsh-portable-tavern route family: card generation, world-book
 * generation, model listing, and chat. Every route consumes LLM quota, so it
 * carries a loopback-only trust fence (plus browser same-origin markers) —
 * LAN-exposed dsh web deployments must not serve these endpoints.
 */

import { randomInt } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import {
  DEFAULT_TEMPERATURE_POLICY,
  TAVERN_API,
  TAVERN_EXT_BASE,
  type ApiErrorBody,
  type CharCard,
  type ChatMessage,
  type CheckResult,
  type Encounter,
  type LlmCustom,
  type MemberChatRequest,
  type PartyMember,
  type PendingCheck,
  type RpgMemberRequest,
  type RpgNarrateRequest,
  type RpgState,
  type RpgTurnRequest,
  type StInstallRequest,
  type TavernSpec,
  type TemperaturePolicy,
} from './protocol.ts'
import { temperatureReport } from './temperature.ts'
import { buildPending, draftOutline, draftScenario, gmNarrate, gmTurn, memberChat, memberLine } from './rpg/gm.ts'
import { judge, type ComputedCheck } from './rpg/engine.ts'
import {
  contentTypeOf,
  installExtension,
  listBuiltin,
  listInstalled,
  readExtensionFile,
  removeExtension,
} from './extensions/store.ts'
import { chatReply, generateCard, generateWorldbook, listModels, testCustom } from './llm.ts'

/** Cap on JSON request bodies (specs and chat histories are small). */
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024

/** Extract a sanitized custom-endpoint config from a request body, if any. */
function readCustom(body: Record<string, unknown> | undefined): LlmCustom | undefined {
  const raw = body?.custom
  if (typeof raw !== 'object' || raw === null) return undefined
  const record = raw as Record<string, unknown>
  const baseUrl = typeof record.baseUrl === 'string' ? record.baseUrl.trim() : ''
  const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : ''
  const model = typeof record.model === 'string' ? record.model.trim() : ''
  if (baseUrl === '' || apiKey === '' || model === '') return undefined
  if (baseUrl.length > 2000 || apiKey.length > 500 || model.length > 200) return undefined
  return { baseUrl, apiKey, model }
}

/**
 * Read the sampling policy from a request body (issue #1). Anything malformed
 * falls back to the default, so an old browser bundle keeps working.
 * @param body - the parsed JSON request body.
 */
function readSampling(body: Record<string, unknown> | undefined): TemperaturePolicy {
  const raw = body?.sampling
  if (typeof raw !== 'object' || raw === null) return DEFAULT_TEMPERATURE_POLICY
  const record = raw as Record<string, unknown>
  const mode = record.mode
  if (mode !== 'auto' && mode !== 'fixed' && mode !== 'omit') return DEFAULT_TEMPERATURE_POLICY
  const value = typeof record.value === 'number' && Number.isFinite(record.value)
    ? Math.min(2, Math.max(0, record.value))
    : DEFAULT_TEMPERATURE_POLICY.value
  return { mode, value }
}


// ---------------------------------------------------------------------------
// RPG payload readers (the RPG routes take richer bodies than the card routes,
// so each nested structure is validated once, here)
// ---------------------------------------------------------------------------

const ATTR_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

/** Coerce an attribute block, clamping every score into the table range. */
function readAttributes(raw: unknown): PartyMember['attributes'] {
  const record = isRecord(raw) ? raw : {}
  const out = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  for (const key of ATTR_KEYS) {
    const value = record[key]
    out[key] = typeof value === 'number' && Number.isFinite(value) ? Math.min(30, Math.max(1, Math.round(value))) : 10
  }
  return out
}

/** Coerce the skill list. */
function readSkills(raw: unknown): PartyMember['skills'] {
  if (!Array.isArray(raw)) return []
  const out: PartyMember['skills'] = []
  for (const item of raw.slice(0, 40)) {
    if (!isRecord(item)) continue
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (name === '') continue
    const attr = ATTR_KEYS.includes(item.attr as typeof ATTR_KEYS[number]) ? item.attr as typeof ATTR_KEYS[number] : 'str'
    const bonus = typeof item.bonus === 'number' && Number.isFinite(item.bonus) ? Math.min(30, Math.max(-10, Math.round(item.bonus))) : 0
    out.push({ name: name.slice(0, 40), attr, bonus })
  }
  return out
}

/** Coerce the per-member model route. */
function readRoute(raw: unknown): PartyMember['llm'] {
  const record = isRecord(raw) ? raw : {}
  const mode = record.mode === 'dsh' || record.mode === 'custom' ? record.mode : 'inherit'
  return {
    mode,
    provider: typeof record.provider === 'string' ? record.provider.trim().slice(0, 100) : '',
    model: typeof record.model === 'string' ? record.model.trim().slice(0, 200) : '',
    baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl.trim().slice(0, 2000) : '',
    apiKey: typeof record.apiKey === 'string' ? record.apiKey.trim().slice(0, 500) : '',
    customModel: typeof record.customModel === 'string' ? record.customModel.trim().slice(0, 200) : '',
  }
}

/** Read one party member, or null when the body is unusable. */
function readMember(raw: unknown): PartyMember | null {
  if (!isRecord(raw)) return null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (name === '') return null
  const maxHp = typeof raw.maxHp === 'number' && Number.isFinite(raw.maxHp) ? Math.min(9999, Math.max(1, Math.round(raw.maxHp))) : 20
  const hp = typeof raw.hp === 'number' && Number.isFinite(raw.hp) ? Math.min(maxHp, Math.max(0, Math.round(raw.hp))) : maxHp
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : 'm' + Math.random().toString(36).slice(2, 8),
    name: name.slice(0, 60),
    role: typeof raw.role === 'string' ? raw.role.trim().slice(0, 60) : '',
    avatar: typeof raw.avatar === 'string' ? raw.avatar : '',
    prompt: typeof raw.prompt === 'string' ? raw.prompt.slice(0, 4000) : '',
    attributes: readAttributes(raw.attributes),
    skills: readSkills(raw.skills),
    hp,
    maxHp,
    status: Array.isArray(raw.status) ? raw.status.filter((s): s is string => typeof s === 'string').slice(0, 20) : [],
    llm: readRoute(raw.llm),
  }
}

/** Read the whole party, dropping entries that cannot be used. */
function readParty(raw: unknown): PartyMember[] {
  if (!Array.isArray(raw)) return []
  const out: PartyMember[] = []
  for (const item of raw.slice(0, 24)) {
    const member = readMember(item)
    if (member !== null) out.push(member)
  }
  return out
}

/** Read one encounter option. */
function readOption(raw: unknown, index: number): Encounter['options'][number] | null {
  if (!isRecord(raw)) return null
  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  if (label === '') return null
  const attribute = ATTR_KEYS.includes(raw.attribute as typeof ATTR_KEYS[number]) ? raw.attribute as typeof ATTR_KEYS[number] : ''
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : 'o' + (index + 1),
    label: label.slice(0, 40),
    attribute,
    skill: typeof raw.skill === 'string' ? raw.skill.trim().slice(0, 40) : '',
    difficulty: typeof raw.difficulty === 'number' && Number.isFinite(raw.difficulty) ? raw.difficulty : 55,
    modifier: typeof raw.modifier === 'number' && Number.isFinite(raw.modifier) ? raw.modifier : 0,
    hint: typeof raw.hint === 'string' ? raw.hint.slice(0, 200) : '',
  }
}

/** Read one encounter. */
function readEncounter(raw: unknown): Encounter | null {
  if (!isRecord(raw)) return null
  const options = (Array.isArray(raw.options) ? raw.options : [])
    .slice(0, 6)
    .map((o, i) => readOption(o, i))
    .filter((o): o is Encounter['options'][number] => o !== null)
  if (options.length === 0) return null
  return {
    id: typeof raw.id === 'string' ? raw.id : 'e1',
    kind: typeof raw.kind === 'string' ? raw.kind : 'other',
    title: typeof raw.title === 'string' ? raw.title.slice(0, 80) : '遭遇',
    description: typeof raw.description === 'string' ? raw.description.slice(0, 600) : '',
    threat: typeof raw.threat === 'number' && Number.isFinite(raw.threat) ? Math.min(100, Math.max(0, raw.threat)) : 50,
    options,
  }
}

/** Read a pending check posted back by the browser. */
function readPending(raw: unknown): PendingCheck | null {
  if (!isRecord(raw)) return null
  const option = readOption(raw.option, 0)
  if (option === null) return null
  if (!isRecord(raw.computed)) return null
  const computed = raw.computed
  const required = typeof computed.required === 'number' && Number.isFinite(computed.required) ? computed.required : null
  if (required === null) return null
  const breakdown = Array.isArray(computed.breakdown)
    ? computed.breakdown
      .filter((row): row is Record<string, unknown> => isRecord(row))
      .map((row) => ({
        label: typeof row.label === 'string' ? row.label : '',
        value: typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : 0,
      }))
    : []
  return {
    memberId: typeof raw.memberId === 'string' ? raw.memberId : '',
    option,
    kind: typeof raw.kind === 'string' ? raw.kind : 'other',
    threat: typeof raw.threat === 'number' && Number.isFinite(raw.threat) ? Math.min(100, Math.max(0, raw.threat)) : 50,
    computed: {
      actorId: typeof computed.actorId === 'string' ? computed.actorId : '',
      actorName: typeof computed.actorName === 'string' ? computed.actorName : '角色',
      optionId: typeof computed.optionId === 'string' ? computed.optionId : option.id,
      optionLabel: typeof computed.optionLabel === 'string' ? computed.optionLabel : option.label,
      required,
      breakdown,
      difficultyLabel: typeof computed.difficultyLabel === 'string' ? computed.difficultyLabel : '普通',
    },
  }
}

/** Loopback literal check plus browser same-origin markers. */
function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try { hostUrl = new URL('http://' + host) } catch { return false }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try { return new URL(origin).host === hostUrl.host } catch { return false }
}

/** One JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

function writeError(res: ServerResponse, status: number, error: string): void {
  writeJson(res, status, { error } satisfies ApiErrorBody)
}

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** Plain-object check shared by the route guards. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Structural sanity for a TavernSpec: the nested section objects must exist. */
function looksLikeSpec(value: unknown): value is TavernSpec {
  if (!isRecord(value)) return false
  const spec = value as Record<string, unknown>
  return isRecord(spec.basic) && isRecord(spec.appearance) && isRecord(spec.personality)
    && isRecord(spec.background) && isRecord(spec.dialogue) && isRecord(spec.scenario)
}

/** Structural sanity for a V2/V3 character card: the data object must exist. */
function looksLikeCard(value: unknown): value is CharCard {
  return isRecord(value) && isRecord((value as Record<string, unknown>).data)
}

/**
 * Build every /api/dsh-portable-tavern route.
 * @param ctx - host context carrying webServer and llm.
 * @returns the exact-path route list.
 */
export function makeRoutes(ctx: Context): WebRoute[] {
  /** Guard helper: fence + method check. */
  const guard = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (!isLoopbackRequest(req)) {
      writeError(res, 403, 'forbidden: loopback-only')
      return false
    }
    if (req.method !== method) {
      writeError(res, 405, 'method not allowed: ' + (req.method ?? ''))
      return false
    }
    return true
  }

  const routes: WebRoute[] = [
    {
      kind: 'exact',
      path: TAVERN_API.generate,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeError(res, 400, 'invalid JSON body')
          return
        }
        if (!looksLikeSpec(body.spec)) {
          writeError(res, 400, 'spec 缺少必需的设定分组（basic/appearance/personality/background/dialogue/scenario）')
          return
        }
        const spec = body.spec as TavernSpec
        const version = body.version === 'v3' ? 'v3' : 'v2'
        try {
          const { card, rawText, fallback } = await generateCard(ctx, spec, version, readCustom(body), readSampling(body))
          writeJson(res, 200, { card, rawText, fallback })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.worldbook,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeError(res, 400, 'invalid JSON body')
          return
        }
        if (!looksLikeSpec(body.spec)) {
          writeError(res, 400, 'spec 缺少必需的设定分组（basic/appearance/personality/background/dialogue/scenario）')
          return
        }
        const spec = body.spec as TavernSpec
        const card = (body.card === null || body.card === undefined ? null : looksLikeCard(body.card) ? body.card as CharCard : null)
        try {
          const { entries, rawText } = await generateWorldbook(ctx, spec, card, readCustom(body), readSampling(body))
          writeJson(res, 200, { entries, rawText })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.models,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          const { options, current } = await listModels(ctx)
          writeJson(res, 200, { options, current, learnedTemperatures: temperatureReport() })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.chat,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeError(res, 400, 'invalid JSON body')
          return
        }
        if (!looksLikeCard(body.card)) {
          writeError(res, 400, 'card 必须是包含 data 对象的 V2/V3 角色卡')
          return
        }
        const card = body.card as CharCard
        const messages = (Array.isArray(body.messages) ? body.messages.filter((m): m is ChatMessage => isRecord(m) && (m.role === 'user' || m.role === 'assistant') && typeof (m as Record<string, unknown>).content === 'string') : []) as ChatMessage[]
        const provider = typeof body.provider === 'string' ? body.provider : undefined
        const model = typeof body.model === 'string' ? body.model : undefined
        const globalPrompt = typeof body.globalPrompt === 'string' ? body.globalPrompt : undefined
        try {
          const reply = await chatReply(ctx, card, messages, provider, model, globalPrompt, readCustom(body), readSampling(body))
          writeJson(res, 200, { reply })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.test,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const custom = readCustom(body)
        if (custom === undefined) {
          writeError(res, 400, '自定义接口未填写完整（地址 / API Key / 模型）')
          return
        }
        try {
          const result = await testCustom(custom, readSampling(body))
          writeJson(res, 200, result)
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },

    // -----------------------------------------------------------------------
    // tabletop RPG: the system arbitrates, the model narrates
    // -----------------------------------------------------------------------
    {
      kind: 'exact',
      path: TAVERN_API.rpgTurn,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        if (!isRecord(body.state)) { writeError(res, 400, 'state 必须是包含 scene/log 的跑团状态对象'); return }
        const action = typeof body.action === 'string' ? body.action.trim() : ''
        if (action === '') { writeError(res, 400, 'action 不能为空'); return }
        const request: RpgTurnRequest = {
          state: body.state as unknown as RpgState,
          party: readParty(body.party),
          action,
          narratorPrompt: typeof body.narratorPrompt === 'string' ? body.narratorPrompt : '',
          provider: typeof body.provider === 'string' ? body.provider : undefined,
          model: typeof body.model === 'string' ? body.model : undefined,
          sampling: readSampling(body),
          custom: readCustom(body),
        }
        try {
          writeJson(res, 200, await gmTurn(ctx, request))
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.rpgCheck,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        const member = readMember(body.member)
        if (member === null) { writeError(res, 400, 'member 不是合法的队伍成员'); return }
        const encounter = readEncounter(body.encounter)
        if (encounter === null) { writeError(res, 400, 'encounter 不是合法的遭遇对象'); return }
        const optionId = typeof body.optionId === 'string' ? body.optionId : ''
        const option = encounter.options.find((o) => o.id === optionId) ?? encounter.options[0]
        if (option === undefined) { writeError(res, 400, '遭遇没有任何可选行动'); return }
        const penalty = typeof body.penalty === 'number' && Number.isFinite(body.penalty) ? body.penalty : 0
        try {
          const pending = buildPending(member, option, encounter.kind, encounter.threat, penalty)
          writeJson(res, 200, { pending })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.rpgRoll,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        const pending = readPending(body.pending)
        if (pending === null) { writeError(res, 400, 'pending 不是合法的待判定对象'); return }
        try {
          // The authoritative throw: crypto-backed, host-side, one per call.
          const roll = 1 + randomInt(0, 100)
          const result = judge(
            pending.computed as unknown as ComputedCheck,
            roll,
            pending.kind,
            pending.threat,
            body.critEnabled !== false,
          )
          writeJson(res, 200, result satisfies CheckResult)
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.rpgNarrate,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        if (!isRecord(body.state) || !isRecord(body.result)) {
          writeError(res, 400, 'state 与 result 都是必需对象')
          return
        }
        const request: RpgNarrateRequest = {
          state: body.state as unknown as RpgState,
          party: readParty(body.party),
          action: typeof body.action === 'string' ? body.action : '当前行动',
          result: body.result as unknown as CheckResult,
          narratorPrompt: typeof body.narratorPrompt === 'string' ? body.narratorPrompt : '',
          provider: typeof body.provider === 'string' ? body.provider : undefined,
          model: typeof body.model === 'string' ? body.model : undefined,
          sampling: readSampling(body),
          custom: readCustom(body),
        }
        try {
          writeJson(res, 200, await gmNarrate(ctx, request))
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.rpgMember,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        const member = readMember(body.member)
        if (member === null) { writeError(res, 400, 'member 不是合法的队伍成员'); return }
        const request: RpgMemberRequest = {
          member,
          state: (isRecord(body.state) ? body.state : { scene: '', turn: 0, log: [], encounter: null, pending: null, inventory: [], facts: [] }) as unknown as RpgState,
          beat: typeof body.beat === 'string' ? body.beat : '',
          instruction: typeof body.instruction === 'string' ? body.instruction : '',
          sampling: readSampling(body),
        }
        try {
          writeJson(res, 200, await memberLine(ctx, request))
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },

    // -----------------------------------------------------------------------
    // SillyTavern extension host
    // -----------------------------------------------------------------------
    {
      kind: 'exact',
      path: TAVERN_API.extList,
      handler: (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          writeJson(res, 200, { installed: listInstalled(), builtin: listBuiltin() })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.extCatalog,
      handler: (req, res) => {
        if (!guard(req, res, 'GET')) return
        // A curated short list of well-known, mostly-CSS community extensions.
        // Nothing is fetched here: the user installs one explicitly.
        writeJson(res, 200, {
          entries: [
            { name: 'SillyTavern-Not-A-Discord-Theme', url: 'https://github.com/IceFog72/SillyTavern-Not-A-Discord-Theme', note: '纯 CSS 皮肤，Discord 风格' },
            { name: 'SillyTavern-TypefaceR', url: 'https://github.com/b4bysw0rld/SillyTavern-TypefaceR', note: '字体美化，零依赖' },
            { name: 'SillyTavern-MoonlitEchoesTheme', url: 'https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme', note: '主题框架，带设置面板' },
            { name: 'SillyTavern-CustomThemeStyleInputs', url: 'https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs', note: '主题变量输入面板' },
            { name: 'SillyTavern-CharacterStyleCustomizer', url: 'https://github.com/Sovex666/SillyTavern-CharacterStyleCustomizer', note: '按角色注入样式' },
            { name: 'Guinevere-UI-Extension', url: 'https://github.com/Bronya-Rand/Guinevere-UI-Extension', note: 'UI 大改（依赖 jQuery）' },
          ],
        })
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.extInstall,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        const request: StInstallRequest = {
          url: typeof body.url === 'string' ? body.url : undefined,
          zipBase64: typeof body.zipBase64 === 'string' ? body.zipBase64 : undefined,
          id: typeof body.id === 'string' ? body.id : undefined,
          overwrite: body.overwrite === true,
        }
        if (request.zipBase64 !== undefined && request.zipBase64.length > 64 * 1024 * 1024) {
          writeError(res, 413, 'zip 过大（上限约 48MB）')
          return
        }
        try {
          const { extension, report } = await installExtension(request)
          writeJson(res, 200, { ok: true, extension, warnings: report.warnings, stubs: report.stubs })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.extRemove,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        const id = typeof body.id === 'string' ? body.id : ''
        if (id === '') { writeError(res, 400, '缺少 id'); return }
        try {
          writeJson(res, 200, { ok: removeExtension(id) })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },

    {
      kind: 'exact',
      path: TAVERN_API.rpgScenario,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        try {
          writeJson(res, 200, await draftScenario(ctx, {
            party: readParty(body.party),
            hint: typeof body.hint === 'string' ? body.hint.slice(0, 4000) : '',
            provider: typeof body.provider === 'string' ? body.provider : undefined,
            model: typeof body.model === 'string' ? body.model : undefined,
            custom: readCustom(body),
            sampling: readSampling(body),
          }))
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.rpgOutline,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        try {
          writeJson(res, 200, await draftOutline(ctx, {
            party: readParty(body.party),
            premise: typeof body.premise === 'string' ? body.premise.slice(0, 6000) : '',
            count: typeof body.count === 'number' ? body.count : 4,
            provider: typeof body.provider === 'string' ? body.provider : undefined,
            model: typeof body.model === 'string' ? body.model : undefined,
            custom: readCustom(body),
            sampling: readSampling(body),
          }))
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
    {
      kind: 'exact',
      path: TAVERN_API.chatMember,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) { writeError(res, 400, 'invalid JSON body'); return }
        const member = readMember(body.member)
        if (member === null) { writeError(res, 400, 'member 不是合法的队伍成员'); return }
        const messages = (Array.isArray(body.messages) ? body.messages : [])
          .filter((m): m is ChatMessage => isRecord(m) && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-40)
        if (messages.length === 0) { writeError(res, 400, 'messages 不能为空'); return }
        const adventure = isRecord(body.adventure)
          ? {
            scene: typeof body.adventure.scene === 'string' ? body.adventure.scene.slice(0, 2000) : '',
            beat: typeof body.adventure.beat === 'string' ? body.adventure.beat.slice(0, 2000) : '',
            encounter: readEncounter(body.adventure.encounter) === null
              ? null
              : {
                title: (readEncounter(body.adventure.encounter) as Encounter).title,
                description: (readEncounter(body.adventure.encounter) as Encounter).description,
                options: (readEncounter(body.adventure.encounter) as Encounter).options.map((o) => o.label),
              },
          }
          : undefined
        try {
          writeJson(res, 200, await memberChat(ctx, {
            member,
            messages,
            adventure,
            inherit: isRecord(body.inherit)
              ? {
                provider: typeof body.inherit.provider === 'string' ? body.inherit.provider : undefined,
                model: typeof body.inherit.model === 'string' ? body.inherit.model : undefined,
                custom: readCustom({ custom: body.inherit.custom }),
              }
              : undefined,
            sampling: readSampling(body),
          }))
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
  ]

  // The extension file carrier. A prefix route (not one exact route per file)
  // keeps the route table small no matter how many extensions are installed.
  routes.push({
    kind: 'prefix',
    path: TAVERN_EXT_BASE,
    handler: (req, res) => {
      if (!isLoopbackRequest(req)) { writeError(res, 403, 'forbidden: loopback-only'); return }
      if (req.method !== 'GET' && req.method !== 'HEAD') { writeError(res, 405, 'method not allowed'); return }
      const url = new URL(req.url ?? '/', 'http://x')
      const rest = url.pathname.slice(TAVERN_EXT_BASE.length).replace(/^\/+/, '')
      const slash = rest.indexOf('/')
      const id = slash < 0 ? rest : rest.slice(0, slash)
      const file = slash < 0 ? '' : rest.slice(slash + 1)
      if (id === '' || file === '') { writeError(res, 404, 'not found'); return }
      let decoded: string
      try { decoded = decodeURIComponent(file) } catch { writeError(res, 400, 'malformed path'); return }
      const found = readExtensionFile(id, decoded)
      if (found === null) { writeError(res, 404, 'not found'); return }
      res.writeHead(200, {
        'content-type': found.type,
        'cache-control': 'no-cache',
        'referrer-policy': 'no-referrer',
        'access-control-allow-origin': '*',
      })
      if (req.method === 'HEAD') { res.end(); return }
      res.end(found.body)
    },
  })

  return routes
}


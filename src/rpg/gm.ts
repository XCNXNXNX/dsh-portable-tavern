/**
 * The narrator half of the RPG mode.
 *
 * Division of labour, enforced by the shape of this module: the GM model is
 * only ever asked for *prose* plus a *request for arbitration* (which attribute,
 * which difficulty, which options). It is never asked for a success or a
 * failure. Every number -- the required roll, the margin, the band, the hit
 * points lost -- comes from ./engine.ts and is handed back to the GM as an
 * already-decided fact it may only describe.
 */

import type { Context } from '@deepseek-ai/cordis'
import { parseResult, routeCompletion, type RouteRequest } from '../llm.ts'
import type {
  CheckResult,
  Encounter,
  EncounterOption,
  PartyMember,
  PendingCheck,
  RpgMemberRequest,
  RpgMemberResponse,
  RpgNarrateRequest,
  RpgNarrateResponse,
  RpgState,
  RpgTurnRequest,
  RpgTurnResponse,
} from '../protocol.ts'
import { ATTRS, actorSummary, computeCheck, type Actor, type AttrId } from './engine.ts'

/** Valid attribute ids, used to sanitize whatever the model returns. */
const ATTR_IDS: AttrId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** Encounter kinds the engine knows how to price consequences for. */
const KINDS = ['combat', 'chase', 'social', 'environment', 'other']

/** The GM's standing instruction. */
export const GM_SYSTEM = [
  '你是「便携酒馆」跑团模式的守秘人（GM）。你负责世界、NPC、剧情推进与叙述。',
  '',
  '【铁律：判定权不属于你】',
  '掷骰、难度、属性加成、成功与失败，全部由系统计算与裁定。你绝对不能自行决定某个行动成功还是失败，也不要写出"你成功了/你失败了"这类结论——那是系统的职责。',
  '当你认为一个行动的结果不确定、且后果重要时，调用 gm_turn 工具并提出 check 或 encounter，把裁决交给系统。',
  '当消息里出现【系统判定】区块时，说明系统已经裁定完毕：你只能描写它如何发生，不得推翻、不得更改成败、也不要把数字念给玩家听。',
  '',
  '【你只需要产出两样东西】',
  '一是叙述（narration），二是需要系统仲裁的行动请求。请求有两种形态：',
  '1. check —— 玩家在这一回合声明了一个具体行动（"我翻窗逃出去"），需要立刻判定，而且**没有别的合理选择**。填 check，给出这个行动靠哪个属性、哪项技能、基础难度多少、有没有情景修正。系统会立刻算出"至少要掷出多少"，玩家掷骰后你再叙述结果。',
  '2. encounter —— 需要玩家做选择时填这个。给出 2 到 4 个可选行动（战斗 / 逃跑 / 交涉 / 观察 …），每个选项都要带上判定所需的字段。系统会为每个选项算出需要的掷骰数，玩家选一个再掷。',
  '3. 只是推进叙述、不需要任何判定时，两者都留空。',
  '',
  '【什么时候必须填 encounter（重要）】',
  '出现下面任何一种情况，**一律填 encounter，不要填 check**：',
  '- 一个新的威胁登场：怪物、追兵、敌意 NPC、陷阱、天灾。此时至少要有"正面对抗"和"回避/逃跑"两类选项，让玩家自己决定打还是跑。',
  '- 玩家面前出现多条路，且各条路代价不同（绕远但安全 / 直穿但危险 / 回头）。',
  '- 需要说服、欺骗或贿赂一个 NPC，而这几种做法后果不同。',
  '换句话说：只要玩家"可以怎么选"本身是这场戏的重点，就用 encounter 把选择权交还给他，而不是替他决定。',
  '只有当玩家刚刚亲口宣告了要做什么、且没有别的合理选项时，才用 check。',
  '',
  '【数值约定】',
  'difficulty 是"不考虑角色能力时，这件事本身有多难"，请从这些锚点里挑最贴近的：25 轻而易举 / 40 轻松 / 55 普通 / 70 困难 / 82 极难 / 92 九死一生。',
  'modifier 是情景修正，正数代表更难，一般取 -20 到 +20 之间的小值，没有就填 0。',
  'threat 是对手强度，0 到 100，50 是势均力敌。',
  'attribute 只能是 str / dex / con / int / wis / cha，分别对应力量 / 敏捷 / 体质 / 智力 / 感知 / 魅力。纯粹靠运气的事就填空字符串。',
  'skill 填一项具体技能名（例如 潜行、说服、攀爬），角色恰好会就加成、不会也没关系，留空也可以。',
  '',
  '【叙述风格】',
  '第二人称，写玩家看到、听到、闻到的东西；节奏紧凑，一次只推进一小步，不要一口气写完一整段冒险。',
  '不要替玩家做决定，不要替玩家说话，不要代替玩家选择选项。长度控制在 250 到 450 字。',
  '全程使用中文。',
].join('\n')

/** Shared schema fragment for one selectable action. */
const OPTION_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string', description: '按钮文字，2-6 个字，例如 战斗 / 逃跑 / 交涉' },
    attribute: { type: 'string', enum: [...ATTR_IDS, ''], description: '这次尝试依靠的属性；纯运气填空字符串' },
    skill: { type: 'string', description: '相关技能名，可留空' },
    difficulty: { type: 'number', description: '情境基础难度，从 25/40/55/70/82/92 中挑选' },
    modifier: { type: 'number', description: '情景修正，正数更难，通常 -20..20' },
    hint: { type: 'string', description: '一句话说明这个选项的风险与收益' },
  },
  required: ['label', 'attribute', 'difficulty'],
}

/** The structured turn the GM must produce. */
export const GM_TURN_TOOL = {
  name: 'gm_turn',
  description: '提交本回合的叙述；当行动需要判定时，给出系统要仲裁的 check 或 encounter',
  parameters: {
    type: 'object',
    properties: {
      narration: { type: 'string', description: '本回合叙述正文，第二人称，250-450 字' },
      scene: { type: 'string', description: '用一段话更新"当前场景"摘要，供后续回合复用' },
      facts: {
        type: 'array',
        items: { type: 'string' },
        description: '本回合新确立、后续必须保持一致的事实（人物、地点、伏笔、承诺）。没有就返回空数组',
      },
      check: {
        ...OPTION_SCHEMA,
        description: '当玩家本回合声明的行动需要立刻判定时填写；否则不要包含该字段',
      },
      checkKind: { type: 'string', enum: KINDS, description: 'check 所属的遭遇类型，用于结算后果' },
      checkThreat: { type: 'number', description: 'check 的对手强度 0-100' },
      encounter: {
        type: 'object',
        description: '当剧情需要玩家抉择时填写；否则不要包含该字段',
        properties: {
          kind: { type: 'string', enum: KINDS, description: '遭遇类型' },
          title: { type: 'string', description: '遭遇标题，例如 腐沼潜伏者' },
          description: { type: 'string', description: '一两句话说明眼前的处境与利害' },
          threat: { type: 'number', description: '对手强度 0-100' },
          options: { type: 'array', items: OPTION_SCHEMA, description: '2-4 个可选行动' },
        },
        required: ['kind', 'title', 'options'],
      },
    },
    required: ['narration'],
  },
}

/** The structured result of narrating an already-decided check. */
export const GM_NARRATE_TOOL = {
  name: 'gm_narrate',
  description: '系统已给出判定结果，请只叙述这次行动如何发生',
  parameters: {
    type: 'object',
    properties: {
      narration: { type: 'string', description: '本次行动的叙述正文，第二人称，200-400 字' },
      scene: { type: 'string', description: '更新后的当前场景摘要' },
      encounter: {
        type: 'object',
        description: '若这次结果直接把剧情推到了一个新的抉择关口，在这里给出；否则省略',
        properties: {
          kind: { type: 'string', enum: KINDS },
          title: { type: 'string' },
          description: { type: 'string' },
          threat: { type: 'number' },
          options: { type: 'array', items: OPTION_SCHEMA },
        },
        required: ['kind', 'title', 'options'],
      },
    },
    required: ['narration'],
  },
}

/** The structured line one party member contributes. */
export const MEMBER_TOOL = {
  name: 'member_line',
  description: '提交这名队伍成员本回合的言行',
  parameters: {
    type: 'object',
    properties: {
      line: { type: 'string', description: '这名成员本回合的言行，1-3 句，可含动作神态' },
    },
    required: ['line'],
  },
}

/** Coerce an untrusted number into range. */
function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Coerce an untrusted string. */
function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

/** Turn whatever the model emitted into a safe option. */
export function coerceOption(raw: unknown, index: number): EncounterOption {
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const attribute = str(record.attribute) as AttrId | ''
  return {
    id: 'o' + (index + 1),
    label: str(record.label) || ('选项 ' + (index + 1)),
    attribute: ATTR_IDS.includes(attribute as AttrId) ? attribute as AttrId : '',
    skill: str(record.skill),
    difficulty: num(record.difficulty, 55, 5, 95),
    modifier: num(record.modifier, 0, -40, 40),
    hint: str(record.hint),
  }
}

/** Turn a model-emitted encounter into a safe one, or null when unusable. */
export function coerceEncounter(raw: unknown, fallbackThreat = 50): Encounter | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const optionsRaw = Array.isArray(record.options) ? record.options : []
  const options = optionsRaw.slice(0, 4).map((o, i) => coerceOption(o, i))
  if (options.length === 0) return null
  const kind = str(record.kind, 'other')
  return {
    id: 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
    kind: KINDS.includes(kind) ? kind : 'other',
    title: str(record.title) || '遭遇',
    description: str(record.description),
    threat: num(record.threat, fallbackThreat, 0, 100),
    options,
  }
}

/** Turn a model-emitted check request into a safe option, or null. */
export function coerceCheck(raw: unknown): EncounterOption | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  if (str(record.label) === '' && record.difficulty === undefined) return null
  const option = coerceOption(record, 0)
  option.id = 'act'
  option.label = option.label === '选项 1' ? '当前行动' : option.label
  return option
}

/** Render one party member's sheet for the GM prompt. */
export function describeParty(party: PartyMember[]): string {
  if (party.length === 0) return '（队伍为空）'
  return party.map((m) => {
    const actor = m as unknown as Actor
    const lines = ['- ' + actorSummary(actor)]
    if (m.role) lines.push('  定位：' + m.role)
    if (m.prompt) lines.push('  人设：' + m.prompt.replace(/\s+/g, ' ').slice(0, 200))
    return lines.join('\n')
  }).join('\n')
}

/** Render the recent adventure log for the GM prompt. */
export function recentLog(state: RpgState, limit: number): string {
  const entries = (state.log ?? []).slice(-limit)
  if (entries.length === 0) return '（冒险刚刚开始）'
  return entries.map((e) => {
    if (e.kind === 'speech') return '【' + e.who + '】' + e.text
    if (e.kind === 'action') return '【玩家行动】' + e.text
    if (e.kind === 'check' && e.check) {
      return '【判定】' + e.check.bandLabel + '：掷出 ' + e.check.roll + '，需要 ' + e.check.required + '（差值 ' + e.check.margin + '）'
    }
    if (e.kind === 'result') return '【系统结算】' + e.text
    if (e.kind === 'system') return '【系统】' + e.text
    return '【叙述】' + e.text
  }).join('\n')
}

/** The opening instruction for a turn. */
export function buildTurnPrompt(req: RpgTurnRequest, member?: PartyMember | null): string {
  const state = req.state
  const lines: string[] = []
  lines.push('【当前场景】')
  lines.push(state.scene || '（尚未开始，请先给出一个自然的开场）')
  lines.push('')
  lines.push('【队伍】')
  lines.push(describeParty(req.party))
  lines.push('')
  if (state.facts.length > 0) {
    lines.push('【已确立的事实（必须保持一致）】')
    for (const f of state.facts.slice(-20)) lines.push('- ' + f)
    lines.push('')
  }
  if (state.encounter) {
    lines.push('【待抉择的遭遇】' + state.encounter.title)
    lines.push(state.encounter.description)
    lines.push('（可选行动：' + state.encounter.options.map((o) => o.label).join(' / ') + '）')
    lines.push('')
  }
  lines.push('【最近的经过】')
  lines.push(recentLog(state, 12))
  lines.push('')
  lines.push('【玩家本回合的声明】')
  lines.push(req.action)
  if (member) lines.push('（由 ' + member.name + ' 执行）')
  lines.push('')
  lines.push('请调用 gm_turn 工具输出本回合内容。')
  lines.push('判定方式怎么选：')
  lines.push('- 如果这一回合有新的敌对目标登场（怪物、追兵、敌意的人），或者玩家完全可能想打、也可能想跑，请用 encounter，并至少给出「正面对抗」与「回避/逃跑」两类选项。')
  lines.push('- 如果玩家已经明确宣告了一个具体动作、且没有别的合理选项，用 check。')
  lines.push('- 只是推进叙述时，两者都省略。')
  return lines.join('\n')
}

/** Route request for the GM voice. */
function routeOf(req: { provider?: string; model?: string; custom?: unknown; sampling?: unknown }): RouteRequest {
  return {
    provider: req.provider,
    model: req.model,
    custom: req.custom as RouteRequest['custom'],
    sampling: req.sampling as RouteRequest['sampling'],
  }
}

/**
 * One narrative turn: the GM either advances the story, or asks the system to
 * arbitrate. Nothing here decides success -- it only shapes the request.
 * @param ctx - host context carrying the llm service.
 * @param req - table state, party, the player's declaration and the GM route.
 */
export async function gmTurn(ctx: Context, req: RpgTurnRequest): Promise<RpgTurnResponse> {
  const system = GM_SYSTEM + (req.narratorPrompt ? '\n\n【本桌额外指令】\n' + req.narratorPrompt : '')
  const actor = req.party.length > 0 ? req.party[0] : null
  const result = await routeCompletion(ctx, routeOf(req), {
    system,
    messages: [{ role: 'user', content: buildTurnPrompt(req, actor) }],
    tools: [GM_TURN_TOOL],
    temperature: 0.85,
    maxTokens: 4096,
  })
  const data = parseResult(result)
  if (data === null) {
    return {
      narration: result.text || '（守秘人沉默了。可以再描述一次你的行动。）',
      scene: req.state.scene,
      encounter: null,
      check: null,
      facts: [],
      checkKind: 'other',
      checkThreat: 50,
    }
  }
  const narration = str(data.narration) || result.text
  const facts = Array.isArray(data.facts)
    ? data.facts.filter((f): f is string => typeof f === 'string' && f.trim() !== '').slice(0, 8)
    : []
  const encounter = coerceEncounter(data.encounter, num(data.checkThreat, 50, 0, 100))
  const check = coerceCheck(data.check)
  const kindRaw = str(data.checkKind, 'other')
  return {
    narration,
    scene: str(data.scene) || req.state.scene,
    encounter,
    check,
    facts,
    checkKind: KINDS.includes(kindRaw) ? kindRaw : 'other',
    checkThreat: num(data.checkThreat, encounter ? encounter.threat : 50, 0, 100),
  }
}

/**
 * Narrate an already-decided check. The directive from the engine is the first
 * thing the model sees, so the verdict cannot drift.
 * @param ctx - host context.
 * @param req - table state, the system's result and the GM route.
 */
export async function gmNarrate(ctx: Context, req: RpgNarrateRequest): Promise<RpgNarrateResponse> {
  const system = GM_SYSTEM + (req.narratorPrompt ? '\n\n【本桌额外指令】\n' + req.narratorPrompt : '')
  const lines: string[] = []
  lines.push(req.result.directive)
  lines.push('')
  lines.push('【当前场景】')
  lines.push(req.state.scene || '（未记录）')
  lines.push('')
  lines.push('【队伍】')
  lines.push(describeParty(req.party))
  lines.push('')
  lines.push('【最近的经过】')
  lines.push(recentLog(req.state, 10))
  lines.push('')
  lines.push('本回合玩家的行动是：' + req.action)
  lines.push('')
  lines.push('请调用 gm_narrate 工具：只叙述这次行动如何发生，严格贴合上面的判定结果与差值档位，不要复述数字，不要改变成败。')
  const result = await routeCompletion(ctx, routeOf(req), {
    system,
    messages: [{ role: 'user', content: lines.join('\n') }],
    tools: [GM_NARRATE_TOOL],
    temperature: 0.9,
    maxTokens: 3072,
  })
  const data = parseResult(result)
  if (data === null) {
    return { narration: result.text || '', scene: req.state.scene, encounter: null }
  }
  return {
    narration: str(data.narration) || result.text,
    scene: str(data.scene) || req.state.scene,
    encounter: coerceEncounter(data.encounter, req.state.encounter ? req.state.encounter.threat : 50),
  }
}

/** Build the pending check the table is waiting on (pure system work). */
export function buildPending(
  member: PartyMember,
  option: EncounterOption,
  kind: string,
  threat: number,
  penalty = 0,
): PendingCheck {
  const computed = computeCheck(member as unknown as Actor, option, { threat, penalty })
  return {
    memberId: member.id,
    option,
    kind,
    threat,
    computed: {
      actorId: computed.actorId,
      actorName: computed.actorName,
      optionId: computed.optionId,
      optionLabel: computed.optionLabel,
      required: computed.required,
      breakdown: computed.breakdown,
      difficultyLabel: computed.difficultyLabel,
    },
  }
}

/** System prompt for one party member's own voice. */
export function memberSystem(member: PartyMember, state: RpgState, narratorPrompt: string): string {
  const actor = member as unknown as Actor
  const lines: string[] = []
  lines.push('你正在扮演跑团队伍中的一名角色：「' + member.name + '」' + (member.role ? '（' + member.role + '）' : '') + '。')
  lines.push('')
  lines.push('【这个角色是谁】')
  lines.push(member.prompt || '（未填写人设，请依据属性与定位合理发挥。）')
  lines.push('')
  lines.push('【他的状态】')
  lines.push(actorSummary(actor))
  if ((member.status ?? []).length > 0) lines.push('当前状态：' + member.status.join('、'))
  lines.push('')
  lines.push('【当下场景】')
  lines.push(state.scene || '（未记录）')
  if (narratorPrompt) {
    lines.push('')
    lines.push('【本桌基调】')
    lines.push(narratorPrompt)
  }
  lines.push('')
  lines.push('【规则】')
  lines.push('1. 只输出这个角色这一回合的言行，1 到 3 句，可以包含对白与动作神态。')
  lines.push('2. 不要替其他角色或玩家说话，不要复述旁白，不要描述全局剧情走向。')
  lines.push('3. 不要提及规则、数值、骰子或任何系统词汇。')
  lines.push('4. 保持人设一致：' + (member.prompt ? '严格遵守上面的人设。' : '依据属性与定位保持稳定性格。'))
  lines.push('5. 全程使用中文。')
  return lines.join('\n')
}

/**
 * One party member's line, generated on that member's own model route -- the
 * feature that lets a single table mix several different APIs.
 * @param ctx - host context.
 * @param req - the member, the current scene and the beat they react to.
 */
export async function memberLine(ctx: Context, req: RpgMemberRequest): Promise<RpgMemberResponse> {
  const system = memberSystem(req.member, req.state, '')
  const lines: string[] = []
  lines.push('【最近的经过】')
  lines.push(recentLog(req.state, 8))
  lines.push('')
  lines.push('【刚刚发生的事】')
  lines.push(req.beat || '（无）')
  if (req.instruction) {
    lines.push('')
    lines.push('【玩家希望你】')
    lines.push(req.instruction)
  }
  lines.push('')
  lines.push('请调用 member_line 工具，给出「' + req.member.name + '」本回合的言行。')
  // Resolve this member's own route; 'inherit' means the tavern-wide selection,
  // which the browser forwards so a member on "跟随全局" really does follow it.
  const mode = req.member.llm.mode
  const inherit = req.inherit ?? {}
  const result = await routeCompletion(ctx, {
    provider: mode === 'dsh' ? req.member.llm.provider : mode === 'inherit' ? inherit.provider : undefined,
    model: mode === 'dsh' ? req.member.llm.model : mode === 'inherit' ? inherit.model : undefined,
    custom: mode === 'custom'
      ? { baseUrl: req.member.llm.baseUrl, apiKey: req.member.llm.apiKey, model: req.member.llm.customModel }
      : mode === 'inherit' ? inherit.custom : undefined,
    sampling: req.sampling,
  }, {
    system,
    messages: [{ role: 'user', content: lines.join('\n') }],
    tools: [MEMBER_TOOL],
    temperature: 0.9,
    maxTokens: 800,
  })
  const data = parseResult(result)
  const line = data === null ? result.text : (str((data as Record<string, unknown>).line) || result.text)
  const used = req.member.llm.mode === 'dsh'
    ? { provider: req.member.llm.provider, model: req.member.llm.model }
    : req.member.llm.mode === 'custom'
      ? { provider: 'custom', model: req.member.llm.customModel }
      : { provider: '', model: '' }
  return { line: line.trim(), provider: used.provider, model: used.model }
}

/** Attribute label lookup used by the client too. */
export function attrLabel(id: AttrId): string {
  return (ATTRS.find((a) => a.id === id) ?? ATTRS[0]).label
}

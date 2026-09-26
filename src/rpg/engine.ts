/**
 * Portable Tavern tabletop engine -- the deterministic half of the RPG mode.
 *
 * The contract of the whole feature: the SYSTEM owns every number. Dice,
 * attribute modifiers, difficulty, the required roll, the margin, the outcome
 * band and the mechanical consequences are all computed here, in pure code with
 * an injected RNG, so they are reproducible, auditable and testable. The AI
 * only narrates the result it is handed and is explicitly forbidden from
 * changing it.
 *
 * Environment-neutral on purpose: both halves import this module. The host
 * supplies a crypto-backed RNG for authoritative rolls; the browser reuses the
 * same functions for live previews (a preview never consumes the real roll).
 */

// ---------------------------------------------------------------------------
// attributes and actors
// ---------------------------------------------------------------------------

/** The six attributes every combatant carries. */
export type AttrId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

/** Attribute scores. 10 is human average; the table is 1..20. */
export interface Attributes {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

/** One trained skill: which attribute it leans on plus a flat bonus. */
export interface Skill {
  name: string
  attr: AttrId
  bonus: number
}

/** Anything that can attempt a check. */
export interface Actor {
  id: string
  name: string
  attributes: Attributes
  skills: Skill[]
  /** Current and maximum hit points. */
  hp: number
  maxHp: number
  /** Free-form conditions such as 中毒 or 被追击. */
  status: string[]
}

/** Attribute display metadata (label plus the short code). */
export const ATTRS: { id: AttrId; label: string; short: string; blurb: string }[] = [
  { id: 'str', label: '力量', short: 'STR', blurb: '近战、负重、蛮力破障' },
  { id: 'dex', label: '敏捷', short: 'DEX', blurb: '闪避、潜行、逃跑、先手' },
  { id: 'con', label: '体质', short: 'CON', blurb: '抗毒、耐痛、长途跋涉' },
  { id: 'int', label: '智力', short: 'INT', blurb: '学识、解谜、法术解析' },
  { id: 'wis', label: '感知', short: 'WIS', blurb: '察觉、直觉、追踪' },
  { id: 'cha', label: '魅力', short: 'CHA', blurb: '说服、谈判、威吓' },
]

/** Clamp helper shared by every derived number. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Attribute modifier on the d100 scale. Average (10) gives 0, and every point
 * away from average is worth 2 -- so an 18 (+16) is a real adventurer and an
 * untrained 6 (-8) genuinely struggles.
 * @param score - the raw attribute score.
 */
export function attrMod(score: number): number {
  return clamp(Math.round((Number(score) - 10) * 2), -30, 30)
}

/** Look up one attribute score on an actor. */
export function attrOf(actor: Actor, id: AttrId): number {
  return Number(actor.attributes[id] ?? 10)
}

// ---------------------------------------------------------------------------
// difficulty ladder
// ---------------------------------------------------------------------------

/** The named difficulty anchors the GM picks from, before the actor applies. */
export const DIFFICULTY_LADDER: { id: string; label: string; value: number }[] = [
  { id: 'trivial', label: '轻而易举', value: 25 },
  { id: 'easy', label: '轻松', value: 40 },
  { id: 'normal', label: '普通', value: 55 },
  { id: 'hard', label: '困难', value: 70 },
  { id: 'veryHard', label: '极难', value: 82 },
  { id: 'brutal', label: '九死一生', value: 92 },
]

/** Snap an arbitrary GM-supplied difficulty onto the ladder (nearest anchor). */
export function snapDifficulty(value: number): number {
  const v = clamp(Math.round(Number(value) || 55), 5, 95)
  let best = DIFFICULTY_LADDER[2].value
  let bestGap = Number.POSITIVE_INFINITY
  for (const step of DIFFICULTY_LADDER) {
    const gap = Math.abs(step.value - v)
    if (gap < bestGap) { bestGap = gap; best = step.value }
  }
  return best
}

/** Human label for a difficulty value on the ladder. */
export function difficultyLabel(value: number): string {
  const v = snapDifficulty(value)
  return (DIFFICULTY_LADDER.find((step) => step.value === v) ?? DIFFICULTY_LADDER[2]).label
}

// ---------------------------------------------------------------------------
// dice
// ---------------------------------------------------------------------------

/** A uniform integer in 1..faces; the RNG is injected so rolls stay testable. */
export function rollDie(faces: number, rng: () => number): number {
  const f = Math.max(2, Math.floor(faces))
  const raw = Number(rng())
  const unit = Number.isFinite(raw) ? Math.min(0.999999999, Math.max(0, raw)) : 0
  return 1 + Math.floor(unit * f)
}

/** A d100 roll -- the system's core resolution die. */
export function rollD100(rng: () => number): number {
  return rollDie(100, rng)
}

/** Roll count dice of the given size and add the bonus. */
export function rollDice(count: number, faces: number, bonus: number, rng: () => number): { rolls: number[]; total: number } {
  const n = clamp(Math.floor(count) || 1, 1, 20)
  const rolls: number[] = []
  for (let i = 0; i < n; i++) rolls.push(rollDie(faces, rng))
  const sum = rolls.reduce((a, b) => a + b, 0)
  return { rolls, total: sum + (Number(bonus) || 0) }
}

// ---------------------------------------------------------------------------
// check construction -- "at least this number"
// ---------------------------------------------------------------------------

/** One selectable course of action offered by the GM for an encounter. */
export interface CheckOption {
  id: string
  /** Button text, e.g. 战斗 / 逃跑 / 交涉. */
  label: string
  /** Attribute the attempt leans on; empty means pure luck. */
  attribute: AttrId | ''
  /** Named skill that adds its bonus when the actor has it. */
  skill: string
  /** Base difficulty of the situation (snapped to the ladder). */
  difficulty: number
  /** Situational modifier supplied with the encounter; positive makes it harder. */
  modifier: number
  /** One-line flavour shown under the button. */
  hint: string
}

/** One line of the "how we got this number" table. */
export interface BreakdownRow {
  label: string
  value: number
}

/** A fully computed check: what the player must roll, and why. */
export interface ComputedCheck {
  actorId: string
  actorName: string
  optionId: string
  optionLabel: string
  /** The number the player must roll on a d100 -- the headline figure. */
  required: number
  /** Every contribution, in display order. */
  breakdown: BreakdownRow[]
  /** How hard the situation is, in words. */
  difficultyLabel: string
}

/** Encounter context a check is resolved inside. */
export interface CheckContext {
  /** 0..100 opposition rating; 50 is neutral. */
  threat: number
  /** Extra system-side modifier (terrain, darkness, wounds). */
  penalty?: number
  /** Attribute the actor is exhausted on, if any. */
  exhausted?: AttrId[]
}

/** Skill bonus lookup by name (case-insensitive, trimmed). */
export function skillBonus(actor: Actor, name: string): number {
  const wanted = String(name || '').trim().toLowerCase()
  if (wanted === '') return 0
  let total = 0
  for (const skill of actor.skills ?? []) {
    if (String(skill.name || '').trim().toLowerCase() === wanted) total += Number(skill.bonus) || 0
  }
  return total
}

/**
 * Turn a situation plus an actor into the number the player must roll.
 *
 * Everything the actor brings is folded into a single target, because that is
 * how the mode is meant to read at the table: the system announces one number,
 * the player throws one die, and the difference is the story.
 * @param actor - who is attempting the action.
 * @param option - which course of action they chose.
 * @param context - encounter threat and situational penalties.
 */
export function computeCheck(actor: Actor, option: CheckOption, context: CheckContext): ComputedCheck {
  const breakdown: BreakdownRow[] = []
  const base = snapDifficulty(option.difficulty)
  breakdown.push({ label: '情境基础难度（' + difficultyLabel(base) + '）', value: base })

  const threat = clamp(Number(context.threat) || 50, 0, 100)
  const threatAdj = Math.round((threat - 50) / 5)
  if (threatAdj !== 0) breakdown.push({ label: '对手威胁（' + threat + '）', value: threatAdj })

  const optionMod = Number(option.modifier) || 0
  if (optionMod !== 0) breakdown.push({ label: '行动方式修正', value: optionMod })

  const situational = Number(context.penalty) || 0
  if (situational !== 0) breakdown.push({ label: '环境与状态修正', value: situational })

  if (option.attribute !== '') {
    const score = attrOf(actor, option.attribute)
    const mod = attrMod(score)
    const meta = ATTRS.find((a) => a.id === option.attribute)
    breakdown.push({ label: (meta ? meta.label : option.attribute) + ' ' + score + ' 调整', value: -mod })
  }

  const sb = skillBonus(actor, option.skill)
  if (sb !== 0) breakdown.push({ label: '技能·' + option.skill + ' 熟练', value: -sb })

  const conditionPenalty = (actor.status ?? []).length * 3
  if (conditionPenalty !== 0) breakdown.push({ label: '负面状态 ' + actor.status.length + ' 项', value: conditionPenalty })

  const raw = breakdown.reduce((sum, row) => sum + row.value, 0)
  const required = clamp(Math.round(raw), 5, 95)
  if (required !== Math.round(raw)) breakdown.push({ label: '判定上限截断', value: required - Math.round(raw) })

  return {
    actorId: actor.id,
    actorName: actor.name,
    optionId: option.id,
    optionLabel: option.label,
    required,
    breakdown,
    difficultyLabel: difficultyLabel(base),
  }
}

// ---------------------------------------------------------------------------
// outcome bands -- the narrative contract
// ---------------------------------------------------------------------------

/** Band identifiers, ordered from best to worst. */
export type BandId = 'triumph' | 'success' | 'costly' | 'narrow' | 'hair' | 'fail' | 'disaster'

/** One outcome band: the label, the narrator's brief, and the system's effects. */
export interface Band {
  id: BandId
  label: string
  /** Inclusive lower bound of the margin (roll - required). */
  min: number
  /** True when the attempt succeeded. */
  success: boolean
  /** How far off the attempt was, in words, used to grade the flavour. */
  grade: 'clean' | 'narrow'
  /** What the narrator must convey -- the system's instruction to the AI. */
  brief: string
}

/** The band table. Ordered best-first; the first match wins. */
export const BANDS: Band[] = [
  {
    id: 'triumph', label: '大成功', min: 50, success: true, grade: 'clean',
    brief: '完成得干净利落且超出预期：不仅达成了目标，还额外占到便宜（多跑出一大段、顺势反制、发现有利地形）。',
  },
  {
    id: 'success', label: '成功', min: 20, success: true, grade: 'clean',
    brief: '顺利达成目标，过程没有明显代价，可以写得从容一些。',
  },
  {
    id: 'costly', label: '险胜', min: 1, success: true, grade: 'narrow',
    brief: '勉强达成，而且付出了小代价（擦伤、掉落物品、惊动旁人、体能透支），要写出千钧一发的感觉。',
  },
  {
    id: 'narrow', label: '极限成功', min: 0, success: true, grade: 'narrow',
    brief: '恰好在最后一瞬达成，成败只隔一线；要写出几乎失败又被拉回来的紧张感。',
  },
  {
    id: 'hair', label: '差一点', min: -19, success: false, grade: 'narrow',
    brief: '功亏一篑：动作一度奏效、眼看就要成功，却在最后关头被扳了回来，并且留下轻微反噬（暴露位置、被追上、失去先手）。',
  },
  {
    id: 'fail', label: '失败', min: -49, success: false, grade: 'clean',
    brief: '明确失败，目标没有达成，处境明显变差；差距越大越可以写出具体的失手（脚下一滑、手没抓稳、被绊住、判断失误），但不要写成彻底出局。',
  },
  {
    id: 'disaster', label: '惨败', min: Number.NEGATIVE_INFINITY, success: false, grade: 'clean',
    brief: '灾难性失败：过程中出现严重失误（摔倒、脱手、判断失误），角色受伤并立刻陷入更危险的处境。',
  },
]

/** Find the band a margin falls into. */
export function bandOf(margin: number): Band {
  for (const band of BANDS) {
    if (margin >= band.min) return band
  }
  return BANDS[BANDS.length - 1]
}

/** What the system does to the world after a check resolves. */
export interface Effects {
  hpLoss: number
  /** Conditions added to the actor. */
  addStatus: string[]
  /** Conditions removed from the actor. */
  removeStatus: string[]
  /** True when the encounter is over (fled, won, talked down). */
  endsEncounter: boolean
}

/**
 * Mechanical consequences, scaled by how far the roll missed and how dangerous
 * the encounter is. The narrator is told about these, never asked to invent
 * them.
 * @param kind - encounter kind (combat / chase / social / ...).
 * @param band - the outcome band.
 * @param margin - signed distance from the required roll.
 * @param threat - 0..100 opposition rating.
 */
export function effectsFor(kind: string, band: Band, margin: number, threat: number): Effects {
  const danger = clamp(Number(threat) || 50, 0, 100)
  const severity = band.id === 'disaster' ? 3 : band.id === 'fail' ? 2 : band.id === 'hair' ? 1 : 0
  const physical = kind === 'combat' || kind === 'chase' ? 1 : 0.5
  // How badly the attempt missed deepens the wound, so a 5-point miss and a
  // 45-point miss are not the same injury. Capped so one bad throw can never
  // take a character from full to out in a single line.
  const gap = Math.max(0, -margin)
  const depth = 1 + Math.min(1.2, Math.max(0, gap - 20) / 50)
  const hpLoss = Math.min(20, Math.round(severity * physical * (1 + danger / 25) * depth))
  const over = Math.max(0, margin)

  const addStatus: string[] = []
  if (band.id === 'disaster') {
    addStatus.push(kind === 'chase' ? '倒地' : '重伤')
  } else if (band.id === 'fail') {
    addStatus.push(kind === 'chase' ? '被追击' : '受创')
  } else if (band.id === 'hair') {
    addStatus.push('暴露')
  } else if (band.id === 'costly' && over < 10) {
    addStatus.push('疲惫')
  }

  const removeStatus: string[] = []
  if (band.success) {
    for (const s of ['被追击', '暴露', '倒地']) removeStatus.push(s)
  }

  return {
    hpLoss: Math.max(0, hpLoss),
    addStatus,
    removeStatus,
    endsEncounter: band.success || band.id === 'disaster',
  }
}

/** The graded distance wording handed to the narrator. */
export function distanceWording(delta: number): string {
  const gap = Math.abs(delta)
  if (gap === 0) return '恰好卡在线上'
  if (gap === 1) return '只差 1 点，几乎可以忽略的一线之差'
  if (gap <= 5) return '只差 ' + gap + ' 点，毫厘之间'
  if (gap <= 19) return '差 ' + gap + ' 点，差距不大但很明确'
  if (gap <= 49) return '差 ' + gap + ' 点，差距相当明显'
  return '差 ' + gap + ' 点，差距悬殊'
}

/** One resolved check: the roll, the target, and the system's verdict. */
export interface CheckResult {
  roll: number
  required: number
  /** roll - required; negative means the attempt fell short. */
  margin: number
  band: BandId
  bandLabel: string
  success: boolean
  /** 'success' / 'failure' when a natural critical overrode the band. */
  critical: 'none' | 'success' | 'failure'
  /** The instruction the narrator receives. */
  directive: string
  effects: Effects
  breakdown: BreakdownRow[]
}

/** Natural-roll thresholds for the optional critical rule. */
export const CRIT_LOW = 5
export const CRIT_HIGH = 96

/**
 * The system's verdict. This is the only place success is decided.
 * @param computed - the pre-computed check (target + breakdown).
 * @param roll - the d100 the player threw.
 * @param kind - encounter kind, used for consequences.
 * @param threat - 0..100 opposition rating.
 * @param critEnabled - whether natural 1-5 / 96-100 override the band.
 */
export function judge(
  computed: ComputedCheck,
  roll: number,
  kind: string,
  threat: number,
  critEnabled = true,
): CheckResult {
  const rolled = clamp(Math.round(roll), 1, 100)
  const margin = rolled - computed.required
  let band = bandOf(margin)
  let critical: CheckResult['critical'] = 'none'

  if (critEnabled && rolled >= CRIT_HIGH) {
    critical = 'success'
    band = BANDS[0]
  } else if (critEnabled && rolled <= CRIT_LOW) {
    critical = 'failure'
    band = BANDS[BANDS.length - 1]
  }

  const effects = effectsFor(kind, band, margin, threat)
  if (critical === 'success') effects.hpLoss = 0

  const directive = buildDirective(computed, rolled, margin, band, critical, effects)
  return {
    roll: rolled,
    required: computed.required,
    margin,
    band: band.id,
    bandLabel: band.label,
    success: band.success,
    critical,
    directive,
    effects,
    breakdown: computed.breakdown,
  }
}

/**
 * The exact brief the narrator receives. It states the numbers, the verdict,
 * and the flavour the distance demands -- and forbids re-deciding any of it.
 */
export function buildDirective(
  computed: ComputedCheck,
  roll: number,
  margin: number,
  band: Band,
  critical: CheckResult['critical'],
  effects: Effects,
): string {
  const lines: string[] = []
  lines.push('【系统判定 · 已生效，不可更改】')
  lines.push('行动：' + computed.actorName + ' 选择「' + computed.optionLabel + '」。')
  lines.push('需要掷出：' + computed.required + '（' + computed.difficultyLabel + '）。实际掷出：' + roll + '。')
  if (critical === 'success') lines.push('自然骰 ' + roll + ' 触发大成功。')
  if (critical === 'failure') lines.push('自然骰 ' + roll + ' 触发大失败。')
  lines.push('结果：' + band.label + '（' + (band.success ? '成功' : '失败') + '，' + distanceWording(margin) + '）。')
  lines.push('叙述要求：' + band.brief)
  if (effects.hpLoss > 0) lines.push('机械后果（已由系统结算）：损失 ' + effects.hpLoss + ' 点生命。')
  if (effects.addStatus.length > 0) lines.push('机械后果（已由系统结算）：获得状态「' + effects.addStatus.join('、') + '」。')
  if (effects.removeStatus.length > 0) lines.push('机械后果（已由系统结算）：解除状态「' + effects.removeStatus.join('、') + '」。')
  lines.push('硬性约束：判定结果由系统给出，你只能描写它如何发生；不得改变成功或失败，不得捏造与上面数字矛盾的结局，也不要向玩家复述这些数字。')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// party helpers
// ---------------------------------------------------------------------------

/** Create a fresh actor with sane defaults. */
export function makeActor(id: string, name: string, patch?: Partial<Actor>): Actor {
  const base: Actor = {
    id,
    name,
    attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    skills: [],
    hp: 20,
    maxHp: 20,
    status: [],
  }
  if (!patch) return base
  return {
    ...base,
    ...patch,
    attributes: { ...base.attributes, ...(patch.attributes ?? {}) },
    skills: patch.skills ?? base.skills,
    status: patch.status ?? base.status,
  }
}

/** Apply the system's effects to an actor, returning a new actor. */
export function applyEffects(actor: Actor, effects: Effects): Actor {
  const hp = clamp(actor.hp - effects.hpLoss, 0, actor.maxHp)
  const set = new Set(actor.status ?? [])
  for (const s of effects.removeStatus) set.delete(s)
  for (const s of effects.addStatus) set.add(s)
  return { ...actor, hp, status: [...set] }
}

/** A short human summary of an actor's vital line. */
export function actorSummary(actor: Actor): string {
  const parts: string[] = []
  parts.push(actor.name)
  parts.push('HP ' + actor.hp + '/' + actor.maxHp)
  for (const meta of ATTRS) parts.push(meta.short + ' ' + attrOf(actor, meta.id))
  if ((actor.status ?? []).length > 0) parts.push('状态：' + actor.status.join('、'))
  if ((actor.skills ?? []).length > 0) parts.push('擅长：' + actor.skills.map((s) => s.name + (s.bonus ? '+' + s.bonus : '')).join('、'))
  return parts.join('｜')
}

/**
 * Story outline: user-authored beats that the SYSTEM decides when to fire.
 *
 * The point of this module is that "trigger" is not a suggestion to the model.
 * Whether a beat fires is evaluated here, in pure code, against the table's
 * actual state -- turn count, the last verdict, who is hurt, what the player
 * just said, what has already been established. Only once a beat has fired does
 * its text reach the narrator, framed as something that must be staged now.
 *
 * Same division of labour as the rest of the mode: the system picks the moment,
 * the model performs it.
 */

import type { OutlineTrigger, TriggerKind } from '../protocol.ts'
import type { BandId } from './engine.ts'

/** Everything a trigger is allowed to look at. */
export interface TriggerContext {
  /** Turns played so far. */
  turn: number
  /** The most recent resolved check, if any. */
  lastResult: { band: BandId; success: boolean; margin: number } | null
  /** Encounter kind currently on the table, or null. */
  encounterKind: string | null
  /** The party's vital signs. */
  party: { name: string; hp: number; maxHp: number }[]
  /** What the player just declared, verbatim. */
  action: string
  /** Facts the table has already established. */
  facts: string[]
  /**
   * Consecutive outcomes: positive counts successive successes, negative
   * successive failures. Reset by the opposite result.
   */
  streak: number
}

/** Human labels for the trigger kinds, used by the editor. */
export const TRIGGER_KINDS: { kind: TriggerKind; label: string; hint: string; field: string }[] = [
  { kind: 'turn', label: '到达回合', hint: '冒险进行到第 N 回合时触发', field: 'turn' },
  { kind: 'band', label: '判定档位', hint: '最近的判定落在某个档位时触发', field: 'band' },
  { kind: 'encounter', label: '遭遇类型', hint: '当场上出现某类遭遇时触发', field: 'encounterKind' },
  { kind: 'hp', label: '血量告急', hint: '任何队员血量低于某个比例时触发', field: 'hpBelow' },
  { kind: 'action', label: '行动关键词', hint: '玩家宣告的行动里包含某段文字时触发', field: 'keyword' },
  { kind: 'fact', label: '已确立事实', hint: '已确立的事实里出现某段文字时触发', field: 'factKeyword' },
  { kind: 'success', label: '连续成功', hint: '连续成功 N 次后触发', field: 'streak' },
  { kind: 'failure', label: '连续失败', hint: '连续失败 N 次后触发', field: 'streak' },
  { kind: 'always', label: '立即', hint: '冒险一开始就触发', field: '' },
]

/** Case-insensitive "does the haystack contain the needle" with a blank guard. */
function contains(haystack: string, needle: string | undefined): boolean {
  const n = String(needle ?? '').trim().toLowerCase()
  if (n === '') return false
  return String(haystack ?? '').toLowerCase().includes(n)
}

/** A fresh outline beat. */
export function makeBeat(index: number): {
  id: string
  title: string
  trigger: OutlineTrigger
  event: string
  once: boolean
  fired: boolean
  firedAtTurn: number
} {
  return {
    id: 'b' + Date.now().toString(36) + '-' + index,
    title: '事件 ' + (index + 1),
    trigger: { kind: 'turn', turn: index + 1 },
    event: '',
    once: true,
    fired: false,
    firedAtTurn: 0,
  }
}

/**
 * Decide whether one beat fires right now.
 * @param trigger - the condition the author wrote.
 * @param ctx - the table's current state.
 * @returns whether it fires, plus a short reason for the log.
 */
export function evaluateTrigger(trigger: OutlineTrigger, ctx: TriggerContext): { fired: boolean; reason: string } {
  const kind = trigger?.kind ?? 'always'
  switch (kind) {
    case 'always':
      return { fired: true, reason: '立即触发' }
    case 'turn': {
      const at = Math.max(1, Math.round(Number(trigger.turn) || 1))
      return { fired: ctx.turn >= at, reason: '第 ' + ctx.turn + ' 回合（条件：≥' + at + '）' }
    }
    case 'band': {
      const wanted = trigger.band
      if (wanted === undefined || ctx.lastResult === null) return { fired: false, reason: '还没有判定结果' }
      return { fired: ctx.lastResult.band === wanted, reason: '最近判定为 ' + ctx.lastResult.band }
    }
    case 'encounter': {
      const wanted = String(trigger.encounterKind ?? '').trim()
      if (wanted === '' || ctx.encounterKind === null) return { fired: false, reason: '当前没有遭遇' }
      return { fired: ctx.encounterKind === wanted, reason: '遭遇类型 ' + ctx.encounterKind }
    }
    case 'hp': {
      const ratio = Math.min(1, Math.max(0, Number(trigger.hpBelow ?? 0.3)))
      const hurt = ctx.party.find((m) => m.maxHp > 0 && m.hp / m.maxHp < ratio)
      if (hurt === undefined) return { fired: false, reason: '无人低于 ' + Math.round(ratio * 100) + '%' }
      return { fired: true, reason: hurt.name + ' 血量 ' + hurt.hp + '/' + hurt.maxHp }
    }
    case 'action':
      return { fired: contains(ctx.action, trigger.keyword), reason: '行动关键词「' + String(trigger.keyword ?? '') + '」' }
    case 'fact':
      return {
        fired: ctx.facts.some((f) => contains(f, trigger.factKeyword)),
        reason: '事实关键词「' + String(trigger.factKeyword ?? '') + '」',
      }
    case 'success': {
      const n = Math.max(1, Math.round(Number(trigger.streak) || 1))
      return { fired: ctx.streak >= n, reason: '连续成功 ' + ctx.streak + ' 次（条件：≥' + n + '）' }
    }
    case 'failure': {
      const n = Math.max(1, Math.round(Number(trigger.streak) || 1))
      return { fired: ctx.streak <= -n, reason: '连续失败 ' + Math.abs(ctx.streak) + ' 次（条件：≥' + n + '）' }
    }
    default:
      return { fired: false, reason: '未知触发条件' }
  }
}

/** One beat that the system decided to fire this turn. */
export interface FiredBeat {
  id: string
  title: string
  event: string
  reason: string
}

/**
 * Evaluate the whole outline in order and return the beats that fire.
 *
 * Every beat that fires this turn is returned (a scene change can satisfy
 * several conditions at once), and a beat marked `once` is retired by the
 * caller. Beats with an empty event body are retired silently rather than
 * handing the narrator an empty instruction.
 * @param beats - the outline, in author order.
 * @param ctx - the table's current state.
 */
export function runOutline(
  beats: { id: string; title: string; trigger: OutlineTrigger; event: string; once: boolean; fired: boolean }[],
  ctx: TriggerContext,
): { fired: FiredBeat[]; retired: string[] } {
  const fired: FiredBeat[] = []
  const retired: string[] = []
  for (const beat of beats ?? []) {
    if (beat.fired && beat.once) continue
    const verdict = evaluateTrigger(beat.trigger, ctx)
    if (!verdict.fired) continue
    if (String(beat.event ?? '').trim() === '') {
      retired.push(beat.id)
      continue
    }
    fired.push({ id: beat.id, title: beat.title, event: beat.event, reason: verdict.reason })
    if (beat.once) retired.push(beat.id)
  }
  return { fired, retired }
}

/** Advance the consecutive-outcome counter. */
export function nextStreak(streak: number, success: boolean): number {
  if (success) return streak >= 0 ? streak + 1 : 1
  return streak <= 0 ? streak - 1 : -1
}

/** Human-readable one-liner for a trigger, shown in the outline editor. */
export function describeTrigger(trigger: OutlineTrigger): string {
  const kind = trigger?.kind ?? 'always'
  switch (kind) {
    case 'always': return '冒险开始时'
    case 'turn': return '第 ' + (trigger.turn ?? 1) + ' 回合及之后'
    case 'band': return '判定落到「' + (trigger.band ?? '?') + '」时'
    case 'encounter': return '遇到「' + (trigger.encounterKind ?? '?') + '」类遭遇时'
    case 'hp': return '有人血量低于 ' + Math.round((trigger.hpBelow ?? 0.3) * 100) + '% 时'
    case 'action': return '行动包含「' + (trigger.keyword ?? '') + '」时'
    case 'fact': return '已确立事实包含「' + (trigger.factKeyword ?? '') + '」时'
    case 'success': return '连续成功 ' + (trigger.streak ?? 1) + ' 次后'
    case 'failure': return '连续失败 ' + (trigger.streak ?? 1) + ' 次后'
    default: return '未知条件'
  }
}

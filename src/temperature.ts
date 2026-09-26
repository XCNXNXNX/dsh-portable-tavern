/**
 * Sampling-temperature policy shared by every tavern LLM call.
 *
 * Issue #1: some OpenAI-compatible models pin temperature (KIMI K3 answers
 * 400 'invalid temperature: only 1 is allowed for this model'), and some
 * reasoning models reject the field outright. The policy has three modes --
 * auto (send the per-call default), fixed (always send the user's value), and
 * omit (never send it) -- and, on top of that, it learns: the first time an
 * upstream rejects a temperature, the constraint is parsed out of the error
 * (the allowed value, or 'unsupported') and remembered per model route, so the
 * next call is right the first time and the user never sees the 400 again.
 *
 * The learner is process-local: a cache of observed upstream behaviour, not
 * configuration. A fresh process simply re-learns on first contact.
 */

import type { TemperaturePolicy } from './protocol.ts'

export type { TemperaturePolicy }

/** Constraint learned from one upstream rejection. */
type Learned = { omit: true } | { value: number }

/** Separator inside a sampling key (NUL - cannot appear in a model id). */
const SEP = String.fromCharCode(0)

/** Learned constraints, keyed by samplingKey. */
const learned = new Map<string, Learned>()

/**
 * Stable key for one model route. The kind separates a DSH-managed provider
 * from a user-supplied endpoint, so one model name on both learns separately.
 * @param kind - which transport the route belongs to.
 * @param owner - provider id (dsh) or base URL (custom).
 * @param model - exact model id.
 */
export function samplingKey(kind: 'dsh' | 'custom', owner: string, model: string): string {
  return kind + SEP + owner + '/' + model
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(2, Math.max(0, value))
}

/**
 * Parse an upstream complaint about temperature into a constraint.
 *
 * Recognized shapes (English and Chinese gateways):
 * - 'invalid temperature: only 1 is allowed for this model' -> fixed 1
 * - 'temperature must be 1' / 'temperature 0.6 is required' -> fixed value
 * - 'unsupported parameter: temperature' -> omit the field
 * @param message - the raw upstream error text.
 * @returns the constraint, or null when the message says nothing about temperature.
 */
export function classifyTemperatureError(message: string): Learned | null {
  const text = String(message === undefined || message === null ? '' : message)
  if (text === '') return null
  if (!/temperature|温度/i.test(text)) return null
  const only = /only\s+(-?[0-9]+(?:\.[0-9]+)?)\s+is\s+allowed/i.exec(text)
  if (only) return { value: clamp(Number(only[1])) }
  // "temperature must be 1" -- the keyword precedes the value
  const mustBe = /temperature[^0-9]{0,32}?(?:must|should|has\s+to|needs?\s+to)\s+be\s+(-?[0-9]+(?:\.[0-9]+)?)/i.exec(text)
  if (mustBe) return { value: clamp(Number(mustBe[1])) }
  // "temperature 1 is required" -- the value precedes the keyword
  const needs = /temperature[^0-9\-+]{0,48}?(-?[0-9]+(?:\.[0-9]+)?)\s*(?:is\s*)?(?:required|allowed|expected|only)/i.exec(text)
  if (needs) return { value: clamp(Number(needs[1])) }
  if (/(not\s+support|unsupported|does\s+not\s+support|unknown\s+(?:parameter|field|argument)|invalid\s+parameter|unexpected\s+(?:parameter|field)|不支持)/i.test(text)) {
    return { omit: true }
  }
  return null
}

/**
 * Record an upstream rejection. Returns true when the message carried a
 * usable temperature constraint (the caller should retry once with it).
 * @param key - samplingKey of the failing route.
 * @param message - the raw upstream error text.
 */
export function noteTemperatureError(key: string, message: string): boolean {
  const constraint = classifyTemperatureError(message)
  if (constraint === null) return false
  learned.set(key, constraint)
  return true
}

/**
 * The value to put on the wire for one call.
 * @param policy - the user's configured policy.
 * @param key - samplingKey of this route.
 * @param fallback - the per-purpose default used by mode 'auto'.
 * @returns a number, or undefined meaning 'omit the field entirely'.
 */
export function resolveTemperature(policy: TemperaturePolicy | undefined, key: string, fallback: number): number | undefined {
  const hit = learned.get(key)
  if (hit !== undefined) return 'omit' in hit ? undefined : hit.value
  if (policy !== undefined && policy.mode === 'omit') return undefined
  if (policy !== undefined && policy.mode === 'fixed') return clamp(policy.value)
  return clamp(fallback)
}

/** Snapshot of what has been learned this process, for diagnostics. */
export function temperatureReport(): { key: string; constraint: string }[] {
  return [...learned.entries()].map(([key, c]) => ({
    key: key.split(SEP).join(' :: '),
    constraint: 'omit' in c ? '不发送' : String(c.value),
  }))
}

/**
 * Run one call under the temperature policy, retrying exactly once when the
 * upstream rejects the value and hands back a usable constraint.
 * @param key - samplingKey of this route.
 * @param policy - the user's configured policy.
 * @param fallback - the per-purpose default used by mode 'auto'.
 * @param run - performs the call with the resolved temperature.
 */
export async function withTemperatureRetry<T>(
  key: string,
  policy: TemperaturePolicy | undefined,
  fallback: number,
  run: (temperature: number | undefined) => Promise<T>,
): Promise<T> {
  try {
    return await run(resolveTemperature(policy, key, fallback))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!noteTemperatureError(key, message)) throw error
    return await run(resolveTemperature(policy, key, fallback))
  }
}

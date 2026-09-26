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
import type { TemperaturePolicy } from './protocol.ts';
export type { TemperaturePolicy };
/** Constraint learned from one upstream rejection. */
type Learned = {
    omit: true;
} | {
    value: number;
};
/**
 * Stable key for one model route. The kind separates a DSH-managed provider
 * from a user-supplied endpoint, so one model name on both learns separately.
 * @param kind - which transport the route belongs to.
 * @param owner - provider id (dsh) or base URL (custom).
 * @param model - exact model id.
 */
export declare function samplingKey(kind: 'dsh' | 'custom', owner: string, model: string): string;
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
export declare function classifyTemperatureError(message: string): Learned | null;
/**
 * Record an upstream rejection. Returns true when the message carried a
 * usable temperature constraint (the caller should retry once with it).
 * @param key - samplingKey of the failing route.
 * @param message - the raw upstream error text.
 */
export declare function noteTemperatureError(key: string, message: string): boolean;
/**
 * The value to put on the wire for one call.
 * @param policy - the user's configured policy.
 * @param key - samplingKey of this route.
 * @param fallback - the per-purpose default used by mode 'auto'.
 * @returns a number, or undefined meaning 'omit the field entirely'.
 */
export declare function resolveTemperature(policy: TemperaturePolicy | undefined, key: string, fallback: number): number | undefined;
/** Snapshot of what has been learned this process, for diagnostics. */
export declare function temperatureReport(): {
    key: string;
    constraint: string;
}[];
/**
 * Run one call under the temperature policy, retrying exactly once when the
 * upstream rejects the value and hands back a usable constraint.
 * @param key - samplingKey of this route.
 * @param policy - the user's configured policy.
 * @param fallback - the per-purpose default used by mode 'auto'.
 * @param run - performs the call with the resolved temperature.
 */
export declare function withTemperatureRetry<T>(key: string, policy: TemperaturePolicy | undefined, fallback: number, run: (temperature: number | undefined) => Promise<T>): Promise<T>;

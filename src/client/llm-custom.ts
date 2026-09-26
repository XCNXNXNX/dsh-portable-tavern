/**
 * User-supplied OpenAI-compatible endpoint, persisted browser-side only.
 * 妥善处理：the key lives in localStorage (browser-local), is sent solely to
 * the loopback-fenced /api/dsh-portable-tavern routes in the request body,
 * is masked in the UI (password input), and the host half never persists or
 * logs it.
 */
import { DEFAULT_TEMPERATURE_POLICY, type LlmCustom, type TemperaturePolicy } from '../protocol.ts'

const KEY = 'dsh.portable-tavern.llm.v1'
const SAMPLING_KEY = 'dsh.portable-tavern.sampling.v1'

export interface CustomLlmConfig extends LlmCustom {
  /** False when every field is empty (fully disconnected). */
  configured: boolean
}

const EMPTY: CustomLlmConfig = { baseUrl: '', apiKey: '', model: '', configured: false }

/** Read the stored config (never throws; unreadable storage = empty config). */
export function loadCustomLlm(): CustomLlmConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<LlmCustom>
    const baseUrl = typeof parsed.baseUrl === 'string' ? parsed.baseUrl : ''
    const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : ''
    const model = typeof parsed.model === 'string' ? parsed.model : ''
    return { baseUrl, apiKey, model, configured: baseUrl.trim() !== '' && apiKey.trim() !== '' && model.trim() !== '' }
  } catch {
    return { ...EMPTY }
  }
}

/** Persist the config (quota failures swallowed — caller state still holds it). */
export function saveCustomLlm(config: LlmCustom): void {
  try { localStorage.setItem(KEY, JSON.stringify(config)) } catch { /* quota */ }
}

/**
 * Read the temperature policy (issue #1). Stored separately from the endpoint
 * config because it also governs DSH-managed providers, which need no endpoint.
 */
export function loadSampling(): TemperaturePolicy {
  try {
    const raw = localStorage.getItem(SAMPLING_KEY)
    if (raw === null) return { ...DEFAULT_TEMPERATURE_POLICY }
    const parsed = JSON.parse(raw) as Partial<TemperaturePolicy>
    const mode = parsed.mode
    if (mode !== 'auto' && mode !== 'fixed' && mode !== 'omit') return { ...DEFAULT_TEMPERATURE_POLICY }
    const value = typeof parsed.value === 'number' && Number.isFinite(parsed.value)
      ? Math.min(2, Math.max(0, parsed.value))
      : DEFAULT_TEMPERATURE_POLICY.value
    return { mode, value }
  } catch {
    return { ...DEFAULT_TEMPERATURE_POLICY }
  }
}

/** Persist the temperature policy. */
export function saveSampling(policy: TemperaturePolicy): void {
  try { localStorage.setItem(SAMPLING_KEY, JSON.stringify(policy)) } catch { /* quota */ }
}

/** Wipe the stored config. */
export function clearCustomLlm(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

/** The request-shape payload: undefined when not fully configured. */
export function customLlmPayload(): LlmCustom | undefined {
  const config = loadCustomLlm()
  return config.configured ? { baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model } : undefined
}

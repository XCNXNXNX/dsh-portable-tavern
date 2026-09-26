/**
 * Browser-side API client for the /api/dsh-portable-tavern route family. The
 * only data access path the panel components use — plain fetch, same origin.
 */

import {
  TAVERN_API,
  type ChatMessage,
  type ChatResponse,
  type CharCard,
  type CheckResult,
  type Encounter,
  type GenerateResponse,
  type ModelsResponse,
  type PartyMember,
  type PendingCheck,
  type RpgCheckResponse,
  type RpgMemberResponse,
  type RpgNarrateResponse,
  type RpgState,
  type RpgTurnResponse,
  type StExtension,
  type StInstallResponse,
  type TavernSpec,
  type WorldbookResponse,
} from '../protocol.ts'
import { customLlmPayload, loadSampling } from './llm-custom.ts'

/** Error carrying the route's JSON error message. */
export class TavernApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TavernApiError'
  }
}

/** Parse a JSON response or throw a TavernApiError. */
async function readJson<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new TavernApiError('HTTP ' + response.status + ': invalid JSON response')
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : 'HTTP ' + response.status
    throw new TavernApiError(message)
  }
  return body as T
}

async function post<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJson<T>(response)
}

/** The browser half's only data entry point. */
export class TavernApi {
  async generate(spec: TavernSpec, version: string): Promise<GenerateResponse> {
    return post<GenerateResponse>(TAVERN_API.generate, { spec, version, custom: customLlmPayload(), sampling: loadSampling() })
  }

  async worldbook(spec: TavernSpec, card: CharCard | null): Promise<WorldbookResponse> {
    return post<WorldbookResponse>(TAVERN_API.worldbook, { spec, card, custom: customLlmPayload(), sampling: loadSampling() })
  }

  async models(): Promise<ModelsResponse> {
    const response = await fetch(TAVERN_API.models)
    return readJson<ModelsResponse>(response)
  }

  async chat(card: CharCard, messages: ChatMessage[], provider?: string, model?: string, globalPrompt?: string): Promise<ChatResponse> {
    // The custom endpoint only takes over when the chat is on it (provider
    // 'custom'/unset) — a selected dsh provider always wins.
    const useCustom = provider === undefined || provider === '' || provider === 'custom'
    return post<ChatResponse>(TAVERN_API.chat, {
      card,
      messages,
      provider: useCustom ? undefined : provider,
      model: useCustom ? undefined : model,
      globalPrompt,
      custom: useCustom ? customLlmPayload() : undefined,
      sampling: loadSampling(),
    })
  }

  async test(custom: { baseUrl: string; apiKey: string; model: string }): Promise<{ ok: true; latencyMs: number; reply: string; temperature?: string }> {
    return post<{ ok: true; latencyMs: number; reply: string; temperature?: string }>(TAVERN_API.test, { custom, sampling: loadSampling() })
  }

  // -------------------------------------------------------------------------
  // tabletop RPG
  // -------------------------------------------------------------------------

  /** One narrative turn: the GM advances the story or asks for arbitration. */
  async rpgTurn(payload: {
    state: RpgState
    party: PartyMember[]
    action: string
    narratorPrompt: string
    provider?: string
    model?: string
  }): Promise<RpgTurnResponse> {
    const useCustom = payload.provider === undefined || payload.provider === '' || payload.provider === 'custom'
    return post<RpgTurnResponse>(TAVERN_API.rpgTurn, {
      ...payload,
      provider: useCustom ? undefined : payload.provider,
      model: useCustom ? undefined : payload.model,
      custom: useCustom ? customLlmPayload() : undefined,
      sampling: loadSampling(),
    })
  }

  /** Ask the system to compute what the player must roll. No dice, no model. */
  async rpgCheck(member: PartyMember, encounter: Encounter, optionId: string, penalty = 0): Promise<RpgCheckResponse> {
    return post<RpgCheckResponse>(TAVERN_API.rpgCheck, { member, encounter, optionId, penalty })
  }

  /** Throw the die. The host owns the RNG and the verdict. */
  async rpgRoll(pending: PendingCheck, critEnabled: boolean): Promise<CheckResult> {
    return post<CheckResult>(TAVERN_API.rpgRoll, { pending, critEnabled })
  }

  /** Hand the decided outcome back to the GM, which may only narrate it. */
  async rpgNarrate(payload: {
    state: RpgState
    party: PartyMember[]
    action: string
    result: CheckResult
    narratorPrompt: string
    provider?: string
    model?: string
  }): Promise<RpgNarrateResponse> {
    const useCustom = payload.provider === undefined || payload.provider === '' || payload.provider === 'custom'
    return post<RpgNarrateResponse>(TAVERN_API.rpgNarrate, {
      ...payload,
      provider: useCustom ? undefined : payload.provider,
      model: useCustom ? undefined : payload.model,
      custom: useCustom ? customLlmPayload() : undefined,
      sampling: loadSampling(),
    })
  }

  /** One party member speaks on its own model route. */
  async rpgMember(
    member: PartyMember,
    state: RpgState,
    beat: string,
    instruction: string,
    globalRoute?: { provider?: string; model?: string },
  ): Promise<RpgMemberResponse> {
    return post<RpgMemberResponse>(TAVERN_API.rpgMember, {
      member,
      state,
      beat,
      instruction,
      // Only meaningful for 'inherit'; harmless otherwise.
      inherit: {
        provider: globalRoute?.provider === 'custom' ? undefined : globalRoute?.provider,
        model: globalRoute?.provider === 'custom' ? undefined : globalRoute?.model,
        custom: globalRoute?.provider === 'custom' ? customLlmPayload() : undefined,
      },
      sampling: loadSampling(),
    })
  }

  // -------------------------------------------------------------------------
  // SillyTavern extension host
  // -------------------------------------------------------------------------

  /** Installed extensions plus the bundled theme pack. */
  async extList(): Promise<{ installed: StExtension[]; builtin: StExtension[] }> {
    const response = await fetch(TAVERN_API.extList)
    return readJson<{ installed: StExtension[]; builtin: StExtension[] }>(response)
  }

  /** A short curated list of community extensions known to be CSS-first. */
  async extCatalog(): Promise<{ entries: { name: string; url: string; note: string }[] }> {
    const response = await fetch(TAVERN_API.extCatalog)
    return readJson<{ entries: { name: string; url: string; note: string }[] }>(response)
  }

  /** Install from a GitHub repo, a manifest URL, a host directory, or a zip. */
  async extInstall(payload: { url?: string; zipBase64?: string; id?: string; overwrite?: boolean }): Promise<StInstallResponse> {
    return post<StInstallResponse>(TAVERN_API.extInstall, payload)
  }

  /** Delete an installed extension from disk. */
  async extRemove(id: string): Promise<{ ok: boolean }> {
    return post<{ ok: boolean }>(TAVERN_API.extRemove, { id })
  }
}


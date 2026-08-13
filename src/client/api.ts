/**
 * Browser-side API client for the /api/dsh-portable-tavern route family. The
 * only data access path the panel components use — plain fetch, same origin.
 */

import {
  TAVERN_API,
  type ChatMessage,
  type ChatResponse,
  type CharCard,
  type GenerateResponse,
  type ModelsResponse,
  type TavernSpec,
  type WorldbookResponse,
} from '../protocol.ts'

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
    return post<GenerateResponse>(TAVERN_API.generate, { spec, version })
  }

  async worldbook(spec: TavernSpec, card: CharCard | null): Promise<WorldbookResponse> {
    return post<WorldbookResponse>(TAVERN_API.worldbook, { spec, card })
  }

  async models(): Promise<ModelsResponse> {
    const response = await fetch(TAVERN_API.models)
    return readJson<ModelsResponse>(response)
  }

  async chat(card: CharCard, messages: ChatMessage[], provider?: string, model?: string): Promise<ChatResponse> {
    return post<ChatResponse>(TAVERN_API.chat, { card, messages, provider, model })
  }
}

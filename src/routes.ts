/**
 * The /api/dsh-portable-tavern route family: card generation, world-book
 * generation, model listing, and chat. Every route consumes LLM quota, so it
 * carries a loopback-only trust fence (plus browser same-origin markers) —
 * LAN-exposed dsh web deployments must not serve these endpoints.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import {
  TAVERN_API,
  type ApiErrorBody,
  type CharCard,
  type ChatMessage,
  type TavernSpec,
} from './protocol.ts'
import { chatReply, generateCard, generateWorldbook, listModels } from './llm.ts'

/** Cap on JSON request bodies (specs and chat histories are small). */
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024

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
        const spec = (body.spec ?? {}) as TavernSpec
        const version = body.version === 'v3' ? 'v3' : 'v2'
        try {
          const { card, rawText, fallback } = await generateCard(ctx, spec, version)
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
        const spec = (body.spec ?? {}) as TavernSpec
        const card = (body.card ?? null) as CharCard | null
        try {
          const { entries, rawText } = await generateWorldbook(ctx, spec, card)
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
          writeJson(res, 200, { options, current })
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
        const card = (body.card ?? {}) as CharCard
        const messages = (Array.isArray(body.messages) ? body.messages : []) as ChatMessage[]
        const provider = typeof body.provider === 'string' ? body.provider : undefined
        const model = typeof body.model === 'string' ? body.model : undefined
        try {
          const reply = await chatReply(ctx, card, messages, provider, model)
          writeJson(res, 200, { reply })
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error))
        }
      },
    },
  ]

  return routes
}

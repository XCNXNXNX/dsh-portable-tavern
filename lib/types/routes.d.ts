/**
 * The /api/dsh-portable-tavern route family: card generation, world-book
 * generation, model listing, and chat. Every route consumes LLM quota, so it
 * carries a loopback-only trust fence (plus browser same-origin markers) —
 * LAN-exposed dsh web deployments must not serve these endpoints.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
/**
 * Build every /api/dsh-portable-tavern route.
 * @param ctx - host context carrying webServer and llm.
 * @returns the exact-path route list.
 */
export declare function makeRoutes(ctx: Context): WebRoute[];

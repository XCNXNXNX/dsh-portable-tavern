/**
 * dsh-portable-tavern - host half. Registers the /api/dsh-portable-tavern
 * route family (generate / worldbook / models / chat), each backed by the
 * official `llm` service. The browser half (./client) renders the portable
 * tavern panel and calls these routes. Built on the official NPM SDK only.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-llm'
import { makeRoutes } from './routes.ts'

/** Stable cordis plugin name. */
export const name = 'portable-tavern'

/** Services required before the routes can mount. */
export const inject = ['webServer', 'llm']

/**
 * Mount the /api/dsh-portable-tavern route family.
 * @param ctx - host plugin context carrying webServer and llm.
 */
export function apply(ctx: Context): void {
  const routes = makeRoutes(ctx)
  ctx.effect(
    () => {
      const disposers = routes.map((route) => ctx.webServer.register(route))
      return () => { for (const dispose of disposers) dispose() }
    },
    'portable-tavern: routes',
  )
}

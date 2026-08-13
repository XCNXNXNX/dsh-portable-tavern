/**
 * dsh-portable-tavern - host half. Registers the /api/dsh-portable-tavern
 * route family (generate / worldbook / models / chat), each backed by the
 * official `llm` service. The browser half (./client) renders the portable
 * tavern panel and calls these routes. Built on the official NPM SDK only.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable cordis plugin name. */
export declare const name = "portable-tavern";
/** Services required before the routes can mount. */
export declare const inject: string[];
/**
 * Mount the /api/dsh-portable-tavern route family.
 * @param ctx - host plugin context carrying webServer and llm.
 */
export declare function apply(ctx: Context): void;

/**
 * Browser-half entry for dsh-portable-tavern. Registers two surfaces through
 * the slots service: the floating right-edge panel (shell.overlay) and a
 * secondary entry in the settings panel (settings.section). Uses createElement
 * here because the entry file stays `.ts` (the build.mjs client entry is
 * `src/client/index.ts`); the components live in PortableTavern.tsx.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Required services (fiber inject waiting — the slot registry must be up first). */
export declare const inject: string[];
/** Mount the portable tavern surfaces. */
export declare function apply(ctx: Context): void;

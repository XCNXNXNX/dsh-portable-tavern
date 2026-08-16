/**
 * User-supplied OpenAI-compatible endpoint, persisted browser-side only.
 * 妥善处理：the key lives in localStorage (browser-local), is sent solely to
 * the loopback-fenced /api/dsh-portable-tavern routes in the request body,
 * is masked in the UI (password input), and the host half never persists or
 * logs it.
 */
import type { LlmCustom } from '../protocol.ts';
export interface CustomLlmConfig extends LlmCustom {
    /** False when every field is empty (fully disconnected). */
    configured: boolean;
}
/** Read the stored config (never throws; unreadable storage = empty config). */
export declare function loadCustomLlm(): CustomLlmConfig;
/** Persist the config (quota failures swallowed — caller state still holds it). */
export declare function saveCustomLlm(config: LlmCustom): void;
/** Wipe the stored config. */
export declare function clearCustomLlm(): void;
/** The request-shape payload: undefined when not fully configured. */
export declare function customLlmPayload(): LlmCustom | undefined;

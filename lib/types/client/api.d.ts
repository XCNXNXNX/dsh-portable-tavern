/**
 * Browser-side API client for the /api/dsh-portable-tavern route family. The
 * only data access path the panel components use — plain fetch, same origin.
 */
import { type ChatMessage, type ChatResponse, type CharCard, type GenerateResponse, type ModelsResponse, type TavernSpec, type WorldbookResponse } from '../protocol.ts';
/** Error carrying the route's JSON error message. */
export declare class TavernApiError extends Error {
    constructor(message: string);
}
/** The browser half's only data entry point. */
export declare class TavernApi {
    generate(spec: TavernSpec, version: string): Promise<GenerateResponse>;
    worldbook(spec: TavernSpec, card: CharCard | null): Promise<WorldbookResponse>;
    models(): Promise<ModelsResponse>;
    chat(card: CharCard, messages: ChatMessage[], provider?: string, model?: string): Promise<ChatResponse>;
}

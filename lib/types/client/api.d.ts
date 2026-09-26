/**
 * Browser-side API client for the /api/dsh-portable-tavern route family. The
 * only data access path the panel components use — plain fetch, same origin.
 */
import { type ChatMessage, type ChatResponse, type CharCard, type CheckResult, type Encounter, type GenerateResponse, type ModelsResponse, type PartyMember, type PendingCheck, type RpgCheckResponse, type RpgMemberResponse, type RpgNarrateResponse, type RpgState, type RpgTurnResponse, type StExtension, type StInstallResponse, type TavernSpec, type WorldbookResponse } from '../protocol.ts';
/** Error carrying the route's JSON error message. */
export declare class TavernApiError extends Error {
    constructor(message: string);
}
/** The browser half's only data entry point. */
export declare class TavernApi {
    generate(spec: TavernSpec, version: string): Promise<GenerateResponse>;
    worldbook(spec: TavernSpec, card: CharCard | null): Promise<WorldbookResponse>;
    models(): Promise<ModelsResponse>;
    chat(card: CharCard, messages: ChatMessage[], provider?: string, model?: string, globalPrompt?: string): Promise<ChatResponse>;
    test(custom: {
        baseUrl: string;
        apiKey: string;
        model: string;
    }): Promise<{
        ok: true;
        latencyMs: number;
        reply: string;
        temperature?: string;
    }>;
    /** One narrative turn: the GM advances the story or asks for arbitration. */
    rpgTurn(payload: {
        state: RpgState;
        party: PartyMember[];
        action: string;
        narratorPrompt: string;
        provider?: string;
        model?: string;
    }): Promise<RpgTurnResponse>;
    /** Ask the system to compute what the player must roll. No dice, no model. */
    rpgCheck(member: PartyMember, encounter: Encounter, optionId: string, penalty?: number): Promise<RpgCheckResponse>;
    /** Throw the die. The host owns the RNG and the verdict. */
    rpgRoll(pending: PendingCheck, critEnabled: boolean): Promise<CheckResult>;
    /** Hand the decided outcome back to the GM, which may only narrate it. */
    rpgNarrate(payload: {
        state: RpgState;
        party: PartyMember[];
        action: string;
        result: CheckResult;
        narratorPrompt: string;
        provider?: string;
        model?: string;
    }): Promise<RpgNarrateResponse>;
    /** One party member speaks on its own model route. */
    rpgMember(member: PartyMember, state: RpgState, beat: string, instruction: string, globalRoute?: {
        provider?: string;
        model?: string;
    }): Promise<RpgMemberResponse>;
    /** Installed extensions plus the bundled theme pack. */
    extList(): Promise<{
        installed: StExtension[];
        builtin: StExtension[];
    }>;
    /** A short curated list of community extensions known to be CSS-first. */
    extCatalog(): Promise<{
        entries: {
            name: string;
            url: string;
            note: string;
        }[];
    }>;
    /** Install from a GitHub repo, a manifest URL, a host directory, or a zip. */
    extInstall(payload: {
        url?: string;
        zipBase64?: string;
        id?: string;
        overwrite?: boolean;
    }): Promise<StInstallResponse>;
    /** Delete an installed extension from disk. */
    extRemove(id: string): Promise<{
        ok: boolean;
    }>;
}

/**
 * Wire contract between the host half (routes.ts) and the browser half
 * (client/api.ts). Pure types plus route-path literals only — imported by both
 * halves, bundled into each, no runtime identity to share.
 */
/** Route paths the client calls (shared literals). */
export declare const TAVERN_API_BASE: "/api/dsh-portable-tavern";
export declare const TAVERN_API: {
    readonly generate: string;
    readonly worldbook: string;
    readonly models: string;
    readonly chat: string;
    readonly test: string;
};
/**
 * User-supplied OpenAI-compatible endpoint. Sent per-request from the browser
 * (localStorage), never persisted host-side and never logged; the host only
 * uses it for the upstream call.
 */
export interface LlmCustom {
    /** Base URL, e.g. https://api.deepseek.com (no /chat/completions suffix). */
    baseUrl: string;
    apiKey: string;
    model: string;
}
/** JSON error body used by every route. */
export interface ApiErrorBody {
    error: string;
}
/** The RPG form state assembled by the browser panel. */
export interface TavernBasic {
    name: string;
    age: number;
    ageUnknown: boolean;
    gender: string;
    race: string;
    raceCustom: string;
    job: string;
    jobCustom: string;
}
export interface TavernAppearance {
    height: number;
    heightUnit: string;
    build: string;
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    skinColor: string;
    features: string[];
}
export interface TavernPersonality {
    extroversion: number;
    agreeableness: number;
    conscientiousness: number;
    stability: number;
    openness: number;
    traits: string[];
}
export interface TavernBackground {
    origin: string;
    experience: string;
    world: string;
}
export interface TavernDialogue {
    style: string;
    tone: string;
    person: string;
}
export interface TavernScenario {
    scene: string;
    sceneTemplate: string;
    openerStyle: string;
}
export interface TavernSpec {
    basic: TavernBasic;
    appearance: TavernAppearance;
    personality: TavernPersonality;
    background: TavernBackground;
    abilities: string[];
    dialogue: TavernDialogue;
    scenario: TavernScenario;
}
/** SillyTavern V2/V3 character-card data object. */
export interface CharCardData {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    tags: string[];
    creator: string;
    character_version: string;
    extensions: Record<string, unknown>;
}
/** The V2/V3 envelope (spec + spec_version + data). */
export interface CharCard {
    spec: string;
    spec_version: string;
    data: CharCardData;
}
/** One World Book entry. */
export interface WorldbookEntry {
    keys: string[];
    content: string;
    comment?: string;
}
/** A chat-history turn. */
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
export interface GenerateResponse {
    card: CharCard;
    rawText: string;
    fallback: boolean;
    model: string;
    provider: string;
}
export interface WorldbookResponse {
    entries: WorldbookEntry[];
    rawText: string;
    model: string;
    provider: string;
}
export interface ModelsResponse {
    options: {
        provider: string;
        model: string;
        label: string;
    }[];
    current: {
        provider: string;
        model: string;
    } | null;
}
export interface ChatResponse {
    reply: string;
    model: string;
    provider: string;
}

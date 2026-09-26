/**
 * Wire contract between the host half (routes.ts) and the browser half
 * (client/api.ts). Pure types plus route-path literals only — imported by both
 * halves, bundled into each, no runtime identity to share.
 */

/** Route paths the client calls (shared literals). */
export const TAVERN_API_BASE = '/api/dsh-portable-tavern' as const

export const TAVERN_API = {
  generate: TAVERN_API_BASE + '/generate',
  worldbook: TAVERN_API_BASE + '/worldbook',
  models: TAVERN_API_BASE + '/models',
  chat: TAVERN_API_BASE + '/chat',
  test: TAVERN_API_BASE + '/test',
  // --- tabletop RPG (system-arbitrated) ---
  rpgTurn: TAVERN_API_BASE + '/rpg/turn',
  rpgCheck: TAVERN_API_BASE + '/rpg/check',
  rpgRoll: TAVERN_API_BASE + '/rpg/roll',
  rpgNarrate: TAVERN_API_BASE + '/rpg/narrate',
  rpgMember: TAVERN_API_BASE + '/rpg/member',
  // --- SillyTavern extension host ---
  extList: TAVERN_API_BASE + '/ext/list',
  extCatalog: TAVERN_API_BASE + '/ext/catalog',
  extInstall: TAVERN_API_BASE + '/ext/install',
  extRemove: TAVERN_API_BASE + '/ext/remove',
} as const

/**
 * User-supplied OpenAI-compatible endpoint. Sent per-request from the browser
 * (localStorage), never persisted host-side and never logged; the host only
 * uses it for the upstream call.
 */
export interface LlmCustom {
  /** Base URL, e.g. https://api.deepseek.com (no /chat/completions suffix). */
  baseUrl: string
  apiKey: string
  model: string
}

/** JSON error body used by every route. */
export interface ApiErrorBody {
  error: string
}

/**
 * How the temperature field reaches the provider (GitHub issue #1). Some
 * models pin it (KIMI K3: 'only 1 is allowed'), some reject the field
 * entirely; the host additionally learns such constraints per model route, so
 * this is the user's preference, not the last word.
 */
export interface TemperaturePolicy {
  /** auto = the per-call default; fixed = always 'value'; omit = never send it. */
  mode: 'auto' | 'fixed' | 'omit'
  /** Value used by mode 'fixed'. */
  value: number
}

/** Default sampling policy applied when the browser sends none. */
export const DEFAULT_TEMPERATURE_POLICY: TemperaturePolicy = { mode: 'auto', value: 0.85 }

/**
 * Base path of the extension file carrier. A prefix route, so the route table
 * stays the same size no matter how many extensions are installed.
 */
export const TAVERN_EXT_BASE = '/tavern-ext' as const

/** The RPG form state assembled by the browser panel. */
export interface TavernBasic {
  name: string
  age: number
  ageUnknown: boolean
  gender: string
  race: string
  raceCustom: string
  job: string
  jobCustom: string
}

export interface TavernAppearance {
  height: number
  heightUnit: string
  build: string
  hairColor: string
  hairStyle: string
  eyeColor: string
  skinColor: string
  features: string[]
}

export interface TavernPersonality {
  extroversion: number
  agreeableness: number
  conscientiousness: number
  stability: number
  openness: number
  traits: string[]
}

export interface TavernBackground {
  origin: string
  experience: string
  world: string
}

export interface TavernDialogue {
  style: string
  tone: string
  person: string
}

export interface TavernScenario {
  scene: string
  sceneTemplate: string
  openerStyle: string
}

export interface TavernSpec {
  basic: TavernBasic
  appearance: TavernAppearance
  personality: TavernPersonality
  background: TavernBackground
  abilities: string[]
  dialogue: TavernDialogue
  scenario: TavernScenario
}

/** SillyTavern V2/V3 character-card data object. */
export interface CharCardData {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  mes_example: string
  creator_notes: string
  system_prompt: string
  post_history_instructions: string
  alternate_greetings: string[]
  tags: string[]
  creator: string
  character_version: string
  extensions: Record<string, unknown>
}

/** The V2/V3 envelope (spec + spec_version + data). */
export interface CharCard {
  spec: string
  spec_version: string
  data: CharCardData
}

/** One World Book entry. */
export interface WorldbookEntry {
  keys: string[]
  content: string
  comment?: string
}

/** A chat-history turn. */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateResponse {
  card: CharCard
  rawText: string
  fallback: boolean
  model: string
  provider: string
}

export interface WorldbookResponse {
  entries: WorldbookEntry[]
  rawText: string
  model: string
  provider: string
}

export interface ModelsResponse {
  options: { provider: string; model: string; label: string }[]
  current: { provider: string; model: string } | null
  /** Temperature constraints the host learned from upstream 400s (issue #1). */
  learnedTemperatures?: { key: string; constraint: string }[]
}

export interface ChatResponse {
  reply: string
  model: string
  provider: string
}

// ---------------------------------------------------------------------------
// party / tabletop RPG wire types
// ---------------------------------------------------------------------------

/**
 * Where one speaker's tokens come from. `inherit` follows the tavern-wide
 * route, `dsh` pins a provider/model served by the harness, and `custom` is
 * the user's own OpenAI-compatible endpoint -- so a single party can mix a
 * local model for the narrator with a remote one for each companion.
 */
export interface MemberRoute {
  mode: 'inherit' | 'dsh' | 'custom'
  /** Harness provider id (mode 'dsh'). */
  provider: string
  /** Harness model id (mode 'dsh'). */
  model: string
  /** OpenAI-compatible base URL (mode 'custom'). */
  baseUrl: string
  /** Key for the custom endpoint; browser-local, never persisted host-side. */
  apiKey: string
  /** Model id on the custom endpoint (mode 'custom'). */
  customModel: string
}

/** A fresh, empty route following the tavern-wide selection. */
export const INHERIT_ROUTE: MemberRoute = {
  mode: 'inherit', provider: '', model: '', baseUrl: '', apiKey: '', customModel: '',
}

/** One player character. Structurally an engine Actor plus presentation. */
export interface PartyMember {
  id: string
  name: string
  /** Class / role line shown on the sheet, e.g. 流浪剑客. */
  role: string
  /** Portrait as a data URL; empty falls back to an initial. */
  avatar: string
  /** This member's own role-play instruction, independent of the card. */
  prompt: string
  attributes: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
  skills: { name: string; attr: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; bonus: number }[]
  hp: number
  maxHp: number
  status: string[]
  /** Per-member model routing -- the "each of them can have its own API" knob. */
  llm: MemberRoute
}

/** A saved, reloadable team. */
export interface Party {
  id: string
  name: string
  members: PartyMember[]
  /** Instruction for the narrator/GM voice. */
  narratorPrompt: string
  /** Route used by the narrator when members inherit. */
  narrator: MemberRoute
  savedAt: number
}

/** One option the GM offers the table. */
export interface EncounterOption {
  id: string
  label: string
  attribute: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | ''
  skill: string
  difficulty: number
  modifier: number
  hint: string
}

/** The situation the system must arbitrate. */
export interface Encounter {
  id: string
  /** combat / chase / social / environment / other. */
  kind: string
  title: string
  description: string
  /** 0..100 opposition rating driving difficulty. */
  threat: number
  options: EncounterOption[]
}

/** One line of the adventure log. */
export interface RpgLogEntry {
  id: string
  kind: 'scene' | 'action' | 'check' | 'result' | 'speech' | 'system'
  /** Speaker name for 'speech'. */
  who: string
  text: string
  /** Set on 'check'/'result' entries so the UI can render the dice block. */
  check?: CheckResult
  at: number
}

/** The check the table is waiting on: fully computed, only the die is missing. */
export interface PendingCheck {
  /** Which member must attempt it. */
  memberId: string
  /** The option being attempted (also used for one-off declared actions). */
  option: EncounterOption
  /** Encounter kind driving the consequences. */
  kind: string
  /** 0..100 opposition rating at the moment of the check. */
  threat: number
  /** The system's computed target and its audit trail. */
  computed: {
    actorId: string
    actorName: string
    optionId: string
    optionLabel: string
    required: number
    breakdown: { label: string; value: number }[]
    difficultyLabel: string
  }
}

/** Everything the table knows. */
export interface RpgState {
  /** One-paragraph summary of where the party is. */
  scene: string
  turn: number
  log: RpgLogEntry[]
  encounter: Encounter | null
  /** The check the table is waiting on, if any. */
  pending: PendingCheck | null
  inventory: string[]
  /** Chekhov's guns the GM has established. */
  facts: string[]
}

/** Wire shape of the RPG engine's check result (mirrors CheckResult). */
export interface CheckResult {
  roll: number
  required: number
  margin: number
  band: string
  bandLabel: string
  success: boolean
  critical: 'none' | 'success' | 'failure'
  directive: string
  effects: { hpLoss: number; addStatus: string[]; removeStatus: string[]; endsEncounter: boolean }
  breakdown: { label: string; value: number }[]
}

// --- route payloads ---

export interface RpgTurnRequest {
  state: RpgState
  party: PartyMember[]
  action: string
  narratorPrompt: string
  provider?: string
  model?: string
  sampling?: TemperaturePolicy
  custom?: LlmCustom
}

export interface RpgTurnResponse {
  narration: string
  scene: string
  encounter: Encounter | null
  /**
   * Set when the player's declared action itself needs a roll right now --
   * the system computes the target immediately, no choice screen involved.
   */
  check: EncounterOption | null
  facts: string[]
  /** Encounter kind the check belongs to (defaults to 'other'). */
  checkKind: string
  /** Threat rating the check is resolved against. */
  checkThreat: number
}

export interface RpgCheckRequest {
  member: PartyMember
  encounter: Encounter
  optionId: string
  penalty?: number
}

export interface RpgCheckResponse {
  /** The fully computed check, ready to be rolled. */
  pending: PendingCheck
}

export interface RpgRollRequest {
  pending: PendingCheck
  critEnabled: boolean
}

export interface RpgNarrateRequest {
  state: RpgState
  party: PartyMember[]
  /** The label of the option that was attempted. */
  action: string
  result: CheckResult
  narratorPrompt: string
  provider?: string
  model?: string
  sampling?: TemperaturePolicy
  custom?: LlmCustom
}

export interface RpgNarrateResponse {
  narration: string
  scene: string
  encounter: Encounter | null
}

export interface RpgMemberRequest {
  member: PartyMember
  state: RpgState
  /** Latest narration the member reacts to. */
  beat: string
  instruction: string
  /**
   * The tavern-wide route, used when the member is on 'inherit'. Without it a
   * member set to follow the global selection would silently fall back to the
   * harness default instead of the user's own endpoint.
   */
  inherit?: { provider?: string; model?: string; custom?: LlmCustom }
  sampling?: TemperaturePolicy
}

export interface RpgMemberResponse {
  line: string
  provider: string
  model: string
}

// ---------------------------------------------------------------------------
// SillyTavern extension host
// ---------------------------------------------------------------------------

/** A SillyTavern extension manifest (the subset the host reads). */
export interface StManifest {
  display_name?: string
  js?: string
  css?: string
  author?: string
  version?: string
  homePage?: string
  loading_order?: number
  i18n?: Record<string, string>
}

/** One installed extension. */
export interface StExtension {
  /** Directory name; unique. */
  id: string
  /** display_name from the manifest, else the id. */
  name: string
  author: string
  version: string
  homePage: string
  /** Relative entry script (empty when the extension is CSS-only). */
  js: string
  /** Relative stylesheet ('' when none). */
  css: string
  loadingOrder: number
  /** Where it came from, for display. */
  source: string
  /** True for the themes that ship inside the plugin. */
  builtin: boolean
  /** Display tags (bundled themes carry theirs; installed ones usually do not). */
  tags?: string[]
  /**
   * A few representative colours, extracted from the theme stylesheet, so the
   * store can preview a theme before it is applied.
   */
  palette?: string[]
  /** Absolute path of the file carrier for this extension. */
  base: string
  description: string
  /** Files shipped with the extension, for diagnostics. */
  files: string[]
}

export interface StInstallRequest {
  /** github repo URL, manifest URL, host directory, or empty for an upload. */
  url?: string
  /** Base64 .zip body when the browser uploads a package. */
  zipBase64?: string
  /** Override the derived id. */
  id?: string
  /** Reinstall over an existing id. */
  overwrite?: boolean
}

export interface StInstallResponse {
  ok: true
  extension: StExtension
  /** Non-fatal problems worth surfacing (skipped files, missing entry point). */
  warnings: string[]
  /** Upstream modules that were stubbed because they do not exist here. */
  stubs: string[]
}


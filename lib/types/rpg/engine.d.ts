/**
 * Portable Tavern tabletop engine -- the deterministic half of the RPG mode.
 *
 * The contract of the whole feature: the SYSTEM owns every number. Dice,
 * attribute modifiers, difficulty, the required roll, the margin, the outcome
 * band and the mechanical consequences are all computed here, in pure code with
 * an injected RNG, so they are reproducible, auditable and testable. The AI
 * only narrates the result it is handed and is explicitly forbidden from
 * changing it.
 *
 * Environment-neutral on purpose: both halves import this module. The host
 * supplies a crypto-backed RNG for authoritative rolls; the browser reuses the
 * same functions for live previews (a preview never consumes the real roll).
 */
/** The six attributes every combatant carries. */
export type AttrId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
/** Attribute scores. 10 is human average; the table is 1..20. */
export interface Attributes {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
}
/** One trained skill: which attribute it leans on plus a flat bonus. */
export interface Skill {
    name: string;
    attr: AttrId;
    bonus: number;
}
/** Anything that can attempt a check. */
export interface Actor {
    id: string;
    name: string;
    attributes: Attributes;
    skills: Skill[];
    /** Current and maximum hit points. */
    hp: number;
    maxHp: number;
    /** Free-form conditions such as 中毒 or 被追击. */
    status: string[];
}
/** Attribute display metadata (label plus the short code). */
export declare const ATTRS: {
    id: AttrId;
    label: string;
    short: string;
    blurb: string;
}[];
/** Clamp helper shared by every derived number. */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Attribute modifier on the d100 scale. Average (10) gives 0, and every point
 * away from average is worth 2 -- so an 18 (+16) is a real adventurer and an
 * untrained 6 (-8) genuinely struggles.
 * @param score - the raw attribute score.
 */
export declare function attrMod(score: number): number;
/** Look up one attribute score on an actor. */
export declare function attrOf(actor: Actor, id: AttrId): number;
/** The named difficulty anchors the GM picks from, before the actor applies. */
export declare const DIFFICULTY_LADDER: {
    id: string;
    label: string;
    value: number;
}[];
/** Snap an arbitrary GM-supplied difficulty onto the ladder (nearest anchor). */
export declare function snapDifficulty(value: number): number;
/** Human label for a difficulty value on the ladder. */
export declare function difficultyLabel(value: number): string;
/** A uniform integer in 1..faces; the RNG is injected so rolls stay testable. */
export declare function rollDie(faces: number, rng: () => number): number;
/** A d100 roll -- the system's core resolution die. */
export declare function rollD100(rng: () => number): number;
/** Roll count dice of the given size and add the bonus. */
export declare function rollDice(count: number, faces: number, bonus: number, rng: () => number): {
    rolls: number[];
    total: number;
};
/** One selectable course of action offered by the GM for an encounter. */
export interface CheckOption {
    id: string;
    /** Button text, e.g. 战斗 / 逃跑 / 交涉. */
    label: string;
    /** Attribute the attempt leans on; empty means pure luck. */
    attribute: AttrId | '';
    /** Named skill that adds its bonus when the actor has it. */
    skill: string;
    /** Base difficulty of the situation (snapped to the ladder). */
    difficulty: number;
    /** Situational modifier supplied with the encounter; positive makes it harder. */
    modifier: number;
    /** One-line flavour shown under the button. */
    hint: string;
}
/** One line of the "how we got this number" table. */
export interface BreakdownRow {
    label: string;
    value: number;
}
/** A fully computed check: what the player must roll, and why. */
export interface ComputedCheck {
    actorId: string;
    actorName: string;
    optionId: string;
    optionLabel: string;
    /** The number the player must roll on a d100 -- the headline figure. */
    required: number;
    /** Every contribution, in display order. */
    breakdown: BreakdownRow[];
    /** How hard the situation is, in words. */
    difficultyLabel: string;
}
/** Encounter context a check is resolved inside. */
export interface CheckContext {
    /** 0..100 opposition rating; 50 is neutral. */
    threat: number;
    /** Extra system-side modifier (terrain, darkness, wounds). */
    penalty?: number;
    /** Attribute the actor is exhausted on, if any. */
    exhausted?: AttrId[];
}
/** Skill bonus lookup by name (case-insensitive, trimmed). */
export declare function skillBonus(actor: Actor, name: string): number;
/**
 * Turn a situation plus an actor into the number the player must roll.
 *
 * Everything the actor brings is folded into a single target, because that is
 * how the mode is meant to read at the table: the system announces one number,
 * the player throws one die, and the difference is the story.
 * @param actor - who is attempting the action.
 * @param option - which course of action they chose.
 * @param context - encounter threat and situational penalties.
 */
export declare function computeCheck(actor: Actor, option: CheckOption, context: CheckContext): ComputedCheck;
/** Band identifiers, ordered from best to worst. */
export type BandId = 'triumph' | 'success' | 'costly' | 'narrow' | 'hair' | 'fail' | 'disaster';
/** One outcome band: the label, the narrator's brief, and the system's effects. */
export interface Band {
    id: BandId;
    label: string;
    /** Inclusive lower bound of the margin (roll - required). */
    min: number;
    /** True when the attempt succeeded. */
    success: boolean;
    /** How far off the attempt was, in words, used to grade the flavour. */
    grade: 'clean' | 'narrow';
    /** What the narrator must convey -- the system's instruction to the AI. */
    brief: string;
}
/** The band table. Ordered best-first; the first match wins. */
export declare const BANDS: Band[];
/** Find the band a margin falls into. */
export declare function bandOf(margin: number): Band;
/** What the system does to the world after a check resolves. */
export interface Effects {
    hpLoss: number;
    /** Conditions added to the actor. */
    addStatus: string[];
    /** Conditions removed from the actor. */
    removeStatus: string[];
    /** True when the encounter is over (fled, won, talked down). */
    endsEncounter: boolean;
}
/**
 * Mechanical consequences, scaled by how far the roll missed and how dangerous
 * the encounter is. The narrator is told about these, never asked to invent
 * them.
 * @param kind - encounter kind (combat / chase / social / ...).
 * @param band - the outcome band.
 * @param margin - signed distance from the required roll.
 * @param threat - 0..100 opposition rating.
 */
export declare function effectsFor(kind: string, band: Band, margin: number, threat: number): Effects;
/** The graded distance wording handed to the narrator. */
export declare function distanceWording(delta: number): string;
/** One resolved check: the roll, the target, and the system's verdict. */
export interface CheckResult {
    roll: number;
    required: number;
    /** roll - required; negative means the attempt fell short. */
    margin: number;
    band: BandId;
    bandLabel: string;
    success: boolean;
    /** 'success' / 'failure' when a natural critical overrode the band. */
    critical: 'none' | 'success' | 'failure';
    /** The instruction the narrator receives. */
    directive: string;
    effects: Effects;
    breakdown: BreakdownRow[];
}
/** Natural-roll thresholds for the optional critical rule. */
export declare const CRIT_LOW = 5;
export declare const CRIT_HIGH = 96;
/**
 * The system's verdict. This is the only place success is decided.
 * @param computed - the pre-computed check (target + breakdown).
 * @param roll - the d100 the player threw.
 * @param kind - encounter kind, used for consequences.
 * @param threat - 0..100 opposition rating.
 * @param critEnabled - whether natural 1-5 / 96-100 override the band.
 */
export declare function judge(computed: ComputedCheck, roll: number, kind: string, threat: number, critEnabled?: boolean): CheckResult;
/**
 * The exact brief the narrator receives. It states the numbers, the verdict,
 * and the flavour the distance demands -- and forbids re-deciding any of it.
 */
export declare function buildDirective(computed: ComputedCheck, roll: number, margin: number, band: Band, critical: CheckResult['critical'], effects: Effects): string;
/** Create a fresh actor with sane defaults. */
export declare function makeActor(id: string, name: string, patch?: Partial<Actor>): Actor;
/** Apply the system's effects to an actor, returning a new actor. */
export declare function applyEffects(actor: Actor, effects: Effects): Actor;
/** A short human summary of an actor's vital line. */
export declare function actorSummary(actor: Actor): string;

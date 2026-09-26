/**
 * Party model and persistence for the tavern's tabletop mode.
 *
 * A team is a plain JSON document -- members, their portraits, their stats and,
 * crucially, their individual model routes -- so saving, loading, exporting and
 * sharing one is just reading and writing that document. Nothing here talks to
 * the network.
 */
import { type MemberRoute, type Party, type PartyMember, type RpgState } from '../protocol.ts';
/** Attribute display metadata (mirrors the engine table for UI use). */
export declare const PARTY_ATTRS: {
    id: keyof PartyMember['attributes'];
    label: string;
    short: string;
    blurb: string;
}[];
/** Pick-from list for the role line. */
export declare const ROLE_PRESETS: string[];
/** Pick-from list for skills; the bonus is a starting suggestion. */
export declare const SKILL_PRESETS: {
    name: string;
    attr: PartyMember['skills'][number]['attr'];
    bonus: number;
}[];
/** Skill-name autocomplete pool. */
export declare const SKILL_NAMES: string[];
/** Total attribute points a member may distribute (6 attributes, min 6 each). */
export declare const ATTR_BUDGET = 66;
/** Floor for a single attribute. */
export declare const ATTR_MIN = 6;
/** Ceiling for a single attribute. */
export declare const ATTR_MAX = 18;
/** Sum of a member's attribute scores. */
export declare function attrTotal(attributes: PartyMember['attributes']): number;
/** Build a fresh member with a sensible spread. */
export declare function makeMember(index: number, patch?: Partial<PartyMember>): PartyMember;
/** Build a fresh empty team. */
export declare function makeParty(name?: string): Party;
/** A fresh adventure state for a party. */
export declare function makeRpgState(): RpgState;
/** Human label for a member's model route. */
export declare function routeLabel(route: MemberRoute): string;
/** Deep-copy a JSON document (used for save/load so edits stay isolated). */
export declare function clone<T>(value: T): T;
/** Every saved team. */
export declare function loadParties(): Party[];
/** Persist the team library. */
export declare function saveParties(list: Party[]): void;
/** Id of the team currently on the table. */
export declare function loadActivePartyId(): string;
/** Remember which team is on the table. */
export declare function saveActivePartyId(id: string): void;
/** The in-progress adventure. */
export declare function loadRpgState(): RpgState | null;
/** Persist the in-progress adventure. */
export declare function saveRpgState(state: RpgState): void;
/** Drop the in-progress adventure. */
export declare function clearRpgState(): void;
/** Normalize an imported team document, filling in every missing field. */
export declare function normalizeParty(raw: unknown): Party | null;

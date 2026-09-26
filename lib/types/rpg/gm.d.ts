/**
 * The narrator half of the RPG mode.
 *
 * Division of labour, enforced by the shape of this module: the GM model is
 * only ever asked for *prose* plus a *request for arbitration* (which attribute,
 * which difficulty, which options). It is never asked for a success or a
 * failure. Every number -- the required roll, the margin, the band, the hit
 * points lost -- comes from ./engine.ts and is handed back to the GM as an
 * already-decided fact it may only describe.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Encounter, EncounterOption, PartyMember, PendingCheck, RpgMemberRequest, RpgMemberResponse, RpgNarrateRequest, RpgNarrateResponse, RpgState, RpgTurnRequest, RpgTurnResponse } from '../protocol.ts';
import { type AttrId } from './engine.ts';
/** The GM's standing instruction. */
export declare const GM_SYSTEM: string;
/** The structured turn the GM must produce. */
export declare const GM_TURN_TOOL: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            narration: {
                type: string;
                description: string;
            };
            scene: {
                type: string;
                description: string;
            };
            facts: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            check: {
                description: string;
                type: string;
                properties: {
                    label: {
                        type: string;
                        description: string;
                    };
                    attribute: {
                        type: string;
                        enum: string[];
                        description: string;
                    };
                    skill: {
                        type: string;
                        description: string;
                    };
                    difficulty: {
                        type: string;
                        description: string;
                    };
                    modifier: {
                        type: string;
                        description: string;
                    };
                    hint: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
            };
            checkKind: {
                type: string;
                enum: string[];
                description: string;
            };
            checkThreat: {
                type: string;
                description: string;
            };
            encounter: {
                type: string;
                description: string;
                properties: {
                    kind: {
                        type: string;
                        enum: string[];
                        description: string;
                    };
                    title: {
                        type: string;
                        description: string;
                    };
                    description: {
                        type: string;
                        description: string;
                    };
                    threat: {
                        type: string;
                        description: string;
                    };
                    options: {
                        type: string;
                        items: {
                            type: string;
                            properties: {
                                label: {
                                    type: string;
                                    description: string;
                                };
                                attribute: {
                                    type: string;
                                    enum: string[];
                                    description: string;
                                };
                                skill: {
                                    type: string;
                                    description: string;
                                };
                                difficulty: {
                                    type: string;
                                    description: string;
                                };
                                modifier: {
                                    type: string;
                                    description: string;
                                };
                                hint: {
                                    type: string;
                                    description: string;
                                };
                            };
                            required: string[];
                        };
                        description: string;
                    };
                };
                required: string[];
            };
        };
        required: string[];
    };
};
/** The structured result of narrating an already-decided check. */
export declare const GM_NARRATE_TOOL: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            narration: {
                type: string;
                description: string;
            };
            scene: {
                type: string;
                description: string;
            };
            encounter: {
                type: string;
                description: string;
                properties: {
                    kind: {
                        type: string;
                        enum: string[];
                    };
                    title: {
                        type: string;
                    };
                    description: {
                        type: string;
                    };
                    threat: {
                        type: string;
                    };
                    options: {
                        type: string;
                        items: {
                            type: string;
                            properties: {
                                label: {
                                    type: string;
                                    description: string;
                                };
                                attribute: {
                                    type: string;
                                    enum: string[];
                                    description: string;
                                };
                                skill: {
                                    type: string;
                                    description: string;
                                };
                                difficulty: {
                                    type: string;
                                    description: string;
                                };
                                modifier: {
                                    type: string;
                                    description: string;
                                };
                                hint: {
                                    type: string;
                                    description: string;
                                };
                            };
                            required: string[];
                        };
                    };
                };
                required: string[];
            };
        };
        required: string[];
    };
};
/** The structured line one party member contributes. */
export declare const MEMBER_TOOL: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            line: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
/** Turn whatever the model emitted into a safe option. */
export declare function coerceOption(raw: unknown, index: number): EncounterOption;
/** Turn a model-emitted encounter into a safe one, or null when unusable. */
export declare function coerceEncounter(raw: unknown, fallbackThreat?: number): Encounter | null;
/** Turn a model-emitted check request into a safe option, or null. */
export declare function coerceCheck(raw: unknown): EncounterOption | null;
/** Render one party member's sheet for the GM prompt. */
export declare function describeParty(party: PartyMember[]): string;
/** Render the recent adventure log for the GM prompt. */
export declare function recentLog(state: RpgState, limit: number): string;
/** The opening instruction for a turn. */
export declare function buildTurnPrompt(req: RpgTurnRequest, member?: PartyMember | null): string;
/**
 * One narrative turn: the GM either advances the story, or asks the system to
 * arbitrate. Nothing here decides success -- it only shapes the request.
 * @param ctx - host context carrying the llm service.
 * @param req - table state, party, the player's declaration and the GM route.
 */
export declare function gmTurn(ctx: Context, req: RpgTurnRequest): Promise<RpgTurnResponse>;
/**
 * Narrate an already-decided check. The directive from the engine is the first
 * thing the model sees, so the verdict cannot drift.
 * @param ctx - host context.
 * @param req - table state, the system's result and the GM route.
 */
export declare function gmNarrate(ctx: Context, req: RpgNarrateRequest): Promise<RpgNarrateResponse>;
/** Build the pending check the table is waiting on (pure system work). */
export declare function buildPending(member: PartyMember, option: EncounterOption, kind: string, threat: number, penalty?: number): PendingCheck;
/** System prompt for one party member's own voice. */
export declare function memberSystem(member: PartyMember, state: RpgState, narratorPrompt: string): string;
/**
 * One party member's line, generated on that member's own model route -- the
 * feature that lets a single table mix several different APIs.
 * @param ctx - host context.
 * @param req - the member, the current scene and the beat they react to.
 */
export declare function memberLine(ctx: Context, req: RpgMemberRequest): Promise<RpgMemberResponse>;
/** Attribute label lookup used by the client too. */
export declare function attrLabel(id: AttrId): string;

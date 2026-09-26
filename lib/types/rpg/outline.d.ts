/**
 * Story outline: user-authored beats that the SYSTEM decides when to fire.
 *
 * The point of this module is that "trigger" is not a suggestion to the model.
 * Whether a beat fires is evaluated here, in pure code, against the table's
 * actual state -- turn count, the last verdict, who is hurt, what the player
 * just said, what has already been established. Only once a beat has fired does
 * its text reach the narrator, framed as something that must be staged now.
 *
 * Same division of labour as the rest of the mode: the system picks the moment,
 * the model performs it.
 */
import type { OutlineTrigger, TriggerKind } from '../protocol.ts';
import type { BandId } from './engine.ts';
/** Everything a trigger is allowed to look at. */
export interface TriggerContext {
    /** Turns played so far. */
    turn: number;
    /** The most recent resolved check, if any. */
    lastResult: {
        band: BandId;
        success: boolean;
        margin: number;
    } | null;
    /** Encounter kind currently on the table, or null. */
    encounterKind: string | null;
    /** The party's vital signs. */
    party: {
        name: string;
        hp: number;
        maxHp: number;
    }[];
    /** What the player just declared, verbatim. */
    action: string;
    /** Facts the table has already established. */
    facts: string[];
    /**
     * Consecutive outcomes: positive counts successive successes, negative
     * successive failures. Reset by the opposite result.
     */
    streak: number;
}
/** Human labels for the trigger kinds, used by the editor. */
export declare const TRIGGER_KINDS: {
    kind: TriggerKind;
    label: string;
    hint: string;
    field: string;
}[];
/** A fresh outline beat. */
export declare function makeBeat(index: number): {
    id: string;
    title: string;
    trigger: OutlineTrigger;
    event: string;
    once: boolean;
    fired: boolean;
    firedAtTurn: number;
};
/**
 * Decide whether one beat fires right now.
 * @param trigger - the condition the author wrote.
 * @param ctx - the table's current state.
 * @returns whether it fires, plus a short reason for the log.
 */
export declare function evaluateTrigger(trigger: OutlineTrigger, ctx: TriggerContext): {
    fired: boolean;
    reason: string;
};
/** One beat that the system decided to fire this turn. */
export interface FiredBeat {
    id: string;
    title: string;
    event: string;
    reason: string;
}
/**
 * Evaluate the whole outline in order and return the beats that fire.
 *
 * Every beat that fires this turn is returned (a scene change can satisfy
 * several conditions at once), and a beat marked `once` is retired by the
 * caller. Beats with an empty event body are retired silently rather than
 * handing the narrator an empty instruction.
 * @param beats - the outline, in author order.
 * @param ctx - the table's current state.
 */
export declare function runOutline(beats: {
    id: string;
    title: string;
    trigger: OutlineTrigger;
    event: string;
    once: boolean;
    fired: boolean;
}[], ctx: TriggerContext): {
    fired: FiredBeat[];
    retired: string[];
};
/** Advance the consecutive-outcome counter. */
export declare function nextStreak(streak: number, success: boolean): number;
/** Human-readable one-liner for a trigger, shown in the outline editor. */
export declare function describeTrigger(trigger: OutlineTrigger): string;

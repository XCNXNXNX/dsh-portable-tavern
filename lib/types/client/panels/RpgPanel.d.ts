/**
 * The tabletop panel.
 *
 * The screen is deliberately split along the feature's dividing line: the
 * system's half is the dice block, the required-roll maths and the settlement
 * rows (all computed host-side, rendered here verbatim), while the GM's half is
 * the narration text. A player can always see which half produced which line,
 * which is the whole point of "system arbitrates, AI narrates".
 */
import type * as React from 'react';
import type { Party, RpgState } from '../../protocol.ts';
import { TavernApi } from '../api.ts';
export interface RpgPanelProps {
    /** Data access layer. */
    api: TavernApi;
    /** The team on the table. */
    party: Party;
    /** Replace the team (hit points and conditions are written back here). */
    onParty: (next: Party) => void;
    /** The adventure so far. */
    state: RpgState;
    /** Replace the adventure state. */
    onState: (next: RpgState) => void;
    /** Global chat route, encoded as provider::model or custom::. */
    chatModel: string;
    /** Whether the global custom endpoint is fully configured. */
    customConfigured: boolean;
    /** Model name of the global custom endpoint (for labels). */
    customModel: string;
    /** Jump to the party tab. */
    onGotoParty: () => void;
}
/**
 * The tabletop surface.
 * @param props - api, party, adventure state and their writers.
 */
export declare function RpgPanel(props: RpgPanelProps): React.ReactElement;

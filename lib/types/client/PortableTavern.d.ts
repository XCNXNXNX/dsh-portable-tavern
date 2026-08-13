/**
 * Portable Tavern browser surface: the draggable floating entry plus the
 * three-tab panel (character card / chat / settings). Pure React; all data
 * goes through the TavernApi fetch client. No emoji, per repo rules.
 */
import type * as React from 'react';
export interface TavernStore {
    get(): boolean;
    set(value: boolean): void;
    subscribe(listener: () => void): () => void;
}
export declare function makeStore(initial: boolean): TavernStore;
export declare function TavernRoot(props: {
    store: TavernStore;
}): React.ReactElement;
export declare function SettingsEntry(props: {
    onOpen: () => void;
}): React.ReactElement;

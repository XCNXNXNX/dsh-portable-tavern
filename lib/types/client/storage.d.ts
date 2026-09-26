/**
 * Persistent storage for the tavern.
 *
 * localStorage is a 5 MB budget shared by everything on the origin, and the
 * tavern's payloads are dominated by pictures: every party portrait and
 * character avatar is an inline data URL. A few saved teams is enough to fill
 * the budget, at which point `setItem` throws -- and because every call site
 * used to swallow that error, the symptom was silent data loss: you edit a
 * team, refresh, and it is gone.
 *
 * So the heavy records live in IndexedDB instead (gigabytes, not megabytes),
 * localStorage keeps only small preferences, and every failure is reported
 * rather than eaten.
 */
/**
 * Keys whose payloads are large enough that localStorage is the wrong home.
 * These are read and written through IndexedDB; the localStorage copies are
 * only consulted once, to migrate an existing installation.
 */
export declare const HEAVY_KEYS: {
    readonly workspace: "dsh.portable-tavern.workspace.v1";
    readonly characters: "dsh.portable-tavern.characters.v1";
    readonly parties: "dsh.portable-tavern.parties.v1";
    readonly party: "dsh.portable-tavern.party.current.v1";
    readonly threads: "dsh.portable-tavern.threads.v1";
    readonly rpg: "dsh.portable-tavern.rpg.v1";
};
/** One storage problem worth showing the user. */
export interface StorageIssue {
    /** Key that failed. */
    key: string;
    /** 'write' or 'read'. */
    op: 'write' | 'read';
    message: string;
}
/**
 * Route storage failures somewhere visible. Without this the tavern silently
 * loses whatever it could not save, which is exactly the bug this module
 * exists to prevent.
 * @param fn - called once per failure.
 */
export declare function onStorageIssue(fn: ((issue: StorageIssue) => void) | null): void;
/**
 * Read one record from IndexedDB.
 * @param key - the record key.
 * @param fallbackKey - localStorage key to migrate from when IndexedDB is empty.
 */
export declare function loadRecord<T>(key: string, fallbackKey?: string): Promise<T | null>;
/**
 * Write one record to IndexedDB.
 * @param key - the record key.
 * @param value - any structured-cloneable value.
 * @returns whether the write succeeded, so the caller can warn the user.
 */
export declare function saveRecord(key: string, value: unknown): Promise<boolean>;
/** Delete one record. */
export declare function deleteRecord(key: string): Promise<void>;
/** Read a small preference (never throws). */
export declare function readPref<T>(key: string, fallback: T): T;
/**
 * Write a small preference. Reports quota problems instead of hiding them.
 * @param key - the preference key.
 * @param value - the value to store.
 */
export declare function writePref(key: string, value: unknown): boolean;
/** Remove a small preference. */
export declare function removePref(key: string): void;
/** How much room is left, for the settings panel. */
export declare function storageEstimate(): Promise<{
    usage: number;
    quota: number;
} | null>;

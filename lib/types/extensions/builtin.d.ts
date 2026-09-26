/**
 * Bundled community beautification themes for the portable tavern.
 *
 * Each theme is a standalone SillyTavern-shaped CSS asset (no network, no JS).
 * The host activates one theme by setting
 *   document.documentElement.dataset.tavernTheme = <id>
 * so every selector below must start with html[data-tavern-theme="<id>"] and
 * only one theme is ever live. Two variable families are part of the public
 * contract: --SmartTheme* (consumed by 129+ community SillyTavern extensions)
 * and --st-* (consumed by this plugin own panel styles).
 *
 * The CSS lives in plain string arrays rather than template literals: the build
 * chain is sensitive to backticks. Keyframe names are namespaced per theme so
 * they can never collide.
 */
/** One bundled beautification theme, shaped like a SillyTavern extension. */
export interface BuiltinTheme {
    /** Directory-safe unique id, kebab-case. */
    id: string;
    display_name: string;
    author: string;
    version: string;
    /** One-line Chinese description shown in the plugin store. */
    description: string;
    /** Theme tags shown as chips, e.g. ['深色','玻璃']. */
    tags: string[];
    /** The whole stylesheet. Must be scoped to html[data-tavern-theme="<id>"]. */
    css: string;
}
/** Every bundled theme, in store display order. */
export declare const BUILTIN_THEMES: BuiltinTheme[];

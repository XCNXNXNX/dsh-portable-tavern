/**
 * Host-side SillyTavern extension store.
 *
 * A SillyTavern extension is a directory with a manifest.json plus a JS entry,
 * an optional stylesheet and optional templates. This module installs such a
 * package (from GitHub, a manifest URL, a host directory or an uploaded zip),
 * rewrites the imports that only make sense inside SillyTavern itself, and
 * serves the files back to the browser half under /tavern-ext/<id>/.
 *
 * Why the rewrite matters: community extensions routinely reach into the
 * SillyTavern source tree ("../../../RossAscends-mods.js", "../../script.js").
 * Those modules do not exist here. Rather than let the browser fail the import
 * and kill the whole extension, install records exactly which symbols each
 * escaped import wanted and writes a per-extension stub module exporting them,
 * so the extension links and then degrades at the call site instead of at load.
 */
import type { StExtension } from '../protocol.ts';
/** Root that holds every installed extension. */
export declare function extensionsRoot(): string;
/** Directory of one installed extension. */
export declare function extensionDir(id: string): string;
/** Make an id safe to use as a single directory name. */
export declare function safeId(raw: string): string;
/** One extracted archive member. */
interface ZipEntry {
    name: string;
    data: Buffer;
}
/**
 * Read a zip archive. Supports stored (0) and deflate (8) members, which is
 * everything GitHub's zipball writer and every desktop zip tool produce.
 * @param buffer - the whole archive.
 */
export declare function unzip(buffer: Buffer): ZipEntry[];
/** Non-fatal notes produced while installing. */
export interface InstallReport {
    warnings: string[];
    stubs: string[];
}
/**
 * Install one extension into the store.
 * @param request - where the package comes from.
 * @returns the installed record plus install-time notes.
 */
export declare function installExtension(request: {
    url?: string;
    zipBase64?: string;
    id?: string;
    overwrite?: boolean;
}): Promise<{
    extension: StExtension;
    report: InstallReport;
}>;
/** Every extension installed on disk. */
export declare function listInstalled(): StExtension[];
/** The bundled beautification themes, presented in the same shape. */
export declare function listBuiltin(): StExtension[];
/** Remove one installed extension. */
export declare function removeExtension(id: string): boolean;
/**
 * Resolve a request path inside an extension, refusing traversal.
 *
 * Separators are unified to '/' before normalizing and converted back
 * afterwards: on Windows path.normalize rewrites every '/' to '\\', which would
 * otherwise make a plain 'theme.css' lookup miss its own file.
 * @param id - extension directory name.
 * @param relativePath - path below the extension root, from the URL.
 */
export declare function readExtensionFile(id: string, relativePath: string): {
    body: Buffer;
    type: string;
} | null;
/** Content type by extension, with a safe default for extension assets. */
export declare function contentTypeOf(path: string): string;
export {};

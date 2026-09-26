/**
 * Shared form primitives for the portable tavern panels. Extracted so the
 * character, party, RPG and plugin panels all render with one visual language
 * instead of four slightly different ones.
 */
import type * as React from 'react';
/** Join class names, dropping falsy entries. */
export declare function cx(...xs: Array<string | false | null | undefined>): string;
/** A collapsible titled block. */
export declare function Section(props: {
    title: string;
    hint?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}): React.ReactElement;
/** A labelled row. */
export declare function Field(props: {
    label: string;
    children: React.ReactNode;
}): React.ReactElement;
/** A labelled range input with end captions. */
export declare function Slider(props: {
    min: number;
    max: number;
    value: number;
    left: string;
    right: string;
    onChange: (v: number) => void;
}): React.ReactElement;
/** A radio group rendered as pills. */
export declare function RadioGroup(props: {
    options: {
        value: string;
        label: string;
    }[];
    value: string;
    onChange: (v: string) => void;
}): React.ReactElement;
/** A multi- or single-select chip row. */
export declare function Chips(props: {
    options: string[];
    values: string[] | string;
    multiple?: boolean;
    onChange: (v: string[] | string) => void;
}): React.ReactElement;
/** A palette of swatches plus a free colour input. */
export declare function ColorSwatches(props: {
    palette: string[];
    value: string;
    onChange: (v: string) => void;
}): React.ReactElement;
/** An input plus an "add" button that appends to a string list. */
export declare function CustomAdd(props: {
    values: string[];
    onAdd: (v: string[]) => void;
    placeholder: string;
}): React.ReactElement;
/** The standard button. */
export declare function Btn(props: {
    children: React.ReactNode;
    variant?: 'primary' | 'ghost';
    disabled?: boolean;
    onClick?: () => void;
    title?: string;
}): React.ReactElement;
/**
 * Read an image file and downscale it to a compact JPEG data URL, so avatars
 * and portraits can live in localStorage and inside exported JSON.
 * @param file - the picked image.
 * @param cb - receives the data URL, or '' when the file cannot be read.
 */
export declare function fileToAvatar(file: File, cb: (dataUrl: string) => void, max?: number): void;
/** The image file picker used by the avatar and portrait rows. */
export declare function AvatarPicker(props: {
    avatar: string;
    name: string;
    fallbackGradient: string;
    onChange: (dataUrl: string) => void;
    size?: number;
}): React.ReactElement;
/** Trigger a browser download for a blob. */
export declare function downloadFile(filename: string, blob: Blob): void;

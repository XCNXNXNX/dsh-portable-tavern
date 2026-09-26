/**
 * 斜杠命令与弹窗的最小兼容面（P2）。
 *
 * 取舍：
 * - SlashCommandParser.addCommand / addCommandObject 只做“注册即可”，把命令存进表里；
 *   真去执行一律抛清晰错误（本宿主没有 ST 的命令管线），错误文案里带命令名；
 * - SlashCommand.fromProps / fromJson 返回命令对象；ARGUMENT_TYPE 提供常用常量；
 * - callGenericPopup 在 CONFIRM 时用 window.confirm 返回 POPUP_RESULT，其它类型返回 null；
 *   INPUT 走 window.prompt；
 * - Popup / POPUP_TYPE / POPUP_RESULT 提供常量与极简实例面。
 */
/** ST 的 SlashCommand 参数类型常量（真实字符串值）。 */
export declare const ARGUMENT_TYPE: {
    /** 字符串。 */
    readonly STRING: "string";
    /** 数字。 */
    readonly NUMBER: "number";
    /** 布尔。 */
    readonly BOOLEAN: "boolean";
    /** 变量引用。 */
    readonly VARIABLE: "variable";
    /** 列表。 */
    readonly LIST: "list";
    /** 闭包。 */
    readonly CLOSURE: "closure";
    /** 字典。 */
    readonly DICTIONARY: "dictionary";
    /** 枚举。 */
    readonly ENUM: "enum";
};
/** 弹窗类型常量（与 ST 数值一致）。 */
export declare const POPUP_TYPE: {
    /** 纯文本提示。 */
    readonly TEXT: 1;
    /** 确认框。 */
    readonly CONFIRM: 2;
    /** 输入框。 */
    readonly INPUT: 3;
    /** 只读展示。 */
    readonly DISPLAY: 4;
    /** 图片裁剪。 */
    readonly CROP: 5;
};
/** 弹窗结果常量（与 ST 数值一致）。 */
export declare const POPUP_RESULT: {
    /** 取消（也是 null）。 */
    readonly CANCELLED: null;
    /** 否定。 */
    readonly NEGATIVE: 0;
    /** 肯定 / 确定。 */
    readonly AFFIRMATIVE: 1;
    /** 自定义按钮 1。 */
    readonly CUSTOM1: 2;
    /** 自定义按钮 2。 */
    readonly CUSTOM2: 3;
    /** 自定义按钮 3。 */
    readonly CUSTOM3: 4;
    /** 自定义按钮 4。 */
    readonly CUSTOM4: 5;
};
/** 命令描述（扩展 addCommand 时传的那个对象）。 */
export interface StSlashCommandDescriptor {
    /** 命令名（不含前导斜杠）。 */
    name?: string;
    /** 执行体（本宿主不会调用它）。 */
    callback?: ((...args: unknown[]) => unknown) | null;
    /** 别名列表。 */
    aliases?: string[] | string;
    /** 帮助文本。 */
    helpString?: string;
    /** 返回类型描述。 */
    returns?: string;
    /** 其余字段原样保留。 */
    [key: string]: unknown;
}
/** 命令对象（注册进 parser 的东西）。 */
export interface StSlashCommandObject {
    /** 命令名。 */
    name: string;
    /** 执行体（可能为 null）。 */
    callback: ((...args: unknown[]) => unknown) | null;
    /** 别名数组。 */
    aliases: string[];
    /** 帮助文本。 */
    helpString: string;
    /** 返回类型描述。 */
    returns: string;
    /** 原始描述（调试用）。 */
    rawProps: StSlashCommandDescriptor;
    /** 执行：本宿主一律抛清晰错误。 */
    execute(...args: unknown[]): never;
}
/** SlashCommand 类面（fromProps / fromJson 是扩展最常用的静态方法）。 */
export interface StSlashCommandClass {
    /** 构造一个新命令。 */
    new (name?: string, callback?: ((...args: unknown[]) => unknown) | null, helpString?: string): StSlashCommandObject;
    /** 由描述对象构造。 */
    fromProps(props?: StSlashCommandDescriptor | null): StSlashCommandObject;
    /** 由 JSON（或对象）构造。 */
    fromJson(json?: unknown): StSlashCommandObject;
}
/** 造一个命令对象（不执行任何东西）。 */
export declare function makeSlashCommand(props?: StSlashCommandDescriptor | null): StSlashCommandObject;
/** 创建 SlashCommand 类（带 fromProps / fromJson 静态方法）。 */
export declare function createSlashCommandClass(): StSlashCommandClass;
/** 命令解析器面（只做注册表）。 */
export interface StSlashCommandParserFace {
    /** 命令名 -> 命令对象。 */
    commands: Record<string, StSlashCommandObject>;
    /** 注册一个命令（返回命令对象）。 */
    addCommand(descriptor: StSlashCommandDescriptor): StSlashCommandObject;
    /** 注册一个已构造的命令对象。 */
    addCommandObject(command: StSlashCommandObject | StSlashCommandDescriptor): StSlashCommandObject;
    /** 取命令（含别名）。 */
    getCommand(name: string): StSlashCommandObject | undefined;
    /** 移除命令。 */
    removeCommand(name: string): boolean;
    /** 已注册命令名列表。 */
    listCommands(): string[];
    /** 执行：一律抛清晰错误。 */
    execute(name: string, ...args: unknown[]): never;
}
/** 创建只注册不执行的 SlashCommandParser。 */
export declare function createSlashCommandParser(onWarn?: (message: string) => void): StSlashCommandParserFace;
/** callGenericPopup 的选项（只用得上 okButton / cancelButton 这两个）。 */
export interface StPopupOptions {
    /** 确定按钮文案。 */
    okButton?: string;
    /** 取消按钮文案。 */
    cancelButton?: string;
    /** 其余字段忽略。 */
    [key: string]: unknown;
}
/**
 * 用浏览器原生对话框实现 ST 的 callGenericPopup。
 * CONFIRM 返回 POPUP_RESULT.AFFIRMATIVE / NEGATIVE；INPUT 返回输入串或 null；其余返回 null。
 */
export declare function callGenericPopup(content: unknown, type?: number, options?: StPopupOptions): Promise<number | string | null>;
/** Popup 实例的最小面。 */
export interface StPopupInstance {
    /** 弹窗内容。 */
    content: unknown;
    /** 弹窗类型。 */
    type: number;
    /** 选项。 */
    options: StPopupOptions;
    /** 显示（原生对话框）并返回结果。 */
    show(): Promise<number | string | null>;
    /** 完成（由 show 内部调用；外部调用只记录结果）。 */
    complete(result?: number | string | null): void;
    /** 关闭。 */
    close(): void;
}
/** Popup 类面（带 TYPE / RESULT 静态常量）。 */
export interface StPopupClass {
    /** 构造。 */
    new (content?: unknown, type?: number, options?: StPopupOptions): StPopupInstance;
    /** 弹窗类型常量。 */
    TYPE: typeof POPUP_TYPE;
    /** 弹窗结果常量。 */
    RESULT: typeof POPUP_RESULT;
}
/** 创建 Popup 类（静态常量 + 极简实例）。 */
export declare function createPopupClass(): StPopupClass;

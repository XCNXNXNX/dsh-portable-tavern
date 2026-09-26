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
export const ARGUMENT_TYPE = {
  /** 字符串。 */
  STRING: 'string',
  /** 数字。 */
  NUMBER: 'number',
  /** 布尔。 */
  BOOLEAN: 'boolean',
  /** 变量引用。 */
  VARIABLE: 'variable',
  /** 列表。 */
  LIST: 'list',
  /** 闭包。 */
  CLOSURE: 'closure',
  /** 字典。 */
  DICTIONARY: 'dictionary',
  /** 枚举。 */
  ENUM: 'enum',
} as const

/** 弹窗类型常量（与 ST 数值一致）。 */
export const POPUP_TYPE = {
  /** 纯文本提示。 */
  TEXT: 1,
  /** 确认框。 */
  CONFIRM: 2,
  /** 输入框。 */
  INPUT: 3,
  /** 只读展示。 */
  DISPLAY: 4,
  /** 图片裁剪。 */
  CROP: 5,
} as const

/** 弹窗结果常量（与 ST 数值一致）。 */
export const POPUP_RESULT = {
  /** 取消（也是 null）。 */
  CANCELLED: null,
  /** 否定。 */
  NEGATIVE: 0,
  /** 肯定 / 确定。 */
  AFFIRMATIVE: 1,
  /** 自定义按钮 1。 */
  CUSTOM1: 2,
  /** 自定义按钮 2。 */
  CUSTOM2: 3,
  /** 自定义按钮 3。 */
  CUSTOM3: 4,
  /** 自定义按钮 4。 */
  CUSTOM4: 5,
} as const

// ---------------------------------------------------------------------------
// SlashCommand
// ---------------------------------------------------------------------------

/** 命令描述（扩展 addCommand 时传的那个对象）。 */
export interface StSlashCommandDescriptor {
  /** 命令名（不含前导斜杠）。 */
  name?: string
  /** 执行体（本宿主不会调用它）。 */
  callback?: ((...args: unknown[]) => unknown) | null
  /** 别名列表。 */
  aliases?: string[] | string
  /** 帮助文本。 */
  helpString?: string
  /** 返回类型描述。 */
  returns?: string
  /** 其余字段原样保留。 */
  [key: string]: unknown
}

/** 命令对象（注册进 parser 的东西）。 */
export interface StSlashCommandObject {
  /** 命令名。 */
  name: string
  /** 执行体（可能为 null）。 */
  callback: ((...args: unknown[]) => unknown) | null
  /** 别名数组。 */
  aliases: string[]
  /** 帮助文本。 */
  helpString: string
  /** 返回类型描述。 */
  returns: string
  /** 原始描述（调试用）。 */
  rawProps: StSlashCommandDescriptor
  /** 执行：本宿主一律抛清晰错误。 */
  execute(...args: unknown[]): never
}

/** SlashCommand 类面（fromProps / fromJson 是扩展最常用的静态方法）。 */
export interface StSlashCommandClass {
  /** 构造一个新命令。 */
  new (name?: string, callback?: ((...args: unknown[]) => unknown) | null, helpString?: string): StSlashCommandObject
  /** 由描述对象构造。 */
  fromProps(props?: StSlashCommandDescriptor | null): StSlashCommandObject
  /** 由 JSON（或对象）构造。 */
  fromJson(json?: unknown): StSlashCommandObject
}

/** 造一个命令对象（不执行任何东西）。 */
export function makeSlashCommand(props?: StSlashCommandDescriptor | null): StSlashCommandObject {
  const source = props && typeof props === 'object' ? props : {}
  const name = typeof source.name === 'string' ? source.name : ''
  const aliases = Array.isArray(source.aliases)
    ? source.aliases.map((a) => String(a))
    : (typeof source.aliases === 'string' && source.aliases ? source.aliases.split(',').map((a) => a.trim()) : [])
  return {
    name,
    callback: typeof source.callback === 'function' ? source.callback : null,
    aliases,
    helpString: typeof source.helpString === 'string' ? source.helpString : '',
    returns: typeof source.returns === 'string' ? source.returns : '',
    rawProps: source,
    execute: (): never => {
      throw new Error('便携酒馆：暂不支持执行斜杠命令 /' + name + '（本宿主没有 ST 的命令管线，命令已注册但不会被执行）')
    },
  }
}

/** 创建 SlashCommand 类（带 fromProps / fromJson 静态方法）。 */
export function createSlashCommandClass(): StSlashCommandClass {
  const SlashCommand = function (this: StSlashCommandObject, name?: string, callback?: ((...args: unknown[]) => unknown) | null, helpString?: string): void {
    Object.assign(this, makeSlashCommand({ name, callback, helpString }))
  } as unknown as StSlashCommandClass
  const statics = SlashCommand as unknown as Record<string, unknown>
  statics.fromProps = (props?: StSlashCommandDescriptor | null): StSlashCommandObject => makeSlashCommand(props)
  statics.fromJson = (json?: unknown): StSlashCommandObject => {
    if (typeof json === 'string') {
      try { return makeSlashCommand(JSON.parse(json) as StSlashCommandDescriptor) } catch (e) { console.error('[portable-tavern/st] SlashCommand.fromJson 解析失败', e); return makeSlashCommand(null) }
    }
    return makeSlashCommand((json || null) as StSlashCommandDescriptor | null)
  }
  return SlashCommand
}

// ---------------------------------------------------------------------------
// SlashCommandParser
// ---------------------------------------------------------------------------

/** 命令解析器面（只做注册表）。 */
export interface StSlashCommandParserFace {
  /** 命令名 -> 命令对象。 */
  commands: Record<string, StSlashCommandObject>
  /** 注册一个命令（返回命令对象）。 */
  addCommand(descriptor: StSlashCommandDescriptor): StSlashCommandObject
  /** 注册一个已构造的命令对象。 */
  addCommandObject(command: StSlashCommandObject | StSlashCommandDescriptor): StSlashCommandObject
  /** 取命令（含别名）。 */
  getCommand(name: string): StSlashCommandObject | undefined
  /** 移除命令。 */
  removeCommand(name: string): boolean
  /** 已注册命令名列表。 */
  listCommands(): string[]
  /** 执行：一律抛清晰错误。 */
  execute(name: string, ...args: unknown[]): never
}

/** 创建只注册不执行的 SlashCommandParser。 */
export function createSlashCommandParser(onWarn?: (message: string) => void): StSlashCommandParserFace {
  const commands: Record<string, StSlashCommandObject> = {}
  const warn = (message: string): void => {
    try { if (onWarn) onWarn(message); else console.warn('[portable-tavern/st] ' + message) } catch { /* 忽略 */ }
  }
  const parser: StSlashCommandParserFace = {
    commands,
    addCommand: (descriptor: StSlashCommandDescriptor): StSlashCommandObject => {
      const command = makeSlashCommand(descriptor)
      if (!command.name) {
        warn('扩展注册了一个没有名字的斜杠命令，已忽略')
        return command
      }
      commands[command.name] = command
      for (const alias of command.aliases) commands[alias] = command
      return command
    },
    addCommandObject: (command: StSlashCommandObject | StSlashCommandDescriptor): StSlashCommandObject => {
      const obj = command && typeof (command as StSlashCommandObject).execute === 'function'
        ? command as StSlashCommandObject
        : makeSlashCommand(command as StSlashCommandDescriptor)
      if (obj.name) {
        commands[obj.name] = obj
        for (const alias of obj.aliases) commands[alias] = obj
      }
      return obj
    },
    getCommand: (name: string): StSlashCommandObject | undefined => commands[name],
    removeCommand: (name: string): boolean => {
      const found = commands[name]
      if (!found) return false
      for (const key of Object.keys(commands)) if (commands[key] === found) delete commands[key]
      return true
    },
    listCommands: (): string[] => Object.keys(commands),
    execute: (name: string): never => {
      throw new Error('便携酒馆：暂不支持执行斜杠命令 /' + name + '（该扩展依赖 ST 的命令管线）')
    },
  }
  return parser
}

// ---------------------------------------------------------------------------
// Popup
// ---------------------------------------------------------------------------

/** callGenericPopup 的选项（只用得上 okButton / cancelButton 这两个）。 */
export interface StPopupOptions {
  /** 确定按钮文案。 */
  okButton?: string
  /** 取消按钮文案。 */
  cancelButton?: string
  /** 其余字段忽略。 */
  [key: string]: unknown
}

/**
 * 用浏览器原生对话框实现 ST 的 callGenericPopup。
 * CONFIRM 返回 POPUP_RESULT.AFFIRMATIVE / NEGATIVE；INPUT 返回输入串或 null；其余返回 null。
 */
export function callGenericPopup(content: unknown, type?: number, options?: StPopupOptions): Promise<number | string | null> {
  const text = typeof content === 'string' ? content : (content && typeof content === 'object' && typeof (content as HTMLElement).textContent === 'string' ? String((content as HTMLElement).textContent) : String(content === undefined || content === null ? '' : content))
  const kind = typeof type === 'number' ? type : POPUP_TYPE.TEXT
  try {
    if (kind === POPUP_TYPE.CONFIRM) {
      const ok = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(text) : false
      return Promise.resolve(ok ? POPUP_RESULT.AFFIRMATIVE : POPUP_RESULT.NEGATIVE)
    }
    if (kind === POPUP_TYPE.INPUT) {
      const value = typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt(text, '') : null
      return Promise.resolve(value === null ? null : value)
    }
    const okLabel = options && typeof options.okButton === 'string' ? options.okButton : '确定'
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') window.confirm(text + '\n\n（' + okLabel + '）')
    return Promise.resolve(null)
  } catch (e) {
    console.error('[portable-tavern/st] callGenericPopup 失败', e)
    return Promise.resolve(null)
  }
}

/** Popup 实例的最小面。 */
export interface StPopupInstance {
  /** 弹窗内容。 */
  content: unknown
  /** 弹窗类型。 */
  type: number
  /** 选项。 */
  options: StPopupOptions
  /** 显示（原生对话框）并返回结果。 */
  show(): Promise<number | string | null>
  /** 完成（由 show 内部调用；外部调用只记录结果）。 */
  complete(result?: number | string | null): void
  /** 关闭。 */
  close(): void
}

/** Popup 类面（带 TYPE / RESULT 静态常量）。 */
export interface StPopupClass {
  /** 构造。 */
  new (content?: unknown, type?: number, options?: StPopupOptions): StPopupInstance
  /** 弹窗类型常量。 */
  TYPE: typeof POPUP_TYPE
  /** 弹窗结果常量。 */
  RESULT: typeof POPUP_RESULT
}

/** 创建 Popup 类（静态常量 + 极简实例）。 */
export function createPopupClass(): StPopupClass {
  const Popup = function (this: StPopupInstance, content?: unknown, type?: number, options?: StPopupOptions): void {
    this.content = content
    this.type = typeof type === 'number' ? type : POPUP_TYPE.TEXT
    this.options = options || {}
    this.show = () => callGenericPopup(this.content, this.type, this.options)
    this.complete = () => { /* 结果只体现在 show() 的 Promise 上 */ }
    this.close = () => { /* 原生对话框无需关闭 */ }
  } as unknown as StPopupClass
  const statics = Popup as unknown as Record<string, unknown>
  statics.TYPE = POPUP_TYPE
  statics.RESULT = POPUP_RESULT
  return Popup
}

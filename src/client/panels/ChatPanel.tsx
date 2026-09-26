/**
 * 聊天面板：把便携酒馆原先挤在 PortableTavern 里的 renderChat 抽成独立面板，
 * 并加上“和队伍成员单独聊天”的能力 —— 每个会话目标（角色卡 / 每名队员）各有
 * 一条对话记录，点顶部的 chip 就能换人说话；冒险进行中时还能把商量的结论直接
 * 送回冒险窗口的行动输入框。
 *
 * 纯受控组件：面板自己不持有对话数据，threads / target / chatModel 都由父组件
 * 传入并回写，持久化与标签页切换留在父组件。本文件不 import PortableTavern，
 * 用到的 cleanPlaceholders / avatarGradient 等小工具在这里各留一份等价实现。
 */

import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import type { CharCard, ChatMessage, Party, TavernSpec } from '../../protocol.ts'
import type { TavernApi } from '../api.ts'
import { routeLabel } from '../party.ts'
import { Btn, cx } from '../ui.tsx'
import { css } from '../styles.ts'

// ---------------------------------------------------------------------------
// 常量与小工具
// ---------------------------------------------------------------------------

/** 角色卡线程在 threads 里的键（成员线程的键是成员 id）。 */
const CARD_TARGET = 'card'

/** 带进冒险的摘要最多包含最近几条对话。 */
const CARRY_LIMIT = 6

/** 横幅标题里场景摘要的最大字数。 */
const SCENE_LIMIT = 36

/** 自定义接口没配好时的提示；沿用原聊天页文案，只是不再跳设置页。 */
const CUSTOM_MISSING = '请先到「设置 → 模型接入」填写自定义接口（地址 / API Key / 模型）'

/** chip 里的小圆头像：比消息头像再小一圈。 */
const CHIP_AVATAR: React.CSSProperties = { width: 18, height: 18, fontSize: 10, marginTop: 0 }

/** 成员消息：名字与气泡的竖向排布。 */
const MEMBER_COLUMN: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, maxWidth: '84%', minWidth: 0 }

/** 成员消息气泡上方的名字。 */
const MEMBER_LABEL: React.CSSProperties = { color: 'var(--st-text-dim)', fontSize: 11, paddingLeft: 2 }

/**
 * 把角色卡里的 {{char}} / {{user}} 占位符换成实际称呼。
 * @param s - 原始文本。
 * @param name - 角色名，缺省时用“角色”。
 */
function cleanPlaceholders(s: string | undefined, name: string | undefined): string {
  return String(s ?? '').split('{{char}}').join(name || '角色').split('{{user}}').join('你')
}

/**
 * 角色卡头像缺图时的渐变兜底：取外观里的发色与肤色。
 * @param spec - 角色卡对应的设定。
 */
function avatarGradient(spec: TavernSpec): string {
  const a = spec.appearance
  return 'linear-gradient(135deg,' + (a.hairColor || '#8b5a2b') + ',' + (a.skinColor || '#f2c9a0') + ')'
}

/**
 * 由名字哈希出的稳定渐变，作为成员没有头像时的兜底底色。
 * @param seed - 参与哈希的文本（成员名）。
 */
function memberGradient(seed: string): string {
  const text = seed || '?'
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360
  }
  const from = hash
  const to = (hash + 48) % 360
  return 'linear-gradient(135deg, hsl(' + from + ', 66%, 52%), hsl(' + to + ', 70%, 36%))'
}

/**
 * 名字首字，用作头像兜底文字。
 * @param name - 角色名或成员名。
 */
function initial(name: string): string {
  return (name || '?').slice(0, 1)
}

/**
 * 场景摘要：太长就截断，空场景给一句兜底。
 * @param scene - 冒险的当前场景。
 */
function sceneSummary(scene: string): string {
  const text = scene.trim()
  if (text === '') return '故事仍在继续'
  return text.length > SCENE_LIMIT ? text.slice(0, SCENE_LIMIT) + '…' : text
}

/**
 * 把当前线程最近几条对话拼成一段可以带进冒险的中文摘要。
 * @param who - 对话对象的称呼（成员名，或角色名）。
 * @param messages - 当前线程的全部消息。
 */
function buildPlan(who: string, messages: ChatMessage[]): string {
  const lines = messages.slice(-CARRY_LIMIT).map((m) => (m.role === 'user' ? '我：' + m.content : who + '：' + m.content))
  return '与 ' + who + ' 商定的计划：\n' + lines.join('\n')
}

/**
 * 把 chatModel（provider::model 或 custom::）拆成一次调用要用的路由，
 * 与 PortableTavern 里 onSend 的解析规则保持一致。
 * @param chatModel - 下拉框里的当前取值。
 * @param customModel - 自定义接口的模型名（mode 为 custom 时使用）。
 */
function splitRoute(chatModel: string, customModel: string): { provider?: string; model?: string; isCustom: boolean } {
  const parts = (chatModel || '').split('::')
  if (parts[0] === 'custom') return { provider: 'custom', model: customModel, isCustom: true }
  if (parts.length >= 2 && parts[0] !== '') return { provider: parts[0], model: parts.slice(1).join('::'), isCustom: false }
  return { isCustom: false }
}

/**
 * 圆形头像：有图用图，没图用名字首字加渐变兜底。
 * @param props.src - 头像图片（data URL），空串表示没有。
 * @param props.name - 用于兜底首字与 alt 的称呼。
 * @param props.gradient - 兜底渐变。
 * @param props.className - 外框类名（决定尺寸）。
 * @param props.imgClassName - 图片类名。
 * @param props.style - 额外内联样式。
 */
function Avatar(props: {
  src: string
  name: string
  gradient: string
  className: string
  imgClassName: string
  style?: React.CSSProperties
}): React.ReactElement {
  const style: React.CSSProperties = {
    ...(props.style ?? {}),
    ...(props.src === '' ? { background: props.gradient } : {}),
  }
  return (
    <div className={props.className} style={style}>
      {props.src === '' ? initial(props.name) : <img className={props.imgClassName} src={props.src} alt={props.name} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 面板
// ---------------------------------------------------------------------------

/**
 * 聊天面板的全部输入。面板是纯受控的：对话记录、当前目标与模型路由都由父组件
 * 持有，面板只负责渲染与回写。
 */
export interface ChatPanelProps {
  api: TavernApi
  /** 当前角色卡，可能为空。 */
  card: CharCard | null
  /** 角色卡头像（data URL）。 */
  cardAvatar: string
  /** 角色卡对应的 spec，用于生成头像渐变兜底。 */
  spec: TavernSpec
  /** 当前队伍。 */
  party: Party
  /** 每个会话目标各自的对话记录：键是 'card' 或成员 id。 */
  threads: Record<string, ChatMessage[]>
  onThreads: (next: Record<string, ChatMessage[]>) => void
  /** 当前打开的目标：'card' 或成员 id。 */
  target: string
  onTarget: (next: string) => void
  /** 全局系统提示词。 */
  globalPrompt: string
  /** 当前模型路由，编码为 provider::model 或 custom::。 */
  chatModel: string
  onModel: (next: string) => void
  modelOptions: { provider: string; model: string; label: string }[]
  customConfigured: boolean
  customModel: string
  /** 正在进行的冒险（没有就是 undefined），成员聊天需要知道。 */
  adventure?: { scene: string; beat: string; encounter: { title: string; description: string; options: string[] } | null }
  /** 把这次商量的计划带进冒险窗口。 */
  onCarryPlan: (plan: string) => void
  /** 没有角色卡时引导用户去创建。 */
  onGotoCharacter: () => void
}

/**
 * 聊天面板本体。
 *
 * 目标解析：props.target 指向一个已不存在的成员时，本帧按 'card' 渲染，
 * 并在 effect 里把 target 纠正回 'card'（渲染期间绝不调用 onTarget）。
 * 冒险横幅在角色卡与成员两种目标下都会显示；“把计划带进冒险”按钮两边都给，
 * 摘要里的称呼随当前目标变化（成员名 / 角色名）。
 * @param props - 见 {@link ChatPanelProps}。
 */
export function ChatPanel(props: ChatPanelProps): React.ReactElement {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [carried, setCarried] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  // 最新的 threads：异步回复回来时按它合并，免得覆盖别处刚写入的内容。
  const threadsRef = useRef(props.threads)
  threadsRef.current = props.threads

  // 目标可能已经被删掉（成员被移除）。这里只做回退，纠正动作交给下面的 effect。
  const member = props.party.members.find((m) => m.id === props.target) ?? null
  const target = member === null ? CARD_TARGET : member.id
  const messages = props.threads[target] ?? []

  const memberName = member === null ? '' : (member.name || '队员')
  const cardName = props.card === null ? '' : (props.card.data.name || '')
  const targetName = member === null ? (cardName || '角色卡') : memberName
  const avatarSrc = member === null ? props.cardAvatar : member.avatar
  const avatarBg = member === null ? avatarGradient(props.spec) : memberGradient(memberName)
  const isCardEmpty = member === null && props.card === null
  const adventure = props.adventure
  const route = splitRoute(props.chatModel, props.customModel)

  useEffect(() => {
    if (props.target !== target) props.onTarget(target)
  }, [props.target, target])

  // 换人说话时清掉上一段对话留下的临时状态。
  useEffect(() => {
    setError('')
    setCarried(false)
    setClearArmed(false)
  }, [target])

  // 二次确认没点下去就自动失效，免得清空按钮一直挂着“确认”。
  useEffect(() => {
    if (!clearArmed) return
    const timer = window.setTimeout(() => setClearArmed(false), 4000)
    return () => window.clearTimeout(timer)
  }, [clearArmed])

  // 新消息与发送中都要贴到底部；#pt-chat-log 同时被兼容宿主当作 #chat 镜像。
  useEffect(() => {
    const el = logRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [messages.length, sending, target])

  /** 只替换某一个目标的对话记录，其余目标原样保留。 */
  const setThread = (key: string, next: ChatMessage[]): void => {
    props.onThreads({ ...threadsRef.current, [key]: next })
  }

  /** 发送一条消息：角色卡走 api.chat，成员走 api.chatMember。 */
  const onSend = (): void => {
    const text = input.trim()
    if (text === '' || sending) return
    if (isCardEmpty) return
    // 只有真正落到全局自定义接口上时才需要全局配置：成员自带接口的走它自己的。
    if (route.isCustom && (member === null || member.llm.mode === 'inherit') && !props.customConfigured) {
      setError(CUSTOM_MISSING)
      return
    }
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setThread(target, next)
    setInput('')
    setSending(true)
    setError('')
    /** 收到回复后就地补进同一条 thread。 */
    const done = (reply: string): void => { setThread(target, [...next, { role: 'assistant', content: reply }]) }
    if (member !== null) {
      void props.api.chatMember(member, next, adventure, { provider: route.provider, model: route.model })
        .then((res) => done(res.reply))
        .catch((e) => setError(e instanceof Error ? e.message : '回复失败'))
        .finally(() => setSending(false))
      return
    }
    const card = props.card
    if (card === null) return
    void props.api.chat(card, next, route.provider, route.model, props.globalPrompt)
      .then((res) => done(res.reply))
      .catch((e) => setError(e instanceof Error ? e.message : '回复失败'))
      .finally(() => setSending(false))
  }

  /** 清空当前目标的对话：角色卡回到 first_mes 开场白，成员清成空数组。两次点击才生效。 */
  const onClear = (): void => {
    if (!clearArmed) { setClearArmed(true); return }
    setClearArmed(false)
    setError('')
    setCarried(false)
    if (member !== null) { setThread(target, []); return }
    const card = props.card
    const greeting = card === null ? '' : cleanPlaceholders(card.data.first_mes, card.data.name)
    setThread(target, greeting === '' ? [] : [{ role: 'assistant', content: greeting }])
  }

  /** 把最近几条对话拼成计划摘要，交给父组件送进冒险窗口的行动输入框。 */
  const onCarry = (): void => {
    if (messages.length === 0) return
    props.onCarryPlan(buildPlan(targetName, messages))
    setCarried(true)
  }

  return (
    <div className={css.stChat}>
      <div className={css.stChipWrap} style={{ flex: 'none', padding: '10px 16px 0', maxHeight: 96, overflowY: 'auto' }}>
        <button
          type="button"
          className={cx(css.stChip, member === null && css.stChipActive)}
          style={isCardEmpty ? { display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.5, cursor: 'not-allowed' } : { display: 'inline-flex', alignItems: 'center', gap: 6 }}
          disabled={isCardEmpty}
          title={isCardEmpty ? '还没有角色卡' : (cardName || '角色卡')}
          onClick={() => props.onTarget(CARD_TARGET)}
        >
          <Avatar src={isCardEmpty ? '' : props.cardAvatar} name={cardName} gradient={avatarGradient(props.spec)} className={css.stMsgAvatar} imgClassName={css.stMsgAvatarImg} style={CHIP_AVATAR} />
          <span>{isCardEmpty ? '还没有角色卡' : (cardName || '未命名角色')}</span>
        </button>
        {props.party.members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={cx(css.stChip, member !== null && member.id === m.id && css.stChipActive)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title={m.role === '' ? (m.name || '队员') : (m.name || '队员') + ' · ' + m.role}
            onClick={() => props.onTarget(m.id)}
          >
            <Avatar src={m.avatar} name={m.name} gradient={memberGradient(m.name)} className={css.stMsgAvatar} imgClassName={css.stMsgAvatarImg} style={CHIP_AVATAR} />
            <span>{m.name || '队员'}</span>
            <span style={{ color: 'var(--st-text-dim)', fontSize: 10 }}>{routeLabel(m.llm)}</span>
          </button>
        ))}
      </div>
      {props.party.members.length === 0
        ? <div className={css.stRpgHint} style={{ flex: 'none', padding: '8px 16px 0' }}>队伍里还没有成员。到「队伍」页添加队友，就能在这里和每个人单独聊天。</div>
        : null}
      <div className={css.stChatHead}>
        <Avatar src={avatarSrc} name={targetName} gradient={avatarBg} className={css.stChatAvatar} imgClassName={css.stChatAvatarImg} />
        <div className={css.stChatMeta}>
          <div className={css.stChatName}>{member === null ? (cardName || '未命名角色') : memberName}</div>
          {member === null
            ? null
            : <div style={{ color: 'var(--st-text-dim)', fontSize: 11 }}>{(member.role === '' ? '' : member.role + ' · ') + routeLabel(member.llm)}</div>}
          <select className={cx(css.stInput, css.stChatModel)} value={props.chatModel} onChange={(e) => props.onModel(e.target.value)}>
            <option value="custom::">{props.customConfigured ? '自定义 · ' + props.customModel : '自定义模型（未配置）'}</option>
            {props.modelOptions.length === 0 ? <option value="">加载模型…</option> : null}
            {props.modelOptions.map((o) => <option key={o.provider + '::' + o.model} value={o.provider + '::' + o.model}>{o.label}</option>)}
          </select>
        </div>
        <Btn onClick={onClear} title={clearArmed ? '再点一次清空当前目标的对话' : '清空当前目标的对话'}>{clearArmed ? '确认清空' : '清空'}</Btn>
      </div>
      {adventure === undefined
        ? null
        : (
          <div className={css.stRpgCard} style={{ flex: 'none', margin: '10px 16px 0' }}>
            <div className={css.stRpgCardTitle}>冒险进行中：{adventure.encounter ? adventure.encounter.title : sceneSummary(adventure.scene)}</div>
            <div className={css.stRpgHint}>你可以在这里和 TA 商量对策，然后把结论带回冒险窗口。</div>
            <div>
              <Btn
                variant="primary"
                disabled={messages.length === 0}
                title={messages.length === 0 ? '先聊出点结论，再带进冒险' : '把最近 ' + CARRY_LIMIT + ' 条对话整理成计划'}
                onClick={onCarry}
              >把计划带进冒险</Btn>
            </div>
            {carried ? <div style={{ color: 'var(--st-accent)', fontSize: 12 }}>已送到冒险窗口的行动输入框</div> : null}
          </div>
        )}
      {isCardEmpty
        ? (
          <div className={css.stEmpty}>
            <div className={css.stEmptyEmoji}>Tavern</div>
            <div>还没有角色。请先到「角色卡」页设定/导入角色，再来开聊。</div>
            <Btn variant="primary" onClick={props.onGotoCharacter}>去创建角色</Btn>
          </div>
        )
        : (
          <div className={css.stChatLog} id="pt-chat-log" ref={logRef}>
            {messages.map((m, i) => {
              const isUser = m.role === 'user'
              return (
                <div key={i} className={cx(css.stMsg, isUser ? css.stMsgUser : css.stMsgChar)}>
                  {isUser
                    ? null
                    : <Avatar src={avatarSrc} name={targetName} gradient={avatarBg} className={css.stMsgAvatar} imgClassName={css.stMsgAvatarImg} />}
                  {isUser || member === null
                    ? <div className={css.stMsgBubble}>{m.content}</div>
                    : (
                      <div style={MEMBER_COLUMN}>
                        <div style={MEMBER_LABEL}>{memberName}</div>
                        <div className={css.stMsgBubble} style={{ maxWidth: '100%' }}>{m.content}</div>
                      </div>
                    )}
                </div>
              )
            })}
          </div>
        )}
      {isCardEmpty
        ? null
        : (
          <>
            {error === '' ? null : <div className={cx(css.stNotice, css.stChatError)}>{error}</div>}
            <div className={css.stChatInput} style={{ flex: 'none' }}>
              <textarea
                className={cx(css.stInput, css.stTextarea)}
                rows={2}
                value={input}
                disabled={sending}
                onChange={(e) => setInput(e.target.value)}
                placeholder={member === null
                  ? '输入对白或动作…（Enter 发送，Shift+Enter 换行）'
                  : '和 ' + memberName + ' 说点什么…（Enter 发送，Shift+Enter 换行）'}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
              />
              <Btn variant="primary" disabled={sending || input.trim() === ''} onClick={onSend}>{sending ? '…' : '发送'}</Btn>
            </div>
          </>
        )}
    </div>
  )
}

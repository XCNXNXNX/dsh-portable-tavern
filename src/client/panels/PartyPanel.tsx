/**
 * 队伍编辑器面板：一支队伍的名称、成员、旁白者，以及每个成员各自的模型接入。
 *
 * 纯受控组件 -- 面板自己不持有队伍数据，任何编辑都构造一份新的 Party 交给
 * props.onChange，持久化（队伍库存取 / localStorage）由父组件负责。队伍模型、
 * 预设表与解析工具全部复用 client/party.ts，本文件只做展示与交互。
 */

import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import { INHERIT_ROUTE, type MemberRoute, type Party, type PartyMember } from '../../protocol.ts'
import {
  ATTR_BUDGET,
  ATTR_MAX,
  ATTR_MIN,
  PARTY_ATTRS,
  ROLE_PRESETS,
  SKILL_PRESETS,
  attrTotal,
  makeMember,
  normalizeParty,
  routeLabel,
} from '../party.ts'
import { AvatarPicker, Btn, Chips, CustomAdd, Field, RadioGroup, Section, Slider, cx, downloadFile } from '../ui.tsx'
import { css } from '../styles.ts'

// ---------------------------------------------------------------------------
// 常量与小工具
// ---------------------------------------------------------------------------

/** 一支队伍的人数下限与上限。 */
const MIN_MEMBERS = 1
const MAX_MEMBERS = 12

/** 六个属性的 id 联合类型。 */
type AttrId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

/** 一条技能的完整形状（与 PartyMember.skills 的元素一致）。 */
type SkillItem = PartyMember['skills'][number]

/** 一个可选模型（与 props.modelOptions 的元素一致）。 */
type ModelOption = { provider: string; model: string; label: string }

/** 数值夹取。 */
function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}

/** 读一个整数；空输入或非法输入回退到 fallback。 */
function readInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

/** 由名字哈希出的稳定渐变，作为没有头像时的兜底底色。 */
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

/** 名字首字，用作头像兜底文字。 */
function initial(name: string): string {
  return (name || '?').slice(0, 1)
}

/** HP 百分比（0..100）。 */
function hpPercent(hp: number, maxHp: number): number {
  return clamp(Math.round((hp / (maxHp > 0 ? maxHp : 1)) * 100), 0, 100)
}

/** HP 条颜色：健康 / 带伤 / 濒死。 */
function hpColor(pct: number): string {
  if (pct <= 30) return '#e05c5c'
  if (pct <= 60) return '#e0a13c'
  return '#4caf7d'
}

/** 属性 id 的中文名。 */
function attrLabel(id: AttrId): string {
  const found = PARTY_ATTRS.find((a) => a.id === id)
  return found ? found.label : id
}

/** 只改一个属性，返回一份新的属性对象。 */
function attrPatch(attributes: PartyMember['attributes'], id: AttrId, value: number): PartyMember['attributes'] {
  const next = { ...attributes }
  next[id] = value
  return next
}

/** 改一条技能的加成，返回一份新的技能列表。 */
function bonusPatch(skills: SkillItem[], index: number, bonus: number): SkillItem[] {
  return skills.map((s, i) => (i === index ? { ...s, bonus } : s))
}
/**
 * 按勾选结果重建技能列表：保留下来的技能保留用户改过的加成，新勾选的取预设值。
 * @param existing - 成员当前技能列表。
 * @param names - 勾选后的技能名（顺序即 Chip 顺序）。
 */
function mergeSkills(existing: SkillItem[], names: string[]): SkillItem[] {
  return names.map((name) => {
    const kept = existing.find((s) => s.name === name)
    if (kept) return kept
    const preset = SKILL_PRESETS.find((p) => p.name === name)
    if (preset) return { name: preset.name, attr: preset.attr, bonus: preset.bonus }
    return { name, attr: 'str' as AttrId, bonus: 4 }
  })
}

/** 保存时间的本地短格式。 */
function formatTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '未知时间'
  return new Date(ts).toLocaleString()
}

/** 文件名安全化：去掉 Windows 不允许的字符，空名回退。 */
function safeFileName(name: string): string {
  const cleaned = (name || '').replace(/[\\/:*?"<>|]/g, '_').trim()
  return cleaned === '' ? 'party' : cleaned
}

// ---------------------------------------------------------------------------
// 小组件
// ---------------------------------------------------------------------------

/** 一条内联的 HP 条（宽度按百分比）。 */
function HpBar(props: { hp: number; maxHp: number; width: number }): React.ReactElement {
  const pct = hpPercent(props.hp, props.maxHp)
  return (
    <span style={{ display: 'inline-block', width: props.width, height: 6, borderRadius: 3, background: '#2a2f3a', overflow: 'hidden', flex: 'none' }}>
      <span style={{ display: 'block', height: '100%', width: pct + '%', background: hpColor(pct) }} />
    </span>
  )
}

/** 小圆头像：有图用图，没图用名字哈希渐变加首字。 */
function MiniAvatar(props: { name: string; avatar: string; size: number }): React.ReactElement {
  const style: React.CSSProperties = { width: props.size, height: props.size, flex: 'none' }
  if (props.avatar) return <img className={css.stLibAvatar} style={style} src={props.avatar} alt={props.name} />
  return <span className={css.stLibAvatarFallback} style={{ ...style, background: memberGradient(props.name) }}>{initial(props.name)}</span>
}

/**
 * 模型路线编辑器：跟随全局 / 指定 DSH 模型 / 独立自定义接口。成员与旁白者共用。
 */
function RouteEditor(props: {
  label: string
  route: MemberRoute
  modelOptions: ModelOption[]
  customConfigured: boolean
  customModel: string
  onChange: (next: MemberRoute) => void
}): React.ReactElement {
  const route = props.route
  const patch = (fields: Partial<MemberRoute>): void => props.onChange({ ...route, ...fields })
  const selected = route.provider !== '' && route.model !== '' ? route.provider + '::' + route.model : ''
  const missBase = route.baseUrl.trim() === ''
  const missModel = route.customModel.trim() === ''
  const incomplete = route.mode === 'custom' && (missBase || missModel)
  return (
    <Field label={props.label}>
      <RadioGroup
        options={[
          { value: 'inherit', label: '跟随全局' },
          { value: 'dsh', label: '指定 DSH 模型' },
          { value: 'custom', label: '独立自定义接口' },
        ]}
        value={route.mode}
        onChange={(v) => patch({ mode: v as MemberRoute['mode'] })}
      />
      {route.mode === 'inherit'
        ? (
          <div className={css.stLabel} style={{ marginTop: 6 }}>
            {props.customConfigured
              ? '使用酒馆设置里的默认模型 / 全局自定义接口：当前走全局自定义接口，模型 ' + (props.customModel || '（还没填模型名）') + '。'
              : '使用酒馆设置里的默认模型 / 全局自定义接口：当前走 DSH 默认模型与密钥。'}
          </div>
        )
        : null}
      {route.mode === 'dsh'
        ? (
          <div style={{ marginTop: 6 }}>
            <select
              className={css.stInput}
              value={selected}
              onChange={(e) => {
                const value = e.target.value
                const at = value.indexOf('::')
                if (at < 0) { patch({ provider: '', model: '' }); return }
                patch({ provider: value.slice(0, at), model: value.slice(at + 2) })
              }}
            >
              <option value="">（未指定，等同于跟随全局）</option>
              {props.modelOptions.map((o) => (
                <option key={o.provider + '::' + o.model} value={o.provider + '::' + o.model}>{o.label}</option>
              ))}
            </select>
            {props.modelOptions.length === 0 ? <div className={css.stLabel} style={{ marginTop: 4 }}>DSH 目前没有返回可用模型列表。</div> : null}
          </div>
        )
        : null}
      {route.mode === 'custom'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            <input className={css.stInput} value={route.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} placeholder="接口地址 Base URL（不带 /chat/completions），例如 https://api.deepseek.com" />
            <input className={css.stInput} type="password" autoComplete="off" value={route.apiKey} onChange={(e) => patch({ apiKey: e.target.value })} placeholder="API Key（只存在本浏览器，不会发给宿主；但导出队伍 JSON 时会一起带走，分享前请留意）" />
            <input className={css.stInput} value={route.customModel} onChange={(e) => patch({ customModel: e.target.value })} placeholder="模型名称，例如 deepseek-chat" />
          </div>
        )
        : null}
      {incomplete
        ? (
          <div className={css.stNotice}>
            {'独立接口还没配置完：' + (missBase ? '缺少接口地址' : '') + (missBase && missModel ? '、' : '') + (missModel ? '缺少模型名称' : '') + '。不补全的话，这个说话人只能退回全局模型。'}
          </div>
        )
        : null}
      {route.mode === 'inherit'
        ? null
        : (
          <div className={cx(css.stRow, css.stGap)}>
            <Btn variant="ghost" onClick={() => props.onChange({ ...INHERIT_ROUTE })}>重置为跟随全局</Btn>
            <span className={css.stLibMeta}>{'当前：' + routeLabel(route)}</span>
          </div>
        )}
    </Field>
  )
}

/**
 * 单个成员的折叠卡片：头像、姓名 / 职业、独立人设、独立 API、属性、HP、技能与状态。
 */
function MemberCard(props: {
  member: PartyMember
  index: number
  open: boolean
  canRemove: boolean
  refCb: (el: HTMLDivElement | null) => void
  onToggle: () => void
  onRemove: () => void
  onPatch: (fields: Partial<PartyMember>) => void
  modelOptions: ModelOption[]
  customConfigured: boolean
  customModel: string
}): React.ReactElement {
  const m = props.member
  const [skillName, setSkillName] = useState('')
  const [skillBonus, setSkillBonus] = useState('4')
  const [skillAttr, setSkillAttr] = useState<AttrId>('str')

  const total = attrTotal(m.attributes)
  const over = total > ATTR_BUDGET

  /** 平均分配：ATTR_BUDGET 六等分，余数依次补给前几项。 */
  const spreadEven = (): void => {
    const base = Math.floor(ATTR_BUDGET / PARTY_ATTRS.length)
    const rest = ATTR_BUDGET % PARTY_ATTRS.length
    const next = { ...m.attributes }
    PARTY_ATTRS.forEach((a, i) => {
      next[a.id] = clamp(base + (i < rest ? 1 : 0), ATTR_MIN, ATTR_MAX)
    })
    props.onPatch({ attributes: next })
  }

  /** 追加一条自定义技能（重名忽略）。 */
  const addSkill = (): void => {
    const name = skillName.trim()
    setSkillName('')
    if (name === '') return
    if (m.skills.some((s) => s.name === name)) return
    const bonus = clamp(readInt(skillBonus, 0), -99, 99)
    props.onPatch({ skills: [...m.skills, { name, attr: skillAttr, bonus }] })
  }

  return (
    <div className={css.stSection} ref={props.refCb} style={{ scrollMarginTop: 8 }}>
      <div className={css.stSectionHead} style={{ cursor: 'pointer' }} onClick={props.onToggle}>
        <MiniAvatar name={m.name} avatar={m.avatar} size={30} />
        <span className={css.stSectionTitle}>{'#' + (props.index + 1) + ' ' + (m.name || '未命名')}</span>
        <span className={css.stLibMeta}>{routeLabel(m.llm)}</span>
        <span className={css.stLibMeta}>{'HP ' + m.hp + '/' + m.maxHp}</span>
        <HpBar hp={m.hp} maxHp={m.maxHp} width={40} />
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className={css.stTplDel}
            disabled={!props.canRemove}
            title={props.canRemove ? '移除该成员' : '至少要保留 1 名成员'}
            onClick={(e) => { e.stopPropagation(); props.onRemove() }}
          >
            移除
          </button>
          <span className={css.stSectionCaret}>{props.open ? '-' : '+'}</span>
        </span>
      </div>
      {props.open
        ? (
          <div className={css.stSectionBody}>
            <Field label="头像">
              <AvatarPicker
                avatar={m.avatar}
                name={m.name}
                fallbackGradient={memberGradient(m.name)}
                size={256}
                onChange={(url) => props.onPatch({ avatar: url })}
              />
            </Field>
            <Field label="姓名">
              <input className={css.stInput} value={m.name} onChange={(e) => props.onPatch({ name: e.target.value })} placeholder="例如：莉安·霜刃" />
            </Field>
            <Field label="定位 / 职业（点下面的预设快速填入，也可以直接手写）">
              <input className={css.stInput} value={m.role} onChange={(e) => props.onPatch({ role: e.target.value })} placeholder="例如：游侠 / 斥候 / 宫廷医师" />
              <Chips options={ROLE_PRESETS} values={m.role} onChange={(v) => props.onPatch({ role: typeof v === 'string' ? v : v.join('') })} />
            </Field>
            <Field label="该成员的独立人设提示词">
              <textarea
                className={cx(css.stInput, css.stTextarea)}
                rows={4}
                value={m.prompt}
                onChange={(e) => props.onPatch({ prompt: e.target.value })}
                placeholder="例如：你是沉默寡言的精灵游侠，说话简短，习惯先观察再行动……"
              />
              <div className={css.stLabel}>只作用于这个人：他说什么、怎么决定都按这段话走，不会覆盖角色卡本身的设定。</div>
            </Field>
            <RouteEditor
              label="独立 API 接入（这个人用哪个模型说话）"
              route={m.llm}
              modelOptions={props.modelOptions}
              customConfigured={props.customConfigured}
              customModel={props.customModel}
              onChange={(next) => props.onPatch({ llm: next })}
            />
            <div className={css.stTpl}>
              <div className={css.stTplHead}>{'属性分配：已分配 ' + total + ' / ' + ATTR_BUDGET + '（每项 ' + ATTR_MIN + ' - ' + ATTR_MAX + '）'}</div>
              {over
                ? <div className={css.stNotice}>{'属性点超支：已分配 ' + total + ' 点，超出 ' + (total - ATTR_BUDGET) + ' 点，请下调，否则判定会越来越难。'}</div>
                : null}
              <div className={cx(css.stRow, css.stGap)} style={{ marginBottom: 8 }}>
                <Btn onClick={spreadEven}>平均分配</Btn>
                <span className={css.stLibMeta}>{'平均分配把 ' + ATTR_BUDGET + ' 点六等分，余数补给前几项。'}</span>
              </div>
              {PARTY_ATTRS.map((a) => (
                <Field key={a.id} label={a.label + '（' + a.short + '） · ' + a.blurb}>
                  <Slider
                    min={ATTR_MIN}
                    max={ATTR_MAX}
                    value={m.attributes[a.id]}
                    left={String(ATTR_MIN)}
                    right={String(ATTR_MAX)}
                    onChange={(v) => props.onPatch({ attributes: attrPatch(m.attributes, a.id, v) })}
                  />
                </Field>
              ))}
            </div>
            <div className={css.stTpl}>
              <div className={css.stTplHead}>{'HP：当前 / 最大（最大 1 - 999，当前值不会超过最大值，当前 ' + hpPercent(m.hp, m.maxHp) + '%）'}</div>
              <div className={css.stRow}>
                <input
                  className={css.stInput}
                  style={{ width: 90 }}
                  type="number"
                  min={0}
                  max={m.maxHp}
                  value={m.hp}
                  onChange={(e) => props.onPatch({ hp: clamp(readInt(e.target.value, m.hp), 0, m.maxHp) })}
                />
                <span className={css.stLabel}>/</span>
                <input
                  className={css.stInput}
                  style={{ width: 90 }}
                  type="number"
                  min={1}
                  max={999}
                  value={m.maxHp}
                  onChange={(e) => {
                    const maxHp = clamp(readInt(e.target.value, m.maxHp), 1, 999)
                    props.onPatch({ maxHp, hp: Math.min(m.hp, maxHp) })
                  }}
                />
                <Btn onClick={() => props.onPatch({ hp: m.maxHp })}>回满</Btn>
                <HpBar hp={m.hp} maxHp={m.maxHp} width={110} />
              </div>
            </div>
            <div className={css.stTpl}>
              <div className={css.stTplHead}>{'技能（已选 ' + m.skills.length + ' 项；点预设加入，再点一次移除）'}</div>
              <Chips
                multiple
                options={SKILL_PRESETS.map((s) => s.name)}
                values={m.skills.map((s) => s.name)}
                onChange={(v) => props.onPatch({ skills: mergeSkills(m.skills, Array.isArray(v) ? v : [v]) })}
              />
              {m.skills.length
                ? (
                  <div style={{ marginTop: 8 }}>
                    {m.skills.map((s, i) => (
                      <div key={s.name + '-' + i} className={css.stRow} style={{ marginBottom: 6 }}>
                        <span className={css.stLibName} style={{ flex: 'none', minWidth: 76 }}>{s.name}</span>
                        <span className={css.stLibMeta}>{attrLabel(s.attr)}</span>
                        <span className={css.stLibMeta}>加成</span>
                        <input
                          className={css.stInput}
                          style={{ width: 72, flex: 'none' }}
                          type="number"
                          min={-99}
                          max={99}
                          value={s.bonus}
                          onChange={(e) => props.onPatch({ skills: bonusPatch(m.skills, i, clamp(readInt(e.target.value, s.bonus), -99, 99)) })}
                        />
                        <button type="button" className={css.stTplDel} title="删除该技能" onClick={() => props.onPatch({ skills: m.skills.filter((_, j) => j !== i) })}>x</button>
                      </div>
                    ))}
                  </div>
                )
                : <div className={css.stLibMeta}>还没有技能：判定时只看属性。</div>}
              <div className={css.stCustomAdd}>
                <input
                  className={css.stInput}
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSkill() }}
                  placeholder="自定义技能名，例如：双手剑"
                />
                <select className={css.stInput} style={{ width: 96, flex: 'none' }} value={skillAttr} onChange={(e) => setSkillAttr(e.target.value as AttrId)}>
                  {PARTY_ATTRS.map((a) => (<option key={a.id} value={a.id}>{a.label}</option>))}
                </select>
                <input className={css.stInput} style={{ width: 72, flex: 'none' }} type="number" min={-99} max={99} value={skillBonus} onChange={(e) => setSkillBonus(e.target.value)} placeholder="加成" />
                <Btn onClick={addSkill}>添加</Btn>
              </div>
            </div>
            <div className={css.stTpl}>
              <div className={css.stTplHead}>{'状态（已挂 ' + m.status.length + ' 项）'}</div>
              <div className={css.stLabel}>每项负面状态会让判定难度 +3，例如中毒、重伤、恐惧；情节过去后记得回来清掉。</div>
              {m.status.length
                ? (
                  <div className={css.stChipWrap} style={{ marginTop: 6 }}>
                    {m.status.map((s, i) => (
                      <span key={s + '-' + i} className={css.stChip}>
                        {s}
                        <button type="button" className={css.stTplDel} title="移除该状态" onClick={() => props.onPatch({ status: m.status.filter((_, j) => j !== i) })}>x</button>
                      </span>
                    ))}
                  </div>
                )
                : <div className={css.stLibMeta}>当前没有状态。</div>}
              <CustomAdd values={m.status} onAdd={(list) => props.onPatch({ status: list })} placeholder="输入状态名，例如：中毒" />
            </div>
          </div>
        )
        : null}
    </div>
  )
}

/** PartyPanel 的全部输入：受控的队伍、编辑回调、队伍库与模型选项。 */
export interface PartyPanelProps {
  /** 当前正在编辑的队伍（受控）。 */
  party: Party
  /** 任何编辑都通过它整份替换（父组件负责持久化）。 */
  onChange: (next: Party) => void
  /** 已保存的队伍库。 */
  library: Party[]
  /** 把当前队伍存入队伍库（按 id 覆盖）。 */
  onSave: () => void
  /** 从队伍库载入一支队伍到桌面。 */
  onLoad: (id: string) => void
  /** 从队伍库删除一支队伍。 */
  onDelete: (id: string) => void
  /** DSH 可用模型列表，供每个成员单独指定模型。 */
  modelOptions: { provider: string; model: string; label: string }[]
  /** 全局自定义接口是否已配置完整。 */
  customConfigured: boolean
  /** 全局自定义接口的模型名，用于「跟随全局」的说明文字。 */
  customModel: string
}

/**
 * 队伍编辑器：队伍总览条 + 队伍级设置 + 成员卡片列表 + 队伍库。
 *
 * 所有写入路径都走 props.onChange(新对象)，不修改 props 里的任何引用；
 * 成员卡片默认全部展开，点总览条里的头像可展开并滚动到对应成员。
 */
export function PartyPanel(props: PartyPanelProps): React.ReactElement {
  const party = props.party
  const members = party.members
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [importError, setImportError] = useState('')
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // 换了一支队伍（载入 / 导入 / 新建）就恢复默认视图：全部展开、清掉上次的导入报错。
  useEffect(() => {
    setCollapsed({})
    setImportError('')
  }, [party.id])

  /** 改队伍级字段。 */
  const patch = (fields: Partial<Party>): void => {
    props.onChange({ ...party, ...fields })
  }

  /** 改一个成员：属性与路由做浅合并，其余整体替换。 */
  const updateMember = (id: string, fields: Partial<PartyMember>): void => {
    props.onChange({
      ...party,
      members: members.map((m) => (m.id === id
        ? { ...m, ...fields, attributes: { ...m.attributes, ...(fields.attributes ?? {}) } }
        : m)),
    })
  }

  /** 追加一名新成员（人数上限内）。 */
  const addMember = (): void => {
    if (members.length >= MAX_MEMBERS) return
    props.onChange({ ...party, members: [...members, makeMember(members.length)] })
  }

  /** 移除一名成员（至少保留一人）。 */
  const removeMember = (id: string): void => {
    if (members.length <= MIN_MEMBERS) return
    props.onChange({ ...party, members: members.filter((m) => m.id !== id) })
  }

  /** 总览条点击：展开该成员并把卡片滚进视野。 */
  const focusMember = (id: string): void => {
    setCollapsed((prev) => ({ ...prev, [id]: false }))
    const el = cardRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** 折叠 / 展开一名成员。 */
  const toggleMember = (id: string): void => {
    setCollapsed((prev) => ({ ...prev, [id]: prev[id] !== true }))
  }

  /** 导出整份 Party 为 JSON 文件，文件名取队伍名。 */
  const exportParty = (): void => {
    const blob = new Blob([JSON.stringify(party, null, 2)], { type: 'application/json' })
    downloadFile(safeFileName(party.name) + '.json', blob)
  }

  /** 读入一个队伍 JSON：normalizeParty 补全字段，失败则给面板内联提示。 */
  const importPartyFile = (file: File): void => {
    setImportError('')
    file.text().then((text) => {
      let parsed: unknown = null
      try {
        parsed = JSON.parse(text)
      } catch (err) {
        setImportError('不是合法的 JSON 文件：' + (err as Error).message)
        return
      }
      const next = normalizeParty(parsed)
      if (!next) {
        setImportError('这个 JSON 里没有可用的成员列表（members 必须是数组且至少一人）。')
        return
      }
      props.onChange(next)
    }).catch(() => setImportError('读取文件失败，请重新选择一次。'))
  }

  return (
    <div className={css.stChar}>
      <div className={css.stWbEntry}>
        <div className={css.stLibHead}>{'队伍总览：' + members.length + ' 人（点一下跳到该成员）'}</div>
        <div className={css.stChipWrap}>
          {members.map((m) => {
            const pct = hpPercent(m.hp, m.maxHp)
            return (
              <button
                key={m.id}
                type="button"
                className={css.stChip}
                title={'跳到 ' + (m.name || '未命名') + '（' + routeLabel(m.llm) + '）'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 3px' }}
                onClick={() => focusMember(m.id)}
              >
                <MiniAvatar name={m.name} avatar={m.avatar} size={24} />
                <span>{m.name || '未命名'}</span>
                <HpBar hp={m.hp} maxHp={m.maxHp} width={44} />
                <span style={{ fontSize: 11, color: hpColor(pct) }}>{m.hp + '/' + m.maxHp}</span>
              </button>
            )
          })}
        </div>
        {members.length === 0 ? <div className={css.stNotice}>队伍里一个人都没有了，先在下面点「添加成员」。</div> : null}
      </div>

      <Section title="队伍" hint={'人数 ' + members.length + ' / ' + MAX_MEMBERS} defaultOpen>
        <Field label="队伍名称">
          <input className={css.stInput} value={party.name} onChange={(e) => patch({ name: e.target.value })} placeholder="例如：灰港冒险团" />
        </Field>
        <div className={css.stLabel}>{'当前 ' + members.length + ' 人：' + members.map((m) => m.name || '未命名').join('、')}</div>
        <div className={css.stActions}>
          <Btn onClick={addMember} disabled={members.length >= MAX_MEMBERS} title={members.length >= MAX_MEMBERS ? '一支队伍最多 ' + MAX_MEMBERS + ' 人' : '添加一名成员'}>添加成员</Btn>
          <Btn variant="primary" onClick={props.onSave}>保存到队伍库</Btn>
          <Btn onClick={exportParty}>导出队伍 JSON</Btn>
          <label className={css.stBtn}>
            导入队伍 JSON
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files ? e.target.files[0] : null
                e.target.value = ''
                if (file) importPartyFile(file)
              }}
            />
          </label>
        </div>
        <div className={css.stLabel}>{'人数范围 ' + MIN_MEMBERS + ' - ' + MAX_MEMBERS + ' 人；移除按钮在每个成员卡片的右上角（至少保留 1 人）。'}</div>
        {importError ? <div className={css.stNotice}>{importError}</div> : null}
      </Section>

      <Section title="旁白者（守秘人）" hint={routeLabel(party.narrator)} defaultOpen>
        <Field label="旁白者提示词（这一段会追加到守秘人的系统提示词后面）">
          <textarea
            className={cx(css.stInput, css.stTextarea)}
            rows={5}
            value={party.narratorPrompt}
            onChange={(e) => patch({ narratorPrompt: e.target.value })}
            placeholder="例如：叙述保持冷峻克制的语调，多写环境细节；不要替玩家做决定，也不要在旁白里提到任何规则或数值。"
          />
        </Field>
        <RouteEditor
          label="旁白者用哪个模型说书"
          route={party.narrator}
          modelOptions={props.modelOptions}
          customConfigured={props.customConfigured}
          customModel={props.customModel}
          onChange={(next) => patch({ narrator: next })}
        />
      </Section>

      {members.map((m, i) => (
        <MemberCard
          key={m.id}
          member={m}
          index={i}
          open={collapsed[m.id] !== true}
          canRemove={members.length > MIN_MEMBERS}
          refCb={(el) => { cardRefs.current[m.id] = el }}
          onToggle={() => toggleMember(m.id)}
          onRemove={() => removeMember(m.id)}
          onPatch={(fields) => updateMember(m.id, fields)}
          modelOptions={props.modelOptions}
          customConfigured={props.customConfigured}
          customModel={props.customModel}
        />
      ))}

      <Section title="队伍库" hint={props.library.length ? props.library.length + ' 支已保存' : '还没有保存过'} defaultOpen>
        <div className={css.stActions}>
          <Btn variant="primary" onClick={props.onSave}>把当前队伍存入队伍库</Btn>
          <span className={css.stLibMeta}>同一支队伍（同 id）会被覆盖更新，其余队伍原样保留。</span>
        </div>
        {props.library.length
          ? props.library.map((p) => (
              <div key={p.id} className={css.stLibItem}>
                <MiniAvatar name={p.name} avatar={p.members.length ? p.members[0].avatar : ''} size={30} />
                <div className={css.stLibName}>{p.name}</div>
                <span className={css.stLibMeta}>{p.members.length + ' 人 · ' + formatTime(p.savedAt)}</span>
                <Btn onClick={() => props.onLoad(p.id)}>载入</Btn>
                <Btn onClick={() => props.onDelete(p.id)}>删除</Btn>
              </div>
            ))
          : <div className={css.stLibMeta}>队伍库是空的：先点「保存到队伍库」，或者用上面的「导入队伍 JSON」。</div>}
      </Section>
    </div>
  )
}

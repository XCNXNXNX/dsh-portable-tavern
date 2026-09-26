/*
 * 冒险剧本 + 剧情大纲编辑器。
 *
 * 面板沿功能的职责线切成两半：
 * 「剧本设定」是写给守秘人的底本（前提、基调、桌规），只当总纲交给 AI；
 * 「剧情大纲」是你提前写好的事件，配上系统能机械判定的触发条件 —— 什么时候该
 * 发生什么事由代码说了算，AI 只负责把判定成立的那一幕演出来。
 */

import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import type {
  AdventureSetup,
  OutlineBeat,
  OutlineTrigger,
  PartyMember,
  TriggerKind,
} from '../../protocol.ts'
import type { TavernApi } from '../api.ts'
import { TRIGGER_KINDS, describeTrigger, makeBeat, nextStreak } from '../../rpg/outline.ts'
import { BANDS } from '../../rpg/engine.ts'
import { Btn, Field, Section, cx } from '../ui.tsx'
import { css } from '../styles.ts'

/** 遭遇类型可选项（取值与引擎里 encounter.kind 的取值一致）。 */
const ENCOUNTER_KINDS: { value: string; label: string }[] = [
  { value: 'combat', label: '战斗' },
  { value: 'chase', label: '追逐' },
  { value: 'social', label: '社交' },
  { value: 'environment', label: '环境' },
  { value: 'other', label: '其他' },
]

/** 「已触发」标记的内联配色（只借用现成的类名，配色用内联 style）。 */
const FIRED_TAG_STYLE: React.CSSProperties = {
  cursor: 'default',
  background: '#2a2416',
  borderColor: '#4a3d1f',
  color: '#ffb84d',
}

/** 编辑器需要的全部输入。 */
export interface OutlineEditorProps {
  /** 数据访问层。 */
  api: TavernApi
  /** 当前队伍，用于让 AI 按队伍来写剧本。 */
  party: PartyMember[]
  /** 受控的剧本 + 大纲。 */
  setup: AdventureSetup
  /** 任何编辑都整份替换。 */
  onChange: (next: AdventureSetup) => void
  /** 当前聊天模型路由，编码为 provider::model 或 custom::。 */
  chatModel: string
  /** 已经触发过的节点 id（只读展示用）。 */
  firedBeats: string[]
}

/**
 * 把聊天模型路由拆成 provider/model；custom:: 时只传 'custom'，由浏览器带上自有端点。
 * 规则与 RpgPanel 里的同名局部函数保持一致。
 * @param chatModel - 形如 provider::model 或 custom:: 的路由串。
 */
function splitRoute(chatModel: string): { provider?: string; model?: string } {
  const parts = (chatModel || '').split('::')
  if (parts[0] === 'custom') return { provider: 'custom' }
  if (parts.length >= 2 && parts[0] !== '') return { provider: parts[0], model: parts.slice(1).join('::') }
  return {}
}

/**
 * 取某类触发条件对应的字段名（'always' 没有字段，返回空串）。
 * @param kind - 触发条件种类。
 */
function triggerField(kind: TriggerKind): string {
  const entry = TRIGGER_KINDS.find((k) => k.kind === kind)
  return entry ? entry.field : ''
}

/**
 * 换一种触发条件：丢掉旧字段，只留新字段，并给一个立刻能用的默认值。
 * 触发条件永远只有一个开关，残留的旧字段不会被系统读取。
 * @param kind - 新选中的触发条件种类。
 */
function retargetTrigger(kind: TriggerKind): OutlineTrigger {
  const next: OutlineTrigger = { kind }
  const field = triggerField(kind)
  if (field === 'turn') next.turn = 3
  else if (field === 'band') next.band = 'fail'
  else if (field === 'encounterKind') next.encounterKind = 'combat'
  else if (field === 'hpBelow') next.hpBelow = 0.3
  else if (field === 'keyword') next.keyword = ''
  else if (field === 'factKeyword') next.factKeyword = ''
  else if (field === 'streak') next.streak = 3
  return next
}

/**
 * 读一个数字输入：非法值退回 fallback，并四舍五入夹进 [min, max]。
 * @param raw - 输入框里的原始文本。
 * @param fallback - 文本不是数字时使用的值。
 * @param min - 允许的最小值。
 * @param max - 允许的最大值。
 */
function readNumber(raw: string, fallback: number, min: number, max: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * 生成一个当前大纲里没被占用的节点 id（makeBeat 的 id 撞车时补一个序号）。
 * @param base - makeBeat 给出的候选 id。
 * @param taken - 已经被占用的 id。
 */
function freshId(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(base + '-' + n)) n += 1
  return base + '-' + n
}

/**
 * AI 没写出来的字段就保留用户原来写的内容，避免起草把已填的设定抹成空白。
 * @param draft - AI 起草的值。
 * @param fallback - 用户当前已经写好的值。
 */
function pickText(draft: string, fallback: string): string {
  const text = String(draft ?? '').trim()
  return text === '' ? fallback : draft
}

/**
 * 把 AI 起草回来的一条节点补全成本地可用的节点：id、fired、firedAtTurn 由本地补齐。
 * @param raw - 起草返回的节点（只有标题、触发条件、事件、once）。
 * @param index - 它在大纲里的位置，用于生成标题与 id。
 * @param taken - 已经被占用的 id。
 */
function adoptBeat(
  raw: { title: string; trigger: OutlineTrigger; event: string; once: boolean },
  index: number,
  taken: string[],
): OutlineBeat {
  const seed = makeBeat(index)
  const title = String(raw.title ?? '').trim()
  return {
    id: freshId(seed.id, taken),
    title: title === '' ? seed.title : title,
    trigger: raw.trigger && raw.trigger.kind ? raw.trigger : { kind: 'turn', turn: 1 },
    event: String(raw.event ?? ''),
    once: raw.once !== false,
    fired: false,
    firedAtTurn: 0,
  }
}

/**
 * 剧本与大纲编辑器：上半写底本，下半编排节点。
 * @param props - 数据访问层、当前队伍、受控的 setup 与它的写回函数。
 */
export function OutlineEditor(props: OutlineEditorProps): React.ReactElement {
  const [busy, setBusy] = useState('')
  const [setupError, setSetupError] = useState('')
  const [outlineError, setOutlineError] = useState('')
  // 请求返回时要写回最新的 setup：拿发起请求那一刻的旧值去覆盖，会吃掉期间的编辑。
  const setupRef = useRef(props.setup)
  useEffect(() => { setupRef.current = props.setup }, [props.setup])

  const route = splitRoute(props.chatModel)
  const beats = props.setup.outline
  const hintOf = (kind: TriggerKind): string => {
    const entry = TRIGGER_KINDS.find((k) => k.kind === kind)
    return entry ? entry.hint : ''
  }
  const isFired = (beat: OutlineBeat): boolean => props.firedBeats.includes(beat.id) || beat.fired

  /** 不可变地改写一个节点。 */
  const patchBeat = (index: number, patch: Partial<OutlineBeat>): void => {
    props.onChange({ ...props.setup, outline: props.setup.outline.map((b, i) => (i === index ? { ...b, ...patch } : b)) })
  }

  /** 追加一个空白节点（复用引擎的 makeBeat 造初始值）。 */
  const addBeat = (): void => {
    const taken = props.setup.outline.map((b) => b.id)
    const seed = makeBeat(props.setup.outline.length)
    const beat: OutlineBeat = { ...seed, id: freshId(seed.id, taken) }
    props.onChange({ ...props.setup, outline: [...props.setup.outline, beat] })
  }

  /** 上移 / 下移一个节点（顺序就是系统的判定顺序）。 */
  const moveBeat = (index: number, delta: number): void => {
    const list = props.setup.outline
    const to = index + delta
    if (to < 0 || to >= list.length) return
    const next = list.slice()
    const moved = next.splice(index, 1)[0]
    next.splice(to, 0, moved)
    props.onChange({ ...props.setup, outline: next })
  }

  /** 删除一个节点。 */
  const removeBeat = (index: number): void => {
    props.onChange({ ...props.setup, outline: props.setup.outline.filter((_b, i) => i !== index) })
  }

  /** 清空剧本四个字段，保留大纲。 */
  const clearSetup = (): void => {
    props.onChange({ ...props.setup, title: '', premise: '', tone: '', rules: '' })
  }

  /** 清空大纲（不可撤销，先问一次）。 */
  const clearOutline = (): void => {
    const count = props.setup.outline.length
    if (count === 0) return
    if (!confirm('确定要清空这 ' + count + ' 个节点吗？清空后无法撤销。')) return
    props.onChange({ ...props.setup, outline: [] })
  }

  /** 让 AI 按当前队伍起草剧本（只写四个字段，不动大纲）。 */
  const draftScenario = async (): Promise<void> => {
    setBusy('scenario')
    setSetupError('')
    try {
      const res = await props.api.rpgScenario(props.party, props.setup.premise, route.provider, route.model)
      const base = setupRef.current
      const draft = res.setup ?? { title: '', premise: '', tone: '', rules: '' }
      props.onChange({
        ...base,
        title: pickText(draft.title, base.title),
        premise: pickText(draft.premise, base.premise),
        tone: pickText(draft.tone, base.tone),
        rules: pickText(draft.rules, base.rules),
      })
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : 'AI 没有给出剧本，可以再试一次。')
    } finally {
      setBusy('')
    }
  }

  /** 让 AI 起草 4 个节点，追加到现有个纲后面。 */
  const draftOutline = async (): Promise<void> => {
    setBusy('outline')
    setOutlineError('')
    try {
      const res = await props.api.rpgOutline(props.party, props.setup.premise, 4, route.provider, route.model)
      const base = setupRef.current
      const list = base.outline
      const taken = list.map((b) => b.id)
      const drafted: OutlineBeat[] = []
      for (const raw of res.beats ?? []) {
        const beat = adoptBeat(raw, list.length + drafted.length, taken)
        taken.push(beat.id)
        drafted.push(beat)
      }
      if (drafted.length === 0) {
        setOutlineError('AI 这次没有给出可用的节点，可以再点一次。')
        return
      }
      props.onChange({ ...base, outline: [...list, ...drafted] })
    } catch (e) {
      setOutlineError(e instanceof Error ? e.message : 'AI 没有给出大纲，可以再试一次。')
    } finally {
      setBusy('')
    }
  }

  /**
   * 按当前 kind 只渲染那一个字段：界面上永远只有一个开关，与系统实际读取的字段一一对应。
   * @param beat - 正在编辑的节点。
   * @param index - 它在大纲里的位置。
   */
  const renderTriggerField = (beat: OutlineBeat, index: number): React.ReactElement | null => {
    const trigger = beat.trigger
    const kind = trigger.kind
    if (kind === 'turn') {
      return (
        <Field label="第几回合">
          <input
            type="number"
            className={css.stInput}
            min={1}
            max={200}
            value={trigger.turn ?? 1}
            onChange={(e) => patchBeat(index, { trigger: { kind, turn: readNumber(e.target.value, trigger.turn ?? 1, 1, 200) } })}
          />
        </Field>
      )
    }
    if (kind === 'band') {
      return (
        <Field label="判定落在哪个档位">
          <select
            className={css.stInput}
            value={trigger.band ?? 'fail'}
            onChange={(e) => patchBeat(index, { trigger: { kind, band: e.target.value } })}
          >
            {BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Field>
      )
    }
    if (kind === 'encounter') {
      return (
        <Field label="遭遇类型">
          <select
            className={css.stInput}
            value={trigger.encounterKind ?? 'combat'}
            onChange={(e) => patchBeat(index, { trigger: { kind, encounterKind: e.target.value } })}
          >
            {ENCOUNTER_KINDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      )
    }
    if (kind === 'hp') {
      const pct = Math.round((trigger.hpBelow ?? 0.3) * 100)
      return (
        <Field label={'有人血量低于 ' + pct + '% 时触发'}>
          <input
            type="number"
            className={css.stInput}
            min={5}
            max={100}
            step={5}
            value={pct}
            onChange={(e) => patchBeat(index, { trigger: { kind, hpBelow: readNumber(e.target.value, pct, 5, 100) / 100 } })}
          />
        </Field>
      )
    }
    if (kind === 'action') {
      return (
        <Field label="玩家行动里出现这段文字">
          <input
            className={css.stInput}
            value={trigger.keyword ?? ''}
            placeholder="例如：敲钟"
            onChange={(e) => patchBeat(index, { trigger: { kind, keyword: e.target.value } })}
          />
        </Field>
      )
    }
    if (kind === 'fact') {
      return (
        <Field label="已确立事实里出现这段文字">
          <input
            className={css.stInput}
            value={trigger.factKeyword ?? ''}
            placeholder="例如：失踪的商队"
            onChange={(e) => patchBeat(index, { trigger: { kind, factKeyword: e.target.value } })}
          />
        </Field>
      )
    }
    if (kind === 'success' || kind === 'failure') {
      const need = trigger.streak ?? 3
      // 连击的计数规则直接问引擎（成功 +1 / 失败 -1，被反向结果打断就清零）。
      const up = nextStreak(0, true)
      const down = nextStreak(0, false)
      return (
        <Field label={kind === 'success' ? '连续成功几次' : '连续失败几次'}>
          <input
            type="number"
            className={css.stInput}
            min={1}
            max={10}
            value={need}
            onChange={(e) => patchBeat(index, { trigger: { kind, streak: readNumber(e.target.value, need, 1, 10) } })}
          />
          <div className={css.stRpgCardMeta}>
            {'系统逐回合累加：成功 ' + (up > 0 ? '+' + up : String(up)) + '，失败 ' + String(down) + '；被反向结果打断就清零。' }
          </div>
        </Field>
      )
    }
    return null
  }

  const firedCount = beats.filter(isFired).length

  return (
    <div>
      <Section title="剧本设定" hint="这一局的底本，守秘人整局都照着它演">
        {setupError !== '' ? <div className={css.stNotice}>{setupError}</div> : null}
        <Field label="冒险名称">
          <input
            className={css.stInput}
            value={props.setup.title}
            placeholder="例如：北境的钟声（简短好记，会出现在面板标题与日志里）"
            onChange={(e) => props.onChange({ ...props.setup, title: e.target.value })}
          />
        </Field>
        <Field label="故事前提">
          <textarea
            className={cx(css.stInput, css.stTextarea)}
            rows={5}
            value={props.setup.premise}
            placeholder="谁、在哪、要做什么、拦在前面的麻烦是什么。写给守秘人当总纲，越具体越好。"
            onChange={(e) => props.onChange({ ...props.setup, premise: e.target.value })}
          />
        </Field>
        <Field label="基调与尺度">
          <textarea
            className={cx(css.stInput, css.stTextarea)}
            rows={2}
            value={props.setup.tone}
            placeholder="例如：低魔黑暗奇幻，允许流血与背叛，不写露骨情节，叙述保持克制。"
            onChange={(e) => props.onChange({ ...props.setup, tone: e.target.value })}
          />
        </Field>
        <Field label="本桌约定">
          <textarea
            className={cx(css.stInput, css.stTextarea)}
            rows={2}
            value={props.setup.rules}
            placeholder="例如：不掷骰就不得描述成功；队友之间不得隐瞒关键情报；每回合最多一次交易。"
            onChange={(e) => props.onChange({ ...props.setup, rules: e.target.value })}
          />
        </Field>
        <div className={css.stRow}>
          <Btn variant="primary" disabled={busy !== ''} onClick={() => { void draftScenario() }}>
            {busy === 'scenario' ? '正在构思…' : '让 AI 写'}
          </Btn>
          <Btn variant="ghost" onClick={clearSetup}>清空剧本</Btn>
        </div>
        <div className={css.stRpgHint}>「让 AI 写」会按当前队伍重新生成这四个字段，不会动你已经写好的剧情大纲。</div>
      </Section>

      <Section title="剧情大纲" hint="触发条件由系统判定，满足就把事件交给 AI 演出">
        {outlineError !== '' ? <div className={css.stNotice}>{outlineError}</div> : null}
        <div className={css.stRpgHint}>
          节点是「你提前写好的事件」：一旦触发，守秘人必须演出什么，由你在这里写死。触发条件则是「系统会机械判定的条件」——第几回合、判定落在哪个档位、谁的血量告急、玩家的行动或已确立的事实里出现了哪个词。判定发生在代码里，不看 AI 的心情；条件不成立，这段事件就绝不会被提前搬上台，所以你可以放心把后面的桥段先写好。
        </div>

        {beats.length === 0
          ? (
            <div className={css.stEmpty}>
              <div className={css.stEmptyEmoji}>空</div>
              <div>还没有任何节点。空大纲不会报错，但守秘人只能临场发挥。</div>
              <div className={css.stRpgHint}>先试一个「到达回合」的节点：第 3 回合，村口的钟自己响了。也可以点下面的「让 AI 起草大纲」拿几个草稿，再自己改。</div>
            </div>
          )
          : beats.map((beat, index) => (
            <div key={beat.id} className={css.stRpgCard}>
              <div className={css.stRpgHead} style={{ marginBottom: 0 }}>
                <span className={css.stRpgTitle}>{(index + 1) + '. ' + (beat.title || '未命名节点')}</span>
                {isFired(beat)
                  ? (
                    <span
                      className={css.stChip}
                      style={FIRED_TAG_STYLE}
                      title={beat.firedAtTurn > 0 ? '已在第 ' + beat.firedAtTurn + ' 回合触发过' : '已经触发过' }
                    >
                      已触发
                    </span>
                  )
                  : null}
                <span className={css.stRpgSpacer} />
                <button
                  type="button"
                  className={cx(css.stBtn, css.stBtnSm, index === 0 && css.stBtnDisabled)}
                  disabled={index === 0}
                  title="与上一个节点交换位置"
                  onClick={() => moveBeat(index, -1)}
                >
                  上移
                </button>
                <button
                  type="button"
                  className={cx(css.stBtn, css.stBtnSm, index === beats.length - 1 && css.stBtnDisabled)}
                  disabled={index === beats.length - 1}
                  title="与下一个节点交换位置"
                  onClick={() => moveBeat(index, 1)}
                >
                  下移
                </button>
                <button
                  type="button"
                  className={cx(css.stBtn, css.stBtnSm)}
                  style={{ color: '#ff8a8a', borderColor: '#4a2b2b' }}
                  title="删除这个节点"
                  onClick={() => removeBeat(index)}
                >
                  删除
                </button>
              </div>
              <div className={css.stRpgCardMeta}>触发条件：{describeTrigger(beat.trigger)}</div>
              <Field label="标题">
                <input
                  className={css.stInput}
                  value={beat.title}
                  placeholder="给这个节点起个短名字，例如：北边的钟"
                  onChange={(e) => patchBeat(index, { title: e.target.value })}
                />
              </Field>
              <Field label="触发条件">
                <select
                  className={css.stInput}
                  value={beat.trigger.kind}
                  onChange={(e) => patchBeat(index, { trigger: retargetTrigger(e.target.value as TriggerKind) })}
                >
                  {TRIGGER_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
                </select>
                <div className={css.stRpgCardMeta}>{hintOf(beat.trigger.kind)}</div>
              </Field>
              {renderTriggerField(beat, index)}
              <Field label="触发后守秘人必须演出的内容">
                <textarea
                  className={cx(css.stInput, css.stTextarea)}
                  rows={4}
                  value={beat.event}
                  placeholder="村口的钟突然自己响了，所有人都停下手里的事望向北边"
                  onChange={(e) => patchBeat(index, { event: e.target.value })}
                />
              </Field>
              <label className={css.stCheck}>
                <input
                  type="checkbox"
                  checked={beat.once}
                  onChange={(e) => patchBeat(index, { once: e.target.checked })}
                />
                只触发一次（触发后自动退休，不会被重复搬上台）
              </label>
            </div>
          ))}

        <div className={css.stRow}>
          <Btn onClick={addBeat}>添加节点</Btn>
          <Btn variant="primary" disabled={busy !== ''} onClick={() => { void draftOutline() }}>
            {busy === 'outline' ? '正在起草…' : '让 AI 起草大纲'}
          </Btn>
          <Btn variant="ghost" disabled={beats.length === 0} onClick={clearOutline}>清空大纲</Btn>
        </div>
        <div className={css.stRpgCardMeta}>
          {'共 ' + beats.length + ' 个节点' + (firedCount > 0 ? '，其中 ' + firedCount + ' 个已触发' : '') + '；顺序就是系统的判定顺序。'}
        </div>
      </Section>
    </div>
  )
}

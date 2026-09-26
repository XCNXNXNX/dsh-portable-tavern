/**
 * The tabletop panel.
 *
 * The screen is deliberately split along the feature's dividing line: the
 * system's half is the dice block, the required-roll maths and the settlement
 * rows (all computed host-side, rendered here verbatim), while the GM's half is
 * the narration text. A player can always see which half produced which line,
 * which is the whole point of "system arbitrates, AI narrates".
 */

import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import type {
  CheckResult,
  Encounter,
  EncounterOption,
  Party,
  PartyMember,
  PendingCheck,
  RpgLogEntry,
  RpgState,
} from '../../protocol.ts'
import { TavernApi } from '../api.ts'
import { applyEffects, type Actor } from '../../rpg/engine.ts'
import { Btn, Field, Section, cx } from '../ui.tsx'
import { css } from '../styles.ts'

export interface RpgPanelProps {
  /** Data access layer. */
  api: TavernApi
  /** The team on the table. */
  party: Party
  /** Replace the team (hit points and conditions are written back here). */
  onParty: (next: Party) => void
  /** The adventure so far. */
  state: RpgState
  /** Replace the adventure state. */
  onState: (next: RpgState) => void
  /** Global chat route, encoded as provider::model or custom::. */
  chatModel: string
  /** Whether the global custom endpoint is fully configured. */
  customConfigured: boolean
  /** Model name of the global custom endpoint (for labels). */
  customModel: string
  /** Jump to the party tab. */
  onGotoParty: () => void
}

/** A fresh log id. */
function logId(): string {
  return 'l' + Date.now().toString(36) + Math.floor(Math.random() * 100000).toString(36)
}

/** Split the chat route selector into provider/model. */
function splitRoute(chatModel: string): { provider?: string; model?: string } {
  const parts = (chatModel || '').split('::')
  if (parts[0] === 'custom') return { provider: 'custom' }
  if (parts.length >= 2 && parts[0] !== '') return { provider: parts[0], model: parts.slice(1).join('::') }
  return {}
}

/** Append one entry to the log without mutating the input state. */
function withLog(state: RpgState, entry: RpgLogEntry): RpgState {
  return { ...state, log: [...state.log, entry] }
}

/** Merge new facts into the state, de-duplicated and capped. */
function withFacts(state: RpgState, facts: string[]): RpgState {
  if (facts.length === 0) return state
  const set = new Set(state.facts)
  for (const f of facts) set.add(f)
  return { ...state, facts: [...set].slice(-40) }
}

/** The colour family of a band, used to tint the dice block. */
function bandTone(band: string): string {
  if (band === 'triumph') return '#2e9e6b'
  if (band === 'success') return '#3f8f5f'
  if (band === 'costly') return '#b7873a'
  if (band === 'narrow') return '#b7873a'
  if (band === 'hair') return '#b8552f'
  if (band === 'fail') return '#a83b3b'
  return '#7d2b2b'
}

/** Small HP bar. */
function HpBar(props: { hp: number; maxHp: number }): React.ReactElement {
  const pct = props.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((props.hp / props.maxHp) * 100))) : 0
  const color = pct > 60 ? '#3f8f5f' : pct > 30 ? '#b7873a' : '#a83b3b'
  return (
    <span style={{ display: 'inline-block', width: 64, height: 6, background: '#2a2f3a', borderRadius: 3, overflow: 'hidden', verticalAlign: 'middle' }}>
      <span style={{ display: 'block', width: pct + '%', height: '100%', background: color }} />
    </span>
  )
}

/** The system's dice block: target, throw, margin, band. */
function DiceBlock(props: { result: CheckResult }): React.ReactElement {
  const r = props.result
  const tone = bandTone(r.band)
  return (
    <div style={{ border: '1px solid ' + tone, borderLeft: '4px solid ' + tone, borderRadius: 8, padding: '10px 12px', background: 'var(--st-panel, #161a21)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--st-text, #fff)' }}>{r.roll}</span>
        <span style={{ color: 'var(--st-text-dim, #8b93a1)', fontSize: 12 }}>需要 {r.required}</span>
        <span style={{ color: tone, fontWeight: 700 }}>{r.bandLabel}</span>
        <span style={{ color: 'var(--st-text-dim, #8b93a1)', fontSize: 12 }}>
          差值 {r.margin > 0 ? '+' + r.margin : String(r.margin)}
          {r.critical === 'success' ? ' · 自然大成功' : r.critical === 'failure' ? ' · 自然大失败' : ''}
        </span>
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {r.breakdown.map((row, i) => (
          <span key={i} style={{ fontSize: 11, color: 'var(--st-text-dim, #8b93a1)', background: 'var(--st-panel-2, #1e232c)', borderRadius: 5, padding: '2px 7px' }}>
            {row.label} {row.value > 0 ? '+' + row.value : row.value}
          </span>
        ))}
      </div>
      {r.effects.hpLoss > 0 || r.effects.addStatus.length > 0
        ? (
          <div style={{ marginTop: 8, fontSize: 12, color: '#c9a227' }}>
            系统结算：
            {r.effects.hpLoss > 0 ? '损失 ' + r.effects.hpLoss + ' 点生命' : ''}
            {r.effects.addStatus.length > 0 ? (r.effects.hpLoss > 0 ? '，' : '') + '获得状态「' + r.effects.addStatus.join('、') + '」' : ''}
          </div>
        )
        : null}
    </div>
  )
}

/** Render one log entry. */
function LogRow(props: { entry: RpgLogEntry; party: Party }): React.ReactElement {
  const e = props.entry
  if (e.kind === 'check' && e.check) {
    return <div style={{ margin: '10px 0' }}><DiceBlock result={e.check} /></div>
  }
  if (e.kind === 'action') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
        <div style={{ maxWidth: '82%', background: 'var(--st-msg-user, #2c3446)', color: 'var(--st-text, #e8e9ec)', borderRadius: '10px 10px 2px 10px', padding: '8px 12px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          <span style={{ color: 'var(--st-text-dim, #8b93a1)', fontSize: 11, marginRight: 6 }}>你的行动</span>{e.text}
        </div>
      </div>
    )
  }
  if (e.kind === 'speech') {
    const member = props.party.members.find((m) => m.name === e.who)
    return (
      <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flex: '0 0 auto', background: 'var(--st-panel-2, #2a2f3a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--st-text-dim, #c3c7cf)' }}>
          {member && member.avatar ? <img src={member.avatar} alt={e.who} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (e.who || '?').slice(0, 1)}
        </div>
        <div style={{ background: 'var(--st-msg-char, #1e232c)', color: 'var(--st-text, #e8e9ec)', borderRadius: '10px 10px 10px 2px', padding: '8px 12px', fontSize: 13, maxWidth: '82%' }}>
          <div style={{ color: 'var(--st-text-dim, #7f8899)', fontSize: 11, marginBottom: 2 }}>{e.who}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{e.text}</div>
        </div>
      </div>
    )
  }
  if (e.kind === 'result' || e.kind === 'system') {
    return <div style={{ margin: '8px 0', fontSize: 12, color: 'var(--st-text-dim, #8b93a1)', borderLeft: '2px solid var(--st-border, #2e3644)', paddingLeft: 10 }}>{e.text}</div>
  }
  return (
    <div style={{ margin: '10px 0', fontSize: 13.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', color: 'var(--st-text, #dfe3ea)' }}>
      {e.who ? <span style={{ color: 'var(--st-text-dim, #7f8899)', fontSize: 11, marginRight: 6 }}>{e.who}</span> : null}
      {e.text}
    </div>
  )
}

/**
 * The tabletop surface.
 * @param props - api, party, adventure state and their writers.
 */
export function RpgPanel(props: RpgPanelProps): React.ReactElement {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')
  const [chatter, setChatter] = useState(true)
  const [critEnabled, setCritEnabled] = useState(true)
  const logRef = useRef<HTMLDivElement | null>(null)

  const members = props.party.members
  const actor: PartyMember | undefined = members.find((m) => m.id === actorId) ?? members[0]
  const route = splitRoute(props.chatModel)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [props.state.log.length, busy])

  /** Write system effects back into the team. */
  const settleParty = (memberId: string, result: CheckResult): { line: string; party: Party } => {
    const index = members.findIndex((m) => m.id === memberId)
    if (index < 0) return { line: '', party: props.party }
    const next = members.map((m, i) => {
      if (i !== index) return m
      const updated = applyEffects(m as unknown as Actor, {
        hpLoss: result.effects.hpLoss,
        addStatus: result.effects.addStatus,
        removeStatus: result.effects.removeStatus,
        endsEncounter: result.effects.endsEncounter,
      })
      return { ...m, hp: updated.hp, status: updated.status }
    })
    const bits: string[] = []
    if (result.effects.hpLoss > 0) bits.push('损失 ' + result.effects.hpLoss + ' 点生命')
    if (result.effects.addStatus.length > 0) bits.push('获得状态「' + result.effects.addStatus.join('、') + '」')
    if (result.effects.removeStatus.length > 0) bits.push('解除状态「' + result.effects.removeStatus.join('、') + '」')
    const line = (members[index].name || '角色') + (bits.length > 0 ? '：' + bits.join('，') : '：状态未发生变化')
    return { line, party: { ...props.party, members: next } }
  }

  /**
   * Ask the system what the player must roll. The caller passes the state the
   * check belongs to: using props.state here would clobber the narration that
   * was just appended in the same turn.
   */
  const requestCheck = async (option: EncounterOption, encounter: Encounter, who: PartyMember, base: RpgState): Promise<void> => {
    setBusy('check'); setError('')
    try {
      const res = await props.api.rpgCheck(who, encounter, option.id)
      props.onState({ ...base, pending: res.pending })
    } catch (e) {
      setError(e instanceof Error ? e.message : '系统计算出错')
    } finally { setBusy('') }
  }

  /**
   * Throw the die, settle the world, then ask the GM to narrate. The check is
   * resolved against the state the player is looking at (props.state), which is
   * the same object the pending card was rendered from.
   */
  const rollPending = async (pending: PendingCheck, who: PartyMember): Promise<void> => {
    setBusy('roll'); setError('')
    try {
      const result = await props.api.rpgRoll(pending, critEnabled)
      const settled = settleParty(who.id, result)

      let next: RpgState = { ...props.state, pending: null, turn: props.state.turn + 1 }
      next = withLog(next, { id: logId(), kind: 'action', who: who.name, text: pending.option.label + '（' + who.name + '）', at: Date.now() })
      next = withLog(next, { id: logId(), kind: 'check', who: '系统', text: '', check: result, at: Date.now() })
      if (settled.line !== '') next = withLog(next, { id: logId(), kind: 'result', who: '系统', text: settled.line, at: Date.now() })
      if (result.effects.endsEncounter) next = { ...next, encounter: null }
      props.onParty(settled.party)
      props.onState(next)

      setBusy('narrate')
      const narrated = await props.api.rpgNarrate({
        state: next,
        party: settled.party.members,
        action: pending.option.label,
        result,
        narratorPrompt: props.party.narratorPrompt,
        provider: route.provider,
        model: route.model,
      })
      let after: RpgState = { ...next, scene: narrated.scene, encounter: narrated.encounter }
      after = withLog(after, { id: logId(), kind: 'scene', who: '守秘人', text: narrated.narration, at: Date.now() })
      props.onState(after)
      if (chatter) await speakUp(after, settled.party, narrated.narration)
    } catch (e) {
      setError(e instanceof Error ? e.message : '判定失败')
    } finally { setBusy('') }
  }

  /**
   * Each member reacts, on its own model route. A member set to "跟随全局"
   * receives the tavern-wide route; one with its own endpoint uses that.
   */
  const speakUp = async (state: RpgState, party: Party, beat: string): Promise<void> => {
    let current = state
    for (const member of party.members) {
      try {
        const res = await props.api.rpgMember(member, current, beat, '', route)
        if (res.line.trim() === '') continue
        current = withLog(current, { id: logId(), kind: 'speech', who: member.name, text: res.line, at: Date.now() })
        props.onState(current)
      } catch {
        // A member on a broken endpoint must not stop the table.
      }
    }
  }

  /** The player's free-form declaration. */
  const submitAction = async (): Promise<void> => {
    const text = action.trim()
    if (text === '' || !actor) return
    setBusy('turn'); setError('')
    try {
      let next: RpgState = { ...props.state, pending: null }
      next = withLog(next, { id: logId(), kind: 'action', who: actor.name, text, at: Date.now() })
      props.onState(next)
      setAction('')
      const res = await props.api.rpgTurn({
        state: next,
        party: members,
        action: text,
        narratorPrompt: props.party.narratorPrompt,
        provider: route.provider,
        model: route.model,
      })
      let after: RpgState = { ...next, scene: res.scene, encounter: res.encounter, pending: null }
      after = withFacts(after, res.facts)
      after = withLog(after, { id: logId(), kind: 'scene', who: '守秘人', text: res.narration, at: Date.now() })
      props.onState(after)

      if (res.encounter !== null) {
        // A choice screen: the options are computed by the system on demand.
        await speakUp(after, props.party, res.narration)
      } else if (res.check !== null && (res.checkKind === 'combat' || res.checkKind === 'chase')) {
        // A fight or a chase is never a single forced action. When the GM hands
        // the system one check for a violent scene, the system widens it into a
        // real fork -- press on, or break away -- so the player keeps the choice
        // the mode promises instead of being railroaded into the roll.
        const fork: Encounter = {
          id: 'fork',
          kind: res.checkKind,
          title: res.checkKind === 'combat' ? '交锋在即' : '追逐开始',
          description: '系统判定这是一个' + (res.checkKind === 'combat' ? '正面交锋' : '追逐') + '场面，把两条路一并摆在你面前。',
          threat: res.checkThreat,
          options: [
            res.check,
            {
              id: 'disengage',
              label: res.checkKind === 'combat' ? '脱离战斗' : '甩开追击',
              attribute: 'dex',
              skill: '',
              difficulty: Math.max(5, res.check.difficulty - 10),
              modifier: 0,
              hint: '不恋战，优先拉开距离；成功则摆脱接触，失败则被咬住。',
            },
          ],
        }
        props.onState({ ...after, encounter: fork })
        await speakUp(after, props.party, res.narration)
      } else if (res.check !== null) {
        // The declared action itself needs a roll -- compute it right away.
        const synthetic: Encounter = {
          id: 'act',
          kind: res.checkKind,
          title: '当前行动',
          description: '',
          threat: res.checkThreat,
          options: [res.check],
        }
        await requestCheck(res.check, synthetic, actor, after)
        await speakUp(after, props.party, res.narration)
      } else {
        await speakUp(after, props.party, res.narration)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '守秘人没有回应')
    } finally { setBusy('') }
  }

  const onOption = async (option: EncounterOption): Promise<void> => {
    if (!actor || props.state.encounter === null) return
    await requestCheck(option, props.state.encounter, actor, props.state)
  }

  if (members.length === 0) {
    return (
      <div className={css.stChar}>
        <div className={css.stEmpty}>
          <div>还没有队伍。跑团模式需要至少一名角色。</div>
          <Btn variant="primary" onClick={props.onGotoParty}>去组建队伍</Btn>
        </div>
      </div>
    )
  }

  const pending = props.state.pending
  const encounter = props.state.encounter

  return (
    <div className={css.stChar}>
      <div className={css.stRpgHead}>
        <span className={css.stRpgTitle}>{props.party.name || '冒险'}</span>
        <span className={css.stRpgTurn}>第 {props.state.turn} 回合</span>
        <span className={css.stRpgSpacer} />
        <label className={css.stCheck}>
          <input type="checkbox" checked={critEnabled} onChange={(e) => setCritEnabled(e.target.checked)} />
          自然骰暴击
        </label>
        <label className={css.stCheck}>
          <input type="checkbox" checked={chatter} onChange={(e) => setChatter(e.target.checked)} />
          队友发言
        </label>
      </div>

      <div className={css.stRpgParty}>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={cx(css.stRpgChip, actor && actor.id === m.id && css.stRpgChipActive)}
            onClick={() => setActorId(m.id)}
            title={'本次判定的执行者：' + m.name}
          >
            {m.avatar
              ? <img src={m.avatar} alt={m.name} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
              : <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--st-panel-2, #39404f)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{(m.name || '?').slice(0, 1)}</span>}
            <span>{m.name}</span>
            <HpBar hp={m.hp} maxHp={m.maxHp} />
            <span style={{ fontSize: 11, color: 'var(--st-text-dim, #8b93a1)' }}>{m.hp}/{m.maxHp}</span>
          </button>
        ))}
      </div>

      <div ref={logRef} className={css.stRpgLog}>
        {props.state.log.length === 0
          ? <div className={css.stRpgHint}>描述你想做什么，守秘人会推进剧情；当行动的结果不确定时，系统会算出你需要掷出的数字，你掷骰，然后由守秘人来讲述结果。</div>
          : props.state.log.map((entry) => <LogRow key={entry.id} entry={entry} party={props.party} />)}
        {busy !== '' ? <div className={css.stRpgBusy}>{busy === 'turn' ? '守秘人正在思考…' : busy === 'narrate' ? '守秘人正在叙述…' : busy === 'roll' ? '掷骰中…' : '系统计算中…'}</div> : null}
      </div>

      {error !== '' ? <div className={css.stNotice}>{error}</div> : null}

      {pending !== null
        ? (
          <div className={css.stRpgCard}>
            <div className={css.stRpgCardTitle}>系统判定：{pending.computed.optionLabel}</div>
            <div className={css.stRpgRequired}>
              <span className={css.stRpgRequiredLabel}>{pending.computed.actorName} 需要掷出至少</span>
              <span className={css.stRpgRequiredValue}>{pending.computed.required}</span>
              <span className={css.stRpgRequiredLabel}>（d100 · {pending.computed.difficultyLabel}）</span>
            </div>
            <div className={css.stRpgBreakdown}>
              {pending.computed.breakdown.map((row, i) => (
                <span key={i} className={css.stRpgBreakdownRow}>
                  {row.label} <b>{row.value > 0 ? '+' + row.value : row.value}</b>
                </span>
              ))}
            </div>
            <div className={css.stRow}>
              <Btn variant="primary" disabled={busy !== ''} onClick={() => { if (actor) void rollPending(pending, actor) }}>
                {busy === 'roll' ? '掷骰中…' : '掷骰'}
              </Btn>
              <Btn disabled={busy !== ''} onClick={() => props.onState({ ...props.state, pending: null })}>放弃</Btn>
            </div>
          </div>
        )
        : encounter !== null
          ? (
            <div className={css.stRpgCard}>
              <div className={css.stRpgCardTitle}>{encounter.title}</div>
              {encounter.description ? <div className={css.stRpgCardDesc}>{encounter.description}</div> : null}
              <div className={css.stRpgCardMeta}>威胁 {encounter.threat} · {encounter.kind}</div>
              <div className={css.stRpgOptions}>
                {encounter.options.map((o) => (
                  <button key={o.id} type="button" className={css.stRpgOption} disabled={busy !== ''} onClick={() => { void onOption(o) }}>
                    <span className={css.stRpgOptionLabel}>{o.label}</span>
                    {o.hint ? <span className={css.stRpgOptionHint}>{o.hint}</span> : null}
                    <span className={css.stRpgOptionMeta}>
                      {o.attribute === '' ? '纯运气' : o.attribute.toUpperCase()}
                      {o.skill ? ' · ' + o.skill : ''}
                    </span>
                  </button>
                ))}
              </div>
              <div className={css.stRpgHint}>选择后由系统算出需要掷出的数字，再由你掷骰。</div>
            </div>
          )
          : null}

      <div className={css.stRpgInput}>
        <textarea
          className={cx(css.stInput, css.stTextarea)}
          rows={2}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={actor ? '以 ' + actor.name + ' 的身份宣告行动…（Enter 发送，Shift+Enter 换行）' : '宣告行动…'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitAction() } }}
        />
        <Btn variant="primary" disabled={busy !== '' || action.trim() === ''} onClick={() => { void submitAction() }}>
          {busy === 'turn' ? '…' : '行动'}
        </Btn>
      </div>

      <Section title="冒险设置" hint="这些开关只影响本局" defaultOpen={false}>
        <Field label="自然骰暴击（掷出 96-100 视为大成功，1-5 视为大失败，覆盖差值档位）">
          <label className={css.stCheck}>
            <input type="checkbox" checked={critEnabled} onChange={(e) => setCritEnabled(e.target.checked)} />
            {critEnabled ? '启用（更戏剧化）' : '关闭（完全按差值判定）'}
          </label>
        </Field>
        <Field label="队友发言（每次叙述后，队伍成员按各自的模型逐一开口）">
          <label className={css.stCheck}>
            <input type="checkbox" checked={chatter} onChange={(e) => setChatter(e.target.checked)} />
            {chatter ? '开启' : '关闭'}
          </label>
        </Field>
        <Field label="当前场景摘要（可手动修正，会作为后续回合的上下文）">
          <textarea
            className={cx(css.stInput, css.stTextarea)}
            rows={3}
            value={props.state.scene}
            onChange={(e) => props.onState({ ...props.state, scene: e.target.value })}
          />
        </Field>
        {props.state.facts.length > 0
          ? (
            <Field label={'已确立的事实（' + props.state.facts.length + ' 条，守秘人必须保持一致）'}>
              <div className={css.stRpgFacts}>
                {props.state.facts.map((f, i) => <div key={i} className={css.stRpgFact}>{f}</div>)}
              </div>
            </Field>
          )
          : null}
        <div className={css.stRow}>
          <Btn onClick={() => { props.onState({ ...props.state, log: [], encounter: null, pending: null, facts: [], turn: 0 }) }}>清空本局记录</Btn>
        </div>
      </Section>
    </div>
  )
}

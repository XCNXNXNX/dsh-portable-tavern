/**
 * Bridge between character cards and party members.
 *
 * A character and a companion are two views of the same person, so they convert
 * both ways: a card you shaped on the 角色卡 tab can walk into your party, and a
 * companion you built on the 队伍 tab can be exported as a standard SillyTavern
 * card to chat with or share.
 *
 * The attribute derivation below is deliberately plain and documented rather
 * than clever: the class sets the physical/mental lean, the Big Five scores
 * nudge the rest, and everything lands in a range the party editor can adjust.
 */

import { INHERIT_ROUTE, type CharCard, type PartyMember, type TavernSpec } from '../protocol.ts'
import { makeMember } from './party.ts'

/** Which attribute each ability name from the card builder leans on. */
const ABILITY_ATTR: Record<string, PartyMember['skills'][number]['attr']> = {
  剑术: 'str', 格斗: 'str', 攀爬: 'str',
  魔法: 'int', 炼金: 'int', 工程: 'int',
  潜行: 'dex', 骑术: 'dex', 箭术: 'dex',
  说服: 'cha', 音乐: 'cha', 外交: 'cha',
  驯兽: 'wis', 医术: 'wis', 占卜: 'wis', 烹饪: 'wis', 追踪: 'wis',
}

/** The class lean: which attributes this profession starts ahead on. */
const JOB_LEAN: Record<string, Partial<Record<keyof PartyMember['attributes'], number>>> = {
  战士: { str: 3, con: 1 }, 骑士: { str: 2, cha: 2 }, 工匠: { str: 2, int: 1, con: 1 },
  盗贼: { dex: 3, wis: 1 }, 猎人: { dex: 2, wis: 2 }, 游侠: { dex: 2, wis: 2 },
  法师: { int: 3, wis: 1 }, 学者: { int: 3, wis: 1 }, 术士: { int: 2, cha: 1, con: 1 },
  牧师: { cha: 2, wis: 2 }, 吟游诗人: { cha: 3, dex: 1 }, 商人: { cha: 3, int: 1 },
}

/** Round toward zero, half away from zero, used for the personality nudges. */
function nudge(score: number, weight: number): number {
  const raw = (Number(score) - 5) * weight
  return raw >= 0 ? Math.round(raw) : -Math.round(-raw)
}

/** Keep a derived score inside the table's legal range. */
function clampAttr(value: number): number {
  return Math.min(18, Math.max(6, Math.round(value)))
}

/** Strip SillyTavern placeholders so the text reads naturally in a prompt. */
function clean(text: string | undefined, name: string): string {
  return String(text ?? '').split('{{char}}').join(name || '角色').split('{{user}}').join('玩家').trim()
}

/** The skill list implied by the card's ability tags. */
function skillsFromAbilities(abilities: string[]): PartyMember['skills'] {
  const out: PartyMember['skills'] = []
  for (const ability of abilities ?? []) {
    const name = String(ability ?? '').trim()
    if (name === '' || out.some((s) => s.name === name)) continue
    out.push({ name, attr: ABILITY_ATTR[name] ?? 'wis', bonus: ABILITY_ATTR[name] === undefined ? 3 : 5 })
    if (out.length >= 10) break
  }
  return out
}

/**
 * Compose the member's standing instruction from whatever the card carries.
 * @param card - the character card, if one exists.
 * @param spec - the builder state, used when the card is thin or absent.
 * @param name - the resolved display name.
 */
export function personaFromCard(card: CharCard | null, spec: TavernSpec | null, name: string): string {
  const parts: string[] = []
  if (card !== null) {
    const d = card.data
    if (d.description) parts.push(clean(d.description, name))
    if (d.personality) parts.push('性格：' + clean(d.personality, name))
    if (d.system_prompt) parts.push('行为准则：' + clean(d.system_prompt, name))
  }
  if (parts.length === 0 && spec !== null) {
    const b = spec.basic
    const p = spec.personality
    const bg = spec.background
    parts.push(name + '，' + (b.ageUnknown ? '年龄未知' : b.age + ' 岁') + '的' + b.gender + '性' +
      (b.race === '自定义' ? (b.raceCustom || '未知种族') : b.race) +
      (b.job === '自定义' ? (b.jobCustom || '') : b.job) + '。')
    if (p.traits.length > 0) parts.push('性格关键词：' + p.traits.join('、') + '。')
    if (bg.origin) parts.push('出身：' + bg.origin + '。')
    if (bg.experience) parts.push('经历：' + bg.experience + '。')
    if (spec.abilities.length > 0) parts.push('擅长：' + spec.abilities.join('、') + '。')
  }
  return parts.join('\n').slice(0, 2000)
}

/**
 * Turn the character card (or the builder state) into a party member.
 *
 * Derivation, so the numbers are never a mystery:
 * - every attribute starts at 11;
 * - the class adds its lean (a 战士 gets +3 力量, a 法师 +3 智力, ...);
 * - the Big Five scores nudge 体质/智力/感知/魅力 by up to ±3;
 * - hit points follow 体质: 16 + (体质 - 10) * 2.
 * Everything is editable afterwards on the 队伍 tab.
 * @param card - the card to convert, or null to convert the builder state.
 * @param spec - the builder state.
 * @param avatar - the portrait to carry over.
 * @param index - position in the party, used for the id and fallback name.
 */
export function memberFromCard(
  card: CharCard | null,
  spec: TavernSpec | null,
  avatar: string,
  index: number,
): PartyMember {
  const name = (card?.data.name || spec?.basic.name || '').trim() || '队员 ' + (index + 1)
  const job = card !== null
    ? (spec?.basic.job ?? '')
    : (spec?.basic.job ?? '')
  const jobName = job === '自定义' ? (spec?.basic.jobCustom ?? '') : job
  const abilities = spec?.abilities ?? []
  const p = spec?.personality

  const attributes: PartyMember['attributes'] = { str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11 }
  const lean = JOB_LEAN[jobName] ?? {}
  for (const key of Object.keys(lean) as (keyof PartyMember['attributes'])[]) {
    attributes[key] += lean[key] ?? 0
  }
  if (p !== undefined && p !== null) {
    attributes.con += nudge(p.stability, 0.6)
    attributes.int += nudge(p.openness, 0.6)
    attributes.wis += nudge(p.conscientiousness, 0.6)
    attributes.cha += nudge((p.extroversion + p.agreeableness) / 2, 0.6)
    attributes.str += nudge(p.extroversion, 0.3)
    attributes.dex += nudge(p.openness, 0.3)
  }
  for (const key of Object.keys(attributes) as (keyof PartyMember['attributes'])[]) {
    attributes[key] = clampAttr(attributes[key])
  }

  const skills = skillsFromAbilities(abilities)
  const carried = card?.data.extensions as { avatar?: unknown } | undefined
  const portrait = avatar !== '' ? avatar : (typeof carried?.avatar === 'string' ? carried.avatar : '')
  const maxHp = Math.max(8, 16 + (attributes.con - 10) * 2)

  return makeMember(index, {
    name,
    role: jobName,
    avatar: portrait,
    prompt: personaFromCard(card, spec, name),
    attributes,
    skills,
    hp: maxHp,
    maxHp,
    status: [],
    llm: { ...INHERIT_ROUTE },
  })
}

/**
 * Turn a party member back into a standard SillyTavern V2 card.
 * @param member - the companion to export.
 */
export function cardFromMember(member: PartyMember): CharCard {
  const stats = (Object.keys(member.attributes) as (keyof PartyMember['attributes'])[])
    .map((key) => key.toUpperCase() + ' ' + member.attributes[key])
    .join(' / ')
  const skills = member.skills.length > 0
    ? member.skills.map((s) => s.name + (s.bonus ? ' +' + s.bonus : '')).join('、')
    : '（未列出）'
  const description = [
    member.name + (member.role ? '，' + member.role + '。' : '。'),
    member.prompt ? member.prompt : '',
    '',
    '属性：' + stats,
    '擅长：' + skills,
    '生命：' + member.hp + '/' + member.maxHp,
    member.status.length > 0 ? '当前状态：' + member.status.join('、') : '',
  ].filter((line) => line !== '').join('\n')

  const tags = [member.role, '便携酒馆队伍'].filter((t) => t !== '')

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: member.name,
      description,
      personality: member.prompt ? member.prompt.slice(0, 400) : (member.role || '性格鲜明'),
      scenario: '',
      first_mes: member.name + '看向你，等你先开口。',
      mes_example: '',
      creator_notes: '由 dsh-portable-tavern 从队伍成员导出',
      system_prompt: member.prompt,
      post_history_instructions: '',
      alternate_greetings: [],
      tags,
      creator: 'dsh-portable-tavern',
      character_version: '1.0',
      extensions: member.avatar !== '' ? { avatar: member.avatar } : {},
    },
  }
}

/**
 * A shareable team document: the party plus a note about where it came from.
 * @param party - the team to serialize.
 * @param members - the resolved members (the party already carries them).
 */
export function teamFileName(party: { name: string }): string {
  const base = (party.name || 'party').replace(/[\\/:*?"<>|]/g, '_').trim() || 'party'
  return base + '.party.json'
}

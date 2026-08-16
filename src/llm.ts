/**
 * LLM-backed helpers shared by the /api/dsh-portable-tavern routes. Everything
 * rides the official `@deepseek-ai/dsh-llm` service (ctx.llm) — one-shot
 * hand-built calls, no agent loop, no DSH source changes.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { GenerateOptions, StreamChunk, LlmRuntime, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { CharCard, ChatMessage, LlmCustom, TavernSpec } from './protocol.ts'

/** Stable generation prompt used by generate/worldbook. */
export const SYSTEM = '你是一位专业的 SillyTavern 角色卡撰写专家，擅长塑造鲜活、立体、有记忆点的角色。你严格遵循用户的输出要求，通过调用工具或输出 JSON 返回结果。'

// ---------------------------------------------------------------------------
// user-supplied OpenAI-compatible endpoint (custom API key path)
// ---------------------------------------------------------------------------

/** A custom-endpoint completion result in the same shape the routes consume. */
export interface CompletionResult {
  text: string
  toolCalls: { name: string; arguments: string }[]
}

/** Normalize a base URL and return the chat-completions endpoint. */
function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '')
  return trimmed + '/chat/completions'
}

/**
 * One OpenAI-compatible chat completion against the user's own endpoint.
 * The API key lives only in the Authorization header of this one request;
 * errors are redacted so the key can never leak into logs or the UI.
 */
export async function customComplete(custom: LlmCustom, options: {
  system?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  temperature?: number
  maxTokens?: number
}): Promise<CompletionResult> {
  const url = completionsUrl(custom.baseUrl)
  let parsedUrl: URL
  try { parsedUrl = new URL(url) } catch { throw new Error('自定义接口地址无效') }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('自定义接口地址必须是 http(s):// 开头')
  }
  const body = {
    model: custom.model,
    messages: [
      ...(options.system ? [{ role: 'system', content: options.system }] : []),
      ...options.messages.map(m => ({ role: m.role, content: m.content })),
    ],
    temperature: options.temperature ?? 0.8,
    max_tokens: options.maxTokens ?? 1600,
    stream: false,
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 180_000)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${custom.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? '请求超时' : '网络错误或接口不可达'
    throw new Error('自定义模型调用失败：' + reason)
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    // Redact: never echo the request body (it contains no key, but stay strict)
    // and cap the upstream text so a chatty gateway can't spam the UI.
    let detail = ''
    try {
      const errBody = await response.text()
      detail = errBody.slice(0, 300)
    } catch { /* ignore */ }
    throw new Error(`自定义模型返回 HTTP ${response.status}${detail ? '：' + detail : ''}`)
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = (data.choices?.[0]?.message?.content ?? '').trim()
  if (text === '') throw new Error('自定义模型返回了空回复')
  return { text, toolCalls: [] }
}

/** True when the custom endpoint is fully configured. */
export function customReady(custom: LlmCustom | undefined | null): custom is LlmCustom {
  return custom !== undefined && custom !== null
    && typeof custom.baseUrl === 'string' && custom.baseUrl.trim() !== ''
    && typeof custom.apiKey === 'string' && custom.apiKey.trim() !== ''
    && typeof custom.model === 'string' && custom.model.trim() !== ''
}

/** Tool schema the generate route offers so the model returns structured card data. */
export const CARD_TOOL = {
  name: 'emit_card',
  description: '输出一张完整的 SillyTavern 角色卡数据对象',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '角色名称' },
      description: { type: 'string', description: '角色描述，整合外貌、出身、经历与世界观' },
      personality: { type: 'string', description: '性格描述' },
      scenario: { type: 'string', description: '初始场景设定' },
      first_mes: { type: 'string', description: '首条问候语' },
      mes_example: { type: 'string', description: '2-3 段示例对话，用 <START> 分隔' },
      creator_notes: { type: 'string', description: '创作者备注' },
      system_prompt: { type: 'string', description: '系统级行为指令' },
      alternate_greetings: { type: 'array', items: { type: 'string' }, description: '2 条替代问候语' },
      tags: { type: 'array', items: { type: 'string' }, description: '3-6 个角色标签' },
    },
    required: ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes', 'system_prompt', 'alternate_greetings', 'tags'],
  },
}

interface DefaultModelSelection { provider?: string; model?: string; reasoningEffort?: ReasoningEffortId }

/** Resolve the model route: the user's default selection, else the first provider/model. */
export async function resolveRoute(ctx: Context): Promise<{ provider: string; model: string; reasoningEffort?: ReasoningEffortId }> {
  const dm = ctx.get('agentDefaultModel') as { currentSelection(): DefaultModelSelection } | undefined
  let provider = ''
  let model = ''
  let reasoningEffort: ReasoningEffortId | undefined
  if (dm) {
    try {
      const sel = dm.currentSelection()
      if (sel && sel.provider && sel.model) {
        provider = sel.provider
        model = sel.model
        reasoningEffort = sel.reasoningEffort
      }
    } catch { /* ignore */ }
  }
  if (!provider || !model) {
    const llm = ctx.llm
    const providers = llm.listProviders()
    if (providers.length === 0) throw new Error('no LLM provider available')
    provider = providers[0].id
    const models = await llm.listModels(provider)
    if (models.length === 0) throw new Error('no model available for provider')
    model = models[0].id
  }
  return { provider, model, reasoningEffort }
}

let msgSeq = 0

/** Build a hand-made provider-neutral message carrying the runtime-required source tag. */
function mkMessage(role: 'user' | 'assistant', text: string, provider = '', model = ''): any {
  msgSeq += 1
  return {
    id: 'pt-msg-' + msgSeq,
    role,
    content: [{ type: 'text', text }],
    source: role === 'assistant' ? { kind: 'model', provider, model } : { kind: 'user' },
  }
}

/** Stream one call and collect visible text plus any emitted tool calls. */
export async function streamCompletion(
  ctx: Context,
  options: GenerateOptions,
): Promise<{ text: string; toolCalls: { name: string; arguments: string }[] }> {
  let text = ''
  const toolCalls: { name: string; arguments: string }[] = []
  const chunks = ctx.llm.stream(options)
  for await (const c of chunks) {
    if (c.type === 'text-delta') text += c.text
    else if (c.type === 'block-end' && c.block.type === 'tool-call') {
      toolCalls.push({ name: c.block.name, arguments: c.block.arguments })
    } else if (c.type === 'finish') {
      const r = c.reason
      if (r.kind === 'error' || r.kind === 'aborted') {
        throw new Error(r.failure?.message ?? 'generation interrupted')
      }
    }
  }
  return { text: text.trim(), toolCalls }
}

/** Stream one call and return only the visible text. */
export async function streamText(ctx: Context, options: GenerateOptions): Promise<string> {
  const r = await streamCompletion(ctx, options)
  return r.text
}

function describeSpec(spec: TavernSpec): string {
  const b = spec.basic
  const a = spec.appearance
  const p = spec.personality
  const bg = spec.background
  const d = spec.dialogue
  const sc = spec.scenario
  const L: string[] = []
  L.push('角色名称：' + (b.name || '未命名'))
  L.push('年龄：' + (b.ageUnknown ? '未知/永生' : String(b.age)))
  L.push('性别：' + b.gender)
  L.push('种族：' + (b.race === '自定义' ? (b.raceCustom || '自定义') : b.race))
  L.push('职业：' + (b.job === '自定义' ? (b.jobCustom || '自定义') : b.job))
  L.push('外貌：身高' + a.height + (a.heightUnit === 'ft' ? '英尺' : '厘米') + '，体型' + a.build + '，发色' + a.hairColor + '，发型' + a.hairStyle + '，瞳色' + a.eyeColor + '，肤色' + a.skinColor)
  if (a.features.length) L.push('显著特征：' + a.features.join('、'))
  L.push('性格五维（1-10，数值越大越外向/热情/严谨/沉稳/好奇）：外向性' + p.extroversion + '、友善度' + p.agreeableness + '、尽责性' + p.conscientiousness + '、情绪稳定性' + p.stability + '、开放性' + p.openness)
  if (p.traits.length) L.push('性格关键词：' + p.traits.join('、'))
  if (bg.origin) L.push('出身：' + bg.origin)
  if (bg.experience) L.push('重要经历：' + bg.experience)
  if (bg.world) L.push('世界观设定：' + bg.world)
  if (spec.abilities.length) L.push('能力与特长：' + spec.abilities.join('、'))
  L.push('对话风格：' + d.style + '，语气' + d.tone + '，' + (d.person === 'third' ? '第三人称（她/他）' : '第一人称（我）'))
  if (sc.scene || sc.sceneTemplate) L.push('初始场景：' + (sc.scene || sc.sceneTemplate))
  L.push('开场白风格：' + (sc.openerStyle || '简短'))
  return L.join('\n')
}

export function buildPrompt(spec: TavernSpec): string {
  const person = spec.dialogue.person === 'third' ? '第三人称' : '第一人称'
  const scene = (spec.scenario.scene || spec.scenario.sceneTemplate) || '由你根据角色背景设计一个自然的开场场景'
  return [
    '请根据下面的角色设定，撰写一张完整的 SillyTavern 角色卡。',
    '',
    '【角色设定】',
    describeSpec(spec),
    '',
    '【输出方式】',
    '请调用 emit_card 工具，把完整的角色卡数据作为该工具的 JSON 参数返回，不要输出任何其他文字。',
    '若无法调用工具，则只输出一个合法的 JSON 对象（不要 Markdown 代码块、不要任何解释），字段如下：',
    'name（角色名称）、description（角色描述，整合外貌/出身/经历/世界观，使用 {{char}} 指代角色、{{user}} 指代用户）、personality（性格描述）、scenario（初始场景，设定为：' + scene + '）、first_mes（首条问候语，用' + person + '）、mes_example（2-3 段示例对话，每段用单独一行 <START> 分隔）、creator_notes（创作者备注）、system_prompt（系统级行为指令，使用 {{char}}/{{user}} 占位符）、alternate_greetings（2 条替代问候语的字符串数组）、tags（3-6 个标签的字符串数组）。',
    '',
    '要求：内容精炼，description 控制在 600-1000 token 量级。全部用中文撰写（角色名与专有名词可保留原文）。',
  ].join('\n')
}

export function buildWorldbookPrompt(spec: TavernSpec, card: CharCard | null): string {
  const d = card?.data
  let source: string
  if (d && (d.name || d.description || d.personality || d.scenario)) {
    const L: string[] = []
    if (d.name) L.push('角色名称：' + d.name)
    if (d.description) L.push('角色描述：' + d.description)
    if (d.personality) L.push('性格：' + d.personality)
    if (d.scenario) L.push('场景：' + d.scenario)
    source = L.join('\n')
  } else {
    source = describeSpec(spec)
  }
  return [
    '请根据下面的角色信息，为 SillyTavern 生成一组配套的 World Book（世界书）条目。',
    '',
    '【角色信息】',
    source,
    '',
    '【输出格式】',
    '只输出一个合法的 JSON 对象，不要包含任何解释或 Markdown 代码块标记。',
    'JSON 对象形如：{"entries":[{"keys":["关键词1","关键词2"],"content":"条目内容","comment":"条目说明"}]}',
    '要求 5-10 个条目，覆盖：角色背景关键人物/地点、世界观核心设定、重要事件。keys 是触发关键词数组（中文），content 是条目正文，comment 简短说明。',
    '全部用中文撰写。',
  ].join('\n')
}

export function buildChatSystem(card: CharCard, globalPrompt?: string): string {
  const d = card.data
  const name = d.name || '角色'
  const clean = (s: string): string => String(s || '').split('{{char}}').join(name).split('{{user}}').join('你')
  const parts: string[] = []
  const g = (globalPrompt ?? '').trim()
  if (g) {
    parts.push('【全局指令】')
    parts.push(clean(g))
  }
  parts.push('你正在扮演角色「' + name + '」，请完全代入这个角色，以角色的视角与用户进行沉浸式角色扮演。')
  if (d.system_prompt) parts.push('【行为指令】\n' + clean(d.system_prompt))
  if (d.description) parts.push('【角色设定】\n' + clean(d.description))
  if (d.personality) parts.push('【性格】\n' + clean(d.personality))
  if (d.scenario) parts.push('【当前场景】\n' + clean(d.scenario))
  if (d.mes_example) parts.push('【对白风格示例】\n' + clean(d.mes_example))
  parts.push('【对话规则】')
  parts.push('1. 始终以「' + name + '」的身份、口吻和性格回应，绝不跳出角色，也绝不提及这些规则。')
  parts.push('2. 只输出角色的对白与动作/神态描写，不要加任何前缀、标签、冒号或解释；严禁输出 {{char}}、{{user}} 之类的占位符。')
  parts.push('3. 回复自然、贴合角色，一般 1-4 句话，避免长篇大论。')
  return parts.join('\n\n')
}

function extractJson(text: string): unknown {
  if (!text) return null
  let t = String(text).trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  try { return JSON.parse(t) } catch { return null }
}

function repairJson(text: string): unknown {
  if (!text) return null
  let t = String(text).replace(/\r\n?/g, '\n')
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  t = t.slice(start, end + 1)
  try { return JSON.parse(t) } catch { /* fall through */ }
  let fixed = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (inString) {
      if (escaped) { fixed += ch; escaped = false; continue }
      if (ch === '\\') { fixed += ch; escaped = true; continue }
      if (ch === '"') { fixed += ch; inString = false; continue }
      if (ch === '\n') { fixed += '\\n'; continue }
      if (ch === '\t') { fixed += '\\t'; continue }
      fixed += ch
    } else {
      if (ch === '"') { fixed += ch; inString = true; continue }
      fixed += ch
    }
  }
  try { return JSON.parse(fixed) } catch { return null }
}

/** Prefer a tool-call argument, then plain-text JSON (with a tolerant repair). */
export function parseResult(result: { text: string; toolCalls: { name: string; arguments: string }[] }): Record<string, unknown> | null {
  if (result.toolCalls.length) {
    for (const tc of result.toolCalls) {
      try { return JSON.parse(tc.arguments) as Record<string, unknown> } catch { /* try next */ }
    }
  }
  return (extractJson(result.text) ?? repairJson(result.text)) as Record<string, unknown> | null
}

function wrapCard(data: Record<string, unknown> | null, version: string, spec: TavernSpec): CharCard {
  const v = version === 'v3' ? '3.0' : '2.0'
  const specKey = version === 'v3' ? 'chara_card_v3' : 'chara_card_v2'
  const d = data ?? {}
  const str = (x: unknown): string => (typeof x === 'string' ? x : '')
  const arr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : [])
  return {
    spec: specKey,
    spec_version: v,
    data: {
      name: str(d.name) || spec.basic.name || '未命名角色',
      description: str(d.description),
      personality: str(d.personality),
      scenario: str(d.scenario),
      first_mes: str(d.first_mes),
      mes_example: str(d.mes_example),
      creator_notes: str(d.creator_notes),
      system_prompt: str(d.system_prompt),
      post_history_instructions: str(d.post_history_instructions),
      alternate_greetings: arr(d.alternate_greetings),
      tags: arr(d.tags),
      creator: str(d.creator) || 'dsh-portable-tavern',
      character_version: str(d.character_version) || '1.0',
      extensions: (typeof d.extensions === 'object' && d.extensions !== null ? d.extensions : {}) as Record<string, unknown>,
    },
  }
}

function fallbackData(spec: TavernSpec): Record<string, unknown> {
  const b = spec.basic
  const a = spec.appearance
  const p = spec.personality
  const bg = spec.background
  const d = spec.dialogue
  const sc = spec.scenario
  const name = b.name || '未命名角色'
  const race = b.race === '自定义' ? (b.raceCustom || '自定义') : b.race
  const job = b.job === '自定义' ? (b.jobCustom || '自定义') : b.job
  const description = [
    name + '是一位' + (b.ageUnknown ? '年龄未知' : b.age + '岁') + '的' + b.gender + '性' + race + job + '。',
    '身高约' + a.height + (a.heightUnit === 'ft' ? '英尺' : '厘米') + '，体型' + a.build + '，' + a.hairStyle + a.hairColor + '头发，' + a.eyeColor + '眼眸。',
    a.features.length ? '身上带有' + a.features.join('、') + '等显著特征。' : '',
    bg.origin ? '出身' + bg.origin + '。' : '',
    bg.experience ? '经历过：' + bg.experience + '。' : '',
    spec.abilities.length ? '擅长' + spec.abilities.join('、') + '。' : '',
    bg.world ? '所处的世界：' + bg.world + '。' : '',
  ].filter(Boolean).join('')
  const first_mes = (d.person === 'third' ? name + '看向你，轻声开口：' : '你终于来了。') + (sc.scene || sc.sceneTemplate ? '（场景：' + (sc.scene || sc.sceneTemplate) + '）' : '')
  return {
    name,
    description,
    personality: p.traits.length ? p.traits.join('、') : '性格鲜明',
    scenario: sc.scene || sc.sceneTemplate || '一个平凡的相遇时刻',
    first_mes,
    mes_example: '<START>\n{{char}}: 你来了。\n{{user}}: 嗯，我来了。\n{{char}}: 我等你很久了。',
    creator_notes: '由 dsh-portable-tavern 降级模式自动生成',
    system_prompt: '你是 {{char}}，请始终以 {{char}} 的身份和口吻与 {{user}} 对话。',
    alternate_greetings: ['我们又见面了。', '你看起来有心事。'],
    tags: [race, job].filter(Boolean),
  }
}

/** Generate the card data, retrying once with a stricter plain-JSON prompt on failure. */
export async function generateCard(ctx: Context, spec: TavernSpec, version: string, custom?: LlmCustom): Promise<{ card: CharCard; rawText: string; fallback: boolean }> {
  const prompt = buildPrompt(spec)
  let result: CompletionResult
  if (customReady(custom)) {
    // Custom endpoint: plain-JSON contract (buildPrompt already instructs it).
    result = await customComplete(custom, { system: SYSTEM, messages: [{ role: 'user', content: prompt }], temperature: 0.85, maxTokens: 3200 })
    let data = parseResult(result)
    if (data === null) {
      const retryPrompt = prompt + '\n\n【再次强调】请只输出一个合法的 JSON 对象本身，不要任何解释、不要 Markdown 代码块；字符串里的换行必须用 \\n 转义。'
      result = await customComplete(custom, { system: SYSTEM, messages: [{ role: 'user', content: retryPrompt }], temperature: 0.3, maxTokens: 3200 })
      data = parseResult(result)
    }
    return { card: wrapCard(data, version, spec), rawText: result.text, fallback: data === null }
  }
  const route = await resolveRoute(ctx)
  result = await streamCompletion(ctx, {
    provider: route.provider,
    model: route.model,
    reasoningEffort: route.reasoningEffort,
    messages: [mkMessage('user', prompt)],
    system: SYSTEM,
    tools: [CARD_TOOL],
    temperature: 0.85,
    maxTokens: 3200,
  })
  let data = parseResult(result)
  if (!data) {
    const retryPrompt = prompt + '\n\n【再次强调】请只输出一个合法的 JSON 对象本身，不要调用工具、不要任何解释、不要 Markdown 代码块；字符串里的换行必须用 \\n 转义。'
    result = await streamCompletion(ctx, {
      provider: route.provider,
      model: route.model,
      reasoningEffort: route.reasoningEffort,
      messages: [mkMessage('user', retryPrompt)],
      system: SYSTEM,
      temperature: 0.3,
      maxTokens: 3200,
    })
    data = parseResult(result)
  }
  const fallback = data === null
  return { card: wrapCard(data, version, spec), rawText: result.text, fallback }
}

/** Generate world-book entries from the spec or an existing card. */
export async function generateWorldbook(ctx: Context, spec: TavernSpec, card: CharCard | null, custom?: LlmCustom): Promise<{ entries: unknown[]; rawText: string }> {
  const prompt = buildWorldbookPrompt(spec, card)
  let text: string
  if (customReady(custom)) {
    text = (await customComplete(custom, { system: SYSTEM, messages: [{ role: 'user', content: prompt }], temperature: 0.7, maxTokens: 2200 })).text
  } else {
    const route = await resolveRoute(ctx)
    text = await streamText(ctx, {
      provider: route.provider,
      model: route.model,
      reasoningEffort: route.reasoningEffort,
      messages: [mkMessage('user', prompt)],
      system: SYSTEM,
      temperature: 0.7,
      maxTokens: 2200,
    })
  }
  const parsed = (extractJson(text) ?? repairJson(text)) as { entries?: unknown } | null
  const entries = parsed && Array.isArray(parsed.entries) ? parsed.entries : []
  return { entries, rawText: text }
}

/** List available models plus the current default route. */
export async function listModels(ctx: Context): Promise<{ options: { provider: string; model: string; label: string }[]; current: { provider: string; model: string } | null }> {
  const llm = ctx.llm
  const providers = llm.listProviders()
  const options: { provider: string; model: string; label: string }[] = []
  for (const p of providers) {
    try {
      const models = await llm.listModels(p.id)
      if (models.length) {
        for (const m of models) options.push({ provider: p.id, model: m.id, label: (p.name || p.id) + ' · ' + (m.name || m.id) })
      } else {
        options.push({ provider: p.id, model: '', label: p.name || p.id })
      }
    } catch {
      options.push({ provider: p.id, model: '', label: p.name || p.id })
    }
  }
  let current: { provider: string; model: string } | null = null
  try {
    const route = await resolveRoute(ctx)
    current = { provider: route.provider, model: route.model }
  } catch { /* no default */ }
  return { options, current }
}

/** Produce the character's reply for one chat turn. */
export async function chatReply(ctx: Context, card: CharCard, messages: ChatMessage[], provider?: string, model?: string, globalPrompt?: string, custom?: LlmCustom): Promise<string> {
  const system = buildChatSystem(card, globalPrompt)
  if (customReady(custom) && (provider === undefined || provider === '' || provider === 'custom')) {
    return (await customComplete(custom, {
      system,
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content })),
      temperature: 0.9,
      maxTokens: 600,
    })).text
  }
  const route = await resolveRoute(ctx)
  const p = provider && model ? provider : route.provider
  const m = provider && model ? model : route.model
  const modelMessages = messages.map((msg) => mkMessage(msg.role === 'assistant' ? 'assistant' : 'user', msg.content, p, m))
  return streamText(ctx, {
    provider: p,
    model: m,
    reasoningEffort: route.reasoningEffort,
    messages: modelMessages,
    system,
    temperature: 0.9,
    maxTokens: 600,
  })
}

/** Round-trip test of a user-supplied endpoint (settings 「测试连接」). */
export async function testCustom(custom: LlmCustom): Promise<{ ok: true; latencyMs: number; reply: string }> {
  const started = Date.now()
  const result = await customComplete(custom, {
    messages: [{ role: 'user', content: '请只回复两个字：连接成功' }],
    temperature: 0,
    maxTokens: 20,
  })
  return { ok: true, latencyMs: Date.now() - started, reply: result.text.slice(0, 100) }
}

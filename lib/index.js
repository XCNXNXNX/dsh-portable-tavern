// src/routes.ts
import { randomInt } from "node:crypto";

// src/protocol.ts
var TAVERN_API_BASE = "/api/dsh-portable-tavern";
var TAVERN_API = {
  generate: TAVERN_API_BASE + "/generate",
  worldbook: TAVERN_API_BASE + "/worldbook",
  models: TAVERN_API_BASE + "/models",
  chat: TAVERN_API_BASE + "/chat",
  test: TAVERN_API_BASE + "/test",
  // --- tabletop RPG (system-arbitrated) ---
  rpgTurn: TAVERN_API_BASE + "/rpg/turn",
  rpgCheck: TAVERN_API_BASE + "/rpg/check",
  rpgRoll: TAVERN_API_BASE + "/rpg/roll",
  rpgNarrate: TAVERN_API_BASE + "/rpg/narrate",
  rpgMember: TAVERN_API_BASE + "/rpg/member",
  rpgScenario: TAVERN_API_BASE + "/rpg/scenario",
  rpgOutline: TAVERN_API_BASE + "/rpg/outline",
  chatMember: TAVERN_API_BASE + "/chat/member",
  // --- SillyTavern extension host ---
  extList: TAVERN_API_BASE + "/ext/list",
  extCatalog: TAVERN_API_BASE + "/ext/catalog",
  extInstall: TAVERN_API_BASE + "/ext/install",
  extRemove: TAVERN_API_BASE + "/ext/remove"
};
var DEFAULT_TEMPERATURE_POLICY = { mode: "auto", value: 0.85 };
var TAVERN_EXT_BASE = "/tavern-ext";
function emptyAdventureSetup() {
  return { title: "", premise: "", tone: "", rules: "", outline: [] };
}

// src/temperature.ts
var SEP = String.fromCharCode(0);
var learned = /* @__PURE__ */ new Map();
function samplingKey(kind, owner, model) {
  return kind + SEP + owner + "/" + model;
}
function clamp(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(0, value));
}
function classifyTemperatureError(message) {
  const text = String(message === void 0 || message === null ? "" : message);
  if (text === "") return null;
  if (!/temperature|温度/i.test(text)) return null;
  const only = /only\s+(-?[0-9]+(?:\.[0-9]+)?)\s+is\s+allowed/i.exec(text);
  if (only) return { value: clamp(Number(only[1])) };
  const mustBe = /temperature[^0-9]{0,32}?(?:must|should|has\s+to|needs?\s+to)\s+be\s+(-?[0-9]+(?:\.[0-9]+)?)/i.exec(text);
  if (mustBe) return { value: clamp(Number(mustBe[1])) };
  const needs = /temperature[^0-9\-+]{0,48}?(-?[0-9]+(?:\.[0-9]+)?)\s*(?:is\s*)?(?:required|allowed|expected|only)/i.exec(text);
  if (needs) return { value: clamp(Number(needs[1])) };
  if (/(not\s+support|unsupported|does\s+not\s+support|unknown\s+(?:parameter|field|argument)|invalid\s+parameter|unexpected\s+(?:parameter|field)|不支持)/i.test(text)) {
    return { omit: true };
  }
  return null;
}
function noteTemperatureError(key, message) {
  const constraint = classifyTemperatureError(message);
  if (constraint === null) return false;
  learned.set(key, constraint);
  return true;
}
function resolveTemperature(policy, key, fallback) {
  const hit = learned.get(key);
  if (hit !== void 0) return "omit" in hit ? void 0 : hit.value;
  if (policy !== void 0 && policy.mode === "omit") return void 0;
  if (policy !== void 0 && policy.mode === "fixed") return clamp(policy.value);
  return clamp(fallback);
}
function temperatureReport() {
  return [...learned.entries()].map(([key, c]) => ({
    key: key.split(SEP).join(" :: "),
    constraint: "omit" in c ? "\u4E0D\u53D1\u9001" : String(c.value)
  }));
}
async function withTemperatureRetry(key, policy, fallback, run) {
  try {
    return await run(resolveTemperature(policy, key, fallback));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!noteTemperatureError(key, message)) throw error;
    return await run(resolveTemperature(policy, key, fallback));
  }
}

// src/llm.ts
import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
var SYSTEM = "\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684 SillyTavern \u89D2\u8272\u5361\u64B0\u5199\u4E13\u5BB6\uFF0C\u64C5\u957F\u5851\u9020\u9C9C\u6D3B\u3001\u7ACB\u4F53\u3001\u6709\u8BB0\u5FC6\u70B9\u7684\u89D2\u8272\u3002\u4F60\u4E25\u683C\u9075\u5FAA\u7528\u6237\u7684\u8F93\u51FA\u8981\u6C42\uFF0C\u901A\u8FC7\u8C03\u7528\u5DE5\u5177\u6216\u8F93\u51FA JSON \u8FD4\u56DE\u7ED3\u679C\u3002";
function completionsUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
  return trimmed + "/chat/completions";
}
async function customComplete(custom, options) {
  const url = completionsUrl(custom.baseUrl);
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("\u81EA\u5B9A\u4E49\u63A5\u53E3\u5730\u5740\u65E0\u6548");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("\u81EA\u5B9A\u4E49\u63A5\u53E3\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934");
  }
  const body = {
    model: custom.model,
    messages: [
      ...options.system ? [{ role: "system", content: options.system }] : [],
      ...options.messages.map((m) => ({ role: m.role, content: m.content }))
    ],
    max_tokens: options.maxTokens ?? 1600,
    stream: false
  };
  if (options.temperature !== void 0) body.temperature = options.temperature;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18e4);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${custom.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "\u8BF7\u6C42\u8D85\u65F6" : "\u7F51\u7EDC\u9519\u8BEF\u6216\u63A5\u53E3\u4E0D\u53EF\u8FBE";
    throw new Error("\u81EA\u5B9A\u4E49\u6A21\u578B\u8C03\u7528\u5931\u8D25\uFF1A" + reason);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.text();
      detail = errBody.slice(0, 300);
    } catch {
    }
    throw new Error(`\u81EA\u5B9A\u4E49\u6A21\u578B\u8FD4\u56DE HTTP ${response.status}${detail ? "\uFF1A" + detail : ""}`);
  }
  const data = await response.json();
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  if (text === "") throw new Error("\u81EA\u5B9A\u4E49\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u56DE\u590D");
  return { text, toolCalls: [] };
}
function customReady(custom) {
  return custom !== void 0 && custom !== null && typeof custom.baseUrl === "string" && custom.baseUrl.trim() !== "" && typeof custom.apiKey === "string" && custom.apiKey.trim() !== "" && typeof custom.model === "string" && custom.model.trim() !== "";
}
var CARD_TOOL = {
  name: "emit_card",
  description: "\u8F93\u51FA\u4E00\u5F20\u5B8C\u6574\u7684 SillyTavern \u89D2\u8272\u5361\u6570\u636E\u5BF9\u8C61",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "\u89D2\u8272\u540D\u79F0" },
      description: { type: "string", description: "\u89D2\u8272\u63CF\u8FF0\uFF0C\u6574\u5408\u5916\u8C8C\u3001\u51FA\u8EAB\u3001\u7ECF\u5386\u4E0E\u4E16\u754C\u89C2" },
      personality: { type: "string", description: "\u6027\u683C\u63CF\u8FF0" },
      scenario: { type: "string", description: "\u521D\u59CB\u573A\u666F\u8BBE\u5B9A" },
      first_mes: { type: "string", description: "\u9996\u6761\u95EE\u5019\u8BED" },
      mes_example: { type: "string", description: "2-3 \u6BB5\u793A\u4F8B\u5BF9\u8BDD\uFF0C\u7528 <START> \u5206\u9694" },
      creator_notes: { type: "string", description: "\u521B\u4F5C\u8005\u5907\u6CE8" },
      system_prompt: { type: "string", description: "\u7CFB\u7EDF\u7EA7\u884C\u4E3A\u6307\u4EE4" },
      alternate_greetings: { type: "array", items: { type: "string" }, description: "2 \u6761\u66FF\u4EE3\u95EE\u5019\u8BED" },
      tags: { type: "array", items: { type: "string" }, description: "3-6 \u4E2A\u89D2\u8272\u6807\u7B7E" }
    },
    required: ["name", "description", "personality", "scenario", "first_mes", "mes_example", "creator_notes", "system_prompt", "alternate_greetings", "tags"]
  }
};
var effortCache = /* @__PURE__ */ new Map();
function supportedEfforts(ctx, provider, model) {
  const key = provider + "\0" + model;
  let cached = effortCache.get(key);
  if (cached === void 0) {
    cached = (async () => {
      try {
        const info = await ctx.llm.resolveModelInfo(provider, model);
        const efforts = info.reasoning?.efforts ?? [];
        return efforts.map((effort) => effort.id);
      } catch {
        return [];
      }
    })();
    effortCache.set(key, cached);
  }
  return cached;
}
async function resolveEffort(ctx, provider, model, requested) {
  if (requested === void 0) return void 0;
  const desired = String(requested) === "max" ? "high" : String(requested);
  const supported = await supportedEfforts(ctx, provider, model);
  if (supported.includes(desired)) return desired;
  if (supported.includes(ReasoningEffortId("high"))) return ReasoningEffortId("high");
  if (supported.includes(ReasoningEffortId("off"))) return ReasoningEffortId("off");
  return void 0;
}
async function resolveRoute(ctx) {
  const dm = ctx.get("agentDefaultModel");
  let provider = "";
  let model = "";
  let reasoningEffort;
  if (dm) {
    try {
      const sel = dm.currentSelection();
      if (sel && sel.provider && sel.model) {
        provider = sel.provider;
        model = sel.model;
        reasoningEffort = sel.reasoningEffort;
      }
    } catch {
    }
  }
  if (!provider || !model) {
    const llm = ctx.llm;
    const providers = llm.listProviders();
    if (providers.length === 0) throw new Error("no LLM provider available");
    provider = providers[0].id;
    const models = await llm.listModels(provider);
    if (models.length === 0) throw new Error("no model available for provider");
    model = models[0].id;
  }
  return { provider, model, reasoningEffort };
}
var msgSeq = 0;
function mkMessage(role, text, provider = "", model = "") {
  msgSeq += 1;
  return {
    id: "pt-msg-" + msgSeq,
    role,
    content: [{ type: "text", text }],
    source: role === "assistant" ? { kind: "model", provider, model } : { kind: "user" }
  };
}
async function streamCompletion(ctx, options) {
  let text = "";
  let finishKind;
  const toolCalls = [];
  const chunks = ctx.llm.stream(options);
  for await (const c of chunks) {
    if (c.type === "text-delta") text += c.text;
    else if (c.type === "block-end" && c.block.type === "tool-call") {
      toolCalls.push({ name: c.block.name, arguments: c.block.arguments });
    } else if (c.type === "finish") {
      const r = c.reason;
      finishKind = r.kind;
      if (r.kind === "error" || r.kind === "aborted") {
        throw new Error(r.failure?.message ?? "generation interrupted");
      }
    }
  }
  return { text: text.trim(), toolCalls, finishKind };
}
async function customWithPolicy(custom, options, sampling) {
  const key = samplingKey("custom", custom.baseUrl, custom.model);
  return withTemperatureRetry(key, sampling, options.temperature, (temperature) => customComplete(custom, { ...options, temperature }));
}
async function dshWithPolicy(ctx, args, sampling) {
  const key = samplingKey("dsh", args.provider, args.model);
  return withTemperatureRetry(key, sampling, args.temperature, (temperature) => streamCompletion(ctx, {
    provider: args.provider,
    model: args.model,
    reasoningEffort: args.reasoningEffort,
    system: args.system,
    messages: args.messages,
    tools: args.tools,
    temperature,
    maxTokens: args.maxTokens
  }));
}
function describeSpec(spec) {
  const b = spec.basic;
  const a = spec.appearance;
  const p = spec.personality;
  const bg = spec.background;
  const d = spec.dialogue;
  const sc = spec.scenario;
  const L = [];
  L.push("\u89D2\u8272\u540D\u79F0\uFF1A" + (b.name || "\u672A\u547D\u540D"));
  L.push("\u5E74\u9F84\uFF1A" + (b.ageUnknown ? "\u672A\u77E5/\u6C38\u751F" : String(b.age)));
  L.push("\u6027\u522B\uFF1A" + b.gender);
  L.push("\u79CD\u65CF\uFF1A" + (b.race === "\u81EA\u5B9A\u4E49" ? b.raceCustom || "\u81EA\u5B9A\u4E49" : b.race));
  L.push("\u804C\u4E1A\uFF1A" + (b.job === "\u81EA\u5B9A\u4E49" ? b.jobCustom || "\u81EA\u5B9A\u4E49" : b.job));
  L.push("\u5916\u8C8C\uFF1A\u8EAB\u9AD8" + a.height + (a.heightUnit === "ft" ? "\u82F1\u5C3A" : "\u5398\u7C73") + "\uFF0C\u4F53\u578B" + a.build + "\uFF0C\u53D1\u8272" + a.hairColor + "\uFF0C\u53D1\u578B" + a.hairStyle + "\uFF0C\u77B3\u8272" + a.eyeColor + "\uFF0C\u80A4\u8272" + a.skinColor);
  if (a.features.length) L.push("\u663E\u8457\u7279\u5F81\uFF1A" + a.features.join("\u3001"));
  L.push("\u6027\u683C\u4E94\u7EF4\uFF081-10\uFF0C\u6570\u503C\u8D8A\u5927\u8D8A\u5916\u5411/\u70ED\u60C5/\u4E25\u8C28/\u6C89\u7A33/\u597D\u5947\uFF09\uFF1A\u5916\u5411\u6027" + p.extroversion + "\u3001\u53CB\u5584\u5EA6" + p.agreeableness + "\u3001\u5C3D\u8D23\u6027" + p.conscientiousness + "\u3001\u60C5\u7EEA\u7A33\u5B9A\u6027" + p.stability + "\u3001\u5F00\u653E\u6027" + p.openness);
  if (p.traits.length) L.push("\u6027\u683C\u5173\u952E\u8BCD\uFF1A" + p.traits.join("\u3001"));
  if (bg.origin) L.push("\u51FA\u8EAB\uFF1A" + bg.origin);
  if (bg.experience) L.push("\u91CD\u8981\u7ECF\u5386\uFF1A" + bg.experience);
  if (bg.world) L.push("\u4E16\u754C\u89C2\u8BBE\u5B9A\uFF1A" + bg.world);
  if (spec.abilities.length) L.push("\u80FD\u529B\u4E0E\u7279\u957F\uFF1A" + spec.abilities.join("\u3001"));
  L.push("\u5BF9\u8BDD\u98CE\u683C\uFF1A" + d.style + "\uFF0C\u8BED\u6C14" + d.tone + "\uFF0C" + (d.person === "third" ? "\u7B2C\u4E09\u4EBA\u79F0\uFF08\u5979/\u4ED6\uFF09" : "\u7B2C\u4E00\u4EBA\u79F0\uFF08\u6211\uFF09"));
  if (sc.scene || sc.sceneTemplate) L.push("\u521D\u59CB\u573A\u666F\uFF1A" + (sc.scene || sc.sceneTemplate));
  L.push("\u5F00\u573A\u767D\u98CE\u683C\uFF1A" + (sc.openerStyle || "\u7B80\u77ED"));
  return L.join("\n");
}
function buildPrompt(spec) {
  const person = spec.dialogue.person === "third" ? "\u7B2C\u4E09\u4EBA\u79F0" : "\u7B2C\u4E00\u4EBA\u79F0";
  const scene = spec.scenario.scene || spec.scenario.sceneTemplate || "\u7531\u4F60\u6839\u636E\u89D2\u8272\u80CC\u666F\u8BBE\u8BA1\u4E00\u4E2A\u81EA\u7136\u7684\u5F00\u573A\u573A\u666F";
  return [
    "\u8BF7\u6839\u636E\u4E0B\u9762\u7684\u89D2\u8272\u8BBE\u5B9A\uFF0C\u64B0\u5199\u4E00\u5F20\u5B8C\u6574\u7684 SillyTavern \u89D2\u8272\u5361\u3002",
    "",
    "\u3010\u89D2\u8272\u8BBE\u5B9A\u3011",
    describeSpec(spec),
    "",
    "\u3010\u8F93\u51FA\u65B9\u5F0F\u3011",
    "\u8BF7\u8C03\u7528 emit_card \u5DE5\u5177\uFF0C\u628A\u5B8C\u6574\u7684\u89D2\u8272\u5361\u6570\u636E\u4F5C\u4E3A\u8BE5\u5DE5\u5177\u7684 JSON \u53C2\u6570\u8FD4\u56DE\uFF0C\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u5176\u4ED6\u6587\u5B57\u3002",
    "\u82E5\u65E0\u6CD5\u8C03\u7528\u5DE5\u5177\uFF0C\u5219\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5\u7684 JSON \u5BF9\u8C61\uFF08\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\u3001\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\uFF09\uFF0C\u5B57\u6BB5\u5982\u4E0B\uFF1A",
    "name\uFF08\u89D2\u8272\u540D\u79F0\uFF09\u3001description\uFF08\u89D2\u8272\u63CF\u8FF0\uFF0C\u6574\u5408\u5916\u8C8C/\u51FA\u8EAB/\u7ECF\u5386/\u4E16\u754C\u89C2\uFF0C\u4F7F\u7528 {{char}} \u6307\u4EE3\u89D2\u8272\u3001{{user}} \u6307\u4EE3\u7528\u6237\uFF09\u3001personality\uFF08\u6027\u683C\u63CF\u8FF0\uFF09\u3001scenario\uFF08\u521D\u59CB\u573A\u666F\uFF0C\u8BBE\u5B9A\u4E3A\uFF1A" + scene + "\uFF09\u3001first_mes\uFF08\u9996\u6761\u95EE\u5019\u8BED\uFF0C\u7528" + person + "\uFF09\u3001mes_example\uFF082-3 \u6BB5\u793A\u4F8B\u5BF9\u8BDD\uFF0C\u6BCF\u6BB5\u7528\u5355\u72EC\u4E00\u884C <START> \u5206\u9694\uFF09\u3001creator_notes\uFF08\u521B\u4F5C\u8005\u5907\u6CE8\uFF09\u3001system_prompt\uFF08\u7CFB\u7EDF\u7EA7\u884C\u4E3A\u6307\u4EE4\uFF0C\u4F7F\u7528 {{char}}/{{user}} \u5360\u4F4D\u7B26\uFF09\u3001alternate_greetings\uFF082 \u6761\u66FF\u4EE3\u95EE\u5019\u8BED\u7684\u5B57\u7B26\u4E32\u6570\u7EC4\uFF09\u3001tags\uFF083-6 \u4E2A\u6807\u7B7E\u7684\u5B57\u7B26\u4E32\u6570\u7EC4\uFF09\u3002",
    "",
    "\u8981\u6C42\uFF1A\u5185\u5BB9\u7CBE\u70BC\uFF0Cdescription \u63A7\u5236\u5728 600-1000 token \u91CF\u7EA7\u3002\u5168\u90E8\u7528\u4E2D\u6587\u64B0\u5199\uFF08\u89D2\u8272\u540D\u4E0E\u4E13\u6709\u540D\u8BCD\u53EF\u4FDD\u7559\u539F\u6587\uFF09\u3002"
  ].join("\n");
}
function buildWorldbookPrompt(spec, card) {
  const d = card?.data;
  let source;
  if (d && (d.name || d.description || d.personality || d.scenario)) {
    const L = [];
    if (d.name) L.push("\u89D2\u8272\u540D\u79F0\uFF1A" + d.name);
    if (d.description) L.push("\u89D2\u8272\u63CF\u8FF0\uFF1A" + d.description);
    if (d.personality) L.push("\u6027\u683C\uFF1A" + d.personality);
    if (d.scenario) L.push("\u573A\u666F\uFF1A" + d.scenario);
    source = L.join("\n");
  } else {
    source = describeSpec(spec);
  }
  return [
    "\u8BF7\u6839\u636E\u4E0B\u9762\u7684\u89D2\u8272\u4FE1\u606F\uFF0C\u4E3A SillyTavern \u751F\u6210\u4E00\u7EC4\u914D\u5957\u7684 World Book\uFF08\u4E16\u754C\u4E66\uFF09\u6761\u76EE\u3002",
    "",
    "\u3010\u89D2\u8272\u4FE1\u606F\u3011",
    source,
    "",
    "\u3010\u8F93\u51FA\u683C\u5F0F\u3011",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5\u7684 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u5305\u542B\u4EFB\u4F55\u89E3\u91CA\u6216 Markdown \u4EE3\u7801\u5757\u6807\u8BB0\u3002",
    'JSON \u5BF9\u8C61\u5F62\u5982\uFF1A{"entries":[{"keys":["\u5173\u952E\u8BCD1","\u5173\u952E\u8BCD2"],"content":"\u6761\u76EE\u5185\u5BB9","comment":"\u6761\u76EE\u8BF4\u660E"}]}',
    "\u8981\u6C42 5-10 \u4E2A\u6761\u76EE\uFF0C\u8986\u76D6\uFF1A\u89D2\u8272\u80CC\u666F\u5173\u952E\u4EBA\u7269/\u5730\u70B9\u3001\u4E16\u754C\u89C2\u6838\u5FC3\u8BBE\u5B9A\u3001\u91CD\u8981\u4E8B\u4EF6\u3002keys \u662F\u89E6\u53D1\u5173\u952E\u8BCD\u6570\u7EC4\uFF08\u4E2D\u6587\uFF09\uFF0Ccontent \u662F\u6761\u76EE\u6B63\u6587\uFF0Ccomment \u7B80\u77ED\u8BF4\u660E\u3002",
    "\u5168\u90E8\u7528\u4E2D\u6587\u64B0\u5199\u3002"
  ].join("\n");
}
function buildChatSystem(card, globalPrompt) {
  const d = card.data;
  const name2 = d.name || "\u89D2\u8272";
  const clean = (s) => String(s || "").split("{{char}}").join(name2).split("{{user}}").join("\u4F60");
  const parts = [];
  const g = (globalPrompt ?? "").trim();
  if (g) {
    parts.push("\u3010\u5168\u5C40\u6307\u4EE4\u3011");
    parts.push(clean(g));
  }
  parts.push("\u4F60\u6B63\u5728\u626E\u6F14\u89D2\u8272\u300C" + name2 + "\u300D\uFF0C\u8BF7\u5B8C\u5168\u4EE3\u5165\u8FD9\u4E2A\u89D2\u8272\uFF0C\u4EE5\u89D2\u8272\u7684\u89C6\u89D2\u4E0E\u7528\u6237\u8FDB\u884C\u6C89\u6D78\u5F0F\u89D2\u8272\u626E\u6F14\u3002");
  if (d.system_prompt) parts.push("\u3010\u884C\u4E3A\u6307\u4EE4\u3011\n" + clean(d.system_prompt));
  if (d.description) parts.push("\u3010\u89D2\u8272\u8BBE\u5B9A\u3011\n" + clean(d.description));
  if (d.personality) parts.push("\u3010\u6027\u683C\u3011\n" + clean(d.personality));
  if (d.scenario) parts.push("\u3010\u5F53\u524D\u573A\u666F\u3011\n" + clean(d.scenario));
  if (d.mes_example) parts.push("\u3010\u5BF9\u767D\u98CE\u683C\u793A\u4F8B\u3011\n" + clean(d.mes_example));
  parts.push("\u3010\u5BF9\u8BDD\u89C4\u5219\u3011");
  parts.push("1. \u59CB\u7EC8\u4EE5\u300C" + name2 + "\u300D\u7684\u8EAB\u4EFD\u3001\u53E3\u543B\u548C\u6027\u683C\u56DE\u5E94\uFF0C\u7EDD\u4E0D\u8DF3\u51FA\u89D2\u8272\uFF0C\u4E5F\u7EDD\u4E0D\u63D0\u53CA\u8FD9\u4E9B\u89C4\u5219\u3002");
  parts.push("2. \u53EA\u8F93\u51FA\u89D2\u8272\u7684\u5BF9\u767D\u4E0E\u52A8\u4F5C/\u795E\u6001\u63CF\u5199\uFF0C\u4E0D\u8981\u52A0\u4EFB\u4F55\u524D\u7F00\u3001\u6807\u7B7E\u3001\u5192\u53F7\u6216\u89E3\u91CA\uFF1B\u4E25\u7981\u8F93\u51FA {{char}}\u3001{{user}} \u4E4B\u7C7B\u7684\u5360\u4F4D\u7B26\u3002");
  parts.push("3. \u56DE\u590D\u81EA\u7136\u3001\u8D34\u5408\u89D2\u8272\uFF0C\u4E00\u822C 1-4 \u53E5\u8BDD\uFF0C\u907F\u514D\u957F\u7BC7\u5927\u8BBA\u3002");
  return parts.join("\n\n");
}
function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
function repairJson(text) {
  if (!text) return null;
  let t = String(text).replace(/\r\n?/g, "\n");
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
  }
  let fixed = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inString) {
      if (escaped) {
        fixed += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        fixed += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        fixed += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") {
        fixed += "\\n";
        continue;
      }
      if (ch === "	") {
        fixed += "\\t";
        continue;
      }
      fixed += ch;
    } else {
      if (ch === '"') {
        fixed += ch;
        inString = true;
        continue;
      }
      fixed += ch;
    }
  }
  try {
    return JSON.parse(fixed);
  } catch {
    return null;
  }
}
function parseResult(result) {
  if (result.toolCalls.length) {
    for (const tc of result.toolCalls) {
      const direct = (() => {
        try {
          return JSON.parse(tc.arguments);
        } catch {
          return null;
        }
      })();
      if (direct !== null) return direct;
      const repaired = repairJson(tc.arguments);
      if (repaired !== null) return repaired;
    }
  }
  return extractJson(result.text) ?? repairJson(result.text);
}
function wrapCard(data, version, spec) {
  const v = version === "v3" ? "3.0" : "2.0";
  const specKey = version === "v3" ? "chara_card_v3" : "chara_card_v2";
  const d = data ?? {};
  const str2 = (x) => typeof x === "string" ? x : "";
  const arr = (x) => Array.isArray(x) ? x.filter((i) => typeof i === "string") : [];
  return {
    spec: specKey,
    spec_version: v,
    data: {
      name: str2(d.name) || spec.basic.name || "\u672A\u547D\u540D\u89D2\u8272",
      description: str2(d.description),
      personality: str2(d.personality),
      scenario: str2(d.scenario),
      first_mes: str2(d.first_mes),
      mes_example: str2(d.mes_example),
      creator_notes: str2(d.creator_notes),
      system_prompt: str2(d.system_prompt),
      post_history_instructions: str2(d.post_history_instructions),
      alternate_greetings: arr(d.alternate_greetings),
      tags: arr(d.tags),
      creator: str2(d.creator) || "dsh-portable-tavern",
      character_version: str2(d.character_version) || "1.0",
      extensions: typeof d.extensions === "object" && d.extensions !== null ? d.extensions : {}
    }
  };
}
async function generateCard(ctx, spec, version, custom, sampling) {
  const prompt = buildPrompt(spec);
  let result;
  if (customReady(custom)) {
    result = await customWithPolicy(custom, { system: SYSTEM, messages: [{ role: "user", content: prompt }], temperature: 0.85, maxTokens: 3200 }, sampling);
    let data2 = parseResult(result);
    if (data2 === null) {
      const retryPrompt = prompt + "\n\n\u3010\u518D\u6B21\u5F3A\u8C03\u3011\u8BF7\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5\u7684 JSON \u5BF9\u8C61\u672C\u8EAB\uFF0C\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u3001\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\uFF1B\u5B57\u7B26\u4E32\u91CC\u7684\u6362\u884C\u5FC5\u987B\u7528 \\n \u8F6C\u4E49\u3002";
      result = await customWithPolicy(custom, { system: SYSTEM, messages: [{ role: "user", content: retryPrompt }], temperature: 0.3, maxTokens: 3200 }, sampling);
      data2 = parseResult(result);
    }
    return { card: wrapCard(data2, version, spec), rawText: result.text, fallback: data2 === null };
  }
  const route = await resolveRoute(ctx);
  const effort = await resolveEffort(ctx, route.provider, route.model, route.reasoningEffort);
  result = await dshWithPolicy(ctx, {
    provider: route.provider,
    model: route.model,
    reasoningEffort: effort,
    system: SYSTEM,
    messages: [mkMessage("user", prompt)],
    tools: [CARD_TOOL],
    temperature: 0.85,
    maxTokens: 8192
  }, sampling);
  let data = parseResult(result);
  if (!data) {
    const retryPrompt = prompt + "\n\n\u3010\u518D\u6B21\u5F3A\u8C03\u3011\u8BF7\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5\u7684 JSON \u5BF9\u8C61\u672C\u8EAB\uFF0C\u4E0D\u8981\u8C03\u7528\u5DE5\u5177\u3001\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u3001\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\uFF1B\u5B57\u7B26\u4E32\u91CC\u7684\u6362\u884C\u5FC5\u987B\u7528 \\n \u8F6C\u4E49\u3002";
    result = await dshWithPolicy(ctx, {
      provider: route.provider,
      model: route.model,
      reasoningEffort: ReasoningEffortId("off"),
      system: SYSTEM,
      messages: [mkMessage("user", retryPrompt)],
      temperature: 0.3,
      maxTokens: 8192
    }, sampling);
    data = parseResult(result);
  }
  const fallback = data === null;
  return { card: wrapCard(data, version, spec), rawText: result.text, fallback };
}
async function generateWorldbook(ctx, spec, card, custom, sampling) {
  const prompt = buildWorldbookPrompt(spec, card);
  let text;
  if (customReady(custom)) {
    text = (await customWithPolicy(custom, { system: SYSTEM, messages: [{ role: "user", content: prompt }], temperature: 0.7, maxTokens: 2200 }, sampling)).text;
  } else {
    const route = await resolveRoute(ctx);
    const effort = await resolveEffort(ctx, route.provider, route.model, route.reasoningEffort);
    text = (await dshWithPolicy(ctx, {
      provider: route.provider,
      model: route.model,
      reasoningEffort: effort,
      messages: [mkMessage("user", prompt)],
      system: SYSTEM,
      temperature: 0.7,
      maxTokens: 4096
    }, sampling)).text;
    if (text === "") {
      text = (await dshWithPolicy(ctx, {
        provider: route.provider,
        model: route.model,
        reasoningEffort: ReasoningEffortId("off"),
        messages: [mkMessage("user", prompt)],
        system: SYSTEM,
        temperature: 0.3,
        maxTokens: 4096
      }, sampling)).text;
    }
  }
  const parsed = extractJson(text) ?? repairJson(text);
  const entries = parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
  return { entries, rawText: text };
}
async function listModels(ctx) {
  const llm = ctx.llm;
  const providers = llm.listProviders();
  const options = [];
  for (const p of providers) {
    try {
      const models = await llm.listModels(p.id);
      if (models.length) {
        for (const m of models) options.push({ provider: p.id, model: m.id, label: (p.name || p.id) + " \xB7 " + (m.name || m.id) });
      } else {
        options.push({ provider: p.id, model: "", label: p.name || p.id });
      }
    } catch {
      options.push({ provider: p.id, model: "", label: p.name || p.id });
    }
  }
  let current = null;
  try {
    const route = await resolveRoute(ctx);
    current = { provider: route.provider, model: route.model };
  } catch {
  }
  return { options, current };
}
async function chatReply(ctx, card, messages, provider, model, globalPrompt, custom, sampling) {
  const system = buildChatSystem(card, globalPrompt);
  if (customReady(custom) && (provider === void 0 || provider === "" || provider === "custom")) {
    return (await customWithPolicy(custom, {
      system,
      messages: messages.map((m2) => ({ role: m2.role === "assistant" ? "assistant" : "user", content: m2.content })),
      temperature: 0.9,
      maxTokens: 600
    }, sampling)).text;
  }
  const route = await resolveRoute(ctx);
  const p = provider && model ? provider : route.provider;
  const m = provider && model ? model : route.model;
  const effort = await resolveEffort(ctx, p, m, route.reasoningEffort);
  const modelMessages = messages.map((msg) => mkMessage(msg.role === "assistant" ? "assistant" : "user", msg.content, p, m));
  return (await dshWithPolicy(ctx, {
    provider: p,
    model: m,
    reasoningEffort: effort,
    messages: modelMessages,
    system,
    temperature: 0.9,
    maxTokens: 1200
  }, sampling)).text;
}
async function routeCompletion(ctx, route, options) {
  const pin = typeof route.provider === "string" && route.provider !== "" && typeof route.model === "string" && route.model !== "";
  if (!pin && customReady(route.custom)) {
    return customWithPolicy(route.custom, {
      system: options.system,
      messages: options.messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      temperature: options.temperature,
      maxTokens: options.maxTokens
    }, route.sampling);
  }
  const fallback = await resolveRoute(ctx);
  const provider = pin ? String(route.provider) : fallback.provider;
  const model = pin ? String(route.model) : fallback.model;
  const effort = await resolveEffort(ctx, provider, model, fallback.reasoningEffort);
  return dshWithPolicy(ctx, {
    provider,
    model,
    reasoningEffort: effort,
    system: options.system,
    messages: options.messages.map((msg) => mkMessage(msg.role === "assistant" ? "assistant" : "user", msg.content, provider, model)),
    tools: options.tools,
    temperature: options.temperature,
    maxTokens: options.maxTokens
  }, route.sampling);
}
async function testCustom(custom, sampling) {
  const started = Date.now();
  const result = await customWithPolicy(custom, {
    messages: [{ role: "user", content: "\u8BF7\u53EA\u56DE\u590D\u4E24\u4E2A\u5B57\uFF1A\u8FDE\u63A5\u6210\u529F" }],
    temperature: 0,
    maxTokens: 20
  }, sampling);
  const learned2 = resolveTemperature(sampling, samplingKey("custom", custom.baseUrl, custom.model), 0);
  return {
    ok: true,
    latencyMs: Date.now() - started,
    reply: result.text.slice(0, 100),
    // Surfaced so the settings panel can show "this model pins temperature".
    temperature: learned2 === void 0 ? "\u4E0D\u53D1\u9001\uFF08\u6A21\u578B\u5DF2\u62D2\u7EDD\u8BE5\u5B57\u6BB5\uFF09" : String(learned2)
  };
}

// src/rpg/engine.ts
var ATTRS = [
  { id: "str", label: "\u529B\u91CF", short: "STR", blurb: "\u8FD1\u6218\u3001\u8D1F\u91CD\u3001\u86EE\u529B\u7834\u969C" },
  { id: "dex", label: "\u654F\u6377", short: "DEX", blurb: "\u95EA\u907F\u3001\u6F5C\u884C\u3001\u9003\u8DD1\u3001\u5148\u624B" },
  { id: "con", label: "\u4F53\u8D28", short: "CON", blurb: "\u6297\u6BD2\u3001\u8010\u75DB\u3001\u957F\u9014\u8DCB\u6D89" },
  { id: "int", label: "\u667A\u529B", short: "INT", blurb: "\u5B66\u8BC6\u3001\u89E3\u8C1C\u3001\u6CD5\u672F\u89E3\u6790" },
  { id: "wis", label: "\u611F\u77E5", short: "WIS", blurb: "\u5BDF\u89C9\u3001\u76F4\u89C9\u3001\u8FFD\u8E2A" },
  { id: "cha", label: "\u9B45\u529B", short: "CHA", blurb: "\u8BF4\u670D\u3001\u8C08\u5224\u3001\u5A01\u5413" }
];
function clamp2(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
function attrMod(score) {
  return clamp2(Math.round((Number(score) - 10) * 2), -30, 30);
}
function attrOf(actor, id) {
  return Number(actor.attributes[id] ?? 10);
}
var DIFFICULTY_LADDER = [
  { id: "trivial", label: "\u8F7B\u800C\u6613\u4E3E", value: 25 },
  { id: "easy", label: "\u8F7B\u677E", value: 40 },
  { id: "normal", label: "\u666E\u901A", value: 55 },
  { id: "hard", label: "\u56F0\u96BE", value: 70 },
  { id: "veryHard", label: "\u6781\u96BE", value: 82 },
  { id: "brutal", label: "\u4E5D\u6B7B\u4E00\u751F", value: 92 }
];
function snapDifficulty(value) {
  const v = clamp2(Math.round(Number(value) || 55), 5, 95);
  let best = DIFFICULTY_LADDER[2].value;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const step of DIFFICULTY_LADDER) {
    const gap = Math.abs(step.value - v);
    if (gap < bestGap) {
      bestGap = gap;
      best = step.value;
    }
  }
  return best;
}
function difficultyLabel(value) {
  const v = snapDifficulty(value);
  return (DIFFICULTY_LADDER.find((step) => step.value === v) ?? DIFFICULTY_LADDER[2]).label;
}
function skillBonus(actor, name2) {
  const wanted = String(name2 || "").trim().toLowerCase();
  if (wanted === "") return 0;
  let total = 0;
  for (const skill of actor.skills ?? []) {
    if (String(skill.name || "").trim().toLowerCase() === wanted) total += Number(skill.bonus) || 0;
  }
  return total;
}
function computeCheck(actor, option, context) {
  const breakdown = [];
  const base = snapDifficulty(option.difficulty);
  breakdown.push({ label: "\u60C5\u5883\u57FA\u7840\u96BE\u5EA6\uFF08" + difficultyLabel(base) + "\uFF09", value: base });
  const threat = clamp2(Number(context.threat) || 50, 0, 100);
  const threatAdj = Math.round((threat - 50) / 5);
  if (threatAdj !== 0) breakdown.push({ label: "\u5BF9\u624B\u5A01\u80C1\uFF08" + threat + "\uFF09", value: threatAdj });
  const optionMod = Number(option.modifier) || 0;
  if (optionMod !== 0) breakdown.push({ label: "\u884C\u52A8\u65B9\u5F0F\u4FEE\u6B63", value: optionMod });
  const situational = Number(context.penalty) || 0;
  if (situational !== 0) breakdown.push({ label: "\u73AF\u5883\u4E0E\u72B6\u6001\u4FEE\u6B63", value: situational });
  if (option.attribute !== "") {
    const score = attrOf(actor, option.attribute);
    const mod = attrMod(score);
    const meta = ATTRS.find((a) => a.id === option.attribute);
    breakdown.push({ label: (meta ? meta.label : option.attribute) + " " + score + " \u8C03\u6574", value: -mod });
  }
  const sb = skillBonus(actor, option.skill);
  if (sb !== 0) breakdown.push({ label: "\u6280\u80FD\xB7" + option.skill + " \u719F\u7EC3", value: -sb });
  const conditionPenalty = (actor.status ?? []).length * 3;
  if (conditionPenalty !== 0) breakdown.push({ label: "\u8D1F\u9762\u72B6\u6001 " + actor.status.length + " \u9879", value: conditionPenalty });
  const raw = breakdown.reduce((sum, row) => sum + row.value, 0);
  const required = clamp2(Math.round(raw), 5, 95);
  if (required !== Math.round(raw)) breakdown.push({ label: "\u5224\u5B9A\u4E0A\u9650\u622A\u65AD", value: required - Math.round(raw) });
  return {
    actorId: actor.id,
    actorName: actor.name,
    optionId: option.id,
    optionLabel: option.label,
    required,
    breakdown,
    difficultyLabel: difficultyLabel(base)
  };
}
var BANDS = [
  {
    id: "triumph",
    label: "\u5927\u6210\u529F",
    min: 50,
    success: true,
    grade: "clean",
    brief: "\u5B8C\u6210\u5F97\u5E72\u51C0\u5229\u843D\u4E14\u8D85\u51FA\u9884\u671F\uFF1A\u4E0D\u4EC5\u8FBE\u6210\u4E86\u76EE\u6807\uFF0C\u8FD8\u989D\u5916\u5360\u5230\u4FBF\u5B9C\uFF08\u591A\u8DD1\u51FA\u4E00\u5927\u6BB5\u3001\u987A\u52BF\u53CD\u5236\u3001\u53D1\u73B0\u6709\u5229\u5730\u5F62\uFF09\u3002"
  },
  {
    id: "success",
    label: "\u6210\u529F",
    min: 20,
    success: true,
    grade: "clean",
    brief: "\u987A\u5229\u8FBE\u6210\u76EE\u6807\uFF0C\u8FC7\u7A0B\u6CA1\u6709\u660E\u663E\u4EE3\u4EF7\uFF0C\u53EF\u4EE5\u5199\u5F97\u4ECE\u5BB9\u4E00\u4E9B\u3002"
  },
  {
    id: "costly",
    label: "\u9669\u80DC",
    min: 1,
    success: true,
    grade: "narrow",
    brief: "\u52C9\u5F3A\u8FBE\u6210\uFF0C\u800C\u4E14\u4ED8\u51FA\u4E86\u5C0F\u4EE3\u4EF7\uFF08\u64E6\u4F24\u3001\u6389\u843D\u7269\u54C1\u3001\u60CA\u52A8\u65C1\u4EBA\u3001\u4F53\u80FD\u900F\u652F\uFF09\uFF0C\u8981\u5199\u51FA\u5343\u94A7\u4E00\u53D1\u7684\u611F\u89C9\u3002"
  },
  {
    id: "narrow",
    label: "\u6781\u9650\u6210\u529F",
    min: 0,
    success: true,
    grade: "narrow",
    brief: "\u6070\u597D\u5728\u6700\u540E\u4E00\u77AC\u8FBE\u6210\uFF0C\u6210\u8D25\u53EA\u9694\u4E00\u7EBF\uFF1B\u8981\u5199\u51FA\u51E0\u4E4E\u5931\u8D25\u53C8\u88AB\u62C9\u56DE\u6765\u7684\u7D27\u5F20\u611F\u3002"
  },
  {
    id: "hair",
    label: "\u5DEE\u4E00\u70B9",
    min: -19,
    success: false,
    grade: "narrow",
    brief: "\u529F\u4E8F\u4E00\u7BD1\uFF1A\u52A8\u4F5C\u4E00\u5EA6\u594F\u6548\u3001\u773C\u770B\u5C31\u8981\u6210\u529F\uFF0C\u5374\u5728\u6700\u540E\u5173\u5934\u88AB\u6273\u4E86\u56DE\u6765\uFF0C\u5E76\u4E14\u7559\u4E0B\u8F7B\u5FAE\u53CD\u566C\uFF08\u66B4\u9732\u4F4D\u7F6E\u3001\u88AB\u8FFD\u4E0A\u3001\u5931\u53BB\u5148\u624B\uFF09\u3002"
  },
  {
    id: "fail",
    label: "\u5931\u8D25",
    min: -49,
    success: false,
    grade: "clean",
    brief: "\u660E\u786E\u5931\u8D25\uFF0C\u76EE\u6807\u6CA1\u6709\u8FBE\u6210\uFF0C\u5904\u5883\u660E\u663E\u53D8\u5DEE\uFF1B\u5DEE\u8DDD\u8D8A\u5927\u8D8A\u53EF\u4EE5\u5199\u51FA\u5177\u4F53\u7684\u5931\u624B\uFF08\u811A\u4E0B\u4E00\u6ED1\u3001\u624B\u6CA1\u6293\u7A33\u3001\u88AB\u7ECA\u4F4F\u3001\u5224\u65AD\u5931\u8BEF\uFF09\uFF0C\u4F46\u4E0D\u8981\u5199\u6210\u5F7B\u5E95\u51FA\u5C40\u3002"
  },
  {
    id: "disaster",
    label: "\u60E8\u8D25",
    min: Number.NEGATIVE_INFINITY,
    success: false,
    grade: "clean",
    brief: "\u707E\u96BE\u6027\u5931\u8D25\uFF1A\u8FC7\u7A0B\u4E2D\u51FA\u73B0\u4E25\u91CD\u5931\u8BEF\uFF08\u6454\u5012\u3001\u8131\u624B\u3001\u5224\u65AD\u5931\u8BEF\uFF09\uFF0C\u89D2\u8272\u53D7\u4F24\u5E76\u7ACB\u523B\u9677\u5165\u66F4\u5371\u9669\u7684\u5904\u5883\u3002"
  }
];
function bandOf(margin) {
  for (const band of BANDS) {
    if (margin >= band.min) return band;
  }
  return BANDS[BANDS.length - 1];
}
function effectsFor(kind, band, margin, threat) {
  const danger = clamp2(Number(threat) || 50, 0, 100);
  const severity = band.id === "disaster" ? 3 : band.id === "fail" ? 2 : band.id === "hair" ? 1 : 0;
  const physical = kind === "combat" || kind === "chase" ? 1 : 0.5;
  const gap = Math.max(0, -margin);
  const depth = 1 + Math.min(1.2, Math.max(0, gap - 20) / 50);
  const hpLoss = Math.min(20, Math.round(severity * physical * (1 + danger / 25) * depth));
  const over = Math.max(0, margin);
  const addStatus = [];
  if (band.id === "disaster") {
    addStatus.push(kind === "chase" ? "\u5012\u5730" : "\u91CD\u4F24");
  } else if (band.id === "fail") {
    addStatus.push(kind === "chase" ? "\u88AB\u8FFD\u51FB" : "\u53D7\u521B");
  } else if (band.id === "hair") {
    addStatus.push("\u66B4\u9732");
  } else if (band.id === "costly" && over < 10) {
    addStatus.push("\u75B2\u60EB");
  }
  const removeStatus = [];
  if (band.success) {
    for (const s of ["\u88AB\u8FFD\u51FB", "\u66B4\u9732", "\u5012\u5730"]) removeStatus.push(s);
  }
  return {
    hpLoss: Math.max(0, hpLoss),
    addStatus,
    removeStatus,
    endsEncounter: band.success || band.id === "disaster"
  };
}
function distanceWording(delta) {
  const gap = Math.abs(delta);
  if (gap === 0) return "\u6070\u597D\u5361\u5728\u7EBF\u4E0A";
  if (gap === 1) return "\u53EA\u5DEE 1 \u70B9\uFF0C\u51E0\u4E4E\u53EF\u4EE5\u5FFD\u7565\u7684\u4E00\u7EBF\u4E4B\u5DEE";
  if (gap <= 5) return "\u53EA\u5DEE " + gap + " \u70B9\uFF0C\u6BEB\u5398\u4E4B\u95F4";
  if (gap <= 19) return "\u5DEE " + gap + " \u70B9\uFF0C\u5DEE\u8DDD\u4E0D\u5927\u4F46\u5F88\u660E\u786E";
  if (gap <= 49) return "\u5DEE " + gap + " \u70B9\uFF0C\u5DEE\u8DDD\u76F8\u5F53\u660E\u663E";
  return "\u5DEE " + gap + " \u70B9\uFF0C\u5DEE\u8DDD\u60AC\u6B8A";
}
var CRIT_LOW = 5;
var CRIT_HIGH = 96;
function judge(computed, roll, kind, threat, critEnabled = true) {
  const rolled = clamp2(Math.round(roll), 1, 100);
  const margin = rolled - computed.required;
  let band = bandOf(margin);
  let critical = "none";
  if (critEnabled && rolled >= CRIT_HIGH) {
    critical = "success";
    band = BANDS[0];
  } else if (critEnabled && rolled <= CRIT_LOW) {
    critical = "failure";
    band = BANDS[BANDS.length - 1];
  }
  const effects = effectsFor(kind, band, margin, threat);
  if (critical === "success") effects.hpLoss = 0;
  const directive = buildDirective(computed, rolled, margin, band, critical, effects);
  return {
    roll: rolled,
    required: computed.required,
    margin,
    band: band.id,
    bandLabel: band.label,
    success: band.success,
    critical,
    directive,
    effects,
    breakdown: computed.breakdown
  };
}
function buildDirective(computed, roll, margin, band, critical, effects) {
  const lines = [];
  lines.push("\u3010\u7CFB\u7EDF\u5224\u5B9A \xB7 \u5DF2\u751F\u6548\uFF0C\u4E0D\u53EF\u66F4\u6539\u3011");
  lines.push("\u884C\u52A8\uFF1A" + computed.actorName + " \u9009\u62E9\u300C" + computed.optionLabel + "\u300D\u3002");
  lines.push("\u9700\u8981\u63B7\u51FA\uFF1A" + computed.required + "\uFF08" + computed.difficultyLabel + "\uFF09\u3002\u5B9E\u9645\u63B7\u51FA\uFF1A" + roll + "\u3002");
  if (critical === "success") lines.push("\u81EA\u7136\u9AB0 " + roll + " \u89E6\u53D1\u5927\u6210\u529F\u3002");
  if (critical === "failure") lines.push("\u81EA\u7136\u9AB0 " + roll + " \u89E6\u53D1\u5927\u5931\u8D25\u3002");
  lines.push("\u7ED3\u679C\uFF1A" + band.label + "\uFF08" + (band.success ? "\u6210\u529F" : "\u5931\u8D25") + "\uFF0C" + distanceWording(margin) + "\uFF09\u3002");
  lines.push("\u53D9\u8FF0\u8981\u6C42\uFF1A" + band.brief);
  if (effects.hpLoss > 0) lines.push("\u673A\u68B0\u540E\u679C\uFF08\u5DF2\u7531\u7CFB\u7EDF\u7ED3\u7B97\uFF09\uFF1A\u635F\u5931 " + effects.hpLoss + " \u70B9\u751F\u547D\u3002");
  if (effects.addStatus.length > 0) lines.push("\u673A\u68B0\u540E\u679C\uFF08\u5DF2\u7531\u7CFB\u7EDF\u7ED3\u7B97\uFF09\uFF1A\u83B7\u5F97\u72B6\u6001\u300C" + effects.addStatus.join("\u3001") + "\u300D\u3002");
  if (effects.removeStatus.length > 0) lines.push("\u673A\u68B0\u540E\u679C\uFF08\u5DF2\u7531\u7CFB\u7EDF\u7ED3\u7B97\uFF09\uFF1A\u89E3\u9664\u72B6\u6001\u300C" + effects.removeStatus.join("\u3001") + "\u300D\u3002");
  lines.push("\u786C\u6027\u7EA6\u675F\uFF1A\u5224\u5B9A\u7ED3\u679C\u7531\u7CFB\u7EDF\u7ED9\u51FA\uFF0C\u4F60\u53EA\u80FD\u63CF\u5199\u5B83\u5982\u4F55\u53D1\u751F\uFF1B\u4E0D\u5F97\u6539\u53D8\u6210\u529F\u6216\u5931\u8D25\uFF0C\u4E0D\u5F97\u634F\u9020\u4E0E\u4E0A\u9762\u6570\u5B57\u77DB\u76FE\u7684\u7ED3\u5C40\uFF0C\u4E5F\u4E0D\u8981\u5411\u73A9\u5BB6\u590D\u8FF0\u8FD9\u4E9B\u6570\u5B57\u3002");
  return lines.join("\n");
}
function actorSummary(actor) {
  const parts = [];
  parts.push(actor.name);
  parts.push("HP " + actor.hp + "/" + actor.maxHp);
  for (const meta of ATTRS) parts.push(meta.short + " " + attrOf(actor, meta.id));
  if ((actor.status ?? []).length > 0) parts.push("\u72B6\u6001\uFF1A" + actor.status.join("\u3001"));
  if ((actor.skills ?? []).length > 0) parts.push("\u64C5\u957F\uFF1A" + actor.skills.map((s) => s.name + (s.bonus ? "+" + s.bonus : "")).join("\u3001"));
  return parts.join("\uFF5C");
}

// src/rpg/outline.ts
function contains(haystack, needle) {
  const n = String(needle ?? "").trim().toLowerCase();
  if (n === "") return false;
  return String(haystack ?? "").toLowerCase().includes(n);
}
function evaluateTrigger(trigger, ctx) {
  const kind = trigger?.kind ?? "always";
  switch (kind) {
    case "always":
      return { fired: true, reason: "\u7ACB\u5373\u89E6\u53D1" };
    case "turn": {
      const at = Math.max(1, Math.round(Number(trigger.turn) || 1));
      return { fired: ctx.turn >= at, reason: "\u7B2C " + ctx.turn + " \u56DE\u5408\uFF08\u6761\u4EF6\uFF1A\u2265" + at + "\uFF09" };
    }
    case "band": {
      const wanted = trigger.band;
      if (wanted === void 0 || ctx.lastResult === null) return { fired: false, reason: "\u8FD8\u6CA1\u6709\u5224\u5B9A\u7ED3\u679C" };
      return { fired: ctx.lastResult.band === wanted, reason: "\u6700\u8FD1\u5224\u5B9A\u4E3A " + ctx.lastResult.band };
    }
    case "encounter": {
      const wanted = String(trigger.encounterKind ?? "").trim();
      if (wanted === "" || ctx.encounterKind === null) return { fired: false, reason: "\u5F53\u524D\u6CA1\u6709\u906D\u9047" };
      return { fired: ctx.encounterKind === wanted, reason: "\u906D\u9047\u7C7B\u578B " + ctx.encounterKind };
    }
    case "hp": {
      const ratio = Math.min(1, Math.max(0, Number(trigger.hpBelow ?? 0.3)));
      const hurt = ctx.party.find((m) => m.maxHp > 0 && m.hp / m.maxHp < ratio);
      if (hurt === void 0) return { fired: false, reason: "\u65E0\u4EBA\u4F4E\u4E8E " + Math.round(ratio * 100) + "%" };
      return { fired: true, reason: hurt.name + " \u8840\u91CF " + hurt.hp + "/" + hurt.maxHp };
    }
    case "action":
      return { fired: contains(ctx.action, trigger.keyword), reason: "\u884C\u52A8\u5173\u952E\u8BCD\u300C" + String(trigger.keyword ?? "") + "\u300D" };
    case "fact":
      return {
        fired: ctx.facts.some((f) => contains(f, trigger.factKeyword)),
        reason: "\u4E8B\u5B9E\u5173\u952E\u8BCD\u300C" + String(trigger.factKeyword ?? "") + "\u300D"
      };
    case "success": {
      const n = Math.max(1, Math.round(Number(trigger.streak) || 1));
      return { fired: ctx.streak >= n, reason: "\u8FDE\u7EED\u6210\u529F " + ctx.streak + " \u6B21\uFF08\u6761\u4EF6\uFF1A\u2265" + n + "\uFF09" };
    }
    case "failure": {
      const n = Math.max(1, Math.round(Number(trigger.streak) || 1));
      return { fired: ctx.streak <= -n, reason: "\u8FDE\u7EED\u5931\u8D25 " + Math.abs(ctx.streak) + " \u6B21\uFF08\u6761\u4EF6\uFF1A\u2265" + n + "\uFF09" };
    }
    default:
      return { fired: false, reason: "\u672A\u77E5\u89E6\u53D1\u6761\u4EF6" };
  }
}
function runOutline(beats, ctx) {
  const fired = [];
  const retired = [];
  for (const beat of beats ?? []) {
    if (beat.fired && beat.once) continue;
    const verdict = evaluateTrigger(beat.trigger, ctx);
    if (!verdict.fired) continue;
    if (String(beat.event ?? "").trim() === "") {
      retired.push(beat.id);
      continue;
    }
    fired.push({ id: beat.id, title: beat.title, event: beat.event, reason: verdict.reason });
    if (beat.once) retired.push(beat.id);
  }
  return { fired, retired };
}

// src/rpg/gm.ts
var ATTR_IDS = ["str", "dex", "con", "int", "wis", "cha"];
var KINDS = ["combat", "chase", "social", "environment", "other"];
var GM_SYSTEM = [
  "\u4F60\u662F\u300C\u4FBF\u643A\u9152\u9986\u300D\u8DD1\u56E2\u6A21\u5F0F\u7684\u5B88\u79D8\u4EBA\uFF08GM\uFF09\u3002\u4F60\u8D1F\u8D23\u4E16\u754C\u3001NPC\u3001\u5267\u60C5\u63A8\u8FDB\u4E0E\u53D9\u8FF0\u3002",
  "",
  "\u3010\u94C1\u5F8B\uFF1A\u5224\u5B9A\u6743\u4E0D\u5C5E\u4E8E\u4F60\u3011",
  '\u63B7\u9AB0\u3001\u96BE\u5EA6\u3001\u5C5E\u6027\u52A0\u6210\u3001\u6210\u529F\u4E0E\u5931\u8D25\uFF0C\u5168\u90E8\u7531\u7CFB\u7EDF\u8BA1\u7B97\u4E0E\u88C1\u5B9A\u3002\u4F60\u7EDD\u5BF9\u4E0D\u80FD\u81EA\u884C\u51B3\u5B9A\u67D0\u4E2A\u884C\u52A8\u6210\u529F\u8FD8\u662F\u5931\u8D25\uFF0C\u4E5F\u4E0D\u8981\u5199\u51FA"\u4F60\u6210\u529F\u4E86/\u4F60\u5931\u8D25\u4E86"\u8FD9\u7C7B\u7ED3\u8BBA\u2014\u2014\u90A3\u662F\u7CFB\u7EDF\u7684\u804C\u8D23\u3002',
  "\u5F53\u4F60\u8BA4\u4E3A\u4E00\u4E2A\u884C\u52A8\u7684\u7ED3\u679C\u4E0D\u786E\u5B9A\u3001\u4E14\u540E\u679C\u91CD\u8981\u65F6\uFF0C\u8C03\u7528 gm_turn \u5DE5\u5177\u5E76\u63D0\u51FA check \u6216 encounter\uFF0C\u628A\u88C1\u51B3\u4EA4\u7ED9\u7CFB\u7EDF\u3002",
  "\u5F53\u6D88\u606F\u91CC\u51FA\u73B0\u3010\u7CFB\u7EDF\u5224\u5B9A\u3011\u533A\u5757\u65F6\uFF0C\u8BF4\u660E\u7CFB\u7EDF\u5DF2\u7ECF\u88C1\u5B9A\u5B8C\u6BD5\uFF1A\u4F60\u53EA\u80FD\u63CF\u5199\u5B83\u5982\u4F55\u53D1\u751F\uFF0C\u4E0D\u5F97\u63A8\u7FFB\u3001\u4E0D\u5F97\u66F4\u6539\u6210\u8D25\u3001\u4E5F\u4E0D\u8981\u628A\u6570\u5B57\u5FF5\u7ED9\u73A9\u5BB6\u542C\u3002",
  "",
  "\u3010\u4F60\u53EA\u9700\u8981\u4EA7\u51FA\u4E24\u6837\u4E1C\u897F\u3011",
  "\u4E00\u662F\u53D9\u8FF0\uFF08narration\uFF09\uFF0C\u4E8C\u662F\u9700\u8981\u7CFB\u7EDF\u4EF2\u88C1\u7684\u884C\u52A8\u8BF7\u6C42\u3002\u8BF7\u6C42\u6709\u4E24\u79CD\u5F62\u6001\uFF1A",
  '1. check \u2014\u2014 \u73A9\u5BB6\u5728\u8FD9\u4E00\u56DE\u5408\u58F0\u660E\u4E86\u4E00\u4E2A\u5177\u4F53\u884C\u52A8\uFF08"\u6211\u7FFB\u7A97\u9003\u51FA\u53BB"\uFF09\uFF0C\u9700\u8981\u7ACB\u523B\u5224\u5B9A\uFF0C\u800C\u4E14**\u6CA1\u6709\u522B\u7684\u5408\u7406\u9009\u62E9**\u3002\u586B check\uFF0C\u7ED9\u51FA\u8FD9\u4E2A\u884C\u52A8\u9760\u54EA\u4E2A\u5C5E\u6027\u3001\u54EA\u9879\u6280\u80FD\u3001\u57FA\u7840\u96BE\u5EA6\u591A\u5C11\u3001\u6709\u6CA1\u6709\u60C5\u666F\u4FEE\u6B63\u3002\u7CFB\u7EDF\u4F1A\u7ACB\u523B\u7B97\u51FA"\u81F3\u5C11\u8981\u63B7\u51FA\u591A\u5C11"\uFF0C\u73A9\u5BB6\u63B7\u9AB0\u540E\u4F60\u518D\u53D9\u8FF0\u7ED3\u679C\u3002',
  "2. encounter \u2014\u2014 \u9700\u8981\u73A9\u5BB6\u505A\u9009\u62E9\u65F6\u586B\u8FD9\u4E2A\u3002\u7ED9\u51FA 2 \u5230 4 \u4E2A\u53EF\u9009\u884C\u52A8\uFF08\u6218\u6597 / \u9003\u8DD1 / \u4EA4\u6D89 / \u89C2\u5BDF \u2026\uFF09\uFF0C\u6BCF\u4E2A\u9009\u9879\u90FD\u8981\u5E26\u4E0A\u5224\u5B9A\u6240\u9700\u7684\u5B57\u6BB5\u3002\u7CFB\u7EDF\u4F1A\u4E3A\u6BCF\u4E2A\u9009\u9879\u7B97\u51FA\u9700\u8981\u7684\u63B7\u9AB0\u6570\uFF0C\u73A9\u5BB6\u9009\u4E00\u4E2A\u518D\u63B7\u3002",
  "3. \u53EA\u662F\u63A8\u8FDB\u53D9\u8FF0\u3001\u4E0D\u9700\u8981\u4EFB\u4F55\u5224\u5B9A\u65F6\uFF0C\u4E24\u8005\u90FD\u7559\u7A7A\u3002",
  "",
  "\u3010\u4EC0\u4E48\u65F6\u5019\u5FC5\u987B\u586B encounter\uFF08\u91CD\u8981\uFF09\u3011",
  "\u51FA\u73B0\u4E0B\u9762\u4EFB\u4F55\u4E00\u79CD\u60C5\u51B5\uFF0C**\u4E00\u5F8B\u586B encounter\uFF0C\u4E0D\u8981\u586B check**\uFF1A",
  '- \u4E00\u4E2A\u65B0\u7684\u5A01\u80C1\u767B\u573A\uFF1A\u602A\u7269\u3001\u8FFD\u5175\u3001\u654C\u610F NPC\u3001\u9677\u9631\u3001\u5929\u707E\u3002\u6B64\u65F6\u81F3\u5C11\u8981\u6709"\u6B63\u9762\u5BF9\u6297"\u548C"\u56DE\u907F/\u9003\u8DD1"\u4E24\u7C7B\u9009\u9879\uFF0C\u8BA9\u73A9\u5BB6\u81EA\u5DF1\u51B3\u5B9A\u6253\u8FD8\u662F\u8DD1\u3002',
  "- \u73A9\u5BB6\u9762\u524D\u51FA\u73B0\u591A\u6761\u8DEF\uFF0C\u4E14\u5404\u6761\u8DEF\u4EE3\u4EF7\u4E0D\u540C\uFF08\u7ED5\u8FDC\u4F46\u5B89\u5168 / \u76F4\u7A7F\u4F46\u5371\u9669 / \u56DE\u5934\uFF09\u3002",
  "- \u9700\u8981\u8BF4\u670D\u3001\u6B3A\u9A97\u6216\u8D3F\u8D42\u4E00\u4E2A NPC\uFF0C\u800C\u8FD9\u51E0\u79CD\u505A\u6CD5\u540E\u679C\u4E0D\u540C\u3002",
  '\u6362\u53E5\u8BDD\u8BF4\uFF1A\u53EA\u8981\u73A9\u5BB6"\u53EF\u4EE5\u600E\u4E48\u9009"\u672C\u8EAB\u662F\u8FD9\u573A\u620F\u7684\u91CD\u70B9\uFF0C\u5C31\u7528 encounter \u628A\u9009\u62E9\u6743\u4EA4\u8FD8\u7ED9\u4ED6\uFF0C\u800C\u4E0D\u662F\u66FF\u4ED6\u51B3\u5B9A\u3002',
  "\u53EA\u6709\u5F53\u73A9\u5BB6\u521A\u521A\u4EB2\u53E3\u5BA3\u544A\u4E86\u8981\u505A\u4EC0\u4E48\u3001\u4E14\u6CA1\u6709\u522B\u7684\u5408\u7406\u9009\u9879\u65F6\uFF0C\u624D\u7528 check\u3002",
  "",
  "\u3010\u6570\u503C\u7EA6\u5B9A\u3011",
  'difficulty \u662F"\u4E0D\u8003\u8651\u89D2\u8272\u80FD\u529B\u65F6\uFF0C\u8FD9\u4EF6\u4E8B\u672C\u8EAB\u6709\u591A\u96BE"\uFF0C\u8BF7\u4ECE\u8FD9\u4E9B\u951A\u70B9\u91CC\u6311\u6700\u8D34\u8FD1\u7684\uFF1A25 \u8F7B\u800C\u6613\u4E3E / 40 \u8F7B\u677E / 55 \u666E\u901A / 70 \u56F0\u96BE / 82 \u6781\u96BE / 92 \u4E5D\u6B7B\u4E00\u751F\u3002',
  "modifier \u662F\u60C5\u666F\u4FEE\u6B63\uFF0C\u6B63\u6570\u4EE3\u8868\u66F4\u96BE\uFF0C\u4E00\u822C\u53D6 -20 \u5230 +20 \u4E4B\u95F4\u7684\u5C0F\u503C\uFF0C\u6CA1\u6709\u5C31\u586B 0\u3002",
  "threat \u662F\u5BF9\u624B\u5F3A\u5EA6\uFF0C0 \u5230 100\uFF0C50 \u662F\u52BF\u5747\u529B\u654C\u3002",
  "attribute \u53EA\u80FD\u662F str / dex / con / int / wis / cha\uFF0C\u5206\u522B\u5BF9\u5E94\u529B\u91CF / \u654F\u6377 / \u4F53\u8D28 / \u667A\u529B / \u611F\u77E5 / \u9B45\u529B\u3002\u7EAF\u7CB9\u9760\u8FD0\u6C14\u7684\u4E8B\u5C31\u586B\u7A7A\u5B57\u7B26\u4E32\u3002",
  "skill \u586B\u4E00\u9879\u5177\u4F53\u6280\u80FD\u540D\uFF08\u4F8B\u5982 \u6F5C\u884C\u3001\u8BF4\u670D\u3001\u6500\u722C\uFF09\uFF0C\u89D2\u8272\u6070\u597D\u4F1A\u5C31\u52A0\u6210\u3001\u4E0D\u4F1A\u4E5F\u6CA1\u5173\u7CFB\uFF0C\u7559\u7A7A\u4E5F\u53EF\u4EE5\u3002",
  "",
  "\u3010\u53D9\u8FF0\u98CE\u683C\u3011",
  "\u7B2C\u4E8C\u4EBA\u79F0\uFF0C\u5199\u73A9\u5BB6\u770B\u5230\u3001\u542C\u5230\u3001\u95FB\u5230\u7684\u4E1C\u897F\uFF1B\u8282\u594F\u7D27\u51D1\uFF0C\u4E00\u6B21\u53EA\u63A8\u8FDB\u4E00\u5C0F\u6B65\uFF0C\u4E0D\u8981\u4E00\u53E3\u6C14\u5199\u5B8C\u4E00\u6574\u6BB5\u5192\u9669\u3002",
  "\u4E0D\u8981\u66FF\u73A9\u5BB6\u505A\u51B3\u5B9A\uFF0C\u4E0D\u8981\u66FF\u73A9\u5BB6\u8BF4\u8BDD\uFF0C\u4E0D\u8981\u4EE3\u66FF\u73A9\u5BB6\u9009\u62E9\u9009\u9879\u3002\u957F\u5EA6\u63A7\u5236\u5728 250 \u5230 450 \u5B57\u3002",
  "\u5168\u7A0B\u4F7F\u7528\u4E2D\u6587\u3002"
].join("\n");
var OPTION_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string", description: "\u6309\u94AE\u6587\u5B57\uFF0C2-6 \u4E2A\u5B57\uFF0C\u4F8B\u5982 \u6218\u6597 / \u9003\u8DD1 / \u4EA4\u6D89" },
    attribute: { type: "string", enum: [...ATTR_IDS, ""], description: "\u8FD9\u6B21\u5C1D\u8BD5\u4F9D\u9760\u7684\u5C5E\u6027\uFF1B\u7EAF\u8FD0\u6C14\u586B\u7A7A\u5B57\u7B26\u4E32" },
    skill: { type: "string", description: "\u76F8\u5173\u6280\u80FD\u540D\uFF0C\u53EF\u7559\u7A7A" },
    difficulty: { type: "number", description: "\u60C5\u5883\u57FA\u7840\u96BE\u5EA6\uFF0C\u4ECE 25/40/55/70/82/92 \u4E2D\u6311\u9009" },
    modifier: { type: "number", description: "\u60C5\u666F\u4FEE\u6B63\uFF0C\u6B63\u6570\u66F4\u96BE\uFF0C\u901A\u5E38 -20..20" },
    hint: { type: "string", description: "\u4E00\u53E5\u8BDD\u8BF4\u660E\u8FD9\u4E2A\u9009\u9879\u7684\u98CE\u9669\u4E0E\u6536\u76CA" }
  },
  required: ["label", "attribute", "difficulty"]
};
var GM_TURN_TOOL = {
  name: "gm_turn",
  description: "\u63D0\u4EA4\u672C\u56DE\u5408\u7684\u53D9\u8FF0\uFF1B\u5F53\u884C\u52A8\u9700\u8981\u5224\u5B9A\u65F6\uFF0C\u7ED9\u51FA\u7CFB\u7EDF\u8981\u4EF2\u88C1\u7684 check \u6216 encounter",
  parameters: {
    type: "object",
    properties: {
      narration: { type: "string", description: "\u672C\u56DE\u5408\u53D9\u8FF0\u6B63\u6587\uFF0C\u7B2C\u4E8C\u4EBA\u79F0\uFF0C250-450 \u5B57" },
      scene: { type: "string", description: '\u7528\u4E00\u6BB5\u8BDD\u66F4\u65B0"\u5F53\u524D\u573A\u666F"\u6458\u8981\uFF0C\u4F9B\u540E\u7EED\u56DE\u5408\u590D\u7528' },
      facts: {
        type: "array",
        items: { type: "string" },
        description: "\u672C\u56DE\u5408\u65B0\u786E\u7ACB\u3001\u540E\u7EED\u5FC5\u987B\u4FDD\u6301\u4E00\u81F4\u7684\u4E8B\u5B9E\uFF08\u4EBA\u7269\u3001\u5730\u70B9\u3001\u4F0F\u7B14\u3001\u627F\u8BFA\uFF09\u3002\u6CA1\u6709\u5C31\u8FD4\u56DE\u7A7A\u6570\u7EC4"
      },
      check: {
        ...OPTION_SCHEMA,
        description: "\u5F53\u73A9\u5BB6\u672C\u56DE\u5408\u58F0\u660E\u7684\u884C\u52A8\u9700\u8981\u7ACB\u523B\u5224\u5B9A\u65F6\u586B\u5199\uFF1B\u5426\u5219\u4E0D\u8981\u5305\u542B\u8BE5\u5B57\u6BB5"
      },
      checkKind: { type: "string", enum: KINDS, description: "check \u6240\u5C5E\u7684\u906D\u9047\u7C7B\u578B\uFF0C\u7528\u4E8E\u7ED3\u7B97\u540E\u679C" },
      checkThreat: { type: "number", description: "check \u7684\u5BF9\u624B\u5F3A\u5EA6 0-100" },
      encounter: {
        type: "object",
        description: "\u5F53\u5267\u60C5\u9700\u8981\u73A9\u5BB6\u6289\u62E9\u65F6\u586B\u5199\uFF1B\u5426\u5219\u4E0D\u8981\u5305\u542B\u8BE5\u5B57\u6BB5",
        properties: {
          kind: { type: "string", enum: KINDS, description: "\u906D\u9047\u7C7B\u578B" },
          title: { type: "string", description: "\u906D\u9047\u6807\u9898\uFF0C\u4F8B\u5982 \u8150\u6CBC\u6F5C\u4F0F\u8005" },
          description: { type: "string", description: "\u4E00\u4E24\u53E5\u8BDD\u8BF4\u660E\u773C\u524D\u7684\u5904\u5883\u4E0E\u5229\u5BB3" },
          threat: { type: "number", description: "\u5BF9\u624B\u5F3A\u5EA6 0-100" },
          options: { type: "array", items: OPTION_SCHEMA, description: "2-4 \u4E2A\u53EF\u9009\u884C\u52A8" }
        },
        required: ["kind", "title", "options"]
      }
    },
    required: ["narration"]
  }
};
var GM_NARRATE_TOOL = {
  name: "gm_narrate",
  description: "\u7CFB\u7EDF\u5DF2\u7ED9\u51FA\u5224\u5B9A\u7ED3\u679C\uFF0C\u8BF7\u53EA\u53D9\u8FF0\u8FD9\u6B21\u884C\u52A8\u5982\u4F55\u53D1\u751F",
  parameters: {
    type: "object",
    properties: {
      narration: { type: "string", description: "\u672C\u6B21\u884C\u52A8\u7684\u53D9\u8FF0\u6B63\u6587\uFF0C\u7B2C\u4E8C\u4EBA\u79F0\uFF0C200-400 \u5B57" },
      scene: { type: "string", description: "\u66F4\u65B0\u540E\u7684\u5F53\u524D\u573A\u666F\u6458\u8981" },
      encounter: {
        type: "object",
        description: "\u82E5\u8FD9\u6B21\u7ED3\u679C\u76F4\u63A5\u628A\u5267\u60C5\u63A8\u5230\u4E86\u4E00\u4E2A\u65B0\u7684\u6289\u62E9\u5173\u53E3\uFF0C\u5728\u8FD9\u91CC\u7ED9\u51FA\uFF1B\u5426\u5219\u7701\u7565",
        properties: {
          kind: { type: "string", enum: KINDS },
          title: { type: "string" },
          description: { type: "string" },
          threat: { type: "number" },
          options: { type: "array", items: OPTION_SCHEMA }
        },
        required: ["kind", "title", "options"]
      }
    },
    required: ["narration"]
  }
};
var MEMBER_TOOL = {
  name: "member_line",
  description: "\u63D0\u4EA4\u8FD9\u540D\u961F\u4F0D\u6210\u5458\u672C\u56DE\u5408\u7684\u8A00\u884C",
  parameters: {
    type: "object",
    properties: {
      line: { type: "string", description: "\u8FD9\u540D\u6210\u5458\u672C\u56DE\u5408\u7684\u8A00\u884C\uFF0C1-3 \u53E5\uFF0C\u53EF\u542B\u52A8\u4F5C\u795E\u6001" }
    },
    required: ["line"]
  }
};
function num(value, fallback, min, max) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function str(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function coerceOption(raw, index) {
  const record = typeof raw === "object" && raw !== null ? raw : {};
  const attribute = str(record.attribute);
  return {
    id: "o" + (index + 1),
    label: str(record.label) || "\u9009\u9879 " + (index + 1),
    attribute: ATTR_IDS.includes(attribute) ? attribute : "",
    skill: str(record.skill),
    difficulty: num(record.difficulty, 55, 5, 95),
    modifier: num(record.modifier, 0, -40, 40),
    hint: str(record.hint)
  };
}
function coerceEncounter(raw, fallbackThreat = 50) {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw;
  const optionsRaw = Array.isArray(record.options) ? record.options : [];
  const options = optionsRaw.slice(0, 4).map((o, i) => coerceOption(o, i));
  if (options.length === 0) return null;
  const kind = str(record.kind, "other");
  return {
    id: "e" + Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36),
    kind: KINDS.includes(kind) ? kind : "other",
    title: str(record.title) || "\u906D\u9047",
    description: str(record.description),
    threat: num(record.threat, fallbackThreat, 0, 100),
    options
  };
}
function coerceCheck(raw) {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw;
  if (str(record.label) === "" && record.difficulty === void 0) return null;
  const option = coerceOption(record, 0);
  option.id = "act";
  option.label = option.label === "\u9009\u9879 1" ? "\u5F53\u524D\u884C\u52A8" : option.label;
  return option;
}
function triggerContext(state, action) {
  const last = [...state.log ?? []].reverse().find((e) => e.kind === "check" && e.check !== void 0);
  return {
    turn: state.turn,
    lastResult: last?.check ? { band: last.check.band, success: last.check.success, margin: last.check.margin } : null,
    encounterKind: state.encounter ? state.encounter.kind : null,
    party: [],
    action,
    facts: state.facts ?? [],
    streak: typeof state.streak === "number" ? state.streak : 0
  };
}
function fireOutline(state, action, party) {
  const beats = state.setup?.outline ?? [];
  if (beats.length === 0) return { fired: [], firedBeats: state.firedBeats ?? [] };
  const already = new Set(state.firedBeats ?? []);
  const ctx = triggerContext(state, action);
  ctx.party = party.map((m) => ({ name: m.name, hp: m.hp, maxHp: m.maxHp }));
  const pending = beats.filter((b) => !(b.once && (b.fired || already.has(b.id))));
  const { fired, retired } = runOutline(pending, ctx);
  const next = [.../* @__PURE__ */ new Set([...state.firedBeats ?? [], ...retired, ...fired.map((f) => f.id)])];
  return { fired, firedBeats: next };
}
function firedBlock(fired) {
  if (fired.length === 0) return "";
  const lines = ["\u3010\u672C\u56DE\u5408\u5FC5\u987B\u6F14\u51FA\u7684\u4E8B\u4EF6\u3011", '\u4E0B\u9762\u662F\u8FD9\u5F20\u684C\u5B50\u4E8B\u5148\u5199\u597D\u7684\u5267\u60C5\u8282\u70B9\uFF0C\u89E6\u53D1\u6761\u4EF6\u521A\u521A\u7531\u7CFB\u7EDF\u5224\u5B9A\u4E3A\u6210\u7ACB\u3002\u8BF7\u628A\u5B83\u4EEC\u81EA\u7136\u5730\u7F16\u7EC7\u8FDB\u672C\u56DE\u5408\u7684\u53D9\u8FF0\uFF0C\u4E0D\u8981\u751F\u786C\u5730\u8D34\u4E0A\u53BB\uFF0C\u4E5F\u4E0D\u8981\u8BF4"\u89E6\u53D1\u4E86\u4E00\u4E2A\u4E8B\u4EF6"\u3002'];
  for (const f of fired) {
    lines.push("- " + (f.title ? "\u300C" + f.title + "\u300D" : "") + f.event);
  }
  return lines.join("\n");
}
function setupBlock(state) {
  const setup = state.setup;
  if (!setup) return "";
  const lines = [];
  if (setup.title) lines.push("\u5267\u672C\uFF1A" + setup.title);
  if (setup.premise) lines.push("\u6545\u4E8B\u524D\u63D0\uFF1A" + setup.premise);
  if (setup.tone) lines.push("\u57FA\u8C03\u4E0E\u5C3A\u5EA6\uFF1A" + setup.tone);
  if (setup.rules) lines.push("\u672C\u684C\u7EA6\u5B9A\uFF1A" + setup.rules);
  return lines.join("\n");
}
function describeParty(party) {
  if (party.length === 0) return "\uFF08\u961F\u4F0D\u4E3A\u7A7A\uFF09";
  return party.map((m) => {
    const actor = m;
    const lines = ["- " + actorSummary(actor)];
    if (m.role) lines.push("  \u5B9A\u4F4D\uFF1A" + m.role);
    if (m.prompt) lines.push("  \u4EBA\u8BBE\uFF1A" + m.prompt.replace(/\s+/g, " ").slice(0, 200));
    return lines.join("\n");
  }).join("\n");
}
function recentLog(state, limit) {
  const entries = (state.log ?? []).slice(-limit);
  if (entries.length === 0) return "\uFF08\u5192\u9669\u521A\u521A\u5F00\u59CB\uFF09";
  return entries.map((e) => {
    if (e.kind === "speech") return "\u3010" + e.who + "\u3011" + e.text;
    if (e.kind === "action") return "\u3010\u73A9\u5BB6\u884C\u52A8\u3011" + e.text;
    if (e.kind === "check" && e.check) {
      return "\u3010\u5224\u5B9A\u3011" + e.check.bandLabel + "\uFF1A\u63B7\u51FA " + e.check.roll + "\uFF0C\u9700\u8981 " + e.check.required + "\uFF08\u5DEE\u503C " + e.check.margin + "\uFF09";
    }
    if (e.kind === "result") return "\u3010\u7CFB\u7EDF\u7ED3\u7B97\u3011" + e.text;
    if (e.kind === "system") return "\u3010\u7CFB\u7EDF\u3011" + e.text;
    return "\u3010\u53D9\u8FF0\u3011" + e.text;
  }).join("\n");
}
function buildTurnPrompt(req, member, fired = []) {
  const state = req.state;
  const lines = [];
  const setup = setupBlock(state);
  if (setup !== "") {
    lines.push("\u3010\u5267\u672C\u8BBE\u5B9A\u3011");
    lines.push(setup);
    lines.push("");
  }
  const beats = firedBlock(fired);
  if (beats !== "") {
    lines.push(beats);
    lines.push("");
  }
  lines.push("\u3010\u5F53\u524D\u573A\u666F\u3011");
  lines.push(state.scene || "\uFF08\u5C1A\u672A\u5F00\u59CB\uFF0C\u8BF7\u5148\u7ED9\u51FA\u4E00\u4E2A\u81EA\u7136\u7684\u5F00\u573A\uFF09");
  lines.push("");
  lines.push("\u3010\u961F\u4F0D\u3011");
  lines.push(describeParty(req.party));
  lines.push("");
  if (state.facts.length > 0) {
    lines.push("\u3010\u5DF2\u786E\u7ACB\u7684\u4E8B\u5B9E\uFF08\u5FC5\u987B\u4FDD\u6301\u4E00\u81F4\uFF09\u3011");
    for (const f of state.facts.slice(-20)) lines.push("- " + f);
    lines.push("");
  }
  if (state.encounter) {
    lines.push("\u3010\u5F85\u6289\u62E9\u7684\u906D\u9047\u3011" + state.encounter.title);
    lines.push(state.encounter.description);
    lines.push("\uFF08\u53EF\u9009\u884C\u52A8\uFF1A" + state.encounter.options.map((o) => o.label).join(" / ") + "\uFF09");
    lines.push("");
  }
  lines.push("\u3010\u6700\u8FD1\u7684\u7ECF\u8FC7\u3011");
  lines.push(recentLog(state, 12));
  lines.push("");
  lines.push("\u3010\u73A9\u5BB6\u672C\u56DE\u5408\u7684\u58F0\u660E\u3011");
  lines.push(req.action);
  if (member) lines.push("\uFF08\u7531 " + member.name + " \u6267\u884C\uFF09");
  lines.push("");
  lines.push("\u8BF7\u8C03\u7528 gm_turn \u5DE5\u5177\u8F93\u51FA\u672C\u56DE\u5408\u5185\u5BB9\u3002");
  lines.push("\u5224\u5B9A\u65B9\u5F0F\u600E\u4E48\u9009\uFF1A");
  lines.push("- \u5982\u679C\u8FD9\u4E00\u56DE\u5408\u6709\u65B0\u7684\u654C\u5BF9\u76EE\u6807\u767B\u573A\uFF08\u602A\u7269\u3001\u8FFD\u5175\u3001\u654C\u610F\u7684\u4EBA\uFF09\uFF0C\u6216\u8005\u73A9\u5BB6\u5B8C\u5168\u53EF\u80FD\u60F3\u6253\u3001\u4E5F\u53EF\u80FD\u60F3\u8DD1\uFF0C\u8BF7\u7528 encounter\uFF0C\u5E76\u81F3\u5C11\u7ED9\u51FA\u300C\u6B63\u9762\u5BF9\u6297\u300D\u4E0E\u300C\u56DE\u907F/\u9003\u8DD1\u300D\u4E24\u7C7B\u9009\u9879\u3002");
  lines.push("- \u5982\u679C\u73A9\u5BB6\u5DF2\u7ECF\u660E\u786E\u5BA3\u544A\u4E86\u4E00\u4E2A\u5177\u4F53\u52A8\u4F5C\u3001\u4E14\u6CA1\u6709\u522B\u7684\u5408\u7406\u9009\u9879\uFF0C\u7528 check\u3002");
  lines.push("- \u53EA\u662F\u63A8\u8FDB\u53D9\u8FF0\u65F6\uFF0C\u4E24\u8005\u90FD\u7701\u7565\u3002");
  return lines.join("\n");
}
function routeOf(req) {
  return {
    provider: req.provider,
    model: req.model,
    custom: req.custom,
    sampling: req.sampling
  };
}
async function gmTurn(ctx, req) {
  const system = GM_SYSTEM + (req.narratorPrompt ? "\n\n\u3010\u672C\u684C\u989D\u5916\u6307\u4EE4\u3011\n" + req.narratorPrompt : "");
  const actor = req.party.length > 0 ? req.party[0] : null;
  const outline = fireOutline(req.state, req.action, req.party);
  const result = await routeCompletion(ctx, routeOf(req), {
    system,
    messages: [{ role: "user", content: buildTurnPrompt(req, actor, outline.fired) }],
    tools: [GM_TURN_TOOL],
    temperature: 0.85,
    maxTokens: 4096
  });
  const data = parseResult(result);
  if (data === null) {
    return {
      narration: result.text || "\uFF08\u5B88\u79D8\u4EBA\u6C89\u9ED8\u4E86\u3002\u53EF\u4EE5\u518D\u63CF\u8FF0\u4E00\u6B21\u4F60\u7684\u884C\u52A8\u3002\uFF09",
      scene: req.state.scene,
      encounter: null,
      check: null,
      facts: [],
      checkKind: "other",
      checkThreat: 50,
      fired: outline.fired,
      firedBeats: outline.firedBeats
    };
  }
  const narration = str(data.narration) || result.text;
  const facts = Array.isArray(data.facts) ? data.facts.filter((f) => typeof f === "string" && f.trim() !== "").slice(0, 8) : [];
  const encounter = coerceEncounter(data.encounter, num(data.checkThreat, 50, 0, 100));
  const check = coerceCheck(data.check);
  const kindRaw = str(data.checkKind, "other");
  return {
    narration,
    scene: str(data.scene) || req.state.scene,
    encounter,
    check,
    facts,
    checkKind: KINDS.includes(kindRaw) ? kindRaw : "other",
    checkThreat: num(data.checkThreat, encounter ? encounter.threat : 50, 0, 100),
    fired: outline.fired,
    firedBeats: outline.firedBeats
  };
}
async function gmNarrate(ctx, req) {
  const system = GM_SYSTEM + (req.narratorPrompt ? "\n\n\u3010\u672C\u684C\u989D\u5916\u6307\u4EE4\u3011\n" + req.narratorPrompt : "");
  const outline = fireOutline(req.state, req.action, req.party);
  const lines = [];
  lines.push(req.result.directive);
  const setup = setupBlock(req.state);
  if (setup !== "") {
    lines.push("");
    lines.push("\u3010\u5267\u672C\u8BBE\u5B9A\u3011");
    lines.push(setup);
  }
  const beats = firedBlock(outline.fired);
  if (beats !== "") {
    lines.push("");
    lines.push(beats);
  }
  lines.push("");
  lines.push("\u3010\u5F53\u524D\u573A\u666F\u3011");
  lines.push(req.state.scene || "\uFF08\u672A\u8BB0\u5F55\uFF09");
  lines.push("");
  lines.push("\u3010\u961F\u4F0D\u3011");
  lines.push(describeParty(req.party));
  lines.push("");
  lines.push("\u3010\u6700\u8FD1\u7684\u7ECF\u8FC7\u3011");
  lines.push(recentLog(req.state, 10));
  lines.push("");
  lines.push("\u672C\u56DE\u5408\u73A9\u5BB6\u7684\u884C\u52A8\u662F\uFF1A" + req.action);
  lines.push("");
  lines.push("\u8BF7\u8C03\u7528 gm_narrate \u5DE5\u5177\uFF1A\u53EA\u53D9\u8FF0\u8FD9\u6B21\u884C\u52A8\u5982\u4F55\u53D1\u751F\uFF0C\u4E25\u683C\u8D34\u5408\u4E0A\u9762\u7684\u5224\u5B9A\u7ED3\u679C\u4E0E\u5DEE\u503C\u6863\u4F4D\uFF0C\u4E0D\u8981\u590D\u8FF0\u6570\u5B57\uFF0C\u4E0D\u8981\u6539\u53D8\u6210\u8D25\u3002");
  const result = await routeCompletion(ctx, routeOf(req), {
    system,
    messages: [{ role: "user", content: lines.join("\n") }],
    tools: [GM_NARRATE_TOOL],
    temperature: 0.9,
    maxTokens: 3072
  });
  const data = parseResult(result);
  if (data === null) {
    return {
      narration: result.text || "",
      scene: req.state.scene,
      encounter: null,
      fired: outline.fired,
      firedBeats: outline.firedBeats
    };
  }
  return {
    narration: str(data.narration) || result.text,
    scene: str(data.scene) || req.state.scene,
    encounter: coerceEncounter(data.encounter, req.state.encounter ? req.state.encounter.threat : 50),
    fired: outline.fired,
    firedBeats: outline.firedBeats
  };
}
function buildPending(member, option, kind, threat, penalty = 0) {
  const computed = computeCheck(member, option, { threat, penalty });
  return {
    memberId: member.id,
    option,
    kind,
    threat,
    computed: {
      actorId: computed.actorId,
      actorName: computed.actorName,
      optionId: computed.optionId,
      optionLabel: computed.optionLabel,
      required: computed.required,
      breakdown: computed.breakdown,
      difficultyLabel: computed.difficultyLabel
    }
  };
}
function memberSystem(member, state, narratorPrompt) {
  const actor = member;
  const lines = [];
  lines.push("\u4F60\u6B63\u5728\u626E\u6F14\u8DD1\u56E2\u961F\u4F0D\u4E2D\u7684\u4E00\u540D\u89D2\u8272\uFF1A\u300C" + member.name + "\u300D" + (member.role ? "\uFF08" + member.role + "\uFF09" : "") + "\u3002");
  lines.push("");
  lines.push("\u3010\u8FD9\u4E2A\u89D2\u8272\u662F\u8C01\u3011");
  lines.push(member.prompt || "\uFF08\u672A\u586B\u5199\u4EBA\u8BBE\uFF0C\u8BF7\u4F9D\u636E\u5C5E\u6027\u4E0E\u5B9A\u4F4D\u5408\u7406\u53D1\u6325\u3002\uFF09");
  lines.push("");
  lines.push("\u3010\u4ED6\u7684\u72B6\u6001\u3011");
  lines.push(actorSummary(actor));
  if ((member.status ?? []).length > 0) lines.push("\u5F53\u524D\u72B6\u6001\uFF1A" + member.status.join("\u3001"));
  lines.push("");
  lines.push("\u3010\u5F53\u4E0B\u573A\u666F\u3011");
  lines.push(state.scene || "\uFF08\u672A\u8BB0\u5F55\uFF09");
  if (narratorPrompt) {
    lines.push("");
    lines.push("\u3010\u672C\u684C\u57FA\u8C03\u3011");
    lines.push(narratorPrompt);
  }
  lines.push("");
  lines.push("\u3010\u89C4\u5219\u3011");
  lines.push("1. \u53EA\u8F93\u51FA\u8FD9\u4E2A\u89D2\u8272\u8FD9\u4E00\u56DE\u5408\u7684\u8A00\u884C\uFF0C1 \u5230 3 \u53E5\uFF0C\u53EF\u4EE5\u5305\u542B\u5BF9\u767D\u4E0E\u52A8\u4F5C\u795E\u6001\u3002");
  lines.push("2. \u4E0D\u8981\u66FF\u5176\u4ED6\u89D2\u8272\u6216\u73A9\u5BB6\u8BF4\u8BDD\uFF0C\u4E0D\u8981\u590D\u8FF0\u65C1\u767D\uFF0C\u4E0D\u8981\u63CF\u8FF0\u5168\u5C40\u5267\u60C5\u8D70\u5411\u3002");
  lines.push("3. \u4E0D\u8981\u63D0\u53CA\u89C4\u5219\u3001\u6570\u503C\u3001\u9AB0\u5B50\u6216\u4EFB\u4F55\u7CFB\u7EDF\u8BCD\u6C47\u3002");
  lines.push("4. \u4FDD\u6301\u4EBA\u8BBE\u4E00\u81F4\uFF1A" + (member.prompt ? "\u4E25\u683C\u9075\u5B88\u4E0A\u9762\u7684\u4EBA\u8BBE\u3002" : "\u4F9D\u636E\u5C5E\u6027\u4E0E\u5B9A\u4F4D\u4FDD\u6301\u7A33\u5B9A\u6027\u683C\u3002"));
  lines.push("5. \u5168\u7A0B\u4F7F\u7528\u4E2D\u6587\u3002");
  return lines.join("\n");
}
async function memberLine(ctx, req) {
  const system = memberSystem(req.member, req.state, "");
  const lines = [];
  lines.push("\u3010\u6700\u8FD1\u7684\u7ECF\u8FC7\u3011");
  lines.push(recentLog(req.state, 8));
  lines.push("");
  lines.push("\u3010\u521A\u521A\u53D1\u751F\u7684\u4E8B\u3011");
  lines.push(req.beat || "\uFF08\u65E0\uFF09");
  if (req.instruction) {
    lines.push("");
    lines.push("\u3010\u73A9\u5BB6\u5E0C\u671B\u4F60\u3011");
    lines.push(req.instruction);
  }
  lines.push("");
  lines.push("\u8BF7\u8C03\u7528 member_line \u5DE5\u5177\uFF0C\u7ED9\u51FA\u300C" + req.member.name + "\u300D\u672C\u56DE\u5408\u7684\u8A00\u884C\u3002");
  const mode = req.member.llm.mode;
  const inherit = req.inherit ?? {};
  const result = await routeCompletion(ctx, {
    provider: mode === "dsh" ? req.member.llm.provider : mode === "inherit" ? inherit.provider : void 0,
    model: mode === "dsh" ? req.member.llm.model : mode === "inherit" ? inherit.model : void 0,
    custom: mode === "custom" ? { baseUrl: req.member.llm.baseUrl, apiKey: req.member.llm.apiKey, model: req.member.llm.customModel } : mode === "inherit" ? inherit.custom : void 0,
    sampling: req.sampling
  }, {
    system,
    messages: [{ role: "user", content: lines.join("\n") }],
    tools: [MEMBER_TOOL],
    temperature: 0.9,
    maxTokens: 800
  });
  const data = parseResult(result);
  const line = data === null ? result.text : str(data.line) || result.text;
  const used = req.member.llm.mode === "dsh" ? { provider: req.member.llm.provider, model: req.member.llm.model } : req.member.llm.mode === "custom" ? { provider: "custom", model: req.member.llm.customModel } : { provider: "", model: "" };
  return { line: line.trim(), provider: used.provider, model: used.model };
}
var MEMBER_CHAT_TOOL = {
  name: "member_reply",
  description: "\u63D0\u4EA4\u8FD9\u540D\u961F\u4F0D\u6210\u5458\u8FD9\u8F6E\u7684\u56DE\u590D",
  parameters: {
    type: "object",
    properties: {
      reply: { type: "string", description: "\u8FD9\u540D\u6210\u5458\u7684\u56DE\u590D\uFF0C\u53EF\u4EE5\u5305\u542B\u5BF9\u767D\u4E0E\u52A8\u4F5C\u795E\u6001\uFF0C1-4 \u53E5\uFF0C\u4E0D\u8981\u590D\u8FF0\u89C4\u5219\u6216\u6570\u503C" }
    },
    required: ["reply"]
  }
};
async function memberChat(ctx, req) {
  const lines = [];
  lines.push("\u4F60\u6B63\u5728\u548C\u73A9\u5BB6\u79C1\u804A\u3002\u8FD9\u662F\u4F60\u4EEC\u4E24\u4E2A\u4EBA\u7684\u5BF9\u8BDD\uFF0C\u961F\u4F0D\u91CC\u7684\u5176\u4ED6\u4EBA\u770B\u4E0D\u5230\u3002");
  if (req.adventure) {
    lines.push("");
    lines.push("\u3010\u6B64\u523B\u5192\u9669\u6B63\u5728\u8FDB\u884C\u3011");
    if (req.adventure.scene) lines.push("\u5F53\u524D\u573A\u666F\uFF1A" + req.adventure.scene);
    if (req.adventure.beat) lines.push("\u521A\u521A\u53D1\u751F\uFF1A" + req.adventure.beat.slice(0, 800));
    if (req.adventure.encounter) {
      lines.push("\u773C\u524D\u7684\u906D\u9047\uFF1A" + req.adventure.encounter.title + "\u3002" + req.adventure.encounter.description);
      lines.push("\u53EF\u9009\u884C\u52A8\uFF1A" + req.adventure.encounter.options.join(" / "));
      lines.push("\u4F60\u5F88\u6E05\u695A\u8FD9\u4E9B\uFF0C\u6240\u4EE5\u73A9\u5BB6\u53EF\u4EE5\u5728\u8FD9\u91CC\u548C\u4F60\u5546\u91CF\u5BF9\u7B56\u3002");
    }
  }
  lines.push("");
  lines.push("\u8BF7\u8C03\u7528 member_reply \u5DE5\u5177\u7ED9\u51FA\u4F60\u7684\u56DE\u590D\u3002");
  const system = memberSystem(req.member, emptyState(), "") + "\n\n" + lines.join("\n");
  const mode = req.member.llm.mode;
  const inherit = req.inherit ?? {};
  const result = await routeCompletion(ctx, {
    provider: mode === "dsh" ? req.member.llm.provider : mode === "inherit" ? inherit.provider : void 0,
    model: mode === "dsh" ? req.member.llm.model : mode === "inherit" ? inherit.model : void 0,
    custom: mode === "custom" ? { baseUrl: req.member.llm.baseUrl, apiKey: req.member.llm.apiKey, model: req.member.llm.customModel } : mode === "inherit" ? inherit.custom : void 0,
    sampling: req.sampling
  }, {
    system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [MEMBER_CHAT_TOOL],
    temperature: 0.9,
    maxTokens: 900
  });
  const data = parseResult(result);
  const reply = data === null ? result.text : str(data.reply) || result.text;
  const used = mode === "dsh" ? { provider: req.member.llm.provider, model: req.member.llm.model } : mode === "custom" ? { provider: "custom", model: req.member.llm.customModel } : { provider: inherit.provider ?? "", model: inherit.model ?? "" };
  return { reply: reply.trim(), provider: used.provider, model: used.model };
}
function emptyState() {
  return {
    scene: "",
    turn: 0,
    log: [],
    encounter: null,
    pending: null,
    inventory: [],
    facts: [],
    setup: emptyAdventureSetup(),
    streak: 0,
    firedBeats: []
  };
}
var SCENARIO_TOOL = {
  name: "emit_scenario",
  description: "\u8F93\u51FA\u4E00\u4EFD\u53EF\u4EE5\u76F4\u63A5\u5F00\u5C40\u7684\u5192\u9669\u8BBE\u5B9A",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "\u8FD9\u6B21\u5192\u9669\u7684\u540D\u5B57\uFF0C\u4E0D\u8D85\u8FC7 12 \u4E2A\u5B57" },
      premise: { type: "string", description: "\u6545\u4E8B\u524D\u63D0\uFF1A\u8FD9\u662F\u4EC0\u4E48\u5730\u65B9\u3001\u53D1\u751F\u4E86\u4EC0\u4E48\u3001\u73A9\u5BB6\u4E3A\u4EC0\u4E48\u5728\u8FD9\u91CC\u3001\u773C\u524D\u7684\u76EE\u6807\u662F\u4EC0\u4E48\u3002150-300 \u5B57" },
      tone: { type: "string", description: '\u57FA\u8C03\u4E0E\u5C3A\u5EA6\uFF1A\u4F8B\u5982"\u8F7B\u677E\u5192\u9669\u3001\u4E0D\u63CF\u5199\u8840\u8165"\u6216"\u9ED1\u6697\u538B\u6291\u3001\u5141\u8BB8\u89D2\u8272\u6B7B\u4EA1"\u3002\u4E00\u4E24\u53E5' },
      rules: { type: "string", description: '\u672C\u684C\u7EA6\u5B9A\uFF1A\u7ED9\u5B88\u79D8\u4EBA\u7684\u989D\u5916\u7EA6\u675F\uFF0C\u4F8B\u5982"\u4E0D\u51FA\u73B0\u73B0\u4EE3\u79D1\u6280""NPC \u4E0D\u4F1A\u4E3B\u52A8\u80CC\u53DB\u73A9\u5BB6"\u3002\u6CA1\u6709\u5C31\u7559\u7A7A' }
    },
    required: ["title", "premise"]
  }
};
var OUTLINE_TOOL = {
  name: "emit_outline",
  description: "\u8F93\u51FA\u4E00\u7EC4\u5267\u60C5\u8282\u70B9\uFF1B\u6BCF\u4E2A\u8282\u70B9\u90FD\u5E26\u4E00\u4E2A\u7CFB\u7EDF\u53EF\u4EE5\u5224\u5B9A\u7684\u89E6\u53D1\u6761\u4EF6",
  parameters: {
    type: "object",
    properties: {
      beats: {
        type: "array",
        description: "3-6 \u4E2A\u8282\u70B9\uFF0C\u6309\u5927\u81F4\u7684\u5148\u540E\u987A\u5E8F\u6392\u5217",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: '\u8282\u70B9\u6807\u9898\uFF0C\u4E0D\u8D85\u8FC7 10 \u4E2A\u5B57\uFF0C\u4F8B\u5982"\u53D1\u73B0\u4FE1\u7269"' },
            event: { type: "string", description: "\u89E6\u53D1\u540E\u5B88\u79D8\u4EBA\u5FC5\u987B\u6F14\u51FA\u7684\u5185\u5BB9\uFF1A\u51FA\u73B0\u4EC0\u4E48\u3001\u53D1\u751F\u4EC0\u4E48\u3001\u63ED\u793A\u4EC0\u4E48\u300280-200 \u5B57\uFF0C\u5199\u6210\u7ED9\u5B88\u79D8\u4EBA\u7684\u6307\u4EE4" },
            once: { type: "boolean", description: "\u662F\u5426\u53EA\u89E6\u53D1\u4E00\u6B21\uFF0C\u901A\u5E38\u4E3A true" },
            trigger: {
              type: "object",
              description: "\u89E6\u53D1\u6761\u4EF6\uFF1Bkind \u51B3\u5B9A\u8BFB\u54EA\u4E2A\u5B57\u6BB5",
              properties: {
                kind: {
                  type: "string",
                  enum: ["turn", "band", "encounter", "hp", "action", "fact", "success", "failure", "always"],
                  description: "turn=\u5230\u8FBE\u56DE\u5408 / band=\u5224\u5B9A\u6863\u4F4D / encounter=\u906D\u9047\u7C7B\u578B / hp=\u8840\u91CF\u4F4E\u4E8E\u6BD4\u4F8B / action=\u884C\u52A8\u542B\u5173\u952E\u8BCD / fact=\u4E8B\u5B9E\u542B\u5173\u952E\u8BCD / success=\u8FDE\u7EED\u6210\u529F / failure=\u8FDE\u7EED\u5931\u8D25 / always=\u7ACB\u5373"
                },
                turn: { type: "number", description: "kind=turn \u65F6\u4F7F\u7528\uFF1A\u7B2C\u51E0\u56DE\u5408" },
                band: { type: "string", enum: ["triumph", "success", "costly", "narrow", "hair", "fail", "disaster"], description: "kind=band \u65F6\u4F7F\u7528" },
                encounterKind: { type: "string", enum: ["combat", "chase", "social", "environment", "other"], description: "kind=encounter \u65F6\u4F7F\u7528" },
                hpBelow: { type: "number", description: "kind=hp \u65F6\u4F7F\u7528\uFF1A0 \u5230 1 \u7684\u6BD4\u4F8B\uFF0C\u4F8B\u5982 0.3 \u8868\u793A\u4E09\u6210\u8840" },
                keyword: { type: "string", description: "kind=action \u65F6\u4F7F\u7528\uFF1A\u73A9\u5BB6\u884C\u52A8\u91CC\u51FA\u73B0\u8FD9\u6BB5\u6587\u5B57\u5C31\u89E6\u53D1" },
                factKeyword: { type: "string", description: "kind=fact \u65F6\u4F7F\u7528\uFF1A\u5DF2\u786E\u7ACB\u4E8B\u5B9E\u91CC\u51FA\u73B0\u8FD9\u6BB5\u6587\u5B57\u5C31\u89E6\u53D1" },
                streak: { type: "number", description: "kind=success/failure \u65F6\u4F7F\u7528\uFF1A\u8FDE\u7EED\u51E0\u6B21" }
              },
              required: ["kind"]
            }
          },
          required: ["title", "event", "trigger"]
        }
      }
    },
    required: ["beats"]
  }
};
function partyBrief(party) {
  if (party.length === 0) return "\uFF08\u8FD8\u6CA1\u6709\u961F\u4F0D\u6210\u5458\uFF0C\u8BF7\u6309\u4E00\u652F\u5178\u578B\u7684\u5192\u9669\u5C0F\u961F\u6765\u5199\u3002\uFF09";
  return party.map((m) => {
    const bits = ["- " + m.name + (m.role ? "\uFF08" + m.role + "\uFF09" : "")];
    if (m.prompt) bits.push("  " + m.prompt.replace(/\s+/g, " ").slice(0, 120));
    return bits.join("\n");
  }).join("\n");
}
async function draftScenario(ctx, req) {
  const lines = [];
  lines.push("\u8BF7\u4E3A\u4E0B\u9762\u8FD9\u652F\u5192\u9669\u5C0F\u961F\u8BBE\u8BA1\u4E00\u4EFD\u53EF\u4EE5\u76F4\u63A5\u5F00\u5C40\u7684\u5192\u9669\u8BBE\u5B9A\u3002");
  lines.push("");
  lines.push("\u3010\u961F\u4F0D\u3011");
  lines.push(partyBrief(req.party));
  lines.push("");
  if (req.hint.trim() !== "") {
    lines.push("\u3010\u73A9\u5BB6\u5DF2\u7ECF\u5199\u4E0B\u7684\u60F3\u6CD5\uFF08\u8BF7\u987A\u7740\u5B83\u5199\uFF0C\u4E0D\u8981\u63A8\u7FFB\uFF09\u3011");
    lines.push(req.hint.trim());
    lines.push("");
  }
  lines.push("\u8981\u6C42\uFF1A\u7ED9\u51FA\u4E00\u4E2A\u6709\u660E\u786E\u773C\u524D\u76EE\u6807\u7684\u5F00\u5C40\uFF1B\u7559\u51FA\u73A9\u5BB6\u505A\u9009\u62E9\u7684\u7A7A\u95F4\uFF0C\u4E0D\u8981\u5199\u6210\u4E00\u672C\u5C0F\u8BF4\uFF1B\u4E0D\u8981\u66FF\u73A9\u5BB6\u51B3\u5B9A\u4EFB\u4F55\u4E8B\u3002");
  lines.push("\u8BF7\u8C03\u7528 emit_scenario \u5DE5\u5177\u8F93\u51FA\u3002\u5168\u7A0B\u4F7F\u7528\u4E2D\u6587\u3002");
  const result = await routeCompletion(ctx, routeOf(req), {
    system: GM_SYSTEM,
    messages: [{ role: "user", content: lines.join("\n") }],
    tools: [SCENARIO_TOOL],
    temperature: 0.95,
    maxTokens: 2048
  });
  const data = parseResult(result);
  if (data === null) {
    return { setup: { title: "\u65B0\u7684\u5192\u9669", premise: result.text.slice(0, 2e3), tone: "", rules: "" } };
  }
  return {
    setup: {
      title: str(data.title) || "\u65B0\u7684\u5192\u9669",
      premise: str(data.premise),
      tone: str(data.tone),
      rules: str(data.rules)
    }
  };
}
async function draftOutline(ctx, req) {
  const count = Math.min(8, Math.max(2, Math.round(req.count) || 4));
  const lines = [];
  lines.push("\u8BF7\u4E3A\u4E0B\u9762\u8FD9\u6B21\u5192\u9669\u8BBE\u8BA1 " + count + " \u4E2A\u5267\u60C5\u8282\u70B9\u3002");
  lines.push("");
  lines.push("\u3010\u961F\u4F0D\u3011");
  lines.push(partyBrief(req.party));
  lines.push("");
  if (req.premise.trim() !== "") {
    lines.push("\u3010\u6545\u4E8B\u524D\u63D0\u3011");
    lines.push(req.premise.trim());
    lines.push("");
  }
  lines.push("\u3010\u5173\u952E\u8981\u6C42\u3011");
  lines.push("\u6BCF\u4E2A\u8282\u70B9\u90FD\u5FC5\u987B\u5E26\u4E00\u4E2A\u89E6\u53D1\u6761\u4EF6\uFF0C\u800C\u4E14\u8FD9\u4E2A\u6761\u4EF6\u4F1A\u88AB\u7CFB\u7EDF\u673A\u68B0\u5730\u5224\u5B9A\u2014\u2014\u53EA\u6709\u5199\u5F97\u5177\u4F53\uFF0C\u5B83\u624D\u4F1A\u5728\u8BE5\u53D1\u751F\u7684\u65F6\u5019\u53D1\u751F\u3002");
  lines.push("\u53EF\u7528\u7684\u89E6\u53D1\u65B9\u5F0F\uFF1A\u5230\u8FBE\u7B2C N \u56DE\u5408\u3001\u6700\u8FD1\u4E00\u6B21\u5224\u5B9A\u843D\u5728\u67D0\u4E2A\u6863\u4F4D\uFF08triumph \u5927\u6210\u529F / success \u6210\u529F / costly \u9669\u80DC / narrow \u6781\u9650\u6210\u529F / hair \u5DEE\u4E00\u70B9 / fail \u5931\u8D25 / disaster \u60E8\u8D25\uFF09\u3001\u9047\u5230\u67D0\u7C7B\u906D\u9047\uFF08combat \u6218\u6597 / chase \u8FFD\u9010 / social \u793E\u4EA4 / environment \u73AF\u5883\uFF09\u3001\u6709\u4EBA\u8840\u91CF\u4F4E\u4E8E\u67D0\u4E2A\u6BD4\u4F8B\u3001\u73A9\u5BB6\u884C\u52A8\u91CC\u51FA\u73B0\u67D0\u4E2A\u5173\u952E\u8BCD\u3001\u5DF2\u786E\u7ACB\u7684\u4E8B\u5B9E\u91CC\u51FA\u73B0\u67D0\u4E2A\u5173\u952E\u8BCD\u3001\u8FDE\u7EED\u6210\u529F\u6216\u5931\u8D25\u82E5\u5E72\u6B21\u3002");
  lines.push('\u8BF7\u628A\u8282\u70B9\u5206\u6563\u5728\u4E0D\u540C\u7684\u89E6\u53D1\u65B9\u5F0F\u4E0A\uFF0C\u4E0D\u8981\u5168\u90E8\u7528"\u7B2C N \u56DE\u5408"\uFF1B\u8BA9\u73A9\u5BB6\u505A\u4EC0\u4E48\u3001\u505A\u5F97\u600E\u4E48\u6837\uFF0C\u771F\u7684\u4F1A\u6539\u53D8\u6545\u4E8B\u8D70\u5411\u3002');
  lines.push("event \u5B57\u6BB5\u5199\u7684\u662F\u7ED9\u5B88\u79D8\u4EBA\u7684\u6307\u4EE4\uFF08\u51FA\u73B0\u4EC0\u4E48\u3001\u53D1\u751F\u4EC0\u4E48\u3001\u63ED\u793A\u4EC0\u4E48\uFF09\uFF0C\u4E0D\u662F\u7ED9\u73A9\u5BB6\u770B\u7684\u6587\u5B57\u3002");
  lines.push("\u8BF7\u8C03\u7528 emit_outline \u5DE5\u5177\u8F93\u51FA\u3002\u5168\u7A0B\u4F7F\u7528\u4E2D\u6587\u3002");
  const result = await routeCompletion(ctx, routeOf(req), {
    system: GM_SYSTEM,
    messages: [{ role: "user", content: lines.join("\n") }],
    tools: [OUTLINE_TOOL],
    temperature: 0.95,
    maxTokens: 3072
  });
  const data = parseResult(result);
  const raw = data !== null && Array.isArray(data.beats) ? data.beats : [];
  const beats = [];
  for (const item of raw.slice(0, 8)) {
    if (typeof item !== "object" || item === null) continue;
    const record = item;
    const title = str(record.title);
    const event = str(record.event);
    if (title === "" && event === "") continue;
    beats.push({
      title: title || "\u5267\u60C5\u8282\u70B9",
      event,
      once: record.once !== false,
      trigger: coerceTrigger(record.trigger)
    });
  }
  return { beats };
}
function coerceTrigger(raw) {
  const record = typeof raw === "object" && raw !== null ? raw : {};
  const kinds = ["turn", "band", "encounter", "hp", "action", "fact", "success", "failure", "always"];
  const kind = kinds.includes(str(record.kind)) ? str(record.kind) : "turn";
  const out = { kind };
  if (kind === "turn") out.turn = num(record.turn, 2, 1, 200);
  if (kind === "band") out.band = str(record.band, "fail");
  if (kind === "encounter") out.encounterKind = str(record.encounterKind, "combat");
  if (kind === "hp") out.hpBelow = Math.min(1, Math.max(0.05, num(record.hpBelow, 0.3, 0.05, 1)));
  if (kind === "action") out.keyword = str(record.keyword).slice(0, 40);
  if (kind === "fact") out.factKeyword = str(record.factKeyword).slice(0, 40);
  if (kind === "success" || kind === "failure") out.streak = num(record.streak, 2, 1, 10);
  return out;
}

// src/extensions/store.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { inflateRawSync } from "node:zlib";

// src/extensions/builtin.ts
var GLASS_CSS = [
  "/* Glassmorphism: frosted shells floating over soft light blobs. */",
  'html[data-tavern-theme="glass"]{',
  "  --SmartThemeBodyColor:#eef2fb;",
  "  --SmartThemeEmColor:#c2d4ff;",
  "  --SmartThemeQuoteColor:#a3b4dd;",
  "  --SmartThemeUnderlineColor:#8aa4e6;",
  "  --SmartThemeBlurTintColor:rgba(146,172,232,0.16);",
  "  --SmartThemeChatTintColor:rgba(118,146,214,0.12);",
  "  --SmartThemeUserMesBlurTintColor:rgba(122,168,255,0.24);",
  "  --SmartThemeBotMesBlurTintColor:rgba(196,212,248,0.10);",
  "  --SmartThemeBlurStrength:16px;",
  "  --SmartThemeShadowColor:rgba(6,10,24,0.48);",
  "  --SmartThemeBorderColor:rgba(255,255,255,0.18);",
  "  --st-accent:#79a6ff;",
  "  --st-accent-soft:rgba(121,166,255,0.24);",
  "  --st-bg:#0d1120;",
  "  --st-panel:linear-gradient(165deg,rgba(40,52,86,0.74),rgba(18,24,44,0.80));",
  "  --st-panel-2:rgba(255,255,255,0.07);",
  "  --st-text:#eef2fb;",
  "  --st-text-dim:#a8b5d4;",
  "  --st-border:rgba(255,255,255,0.16);",
  "  --st-msg-user:linear-gradient(135deg,rgba(121,166,255,0.92),rgba(154,124,255,0.86));",
  "  --st-msg-char:rgba(255,255,255,0.09);",
  "  --st-radius:16px;",
  "  --st-glow:0 12px 32px rgba(6,10,24,0.34);",
  "}",
  "",
  "/* shell: translucent slab, lit inner rim, ambient blobs behind the content */",
  'html[data-tavern-theme="glass"] .stPanel{background:var(--st-panel);color:var(--st-text);border-left:1px solid var(--st-border);border-radius:20px 0 0 20px;box-shadow:-20px 0 60px rgba(6,10,24,0.55),inset 0 1px 0 rgba(255,255,255,0.20);backdrop-filter:blur(18px) saturate(155%);-webkit-backdrop-filter:blur(18px) saturate(155%);font-family:"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif}',
  'html[data-tavern-theme="glass"] .stPanel::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:radial-gradient(420px 320px at 88% -8%,rgba(140,180,255,0.32),transparent 62%),radial-gradient(380px 300px at 2% 102%,rgba(176,140,255,0.24),transparent 60%);animation:stGlassGlow 11s ease-in-out infinite}',
  'html[data-tavern-theme="glass"] .stPanel::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,0.10),transparent 30%)}',
  "@keyframes stGlassGlow{0%,100%{opacity:0.68}50%{opacity:1}}",
  "",
  "/* head: a thin lit strip instead of a solid bar */",
  'html[data-tavern-theme="glass"] .stPanelHead{background:linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02));border-bottom:1px solid var(--st-border);backdrop-filter:blur(10px)}',
  'html[data-tavern-theme="glass"] .stPanelTitle{font-weight:600;letter-spacing:0.02em;text-shadow:0 1px 0 rgba(255,255,255,0.16)}',
  'html[data-tavern-theme="glass"] .stClose{color:var(--st-text-dim);border-radius:10px}',
  'html[data-tavern-theme="glass"] .stClose:hover{background:rgba(255,255,255,0.16);color:#fff}',
  "",
  "/* tabs: backlit glass pills */",
  'html[data-tavern-theme="glass"] .stTabbar{background:rgba(255,255,255,0.04);border-bottom:1px solid var(--st-border);gap:6px}',
  'html[data-tavern-theme="glass"] .stTab{color:var(--st-text-dim);border-radius:12px;transition:background 0.18s ease,color 0.18s ease}',
  'html[data-tavern-theme="glass"] .stTab:hover{background:rgba(255,255,255,0.09);color:var(--st-text)}',
  'html[data-tavern-theme="glass"] .stTabActive{background:linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.07));color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,0.38),0 6px 18px rgba(6,10,24,0.35)}',
  "",
  "/* chat: ambient blobs stay faintly visible through the transcript */",
  'html[data-tavern-theme="glass"] .stChatLog{background:linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))}',
  'html[data-tavern-theme="glass"] .stChatHead{background:rgba(255,255,255,0.03);border-bottom:1px solid var(--st-border)}',
  'html[data-tavern-theme="glass"] .stChatAvatar{border:1px solid rgba(255,255,255,0.30);box-shadow:0 6px 18px rgba(6,10,24,0.35)}',
  'html[data-tavern-theme="glass"] .stMsgBubble{border:1px solid var(--st-border);border-radius:16px;line-height:1.72;box-shadow:var(--st-glow);backdrop-filter:blur(10px)}',
  'html[data-tavern-theme="glass"] .stMsgChar .stMsgBubble{background:var(--st-msg-char);border-top-left-radius:4px;color:var(--st-text)}',
  'html[data-tavern-theme="glass"] .stMsgUser .stMsgBubble{background:var(--st-msg-user);border-color:rgba(255,255,255,0.32);border-top-right-radius:4px;color:#fff}',
  'html[data-tavern-theme="glass"] .stMsgAvatar{border:1px solid rgba(255,255,255,0.28)}',
  "",
  "/* composer and buttons: focus reads as a halo ring */",
  'html[data-tavern-theme="glass"] .stInput{background:rgba(255,255,255,0.08);border:1px solid var(--st-border);border-radius:12px;color:var(--st-text);backdrop-filter:blur(8px)}',
  'html[data-tavern-theme="glass"] .stInput::placeholder{color:rgba(200,212,240,0.50)}',
  'html[data-tavern-theme="glass"] .stInput:focus{border-color:var(--st-accent);box-shadow:0 0 0 3px var(--st-accent-soft)}',
  'html[data-tavern-theme="glass"] .stChatInput{border-top:1px solid var(--st-border)}',
  'html[data-tavern-theme="glass"] .stBtn{background:rgba(255,255,255,0.10);border:1px solid var(--st-border);border-radius:12px;color:var(--st-text);backdrop-filter:blur(8px);transition:background 0.16s ease,transform 0.16s ease}',
  'html[data-tavern-theme="glass"] .stBtn:hover{background:rgba(255,255,255,0.19);transform:translateY(-1px)}',
  'html[data-tavern-theme="glass"] .stBtnPrimary{background:linear-gradient(135deg,var(--st-accent),#a07dff);border-color:rgba(255,255,255,0.34);color:#fff;box-shadow:0 10px 24px rgba(90,130,255,0.36)}',
  'html[data-tavern-theme="glass"] .stBtnPrimary:hover{background:linear-gradient(135deg,#8db2ff,#ae8dff);filter:none}',
  'html[data-tavern-theme="glass"] .stBtnGhost{border-color:rgba(255,255,255,0.20);color:var(--st-text-dim)}',
  "",
  "/* sections and result cards: raised glass slabs */",
  'html[data-tavern-theme="glass"] .stSection{background:rgba(255,255,255,0.06);border:1px solid var(--st-border);border-radius:16px;box-shadow:0 10px 30px rgba(6,10,24,0.26);backdrop-filter:blur(10px)}',
  'html[data-tavern-theme="glass"] .stSectionHead{background:linear-gradient(180deg,rgba(255,255,255,0.13),rgba(255,255,255,0.03));color:var(--st-text)}',
  'html[data-tavern-theme="glass"] .stSectionHead:hover{background:rgba(255,255,255,0.17)}',
  'html[data-tavern-theme="glass"] .stSectionBody{background:transparent}',
  'html[data-tavern-theme="glass"] .stSectionHint,',
  'html[data-tavern-theme="glass"] .stSectionCaret,',
  'html[data-tavern-theme="glass"] .stLabel,',
  'html[data-tavern-theme="glass"] .stLiveHint,',
  'html[data-tavern-theme="glass"] .stLibMeta{color:var(--st-text-dim)}',
  'html[data-tavern-theme="glass"] .stResultWrap,',
  'html[data-tavern-theme="glass"] .stWbEntry,',
  'html[data-tavern-theme="glass"] .stLibItem{background:rgba(255,255,255,0.05);border:1px solid var(--st-border);border-radius:14px}',
  'html[data-tavern-theme="glass"] .stCardName{color:#fff;text-shadow:0 2px 12px rgba(90,130,255,0.45)}',
  'html[data-tavern-theme="glass"] .stCardTag{background:rgba(255,255,255,0.12);color:var(--st-text)}',
  "",
  "/* chips, radios, sliders and scrollbars share one frosted language */",
  'html[data-tavern-theme="glass"] .stChip{background:rgba(255,255,255,0.08);border:1px solid var(--st-border);color:var(--st-text-dim)}',
  'html[data-tavern-theme="glass"] .stChip:hover{border-color:var(--st-accent);color:var(--st-text)}',
  'html[data-tavern-theme="glass"] .stChipActive{background:var(--st-accent-soft);border-color:var(--st-accent);color:#fff}',
  'html[data-tavern-theme="glass"] .stRadio{border-color:var(--st-border);color:var(--st-text)}',
  'html[data-tavern-theme="glass"] .stRadioActive{border-color:var(--st-accent);background:var(--st-accent-soft);color:#fff}',
  'html[data-tavern-theme="glass"] .stSliderVal{background:rgba(255,255,255,0.12);border-radius:8px;color:#fff}',
  'html[data-tavern-theme="glass"] .stSwatch{box-shadow:0 4px 12px rgba(6,10,24,0.40)}',
  'html[data-tavern-theme="glass"] .stTrigger{background:rgba(24,32,54,0.74);border:1px solid var(--st-border);border-radius:12px;color:var(--st-text);backdrop-filter:blur(14px)}',
  'html[data-tavern-theme="glass"] .stRaw,',
  'html[data-tavern-theme="glass"] .stLivePre,',
  'html[data-tavern-theme="glass"] .stJsonArea{background:rgba(10,14,28,0.46);border-color:var(--st-border);border-radius:12px}',
  'html[data-tavern-theme="glass"] .stEmpty{color:var(--st-text-dim)}',
  'html[data-tavern-theme="glass"] .stSpinner{border-color:rgba(255,255,255,0.18);border-top-color:var(--st-accent)}',
  'html[data-tavern-theme="glass"] .stPanel ::-webkit-scrollbar{width:10px;height:10px}',
  'html[data-tavern-theme="glass"] .stPanel ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.18);border-radius:999px}',
  'html[data-tavern-theme="glass"] .stSlider{accent-color:var(--st-accent)}',
  'html[data-tavern-theme="glass"] .stAvatarPreview{border:2px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.08)}',
  'html[data-tavern-theme="glass"] .stCardBlockLabel{color:var(--st-text-dim);letter-spacing:0.08em;text-transform:uppercase}',
  'html[data-tavern-theme="glass"] .stEmptyEmoji{color:rgba(255,255,255,0.35)}',
  'html[data-tavern-theme="glass"] .stPanel ::-webkit-scrollbar-track{background:transparent}'
];
var CYBER_CSS = [
  "/* Cyber neon: black chassis, cyan and magenta tube light, rolling scanlines. */",
  'html[data-tavern-theme="cyber"]{',
  "  --SmartThemeBodyColor:#d8fbff;",
  "  --SmartThemeEmColor:#00e5ff;",
  "  --SmartThemeQuoteColor:#7fe9ff;",
  "  --SmartThemeUnderlineColor:#ff2fd0;",
  "  --SmartThemeBlurTintColor:rgba(0,229,255,0.10);",
  "  --SmartThemeChatTintColor:rgba(5,7,14,0.88);",
  "  --SmartThemeUserMesBlurTintColor:rgba(255,47,208,0.14);",
  "  --SmartThemeBotMesBlurTintColor:rgba(0,229,255,0.10);",
  "  --SmartThemeBlurStrength:8px;",
  "  --SmartThemeShadowColor:rgba(0,229,255,0.28);",
  "  --SmartThemeBorderColor:rgba(0,229,255,0.42);",
  "  --st-accent:#00e5ff;",
  "  --st-accent-2:#ff2fd0;",
  "  --st-bg:#05060a;",
  "  --st-panel:rgba(6,9,18,0.97);",
  "  --st-panel-2:rgba(0,229,255,0.05);",
  "  --st-text:#d8fbff;",
  "  --st-text-dim:#5f8398;",
  "  --st-border:rgba(0,229,255,0.42);",
  "  --st-msg-user:linear-gradient(135deg,rgba(255,47,208,0.22),rgba(96,0,72,0.30));",
  "  --st-msg-char:rgba(0,229,255,0.07);",
  "  --st-radius:2px;",
  "  --st-glow:0 0 18px rgba(0,229,255,0.35);",
  "}",
  "",
  "/* shell: hard plate, cyan rim, magenta counter edge, drifting scanlines */",
  'html[data-tavern-theme="cyber"] .stPanel{background:var(--st-panel);color:var(--st-text);border-left:2px solid var(--st-accent);border-radius:0;box-shadow:-1px 0 0 rgba(255,47,208,0.35),inset 1px 0 26px rgba(0,229,255,0.10),-26px 0 62px rgba(0,229,255,0.16);font-family:"Cascadia Mono",Consolas,"SFMono-Regular",Menlo,"Microsoft YaHei",monospace;letter-spacing:0.045em}',
  'html[data-tavern-theme="cyber"] .stPanel::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:repeating-linear-gradient(180deg,rgba(0,229,255,0.055) 0 1px,rgba(0,0,0,0) 1px 4px);animation:stCyberScan 1.8s linear infinite}',
  'html[data-tavern-theme="cyber"] .stPanel::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 60% at 50% 0%,rgba(0,229,255,0.13),transparent 64%),radial-gradient(90% 55% at 50% 100%,rgba(255,47,208,0.11),transparent 70%)}',
  "@keyframes stCyberScan{from{background-position:0 0}to{background-position:0 8px}}",
  "",
  "/* head: reads like a boot banner */",
  'html[data-tavern-theme="cyber"] .stPanelHead{background:linear-gradient(90deg,rgba(0,229,255,0.15),rgba(255,47,208,0.09) 68%,transparent);border-bottom:1px solid var(--st-border);box-shadow:0 1px 0 rgba(255,47,208,0.30)}',
  'html[data-tavern-theme="cyber"] .stPanelTitle{color:#eafeff;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;text-shadow:0 0 10px rgba(0,229,255,0.55)}',
  'html[data-tavern-theme="cyber"] .stClose{color:var(--st-accent);border:1px solid transparent;border-radius:0}',
  'html[data-tavern-theme="cyber"] .stClose:hover{background:rgba(0,229,255,0.12);border-color:var(--st-border);color:#fff}',
  "",
  "/* tabs: uppercase labels with an underglow bar */",
  'html[data-tavern-theme="cyber"] .stTabbar{background:rgba(0,0,0,0.42);border-bottom:1px solid var(--st-border);gap:2px}',
  'html[data-tavern-theme="cyber"] .stTab{color:var(--st-text-dim);border-radius:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;padding:8px 12px}',
  'html[data-tavern-theme="cyber"] .stTab:hover{background:rgba(0,229,255,0.07);color:var(--st-accent)}',
  'html[data-tavern-theme="cyber"] .stTabActive{background:linear-gradient(180deg,rgba(0,229,255,0.18),rgba(0,229,255,0.02));color:#eafeff;box-shadow:inset 0 -2px 0 var(--st-accent),0 0 18px rgba(0,229,255,0.35);text-shadow:0 0 8px rgba(0,229,255,0.60)}',
  "",
  "/* chat: magenta data grid under a cyan wash */",
  'html[data-tavern-theme="cyber"] .stChatLog{background-image:linear-gradient(180deg,rgba(0,229,255,0.04),transparent 42%),repeating-linear-gradient(0deg,rgba(255,47,208,0.035) 0 1px,transparent 1px 28px)}',
  'html[data-tavern-theme="cyber"] .stChatHead{background:rgba(0,229,255,0.04);border-bottom:1px solid var(--st-border)}',
  'html[data-tavern-theme="cyber"] .stChatAvatar{border:1px solid var(--st-accent);border-radius:0;box-shadow:0 0 14px rgba(0,229,255,0.45)}',
  'html[data-tavern-theme="cyber"] .stMsgBubble{border:1px solid rgba(0,229,255,0.30);border-radius:2px;letter-spacing:0.05em;line-height:1.7;box-shadow:inset 0 0 22px rgba(0,229,255,0.07)}',
  'html[data-tavern-theme="cyber"] .stMsgChar .stMsgBubble{background:var(--st-msg-char);border-left:2px solid var(--st-accent);color:var(--st-text)}',
  'html[data-tavern-theme="cyber"] .stMsgUser .stMsgBubble{background:var(--st-msg-user);border-color:rgba(255,47,208,0.50);border-right:2px solid var(--st-accent-2);color:#ffe9fb;box-shadow:inset 0 0 22px rgba(255,47,208,0.12),0 0 16px rgba(255,47,208,0.20)}',
  'html[data-tavern-theme="cyber"] .stMsgAvatar{border:1px solid rgba(0,229,255,0.45);border-radius:0}',
  "",
  "/* composer: black well, neon focus ring */",
  'html[data-tavern-theme="cyber"] .stInput{background:rgba(0,0,0,0.74);border:1px solid var(--st-border);border-radius:2px;color:var(--st-text);caret-color:var(--st-accent);letter-spacing:0.05em}',
  'html[data-tavern-theme="cyber"] .stInput::placeholder{color:rgba(95,131,152,0.85)}',
  'html[data-tavern-theme="cyber"] .stInput:focus{border-color:var(--st-accent-2);box-shadow:0 0 0 1px var(--st-accent),0 0 18px rgba(255,47,208,0.35)}',
  'html[data-tavern-theme="cyber"] .stChatInput{background:rgba(0,229,255,0.03);border-top:1px solid var(--st-border)}',
  'html[data-tavern-theme="cyber"] .stBtn{background:rgba(0,229,255,0.06);border:1px solid var(--st-border);border-radius:2px;color:var(--st-accent);font-size:11px;letter-spacing:0.14em;text-transform:uppercase}',
  'html[data-tavern-theme="cyber"] .stBtn:hover{background:rgba(0,229,255,0.16);box-shadow:0 0 16px rgba(0,229,255,0.35)}',
  'html[data-tavern-theme="cyber"] .stBtnPrimary{background:linear-gradient(135deg,rgba(0,229,255,0.92),rgba(0,150,255,0.86));border-color:transparent;color:#02121a;font-weight:700;box-shadow:0 0 20px rgba(0,229,255,0.45)}',
  'html[data-tavern-theme="cyber"] .stBtnPrimary:hover{background:linear-gradient(135deg,#00e5ff,#00a2ff);filter:none;box-shadow:0 0 28px rgba(0,229,255,0.62)}',
  'html[data-tavern-theme="cyber"] .stBtnGhost{border-color:rgba(0,229,255,0.28);color:var(--st-text)}',
  "",
  "/* sections: thin neon outlines, square corners */",
  'html[data-tavern-theme="cyber"] .stSection{background:rgba(0,229,255,0.035);border:1px solid rgba(0,229,255,0.22);border-radius:2px}',
  'html[data-tavern-theme="cyber"] .stSectionHead{background:rgba(0,229,255,0.08);border-bottom:1px solid rgba(0,229,255,0.20);color:var(--st-text);letter-spacing:0.08em}',
  'html[data-tavern-theme="cyber"] .stSectionHead:hover{background:rgba(0,229,255,0.14)}',
  'html[data-tavern-theme="cyber"] .stSectionTitle{font-size:11px;letter-spacing:0.12em;text-transform:uppercase}',
  'html[data-tavern-theme="cyber"] .stSectionHint,',
  'html[data-tavern-theme="cyber"] .stSectionCaret,',
  'html[data-tavern-theme="cyber"] .stLabel,',
  'html[data-tavern-theme="cyber"] .stLiveHint,',
  'html[data-tavern-theme="cyber"] .stLibMeta{color:var(--st-text-dim)}',
  'html[data-tavern-theme="cyber"] .stResultWrap,',
  'html[data-tavern-theme="cyber"] .stWbEntry,',
  'html[data-tavern-theme="cyber"] .stLibItem{background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.20);border-radius:2px}',
  'html[data-tavern-theme="cyber"] .stCardName{color:#eafeff;text-shadow:0 0 12px rgba(0,229,255,0.55)}',
  'html[data-tavern-theme="cyber"] .stCardTag{background:rgba(255,47,208,0.16);color:#ffe9fb;border-radius:0}',
  "",
  "/* chips, radios, sliders and scrollbars stay square and glowing */",
  'html[data-tavern-theme="cyber"] .stChip{background:rgba(0,0,0,0.55);border:1px solid var(--st-border);border-radius:2px;color:var(--st-text-dim)}',
  'html[data-tavern-theme="cyber"] .stChip:hover{color:var(--st-accent);box-shadow:0 0 12px rgba(0,229,255,0.30)}',
  'html[data-tavern-theme="cyber"] .stChipActive{background:rgba(255,47,208,0.16);border-color:var(--st-accent-2);color:#ffe9fb}',
  'html[data-tavern-theme="cyber"] .stRadio{border:1px solid rgba(0,229,255,0.28);border-radius:2px;color:var(--st-text)}',
  'html[data-tavern-theme="cyber"] .stRadioActive{border-color:var(--st-accent);color:#fff;box-shadow:0 0 12px rgba(0,229,255,0.28)}',
  'html[data-tavern-theme="cyber"] .stSliderVal{background:rgba(0,229,255,0.14);border-radius:0;color:#eafeff}',
  'html[data-tavern-theme="cyber"] .stSwatch{border-radius:0}',
  'html[data-tavern-theme="cyber"] .stTrigger{background:rgba(5,7,14,0.94);border:1px solid var(--st-accent);border-radius:0;color:var(--st-accent);letter-spacing:0.16em;text-transform:uppercase;box-shadow:0 0 18px rgba(0,229,255,0.30)}',
  'html[data-tavern-theme="cyber"] .stRaw,',
  'html[data-tavern-theme="cyber"] .stLivePre,',
  'html[data-tavern-theme="cyber"] .stJsonArea{background:rgba(0,0,0,0.62);border-color:rgba(0,229,255,0.22);border-radius:2px}',
  'html[data-tavern-theme="cyber"] .stEmpty{color:var(--st-text-dim)}',
  'html[data-tavern-theme="cyber"] .stSpinner{border-color:rgba(0,229,255,0.20);border-top-color:var(--st-accent-2)}',
  'html[data-tavern-theme="cyber"] .stPanel ::-webkit-scrollbar{width:8px;height:8px}',
  'html[data-tavern-theme="cyber"] .stPanel ::-webkit-scrollbar-thumb{background:rgba(0,229,255,0.35);border-radius:0}',
  'html[data-tavern-theme="cyber"] .stSlider{accent-color:var(--st-accent)}',
  'html[data-tavern-theme="cyber"] .stAvatarPreview{border:1px solid var(--st-accent);border-radius:0;background:rgba(0,229,255,0.06)}',
  'html[data-tavern-theme="cyber"] .stCardBlockLabel{color:var(--st-text-dim);letter-spacing:0.16em;text-transform:uppercase}',
  'html[data-tavern-theme="cyber"] .stEmptyEmoji{color:rgba(0,229,255,0.45)}',
  'html[data-tavern-theme="cyber"] .stPanel ::-webkit-scrollbar-track{background:rgba(0,229,255,0.05)}'
];
var PARCHMENT_CSS = [
  "/* Parchment: laid paper grain, serif type, gilt accents like an old folio. */",
  'html[data-tavern-theme="parchment"]{',
  "  --SmartThemeBodyColor:#3a2c1a;",
  "  --SmartThemeEmColor:#8a5a12;",
  "  --SmartThemeQuoteColor:#6b5230;",
  "  --SmartThemeUnderlineColor:#a8761f;",
  "  --SmartThemeBlurTintColor:rgba(214,190,140,0.30);",
  "  --SmartThemeChatTintColor:rgba(246,236,214,0.78);",
  "  --SmartThemeUserMesBlurTintColor:rgba(168,118,31,0.18);",
  "  --SmartThemeBotMesBlurTintColor:rgba(255,252,242,0.55);",
  "  --SmartThemeBlurStrength:4px;",
  "  --SmartThemeShadowColor:rgba(90,66,32,0.28);",
  "  --SmartThemeBorderColor:rgba(150,116,62,0.45);",
  "  --st-accent:#a8761f;",
  "  --st-accent-2:#7a2b1f;",
  "  --st-bg:#e9dcbd;",
  "  --st-panel:linear-gradient(180deg,#f7eed8,#eddfbe);",
  "  --st-panel-2:rgba(255,250,236,0.62);",
  "  --st-text:#3a2c1a;",
  "  --st-text-dim:#7b6440;",
  "  --st-border:rgba(150,116,62,0.45);",
  "  --st-msg-user:linear-gradient(180deg,#ead8ab,#dfc791);",
  "  --st-msg-char:rgba(255,252,242,0.82);",
  "  --st-radius:4px;",
  "  --st-shadow:1px 2px 0 rgba(120,92,48,0.18);",
  "}",
  "",
  "/* shell: paper weave plus an aged vignette on the edges */",
  'html[data-tavern-theme="parchment"] .stPanel{background:var(--st-panel);color:var(--st-text);border-left:1px solid #b99a63;border-radius:0;box-shadow:-18px 0 46px rgba(74,54,26,0.28);font-family:"Iowan Old Style","Palatino Linotype",Georgia,"Songti SC","SimSun",serif;line-height:1.78}',
  'html[data-tavern-theme="parchment"] .stPanel::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;mix-blend-mode:multiply;background-image:repeating-linear-gradient(0deg,rgba(120,92,48,0.045) 0 1px,rgba(0,0,0,0) 1px 3px),repeating-linear-gradient(90deg,rgba(120,92,48,0.035) 0 1px,rgba(0,0,0,0) 1px 4px)}',
  'html[data-tavern-theme="parchment"] .stPanel::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(125% 92% at 50% 45%,rgba(0,0,0,0) 55%,rgba(120,92,48,0.22) 100%)}',
  "@keyframes stParchmentInk{from{opacity:0}to{opacity:1}}",
  "",
  "/* head: rubricated title over a double gilt rule */",
  'html[data-tavern-theme="parchment"] .stPanelHead{background:linear-gradient(180deg,rgba(190,158,98,0.30),rgba(190,158,98,0.06));border-bottom:3px double #b99a63}',
  'html[data-tavern-theme="parchment"] .stPanelTitle{color:#5a3d14;font-weight:700;letter-spacing:0.10em;text-shadow:0 1px 0 rgba(255,252,240,0.85)}',
  'html[data-tavern-theme="parchment"] .stClose{color:#7b6440;border-radius:2px}',
  'html[data-tavern-theme="parchment"] .stClose:hover{background:rgba(168,118,31,0.16);color:#4a3110}',
  "",
  "/* tabs: index tabs ruled by a gilt underline */",
  'html[data-tavern-theme="parchment"] .stTabbar{background:rgba(255,250,236,0.40);border-bottom:1px solid rgba(150,116,62,0.35)}',
  'html[data-tavern-theme="parchment"] .stTab{color:#7b6440;border-radius:3px;letter-spacing:0.06em}',
  'html[data-tavern-theme="parchment"] .stTab:hover{background:rgba(168,118,31,0.12);color:#5a3d14}',
  'html[data-tavern-theme="parchment"] .stTabActive{background:linear-gradient(180deg,rgba(255,252,242,0.92),rgba(232,213,168,0.72));color:#4a3110;box-shadow:inset 0 -2px 0 #a8761f,0 1px 0 rgba(255,252,240,0.70)}',
  "",
  "/* chat: ruled writing paper with an ink vignette */",
  'html[data-tavern-theme="parchment"] .stChatLog{background-image:repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 27px,rgba(120,92,48,0.16) 27px 28px);background-position:0 6px}',
  'html[data-tavern-theme="parchment"] .stChatHead{background:rgba(190,158,98,0.14);border-bottom:1px solid rgba(150,116,62,0.32)}',
  'html[data-tavern-theme="parchment"] .stChatAvatar{border:1px solid #b99a63;border-radius:3px;color:#4a3110;background:linear-gradient(180deg,#e8d5a8,#d9bf8c)}',
  'html[data-tavern-theme="parchment"] .stMsgBubble{border-radius:4px;line-height:1.85;font-size:13.5px;box-shadow:1px 2px 0 rgba(120,92,48,0.18);animation:stParchmentInk 0.35s ease-out}',
  'html[data-tavern-theme="parchment"] .stMsgChar .stMsgBubble{background:var(--st-msg-char);border:1px solid rgba(150,116,62,0.42);border-top-left-radius:2px;color:#3a2c1a}',
  'html[data-tavern-theme="parchment"] .stMsgUser .stMsgBubble{background:var(--st-msg-user);border:1px solid #b99a63;border-top-right-radius:2px;color:#4a3110}',
  'html[data-tavern-theme="parchment"] .stMsgAvatar{border:1px solid #b99a63;border-radius:2px}',
  "",
  "/* composer: laid paper well with a gilt focus rule */",
  'html[data-tavern-theme="parchment"] .stInput{background:rgba(255,252,242,0.88);border:1px solid rgba(150,116,62,0.50);border-radius:3px;color:#3a2c1a;box-shadow:inset 0 1px 3px rgba(120,92,48,0.22)}',
  'html[data-tavern-theme="parchment"] .stInput::placeholder{color:rgba(123,100,64,0.60)}',
  'html[data-tavern-theme="parchment"] .stInput:focus{border-color:#a8761f;box-shadow:inset 0 1px 3px rgba(120,92,48,0.24),0 0 0 2px rgba(168,118,31,0.25)}',
  'html[data-tavern-theme="parchment"] .stChatInput{background:rgba(190,158,98,0.10);border-top:1px solid rgba(150,116,62,0.35)}',
  'html[data-tavern-theme="parchment"] .stBtn{background:linear-gradient(180deg,#f4e8cb,#e4d2a6);border:1px solid #b99a63;border-radius:3px;color:#4a3110;letter-spacing:0.04em}',
  'html[data-tavern-theme="parchment"] .stBtn:hover{background:linear-gradient(180deg,#f9efda,#ead9b0)}',
  'html[data-tavern-theme="parchment"] .stBtnPrimary{background:linear-gradient(180deg,#c6952f,#a8761f);border-color:#8a5a12;color:#fff8e6;text-shadow:0 1px 0 rgba(90,60,10,0.45)}',
  'html[data-tavern-theme="parchment"] .stBtnPrimary:hover{background:linear-gradient(180deg,#d3a23c,#b5801f);filter:none}',
  'html[data-tavern-theme="parchment"] .stBtnGhost{border-color:rgba(150,116,62,0.45);color:#7b6440}',
  "",
  "/* sections: cream leaves marked by a gilt margin rule */",
  'html[data-tavern-theme="parchment"] .stSection{background:rgba(255,250,236,0.64);border:1px solid rgba(150,116,62,0.40);border-left:3px solid #a8761f;border-radius:3px;box-shadow:0 1px 0 rgba(255,252,240,0.85)}',
  'html[data-tavern-theme="parchment"] .stSectionHead{background:rgba(190,158,98,0.20);border-bottom:1px solid rgba(150,116,62,0.28);color:#4a3110}',
  'html[data-tavern-theme="parchment"] .stSectionHead:hover{background:rgba(190,158,98,0.30)}',
  'html[data-tavern-theme="parchment"] .stSectionTitle{letter-spacing:0.06em}',
  'html[data-tavern-theme="parchment"] .stSectionHint,',
  'html[data-tavern-theme="parchment"] .stSectionCaret,',
  'html[data-tavern-theme="parchment"] .stLabel,',
  'html[data-tavern-theme="parchment"] .stLiveHint,',
  'html[data-tavern-theme="parchment"] .stLibMeta{color:#7b6440}',
  'html[data-tavern-theme="parchment"] .stCheck,',
  'html[data-tavern-theme="parchment"] .stRadio{color:#5a4326}',
  'html[data-tavern-theme="parchment"] .stResultWrap,',
  'html[data-tavern-theme="parchment"] .stWbEntry,',
  'html[data-tavern-theme="parchment"] .stLibItem{background:rgba(255,250,236,0.66);border:1px solid rgba(150,116,62,0.35);border-radius:3px}',
  'html[data-tavern-theme="parchment"] .stCardName{color:#4a3110;letter-spacing:0.04em}',
  'html[data-tavern-theme="parchment"] .stCardTag{background:rgba(168,118,31,0.18);color:#5a3d14;border-radius:2px}',
  "",
  "/* chips, radios, sliders and scrollbars: wax, brass and ink */",
  'html[data-tavern-theme="parchment"] .stChip{background:rgba(255,252,242,0.70);border:1px solid rgba(150,116,62,0.45);border-radius:2px;color:#5a4326}',
  'html[data-tavern-theme="parchment"] .stChip:hover{border-color:#a8761f;color:#4a3110}',
  'html[data-tavern-theme="parchment"] .stChipActive{background:linear-gradient(180deg,#d8b96a,#c19a3c);border-color:#8a5a12;color:#3a2a08}',
  'html[data-tavern-theme="parchment"] .stRadio{border:1px solid rgba(150,116,62,0.45);border-radius:2px;color:#5a4326}',
  'html[data-tavern-theme="parchment"] .stRadioActive{border-color:#a8761f;background:rgba(168,118,31,0.16);color:#3a2a08}',
  'html[data-tavern-theme="parchment"] .stSliderVal{background:rgba(168,118,31,0.20);border-radius:2px;color:#4a3110}',
  'html[data-tavern-theme="parchment"] .stSwatch{border-radius:2px;box-shadow:0 1px 0 rgba(255,252,240,0.90)}',
  'html[data-tavern-theme="parchment"] .stTrigger{background:linear-gradient(180deg,#f4e8cb,#e0cda0);border:1px solid #b99a63;border-radius:3px;color:#5a3d14;letter-spacing:0.08em}',
  'html[data-tavern-theme="parchment"] .stRaw,',
  'html[data-tavern-theme="parchment"] .stLivePre,',
  'html[data-tavern-theme="parchment"] .stJsonArea{background:rgba(255,252,242,0.78);border-color:rgba(150,116,62,0.38);border-radius:3px;color:#4a3a22}',
  'html[data-tavern-theme="parchment"] .stNotice{background:#f3e3bd;border-color:#c19a3c;color:#7a4a10}',
  'html[data-tavern-theme="parchment"] .stEmpty{color:#7b6440}',
  'html[data-tavern-theme="parchment"] .stSpinner{border-color:rgba(150,116,62,0.25);border-top-color:#a8761f}',
  'html[data-tavern-theme="parchment"] .stPanel ::-webkit-scrollbar{width:10px;height:10px}',
  'html[data-tavern-theme="parchment"] .stPanel ::-webkit-scrollbar-thumb{background:rgba(150,116,62,0.45);border-radius:0}',
  'html[data-tavern-theme="parchment"] .stPanel ::-webkit-scrollbar-track{background:rgba(190,158,98,0.14)}'
];
var SAKURA_CSS = [
  "/* Sakura: pink and white translucency with petals drifting down the panel. */",
  'html[data-tavern-theme="sakura"]{',
  "  --SmartThemeBodyColor:#4a3540;",
  "  --SmartThemeEmColor:#d94f86;",
  "  --SmartThemeQuoteColor:#a2688a;",
  "  --SmartThemeUnderlineColor:#ff8fbb;",
  "  --SmartThemeBlurTintColor:rgba(255,214,229,0.35);",
  "  --SmartThemeChatTintColor:rgba(255,248,251,0.72);",
  "  --SmartThemeUserMesBlurTintColor:rgba(255,143,187,0.24);",
  "  --SmartThemeBotMesBlurTintColor:rgba(255,255,255,0.65);",
  "  --SmartThemeBlurStrength:12px;",
  "  --SmartThemeShadowColor:rgba(214,128,164,0.28);",
  "  --SmartThemeBorderColor:rgba(255,168,199,0.55);",
  "  --st-accent:#ff7aa8;",
  "  --st-accent-2:#c86fa8;",
  "  --st-bg:#fff4f8;",
  "  --st-panel:linear-gradient(180deg,rgba(255,251,253,0.95),rgba(255,240,246,0.92));",
  "  --st-panel-2:rgba(255,255,255,0.75);",
  "  --st-text:#4a3540;",
  "  --st-text-dim:#9c7c8b;",
  "  --st-border:rgba(255,168,199,0.55);",
  "  --st-msg-user:linear-gradient(135deg,#ffa8c8,#ff7aa8);",
  "  --st-msg-char:rgba(255,255,255,0.90);",
  "  --st-radius:18px;",
  "  --st-glow:0 8px 20px rgba(214,128,164,0.18);",
  "}",
  "",
  "/* shell: frosted blossom glass with a petal shower */",
  'html[data-tavern-theme="sakura"] .stPanel{background:var(--st-panel);color:var(--st-text);border-left:1px solid var(--st-border);border-radius:22px 0 0 22px;box-shadow:-18px 0 48px rgba(214,128,164,0.28),inset 0 1px 0 rgba(255,255,255,0.92);font-family:"Hiragino Sans","PingFang SC","Microsoft YaHei",system-ui,sans-serif}',
  'html[data-tavern-theme="sakura"] .stPanel::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0.55;background-image:radial-gradient(circle at 22% 18%,rgba(255,168,199,0.85) 0 3px,rgba(0,0,0,0) 4px),radial-gradient(circle at 68% 62%,rgba(255,205,224,0.90) 0 2.5px,rgba(0,0,0,0) 3.5px),radial-gradient(circle at 42% 86%,rgba(255,143,187,0.70) 0 3.5px,rgba(0,0,0,0) 4.5px);background-size:180px 200px;background-repeat:repeat;animation:stSakuraFall 18s linear infinite}',
  'html[data-tavern-theme="sakura"] .stPanel::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(110% 60% at 80% 0%,rgba(255,196,220,0.42),transparent 66%),radial-gradient(90% 55% at 0% 100%,rgba(255,224,236,0.50),transparent 70%)}',
  "@keyframes stSakuraFall{from{background-position:0 0}to{background-position:0 200px}}",
  "",
  "/* head: blossom banner with a petal underline */",
  'html[data-tavern-theme="sakura"] .stPanelHead{background:linear-gradient(90deg,rgba(255,214,229,0.78),rgba(255,255,255,0.35));border-bottom:1px solid rgba(255,168,199,0.50)}',
  'html[data-tavern-theme="sakura"] .stPanelTitle{color:#c2477c;font-weight:600;letter-spacing:0.04em;text-shadow:0 1px 0 #fff}',
  'html[data-tavern-theme="sakura"] .stClose{color:#c98aa6;border-radius:999px}',
  'html[data-tavern-theme="sakura"] .stClose:hover{background:rgba(255,168,199,0.28);color:#a8305f}',
  "",
  "/* tabs: petal pills, the active one filled */",
  'html[data-tavern-theme="sakura"] .stTabbar{background:rgba(255,255,255,0.42);border-bottom:1px solid rgba(255,168,199,0.40)}',
  'html[data-tavern-theme="sakura"] .stTab{color:#9c7c8b;border-radius:999px;transition:background 0.20s ease,color 0.20s ease}',
  'html[data-tavern-theme="sakura"] .stTab:hover{background:rgba(255,168,199,0.20);color:#c2477c}',
  'html[data-tavern-theme="sakura"] .stTabActive{background:linear-gradient(135deg,#ffb3cd,#ff8ab4);color:#fff;box-shadow:0 6px 16px rgba(255,122,168,0.40)}',
  "",
  "/* chat: soft blossom wash behind the transcript */",
  'html[data-tavern-theme="sakura"] .stChatLog{background-image:radial-gradient(120% 70% at 50% 0%,rgba(255,214,229,0.55),transparent 70%),radial-gradient(80% 50% at 90% 100%,rgba(255,196,220,0.35),transparent 75%)}',
  'html[data-tavern-theme="sakura"] .stChatHead{background:rgba(255,255,255,0.45);border-bottom:1px solid rgba(255,168,199,0.40)}',
  'html[data-tavern-theme="sakura"] .stChatAvatar{border:2px solid rgba(255,255,255,0.90);box-shadow:0 6px 16px rgba(214,128,164,0.30)}',
  'html[data-tavern-theme="sakura"] .stMsgBubble{border:1px solid rgba(255,168,199,0.45);border-radius:18px;line-height:1.75;box-shadow:var(--st-glow)}',
  'html[data-tavern-theme="sakura"] .stMsgChar .stMsgBubble{background:var(--st-msg-char);border-top-left-radius:6px;color:var(--st-text)}',
  'html[data-tavern-theme="sakura"] .stMsgUser .stMsgBubble{background:var(--st-msg-user);border-color:rgba(255,255,255,0.65);border-top-right-radius:6px;color:#fff;box-shadow:0 10px 22px rgba(255,122,168,0.35)}',
  'html[data-tavern-theme="sakura"] .stMsgAvatar{border:2px solid rgba(255,255,255,0.85)}',
  "",
  "/* composer: white petal well with a pink halo */",
  'html[data-tavern-theme="sakura"] .stInput{background:rgba(255,255,255,0.88);border:1px solid rgba(255,168,199,0.60);border-radius:14px;color:var(--st-text);box-shadow:inset 0 1px 2px rgba(214,128,164,0.14)}',
  'html[data-tavern-theme="sakura"] .stInput::placeholder{color:rgba(156,124,139,0.70)}',
  'html[data-tavern-theme="sakura"] .stInput:focus{border-color:var(--st-accent);box-shadow:0 0 0 3px rgba(255,168,199,0.35)}',
  'html[data-tavern-theme="sakura"] .stChatInput{background:rgba(255,255,255,0.40);border-top:1px solid rgba(255,168,199,0.40)}',
  'html[data-tavern-theme="sakura"] .stBtn{background:rgba(255,255,255,0.82);border:1px solid rgba(255,168,199,0.60);border-radius:999px;color:#c2477c;transition:box-shadow 0.18s ease,transform 0.18s ease}',
  'html[data-tavern-theme="sakura"] .stBtn:hover{background:#fff;transform:translateY(-1px);box-shadow:0 6px 16px rgba(255,122,168,0.25)}',
  'html[data-tavern-theme="sakura"] .stBtnPrimary{background:linear-gradient(135deg,#ff9dc0,#ff7aa8);border-color:transparent;color:#fff;box-shadow:0 8px 20px rgba(255,122,168,0.42)}',
  'html[data-tavern-theme="sakura"] .stBtnPrimary:hover{background:linear-gradient(135deg,#ffabcd,#ff8ab4);filter:none}',
  'html[data-tavern-theme="sakura"] .stBtnGhost{border-color:rgba(255,168,199,0.55);color:#c98aa6}',
  "",
  "/* sections: white blossom cards on the pink wash */",
  'html[data-tavern-theme="sakura"] .stSection{background:rgba(255,255,255,0.74);border:1px solid rgba(255,168,199,0.45);border-radius:16px;box-shadow:0 8px 22px rgba(214,128,164,0.14)}',
  'html[data-tavern-theme="sakura"] .stSectionHead{background:linear-gradient(90deg,rgba(255,214,229,0.62),rgba(255,255,255,0.20));color:#7a455c}',
  'html[data-tavern-theme="sakura"] .stSectionHead:hover{background:linear-gradient(90deg,rgba(255,200,220,0.75),rgba(255,255,255,0.30))}',
  'html[data-tavern-theme="sakura"] .stSectionHint,',
  'html[data-tavern-theme="sakura"] .stSectionCaret,',
  'html[data-tavern-theme="sakura"] .stLabel,',
  'html[data-tavern-theme="sakura"] .stLiveHint,',
  'html[data-tavern-theme="sakura"] .stLibMeta{color:#9c7c8b}',
  'html[data-tavern-theme="sakura"] .stCheck,',
  'html[data-tavern-theme="sakura"] .stRadio{color:#7a5b69}',
  'html[data-tavern-theme="sakura"] .stResultWrap,',
  'html[data-tavern-theme="sakura"] .stWbEntry,',
  'html[data-tavern-theme="sakura"] .stLibItem{background:rgba(255,255,255,0.78);border:1px solid rgba(255,168,199,0.38);border-radius:14px}',
  'html[data-tavern-theme="sakura"] .stCardName{color:#b8406f;text-shadow:0 2px 10px rgba(255,168,199,0.55)}',
  'html[data-tavern-theme="sakura"] .stCardTag{background:rgba(255,168,199,0.28);color:#a8305f}',
  "",
  "/* chips, radios, sliders and scrollbars stay light and round */",
  'html[data-tavern-theme="sakura"] .stChip{background:rgba(255,255,255,0.80);border:1px solid rgba(255,168,199,0.55);color:#9c7c8b}',
  'html[data-tavern-theme="sakura"] .stChip:hover{border-color:var(--st-accent);color:#c2477c}',
  'html[data-tavern-theme="sakura"] .stChipActive{background:linear-gradient(135deg,#ffb3cd,#ff8ab4);border-color:transparent;color:#fff}',
  'html[data-tavern-theme="sakura"] .stRadio{border:1px solid rgba(255,168,199,0.55);color:#7a5b69}',
  'html[data-tavern-theme="sakura"] .stRadioActive{border-color:var(--st-accent);background:rgba(255,168,199,0.22);color:#a8305f}',
  'html[data-tavern-theme="sakura"] .stSliderVal{background:rgba(255,168,199,0.28);color:#a8305f}',
  'html[data-tavern-theme="sakura"] .stSwatch{box-shadow:0 4px 10px rgba(214,128,164,0.30)}',
  'html[data-tavern-theme="sakura"] .stTrigger{background:linear-gradient(135deg,rgba(255,255,255,0.94),rgba(255,232,241,0.94));border:1px solid rgba(255,168,199,0.70);color:#c2477c;box-shadow:0 8px 20px rgba(214,128,164,0.28)}',
  'html[data-tavern-theme="sakura"] .stRaw,',
  'html[data-tavern-theme="sakura"] .stLivePre,',
  'html[data-tavern-theme="sakura"] .stJsonArea{background:rgba(255,255,255,0.78);border-color:rgba(255,168,199,0.40);border-radius:12px;color:#5c4550}',
  'html[data-tavern-theme="sakura"] .stNotice{background:#fff0f5;border-color:#ffb3cd;color:#a8305f}',
  'html[data-tavern-theme="sakura"] .stEmpty{color:#9c7c8b}',
  'html[data-tavern-theme="sakura"] .stSpinner{border-color:rgba(255,168,199,0.35);border-top-color:var(--st-accent)}',
  'html[data-tavern-theme="sakura"] .stPanel ::-webkit-scrollbar{width:10px;height:10px}',
  'html[data-tavern-theme="sakura"] .stPanel ::-webkit-scrollbar-thumb{background:rgba(255,168,199,0.60);border-radius:999px}',
  'html[data-tavern-theme="sakura"] .stPanel ::-webkit-scrollbar-track{background:rgba(255,240,246,0.60)}'
];
var TERMINAL_CSS = [
  "/* Terminal: pure black, phosphor green monospace, square corners, no shadows. */",
  'html[data-tavern-theme="terminal"]{',
  "  --SmartThemeBodyColor:#c4ffd4;",
  "  --SmartThemeEmColor:#39ff88;",
  "  --SmartThemeQuoteColor:#6fbf8c;",
  "  --SmartThemeUnderlineColor:#39ff88;",
  "  --SmartThemeBlurTintColor:rgba(0,0,0,0.85);",
  "  --SmartThemeChatTintColor:rgba(0,0,0,0.92);",
  "  --SmartThemeUserMesBlurTintColor:rgba(57,255,136,0.10);",
  "  --SmartThemeBotMesBlurTintColor:rgba(0,255,120,0.05);",
  "  --SmartThemeBlurStrength:0px;",
  "  --SmartThemeShadowColor:rgba(0,0,0,0.90);",
  "  --SmartThemeBorderColor:#1f5c33;",
  "  --st-accent:#39ff88;",
  "  --st-accent-2:#1f5c33;",
  "  --st-bg:#000000;",
  "  --st-panel:#000000;",
  "  --st-panel-2:#050b06;",
  "  --st-text:#c4ffd4;",
  "  --st-text-dim:#4f9c68;",
  "  --st-border:#1f5c33;",
  "  --st-msg-user:rgba(57,255,136,0.08);",
  "  --st-msg-char:rgba(0,0,0,0);",
  "  --st-radius:0;",
  "  --st-shadow:none;",
  "}",
  "",
  "/* shell: black glass with a faint CRT line mask, nothing rounded or glowing */",
  'html[data-tavern-theme="terminal"] .stPanel{background:#000000;color:var(--st-text);border-left:2px solid var(--st-accent-2);border-radius:0;box-shadow:none;font-family:"Cascadia Mono","Consolas","DejaVu Sans Mono","Microsoft YaHei",monospace;font-size:13px;line-height:1.7}',
  'html[data-tavern-theme="terminal"] .stPanel::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:repeating-linear-gradient(180deg,rgba(57,255,136,0.035) 0 1px,rgba(0,0,0,0) 1px 3px)}',
  'html[data-tavern-theme="terminal"] .stPanel::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:none}',
  "@keyframes stTerminalBlink{0%,49%{opacity:1}50%,100%{opacity:0}}",
  "",
  "/* head: a prompt line with a blinking block cursor */",
  'html[data-tavern-theme="terminal"] .stPanelHead{background:#000000;border-bottom:1px dashed var(--st-accent-2);border-radius:0}',
  'html[data-tavern-theme="terminal"] .stPanelTitle{color:var(--st-accent);font-weight:700;letter-spacing:0.14em;text-transform:uppercase}',
  'html[data-tavern-theme="terminal"] .stPanelTitle::after{content:"_";margin-left:2px;animation:stTerminalBlink 1.1s steps(1,end) infinite}',
  'html[data-tavern-theme="terminal"] .stClose{color:var(--st-text-dim);border-radius:0}',
  'html[data-tavern-theme="terminal"] .stClose:hover{background:#07160c;color:var(--st-accent)}',
  "",
  "/* tabs: bracketed command words, the active one underscored */",
  'html[data-tavern-theme="terminal"] .stTabbar{background:#000000;border-bottom:1px solid var(--st-accent-2);border-radius:0;gap:2px}',
  'html[data-tavern-theme="terminal"] .stTab{color:var(--st-text-dim);border-radius:0;letter-spacing:0.08em}',
  'html[data-tavern-theme="terminal"] .stTab::before{content:"[ "}',
  'html[data-tavern-theme="terminal"] .stTab::after{content:" ]"}',
  'html[data-tavern-theme="terminal"] .stTab:hover{background:#07160c;color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stTabActive{background:#0a1a0f;color:var(--st-accent);box-shadow:inset 0 -2px 0 var(--st-accent)}',
  "",
  "/* chat: bare black screen with the CRT mask only */",
  'html[data-tavern-theme="terminal"] .stChatLog{background:#000000;background-image:repeating-linear-gradient(180deg,rgba(57,255,136,0.03) 0 1px,rgba(0,0,0,0) 1px 4px)}',
  'html[data-tavern-theme="terminal"] .stChatHead{background:#000000;border-bottom:1px solid var(--st-accent-2);border-radius:0}',
  'html[data-tavern-theme="terminal"] .stChatAvatar{border:1px solid var(--st-accent-2);border-radius:0;background:#050b06;color:var(--st-accent);box-shadow:none}',
  'html[data-tavern-theme="terminal"] .stMsgBubble{border-radius:0;box-shadow:none;line-height:1.65;padding:8px 10px;font-size:13px}',
  'html[data-tavern-theme="terminal"] .stMsgChar .stMsgBubble{background:transparent;border:1px solid var(--st-accent-2);color:var(--st-text)}',
  'html[data-tavern-theme="terminal"] .stMsgChar .stMsgBubble::before{content:"> ";color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stMsgUser .stMsgBubble{background:#07160c;border:1px solid #2b7a45;color:#d8ffe4}',
  'html[data-tavern-theme="terminal"] .stMsgUser .stMsgBubble::before{content:"$ ";color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stMsgAvatar{border:1px solid var(--st-accent-2);border-radius:0}',
  "",
  "/* composer: a bare command line, focus is a hard outline, not a glow */",
  'html[data-tavern-theme="terminal"] .stInput{background:#000000;border:1px solid var(--st-accent-2);border-radius:0;color:var(--st-text);caret-color:var(--st-accent);box-shadow:none}',
  'html[data-tavern-theme="terminal"] .stInput::placeholder{color:#3d7a52}',
  'html[data-tavern-theme="terminal"] .stInput:focus{outline:1px solid var(--st-accent);outline-offset:-1px;border-color:var(--st-accent);box-shadow:none}',
  'html[data-tavern-theme="terminal"] .stChatInput{background:#000000;border-top:1px solid var(--st-accent-2);border-radius:0}',
  'html[data-tavern-theme="terminal"] .stBtn{background:#000000;border:1px solid var(--st-accent-2);border-radius:0;color:var(--st-accent);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;box-shadow:none}',
  'html[data-tavern-theme="terminal"] .stBtn:hover{background:#07160c;border-color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stBtnPrimary{background:var(--st-accent);border-color:var(--st-accent);color:#001a09;font-weight:700;box-shadow:none}',
  'html[data-tavern-theme="terminal"] .stBtnPrimary:hover{background:#5cffa0;filter:none}',
  'html[data-tavern-theme="terminal"] .stBtnGhost{border-color:var(--st-accent-2);color:var(--st-text-dim)}',
  "",
  "/* sections: dashed boxes that look like plain text frames */",
  'html[data-tavern-theme="terminal"] .stSection{background:#000000;border:1px dashed var(--st-accent-2);border-radius:0;box-shadow:none}',
  'html[data-tavern-theme="terminal"] .stSectionHead{background:#050b06;color:var(--st-text);border-radius:0;border-bottom:1px solid var(--st-accent-2)}',
  'html[data-tavern-theme="terminal"] .stSectionHead::before{content:"> "}',
  'html[data-tavern-theme="terminal"] .stSectionHead:hover{background:#0a1a0f}',
  'html[data-tavern-theme="terminal"] .stSectionTitle{letter-spacing:0.06em}',
  'html[data-tavern-theme="terminal"] .stSectionHint,',
  'html[data-tavern-theme="terminal"] .stSectionCaret,',
  'html[data-tavern-theme="terminal"] .stLabel,',
  'html[data-tavern-theme="terminal"] .stLiveHint,',
  'html[data-tavern-theme="terminal"] .stLibMeta{color:var(--st-text-dim)}',
  'html[data-tavern-theme="terminal"] .stCheck,',
  'html[data-tavern-theme="terminal"] .stRadio{color:var(--st-text);border-radius:0}',
  'html[data-tavern-theme="terminal"] .stResultWrap,',
  'html[data-tavern-theme="terminal"] .stWbEntry,',
  'html[data-tavern-theme="terminal"] .stLibItem{background:#000000;border:1px solid var(--st-accent-2);border-radius:0}',
  'html[data-tavern-theme="terminal"] .stCardName{color:var(--st-accent);letter-spacing:0.06em}',
  'html[data-tavern-theme="terminal"] .stCardTag{background:#050b06;color:var(--st-text-dim);border-radius:0}',
  "",
  "/* chips, radios, sliders and scrollbars: square, outlined, unlit */",
  'html[data-tavern-theme="terminal"] .stChip{background:#000000;border:1px solid var(--st-accent-2);border-radius:0;color:var(--st-text-dim)}',
  'html[data-tavern-theme="terminal"] .stChip:hover{border-color:var(--st-accent);color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stChipActive{background:#0a1a0f;border-color:var(--st-accent);color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stRadio{border:1px solid var(--st-accent-2);border-radius:0;color:var(--st-text)}',
  'html[data-tavern-theme="terminal"] .stRadioActive{border-color:var(--st-accent);background:#0a1a0f;color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stSliderVal{background:#050b06;border-radius:0;color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stSwatch{border-radius:0;box-shadow:none}',
  'html[data-tavern-theme="terminal"] .stTrigger{background:#000000;border:1px solid var(--st-accent);border-radius:0;color:var(--st-accent);letter-spacing:0.10em;text-transform:uppercase;box-shadow:none}',
  'html[data-tavern-theme="terminal"] .stRaw,',
  'html[data-tavern-theme="terminal"] .stLivePre,',
  'html[data-tavern-theme="terminal"] .stJsonArea{background:#000000;border-color:var(--st-accent-2);border-radius:0;color:var(--st-text)}',
  'html[data-tavern-theme="terminal"] .stRawSummary{color:var(--st-text-dim)}',
  'html[data-tavern-theme="terminal"] .stNotice{background:#0a1a0f;border-color:var(--st-accent);border-radius:0;color:var(--st-accent)}',
  'html[data-tavern-theme="terminal"] .stEmpty{color:var(--st-text-dim)}',
  'html[data-tavern-theme="terminal"] .stSpinner{border-color:var(--st-accent-2);border-top-color:var(--st-accent);border-radius:0}',
  'html[data-tavern-theme="terminal"] .stPanel ::-webkit-scrollbar{width:8px;height:8px}',
  'html[data-tavern-theme="terminal"] .stPanel ::-webkit-scrollbar-thumb{background:var(--st-accent-2);border-radius:0}',
  'html[data-tavern-theme="terminal"] .stPanel ::-webkit-scrollbar-track{background:#000000}'
];
var NOCTURNE_CSS = [
  "/* Nocturne: deep indigo dusk, low saturation, unhurried reading typography. */",
  'html[data-tavern-theme="nocturne"]{',
  "  --SmartThemeBodyColor:#d3d8ea;",
  "  --SmartThemeEmColor:#a9b2e0;",
  "  --SmartThemeQuoteColor:#8f97bf;",
  "  --SmartThemeUnderlineColor:#7c86b8;",
  "  --SmartThemeBlurTintColor:rgba(60,72,120,0.24);",
  "  --SmartThemeChatTintColor:rgba(18,22,38,0.72);",
  "  --SmartThemeUserMesBlurTintColor:rgba(96,110,180,0.22);",
  "  --SmartThemeBotMesBlurTintColor:rgba(40,48,80,0.28);",
  "  --SmartThemeBlurStrength:14px;",
  "  --SmartThemeShadowColor:rgba(4,6,16,0.55);",
  "  --SmartThemeBorderColor:rgba(126,138,190,0.28);",
  "  --st-accent:#8b93c9;",
  "  --st-accent-2:#6f7bb8;",
  "  --st-bg:#0b0f1d;",
  "  --st-panel:linear-gradient(180deg,#161c31,#101425 62%,#0d1120);",
  "  --st-panel-2:rgba(255,255,255,0.045);",
  "  --st-text:#d3d8ea;",
  "  --st-text-dim:#7a83a6;",
  "  --st-border:rgba(126,138,190,0.28);",
  "  --st-msg-user:linear-gradient(135deg,#3b4478,#2b3159);",
  "  --st-msg-char:rgba(255,255,255,0.05);",
  "  --st-radius:14px;",
  "  --st-glow:0 14px 38px rgba(3,5,14,0.55);",
  "}",
  "",
  "/* shell: a deep gradient sheet with a faint starfield and a breathing glow */",
  'html[data-tavern-theme="nocturne"] .stPanel{background:var(--st-panel);color:var(--st-text);border-left:1px solid rgba(126,138,190,0.22);border-radius:0;box-shadow:-24px 0 70px rgba(3,5,14,0.70),inset 0 1px 0 rgba(255,255,255,0.06);font-family:"Iowan Old Style",Georgia,"Songti SC","Times New Roman",serif;line-height:1.85}',
  'html[data-tavern-theme="nocturne"] .stPanel::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0.50;background-image:radial-gradient(1.5px 1.5px at 18% 22%,rgba(200,214,255,0.55),rgba(0,0,0,0) 65%),radial-gradient(1.5px 1.5px at 74% 44%,rgba(180,196,255,0.45),rgba(0,0,0,0) 65%),radial-gradient(1.5px 1.5px at 38% 78%,rgba(210,220,255,0.38),rgba(0,0,0,0) 65%);background-size:220px 240px;background-repeat:repeat}',
  'html[data-tavern-theme="nocturne"] .stPanel::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(90% 55% at 78% 4%,rgba(120,136,220,0.16),transparent 68%),radial-gradient(80% 50% at 12% 96%,rgba(94,80,168,0.14),transparent 70%);animation:stNocturneBreath 12s ease-in-out infinite}',
  "@keyframes stNocturneBreath{0%,100%{opacity:0.75}50%{opacity:1}}",
  "",
  "/* head: quiet gradient band, wide tracking, no hard rule */",
  'html[data-tavern-theme="nocturne"] .stPanelHead{background:linear-gradient(180deg,rgba(126,138,190,0.14),transparent);border-bottom:1px solid var(--st-border)}',
  'html[data-tavern-theme="nocturne"] .stPanelTitle{color:#e2e6f6;font-weight:600;letter-spacing:0.08em}',
  'html[data-tavern-theme="nocturne"] .stClose{color:var(--st-text-dim);border-radius:8px}',
  'html[data-tavern-theme="nocturne"] .stClose:hover{background:rgba(255,255,255,0.07);color:#e2e6f6}',
  "",
  "/* tabs: no pills, just a slowly lit underline under the active label */",
  'html[data-tavern-theme="nocturne"] .stTabbar{background:transparent;border-bottom:1px solid var(--st-border);gap:2px}',
  'html[data-tavern-theme="nocturne"] .stTab{color:var(--st-text-dim);border-radius:0;letter-spacing:0.06em;padding:8px 14px}',
  'html[data-tavern-theme="nocturne"] .stTab:hover{color:#cfd5ec;background:rgba(139,147,201,0.08)}',
  'html[data-tavern-theme="nocturne"] .stTabActive{background:transparent;color:#eef1fb;box-shadow:inset 0 -1px 0 var(--st-accent);text-shadow:0 0 14px rgba(139,147,201,0.55)}',
  "",
  "/* chat: dusk wash with generous breathing room */",
  'html[data-tavern-theme="nocturne"] .stChatLog{background-image:linear-gradient(180deg,rgba(139,147,201,0.06),rgba(0,0,0,0) 45%);gap:14px}',
  'html[data-tavern-theme="nocturne"] .stChatHead{background:rgba(255,255,255,0.02);border-bottom:1px solid var(--st-border)}',
  'html[data-tavern-theme="nocturne"] .stChatAvatar{border:1px solid rgba(126,138,190,0.35);box-shadow:0 8px 22px rgba(3,5,14,0.55)}',
  'html[data-tavern-theme="nocturne"] .stMsgBubble{border:1px solid rgba(255,255,255,0.07);border-radius:14px;line-height:1.9;font-size:13.5px;box-shadow:var(--st-glow)}',
  'html[data-tavern-theme="nocturne"] .stMsgChar .stMsgBubble{background:var(--st-msg-char);border-top-left-radius:4px;color:var(--st-text)}',
  'html[data-tavern-theme="nocturne"] .stMsgUser .stMsgBubble{background:var(--st-msg-user);border-color:rgba(139,147,201,0.30);border-top-right-radius:4px;color:#eef1fb}',
  'html[data-tavern-theme="nocturne"] .stMsgAvatar{border:1px solid rgba(126,138,190,0.30)}',
  "",
  "/* composer: low-contrast well, focus is a soft widening ring */",
  'html[data-tavern-theme="nocturne"] .stInput{background:rgba(255,255,255,0.045);border:1px solid var(--st-border);border-radius:10px;color:var(--st-text);font-family:"Segoe UI","PingFang SC",system-ui,sans-serif}',
  'html[data-tavern-theme="nocturne"] .stInput::placeholder{color:rgba(122,131,166,0.75)}',
  'html[data-tavern-theme="nocturne"] .stInput:focus{border-color:var(--st-accent);box-shadow:0 0 0 3px rgba(139,147,201,0.18)}',
  'html[data-tavern-theme="nocturne"] .stChatInput{background:rgba(255,255,255,0.02);border-top:1px solid var(--st-border)}',
  'html[data-tavern-theme="nocturne"] .stBtn{background:rgba(255,255,255,0.05);border:1px solid var(--st-border);border-radius:10px;color:var(--st-text);font-family:"Segoe UI","PingFang SC",system-ui,sans-serif;font-size:12px}',
  'html[data-tavern-theme="nocturne"] .stBtn:hover{background:rgba(255,255,255,0.09);border-color:rgba(139,147,201,0.45)}',
  'html[data-tavern-theme="nocturne"] .stBtnPrimary{background:linear-gradient(135deg,#5b6499,#454d80);border-color:rgba(139,147,201,0.45);color:#f2f4fd;box-shadow:0 10px 26px rgba(3,5,14,0.45)}',
  'html[data-tavern-theme="nocturne"] .stBtnPrimary:hover{background:linear-gradient(135deg,#68719f,#4d5590);filter:none}',
  'html[data-tavern-theme="nocturne"] .stBtnGhost{border-color:var(--st-border);color:var(--st-text-dim)}',
  "",
  "/* sections: quiet cards that recede into the dusk */",
  'html[data-tavern-theme="nocturne"] .stSection{background:rgba(255,255,255,0.035);border:1px solid var(--st-border);border-radius:12px;box-shadow:0 12px 30px rgba(3,5,14,0.35)}',
  'html[data-tavern-theme="nocturne"] .stSectionHead{background:linear-gradient(180deg,rgba(139,147,201,0.12),rgba(139,147,201,0.02));color:var(--st-text)}',
  'html[data-tavern-theme="nocturne"] .stSectionHead:hover{background:rgba(139,147,201,0.14)}',
  'html[data-tavern-theme="nocturne"] .stSectionTitle{letter-spacing:0.05em;font-weight:600}',
  'html[data-tavern-theme="nocturne"] .stSectionHint,',
  'html[data-tavern-theme="nocturne"] .stSectionCaret,',
  'html[data-tavern-theme="nocturne"] .stLabel,',
  'html[data-tavern-theme="nocturne"] .stLiveHint,',
  'html[data-tavern-theme="nocturne"] .stLibMeta{color:var(--st-text-dim)}',
  'html[data-tavern-theme="nocturne"] .stCheck,',
  'html[data-tavern-theme="nocturne"] .stRadio{color:#b9c0da}',
  'html[data-tavern-theme="nocturne"] .stResultWrap,',
  'html[data-tavern-theme="nocturne"] .stWbEntry,',
  'html[data-tavern-theme="nocturne"] .stLibItem{background:rgba(255,255,255,0.03);border:1px solid var(--st-border);border-radius:12px}',
  'html[data-tavern-theme="nocturne"] .stCardName{color:#eef1fb;letter-spacing:0.04em;font-weight:600}',
  'html[data-tavern-theme="nocturne"] .stCardTag{background:rgba(139,147,201,0.18);color:#c6cce6}',
  "",
  "/* chips, radios, sliders and scrollbars: muted indigo, never loud */",
  'html[data-tavern-theme="nocturne"] .stChip{background:rgba(255,255,255,0.04);border:1px solid var(--st-border);color:var(--st-text-dim)}',
  'html[data-tavern-theme="nocturne"] .stChip:hover{border-color:rgba(139,147,201,0.50);color:var(--st-text)}',
  'html[data-tavern-theme="nocturne"] .stChipActive{background:rgba(139,147,201,0.22);border-color:var(--st-accent);color:#eef1fb}',
  'html[data-tavern-theme="nocturne"] .stRadio{border:1px solid var(--st-border);color:#b9c0da}',
  'html[data-tavern-theme="nocturne"] .stRadioActive{border-color:var(--st-accent);background:rgba(139,147,201,0.16);color:#eef1fb}',
  'html[data-tavern-theme="nocturne"] .stSliderVal{background:rgba(139,147,201,0.20);border-radius:6px;color:#eef1fb}',
  'html[data-tavern-theme="nocturne"] .stSwatch{box-shadow:0 6px 16px rgba(3,5,14,0.55)}',
  'html[data-tavern-theme="nocturne"] .stTrigger{background:linear-gradient(160deg,rgba(30,37,64,0.94),rgba(16,20,37,0.94));border:1px solid var(--st-border);color:#c6cce6;letter-spacing:0.06em;box-shadow:0 14px 34px rgba(3,5,14,0.60)}',
  'html[data-tavern-theme="nocturne"] .stRaw,',
  'html[data-tavern-theme="nocturne"] .stLivePre,',
  'html[data-tavern-theme="nocturne"] .stJsonArea{background:rgba(6,9,20,0.60);border-color:var(--st-border);border-radius:10px;color:#c2c8e0}',
  'html[data-tavern-theme="nocturne"] .stNotice{background:rgba(122,96,32,0.22);border-color:rgba(190,158,98,0.45);color:#e6cf9c}',
  'html[data-tavern-theme="nocturne"] .stEmpty{color:var(--st-text-dim)}',
  'html[data-tavern-theme="nocturne"] .stSpinner{border-color:rgba(139,147,201,0.20);border-top-color:var(--st-accent)}',
  'html[data-tavern-theme="nocturne"] .stPanel ::-webkit-scrollbar{width:10px;height:10px}',
  'html[data-tavern-theme="nocturne"] .stPanel ::-webkit-scrollbar-thumb{background:rgba(139,147,201,0.30);border-radius:999px}',
  'html[data-tavern-theme="nocturne"] .stPanel ::-webkit-scrollbar-track{background:transparent}'
];
var BUILTIN_THEMES = [
  {
    id: "glass",
    display_name: "\u73BB\u7483\u62DF\u6001",
    author: "DSH Portable Tavern",
    version: "1.0.0",
    description: "\u534A\u900F\u660E\u6BDB\u73BB\u7483\u9762\u677F\u53E0\u52A0\u67D4\u548C\u5149\u6655\u6E10\u53D8\uFF0C\u5706\u89D2\u4E0E\u7EC6\u8FB9\u6846\u6536\u675F\u5C42\u6B21\uFF0C\u754C\u9762\u8F7B\u76C8\u901A\u900F\u3002",
    tags: ["\u6DF1\u8272", "\u73BB\u7483", "\u5706\u89D2", "\u73B0\u4EE3"],
    css: GLASS_CSS.join("\n")
  },
  {
    id: "cyber",
    display_name: "\u8D5B\u535A\u9713\u8679",
    author: "DSH Portable Tavern",
    version: "1.0.0",
    description: "\u6DF1\u9ED1\u5E95\u914D\u9752\u4E0E\u54C1\u7EA2\u53CC\u8272\u9713\u8679\u63CF\u8FB9\uFF0C\u626B\u63CF\u7EBF\u6D41\u52A8\u3001\u5B57\u8DDD\u52A0\u5BBD\uFF0C\u96E8\u591C\u9713\u8679\u8857\u533A\u7684\u5473\u9053\u3002",
    tags: ["\u6DF1\u8272", "\u9713\u8679", "\u8D5B\u535A", "\u79D1\u5E7B"],
    css: CYBER_CSS.join("\n")
  },
  {
    id: "parchment",
    display_name: "\u7F8A\u76AE\u7EB8",
    author: "DSH Portable Tavern",
    version: "1.0.0",
    description: "\u7C73\u9EC4\u7EB8\u7EB9\u4E0E\u886C\u7EBF\u5B57\u4F53\uFF0C\u70EB\u91D1\u5F3A\u8C03\u8272\u914D\u53CC\u7EBF\u5206\u9694\uFF0C\u50CF\u7FFB\u5F00\u4E00\u518C\u65E7\u65E5\u624B\u672D\u3002",
    tags: ["\u6D45\u8272", "\u7EB8\u8D28", "\u886C\u7EBF", "\u590D\u53E4"],
    css: PARCHMENT_CSS.join("\n")
  },
  {
    id: "sakura",
    display_name: "\u6A31\u82B1\u7269\u8BED",
    author: "DSH Portable Tavern",
    version: "1.0.0",
    description: "\u7C89\u767D\u901A\u900F\u914D\u8272\u914D\u98D8\u843D\u82B1\u74E3\uFF0C\u67D4\u548C\u9634\u5F71\u4E0E\u5706\u6DA6\u6C14\u6CE1\uFF0C\u8F7B\u76C8\u5F97\u50CF\u6625\u65E5\u5348\u540E\u3002",
    tags: ["\u6D45\u8272", "\u7C89\u8272", "\u82B1\u74E3", "\u67D4\u548C"],
    css: SAKURA_CSS.join("\n")
  },
  {
    id: "terminal",
    display_name: "\u6781\u7B80\u7EC8\u7AEF",
    author: "DSH Portable Tavern",
    version: "1.0.0",
    description: "\u7EAF\u9ED1\u914D\u8367\u5149\u7EFF\u7B49\u5BBD\u5B57\u4F53\uFF0C\u76F4\u89D2\u8FB9\u6846\u96F6\u9634\u5F71\uFF0C\u65B9\u62EC\u53F7\u6807\u7B7E\u4E0E\u95EA\u70C1\u5149\u6807\u8FD8\u539F CRT \u7EC8\u7AEF\u3002",
    tags: ["\u6DF1\u8272", "\u7EC8\u7AEF", "\u7B49\u5BBD", "\u6781\u7B80"],
    css: TERMINAL_CSS.join("\n")
  },
  {
    id: "nocturne",
    display_name: "\u591C\u66F2",
    author: "DSH Portable Tavern",
    version: "1.0.0",
    description: "\u6DF1\u84DD\u7D2B\u6E10\u53D8\u4F4E\u9971\u548C\u914D\u8272\uFF0C\u886C\u7EBF\u6B63\u6587\u4E0E\u8212\u7F13\u884C\u8DDD\uFF0C\u5B89\u9759\u8010\u770B\u7684\u957F\u65F6\u95F4\u9605\u8BFB\u4E3B\u9898\u3002",
    tags: ["\u6DF1\u8272", "\u4F4E\u9971\u548C", "\u9605\u8BFB", "\u4F18\u96C5"],
    css: NOCTURNE_CSS.join("\n")
  }
];

// src/extensions/store.ts
function extensionsRoot() {
  const home = process.env.DSH_HOME && process.env.DSH_HOME.trim() !== "" ? process.env.DSH_HOME : join(homedir(), ".dsh");
  return join(home, "portable-tavern", "extensions");
}
function extensionDir(id) {
  return join(extensionsRoot(), safeId(id));
}
function safeId(raw) {
  const cleaned = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return cleaned === "" ? "extension" : cleaned;
}
function unzip(buffer) {
  const eocd = findEocd(buffer);
  if (eocd < 0) throw new Error("\u4E0D\u662F\u6709\u6548\u7684 zip \u6587\u4EF6\uFF08\u672A\u627E\u5230\u4E2D\u592E\u76EE\u5F55\uFF09");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 33639248) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name2 = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (name2.endsWith("/")) continue;
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 67324752) continue;
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    try {
      entries.push({ name: name2, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });
    } catch {
    }
  }
  return entries;
}
function findEocd(buffer) {
  const min = Math.max(0, buffer.length - 66e3);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === 101010256) return i;
  }
  return -1;
}
function stripWrapper(entries) {
  if (entries.length === 0) return entries;
  const first = entries[0].name;
  const slash = first.indexOf("/");
  if (slash < 0) return entries;
  const prefix = first.slice(0, slash + 1);
  if (!entries.every((e) => e.name.startsWith(prefix))) return entries;
  return entries.map((e) => ({ name: e.name.slice(prefix.length), data: e.data }));
}
function bindingsOf(clause) {
  const names = [];
  let hasDefault = false;
  const trimmed = clause.trim();
  if (trimmed === "") return { names, hasDefault };
  const braces = /\{([^}]*)\}/.exec(trimmed);
  if (braces) {
    for (const part of braces[1].split(",")) {
      const piece = part.trim();
      if (piece === "") continue;
      const aliased = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(piece);
      names.push(aliased ? aliased[2] : piece);
    }
  }
  const star = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (star) names.push(star[1]);
  const head = trimmed.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, "").replace(/,/g, "").trim();
  if (head !== "" && /^[A-Za-z_$][\w$]*$/.test(head)) hasDefault = true;
  return { names, hasDefault };
}
function escapesRoot(specifier, depth) {
  if (!specifier.startsWith(".")) return false;
  const parts = specifier.split("/");
  let up = 0;
  for (const part of parts) {
    if (part === "..") up++;
    else break;
  }
  return up > depth;
}
function tokenizeLiterals(source) {
  const literals = [];
  let masked = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = i + 1 < n ? source[i + 1] : "";
    if (ch === "/" && next === "/") {
      while (i < n && source[i] !== "\n") {
        masked += " ";
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      masked += "  ";
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        masked += source[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        masked += "  ";
        i += 2;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let raw = ch;
      let content = "";
      i++;
      while (i < n) {
        const c = source[i];
        if (c === "\\") {
          raw += c;
          if (i + 1 < n) {
            raw += source[i + 1];
            content += source[i + 1];
          }
          i += 2;
          continue;
        }
        if (c === quote) break;
        raw += c;
        content += c;
        i++;
      }
      if (i < n) {
        raw += quote;
        i++;
      }
      masked += "\0" + literals.length + "\0";
      literals.push({ raw, content });
      continue;
    }
    masked += ch;
    i++;
  }
  return { masked, literals };
}
function rebuildLiterals(masked, literals) {
  return masked.replace(/\u0000(\d+)\u0000/g, (_whole, digits) => literals[Number(digits)].raw);
}
function specifiersOf(masked, literals) {
  const found = [];
  const take = (indexText) => ({
    specifier: literals[Number(indexText)]?.content ?? "",
    token: "\0" + indexText + "\0"
  });
  const patterns = [
    { re: /(?:^|[^\w$.])import\s+([^;]*?)\s+from\s*\u0000(\d+)\u0000/g, kind: "from" },
    { re: /(?:^|[^\w$.])export\s+([^;]*?)\s+from\s*\u0000(\d+)\u0000/g, kind: "from" },
    { re: /(?:^|[^\w$.])import\s*\u0000(\d+)\u0000/g, kind: "bare" },
    { re: /(?:^|[^\w$.])import\s*\(\s*\u0000(\d+)\u0000\s*\)/g, kind: "bare" }
  ];
  for (const { re, kind } of patterns) {
    let m;
    while ((m = re.exec(masked)) !== null) {
      if (kind === "bare") {
        const hit = take(m[1]);
        if (hit.specifier !== "") found.push({ ...hit, clause: "" });
      } else {
        const hit = take(m[2]);
        if (hit.specifier !== "") found.push({ ...hit, clause: m[1] });
      }
    }
  }
  return found;
}
var HOST_PROVIDED = /* @__PURE__ */ new Set([
  "eventSource",
  "event_types",
  "eventTypes",
  "extension_settings",
  "power_user",
  "saveSettingsDebounced",
  "saveMetadataDebounced",
  "getRequestHeaders",
  "renderTemplateAsync",
  "renderExtensionTemplateAsync",
  "substituteParams",
  "substituteParamsExtended",
  "chat_metadata",
  "chatMetadata",
  "isMobile",
  "DOMPurify",
  "Bowser",
  "accountStorage",
  "SlashCommandParser",
  "SlashCommand",
  "ARGUMENT_TYPE",
  "executeSlashCommands",
  "callGenericPopup",
  "Popup",
  "POPUP_TYPE",
  "POPUP_RESULT",
  "toastr",
  "getContext",
  "characters",
  "this_chid",
  "name1",
  "name2",
  "main_api",
  "onlineStatus",
  "getSlideToggleOptions",
  "initMovingUI",
  "favsToHotswap"
]);
var STUB_FALLBACKS = {
  event_types: "{}",
  eventTypes: "{}",
  extension_settings: "{}",
  power_user: "{}",
  chat_metadata: "{}",
  chatMetadata: "{}",
  characters: "[]",
  this_chid: "undefined",
  name1: '"You"',
  name2: '""',
  main_api: '"dsh"',
  onlineStatus: '"online"',
  isMobile: "false",
  POPUP_TYPE: "{}",
  POPUP_RESULT: "{}",
  ARGUMENT_TYPE: "{}"
};
function stubModule(names, label) {
  const lines = [];
  lines.push("/* Auto-generated by dsh-portable-tavern: the SillyTavern module " + JSON.stringify(label) + " has no counterpart here. */");
  lines.push('const host = (typeof window !== "undefined" && window.__tavernSt) || {}');
  lines.push("const noop = function () { return undefined }");
  lines.push("const missing = function () {");
  lines.push("  if (!missing.warned) { missing.warned = true; console.warn(" + JSON.stringify("[\u4FBF\u643A\u9152\u9986] \u6269\u5C55\u4F9D\u8D56\u7684\u9152\u9986\u5185\u90E8\u6A21\u5757 " + label + " \u5728\u672C\u5BBF\u4E3B\u4E2D\u4E0D\u5B58\u5728\uFF0C\u5DF2\u7528\u7A7A\u5B9E\u73B0\u66FF\u4EE3\u3002") + ") }");
  lines.push("  return undefined");
  lines.push("}");
  lines.push("export const __stubLabel = " + JSON.stringify(label));
  const seen = /* @__PURE__ */ new Set(["__stubLabel", "host", "noop", "missing"]);
  for (const raw of names) {
    const name2 = String(raw || "").trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(name2) || seen.has(name2)) continue;
    seen.add(name2);
    const fallback = STUB_FALLBACKS[name2] ?? "noop";
    if (HOST_PROVIDED.has(name2)) {
      lines.push("export const " + name2 + " = (host." + name2 + " !== undefined ? host." + name2 + " : " + fallback + ")");
    } else {
      lines.push("export const " + name2 + " = " + fallback);
    }
  }
  lines.push("const stub = new Proxy({}, { get: function (_t, key) { return key === Symbol.toPrimitive ? function (v) { return v } : noop } })");
  lines.push("export default stub");
  lines.push("export { missing, host }");
  return lines.join("\n");
}
function rewriteSource(source, depth, extId, escapes, stubs) {
  const { masked, literals } = tokenizeLiterals(source);
  let body = masked;
  const seen = /* @__PURE__ */ new Map();
  for (const { specifier, clause, token } of specifiersOf(masked, literals)) {
    if (specifier.startsWith("http:") || specifier.startsWith("https:") || specifier.startsWith("data:")) continue;
    const bare = !specifier.startsWith(".") && !specifier.startsWith("/");
    const climbs = escapesRoot(specifier, depth);
    if (!bare && !climbs) continue;
    let file = seen.get(specifier);
    if (file === void 0) {
      const { names } = bindingsOf(clause);
      const index = escapes.length + 1;
      file = "__tavern_stub_" + index + ".js";
      seen.set(specifier, file);
      escapes.push({ specifier, names });
      stubs.set(file, stubModule(names, specifier));
    }
    const replacement = "'/tavern-ext/" + extId + "/" + file + "'";
    const newIndex = literals.length;
    literals.push({ raw: replacement, content: replacement });
    body = body.split(token).join("\0" + newIndex + "\0");
  }
  return rebuildLiterals(body, literals);
}
function writeEntries(root, entries) {
  for (const entry of entries) {
    const name2 = String(entry.name ?? "").replace(/\\/g, "/");
    if (name2 === "" || name2.startsWith("/") || /^[A-Za-z]:/.test(name2)) continue;
    if (name2.split("/").some((segment) => segment === ".." || segment === "")) continue;
    const target = join(root, name2);
    const rel = relative(root, target);
    if (rel === "" || rel.startsWith("..") || normalize(rel).startsWith("..")) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.data);
  }
}
function readDirEntries(root) {
  const out = [];
  const walk = (dir) => {
    for (const name2 of readdirSync(dir)) {
      if (name2 === ".git" || name2 === "node_modules") continue;
      const full = join(dir, name2);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!stat.isFile() || stat.size >= 8 * 1024 * 1024) continue;
      out.push({ name: relative(root, full).split(sep).join("/"), data: readFileSync(full) });
    }
  };
  walk(root);
  return out;
}
function locateRoot(entries) {
  const candidates = entries.filter((e) => e.name === "manifest.json" || e.name.endsWith("/manifest.json")).map((e) => e.name === "manifest.json" ? "" : e.name.slice(0, -"manifest.json".length)).sort((a, b) => a.length - b.length);
  return candidates.length > 0 ? candidates[0] : "";
}
function idFromLabel(label) {
  const tail = label.replace(/\/+$/, "").split("/").pop() ?? "extension";
  return safeId(tail.replace(/\.git$/, "").replace(/^SillyTavern-/, ""));
}
async function download(url) {
  let response;
  try {
    response = await fetch(url, { redirect: "follow", headers: { "user-agent": "dsh-portable-tavern" } });
  } catch (error) {
    throw new Error("\u4E0B\u8F7D\u5931\u8D25\uFF08\u7F51\u7EDC\u4E0D\u53EF\u8FBE\uFF09\uFF1A" + (error instanceof Error ? error.message : String(error)));
  }
  if (!response.ok) throw new Error("\u4E0B\u8F7D\u5931\u8D25\uFF1AHTTP " + response.status + " " + url);
  return Buffer.from(await response.arrayBuffer());
}
function githubZipball(url) {
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/#?]+))?\/?$/.exec(url.trim());
  if (!m) return null;
  const ref = m[3] ?? "HEAD";
  return "https://codeload.github.com/" + m[1] + "/" + m[2] + "/zip/" + ref;
}
async function installExtension(request) {
  const warnings = [];
  let entries = [];
  let label = "";
  let source = "";
  if (typeof request.zipBase64 === "string" && request.zipBase64 !== "") {
    const buffer = Buffer.from(request.zipBase64, "base64");
    entries = stripWrapper(unzip(buffer));
    label = request.id ?? "uploaded";
    source = "\u672C\u5730\u4E0A\u4F20\uFF08zip\uFF09";
  } else if (typeof request.url === "string" && request.url.trim() !== "") {
    const url = request.url.trim();
    label = idFromLabel(url);
    if (existsSync(url) && statSync(url).isDirectory()) {
      entries = readDirEntries(url);
      source = "\u672C\u673A\u76EE\u5F55 " + url;
    } else if (/\.json(\?|$)/i.test(url)) {
      const manifestBuffer = await download(url);
      const manifest2 = JSON.parse(manifestBuffer.toString("utf8"));
      entries.push({ name: "manifest.json", data: manifestBuffer });
      const base = url.slice(0, url.lastIndexOf("/") + 1);
      const wanted = [];
      if (typeof manifest2.js === "string") wanted.push(manifest2.js);
      if (typeof manifest2.css === "string") wanted.push(manifest2.css);
      for (const value of Object.values(manifest2.i18n ?? {})) if (typeof value === "string") wanted.push(value);
      for (const rel of wanted) {
        try {
          entries.push({ name: rel.replace(/^\.\//, ""), data: await download(base + rel.replace(/^\.\//, "")) });
        } catch {
          warnings.push("\u6E05\u5355\u58F0\u660E\u7684\u6587\u4EF6\u4E0B\u8F7D\u5931\u8D25\uFF1A" + rel);
        }
      }
      source = "\u6E05\u5355\u5730\u5740 " + url;
    } else {
      const zip = githubZipball(url);
      if (zip === null) throw new Error("\u65E0\u6CD5\u8BC6\u522B\u7684\u5730\u5740\uFF1A\u8BF7\u586B GitHub \u4ED3\u5E93\u5730\u5740\u3001manifest.json \u76F4\u94FE\u3001\u672C\u673A\u76EE\u5F55\u8DEF\u5F84\uFF0C\u6216\u4E0A\u4F20 zip");
      entries = stripWrapper(unzip(await download(zip)));
      source = "GitHub " + url;
    }
  } else {
    throw new Error("\u672A\u63D0\u4F9B\u5B89\u88C5\u6765\u6E90");
  }
  if (entries.length === 0) throw new Error("\u5305\u5185\u6CA1\u6709\u4EFB\u4F55\u6587\u4EF6");
  const root = locateRoot(entries);
  const scoped = root === "" ? entries : entries.map((e) => ({ name: e.name.slice(root.length), data: e.data }));
  const manifestEntry = scoped.find((e) => e.name === "manifest.json");
  if (manifestEntry === void 0) warnings.push("\u5305\u5185\u6CA1\u6709 manifest.json\uFF0C\u5C06\u6309\u7EA6\u5B9A\u731C\u6D4B\u5165\u53E3\u6587\u4EF6");
  let manifest = {};
  if (manifestEntry !== void 0) {
    try {
      manifest = JSON.parse(manifestEntry.data.toString("utf8"));
    } catch {
      warnings.push("manifest.json \u4E0D\u662F\u5408\u6CD5 JSON\uFF0C\u5DF2\u5FFD\u7565");
    }
  }
  const id = safeId(request.id ?? manifest.display_name ?? label);
  const dir = extensionDir(id);
  if (existsSync(dir)) {
    if (request.overwrite !== true) throw new Error("\u540C\u540D\u6269\u5C55\u5DF2\u5B58\u5728\uFF1A" + id + "\uFF08\u52FE\u9009\u8986\u76D6\u53EF\u91CD\u88C5\uFF09");
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
  writeEntries(dir, scoped);
  let js = typeof manifest.js === "string" ? manifest.js.replace(/^\.\//, "") : "";
  if (js === "" || !existsSync(join(dir, js))) {
    const guess = ["index.js", "main.js", "script.js"].find((name2) => existsSync(join(dir, name2)));
    if (guess !== void 0) {
      if (js !== "") warnings.push("\u6E05\u5355\u58F0\u660E\u7684\u5165\u53E3 " + js + " \u4E0D\u5B58\u5728\uFF0C\u5DF2\u6539\u7528 " + guess);
      js = guess;
    } else {
      js = "";
      warnings.push("\u672A\u627E\u5230 JS \u5165\u53E3\uFF0C\u8BE5\u6269\u5C55\u5C06\u4EC5\u52A0\u8F7D\u6837\u5F0F");
    }
  }
  let css = typeof manifest.css === "string" ? manifest.css.replace(/^\.\//, "") : "";
  if (css !== "" && !existsSync(join(dir, css))) {
    warnings.push("\u6E05\u5355\u58F0\u660E\u7684\u6837\u5F0F " + css + " \u4E0D\u5B58\u5728\uFF0C\u5DF2\u5FFD\u7565");
    css = "";
  }
  if (css === "") {
    const guess = ["style.css", "styles.css"].find((name2) => existsSync(join(dir, name2)));
    if (guess !== void 0) css = guess;
  }
  const escapes = [];
  const stubs = /* @__PURE__ */ new Map();
  const walkJs = (current) => {
    for (const name2 of readdirSync(current)) {
      const full = join(current, name2);
      if (statSync(full).isDirectory()) {
        if (name2 === ".git" || name2 === "node_modules") continue;
        walkJs(full);
        continue;
      }
      if (extname(name2) !== ".js" && extname(name2) !== ".mjs") continue;
      if (name2.startsWith("__tavern_stub_")) continue;
      const rel = relative(dir, full).split(sep).join("/");
      const depth = rel.split("/").length - 1;
      const text = readFileSync(full, "utf8");
      const next = rewriteSource(text, depth, id, escapes, stubs);
      if (next !== text) writeFileSync(full, next);
    }
  };
  walkJs(dir);
  for (const [file, body] of stubs) writeFileSync(join(dir, file), body);
  writeFileSync(join(dir, ".tavern-source.json"), JSON.stringify({
    source,
    installedAt: Date.now(),
    escapes: escapes.map((e) => e.specifier)
  }, null, 2));
  const files = [];
  const collect = (current) => {
    for (const name2 of readdirSync(current)) {
      const full = join(current, name2);
      if (statSync(full).isDirectory()) collect(full);
      else files.push(relative(dir, full).split(sep).join("/"));
    }
  };
  collect(dir);
  const extension = describeInstalled(id, {
    manifest,
    js,
    css,
    source,
    files
  });
  return {
    extension,
    report: { warnings, stubs: [...new Set(escapes.map((e) => e.specifier))] }
  };
}
function describeInstalled(id, meta) {
  let description = "";
  try {
    const readme = meta.files.find((f) => /^readme\.md$/i.test(f));
    if (readme !== void 0) {
      description = readFileSync(join(extensionDir(id), readme), "utf8").split(/\r?\n/).filter((line) => line.trim() !== "" && !line.trim().startsWith("#")).slice(0, 2).join(" ").slice(0, 200);
    }
  } catch {
  }
  return {
    id,
    name: meta.manifest.display_name ?? id,
    author: meta.manifest.author ?? "\u672A\u77E5",
    version: meta.manifest.version ?? "0.0.0",
    homePage: meta.manifest.homePage ?? "",
    js: meta.js,
    css: meta.css,
    loadingOrder: typeof meta.manifest.loading_order === "number" ? meta.manifest.loading_order : 100,
    source: meta.source,
    builtin: false,
    base: "/tavern-ext/" + id + "/",
    description,
    files: meta.files
  };
}
function listInstalled() {
  const root = extensionsRoot();
  if (!existsSync(root)) return [];
  const out = [];
  for (const id of readdirSync(root)) {
    const dir = join(root, id);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    try {
      let manifest = {};
      const manifestPath = join(dir, "manifest.json");
      if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      let js = typeof manifest.js === "string" ? manifest.js : "";
      if (js !== "" && !existsSync(join(dir, js))) js = "";
      if (js === "") js = ["index.js", "main.js", "script.js"].find((n) => existsSync(join(dir, n))) ?? "";
      let css = typeof manifest.css === "string" ? manifest.css : "";
      if (css !== "" && !existsSync(join(dir, css))) css = "";
      if (css === "") css = ["style.css", "styles.css"].find((n) => existsSync(join(dir, n))) ?? "";
      let source = "";
      const sourcePath = join(dir, ".tavern-source.json");
      if (existsSync(sourcePath)) {
        try {
          source = String(JSON.parse(readFileSync(sourcePath, "utf8")).source ?? "");
        } catch {
        }
      }
      const files = [];
      const collect = (current) => {
        for (const name2 of readdirSync(current)) {
          const full = join(current, name2);
          if (statSync(full).isDirectory()) collect(full);
          else files.push(relative(dir, full).split(sep).join("/"));
        }
      };
      collect(dir);
      out.push(describeInstalled(id, { manifest, js, css, source: source || "\u672C\u5730\u5B89\u88C5", files }));
    } catch {
    }
  }
  return out.sort((a, b) => a.loadingOrder - b.loadingOrder || a.id.localeCompare(b.id));
}
function paletteOf(css) {
  const wanted = ["--st-bg", "--st-panel", "--st-accent", "--st-text", "--SmartThemeEmColor"];
  const out = [];
  for (const name2 of wanted) {
    const m = new RegExp(name2.replace(/[-]/g, "\\-") + "\\s*:\\s*(#[0-9A-Fa-f]{3,8})").exec(css);
    if (m !== null && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}
function listBuiltin() {
  return BUILTIN_THEMES.map((theme) => ({
    id: theme.id,
    name: theme.display_name,
    author: theme.author,
    version: theme.version,
    homePage: "",
    js: "",
    css: "theme.css",
    loadingOrder: 0,
    source: "\u5185\u7F6E\u4E3B\u9898\u5305",
    builtin: true,
    tags: theme.tags,
    palette: paletteOf(theme.css),
    base: "/tavern-ext/" + theme.id + "/",
    description: theme.description,
    files: ["theme.css"]
  }));
}
function removeExtension(id) {
  const dir = extensionDir(id);
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  return true;
}
function readExtensionFile(id, relativePath) {
  const unified = String(relativePath ?? "").replace(/\\/g, "/");
  const clean = normalize(unified).split(sep).join("/").replace(/^\/+/, "");
  if (clean === "") return null;
  if (clean.split("/").includes("..")) return null;
  const theme = BUILTIN_THEMES.find((t) => t.id === id);
  if (theme !== void 0) {
    if (clean === "theme.css") return { body: Buffer.from(theme.css, "utf8"), type: "text/css; charset=utf-8" };
    if (clean === "manifest.json") {
      return {
        body: Buffer.from(JSON.stringify({
          display_name: theme.display_name,
          author: theme.author,
          version: theme.version,
          css: "theme.css"
        }, null, 2), "utf8"),
        type: "application/json; charset=utf-8"
      };
    }
    return null;
  }
  const dir = extensionDir(id);
  if (!existsSync(dir)) return null;
  const target = resolve(dir, clean);
  const rel = relative(dir, target);
  if (rel.startsWith("..") || resolve(target) === resolve(dir)) return null;
  if (!existsSync(target) || !statSync(target).isFile()) return null;
  return { body: readFileSync(target), type: contentTypeOf(target) };
}
function contentTypeOf(path) {
  switch (extname(path).toLowerCase()) {
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".otf":
      return "font/otf";
    case ".md":
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

// src/routes.ts
var MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
function readCustom(body) {
  const raw = body?.custom;
  if (typeof raw !== "object" || raw === null) return void 0;
  const record = raw;
  const baseUrl = typeof record.baseUrl === "string" ? record.baseUrl.trim() : "";
  const apiKey = typeof record.apiKey === "string" ? record.apiKey.trim() : "";
  const model = typeof record.model === "string" ? record.model.trim() : "";
  if (baseUrl === "" || apiKey === "" || model === "") return void 0;
  if (baseUrl.length > 2e3 || apiKey.length > 500 || model.length > 200) return void 0;
  return { baseUrl, apiKey, model };
}
function readSampling(body) {
  const raw = body?.sampling;
  if (typeof raw !== "object" || raw === null) return DEFAULT_TEMPERATURE_POLICY;
  const record = raw;
  const mode = record.mode;
  if (mode !== "auto" && mode !== "fixed" && mode !== "omit") return DEFAULT_TEMPERATURE_POLICY;
  const value = typeof record.value === "number" && Number.isFinite(record.value) ? Math.min(2, Math.max(0, record.value)) : DEFAULT_TEMPERATURE_POLICY.value;
  return { mode, value };
}
var ATTR_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
function readAttributes(raw) {
  const record = isRecord(raw) ? raw : {};
  const out = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  for (const key of ATTR_KEYS) {
    const value = record[key];
    out[key] = typeof value === "number" && Number.isFinite(value) ? Math.min(30, Math.max(1, Math.round(value))) : 10;
  }
  return out;
}
function readSkills(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 40)) {
    if (!isRecord(item)) continue;
    const name2 = typeof item.name === "string" ? item.name.trim() : "";
    if (name2 === "") continue;
    const attr = ATTR_KEYS.includes(item.attr) ? item.attr : "str";
    const bonus = typeof item.bonus === "number" && Number.isFinite(item.bonus) ? Math.min(30, Math.max(-10, Math.round(item.bonus))) : 0;
    out.push({ name: name2.slice(0, 40), attr, bonus });
  }
  return out;
}
function readRoute(raw) {
  const record = isRecord(raw) ? raw : {};
  const mode = record.mode === "dsh" || record.mode === "custom" ? record.mode : "inherit";
  return {
    mode,
    provider: typeof record.provider === "string" ? record.provider.trim().slice(0, 100) : "",
    model: typeof record.model === "string" ? record.model.trim().slice(0, 200) : "",
    baseUrl: typeof record.baseUrl === "string" ? record.baseUrl.trim().slice(0, 2e3) : "",
    apiKey: typeof record.apiKey === "string" ? record.apiKey.trim().slice(0, 500) : "",
    customModel: typeof record.customModel === "string" ? record.customModel.trim().slice(0, 200) : ""
  };
}
function readMember(raw) {
  if (!isRecord(raw)) return null;
  const name2 = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name2 === "") return null;
  const maxHp = typeof raw.maxHp === "number" && Number.isFinite(raw.maxHp) ? Math.min(9999, Math.max(1, Math.round(raw.maxHp))) : 20;
  const hp = typeof raw.hp === "number" && Number.isFinite(raw.hp) ? Math.min(maxHp, Math.max(0, Math.round(raw.hp))) : maxHp;
  return {
    id: typeof raw.id === "string" && raw.id !== "" ? raw.id : "m" + Math.random().toString(36).slice(2, 8),
    name: name2.slice(0, 60),
    role: typeof raw.role === "string" ? raw.role.trim().slice(0, 60) : "",
    avatar: typeof raw.avatar === "string" ? raw.avatar : "",
    prompt: typeof raw.prompt === "string" ? raw.prompt.slice(0, 4e3) : "",
    attributes: readAttributes(raw.attributes),
    skills: readSkills(raw.skills),
    hp,
    maxHp,
    status: Array.isArray(raw.status) ? raw.status.filter((s) => typeof s === "string").slice(0, 20) : [],
    llm: readRoute(raw.llm)
  };
}
function readParty(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 24)) {
    const member = readMember(item);
    if (member !== null) out.push(member);
  }
  return out;
}
function readOption(raw, index) {
  if (!isRecord(raw)) return null;
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (label === "") return null;
  const attribute = ATTR_KEYS.includes(raw.attribute) ? raw.attribute : "";
  return {
    id: typeof raw.id === "string" && raw.id !== "" ? raw.id : "o" + (index + 1),
    label: label.slice(0, 40),
    attribute,
    skill: typeof raw.skill === "string" ? raw.skill.trim().slice(0, 40) : "",
    difficulty: typeof raw.difficulty === "number" && Number.isFinite(raw.difficulty) ? raw.difficulty : 55,
    modifier: typeof raw.modifier === "number" && Number.isFinite(raw.modifier) ? raw.modifier : 0,
    hint: typeof raw.hint === "string" ? raw.hint.slice(0, 200) : ""
  };
}
function readEncounter(raw) {
  if (!isRecord(raw)) return null;
  const options = (Array.isArray(raw.options) ? raw.options : []).slice(0, 6).map((o, i) => readOption(o, i)).filter((o) => o !== null);
  if (options.length === 0) return null;
  return {
    id: typeof raw.id === "string" ? raw.id : "e1",
    kind: typeof raw.kind === "string" ? raw.kind : "other",
    title: typeof raw.title === "string" ? raw.title.slice(0, 80) : "\u906D\u9047",
    description: typeof raw.description === "string" ? raw.description.slice(0, 600) : "",
    threat: typeof raw.threat === "number" && Number.isFinite(raw.threat) ? Math.min(100, Math.max(0, raw.threat)) : 50,
    options
  };
}
function readPending(raw) {
  if (!isRecord(raw)) return null;
  const option = readOption(raw.option, 0);
  if (option === null) return null;
  if (!isRecord(raw.computed)) return null;
  const computed = raw.computed;
  const required = typeof computed.required === "number" && Number.isFinite(computed.required) ? computed.required : null;
  if (required === null) return null;
  const breakdown = Array.isArray(computed.breakdown) ? computed.breakdown.filter((row) => isRecord(row)).map((row) => ({
    label: typeof row.label === "string" ? row.label : "",
    value: typeof row.value === "number" && Number.isFinite(row.value) ? row.value : 0
  })) : [];
  return {
    memberId: typeof raw.memberId === "string" ? raw.memberId : "",
    option,
    kind: typeof raw.kind === "string" ? raw.kind : "other",
    threat: typeof raw.threat === "number" && Number.isFinite(raw.threat) ? Math.min(100, Math.max(0, raw.threat)) : 50,
    computed: {
      actorId: typeof computed.actorId === "string" ? computed.actorId : "",
      actorName: typeof computed.actorName === "string" ? computed.actorName : "\u89D2\u8272",
      optionId: typeof computed.optionId === "string" ? computed.optionId : option.id,
      optionLabel: typeof computed.optionLabel === "string" ? computed.optionLabel : option.label,
      required,
      breakdown,
      difficultyLabel: typeof computed.difficultyLabel === "string" ? computed.difficultyLabel : "\u666E\u901A"
    }
  };
}
function isLoopbackRequest(request) {
  const address = request.socket.remoteAddress;
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
  const host = request.headers.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL("http://" + host);
  } catch {
    return false;
  }
  if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}
function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "referrer-policy": "no-referrer" });
  res.end(payload);
}
function writeError(res, status, error) {
  writeJson(res, status, { error });
}
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk;
    size += buffer.length;
    if (size > MAX_JSON_BODY_BYTES) return void 0;
    chunks.push(buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function looksLikeSpec(value) {
  if (!isRecord(value)) return false;
  const spec = value;
  return isRecord(spec.basic) && isRecord(spec.appearance) && isRecord(spec.personality) && isRecord(spec.background) && isRecord(spec.dialogue) && isRecord(spec.scenario);
}
function looksLikeCard(value) {
  return isRecord(value) && isRecord(value.data);
}
function makeRoutes(ctx) {
  const guard = (req, res, method) => {
    if (!isLoopbackRequest(req)) {
      writeError(res, 403, "forbidden: loopback-only");
      return false;
    }
    if (req.method !== method) {
      writeError(res, 405, "method not allowed: " + (req.method ?? ""));
      return false;
    }
    return true;
  };
  const routes = [
    {
      kind: "exact",
      path: TAVERN_API.generate,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        if (!looksLikeSpec(body.spec)) {
          writeError(res, 400, "spec \u7F3A\u5C11\u5FC5\u9700\u7684\u8BBE\u5B9A\u5206\u7EC4\uFF08basic/appearance/personality/background/dialogue/scenario\uFF09");
          return;
        }
        const spec = body.spec;
        const version = body.version === "v3" ? "v3" : "v2";
        try {
          const { card, rawText, fallback } = await generateCard(ctx, spec, version, readCustom(body), readSampling(body));
          writeJson(res, 200, { card, rawText, fallback });
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.worldbook,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        if (!looksLikeSpec(body.spec)) {
          writeError(res, 400, "spec \u7F3A\u5C11\u5FC5\u9700\u7684\u8BBE\u5B9A\u5206\u7EC4\uFF08basic/appearance/personality/background/dialogue/scenario\uFF09");
          return;
        }
        const spec = body.spec;
        const card = body.card === null || body.card === void 0 ? null : looksLikeCard(body.card) ? body.card : null;
        try {
          const { entries, rawText } = await generateWorldbook(ctx, spec, card, readCustom(body), readSampling(body));
          writeJson(res, 200, { entries, rawText });
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.models,
      handler: async (req, res) => {
        if (!guard(req, res, "GET")) return;
        try {
          const { options, current } = await listModels(ctx);
          writeJson(res, 200, { options, current, learnedTemperatures: temperatureReport() });
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.chat,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        if (!looksLikeCard(body.card)) {
          writeError(res, 400, "card \u5FC5\u987B\u662F\u5305\u542B data \u5BF9\u8C61\u7684 V2/V3 \u89D2\u8272\u5361");
          return;
        }
        const card = body.card;
        const messages = Array.isArray(body.messages) ? body.messages.filter((m) => isRecord(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") : [];
        const provider = typeof body.provider === "string" ? body.provider : void 0;
        const model = typeof body.model === "string" ? body.model : void 0;
        const globalPrompt = typeof body.globalPrompt === "string" ? body.globalPrompt : void 0;
        try {
          const reply = await chatReply(ctx, card, messages, provider, model, globalPrompt, readCustom(body), readSampling(body));
          writeJson(res, 200, { reply });
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.test,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        const custom = readCustom(body);
        if (custom === void 0) {
          writeError(res, 400, "\u81EA\u5B9A\u4E49\u63A5\u53E3\u672A\u586B\u5199\u5B8C\u6574\uFF08\u5730\u5740 / API Key / \u6A21\u578B\uFF09");
          return;
        }
        try {
          const result = await testCustom(custom, readSampling(body));
          writeJson(res, 200, result);
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    // -----------------------------------------------------------------------
    // tabletop RPG: the system arbitrates, the model narrates
    // -----------------------------------------------------------------------
    {
      kind: "exact",
      path: TAVERN_API.rpgTurn,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        if (!isRecord(body.state)) {
          writeError(res, 400, "state \u5FC5\u987B\u662F\u5305\u542B scene/log \u7684\u8DD1\u56E2\u72B6\u6001\u5BF9\u8C61");
          return;
        }
        const action = typeof body.action === "string" ? body.action.trim() : "";
        if (action === "") {
          writeError(res, 400, "action \u4E0D\u80FD\u4E3A\u7A7A");
          return;
        }
        const request = {
          state: body.state,
          party: readParty(body.party),
          action,
          narratorPrompt: typeof body.narratorPrompt === "string" ? body.narratorPrompt : "",
          provider: typeof body.provider === "string" ? body.provider : void 0,
          model: typeof body.model === "string" ? body.model : void 0,
          sampling: readSampling(body),
          custom: readCustom(body)
        };
        try {
          writeJson(res, 200, await gmTurn(ctx, request));
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.rpgCheck,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        const member = readMember(body.member);
        if (member === null) {
          writeError(res, 400, "member \u4E0D\u662F\u5408\u6CD5\u7684\u961F\u4F0D\u6210\u5458");
          return;
        }
        const encounter = readEncounter(body.encounter);
        if (encounter === null) {
          writeError(res, 400, "encounter \u4E0D\u662F\u5408\u6CD5\u7684\u906D\u9047\u5BF9\u8C61");
          return;
        }
        const optionId = typeof body.optionId === "string" ? body.optionId : "";
        const option = encounter.options.find((o) => o.id === optionId) ?? encounter.options[0];
        if (option === void 0) {
          writeError(res, 400, "\u906D\u9047\u6CA1\u6709\u4EFB\u4F55\u53EF\u9009\u884C\u52A8");
          return;
        }
        const penalty = typeof body.penalty === "number" && Number.isFinite(body.penalty) ? body.penalty : 0;
        try {
          const pending = buildPending(member, option, encounter.kind, encounter.threat, penalty);
          writeJson(res, 200, { pending });
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.rpgRoll,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        const pending = readPending(body.pending);
        if (pending === null) {
          writeError(res, 400, "pending \u4E0D\u662F\u5408\u6CD5\u7684\u5F85\u5224\u5B9A\u5BF9\u8C61");
          return;
        }
        try {
          const roll = 1 + randomInt(0, 100);
          const result = judge(
            pending.computed,
            roll,
            pending.kind,
            pending.threat,
            body.critEnabled !== false
          );
          writeJson(res, 200, result);
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.rpgNarrate,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        if (!isRecord(body.state) || !isRecord(body.result)) {
          writeError(res, 400, "state \u4E0E result \u90FD\u662F\u5FC5\u9700\u5BF9\u8C61");
          return;
        }
        const request = {
          state: body.state,
          party: readParty(body.party),
          action: typeof body.action === "string" ? body.action : "\u5F53\u524D\u884C\u52A8",
          result: body.result,
          narratorPrompt: typeof body.narratorPrompt === "string" ? body.narratorPrompt : "",
          provider: typeof body.provider === "string" ? body.provider : void 0,
          model: typeof body.model === "string" ? body.model : void 0,
          sampling: readSampling(body),
          custom: readCustom(body)
        };
        try {
          writeJson(res, 200, await gmNarrate(ctx, request));
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.rpgMember,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        const member = readMember(body.member);
        if (member === null) {
          writeError(res, 400, "member \u4E0D\u662F\u5408\u6CD5\u7684\u961F\u4F0D\u6210\u5458");
          return;
        }
        const request = {
          member,
          state: isRecord(body.state) ? body.state : { scene: "", turn: 0, log: [], encounter: null, pending: null, inventory: [], facts: [] },
          beat: typeof body.beat === "string" ? body.beat : "",
          instruction: typeof body.instruction === "string" ? body.instruction : "",
          sampling: readSampling(body)
        };
        try {
          writeJson(res, 200, await memberLine(ctx, request));
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    // -----------------------------------------------------------------------
    // SillyTavern extension host
    // -----------------------------------------------------------------------
    {
      kind: "exact",
      path: TAVERN_API.extList,
      handler: (req, res) => {
        if (!guard(req, res, "GET")) return;
        try {
          writeJson(res, 200, { installed: listInstalled(), builtin: listBuiltin() });
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.extCatalog,
      handler: (req, res) => {
        if (!guard(req, res, "GET")) return;
        writeJson(res, 200, {
          entries: [
            { name: "SillyTavern-Not-A-Discord-Theme", url: "https://github.com/IceFog72/SillyTavern-Not-A-Discord-Theme", note: "\u7EAF CSS \u76AE\u80A4\uFF0CDiscord \u98CE\u683C" },
            { name: "SillyTavern-TypefaceR", url: "https://github.com/b4bysw0rld/SillyTavern-TypefaceR", note: "\u5B57\u4F53\u7F8E\u5316\uFF0C\u96F6\u4F9D\u8D56" },
            { name: "SillyTavern-MoonlitEchoesTheme", url: "https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme", note: "\u4E3B\u9898\u6846\u67B6\uFF0C\u5E26\u8BBE\u7F6E\u9762\u677F" },
            { name: "SillyTavern-CustomThemeStyleInputs", url: "https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs", note: "\u4E3B\u9898\u53D8\u91CF\u8F93\u5165\u9762\u677F" },
            { name: "SillyTavern-CharacterStyleCustomizer", url: "https://github.com/Sovex666/SillyTavern-CharacterStyleCustomizer", note: "\u6309\u89D2\u8272\u6CE8\u5165\u6837\u5F0F" },
            { name: "Guinevere-UI-Extension", url: "https://github.com/Bronya-Rand/Guinevere-UI-Extension", note: "UI \u5927\u6539\uFF08\u4F9D\u8D56 jQuery\uFF09" }
          ]
        });
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.extInstall,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        const request = {
          url: typeof body.url === "string" ? body.url : void 0,
          zipBase64: typeof body.zipBase64 === "string" ? body.zipBase64 : void 0,
          id: typeof body.id === "string" ? body.id : void 0,
          overwrite: body.overwrite === true
        };
        if (request.zipBase64 !== void 0 && request.zipBase64.length > 64 * 1024 * 1024) {
          writeError(res, 413, "zip \u8FC7\u5927\uFF08\u4E0A\u9650\u7EA6 48MB\uFF09");
          return;
        }
        try {
          const { extension, report } = await installExtension(request);
          writeJson(res, 200, { ok: true, extension, warnings: report.warnings, stubs: report.stubs });
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.extRemove,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        const id = typeof body.id === "string" ? body.id : "";
        if (id === "") {
          writeError(res, 400, "\u7F3A\u5C11 id");
          return;
        }
        try {
          writeJson(res, 200, { ok: removeExtension(id) });
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.rpgScenario,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        try {
          writeJson(res, 200, await draftScenario(ctx, {
            party: readParty(body.party),
            hint: typeof body.hint === "string" ? body.hint.slice(0, 4e3) : "",
            provider: typeof body.provider === "string" ? body.provider : void 0,
            model: typeof body.model === "string" ? body.model : void 0,
            custom: readCustom(body),
            sampling: readSampling(body)
          }));
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.rpgOutline,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        try {
          writeJson(res, 200, await draftOutline(ctx, {
            party: readParty(body.party),
            premise: typeof body.premise === "string" ? body.premise.slice(0, 6e3) : "",
            count: typeof body.count === "number" ? body.count : 4,
            provider: typeof body.provider === "string" ? body.provider : void 0,
            model: typeof body.model === "string" ? body.model : void 0,
            custom: readCustom(body),
            sampling: readSampling(body)
          }));
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    },
    {
      kind: "exact",
      path: TAVERN_API.chatMember,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        const body = await readJsonBody(req);
        if (body === void 0) {
          writeError(res, 400, "invalid JSON body");
          return;
        }
        const member = readMember(body.member);
        if (member === null) {
          writeError(res, 400, "member \u4E0D\u662F\u5408\u6CD5\u7684\u961F\u4F0D\u6210\u5458");
          return;
        }
        const messages = (Array.isArray(body.messages) ? body.messages : []).filter((m) => isRecord(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-40);
        if (messages.length === 0) {
          writeError(res, 400, "messages \u4E0D\u80FD\u4E3A\u7A7A");
          return;
        }
        const adventure = isRecord(body.adventure) ? {
          scene: typeof body.adventure.scene === "string" ? body.adventure.scene.slice(0, 2e3) : "",
          beat: typeof body.adventure.beat === "string" ? body.adventure.beat.slice(0, 2e3) : "",
          encounter: readEncounter(body.adventure.encounter) === null ? null : {
            title: readEncounter(body.adventure.encounter).title,
            description: readEncounter(body.adventure.encounter).description,
            options: readEncounter(body.adventure.encounter).options.map((o) => o.label)
          }
        } : void 0;
        try {
          writeJson(res, 200, await memberChat(ctx, {
            member,
            messages,
            adventure,
            inherit: isRecord(body.inherit) ? {
              provider: typeof body.inherit.provider === "string" ? body.inherit.provider : void 0,
              model: typeof body.inherit.model === "string" ? body.inherit.model : void 0,
              custom: readCustom({ custom: body.inherit.custom })
            } : void 0,
            sampling: readSampling(body)
          }));
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    }
  ];
  routes.push({
    kind: "prefix",
    path: TAVERN_EXT_BASE,
    handler: (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeError(res, 403, "forbidden: loopback-only");
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        writeError(res, 405, "method not allowed");
        return;
      }
      const url = new URL(req.url ?? "/", "http://x");
      const rest = url.pathname.slice(TAVERN_EXT_BASE.length).replace(/^\/+/, "");
      const slash = rest.indexOf("/");
      const id = slash < 0 ? rest : rest.slice(0, slash);
      const file = slash < 0 ? "" : rest.slice(slash + 1);
      if (id === "" || file === "") {
        writeError(res, 404, "not found");
        return;
      }
      let decoded;
      try {
        decoded = decodeURIComponent(file);
      } catch {
        writeError(res, 400, "malformed path");
        return;
      }
      const found = readExtensionFile(id, decoded);
      if (found === null) {
        writeError(res, 404, "not found");
        return;
      }
      res.writeHead(200, {
        "content-type": found.type,
        "cache-control": "no-cache",
        "referrer-policy": "no-referrer",
        "access-control-allow-origin": "*"
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(found.body);
    }
  });
  return routes;
}

// src/index.ts
var name = "portable-tavern";
var inject = ["webServer", "llm"];
function apply(ctx) {
  const routes = makeRoutes(ctx);
  ctx.effect(
    () => {
      const disposers = routes.map((route) => ctx.webServer.register(route));
      return () => {
        for (const dispose of disposers) dispose();
      };
    },
    "portable-tavern: routes"
  );
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map

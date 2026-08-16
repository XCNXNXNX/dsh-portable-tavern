// src/protocol.ts
var TAVERN_API_BASE = "/api/dsh-portable-tavern";
var TAVERN_API = {
  generate: TAVERN_API_BASE + "/generate",
  worldbook: TAVERN_API_BASE + "/worldbook",
  models: TAVERN_API_BASE + "/models",
  chat: TAVERN_API_BASE + "/chat",
  test: TAVERN_API_BASE + "/test"
};

// src/llm.ts
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
    temperature: options.temperature ?? 0.8,
    max_tokens: options.maxTokens ?? 1600,
    stream: false
  };
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
  const toolCalls = [];
  const chunks = ctx.llm.stream(options);
  for await (const c of chunks) {
    if (c.type === "text-delta") text += c.text;
    else if (c.type === "block-end" && c.block.type === "tool-call") {
      toolCalls.push({ name: c.block.name, arguments: c.block.arguments });
    } else if (c.type === "finish") {
      const r = c.reason;
      if (r.kind === "error" || r.kind === "aborted") {
        throw new Error(r.failure?.message ?? "generation interrupted");
      }
    }
  }
  return { text: text.trim(), toolCalls };
}
async function streamText(ctx, options) {
  const r = await streamCompletion(ctx, options);
  return r.text;
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
      try {
        return JSON.parse(tc.arguments);
      } catch {
      }
    }
  }
  return extractJson(result.text) ?? repairJson(result.text);
}
function wrapCard(data, version, spec) {
  const v = version === "v3" ? "3.0" : "2.0";
  const specKey = version === "v3" ? "chara_card_v3" : "chara_card_v2";
  const d = data ?? {};
  const str = (x) => typeof x === "string" ? x : "";
  const arr = (x) => Array.isArray(x) ? x.filter((i) => typeof i === "string") : [];
  return {
    spec: specKey,
    spec_version: v,
    data: {
      name: str(d.name) || spec.basic.name || "\u672A\u547D\u540D\u89D2\u8272",
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
      creator: str(d.creator) || "dsh-portable-tavern",
      character_version: str(d.character_version) || "1.0",
      extensions: typeof d.extensions === "object" && d.extensions !== null ? d.extensions : {}
    }
  };
}
async function generateCard(ctx, spec, version, custom) {
  const prompt = buildPrompt(spec);
  let result;
  if (customReady(custom)) {
    result = await customComplete(custom, { system: SYSTEM, messages: [{ role: "user", content: prompt }], temperature: 0.85, maxTokens: 3200 });
    let data2 = parseResult(result);
    if (data2 === null) {
      const retryPrompt = prompt + "\n\n\u3010\u518D\u6B21\u5F3A\u8C03\u3011\u8BF7\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5\u7684 JSON \u5BF9\u8C61\u672C\u8EAB\uFF0C\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u3001\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\uFF1B\u5B57\u7B26\u4E32\u91CC\u7684\u6362\u884C\u5FC5\u987B\u7528 \\n \u8F6C\u4E49\u3002";
      result = await customComplete(custom, { system: SYSTEM, messages: [{ role: "user", content: retryPrompt }], temperature: 0.3, maxTokens: 3200 });
      data2 = parseResult(result);
    }
    return { card: wrapCard(data2, version, spec), rawText: result.text, fallback: data2 === null };
  }
  const route = await resolveRoute(ctx);
  result = await streamCompletion(ctx, {
    provider: route.provider,
    model: route.model,
    reasoningEffort: route.reasoningEffort,
    messages: [mkMessage("user", prompt)],
    system: SYSTEM,
    tools: [CARD_TOOL],
    temperature: 0.85,
    maxTokens: 3200
  });
  let data = parseResult(result);
  if (!data) {
    const retryPrompt = prompt + "\n\n\u3010\u518D\u6B21\u5F3A\u8C03\u3011\u8BF7\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5\u7684 JSON \u5BF9\u8C61\u672C\u8EAB\uFF0C\u4E0D\u8981\u8C03\u7528\u5DE5\u5177\u3001\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u3001\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\uFF1B\u5B57\u7B26\u4E32\u91CC\u7684\u6362\u884C\u5FC5\u987B\u7528 \\n \u8F6C\u4E49\u3002";
    result = await streamCompletion(ctx, {
      provider: route.provider,
      model: route.model,
      reasoningEffort: route.reasoningEffort,
      messages: [mkMessage("user", retryPrompt)],
      system: SYSTEM,
      temperature: 0.3,
      maxTokens: 3200
    });
    data = parseResult(result);
  }
  const fallback = data === null;
  return { card: wrapCard(data, version, spec), rawText: result.text, fallback };
}
async function generateWorldbook(ctx, spec, card, custom) {
  const prompt = buildWorldbookPrompt(spec, card);
  let text;
  if (customReady(custom)) {
    text = (await customComplete(custom, { system: SYSTEM, messages: [{ role: "user", content: prompt }], temperature: 0.7, maxTokens: 2200 })).text;
  } else {
    const route = await resolveRoute(ctx);
    text = await streamText(ctx, {
      provider: route.provider,
      model: route.model,
      reasoningEffort: route.reasoningEffort,
      messages: [mkMessage("user", prompt)],
      system: SYSTEM,
      temperature: 0.7,
      maxTokens: 2200
    });
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
async function chatReply(ctx, card, messages, provider, model, globalPrompt, custom) {
  const system = buildChatSystem(card, globalPrompt);
  if (customReady(custom) && (provider === void 0 || provider === "" || provider === "custom")) {
    return (await customComplete(custom, {
      system,
      messages: messages.map((m2) => ({ role: m2.role === "assistant" ? "assistant" : "user", content: m2.content })),
      temperature: 0.9,
      maxTokens: 600
    })).text;
  }
  const route = await resolveRoute(ctx);
  const p = provider && model ? provider : route.provider;
  const m = provider && model ? model : route.model;
  const modelMessages = messages.map((msg) => mkMessage(msg.role === "assistant" ? "assistant" : "user", msg.content, p, m));
  return streamText(ctx, {
    provider: p,
    model: m,
    reasoningEffort: route.reasoningEffort,
    messages: modelMessages,
    system,
    temperature: 0.9,
    maxTokens: 600
  });
}
async function testCustom(custom) {
  const started = Date.now();
  const result = await customComplete(custom, {
    messages: [{ role: "user", content: "\u8BF7\u53EA\u56DE\u590D\u4E24\u4E2A\u5B57\uFF1A\u8FDE\u63A5\u6210\u529F" }],
    temperature: 0,
    maxTokens: 20
  });
  return { ok: true, latencyMs: Date.now() - started, reply: result.text.slice(0, 100) };
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
        const spec = body.spec ?? {};
        const version = body.version === "v3" ? "v3" : "v2";
        try {
          const { card, rawText, fallback } = await generateCard(ctx, spec, version, readCustom(body));
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
        const spec = body.spec ?? {};
        const card = body.card ?? null;
        try {
          const { entries, rawText } = await generateWorldbook(ctx, spec, card, readCustom(body));
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
          writeJson(res, 200, { options, current });
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
        const card = body.card ?? {};
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const provider = typeof body.provider === "string" ? body.provider : void 0;
        const model = typeof body.model === "string" ? body.model : void 0;
        const globalPrompt = typeof body.globalPrompt === "string" ? body.globalPrompt : void 0;
        try {
          const reply = await chatReply(ctx, card, messages, provider, model, globalPrompt, readCustom(body));
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
          const result = await testCustom(custom);
          writeJson(res, 200, result);
        } catch (error) {
          writeError(res, 500, error instanceof Error ? error.message : String(error));
        }
      }
    }
  ];
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

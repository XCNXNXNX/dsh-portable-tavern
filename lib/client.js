window.__ModuleLoader__.load({ id: 'dsh-portable-tavern', factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react8 = require("react");

// src/client/PortableTavern.tsx
var import_react7 = require("react");

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
var INHERIT_ROUTE = {
  mode: "inherit",
  provider: "",
  model: "",
  baseUrl: "",
  apiKey: "",
  customModel: ""
};
function emptyAdventureSetup() {
  return { title: "", premise: "", tone: "", rules: "", outline: [] };
}

// src/client/llm-custom.ts
var KEY = "dsh.portable-tavern.llm.v1";
var SAMPLING_KEY = "dsh.portable-tavern.sampling.v1";
var EMPTY = { baseUrl: "", apiKey: "", model: "", configured: false };
function loadCustomLlm() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    const baseUrl = typeof parsed.baseUrl === "string" ? parsed.baseUrl : "";
    const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
    const model = typeof parsed.model === "string" ? parsed.model : "";
    return { baseUrl, apiKey, model, configured: baseUrl.trim() !== "" && apiKey.trim() !== "" && model.trim() !== "" };
  } catch {
    return { ...EMPTY };
  }
}
function saveCustomLlm(config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
  }
}
function loadSampling() {
  try {
    const raw = localStorage.getItem(SAMPLING_KEY);
    if (raw === null) return { ...DEFAULT_TEMPERATURE_POLICY };
    const parsed = JSON.parse(raw);
    const mode = parsed.mode;
    if (mode !== "auto" && mode !== "fixed" && mode !== "omit") return { ...DEFAULT_TEMPERATURE_POLICY };
    const value = typeof parsed.value === "number" && Number.isFinite(parsed.value) ? Math.min(2, Math.max(0, parsed.value)) : DEFAULT_TEMPERATURE_POLICY.value;
    return { mode, value };
  } catch {
    return { ...DEFAULT_TEMPERATURE_POLICY };
  }
}
function saveSampling(policy) {
  try {
    localStorage.setItem(SAMPLING_KEY, JSON.stringify(policy));
  } catch {
  }
}
function clearCustomLlm() {
  try {
    localStorage.removeItem(KEY);
  } catch {
  }
}
function customLlmPayload() {
  const config = loadCustomLlm();
  return config.configured ? { baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model } : void 0;
}

// src/client/api.ts
var TavernApiError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "TavernApiError";
  }
};
async function readJson(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new TavernApiError("HTTP " + response.status + ": invalid JSON response");
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && typeof body.error === "string" ? body.error : "HTTP " + response.status;
    throw new TavernApiError(message);
  }
  return body;
}
async function post(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}
var TavernApi = class {
  async generate(spec, version) {
    return post(TAVERN_API.generate, { spec, version, custom: customLlmPayload(), sampling: loadSampling() });
  }
  async worldbook(spec, card) {
    return post(TAVERN_API.worldbook, { spec, card, custom: customLlmPayload(), sampling: loadSampling() });
  }
  async models() {
    const response = await fetch(TAVERN_API.models);
    return readJson(response);
  }
  async chat(card, messages, provider, model, globalPrompt) {
    const useCustom = provider === void 0 || provider === "" || provider === "custom";
    return post(TAVERN_API.chat, {
      card,
      messages,
      provider: useCustom ? void 0 : provider,
      model: useCustom ? void 0 : model,
      globalPrompt,
      custom: useCustom ? customLlmPayload() : void 0,
      sampling: loadSampling()
    });
  }
  async test(custom) {
    return post(TAVERN_API.test, { custom, sampling: loadSampling() });
  }
  // -------------------------------------------------------------------------
  // tabletop RPG
  // -------------------------------------------------------------------------
  /** One narrative turn: the GM advances the story or asks for arbitration. */
  async rpgTurn(payload) {
    const useCustom = payload.provider === void 0 || payload.provider === "" || payload.provider === "custom";
    return post(TAVERN_API.rpgTurn, {
      ...payload,
      provider: useCustom ? void 0 : payload.provider,
      model: useCustom ? void 0 : payload.model,
      custom: useCustom ? customLlmPayload() : void 0,
      sampling: loadSampling()
    });
  }
  /** Ask the system to compute what the player must roll. No dice, no model. */
  async rpgCheck(member, encounter, optionId, penalty = 0) {
    return post(TAVERN_API.rpgCheck, { member, encounter, optionId, penalty });
  }
  /** Throw the die. The host owns the RNG and the verdict. */
  async rpgRoll(pending, critEnabled) {
    return post(TAVERN_API.rpgRoll, { pending, critEnabled });
  }
  /** Hand the decided outcome back to the GM, which may only narrate it. */
  async rpgNarrate(payload) {
    const useCustom = payload.provider === void 0 || payload.provider === "" || payload.provider === "custom";
    return post(TAVERN_API.rpgNarrate, {
      ...payload,
      provider: useCustom ? void 0 : payload.provider,
      model: useCustom ? void 0 : payload.model,
      custom: useCustom ? customLlmPayload() : void 0,
      sampling: loadSampling()
    });
  }
  /** One party member speaks on its own model route. */
  async rpgMember(member, state, beat, instruction, globalRoute) {
    return post(TAVERN_API.rpgMember, {
      member,
      state,
      beat,
      instruction,
      // Only meaningful for 'inherit'; harmless otherwise.
      inherit: {
        provider: globalRoute?.provider === "custom" ? void 0 : globalRoute?.provider,
        model: globalRoute?.provider === "custom" ? void 0 : globalRoute?.model,
        custom: globalRoute?.provider === "custom" ? customLlmPayload() : void 0
      },
      sampling: loadSampling()
    });
  }
  /** One turn of a private conversation with a party member. */
  async chatMember(member, messages, adventure, globalRoute) {
    return post(TAVERN_API.chatMember, {
      member,
      messages,
      adventure,
      inherit: {
        provider: globalRoute?.provider === "custom" ? void 0 : globalRoute?.provider,
        model: globalRoute?.provider === "custom" ? void 0 : globalRoute?.model,
        custom: globalRoute?.provider === "custom" ? customLlmPayload() : void 0
      },
      sampling: loadSampling()
    });
  }
  /** Let the AI draft an adventure scenario from the party. */
  async rpgScenario(party, hint, provider, model) {
    const useCustom = provider === void 0 || provider === "" || provider === "custom";
    return post(TAVERN_API.rpgScenario, {
      party,
      hint,
      provider: useCustom ? void 0 : provider,
      model: useCustom ? void 0 : model,
      custom: useCustom ? customLlmPayload() : void 0,
      sampling: loadSampling()
    });
  }
  /** Let the AI draft outline beats whose triggers the system can evaluate. */
  async rpgOutline(party, premise, count, provider, model) {
    const useCustom = provider === void 0 || provider === "" || provider === "custom";
    return post(TAVERN_API.rpgOutline, {
      party,
      premise,
      count,
      provider: useCustom ? void 0 : provider,
      model: useCustom ? void 0 : model,
      custom: useCustom ? customLlmPayload() : void 0,
      sampling: loadSampling()
    });
  }
  // -------------------------------------------------------------------------
  // SillyTavern extension host
  // -------------------------------------------------------------------------
  /** Installed extensions plus the bundled theme pack. */
  async extList() {
    const response = await fetch(TAVERN_API.extList);
    return readJson(response);
  }
  /** A short curated list of community extensions known to be CSS-first. */
  async extCatalog() {
    const response = await fetch(TAVERN_API.extCatalog);
    return readJson(response);
  }
  /** Install from a GitHub repo, a manifest URL, a host directory, or a zip. */
  async extInstall(payload) {
    return post(TAVERN_API.extInstall, payload);
  }
  /** Delete an installed extension from disk. */
  async extRemove(id) {
    return post(TAVERN_API.extRemove, { id });
  }
};

// src/client/ui.tsx
var import_react = require("react");

// src/client/styles.ts
var css = new Proxy({}, { get: (_target, key) => key });
var CSS_TEXT = `
.stRoot{position:fixed;inset:0;z-index:1000;pointer-events:none}
.stTrigger{position:fixed;pointer-events:auto;background:#1b1e25;color:#e8e9ec;border:1px solid #333a47;cursor:grab;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.35);z-index:1001;touch-action:none;user-select:none}
.stTrigger:hover{border-color:var(--st-accent,#4f7cff)}
.stTrigger:active{cursor:grabbing}
.stTriggerDockedLeft{writing-mode:vertical-rl;letter-spacing:1px;border-left:0;border-radius:0 9px 9px 0;padding:13px 7px}
.stTriggerDockedRight{writing-mode:vertical-rl;letter-spacing:1px;border-right:0;border-radius:9px 0 0 9px;padding:13px 7px}
.stTriggerFloat{writing-mode:horizontal-tb;letter-spacing:0;border-radius:12px;padding:10px 14px}
.stPanel{position:fixed;top:0;right:0;height:100vh;width:540px;max-width:94vw;pointer-events:auto;background:#16181d;color:#e8e9ec;border-left:1px solid #262932;box-shadow:-16px 0 48px rgba(0,0,0,0.45);display:flex;flex-direction:column;overflow:hidden;z-index:1001}
.stPanel>*{position:relative;z-index:1}
.stPanelBg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0.16;pointer-events:none;z-index:0}
.stPanelHead{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #262932}
.stPanelTitle{font-size:15px;font-weight:700}
.stStorageWarn{margin-left:8px;font-size:11px;font-weight:700;color:#1b1206;background:#e0a63a;border-radius:999px;padding:2px 9px;cursor:help}
.stTabbar{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid #262932}
.stPanelBody{flex:1;min-height:0;overflow:hidden}
.stChar{height:100%;overflow-y:auto;padding:14px 16px;box-sizing:border-box}
.stResultWrap{margin-top:14px;border:1px solid #262932;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;background:#1b1e25}
.stResultTabs{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid #262932}
.stResultBody{max-height:560px;overflow-y:auto;padding:14px}
.stTab{background:transparent;border:0;color:#9aa0ab;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:13px}
.stTabbar .stTab{flex:1;text-align:center}
.stTabActive{background:#2c313d;color:#fff}
.stClose{margin-left:auto;background:transparent;border:0;color:#9aa0ab;font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px}
.stClose:hover{background:#262932;color:#fff}
.stSection{border:1px solid #262932;border-radius:10px;margin-bottom:10px;background:#1b1e25;overflow:hidden}
.stSectionHead{width:100%;display:flex;align-items:center;gap:8px;background:#20242c;border:0;color:#e8e9ec;padding:10px 14px;cursor:pointer;text-align:left}
.stSectionTitle{font-weight:600;font-size:13px}
.stSectionHint{color:#6f7683;font-size:11px}
.stSectionCaret{margin-left:auto;color:#6f7683}
.stSectionBody{padding:12px 14px;display:flex;flex-direction:column;gap:12px}
.stField{display:flex;flex-direction:column;gap:6px}
.stLabel{color:#9aa0ab;font-size:12px}
.stInput{background:#12141a;border:1px solid #2e323d;color:#e8e9ec;border-radius:7px;padding:7px 10px;font-size:13px;width:100%;box-sizing:border-box}
.stInput:focus{outline:none;border-color:var(--st-accent,#4f7cff)}
.stTextarea{resize:vertical;font-family:inherit;line-height:1.5}
.stRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.stGap{gap:8px;margin-top:8px}
.stSliderRow{display:flex;align-items:center;gap:8px}
.stSlider{flex:1;accent-color:var(--st-accent,#4f7cff)}
.stSliderEnd{color:#9aa0ab;font-size:11px;white-space:nowrap}
.stSliderVal{color:#fff;font-size:12px;min-width:24px;text-align:center;background:#262932;border-radius:5px;padding:1px 6px}
.stCheck{display:inline-flex;align-items:center;gap:5px;color:#c3c7cf;font-size:12px;cursor:pointer;white-space:nowrap}
.stRadioGroup{display:flex;flex-wrap:wrap;gap:6px}
.stRadio{display:inline-flex;align-items:center;gap:5px;color:#c3c7cf;font-size:12px;cursor:pointer;padding:5px 10px;border:1px solid #2e323d;border-radius:7px}
.stRadio input{accent-color:var(--st-accent,#4f7cff)}
.stRadioActive{border-color:var(--st-accent,#4f7cff);color:#fff}
.stChipWrap{display:flex;flex-wrap:wrap;gap:6px}
.stChip{background:#12141a;border:1px solid #2e323d;color:#c3c7cf;border-radius:999px;padding:4px 11px;font-size:12px;cursor:pointer}
.stChip:hover{border-color:var(--st-accent,#4f7cff)}
.stChipActive{background:#35405a;border-color:var(--st-accent,#4f7cff);color:#fff}
.stSwatches{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.stSwatch{width:26px;height:26px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}
.stSwatchActive{border-color:#fff}
.stColorInput{width:30px;height:30px;border:0;background:transparent;cursor:pointer;padding:0}
.stColorText{width:90px}
.stCustomAdd{display:flex;gap:6px;margin-top:6px}
.stBtn{display:inline-flex;align-items:center;background:#2a2f3a;border:1px solid #3a404d;color:#e8e9ec;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer}
.stBtn:hover{background:#333947}
.stBtnPrimary{background:var(--st-accent,#4f7cff);border-color:var(--st-accent,#4f7cff);color:#fff}
.stBtnPrimary:hover{background:var(--st-accent,#4f7cff);filter:brightness(0.9)}
.stBtnGhost{background:transparent}
.stBtnSm{padding:6px 10px;font-size:12px}
.stBtnDisabled{opacity:0.5;cursor:not-allowed}
.stActions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:4px}
.stVerToggle{display:inline-flex;border:1px solid #2e323d;border-radius:8px;overflow:hidden}
.stVerBtn{background:transparent;border:0;color:#9aa0ab;padding:4px 10px;font-size:12px;cursor:pointer}
.stVerActive{background:#3d4250;color:#fff}
.stNotice{color:#ffb84d;font-size:12px;padding:8px 10px;background:#2a2416;border:1px solid #4a3d1f;border-radius:8px;margin:8px 0;width:100%;box-sizing:border-box}
.stEmpty{display:flex;flex-direction:column;align-items:center;gap:12px;color:#9aa0ab;padding:40px 20px;text-align:center}
.stEmptyEmoji{font-size:18px;font-weight:700;color:#6f7683}
.stSpinner{width:28px;height:28px;border:3px solid #2e323d;border-top-color:var(--st-accent,#4f7cff);border-radius:50%}
.stLiveHint{color:#6f7683;font-size:11px;margin-bottom:8px}
.stLivePre{white-space:pre-wrap;word-break:break-word;background:#12141a;border:1px solid #2e323d;border-radius:8px;padding:14px;line-height:1.7;color:#c3c7cf;font-family:inherit;font-size:12px}
.stCardPreview{display:flex;flex-direction:column;gap:12px}
.stCardName{font-size:22px;font-weight:700}
.stCardTags{display:flex;flex-wrap:wrap;gap:6px}
.stCardTag{background:#2a2f3a;color:#c3c7cf;border-radius:999px;padding:2px 10px;font-size:11px}
.stCardBlock{display:flex;flex-direction:column;gap:4px}
.stCardBlockLabel{color:#6f7683;font-size:11px;letter-spacing:0.4px}
.stCardBlockText{white-space:pre-wrap;word-break:break-word;line-height:1.6;color:#d7d9de}
.stEdit{display:flex;flex-direction:column;gap:12px}
.stJsonArea{min-height:420px;font-family:monospace;font-size:12px}
.stRaw{margin:8px 0;border:1px solid #333a47;border-radius:8px;background:#12141a}
.stRawSummary{color:#9aa0ab;font-size:12px;cursor:pointer;padding:8px 12px;user-select:none}
.stRawPre{white-space:pre-wrap;word-break:break-word;padding:12px;margin:0;border-top:1px solid #262932;color:#c3c7cf;font-size:11px;line-height:1.6;max-height:300px;overflow:auto}
.stWbEntry{border:1px solid #262932;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#1b1e25}
.stWbKeys{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}
.stWbKey{background:#35405a;border-radius:5px;padding:1px 8px;font-size:11px;color:#cfe0ff}
.stWbComment{color:#6f7683;font-size:11px;margin-top:4px}
.stTpl{border-top:1px solid #262932;margin-top:12px;padding-top:12px}
.stTplHead{color:#9aa0ab;font-size:12px;margin-bottom:6px}
.stTplItem{display:inline-flex;align-items:center;gap:2px}
.stTplDel{background:transparent;border:0;color:#6f7683;cursor:pointer;font-size:11px;padding:2px}
.stTplDel:hover{color:#ff6b6b}
.stChat{height:100%;display:flex;flex-direction:column}
.stChatHead{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #262932}
.stChatAvatar{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:16px;flex:none}
.stChatMeta{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.stChatName{font-weight:600;font-size:14px}
.stChatModel{font-size:11px;padding:4px 6px;width:auto;max-width:100%}
.stChatLog{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.stMsg{display:flex}
.stMsgUser{justify-content:flex-end}
.stMsgChar{justify-content:flex-start}
.stMsgBubble{max-width:84%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word;line-height:1.6;font-size:13px}
.stMsgChar .stMsgBubble{background:#262b36;color:#e8e9ec;border-top-left-radius:3px}
.stMsgUser .stMsgBubble{background:var(--st-accent,#4f7cff);color:#fff;border-top-right-radius:3px}
.stChatInput{display:flex;gap:8px;padding:12px 16px;border-top:1px solid #262932;align-items:flex-end}
.stChatInput .stTextarea{flex:1;resize:none}
.stChatError{margin:0 16px 8px;width:auto}
.stMusicBar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #262932;background:#1b1e25;flex:none}
.stMusicBar .stAudio{flex:1;min-width:0;height:32px}
.stMusicInfo{font-size:11px;color:#9aa0ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38%}
.stSettingsEntry{display:flex;flex-direction:column;gap:14px;max-width:560px}
.stSettingsTitle{font-size:18px;font-weight:700;color:inherit}
.stSettingsDesc{color:inherit;opacity:0.72;font-size:13px;line-height:1.7;margin:0}
.stChatAvatarImg{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
.stAvatarRow{display:flex;align-items:center;gap:12px}
.stAvatarActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.stAvatarPreview{width:64px;height:64px;border-radius:50%;overflow:hidden;flex:none;border:2px solid #2e323d;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:24px;background:#2a2f3a}
.stAvatarPreviewImg{width:100%;height:100%;object-fit:cover;display:block}
.stCardHead{display:flex;align-items:center;gap:10px}
.stCardAvatar{width:44px;height:44px;border-radius:50%;object-fit:cover;flex:none;border:2px solid #2e323d;display:block}
.stLib{border-top:1px solid #262932;margin-top:12px;padding-top:12px}
.stLibHead{color:#9aa0ab;font-size:12px;margin-bottom:8px}
.stLibItem{display:flex;align-items:center;gap:10px;border:1px solid #262932;border-radius:8px;padding:8px 10px;margin-bottom:6px;background:#1b1e25}
.stLibAvatar{width:30px;height:30px;border-radius:50%;object-fit:cover;display:block;flex:none}
.stLibAvatarFallback{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#2a2f3a;color:#fff;font-weight:700;font-size:13px;flex:none}
.stLibName{flex:1;min-width:0;font-size:13px;color:#e8e9ec;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stLibMeta{color:#6f7683;font-size:11px;flex:none;white-space:nowrap}
.stMsgAvatar{width:26px;height:26px;border-radius:50%;overflow:hidden;flex:none;margin-top:2px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700}
.stMsgAvatarImg{width:100%;height:100%;object-fit:cover;display:block}

/* ---------------------------------------------------------------------------
   SillyTavern theme contract + tabletop surface.

   Every value below is expressed as a variable with the historical literal as
   its fallback, so an unthemed tavern renders exactly as before while a theme
   (built-in or an installed community extension) can restyle the whole surface
   by redefining variables alone. The --SmartTheme* names are the contract the
   SillyTavern beautification ecosystem is written against.
   --------------------------------------------------------------------------- */
:root{
  --SmartThemeBodyColor:#e8e9ec;
  --SmartThemeEmColor:#c9a227;
  --SmartThemeQuoteColor:#8b93a1;
  --SmartThemeUnderlineColor:#4f7cff;
  --SmartThemeBlurTintColor:rgba(22,24,29,0.82);
  --SmartThemeChatTintColor:rgba(18,20,26,0.72);
  --SmartThemeUserMesBlurTintColor:rgba(44,52,70,0.85);
  --SmartThemeBotMesBlurTintColor:rgba(30,35,44,0.85);
  --SmartThemeBlurStrength:10px;
  --SmartThemeShadowColor:rgba(0,0,0,0.45);
  --SmartThemeBorderColor:#262932;
  --st-accent:#4f7cff;
  --st-bg:#16181d;
  --st-panel:#1b1e25;
  --st-panel-2:#20242c;
  --st-text:#e8e9ec;
  --st-text-dim:#9aa0ab;
  --st-border:#262932;
  --st-msg-user:#2c3446;
  --st-msg-char:#1e232c;
  /* Derived, not literal: a theme that only repaints --st-bg still gets a
     matching input/chat surface, which light themes depend on. */
  --st-chat-bg:var(--st-bg);
}
.stPanel{background:var(--st-bg);color:var(--st-text);border-left-color:var(--st-border)}
.stPanelHead,.stTabbar,.stResultTabs{border-bottom-color:var(--st-border)}
.stSection,.stResultWrap,.stLibItem{background:var(--st-panel);border-color:var(--st-border)}
.stSectionHead{background:var(--st-panel-2);color:var(--st-text)}
.stInput{background:var(--st-chat-bg,#12141a);border-color:var(--st-border);color:var(--st-text)}
.stMsgUser .stMsgBubble{background:var(--st-msg-user)}
.stMsgChar .stMsgBubble{background:var(--st-msg-char)}
.stChip,.stRadio{border-color:var(--st-border)}
.stChatLog{background:var(--st-chat-bg,#12141a);border-color:var(--st-border)}
.stBtn{border-color:var(--st-border)}

/* --- tabletop surface --- */
.stRpgHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.stRpgTitle{font-weight:700;font-size:14px}
.stRpgTurn{font-size:11px;color:var(--st-text-dim);background:var(--st-panel-2);border-radius:5px;padding:2px 8px}
.stRpgSpacer{flex:1}
.stRpgParty{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.stRpgChip{display:inline-flex;align-items:center;gap:6px;background:var(--st-panel);border:1px solid var(--st-border);color:var(--st-text);border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer}
.stRpgChip:hover{border-color:var(--st-accent)}
.stRpgChipActive{border-color:var(--st-accent);background:var(--st-panel-2);box-shadow:0 0 0 1px var(--st-accent) inset}
.stRpgLog{border:1px solid var(--st-border);border-radius:10px;background:var(--st-chat-bg,#12141a);padding:12px 14px;max-height:46vh;min-height:140px;overflow-y:auto;margin-bottom:10px}
.stRpgHint{color:var(--st-text-dim);font-size:12px;line-height:1.7}
.stRpgBusy{color:var(--st-accent);font-size:12px;padding:8px 0;animation:stPulse 1.4s ease-in-out infinite}
@keyframes stPulse{0%,100%{opacity:0.45}50%{opacity:1}}
.stRpgCard{border:1px solid var(--st-border);border-left:3px solid var(--st-accent);border-radius:10px;background:var(--st-panel);padding:12px 14px;margin-bottom:10px;display:flex;flex-direction:column;gap:10px}
.stRpgCardTitle{font-weight:700;font-size:14px}
.stRpgCardDesc{font-size:13px;line-height:1.7;color:var(--st-text);opacity:0.9}
.stRpgCardMeta{font-size:11px;color:var(--st-text-dim)}
.stRpgRequired{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.stRpgRequiredLabel{font-size:12px;color:var(--st-text-dim)}
.stRpgRequiredValue{font-size:30px;font-weight:800;color:var(--st-accent);line-height:1;letter-spacing:-1px}
.stRpgBreakdown{display:flex;flex-wrap:wrap;gap:6px}
.stRpgBreakdownRow{font-size:11px;color:var(--st-text-dim);background:var(--st-panel-2);border-radius:5px;padding:3px 8px}
.stRpgBreakdownRow b{color:var(--st-text)}
.stRpgOptions{display:flex;flex-direction:column;gap:8px}
.stRpgOption{display:flex;flex-direction:column;gap:3px;align-items:flex-start;text-align:left;background:var(--st-panel-2);border:1px solid var(--st-border);border-radius:9px;padding:10px 12px;cursor:pointer;color:var(--st-text)}
.stRpgOption:hover:not(:disabled){border-color:var(--st-accent);background:var(--st-panel)}
.stRpgOption:disabled{opacity:0.5;cursor:default}
.stRpgOptionLabel{font-weight:700;font-size:13px}
.stRpgOptionHint{font-size:12px;color:var(--st-text-dim);line-height:1.6}
.stRpgOptionMeta{font-size:10px;color:var(--st-text-dim);letter-spacing:0.5px;text-transform:uppercase}
.stRpgInput{display:flex;gap:8px;align-items:flex-end}
.stRpgInput textarea{flex:1}
.stRpgFacts{display:flex;flex-direction:column;gap:4px;max-height:180px;overflow-y:auto}
.stRpgFact{font-size:12px;color:var(--st-text-dim);border-left:2px solid var(--st-border);padding-left:8px;line-height:1.6}

/* --- extension manager + compat host surfaces --- */
.stExtGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.stExtCard{border:1px solid var(--st-border);border-radius:10px;background:var(--st-panel);padding:10px;display:flex;flex-direction:column;gap:6px;cursor:pointer}
.stExtCardActive{border-color:var(--st-accent);box-shadow:0 0 0 1px var(--st-accent) inset}
.stExtPreview{height:64px;border-radius:7px;border:1px solid var(--st-border)}
.stExtName{font-weight:700;font-size:13px}
.stExtMeta{font-size:11px;color:var(--st-text-dim)}
.stExtDesc{font-size:11.5px;color:var(--st-text-dim);line-height:1.6}
.stExtRow{display:flex;align-items:center;gap:10px;border:1px solid var(--st-border);border-radius:9px;padding:8px 10px;margin-bottom:6px;background:var(--st-panel)}
.stExtRowMain{flex:1;min-width:0}
.stExtLog{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.6;color:var(--st-text-dim);background:var(--st-chat-bg,#12141a);border:1px solid var(--st-border);border-radius:8px;padding:8px 10px;max-height:180px;overflow-y:auto;white-space:pre-wrap}
.stExtMount{border-top:1px solid var(--st-border);margin-top:10px;padding-top:10px}
`;
function adoptStyles() {
  if (typeof document === "undefined") return;
  const id = "dsh-portable-tavern-styles";
  if (document.getElementById(id)) return;
  const tag = document.createElement("style");
  tag.id = id;
  tag.dataset.plugin = "dsh-portable-tavern";
  tag.textContent = CSS_TEXT;
  document.head.appendChild(tag);
}

// src/client/ui.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}
function Section(props) {
  const [open, setOpen] = (0, import_react.useState)(props.defaultOpen !== false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stSection, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: css.stSectionHead, onClick: () => setOpen(!open), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stSectionTitle, children: props.title }),
      props.hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stSectionHint, children: props.hint }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stSectionCaret, children: open ? "-" : "+" })
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stSectionBody, children: props.children }) : null
  ] });
}
function Field(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stField, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stLabel, children: props.label }),
    props.children
  ] });
}
function Slider(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stSliderRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stSliderEnd, children: props.left }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "range", min: props.min, max: props.max, value: props.value, onChange: (e) => props.onChange(Number(e.target.value)), className: css.stSlider }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stSliderEnd, children: props.right }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stSliderVal, children: props.value })
  ] });
}
function RadioGroup(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stRadioGroup, children: props.options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: cx(css.stRadio, props.value === o.value && css.stRadioActive), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", checked: props.value === o.value, onChange: () => props.onChange(o.value) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: o.label })
  ] }, o.value)) });
}
function Chips(props) {
  const multiple = props.multiple === true;
  const values = multiple ? props.values : [props.values];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stChipWrap, children: props.options.map((o) => {
    const active = values.includes(o);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        className: cx(css.stChip, active && css.stChipActive),
        onClick: () => {
          if (multiple) props.onChange(active ? values.filter((v) => v !== o) : [...values, o]);
          else props.onChange(o);
        },
        children: o
      },
      o
    );
  }) });
}
function ColorSwatches(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stSwatches, children: [
    props.palette.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stSwatch, props.value === c && css.stSwatchActive), style: { background: c }, title: c, onClick: () => props.onChange(c) }, c)),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "color", value: props.value, onChange: (e) => props.onChange(e.target.value), className: css.stColorInput, title: "\u81EA\u5B9A\u4E49\u989C\u8272" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: cx(css.stInput, css.stColorText), value: props.value, onChange: (e) => props.onChange(e.target.value) })
  ] });
}
function CustomAdd(props) {
  const [v, setV] = (0, import_react.useState)("");
  const submit = () => {
    const t = v.trim();
    if (t && !props.values.includes(t)) props.onAdd([...props.values, t]);
    setV("");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stCustomAdd, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: css.stInput, value: v, onChange: (e) => setV(e.target.value), placeholder: props.placeholder, onKeyDown: (e) => {
      if (e.key === "Enter") submit();
    } }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stBtn, css.stBtnSm), onClick: submit, children: "\u6DFB\u52A0" })
  ] });
}
function Btn(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      className: cx(css.stBtn, props.variant === "primary" && css.stBtnPrimary, props.variant === "ghost" && css.stBtnGhost, props.disabled && css.stBtnDisabled),
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title,
      children: props.children
    }
  );
}
function fileToAvatar(file, cb, max = 256) {
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) {
          cb(src);
          return;
        }
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext("2d");
        if (!g) {
          cb(src);
          return;
        }
        g.drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        cb(src);
      }
    };
    img.onerror = () => cb(src);
    img.src = src;
  };
  reader.onerror = () => cb("");
  reader.readAsDataURL(file);
}
function AvatarPicker(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stAvatarRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stAvatarPreview, style: props.avatar ? void 0 : { background: props.fallbackGradient }, children: props.avatar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { className: css.stAvatarPreviewImg, src: props.avatar, alt: props.name }) : (props.name || "?").slice(0, 1) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stAvatarActions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: css.stBtn, children: [
        "\u4E0A\u4F20\u56FE\u7247",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "file",
            accept: "image/*",
            style: { display: "none" },
            onChange: (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              fileToAvatar(file, (url) => {
                if (url) props.onChange(url);
              }, props.size ?? 256);
            }
          }
        )
      ] }),
      props.avatar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: () => props.onChange(""), children: "\u6E05\u9664" }) : null
    ] })
  ] });
}
function downloadFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// src/client/panels/ChatPanel.tsx
var import_react2 = require("react");

// src/client/party.ts
var PARTIES_KEY = "dsh.portable-tavern.parties.v1";
var ACTIVE_KEY = "dsh.portable-tavern.activeParty.v1";
var SESSION_KEY = "dsh.portable-tavern.rpg.v1";
var CURRENT_KEY = "dsh.portable-tavern.party.current.v1";
var PARTY_ATTRS = [
  { id: "str", label: "\u529B\u91CF", short: "STR", blurb: "\u8FD1\u6218\u3001\u8D1F\u91CD\u3001\u86EE\u529B\u7834\u969C" },
  { id: "dex", label: "\u654F\u6377", short: "DEX", blurb: "\u95EA\u907F\u3001\u6F5C\u884C\u3001\u9003\u8DD1\u3001\u5148\u624B" },
  { id: "con", label: "\u4F53\u8D28", short: "CON", blurb: "\u6297\u6BD2\u3001\u8010\u75DB\u3001\u957F\u9014\u8DCB\u6D89" },
  { id: "int", label: "\u667A\u529B", short: "INT", blurb: "\u5B66\u8BC6\u3001\u89E3\u8C1C\u3001\u6CD5\u672F\u89E3\u6790" },
  { id: "wis", label: "\u611F\u77E5", short: "WIS", blurb: "\u5BDF\u89C9\u3001\u76F4\u89C9\u3001\u8FFD\u8E2A" },
  { id: "cha", label: "\u9B45\u529B", short: "CHA", blurb: "\u8BF4\u670D\u3001\u8C08\u5224\u3001\u5A01\u5413" }
];
var ROLE_PRESETS = ["\u5251\u58EB", "\u6CD5\u5E08", "\u6E38\u4FA0", "\u76D7\u8D3C", "\u7267\u5E08", "\u541F\u6E38\u8BD7\u4EBA", "\u70BC\u91D1\u672F\u58EB", "\u9A91\u58EB", "\u65A5\u5019", "\u672F\u58EB", "\u6B66\u50E7", "\u9A6F\u517D\u5E08"];
var SKILL_PRESETS = [
  { name: "\u5251\u672F", attr: "str", bonus: 6 },
  { name: "\u683C\u6597", attr: "str", bonus: 6 },
  { name: "\u6500\u722C", attr: "str", bonus: 4 },
  { name: "\u6F5C\u884C", attr: "dex", bonus: 6 },
  { name: "\u95EA\u907F", attr: "dex", bonus: 6 },
  { name: "\u5F00\u9501", attr: "dex", bonus: 4 },
  { name: "\u8010\u529B", attr: "con", bonus: 5 },
  { name: "\u6297\u6BD2", attr: "con", bonus: 4 },
  { name: "\u535A\u5B66", attr: "int", bonus: 5 },
  { name: "\u6CD5\u672F", attr: "int", bonus: 7 },
  { name: "\u70BC\u91D1", attr: "int", bonus: 5 },
  { name: "\u5BDF\u89C9", attr: "wis", bonus: 6 },
  { name: "\u8FFD\u8E2A", attr: "wis", bonus: 5 },
  { name: "\u533B\u672F", attr: "wis", bonus: 4 },
  { name: "\u8BF4\u670D", attr: "cha", bonus: 6 },
  { name: "\u5A01\u5413", attr: "cha", bonus: 5 },
  { name: "\u8868\u6F14", attr: "cha", bonus: 5 }
];
var SKILL_NAMES = SKILL_PRESETS.map((s) => s.name);
var ATTR_BUDGET = 66;
var ATTR_MIN = 6;
var ATTR_MAX = 18;
function attrTotal(attributes) {
  return Object.values(attributes).reduce((a, b) => a + b, 0);
}
function makeMember(index, patch) {
  const base = {
    id: "m" + Date.now().toString(36) + "-" + index + "-" + Math.floor(Math.random() * 1e5).toString(36),
    name: "\u961F\u5458 " + (index + 1),
    role: "",
    avatar: "",
    prompt: "",
    attributes: { str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11 },
    skills: [],
    hp: 20,
    maxHp: 20,
    status: [],
    llm: { ...INHERIT_ROUTE }
  };
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    attributes: { ...base.attributes, ...patch.attributes ?? {} },
    skills: patch.skills ?? base.skills,
    status: patch.status ?? base.status,
    llm: { ...base.llm, ...patch.llm ?? {} }
  };
}
function makeParty(name = "\u65B0\u7684\u961F\u4F0D") {
  return {
    id: "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36),
    name,
    members: [makeMember(0)],
    narratorPrompt: "",
    narrator: { ...INHERIT_ROUTE },
    savedAt: Date.now()
  };
}
function makeRpgState() {
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
function routeLabel(route) {
  if (route.mode === "dsh") return route.model === "" ? "DSH \u6307\u5B9A\u6A21\u578B" : route.model;
  if (route.mode === "custom") return route.customModel === "" ? "\u81EA\u5B9A\u4E49\u63A5\u53E3" : "\u81EA\u5B9A\u4E49 \xB7 " + route.customModel;
  return "\u8DDF\u968F\u5168\u5C40";
}
function loadParties() {
  try {
    const raw = localStorage.getItem(PARTIES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.map((p) => ({ ...p, members: Array.isArray(p.members) ? p.members : [] }));
  } catch {
    return [];
  }
}
function loadActivePartyId() {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? "";
  } catch {
    return "";
  }
}
function saveActivePartyId(id) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
  }
}
function loadCurrentParty() {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw === null) return null;
    return normalizeParty(JSON.parse(raw));
  } catch {
    return null;
  }
}
function loadRpgState() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return {
      scene: typeof parsed.scene === "string" ? parsed.scene : "",
      turn: typeof parsed.turn === "number" ? parsed.turn : 0,
      log: Array.isArray(parsed.log) ? parsed.log : [],
      encounter: parsed.encounter ?? null,
      pending: parsed.pending ?? null,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      setup: parsed.setup ?? emptyAdventureSetup(),
      streak: typeof parsed.streak === "number" ? parsed.streak : 0,
      firedBeats: Array.isArray(parsed.firedBeats) ? parsed.firedBeats : []
    };
  } catch {
    return null;
  }
}
function normalizeParty(raw) {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw;
  if (!Array.isArray(record.members)) return null;
  const members = record.members.map((m, i) => {
    if (typeof m !== "object" || m === null) return null;
    return makeMember(i, m);
  }).filter((m) => m !== null);
  if (members.length === 0) return null;
  return {
    id: typeof record.id === "string" ? record.id : "p" + Date.now().toString(36),
    name: typeof record.name === "string" ? record.name : "\u5BFC\u5165\u7684\u961F\u4F0D",
    members,
    narratorPrompt: typeof record.narratorPrompt === "string" ? record.narratorPrompt : "",
    narrator: { ...INHERIT_ROUTE, ...typeof record.narrator === "object" && record.narrator !== null ? record.narrator : {} },
    savedAt: typeof record.savedAt === "number" ? record.savedAt : Date.now()
  };
}

// src/client/panels/ChatPanel.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var CARD_TARGET = "card";
var CARRY_LIMIT = 6;
var SCENE_LIMIT = 36;
var CUSTOM_MISSING = "\u8BF7\u5148\u5230\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u63A5\u5165\u300D\u586B\u5199\u81EA\u5B9A\u4E49\u63A5\u53E3\uFF08\u5730\u5740 / API Key / \u6A21\u578B\uFF09";
var CHIP_AVATAR = { width: 18, height: 18, fontSize: 10, marginTop: 0 };
var MEMBER_COLUMN = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, maxWidth: "84%", minWidth: 0 };
var MEMBER_LABEL = { color: "var(--st-text-dim)", fontSize: 11, paddingLeft: 2 };
function cleanPlaceholders(s, name) {
  return String(s ?? "").split("{{char}}").join(name || "\u89D2\u8272").split("{{user}}").join("\u4F60");
}
function avatarGradient(spec) {
  const a = spec.appearance;
  return "linear-gradient(135deg," + (a.hairColor || "#8b5a2b") + "," + (a.skinColor || "#f2c9a0") + ")";
}
function memberGradient(seed) {
  const text = seed || "?";
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  const from = hash;
  const to = (hash + 48) % 360;
  return "linear-gradient(135deg, hsl(" + from + ", 66%, 52%), hsl(" + to + ", 70%, 36%))";
}
function initial(name) {
  return (name || "?").slice(0, 1);
}
function sceneSummary(scene) {
  const text = scene.trim();
  if (text === "") return "\u6545\u4E8B\u4ECD\u5728\u7EE7\u7EED";
  return text.length > SCENE_LIMIT ? text.slice(0, SCENE_LIMIT) + "\u2026" : text;
}
function buildPlan(who, messages) {
  const lines = messages.slice(-CARRY_LIMIT).map((m) => m.role === "user" ? "\u6211\uFF1A" + m.content : who + "\uFF1A" + m.content);
  return "\u4E0E " + who + " \u5546\u5B9A\u7684\u8BA1\u5212\uFF1A\n" + lines.join("\n");
}
function splitRoute(chatModel, customModel) {
  const parts = (chatModel || "").split("::");
  if (parts[0] === "custom") return { provider: "custom", model: customModel, isCustom: true };
  if (parts.length >= 2 && parts[0] !== "") return { provider: parts[0], model: parts.slice(1).join("::"), isCustom: false };
  return { isCustom: false };
}
function Avatar(props) {
  const style = {
    ...props.style ?? {},
    ...props.src === "" ? { background: props.gradient } : {}
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: props.className, style, children: props.src === "" ? initial(props.name) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("img", { className: props.imgClassName, src: props.src, alt: props.name }) });
}
function ChatPanel(props) {
  const [input, setInput] = (0, import_react2.useState)("");
  const [sending, setSending] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)("");
  const [carried, setCarried] = (0, import_react2.useState)(false);
  const [clearArmed, setClearArmed] = (0, import_react2.useState)(false);
  const logRef = (0, import_react2.useRef)(null);
  const threadsRef = (0, import_react2.useRef)(props.threads);
  threadsRef.current = props.threads;
  const member = props.party.members.find((m) => m.id === props.target) ?? null;
  const target = member === null ? CARD_TARGET : member.id;
  const messages = props.threads[target] ?? [];
  const memberName = member === null ? "" : member.name || "\u961F\u5458";
  const cardName = props.card === null ? "" : props.card.data.name || "";
  const targetName = member === null ? cardName || "\u89D2\u8272\u5361" : memberName;
  const avatarSrc = member === null ? props.cardAvatar : member.avatar;
  const avatarBg = member === null ? avatarGradient(props.spec) : memberGradient(memberName);
  const isCardEmpty = member === null && props.card === null;
  const adventure = props.adventure;
  const route = splitRoute(props.chatModel, props.customModel);
  (0, import_react2.useEffect)(() => {
    if (props.target !== target) props.onTarget(target);
  }, [props.target, target]);
  (0, import_react2.useEffect)(() => {
    setError("");
    setCarried(false);
    setClearArmed(false);
  }, [target]);
  (0, import_react2.useEffect)(() => {
    if (!clearArmed) return;
    const timer = window.setTimeout(() => setClearArmed(false), 4e3);
    return () => window.clearTimeout(timer);
  }, [clearArmed]);
  (0, import_react2.useEffect)(() => {
    const el = logRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, target]);
  const setThread = (key, next) => {
    props.onThreads({ ...threadsRef.current, [key]: next });
  };
  const onSend = () => {
    const text = input.trim();
    if (text === "" || sending) return;
    if (isCardEmpty) return;
    if (route.isCustom && (member === null || member.llm.mode === "inherit") && !props.customConfigured) {
      setError(CUSTOM_MISSING);
      return;
    }
    const next = [...messages, { role: "user", content: text }];
    setThread(target, next);
    setInput("");
    setSending(true);
    setError("");
    const done = (reply) => {
      setThread(target, [...next, { role: "assistant", content: reply }]);
    };
    if (member !== null) {
      void props.api.chatMember(member, next, adventure, { provider: route.provider, model: route.model }).then((res) => done(res.reply)).catch((e) => setError(e instanceof Error ? e.message : "\u56DE\u590D\u5931\u8D25")).finally(() => setSending(false));
      return;
    }
    const card = props.card;
    if (card === null) return;
    void props.api.chat(card, next, route.provider, route.model, props.globalPrompt).then((res) => done(res.reply)).catch((e) => setError(e instanceof Error ? e.message : "\u56DE\u590D\u5931\u8D25")).finally(() => setSending(false));
  };
  const onClear = () => {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    setError("");
    setCarried(false);
    if (member !== null) {
      setThread(target, []);
      return;
    }
    const card = props.card;
    const greeting = card === null ? "" : cleanPlaceholders(card.data.first_mes, card.data.name);
    setThread(target, greeting === "" ? [] : [{ role: "assistant", content: greeting }]);
  };
  const onCarry = () => {
    if (messages.length === 0) return;
    props.onCarryPlan(buildPlan(targetName, messages));
    setCarried(true);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.stChat, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.stChipWrap, style: { flex: "none", padding: "10px 16px 0", maxHeight: 96, overflowY: "auto" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          type: "button",
          className: cx(css.stChip, member === null && css.stChipActive),
          style: isCardEmpty ? { display: "inline-flex", alignItems: "center", gap: 6, opacity: 0.5, cursor: "not-allowed" } : { display: "inline-flex", alignItems: "center", gap: 6 },
          disabled: isCardEmpty,
          title: isCardEmpty ? "\u8FD8\u6CA1\u6709\u89D2\u8272\u5361" : cardName || "\u89D2\u8272\u5361",
          onClick: () => props.onTarget(CARD_TARGET),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Avatar, { src: isCardEmpty ? "" : props.cardAvatar, name: cardName, gradient: avatarGradient(props.spec), className: css.stMsgAvatar, imgClassName: css.stMsgAvatarImg, style: CHIP_AVATAR }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: isCardEmpty ? "\u8FD8\u6CA1\u6709\u89D2\u8272\u5361" : cardName || "\u672A\u547D\u540D\u89D2\u8272" })
          ]
        }
      ),
      props.party.members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          type: "button",
          className: cx(css.stChip, member !== null && member.id === m.id && css.stChipActive),
          style: { display: "inline-flex", alignItems: "center", gap: 6 },
          title: m.role === "" ? m.name || "\u961F\u5458" : (m.name || "\u961F\u5458") + " \xB7 " + m.role,
          onClick: () => props.onTarget(m.id),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Avatar, { src: m.avatar, name: m.name, gradient: memberGradient(m.name), className: css.stMsgAvatar, imgClassName: css.stMsgAvatarImg, style: CHIP_AVATAR }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: m.name || "\u961F\u5458" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "var(--st-text-dim)", fontSize: 10 }, children: routeLabel(m.llm) })
          ]
        },
        m.id
      ))
    ] }),
    props.party.members.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: css.stRpgHint, style: { flex: "none", padding: "8px 16px 0" }, children: "\u961F\u4F0D\u91CC\u8FD8\u6CA1\u6709\u6210\u5458\u3002\u5230\u300C\u961F\u4F0D\u300D\u9875\u6DFB\u52A0\u961F\u53CB\uFF0C\u5C31\u80FD\u5728\u8FD9\u91CC\u548C\u6BCF\u4E2A\u4EBA\u5355\u72EC\u804A\u5929\u3002" }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.stChatHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Avatar, { src: avatarSrc, name: targetName, gradient: avatarBg, className: css.stChatAvatar, imgClassName: css.stChatAvatarImg }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.stChatMeta, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: css.stChatName, children: member === null ? cardName || "\u672A\u547D\u540D\u89D2\u8272" : memberName }),
        member === null ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "var(--st-text-dim)", fontSize: 11 }, children: (member.role === "" ? "" : member.role + " \xB7 ") + routeLabel(member.llm) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { className: cx(css.stInput, css.stChatModel), value: props.chatModel, onChange: (e) => props.onModel(e.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "custom::", children: props.customConfigured ? "\u81EA\u5B9A\u4E49 \xB7 " + props.customModel : "\u81EA\u5B9A\u4E49\u6A21\u578B\uFF08\u672A\u914D\u7F6E\uFF09" }),
          props.modelOptions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "", children: "\u52A0\u8F7D\u6A21\u578B\u2026" }) : null,
          props.modelOptions.map((o) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: o.provider + "::" + o.model, children: o.label }, o.provider + "::" + o.model))
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Btn, { onClick: onClear, title: clearArmed ? "\u518D\u70B9\u4E00\u6B21\u6E05\u7A7A\u5F53\u524D\u76EE\u6807\u7684\u5BF9\u8BDD" : "\u6E05\u7A7A\u5F53\u524D\u76EE\u6807\u7684\u5BF9\u8BDD", children: clearArmed ? "\u786E\u8BA4\u6E05\u7A7A" : "\u6E05\u7A7A" })
    ] }),
    adventure === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.stRpgCard, style: { flex: "none", margin: "10px 16px 0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.stRpgCardTitle, children: [
        "\u5192\u9669\u8FDB\u884C\u4E2D\uFF1A",
        adventure.encounter ? adventure.encounter.title : sceneSummary(adventure.scene)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: css.stRpgHint, children: "\u4F60\u53EF\u4EE5\u5728\u8FD9\u91CC\u548C TA \u5546\u91CF\u5BF9\u7B56\uFF0C\u7136\u540E\u628A\u7ED3\u8BBA\u5E26\u56DE\u5192\u9669\u7A97\u53E3\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Btn,
        {
          variant: "primary",
          disabled: messages.length === 0,
          title: messages.length === 0 ? "\u5148\u804A\u51FA\u70B9\u7ED3\u8BBA\uFF0C\u518D\u5E26\u8FDB\u5192\u9669" : "\u628A\u6700\u8FD1 " + CARRY_LIMIT + " \u6761\u5BF9\u8BDD\u6574\u7406\u6210\u8BA1\u5212",
          onClick: onCarry,
          children: "\u628A\u8BA1\u5212\u5E26\u8FDB\u5192\u9669"
        }
      ) }),
      carried ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { color: "var(--st-accent)", fontSize: 12 }, children: "\u5DF2\u9001\u5230\u5192\u9669\u7A97\u53E3\u7684\u884C\u52A8\u8F93\u5165\u6846" }) : null
    ] }),
    isCardEmpty ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.stEmpty, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: css.stEmptyEmoji, children: "Tavern" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: "\u8FD8\u6CA1\u6709\u89D2\u8272\u3002\u8BF7\u5148\u5230\u300C\u89D2\u8272\u5361\u300D\u9875\u8BBE\u5B9A/\u5BFC\u5165\u89D2\u8272\uFF0C\u518D\u6765\u5F00\u804A\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Btn, { variant: "primary", onClick: props.onGotoCharacter, children: "\u53BB\u521B\u5EFA\u89D2\u8272" })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: css.stChatLog, id: "pt-chat-log", ref: logRef, children: messages.map((m, i) => {
      const isUser = m.role === "user";
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: cx(css.stMsg, isUser ? css.stMsgUser : css.stMsgChar), children: [
        isUser ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Avatar, { src: avatarSrc, name: targetName, gradient: avatarBg, className: css.stMsgAvatar, imgClassName: css.stMsgAvatarImg }),
        isUser || member === null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: css.stMsgBubble, children: m.content }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: MEMBER_COLUMN, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: MEMBER_LABEL, children: memberName }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: css.stMsgBubble, style: { maxWidth: "100%" }, children: m.content })
        ] })
      ] }, i);
    }) }),
    isCardEmpty ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      error === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: cx(css.stNotice, css.stChatError), children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: css.stChatInput, style: { flex: "none" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "textarea",
          {
            className: cx(css.stInput, css.stTextarea),
            rows: 2,
            value: input,
            disabled: sending,
            onChange: (e) => setInput(e.target.value),
            placeholder: member === null ? "\u8F93\u5165\u5BF9\u767D\u6216\u52A8\u4F5C\u2026\uFF08Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C\uFF09" : "\u548C " + memberName + " \u8BF4\u70B9\u4EC0\u4E48\u2026\uFF08Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C\uFF09",
            onKeyDown: (e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Btn, { variant: "primary", disabled: sending || input.trim() === "", onClick: onSend, children: sending ? "\u2026" : "\u53D1\u9001" })
      ] })
    ] })
  ] });
}

// src/client/panels/ExtPanel.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function extrasOf(ext) {
  return ext;
}
var LOG_LIMIT = 100;
var PREVIEW_HEIGHT = 120;
var CARD_MIN = 168;
var SOURCE_HINT = "\u652F\u6301\u4E09\u79CD\u6765\u6E90\uFF1A\n1) GitHub \u4ED3\u5E93\u5730\u5740\uFF1Ahttps://github.com/IceFog72/SillyTavern-Not-A-Discord-Theme\n2) manifest.json \u76F4\u94FE\uFF1Ahttps://example.com/ext/manifest.json\n3) \u672C\u673A\u76EE\u5F55\u7EDD\u5BF9\u8DEF\u5F84\uFF08\u5BBF\u4E3B\u4FA7\uFF0C\u4E0D\u662F\u6D4F\u89C8\u5668\u4FA7\uFF09\uFF1AC:\\ext\\my-extension";
function errText(e) {
  if (e instanceof Error) return e.message;
  return String(e);
}
function hashString(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = h * 33 + text.charCodeAt(i) >>> 0;
  return h;
}
function hashedGradient(id) {
  const h = hashString(id === "" ? "theme" : id);
  const a = h % 360;
  const b = (a + 45 + (h >>> 8) % 90) % 360;
  const c = (a + 200 + (h >>> 16) % 60) % 360;
  return "linear-gradient(120deg, hsl(" + a + " 60% 42%), hsl(" + b + " 55% 28%) 45%, hsl(" + c + " 60% 16%))";
}
function colorsFromText(text) {
  const found = text.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g);
  if (found === null) return [];
  return [...new Set(found.map((c) => c.toLowerCase()))].slice(0, 4);
}
function themeColors(ext) {
  const palette = extrasOf(ext).palette;
  if (Array.isArray(palette)) {
    const list = palette.filter((c) => typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c));
    if (list.length > 0) return list.slice(0, 4);
  }
  return colorsFromText(ext.description || "");
}
function themeGradient(ext) {
  const colors = themeColors(ext);
  if (colors.length === 0) return hashedGradient(ext.id);
  if (colors.length === 1) return "linear-gradient(120deg, " + colors[0] + ", #12141a)";
  return "linear-gradient(120deg, " + colors.join(", ") + ")";
}
function displayTags(ext) {
  const raw = extrasOf(ext).tags;
  if (Array.isArray(raw)) {
    const list = raw.filter((t) => typeof t === "string" && t.trim() !== "");
    if (list.length > 0) return list.slice(0, 6);
  }
  const derived = [];
  derived.push(ext.builtin ? "\u5185\u7F6E" : "\u7B2C\u4E09\u65B9");
  derived.push(ext.js === "" ? "\u7EAF\u6837\u5F0F" : "\u542B\u811A\u672C");
  if (ext.css !== "") derived.push("\u542B CSS");
  const fileCount = Array.isArray(ext.files) ? ext.files.length : 0;
  if (fileCount > 0) derived.push(fileCount + " \u4E2A\u6587\u4EF6");
  return derived;
}
function shortText(text, max) {
  const flat = text.split(/\s+/).join(" ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max) + "\u2026";
}
function sizeText(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}
function ExtPanel(props) {
  const [installed, setInstalled] = (0, import_react3.useState)([]);
  const [builtin, setBuiltin] = (0, import_react3.useState)([]);
  const [catalog, setCatalog] = (0, import_react3.useState)([]);
  const [loading, setLoading] = (0, import_react3.useState)(true);
  const [loadError, setLoadError] = (0, import_react3.useState)("");
  const [refreshKey, setRefreshKey] = (0, import_react3.useState)(0);
  const [previewId, setPreviewId] = (0, import_react3.useState)("");
  const [source, setSource] = (0, import_react3.useState)("");
  const [overwrite, setOverwrite] = (0, import_react3.useState)(false);
  const [installing, setInstalling] = (0, import_react3.useState)(false);
  const [installError, setInstallError] = (0, import_react3.useState)("");
  const [result, setResult] = (0, import_react3.useState)(null);
  const [busy, setBusy] = (0, import_react3.useState)("");
  const [removing, setRemoving] = (0, import_react3.useState)("");
  const [removeError, setRemoveError] = (0, import_react3.useState)("");
  const [zipName, setZipName] = (0, import_react3.useState)("");
  const [zipSize, setZipSize] = (0, import_react3.useState)(0);
  const [zipBase64, setZipBase64] = (0, import_react3.useState)("");
  const [zipError, setZipError] = (0, import_react3.useState)("");
  const loadSeq = (0, import_react3.useRef)(0);
  const zipRef = (0, import_react3.useRef)(null);
  const refresh = () => setRefreshKey((k) => k + 1);
  (0, import_react3.useEffect)(() => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoading(true);
    setLoadError("");
    Promise.all([props.api.extList(), props.api.extCatalog()]).then(([list, cat]) => {
      if (loadSeq.current !== seq) return;
      setInstalled(list.installed);
      setBuiltin(list.builtin);
      setCatalog(cat.entries);
      setLoading(false);
    }).catch((e) => {
      if (loadSeq.current !== seq) return;
      setLoadError("\u8BFB\u53D6\u6269\u5C55\u5217\u8868\u5931\u8D25\uFF1A" + errText(e));
      setLoading(false);
    });
  }, [props.api, refreshKey]);
  const runInstall = async (payload, note) => {
    setInstalling(true);
    setBusy(note);
    setInstallError("");
    setResult(null);
    try {
      const res = await props.api.extInstall({ ...payload, overwrite });
      setResult(res);
      setSource("");
      setZipBase64("");
      setZipName("");
      setZipSize(0);
      if (zipRef.current !== null) zipRef.current.value = "";
      refresh();
      props.onChanged();
    } catch (e) {
      setInstallError("\u5B89\u88C5\u5931\u8D25\uFF1A" + errText(e));
    } finally {
      setInstalling(false);
      setBusy("");
    }
  };
  const installFromSource = async () => {
    const url = source.trim();
    if (url === "") {
      setInstallError("\u8BF7\u5148\u586B\u5199\u6269\u5C55\u6765\u6E90\u3002");
      return;
    }
    await runInstall({ url }, "\u6B63\u5728\u5B89\u88C5\uFF08GitHub \u4ED3\u5E93\u4F1A\u5148\u4E0B\u8F7D zip \u5305\uFF0C\u7A0D\u7B49\u7247\u523B\uFF09\u2026");
  };
  const installFromZip = async () => {
    if (zipBase64 === "") {
      setInstallError("\u8BF7\u5148\u9009\u62E9 zip \u6587\u4EF6\u3002");
      return;
    }
    await runInstall({ zipBase64 }, "\u6B63\u5728\u4E0A\u4F20\u5E76\u5B89\u88C5 zip \u5305\uFF0C\u5927\u6587\u4EF6\u8BF7\u7A0D\u5019\u2026");
  };
  const onZipPick = (e) => {
    const file = e.target.files !== null && e.target.files.length > 0 ? e.target.files[0] : null;
    e.target.value = "";
    if (file === null) return;
    setZipError("");
    setResult(null);
    setZipName(file.name);
    setZipSize(file.size);
    setZipBase64("");
    setBusy("\u6B63\u5728\u8BFB\u53D6 " + file.name + "\uFF08" + sizeText(file.size) + "\uFF09\uFF0C\u5927\u6587\u4EF6\u8BF7\u7A0D\u5019\u2026");
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const comma = text.indexOf(",");
      setZipBase64(comma >= 0 ? text.slice(comma + 1) : text);
      setBusy("");
    };
    reader.onerror = () => {
      setZipError("\u8BFB\u53D6 " + file.name + " \u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\uFF0C\u6216\u6539\u7528\u6765\u6E90\u5730\u5740\u5B89\u88C5\u3002");
      setBusy("");
      setZipName("");
      setZipSize(0);
    };
    reader.readAsDataURL(file);
  };
  const doRemove = async (ext) => {
    const ask = "\u786E\u5B9A\u8981\u5378\u8F7D\u6269\u5C55\u300C" + ext.name + "\u300D\u5417\uFF1F\n\u8BE5\u6269\u5C55\u7684\u76EE\u5F55\u4F1A\u88AB\u5220\u9664\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002";
    if (typeof window !== "undefined" && !window.confirm(ask)) return;
    setRemoving(ext.id);
    setRemoveError("");
    try {
      await props.api.extRemove(ext.id);
      refresh();
      props.onChanged();
    } catch (e) {
      setRemoveError("\u5378\u8F7D\u300C" + ext.name + "\u300D\u5931\u8D25\uFF1A" + errText(e));
    } finally {
      setRemoving("");
    }
  };
  const enabledCount = installed.filter((ext) => props.enabled.includes(ext.id)).length;
  const previewFound = builtin.find((t) => t.id === (previewId !== "" ? previewId : props.theme));
  const previewExt = previewFound === void 0 ? null : previewFound;
  const logLines = props.log.length > LOG_LIMIT ? props.log.slice(props.log.length - LOG_LIMIT) : props.log;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: css.stChar, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stSettingsDesc, children: "\u6269\u5C55\u4EE5\u517C\u5BB9\u6A21\u5F0F\u8FD0\u884C\uFF1A\u7EAF CSS \u7684\u7F8E\u5316\u7C7B\u6269\u5C55\u6700\u7A33\uFF1B\u542B\u811A\u672C\u7684\u6269\u5C55\u4F1A\u7528\u5230\u88AB\u6869\u6389\u7684 SillyTavern \u5185\u90E8\u6A21\u5757\uFF0C\u53EF\u80FD\u53EA\u6709\u90E8\u5206\u529F\u80FD\u53EF\u7528\uFF08\u8BE6\u60C5\u89C1\u5E95\u90E8\u65E5\u5FD7\uFF09\u3002" }),
    loading ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stNotice, children: "\u6B63\u5728\u8BFB\u53D6\u6269\u5C55\u5217\u8868\u2026" }) : null,
    loadError !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stNotice, children: loadError }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: "\u5185\u7F6E\u7F8E\u5316\u4E3B\u9898", hint: "\u968F\u63D2\u4EF6\u81EA\u5E26\uFF0C\u5F00\u7BB1\u5373\u7528", defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLabel, children: "\u4E3B\u9898\u9884\u89C8" + (previewExt === null ? "\uFF1A\u672A\u9009\u62E9\u4E3B\u9898" : "\uFF1A" + previewExt.name + " \xB7 " + previewExt.author) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "div",
          {
            style: {
              height: PREVIEW_HEIGHT,
              borderRadius: 10,
              border: "1px solid #2e323d",
              background: previewExt === null ? "linear-gradient(120deg, #1b1e25, #262b36)" : themeGradient(previewExt),
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 10,
              padding: 12,
              boxSizing: "border-box"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 12, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.65)" }, children: previewExt === null ? "\u70B9\u51FB\u4E0B\u65B9\u4EFB\u610F\u4E3B\u9898\u5361\u7247\u9884\u89C8\u914D\u8272" : previewExt.name + " \xB7 v" + previewExt.version }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 11, color: "#fff", opacity: 0.85, textShadow: "0 1px 3px rgba(0,0,0,0.65)" }, children: props.theme === "" ? "\u5F53\u524D\u65E0\u4E3B\u9898\uFF08\u5BBF\u4E3B\u9ED8\u8BA4\u5916\u89C2\uFF09" : "\u5F53\u524D\u751F\u6548\uFF1A" + props.theme })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: css.stRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Btn, { disabled: props.theme === "", onClick: () => props.onTheme(""), children: "\u6E05\u9664\u4E3B\u9898" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: css.stLabel, children: "\u5171 " + builtin.length + " \u6B3E\u5185\u7F6E\u4E3B\u9898" + (props.theme === "" ? "\uFF0C\u5F53\u524D\u4F7F\u7528\u5BBF\u4E3B\u9ED8\u8BA4\u5916\u89C2" : "\uFF0C\u5F53\u524D\u4F7F\u7528 " + props.theme) })
        ] })
      ] }),
      builtin.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLibHead, children: loading ? "\u6B63\u5728\u8BFB\u53D6\u5185\u7F6E\u4E3B\u9898\u2026" : "\u5185\u7F6E\u4E3B\u9898\u5305\u4E3A\u7A7A\uFF1A\u5F53\u524D\u5BBF\u4E3B\u7248\u672C\u8FD8\u6CA1\u6709\u6253\u5305\u4E3B\u9898\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(" + CARD_MIN + "px, 1fr))", gap: 8 }, children: builtin.map((t) => {
        const active = props.theme === t.id;
        const picked = previewExt !== null && previewExt.id === t.id;
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "div",
          {
            className: css.stWbEntry,
            style: {
              margin: 0,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              cursor: "pointer",
              borderColor: active ? "var(--st-accent, #4f7cff)" : picked ? "#3a404d" : "#262932"
            },
            title: "\u70B9\u51FB\u5361\u7247\u9884\u89C8\u8BE5\u4E3B\u9898\u7684\u914D\u8272",
            onClick: () => setPreviewId(t.id),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 13, fontWeight: 600, color: "#e8e9ec" }, children: t.name }),
                active ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 10, color: "#cfe0ff", background: "#35405a", borderRadius: 999, padding: "1px 7px" }, children: "\u4F7F\u7528\u4E2D" }) : null
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLibMeta, children: t.author + " \xB7 v" + t.version }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { height: 26, borderRadius: 6, border: "1px solid #262932", background: themeGradient(t) } }),
              t.description !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 11, color: "#9aa0ab", lineHeight: 1.6 }, children: shortText(t.description, 96) }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stCardTags, children: displayTags(t).map((tag) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: css.stCardTag, children: tag }, tag)) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stRow, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                Btn,
                {
                  variant: active ? "ghost" : "primary",
                  disabled: active,
                  onClick: () => props.onTheme(t.id),
                  children: active ? "\u4F7F\u7528\u4E2D" : "\u5E94\u7528"
                }
              ) })
            ]
          },
          t.id
        );
      }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: "\u5DF2\u5B89\u88C5\u6269\u5C55", hint: "\u542F\u7528 / \u505C\u7528\u4E0E\u5378\u8F7D", defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: css.stRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: css.stLabel, children: "\u5DF2\u5B89\u88C5 " + installed.length + " \u4E2A\uFF0C\u5176\u4E2D\u542F\u7528 " + enabledCount + " \u4E2A" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Btn, { disabled: loading, onClick: refresh, children: loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0\u5217\u8868" })
      ] }),
      installed.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLibHead, children: loading ? "\u6B63\u5728\u8BFB\u53D6\u5DF2\u5B89\u88C5\u6269\u5C55\u2026" : "\u8FD8\u6CA1\u6709\u5B89\u88C5\u4EFB\u4F55\u6269\u5C55\u3002\u53EF\u5728\u4E0B\u65B9\u4ECE GitHub \u4ED3\u5E93\u3001manifest.json \u76F4\u94FE\u3001\u672C\u673A\u76EE\u5F55\u6216 zip \u5305\u5B89\u88C5\u3002" }) : installed.map((ext) => {
        const on = props.enabled.includes(ext.id);
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: css.stLibItem, style: { alignItems: "flex-start" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: css.stCheck, style: { marginTop: 2 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { type: "checkbox", checked: on, onChange: (e) => props.onToggle(ext.id, e.target.checked) }),
            on ? "\u542F\u7528" : "\u505C\u7528"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 13, fontWeight: 600, color: "#e8e9ec" }, children: ext.name }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: css.stLibMeta, children: ext.author + " \xB7 v" + ext.version }),
              ext.builtin ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 10, color: "#cfe0ff", background: "#35405a", borderRadius: 999, padding: "1px 7px" }, children: "\u5185\u7F6E" }) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLibMeta, style: { whiteSpace: "normal" }, children: "\u6765\u6E90\uFF1A" + (ext.source === "" ? "\u672A\u77E5" : ext.source) + " \xB7 \u5165\u53E3\uFF1A" + (ext.js === "" ? "\u4EC5\u6837\u5F0F" : ext.js) }),
            ext.description !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 11, color: "#9aa0ab", lineHeight: 1.6 }, children: shortText(ext.description, 180) }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stCardTags, children: displayTags(ext).map((tag) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: css.stCardTag, children: tag }, tag)) })
          ] }),
          ext.builtin ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Btn, { variant: "ghost", disabled: removing === ext.id, onClick: () => {
            void doRemove(ext);
          }, children: removing === ext.id ? "\u5378\u8F7D\u4E2D\u2026" : "\u5378\u8F7D" })
        ] }, ext.id);
      }),
      removeError !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stNotice, children: removeError }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: "\u5B89\u88C5\u6269\u5C55", hint: "GitHub \u4ED3\u5E93 / manifest.json \u76F4\u94FE / \u672C\u673A\u76EE\u5F55 / zip \u5305", defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: "\u6269\u5C55\u6765\u6E90\uFF08\u4E09\u79CD\u90FD\u652F\u6301\uFF0C\u7C98\u8D34\u4E00\u884C\u5373\u53EF\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "textarea",
        {
          className: cx(css.stInput, css.stTextarea),
          rows: 3,
          value: source,
          onChange: (e) => setSource(e.target.value),
          placeholder: SOURCE_HINT,
          disabled: installing
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLabel, children: "\u7B2C\u4E09\u79CD\u662F\u672C\u673A\uFF08\u5BBF\u4E3B\uFF09\u7EDD\u5BF9\u8DEF\u5F84\uFF1A\u5BBF\u4E3B\u4F1A\u76F4\u63A5\u4ECE\u8FD0\u884C DSH \u7684\u90A3\u53F0\u673A\u5668\u7684\u76EE\u5F55\u590D\u5236\u6269\u5C55\uFF0C\u6D4F\u89C8\u5668\u6240\u5728\u673A\u5668\u7684\u8DEF\u5F84\u65E0\u6548\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { type: "checkbox", checked: overwrite, onChange: (e) => setOverwrite(e.target.checked), disabled: installing }),
        "\u8986\u76D6\u91CD\u88C5\uFF08\u540C\u540D\u6269\u5C55\u5DF2\u5B58\u5728\u65F6\u5148\u6E05\u7A7A\u65E7\u76EE\u5F55\uFF09"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: css.stRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Btn, { variant: "primary", disabled: installing || source.trim() === "", onClick: () => {
          void installFromSource();
        }, children: installing ? "\u5B89\u88C5\u4E2D\u2026" : "\u5B89\u88C5" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: cx(css.stBtn, installing && css.stBtnDisabled), style: { cursor: installing ? "not-allowed" : "pointer" }, children: [
          "\u9009\u62E9 zip \u5305",
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              ref: zipRef,
              type: "file",
              accept: ".zip,application/zip",
              style: { display: "none" },
              disabled: installing,
              onChange: onZipPick
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Btn, { variant: "primary", disabled: installing || zipBase64 === "", onClick: () => {
          void installFromZip();
        }, children: installing ? "\u5B89\u88C5\u4E2D\u2026" : "\u5B89\u88C5 zip" }),
        zipName !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: css.stLabel, children: "\u5DF2\u8BFB\u53D6\uFF1A" + zipName + "\uFF08" + sizeText(zipSize) + "\uFF09" }) : null
      ] }),
      zipError !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stNotice, children: zipError }) : null,
      busy !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stNotice, children: busy }) : null,
      installError !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stNotice, children: installError }) : null,
      result !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { border: "1px solid #2e4a2e", background: "#16241a", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#9adc9a" }, children: "\u5B89\u88C5\u6210\u529F\uFF1A" + result.extension.name + "\uFF08" + result.extension.id + " \xB7 v" + result.extension.version + " \xB7 \u6765\u6E90 " + (result.extension.source === "" ? "\u672A\u77E5" : result.extension.source) + "\uFF09" }),
        result.warnings.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: css.stNotice, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontWeight: 700, marginBottom: 4 }, children: "\u5B89\u88C5\u544A\u8B66\uFF08" + result.warnings.length + " \u6761\uFF09" }),
          result.warnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { lineHeight: 1.6 }, children: [
            "\xB7 ",
            w
          ] }, i))
        ] }) : null,
        result.stubs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: css.stNotice, style: { background: "#1a2233", borderColor: "#2f4468", color: "#9dc0ff" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontWeight: 700, marginBottom: 4 }, children: "\u88AB\u6869\u6389\u7684 SillyTavern \u5185\u90E8\u6A21\u5757\uFF08" + result.stubs.length + " \u4E2A\uFF09" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { lineHeight: 1.6 }, children: "\u8BE5\u6269\u5C55\u5F15\u7528\u4E86 SillyTavern \u5185\u90E8\u6A21\u5757\uFF0C\u8FD9\u4E9B\u6A21\u5757\u5728\u672C\u5BBF\u4E3B\u4E2D\u4E0D\u5B58\u5728\uFF0C\u5DF2\u66FF\u6362\u4E3A\u7A7A\u5B9E\u73B0\uFF08\u6269\u5C55\u53EF\u80FD\u90E8\u5206\u529F\u80FD\u5931\u6548\uFF09\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginTop: 4, fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }, children: result.stubs.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
            "\xB7 ",
            s
          ] }, i)) })
        ] }) : null
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: "\u63A8\u8350\u6269\u5C55", hint: "\u793E\u533A\u5E38\u7528\u3001\u4EE5 CSS \u7F8E\u5316\u4E3A\u4E3B", defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stNotice, style: { background: "#1a2233", borderColor: "#2f4468", color: "#9dc0ff" }, children: "\u8FD9\u4E9B\u662F\u793E\u533A\u6269\u5C55\uFF0C\u5B89\u88C5\u540E\u4F1A\u4EE5\u517C\u5BB9\u6A21\u5F0F\u8FD0\u884C\uFF1B\u7EAF CSS \u7684\u7F8E\u5316\u7C7B\u6269\u5C55\u517C\u5BB9\u6027\u6700\u597D\u3002" }),
      catalog.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLibHead, children: loading ? "\u6B63\u5728\u8BFB\u53D6\u63A8\u8350\u5217\u8868\u2026" : "\u63A8\u8350\u5217\u8868\u4E3A\u7A7A\u3002" }) : catalog.map((entry, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: css.stLibItem, style: { alignItems: "flex-start" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 13, color: "#e8e9ec" }, children: entry.name }),
          entry.note !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 11, color: "#9aa0ab", lineHeight: 1.6 }, children: entry.note }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 11, color: "#6f7683", wordBreak: "break-all" }, children: entry.url })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Btn, { onClick: () => {
          setSource(entry.url);
          setResult(null);
          setInstallError("");
        }, title: "\u586B\u5165\u4E0A\u65B9\u7684\u6765\u6E90\u8F93\u5165\u6846", children: "\u586B\u5165" })
      ] }, entry.url + "#" + i))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Section, { title: "\u517C\u5BB9\u6027\u65E5\u5FD7", hint: "\u52A0\u8F7D\u5931\u8D25 / \u88AB\u6869\u6389\u7684\u6A21\u5757 / \u544A\u8B66", defaultOpen: true, children: [
      props.log.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLibHead, children: "\u6682\u65E0\u65E5\u5FD7" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "div",
        {
          className: css.stLivePre,
          style: { fontFamily: "monospace", fontSize: 11, lineHeight: 1.7, maxHeight: 200, overflowY: "auto", margin: 0 },
          children: logLines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { wordBreak: "break-all" }, children: line }, i))
        }
      ),
      props.log.length > logLines.length ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: css.stLabel, children: "\u5171 " + props.log.length + " \u6761\uFF0C\u4EC5\u663E\u793A\u6700\u8FD1 " + logLines.length + " \u6761" }) : null
    ] })
  ] });
}

// src/client/panels/PartyPanel.tsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var MIN_MEMBERS = 1;
var MAX_MEMBERS = 12;
function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
function readInt(raw, fallback) {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}
function memberGradient2(seed) {
  const text = seed || "?";
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  const from = hash;
  const to = (hash + 48) % 360;
  return "linear-gradient(135deg, hsl(" + from + ", 66%, 52%), hsl(" + to + ", 70%, 36%))";
}
function initial2(name) {
  return (name || "?").slice(0, 1);
}
function hpPercent(hp, maxHp) {
  return clamp(Math.round(hp / (maxHp > 0 ? maxHp : 1) * 100), 0, 100);
}
function hpColor(pct) {
  if (pct <= 30) return "#e05c5c";
  if (pct <= 60) return "#e0a13c";
  return "#4caf7d";
}
function attrLabel(id) {
  const found = PARTY_ATTRS.find((a) => a.id === id);
  return found ? found.label : id;
}
function attrPatch(attributes, id, value) {
  const next = { ...attributes };
  next[id] = value;
  return next;
}
function bonusPatch(skills, index, bonus) {
  return skills.map((s, i) => i === index ? { ...s, bonus } : s);
}
function mergeSkills(existing, names) {
  return names.map((name) => {
    const kept = existing.find((s) => s.name === name);
    if (kept) return kept;
    const preset = SKILL_PRESETS.find((p) => p.name === name);
    if (preset) return { name: preset.name, attr: preset.attr, bonus: preset.bonus };
    return { name, attr: "str", bonus: 4 };
  });
}
function formatTime(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return "\u672A\u77E5\u65F6\u95F4";
  return new Date(ts).toLocaleString();
}
function safeFileName(name) {
  const cleaned = (name || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned === "" ? "party" : cleaned;
}
function HpBar(props) {
  const pct = hpPercent(props.hp, props.maxHp);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { display: "inline-block", width: props.width, height: 6, borderRadius: 3, background: "#2a2f3a", overflow: "hidden", flex: "none" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { display: "block", height: "100%", width: pct + "%", background: hpColor(pct) } }) });
}
function MiniAvatar(props) {
  const style = { width: props.size, height: props.size, flex: "none" };
  if (props.avatar) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { className: css.stLibAvatar, style, src: props.avatar, alt: props.name });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibAvatarFallback, style: { ...style, background: memberGradient2(props.name) }, children: initial2(props.name) });
}
function RouteEditor(props) {
  const route = props.route;
  const patch = (fields) => props.onChange({ ...route, ...fields });
  const selected = route.provider !== "" && route.model !== "" ? route.provider + "::" + route.model : "";
  const missBase = route.baseUrl.trim() === "";
  const missModel = route.customModel.trim() === "";
  const incomplete = route.mode === "custom" && (missBase || missModel);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Field, { label: props.label, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      RadioGroup,
      {
        options: [
          { value: "inherit", label: "\u8DDF\u968F\u5168\u5C40" },
          { value: "dsh", label: "\u6307\u5B9A DSH \u6A21\u578B" },
          { value: "custom", label: "\u72EC\u7ACB\u81EA\u5B9A\u4E49\u63A5\u53E3" }
        ],
        value: route.mode,
        onChange: (v) => patch({ mode: v })
      }
    ),
    route.mode === "inherit" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLabel, style: { marginTop: 6 }, children: props.customConfigured ? "\u4F7F\u7528\u9152\u9986\u8BBE\u7F6E\u91CC\u7684\u9ED8\u8BA4\u6A21\u578B / \u5168\u5C40\u81EA\u5B9A\u4E49\u63A5\u53E3\uFF1A\u5F53\u524D\u8D70\u5168\u5C40\u81EA\u5B9A\u4E49\u63A5\u53E3\uFF0C\u6A21\u578B " + (props.customModel || "\uFF08\u8FD8\u6CA1\u586B\u6A21\u578B\u540D\uFF09") + "\u3002" : "\u4F7F\u7528\u9152\u9986\u8BBE\u7F6E\u91CC\u7684\u9ED8\u8BA4\u6A21\u578B / \u5168\u5C40\u81EA\u5B9A\u4E49\u63A5\u53E3\uFF1A\u5F53\u524D\u8D70 DSH \u9ED8\u8BA4\u6A21\u578B\u4E0E\u5BC6\u94A5\u3002" }) : null,
    route.mode === "dsh" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { marginTop: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "select",
        {
          className: css.stInput,
          value: selected,
          onChange: (e) => {
            const value = e.target.value;
            const at = value.indexOf("::");
            if (at < 0) {
              patch({ provider: "", model: "" });
              return;
            }
            patch({ provider: value.slice(0, at), model: value.slice(at + 2) });
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "", children: "\uFF08\u672A\u6307\u5B9A\uFF0C\u7B49\u540C\u4E8E\u8DDF\u968F\u5168\u5C40\uFF09" }),
            props.modelOptions.map((o) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: o.provider + "::" + o.model, children: o.label }, o.provider + "::" + o.model))
          ]
        }
      ),
      props.modelOptions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLabel, style: { marginTop: 4 }, children: "DSH \u76EE\u524D\u6CA1\u6709\u8FD4\u56DE\u53EF\u7528\u6A21\u578B\u5217\u8868\u3002" }) : null
    ] }) : null,
    route.mode === "custom" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: css.stInput, value: route.baseUrl, onChange: (e) => patch({ baseUrl: e.target.value }), placeholder: "\u63A5\u53E3\u5730\u5740 Base URL\uFF08\u4E0D\u5E26 /chat/completions\uFF09\uFF0C\u4F8B\u5982 https://api.deepseek.com" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: css.stInput, type: "password", autoComplete: "off", value: route.apiKey, onChange: (e) => patch({ apiKey: e.target.value }), placeholder: "API Key\uFF08\u53EA\u5B58\u5728\u672C\u6D4F\u89C8\u5668\uFF0C\u4E0D\u4F1A\u53D1\u7ED9\u5BBF\u4E3B\uFF1B\u4F46\u5BFC\u51FA\u961F\u4F0D JSON \u65F6\u4F1A\u4E00\u8D77\u5E26\u8D70\uFF0C\u5206\u4EAB\u524D\u8BF7\u7559\u610F\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: css.stInput, value: route.customModel, onChange: (e) => patch({ customModel: e.target.value }), placeholder: "\u6A21\u578B\u540D\u79F0\uFF0C\u4F8B\u5982 deepseek-chat" })
    ] }) : null,
    incomplete ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stNotice, children: "\u72EC\u7ACB\u63A5\u53E3\u8FD8\u6CA1\u914D\u7F6E\u5B8C\uFF1A" + (missBase ? "\u7F3A\u5C11\u63A5\u53E3\u5730\u5740" : "") + (missBase && missModel ? "\u3001" : "") + (missModel ? "\u7F3A\u5C11\u6A21\u578B\u540D\u79F0" : "") + "\u3002\u4E0D\u8865\u5168\u7684\u8BDD\uFF0C\u8FD9\u4E2A\u8BF4\u8BDD\u4EBA\u53EA\u80FD\u9000\u56DE\u5168\u5C40\u6A21\u578B\u3002" }) : null,
    route.mode === "inherit" ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { variant: "ghost", onClick: () => props.onChange({ ...INHERIT_ROUTE }), children: "\u91CD\u7F6E\u4E3A\u8DDF\u968F\u5168\u5C40" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibMeta, children: "\u5F53\u524D\uFF1A" + routeLabel(route) })
    ] })
  ] });
}
function MemberCard(props) {
  const m = props.member;
  const [skillName, setSkillName] = (0, import_react4.useState)("");
  const [skillBonus, setSkillBonus] = (0, import_react4.useState)("4");
  const [skillAttr, setSkillAttr] = (0, import_react4.useState)("str");
  const total = attrTotal(m.attributes);
  const over = total > ATTR_BUDGET;
  const spreadEven = () => {
    const base = Math.floor(ATTR_BUDGET / PARTY_ATTRS.length);
    const rest = ATTR_BUDGET % PARTY_ATTRS.length;
    const next = { ...m.attributes };
    PARTY_ATTRS.forEach((a, i) => {
      next[a.id] = clamp(base + (i < rest ? 1 : 0), ATTR_MIN, ATTR_MAX);
    });
    props.onPatch({ attributes: next });
  };
  const addSkill = () => {
    const name = skillName.trim();
    setSkillName("");
    if (name === "") return;
    if (m.skills.some((s) => s.name === name)) return;
    const bonus = clamp(readInt(skillBonus, 0), -99, 99);
    props.onPatch({ skills: [...m.skills, { name, attr: skillAttr, bonus }] });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stSection, ref: props.refCb, style: { scrollMarginTop: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stSectionHead, style: { cursor: "pointer" }, onClick: props.onToggle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MiniAvatar, { name: m.name, avatar: m.avatar, size: 30 }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stSectionTitle, children: "#" + (props.index + 1) + " " + (m.name || "\u672A\u547D\u540D") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibMeta, children: routeLabel(m.llm) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibMeta, children: "HP " + m.hp + "/" + m.maxHp }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(HpBar, { hp: m.hp, maxHp: m.maxHp, width: 40 }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }, children: [
        props.onExportCard ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: css.stTplDel,
            title: "\u628A TA \u5BFC\u51FA\u6210\u4E00\u5F20 SillyTavern \u89D2\u8272\u5361\uFF0C\u53EF\u4EE5\u53BB\u804A\u5929\u9875\u5355\u72EC\u804A\uFF0C\u4E5F\u53EF\u4EE5\u5206\u4EAB",
            onClick: (e) => {
              e.stopPropagation();
              props.onExportCard?.(m);
            },
            children: "\u5BFC\u51FA\u89D2\u8272\u5361"
          }
        ) : null,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: css.stTplDel,
            disabled: !props.canRemove,
            title: props.canRemove ? "\u79FB\u9664\u8BE5\u6210\u5458" : "\u81F3\u5C11\u8981\u4FDD\u7559 1 \u540D\u6210\u5458",
            onClick: (e) => {
              e.stopPropagation();
              props.onRemove();
            },
            children: "\u79FB\u9664"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stSectionCaret, children: props.open ? "-" : "+" })
      ] })
    ] }),
    props.open ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stSectionBody, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: "\u5934\u50CF", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        AvatarPicker,
        {
          avatar: m.avatar,
          name: m.name,
          fallbackGradient: memberGradient2(m.name),
          size: 256,
          onChange: (url) => props.onPatch({ avatar: url })
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: "\u59D3\u540D", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: css.stInput, value: m.name, onChange: (e) => props.onPatch({ name: e.target.value }), placeholder: "\u4F8B\u5982\uFF1A\u8389\u5B89\xB7\u971C\u5203" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Field, { label: "\u5B9A\u4F4D / \u804C\u4E1A\uFF08\u70B9\u4E0B\u9762\u7684\u9884\u8BBE\u5FEB\u901F\u586B\u5165\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u624B\u5199\uFF09", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: css.stInput, value: m.role, onChange: (e) => props.onPatch({ role: e.target.value }), placeholder: "\u4F8B\u5982\uFF1A\u6E38\u4FA0 / \u65A5\u5019 / \u5BAB\u5EF7\u533B\u5E08" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chips, { options: ROLE_PRESETS, values: m.role, onChange: (v) => props.onPatch({ role: typeof v === "string" ? v : v.join("") }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Field, { label: "\u8BE5\u6210\u5458\u7684\u72EC\u7ACB\u4EBA\u8BBE\u63D0\u793A\u8BCD", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "textarea",
          {
            className: cx(css.stInput, css.stTextarea),
            rows: 4,
            value: m.prompt,
            onChange: (e) => props.onPatch({ prompt: e.target.value }),
            placeholder: "\u4F8B\u5982\uFF1A\u4F60\u662F\u6C89\u9ED8\u5BE1\u8A00\u7684\u7CBE\u7075\u6E38\u4FA0\uFF0C\u8BF4\u8BDD\u7B80\u77ED\uFF0C\u4E60\u60EF\u5148\u89C2\u5BDF\u518D\u884C\u52A8\u2026\u2026"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLabel, children: "\u53EA\u4F5C\u7528\u4E8E\u8FD9\u4E2A\u4EBA\uFF1A\u4ED6\u8BF4\u4EC0\u4E48\u3001\u600E\u4E48\u51B3\u5B9A\u90FD\u6309\u8FD9\u6BB5\u8BDD\u8D70\uFF0C\u4E0D\u4F1A\u8986\u76D6\u89D2\u8272\u5361\u672C\u8EAB\u7684\u8BBE\u5B9A\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        RouteEditor,
        {
          label: "\u72EC\u7ACB API \u63A5\u5165\uFF08\u8FD9\u4E2A\u4EBA\u7528\u54EA\u4E2A\u6A21\u578B\u8BF4\u8BDD\uFF09",
          route: m.llm,
          modelOptions: props.modelOptions,
          customConfigured: props.customConfigured,
          customModel: props.customModel,
          onChange: (next) => props.onPatch({ llm: next })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stTpl, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stTplHead, children: "\u5C5E\u6027\u5206\u914D\uFF1A\u5DF2\u5206\u914D " + total + " / " + ATTR_BUDGET + "\uFF08\u6BCF\u9879 " + ATTR_MIN + " - " + ATTR_MAX + "\uFF09" }),
        over ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stNotice, children: "\u5C5E\u6027\u70B9\u8D85\u652F\uFF1A\u5DF2\u5206\u914D " + total + " \u70B9\uFF0C\u8D85\u51FA " + (total - ATTR_BUDGET) + " \u70B9\uFF0C\u8BF7\u4E0B\u8C03\uFF0C\u5426\u5219\u5224\u5B9A\u4F1A\u8D8A\u6765\u8D8A\u96BE\u3002" }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: cx(css.stRow, css.stGap), style: { marginBottom: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { onClick: spreadEven, children: "\u5E73\u5747\u5206\u914D" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibMeta, children: "\u5E73\u5747\u5206\u914D\u628A " + ATTR_BUDGET + " \u70B9\u516D\u7B49\u5206\uFF0C\u4F59\u6570\u8865\u7ED9\u524D\u51E0\u9879\u3002" })
        ] }),
        PARTY_ATTRS.map((a) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: a.label + "\uFF08" + a.short + "\uFF09 \xB7 " + a.blurb, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          Slider,
          {
            min: ATTR_MIN,
            max: ATTR_MAX,
            value: m.attributes[a.id],
            left: String(ATTR_MIN),
            right: String(ATTR_MAX),
            onChange: (v) => props.onPatch({ attributes: attrPatch(m.attributes, a.id, v) })
          }
        ) }, a.id))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stTpl, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stTplHead, children: "HP\uFF1A\u5F53\u524D / \u6700\u5927\uFF08\u6700\u5927 1 - 999\uFF0C\u5F53\u524D\u503C\u4E0D\u4F1A\u8D85\u8FC7\u6700\u5927\u503C\uFF0C\u5F53\u524D " + hpPercent(m.hp, m.maxHp) + "%\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              className: css.stInput,
              style: { width: 90 },
              type: "number",
              min: 0,
              max: m.maxHp,
              value: m.hp,
              onChange: (e) => props.onPatch({ hp: clamp(readInt(e.target.value, m.hp), 0, m.maxHp) })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLabel, children: "/" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              className: css.stInput,
              style: { width: 90 },
              type: "number",
              min: 1,
              max: 999,
              value: m.maxHp,
              onChange: (e) => {
                const maxHp = clamp(readInt(e.target.value, m.maxHp), 1, 999);
                props.onPatch({ maxHp, hp: Math.min(m.hp, maxHp) });
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { onClick: () => props.onPatch({ hp: m.maxHp }), children: "\u56DE\u6EE1" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(HpBar, { hp: m.hp, maxHp: m.maxHp, width: 110 })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stTpl, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stTplHead, children: "\u6280\u80FD\uFF08\u5DF2\u9009 " + m.skills.length + " \u9879\uFF1B\u70B9\u9884\u8BBE\u52A0\u5165\uFF0C\u518D\u70B9\u4E00\u6B21\u79FB\u9664\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          Chips,
          {
            multiple: true,
            options: SKILL_PRESETS.map((s) => s.name),
            values: m.skills.map((s) => s.name),
            onChange: (v) => props.onPatch({ skills: mergeSkills(m.skills, Array.isArray(v) ? v : [v]) })
          }
        ),
        m.skills.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { marginTop: 8 }, children: m.skills.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stRow, style: { marginBottom: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibName, style: { flex: "none", minWidth: 76 }, children: s.name }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibMeta, children: attrLabel(s.attr) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibMeta, children: "\u52A0\u6210" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              className: css.stInput,
              style: { width: 72, flex: "none" },
              type: "number",
              min: -99,
              max: 99,
              value: s.bonus,
              onChange: (e) => props.onPatch({ skills: bonusPatch(m.skills, i, clamp(readInt(e.target.value, s.bonus), -99, 99)) })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: css.stTplDel, title: "\u5220\u9664\u8BE5\u6280\u80FD", onClick: () => props.onPatch({ skills: m.skills.filter((_, j) => j !== i) }), children: "x" })
        ] }, s.name + "-" + i)) }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLibMeta, children: "\u8FD8\u6CA1\u6709\u6280\u80FD\uFF1A\u5224\u5B9A\u65F6\u53EA\u770B\u5C5E\u6027\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stCustomAdd, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              className: css.stInput,
              value: skillName,
              onChange: (e) => setSkillName(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") addSkill();
              },
              placeholder: "\u81EA\u5B9A\u4E49\u6280\u80FD\u540D\uFF0C\u4F8B\u5982\uFF1A\u53CC\u624B\u5251"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("select", { className: css.stInput, style: { width: 96, flex: "none" }, value: skillAttr, onChange: (e) => setSkillAttr(e.target.value), children: PARTY_ATTRS.map((a) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: a.id, children: a.label }, a.id)) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: css.stInput, style: { width: 72, flex: "none" }, type: "number", min: -99, max: 99, value: skillBonus, onChange: (e) => setSkillBonus(e.target.value), placeholder: "\u52A0\u6210" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { onClick: addSkill, children: "\u6DFB\u52A0" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stTpl, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stTplHead, children: "\u72B6\u6001\uFF08\u5DF2\u6302 " + m.status.length + " \u9879\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLabel, children: "\u6BCF\u9879\u8D1F\u9762\u72B6\u6001\u4F1A\u8BA9\u5224\u5B9A\u96BE\u5EA6 +3\uFF0C\u4F8B\u5982\u4E2D\u6BD2\u3001\u91CD\u4F24\u3001\u6050\u60E7\uFF1B\u60C5\u8282\u8FC7\u53BB\u540E\u8BB0\u5F97\u56DE\u6765\u6E05\u6389\u3002" }),
        m.status.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stChipWrap, style: { marginTop: 6 }, children: m.status.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: css.stChip, children: [
          s,
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: css.stTplDel, title: "\u79FB\u9664\u8BE5\u72B6\u6001", onClick: () => props.onPatch({ status: m.status.filter((_, j) => j !== i) }), children: "x" })
        ] }, s + "-" + i)) }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLibMeta, children: "\u5F53\u524D\u6CA1\u6709\u72B6\u6001\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CustomAdd, { values: m.status, onAdd: (list) => props.onPatch({ status: list }), placeholder: "\u8F93\u5165\u72B6\u6001\u540D\uFF0C\u4F8B\u5982\uFF1A\u4E2D\u6BD2" })
      ] })
    ] }) : null
  ] });
}
function PartyPanel(props) {
  const party = props.party;
  const members = party.members;
  const [collapsed, setCollapsed] = (0, import_react4.useState)({});
  const [importError, setImportError] = (0, import_react4.useState)("");
  const cardRefs = (0, import_react4.useRef)({});
  (0, import_react4.useEffect)(() => {
    setCollapsed({});
    setImportError("");
  }, [party.id]);
  const patch = (fields) => {
    props.onChange({ ...party, ...fields });
  };
  const updateMember = (id, fields) => {
    props.onChange({
      ...party,
      members: members.map((m) => m.id === id ? { ...m, ...fields, attributes: { ...m.attributes, ...fields.attributes ?? {} } } : m)
    });
  };
  const addMember = () => {
    if (members.length >= MAX_MEMBERS) return;
    props.onChange({ ...party, members: [...members, makeMember(members.length)] });
  };
  const removeMember = (id) => {
    if (members.length <= MIN_MEMBERS) return;
    props.onChange({ ...party, members: members.filter((m) => m.id !== id) });
  };
  const focusMember = (id) => {
    setCollapsed((prev) => ({ ...prev, [id]: false }));
    const el = cardRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const toggleMember = (id) => {
    setCollapsed((prev) => ({ ...prev, [id]: prev[id] !== true }));
  };
  const exportParty = () => {
    const blob = new Blob([JSON.stringify(party, null, 2)], { type: "application/json" });
    downloadFile(safeFileName(party.name) + ".json", blob);
  };
  const importPartyFile = (file) => {
    setImportError("");
    file.text().then((text) => {
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        setImportError("\u4E0D\u662F\u5408\u6CD5\u7684 JSON \u6587\u4EF6\uFF1A" + err.message);
        return;
      }
      const next = normalizeParty(parsed);
      if (!next) {
        setImportError("\u8FD9\u4E2A JSON \u91CC\u6CA1\u6709\u53EF\u7528\u7684\u6210\u5458\u5217\u8868\uFF08members \u5FC5\u987B\u662F\u6570\u7EC4\u4E14\u81F3\u5C11\u4E00\u4EBA\uFF09\u3002");
        return;
      }
      props.onChange(next);
    }).catch(() => setImportError("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u4E00\u6B21\u3002"));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stChar, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stWbEntry, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLibHead, children: "\u961F\u4F0D\u603B\u89C8\uFF1A" + members.length + " \u4EBA\uFF08\u70B9\u4E00\u4E0B\u8DF3\u5230\u8BE5\u6210\u5458\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stChipWrap, children: members.map((m) => {
        const pct = hpPercent(m.hp, m.maxHp);
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "button",
          {
            type: "button",
            className: css.stChip,
            title: "\u8DF3\u5230 " + (m.name || "\u672A\u547D\u540D") + "\uFF08" + routeLabel(m.llm) + "\uFF09",
            style: { display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 3px" },
            onClick: () => focusMember(m.id),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MiniAvatar, { name: m.name, avatar: m.avatar, size: 24 }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: m.name || "\u672A\u547D\u540D" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(HpBar, { hp: m.hp, maxHp: m.maxHp, width: 44 }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 11, color: hpColor(pct) }, children: m.hp + "/" + m.maxHp })
            ]
          },
          m.id
        );
      }) }),
      members.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stNotice, children: "\u961F\u4F0D\u91CC\u4E00\u4E2A\u4EBA\u90FD\u6CA1\u6709\u4E86\uFF0C\u5148\u5728\u4E0B\u9762\u70B9\u300C\u6DFB\u52A0\u6210\u5458\u300D\u3002" }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Section, { title: "\u961F\u4F0D", hint: "\u4EBA\u6570 " + members.length + " / " + MAX_MEMBERS, defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: "\u961F\u4F0D\u540D\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: css.stInput, value: party.name, onChange: (e) => patch({ name: e.target.value }), placeholder: "\u4F8B\u5982\uFF1A\u7070\u6E2F\u5192\u9669\u56E2" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLabel, children: "\u5F53\u524D " + members.length + " \u4EBA\uFF1A" + members.map((m) => m.name || "\u672A\u547D\u540D").join("\u3001") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stActions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { onClick: addMember, disabled: members.length >= MAX_MEMBERS, title: members.length >= MAX_MEMBERS ? "\u4E00\u652F\u961F\u4F0D\u6700\u591A " + MAX_MEMBERS + " \u4EBA" : "\u6DFB\u52A0\u4E00\u540D\u6210\u5458", children: "\u6DFB\u52A0\u6210\u5458" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { variant: "primary", onClick: props.onSave, children: "\u4FDD\u5B58\u5230\u961F\u4F0D\u5E93" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { onClick: exportParty, children: "\u5BFC\u51FA\u961F\u4F0D JSON" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: css.stBtn, children: [
          "\u5BFC\u5165\u961F\u4F0D JSON",
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              type: "file",
              accept: ".json,application/json",
              style: { display: "none" },
              onChange: (e) => {
                const file = e.target.files ? e.target.files[0] : null;
                e.target.value = "";
                if (file) importPartyFile(file);
              }
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLabel, children: "\u4EBA\u6570\u8303\u56F4 " + MIN_MEMBERS + " - " + MAX_MEMBERS + " \u4EBA\uFF1B\u79FB\u9664\u6309\u94AE\u5728\u6BCF\u4E2A\u6210\u5458\u5361\u7247\u7684\u53F3\u4E0A\u89D2\uFF08\u81F3\u5C11\u4FDD\u7559 1 \u4EBA\uFF09\u3002" }),
      importError ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stNotice, children: importError }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Section, { title: "\u65C1\u767D\u8005\uFF08\u5B88\u79D8\u4EBA\uFF09", hint: routeLabel(party.narrator), defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: "\u65C1\u767D\u8005\u63D0\u793A\u8BCD\uFF08\u8FD9\u4E00\u6BB5\u4F1A\u8FFD\u52A0\u5230\u5B88\u79D8\u4EBA\u7684\u7CFB\u7EDF\u63D0\u793A\u8BCD\u540E\u9762\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "textarea",
        {
          className: cx(css.stInput, css.stTextarea),
          rows: 5,
          value: party.narratorPrompt,
          onChange: (e) => patch({ narratorPrompt: e.target.value }),
          placeholder: "\u4F8B\u5982\uFF1A\u53D9\u8FF0\u4FDD\u6301\u51B7\u5CFB\u514B\u5236\u7684\u8BED\u8C03\uFF0C\u591A\u5199\u73AF\u5883\u7EC6\u8282\uFF1B\u4E0D\u8981\u66FF\u73A9\u5BB6\u505A\u51B3\u5B9A\uFF0C\u4E5F\u4E0D\u8981\u5728\u65C1\u767D\u91CC\u63D0\u5230\u4EFB\u4F55\u89C4\u5219\u6216\u6570\u503C\u3002"
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        RouteEditor,
        {
          label: "\u65C1\u767D\u8005\u7528\u54EA\u4E2A\u6A21\u578B\u8BF4\u4E66",
          route: party.narrator,
          modelOptions: props.modelOptions,
          customConfigured: props.customConfigured,
          customModel: props.customModel,
          onChange: (next) => patch({ narrator: next })
        }
      )
    ] }),
    members.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      MemberCard,
      {
        member: m,
        index: i,
        open: collapsed[m.id] !== true,
        canRemove: members.length > MIN_MEMBERS,
        refCb: (el) => {
          cardRefs.current[m.id] = el;
        },
        onToggle: () => toggleMember(m.id),
        onRemove: () => removeMember(m.id),
        onPatch: (fields) => updateMember(m.id, fields),
        modelOptions: props.modelOptions,
        customConfigured: props.customConfigured,
        customModel: props.customModel,
        onExportCard: props.onExportCard
      },
      m.id
    )),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Section, { title: "\u961F\u4F0D\u5E93", hint: props.library.length ? props.library.length + " \u652F\u5DF2\u4FDD\u5B58" : "\u8FD8\u6CA1\u6709\u4FDD\u5B58\u8FC7", defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stActions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { variant: "primary", onClick: props.onSave, children: "\u628A\u5F53\u524D\u961F\u4F0D\u5B58\u5165\u961F\u4F0D\u5E93" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibMeta, children: "\u540C\u4E00\u652F\u961F\u4F0D\uFF08\u540C id\uFF09\u4F1A\u88AB\u8986\u76D6\u66F4\u65B0\uFF0C\u5176\u4F59\u961F\u4F0D\u539F\u6837\u4FDD\u7559\u3002" })
      ] }),
      props.library.length ? props.library.map((p) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: css.stLibItem, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MiniAvatar, { name: p.name, avatar: p.members.length ? p.members[0].avatar : "", size: 30 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLibName, children: p.name }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: css.stLibMeta, children: p.members.length + " \u4EBA \xB7 " + formatTime(p.savedAt) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { onClick: () => props.onLoad(p.id), children: "\u8F7D\u5165" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Btn, { onClick: () => props.onDelete(p.id), children: "\u5220\u9664" })
      ] }, p.id)) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: css.stLibMeta, children: "\u961F\u4F0D\u5E93\u662F\u7A7A\u7684\uFF1A\u5148\u70B9\u300C\u4FDD\u5B58\u5230\u961F\u4F0D\u5E93\u300D\uFF0C\u6216\u8005\u7528\u4E0A\u9762\u7684\u300C\u5BFC\u5165\u961F\u4F0D JSON\u300D\u3002" })
    ] })
  ] });
}

// src/client/panels/RpgPanel.tsx
var import_react6 = require("react");

// src/rpg/engine.ts
function clamp2(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
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
function applyEffects(actor, effects) {
  const hp = clamp2(actor.hp - effects.hpLoss, 0, actor.maxHp);
  const set = new Set(actor.status ?? []);
  for (const s of effects.removeStatus) set.delete(s);
  for (const s of effects.addStatus) set.add(s);
  return { ...actor, hp, status: [...set] };
}

// src/rpg/outline.ts
var TRIGGER_KINDS = [
  { kind: "turn", label: "\u5230\u8FBE\u56DE\u5408", hint: "\u5192\u9669\u8FDB\u884C\u5230\u7B2C N \u56DE\u5408\u65F6\u89E6\u53D1", field: "turn" },
  { kind: "band", label: "\u5224\u5B9A\u6863\u4F4D", hint: "\u6700\u8FD1\u7684\u5224\u5B9A\u843D\u5728\u67D0\u4E2A\u6863\u4F4D\u65F6\u89E6\u53D1", field: "band" },
  { kind: "encounter", label: "\u906D\u9047\u7C7B\u578B", hint: "\u5F53\u573A\u4E0A\u51FA\u73B0\u67D0\u7C7B\u906D\u9047\u65F6\u89E6\u53D1", field: "encounterKind" },
  { kind: "hp", label: "\u8840\u91CF\u544A\u6025", hint: "\u4EFB\u4F55\u961F\u5458\u8840\u91CF\u4F4E\u4E8E\u67D0\u4E2A\u6BD4\u4F8B\u65F6\u89E6\u53D1", field: "hpBelow" },
  { kind: "action", label: "\u884C\u52A8\u5173\u952E\u8BCD", hint: "\u73A9\u5BB6\u5BA3\u544A\u7684\u884C\u52A8\u91CC\u5305\u542B\u67D0\u6BB5\u6587\u5B57\u65F6\u89E6\u53D1", field: "keyword" },
  { kind: "fact", label: "\u5DF2\u786E\u7ACB\u4E8B\u5B9E", hint: "\u5DF2\u786E\u7ACB\u7684\u4E8B\u5B9E\u91CC\u51FA\u73B0\u67D0\u6BB5\u6587\u5B57\u65F6\u89E6\u53D1", field: "factKeyword" },
  { kind: "success", label: "\u8FDE\u7EED\u6210\u529F", hint: "\u8FDE\u7EED\u6210\u529F N \u6B21\u540E\u89E6\u53D1", field: "streak" },
  { kind: "failure", label: "\u8FDE\u7EED\u5931\u8D25", hint: "\u8FDE\u7EED\u5931\u8D25 N \u6B21\u540E\u89E6\u53D1", field: "streak" },
  { kind: "always", label: "\u7ACB\u5373", hint: "\u5192\u9669\u4E00\u5F00\u59CB\u5C31\u89E6\u53D1", field: "" }
];
function makeBeat(index) {
  return {
    id: "b" + Date.now().toString(36) + "-" + index,
    title: "\u4E8B\u4EF6 " + (index + 1),
    trigger: { kind: "turn", turn: index + 1 },
    event: "",
    once: true,
    fired: false,
    firedAtTurn: 0
  };
}
function nextStreak(streak, success) {
  if (success) return streak >= 0 ? streak + 1 : 1;
  return streak <= 0 ? streak - 1 : -1;
}
function describeTrigger(trigger) {
  const kind = trigger?.kind ?? "always";
  switch (kind) {
    case "always":
      return "\u5192\u9669\u5F00\u59CB\u65F6";
    case "turn":
      return "\u7B2C " + (trigger.turn ?? 1) + " \u56DE\u5408\u53CA\u4E4B\u540E";
    case "band":
      return "\u5224\u5B9A\u843D\u5230\u300C" + (trigger.band ?? "?") + "\u300D\u65F6";
    case "encounter":
      return "\u9047\u5230\u300C" + (trigger.encounterKind ?? "?") + "\u300D\u7C7B\u906D\u9047\u65F6";
    case "hp":
      return "\u6709\u4EBA\u8840\u91CF\u4F4E\u4E8E " + Math.round((trigger.hpBelow ?? 0.3) * 100) + "% \u65F6";
    case "action":
      return "\u884C\u52A8\u5305\u542B\u300C" + (trigger.keyword ?? "") + "\u300D\u65F6";
    case "fact":
      return "\u5DF2\u786E\u7ACB\u4E8B\u5B9E\u5305\u542B\u300C" + (trigger.factKeyword ?? "") + "\u300D\u65F6";
    case "success":
      return "\u8FDE\u7EED\u6210\u529F " + (trigger.streak ?? 1) + " \u6B21\u540E";
    case "failure":
      return "\u8FDE\u7EED\u5931\u8D25 " + (trigger.streak ?? 1) + " \u6B21\u540E";
    default:
      return "\u672A\u77E5\u6761\u4EF6";
  }
}

// src/client/panels/OutlineEditor.tsx
var import_react5 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var ENCOUNTER_KINDS = [
  { value: "combat", label: "\u6218\u6597" },
  { value: "chase", label: "\u8FFD\u9010" },
  { value: "social", label: "\u793E\u4EA4" },
  { value: "environment", label: "\u73AF\u5883" },
  { value: "other", label: "\u5176\u4ED6" }
];
var FIRED_TAG_STYLE = {
  cursor: "default",
  background: "#2a2416",
  borderColor: "#4a3d1f",
  color: "#ffb84d"
};
function splitRoute2(chatModel) {
  const parts = (chatModel || "").split("::");
  if (parts[0] === "custom") return { provider: "custom" };
  if (parts.length >= 2 && parts[0] !== "") return { provider: parts[0], model: parts.slice(1).join("::") };
  return {};
}
function triggerField(kind) {
  const entry = TRIGGER_KINDS.find((k) => k.kind === kind);
  return entry ? entry.field : "";
}
function retargetTrigger(kind) {
  const next = { kind };
  const field = triggerField(kind);
  if (field === "turn") next.turn = 3;
  else if (field === "band") next.band = "fail";
  else if (field === "encounterKind") next.encounterKind = "combat";
  else if (field === "hpBelow") next.hpBelow = 0.3;
  else if (field === "keyword") next.keyword = "";
  else if (field === "factKeyword") next.factKeyword = "";
  else if (field === "streak") next.streak = 3;
  return next;
}
function readNumber(raw, fallback, min, max) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
function freshId(base, taken) {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(base + "-" + n)) n += 1;
  return base + "-" + n;
}
function pickText(draft, fallback) {
  const text = String(draft ?? "").trim();
  return text === "" ? fallback : draft;
}
function adoptBeat(raw, index, taken) {
  const seed = makeBeat(index);
  const title = String(raw.title ?? "").trim();
  return {
    id: freshId(seed.id, taken),
    title: title === "" ? seed.title : title,
    trigger: raw.trigger && raw.trigger.kind ? raw.trigger : { kind: "turn", turn: 1 },
    event: String(raw.event ?? ""),
    once: raw.once !== false,
    fired: false,
    firedAtTurn: 0
  };
}
function OutlineEditor(props) {
  const [busy, setBusy] = (0, import_react5.useState)("");
  const [setupError, setSetupError] = (0, import_react5.useState)("");
  const [outlineError, setOutlineError] = (0, import_react5.useState)("");
  const setupRef = (0, import_react5.useRef)(props.setup);
  (0, import_react5.useEffect)(() => {
    setupRef.current = props.setup;
  }, [props.setup]);
  const route = splitRoute2(props.chatModel);
  const beats = props.setup.outline;
  const hintOf = (kind) => {
    const entry = TRIGGER_KINDS.find((k) => k.kind === kind);
    return entry ? entry.hint : "";
  };
  const isFired = (beat) => props.firedBeats.includes(beat.id) || beat.fired;
  const patchBeat = (index, patch) => {
    props.onChange({ ...props.setup, outline: props.setup.outline.map((b, i) => i === index ? { ...b, ...patch } : b) });
  };
  const addBeat = () => {
    const taken = props.setup.outline.map((b) => b.id);
    const seed = makeBeat(props.setup.outline.length);
    const beat = { ...seed, id: freshId(seed.id, taken) };
    props.onChange({ ...props.setup, outline: [...props.setup.outline, beat] });
  };
  const moveBeat = (index, delta) => {
    const list = props.setup.outline;
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    const next = list.slice();
    const moved = next.splice(index, 1)[0];
    next.splice(to, 0, moved);
    props.onChange({ ...props.setup, outline: next });
  };
  const removeBeat = (index) => {
    props.onChange({ ...props.setup, outline: props.setup.outline.filter((_b, i) => i !== index) });
  };
  const clearSetup = () => {
    props.onChange({ ...props.setup, title: "", premise: "", tone: "", rules: "" });
  };
  const clearOutline = () => {
    const count = props.setup.outline.length;
    if (count === 0) return;
    if (!confirm("\u786E\u5B9A\u8981\u6E05\u7A7A\u8FD9 " + count + " \u4E2A\u8282\u70B9\u5417\uFF1F\u6E05\u7A7A\u540E\u65E0\u6CD5\u64A4\u9500\u3002")) return;
    props.onChange({ ...props.setup, outline: [] });
  };
  const draftScenario = async () => {
    setBusy("scenario");
    setSetupError("");
    try {
      const res = await props.api.rpgScenario(props.party, props.setup.premise, route.provider, route.model);
      const base = setupRef.current;
      const draft = res.setup ?? { title: "", premise: "", tone: "", rules: "" };
      props.onChange({
        ...base,
        title: pickText(draft.title, base.title),
        premise: pickText(draft.premise, base.premise),
        tone: pickText(draft.tone, base.tone),
        rules: pickText(draft.rules, base.rules)
      });
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : "AI \u6CA1\u6709\u7ED9\u51FA\u5267\u672C\uFF0C\u53EF\u4EE5\u518D\u8BD5\u4E00\u6B21\u3002");
    } finally {
      setBusy("");
    }
  };
  const draftOutline = async () => {
    setBusy("outline");
    setOutlineError("");
    try {
      const res = await props.api.rpgOutline(props.party, props.setup.premise, 4, route.provider, route.model);
      const base = setupRef.current;
      const list = base.outline;
      const taken = list.map((b) => b.id);
      const drafted = [];
      for (const raw of res.beats ?? []) {
        const beat = adoptBeat(raw, list.length + drafted.length, taken);
        taken.push(beat.id);
        drafted.push(beat);
      }
      if (drafted.length === 0) {
        setOutlineError("AI \u8FD9\u6B21\u6CA1\u6709\u7ED9\u51FA\u53EF\u7528\u7684\u8282\u70B9\uFF0C\u53EF\u4EE5\u518D\u70B9\u4E00\u6B21\u3002");
        return;
      }
      props.onChange({ ...base, outline: [...list, ...drafted] });
    } catch (e) {
      setOutlineError(e instanceof Error ? e.message : "AI \u6CA1\u6709\u7ED9\u51FA\u5927\u7EB2\uFF0C\u53EF\u4EE5\u518D\u8BD5\u4E00\u6B21\u3002");
    } finally {
      setBusy("");
    }
  };
  const renderTriggerField = (beat, index) => {
    const trigger = beat.trigger;
    const kind = trigger.kind;
    if (kind === "turn") {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u7B2C\u51E0\u56DE\u5408", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          type: "number",
          className: css.stInput,
          min: 1,
          max: 200,
          value: trigger.turn ?? 1,
          onChange: (e) => patchBeat(index, { trigger: { kind, turn: readNumber(e.target.value, trigger.turn ?? 1, 1, 200) } })
        }
      ) });
    }
    if (kind === "band") {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u5224\u5B9A\u843D\u5728\u54EA\u4E2A\u6863\u4F4D", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "select",
        {
          className: css.stInput,
          value: trigger.band ?? "fail",
          onChange: (e) => patchBeat(index, { trigger: { kind, band: e.target.value } }),
          children: BANDS.map((b) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: b.id, children: b.label }, b.id))
        }
      ) });
    }
    if (kind === "encounter") {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u906D\u9047\u7C7B\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "select",
        {
          className: css.stInput,
          value: trigger.encounterKind ?? "combat",
          onChange: (e) => patchBeat(index, { trigger: { kind, encounterKind: e.target.value } }),
          children: ENCOUNTER_KINDS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: o.value, children: o.label }, o.value))
        }
      ) });
    }
    if (kind === "hp") {
      const pct = Math.round((trigger.hpBelow ?? 0.3) * 100);
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u6709\u4EBA\u8840\u91CF\u4F4E\u4E8E " + pct + "% \u65F6\u89E6\u53D1", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          type: "number",
          className: css.stInput,
          min: 5,
          max: 100,
          step: 5,
          value: pct,
          onChange: (e) => patchBeat(index, { trigger: { kind, hpBelow: readNumber(e.target.value, pct, 5, 100) / 100 } })
        }
      ) });
    }
    if (kind === "action") {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u73A9\u5BB6\u884C\u52A8\u91CC\u51FA\u73B0\u8FD9\u6BB5\u6587\u5B57", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          className: css.stInput,
          value: trigger.keyword ?? "",
          placeholder: "\u4F8B\u5982\uFF1A\u6572\u949F",
          onChange: (e) => patchBeat(index, { trigger: { kind, keyword: e.target.value } })
        }
      ) });
    }
    if (kind === "fact") {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u5DF2\u786E\u7ACB\u4E8B\u5B9E\u91CC\u51FA\u73B0\u8FD9\u6BB5\u6587\u5B57", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          className: css.stInput,
          value: trigger.factKeyword ?? "",
          placeholder: "\u4F8B\u5982\uFF1A\u5931\u8E2A\u7684\u5546\u961F",
          onChange: (e) => patchBeat(index, { trigger: { kind, factKeyword: e.target.value } })
        }
      ) });
    }
    if (kind === "success" || kind === "failure") {
      const need = trigger.streak ?? 3;
      const up = nextStreak(0, true);
      const down = nextStreak(0, false);
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Field, { label: kind === "success" ? "\u8FDE\u7EED\u6210\u529F\u51E0\u6B21" : "\u8FDE\u7EED\u5931\u8D25\u51E0\u6B21", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            type: "number",
            className: css.stInput,
            min: 1,
            max: 10,
            value: need,
            onChange: (e) => patchBeat(index, { trigger: { kind, streak: readNumber(e.target.value, need, 1, 10) } })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stRpgCardMeta, children: "\u7CFB\u7EDF\u9010\u56DE\u5408\u7D2F\u52A0\uFF1A\u6210\u529F " + (up > 0 ? "+" + up : String(up)) + "\uFF0C\u5931\u8D25 " + String(down) + "\uFF1B\u88AB\u53CD\u5411\u7ED3\u679C\u6253\u65AD\u5C31\u6E05\u96F6\u3002" })
      ] });
    }
    return null;
  };
  const firedCount = beats.filter(isFired).length;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Section, { title: "\u5267\u672C\u8BBE\u5B9A", hint: "\u8FD9\u4E00\u5C40\u7684\u5E95\u672C\uFF0C\u5B88\u79D8\u4EBA\u6574\u5C40\u90FD\u7167\u7740\u5B83\u6F14", children: [
      setupError !== "" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stNotice, children: setupError }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u5192\u9669\u540D\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          className: css.stInput,
          value: props.setup.title,
          placeholder: "\u4F8B\u5982\uFF1A\u5317\u5883\u7684\u949F\u58F0\uFF08\u7B80\u77ED\u597D\u8BB0\uFF0C\u4F1A\u51FA\u73B0\u5728\u9762\u677F\u6807\u9898\u4E0E\u65E5\u5FD7\u91CC\uFF09",
          onChange: (e) => props.onChange({ ...props.setup, title: e.target.value })
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u6545\u4E8B\u524D\u63D0", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "textarea",
        {
          className: cx(css.stInput, css.stTextarea),
          rows: 5,
          value: props.setup.premise,
          placeholder: "\u8C01\u3001\u5728\u54EA\u3001\u8981\u505A\u4EC0\u4E48\u3001\u62E6\u5728\u524D\u9762\u7684\u9EBB\u70E6\u662F\u4EC0\u4E48\u3002\u5199\u7ED9\u5B88\u79D8\u4EBA\u5F53\u603B\u7EB2\uFF0C\u8D8A\u5177\u4F53\u8D8A\u597D\u3002",
          onChange: (e) => props.onChange({ ...props.setup, premise: e.target.value })
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u57FA\u8C03\u4E0E\u5C3A\u5EA6", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "textarea",
        {
          className: cx(css.stInput, css.stTextarea),
          rows: 2,
          value: props.setup.tone,
          placeholder: "\u4F8B\u5982\uFF1A\u4F4E\u9B54\u9ED1\u6697\u5947\u5E7B\uFF0C\u5141\u8BB8\u6D41\u8840\u4E0E\u80CC\u53DB\uFF0C\u4E0D\u5199\u9732\u9AA8\u60C5\u8282\uFF0C\u53D9\u8FF0\u4FDD\u6301\u514B\u5236\u3002",
          onChange: (e) => props.onChange({ ...props.setup, tone: e.target.value })
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u672C\u684C\u7EA6\u5B9A", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "textarea",
        {
          className: cx(css.stInput, css.stTextarea),
          rows: 2,
          value: props.setup.rules,
          placeholder: "\u4F8B\u5982\uFF1A\u4E0D\u63B7\u9AB0\u5C31\u4E0D\u5F97\u63CF\u8FF0\u6210\u529F\uFF1B\u961F\u53CB\u4E4B\u95F4\u4E0D\u5F97\u9690\u7792\u5173\u952E\u60C5\u62A5\uFF1B\u6BCF\u56DE\u5408\u6700\u591A\u4E00\u6B21\u4EA4\u6613\u3002",
          onChange: (e) => props.onChange({ ...props.setup, rules: e.target.value })
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.stRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Btn, { variant: "primary", disabled: busy !== "", onClick: () => {
          void draftScenario();
        }, children: busy === "scenario" ? "\u6B63\u5728\u6784\u601D\u2026" : "\u8BA9 AI \u5199" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Btn, { variant: "ghost", onClick: clearSetup, children: "\u6E05\u7A7A\u5267\u672C" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stRpgHint, children: "\u300C\u8BA9 AI \u5199\u300D\u4F1A\u6309\u5F53\u524D\u961F\u4F0D\u91CD\u65B0\u751F\u6210\u8FD9\u56DB\u4E2A\u5B57\u6BB5\uFF0C\u4E0D\u4F1A\u52A8\u4F60\u5DF2\u7ECF\u5199\u597D\u7684\u5267\u60C5\u5927\u7EB2\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Section, { title: "\u5267\u60C5\u5927\u7EB2", hint: "\u89E6\u53D1\u6761\u4EF6\u7531\u7CFB\u7EDF\u5224\u5B9A\uFF0C\u6EE1\u8DB3\u5C31\u628A\u4E8B\u4EF6\u4EA4\u7ED9 AI \u6F14\u51FA", children: [
      outlineError !== "" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stNotice, children: outlineError }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stRpgHint, children: "\u8282\u70B9\u662F\u300C\u4F60\u63D0\u524D\u5199\u597D\u7684\u4E8B\u4EF6\u300D\uFF1A\u4E00\u65E6\u89E6\u53D1\uFF0C\u5B88\u79D8\u4EBA\u5FC5\u987B\u6F14\u51FA\u4EC0\u4E48\uFF0C\u7531\u4F60\u5728\u8FD9\u91CC\u5199\u6B7B\u3002\u89E6\u53D1\u6761\u4EF6\u5219\u662F\u300C\u7CFB\u7EDF\u4F1A\u673A\u68B0\u5224\u5B9A\u7684\u6761\u4EF6\u300D\u2014\u2014\u7B2C\u51E0\u56DE\u5408\u3001\u5224\u5B9A\u843D\u5728\u54EA\u4E2A\u6863\u4F4D\u3001\u8C01\u7684\u8840\u91CF\u544A\u6025\u3001\u73A9\u5BB6\u7684\u884C\u52A8\u6216\u5DF2\u786E\u7ACB\u7684\u4E8B\u5B9E\u91CC\u51FA\u73B0\u4E86\u54EA\u4E2A\u8BCD\u3002\u5224\u5B9A\u53D1\u751F\u5728\u4EE3\u7801\u91CC\uFF0C\u4E0D\u770B AI \u7684\u5FC3\u60C5\uFF1B\u6761\u4EF6\u4E0D\u6210\u7ACB\uFF0C\u8FD9\u6BB5\u4E8B\u4EF6\u5C31\u7EDD\u4E0D\u4F1A\u88AB\u63D0\u524D\u642C\u4E0A\u53F0\uFF0C\u6240\u4EE5\u4F60\u53EF\u4EE5\u653E\u5FC3\u628A\u540E\u9762\u7684\u6865\u6BB5\u5148\u5199\u597D\u3002" }),
      beats.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.stEmpty, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stEmptyEmoji, children: "\u7A7A" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: "\u8FD8\u6CA1\u6709\u4EFB\u4F55\u8282\u70B9\u3002\u7A7A\u5927\u7EB2\u4E0D\u4F1A\u62A5\u9519\uFF0C\u4F46\u5B88\u79D8\u4EBA\u53EA\u80FD\u4E34\u573A\u53D1\u6325\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stRpgHint, children: "\u5148\u8BD5\u4E00\u4E2A\u300C\u5230\u8FBE\u56DE\u5408\u300D\u7684\u8282\u70B9\uFF1A\u7B2C 3 \u56DE\u5408\uFF0C\u6751\u53E3\u7684\u949F\u81EA\u5DF1\u54CD\u4E86\u3002\u4E5F\u53EF\u4EE5\u70B9\u4E0B\u9762\u7684\u300C\u8BA9 AI \u8D77\u8349\u5927\u7EB2\u300D\u62FF\u51E0\u4E2A\u8349\u7A3F\uFF0C\u518D\u81EA\u5DF1\u6539\u3002" })
      ] }) : beats.map((beat, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.stRpgCard, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.stRpgHead, style: { marginBottom: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: css.stRpgTitle, children: index + 1 + ". " + (beat.title || "\u672A\u547D\u540D\u8282\u70B9") }),
          isFired(beat) ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "span",
            {
              className: css.stChip,
              style: FIRED_TAG_STYLE,
              title: beat.firedAtTurn > 0 ? "\u5DF2\u5728\u7B2C " + beat.firedAtTurn + " \u56DE\u5408\u89E6\u53D1\u8FC7" : "\u5DF2\u7ECF\u89E6\u53D1\u8FC7",
              children: "\u5DF2\u89E6\u53D1"
            }
          ) : null,
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: css.stRpgSpacer }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: cx(css.stBtn, css.stBtnSm, index === 0 && css.stBtnDisabled),
              disabled: index === 0,
              title: "\u4E0E\u4E0A\u4E00\u4E2A\u8282\u70B9\u4EA4\u6362\u4F4D\u7F6E",
              onClick: () => moveBeat(index, -1),
              children: "\u4E0A\u79FB"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: cx(css.stBtn, css.stBtnSm, index === beats.length - 1 && css.stBtnDisabled),
              disabled: index === beats.length - 1,
              title: "\u4E0E\u4E0B\u4E00\u4E2A\u8282\u70B9\u4EA4\u6362\u4F4D\u7F6E",
              onClick: () => moveBeat(index, 1),
              children: "\u4E0B\u79FB"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: cx(css.stBtn, css.stBtnSm),
              style: { color: "#ff8a8a", borderColor: "#4a2b2b" },
              title: "\u5220\u9664\u8FD9\u4E2A\u8282\u70B9",
              onClick: () => removeBeat(index),
              children: "\u5220\u9664"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.stRpgCardMeta, children: [
          "\u89E6\u53D1\u6761\u4EF6\uFF1A",
          describeTrigger(beat.trigger)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u6807\u9898", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            className: css.stInput,
            value: beat.title,
            placeholder: "\u7ED9\u8FD9\u4E2A\u8282\u70B9\u8D77\u4E2A\u77ED\u540D\u5B57\uFF0C\u4F8B\u5982\uFF1A\u5317\u8FB9\u7684\u949F",
            onChange: (e) => patchBeat(index, { title: e.target.value })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Field, { label: "\u89E6\u53D1\u6761\u4EF6", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "select",
            {
              className: css.stInput,
              value: beat.trigger.kind,
              onChange: (e) => patchBeat(index, { trigger: retargetTrigger(e.target.value) }),
              children: TRIGGER_KINDS.map((k) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: k.kind, children: k.label }, k.kind))
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stRpgCardMeta, children: hintOf(beat.trigger.kind) })
        ] }),
        renderTriggerField(beat, index),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u89E6\u53D1\u540E\u5B88\u79D8\u4EBA\u5FC5\u987B\u6F14\u51FA\u7684\u5185\u5BB9", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "textarea",
          {
            className: cx(css.stInput, css.stTextarea),
            rows: 4,
            value: beat.event,
            placeholder: "\u6751\u53E3\u7684\u949F\u7A81\u7136\u81EA\u5DF1\u54CD\u4E86\uFF0C\u6240\u6709\u4EBA\u90FD\u505C\u4E0B\u624B\u91CC\u7684\u4E8B\u671B\u5411\u5317\u8FB9",
            onChange: (e) => patchBeat(index, { event: e.target.value })
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: css.stCheck, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "input",
            {
              type: "checkbox",
              checked: beat.once,
              onChange: (e) => patchBeat(index, { once: e.target.checked })
            }
          ),
          "\u53EA\u89E6\u53D1\u4E00\u6B21\uFF08\u89E6\u53D1\u540E\u81EA\u52A8\u9000\u4F11\uFF0C\u4E0D\u4F1A\u88AB\u91CD\u590D\u642C\u4E0A\u53F0\uFF09"
        ] })
      ] }, beat.id)),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: css.stRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Btn, { onClick: addBeat, children: "\u6DFB\u52A0\u8282\u70B9" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Btn, { variant: "primary", disabled: busy !== "", onClick: () => {
          void draftOutline();
        }, children: busy === "outline" ? "\u6B63\u5728\u8D77\u8349\u2026" : "\u8BA9 AI \u8D77\u8349\u5927\u7EB2" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Btn, { variant: "ghost", disabled: beats.length === 0, onClick: clearOutline, children: "\u6E05\u7A7A\u5927\u7EB2" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: css.stRpgCardMeta, children: "\u5171 " + beats.length + " \u4E2A\u8282\u70B9" + (firedCount > 0 ? "\uFF0C\u5176\u4E2D " + firedCount + " \u4E2A\u5DF2\u89E6\u53D1" : "") + "\uFF1B\u987A\u5E8F\u5C31\u662F\u7CFB\u7EDF\u7684\u5224\u5B9A\u987A\u5E8F\u3002" })
    ] })
  ] });
}

// src/client/panels/RpgPanel.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function logId() {
  return "l" + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
}
function splitRoute3(chatModel) {
  const parts = (chatModel || "").split("::");
  if (parts[0] === "custom") return { provider: "custom" };
  if (parts.length >= 2 && parts[0] !== "") return { provider: parts[0], model: parts.slice(1).join("::") };
  return {};
}
function withLog(state, entry) {
  return { ...state, log: [...state.log, entry] };
}
function withFacts(state, facts) {
  if (facts.length === 0) return state;
  const set = new Set(state.facts);
  for (const f of facts) set.add(f);
  return { ...state, facts: [...set].slice(-40) };
}
function withFired(state, fired, firedBeats) {
  if (fired.length === 0) return { ...state, firedBeats };
  let next = { ...state, firedBeats };
  for (const beat of fired) {
    next = withLog(next, {
      id: logId(),
      kind: "system",
      who: "\u5267\u60C5\u5927\u7EB2",
      text: "\u8282\u70B9\u300C" + (beat.title || beat.id) + "\u300D\u89E6\u53D1\uFF08" + beat.reason + "\uFF09",
      at: Date.now()
    });
  }
  return next;
}
function bandTone(band) {
  if (band === "triumph") return "#2e9e6b";
  if (band === "success") return "#3f8f5f";
  if (band === "costly") return "#b7873a";
  if (band === "narrow") return "#b7873a";
  if (band === "hair") return "#b8552f";
  if (band === "fail") return "#a83b3b";
  return "#7d2b2b";
}
function HpBar2(props) {
  const pct = props.maxHp > 0 ? Math.max(0, Math.min(100, Math.round(props.hp / props.maxHp * 100))) : 0;
  const color = pct > 60 ? "#3f8f5f" : pct > 30 ? "#b7873a" : "#a83b3b";
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { display: "inline-block", width: 64, height: 6, background: "#2a2f3a", borderRadius: 3, overflow: "hidden", verticalAlign: "middle" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { display: "block", width: pct + "%", height: "100%", background: color } }) });
}
function DiceBlock(props) {
  const r = props.result;
  const tone = bandTone(r.band);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { border: "1px solid " + tone, borderLeft: "4px solid " + tone, borderRadius: 8, padding: "10px 12px", background: "var(--st-panel, #161a21)" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontSize: 22, fontWeight: 700, color: "var(--st-text, #fff)" }, children: r.roll }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { color: "var(--st-text-dim, #8b93a1)", fontSize: 12 }, children: [
        "\u9700\u8981 ",
        r.required
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: tone, fontWeight: 700 }, children: r.bandLabel }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { color: "var(--st-text-dim, #8b93a1)", fontSize: 12 }, children: [
        "\u5DEE\u503C ",
        r.margin > 0 ? "+" + r.margin : String(r.margin),
        r.critical === "success" ? " \xB7 \u81EA\u7136\u5927\u6210\u529F" : r.critical === "failure" ? " \xB7 \u81EA\u7136\u5927\u5931\u8D25" : ""
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }, children: r.breakdown.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { fontSize: 11, color: "var(--st-text-dim, #8b93a1)", background: "var(--st-panel-2, #1e232c)", borderRadius: 5, padding: "2px 7px" }, children: [
      row.label,
      " ",
      row.value > 0 ? "+" + row.value : row.value
    ] }, i)) }),
    r.effects.hpLoss > 0 || r.effects.addStatus.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginTop: 8, fontSize: 12, color: "#c9a227" }, children: [
      "\u7CFB\u7EDF\u7ED3\u7B97\uFF1A",
      r.effects.hpLoss > 0 ? "\u635F\u5931 " + r.effects.hpLoss + " \u70B9\u751F\u547D" : "",
      r.effects.addStatus.length > 0 ? (r.effects.hpLoss > 0 ? "\uFF0C" : "") + "\u83B7\u5F97\u72B6\u6001\u300C" + r.effects.addStatus.join("\u3001") + "\u300D" : ""
    ] }) : null
  ] });
}
function LogRow(props) {
  const e = props.entry;
  if (e.kind === "check" && e.check) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { margin: "10px 0" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(DiceBlock, { result: e.check }) });
  }
  if (e.kind === "action") {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", margin: "8px 0" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { maxWidth: "82%", background: "var(--st-msg-user, #2c3446)", color: "var(--st-text, #e8e9ec)", borderRadius: "10px 10px 2px 10px", padding: "8px 12px", fontSize: 13, whiteSpace: "pre-wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "var(--st-text-dim, #8b93a1)", fontSize: 11, marginRight: 6 }, children: "\u4F60\u7684\u884C\u52A8" }),
      e.text
    ] }) });
  }
  if (e.kind === "speech") {
    const member = props.party.members.find((m) => m.name === e.who);
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: 8, margin: "8px 0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { width: 30, height: 30, borderRadius: "50%", overflow: "hidden", flex: "0 0 auto", background: "var(--st-panel-2, #2a2f3a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--st-text-dim, #c3c7cf)" }, children: member && member.avatar ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("img", { src: member.avatar, alt: e.who, style: { width: "100%", height: "100%", objectFit: "cover" } }) : (e.who || "?").slice(0, 1) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { background: "var(--st-msg-char, #1e232c)", color: "var(--st-text, #e8e9ec)", borderRadius: "10px 10px 10px 2px", padding: "8px 12px", fontSize: 13, maxWidth: "82%" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { color: "var(--st-text-dim, #7f8899)", fontSize: 11, marginBottom: 2 }, children: e.who }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: e.text })
      ] })
    ] });
  }
  if (e.kind === "result" || e.kind === "system") {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { margin: "8px 0", fontSize: 12, color: "var(--st-text-dim, #8b93a1)", borderLeft: "2px solid var(--st-border, #2e3644)", paddingLeft: 10 }, children: e.text });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { margin: "10px 0", fontSize: 13.5, lineHeight: 1.75, whiteSpace: "pre-wrap", color: "var(--st-text, #dfe3ea)" }, children: [
    e.who ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "var(--st-text-dim, #7f8899)", fontSize: 11, marginRight: 6 }, children: e.who }) : null,
    e.text
  ] });
}
function RpgPanel(props) {
  const [busy, setBusy] = (0, import_react6.useState)("");
  const [error, setError] = (0, import_react6.useState)("");
  const [action, setAction] = (0, import_react6.useState)("");
  const [actorId, setActorId] = (0, import_react6.useState)("");
  const [chatter, setChatter] = (0, import_react6.useState)(true);
  const [critEnabled, setCritEnabled] = (0, import_react6.useState)(true);
  const logRef = (0, import_react6.useRef)(null);
  const members = props.party.members;
  const actor = members.find((m) => m.id === actorId) ?? members[0];
  const route = splitRoute3(props.chatModel);
  (0, import_react6.useEffect)(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [props.state.log.length, busy]);
  (0, import_react6.useEffect)(() => {
    const carried = (props.incomingAction ?? "").trim();
    if (carried === "") return;
    setAction(carried);
    props.onIncomingConsumed?.();
  }, [props.incomingAction]);
  const settleParty = (memberId, result) => {
    const index = members.findIndex((m) => m.id === memberId);
    if (index < 0) return { line: "", party: props.party };
    const next = members.map((m, i) => {
      if (i !== index) return m;
      const updated = applyEffects(m, {
        hpLoss: result.effects.hpLoss,
        addStatus: result.effects.addStatus,
        removeStatus: result.effects.removeStatus,
        endsEncounter: result.effects.endsEncounter
      });
      return { ...m, hp: updated.hp, status: updated.status };
    });
    const bits = [];
    if (result.effects.hpLoss > 0) bits.push("\u635F\u5931 " + result.effects.hpLoss + " \u70B9\u751F\u547D");
    if (result.effects.addStatus.length > 0) bits.push("\u83B7\u5F97\u72B6\u6001\u300C" + result.effects.addStatus.join("\u3001") + "\u300D");
    if (result.effects.removeStatus.length > 0) bits.push("\u89E3\u9664\u72B6\u6001\u300C" + result.effects.removeStatus.join("\u3001") + "\u300D");
    const line = (members[index].name || "\u89D2\u8272") + (bits.length > 0 ? "\uFF1A" + bits.join("\uFF0C") : "\uFF1A\u72B6\u6001\u672A\u53D1\u751F\u53D8\u5316");
    return { line, party: { ...props.party, members: next } };
  };
  const requestCheck = async (option, encounter2, who, base) => {
    setBusy("check");
    setError("");
    try {
      const res = await props.api.rpgCheck(who, encounter2, option.id);
      props.onState({ ...base, pending: res.pending });
    } catch (e) {
      setError(e instanceof Error ? e.message : "\u7CFB\u7EDF\u8BA1\u7B97\u51FA\u9519");
    } finally {
      setBusy("");
    }
  };
  const rollPending = async (pending2, who) => {
    setBusy("roll");
    setError("");
    try {
      const result = await props.api.rpgRoll(pending2, critEnabled);
      const settled = settleParty(who.id, result);
      let next = {
        ...props.state,
        pending: null,
        // Feeds the outline's consecutive-success / consecutive-failure triggers.
        streak: nextStreak(props.state.streak ?? 0, result.success)
      };
      next = withLog(next, { id: logId(), kind: "action", who: who.name, text: pending2.option.label + "\uFF08" + who.name + "\uFF09", at: Date.now() });
      next = withLog(next, { id: logId(), kind: "check", who: "\u7CFB\u7EDF", text: "", check: result, at: Date.now() });
      if (settled.line !== "") next = withLog(next, { id: logId(), kind: "result", who: "\u7CFB\u7EDF", text: settled.line, at: Date.now() });
      if (result.effects.endsEncounter) next = { ...next, encounter: null };
      props.onParty(settled.party);
      props.onState(next);
      setBusy("narrate");
      const narrated = await props.api.rpgNarrate({
        state: next,
        party: settled.party.members,
        action: pending2.option.label,
        result,
        narratorPrompt: props.party.narratorPrompt,
        provider: route.provider,
        model: route.model
      });
      let after = { ...next, scene: narrated.scene, encounter: narrated.encounter };
      after = withLog(after, { id: logId(), kind: "scene", who: "\u5B88\u79D8\u4EBA", text: narrated.narration, at: Date.now() });
      after = withFired(after, narrated.fired ?? [], narrated.firedBeats ?? after.firedBeats);
      props.onState(after);
      if (chatter) await speakUp(after, settled.party, narrated.narration);
    } catch (e) {
      setError(e instanceof Error ? e.message : "\u5224\u5B9A\u5931\u8D25");
    } finally {
      setBusy("");
    }
  };
  const speakUp = async (state, party, beat) => {
    let current = state;
    for (const member of party.members) {
      try {
        const res = await props.api.rpgMember(member, current, beat, "", route);
        if (res.line.trim() === "") continue;
        current = withLog(current, { id: logId(), kind: "speech", who: member.name, text: res.line, at: Date.now() });
        props.onState(current);
      } catch {
      }
    }
  };
  const submitAction = async () => {
    const text = action.trim();
    if (text === "" || !actor) return;
    setBusy("turn");
    setError("");
    try {
      let next = { ...props.state, pending: null, turn: props.state.turn + 1 };
      next = withLog(next, { id: logId(), kind: "action", who: actor.name, text, at: Date.now() });
      props.onState(next);
      setAction("");
      const res = await props.api.rpgTurn({
        state: next,
        party: members,
        action: text,
        narratorPrompt: props.party.narratorPrompt,
        provider: route.provider,
        model: route.model
      });
      let after = { ...next, scene: res.scene, encounter: res.encounter, pending: null };
      after = withFacts(after, res.facts);
      after = withLog(after, { id: logId(), kind: "scene", who: "\u5B88\u79D8\u4EBA", text: res.narration, at: Date.now() });
      after = withFired(after, res.fired ?? [], res.firedBeats ?? after.firedBeats);
      props.onState(after);
      if (res.encounter !== null) {
        await speakUp(after, props.party, res.narration);
      } else if (res.check !== null && (res.checkKind === "combat" || res.checkKind === "chase")) {
        const fork = {
          id: "fork",
          kind: res.checkKind,
          title: res.checkKind === "combat" ? "\u4EA4\u950B\u5728\u5373" : "\u8FFD\u9010\u5F00\u59CB",
          description: "\u7CFB\u7EDF\u5224\u5B9A\u8FD9\u662F\u4E00\u4E2A" + (res.checkKind === "combat" ? "\u6B63\u9762\u4EA4\u950B" : "\u8FFD\u9010") + "\u573A\u9762\uFF0C\u628A\u4E24\u6761\u8DEF\u4E00\u5E76\u6446\u5728\u4F60\u9762\u524D\u3002",
          threat: res.checkThreat,
          options: [
            res.check,
            {
              id: "disengage",
              label: res.checkKind === "combat" ? "\u8131\u79BB\u6218\u6597" : "\u7529\u5F00\u8FFD\u51FB",
              attribute: "dex",
              skill: "",
              difficulty: Math.max(5, res.check.difficulty - 10),
              modifier: 0,
              hint: "\u4E0D\u604B\u6218\uFF0C\u4F18\u5148\u62C9\u5F00\u8DDD\u79BB\uFF1B\u6210\u529F\u5219\u6446\u8131\u63A5\u89E6\uFF0C\u5931\u8D25\u5219\u88AB\u54AC\u4F4F\u3002"
            }
          ]
        };
        props.onState({ ...after, encounter: fork });
        await speakUp(after, props.party, res.narration);
      } else if (res.check !== null) {
        const synthetic = {
          id: "act",
          kind: res.checkKind,
          title: "\u5F53\u524D\u884C\u52A8",
          description: "",
          threat: res.checkThreat,
          options: [res.check]
        };
        await requestCheck(res.check, synthetic, actor, after);
        await speakUp(after, props.party, res.narration);
      } else {
        await speakUp(after, props.party, res.narration);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "\u5B88\u79D8\u4EBA\u6CA1\u6709\u56DE\u5E94");
    } finally {
      setBusy("");
    }
  };
  const onOption = async (option) => {
    if (!actor || props.state.encounter === null) return;
    const advanced = { ...props.state, turn: props.state.turn + 1 };
    props.onState(advanced);
    await requestCheck(option, props.state.encounter, actor, advanced);
  };
  if (members.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stChar, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stEmpty, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { children: "\u8FD8\u6CA1\u6709\u961F\u4F0D\u3002\u8DD1\u56E2\u6A21\u5F0F\u9700\u8981\u81F3\u5C11\u4E00\u540D\u89D2\u8272\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Btn, { variant: "primary", onClick: props.onGotoParty, children: "\u53BB\u7EC4\u5EFA\u961F\u4F0D" })
    ] }) });
  }
  const pending = props.state.pending;
  const encounter = props.state.encounter;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stChar, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRpgHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: css.stRpgTitle, children: props.party.name || "\u5192\u9669" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: css.stRpgTurn, children: [
        "\u7B2C ",
        props.state.turn,
        " \u56DE\u5408"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: css.stRpgSpacer }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "checkbox", checked: critEnabled, onChange: (e) => setCritEnabled(e.target.checked) }),
        "\u81EA\u7136\u9AB0\u66B4\u51FB"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "checkbox", checked: chatter, onChange: (e) => setChatter(e.target.checked) }),
        "\u961F\u53CB\u53D1\u8A00"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgParty, children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "button",
      {
        type: "button",
        className: cx(css.stRpgChip, actor && actor.id === m.id && css.stRpgChipActive),
        onClick: () => setActorId(m.id),
        title: "\u672C\u6B21\u5224\u5B9A\u7684\u6267\u884C\u8005\uFF1A" + m.name,
        children: [
          m.avatar ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("img", { src: m.avatar, alt: m.name, style: { width: 18, height: 18, borderRadius: "50%", objectFit: "cover" } }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { width: 18, height: 18, borderRadius: "50%", background: "var(--st-panel-2, #39404f)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }, children: (m.name || "?").slice(0, 1) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: m.name }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HpBar2, { hp: m.hp, maxHp: m.maxHp }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { fontSize: 11, color: "var(--st-text-dim, #8b93a1)" }, children: [
            m.hp,
            "/",
            m.maxHp
          ] })
        ]
      },
      m.id
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { ref: logRef, className: css.stRpgLog, children: [
      props.state.log.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgHint, children: "\u63CF\u8FF0\u4F60\u60F3\u505A\u4EC0\u4E48\uFF0C\u5B88\u79D8\u4EBA\u4F1A\u63A8\u8FDB\u5267\u60C5\uFF1B\u5F53\u884C\u52A8\u7684\u7ED3\u679C\u4E0D\u786E\u5B9A\u65F6\uFF0C\u7CFB\u7EDF\u4F1A\u7B97\u51FA\u4F60\u9700\u8981\u63B7\u51FA\u7684\u6570\u5B57\uFF0C\u4F60\u63B7\u9AB0\uFF0C\u7136\u540E\u7531\u5B88\u79D8\u4EBA\u6765\u8BB2\u8FF0\u7ED3\u679C\u3002" }) : props.state.log.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(LogRow, { entry, party: props.party }, entry.id)),
      busy !== "" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgBusy, children: busy === "turn" ? "\u5B88\u79D8\u4EBA\u6B63\u5728\u601D\u8003\u2026" : busy === "narrate" ? "\u5B88\u79D8\u4EBA\u6B63\u5728\u53D9\u8FF0\u2026" : busy === "roll" ? "\u63B7\u9AB0\u4E2D\u2026" : "\u7CFB\u7EDF\u8BA1\u7B97\u4E2D\u2026" }) : null
    ] }),
    error !== "" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stNotice, children: error }) : null,
    pending !== null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRpgCard, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRpgCardTitle, children: [
        "\u7CFB\u7EDF\u5224\u5B9A\uFF1A",
        pending.computed.optionLabel
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRpgRequired, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: css.stRpgRequiredLabel, children: [
          pending.computed.actorName,
          " \u9700\u8981\u63B7\u51FA\u81F3\u5C11"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: css.stRpgRequiredValue, children: pending.computed.required }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: css.stRpgRequiredLabel, children: [
          "\uFF08d100 \xB7 ",
          pending.computed.difficultyLabel,
          "\uFF09"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgBreakdown, children: pending.computed.breakdown.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: css.stRpgBreakdownRow, children: [
        row.label,
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("b", { children: row.value > 0 ? "+" + row.value : row.value })
      ] }, i)) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Btn, { variant: "primary", disabled: busy !== "", onClick: () => {
          if (actor) void rollPending(pending, actor);
        }, children: busy === "roll" ? "\u63B7\u9AB0\u4E2D\u2026" : "\u63B7\u9AB0" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Btn, { disabled: busy !== "", onClick: () => props.onState({ ...props.state, pending: null }), children: "\u653E\u5F03" })
      ] })
    ] }) : encounter !== null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRpgCard, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgCardTitle, children: encounter.title }),
      encounter.description ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgCardDesc, children: encounter.description }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRpgCardMeta, children: [
        "\u5A01\u80C1 ",
        encounter.threat,
        " \xB7 ",
        encounter.kind
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgOptions, children: encounter.options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { type: "button", className: css.stRpgOption, disabled: busy !== "", onClick: () => {
        void onOption(o);
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: css.stRpgOptionLabel, children: o.label }),
        o.hint ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: css.stRpgOptionHint, children: o.hint }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: css.stRpgOptionMeta, children: [
          o.attribute === "" ? "\u7EAF\u8FD0\u6C14" : o.attribute.toUpperCase(),
          o.skill ? " \xB7 " + o.skill : ""
        ] })
      ] }, o.id)) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgHint, children: "\u9009\u62E9\u540E\u7531\u7CFB\u7EDF\u7B97\u51FA\u9700\u8981\u63B7\u51FA\u7684\u6570\u5B57\uFF0C\u518D\u7531\u4F60\u63B7\u9AB0\u3002" })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRpgInput, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "textarea",
        {
          className: cx(css.stInput, css.stTextarea),
          rows: 2,
          value: action,
          onChange: (e) => setAction(e.target.value),
          placeholder: actor ? "\u4EE5 " + actor.name + " \u7684\u8EAB\u4EFD\u5BA3\u544A\u884C\u52A8\u2026\uFF08Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C\uFF09" : "\u5BA3\u544A\u884C\u52A8\u2026",
          onKeyDown: (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submitAction();
            }
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Btn, { variant: "primary", disabled: busy !== "" || action.trim() === "", onClick: () => {
        void submitAction();
      }, children: busy === "turn" ? "\u2026" : "\u884C\u52A8" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Section, { title: "\u5267\u672C\u4E0E\u5267\u60C5\u5927\u7EB2", hint: "\u4F60\u5199\uFF0C\u6216\u8005\u8BA9 AI \u8D77\u8349\uFF1B\u89E6\u53D1\u6761\u4EF6\u7531\u7CFB\u7EDF\u5224\u5B9A", defaultOpen: false, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      OutlineEditor,
      {
        api: props.api,
        party: props.party.members,
        setup: props.state.setup,
        onChange: (next) => props.onState({ ...props.state, setup: next }),
        chatModel: props.chatModel,
        firedBeats: props.state.firedBeats ?? []
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(Section, { title: "\u5192\u9669\u8BBE\u7F6E", hint: "\u8FD9\u4E9B\u5F00\u5173\u53EA\u5F71\u54CD\u672C\u5C40", defaultOpen: false, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Field, { label: "\u81EA\u7136\u9AB0\u66B4\u51FB\uFF08\u63B7\u51FA 96-100 \u89C6\u4E3A\u5927\u6210\u529F\uFF0C1-5 \u89C6\u4E3A\u5927\u5931\u8D25\uFF0C\u8986\u76D6\u5DEE\u503C\u6863\u4F4D\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "checkbox", checked: critEnabled, onChange: (e) => setCritEnabled(e.target.checked) }),
        critEnabled ? "\u542F\u7528\uFF08\u66F4\u620F\u5267\u5316\uFF09" : "\u5173\u95ED\uFF08\u5B8C\u5168\u6309\u5DEE\u503C\u5224\u5B9A\uFF09"
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Field, { label: "\u961F\u53CB\u53D1\u8A00\uFF08\u6BCF\u6B21\u53D9\u8FF0\u540E\uFF0C\u961F\u4F0D\u6210\u5458\u6309\u5404\u81EA\u7684\u6A21\u578B\u9010\u4E00\u5F00\u53E3\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "checkbox", checked: chatter, onChange: (e) => setChatter(e.target.checked) }),
        chatter ? "\u5F00\u542F" : "\u5173\u95ED"
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Field, { label: "\u5F53\u524D\u573A\u666F\u6458\u8981\uFF08\u53EF\u624B\u52A8\u4FEE\u6B63\uFF0C\u4F1A\u4F5C\u4E3A\u540E\u7EED\u56DE\u5408\u7684\u4E0A\u4E0B\u6587\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "textarea",
        {
          className: cx(css.stInput, css.stTextarea),
          rows: 3,
          value: props.state.scene,
          onChange: (e) => props.onState({ ...props.state, scene: e.target.value })
        }
      ) }),
      props.state.facts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Field, { label: "\u5DF2\u786E\u7ACB\u7684\u4E8B\u5B9E\uFF08" + props.state.facts.length + " \u6761\uFF0C\u5B88\u79D8\u4EBA\u5FC5\u987B\u4FDD\u6301\u4E00\u81F4\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgFacts, children: props.state.facts.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: css.stRpgFact, children: f }, i)) }) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: css.stRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Btn, { onClick: () => {
          props.onState({ ...props.state, log: [], encounter: null, pending: null, facts: [], turn: 0, streak: 0, firedBeats: [] });
        }, children: "\u6E05\u7A7A\u672C\u5C40\u8BB0\u5F55" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Btn, { onClick: () => {
          props.onState({ ...props.state, log: [], encounter: null, pending: null, facts: [], turn: 0, streak: 0, firedBeats: [], scene: "" });
        }, children: "\u91CD\u5F00\u4E00\u5C40\uFF08\u4FDD\u7559\u5267\u672C\uFF09" })
      ] })
    ] })
  ] });
}

// src/client/character-bridge.ts
var ABILITY_ATTR = {
  \u5251\u672F: "str",
  \u683C\u6597: "str",
  \u6500\u722C: "str",
  \u9B54\u6CD5: "int",
  \u70BC\u91D1: "int",
  \u5DE5\u7A0B: "int",
  \u6F5C\u884C: "dex",
  \u9A91\u672F: "dex",
  \u7BAD\u672F: "dex",
  \u8BF4\u670D: "cha",
  \u97F3\u4E50: "cha",
  \u5916\u4EA4: "cha",
  \u9A6F\u517D: "wis",
  \u533B\u672F: "wis",
  \u5360\u535C: "wis",
  \u70F9\u996A: "wis",
  \u8FFD\u8E2A: "wis"
};
var JOB_LEAN = {
  \u6218\u58EB: { str: 3, con: 1 },
  \u9A91\u58EB: { str: 2, cha: 2 },
  \u5DE5\u5320: { str: 2, int: 1, con: 1 },
  \u76D7\u8D3C: { dex: 3, wis: 1 },
  \u730E\u4EBA: { dex: 2, wis: 2 },
  \u6E38\u4FA0: { dex: 2, wis: 2 },
  \u6CD5\u5E08: { int: 3, wis: 1 },
  \u5B66\u8005: { int: 3, wis: 1 },
  \u672F\u58EB: { int: 2, cha: 1, con: 1 },
  \u7267\u5E08: { cha: 2, wis: 2 },
  \u541F\u6E38\u8BD7\u4EBA: { cha: 3, dex: 1 },
  \u5546\u4EBA: { cha: 3, int: 1 }
};
function nudge(score, weight) {
  const raw = (Number(score) - 5) * weight;
  return raw >= 0 ? Math.round(raw) : -Math.round(-raw);
}
function clampAttr(value) {
  return Math.min(18, Math.max(6, Math.round(value)));
}
function clean(text, name) {
  return String(text ?? "").split("{{char}}").join(name || "\u89D2\u8272").split("{{user}}").join("\u73A9\u5BB6").trim();
}
function skillsFromAbilities(abilities) {
  const out = [];
  for (const ability of abilities ?? []) {
    const name = String(ability ?? "").trim();
    if (name === "" || out.some((s) => s.name === name)) continue;
    out.push({ name, attr: ABILITY_ATTR[name] ?? "wis", bonus: ABILITY_ATTR[name] === void 0 ? 3 : 5 });
    if (out.length >= 10) break;
  }
  return out;
}
function personaFromCard(card, spec, name) {
  const parts = [];
  if (card !== null) {
    const d = card.data;
    if (d.description) parts.push(clean(d.description, name));
    if (d.personality) parts.push("\u6027\u683C\uFF1A" + clean(d.personality, name));
    if (d.system_prompt) parts.push("\u884C\u4E3A\u51C6\u5219\uFF1A" + clean(d.system_prompt, name));
  }
  if (parts.length === 0 && spec !== null) {
    const b = spec.basic;
    const p = spec.personality;
    const bg = spec.background;
    parts.push(name + "\uFF0C" + (b.ageUnknown ? "\u5E74\u9F84\u672A\u77E5" : b.age + " \u5C81") + "\u7684" + b.gender + "\u6027" + (b.race === "\u81EA\u5B9A\u4E49" ? b.raceCustom || "\u672A\u77E5\u79CD\u65CF" : b.race) + (b.job === "\u81EA\u5B9A\u4E49" ? b.jobCustom || "" : b.job) + "\u3002");
    if (p.traits.length > 0) parts.push("\u6027\u683C\u5173\u952E\u8BCD\uFF1A" + p.traits.join("\u3001") + "\u3002");
    if (bg.origin) parts.push("\u51FA\u8EAB\uFF1A" + bg.origin + "\u3002");
    if (bg.experience) parts.push("\u7ECF\u5386\uFF1A" + bg.experience + "\u3002");
    if (spec.abilities.length > 0) parts.push("\u64C5\u957F\uFF1A" + spec.abilities.join("\u3001") + "\u3002");
  }
  return parts.join("\n").slice(0, 2e3);
}
function memberFromCard(card, spec, avatar, index) {
  const name = (card?.data.name || spec?.basic.name || "").trim() || "\u961F\u5458 " + (index + 1);
  const job = card !== null ? spec?.basic.job ?? "" : spec?.basic.job ?? "";
  const jobName = job === "\u81EA\u5B9A\u4E49" ? spec?.basic.jobCustom ?? "" : job;
  const abilities = spec?.abilities ?? [];
  const p = spec?.personality;
  const attributes = { str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11 };
  const lean = JOB_LEAN[jobName] ?? {};
  for (const key of Object.keys(lean)) {
    attributes[key] += lean[key] ?? 0;
  }
  if (p !== void 0 && p !== null) {
    attributes.con += nudge(p.stability, 0.6);
    attributes.int += nudge(p.openness, 0.6);
    attributes.wis += nudge(p.conscientiousness, 0.6);
    attributes.cha += nudge((p.extroversion + p.agreeableness) / 2, 0.6);
    attributes.str += nudge(p.extroversion, 0.3);
    attributes.dex += nudge(p.openness, 0.3);
  }
  for (const key of Object.keys(attributes)) {
    attributes[key] = clampAttr(attributes[key]);
  }
  const skills = skillsFromAbilities(abilities);
  const carried = card?.data.extensions;
  const portrait = avatar !== "" ? avatar : typeof carried?.avatar === "string" ? carried.avatar : "";
  const maxHp = Math.max(8, 16 + (attributes.con - 10) * 2);
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
    llm: { ...INHERIT_ROUTE }
  });
}
function cardFromMember(member) {
  const stats = Object.keys(member.attributes).map((key) => key.toUpperCase() + " " + member.attributes[key]).join(" / ");
  const skills = member.skills.length > 0 ? member.skills.map((s) => s.name + (s.bonus ? " +" + s.bonus : "")).join("\u3001") : "\uFF08\u672A\u5217\u51FA\uFF09";
  const description = [
    member.name + (member.role ? "\uFF0C" + member.role + "\u3002" : "\u3002"),
    member.prompt ? member.prompt : "",
    "",
    "\u5C5E\u6027\uFF1A" + stats,
    "\u64C5\u957F\uFF1A" + skills,
    "\u751F\u547D\uFF1A" + member.hp + "/" + member.maxHp,
    member.status.length > 0 ? "\u5F53\u524D\u72B6\u6001\uFF1A" + member.status.join("\u3001") : ""
  ].filter((line) => line !== "").join("\n");
  const tags = [member.role, "\u4FBF\u643A\u9152\u9986\u961F\u4F0D"].filter((t) => t !== "");
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: member.name,
      description,
      personality: member.prompt ? member.prompt.slice(0, 400) : member.role || "\u6027\u683C\u9C9C\u660E",
      scenario: "",
      first_mes: member.name + "\u770B\u5411\u4F60\uFF0C\u7B49\u4F60\u5148\u5F00\u53E3\u3002",
      mes_example: "",
      creator_notes: "\u7531 dsh-portable-tavern \u4ECE\u961F\u4F0D\u6210\u5458\u5BFC\u51FA",
      system_prompt: member.prompt,
      post_history_instructions: "",
      alternate_greetings: [],
      tags,
      creator: "dsh-portable-tavern",
      character_version: "1.0",
      extensions: member.avatar !== "" ? { avatar: member.avatar } : {}
    }
  };
}

// src/client/storage.ts
var DB_NAME = "dsh-portable-tavern";
var DB_VERSION = 1;
var STORE_NAME = "kv";
var HEAVY_KEYS = {
  workspace: "dsh.portable-tavern.workspace.v1",
  characters: "dsh.portable-tavern.characters.v1",
  parties: "dsh.portable-tavern.parties.v1",
  party: "dsh.portable-tavern.party.current.v1",
  threads: "dsh.portable-tavern.threads.v1",
  rpg: "dsh.portable-tavern.rpg.v1"
};
var reporter = null;
function onStorageIssue(fn) {
  reporter = fn;
}
var reported = /* @__PURE__ */ new Set();
function report(key, op, error) {
  const message = error instanceof Error ? error.message : String(error);
  const stamp = op + ":" + key + ":" + message;
  if (reported.has(stamp)) return;
  reported.add(stamp);
  console.warn("[portable-tavern] storage " + op + " failed for " + key, error);
  if (reporter !== null) reporter({ key, op, message });
}
var dbPromise = null;
function openDb() {
  if (dbPromise !== null) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        report("(db)", "read", request.error);
        resolve(null);
      };
      request.onblocked = () => resolve(null);
    } catch (error) {
      report("(db)", "read", error);
      resolve(null);
    }
  });
  return dbPromise;
}
function transact(mode, run) {
  return openDb().then((db) => {
    if (db === null) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const request = run(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}
async function loadRecord(key, fallbackKey) {
  const hit = await transact("readonly", (store) => store.get(key));
  if (hit !== void 0 && hit !== null) return hit;
  if (fallbackKey !== void 0) {
    try {
      const raw = localStorage.getItem(fallbackKey);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        void saveRecord(key, parsed);
        return parsed;
      }
    } catch {
    }
  }
  return null;
}
async function saveRecord(key, value) {
  const result = await transact("readwrite", (store) => store.put(value, key));
  if (result !== null) {
    try {
      localStorage.removeItem(key);
    } catch {
    }
    reported.delete("write:" + key + ":IndexedDB \u5199\u5165\u5931\u8D25");
    return true;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    report(key, "write", error);
    return false;
  }
}
function readPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    report(key, "write", error);
    return false;
  }
}
async function storageEstimate() {
  try {
    if (typeof navigator === "undefined" || navigator.storage === void 0) return null;
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}

// src/client/st/emitter.ts
var event_types = {
  APP_READY: "app_ready",
  APP_INITIALIZED: "app_initialized",
  EXTRAS_CONNECTED: "extras_connected",
  CHAT_CHANGED: "chat_id_changed",
  CHAT_ID_CHANGED: "chat_id_changed",
  CHAT_LOADED: "chatLoaded",
  CHAT_CREATED: "chat_created",
  CHATCREATED: "chat_created",
  CHAT_RENAMED: "chat_renamed",
  CHAT_DELETED: "chat_deleted",
  GROUP_CHAT_DELETED: "group_chat_deleted",
  MESSAGE_SENT: "message_sent",
  MESSAGE_RECEIVED: "message_received",
  MESSAGE_EDITED: "message_edited",
  MESSAGE_DELETED: "message_deleted",
  MESSAGE_UPDATED: "message_updated",
  MESSAGE_SWIPED: "message_swiped",
  MESSAGE_FILE_EMBEDDED: "message_file_embedded",
  USER_MESSAGE_RENDERED: "user_message_rendered",
  CHARACTER_MESSAGE_RENDERED: "character_message_rendered",
  IMPERSONATE_READY: "impersonate_ready",
  GENERATION_AFTER_COMMANDS: "GENERATION_AFTER_COMMANDS",
  GENERATION_STARTED: "generation_started",
  GENERATION_STOPPED: "generation_stopped",
  GENERATION_ENDED: "generation_ended",
  STREAM_TOKEN_RECEIVED: "stream_token_received",
  TOOL_CALLS_PERFORMED: "tool_calls_performed",
  TOOL_CALLS_RENDERED: "tool_calls_rendered",
  SETTINGS_LOADED: "settings_loaded",
  SETTINGS_LOADED_BEFORE: "settings_loaded_before",
  SETTINGS_LOADED_AFTER: "settings_loaded_after",
  SETTINGS_UPDATED: "settings_updated",
  EXTENSION_SETTINGS_LOADED: "extension_settings_loaded",
  EXTENSIONS_FIRST_LOAD: "extensions_first_load",
  GROUP_UPDATED: "group_updated",
  WORLDINFO_UPDATED: "worldinfo_updated",
  WORLDINFO_ENTRIES_LOADED: "worldinfo_entries_loaded",
  CHARACTER_EDITED: "character_edited",
  CHARACTER_DELETED: "character_deleted",
  CHARACTER_DUPLICATED: "character_duplicated",
  CHARACTER_MANAGEMENT_OPENED: "character_management_opened",
  PERSONA_CHANGED: "persona_changed",
  MAIN_API_CHANGED: "main_api_changed",
  ONLINE_STATUS_CHANGED: "online_status_changed",
  FORCE_SET_BACKGROUND: "force_set_background",
  MOVABLE_PANELS_RESET: "movable_panels_reset",
  PRESET_CHANGED: "preset_changed"
};
var REPLAY_EVENTS = [event_types.APP_READY, event_types.APP_INITIALIZED];
function insertRecord(records, rec) {
  if (rec.first) {
    let i = 0;
    while (i < records.length && records[i].first) i++;
    records.splice(i, 0, rec);
    return;
  }
  if (rec.last) {
    records.push(rec);
    return;
  }
  let at = records.length;
  for (let i = 0; i < records.length; i++) {
    if (records[i].last) {
      at = i;
      break;
    }
  }
  records.splice(at, 0, rec);
}
var StEventSource = class {
  /** 事件名 -> 监听器列表。 */
  _records = {};
  /** onAny 注册的监听器。 */
  _any = [];
  /** 需要补发的事件 -> 最后一次 emit 的参数。 */
  _last = {};
  /** 当前加载窗口归属的扩展 id；期间注册的监听器都记在它名下。 */
  _owner = "";
  /** 注册一个持久监听器。 */
  on(event, listener, once = false) {
    if (typeof event !== "string" || typeof listener !== "function") return;
    const rec = { fn: listener, once, owner: this._owner, first: false, last: false };
    const list = this._records[event] || (this._records[event] = []);
    if (once && this._last[event] && REPLAY_EVENTS.indexOf(event) >= 0) {
      void this._call(rec, event, this._last[event]);
      return;
    }
    insertRecord(list, rec);
    this._replay(event, rec);
  }
  /** 注册只触发一次的监听器。 */
  once(event, listener) {
    this.on(event, listener, true);
  }
  /** 注册监听器并排到所有普通监听器之前。 */
  makeFirst(event, listener) {
    if (typeof event !== "string" || typeof listener !== "function") return;
    const list = this._records[event] || (this._records[event] = []);
    const rec = { fn: listener, once: false, owner: this._owner, first: true, last: false };
    insertRecord(list, rec);
    this._replay(event, rec);
  }
  /** 注册监听器并排到所有普通监听器之后。 */
  makeLast(event, listener) {
    if (typeof event !== "string" || typeof listener !== "function") return;
    const list = this._records[event] || (this._records[event] = []);
    const rec = { fn: listener, once: false, owner: this._owner, first: false, last: true };
    insertRecord(list, rec);
    this._replay(event, rec);
  }
  /** 注册一个“任何事件都会收到”的监听器（参数为 event 名 + 原参数）。 */
  onAny(listener) {
    if (typeof listener !== "function") return;
    this._any.push({ fn: listener, once: false, owner: this._owner, first: false, last: false });
  }
  /** 注销 onAny 监听器。 */
  offAny(listener) {
    this._any = this._any.filter((rec) => rec.fn !== listener);
  }
  /** 注销一个监听器（on / once / makeFirst / makeLast 注册的都能注销）。 */
  removeListener(event, listener) {
    const list = this._records[event];
    if (!list) return;
    this._records[event] = list.filter((rec) => rec.fn !== listener);
  }
  /** removeListener 的别名。 */
  off(event, listener) {
    this.removeListener(event, listener);
  }
  /** 清空监听器；带 event 只清该事件。 */
  removeAllListeners(event) {
    if (typeof event === "string") {
      delete this._records[event];
      return;
    }
    this._records = {};
    this._any = [];
  }
  /** 派发一个事件；按注册顺序逐个 await，异常全部吞掉并 console.error。 */
  async emit(event, ...args) {
    await this.emitAndWait(event, ...args);
  }
  /** 与 emit 相同，但返回每个监听器的返回值数组。 */
  async emitAndWait(event, ...args) {
    if (typeof event !== "string") return [];
    const results = [];
    if (REPLAY_EVENTS.indexOf(event) >= 0) this._last[event] = args.slice();
    const list = (this._records[event] || []).slice();
    for (const rec of list) {
      if (rec.once) this._removeRecord(event, rec);
      results.push(await this._call(rec, event, args));
    }
    for (const rec of this._any.slice()) {
      results.push(await this._call(rec, event, [event].concat(args)));
    }
    return results;
  }
  /**
   * 等待某个事件满足条件（predicate 可省略 = 第一次触发即完成）。
   * timeout > 0 时超时会 reject；否则一直等。
   */
  waitUntil(event, predicate, timeout) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        this.removeListener(event, handler);
        if (timer !== null) clearTimeout(timer);
      };
      const handler = (...args) => {
        if (typeof predicate === "function") {
          let ok = false;
          try {
            ok = !!predicate(...args);
          } catch {
            ok = false;
          }
          if (!ok) return;
        }
        cleanup();
        resolve(args);
      };
      this.on(event, handler);
      if (typeof timeout === "number" && timeout > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error("waitUntil \u8D85\u65F6\uFF1A" + event));
        }, timeout);
      }
    });
  }
  /** 该事件当前监听器数量。 */
  listenerCount(event) {
    return (this._records[event] || []).length;
  }
  /** 当前有监听器的事件名列表。 */
  eventNames() {
    return Object.keys(this._records);
  }
  /** 该事件是否已经 emit 过（用于判断补发是否可用）。 */
  hasEmitted(event) {
    return Object.prototype.hasOwnProperty.call(this._last, event);
  }
  /** 该事件最后一次 emit 的参数（没有则 null）。 */
  lastArgs(event) {
    return this._last[event] || null;
  }
  /** 开启加载窗口：期间注册的监听器归属 owner（扩展 id）。 */
  beginScope(owner) {
    this._owner = owner || "";
  }
  /** 关闭加载窗口。 */
  endScope() {
    this._owner = "";
  }
  /** 按归属批量注销（unload 一个扩展时调用），返回注销条数。 */
  removeByOwner(owner) {
    let removed = 0;
    for (const event of Object.keys(this._records)) {
      const before = this._records[event].length;
      this._records[event] = this._records[event].filter((rec) => rec.owner !== owner);
      removed += before - this._records[event].length;
    }
    const anyBefore = this._any.length;
    this._any = this._any.filter((rec) => rec.owner !== owner);
    removed += anyBefore - this._any.length;
    return removed;
  }
  /** 归属统计，诊断用。 */
  ownerStats() {
    const stats = {};
    const bump = (owner) => {
      stats[owner || "(host)"] = (stats[owner || "(host)"] || 0) + 1;
    };
    for (const event of Object.keys(this._records)) for (const rec of this._records[event]) bump(rec.owner);
    for (const rec of this._any) bump(rec.owner);
    return stats;
  }
  /** 内部：补发最后一次参数（仅 REPLAY_EVENTS）。 */
  _replay(event, rec) {
    if (REPLAY_EVENTS.indexOf(event) < 0) return;
    const last = this._last[event];
    if (!last) return;
    void this._call(rec, event, last);
  }
  /** 内部：调用一个监听器，异常吞掉并 console.error。 */
  async _call(rec, event, args) {
    try {
      return await rec.fn(...args);
    } catch (e) {
      try {
        console.error("[portable-tavern/st] \u4E8B\u4EF6\u76D1\u542C\u5668\u5F02\u5E38 (" + event + ")", e);
      } catch {
      }
      return void 0;
    }
  }
  /** 内部：从列表移除一条记录。 */
  _removeRecord(event, rec) {
    const list = this._records[event];
    if (!list) return;
    const i = list.indexOf(rec);
    if (i >= 0) list.splice(i, 1);
  }
};
function createEventSource() {
  return new StEventSource();
}

// src/client/st/libs-pure.ts
function toStringValue(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
function escapeHtml(value) {
  return toStringValue(value).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;").split("'").join("&#x27;").split("=").join("&#x3D;").split(String.fromCharCode(96)).join("&#x60;");
}
function toPath(path) {
  if (Array.isArray(path)) return path.map((p) => typeof p === "number" ? p : String(p));
  if (typeof path === "number") return [path];
  const text = typeof path === "string" ? path : String(path === null || path === void 0 ? "" : path);
  const parts = [];
  for (const chunk of text.split(".")) {
    if (!chunk) continue;
    let rest = chunk;
    const head = rest.split("[")[0];
    if (head) parts.push(head);
    rest = rest.slice(head.length);
    while (rest.length > 1 && rest.charAt(0) === "[") {
      const close = rest.indexOf("]");
      if (close < 0) break;
      const inner = rest.slice(1, close);
      const n = Number(inner);
      parts.push(inner !== "" && String(n) === inner ? n : inner);
      rest = rest.slice(close + 1);
    }
  }
  return parts;
}
function cloneDeep(value, seen) {
  if (value === null || typeof value !== "object") return value;
  const map = seen || /* @__PURE__ */ new WeakMap();
  const known = map.get(value);
  if (known !== void 0) return known;
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Map) {
    const out2 = /* @__PURE__ */ new Map();
    map.set(value, out2);
    value.forEach((v, k) => out2.set(cloneDeep(k, map), cloneDeep(v, map)));
    return out2;
  }
  if (value instanceof Set) {
    const out2 = /* @__PURE__ */ new Set();
    map.set(value, out2);
    value.forEach((v) => out2.add(cloneDeep(v, map)));
    return out2;
  }
  if (Array.isArray(value)) {
    const out2 = [];
    map.set(value, out2);
    for (const item of value) out2.push(cloneDeep(item, map));
    return out2;
  }
  const out = {};
  map.set(value, out);
  for (const key of Object.keys(value)) {
    out[key] = cloneDeep(value[key], map);
  }
  return out;
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function mergeDeep(target, ...sources) {
  for (const source of sources) {
    if (source === null || typeof source !== "object") continue;
    for (const key of Object.keys(source)) {
      const from = source[key];
      const current = target[key];
      if (Array.isArray(from) && Array.isArray(current)) {
        for (let i = 0; i < from.length; i++) {
          const item = from[i];
          if (isPlainObject(item) && isPlainObject(current[i])) current[i] = mergeDeep(current[i], item);
          else if (item !== void 0) current[i] = cloneDeep(item);
        }
      } else if (isPlainObject(from) && isPlainObject(current)) {
        mergeDeep(current, from);
      } else if (from !== void 0) {
        target[key] = cloneDeep(from);
      }
    }
  }
  return target;
}
function getPath(object, path, defaultValue) {
  const parts = toPath(path);
  if (parts.length === 0) return object === void 0 ? defaultValue : object;
  let current = object;
  for (const part of parts) {
    if (current === null || current === void 0) return defaultValue;
    current = current[part];
  }
  return current === void 0 ? defaultValue : current;
}
function setPath(object, path, value) {
  const parts = toPath(path);
  if (parts.length === 0) return object;
  if (object === null || typeof object !== "object") return object;
  let current = object;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    if (current[key] === null || current[key] === void 0 || typeof current[key] !== "object") {
      current[key] = typeof nextKey === "number" ? [] : {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
  return object;
}
function hasPath(object, path) {
  const parts = toPath(path);
  if (parts.length === 0) return false;
  let current = object;
  for (const part of parts) {
    if (current === null || current === void 0) return false;
    if (!(part in Object(current))) return false;
    current = current[part];
  }
  return true;
}
function baseIteratee(iteratee) {
  if (typeof iteratee === "function") return iteratee;
  if (iteratee === null || iteratee === void 0) return (value) => value;
  if (typeof iteratee === "object" && !Array.isArray(iteratee)) {
    const source = iteratee;
    return (value) => {
      for (const key of Object.keys(source)) {
        if ((value === null || value === void 0 ? void 0 : value[key]) !== source[key]) return false;
      }
      return true;
    };
  }
  return (value) => getPath(value, iteratee);
}
function entriesOf(collection) {
  if (collection === null || collection === void 0) return [];
  if (Array.isArray(collection) || typeof collection === "string") {
    return Array.from(collection).map((value, i) => [i, value]);
  }
  if (collection instanceof Map) return Array.from(collection.entries());
  if (collection instanceof Set) return Array.from(collection.values()).map((v, i) => [i, v]);
  if (typeof collection === "object") {
    return Object.keys(collection).map((k) => [k, collection[k]]);
  }
  return [];
}
function isEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") {
    return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b);
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isEqual(a[key], b[key])) return false;
  }
  return true;
}
function wordsOf(value) {
  const text = toStringValue(value).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return text.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 0);
}
function debounce(fn, wait = 0, options) {
  const leading = !!(options && options.leading);
  const trailing = !(options && options.trailing === false);
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let result;
  const invoke = () => {
    const args = lastArgs || [];
    const ctx = lastThis;
    lastArgs = null;
    lastThis = null;
    result = fn.apply(ctx, args);
    return result;
  };
  const debounced = function(...args) {
    const idle = timer === null;
    lastArgs = args;
    lastThis = this;
    if (timer !== null) clearTimeout(timer);
    if (leading && idle) invoke();
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) invoke();
    }, Math.max(0, wait));
    return result;
  };
  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
    lastThis = null;
  };
  debounced.flush = () => {
    if (timer !== null && lastArgs) {
      clearTimeout(timer);
      timer = null;
      return invoke();
    }
    return result;
  };
  return debounced;
}
function throttle(fn, wait = 0, options) {
  const leading = !(options && options.leading === false);
  const trailing = !(options && options.trailing === false);
  let last = 0;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let result;
  const invoke = () => {
    last = Date.now();
    const args = lastArgs || [];
    const ctx = lastThis;
    lastArgs = null;
    lastThis = null;
    result = fn.apply(ctx, args);
    return result;
  };
  const throttled = function(...args) {
    const now = Date.now();
    if (last === 0 && !leading) last = now;
    const remaining = wait - (now - last);
    lastArgs = args;
    lastThis = this;
    if (remaining <= 0 || remaining > wait) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      invoke();
    } else if (timer === null && trailing) {
      timer = setTimeout(() => {
        timer = null;
        last = leading ? Date.now() : 0;
        invoke();
      }, remaining);
    }
    return result;
  };
  throttled.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    last = 0;
    lastArgs = null;
    lastThis = null;
  };
  throttled.flush = () => {
    if (timer !== null && lastArgs) {
      clearTimeout(timer);
      timer = null;
      return invoke();
    }
    return result;
  };
  return throttled;
}
function collectPaths(paths) {
  const out = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      if (value.length > 0 && value.every((v) => typeof v === "number")) {
        for (const v of value) out.push(v);
      } else if (value.length > 0 && value.every((v) => typeof v === "string" && v.indexOf(".") < 0 && v.indexOf("[") < 0)) {
        for (const v of value) {
          out.push(String(v));
        }
      } else {
        for (const v of value) walk(v);
      }
      return;
    }
    for (const part of toPath(value)) out.push(part);
  };
  for (const p of paths) walk(p);
  return out;
}
var lodashSubset = {
  get: getPath,
  set: setPath,
  has: hasPath,
  cloneDeep,
  clone: (value) => {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.slice();
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    return Object.assign({}, value);
  },
  merge: (target, ...sources) => mergeDeep(target, ...sources),
  debounce,
  throttle,
  isEmpty: (value) => {
    if (value === null || value === void 0) return true;
    if (typeof value === "string" || Array.isArray(value)) return value.length === 0;
    if (value instanceof Map || value instanceof Set) return value.size === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return true;
  },
  isObject: (value) => value !== null && (typeof value === "object" || typeof value === "function"),
  isArray: Array.isArray,
  isString: (value) => typeof value === "string",
  isFunction: (value) => typeof value === "function",
  isNil: (value) => value === null || value === void 0,
  isEqual,
  forEach: (collection, iteratee) => {
    const fn = baseIteratee(iteratee);
    for (const [key, value] of entriesOf(collection)) {
      if (fn(value, key, collection) === false) break;
    }
    return collection;
  },
  map: (collection, iteratee) => {
    const fn = baseIteratee(iteratee);
    return entriesOf(collection).map(([key, value]) => fn(value, key, collection));
  },
  filter: (collection, predicate) => {
    const fn = baseIteratee(predicate);
    const out = [];
    for (const [key, value] of entriesOf(collection)) if (fn(value, key, collection)) out.push(value);
    return out;
  },
  find: (collection, predicate) => {
    const fn = baseIteratee(predicate);
    for (const [key, value] of entriesOf(collection)) if (fn(value, key, collection)) return value;
    return void 0;
  },
  uniqBy: (collection, iteratee) => {
    const fn = baseIteratee(iteratee);
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const [key, value] of entriesOf(collection)) {
      const mark = toStringValue(fn(value, key, collection));
      if (seen.has(mark)) continue;
      seen.add(mark);
      out.push(value);
    }
    return out;
  },
  sortBy: (collection, ...iteratees) => {
    const fns = iteratees.length > 0 ? iteratees.map(baseIteratee) : [baseIteratee(void 0)];
    return entriesOf(collection).map(([key, value]) => ({ key, value })).sort((a, b) => {
      for (const fn of fns) {
        const va = fn(a.value, a.key, collection);
        const vb = fn(b.value, b.key, collection);
        if (va === vb) continue;
        if (va === void 0 || va === null) return 1;
        if (vb === void 0 || vb === null) return -1;
        return va > vb ? 1 : -1;
      }
      return 0;
    }).map((entry) => entry.value);
  },
  groupBy: (collection, iteratee) => {
    const fn = baseIteratee(iteratee);
    const out = {};
    for (const [key, value] of entriesOf(collection)) {
      const group = toStringValue(fn(value, key, collection));
      if (!out[group]) out[group] = [];
      out[group].push(value);
    }
    return out;
  },
  keyBy: (collection, iteratee) => {
    const fn = baseIteratee(iteratee);
    const out = {};
    for (const [key, value] of entriesOf(collection)) out[toStringValue(fn(value, key, collection))] = value;
    return out;
  },
  keys: (object) => object === null || typeof object !== "object" ? [] : Object.keys(object),
  values: (object) => object === null || typeof object !== "object" ? [] : Object.keys(object).map((k) => object[k]),
  escape: escapeHtml,
  random: (min, max, floating) => {
    let lower = min;
    let upper = max;
    let isFloat = floating;
    if (lower === void 0 && upper === void 0) {
      return isFloat ? Math.random() : Math.random() < 0.5 ? 0 : 1;
    }
    if (upper === void 0) {
      upper = lower;
      lower = 0;
    }
    const lo = lower === void 0 ? 0 : lower;
    const hi = upper === void 0 ? 0 : upper;
    if (isFloat === void 0) isFloat = lo % 1 !== 0 || hi % 1 !== 0;
    if (isFloat) return Math.random() * (hi - lo) + lo;
    return Math.floor(Math.random() * (Math.floor(hi) - Math.ceil(lo) + 1)) + Math.ceil(lo);
  },
  range: (start, end, step) => {
    let from = start === void 0 ? 0 : start;
    let to = end === void 0 ? start === void 0 ? 0 : start : end;
    if (end === void 0) from = 0;
    const by = step === void 0 ? to < from ? -1 : 1 : step;
    const out = [];
    if (by === 0) return out;
    if (by > 0) for (let i = from; i < to; i += by) out.push(i);
    else for (let i = from; i > to; i += by) out.push(i);
    return out;
  },
  clamp: (value, min, max) => {
    let out = value;
    if (max !== void 0 && out > max) out = max;
    if (min !== void 0 && out < min) out = min;
    return out;
  },
  kebabCase: (value) => wordsOf(value).map((w) => w.toLowerCase()).join("-"),
  camelCase: (value) => wordsOf(value).map((w, i) => {
    const lower = w.toLowerCase();
    return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(""),
  startCase: (value) => wordsOf(value).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
  capitalize: (value) => {
    const text = toStringValue(value).toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  },
  omit: (object, ...paths) => {
    const out = Object.assign({}, object);
    for (const path of collectPaths(paths)) {
      const parts = toPath(path);
      if (parts.length <= 1) {
        delete out[String(parts[0])];
        continue;
      }
      const parent = getPath(out, parts.slice(0, -1));
      if (parent && typeof parent === "object") delete parent[String(parts[parts.length - 1])];
    }
    return out;
  },
  pick: (object, ...paths) => {
    const out = {};
    for (const path of collectPaths(paths)) {
      const value = getPath(object, path, void 0);
      if (value !== void 0) setPath(out, path, value);
    }
    return out;
  },
  assign: (target, ...sources) => {
    for (const source of sources) {
      if (source === null || typeof source !== "object") continue;
      for (const key of Object.keys(source)) {
        target[key] = source[key];
      }
    }
    return target;
  },
  defaults: (target, ...sources) => {
    for (const source of sources) {
      if (source === null || typeof source !== "object") continue;
      for (const key of Object.keys(source)) {
        if (target[key] === void 0) target[key] = source[key];
      }
    }
    return target;
  },
  flatten: (collection) => {
    const out = [];
    for (const value of entriesOf(collection).map((entry) => entry[1])) {
      if (Array.isArray(value)) for (const item of value) out.push(item);
      else out.push(value);
    }
    return out;
  },
  shuffle: (collection) => {
    const out = entriesOf(collection).map((entry) => entry[1]);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  },
  sample: (collection) => {
    const list = entriesOf(collection).map((entry) => entry[1]);
    if (list.length === 0) return void 0;
    return list[Math.floor(Math.random() * list.length)];
  },
  sumBy: (collection, iteratee) => {
    const fn = baseIteratee(iteratee);
    let sum = 0;
    for (const [key, value] of entriesOf(collection)) {
      const n = Number(fn(value, key, collection));
      if (!Number.isNaN(n)) sum += n;
    }
    return sum;
  },
  times: (n, iteratee) => {
    const fn = baseIteratee(iteratee);
    const count = Math.max(0, Math.floor(n));
    const out = [];
    for (let i = 0; i < count; i++) out.push(fn(i, i, void 0));
    return out;
  },
  uniqueId: /* @__PURE__ */ (() => {
    let counter = 0;
    return (prefix) => {
      counter += 1;
      return toStringValue(prefix === void 0 ? "" : prefix) + counter;
    };
  })(),
  noop: () => {
  },
  identity: (value) => value
};
function splitTokens(input) {
  const out = [];
  let current = "";
  let quote = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);
    if (quote) {
      if (ch === quote) {
        quote = "";
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += "\0";
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        out.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}
function tokenizeTemplate(src) {
  const tokens = [];
  let i = 0;
  const pushText = (text, stripAfter, stripBefore) => {
    if (stripBefore && tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      if (prev.t === "text") prev.v = prev.v.replace(/[ \t\r\n]+$/, "");
    }
    let value = text;
    if (stripAfter) value = value.replace(/^[ \t\r\n]+/, "");
    if (value) tokens.push({ t: "text", v: value });
  };
  let pendingStripAfter = false;
  while (i < src.length) {
    const open = src.indexOf("{{", i);
    if (open < 0) {
      pushText(src.slice(i), pendingStripAfter);
      break;
    }
    if (open > i) pushText(src.slice(i, open), pendingStripAfter);
    pendingStripAfter = false;
    const triple = src.charAt(open + 2) === "{";
    const closeSeq = triple ? "}}}" : "}}";
    const close = src.indexOf(closeSeq, open + (triple ? 3 : 2));
    if (close < 0) {
      pushText(src.slice(open));
      break;
    }
    let inner = src.slice(open + (triple ? 3 : 2), close).trim();
    i = close + closeSeq.length;
    let stripBefore = false;
    let stripAfter = false;
    if (inner.charAt(0) === "~") {
      stripBefore = true;
      inner = inner.slice(1).trim();
    }
    if (inner.charAt(inner.length - 1) === "~") {
      stripAfter = true;
      inner = inner.slice(0, -1).trim();
    }
    if (stripBefore && tokens.length > 0) {
      const prev = tokens[tokens.length - 1];
      if (prev.t === "text") prev.v = prev.v.replace(/[ \t\r\n]+$/, "");
    }
    pendingStripAfter = stripAfter;
    if (!inner) continue;
    if (inner.charAt(0) === "!") continue;
    if (triple) {
      tokens.push({ t: "raw", v: inner });
      continue;
    }
    if (inner.charAt(0) === "#") {
      tokens.push({ t: "open", v: inner.slice(1).trim() });
      continue;
    }
    if (inner.charAt(0) === "^") {
      tokens.push({ t: "inv", v: inner.slice(1).trim() });
      continue;
    }
    if (inner.charAt(0) === "/") {
      tokens.push({ t: "close", v: inner.slice(1).trim() });
      continue;
    }
    if (inner === "else" || inner.indexOf("else ") === 0) {
      const rest = inner === "else" ? "" : inner.slice(5).trim();
      const elseIf = rest.indexOf("if ") === 0 ? rest.slice(3).trim() : rest;
      tokens.push({ t: "else", v: inner, elseIf: elseIf || void 0 });
      continue;
    }
    if (inner.charAt(0) === "&") {
      tokens.push({ t: "raw", v: inner.slice(1).trim() });
      continue;
    }
    tokens.push({ t: "var", v: inner });
  }
  return tokens;
}
function parseTemplate(src) {
  const tokens = tokenizeTemplate(src);
  const root = [];
  const frames = [{ node: null, list: root, chained: false }];
  for (const tok of tokens) {
    const frame = frames[frames.length - 1];
    if (tok.t === "text") {
      frame.list.push({ kind: "text", text: tok.v });
      continue;
    }
    if (tok.t === "var" || tok.t === "raw") {
      let expr = tok.v;
      let raw = tok.t === "raw";
      if (expr.charAt(0) === "&") {
        raw = true;
        expr = expr.slice(1).trim();
      }
      frame.list.push({ kind: "var", expr, raw });
      continue;
    }
    if (tok.t === "open" || tok.t === "inv") {
      const parts = splitTokens(tok.v);
      const node = { kind: "block", name: parts[0] || "if", expr: parts.slice(1).join(" "), children: [], inverse: [] };
      frame.list.push(node);
      frames.push({ node, list: node.children, chained: false });
      continue;
    }
    if (tok.t === "else") {
      if (!frame.node) continue;
      if (tok.elseIf) {
        const node = { kind: "block", name: "if", expr: tok.elseIf, children: [], inverse: [] };
        frame.node.inverse = [node];
        frames.push({ node, list: node.children, chained: true });
      } else {
        frames.push({ node: frame.node, list: frame.node.inverse, chained: true });
      }
      continue;
    }
    if (tok.t === "close") {
      while (frames.length > 1 && frames[frames.length - 1].chained) frames.pop();
      if (frames.length > 1) frames.pop();
    }
  }
  return root;
}
function stringifyValue(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "object") {
    if (typeof value.toHTML === "function") {
      try {
        return String(value.toHTML());
      } catch {
        return "";
      }
    }
    if (Array.isArray(value)) return value.map((item) => stringifyValue(item)).join(",");
    return String(value);
  }
  return String(value);
}
function isSafeString(value) {
  return !!value && typeof value === "object" && typeof value.toHTML === "function";
}
function hbIsFalsy(value) {
  if (value === false || value === null || value === void 0) return true;
  if (value === 0 || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number" && Number.isNaN(value)) return true;
  return false;
}
function parseRef(expr) {
  let rest = expr.trim();
  let depth = 0;
  while (rest.indexOf("../") === 0) {
    depth += 1;
    rest = rest.slice(3);
  }
  rest = rest.replace(/^\.\//, "");
  if (rest === "." || rest === "this") return { depth, parts: [], special: "this" };
  if (rest.charAt(0) === "@") return { depth, parts: toPath(rest.slice(1)), special: "at" };
  if (rest === "true") return { depth, parts: [], special: "true" };
  if (rest === "false") return { depth, parts: [], special: "false" };
  if (/^-?\d+(\.\d+)?$/.test(rest)) return { depth, parts: [], special: "num:" + rest };
  return { depth, parts: toPath(rest), special: "" };
}
function resolveRef(expr, stack) {
  const ref = parseRef(expr);
  if (ref.special === "true") return true;
  if (ref.special === "false") return false;
  if (ref.special.indexOf("num:") === 0) return Number(ref.special.slice(4));
  const current = stack[stack.length - 1];
  if (ref.special === "at") {
    const key = ref.parts.length > 0 ? String(ref.parts[0]) : "";
    if (key === "root") return stack[0].data;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (Object.prototype.hasOwnProperty.call(stack[i].locals, key)) return stack[i].locals[key];
    }
    return void 0;
  }
  let index = stack.length - 1 - ref.depth;
  if (index < 0) index = 0;
  if (ref.parts.length === 0) return stack[index].data;
  for (let i = index; i >= 0; i--) {
    const data = stack[i].data;
    if (data === null || data === void 0) continue;
    const head = ref.parts[0];
    const container = Object(data);
    if (!(head in container)) continue;
    let value = container[head];
    for (let p = 1; p < ref.parts.length; p++) {
      if (value === null || value === void 0) return void 0;
      value = value[ref.parts[p]];
    }
    return value;
  }
  void current;
  return void 0;
}
function renderNodes(nodes, stack, helpers) {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "text") {
      out += node.text || "";
      continue;
    }
    if (node.kind === "var") {
      const expr = (node.expr || "").trim();
      const words = splitTokens(expr);
      const helperName = words[0];
      const useHelper = !!helpers[helperName] && expr.charAt(0) !== "." && expr.charAt(0) !== "@" && expr.indexOf("this.") !== 0;
      if (useHelper) {
        const args = words.slice(1).map((w) => resolveRef(w, stack));
        const produced = helpers[helperName].apply(stack[stack.length - 1].data, args);
        out += node.raw || isSafeString(produced) ? stringifyValue(produced) : escapeHtml(produced);
        continue;
      }
      const value = resolveRef(expr, stack);
      out += node.raw || isSafeString(value) ? stringifyValue(value) : escapeHtml(value);
      continue;
    }
    const name = node.name || "";
    const argExpr = (node.expr || "").trim();
    if (name === "if" || name === "unless") {
      let value = resolveRef(argExpr, stack);
      if (typeof value === "function") {
        try {
          value = value.call(stack[stack.length - 1].data);
        } catch {
          value = void 0;
        }
      }
      let truthy = !hbIsFalsy(value);
      if (name === "unless") truthy = !truthy;
      out += renderNodes(truthy ? node.children || [] : node.inverse || [], stack, helpers);
      continue;
    }
    if (name === "with") {
      const value = resolveRef(argExpr, stack);
      if (hbIsFalsy(value)) {
        out += renderNodes(node.inverse || [], stack, helpers);
        continue;
      }
      stack.push({ data: value, locals: {} });
      out += renderNodes(node.children || [], stack, helpers);
      stack.pop();
      continue;
    }
    if (name === "each") {
      const value = resolveRef(argExpr, stack);
      const pairs = entriesOf(value);
      if (pairs.length === 0) {
        out += renderNodes(node.inverse || [], stack, helpers);
        continue;
      }
      const isArrayLike = Array.isArray(value);
      for (let i = 0; i < pairs.length; i++) {
        const key = pairs[i][0];
        const item = pairs[i][1];
        stack.push({
          data: item,
          locals: {
            index: isArrayLike ? i : key,
            key,
            first: i === 0,
            last: i === pairs.length - 1
          }
        });
        out += renderNodes(node.children || [], stack, helpers);
        stack.pop();
      }
      continue;
    }
    if (helpers[name]) {
      const options = {
        fn: (ctx) => {
          stack.push({ data: ctx, locals: {} });
          const text = renderNodes(node.children || [], stack, helpers);
          stack.pop();
          return text;
        },
        inverse: (ctx) => {
          stack.push({ data: ctx, locals: {} });
          const text = renderNodes(node.inverse || [], stack, helpers);
          stack.pop();
          return text;
        },
        hash: {},
        data: stack[stack.length - 1].locals
      };
      try {
        out += stringifyValue(helpers[name].call(stack[stack.length - 1].data, resolveRef(argExpr, stack), options));
      } catch (e) {
        try {
          console.error("[portable-tavern/st] Handlebars \u5757\u52A9\u624B\u5F02\u5E38: " + name, e);
        } catch {
        }
      }
      continue;
    }
    const fallback = resolveRef(argExpr, stack);
    out += renderNodes(hbIsFalsy(fallback) ? node.inverse || [] : node.children || [], stack, helpers);
  }
  return out;
}
function createHandlebars() {
  const helpers = {};
  const templates = {};
  class StSafeString {
    value;
    constructor(value) {
      this.value = toStringValue(value);
    }
    toString() {
      return this.value;
    }
    toHTML() {
      return this.value;
    }
  }
  const compile = (template) => {
    let ast = [];
    try {
      ast = parseTemplate(typeof template === "string" ? template : "");
    } catch (e) {
      try {
        console.error("[portable-tavern/st] Handlebars \u6A21\u677F\u89E3\u6790\u5931\u8D25", e);
      } catch {
      }
    }
    return (data) => {
      try {
        const stack = [{ data: data === void 0 ? {} : data, locals: {} }];
        return renderNodes(ast, stack, helpers);
      } catch (e) {
        try {
          console.error("[portable-tavern/st] Handlebars \u6E32\u67D3\u5931\u8D25", e);
        } catch {
        }
        return "";
      }
    };
  };
  return {
    compile,
    registerHelper: (name, fn) => {
      helpers[name] = fn;
    },
    unregisterHelper: (name) => {
      delete helpers[name];
    },
    registerPartial: (name, template) => {
      templates[name] = compile(template);
    },
    escapeExpression: escapeHtml,
    SafeString: StSafeString,
    helpers,
    templates
  };
}
function searchableText(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (typeof value === "object") {
    const out = [];
    for (const key of Object.keys(value)) out.push(searchableText(value[key]));
    return out.join(" ");
  }
  return String(value);
}
function scoreField(text, query) {
  if (!query) return 0;
  if (text === query) return 0;
  const at = text.indexOf(query);
  if (at >= 0) return 0.05 + Math.min(0.35, at / Math.max(1, text.length) * 0.35);
  let i = 0;
  let gaps = 0;
  let lastHit = -1;
  for (let p = 0; p < text.length && i < query.length; p++) {
    if (text.charAt(p) === query.charAt(i)) {
      if (lastHit >= 0) gaps += p - lastHit - 1;
      lastHit = p;
      i += 1;
    }
  }
  if (i < query.length) return 1;
  return Math.min(0.95, 0.4 + gaps / Math.max(1, text.length));
}
function createFuseClass() {
  return class Fuse {
    _list;
    _options;
    constructor(list, options) {
      this._list = Array.isArray(list) ? list.slice() : [];
      this._options = options || {};
    }
    setCollection(list) {
      this._list = Array.isArray(list) ? list.slice() : [];
    }
    add(item) {
      this._list.push(item);
    }
    getCollection() {
      return this._list.slice();
    }
    search(pattern, options) {
      const query = typeof pattern === "string" ? pattern : String(pattern === null || pattern === void 0 ? "" : pattern);
      const caseSensitive = this._options.isCaseSensitive === true;
      const needle = caseSensitive ? query : query.toLowerCase();
      const threshold = typeof this._options.threshold === "number" ? this._options.threshold : 0.6;
      const results = [];
      for (let i = 0; i < this._list.length; i++) {
        const item = this._list[i];
        let best = 1;
        if (!needle) {
          best = 0;
        } else if (this._options.keys && this._options.keys.length > 0) {
          for (const key of this._options.keys) {
            const path = typeof key === "string" ? key : key.name;
            const value = searchableText(getPath(item, path));
            const hay = caseSensitive ? value : value.toLowerCase();
            const score = scoreField(hay, needle);
            if (score < best) best = score;
          }
        } else {
          const value = searchableText(item);
          best = scoreField(caseSensitive ? value : value.toLowerCase(), needle);
        }
        if (best <= threshold) results.push({ item, refIndex: i, score: best });
      }
      if (this._options.shouldSort !== false) results.sort((a, b) => a.score - b.score);
      const limit = options && typeof options.limit === "number" ? options.limit : 0;
      return limit > 0 ? results.slice(0, limit) : results;
    }
  };
}
function pickVersion(ua, re) {
  const m = re.exec(ua);
  return m && m[1] ? m[1] : "";
}
function parseUserAgent(ua) {
  const text = typeof ua === "string" ? ua : "";
  let browserName = "Unknown";
  let browserVersion = "";
  if (/Edg\//.test(text)) {
    browserName = "Edge";
    browserVersion = pickVersion(text, /Edg\/([\d.]+)/);
  } else if (/OPR\/|Opera/.test(text)) {
    browserName = "Opera";
    browserVersion = pickVersion(text, /(?:OPR|Opera)[\/ ]([\d.]+)/);
  } else if (/Firefox\//.test(text)) {
    browserName = "Firefox";
    browserVersion = pickVersion(text, /Firefox\/([\d.]+)/);
  } else if (/Chrome\//.test(text)) {
    browserName = "Chrome";
    browserVersion = pickVersion(text, /Chrome\/([\d.]+)/);
  } else if (/Safari\//.test(text) && /Version\//.test(text)) {
    browserName = "Safari";
    browserVersion = pickVersion(text, /Version\/([\d.]+)/);
  } else if (/MSIE|Trident/.test(text)) {
    browserName = "Internet Explorer";
    browserVersion = pickVersion(text, /(?:MSIE |rv:)([\d.]+)/);
  }
  let osName = "Unknown";
  let osVersion = "";
  if (/Windows NT/.test(text)) {
    osName = "Windows";
    const nt = pickVersion(text, /Windows NT ([\d.]+)/);
    osVersion = nt === "10.0" ? "10" : nt;
  } else if (/Android/.test(text)) {
    osName = "Android";
    osVersion = pickVersion(text, /Android ([\d.]+)/);
  } else if (/iPhone|iPad|iPod/.test(text)) {
    osName = "iOS";
    osVersion = pickVersion(text, /OS ([\d_]+)/).split("_").join(".");
  } else if (/Mac OS X/.test(text)) {
    osName = "macOS";
    osVersion = pickVersion(text, /Mac OS X ([\d_.]+)/).split("_").join(".");
  } else if (/CrOS/.test(text)) {
    osName = "Chrome OS";
  } else if (/Linux/.test(text)) {
    osName = "Linux";
  }
  const isTablet = /iPad|Tablet|PlayBook|Silk/.test(text) || /Android/.test(text) && !/Mobile/.test(text);
  const isMobile = !isTablet && /Mobile|iPhone|iPod|Android|Windows Phone|IEMobile/.test(text);
  const isBot = /bot|crawler|spider|crawling/i.test(text);
  const platformType = isBot ? "bot" : isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  let engine = "Unknown";
  if (/Gecko\//.test(text) && /Firefox/.test(text)) engine = "Gecko";
  else if (/AppleWebKit/.test(text)) engine = /Chrome|Edg|OPR/.test(text) ? "Blink" : "WebKit";
  else if (/Trident/.test(text)) engine = "Trident";
  return {
    browser: { name: browserName, version: browserVersion },
    os: { name: osName, version: osVersion },
    platform: { type: platformType, vendor: "", model: "" },
    engine: { name: engine, version: "" }
  };
}
function createBowser(userAgent) {
  const initial3 = typeof userAgent === "string" ? userAgent : "";
  const parserOf = (ua) => {
    const info2 = parseUserAgent(typeof ua === "string" ? ua : initial3);
    return {
      getBrowser: () => info2.browser,
      getBrowserName: () => info2.browser.name,
      getBrowserVersion: () => info2.browser.version,
      getOS: () => info2.os,
      getOSName: () => info2.os.name,
      getOSVersion: () => info2.os.version,
      getPlatform: () => info2.platform,
      getPlatformType: () => info2.platform.type,
      getEngine: () => info2.engine,
      getEngineName: () => info2.engine.name,
      parse: () => info2,
      satisfies: (check) => satisfiesUa(info2, check),
      is: (check) => {
        const parts = String(check).split(" ").filter(Boolean);
        const name = parts[0] || "";
        return info2.browser.name.toLowerCase() === name.toLowerCase() || info2.os.name.toLowerCase() === name.toLowerCase();
      }
    };
  };
  const info = parseUserAgent(initial3);
  return {
    parse: (ua) => parseUserAgent(typeof ua === "string" ? ua : initial3),
    getParser: parserOf,
    mobile: info.platform.type === "mobile",
    tablet: info.platform.type === "tablet",
    desktop: info.platform.type === "desktop",
    bot: info.platform.type === "bot",
    browser: info.browser,
    os: info.os,
    platform: info.platform,
    satisfies: (check) => satisfiesUa(info, check)
  };
}
function satisfiesUa(info, check) {
  if (!check || typeof check !== "object") return true;
  const platform = check.platform;
  if (platform && platform.type && platform.type !== info.platform.type) return false;
  const browser = check.browser;
  if (browser && browser.name && browser.name.toLowerCase() !== info.browser.name.toLowerCase()) return false;
  const os = check.os;
  if (os && os.name && os.name.toLowerCase() !== info.os.name.toLowerCase()) return false;
  return true;
}
function createHljs() {
  const languages = { plaintext: { name: "Plain text", aliases: ["text", "txt"] } };
  const result = (code, language) => ({ value: escapeHtml(code), language, relevance: 0, stubbed: true });
  return {
    highlight: (code, options) => result(code, options && options.language || "plaintext"),
    highlightAuto: (code) => result(code, "plaintext"),
    highlightElement: (element) => {
      try {
        if (element && typeof element === "object") element.innerHTML = escapeHtml(element.innerHTML);
      } catch (e) {
        try {
          console.error("[portable-tavern/st] hljs.highlightElement \u5931\u8D25", e);
        } catch {
        }
      }
    },
    getLanguage: (name) => languages[name],
    listLanguages: () => Object.keys(languages),
    registerLanguage: (name, definition) => {
      languages[name] = { name, aliases: definition && typeof definition === "object" ? definition.aliases : void 0 };
    },
    unregisterLanguage: (name) => {
      delete languages[name];
    },
    configure: () => {
    },
    versionString: "11.9.0-portable-tavern-stub"
  };
}
function createLocalforage(storage) {
  const safe = (fn) => {
    try {
      fn();
    } catch (e) {
      console.error("[portable-tavern/st] localforage \u5199\u5931\u8D25", e);
    }
  };
  const keysOf = () => {
    const out = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (typeof k === "string") out.push(k);
      }
    } catch (e) {
      console.error("[portable-tavern/st] localforage \u679A\u4E3E\u5931\u8D25", e);
    }
    return out;
  };
  const instance = {
    INDEXEDDB: "asyncStorage",
    WEBSQL: "webSQLStorage",
    LOCALSTORAGE: "localStorageWrapper",
    ready: (callback) => {
      if (callback) callback();
      return Promise.resolve();
    },
    driver: (callback) => {
      if (callback) callback(instance.LOCALSTORAGE);
      return Promise.resolve(instance.LOCALSTORAGE);
    },
    setDriver: (_driver, callback) => {
      if (callback) callback();
      return Promise.resolve();
    },
    config: (options) => Object.assign({ driver: [instance.LOCALSTORAGE], name: "portable-tavern", storeName: "tavern_st" }, options || {}),
    getItem: (key, callback) => {
      let value = null;
      try {
        const raw = storage.getItem(key);
        value = raw === null || raw === void 0 ? null : JSON.parse(raw);
      } catch (e) {
        console.error("[portable-tavern/st] localforage.getItem \u89E3\u6790\u5931\u8D25: " + key, e);
      }
      if (callback) callback(null, value);
      return Promise.resolve(value);
    },
    setItem: (key, value, callback) => {
      safe(() => storage.setItem(key, JSON.stringify(value === void 0 ? null : value)));
      if (callback) callback(null, value);
      return Promise.resolve(value);
    },
    removeItem: (key, callback) => {
      safe(() => storage.removeItem(key));
      if (callback) callback(null);
      return Promise.resolve();
    },
    clear: (callback) => {
      safe(() => storage.clear());
      if (callback) callback(null);
      return Promise.resolve();
    },
    length: (callback) => {
      let n = 0;
      try {
        n = storage.length;
      } catch {
        n = 0;
      }
      if (callback) callback(null, n);
      return Promise.resolve(n);
    },
    key: (index, callback) => {
      let value = null;
      try {
        value = storage.key(index);
      } catch {
        value = null;
      }
      if (callback) callback(null, value);
      return Promise.resolve(value);
    },
    keys: (callback) => {
      const list = keysOf();
      if (callback) callback(null, list);
      return Promise.resolve(list);
    },
    iterate: (iterator, callback) => {
      let result;
      const list = keysOf();
      for (let i = 0; i < list.length; i++) {
        let value = null;
        try {
          const raw = storage.getItem(list[i]);
          value = raw === null ? null : JSON.parse(raw);
        } catch {
          value = null;
        }
        result = iterator(value, list[i], i + 1);
      }
      if (callback) callback(null, result);
      return Promise.resolve(result);
    },
    createInstance: () => instance,
    dropInstance: () => {
      safe(() => storage.clear());
      return Promise.resolve();
    },
    supports: () => true
  };
  return instance;
}
var DEFAULT_FORBID_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta", "base", "template", "noscript", "frame", "frameset", "applet"];
function sanitizeHtmlFallback(html, options) {
  let text = toStringValue(html);
  if (!text) return "";
  const opts = options || {};
  const keepContent = opts.KEEP_CONTENT !== false;
  const allowDataAttr = opts.ALLOW_DATA_ATTR !== false;
  const forbidTags = DEFAULT_FORBID_TAGS.concat(opts.FORBID_TAGS || []).map((t) => t.toLowerCase());
  const allowedTags = opts.ALLOWED_TAGS ? opts.ALLOWED_TAGS.map((t) => t.toLowerCase()) : null;
  const allowedAttrs = opts.ALLOWED_ATTR ? opts.ALLOWED_ATTR.map((a) => a.toLowerCase()) : null;
  const forbidAttrs = (opts.FORBID_ATTR || []).map((a) => a.toLowerCase());
  text = text.split(/<!--[\s\S]*?-->/g).join("");
  text = text.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (match, rawName, rawAttrs) => {
    const name = String(rawName).toLowerCase();
    const closing = match.charAt(1) === "/";
    const blocked = forbidTags.indexOf(name) >= 0 || allowedTags !== null && allowedTags.indexOf(name) < 0;
    if (blocked) return keepContent ? "" : "";
    if (closing) return "</" + name + ">";
    const attrs = String(rawAttrs || "");
    let cleaned = "";
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g;
    let m;
    while ((m = attrRe.exec(attrs)) !== null) {
      const attrName = m[1].toLowerCase();
      const attrValue = m[2];
      if (attrName.indexOf("on") === 0) continue;
      if (forbidAttrs.indexOf(attrName) >= 0) continue;
      if (attrName.indexOf("data-") === 0 && !allowDataAttr) continue;
      if (allowedAttrs !== null && allowedAttrs.indexOf(attrName) < 0 && attrName.indexOf("data-") !== 0 && attrName !== "class") continue;
      const bare = attrValue.replace(/^["']|["']$/g, "").replace(/\s+/g, "").toLowerCase();
      if ((attrName === "href" || attrName === "src" || attrName === "xlink:href" || attrName === "action") && bare.indexOf("javascript:") === 0) continue;
      if ((attrName === "src" || attrName === "href") && bare.indexOf("data:") === 0 && bare.indexOf("data:image/") !== 0) continue;
      cleaned += " " + attrName + "=" + attrValue;
    }
    const selfClosing = /\/>$/.test(attrs.trim()) ? " /" : "";
    return "<" + name + cleaned + selfClosing + ">";
  });
  return text;
}

// src/client/st/libs.ts
function createMemoryStorage() {
  const map = /* @__PURE__ */ new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    key: (index) => {
      const list = Array.from(map.keys());
      return index >= 0 && index < list.length ? list[index] : null;
    },
    get length() {
      return map.size;
    },
    clear: () => {
      map.clear();
    }
  };
}
function resolveStorage(win) {
  try {
    const storage = (win || (typeof window !== "undefined" ? window : void 0))?.localStorage;
    if (storage) {
      const probe = "__tavern_st_probe__";
      storage.setItem(probe, "1");
      storage.removeItem(probe);
      return storage;
    }
  } catch {
  }
  return createMemoryStorage();
}
var FORBID_CONTENT_TAGS = ["script", "style", "template", "noscript"];
var FORBID_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta", "base", "template", "noscript", "frame", "frameset", "applet"];
function isDangerousUrl(name, value) {
  if (name !== "href" && name !== "src" && name !== "xlink:href" && name !== "action" && name !== "formaction" && name !== "srcset") return false;
  const bare = String(value).replace(/\s+/g, "").toLowerCase();
  if (bare.indexOf("javascript:") >= 0) return true;
  if (bare.indexOf("vbscript:") >= 0) return true;
  if (bare.indexOf("data:") >= 0 && bare.indexOf("data:image/") < 0) return true;
  return false;
}
function cleanAttributes(el, options) {
  const allowedAttrs = options.ALLOWED_ATTR ? options.ALLOWED_ATTR.map((a) => a.toLowerCase()) : null;
  const forbidAttrs = (options.FORBID_ATTR || []).map((a) => a.toLowerCase());
  const allowDataAttr = options.ALLOW_DATA_ATTR !== false;
  const names = [];
  for (let i = 0; i < el.attributes.length; i++) names.push(el.attributes[i].name);
  for (const name of names) {
    const lower = name.toLowerCase();
    const value = el.getAttribute(name) || "";
    let keep = true;
    if (lower.indexOf("on") === 0 && lower.length > 2) keep = false;
    else if (forbidAttrs.indexOf(lower) >= 0) keep = false;
    else if (lower.indexOf("data-") === 0 && !allowDataAttr) keep = false;
    else if (allowedAttrs !== null && allowedAttrs.indexOf(lower) < 0 && lower.indexOf("data-") !== 0) keep = false;
    else if (isDangerousUrl(lower, value)) keep = false;
    else if (lower === "style" && /expression\(|javascript:/i.test(value)) keep = false;
    if (!keep) el.removeAttribute(name);
  }
}
function sanitizeWithDom(doc, html, options) {
  const host = doc.createElement("div");
  host.innerHTML = toStringValue(html);
  const allowedTags = options.ALLOWED_TAGS ? options.ALLOWED_TAGS.map((t) => t.toLowerCase()) : null;
  const forbidTags = FORBID_TAGS.concat(options.FORBID_TAGS || []).map((t) => t.toLowerCase());
  const keepContent = options.KEEP_CONTENT !== false;
  const walk = (parent) => {
    const children = [];
    for (let i = 0; i < parent.children.length; i++) children.push(parent.children[i]);
    for (const el of children) {
      const tag = el.tagName.toLowerCase();
      const blocked = forbidTags.indexOf(tag) >= 0 || allowedTags !== null && allowedTags.indexOf(tag) < 0;
      if (blocked) {
        if (FORBID_CONTENT_TAGS.indexOf(tag) >= 0 || !keepContent) {
          el.remove();
        } else {
          const grand = [];
          for (let i = 0; i < el.children.length; i++) grand.push(el.children[i]);
          for (const child of grand) parent.insertBefore(child, el);
          el.remove();
        }
        continue;
      }
      cleanAttributes(el, options);
      walk(el);
    }
  };
  walk(host);
  return host.innerHTML;
}
function createDOMPurify(win) {
  const hooks = {};
  let defaultOptions = {};
  const sanitize = (html, options) => {
    const merged = Object.assign({}, defaultOptions, options || {});
    const source = toStringValue(html);
    if (!source) return "";
    try {
      const doc = win && win.document ? win.document : typeof document !== "undefined" ? document : void 0;
      if (doc && typeof doc.createElement === "function") {
        const host = doc.createElement("div");
        const out = sanitizeWithDom(doc, source, merged);
        host.innerHTML = out;
        const list = hooks.afterSanitizeAttributes || [];
        if (list.length > 0) {
          const all = [];
          const collect = (root) => {
            for (let i = 0; i < root.children.length; i++) {
              all.push(root.children[i]);
              collect(root.children[i]);
            }
          };
          collect(host);
          for (const el of all) {
            for (const hook of list) {
              try {
                hook(el);
              } catch (e) {
                console.error("[portable-tavern/st] DOMPurify \u94A9\u5B50\u5F02\u5E38", e);
              }
            }
            cleanAttributes(el, merged);
          }
        }
        return host.innerHTML;
      }
    } catch (e) {
      console.error("[portable-tavern/st] DOMPurify(DOM) \u5931\u8D25\uFF0C\u964D\u7EA7\u4E3A\u6B63\u5219\u7248", e);
    }
    return sanitizeHtmlFallback(source, merged);
  };
  return {
    sanitize,
    addHook: (name, hook) => {
      if (typeof hook !== "function") return;
      const list = hooks[name] || (hooks[name] = []);
      list.push(hook);
    },
    removeHook: (name, hook) => {
      hooks[name] = (hooks[name] || []).filter((h) => h !== hook);
    },
    removeHooks: (name) => {
      if (name) delete hooks[name];
      else for (const key of Object.keys(hooks)) delete hooks[key];
    },
    isSupported: true,
    version: "3.1.6-portable-tavern",
    setConfig: (options) => {
      defaultOptions = Object.assign({}, options || {});
    },
    clearConfig: () => {
      defaultOptions = {};
    }
  };
}
function composeLodash(win) {
  const merged = Object.assign({}, lodashSubset);
  try {
    const target = win || (typeof window !== "undefined" ? window : void 0);
    const external = target;
    const candidate = external && (external._ || external.lodash);
    if (candidate && typeof candidate === "object") {
      for (const key of Object.keys(lodashSubset)) {
        if (typeof candidate[key] === "function") merged[key] = candidate[key];
      }
    }
  } catch (e) {
    console.error("[portable-tavern/st] \u590D\u7528\u9875\u9762 lodash \u5931\u8D25\uFF0C\u4F7F\u7528\u81EA\u5E26\u5B50\u96C6", e);
  }
  return merged;
}
function createCssLib() {
  return {
    escape: (value) => toStringValue(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => "\\" + ch),
    parse: () => ({ type: "stylesheet", stylesheet: { rules: [] } }),
    stringify: () => "",
    compress: (input) => toStringValue(input)
  };
}
function createStLibs(win) {
  const target = win || (typeof window !== "undefined" ? window : void 0);
  const userAgent = target && target.navigator ? String(target.navigator.userAgent || "") : "";
  return {
    lodash: composeLodash(target),
    Fuse: createFuseClass(),
    DOMPurify: createDOMPurify(target),
    hljs: createHljs(),
    localforage: createLocalforage(resolveStorage(target)),
    Handlebars: createHandlebars(),
    css: createCssLib(),
    Bowser: createBowser(userAgent)
  };
}

// src/client/st/jquery.ts
var NATIVE_PSEUDOS = [
  "not",
  "is",
  "where",
  "has",
  "nth-child",
  "nth-of-type",
  "nth-last-child",
  "nth-last-of-type",
  "first-child",
  "last-child",
  "first-of-type",
  "last-of-type",
  "only-child",
  "only-of-type",
  "checked",
  "disabled",
  "enabled",
  "required",
  "optional",
  "focus",
  "focus-visible",
  "focus-within",
  "root",
  "empty",
  "target",
  "scope",
  "placeholder-shown",
  "read-only",
  "read-write",
  "default",
  "indeterminate"
];
var JQ_PSEUDOS = ["visible", "hidden", "first", "last", "eq", "even", "odd", "contains", "selected", "input", "parent", "header", "animated", "button", "text", "submit", "password", "radio", "checkbox", "file", "image", "reset"];
function isVisible(el) {
  try {
    if (typeof el.getClientRects === "function" && el.getClientRects().length > 0) return true;
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
    }
    return el.offsetParent !== null;
  } catch {
    return true;
  }
}
function parseSelector(selector) {
  const filters = [];
  const unsupported = [];
  let base = "";
  let i = 0;
  while (i < selector.length) {
    const ch = selector.charAt(i);
    if (ch !== ":" || selector.charAt(i + 1) === ":") {
      base += ch;
      if (ch === ":" && selector.charAt(i + 1) === ":") {
        base += ":";
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    const match = /^:([a-zA-Z-]+)/.exec(selector.slice(i));
    if (!match) {
      base += ch;
      i += 1;
      continue;
    }
    const name = match[1].toLowerCase();
    let end = i + match[0].length;
    let arg = "";
    if (selector.charAt(end) === "(") {
      let depth = 0;
      let j = end;
      for (; j < selector.length; j++) {
        const c = selector.charAt(j);
        if (c === "(") depth += 1;
        else if (c === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      arg = selector.slice(end + 1, j);
      end = j + 1;
    }
    if (NATIVE_PSEUDOS.indexOf(name) >= 0) {
      base += selector.slice(i, end);
      i = end;
      continue;
    }
    if (JQ_PSEUDOS.indexOf(name) >= 0) {
      filters.push({ name, arg });
      i = end;
      continue;
    }
    unsupported.push(name);
    i = end;
  }
  return { base: base.trim() === "" ? "*" : base.trim(), filters, unsupported };
}
function applyFilters(elements, parsed) {
  let out = elements;
  for (const filter of parsed.filters) {
    const name = filter.name;
    const arg = filter.arg;
    if (name === "visible") out = out.filter((el) => isVisible(el));
    else if (name === "hidden") out = out.filter((el) => !isVisible(el));
    else if (name === "first") out = out.slice(0, 1);
    else if (name === "last") out = out.slice(-1);
    else if (name === "eq") {
      const n = Number(arg);
      out = Number.isNaN(n) ? [] : n < 0 ? out.slice(n) : out.slice(n, n + 1);
    } else if (name === "even") out = out.filter((_el, i) => i % 2 === 0);
    else if (name === "odd") out = out.filter((_el, i) => i % 2 === 1);
    else if (name === "contains") out = out.filter((el) => String(el.textContent || "").indexOf(arg.trim().replace(/^["']|["']$/g, "")) >= 0);
    else if (name === "has") out = out.filter((el) => {
      try {
        return el.querySelector(arg) !== null;
      } catch {
        return false;
      }
    });
    else if (name === "selected") out = out.filter((el) => el.selected === true);
    else if (name === "input") out = out.filter((el) => ["input", "select", "textarea", "button"].indexOf(el.tagName.toLowerCase()) >= 0);
    else if (["button", "text", "submit", "password", "radio", "checkbox", "file", "image", "reset"].indexOf(name) >= 0) {
      out = out.filter((el) => {
        const tag = el.tagName.toLowerCase();
        if (name === "button") return tag === "button" || tag === "input" && String(el.type) === "button";
        return tag === "input" && String(el.type) === name;
      });
    } else if (name === "parent") out = out.filter((el) => el.childNodes.length > 0);
    else if (name === "header") out = out.filter((el) => /^h[1-6]$/.test(el.tagName.toLowerCase()));
    else out = [];
  }
  return out;
}
var elementData = /* @__PURE__ */ new WeakMap();
var eventRegistry = /* @__PURE__ */ new WeakMap();
var displayStore = /* @__PURE__ */ new WeakMap();
var warnedKeys = /* @__PURE__ */ new Set();
var UNITLESS_PROPS = ["opacity", "zIndex", "z-index", "flex", "flexGrow", "flexShrink", "fontWeight", "font-weight", "lineHeight", "line-height", "order", "zoom", "columnCount", "orphans", "widows"];
function kebab(name) {
  return String(name).replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}
function parseHtmlNodes(doc, html) {
  const template = doc.createElement("template");
  template.innerHTML = html;
  const out = [];
  const content = template.content;
  for (let i = 0; i < content.childNodes.length; i++) out.push(content.childNodes[i]);
  return out;
}
function resolveContent(doc, content) {
  if (content === null || content === void 0 || content === false) return [];
  if (typeof content === "string") {
    if (doc && content.indexOf("<") >= 0) return parseHtmlNodes(doc, content);
    return doc ? [doc.createTextNode(content)] : [];
  }
  if (typeof content === "number" || typeof content === "boolean") {
    return doc ? [doc.createTextNode(String(content))] : [];
  }
  if (typeof content === "object" && content.nodeType) return [content];
  if (Array.isArray(content)) {
    const out = [];
    for (const item of content) for (const node of resolveContent(doc, item)) out.push(node);
    return out;
  }
  const list = content;
  if (typeof list.length === "number") {
    const out = [];
    for (let i = 0; i < list.length; i++) for (const node of resolveContent(doc, list[i])) out.push(node);
    return out;
  }
  return [];
}
function makeCollection(proto, elements) {
  const obj = Object.create(proto);
  for (let i = 0; i < elements.length; i++) obj[i] = elements[i];
  obj.length = elements.length;
  return obj;
}
function uniqueElements(list) {
  const out = [];
  for (const el of list) if (out.indexOf(el) < 0) out.push(el);
  return out;
}
function createPrototype(deps) {
  const { doc, win, warn } = deps;
  const proto = {};
  proto.each = function(fn) {
    for (let i = 0; i < this.length; i++) {
      if (fn.call(this[i], i, this[i]) === false) break;
    }
    return this;
  };
  proto.get = function(index) {
    if (index === void 0) {
      const out = [];
      for (let i2 = 0; i2 < this.length; i2++) out.push(this[i2]);
      return out;
    }
    const i = index < 0 ? this.length + index : index;
    return i >= 0 && i < this.length ? this[i] : void 0;
  };
  proto.index = function() {
    const el = this[0];
    if (!el || !el.parentElement) return -1;
    return Array.prototype.indexOf.call(el.parentElement.children, el);
  };
  proto.eq = function(index) {
    const i = index < 0 ? this.length + index : index;
    return makeCollection(proto, i >= 0 && i < this.length ? [this[i]] : []);
  };
  proto.first = function() {
    return makeCollection(proto, this.length > 0 ? [this[0]] : []);
  };
  proto.last = function() {
    return makeCollection(proto, this.length > 0 ? [this[this.length - 1]] : []);
  };
  proto.append = function(content) {
    for (let i = 0; i < this.length; i++) {
      for (const node of resolveContent(doc, content)) this[i].appendChild(node);
    }
    return this;
  };
  proto.prepend = function(content) {
    for (let i = 0; i < this.length; i++) {
      const first = this[i].firstChild;
      for (const node of resolveContent(doc, content)) this[i].insertBefore(node, first);
    }
    return this;
  };
  proto.after = function(content) {
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      const parent = el.parentNode;
      if (!parent) continue;
      const next = el.nextSibling;
      for (const node of resolveContent(doc, content)) parent.insertBefore(node, next);
    }
    return this;
  };
  proto.before = function(content) {
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      const parent = el.parentNode;
      if (!parent) continue;
      for (const node of resolveContent(doc, content)) parent.insertBefore(node, el);
    }
    return this;
  };
  proto.appendTo = function(target) {
    const targets = toElements(target, doc, warn);
    for (const node of targets) {
      for (let i = 0; i < this.length; i++) node.appendChild(this[i]);
    }
    return this;
  };
  proto.remove = function(selector) {
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      if (selector) {
        let matched = false;
        try {
          matched = el.matches(selector);
        } catch {
          matched = false;
        }
        if (!matched) continue;
      }
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    return this;
  };
  proto.empty = function() {
    for (let i = 0; i < this.length; i++) this[i].innerHTML = "";
    return this;
  };
  proto.html = function(value) {
    if (value === void 0) return this.length > 0 ? this[0].innerHTML : void 0;
    for (let i = 0; i < this.length; i++) this[i].innerHTML = toStringValue(value);
    return this;
  };
  proto.text = function(value) {
    if (value === void 0) return this.length > 0 ? String(this[0].textContent || "") : void 0;
    for (let i = 0; i < this.length; i++) this[i].textContent = toStringValue(value);
    return this;
  };
  proto.val = function(value) {
    if (value === void 0) {
      const el = this[0];
      return el ? el.value : void 0;
    }
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      if (typeof value === "boolean" && "checked" in el) {
        el.checked = value;
        continue;
      }
      try {
        el.value = toStringValue(value);
      } catch (e) {
        console.error("[portable-tavern/st] .val() \u5199\u5165\u5931\u8D25", e);
      }
    }
    return this;
  };
  proto.attr = function(name, value) {
    if (name && typeof name === "object") {
      for (const key2 of Object.keys(name)) {
        for (let i = 0; i < this.length; i++) this[i].setAttribute(key2, toStringValue(name[key2]));
      }
      return this;
    }
    const key = toStringValue(name);
    if (value === void 0) return this.length > 0 ? this[0].getAttribute(key) : void 0;
    for (let i = 0; i < this.length; i++) {
      if (value === null) this[i].removeAttribute(key);
      else this[i].setAttribute(key, toStringValue(value));
    }
    return this;
  };
  proto.removeAttr = function(name) {
    const names = String(name).split(/\s+/).filter(Boolean);
    for (let i = 0; i < this.length; i++) for (const key of names) this[i].removeAttribute(key);
    return this;
  };
  proto.addClass = function(names) {
    const list = String(names).split(/\s+/).filter(Boolean);
    for (let i = 0; i < this.length; i++) for (const name of list) this[i].classList.add(name);
    return this;
  };
  proto.removeClass = function(names) {
    for (let i = 0; i < this.length; i++) {
      if (names === void 0 || names === "") {
        this[i].className = "";
        continue;
      }
      const list = String(names).split(/\s+/).filter(Boolean);
      for (const name of list) this[i].classList.remove(name);
    }
    return this;
  };
  proto.toggleClass = function(names, state) {
    const list = String(names).split(/\s+/).filter(Boolean);
    for (let i = 0; i < this.length; i++) {
      for (const name of list) {
        if (state === void 0) this[i].classList.toggle(name);
        else if (state) this[i].classList.add(name);
        else this[i].classList.remove(name);
      }
    }
    return this;
  };
  proto.hasClass = function(name) {
    return this.length > 0 ? this[0].classList.contains(name) : false;
  };
  proto.css = function(name, value) {
    if (name && typeof name === "object") {
      for (const key of Object.keys(name)) this.css(key, name[key]);
      return this;
    }
    const prop = toStringValue(name);
    if (value === void 0) {
      const el = this[0];
      if (!el) return void 0;
      try {
        if (win && typeof win.getComputedStyle === "function") {
          const computed = win.getComputedStyle(el);
          const found = computed.getPropertyValue(kebab(prop));
          if (found) return found;
        }
      } catch {
      }
      const style = el.style;
      return style[prop] !== void 0 ? style[prop] : el.style.getPropertyValue(kebab(prop));
    }
    const text = typeof value === "number" && UNITLESS_PROPS.indexOf(prop) < 0 ? String(value) + "px" : toStringValue(value);
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      try {
        el.style.setProperty(kebab(prop), text);
      } catch (e) {
        console.error("[portable-tavern/st] .css() \u5199\u5165\u5931\u8D25", e);
      }
    }
    return this;
  };
  proto.show = function() {
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      const prev = displayStore.get(el);
      el.style.display = prev !== void 0 && prev !== "none" ? prev : "";
    }
    return this;
  };
  proto.hide = function() {
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      if (el.style.display !== "none") displayStore.set(el, el.style.display);
      el.style.display = "none";
    }
    return this;
  };
  proto.toggle = function(force) {
    const shouldShow = force === void 0 ? this.length > 0 ? this[0].style.display === "none" : false : force;
    const showFn = proto.show;
    const hideFn = proto.hide;
    return shouldShow ? showFn.call(this) : hideFn.call(this);
  };
  proto.fadeIn = function(duration, callback) {
    for (let i = 0; i < this.length; i++) fadeElement(this[i], 0, 1, duration, callback);
    return this;
  };
  proto.fadeOut = function(duration, callback) {
    for (let i = 0; i < this.length; i++) fadeElement(this[i], 1, 0, duration, callback);
    return this;
  };
  proto.on = function(events, selectorOrHandler, handlerArg) {
    if (events && typeof events === "object" && !Array.isArray(events)) {
      for (const key of Object.keys(events)) this.on(key, events[key]);
      return this;
    }
    const types = String(events || "").split(/\s+/).filter(Boolean);
    let selector = "";
    let handler = selectorOrHandler;
    if (typeof selectorOrHandler === "string") {
      selector = selectorOrHandler;
      handler = handlerArg;
    }
    if (typeof handler !== "function") return this;
    for (let i = 0; i < this.length; i++) bindEvent(this[i], types, selector, handler, false, warn);
    return this;
  };
  proto.one = function(events, selectorOrHandler, handlerArg) {
    const types = String(events || "").split(/\s+/).filter(Boolean);
    let selector = "";
    let handler = selectorOrHandler;
    if (typeof selectorOrHandler === "string") {
      selector = selectorOrHandler;
      handler = handlerArg;
    }
    if (typeof handler !== "function") return this;
    for (let i = 0; i < this.length; i++) bindEvent(this[i], types, selector, handler, true, warn);
    return this;
  };
  proto.off = function(events, selectorOrHandler, handlerArg) {
    const types = events ? String(events).split(/\s+/).filter(Boolean) : [];
    let selector = null;
    let handler = selectorOrHandler;
    if (typeof selectorOrHandler === "string") {
      selector = selectorOrHandler;
      handler = handlerArg;
    }
    for (let i = 0; i < this.length; i++) unbindEvent(this[i], types, selector, typeof handler === "function" ? handler : null);
    return this;
  };
  proto.click = function(handler) {
    if (typeof handler === "function") return this.on("click", handler);
    return this.trigger("click");
  };
  proto.change = function(handler) {
    if (typeof handler === "function") return this.on("change", handler);
    return this.trigger("change");
  };
  proto.input = function(handler) {
    if (typeof handler === "function") return this.on("input", handler);
    return this.trigger("input");
  };
  proto.trigger = function(event, extra) {
    for (let i = 0; i < this.length; i++) {
      const node = this[i];
      try {
        const evt = createEvent(win, node, event, extra);
        node.dispatchEvent(evt);
      } catch (e) {
        console.error("[portable-tavern/st] .trigger() \u5931\u8D25: " + event, e);
      }
    }
    return this;
  };
  proto.triggerHandler = function(event, extra) {
    const el = this[0];
    if (!el) return void 0;
    const records = (eventRegistry.get(el) || []).filter((rec) => rec.type === event);
    let result;
    const fake = {
      type: event,
      target: el,
      currentTarget: el,
      defaultPrevented: false,
      preventDefault: () => {
      },
      stopPropagation: () => {
      },
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      __stExtra: extra === void 0 ? [] : [extra]
    };
    for (const rec of records) {
      try {
        result = rec.orig.apply(el, [fake].concat(fake.__stExtra));
      } catch (e) {
        console.error("[portable-tavern/st] triggerHandler \u5904\u7406\u5668\u5F02\u5E38: " + event, e);
      }
    }
    return result;
  };
  proto.find = function(selector) {
    const found = [];
    const parsed = parseSelector(String(selector));
    if (parsed.unsupported.length > 0) {
      warn("pseudo:" + parsed.unsupported.join(","), "jQuery \u4F2A\u7C7B :" + parsed.unsupported.join(", :") + " \u6682\u4E0D\u652F\u6301\uFF0C\u5DF2\u8FD4\u56DE\u7A7A\u96C6\u5408");
      return makeCollection(proto, []);
    }
    for (let i = 0; i < this.length; i++) {
      let list = [];
      try {
        list = Array.prototype.slice.call(this[i].querySelectorAll(parsed.base));
      } catch (e) {
        warn("selector:" + parsed.base, "\u9009\u62E9\u5668\u65E0\u6CD5\u4EA4\u7ED9\u539F\u751F\u5F15\u64CE\uFF08" + parsed.base + "\uFF09\uFF0C\u5DF2\u8FD4\u56DE\u7A7A\u96C6\u5408");
        continue;
      }
      for (const el of applyFilters(list, parsed)) found.push(el);
    }
    return makeCollection(proto, uniqueElements(found));
  };
  proto.closest = function(selector) {
    const found = [];
    for (let i = 0; i < this.length; i++) {
      try {
        const hit = this[i].closest(selector);
        if (hit) found.push(hit);
      } catch (e) {
        warn("closest:" + selector, "closest \u65E0\u6CD5\u5339\u914D\u9009\u62E9\u5668 " + selector);
      }
    }
    return makeCollection(proto, uniqueElements(found));
  };
  proto.parent = function() {
    const found = [];
    for (let i = 0; i < this.length; i++) {
      const parent = this[i].parentElement;
      if (parent) found.push(parent);
    }
    return makeCollection(proto, uniqueElements(found));
  };
  proto.children = function(selector) {
    const found = [];
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      for (let j = 0; j < el.children.length; j++) {
        const child = el.children[j];
        if (selector) {
          let matched = false;
          try {
            matched = child.matches(selector);
          } catch {
            matched = false;
          }
          if (!matched) continue;
        }
        found.push(child);
      }
    }
    return makeCollection(proto, uniqueElements(found));
  };
  proto.is = function(selector) {
    if (this.length === 0) return false;
    try {
      return this[0].matches(selector);
    } catch (e) {
      warn("is:" + selector, "is() \u65E0\u6CD5\u5339\u914D\u9009\u62E9\u5668 " + selector);
      return false;
    }
  };
  proto.data = function(key, value) {
    const el = this[0];
    if (!el) return void 0;
    const store = elementData.get(el) || {};
    if (key === void 0) {
      const out = {};
      const dataset = el.dataset || {};
      for (const k of Object.keys(dataset)) out[k] = dataset[k];
      return Object.assign(out, store);
    }
    if (value === void 0) {
      if (Object.prototype.hasOwnProperty.call(store, key)) return store[key];
      const attr = el.dataset ? el.dataset[key] : void 0;
      return attr;
    }
    store[key] = value;
    elementData.set(el, store);
    return this;
  };
  return proto;
}
function extraArgsOf(event) {
  const extra = event.__stExtra;
  return Array.isArray(extra) ? extra : [];
}
function createEvent(win, el, type, extra) {
  const payload = extra === void 0 ? [] : [extra];
  let event;
  const target = win;
  try {
    if (target && ["click", "dblclick", "mousedown", "mouseup", "mousemove", "mouseover", "mouseout", "contextmenu"].indexOf(type) >= 0) {
      event = new target.MouseEvent(type, { bubbles: true, cancelable: true, view: win });
    } else if (target && ["keydown", "keyup", "keypress"].indexOf(type) >= 0) {
      event = new target.KeyboardEvent(type, { bubbles: true, cancelable: true });
    } else if (target && typeof target.CustomEvent === "function") {
      event = new target.CustomEvent(type, { bubbles: true, cancelable: true, detail: extra });
    } else {
      event = new Event(type, { bubbles: true, cancelable: true });
    }
  } catch (e) {
    event = new Event(type, { bubbles: true, cancelable: true });
  }
  try {
    event.__stExtra = payload;
  } catch {
  }
  void el;
  return event;
}
function bindEvent(el, types, selector, handler, once, warn) {
  const list = eventRegistry.get(el) || [];
  for (const type of types) {
    const record = { type, fn: () => {
    }, orig: handler, selector, once };
    record.fn = (event) => {
      let thisArg = el;
      if (selector) {
        const targetEl = event.target;
        if (!targetEl || typeof targetEl.closest !== "function") return;
        let matched = null;
        try {
          matched = targetEl.closest(selector);
        } catch {
          matched = null;
        }
        if (!matched || !el.contains(matched)) return;
        thisArg = matched;
      }
      if (once) unbindEvent(el, [], null, handler, type);
      try {
        const result = handler.apply(thisArg, [event].concat(extraArgsOf(event)));
        if (result === false && event.cancelable) {
          event.preventDefault();
          event.stopPropagation();
        }
      } catch (e) {
        console.error("[portable-tavern/st] \u4E8B\u4EF6\u5904\u7406\u5668\u5F02\u5E38 (" + type + ")", e);
      }
    };
    list.push(record);
    try {
      el.addEventListener(type, record.fn);
    } catch (e) {
      warn("bind:" + type, "\u4E8B\u4EF6 " + type + " \u7ED1\u5B9A\u5931\u8D25\uFF1A" + String(e));
    }
  }
  eventRegistry.set(el, list);
}
function unbindEvent(el, types, selector, handler, onlyType) {
  const list = eventRegistry.get(el) || [];
  const keep = [];
  for (const record of list) {
    const typeMatch = (types.length === 0 || types.indexOf(record.type) >= 0) && (onlyType === void 0 || record.type === onlyType);
    const selectorMatch = selector === null || record.selector === selector;
    const handlerMatch = handler === null || record.orig === handler;
    if (typeMatch && selectorMatch && handlerMatch) {
      try {
        el.removeEventListener(record.type, record.fn);
      } catch {
      }
      continue;
    }
    keep.push(record);
  }
  eventRegistry.set(el, keep);
}
function fadeElement(el, from, to, duration, callback) {
  if (!el || !el.style) return;
  const ms = Math.max(0, typeof duration === "number" ? duration : 200);
  const finish = () => {
    el.style.opacity = String(to);
    if (to === 0) {
      if (el.style.display !== "none") displayStore.set(el, el.style.display);
      el.style.display = "none";
    } else {
      const prev = displayStore.get(el);
      el.style.display = prev !== void 0 && prev !== "none" ? prev : "";
    }
    if (typeof callback === "function") {
      try {
        callback();
      } catch (e) {
        console.error("[portable-tavern/st] fade \u56DE\u8C03\u5F02\u5E38", e);
      }
    }
  };
  try {
    if (ms === 0) {
      finish();
      return;
    }
    el.style.transition = "opacity " + ms + "ms linear";
    el.style.opacity = String(from);
    void el.offsetWidth;
    el.style.opacity = String(to);
    const timer = typeof window !== "undefined" ? window.setTimeout : setTimeout;
    timer(() => {
      el.style.transition = "";
      finish();
    }, ms + 30);
  } catch (e) {
    console.error("[portable-tavern/st] fade \u52A8\u753B\u5931\u8D25", e);
    finish();
  }
}
function isElementLike(value) {
  if (!value || typeof value !== "object") return false;
  const nodeType = value.nodeType;
  return nodeType === 1 || nodeType === 9 || nodeType === 11;
}
function toElements(selector, doc, warn, context) {
  if (selector === null || selector === void 0 || selector === false) return [];
  if (typeof selector === "string") {
    const text = selector.trim();
    if (!text) return [];
    if (text.charAt(0) === "<") return parseHtmlNodes(doc, text).filter(isElementLike);
    const parsed = parseSelector(text);
    if (parsed.unsupported.length > 0) {
      warn("pseudo:" + parsed.unsupported.join(","), "jQuery \u4F2A\u7C7B :" + parsed.unsupported.join(", :") + " \u6682\u4E0D\u652F\u6301\uFF0C\u5DF2\u8FD4\u56DE\u7A7A\u96C6\u5408");
      return [];
    }
    const roots = [];
    if (context !== void 0) {
      for (const el of toElements(context, doc, warn)) roots.push(el);
    } else if (doc) {
      roots.push(doc);
    }
    const out = [];
    for (const root of roots) {
      try {
        const list = Array.prototype.slice.call(root.querySelectorAll(parsed.base));
        for (const el of applyFilters(list, parsed)) out.push(el);
      } catch (e) {
        warn("selector:" + parsed.base, "\u9009\u62E9\u5668\u65E0\u6CD5\u4EA4\u7ED9\u539F\u751F\u5F15\u64CE\uFF08" + parsed.base + "\uFF09\uFF0C\u5DF2\u8FD4\u56DE\u7A7A\u96C6\u5408");
      }
    }
    return uniqueElements(out);
  }
  if (isElementLike(selector)) return [selector];
  if (typeof selector === "object" && selector !== null && selector.nodeType === void 0) {
    const list = selector;
    if (typeof list.length === "number") {
      const out = [];
      for (let i = 0; i < list.length; i++) for (const el of toElements(list[i], doc, warn)) out.push(el);
      return out;
    }
  }
  return [];
}
function serializeParam(value, prefix) {
  if (value === null || value === void 0) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return encodeURIComponent(toStringValue(prefix)) + "=" + encodeURIComponent(toStringValue(value));
  }
  if (Array.isArray(value)) {
    const parts = [];
    for (const item of value) parts.push(serializeParam(item, prefix));
    return parts.filter(Boolean).join("&");
  }
  if (typeof value === "object") {
    const parts = [];
    for (const key of Object.keys(value)) {
      const next = prefix ? prefix + "[" + key + "]" : key;
      parts.push(serializeParam(value[key], next));
    }
    return parts.filter(Boolean).join("&");
  }
  return "";
}
function createJQuery(win, onWarn) {
  const target = win || (typeof window !== "undefined" ? window : void 0);
  const doc = target && target.document ? target.document : typeof document !== "undefined" ? document : void 0;
  const warn = (key, message) => {
    if (warnedKeys.has(key)) return;
    warnedKeys.add(key);
    try {
      if (onWarn) onWarn(message);
      else console.warn("[portable-tavern/st] " + message);
    } catch {
    }
  };
  const proto = createPrototype({ doc, win: target, warn });
  proto.extend = function(obj) {
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) this[key] = obj[key];
    }
    return this;
  };
  proto.jquery = "3.7.1-portable-tavern";
  const ready = (callback) => {
    if (typeof callback !== "function") return;
    try {
      if (!doc || doc.readyState === "complete" || doc.readyState === "interactive") {
        const timer = typeof setTimeout === "function" ? setTimeout : void 0;
        if (timer) timer(callback, 0);
        else callback();
        return;
      }
      doc.addEventListener("DOMContentLoaded", () => {
        try {
          callback();
        } catch (e) {
          console.error("[portable-tavern/st] ready \u56DE\u8C03\u5F02\u5E38", e);
        }
      }, { once: true });
    } catch (e) {
      console.error("[portable-tavern/st] ready \u6CE8\u518C\u5931\u8D25", e);
    }
  };
  const extend = (...args) => {
    let deep = false;
    let i = 0;
    if (typeof args[0] === "boolean") {
      deep = args[0];
      i = 1;
    }
    const targetObj = args[i] && typeof args[i] === "object" ? args[i] : {};
    i += 1;
    for (; i < args.length; i++) {
      const source = args[i];
      if (!source || typeof source !== "object") continue;
      for (const key of Object.keys(source)) {
        const from = source[key];
        const current = targetObj[key];
        if (deep && from && typeof from === "object" && !Array.isArray(from) && current && typeof current === "object" && !Array.isArray(current)) {
          extend(true, current, from);
        } else if (from !== void 0) {
          targetObj[key] = from;
        }
      }
    }
    return targetObj;
  };
  const each = (collection, callback) => {
    if (collection === null || collection === void 0 || typeof callback !== "function") return collection;
    if (Array.isArray(collection) || typeof collection === "string") {
      const list = collection;
      for (let i = 0; i < list.length; i++) {
        if (callback(i, list[i]) === false) break;
      }
      return collection;
    }
    if (typeof collection === "object") {
      for (const key of Object.keys(collection)) {
        if (callback(key, collection[key]) === false) break;
      }
    }
    return collection;
  };
  const map = (collection, callback) => {
    const out = [];
    if (typeof callback !== "function") return out;
    each(collection, (index, value) => {
      const mapped = callback(value, index);
      if (Array.isArray(mapped)) for (const item of mapped) out.push(item);
      else if (mapped !== null && mapped !== void 0) out.push(mapped);
    });
    return out;
  };
  const grep = (list, callback, invert) => {
    const out = [];
    if (!Array.isArray(list) || typeof callback !== "function") return out;
    for (let i = 0; i < list.length; i++) {
      const hit = !!callback(list[i], i);
      if (hit !== !!invert) out.push(list[i]);
    }
    return out;
  };
  const inArray = (value, list, fromIndex) => {
    if (!Array.isArray(list)) return -1;
    return list.indexOf(value, typeof fromIndex === "number" ? fromIndex : 0);
  };
  const parseHTML = (html) => {
    if (!doc) return [];
    return parseHtmlNodes(doc, String(html)).filter(isElementLike);
  };
  const makeArray = (value) => {
    if (Array.isArray(value)) return value.slice();
    if (value === null || value === void 0) return [];
    if (typeof value === "object" && typeof value.length === "number") {
      return Array.prototype.slice.call(value);
    }
    return [value];
  };
  const makeXhr = () => {
    const doneCbs = [];
    const failCbs = [];
    const alwaysCbs = [];
    let settled = false;
    let settleResolve = () => {
    };
    let settleReject = () => {
    };
    const promise = new Promise((resolve, reject) => {
      settleResolve = resolve;
      settleReject = reject;
    });
    void promise.catch(() => {
    });
    const xhr = {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
      status: 0,
      responseText: "",
      readyState: 0,
      getResponseHeader: (_name) => null,
      abort: () => {
        abortFn();
      },
      done: (cb) => {
        doneCbs.push(cb);
        return xhr;
      },
      fail: (cb) => {
        failCbs.push(cb);
        return xhr;
      },
      always: (cb) => {
        alwaysCbs.push(cb);
        return xhr;
      }
    };
    let abortFn = () => {
    };
    const settle = (ok, data, textStatus, errorThrown) => {
      if (settled) return;
      settled = true;
      if (ok) {
        for (const cb of doneCbs) {
          try {
            cb(data, textStatus, xhr);
          } catch (e) {
            console.error("[portable-tavern/st] ajax done \u56DE\u8C03\u5F02\u5E38", e);
          }
        }
        settleResolve(data);
      } else {
        for (const cb of failCbs) {
          try {
            cb(xhr, textStatus, errorThrown);
          } catch (e) {
            console.error("[portable-tavern/st] ajax fail \u56DE\u8C03\u5F02\u5E38", e);
          }
        }
        settleReject(new Error(errorThrown || textStatus || "ajax error"));
      }
      for (const cb of alwaysCbs) {
        try {
          cb(xhr, textStatus);
        } catch (e) {
          console.error("[portable-tavern/st] ajax always \u56DE\u8C03\u5F02\u5E38", e);
        }
      }
    };
    return {
      xhr,
      done: doneCbs,
      fail: failCbs,
      always: alwaysCbs,
      settle,
      isSettled: () => settled,
      setAbort: (fn) => {
        abortFn = fn;
      }
    };
  };
  const ajax = (options) => {
    const opts = typeof options === "string" ? { url: options } : options || {};
    const box = makeXhr();
    const xhr = box.xhr;
    if (opts.success) box.done.push(opts.success);
    if (opts.error) box.fail.push(opts.error);
    if (opts.complete) box.always.push(opts.complete);
    const method = String(opts.type || opts.method || "GET").toUpperCase();
    if (method !== "GET") {
      warn("ajax:method:" + method, "$.ajax \u53EA\u652F\u6301\u540C\u6E90 GET\uFF0C\u6536\u5230 " + method + "\uFF0C\u5DF2\u6309\u5931\u8D25\u5904\u7406");
      box.settle(false, null, "error", "portable-tavern\uFF1A$.ajax \u4EC5\u652F\u6301 GET");
      return xhr;
    }
    if (!target || !target.location || typeof target.fetch !== "function" || typeof URL !== "function") {
      box.settle(false, null, "error", "portable-tavern\uFF1A\u5F53\u524D\u73AF\u5883\u6CA1\u6709 fetch/window");
      return xhr;
    }
    let url;
    try {
      url = new URL(String(opts.url || ""), target.location.href);
    } catch (e) {
      box.settle(false, null, "error", "portable-tavern\uFF1AURL \u975E\u6CD5\uFF08" + toStringValue(opts.url) + "\uFF09");
      return xhr;
    }
    if (url.origin !== target.location.origin) {
      warn("ajax:cross-origin", "$.ajax \u53EA\u652F\u6301\u540C\u6E90\u8BF7\u6C42\uFF0C\u8DE8\u57DF " + url.origin + " \u5DF2\u6309\u5931\u8D25\u5904\u7406");
      box.settle(false, null, "error", "portable-tavern\uFF1A$.ajax \u4EC5\u652F\u6301\u540C\u6E90\u8BF7\u6C42");
      return xhr;
    }
    const query = opts.data === void 0 || opts.data === null || opts.data === "" ? "" : typeof opts.data === "string" ? opts.data : serializeParam(opts.data);
    const finalUrl = query ? url.toString() + (url.search ? "&" : "?") + query : url.toString();
    if (typeof AbortController !== "function") {
      box.settle(false, null, "error", "portable-tavern\uFF1A\u5F53\u524D\u73AF\u5883\u6CA1\u6709 AbortController");
      return xhr;
    }
    const controller = new AbortController();
    box.setAbort(() => {
      try {
        controller.abort();
      } catch {
      }
    });
    let timer = null;
    if (typeof opts.timeout === "number" && opts.timeout > 0) {
      timer = target.setTimeout(() => {
        try {
          controller.abort();
        } catch {
        }
      }, opts.timeout);
    }
    const headers = Object.assign({ Accept: "application/json, text/plain, */*" }, opts.headers || {});
    target.fetch(finalUrl, { method: "GET", headers, signal: controller.signal, credentials: "same-origin", cache: opts.cache === false ? "no-store" : "default" }).then((response) => {
      xhr.status = response.status;
      xhr.readyState = 4;
      const contentType = response.headers.get("content-type") || "";
      xhr.getResponseHeader = (name) => response.headers.get(name);
      return response.text().then((text) => ({ response, text, contentType }));
    }).then((payload) => {
      xhr.responseText = payload.text;
      if (!payload.response.ok) {
        box.settle(false, null, "error", "HTTP " + payload.response.status);
        return;
      }
      const wantsJson = opts.dataType === "json" || opts.dataType === void 0 && payload.contentType.indexOf("json") >= 0;
      if (!wantsJson) {
        box.settle(true, payload.text, "success", "");
        return;
      }
      try {
        box.settle(true, payload.text ? JSON.parse(payload.text) : null, "success", "");
      } catch (e) {
        box.settle(false, null, "parsererror", "JSON \u89E3\u6790\u5931\u8D25");
      }
    }).catch((e) => {
      box.settle(false, null, "error", String(e && e.message ? e.message : e));
    }).then(() => {
      if (timer !== null) target.clearTimeout(timer);
    });
    return xhr;
  };
  const jq = function(selector, context) {
    if (typeof selector === "function") {
      ready(selector);
      return makeCollection(proto, []);
    }
    return makeCollection(proto, toElements(selector, doc, warn, context));
  };
  jq.fn = proto;
  jq.extend = extend;
  jq.each = each;
  jq.map = map;
  jq.grep = grep;
  jq.inArray = inArray;
  jq.ajax = ajax;
  jq.get = (url, data, success) => {
    const options = { url, data, success };
    return ajax(options);
  };
  jq.param = (value) => serializeParam(value);
  jq.parseHTML = parseHTML;
  jq.trim = (value) => toStringValue(value).trim();
  jq.isArray = (value) => Array.isArray(value);
  jq.isFunction = (value) => typeof value === "function";
  jq.isNumeric = (value) => {
    if (typeof value === "number") return !Number.isNaN(value) && Number.isFinite(value);
    if (typeof value === "string" && value.trim() !== "") return !Number.isNaN(Number(value));
    return false;
  };
  jq.contains = (a, b) => {
    try {
      return !!a && !!b && a.contains(b);
    } catch {
      return false;
    }
  };
  jq.noop = () => {
  };
  jq.now = () => Date.now();
  jq.makeArray = makeArray;
  jq.ready = ready;
  Object.assign(jq, { jquery: "3.7.1-portable-tavern" });
  return jq;
}

// src/client/st/dom.ts
var PT_EXT_MOUNT_ID = "pt-ext-mount";
var ST_ROOT_ID = "tavern-st-root";
var ST_EXT_PANEL_ID = "tavern-st-ext-panel";
var ST_EXT_DOCK_ID = "tavern-st-ext-dock";
var ST_TOASTS_ID = "tavern-st-toasts";
var ST_THEME_VARS_ID = "tavern-theme-vars";
var ST_STYLE_ID = "dsh-portable-tavern-st";
var ST_LOADER_ID = "tavern-st-loader";
var TRACKED_MOUNT_IDS = ["extensions_settings", "extensions_settings2", "extensionsMenu", "movingDivs"];
function skeletonCss() {
  return [
    "#tavern-st-root{position:fixed;left:0;top:0;width:0;height:0;overflow:visible;z-index:0;display:none}",
    "#tavern-st-ext-panel{display:flex;flex-direction:column;gap:8px;font-size:13px;color:#e8e9ec;box-sizing:border-box;",
    "  --SmartThemeBodyColor:#e8e9ec;--SmartThemeEmColor:#9aa0ab;--SmartThemeQuoteColor:#c3c7cf;",
    "  --SmartThemeBlurTintColor:rgba(22,24,29,0.85);--SmartThemeBorderColor:#2e323d;--SmartThemeUserMesBlurTintColor:#2a2f3a;",
    "  --SmartThemeBotMesBlurTintColor:#262b36;--SmartThemeShadowColor:rgba(0,0,0,0.35);--SmartThemeUnderlineColor:#4f7cff;",
    "  --SmartThemeFontSize:13px;--mainFontSize:13px;--white30:rgba(255,255,255,0.3);--black50:rgba(0,0,0,0.5)}",
    "#tavern-st-ext-dock{position:fixed;right:16px;bottom:16px;width:420px;max-width:92vw;max-height:64vh;overflow:auto;",
    "  z-index:1002;background:#16181d;border:1px solid #2e323d;border-radius:12px;padding:10px;box-shadow:0 12px 36px rgba(0,0,0,0.45)}",
    ".tavern-st-ext-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:6px;border-bottom:1px solid #262932}",
    ".tavern-st-ext-title{font-weight:700;font-size:13px}",
    ".tavern-st-ext-hint{color:#6f7683;font-size:11px;flex:1;min-width:120px}",
    ".tavern-st-ext-toggle{background:#2a2f3a;border:1px solid #3a404d;color:#e8e9ec;border-radius:7px;padding:4px 10px;font-size:12px;cursor:pointer}",
    ".tavern-st-ext-body{display:flex;flex-direction:column;gap:8px}",
    ".tavern-st-ext-body.tavern-st-collapsed{display:none}",
    "#extensionsMenu{display:flex;flex-wrap:wrap;gap:6px}",
    "#extensionsMenu:empty{display:none}",
    "#extensions_settings,#extensions_settings2{display:flex;flex-direction:column;gap:8px}",
    "#extensions_settings:empty,#extensions_settings2:empty{display:none}",
    ".tavern-st-mirror{border:1px solid #262932;border-radius:8px;padding:6px 8px;background:#12141a}",
    ".tavern-st-mirror>summary{cursor:pointer;color:#9aa0ab;font-size:12px;user-select:none}",
    "#chat{display:flex;flex-direction:column;gap:8px;padding:8px 0;max-height:46vh;overflow:auto}",
    ".tavern-st-chat-empty{color:#6f7683;font-size:12px;padding:6px 2px}",
    "#chat .mes{display:flex;gap:8px;align-items:flex-start}",
    "#chat .mes .mes_avatar{width:26px;height:26px;border-radius:50%;background:#2a2f3a;color:#fff;font-size:12px;font-weight:700;",
    "  display:flex;align-items:center;justify-content:center;flex:none}",
    "#chat .mes .mes_block{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}",
    "#chat .mes .ch_name{font-size:12px;color:#9aa0ab}",
    "#chat .mes .mes_text{white-space:pre-wrap;word-break:break-word;background:#262b36;border-radius:10px;padding:7px 10px;line-height:1.6}",
    '#chat .mes[is_user="true"] .mes_text{background:#2f3b57}',
    "#chat .mes .mes_buttons{display:flex;gap:6px;opacity:0.5}",
    "#chat .mes .mes_buttons>div{width:14px;height:14px;border:1px solid #3a404d;border-radius:4px;cursor:pointer}",
    "#movingDivs{display:flex;flex-direction:column;gap:6px}",
    "#movingDivs:empty{display:none}",
    ".inline-drawer{border:1px solid #262932;border-radius:8px;background:#1b1e25;overflow:hidden;margin-bottom:6px}",
    ".inline-drawer-toggle,.inline-drawer-header{display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:pointer;background:#20242c}",
    ".inline-drawer-content{padding:10px;display:flex;flex-direction:column;gap:8px;color:#d7d9de}",
    ".tavern-st-ext-body .menu_button,#tavern-st-ext-dock .menu_button{background:#2a2f3a;border:1px solid #3a404d;color:#e8e9ec;",
    "  border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer}",
    ".tavern-st-ext-body .menu_button:hover,#tavern-st-ext-dock .menu_button:hover{background:#333947}",
    '.tavern-st-ext-body .text_pole,#tavern-st-ext-dock .text_pole,#tavern-st-ext-body input[type="text"],#tavern-st-ext-dock input[type="text"],',
    "  #tavern-st-ext-body textarea,#tavern-st-ext-dock textarea,#tavern-st-ext-body select,#tavern-st-ext-dock select{",
    "  background:#12141a;border:1px solid #2e323d;color:#e8e9ec;border-radius:7px;padding:6px 9px;font-size:12px;max-width:100%}",
    ".tavern-st-ext-body .checkbox_label,#tavern-st-ext-dock .checkbox_label{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#c3c7cf}",
    ".tavern-st-ext-body .flex-container,#tavern-st-ext-dock .flex-container{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".tavern-st-ext-body .flexBasis48p,#tavern-st-ext-dock .flexBasis48p{flex:1 1 46%;min-width:140px}",
    ".tavern-st-ext-body .gap10,#tavern-st-ext-dock .gap10{gap:10px}",
    ".tavern-st-ext-body .opacity50p,#tavern-st-ext-dock .opacity50p{opacity:0.5}",
    ".tavern-st-ext-body .range-block,#tavern-st-ext-dock .range-block{display:flex;flex-direction:column;gap:4px}",
    "#tavern-st-toasts{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;z-index:2147483000;pointer-events:none}",
    ".tavern-st-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:8px;max-width:360px;background:#1b1e25;color:#e8e9ec;",
    "  border:1px solid #2e323d;border-left-width:3px;border-radius:8px;padding:9px 11px;font-size:12px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,0.4)}",
    ".tavern-st-toast-info{border-left-color:#4f7cff}",
    ".tavern-st-toast-success{border-left-color:#3fbf7f}",
    ".tavern-st-toast-warning{border-left-color:#ffb84d}",
    ".tavern-st-toast-error{border-left-color:#ff6b6b}",
    ".tavern-st-toast-text{flex:1;min-width:0;word-break:break-word}",
    ".tavern-st-toast-close{background:transparent;border:0;color:#9aa0ab;cursor:pointer;font-size:13px;padding:0 2px}",
    "#tavern-st-loader{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(8,9,12,0.45);z-index:2147483001}",
    "#tavern-st-loader.tavern-st-loader-on{display:flex}",
    ".tavern-st-loader-box{background:#16181d;border:1px solid #2e323d;border-radius:10px;padding:14px 18px;color:#e8e9ec;font-size:13px}"
  ].join("\n");
}
function mk(tag, id, className) {
  const node = document.createElement(tag);
  if (id) node.id = id;
  if (className) node.className = className;
  return node;
}
function ensure(id, parent, tag, className, onWarn) {
  const found = document.getElementById(id);
  if (found) {
    if (!parent.contains(found) && onWarn) onWarn("\u9875\u9762\u5DF2\u6709 #" + id + "\uFF08\u4E0D\u662F\u517C\u5BB9\u5BBF\u4E3B\u5EFA\u7684\uFF09\uFF0C\u6CBF\u7528\u8BE5\u8282\u70B9\u4F5C\u4E3A\u6302\u8F7D\u70B9");
    return found;
  }
  const node = document.createElement(tag || "div");
  node.id = id;
  if (className) node.className = className;
  parent.appendChild(node);
  return node;
}
function adoptMount(skel, createDock) {
  const mount = document.getElementById(PT_EXT_MOUNT_ID);
  if (mount) {
    if (skel.extPanel.parentNode !== mount) mount.appendChild(skel.extPanel);
    if (skel.dock && skel.dock.parentNode) skel.dock.remove();
    skel.dock = null;
    return true;
  }
  if (createDock && !skel.dock) {
    const dock = mk("div", ST_EXT_DOCK_ID, "tavern-st-ext-dock");
    dock.appendChild(skel.extPanel);
    document.body.appendChild(dock);
    skel.dock = dock;
    return false;
  }
  return false;
}
function installSkeleton(options) {
  const head = document.head;
  const body = document.body;
  let style = document.getElementById(ST_STYLE_ID);
  if (!style) {
    style = mk("style", ST_STYLE_ID);
    style.dataset.plugin = "dsh-portable-tavern-st";
    style.textContent = skeletonCss();
    head.appendChild(style);
  }
  const root = ensure(ST_ROOT_ID, body, "div", void 0, options.onWarn);
  const sendForm = ensure("send_form", root, "div", void 0, options.onWarn);
  let sendTextarea = document.getElementById("send_textarea");
  if (!sendTextarea) {
    sendTextarea = mk("textarea", "send_textarea");
    sendTextarea.rows = 2;
    sendForm.appendChild(sendTextarea);
  }
  const messageTemplate = ensure("message_template", root, "div", void 0, options.onWarn);
  const customCss = ensure("customCSS", root, "style", void 0, options.onWarn);
  const rightNavPanel = ensure("right-nav-panel", root, "div", void 0, options.onWarn);
  const leftNavPanel = ensure("left-nav-panel", root, "div", void 0, options.onWarn);
  const topSettingsHolder = ensure("top-settings-holder", root, "div", void 0, options.onWarn);
  let extPanel = document.getElementById(ST_EXT_PANEL_ID);
  if (!extPanel) {
    extPanel = mk("div", ST_EXT_PANEL_ID, "tavern-st-ext-panel");
    body.appendChild(extPanel);
  }
  extPanel.innerHTML = "";
  const extHead = mk("div", void 0, "tavern-st-ext-head");
  const extTitle = mk("span", void 0, "tavern-st-ext-title");
  extTitle.textContent = "\u6269\u5C55\u9762\u677F";
  const extHint = mk("span", void 0, "tavern-st-ext-hint");
  extHint.textContent = "\u793E\u533A\u6269\u5C55\uFF08SillyTavern \u517C\u5BB9\uFF09\u7684\u8BBE\u7F6E\u4E0E\u9762\u677F\u6302\u8F7D\u5728\u8FD9\u91CC";
  const extToggle = mk("button", void 0, "tavern-st-ext-toggle");
  extToggle.type = "button";
  extToggle.textContent = "\u6536\u8D77";
  extHead.appendChild(extTitle);
  extHead.appendChild(extHint);
  extHead.appendChild(extToggle);
  const extBody = mk("div", void 0, "tavern-st-ext-body");
  const extMenu = mk("div", "extensionsMenu");
  const extSettings = mk("div", "extensions_settings");
  const extSettings2 = mk("div", "extensions_settings2");
  const mirror = mk("details", void 0, "tavern-st-mirror");
  const mirrorSummary = mk("summary");
  mirrorSummary.textContent = "\u5BF9\u8BDD\u955C\u50CF / \u6D6E\u52A8\u6302\u8F7D\u70B9\uFF08#chat\u3001#movingDivs\uFF09";
  const chat = mk("div", "chat");
  const movingDivs = mk("div", "movingDivs");
  mirror.appendChild(mirrorSummary);
  mirror.appendChild(chat);
  mirror.appendChild(movingDivs);
  extBody.appendChild(extMenu);
  extBody.appendChild(extSettings);
  extBody.appendChild(extSettings2);
  extBody.appendChild(mirror);
  extPanel.appendChild(extHead);
  extPanel.appendChild(extBody);
  const toasts = ensure(ST_TOASTS_ID, body, "div", void 0, options.onWarn);
  const loader = ensure(ST_LOADER_ID, body, "div", void 0, options.onWarn);
  if (!loader.firstChild) {
    const box = mk("div", void 0, "tavern-st-loader-box");
    box.textContent = "\u6B63\u5728\u52A0\u8F7D\u6269\u5C55\u2026";
    loader.appendChild(box);
  }
  let themeVars = document.getElementById(ST_THEME_VARS_ID);
  if (!themeVars) {
    themeVars = mk("style", ST_THEME_VARS_ID);
    head.appendChild(themeVars);
  }
  const skel = {
    root,
    extPanel,
    extBody,
    dock: document.getElementById(ST_EXT_DOCK_ID),
    extSettings,
    extSettings2,
    extMenu,
    chat,
    movingDivs,
    sendForm,
    sendTextarea,
    messageTemplate,
    customCss,
    rightNavPanel,
    leftNavPanel,
    topSettingsHolder,
    loader,
    toasts,
    themeVars,
    style,
    chatSignature: "",
    collapsed: false,
    observer: null,
    onSend: options.onSend,
    owned: [root, extPanel, toasts, loader],
    onClick: () => {
    },
    onSubmit: () => {
    },
    onKeydown: () => {
    }
  };
  skel.onClick = (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    const toggle = target.closest(".inline-drawer-toggle, .inline-drawer-header");
    if (!toggle) return;
    const drawer = toggle.parentElement;
    if (!drawer) return;
    const content = drawer.querySelector(".inline-drawer-content");
    if (!content) return;
    const box = content;
    const hidden = box.style.display === "none" || box.style.display === "";
    box.style.display = hidden ? "flex" : "none";
    event.preventDefault();
  };
  document.addEventListener("click", skel.onClick, true);
  extToggle.addEventListener("click", () => {
    skel.collapsed = !skel.collapsed;
    extBody.className = skel.collapsed ? "tavern-st-ext-body tavern-st-collapsed" : "tavern-st-ext-body";
    extToggle.textContent = skel.collapsed ? "\u5C55\u5F00" : "\u6536\u8D77";
  });
  skel.onSubmit = (event) => {
    event.preventDefault();
    const text = String(skel.sendTextarea.value || "");
    if (!text.trim()) return;
    skel.sendTextarea.value = "";
    try {
      skel.onSend(text);
    } catch (e) {
      console.error("[portable-tavern/st] #send_form \u56DE\u8C03\u5F02\u5E38", e);
    }
  };
  skel.onKeydown = (event) => {
    const key = event.key;
    if (key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    skel.onSubmit(event);
  };
  sendForm.addEventListener("submit", skel.onSubmit);
  sendTextarea.addEventListener("keydown", skel.onKeydown);
  adoptMount(skel, true);
  if (typeof MutationObserver === "function") {
    const observer = new MutationObserver(() => {
      if (document.getElementById(PT_EXT_MOUNT_ID)) {
        if (adoptMount(skel, false)) observer.disconnect();
      }
    });
    observer.observe(body, { childList: true, subtree: true });
    skel.observer = observer;
  }
  return skel;
}
function disposeSkeleton(skel) {
  try {
    document.removeEventListener("click", skel.onClick, true);
  } catch {
  }
  try {
    skel.sendForm.removeEventListener("submit", skel.onSubmit);
  } catch {
  }
  try {
    skel.sendTextarea.removeEventListener("keydown", skel.onKeydown);
  } catch {
  }
  if (skel.observer) {
    try {
      skel.observer.disconnect();
    } catch {
    }
    skel.observer = null;
  }
  for (const node of skel.owned) {
    try {
      if (node.parentNode) node.parentNode.removeChild(node);
    } catch {
    }
  }
  const dock = document.getElementById(ST_EXT_DOCK_ID);
  if (dock && dock.parentNode) {
    try {
      dock.parentNode.removeChild(dock);
    } catch {
    }
  }
  for (const id of [ST_THEME_VARS_ID, ST_STYLE_ID]) {
    const node = document.getElementById(id);
    try {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    } catch {
    }
  }
}
function mesHtml(msg, index, mirror, sanitize) {
  const name = String(msg && msg.name ? msg.name : msg && msg.is_user ? mirror.name1 : mirror.name2);
  const isUser = msg && msg.is_user === true;
  const isSystem = msg && msg.is_system === true;
  const raw = msg && typeof msg.mes === "string" ? msg.mes : "";
  let body = "";
  try {
    body = sanitize(raw);
  } catch {
    body = escapeHtml(raw);
  }
  const avatar = escapeHtml(name.slice(0, 1) || "?");
  const sendDate = escapeHtml(msg && msg.send_date ? msg.send_date : "");
  const extra = msg && msg.extra && typeof msg.extra === "object" ? escapeHtml(JSON.stringify(msg.extra)) : "{}";
  return [
    '<div class="mes" mesid="' + index + '" data-mesid="' + index + '" is_user="' + (isUser ? "true" : "false") + '" is_system="' + (isSystem ? "true" : "false") + '" name="' + escapeHtml(name) + '" ch_name="' + escapeHtml(name) + '" send_date="' + sendDate + '" mes_extra="' + extra + '">',
    '  <div class="mes_avatar">' + avatar + "</div>",
    '  <div class="mes_block">',
    '    <div class="ch_name"><span class="name_text">' + escapeHtml(name) + "</span></div>",
    '    <div class="mes_text">' + body + "</div>",
    '    <div class="mes_buttons"><div class="mes_edit" title="\u7F16\u8F91"></div><div class="mes_delete" title="\u5220\u9664"></div><div class="mes_swipe" title="\u6ED1\u52A8"></div></div>',
    "  </div>",
    "</div>"
  ].join("\n");
}
function chatSignatureOf(chat, name1, name2) {
  const shape = chat.map((msg) => {
    const text = msg && typeof msg.mes === "string" ? msg.mes : "";
    return (msg && msg.is_user ? "u" : "a") + text.length;
  }).join(",");
  return [String(chat.length), name1, name2, shape].join("|");
}
function syncChatMirror(skel, mirror, sanitize) {
  const host = skel.chat;
  if (!host) return;
  const chat = mirror && Array.isArray(mirror.chat) ? mirror.chat : [];
  const signature = chatSignatureOf(chat, mirror ? mirror.name1 : "", mirror ? mirror.name2 : "");
  if (signature === skel.chatSignature) return;
  skel.chatSignature = signature;
  const parts = [];
  for (let i = 0; i < chat.length; i++) parts.push(mesHtml(chat[i], i, mirror, sanitize));
  if (parts.length === 0) {
    parts.push('<div class="tavern-st-chat-empty">\u6682\u65E0\u5BF9\u8BDD\uFF1A\u5728\u9152\u9986\u9762\u677F\u5F00\u59CB\u804A\u5929\u540E\uFF0C\u8FD9\u91CC\u4F1A\u540C\u6B65\u6210 ST \u5F62\u72B6\u7684 #chat \u955C\u50CF\u3002</div>');
  }
  host.innerHTML = parts.join("\n");
}
function showToast(skel, message, kind = "info", ttl = 4200) {
  try {
    const node = mk("div", void 0, "tavern-st-toast tavern-st-toast-" + kind);
    const text = mk("span", void 0, "tavern-st-toast-text");
    text.textContent = String(message === void 0 || message === null ? "" : message);
    const close = mk("button", void 0, "tavern-st-toast-close");
    close.type = "button";
    close.textContent = "\xD7";
    close.addEventListener("click", () => {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    node.appendChild(text);
    node.appendChild(close);
    skel.toasts.appendChild(node);
    if (ttl > 0) {
      window.setTimeout(() => {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, ttl);
    }
  } catch (e) {
    console.error("[portable-tavern/st] toast \u6E32\u67D3\u5931\u8D25", e);
  }
}
function clearToasts(skel) {
  try {
    skel.toasts.innerHTML = "";
  } catch {
  }
}
function setLoader(skel, visible) {
  try {
    skel.loader.className = visible ? "tavern-st-loader-on" : "";
  } catch {
  }
}
function applyThemeVars(skel, css2) {
  try {
    skel.themeVars.textContent = css2 ? String(css2) : "";
  } catch {
  }
}
var watcherOwner = "";
var watcherNodes = /* @__PURE__ */ new Map();
var domPatched = false;
function isRecordableParent(parent) {
  if (!parent || typeof document === "undefined") return false;
  return parent === document.head || parent === document.body;
}
function recordNode(node, parent) {
  if (!watcherOwner) return;
  if (!node || typeof node !== "object") return;
  if (node.nodeType !== 1) return;
  if (!isRecordableParent(parent)) return;
  const list = watcherNodes.get(watcherOwner) || [];
  if (list.length >= 500) return;
  if (list.indexOf(node) >= 0) return;
  list.push(node);
  watcherNodes.set(watcherOwner, list);
}
function wrapMethod(proto, key, pick) {
  if (!proto) return;
  const orig = proto[key];
  if (typeof orig !== "function" || orig.__tavernStWrapped === true) return;
  const wrapped = function(...args) {
    const result = orig.apply(this, args);
    try {
      const picked = pick(args);
      for (const node of picked) recordNode(node, this);
    } catch {
    }
    return result;
  };
  wrapped.__tavernStWrapped = true;
  proto[key] = wrapped;
}
function patchDomOnce() {
  if (domPatched) return;
  domPatched = true;
  try {
    const nodeProto = typeof Node !== "undefined" ? Node.prototype : void 0;
    const elementProto = typeof Element !== "undefined" ? Element.prototype : void 0;
    const documentProto = typeof Document !== "undefined" ? Document.prototype : void 0;
    wrapMethod(nodeProto, "appendChild", (args) => [args[0]]);
    wrapMethod(nodeProto, "insertBefore", (args) => [args[0]]);
    wrapMethod(nodeProto, "replaceChild", (args) => [args[0]]);
    for (const proto of [elementProto, documentProto]) {
      wrapMethod(proto, "append", (args) => args);
      wrapMethod(proto, "prepend", (args) => args);
      wrapMethod(proto, "replaceChildren", (args) => args);
    }
    wrapMethod(elementProto, "after", (args) => args);
    wrapMethod(elementProto, "before", (args) => args);
    wrapMethod(elementProto, "insertAdjacentElement", (args) => [args[1]]);
  } catch (e) {
    console.error("[portable-tavern/st] DOM \u5F52\u5C5E\u8FFD\u8E2A\u8865\u4E01\u5931\u8D25", e);
  }
}
function createDomWatcher() {
  patchDomOnce();
  return {
    begin: (owner) => {
      watcherOwner = owner || "";
    },
    end: () => {
      watcherOwner = "";
    },
    owner: () => watcherOwner,
    nodesOf: (owner) => (watcherNodes.get(owner) || []).slice(),
    forget: (owner) => {
      watcherNodes.delete(owner);
    }
  };
}
function removeHeadBodyNodes(nodes) {
  let removed = 0;
  for (const node of nodes) {
    try {
      if (node.parentNode && isRecordableParent(node.parentNode)) {
        node.parentNode.removeChild(node);
        removed += 1;
      }
    } catch {
    }
  }
  return removed;
}
function captureMounts() {
  const out = [];
  for (const id of TRACKED_MOUNT_IDS) {
    const node = document.getElementById(id);
    if (!node) continue;
    const children = [];
    for (let i = 0; i < node.childNodes.length; i++) children.push(node.childNodes[i]);
    out.push([node, children]);
  }
  return out;
}
function addedChildrenSince(snapshot) {
  const out = [];
  for (const entry of snapshot) {
    const node = entry[0];
    const before = entry[1];
    try {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (before.indexOf(child) < 0) out.push(child);
      }
    } catch {
    }
  }
  return out;
}

// src/client/st/slash.ts
var ARGUMENT_TYPE = {
  /** 字符串。 */
  STRING: "string",
  /** 数字。 */
  NUMBER: "number",
  /** 布尔。 */
  BOOLEAN: "boolean",
  /** 变量引用。 */
  VARIABLE: "variable",
  /** 列表。 */
  LIST: "list",
  /** 闭包。 */
  CLOSURE: "closure",
  /** 字典。 */
  DICTIONARY: "dictionary",
  /** 枚举。 */
  ENUM: "enum"
};
var POPUP_TYPE = {
  /** 纯文本提示。 */
  TEXT: 1,
  /** 确认框。 */
  CONFIRM: 2,
  /** 输入框。 */
  INPUT: 3,
  /** 只读展示。 */
  DISPLAY: 4,
  /** 图片裁剪。 */
  CROP: 5
};
var POPUP_RESULT = {
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
  CUSTOM4: 5
};
function makeSlashCommand(props) {
  const source = props && typeof props === "object" ? props : {};
  const name = typeof source.name === "string" ? source.name : "";
  const aliases = Array.isArray(source.aliases) ? source.aliases.map((a) => String(a)) : typeof source.aliases === "string" && source.aliases ? source.aliases.split(",").map((a) => a.trim()) : [];
  return {
    name,
    callback: typeof source.callback === "function" ? source.callback : null,
    aliases,
    helpString: typeof source.helpString === "string" ? source.helpString : "",
    returns: typeof source.returns === "string" ? source.returns : "",
    rawProps: source,
    execute: () => {
      throw new Error("\u4FBF\u643A\u9152\u9986\uFF1A\u6682\u4E0D\u652F\u6301\u6267\u884C\u659C\u6760\u547D\u4EE4 /" + name + "\uFF08\u672C\u5BBF\u4E3B\u6CA1\u6709 ST \u7684\u547D\u4EE4\u7BA1\u7EBF\uFF0C\u547D\u4EE4\u5DF2\u6CE8\u518C\u4F46\u4E0D\u4F1A\u88AB\u6267\u884C\uFF09");
    }
  };
}
function createSlashCommandClass() {
  const SlashCommand = function(name, callback, helpString) {
    Object.assign(this, makeSlashCommand({ name, callback, helpString }));
  };
  const statics = SlashCommand;
  statics.fromProps = (props) => makeSlashCommand(props);
  statics.fromJson = (json) => {
    if (typeof json === "string") {
      try {
        return makeSlashCommand(JSON.parse(json));
      } catch (e) {
        console.error("[portable-tavern/st] SlashCommand.fromJson \u89E3\u6790\u5931\u8D25", e);
        return makeSlashCommand(null);
      }
    }
    return makeSlashCommand(json || null);
  };
  return SlashCommand;
}
function createSlashCommandParser(onWarn) {
  const commands = {};
  const warn = (message) => {
    try {
      if (onWarn) onWarn(message);
      else console.warn("[portable-tavern/st] " + message);
    } catch {
    }
  };
  const parser = {
    commands,
    addCommand: (descriptor) => {
      const command = makeSlashCommand(descriptor);
      if (!command.name) {
        warn("\u6269\u5C55\u6CE8\u518C\u4E86\u4E00\u4E2A\u6CA1\u6709\u540D\u5B57\u7684\u659C\u6760\u547D\u4EE4\uFF0C\u5DF2\u5FFD\u7565");
        return command;
      }
      commands[command.name] = command;
      for (const alias of command.aliases) commands[alias] = command;
      return command;
    },
    addCommandObject: (command) => {
      const obj = command && typeof command.execute === "function" ? command : makeSlashCommand(command);
      if (obj.name) {
        commands[obj.name] = obj;
        for (const alias of obj.aliases) commands[alias] = obj;
      }
      return obj;
    },
    getCommand: (name) => commands[name],
    removeCommand: (name) => {
      const found = commands[name];
      if (!found) return false;
      for (const key of Object.keys(commands)) if (commands[key] === found) delete commands[key];
      return true;
    },
    listCommands: () => Object.keys(commands),
    execute: (name) => {
      throw new Error("\u4FBF\u643A\u9152\u9986\uFF1A\u6682\u4E0D\u652F\u6301\u6267\u884C\u659C\u6760\u547D\u4EE4 /" + name + "\uFF08\u8BE5\u6269\u5C55\u4F9D\u8D56 ST \u7684\u547D\u4EE4\u7BA1\u7EBF\uFF09");
    }
  };
  return parser;
}
function callGenericPopup(content, type, options) {
  const text = typeof content === "string" ? content : content && typeof content === "object" && typeof content.textContent === "string" ? String(content.textContent) : String(content === void 0 || content === null ? "" : content);
  const kind = typeof type === "number" ? type : POPUP_TYPE.TEXT;
  try {
    if (kind === POPUP_TYPE.CONFIRM) {
      const ok = typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(text) : false;
      return Promise.resolve(ok ? POPUP_RESULT.AFFIRMATIVE : POPUP_RESULT.NEGATIVE);
    }
    if (kind === POPUP_TYPE.INPUT) {
      const value = typeof window !== "undefined" && typeof window.prompt === "function" ? window.prompt(text, "") : null;
      return Promise.resolve(value === null ? null : value);
    }
    const okLabel = options && typeof options.okButton === "string" ? options.okButton : "\u786E\u5B9A";
    if (typeof window !== "undefined" && typeof window.confirm === "function") window.confirm(text + "\n\n\uFF08" + okLabel + "\uFF09");
    return Promise.resolve(null);
  } catch (e) {
    console.error("[portable-tavern/st] callGenericPopup \u5931\u8D25", e);
    return Promise.resolve(null);
  }
}
function createPopupClass() {
  const Popup = function(content, type, options) {
    this.content = content;
    this.type = typeof type === "number" ? type : POPUP_TYPE.TEXT;
    this.options = options || {};
    this.show = () => callGenericPopup(this.content, this.type, this.options);
    this.complete = () => {
    };
    this.close = () => {
    };
  };
  const statics = Popup;
  statics.TYPE = POPUP_TYPE;
  statics.RESULT = POPUP_RESULT;
  return Popup;
}

// src/client/st/context.ts
function pad2(value) {
  return value < 10 ? "0" + value : String(value);
}
function dateText(now) {
  return String(now.getFullYear()) + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
}
function timeText(now) {
  return pad2(now.getHours()) + ":" + pad2(now.getMinutes());
}
function estimateTokens(text) {
  const value = toStringValue(text);
  if (!value) return 0;
  let cjk = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 11904 && code <= 40959) cjk += 1;
  }
  return cjk + Math.ceil((value.length - cjk) / 4);
}
function emptyMirror() {
  return { chat: [], name1: "\u4F60", name2: "", character: null, chatMetadata: {}, mainApi: "dsh", onlineStatus: "online", chatRootId: "pt-chat-log" };
}
function pickOne(list) {
  if (list.length === 0) return "";
  return list[Math.floor(Math.random() * list.length)];
}
function createAccountStorage(localforage) {
  const storage = (() => void 0);
  storage.getItem = (key) => localforage.getItem(key);
  storage.setItem = (key, value) => localforage.setItem(key, value);
  storage.removeItem = (key) => localforage.removeItem(key);
  storage.clear = () => localforage.clear();
  storage.keys = () => localforage.keys();
  return storage;
}
function createPowerUser() {
  return {
    personas: {},
    persona_descriptions: {},
    default_persona: null,
    active_persona: null,
    custom_persona: null,
    context: { preset: "default", allow_rearrange: false },
    instruct: { enabled: false, preset: "default" },
    world_info_depth: 2,
    world_info_budget: 25,
    world_info_recursive: false,
    world_info_case_sensitive: false,
    world_info_whole_words: false,
    world_info_include_names: true,
    author_notes_prompt: "",
    prefer_character_prompt: true,
    prefer_character_jailbreak: true,
    show_avatar: false,
    fast_ui_mode: true,
    quiet_prompt: "",
    quick_continue: false,
    auto_connect: false
  };
}
function createStContext(deps) {
  const { extensionSettings, chatMetadata } = deps;
  const characters = [];
  const groups = [];
  const locales = {};
  const manifests = {};
  const debugFunctions = {};
  const notified = /* @__PURE__ */ new Set();
  const slashParser = createSlashCommandParser(deps.onWarn);
  const SlashCommand = createSlashCommandClass();
  const Popup = createPopupClass();
  const powerUser = createPowerUser();
  const accountStorage = createAccountStorage(deps.libs.localforage);
  let currentLocale = "zh-cn";
  const safeMirror = () => {
    try {
      const mirror = deps.getMirror();
      if (mirror && typeof mirror === "object") return mirror;
    } catch (e) {
      console.error("[portable-tavern/st] getContext \u8BFB\u53D6\u9152\u9986\u955C\u50CF\u5931\u8D25", e);
    }
    return emptyMirror();
  };
  const unsupported = (feature, reason) => {
    if (!notified.has(feature)) {
      notified.add(feature);
      try {
        deps.onToast(reason, "warning");
      } catch {
      }
    }
    throw new Error("\u4FBF\u643A\u9152\u9986\uFF1A" + reason + "\uFF08" + feature + "\uFF09");
  };
  const saveSettings = () => {
    try {
      deps.persistSettings();
    } catch (e) {
      console.error("[portable-tavern/st] \u4FDD\u5B58 extension_settings \u5931\u8D25", e);
    }
  };
  const saveSettingsDebounced = debounce(saveSettings, 500);
  const saveMetadataDebounced = debounce(() => {
    try {
      deps.persistMetadata();
    } catch (e) {
      console.error("[portable-tavern/st] \u4FDD\u5B58 chat_metadata \u5931\u8D25", e);
    }
  }, 500);
  const substitute = (text, extra) => {
    let out = toStringValue(text);
    if (!out) return out;
    if (out.indexOf("{{") < 0) return out;
    const mirror = safeMirror();
    const card = mirror.character || {};
    const chat = Array.isArray(mirror.chat) ? mirror.chat : [];
    const now = /* @__PURE__ */ new Date();
    const first = chat.length > 0 ? chat[0] : null;
    const last = chat.length > 0 ? chat[chat.length - 1] : null;
    const field = (key) => toStringValue(card[key]);
    const table = {
      user: mirror.name1 || "\u4F60",
      char: mirror.name2 || "",
      time: timeText(now),
      date: dateText(now),
      weekday: ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"][now.getDay()],
      isotime: now.toISOString(),
      newline: "\n",
      input: "",
      persona: "",
      description: field("description"),
      personality: field("personality"),
      scenario: field("scenario"),
      mesExamples: field("mes_example"),
      example_dialogue: field("mes_example"),
      charPrompt: "",
      charJailbreak: "",
      charVersion: field("character_version"),
      charCreator: field("creator"),
      creator_notes: field("creator_notes"),
      first_mes: field("first_mes"),
      model: "dsh",
      maxPrompt: "2048",
      maxContext: "8192",
      maxResponse: "1024",
      lastMessage: last ? toStringValue(last.mes) : "",
      firstMessage: first ? toStringValue(first.mes) : "",
      original: "",
      group: "",
      idle_duration: "",
      isMobile: deps.isMobile ? "true" : "false",
      toggles: ""
    };
    out = out.replace(/\{\{\s*(random|pick)\s*:\s*([^}]*)\}\}/gi, (_match, _kind, list) => {
      const options = String(list).split(",").map((item) => item.trim()).filter((item) => item !== "");
      return pickOne(options);
    });
    out = out.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.-]*)\s*\}\}/g, (match, name) => {
      if (extra && Object.prototype.hasOwnProperty.call(extra, name)) return toStringValue(extra[name]);
      if (Object.prototype.hasOwnProperty.call(table, name)) return table[name];
      return match;
    });
    return out;
  };
  const renderExtensionTemplateAsync = async (extensionName, templateId, data) => {
    try {
      const name = toStringValue(extensionName);
      const id = toStringValue(templateId);
      if (!name || !id) return "";
      const file = /\.html?$/i.test(id) ? id : id + ".html";
      const path = file.split("/").map((part) => encodeURIComponent(part)).join("/");
      const url = "/tavern-ext/" + encodeURIComponent(name) + "/" + path;
      const response = await fetch(url);
      if (!response.ok) {
        deps.onWarn("\u6269\u5C55\u6A21\u677F\u4E0D\u5B58\u5728\uFF1A" + url + "\uFF08HTTP " + response.status + "\uFF09\uFF0C\u5DF2\u8FD4\u56DE\u7A7A\u4E32");
        return "";
      }
      const text = await response.text();
      const template = deps.libs.Handlebars.compile(text);
      return template(data === void 0 || data === null ? {} : data);
    } catch (e) {
      deps.onWarn("\u6269\u5C55\u6A21\u677F\u6E32\u67D3\u5931\u8D25\uFF1A" + String(e instanceof Error ? e.message : e));
      return "";
    }
  };
  const translate = (text) => {
    const key = toStringValue(text);
    if (!key) return key;
    try {
      const current = locales[currentLocale];
      if (current && Object.prototype.hasOwnProperty.call(current, key)) return toStringValue(current[key]);
      for (const name of Object.keys(locales)) {
        const dict = locales[name];
        if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return toStringValue(dict[key]);
      }
    } catch (e) {
      console.error("[portable-tavern/st] translate \u5931\u8D25", e);
    }
    return key;
  };
  const context = {
    chat: [],
    characters,
    characterId: void 0,
    this_chid: void 0,
    groups,
    groupId: null,
    chatId: "",
    name1: "\u4F60",
    name2: "",
    mainApi: "dsh",
    main_api: "dsh",
    onlineStatus: "online",
    chatMetadata,
    chat_metadata: chatMetadata,
    extensionSettings,
    extension_settings: extensionSettings,
    eventSource: deps.eventSource,
    eventTypes: event_types,
    event_types,
    getRequestHeaders: () => ({ "Content-Type": "application/json" }),
    substituteParams: (text, extra) => substitute(text, extra),
    substituteParamsExtended: (text, additional) => substitute(text, additional),
    renderExtensionTemplateAsync,
    renderTemplateAsync: (templateId, data) => renderExtensionTemplateAsync("template", templateId, data),
    getExtensionManifest: (extensionName) => {
      const name = toStringValue(extensionName);
      if (manifests[name]) return manifests[name];
      const cached = deps.manifestFor(name);
      if (cached) {
        manifests[name] = cached;
        return cached;
      }
      const placeholder = { display_name: name, js: "index.js", css: "style.css", version: "", author: "", stubbed: true };
      manifests[name] = placeholder;
      try {
        deps.requestManifest(name);
      } catch {
      }
      return placeholder;
    },
    t: translate,
    translate,
    addLocaleData: (nameOrData, dataOrName) => {
      try {
        const name = typeof nameOrData === "string" ? nameOrData : typeof dataOrName === "string" ? dataOrName : "default";
        const data = typeof nameOrData === "string" ? dataOrName : nameOrData;
        if (!data || typeof data !== "object") return;
        const dict = locales[name] || (locales[name] = {});
        for (const key of Object.keys(data)) dict[key] = toStringValue(data[key]);
      } catch (e) {
        console.error("[portable-tavern/st] addLocaleData \u5931\u8D25", e);
      }
    },
    getCurrentLocale: () => currentLocale,
    isMobile: deps.isMobile,
    loader: {
      show: () => {
        const skel = deps.getSkeleton();
        if (skel) {
          try {
            setLoader(skel, true);
          } catch {
          }
        }
      },
      hide: () => {
        const skel = deps.getSkeleton();
        if (skel) {
          try {
            setLoader(skel, false);
          } catch {
          }
        }
      }
    },
    callGenericPopup,
    Popup,
    POPUP_TYPE,
    POPUP_RESULT,
    registerDebugFunction: (name, description, fn) => {
      const safeFn = typeof fn === "function" ? fn : () => {
      };
      debugFunctions[toStringValue(name)] = safeFn;
      void description;
      return safeFn;
    },
    SlashCommandParser: slashParser,
    SlashCommand,
    ARGUMENT_TYPE,
    executeSlashCommands: (command) => {
      deps.onWarn("\u6269\u5C55\u8BF7\u6C42\u6267\u884C\u659C\u6760\u547D\u4EE4 /" + toStringValue(command).replace(/^\//, "") + "\uFF0C\u672C\u5BBF\u4E3B\u6CA1\u6709 ST \u7684\u547D\u4EE4\u7BA1\u7EBF");
      return unsupported("executeSlashCommands", "\u8BE5\u6269\u5C55\u9700\u8981 ST \u7684\u659C\u6760\u547D\u4EE4\u7BA1\u7EBF\uFF0C\u672C\u5BBF\u4E3B\u6682\u4E0D\u652F\u6301");
    },
    executeSlashCommandsWithOptions: (command) => unsupported("executeSlashCommandsWithOptions", "\u8BE5\u6269\u5C55\u9700\u8981 ST \u7684\u659C\u6760\u547D\u4EE4\u7BA1\u7EBF\uFF08" + toStringValue(command).slice(0, 40) + "\uFF09\uFF0C\u672C\u5BBF\u4E3B\u6682\u4E0D\u652F\u6301"),
    generate: () => unsupported("generate", "\u8BE5\u6269\u5C55\u9700\u8981\u751F\u6210\u94FE\u8DEF\uFF0C\u672C\u5BBF\u4E3B\u6682\u4E0D\u652F\u6301"),
    generateRaw: () => unsupported("generateRaw", "\u8BE5\u6269\u5C55\u9700\u8981\u751F\u6210\u94FE\u8DEF\uFF0C\u672C\u5BBF\u4E3B\u6682\u4E0D\u652F\u6301"),
    Generate: () => unsupported("Generate", "\u8BE5\u6269\u5C55\u9700\u8981\u751F\u6210\u94FE\u8DEF\uFF0C\u672C\u5BBF\u4E3B\u6682\u4E0D\u652F\u6301"),
    stopGeneration: () => unsupported("stopGeneration", "\u8BE5\u6269\u5C55\u9700\u8981\u751F\u6210\u94FE\u8DEF\uFF0C\u672C\u5BBF\u4E3B\u6682\u4E0D\u652F\u6301"),
    sendMessageAsUser: (text) => {
      try {
        deps.onSend(toStringValue(text));
      } catch (e) {
        console.error("[portable-tavern/st] sendMessageAsUser \u5931\u8D25", e);
      }
    },
    saveSettings,
    saveSettingsDebounced,
    saveMetadataDebounced,
    getTokenCount: (text) => estimateTokens(text),
    getTokenCountAsync: (text) => Promise.resolve(estimateTokens(text)),
    accountStorage,
    powerUser,
    power_user: powerUser
  };
  const syncCharacters = (mirror) => {
    characters.length = 0;
    const card = mirror.character;
    if (!card || typeof card !== "object") return;
    let json = "";
    try {
      json = JSON.stringify(card);
    } catch {
      json = "";
    }
    const entry = Object.assign({}, card, {
      name: toStringValue(card.name) || mirror.name2 || "\u89D2\u8272",
      avatar: "portable-tavern.png",
      chat: mirror.chatRootId,
      data: card,
      fav: false,
      talkativeness: 0.5,
      json_data: json
    });
    characters.push(entry);
  };
  const syncMetadata = (mirror) => {
    const incoming = mirror.chatMetadata;
    if (!incoming || typeof incoming !== "object") return;
    for (const key of Object.keys(incoming)) {
      if (!Object.prototype.hasOwnProperty.call(chatMetadata, key)) chatMetadata[key] = incoming[key];
    }
  };
  const refresh = () => {
    const mirror = safeMirror();
    syncCharacters(mirror);
    syncMetadata(mirror);
    context.chat = Array.isArray(mirror.chat) ? mirror.chat : [];
    context.name1 = toStringValue(mirror.name1) || "\u4F60";
    context.name2 = toStringValue(mirror.name2);
    context.mainApi = toStringValue(mirror.mainApi) || "dsh";
    context.main_api = context.mainApi;
    context.onlineStatus = toStringValue(mirror.onlineStatus) || "online";
    context.chatId = toStringValue(mirror.chatId) || "tavern-" + (context.name2 || "nochar");
    const hasCharacter = !!mirror.character && typeof mirror.character === "object";
    context.characterId = hasCharacter ? 0 : void 0;
    context.this_chid = context.characterId;
    context.isMobile = deps.isMobile;
    return context;
  };
  return {
    get: refresh,
    peek: () => context,
    cacheManifest: (id, manifest) => {
      if (id) manifests[id] = manifest;
    },
    slashParser
  };
}

// src/client/st/host.ts
var ST_SETTINGS_KEY = "dsh.portable-tavern.st.extension-settings.v1";
var ST_METADATA_KEY = "dsh.portable-tavern.st.chat-metadata.v1";
var LOAD_WINDOW_MS = 3e3;
var LOAD_GRACE_MS = 800;
var MIRROR_INTERVAL_MS = 900;
function loadJsonObject(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function saveJsonObject(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("[portable-tavern/st] \u5199\u5165 localStorage \u5931\u8D25: " + key, e);
  }
}
function resolveUrl(src) {
  try {
    return new URL(src, window.location.href).toString();
  } catch {
    return src;
  }
}
function extractModuleRefs(message) {
  const out = [];
  const re = /(https?:\/\/[^\s"')]+|\/[A-Za-z0-9_\-./@]+\.m?js)/g;
  let match;
  while ((match = re.exec(message)) !== null) {
    const value = match[1];
    if (out.indexOf(value) < 0) out.push(value);
  }
  return out;
}
function isModuleImportError(message) {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|does not provide an export named|Failed to resolve module specifier|Cannot find module|The requested module/i.test(message);
}
function noopFunction() {
  return (..._args) => void 0;
}
function createStHost() {
  const eventSource = createEventSource();
  const libs = createStLibs();
  const extensionSettings = loadJsonObject(ST_SETTINGS_KEY);
  const chatMetadata = loadJsonObject(ST_METADATA_KEY);
  const extensions = /* @__PURE__ */ new Map();
  const watcher = createDomWatcher();
  const stubHost = {};
  const ownedGlobals = [];
  const previousGlobals = /* @__PURE__ */ new Map();
  const notified = /* @__PURE__ */ new Set();
  let skeleton = null;
  let options = null;
  let installed = false;
  let activeLoad = null;
  let mirrorTimer = null;
  let loadChain = Promise.resolve();
  let seenChatLength = -1;
  let seenCharacter = "\0";
  let seenChatId = "";
  const warn = (message) => {
    const text = toStringValue(message);
    try {
      console.warn("[portable-tavern/st] " + text);
    } catch {
    }
    try {
      if (options) options.onWarn(text);
    } catch (e) {
      console.error("[portable-tavern/st] onWarn \u56DE\u8C03\u5F02\u5E38", e);
    }
  };
  const reportError = (message, error) => {
    try {
      console.error("[portable-tavern/st] " + message, error);
    } catch {
    }
    try {
      if (options) options.onWarn(message + "\uFF1A" + String(error instanceof Error ? error.message : error));
    } catch {
    }
  };
  const toast = (message, kind = "info") => {
    const text = toStringValue(message);
    try {
      if (skeleton) showToast(skeleton, text, kind);
      else console.info("[portable-tavern/st] toast(" + kind + ")\uFF1A" + text);
    } catch (e) {
      console.error("[portable-tavern/st] toast \u5931\u8D25", e);
    }
  };
  const notifyOnce = (key, message) => {
    if (notified.has(key)) return;
    notified.add(key);
    warn(message);
    toast(message, "warning");
  };
  const persistSettings = () => {
    saveJsonObject(ST_SETTINGS_KEY, extensionSettings);
    try {
      if (options) options.onSettings(extensionSettings);
    } catch (e) {
      console.error("[portable-tavern/st] onSettings \u56DE\u8C03\u5F02\u5E38", e);
    }
  };
  const persistMetadata = () => {
    saveJsonObject(ST_METADATA_KEY, chatMetadata);
  };
  const contextHandle = createStContext({
    eventSource,
    libs,
    getMirror: () => {
      if (!options) return { chat: [], name1: "\u4F60", name2: "", character: null, chatMetadata: {}, mainApi: "dsh", onlineStatus: "online", chatRootId: "pt-chat-log" };
      return options.getContext();
    },
    onSend: (text) => {
      try {
        if (options) options.onSend(text);
        else warn("\u6269\u5C55\u5C1D\u8BD5\u4EE5\u7528\u6237\u8EAB\u4EFD\u53D1\u8A00\uFF0C\u4F46\u9152\u9986\u9762\u677F\u8FD8\u6CA1\u63A5\u4E0A onSend");
      } catch (e) {
        reportError("onSend \u56DE\u8C03\u5F02\u5E38", e);
      }
    },
    onWarn: warn,
    onToast: toast,
    extensionSettings,
    chatMetadata,
    persistSettings,
    persistMetadata,
    getSkeleton: () => skeleton,
    loadedExtensions: () => Array.from(extensions.keys()),
    manifestFor: () => void 0,
    requestManifest: (id) => {
      void primeManifest(id);
    },
    isMobile: !!(libs.Bowser && libs.Bowser.mobile === true)
  });
  const getContext = () => {
    const ctx = contextHandle.get();
    refreshStubHost(ctx);
    return ctx;
  };
  const refreshStubHost = (ctx) => {
    try {
      stubHost.characters = ctx.characters;
      stubHost.chat = ctx.chat;
      stubHost.chatId = ctx.chatId;
      stubHost.this_chid = ctx.characterId;
      stubHost.name1 = ctx.name1;
      stubHost.name2 = ctx.name2;
      stubHost.main_api = ctx.mainApi;
      stubHost.mainApi = ctx.mainApi;
      stubHost.onlineStatus = ctx.onlineStatus;
      stubHost.isMobile = ctx.isMobile;
      stubHost.extension_settings = ctx.extensionSettings;
      stubHost.chat_metadata = ctx.chatMetadata;
    } catch (e) {
      console.error("[portable-tavern/st] \u5237\u65B0\u6869\u6A21\u5757\u5165\u53E3\u5931\u8D25", e);
    }
  };
  const primeManifest = async (id) => {
    try {
      const response = await fetch("/tavern-ext/" + encodeURIComponent(id) + "/manifest.json");
      if (!response.ok) return;
      const data = await response.json();
      if (data && typeof data === "object") contextHandle.cacheManifest(id, data);
    } catch {
    }
  };
  const syncMirror = (ctx) => {
    if (!skeleton) return;
    try {
      const mirror = {
        chat: Array.isArray(ctx.chat) ? ctx.chat : [],
        name1: ctx.name1,
        name2: ctx.name2,
        character: ctx.characters.length > 0 ? ctx.characters[0].data : null,
        chatMetadata: ctx.chatMetadata,
        mainApi: ctx.mainApi,
        onlineStatus: ctx.onlineStatus,
        chatRootId: "pt-chat-log"
      };
      syncChatMirror(skeleton, mirror, (html) => libs.DOMPurify.sanitize(html));
    } catch (e) {
      console.error("[portable-tavern/st] \u540C\u6B65 #chat \u955C\u50CF\u5931\u8D25", e);
    }
  };
  const pollMirror = () => {
    if (!installed) return;
    const ctx = getContext();
    syncMirror(ctx);
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const character = ctx.name2 || "";
    if (character !== seenCharacter) {
      const previous = seenCharacter;
      seenCharacter = character;
      seenChatLength = chat.length;
      seenChatId = ctx.chatId;
      if (previous !== "\0") {
        void emit(event_types.CHAT_CHANGED, ctx.chatId);
        void emit(event_types.CHAT_LOADED, ctx.chatId);
      } else if (character) {
        void emit(event_types.CHAT_CREATED, ctx.chatId);
      }
      return;
    }
    if (seenChatLength < 0) {
      seenChatLength = chat.length;
      return;
    }
    if (chat.length > seenChatLength) {
      const fresh = chat.slice(seenChatLength);
      seenChatLength = chat.length;
      for (let i = 0; i < fresh.length; i++) {
        const message = fresh[i];
        const index = chat.length - fresh.length + i;
        const isUser = message && message.is_user === true;
        void emit(isUser ? event_types.MESSAGE_SENT : event_types.MESSAGE_RECEIVED, index, "normal");
        void emit(isUser ? event_types.USER_MESSAGE_RENDERED : event_types.CHARACTER_MESSAGE_RENDERED, index, "normal");
      }
      return;
    }
    if (chat.length < seenChatLength) {
      seenChatLength = chat.length;
      void emit(event_types.CHAT_CHANGED, ctx.chatId);
      void emit(event_types.CHAT_LOADED, ctx.chatId);
    }
  };
  const startMirror = () => {
    stopMirror();
    seenChatLength = -1;
    seenCharacter = "\0";
    seenChatId = "";
    try {
      mirrorTimer = window.setInterval(() => {
        try {
          pollMirror();
        } catch (e) {
          console.error("[portable-tavern/st] \u955C\u50CF\u8F6E\u8BE2\u5F02\u5E38", e);
        }
      }, MIRROR_INTERVAL_MS);
    } catch (e) {
      reportError("\u542F\u52A8\u955C\u50CF\u8F6E\u8BE2\u5931\u8D25", e);
    }
  };
  const stopMirror = () => {
    if (mirrorTimer !== null) {
      try {
        window.clearInterval(mirrorTimer);
      } catch {
      }
      mirrorTimer = null;
    }
  };
  const setGlobal = (name, value, force) => {
    try {
      const win = window;
      const existing = win[name];
      if (!force && existing !== void 0 && existing !== null) {
        notifyOnce("global:" + name, "\u9875\u9762\u5DF2\u6709 window." + name + "\uFF0C\u517C\u5BB9\u5BBF\u4E3B\u4E0D\u8986\u76D6\u5B83");
        return;
      }
      if (!previousGlobals.has(name)) previousGlobals.set(name, existing);
      win[name] = value;
      if (ownedGlobals.indexOf(name) < 0) ownedGlobals.push(name);
    } catch (e) {
      reportError("\u6CE8\u5165\u5168\u5C40 " + name + " \u5931\u8D25", e);
    }
  };
  const restoreGlobals = () => {
    try {
      const win = window;
      for (const name of ownedGlobals) {
        const previous = previousGlobals.get(name);
        if (previous === void 0) {
          try {
            delete win[name];
          } catch {
            win[name] = void 0;
          }
        } else {
          win[name] = previous;
        }
      }
    } catch (e) {
      console.error("[portable-tavern/st] \u8FD8\u539F\u5168\u5C40\u5931\u8D25", e);
    }
    ownedGlobals.length = 0;
    previousGlobals.clear();
  };
  const buildStubHost = (toastr) => {
    const first = contextHandle.peek();
    Object.assign(stubHost, {
      eventSource,
      event_types,
      eventTypes: event_types,
      extension_settings: extensionSettings,
      extensionSettings,
      power_user: first.power_user,
      powerUser: first.powerUser,
      saveSettings: first.saveSettings,
      saveSettingsDebounced: first.saveSettingsDebounced,
      saveMetadata: persistMetadata,
      saveMetadataDebounced: first.saveMetadataDebounced,
      getRequestHeaders: first.getRequestHeaders,
      renderTemplateAsync: first.renderTemplateAsync,
      renderExtensionTemplateAsync: first.renderExtensionTemplateAsync,
      substituteParams: first.substituteParams,
      substituteParamsExtended: first.substituteParamsExtended,
      chat_metadata: chatMetadata,
      chatMetadata,
      isMobile: first.isMobile,
      DOMPurify: libs.DOMPurify,
      Bowser: libs.Bowser,
      accountStorage: first.accountStorage,
      SlashCommandParser: first.SlashCommandParser,
      SlashCommand: first.SlashCommand,
      ARGUMENT_TYPE,
      executeSlashCommands: first.executeSlashCommands,
      callGenericPopup,
      Popup: first.Popup,
      POPUP_TYPE,
      POPUP_RESULT,
      toastr,
      getContext: () => getContext(),
      libs,
      eventSourceVersion: "portable-tavern-st"
    });
    stubHost.getSlideToggleOptions = noopFunction();
    stubHost.initMovingUI = noopFunction();
    stubHost.favsToHotswap = noopFunction();
    stubHost.renderTemplate = first.renderTemplateAsync;
    refreshStubHost(first);
  };
  const installGlobals = () => {
    try {
      const jq = createJQuery(window, warn);
      setGlobal("$", jq, false);
      setGlobal("jQuery", jq, false);
    } catch (e) {
      reportError("\u8FF7\u4F60 jQuery \u6CE8\u5165\u5931\u8D25", e);
    }
    setGlobal("_", libs.lodash, false);
    setGlobal("lodash", libs.lodash, false);
    const toastr = {
      info: (message, title) => toast(joinTitle(title, message), "info"),
      success: (message, title) => toast(joinTitle(title, message), "success"),
      warning: (message, title) => toast(joinTitle(title, message), "warning"),
      error: (message, title) => toast(joinTitle(title, message), "error"),
      clear: () => {
        if (skeleton) {
          try {
            clearToasts(skeleton);
          } catch {
          }
        }
      }
    };
    setGlobal("toastr", toastr, true);
    setGlobal("__tavernStStub", (path) => "/api/dsh-portable-tavern/ext/stub?path=" + encodeURIComponent(String(path)), false);
    buildStubHost(toastr);
    setGlobal("__tavernSt", stubHost, true);
    setGlobal("SillyTavern", {
      libs,
      getContext: () => getContext(),
      eventSource,
      event_types,
      eventTypes: event_types,
      version: "portable-tavern-st"
    }, true);
  };
  const attributeError = (message) => {
    const load2 = activeLoad;
    if (!load2) return;
    const text = toStringValue(message);
    if (load2.errors.indexOf(text) < 0) load2.errors.push(text);
    if (isModuleImportError(text)) {
      const refs = extractModuleRefs(text);
      for (const ref of refs) if (load2.stubs.indexOf(ref) < 0) load2.stubs.push(ref);
      const exportMatch = /does not provide an export named '?([^'\s]+)'?/.exec(text);
      const detail = exportMatch ? "\u7F3A\u5C11\u5BFC\u51FA " + exportMatch[1] : refs.length > 0 ? "\u6A21\u5757 " + refs[0] : "\u4E0A\u6E38\u6A21\u5757";
      notifyOnce("import:" + load2.id + ":" + detail, "\u6269\u5C55 " + load2.id + " \u7684 import \u5931\u8D25\uFF1A" + detail + "\uFF08\u8BE5\u4E0A\u6E38\u6A21\u5757\u53EF\u80FD\u6CA1\u6709\u88AB stub\uFF0C\u529F\u80FD\u4F1A\u7F3A\u5931\uFF09");
    }
    if (load2.settled) load2.finish(false, "\u6269\u5C55\u8FD0\u884C\u671F\u5F02\u5E38\uFF1A" + text);
  };
  const onWindowError = (event) => {
    try {
      const error = event && event.error;
      const message = event && event.message || (error instanceof Error ? error.message : "") || "\u811A\u672C\u9519\u8BEF";
      attributeError(String(message));
    } catch (e) {
      console.error("[portable-tavern/st] error \u76D1\u542C\u5F02\u5E38", e);
    }
  };
  const onWindowRejection = (event) => {
    try {
      const reason = event ? event.reason : void 0;
      const message = reason instanceof Error ? reason.message : toStringValue(reason);
      attributeError(message || "\u672A\u5904\u7406\u7684 Promise \u62D2\u7EDD");
    } catch (e) {
      console.error("[portable-tavern/st] unhandledrejection \u76D1\u542C\u5F02\u5E38", e);
    }
  };
  const loadStylesheet = (record, href) => {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => {
        if (!done) {
          done = true;
          resolve(ok);
        }
      };
      try {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = resolveUrl(href);
        link.dataset.tavernStExtension = record.id;
        link.addEventListener("load", () => finish(true));
        link.addEventListener("error", () => {
          warn("\u6269\u5C55 " + record.id + " \u7684\u6837\u5F0F\u8868\u52A0\u8F7D\u5931\u8D25\uFF1A" + href);
          finish(false);
        });
        document.head.appendChild(link);
        record.nodes.push(link);
        window.setTimeout(() => finish(true), LOAD_WINDOW_MS);
      } catch (e) {
        reportError("\u63D2\u5165\u6269\u5C55\u6837\u5F0F\u8868\u5931\u8D25", e);
        finish(false);
      }
    });
  };
  const loadScript = (record, src) => {
    return new Promise((resolve) => {
      let done = false;
      let graceTimer = null;
      let windowTimer = null;
      const settle = (ok, error) => {
        if (done) return;
        done = true;
        if (graceTimer !== null) {
          try {
            window.clearTimeout(graceTimer);
          } catch {
          }
        }
        if (windowTimer !== null) {
          try {
            window.clearTimeout(windowTimer);
          } catch {
          }
        }
        resolve({ ok, error });
      };
      const state = {
        id: record.id,
        errors: record.errors,
        stubs: record.stubs,
        settled: false,
        finish: (ok, error) => settle(ok, error)
      };
      activeLoad = state;
      const startGrace = () => {
        state.settled = true;
        graceTimer = window.setTimeout(() => {
          settle(record.errors.length > 0 ? false : true, record.errors.length > 0 ? record.errors[0] : void 0);
        }, LOAD_GRACE_MS);
      };
      try {
        const script = document.createElement("script");
        script.type = "module";
        script.src = resolveUrl(src);
        script.async = false;
        script.dataset.tavernStExtension = record.id;
        script.addEventListener("load", () => {
          if (record.errors.length > 0) {
            settle(false, record.errors[0]);
            return;
          }
          startGrace();
        });
        script.addEventListener("error", () => {
          const detail = record.errors.length > 0 ? record.errors[0] : "\u811A\u672C\u52A0\u8F7D\u5931\u8D25\uFF08404 / \u8BED\u6CD5\u9519\u8BEF / CSP \u62E6\u622A\uFF09\uFF1A" + src;
          settle(false, detail);
        });
        document.head.appendChild(script);
        record.nodes.push(script);
        windowTimer = window.setTimeout(() => {
          if (record.errors.length > 0) settle(false, record.errors[0]);
          else settle(true);
        }, LOAD_WINDOW_MS);
      } catch (e) {
        reportError("\u63D2\u5165\u6269\u5C55\u811A\u672C\u5931\u8D25", e);
        settle(false, "\u63D2\u5165\u811A\u672C\u5931\u8D25\uFF1A" + String(e instanceof Error ? e.message : e));
      }
    });
  };
  const loadOne = async (ext) => {
    const id = toStringValue(ext && ext.id);
    if (!id) return { ok: false, error: "\u7F3A\u5C11\u6269\u5C55 id", stubs: [] };
    if (!installed) return { ok: false, error: "\u517C\u5BB9\u5BBF\u4E3B\u5C1A\u672A install()\uFF0C\u65E0\u6CD5\u52A0\u8F7D\u6269\u5C55", stubs: [] };
    if (extensions.has(id)) unload(id);
    const record = {
      id,
      source: { id, js: toStringValue(ext.js), css: toStringValue(ext.css), base: toStringValue(ext.base) },
      nodes: [],
      mountSnapshot: captureMounts(),
      domNodes: [],
      errors: [],
      stubs: [],
      loadedAt: Date.now()
    };
    extensions.set(id, record);
    eventSource.beginScope(id);
    watcher.begin(id);
    let ok = true;
    let error;
    try {
      if (record.source.css) {
        const cssOk = await loadStylesheet(record, record.source.css);
        if (!cssOk) warn("\u6269\u5C55 " + id + " \u7684\u6837\u5F0F\u8868\u6CA1\u52A0\u8F7D\u6210\u529F\uFF08\u811A\u672C\u7EE7\u7EED\uFF09");
      }
      if (!installed || extensions.get(id) !== record) {
        return { ok: false, error: "\u52A0\u8F7D\u8FC7\u7A0B\u4E2D\u5BBF\u4E3B\u88AB dispose", stubs: record.stubs.slice() };
      }
      if (record.source.js) {
        const result = await loadScript(record, record.source.js);
        ok = result.ok;
        error = result.error;
      }
    } catch (e) {
      ok = false;
      error = "\u52A0\u8F7D\u5F02\u5E38\uFF1A" + String(e instanceof Error ? e.message : e);
      reportError("\u52A0\u8F7D\u6269\u5C55 " + id + " \u5931\u8D25", e);
    } finally {
      activeLoad = null;
      watcher.end();
      eventSource.endScope();
      record.domNodes = watcher.nodesOf(id).slice();
      watcher.forget(id);
    }
    if (!ok) warn("\u6269\u5C55 " + id + " \u52A0\u8F7D\u5931\u8D25\uFF1A" + (error || "\u672A\u77E5\u539F\u56E0"));
    else if (record.errors.length > 0) warn("\u6269\u5C55 " + id + " \u52A0\u8F7D\u5B8C\u6210\uFF0C\u4F46\u6355\u83B7\u5230 " + record.errors.length + " \u6761\u5F02\u5E38");
    return { ok, error, stubs: record.stubs.slice() };
  };
  const unload = (id) => {
    const key = toStringValue(id);
    const record = extensions.get(key);
    if (!record) return;
    extensions.delete(key);
    try {
      const removedListeners = eventSource.removeByOwner(key);
      let removedNodes = 0;
      for (const node of record.nodes) {
        try {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
            removedNodes += 1;
          }
        } catch {
        }
      }
      removedNodes += removeHeadBodyNodes(record.domNodes);
      for (const node of addedChildrenSince(record.mountSnapshot)) {
        try {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
            removedNodes += 1;
          }
        } catch {
        }
      }
      if (skeleton) skeleton.chatSignature = "";
      try {
        window.dispatchEvent(new CustomEvent("tavern_st_unload", { detail: { id: key } }));
      } catch {
      }
      console.info("[portable-tavern/st] \u5DF2\u5378\u8F7D\u6269\u5C55 " + key + "\uFF08\u6CE8\u9500\u76D1\u542C\u5668 " + removedListeners + " \u4E2A\uFF0C\u79FB\u9664\u8282\u70B9 " + removedNodes + " \u4E2A\uFF09");
    } catch (e) {
      reportError("\u5378\u8F7D\u6269\u5C55 " + key + " \u65F6\u51FA\u9519", e);
    }
  };
  const emit = async (event, ...args) => {
    if (typeof event !== "string" || !event) return;
    try {
      if (event === event_types.MESSAGE_RECEIVED || event === event_types.USER_MESSAGE_RENDERED || event === event_types.CHARACTER_MESSAGE_RENDERED || event === event_types.MESSAGE_SENT) {
        const ctx = getContext();
        syncMirror(ctx);
        if (Array.isArray(ctx.chat)) seenChatLength = ctx.chat.length;
      }
      await eventSource.emit(event, ...args);
    } catch (e) {
      reportError("\u6D3E\u53D1\u4E8B\u4EF6 " + event + " \u5931\u8D25", e);
    }
  };
  const emitInitialEvents = async () => {
    const sequence = [
      [event_types.SETTINGS_LOADED_BEFORE, []],
      [event_types.SETTINGS_LOADED, []],
      [event_types.SETTINGS_LOADED_AFTER, []],
      [event_types.EXTENSION_SETTINGS_LOADED, []],
      [event_types.EXTENSIONS_FIRST_LOAD, []],
      [event_types.MAIN_API_CHANGED, ["dsh"]],
      [event_types.ONLINE_STATUS_CHANGED, ["online"]],
      [event_types.APP_INITIALIZED, []],
      [event_types.APP_READY, []]
    ];
    for (const entry of sequence) {
      if (!installed) return;
      try {
        await eventSource.emit(entry[0], ...entry[1]);
      } catch (e) {
        console.error("[portable-tavern/st] \u542F\u52A8\u4E8B\u4EF6\u6D3E\u53D1\u5931\u8D25: " + entry[0], e);
      }
    }
  };
  const install = (next) => {
    options = next;
    if (installed) return;
    if (typeof document === "undefined" || !document.body) {
      reportError("\u5B89\u88C5\u517C\u5BB9\u5BBF\u4E3B\u5931\u8D25", new Error("\u6CA1\u6709 document.body"));
      return;
    }
    installed = true;
    try {
      skeleton = installSkeleton({
        onSend: (text) => {
          try {
            if (options) options.onSend(text);
          } catch (e) {
            reportError("onSend \u56DE\u8C03\u5F02\u5E38", e);
          }
        },
        onWarn: warn
      });
    } catch (e) {
      reportError("\u521B\u5EFA DOM \u9AA8\u67B6\u5931\u8D25\uFF08\u6269\u5C55\u6302\u8F7D\u70B9\u4E0D\u53EF\u7528\uFF09", e);
      skeleton = null;
    }
    try {
      installGlobals();
    } catch (e) {
      reportError("\u6CE8\u5165\u517C\u5BB9\u5168\u5C40\u5931\u8D25", e);
    }
    try {
      window.addEventListener("error", onWindowError);
    } catch (e) {
      reportError("\u6CE8\u518C window error \u76D1\u542C\u5931\u8D25", e);
    }
    try {
      window.addEventListener("unhandledrejection", onWindowRejection);
    } catch (e) {
      reportError("\u6CE8\u518C unhandledrejection \u76D1\u542C\u5931\u8D25", e);
    }
    startMirror();
    try {
      const ctx = getContext();
      syncMirror(ctx);
      seenChatLength = Array.isArray(ctx.chat) ? ctx.chat.length : 0;
    } catch (e) {
      reportError("\u9996\u6B21\u540C\u6B65\u955C\u50CF\u5931\u8D25", e);
    }
    window.setTimeout(() => {
      void emitInitialEvents();
    }, 0);
  };
  const load = (ext) => {
    const run = loadChain.then(() => loadOne(ext), () => loadOne(ext));
    loadChain = run.then(() => void 0, () => void 0);
    return run;
  };
  const setThemeVars = (css2) => {
    if (!skeleton) return;
    try {
      applyThemeVars(skeleton, css2);
    } catch (e) {
      reportError("\u5199\u5165\u4E3B\u9898\u53D8\u91CF\u5931\u8D25", e);
    }
  };
  const loaded = () => Array.from(extensions.keys());
  const dispose = () => {
    const wasInstalled = installed;
    installed = false;
    stopMirror();
    for (const id of Array.from(extensions.keys())) unload(id);
    try {
      window.removeEventListener("error", onWindowError);
    } catch {
    }
    try {
      window.removeEventListener("unhandledrejection", onWindowRejection);
    } catch {
    }
    activeLoad = null;
    restoreGlobals();
    try {
      const win = window;
      if (win.__tavernSt === stubHost) delete win.__tavernSt;
    } catch {
    }
    if (skeleton) {
      try {
        disposeSkeleton(skeleton);
      } catch (e) {
        reportError("\u62C6\u9664 DOM \u9AA8\u67B6\u5931\u8D25", e);
      }
      skeleton = null;
    }
    options = null;
    seenChatLength = -1;
    seenCharacter = "\0";
    seenChatId = "";
    if (wasInstalled) console.info("[portable-tavern/st] \u517C\u5BB9\u5BBF\u4E3B\u5DF2\u5378\u8F7D");
  };
  return { install, load, unload, emit, setThemeVars, toast, loaded, dispose };
}
function joinTitle(title, message) {
  const text = toStringValue(message);
  const head = toStringValue(title);
  return head ? head + "\uFF1A" + text : text;
}

// src/client/PortableTavern.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var RACES = ["\u4EBA\u7C7B", "\u7CBE\u7075", "\u517D\u4EBA", "\u673A\u68B0", "\u5929\u4F7F", "\u6076\u9B54", "\u9F99\u65CF", "\u534A\u517D\u4EBA", "\u5438\u8840\u9B3C", "\u4EBA\u9C7C", "\u81EA\u5B9A\u4E49"];
var JOBS = ["\u6218\u58EB", "\u6CD5\u5E08", "\u76D7\u8D3C", "\u7267\u5E08", "\u541F\u6E38\u8BD7\u4EBA", "\u5546\u4EBA", "\u5DE5\u5320", "\u730E\u4EBA", "\u9A91\u58EB", "\u5B66\u8005", "\u81EA\u5B9A\u4E49"];
var BUILDS = ["\u7EA4\u7EC6", "\u5300\u79F0", "\u5065\u58EE", "\u4E30\u6EE1"];
var HAIR_STYLES = ["\u77ED\u53D1", "\u4E2D\u53D1", "\u957F\u53D1", "\u5377\u53D1", "\u624E\u53D1", "\u9A6C\u5C3E", "\u53CC\u9A6C\u5C3E", "\u5149\u5934", "\u53CA\u80A9", "\u76D8\u53D1"];
var HAIR_COLORS = ["#1a1a1a", "#5a3a1a", "#8b5a2b", "#c19a6b", "#e6c48c", "#ffd700", "#b22222", "#8b0000", "#4b0082", "#2e8b57", "#1e90ff", "#f5f5f5"];
var EYE_COLORS = ["#1a1a1a", "#5a3a1a", "#8b5a2b", "#2e8b57", "#1e90ff", "#4a90d9", "#8a2be2", "#b22222", "#ff8c00", "#808080", "#e63946", "#20b2aa"];
var SKIN_COLORS = ["#f2c9a0", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#ffe0bd", "#f1c27d", "#a47551", "#7d5a3c", "#3b2a1a"];
var FEATURES = ["\u75A4\u75D5", "\u7EB9\u8EAB", "\u80CE\u8BB0", "\u4E49\u80A2", "\u89D2", "\u7FC5\u8180", "\u5C3E\u5DF4", "\u517D\u8033", "\u5F02\u8272\u77B3", "\u9762\u7EB1", "\u9762\u5177", "\u9970\u54C1"];
var TRAITS = ["\u52C7\u6562", "\u72E1\u8BC8", "\u5FE0\u8BDA", "\u53DB\u9006", "\u6E29\u67D4", "\u6BD2\u820C", "\u5E7D\u9ED8", "\u5FE7\u90C1", "\u50B2\u6162", "\u8C26\u900A", "\u5929\u771F", "\u4E16\u6545", "\u51B7\u9759", "\u51B2\u52A8", "\u597D\u5947", "\u8C28\u614E"];
var ABILITIES = ["\u5251\u672F", "\u9B54\u6CD5", "\u6F5C\u884C", "\u8BF4\u670D", "\u70BC\u91D1", "\u9A6F\u517D", "\u5DE5\u7A0B", "\u533B\u672F", "\u5360\u535C", "\u70F9\u996A", "\u97F3\u4E50", "\u9A91\u672F", "\u7BAD\u672F", "\u683C\u6597", "\u8FFD\u8E2A", "\u5916\u4EA4"];
var ORIGINS = ["\u8D35\u65CF", "\u5E73\u6C11", "\u6D41\u6D6A\u8005", "\u88AB\u9057\u5FD8\u8005", "\u5B64\u513F", "\u6218\u58EB\u4E16\u5BB6", "\u5546\u4EBA\u4E4B\u5BB6", "\u5B97\u6559\u4E16\u5BB6", "\u7687\u65CF", "\u9690\u4E16\u5BB6\u65CF"];
var DIALOG_STYLES = ["\u6B63\u5F0F\u5178\u96C5", "\u968F\u6027\u53E3\u8BED", "\u53E4\u98CE\u6587\u8A00", "\u79D1\u5E7B\u672F\u8BED", "\u840C\u7CFB\u53EF\u7231", "\u6697\u9ED1\u54E5\u7279"];
var TONES = ["\u6E29\u67D4", "\u5F3A\u52BF", "\u620F\u8C11", "\u51B7\u6DE1", "\u70ED\u60C5", "\u795E\u79D8"];
var SCENE_TEMPLATES = ["\u9152\u9986", "\u68EE\u6797", "\u57CE\u5821", "\u592A\u7A7A\u7AD9", "\u5B66\u9662", "\u5730\u4E0B\u57CE", "\u5BAB\u5EF7", "\u6218\u573A", "\u6D77\u8FB9\u5C0F\u9547", "\u5E9F\u589F\u90FD\u5E02"];
var OPENER_STYLES = ["\u7B80\u77ED", "\u8BE6\u7EC6", "\u8BD7\u610F", "\u884C\u52A8\u6D3E"];
var GENDERS = [{ value: "\u7537", label: "\u7537" }, { value: "\u5973", label: "\u5973" }, { value: "\u975E\u4E8C\u5143", label: "\u975E\u4E8C\u5143" }, { value: "\u5176\u4ED6", label: "\u5176\u4ED6" }];
var PERSON_OPTS = [{ value: "first", label: "\u7B2C\u4E00\u4EBA\u79F0\uFF08\u6211\uFF09" }, { value: "third", label: "\u7B2C\u4E09\u4EBA\u79F0\uFF08\u5979/\u4ED6\uFF09" }];
var RACE_OPTS = RACES.map((r) => ({ value: r, label: r }));
var JOB_OPTS = JOBS.map((j) => ({ value: j, label: j }));
var STYLE_OPTS = DIALOG_STYLES.map((s) => ({ value: s, label: s }));
var DEFAULT_SPEC = {
  basic: { name: "", age: 24, ageUnknown: false, gender: "\u5973", race: "\u4EBA\u7C7B", raceCustom: "", job: "\u6CD5\u5E08", jobCustom: "" },
  appearance: { height: 165, heightUnit: "cm", build: "\u5300\u79F0", hairColor: "#8b5a2b", hairStyle: "\u957F\u53D1", eyeColor: "#1e90ff", skinColor: "#f2c9a0", features: [] },
  personality: { extroversion: 5, agreeableness: 6, conscientiousness: 5, stability: 5, openness: 7, traits: [] },
  background: { origin: "", experience: "", world: "" },
  abilities: [],
  dialogue: { style: "\u968F\u6027\u53E3\u8BED", tone: "\u6E29\u67D4", person: "first" },
  scenario: { scene: "", sceneTemplate: "", openerStyle: "\u7B80\u77ED" }
};
function cleanPlaceholders2(s, name) {
  return String(s ?? "").split("{{char}}").join(name || "\u89D2\u8272").split("{{user}}").join("\u4F60");
}
function makeStore(initial3) {
  let value = initial3;
  const listeners = /* @__PURE__ */ new Set();
  return {
    get: () => value,
    set: (v) => {
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    }
  };
}
function useStoreValue(store) {
  const [v, setV] = (0, import_react7.useState)(store.get());
  (0, import_react7.useEffect)(() => store.subscribe(() => setV(store.get())), [store]);
  return v;
}
var DEFAULT_BG_OPACITY = 0.16;
function loadTavernSettings() {
  try {
    const raw = localStorage.getItem("dsh.portable-tavern.settings.v1");
    const s = raw ? JSON.parse(raw) : {};
    return {
      width: s.width || 540,
      accent: s.accent || "#4f7cff",
      showTrigger: s.showTrigger !== false,
      bgOpacity: typeof s.bgOpacity === "number" ? Math.min(0.7, Math.max(0, s.bgOpacity)) : DEFAULT_BG_OPACITY
    };
  } catch {
    return { width: 540, accent: "#4f7cff", showTrigger: true, bgOpacity: DEFAULT_BG_OPACITY };
  }
}
function saveTavernSettings(s) {
  try {
    localStorage.setItem("dsh.portable-tavern.settings.v1", JSON.stringify(s));
  } catch {
  }
}
var triggerStore = makeStore(loadTavernSettings().showTrigger);
function setTriggerVisible(value) {
  triggerStore.set(value);
  const s = loadTavernSettings();
  saveTavernSettings({ ...s, showTrigger: value });
}
function loadBgImage() {
  try {
    return localStorage.getItem("dsh.portable-tavern.bgimage.v1") || "";
  } catch {
    return "";
  }
}
function saveBgImage(v) {
  try {
    if (v) localStorage.setItem("dsh.portable-tavern.bgimage.v1", v);
    else localStorage.removeItem("dsh.portable-tavern.bgimage.v1");
  } catch {
  }
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
var MUSIC_KEY = "dsh.portable-tavern.music.v1";
function loadMusicState() {
  const saved = readPref(MUSIC_KEY, {});
  return {
    index: typeof saved.index === "number" && saved.index >= 0 ? saved.index : 0,
    position: typeof saved.position === "number" && saved.position >= 0 ? saved.position : 0,
    playing: saved.playing === true
  };
}
function saveMusicState(state) {
  writePref(MUSIC_KEY, state);
}
var THREADS_KEY = "dsh.portable-tavern.threads.v1";
function loadMemberThreads() {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== "object" || parsed === null) return {};
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}
var EXT_ENABLED_KEY = "dsh.portable-tavern.ext.enabled.v1";
var EXT_THEME_KEY = "dsh.portable-tavern.ext.theme.v1";
function loadEnabledExt() {
  try {
    const raw = localStorage.getItem(EXT_ENABLED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function saveEnabledExt(list) {
  try {
    localStorage.setItem(EXT_ENABLED_KEY, JSON.stringify(list));
  } catch {
  }
}
function loadActiveTheme() {
  try {
    return localStorage.getItem(EXT_THEME_KEY) ?? "";
  } catch {
    return "";
  }
}
function saveActiveTheme(id) {
  try {
    if (id === "") localStorage.removeItem(EXT_THEME_KEY);
    else localStorage.setItem(EXT_THEME_KEY, id);
  } catch {
  }
}
function loadTemplates() {
  try {
    const raw = localStorage.getItem("dsh.portable-tavern.templates.v1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveTemplates(list) {
  try {
    localStorage.setItem("dsh.portable-tavern.templates.v1", JSON.stringify(list));
  } catch {
  }
}
var WS_KEY = "dsh.portable-tavern.workspace.v1";
var CHARS_KEY = "dsh.portable-tavern.characters.v1";
function loadWorkspace() {
  try {
    const raw = localStorage.getItem(WS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function loadCharacters() {
  try {
    const raw = localStorage.getItem(CHARS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function musicDb() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open("dsh-portable-tavern-music", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("tracks")) req.result.createObjectStore("tracks", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}
function saveMusic(list) {
  void musicDb().then((db) => {
    try {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      store.clear();
      for (const t of list) store.put({ id: t.id, name: t.name, blob: t.blob });
    } catch {
    }
  }).catch(() => void 0);
}
function loadMusic() {
  return musicDb().then((db) => new Promise((resolve) => {
    try {
      const req = db.transaction("tracks", "readonly").objectStore("tracks").getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  })).catch(() => []);
}
function bytesToAscii(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}
function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function decodePngChara(bytes) {
  try {
    if (bytes.length < 8) return null;
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
    let off = 8;
    while (off + 8 <= bytes.length) {
      const len = bytes[off] << 24 | bytes[off + 1] << 16 | bytes[off + 2] << 8 | bytes[off + 3];
      const type = bytesToAscii(bytes.subarray(off + 4, off + 8));
      const dataStart = off + 8;
      const dataEnd = dataStart + len;
      if (dataEnd > bytes.length) break;
      if (type === "tEXt") {
        const data = bytes.subarray(dataStart, dataEnd);
        let nul = -1;
        for (let i = 0; i < data.length; i++) if (data[i] === 0) {
          nul = i;
          break;
        }
        if (nul >= 0) {
          const keyword = bytesToAscii(data.subarray(0, nul));
          if (keyword === "chara") return bytesToAscii(data.subarray(nul + 1));
        }
      }
      if (type === "IEND") break;
      off = dataEnd + 4;
    }
    return null;
  } catch {
    return null;
  }
}
function normalizeWorldbook(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object" && "entries" in obj) {
    const entries = obj.entries;
    if (Array.isArray(entries)) return entries;
    if (entries && typeof entries === "object") return Object.values(entries);
  }
  return [];
}
function avatarGradient2(spec) {
  const a = spec.appearance;
  return "linear-gradient(135deg," + (a.hairColor || "#8b5a2b") + "," + (a.skinColor || "#f2c9a0") + ")";
}
function fileToAvatar2(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result);
    const img = new Image();
    img.onload = () => {
      try {
        const max = 256;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) {
          cb(src);
          return;
        }
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext("2d");
        if (!g) {
          cb(src);
          return;
        }
        g.drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        cb(src);
      }
    };
    img.onerror = () => cb(src);
    img.src = src;
  };
  reader.onerror = () => cb("");
  reader.readAsDataURL(file);
}
function describeSpec(spec) {
  const b = spec.basic;
  const a = spec.appearance;
  const p = spec.personality;
  const bg = spec.background;
  const d = spec.dialogue;
  const sc = spec.scenario;
  const lines = [];
  lines.push("- \u540D\u79F0\uFF1A" + (b.name || "\u672A\u547D\u540D"));
  lines.push("- \u5E74\u9F84\uFF1A" + (b.ageUnknown ? "\u672A\u77E5/\u6C38\u751F" : b.age + " \u5C81"));
  lines.push("- \u6027\u522B\uFF1A" + b.gender);
  lines.push("- \u79CD\u65CF\uFF1A" + (b.race === "\u81EA\u5B9A\u4E49" ? b.raceCustom || "\u81EA\u5B9A\u4E49" : b.race));
  lines.push("- \u804C\u4E1A\uFF1A" + (b.job === "\u81EA\u5B9A\u4E49" ? b.jobCustom || "\u81EA\u5B9A\u4E49" : b.job));
  lines.push("- \u5916\u8C8C\uFF1A" + a.height + (a.heightUnit === "ft" ? "\u82F1\u5C3A" : "cm") + " \xB7 " + a.build + " \xB7 " + a.hairColor + "\u53D1 \xB7 " + a.hairStyle + " \xB7 " + a.eyeColor + "\u77B3");
  if (a.features.length) lines.push("- \u7279\u5F81\uFF1A" + a.features.join("\u3001"));
  lines.push("- \u6027\u683C\u4E94\u7EF4\uFF1A\u5916\u5411 " + p.extroversion + " / \u53CB\u5584 " + p.agreeableness + " / \u5C3D\u8D23 " + p.conscientiousness + " / \u7A33\u5B9A " + p.stability + " / \u5F00\u653E " + p.openness);
  if (p.traits.length) lines.push("- \u5173\u952E\u8BCD\uFF1A" + p.traits.join("\u3001"));
  if (bg.origin) lines.push("- \u51FA\u8EAB\uFF1A" + bg.origin);
  if (bg.experience) lines.push("- \u7ECF\u5386\uFF1A" + bg.experience);
  if (bg.world) lines.push("- \u4E16\u754C\uFF1A" + bg.world);
  if (spec.abilities.length) lines.push("- \u80FD\u529B\uFF1A" + spec.abilities.join("\u3001"));
  lines.push("- \u5BF9\u8BDD\uFF1A" + d.style + " \xB7 " + d.tone + " \xB7 " + (d.person === "third" ? "\u7B2C\u4E09\u4EBA\u79F0" : "\u7B2C\u4E00\u4EBA\u79F0"));
  if (sc.scene || sc.sceneTemplate) lines.push("- \u573A\u666F\uFF1A" + (sc.scene || sc.sceneTemplate));
  return lines.join("\n");
}
var TABS = [
  { id: "character", label: "\u89D2\u8272\u5361", title: "\u5851\u9020 / \u5BFC\u5165\u89D2\u8272\u5361" },
  { id: "chat", label: "\u804A\u5929", title: "\u4E0E\u89D2\u8272\u5355\u72EC\u5BF9\u8BDD" },
  { id: "rpg", label: "\u5192\u9669", title: "\u8DD1\u56E2\u6A21\u5F0F\uFF1A\u7CFB\u7EDF\u5224\u5B9A\uFF0CAI \u53D9\u8FF0" },
  { id: "party", label: "\u961F\u4F0D", title: "\u961F\u4F0D\u4E0E\u6BCF\u4E2A\u6210\u5458\u7684\u72EC\u7ACB\u6A21\u578B" },
  { id: "plugins", label: "\u63D2\u4EF6", title: "\u9152\u9986\u6269\u5C55\u4E0E\u7F8E\u5316\u4E3B\u9898" },
  { id: "settings", label: "\u8BBE\u7F6E", title: "\u5916\u89C2\u3001\u6A21\u578B\u63A5\u5165\u3001\u91C7\u6837\u4E0E\u97F3\u4E50" }
];
function CardPreview(props) {
  const d = props.card.data;
  const items = [
    ["description", "\u63CF\u8FF0"],
    ["personality", "\u6027\u683C"],
    ["scenario", "\u573A\u666F"],
    ["first_mes", "\u9996\u6761\u95EE\u5019"],
    ["mes_example", "\u793A\u4F8B\u5BF9\u8BDD"],
    ["creator_notes", "\u521B\u4F5C\u8005\u5907\u6CE8"],
    ["system_prompt", "\u7CFB\u7EDF\u63D0\u793A"]
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stCardPreview, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stCardHead, children: [
      props.avatar ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("img", { className: css.stCardAvatar, src: props.avatar, alt: d.name }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stCardName, children: d.name || "\u672A\u547D\u540D\u89D2\u8272" })
    ] }),
    d.tags.length ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stCardTags, children: d.tags.map((t) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: css.stCardTag, children: t }, t)) }) : null,
    items.map(([key, label]) => {
      const v = d[key];
      if (!v) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stCardBlock, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stCardBlockLabel, children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stCardBlockText, children: v })
      ] }, key);
    }),
    d.alternate_greetings.length ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stCardBlock, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stCardBlockLabel, children: "\u66FF\u4EE3\u95EE\u5019" }),
      d.alternate_greetings.map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stCardBlockText, children: g }, i))
    ] }) : null
  ] });
}
function PortableTavern(props) {
  const api = (0, import_react7.useState)(() => new TavernApi())[0];
  const [ws] = (0, import_react7.useState)(loadWorkspace);
  const [spec, setSpec] = (0, import_react7.useState)(() => ws.spec ?? DEFAULT_SPEC);
  const [card, setCard] = (0, import_react7.useState)(() => ws.card ?? null);
  const [version, setVersion] = (0, import_react7.useState)(() => ws.version ?? "v2");
  const [generating, setGenerating] = (0, import_react7.useState)(false);
  const [error, setError] = (0, import_react7.useState)("");
  const [fallback, setFallback] = (0, import_react7.useState)(false);
  const [rawText, setRawText] = (0, import_react7.useState)("");
  const [charTab, setCharTab] = (0, import_react7.useState)("preview");
  const [jsonDraft, setJsonDraft] = (0, import_react7.useState)("");
  const [worldbook, setWorldbook] = (0, import_react7.useState)(() => ws.worldbook ?? null);
  const [wbGenerating, setWbGenerating] = (0, import_react7.useState)(false);
  const [wbError, setWbError] = (0, import_react7.useState)("");
  const [templates, setTemplates] = (0, import_react7.useState)(loadTemplates);
  const [templateName, setTemplateName] = (0, import_react7.useState)("");
  const [tab, setTab] = (0, import_react7.useState)("character");
  const [chatMessages, setChatMessages] = (0, import_react7.useState)(() => ws.chat ?? []);
  const [chatInput, setChatInput] = (0, import_react7.useState)("");
  const [chatSending, setChatSending] = (0, import_react7.useState)(false);
  const [chatError, setChatError] = (0, import_react7.useState)("");
  const [modelOptions, setModelOptions] = (0, import_react7.useState)([]);
  const [chatModel, setChatModel] = (0, import_react7.useState)(() => ws.chatModel ?? "");
  const [globalPrompt, setGlobalPrompt] = (0, import_react7.useState)(() => ws.globalPrompt ?? "");
  const [avatar, setAvatar] = (0, import_react7.useState)(() => ws.avatar ?? "");
  const [savedChars, setSavedChars] = (0, import_react7.useState)(loadCharacters);
  const [tavern, setTavern] = (0, import_react7.useState)(loadTavernSettings);
  const [showTrigger, setShowTrigger] = (0, import_react7.useState)(() => triggerStore.get());
  const [llmDraft, setLlmDraft] = (0, import_react7.useState)(loadCustomLlm);
  const [sampling, setSampling] = (0, import_react7.useState)(loadSampling);
  const [llmTesting, setLlmTesting] = (0, import_react7.useState)(false);
  const [llmTestResult, setLlmTestResult] = (0, import_react7.useState)("");
  const [bgImage, setBgImage] = (0, import_react7.useState)(loadBgImage);
  const [playlist, setPlaylist] = (0, import_react7.useState)([]);
  const [currentIndex, setCurrentIndex] = (0, import_react7.useState)(-1);
  const [parties, setParties] = (0, import_react7.useState)(loadParties);
  const [party, setParty] = (0, import_react7.useState)(() => {
    const working = loadCurrentParty();
    if (working !== null) return working;
    const id = loadActivePartyId();
    const found = loadParties().find((p) => p.id === id);
    return found ?? makeParty();
  });
  const [rpg, setRpg] = (0, import_react7.useState)(() => loadRpgState() ?? makeRpgState());
  const stHost = (0, import_react7.useState)(() => createStHost())[0];
  const [extInstalled, setExtInstalled] = (0, import_react7.useState)([]);
  const [extBuiltin, setExtBuiltin] = (0, import_react7.useState)([]);
  const [extEnabled, setExtEnabled] = (0, import_react7.useState)(loadEnabledExt);
  const [extLog, setExtLog] = (0, import_react7.useState)([]);
  const [extTheme, setExtTheme] = (0, import_react7.useState)(loadActiveTheme);
  const [memberThreads, setMemberThreads] = (0, import_react7.useState)(loadMemberThreads);
  const [chatTarget, setChatTarget] = (0, import_react7.useState)("card");
  const [carryPlan, setCarryPlan] = (0, import_react7.useState)("");
  const [hydrated, setHydrated] = (0, import_react7.useState)(false);
  const [storageIssue, setStorageIssue] = (0, import_react7.useState)(null);
  const [storageUsage, setStorageUsage] = (0, import_react7.useState)(null);
  const audioRef = (0, import_react7.useRef)(null);
  const seekRef = (0, import_react7.useRef)(0);
  const positionRef = (0, import_react7.useRef)(0);
  const playingRef = (0, import_react7.useRef)(false);
  const wantPlayRef = (0, import_react7.useRef)(false);
  const loadingRef = (0, import_react7.useRef)(false);
  const indexRef = (0, import_react7.useRef)(0);
  const patch = (key, value) => setSpec((prev) => ({ ...prev, [key]: value }));
  const patchN = (section, key, value) => setSpec((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  const customConfigured = llmDraft.baseUrl.trim() !== "" && llmDraft.apiKey.trim() !== "" && llmDraft.model.trim() !== "";
  (0, import_react7.useEffect)(() => {
    void api.models().then((res) => {
      setModelOptions(res.options);
      if (!chatModel && res.current?.provider && res.current?.model) {
        setChatModel(res.current.provider + "::" + res.current.model);
      }
    }).catch(() => void 0);
  }, []);
  (0, import_react7.useEffect)(() => {
    void loadMusic().then((tracks) => {
      if (tracks.length === 0) return;
      setPlaylist(tracks.map((t) => ({ id: t.id, name: t.name, url: URL.createObjectURL(t.blob) })));
      const saved = loadMusicState();
      setCurrentIndex(Math.min(saved.index, tracks.length - 1));
      seekRef.current = saved.position;
      wantPlayRef.current = saved.playing;
    });
  }, []);
  (0, import_react7.useEffect)(() => {
    const el = document.getElementById("pt-chat-log");
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, chatSending]);
  (0, import_react7.useEffect)(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void saveRecord(HEAVY_KEYS.workspace, { spec, card, worldbook, chat: chatMessages, version, chatModel, globalPrompt, avatar });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [spec, card, worldbook, chatMessages, version, chatModel, globalPrompt, avatar, hydrated]);
  const liveRef = (0, import_react7.useRef)({ chat: [], card: null });
  liveRef.current = { chat: chatMessages, card };
  const stSendRef = (0, import_react7.useRef)(() => void 0);
  const pushExtLog = (message) => {
    setExtLog((prev) => [...prev.slice(-199), (/* @__PURE__ */ new Date()).toLocaleTimeString() + " " + message]);
  };
  const refreshExt = () => {
    void api.extList().then((res) => {
      setExtInstalled(res.installed);
      setExtBuiltin(res.builtin);
    }).catch((e) => pushExtLog("\u6269\u5C55\u5217\u8868\u8BFB\u53D6\u5931\u8D25\uFF1A" + (e instanceof Error ? e.message : String(e))));
  };
  (0, import_react7.useEffect)(() => {
    onStorageIssue(setStorageIssue);
    return () => onStorageIssue(null);
  }, []);
  (0, import_react7.useEffect)(() => {
    void storageEstimate().then(setStorageUsage);
  }, [storageIssue]);
  (0, import_react7.useEffect)(() => {
    indexRef.current = Math.max(0, currentIndex);
  }, [currentIndex]);
  (0, import_react7.useEffect)(() => {
    const retry = () => {
      const el = audioRef.current;
      if (el !== null && wantPlayRef.current && el.paused && el.getAttribute("src") !== null) {
        void el.play().catch(() => void 0);
      }
    };
    document.addEventListener("pointerdown", retry);
    document.addEventListener("keydown", retry);
    return () => {
      document.removeEventListener("pointerdown", retry);
      document.removeEventListener("keydown", retry);
    };
  }, []);
  (0, import_react7.useEffect)(() => {
    const el = audioRef.current;
    const item = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
    if (el === null || item === null) return;
    const seek = seekRef.current;
    const resume = wantPlayRef.current;
    seekRef.current = 0;
    loadingRef.current = true;
    const onMeta = () => {
      loadingRef.current = false;
      if (seek > 0 && Number.isFinite(el.duration) && seek < el.duration) {
        try {
          el.currentTime = seek;
        } catch {
        }
      }
      if (resume) void el.play().catch(() => void 0);
      el.removeEventListener("loadedmetadata", onMeta);
    };
    el.addEventListener("loadedmetadata", onMeta);
    el.src = item.url;
    el.load();
    return () => {
      loadingRef.current = false;
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [currentIndex, playlist]);
  (0, import_react7.useEffect)(() => {
    const timer = window.setInterval(() => {
      if (playingRef.current) {
        saveMusicState({ index: indexRef.current, position: positionRef.current, playing: true });
      }
    }, 5e3);
    return () => {
      window.clearInterval(timer);
      saveMusicState({ index: indexRef.current, position: positionRef.current, playing: playingRef.current });
    };
  }, []);
  (0, import_react7.useEffect)(() => {
    let cancelled = false;
    void (async () => {
      const [storedParty, storedParties, storedChars, storedThreads, storedRpg, storedWs] = await Promise.all([
        loadRecord(HEAVY_KEYS.party, HEAVY_KEYS.party),
        loadRecord(HEAVY_KEYS.parties, HEAVY_KEYS.parties),
        loadRecord(HEAVY_KEYS.characters, HEAVY_KEYS.characters),
        loadRecord(HEAVY_KEYS.threads, HEAVY_KEYS.threads),
        loadRecord(HEAVY_KEYS.rpg, HEAVY_KEYS.rpg),
        loadRecord(HEAVY_KEYS.workspace, HEAVY_KEYS.workspace)
      ]);
      if (cancelled) return;
      if (storedParty !== null) setParty(storedParty);
      if (storedParties !== null) setParties(storedParties);
      if (storedChars !== null) setSavedChars(storedChars);
      if (storedThreads !== null) setMemberThreads(storedThreads);
      if (storedRpg !== null) setRpg(storedRpg);
      if (storedWs !== null && storedWs.card !== void 0 && storedWs.card !== null) {
        setCard(storedWs.card);
        setWorldbook(storedWs.worldbook ?? null);
        setChatMessages(storedWs.chat ?? []);
        if (typeof storedWs.avatar === "string") setAvatar(storedWs.avatar);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  (0, import_react7.useEffect)(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void saveRecord(HEAVY_KEYS.rpg, rpg);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [rpg, hydrated]);
  (0, import_react7.useEffect)(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void saveRecord(HEAVY_KEYS.threads, memberThreads);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [memberThreads, hydrated]);
  (0, import_react7.useEffect)(() => {
    saveActivePartyId(party.id);
  }, [party.id]);
  (0, import_react7.useEffect)(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void saveRecord(HEAVY_KEYS.party, party);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [party, hydrated]);
  (0, import_react7.useEffect)(() => {
    refreshExt();
  }, []);
  (0, import_react7.useEffect)(() => {
    stHost.install({
      getContext: () => {
        const name = liveRef.current.card?.data.name ?? "";
        return {
          chat: liveRef.current.chat.map((m) => ({
            name: m.role === "user" ? "\u4F60" : name || "\u89D2\u8272",
            mes: m.content,
            is_user: m.role === "user",
            is_system: false,
            send_date: String(Date.now()),
            extra: {}
          })),
          name1: "\u4F60",
          name2: name,
          character: liveRef.current.card ? { ...liveRef.current.card.data } : null,
          chatMetadata: {},
          mainApi: "dsh",
          onlineStatus: "online",
          chatRootId: "pt-chat-log"
        };
      },
      onSend: (text) => stSendRef.current(text),
      onSettings: () => void 0,
      onWarn: (message) => {
        pushExtLog(message);
      }
    });
    pushExtLog("\u517C\u5BB9\u5BBF\u4E3B\u5DF2\u542F\u52A8\uFF08SillyTavern API \u517C\u5BB9\u5C42\u5C31\u7EEA\uFF09");
    return () => stHost.dispose();
  }, []);
  (0, import_react7.useEffect)(() => {
    const all = extBuiltin.concat(extInstalled);
    for (const ext of all) {
      const wanted = extEnabled.includes(ext.id);
      const loaded = stHost.loaded().includes(ext.id);
      if (!wanted && loaded) {
        stHost.unload(ext.id);
        continue;
      }
      if (!wanted || loaded) continue;
      void stHost.load({
        id: ext.id,
        js: ext.js === "" ? "" : ext.base + ext.js,
        css: ext.css === "" ? "" : ext.base + ext.css,
        base: ext.base
      }).then((res) => {
        if (res.ok) pushExtLog("\u5DF2\u52A0\u8F7D\u6269\u5C55\uFF1A" + ext.name);
        else pushExtLog("\u6269\u5C55\u52A0\u8F7D\u5931\u8D25\uFF1A" + ext.name + " \u2014 " + (res.error ?? "\u672A\u77E5\u539F\u56E0"));
        for (const stub of res.stubs) pushExtLog("  \xB7 \u5DF2\u7528\u7A7A\u5B9E\u73B0\u66FF\u4EE3\u9152\u9986\u5185\u90E8\u6A21\u5757\uFF1A" + stub);
      }).catch((e) => pushExtLog("\u6269\u5C55\u52A0\u8F7D\u5F02\u5E38\uFF1A" + ext.name + " \u2014 " + (e instanceof Error ? e.message : String(e))));
    }
  }, [extEnabled, extBuiltin, extInstalled]);
  (0, import_react7.useEffect)(() => {
    if (typeof document === "undefined") return;
    if (extTheme === "") delete document.documentElement.dataset.tavernTheme;
    else document.documentElement.dataset.tavernTheme = extTheme;
  }, [extTheme]);
  const onToggleExt = (id, on) => {
    setExtEnabled((prev) => {
      const next = on ? prev.includes(id) ? prev : [...prev, id] : prev.filter((x) => x !== id);
      saveEnabledExt(next);
      return next;
    });
  };
  const onTheme = (id) => {
    setExtTheme(id);
    saveActiveTheme(id);
    if (id === "") return;
    setExtEnabled((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveEnabledExt(next);
      return next;
    });
  };
  (0, import_react7.useEffect)(() => {
    stSendRef.current = (text) => onSend(text);
  });
  const onGenerate = () => {
    setGenerating(true);
    setError("");
    setFallback(false);
    setRawText("");
    void api.generate(spec, version).then((res) => {
      setCard(res.card);
      setFallback(res.fallback);
      setRawText(res.rawText);
      setCharTab("preview");
      const d = res.card.data;
      const greeting = cleanPlaceholders2(d.first_mes, d.name);
      setChatMessages(greeting ? [{ role: "assistant", content: greeting }] : []);
    }).catch((e) => setError(e instanceof Error ? e.message : "\u751F\u6210\u5931\u8D25")).finally(() => setGenerating(false));
  };
  const onWorldbook = (fromCard) => {
    setWbGenerating(true);
    setWbError("");
    void api.worldbook(spec, fromCard ? card : null).then((res) => {
      setWorldbook({ entries: res.entries });
      setCharTab("worldbook");
    }).catch((e) => setWbError(e instanceof Error ? e.message : "\u4E16\u754C\u4E66\u751F\u6210\u5931\u8D25")).finally(() => setWbGenerating(false));
  };
  const onSend = (override) => {
    const text = (override ?? chatInput).trim();
    if (!text || chatSending || !card) return;
    const parts = (chatModel || "").split("::");
    const isCustom = parts[0] === "custom";
    if (isCustom && !customConfigured) {
      setChatError("\u8BF7\u5148\u5230\u300C\u8BBE\u7F6E \u2192 \u6A21\u578B\u63A5\u5165\u300D\u586B\u5199\u81EA\u5B9A\u4E49\u63A5\u53E3\uFF08\u5730\u5740 / API Key / \u6A21\u578B\uFF09");
      setTab("settings");
      return;
    }
    const next = [...chatMessages, { role: "user", content: text }];
    setChatMessages(next);
    setChatInput("");
    setChatSending(true);
    setChatError("");
    const provider = isCustom ? "custom" : parts.length >= 2 && parts[0] ? parts[0] : void 0;
    const model = isCustom ? llmDraft.model : parts.length >= 2 ? parts.slice(1).join("::") : void 0;
    void api.chat(card, next, provider, model, globalPrompt).then((res) => {
      setChatMessages([...next, { role: "assistant", content: res.reply }]);
    }).catch((e) => setChatError(e instanceof Error ? e.message : "\u56DE\u590D\u5931\u8D25")).finally(() => setChatSending(false));
  };
  const onClearChat = () => {
    const g = card ? cleanPlaceholders2(card.data.first_mes, card.data.name) : "";
    setChatMessages(g ? [{ role: "assistant", content: g }] : []);
    setChatError("");
  };
  const updateTavern = (key, value) => {
    setTavern((prev) => {
      const n = { ...prev, [key]: value };
      saveTavernSettings(n);
      return n;
    });
  };
  const onToggleTrigger = (value) => {
    setShowTrigger(value);
    setTriggerVisible(value);
  };
  const onTestLlm = () => {
    const baseUrl = llmDraft.baseUrl.trim();
    const apiKey = llmDraft.apiKey.trim();
    const model = llmDraft.model.trim();
    if (baseUrl === "" || apiKey === "" || model === "") {
      setLlmTestResult("\u8BF7\u5148\u586B\u5199\u5B8C\u6574\uFF1A\u63A5\u53E3\u5730\u5740 / API Key / \u6A21\u578B\u540D\u79F0");
      return;
    }
    setLlmTesting(true);
    setLlmTestResult("");
    saveCustomLlm({ baseUrl, apiKey, model });
    setLlmDraft(loadCustomLlm());
    void api.test({ baseUrl, apiKey, model }).then((res) => {
      const temp = res.temperature ? "\uFF5C\u91C7\u6837\u6E29\u5EA6\uFF1A" + res.temperature : "";
      setLlmTestResult("\u8FDE\u63A5\u6210\u529F\uFF08" + res.latencyMs + "ms\uFF09\uFF1A" + res.reply + temp);
    }).catch((e) => setLlmTestResult("\u8FDE\u63A5\u5931\u8D25\uFF1A" + (e instanceof Error ? e.message : String(e)))).finally(() => setLlmTesting(false));
  };
  const onClearLlm = () => {
    clearCustomLlm();
    setLlmDraft(loadCustomLlm());
    setLlmTestResult("");
  };
  const onBgImageFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const u = String(reader.result);
      setBgImage(u);
      saveBgImage(u);
    };
    reader.readAsDataURL(file);
  };
  const onAvatarFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    fileToAvatar2(file, (dataUrl) => {
      if (dataUrl) setAvatar(dataUrl);
    });
  };
  const onClearAvatar = () => setAvatar("");
  const onMusicFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const t = { id: "t" + Date.now() + "-" + Math.floor(Math.random() * 1e5), name: file.name, url: URL.createObjectURL(file), blob: file };
    const list = [...playlist, t];
    setPlaylist(list);
    setCurrentIndex(list.length - 1);
    saveMusic(list.map((x) => ({ id: x.id, name: x.name, blob: x.blob })));
  };
  const onMusicFolder = (e) => {
    const files = Array.prototype.slice.call(e.target.files ?? []);
    e.target.value = "";
    const audioFiles = files.filter((f) => /\.(mp3|wav|ogg|m4a|flac|aac|opus|webm|mp4)$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
    if (!audioFiles.length) {
      setError("\u6587\u4EF6\u5939\u4E2D\u672A\u627E\u5230\u97F3\u9891\u6587\u4EF6");
      return;
    }
    const list = audioFiles.map((f, i) => ({ id: "t" + Date.now() + "-" + i, name: f.name, url: URL.createObjectURL(f), blob: f }));
    setPlaylist(list);
    setCurrentIndex(0);
    saveMusic(list.map((x) => ({ id: x.id, name: x.name, blob: x.blob })));
  };
  const nextTrack = () => {
    wantPlayRef.current = true;
    positionRef.current = 0;
    setCurrentIndex((i) => playlist.length ? (i + 1) % playlist.length : -1);
  };
  const prevTrack = () => {
    wantPlayRef.current = true;
    positionRef.current = 0;
    setCurrentIndex((i) => playlist.length ? (i - 1 + playlist.length) % playlist.length : -1);
  };
  const stopMusic = () => {
    wantPlayRef.current = false;
    playingRef.current = false;
    saveMusicState({ index: 0, position: 0, playing: false });
    setPlaylist([]);
    setCurrentIndex(-1);
    saveMusic([]);
  };
  const applyImportedCard = (obj) => {
    const cardObj = obj && typeof obj === "object" && "spec" in obj && "data" in obj ? obj : { spec: "chara_card_v2", spec_version: "2.0", data: obj };
    setCard(cardObj);
    setCharTab("preview");
    setError("");
    const ext = cardObj.data.extensions;
    if (ext && typeof ext.avatar === "string") setAvatar(ext.avatar);
    const greeting = cleanPlaceholders2(cardObj.data.first_mes, cardObj.data.name);
    setChatMessages(greeting ? [{ role: "assistant", content: greeting }] : []);
  };
  const onImportCardFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isPng = /\.png$/i.test(file.name) || file.type === "image/png";
    if (isPng) {
      const reader = new FileReader();
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result);
        const b64 = decodePngChara(bytes);
        if (!b64) {
          setError("PNG \u4E2D\u672A\u627E\u5230\u89D2\u8272\u5361\u6570\u636E\uFF08chara \u5757\uFF09");
          return;
        }
        try {
          applyImportedCard(JSON.parse(b64ToUtf8(b64)));
        } catch (err) {
          setError("\u89D2\u8272\u5361\u89E3\u6790\u5931\u8D25\uFF1A" + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          applyImportedCard(JSON.parse(String(reader.result)));
        } catch (err) {
          setError("\u89D2\u8272\u5361 JSON \u89E3\u6790\u5931\u8D25\uFF1A" + err.message);
        }
      };
      reader.readAsText(file);
    }
  };
  const onImportWorldbookFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const entries = normalizeWorldbook(JSON.parse(String(reader.result)));
        if (entries.length) {
          setWorldbook({ entries });
          setCharTab("worldbook");
          setWbError("");
        } else setWbError("\u672A\u627E\u5230\u4E16\u754C\u4E66\u6761\u76EE");
      } catch (err) {
        setWbError("\u4E16\u754C\u4E66\u89E3\u6790\u5931\u8D25\uFF1A" + err.message);
      }
    };
    reader.readAsText(file);
  };
  const onSaveTemplate = () => {
    const name = templateName.trim() || spec.basic.name || "\u6A21\u677F " + (templates.length + 1);
    const list = [...templates, { name, spec: JSON.parse(JSON.stringify(spec)) }];
    setTemplates(list);
    saveTemplates(list);
    setTemplateName("");
  };
  const onSaveCharacter = () => {
    if (!card) return;
    const name = card.data.name || "\u672A\u547D\u540D\u89D2\u8272";
    const entry = {
      id: "c" + Date.now() + "-" + Math.floor(Math.random() * 1e5),
      name,
      savedAt: Date.now(),
      card: JSON.parse(JSON.stringify(card)),
      worldbook: worldbook ? JSON.parse(JSON.stringify(worldbook)) : null,
      chat: JSON.parse(JSON.stringify(chatMessages)),
      avatar
    };
    const existing = savedChars.find((c) => c.name === name);
    const list = existing ? savedChars.map((c) => c.name === name ? entry : c) : [...savedChars, entry];
    setSavedChars(list);
    void saveRecord(HEAVY_KEYS.characters, list);
    setError("");
  };
  const onLoadCharacter = (c) => {
    setCard(JSON.parse(JSON.stringify(c.card)));
    setWorldbook(c.worldbook ? JSON.parse(JSON.stringify(c.worldbook)) : null);
    setChatMessages(JSON.parse(JSON.stringify(c.chat)));
    setAvatar(c.avatar || "");
    setCharTab("preview");
    setError("");
  };
  const onDeleteCharacter = (id) => {
    const list = savedChars.filter((c) => c.id !== id);
    setSavedChars(list);
    void saveRecord(HEAVY_KEYS.characters, list);
  };
  const onJoinParty = () => {
    const member = memberFromCard(card, spec, avatar, party.members.length);
    setParty({ ...party, members: [...party.members, member] });
    setChatTarget(member.id);
    setTab("party");
  };
  const onApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft);
      setCard("spec" in parsed && "data" in parsed ? parsed : { spec: version === "v3" ? "chara_card_v3" : "chara_card_v2", spec_version: version === "v3" ? "3.0" : "2.0", data: parsed });
      setError("");
    } catch (e) {
      setError("JSON \u89E3\u6790\u5931\u8D25\uFF1A" + e.message);
    }
  };
  const exportJson = () => {
    const base = card ?? { spec: version === "v3" ? "chara_card_v3" : "chara_card_v2", spec_version: version === "v3" ? "3.0" : "2.0", data: { name: spec.basic.name || "\u672A\u547D\u540D\u89D2\u8272", description: describeSpec(spec), personality: "", scenario: "", first_mes: "", mes_example: "", creator_notes: "", system_prompt: "", post_history_instructions: "", alternate_greetings: [], tags: [], creator: "dsh-portable-tavern", character_version: "1.0", extensions: {} } };
    const obj = JSON.parse(JSON.stringify(base));
    if (avatar) obj.data.extensions = { ...obj.data.extensions, avatar };
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    downloadFile((obj.data.name || "character") + ".json", blob);
  };
  const CARD_FIELDS = [
    { key: "name", label: "\u540D\u79F0", area: false },
    { key: "description", label: "\u63CF\u8FF0", area: true },
    { key: "personality", label: "\u6027\u683C", area: true },
    { key: "scenario", label: "\u573A\u666F", area: true },
    { key: "first_mes", label: "\u9996\u6761\u95EE\u5019", area: true },
    { key: "mes_example", label: "\u793A\u4F8B\u5BF9\u8BDD", area: true },
    { key: "creator_notes", label: "\u521B\u4F5C\u8005\u5907\u6CE8", area: true },
    { key: "system_prompt", label: "\u7CFB\u7EDF\u63D0\u793A", area: true },
    { key: "alternate_greetings", label: "\u66FF\u4EE3\u95EE\u5019\uFF08\u6BCF\u884C\u4E00\u6761\uFF09", area: true },
    { key: "tags", label: "\u6807\u7B7E\uFF08\u9017\u53F7\u5206\u9694\uFF09", area: false }
  ];
  const cardFieldValue = (key) => {
    const v = card?.data[key];
    if (Array.isArray(v)) return key === "tags" ? v.join(", ") : v.join("\n");
    return v ?? "";
  };
  const onCardFieldChange = (key, str) => {
    let value = str;
    if (key === "alternate_greetings") value = str.split("\n").map((s) => s.trim()).filter(Boolean);
    else if (key === "tags") value = str.split(",").map((s) => s.trim()).filter(Boolean);
    setCard((prev) => prev ? { ...prev, data: { ...prev.data, [key]: value } } : prev);
  };
  const secAvatar = /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Section, { title: "\u89D2\u8272\u5934\u50CF", hint: "\u81EA\u5B9A\u4E49\u804A\u5929\u5934\u50CF\uFF0C\u53EF\u9009", defaultOpen: true, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stAvatarRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stAvatarPreview, style: avatar ? void 0 : { background: avatarGradient2(spec) }, children: avatar ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("img", { className: css.stAvatarPreviewImg, src: avatar, alt: "\u5934\u50CF\u9884\u89C8" }) : (spec.basic.name || "?").slice(0, 1) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stAvatarActions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stBtn, children: [
        "\u4E0A\u4F20\u56FE\u7247",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: onAvatarFile })
      ] }),
      avatar ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: onClearAvatar, children: "\u6E05\u9664" }) : null
    ] })
  ] }) });
  const secBasic = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u4E00\u3001\u57FA\u7840\u4FE1\u606F", hint: "\u5FC5\u586B", defaultOpen: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u89D2\u8272\u540D\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, value: spec.basic.name, onChange: (e) => patchN("basic", "name", e.target.value), placeholder: "\u89D2\u8272\u7684\u552F\u4E00\u6807\u8BC6" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u5E74\u9F84", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Slider, { min: 10, max: 999, value: spec.basic.age, left: "10", right: "999", onChange: (v) => patchN("basic", "age", v) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "checkbox", checked: spec.basic.ageUnknown, onChange: (e) => patchN("basic", "ageUnknown", e.target.checked) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u672A\u77E5/\u6C38\u751F" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u6027\u522B", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(RadioGroup, { options: GENDERS, value: spec.basic.gender, onChange: (v) => patchN("basic", "gender", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Field, { label: "\u79CD\u65CF", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("select", { className: css.stInput, value: spec.basic.race, onChange: (e) => patchN("basic", "race", e.target.value), children: RACE_OPTS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: o.value, children: o.label }, o.value)) }),
      spec.basic.race === "\u81EA\u5B9A\u4E49" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, value: spec.basic.raceCustom, onChange: (e) => patchN("basic", "raceCustom", e.target.value), placeholder: "\u81EA\u5B9A\u4E49\u79CD\u65CF" }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Field, { label: "\u804C\u4E1A", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("select", { className: css.stInput, value: spec.basic.job, onChange: (e) => patchN("basic", "job", e.target.value), children: JOB_OPTS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: o.value, children: o.label }, o.value)) }),
      spec.basic.job === "\u81EA\u5B9A\u4E49" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, value: spec.basic.jobCustom, onChange: (e) => patchN("basic", "jobCustom", e.target.value), placeholder: "\u81EA\u5B9A\u4E49\u804C\u4E1A" }) : null
    ] })
  ] });
  const secAppearance = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u4E8C\u3001\u5916\u8C8C\u7279\u5F81", hint: "\u591A\u9009 + \u586B\u7A7A", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u8EAB\u9AD8", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Slider, { min: 120, max: 260, value: spec.appearance.height, left: "\u77EE\u5C0F", right: "\u9AD8\u5927", onChange: (v) => patchN("appearance", "height", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u4F53\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: BUILDS, values: spec.appearance.build, onChange: (v) => patchN("appearance", "build", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u53D1\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ColorSwatches, { palette: HAIR_COLORS, value: spec.appearance.hairColor, onChange: (v) => patchN("appearance", "hairColor", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u53D1\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: HAIR_STYLES, values: spec.appearance.hairStyle, onChange: (v) => patchN("appearance", "hairStyle", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u77B3\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ColorSwatches, { palette: EYE_COLORS, value: spec.appearance.eyeColor, onChange: (v) => patchN("appearance", "eyeColor", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u80A4\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ColorSwatches, { palette: SKIN_COLORS, value: spec.appearance.skinColor, onChange: (v) => patchN("appearance", "skinColor", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Field, { label: "\u663E\u8457\u7279\u5F81", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: FEATURES, values: spec.appearance.features, multiple: true, onChange: (v) => patchN("appearance", "features", v) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(CustomAdd, { values: spec.appearance.features, onAdd: (v) => patchN("appearance", "features", v), placeholder: "\u81EA\u5B9A\u4E49\u7279\u5F81\u2026" })
    ] })
  ] });
  const secPersonality = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u4E09\u3001\u6027\u683C\u4E0E\u884C\u4E3A", hint: "\u6ED1\u5757\u77E9\u9635 + \u5173\u952E\u8BCD", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u5916\u5411\u6027", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Slider, { min: 1, max: 10, value: spec.personality.extroversion, left: "\u5185\u5411", right: "\u5916\u5411", onChange: (v) => patchN("personality", "extroversion", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u53CB\u5584\u5EA6", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Slider, { min: 1, max: 10, value: spec.personality.agreeableness, left: "\u51B7\u6F20", right: "\u70ED\u60C5", onChange: (v) => patchN("personality", "agreeableness", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u5C3D\u8D23\u6027", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Slider, { min: 1, max: 10, value: spec.personality.conscientiousness, left: "\u968F\u6027", right: "\u4E25\u8C28", onChange: (v) => patchN("personality", "conscientiousness", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u60C5\u7EEA\u7A33\u5B9A\u6027", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Slider, { min: 1, max: 10, value: spec.personality.stability, left: "\u654F\u611F", right: "\u6C89\u7A33", onChange: (v) => patchN("personality", "stability", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u5F00\u653E\u6027", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Slider, { min: 1, max: 10, value: spec.personality.openness, left: "\u4FDD\u5B88", right: "\u597D\u5947", onChange: (v) => patchN("personality", "openness", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u6027\u683C\u5173\u952E\u8BCD", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: TRAITS, values: spec.personality.traits, multiple: true, onChange: (v) => patchN("personality", "traits", v) }) })
  ] });
  const secBackground = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u56DB\u3001\u80CC\u666F\u4E0E\u4E16\u754C\u89C2", hint: "\u586B\u7A7A + \u5FEB\u6377\u6A21\u677F", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Field, { label: "\u51FA\u8EAB", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: ORIGINS, values: spec.background.origin, onChange: (v) => patchN("background", "origin", v) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, value: spec.background.origin, onChange: (e) => patchN("background", "origin", e.target.value), placeholder: "\u6216\u81EA\u5B9A\u4E49\u51FA\u8EAB" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u91CD\u8981\u7ECF\u5386", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 3, value: spec.background.experience, onChange: (e) => patchN("background", "experience", e.target.value), placeholder: "\u5F71\u54CD\u89D2\u8272\u6027\u683C\u7684\u5173\u952E\u4E8B\u4EF6" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u4E16\u754C\u89C2\u8BBE\u5B9A", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 3, value: spec.background.world, onChange: (e) => patchN("background", "world", e.target.value), placeholder: "\u6545\u4E8B\u53D1\u751F\u7684\u4E16\u754C\u80CC\u666F" }) })
  ] });
  const secAbilities = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u4E94\u3001\u80FD\u529B\u4E0E\u7279\u957F", hint: "\u6807\u7B7E\u591A\u9009 + \u81EA\u5B9A\u4E49", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: ABILITIES, values: spec.abilities, multiple: true, onChange: (v) => patch("abilities", v) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(CustomAdd, { values: spec.abilities, onAdd: (v) => patch("abilities", v), placeholder: "\u81EA\u5B9A\u4E49\u80FD\u529B\u2026" })
  ] });
  const secDialogue = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u516D\u3001\u5BF9\u8BDD\u98CE\u683C", hint: "\u5355\u9009 + \u5F15\u5BFC", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u98CE\u683C\u9884\u8BBE", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("select", { className: css.stInput, value: spec.dialogue.style, onChange: (e) => patchN("dialogue", "style", e.target.value), children: STYLE_OPTS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: o.value, children: o.label }, o.value)) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u8BED\u6C14", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: TONES, values: spec.dialogue.tone, onChange: (v) => patchN("dialogue", "tone", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u4EBA\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(RadioGroup, { options: PERSON_OPTS, value: spec.dialogue.person, onChange: (v) => patchN("dialogue", "person", v) }) })
  ] });
  const secScenario = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u4E03\u3001\u573A\u666F\u4E0E\u5F00\u573A", hint: "\u53EF\u9009", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u573A\u666F\u6A21\u677F", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: SCENE_TEMPLATES, values: spec.scenario.sceneTemplate, onChange: (v) => patchN("scenario", "sceneTemplate", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u521D\u59CB\u573A\u666F", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 2, value: spec.scenario.scene, onChange: (e) => patchN("scenario", "scene", e.target.value), placeholder: "\u81EA\u5B9A\u4E49\u521D\u59CB\u573A\u666F\u63CF\u8FF0" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u5F00\u573A\u767D\u98CE\u683C", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Chips, { options: OPENER_STYLES, values: spec.scenario.openerStyle, onChange: (v) => patchN("scenario", "openerStyle", v) }) })
  ] });
  const renderPreview = () => {
    if (generating) return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stEmpty, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stSpinner }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { children: "\u6B63\u5728\u751F\u6210\u89D2\u8272\u5361\u2026" })
    ] });
    if (card) {
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
        fallback ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stNotice, children: "\u6CE8\u610F\uFF1A\u6A21\u578B\u8F93\u51FA\u672A\u80FD\u89E3\u6790\uFF0C\u5DF2\u4F7F\u7528\u8BBE\u5B9A\u76F4\u63A5\u7EC4\u88C5\uFF08\u964D\u7EA7\u6A21\u5F0F\uFF09\u3002\u53EF\u5728\u300C\u7F16\u8F91\u300D\u9875\u5FAE\u8C03\u3002" }) : null,
        fallback && rawText ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("details", { className: css.stRaw, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("summary", { className: css.stRawSummary, children: "\u67E5\u770B\u6A21\u578B\u539F\u59CB\u8F93\u51FA" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("pre", { className: css.stRawPre, children: rawText })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(CardPreview, { card, avatar })
      ] });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLiveHint, children: "\u5B9E\u65F6\u9884\u89C8\uFF08\u57FA\u4E8E\u5F53\u524D\u8BBE\u5B9A\uFF0C\u751F\u6210\u540E\u66FF\u6362\u4E3A\u5B8C\u6574\u89D2\u8272\u5361\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("pre", { className: css.stLivePre, children: describeSpec(spec) })
    ] });
  };
  const renderEdit = () => {
    if (!card) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stEmpty, children: "\u8BF7\u5148\u70B9\u51FB\u300C\u751F\u6210\u89D2\u8272\u5361\u300D" });
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stEdit, children: CARD_FIELDS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: f.label, children: f.area ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 4, value: cardFieldValue(f.key), onChange: (e) => onCardFieldChange(f.key, e.target.value) }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, value: cardFieldValue(f.key), onChange: (e) => onCardFieldChange(f.key, e.target.value) }) }, f.key)) });
  };
  const renderJson = () => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("textarea", { className: cx(css.stInput, css.stTextarea, css.stJsonArea), value: jsonDraft, onChange: (e) => setJsonDraft(e.target.value) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { variant: "primary", onClick: onApplyJson, children: "\u5E94\u7528\u4FEE\u6539" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: exportJson, children: "\u5BFC\u51FA JSON" })
    ] })
  ] });
  const renderWorldbook = () => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { variant: "primary", disabled: wbGenerating, onClick: () => onWorldbook(false), children: wbGenerating ? "\u751F\u6210\u4E2D\u2026" : "\u751F\u6210\u4E16\u754C\u4E66" }),
      worldbook && worldbook.entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { disabled: wbGenerating, onClick: () => onWorldbook(true), children: "\u8865\u5168\u4E16\u754C\u4E66" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stBtn, children: [
        "\u5BFC\u5165\u4E16\u754C\u4E66",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "file", accept: ".json,application/json", style: { display: "none" }, onChange: onImportWorldbookFile })
      ] })
    ] }),
    wbError ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stNotice, children: wbError }) : null,
    worldbook && worldbook.entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stNotice, children: "\u672A\u80FD\u89E3\u6790\u51FA\u4E16\u754C\u4E66\u6761\u76EE\u3002\u53EF\u70B9\u300C\u8865\u5168\u4E16\u754C\u4E66\u300D\u6839\u636E\u5DF2\u751F\u6210\u7684\u4EBA\u7269\u5361\u91CD\u65B0\u751F\u6210\uFF0C\u6216\u5BFC\u5165\u5DF2\u6709\u4E16\u754C\u4E66 JSON\u3002" }) : null,
    worldbook?.entries.map((en, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stWbEntry, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stWbKeys, children: (en.keys ?? []).map((k) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: css.stWbKey, children: k }, k)) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stCardBlockText, children: en.content }),
      en.comment ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stWbComment, children: en.comment }) : null
    ] }, i)),
    worldbook && worldbook.entries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: () => downloadFile((spec.basic.name || "character") + ".worldbook.json", new Blob([JSON.stringify({ entries: worldbook.entries }, null, 2)], { type: "application/json" })), children: "\u5BFC\u51FA\u4E16\u754C\u4E66 JSON" }) : null
  ] });
  const renderCharacter = () => {
    const resultBody = charTab === "preview" ? renderPreview() : charTab === "edit" ? renderEdit() : charTab === "json" ? renderJson() : renderWorldbook();
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stChar, children: [
      secAvatar,
      secBasic,
      secAppearance,
      secPersonality,
      secBackground,
      secAbilities,
      secDialogue,
      secScenario,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stActions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { variant: "primary", disabled: generating, onClick: onGenerate, children: generating ? "\u751F\u6210\u4E2D\u2026" : "\u751F\u6210\u89D2\u8272\u5361" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: exportJson, children: "\u5BFC\u51FA JSON" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: onJoinParty, title: "\u628A\u5F53\u524D\u89D2\u8272\u53D8\u6210\u961F\u4F0D\u6210\u5458\uFF1B\u5C5E\u6027\u7531\u89D2\u8272\u5361\u63A8\u5BFC\uFF0C\u4E4B\u540E\u53EF\u5728\u961F\u4F0D\u9875\u8C03\u6574", children: "\u52A0\u5165\u961F\u4F0D" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stBtn, children: [
          "\u5BFC\u5165\u89D2\u8272\u5361",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "file", accept: ".json,.png,application/json,image/png", style: { display: "none" }, onChange: onImportCardFile })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: css.stVerToggle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: cx(css.stVerBtn, version === "v2" && css.stVerActive), onClick: () => setVersion("v2"), children: "V2" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: cx(css.stVerBtn, version === "v3" && css.stVerActive), onClick: () => setVersion("v3"), children: "V3" })
        ] }),
        error ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stNotice, children: error }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stTpl, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stTplHead, children: "\u6A21\u677F\uFF08\u4FDD\u5B58/\u8F7D\u5165\u5F53\u524D\u8BBE\u5B9A\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stCustomAdd, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, value: templateName, onChange: (e) => setTemplateName(e.target.value), placeholder: "\u6A21\u677F\u540D\u79F0" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: onSaveTemplate, children: "\u4FDD\u5B58\u6A21\u677F" })
        ] }),
        templates.length ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stChipWrap, children: templates.map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: css.stTplItem, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: css.stChip, onClick: () => setSpec(JSON.parse(JSON.stringify(t.spec))), children: t.name }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: css.stTplDel, title: "\u5220\u9664", onClick: () => {
            const list = templates.filter((_, j) => j !== i);
            setTemplates(list);
            saveTemplates(list);
          }, children: "x" })
        ] }, i)) }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stLib, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLibHead, children: "\u89D2\u8272\u5E93\uFF08\u672C\u5730\u4FDD\u5B58\u89D2\u8272\u5361\u4E0E\u5BF9\u8BDD\u8BB0\u5F55\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stCustomAdd, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { variant: "primary", disabled: !card, onClick: onSaveCharacter, children: "\u4FDD\u5B58\u5F53\u524D\u89D2\u8272\u5230\u5E93" }) }),
        savedChars.length ? savedChars.map((c) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stLibItem, children: [
          c.avatar ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("img", { className: css.stLibAvatar, src: c.avatar, alt: c.name }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: css.stLibAvatarFallback, children: (c.name || "?").slice(0, 1) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLibName, children: c.name }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: css.stLibMeta, children: [
            c.chat.length,
            " \u6761 \xB7 ",
            new Date(c.savedAt).toLocaleDateString()
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: () => onLoadCharacter(c), children: "\u8F7D\u5165" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: css.stTplDel, title: "\u5220\u9664", onClick: () => onDeleteCharacter(c.id), children: "x" })
        ] }, c.id)) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLibMeta, children: "\u6682\u65E0\u4FDD\u5B58\u7684\u89D2\u8272" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stResultWrap, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stResultTabs, children: [{ id: "preview", label: "\u9884\u89C8" }, { id: "edit", label: "\u7F16\u8F91" }, { id: "json", label: "JSON" }, { id: "worldbook", label: "\u4E16\u754C\u4E66" }].map((t) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: cx(css.stTab, charTab === t.id && css.stTabActive), onClick: () => setCharTab(t.id), children: t.label }, t.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stResultBody, children: resultBody })
      ] })
    ] });
  };
  const renderSettings = () => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stChar, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Section, { title: "\u5BF9\u8BDD\u7CFB\u7EDF\u63D0\u793A\u8BCD", hint: "\u6BCF\u6B21\u5BF9\u8BDD\u524D\u6CE8\u5165\uFF0C\u7C7B\u4F3C SillyTavern \u7684 System Prompt", defaultOpen: true, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u5168\u5C40\u6307\u4EE4\uFF08\u6CE8\u5165\u5230\u89D2\u8272\u8BBE\u5B9A\u4E4B\u524D\uFF0C\u652F\u6301 {{char}} / {{user}} \u5360\u4F4D\u7B26\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 5, value: globalPrompt, onChange: (e) => setGlobalPrompt(e.target.value), placeholder: "\u4F8B\u5982\uFF1A\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684\u6545\u4E8B\u53D9\u8FF0\u8005\uFF0C\u59CB\u7EC8\u6C89\u6D78\u89D2\u8272\u3001\u4E0D\u8DF3\u51FA\u3001\u4E0D\u63D0\u53CA\u4EFB\u4F55\u8BBE\u5B9A\u4E0E\u89C4\u5219\uFF0C\u4F7F\u7528\u4E2D\u6587\u56DE\u590D\u2026\u2026" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u5916\u89C2", defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u9762\u677F\u5BBD\u5EA6\uFF1A" + tavern.width + "px", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Slider, { min: 360, max: 820, value: tavern.width, left: "\u7A84", right: "\u5BBD", onChange: (v) => updateTavern("width", v) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u60AC\u6D6E\u6309\u94AE", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "checkbox", checked: showTrigger, onChange: (e) => onToggleTrigger(e.target.checked) }),
        showTrigger ? "\u663E\u793A\uFF08\u53EF\u62D6\u52A8\u505C\u9760\uFF09" : "\u9690\u85CF\uFF08\u4ECE DSH \u8BBE\u7F6E\u9875\u6253\u5F00\u9152\u9986\uFF09"
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u4E3B\u9898\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stSwatches, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "color", value: tavern.accent, onChange: (e) => updateTavern("accent", e.target.value), className: css.stColorInput }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: cx(css.stInput, css.stColorText), value: tavern.accent, onChange: (e) => updateTavern("accent", e.target.value) })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u80CC\u666F\u56FE\u7247", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stBtn, children: [
          "\u9009\u62E9\u56FE\u7247",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: onBgImageFile })
        ] }),
        bgImage ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: () => {
          setBgImage("");
          saveBgImage("");
        }, children: "\u6E05\u9664" }) : null
      ] }) }),
      bgImage ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Field, { label: "\u80CC\u666F\u56FE\u5F3A\u5EA6\uFF1A" + Math.round(tavern.bgOpacity * 100) + "%", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          Slider,
          {
            min: 0,
            max: 70,
            value: Math.round(tavern.bgOpacity * 100),
            left: "\u51E0\u4E4E\u770B\u4E0D\u89C1",
            right: "\u5F88\u660E\u663E",
            onChange: (v) => updateTavern("bgOpacity", v / 100)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLabel, children: "\u7528\u73BB\u7483\u62DF\u6001\u8FD9\u7C7B\u534A\u900F\u660E\u4E3B\u9898\u65F6\u8C03\u9AD8\u4E00\u70B9\uFF0C\u58C1\u7EB8\u624D\u4F1A\u771F\u7684\u900F\u51FA\u6765\uFF1B\u8C03\u592A\u9AD8\u4F1A\u5F71\u54CD\u6587\u5B57\u53EF\u8BFB\u6027\u3002" })
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u6A21\u578B\u63A5\u5165", hint: "\u9ED8\u8BA4\u76F4\u63A5\u4F7F\u7528 DSH \u5F53\u524D\u914D\u7F6E\u7684\u6A21\u578B\u4E0E\u5BC6\u94A5\uFF1B\u586B\u5199\u540E\u53EF\u6539\u8D70\u4F60\u81EA\u5DF1\u7684 OpenAI \u517C\u5BB9\u63A5\u53E3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u63A5\u53E3\u5730\u5740\uFF08Base URL\uFF0C\u81EA\u52A8\u62FC\u63A5 /chat/completions\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, value: llmDraft.baseUrl, onChange: (e) => setLlmDraft({ ...llmDraft, baseUrl: e.target.value }), placeholder: "https://api.deepseek.com" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "API Key\uFF08\u4EC5\u4FDD\u5B58\u5728\u672C\u6D4F\u89C8\u5668\uFF0C\u5BC6\u7801\u6846\u906E\u853D\u663E\u793A\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, type: "password", value: llmDraft.apiKey, onChange: (e) => setLlmDraft({ ...llmDraft, apiKey: e.target.value }), placeholder: "sk-\u2026", autoComplete: "off" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u6A21\u578B\u540D\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: css.stInput, value: llmDraft.model, onChange: (e) => setLlmDraft({ ...llmDraft, model: e.target.value }), placeholder: "deepseek-chat" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u5F53\u524D\u72B6\u6001\uFF1A" + (customConfigured ? "\u5DF2\u542F\u7528\u81EA\u5B9A\u4E49\u63A5\u53E3\uFF08\u89D2\u8272\u5361 / \u4E16\u754C\u4E66 / \u804A\u5929\u53EF\u7528\uFF09" : "\u672A\u542F\u7528\uFF08\u4F7F\u7528 DSH \u9ED8\u8BA4\u6A21\u578B\uFF09"), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { variant: "primary", disabled: llmTesting, onClick: onTestLlm, children: llmTesting ? "\u6D4B\u8BD5\u4E2D\u2026" : "\u4FDD\u5B58\u5E76\u6D4B\u8BD5\u8FDE\u63A5" }),
        customConfigured ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: onClearLlm, children: "\u6E05\u9664\u914D\u7F6E" }) : null
      ] }) }),
      llmTestResult ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stNotice, children: llmTestResult }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLabel, children: "API Key \u53EA\u5B58\u5728\u672C\u673A\u6D4F\u89C8\u5668 localStorage\uFF0C\u4EC5\u53D1\u9001\u7ED9\u672C\u673A\u9152\u9986\u8DEF\u7531\u8F6C\u53D1\u8BF7\u6C42\uFF0C\u4E0D\u5199\u5165\u4EFB\u4F55\u65E5\u5FD7\uFF1B\u804A\u5929\u9875\u7684\u6A21\u578B\u4E0B\u62C9\u4E2D\u9009\u62E9\u300C\u81EA\u5B9A\u4E49\u300D\u5373\u53EF\u5207\u6362\u5230\u8BE5\u63A5\u53E3\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u91C7\u6837\u6E29\u5EA6", hint: "\u4FEE\u590D\u90E8\u5206\u6A21\u578B\u56FA\u5B9A temperature \u5BFC\u81F4\u7684 400 \u62A5\u9519", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u53D1\u9001\u65B9\u5F0F", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        RadioGroup,
        {
          options: [
            { value: "auto", label: "\u81EA\u52A8\uFF08\u63A8\u8350\uFF09" },
            { value: "fixed", label: "\u56FA\u5B9A\u6570\u503C" },
            { value: "omit", label: "\u4E0D\u53D1\u9001\u8BE5\u5B57\u6BB5" }
          ],
          value: sampling.mode,
          onChange: (v) => {
            const next = { ...sampling, mode: v };
            setSampling(next);
            saveSampling(next);
          }
        }
      ) }),
      sampling.mode === "fixed" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Field, { label: "\u6E29\u5EA6\u503C\uFF1A" + sampling.value.toFixed(2), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        Slider,
        {
          min: 0,
          max: 2,
          value: sampling.value,
          left: "\u7A33\u5B9A",
          right: "\u53D1\u6563",
          onChange: (v) => {
            const next = { ...sampling, value: v };
            setSampling(next);
            saveSampling(next);
          }
        }
      ) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLabel, children: "\u81EA\u52A8\u6A21\u5F0F\u6309\u6BCF\u6B21\u4EFB\u52A1\u7ED9\u51FA\u9ED8\u8BA4\u6E29\u5EA6\uFF08\u89D2\u8272\u5361 0.85 / \u4E16\u754C\u4E66 0.7 / \u804A\u5929 0.9\uFF09\u3002\u82E5\u67D0\u4E2A\u6A21\u578B\u53EA\u63A5\u53D7\u56FA\u5B9A\u6E29\u5EA6\uFF08\u4F8B\u5982 KIMI K3 \u53EA\u5141\u8BB8 1\uFF09\u6216\u76F4\u63A5\u62D2\u7EDD\u8BE5\u5B57\u6BB5\uFF0C\u5BBF\u4E3B\u4F1A\u4ECE\u4E0A\u6E38\u62A5\u9519\u91CC\u8BFB\u51FA\u9650\u5236\u5E76\u81EA\u52A8\u8BB0\u4F4F\uFF0C\u63A5\u4E0B\u6765\u5BF9\u8BE5\u6A21\u578B\u4E00\u5F8B\u6309\u9650\u5236\u53D1\u9001\uFF0C\u7528\u6237\u4E0D\u4F1A\u518D\u770B\u5230\u8FD9\u6761 400\u3002\u9009\u62E9\u300C\u4E0D\u53D1\u9001\u300D\u53EF\u624B\u52A8\u5F3A\u5236\u7701\u7565\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Section, { title: "\u6269\u5C55\u8BBE\u7F6E\u9762\u677F", hint: "\u793E\u533A\u6269\u5C55\u628A\u81EA\u5DF1\u7684\u8BBE\u7F6E\u754C\u9762\u6302\u5728\u8FD9\u91CC", defaultOpen: false, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLabel, children: "\u5DF2\u542F\u7528\u7684\u6269\u5C55\u4F1A\u628A\u5B83\u4EEC\u7684\u8BBE\u7F6E\u9762\u677F\u63D2\u5165\u4E0B\u9762\u7684\u300C\u6269\u5C55\u9762\u677F\u300D\u533A\u57DF\uFF08\u5BF9\u5E94 SillyTavern \u7684 #extensions_settings \u4E0E #extensions_settings2 \u6302\u8F7D\u70B9\uFF09\u3002\u5982\u679C\u90A3\u91CC\u662F\u7A7A\u7684\uFF0C\u8BF4\u660E\u5F53\u524D\u6CA1\u6709\u542F\u7528\u4EFB\u4F55\u9700\u8981\u8BBE\u7F6E\u754C\u9762\u7684\u6269\u5C55\u3002" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { id: "pt-ext-mount", className: css.stExtMount }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Section, { title: "\u5B58\u50A8", hint: "\u89D2\u8272\u5361\u3001\u961F\u4F0D\u3001\u5BF9\u8BDD\u90FD\u5B58\u5728\u672C\u673A\u6D4F\u89C8\u5668\u91CC", defaultOpen: false, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLabel, children: storageUsage === null ? "\u6B63\u5728\u8BFB\u53D6\u5360\u7528\u2026" : "\u672C\u673A\u5DF2\u7528 " + formatBytes(storageUsage.usage) + "\uFF0C\u6D4F\u89C8\u5668\u7ED9\u8FD9\u4E2A\u7AD9\u70B9\u5206\u914D\u4E86 " + formatBytes(storageUsage.quota) + "\u3002\u89D2\u8272\u5361\u548C\u961F\u4F0D\u7684\u56FE\u7247\u662F\u4E3B\u8981\u5360\u7528\uFF0C\u5B58\u5728 IndexedDB \u91CC\uFF08\u4E0D\u662F 5MB \u7684 localStorage\uFF09\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLabel, children: "IndexedDB \u91CC\u4FDD\u5B58\u7684\u662F\uFF1A\u5F53\u524D\u5DE5\u4F5C\u533A\u3001\u89D2\u8272\u5E93\u3001\u961F\u4F0D\u5E93\u3001\u684C\u9762\u4E0A\u7684\u961F\u4F0D\u3001\u6BCF\u4E2A\u4EBA\u7684\u5BF9\u8BDD\u3001\u5F53\u524D\u8FD9\u5C40\u5192\u9669\u3002" }),
      storageIssue !== null ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stNotice, children: [
        "\u6700\u8FD1\u4E00\u6B21\u5931\u8D25\uFF08",
        storageIssue.op === "write" ? "\u5199\u5165" : "\u8BFB\u53D6",
        "\uFF09\uFF1A",
        storageIssue.message
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stLabel, children: "\u6700\u8FD1\u6CA1\u6709\u4FDD\u5B58\u5931\u8D25\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Section, { title: "\u672C\u5730\u97F3\u4E50", defaultOpen: true, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Field, { label: "\u672C\u5730\u97F3\u4E50\uFF08\u652F\u6301\u6587\u4EF6\u5939\u3001\u6309\u987A\u5E8F\u64AD\u653E\uFF09", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stBtn, children: [
          "\u6253\u5F00\u6587\u4EF6\u5939",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "file", ...{ webkitdirectory: "true", directory: "true" }, multiple: true, accept: "audio/*", style: { display: "none" }, onChange: onMusicFolder })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stBtn, children: [
          "\u9009\u62E9\u5355\u66F2",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "file", accept: "audio/*", style: { display: "none" }, onChange: onMusicFile })
        ] }),
        playlist.length ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: stopMusic, children: "\u505C\u6B62\u5E76\u6E05\u7A7A" }) : null
      ] }),
      playlist.length ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stLabel, children: [
        "\u64AD\u653E\u5217\u8868\uFF08",
        playlist.length,
        " \u9996\uFF09"
      ] }) : null
    ] }) })
  ] });
  const threads = { card: chatMessages, ...memberThreads };
  const onThreads = (next) => {
    setChatMessages(next.card ?? []);
    const rest = {};
    for (const key of Object.keys(next)) {
      if (key !== "card") rest[key] = next[key];
    }
    setMemberThreads(rest);
  };
  const adventureContext = rpg.scene !== "" || rpg.encounter !== null || rpg.log.length > 0 ? {
    scene: rpg.scene,
    beat: [...rpg.log].reverse().find((e) => e.kind === "scene")?.text ?? "",
    encounter: rpg.encounter === null ? null : {
      title: rpg.encounter.title,
      description: rpg.encounter.description,
      options: rpg.encounter.options.map((o) => o.label)
    }
  } : void 0;
  const renderChatPanel = () => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    ChatPanel,
    {
      api,
      card,
      cardAvatar: avatar,
      spec,
      party,
      threads,
      onThreads,
      target: chatTarget,
      onTarget: setChatTarget,
      globalPrompt,
      chatModel,
      onModel: setChatModel,
      modelOptions,
      customConfigured,
      customModel: llmDraft.model,
      adventure: adventureContext,
      onCarryPlan: (plan) => {
        setCarryPlan(plan);
        setTab("rpg");
      },
      onGotoCharacter: () => setTab("character")
    }
  );
  const renderRpg = () => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    RpgPanel,
    {
      api,
      party,
      onParty: setParty,
      state: rpg,
      onState: setRpg,
      chatModel,
      customConfigured,
      customModel: llmDraft.model,
      onGotoParty: () => setTab("party"),
      incomingAction: carryPlan,
      onIncomingConsumed: () => setCarryPlan("")
    }
  );
  const renderParty = () => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    PartyPanel,
    {
      party,
      onChange: setParty,
      library: parties,
      onSave: () => {
        const entry = { ...JSON.parse(JSON.stringify(party)), savedAt: Date.now() };
        const list = parties.some((p) => p.id === entry.id) ? parties.map((p) => p.id === entry.id ? entry : p) : [...parties, entry];
        setParties(list);
        void saveRecord(HEAVY_KEYS.parties, list);
      },
      onLoad: (id) => {
        const found = parties.find((p) => p.id === id);
        if (found) setParty(JSON.parse(JSON.stringify(found)));
      },
      onDelete: (id) => {
        const list = parties.filter((p) => p.id !== id);
        setParties(list);
        void saveRecord(HEAVY_KEYS.parties, list);
      },
      modelOptions,
      customConfigured,
      customModel: llmDraft.model,
      onExportCard: (member) => {
        const exported = cardFromMember(member);
        downloadFile((member.name || "companion") + ".json", new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" }));
      }
    }
  );
  const renderPlugins = () => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    ExtPanel,
    {
      api,
      enabled: extEnabled,
      onToggle: onToggleExt,
      onChanged: refreshExt,
      log: extLog,
      theme: extTheme,
      onTheme
    }
  );
  const track = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stPanel, style: { width: tavern.width, "--st-accent": tavern.accent, visibility: props.open ? "visible" : "hidden", pointerEvents: props.open ? "auto" : "none" }, children: [
    bgImage ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        className: css.stPanelBg,
        style: { backgroundImage: "url(" + bgImage + ")", opacity: tavern.bgOpacity }
      }
    ) : null,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stPanelHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: css.stPanelTitle, children: "\u4FBF\u643A\u9152\u9986" }),
      storageIssue !== null ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: css.stStorageWarn, title: storageIssue.message, children: "\u5B58\u50A8\u544A\u8B66" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: css.stClose, onClick: () => props.store.set(false), children: "\xD7" })
    ] }),
    storageIssue !== null ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stNotice, style: { margin: "8px 14px 0" }, children: [
      "\u4FDD\u5B58\u5931\u8D25\uFF08",
      storageIssue.op === "write" ? "\u5199\u5165" : "\u8BFB\u53D6",
      "\uFF09\uFF1A",
      storageIssue.message,
      "\u3002 \u8FD9\u6B21\u7684\u6539\u52A8\u53EF\u80FD\u4E0D\u4F1A\u5728\u5237\u65B0\u540E\u4FDD\u7559 \u2014\u2014 \u8BE6\u60C5\u89C1\u300C\u8BBE\u7F6E \u2192 \u5B58\u50A8\u300D\u3002"
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stTabbar, children: TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: cx(css.stTab, tab === t.id && css.stTabActive), onClick: () => setTab(t.id), title: t.title, children: t.label }, t.id)) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stPanelBody, children: [
      tab === "chat" ? renderChatPanel() : tab === "rpg" ? renderRpg() : tab === "party" ? renderParty() : tab === "plugins" ? renderPlugins() : tab === "settings" ? null : renderCharacter(),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { display: tab === "settings" ? "block" : "none", height: "100%" }, children: renderSettings() })
    ] }),
    track ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stMusicBar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "audio",
        {
          ref: audioRef,
          className: css.stAudio,
          controls: true,
          onTimeUpdate: (e) => {
            positionRef.current = e.currentTarget.currentTime;
          },
          onPlay: () => {
            playingRef.current = true;
            wantPlayRef.current = true;
            saveMusicState({ index: indexRef.current, position: positionRef.current, playing: true });
          },
          onPause: () => {
            playingRef.current = false;
            if (!loadingRef.current) wantPlayRef.current = false;
            saveMusicState({ index: indexRef.current, position: positionRef.current, playing: wantPlayRef.current });
          },
          onEnded: nextTrack
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stMusicInfo, title: track.name, children: currentIndex + 1 + "/" + playlist.length + " \xB7 " + track.name }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: prevTrack, title: "\u4E0A\u4E00\u9996", children: "\u4E0A\u4E00\u9996" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: nextTrack, title: "\u4E0B\u4E00\u9996", children: "\u4E0B\u4E00\u9996" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Btn, { onClick: stopMusic, title: "\u505C\u6B62", children: "\u505C\u6B62" })
    ] }) : null
  ] });
}
var dragState = null;
var dragged = false;
function TavernRoot(props) {
  const open = useStoreValue(props.store);
  const showTrigger = useStoreValue(triggerStore);
  const [pos, setPos] = (0, import_react7.useState)(() => {
    const vw2 = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    return { left: Math.max(0, vw2 - 60), top: Math.round(vh * 0.44) };
  });
  const onDown = (e) => {
    dragState = { sx: e.clientX, sy: e.clientY, ox: pos.left, oy: pos.top };
    dragged = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
    }
  };
  const onMove = (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.sx;
    const dy = e.clientY - dragState.sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
    const vw2 = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const maxX = Math.max(0, vw2 - 60);
    const maxY = Math.max(0, vh - 60);
    setPos({ left: Math.max(0, Math.min(maxX, dragState.ox + dx)), top: Math.max(0, Math.min(maxY, dragState.oy + dy)) });
  };
  const onUp = () => {
    dragState = null;
  };
  const onClick = () => {
    if (dragged) {
      dragged = false;
      return;
    }
    props.store.set(true);
  };
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const dock = pos.left < 12 ? "left" : pos.left > vw - 90 ? "right" : "none";
  const shared = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onClick };
  const trigger = dock === "left" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: cx(css.stTrigger, css.stTriggerDockedLeft), style: { left: 0, top: pos.top }, ...shared, children: "\u4FBF\u643A\u9152\u9986" }) : dock === "right" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: cx(css.stTrigger, css.stTriggerDockedRight), style: { right: 0, top: pos.top }, ...shared, children: "\u4FBF\u643A\u9152\u9986" }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: cx(css.stTrigger, css.stTriggerFloat), style: { left: pos.left, top: pos.top }, ...shared, children: "\u4FBF\u643A\u9152\u9986" });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stRoot, children: [
    showTrigger ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { display: open ? "none" : "block" }, children: trigger }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PortableTavern, { store: props.store, open })
  ] });
}
function SettingsEntry(props) {
  const showTrigger = useStoreValue(triggerStore);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: css.stSettingsEntry, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: css.stSettingsTitle, children: "\u4FBF\u643A\u9152\u9986" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: css.stSettingsDesc, children: "RPG \u89D2\u8272\u5361\u751F\u6210 + \u9152\u9986\u804A\u5929\u4E00\u4F53\u3002\u901A\u8FC7\u53EF\u89C6\u5316\u9762\u677F\u5851\u9020\u89D2\u8272\uFF0C\u4E00\u952E\u751F\u6210 SillyTavern \u89D2\u8272\u5361\uFF0C\u5E76\u76F4\u63A5\u5728\u53F3\u4FA7\u4E0E\u89D2\u8272\u5BF9\u8BDD\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: cx(css.stBtn, css.stBtnPrimary), onClick: props.onOpen, children: "\u6253\u5F00\u4FBF\u643A\u9152\u9986" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { type: "checkbox", checked: showTrigger, onChange: (e) => setTriggerVisible(e.target.checked) }),
        "\u60AC\u6D6E\u6309\u94AE"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: css.stSectionHint, children: "\u5173\u95ED\u60AC\u6D6E\u6309\u94AE\u540E\uFF0C\u4ECD\u53EF\u4ECE\u6B64\u9875\u6253\u5F00\u9152\u9986" })
  ] });
}

// src/client/index.ts
var inject = ["slots"];
function apply(ctx) {
  const slots = ctx.get("slots");
  if (!slots) return;
  adoptStyles();
  const store = makeStore(false);
  slots.inject("shell.overlay", () => slots.register(
    { name: "shell.overlay", id: "dsh-portable-tavern", order: 50, label: "\u4FBF\u643A\u9152\u9986" },
    () => (0, import_react8.createElement)(TavernRoot, { store })
  ));
  slots.inject("settings.section", () => slots.register(
    { name: "settings.section", id: "dsh-portable-tavern", order: 60, label: "\u4FBF\u643A\u9152\u9986" },
    () => (0, import_react8.createElement)(SettingsEntry, { onOpen: () => store.set(true) })
  ));
}
return module.exports; } });
//# sourceMappingURL=client.js.map

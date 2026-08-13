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
var import_react2 = require("react");

// src/client/PortableTavern.tsx
var import_react = require("react");

// src/protocol.ts
var TAVERN_API_BASE = "/api/dsh-portable-tavern";
var TAVERN_API = {
  generate: TAVERN_API_BASE + "/generate",
  worldbook: TAVERN_API_BASE + "/worldbook",
  models: TAVERN_API_BASE + "/models",
  chat: TAVERN_API_BASE + "/chat"
};

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
    return post(TAVERN_API.generate, { spec, version });
  }
  async worldbook(spec, card) {
    return post(TAVERN_API.worldbook, { spec, card });
  }
  async models() {
    const response = await fetch(TAVERN_API.models);
    return readJson(response);
  }
  async chat(card, messages, provider, model) {
    return post(TAVERN_API.chat, { card, messages, provider, model });
  }
};

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

// src/client/PortableTavern.tsx
var import_jsx_runtime = require("react/jsx-runtime");
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
function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}
function cleanPlaceholders(s, name) {
  return String(s ?? "").split("{{char}}").join(name || "\u89D2\u8272").split("{{user}}").join("\u4F60");
}
function makeStore(initial) {
  let value = initial;
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
  const [v, setV] = (0, import_react.useState)(store.get());
  (0, import_react.useEffect)(() => store.subscribe(() => setV(store.get())), [store]);
  return v;
}
function loadTavernSettings() {
  try {
    const raw = localStorage.getItem("dsh.portable-tavern.settings.v1");
    const s = raw ? JSON.parse(raw) : {};
    return { width: s.width || 540, accent: s.accent || "#4f7cff" };
  } catch {
    return { width: 540, accent: "#4f7cff" };
  }
}
function saveTavernSettings(s) {
  try {
    localStorage.setItem("dsh.portable-tavern.settings.v1", JSON.stringify(s));
  } catch {
  }
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
function avatarGradient(spec) {
  const a = spec.appearance;
  return "linear-gradient(135deg," + (a.hairColor || "#8b5a2b") + "," + (a.skinColor || "#f2c9a0") + ")";
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stCardPreview, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stCardName, children: d.name || "\u672A\u547D\u540D\u89D2\u8272" }),
    d.tags.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stCardTags, children: d.tags.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stCardTag, children: t }, t)) }) : null,
    items.map(([key, label]) => {
      const v = d[key];
      if (!v) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stCardBlock, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stCardBlockLabel, children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stCardBlockText, children: v })
      ] }, key);
    }),
    d.alternate_greetings.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stCardBlock, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stCardBlockLabel, children: "\u66FF\u4EE3\u95EE\u5019" }),
      d.alternate_greetings.map((g, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stCardBlockText, children: g }, i))
    ] }) : null
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
function PortableTavern(props) {
  const api = (0, import_react.useState)(() => new TavernApi())[0];
  const [spec, setSpec] = (0, import_react.useState)(DEFAULT_SPEC);
  const [card, setCard] = (0, import_react.useState)(null);
  const [version, setVersion] = (0, import_react.useState)("v2");
  const [generating, setGenerating] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const [fallback, setFallback] = (0, import_react.useState)(false);
  const [rawText, setRawText] = (0, import_react.useState)("");
  const [charTab, setCharTab] = (0, import_react.useState)("preview");
  const [jsonDraft, setJsonDraft] = (0, import_react.useState)("");
  const [worldbook, setWorldbook] = (0, import_react.useState)(null);
  const [wbGenerating, setWbGenerating] = (0, import_react.useState)(false);
  const [wbError, setWbError] = (0, import_react.useState)("");
  const [templates, setTemplates] = (0, import_react.useState)(loadTemplates);
  const [templateName, setTemplateName] = (0, import_react.useState)("");
  const [tab, setTab] = (0, import_react.useState)("character");
  const [chatMessages, setChatMessages] = (0, import_react.useState)([]);
  const [chatInput, setChatInput] = (0, import_react.useState)("");
  const [chatSending, setChatSending] = (0, import_react.useState)(false);
  const [chatError, setChatError] = (0, import_react.useState)("");
  const [modelOptions, setModelOptions] = (0, import_react.useState)([]);
  const [chatModel, setChatModel] = (0, import_react.useState)("");
  const [tavern, setTavern] = (0, import_react.useState)(loadTavernSettings);
  const [bgImage, setBgImage] = (0, import_react.useState)(loadBgImage);
  const [playlist, setPlaylist] = (0, import_react.useState)([]);
  const [currentIndex, setCurrentIndex] = (0, import_react.useState)(-1);
  const patch = (key, value) => setSpec((prev) => ({ ...prev, [key]: value }));
  const patchN = (section, key, value) => setSpec((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  (0, import_react.useEffect)(() => {
    void api.models().then((res) => {
      setModelOptions(res.options);
      if (!chatModel && res.current?.provider && res.current?.model) {
        setChatModel(res.current.provider + "::" + res.current.model);
      }
    }).catch(() => void 0);
  }, []);
  (0, import_react.useEffect)(() => {
    void loadMusic().then((tracks) => {
      if (tracks.length) {
        setPlaylist(tracks.map((t) => ({ id: t.id, name: t.name, url: URL.createObjectURL(t.blob) })));
        setCurrentIndex(0);
      }
    });
  }, []);
  (0, import_react.useEffect)(() => {
    const el = document.getElementById("pt-chat-log");
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, chatSending]);
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
      const greeting = cleanPlaceholders(d.first_mes, d.name);
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
  const onSend = () => {
    const text = chatInput.trim();
    if (!text || chatSending || !card) return;
    const next = [...chatMessages, { role: "user", content: text }];
    setChatMessages(next);
    setChatInput("");
    setChatSending(true);
    setChatError("");
    const parts = (chatModel || "").split("::");
    const provider = parts.length >= 2 && parts[0] ? parts[0] : void 0;
    const model = parts.length >= 2 ? parts.slice(1).join("::") : void 0;
    void api.chat(card, next, provider, model).then((res) => {
      setChatMessages([...next, { role: "assistant", content: res.reply }]);
    }).catch((e) => setChatError(e instanceof Error ? e.message : "\u56DE\u590D\u5931\u8D25")).finally(() => setChatSending(false));
  };
  const onClearChat = () => {
    const g = card ? cleanPlaceholders(card.data.first_mes, card.data.name) : "";
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
  const nextTrack = () => setCurrentIndex((i) => playlist.length ? (i + 1) % playlist.length : -1);
  const prevTrack = () => setCurrentIndex((i) => playlist.length ? (i - 1 + playlist.length) % playlist.length : -1);
  const stopMusic = () => {
    setPlaylist([]);
    setCurrentIndex(-1);
    saveMusic([]);
  };
  const applyImportedCard = (obj) => {
    const cardObj = obj && typeof obj === "object" && "spec" in obj && "data" in obj ? obj : { spec: "chara_card_v2", spec_version: "2.0", data: obj };
    setCard(cardObj);
    setCharTab("preview");
    setError("");
    const greeting = cleanPlaceholders(cardObj.data.first_mes, cardObj.data.name);
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
    const obj = card ?? { spec: version === "v3" ? "chara_card_v3" : "chara_card_v2", spec_version: version === "v3" ? "3.0" : "2.0", data: { name: spec.basic.name || "\u672A\u547D\u540D\u89D2\u8272", description: describeSpec(spec), personality: "", scenario: "", first_mes: "", mes_example: "", creator_notes: "", system_prompt: "", post_history_instructions: "", alternate_greetings: [], tags: [], creator: "dsh-portable-tavern", character_version: "1.0", extensions: {} } };
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
  const secBasic = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u4E00\u3001\u57FA\u7840\u4FE1\u606F", hint: "\u5FC5\u586B", defaultOpen: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u89D2\u8272\u540D\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: css.stInput, value: spec.basic.name, onChange: (e) => patchN("basic", "name", e.target.value), placeholder: "\u89D2\u8272\u7684\u552F\u4E00\u6807\u8BC6" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u5E74\u9F84", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, { min: 10, max: 999, value: spec.basic.age, left: "10", right: "999", onChange: (v) => patchN("basic", "age", v) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: css.stCheck, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: spec.basic.ageUnknown, onChange: (e) => patchN("basic", "ageUnknown", e.target.checked) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u672A\u77E5/\u6C38\u751F" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u6027\u522B", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, { options: GENDERS, value: spec.basic.gender, onChange: (v) => patchN("basic", "gender", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, { label: "\u79CD\u65CF", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { className: css.stInput, value: spec.basic.race, onChange: (e) => patchN("basic", "race", e.target.value), children: RACE_OPTS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: o.value, children: o.label }, o.value)) }),
      spec.basic.race === "\u81EA\u5B9A\u4E49" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: css.stInput, value: spec.basic.raceCustom, onChange: (e) => patchN("basic", "raceCustom", e.target.value), placeholder: "\u81EA\u5B9A\u4E49\u79CD\u65CF" }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, { label: "\u804C\u4E1A", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { className: css.stInput, value: spec.basic.job, onChange: (e) => patchN("basic", "job", e.target.value), children: JOB_OPTS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: o.value, children: o.label }, o.value)) }),
      spec.basic.job === "\u81EA\u5B9A\u4E49" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: css.stInput, value: spec.basic.jobCustom, onChange: (e) => patchN("basic", "jobCustom", e.target.value), placeholder: "\u81EA\u5B9A\u4E49\u804C\u4E1A" }) : null
    ] })
  ] });
  const secAppearance = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u4E8C\u3001\u5916\u8C8C\u7279\u5F81", hint: "\u591A\u9009 + \u586B\u7A7A", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u8EAB\u9AD8", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, { min: 120, max: 260, value: spec.appearance.height, left: "\u77EE\u5C0F", right: "\u9AD8\u5927", onChange: (v) => patchN("appearance", "height", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u4F53\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: BUILDS, values: spec.appearance.build, onChange: (v) => patchN("appearance", "build", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u53D1\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ColorSwatches, { palette: HAIR_COLORS, value: spec.appearance.hairColor, onChange: (v) => patchN("appearance", "hairColor", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u53D1\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: HAIR_STYLES, values: spec.appearance.hairStyle, onChange: (v) => patchN("appearance", "hairStyle", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u77B3\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ColorSwatches, { palette: EYE_COLORS, value: spec.appearance.eyeColor, onChange: (v) => patchN("appearance", "eyeColor", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u80A4\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ColorSwatches, { palette: SKIN_COLORS, value: spec.appearance.skinColor, onChange: (v) => patchN("appearance", "skinColor", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, { label: "\u663E\u8457\u7279\u5F81", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: FEATURES, values: spec.appearance.features, multiple: true, onChange: (v) => patchN("appearance", "features", v) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomAdd, { values: spec.appearance.features, onAdd: (v) => patchN("appearance", "features", v), placeholder: "\u81EA\u5B9A\u4E49\u7279\u5F81\u2026" })
    ] })
  ] });
  const secPersonality = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u4E09\u3001\u6027\u683C\u4E0E\u884C\u4E3A", hint: "\u6ED1\u5757\u77E9\u9635 + \u5173\u952E\u8BCD", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u5916\u5411\u6027", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, { min: 1, max: 10, value: spec.personality.extroversion, left: "\u5185\u5411", right: "\u5916\u5411", onChange: (v) => patchN("personality", "extroversion", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u53CB\u5584\u5EA6", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, { min: 1, max: 10, value: spec.personality.agreeableness, left: "\u51B7\u6F20", right: "\u70ED\u60C5", onChange: (v) => patchN("personality", "agreeableness", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u5C3D\u8D23\u6027", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, { min: 1, max: 10, value: spec.personality.conscientiousness, left: "\u968F\u6027", right: "\u4E25\u8C28", onChange: (v) => patchN("personality", "conscientiousness", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u60C5\u7EEA\u7A33\u5B9A\u6027", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, { min: 1, max: 10, value: spec.personality.stability, left: "\u654F\u611F", right: "\u6C89\u7A33", onChange: (v) => patchN("personality", "stability", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u5F00\u653E\u6027", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, { min: 1, max: 10, value: spec.personality.openness, left: "\u4FDD\u5B88", right: "\u597D\u5947", onChange: (v) => patchN("personality", "openness", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u6027\u683C\u5173\u952E\u8BCD", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: TRAITS, values: spec.personality.traits, multiple: true, onChange: (v) => patchN("personality", "traits", v) }) })
  ] });
  const secBackground = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u56DB\u3001\u80CC\u666F\u4E0E\u4E16\u754C\u89C2", hint: "\u586B\u7A7A + \u5FEB\u6377\u6A21\u677F", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, { label: "\u51FA\u8EAB", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: ORIGINS, values: spec.background.origin, onChange: (v) => patchN("background", "origin", v) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: css.stInput, value: spec.background.origin, onChange: (e) => patchN("background", "origin", e.target.value), placeholder: "\u6216\u81EA\u5B9A\u4E49\u51FA\u8EAB" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u91CD\u8981\u7ECF\u5386", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 3, value: spec.background.experience, onChange: (e) => patchN("background", "experience", e.target.value), placeholder: "\u5F71\u54CD\u89D2\u8272\u6027\u683C\u7684\u5173\u952E\u4E8B\u4EF6" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u4E16\u754C\u89C2\u8BBE\u5B9A", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 3, value: spec.background.world, onChange: (e) => patchN("background", "world", e.target.value), placeholder: "\u6545\u4E8B\u53D1\u751F\u7684\u4E16\u754C\u80CC\u666F" }) })
  ] });
  const secAbilities = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u4E94\u3001\u80FD\u529B\u4E0E\u7279\u957F", hint: "\u6807\u7B7E\u591A\u9009 + \u81EA\u5B9A\u4E49", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: ABILITIES, values: spec.abilities, multiple: true, onChange: (v) => patch("abilities", v) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomAdd, { values: spec.abilities, onAdd: (v) => patch("abilities", v), placeholder: "\u81EA\u5B9A\u4E49\u80FD\u529B\u2026" })
  ] });
  const secDialogue = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u516D\u3001\u5BF9\u8BDD\u98CE\u683C", hint: "\u5355\u9009 + \u5F15\u5BFC", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u98CE\u683C\u9884\u8BBE", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { className: css.stInput, value: spec.dialogue.style, onChange: (e) => patchN("dialogue", "style", e.target.value), children: STYLE_OPTS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: o.value, children: o.label }, o.value)) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u8BED\u6C14", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: TONES, values: spec.dialogue.tone, onChange: (v) => patchN("dialogue", "tone", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u4EBA\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, { options: PERSON_OPTS, value: spec.dialogue.person, onChange: (v) => patchN("dialogue", "person", v) }) })
  ] });
  const secScenario = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u4E03\u3001\u573A\u666F\u4E0E\u5F00\u573A", hint: "\u53EF\u9009", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u573A\u666F\u6A21\u677F", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: SCENE_TEMPLATES, values: spec.scenario.sceneTemplate, onChange: (v) => patchN("scenario", "sceneTemplate", v) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u521D\u59CB\u573A\u666F", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 2, value: spec.scenario.scene, onChange: (e) => patchN("scenario", "scene", e.target.value), placeholder: "\u81EA\u5B9A\u4E49\u521D\u59CB\u573A\u666F\u63CF\u8FF0" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u5F00\u573A\u767D\u98CE\u683C", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chips, { options: OPENER_STYLES, values: spec.scenario.openerStyle, onChange: (v) => patchN("scenario", "openerStyle", v) }) })
  ] });
  const renderPreview = () => {
    if (generating) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stEmpty, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stSpinner }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "\u6B63\u5728\u751F\u6210\u89D2\u8272\u5361\u2026" })
    ] });
    if (card) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        fallback ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stNotice, children: "\u6CE8\u610F\uFF1A\u6A21\u578B\u8F93\u51FA\u672A\u80FD\u89E3\u6790\uFF0C\u5DF2\u4F7F\u7528\u8BBE\u5B9A\u76F4\u63A5\u7EC4\u88C5\uFF08\u964D\u7EA7\u6A21\u5F0F\uFF09\u3002\u53EF\u5728\u300C\u7F16\u8F91\u300D\u9875\u5FAE\u8C03\u3002" }) : null,
        fallback && rawText ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: css.stRaw, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { className: css.stRawSummary, children: "\u67E5\u770B\u6A21\u578B\u539F\u59CB\u8F93\u51FA" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: css.stRawPre, children: rawText })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardPreview, { card })
      ] });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stLiveHint, children: "\u5B9E\u65F6\u9884\u89C8\uFF08\u57FA\u4E8E\u5F53\u524D\u8BBE\u5B9A\uFF0C\u751F\u6210\u540E\u66FF\u6362\u4E3A\u5B8C\u6574\u89D2\u8272\u5361\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: css.stLivePre, children: describeSpec(spec) })
    ] });
  };
  const renderEdit = () => {
    if (!card) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stEmpty, children: "\u8BF7\u5148\u70B9\u51FB\u300C\u751F\u6210\u89D2\u8272\u5361\u300D" });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stEdit, children: CARD_FIELDS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: f.label, children: f.area ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 4, value: cardFieldValue(f.key), onChange: (e) => onCardFieldChange(f.key, e.target.value) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: css.stInput, value: cardFieldValue(f.key), onChange: (e) => onCardFieldChange(f.key, e.target.value) }) }, f.key)) });
  };
  const renderJson = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: cx(css.stInput, css.stTextarea, css.stJsonArea), value: jsonDraft, onChange: (e) => setJsonDraft(e.target.value) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", onClick: onApplyJson, children: "\u5E94\u7528\u4FEE\u6539" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: exportJson, children: "\u5BFC\u51FA JSON" })
    ] })
  ] });
  const renderWorldbook = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", disabled: wbGenerating, onClick: () => onWorldbook(false), children: wbGenerating ? "\u751F\u6210\u4E2D\u2026" : "\u751F\u6210\u4E16\u754C\u4E66" }),
      worldbook && worldbook.entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { disabled: wbGenerating, onClick: () => onWorldbook(true), children: "\u8865\u5168\u4E16\u754C\u4E66" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: css.stBtn, children: [
        "\u5BFC\u5165\u4E16\u754C\u4E66",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", accept: ".json,application/json", style: { display: "none" }, onChange: onImportWorldbookFile })
      ] })
    ] }),
    wbError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stNotice, children: wbError }) : null,
    worldbook && worldbook.entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stNotice, children: "\u672A\u80FD\u89E3\u6790\u51FA\u4E16\u754C\u4E66\u6761\u76EE\u3002\u53EF\u70B9\u300C\u8865\u5168\u4E16\u754C\u4E66\u300D\u6839\u636E\u5DF2\u751F\u6210\u7684\u4EBA\u7269\u5361\u91CD\u65B0\u751F\u6210\uFF0C\u6216\u5BFC\u5165\u5DF2\u6709\u4E16\u754C\u4E66 JSON\u3002" }) : null,
    worldbook?.entries.map((en, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stWbEntry, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stWbKeys, children: (en.keys ?? []).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stWbKey, children: k }, k)) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stCardBlockText, children: en.content }),
      en.comment ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stWbComment, children: en.comment }) : null
    ] }, i)),
    worldbook && worldbook.entries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: () => downloadFile((spec.basic.name || "character") + ".worldbook.json", new Blob([JSON.stringify({ entries: worldbook.entries }, null, 2)], { type: "application/json" })), children: "\u5BFC\u51FA\u4E16\u754C\u4E66 JSON" }) : null
  ] });
  const renderCharacter = () => {
    const resultBody = charTab === "preview" ? renderPreview() : charTab === "edit" ? renderEdit() : charTab === "json" ? renderJson() : renderWorldbook();
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stChar, children: [
      secBasic,
      secAppearance,
      secPersonality,
      secBackground,
      secAbilities,
      secDialogue,
      secScenario,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stActions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", disabled: generating, onClick: onGenerate, children: generating ? "\u751F\u6210\u4E2D\u2026" : "\u751F\u6210\u89D2\u8272\u5361" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: exportJson, children: "\u5BFC\u51FA JSON" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: css.stBtn, children: [
          "\u5BFC\u5165\u89D2\u8272\u5361",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", accept: ".json,.png,application/json,image/png", style: { display: "none" }, onChange: onImportCardFile })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: css.stVerToggle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stVerBtn, version === "v2" && css.stVerActive), onClick: () => setVersion("v2"), children: "V2" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stVerBtn, version === "v3" && css.stVerActive), onClick: () => setVersion("v3"), children: "V3" })
        ] }),
        error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stNotice, children: error }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stTpl, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stTplHead, children: "\u6A21\u677F\uFF08\u4FDD\u5B58/\u8F7D\u5165\u5F53\u524D\u8BBE\u5B9A\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stCustomAdd, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: css.stInput, value: templateName, onChange: (e) => setTemplateName(e.target.value), placeholder: "\u6A21\u677F\u540D\u79F0" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: onSaveTemplate, children: "\u4FDD\u5B58\u6A21\u677F" })
        ] }),
        templates.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stChipWrap, children: templates.map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: css.stTplItem, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: css.stChip, onClick: () => setSpec(JSON.parse(JSON.stringify(t.spec))), children: t.name }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: css.stTplDel, title: "\u5220\u9664", onClick: () => {
            const list = templates.filter((_, j) => j !== i);
            setTemplates(list);
            saveTemplates(list);
          }, children: "x" })
        ] }, i)) }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stResultWrap, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stResultTabs, children: [{ id: "preview", label: "\u9884\u89C8" }, { id: "edit", label: "\u7F16\u8F91" }, { id: "json", label: "JSON" }, { id: "worldbook", label: "\u4E16\u754C\u4E66" }].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stTab, charTab === t.id && css.stTabActive), onClick: () => setCharTab(t.id), children: t.label }, t.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stResultBody, children: resultBody })
      ] })
    ] });
  };
  const renderSettings = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stChar, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, { title: "\u5916\u89C2", defaultOpen: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u9762\u677F\u5BBD\u5EA6\uFF1A" + tavern.width + "px", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, { min: 360, max: 820, value: tavern.width, left: "\u7A84", right: "\u5BBD", onChange: (v) => updateTavern("width", v) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u4E3B\u9898\u8272", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stSwatches, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "color", value: tavern.accent, onChange: (e) => updateTavern("accent", e.target.value), className: css.stColorInput }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: cx(css.stInput, css.stColorText), value: tavern.accent, onChange: (e) => updateTavern("accent", e.target.value) })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: "\u80CC\u666F\u56FE\u7247", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: css.stBtn, children: [
          "\u9009\u62E9\u56FE\u7247",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: onBgImageFile })
        ] }),
        bgImage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: () => {
          setBgImage("");
          saveBgImage("");
        }, children: "\u6E05\u9664" }) : null
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, { title: "\u672C\u5730\u97F3\u4E50", defaultOpen: true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, { label: "\u672C\u5730\u97F3\u4E50\uFF08\u652F\u6301\u6587\u4EF6\u5939\u3001\u6309\u987A\u5E8F\u64AD\u653E\uFF09", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx(css.stRow, css.stGap), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: css.stBtn, children: [
          "\u6253\u5F00\u6587\u4EF6\u5939",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", ...{ webkitdirectory: "true", directory: "true" }, multiple: true, accept: "audio/*", style: { display: "none" }, onChange: onMusicFolder })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: css.stBtn, children: [
          "\u9009\u62E9\u5355\u66F2",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "file", accept: "audio/*", style: { display: "none" }, onChange: onMusicFile })
        ] }),
        playlist.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: stopMusic, children: "\u505C\u6B62\u5E76\u6E05\u7A7A" }) : null
      ] }),
      playlist.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stLabel, children: [
        "\u64AD\u653E\u5217\u8868\uFF08",
        playlist.length,
        " \u9996\uFF09"
      ] }) : null
    ] }) })
  ] });
  const renderChat = () => {
    if (!card) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stEmpty, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stEmptyEmoji, children: "Tavern" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "\u8FD8\u6CA1\u6709\u89D2\u8272\u3002\u8BF7\u5148\u5230\u300C\u89D2\u8272\u5361\u300D\u9875\u8BBE\u5B9A/\u5BFC\u5165\u89D2\u8272\uFF0C\u518D\u6765\u5F00\u804A\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", onClick: () => setTab("character"), children: "\u53BB\u521B\u5EFA\u89D2\u8272" })
      ] });
    }
    const d = card.data;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stChat, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stChatHead, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stChatAvatar, style: { background: avatarGradient(spec) }, children: (d.name || "?").slice(0, 1) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stChatMeta, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stChatName, children: d.name || "\u672A\u547D\u540D\u89D2\u8272" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { className: cx(css.stInput, css.stChatModel), value: chatModel, onChange: (e) => setChatModel(e.target.value), children: [
            modelOptions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: "\u52A0\u8F7D\u6A21\u578B\u2026" }) : null,
            modelOptions.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: o.provider + "::" + o.model, children: o.label }, o.provider + "::" + o.model))
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: onClearChat, title: "\u6E05\u7A7A\u5BF9\u8BDD", children: "\u6E05\u7A7A" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "pt-chat-log", className: css.stChatLog, children: chatMessages.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx(css.stMsg, m.role === "assistant" ? css.stMsgChar : css.stMsgUser), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stMsgBubble, children: m.content }) }, i)) }),
      chatError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cx(css.stNotice, css.stChatError), children: chatError }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stChatInput, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: cx(css.stInput, css.stTextarea), rows: 2, value: chatInput, onChange: (e) => setChatInput(e.target.value), placeholder: "\u8F93\u5165\u5BF9\u767D\u6216\u52A8\u4F5C\u2026\uFF08Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C\uFF09", onKeyDown: (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { variant: "primary", disabled: chatSending || !chatInput.trim(), onClick: onSend, children: chatSending ? "\u2026" : "\u53D1\u9001" })
      ] })
    ] });
  };
  const track = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stPanel, style: { width: tavern.width, "--st-accent": tavern.accent, visibility: props.open ? "visible" : "hidden", pointerEvents: props.open ? "auto" : "none" }, children: [
    bgImage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stPanelBg, style: { backgroundImage: "url(" + bgImage + ")" } }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stPanelHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.stPanelTitle, children: "\u4FBF\u643A\u9152\u9986" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: css.stClose, onClick: () => props.store.set(false), children: "\xD7" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stTabbar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stTab, tab === "character" && css.stTabActive), onClick: () => setTab("character"), children: "\u89D2\u8272\u5361" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stTab, tab === "chat" && css.stTabActive), onClick: () => setTab("chat"), children: "\u804A\u5929" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stTab, tab === "settings" && css.stTabActive), onClick: () => setTab("settings"), children: "\u8BBE\u7F6E" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stPanelBody, children: tab === "chat" ? renderChat() : tab === "settings" ? renderSettings() : renderCharacter() }),
    track ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stMusicBar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("audio", { className: css.stAudio, src: track.url, controls: true, autoPlay: true, onEnded: nextTrack }, currentIndex),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stMusicInfo, title: track.name, children: currentIndex + 1 + "/" + playlist.length + " \xB7 " + track.name }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: prevTrack, title: "\u4E0A\u4E00\u9996", children: "\u4E0A\u4E00\u9996" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: nextTrack, title: "\u4E0B\u4E00\u9996", children: "\u4E0B\u4E00\u9996" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, { onClick: stopMusic, title: "\u505C\u6B62", children: "\u505C\u6B62" })
    ] }) : null
  ] });
}
var dragState = null;
var dragged = false;
function TavernRoot(props) {
  const open = useStoreValue(props.store);
  const [pos, setPos] = (0, import_react.useState)(() => {
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
  const trigger = dock === "left" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stTrigger, css.stTriggerDockedLeft), style: { left: 0, top: pos.top }, ...shared, children: "\u4FBF\u643A\u9152\u9986" }) : dock === "right" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stTrigger, css.stTriggerDockedRight), style: { right: 0, top: pos.top }, ...shared, children: "\u4FBF\u643A\u9152\u9986" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stTrigger, css.stTriggerFloat), style: { left: pos.left, top: pos.top }, ...shared, children: "\u4FBF\u643A\u9152\u9986" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stRoot, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: open ? "none" : "block" }, children: trigger }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortableTavern, { store: props.store, open })
  ] });
}
function SettingsEntry(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.stSettingsEntry, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.stSettingsTitle, children: "\u4FBF\u643A\u9152\u9986" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: css.stSettingsDesc, children: "RPG \u89D2\u8272\u5361\u751F\u6210 + \u9152\u9986\u804A\u5929\u4E00\u4F53\u3002\u901A\u8FC7\u53EF\u89C6\u5316\u9762\u677F\u5851\u9020\u89D2\u8272\uFF0C\u4E00\u952E\u751F\u6210 SillyTavern \u89D2\u8272\u5361\uFF0C\u5E76\u76F4\u63A5\u5728\u53F3\u4FA7\u4E0E\u89D2\u8272\u5BF9\u8BDD\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: cx(css.stBtn, css.stBtnPrimary), onClick: props.onOpen, children: "\u6253\u5F00\u4FBF\u643A\u9152\u9986" })
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
    () => (0, import_react2.createElement)(TavernRoot, { store })
  ));
  slots.inject("settings.section", () => slots.register(
    { name: "settings.section", id: "dsh-portable-tavern", order: 60, label: "\u4FBF\u643A\u9152\u9986" },
    () => (0, import_react2.createElement)(SettingsEntry, { onOpen: () => store.set(true) })
  ));
}
return module.exports; } });
//# sourceMappingURL=client.js.map

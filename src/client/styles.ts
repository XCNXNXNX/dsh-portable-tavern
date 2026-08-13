/**
 * Injected stylesheet for the portable tavern panel. A plain CSS string
 * (standalone plugins ship one client bundle, so there are no CSS artifacts);
 * the `css` object maps the camelCase keys used in PortableTavern.tsx to the
 * same-named class selectors in CSS_TEXT.
 */

export const css = new Proxy({}, { get: (_target, key: string) => key }) as Record<string, string>

const CSS_TEXT = `
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
`

export function adoptStyles(): void {
  if (typeof document === 'undefined') return
  const id = 'dsh-portable-tavern-styles'
  if (document.getElementById(id)) return
  const tag = document.createElement('style')
  tag.id = id
  tag.dataset.plugin = 'dsh-portable-tavern'
  tag.textContent = CSS_TEXT
  document.head.appendChild(tag)
}

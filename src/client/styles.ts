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
`

/** The generated stylesheet text (also used by the theme preview). */
export function stylesheetText(): string {
  return CSS_TEXT
}

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

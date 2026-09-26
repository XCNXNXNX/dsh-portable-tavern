/**
 * SillyTavern 扩展兼容宿主的统一入口（src/client/st/）。
 *
 * 酒馆面板只需要三行：
 *   const host = createStHost()
 *   host.install({ getContext, onSend, onSettings, onWarn })
 *   host.load({ id, js, css, base })
 *
 * 文件分工：
 * - types.ts      公共类型（StMirror / StHostOptions / StLoadResult / StHost / StToastr）
 * - emitter.ts    eventSource 复刻（await 串行 / 吞异常 / APP_READY 补发）+ event_types 全表
 * - libs-pure.ts  纯逻辑库：lodash 子集 / Handlebars 子集 / Fuse / Bowser / hljs / localforage / sanitize 降级
 * - libs.ts       window.SillyTavern.libs 装配（DOMParser 版 DOMPurify、复用页面 lodash）
 * - dom.ts        DOM 骨架（#extensions_settings / #chat 镜像 / #movingDivs / toast / loader / 主题变量）
 * - jquery.ts     迷你 jQuery（window.$ / window.jQuery）
 * - slash.ts      斜杠命令与弹窗的最小兼容面（P2）
 * - context.ts    getContext() 的完整兼容面（extensionSettings 稳定引用、宏替换、模板渲染…）
 * - host.ts       createStHost()：加载 / 卸载 / 事件 / 全局注入（含 window.__tavernSt 契约）
 * - CONTRACT.md   window.__tavernSt 的键名契约（与 Node 半的桩生成器同步维护）
 * - __selftest.mjs  纯逻辑自检（node --experimental-strip-types 直接跑）
 */
export type { StExtensionSource, StHost, StHostOptions, StLoadResult, StMessage, StMirror, StToastKind, StToastr, } from './types.ts';
export { ST_METADATA_KEY, ST_SETTINGS_KEY, createStHost } from './host.ts';
export { REPLAY_EVENTS, StEventSource, createEventSource, event_types, eventTypes } from './emitter.ts';
export type { StEventListener, StListenerRecord } from './emitter.ts';
export { createCssLib, createDOMPurify, createMemoryStorage, createStLibs, resolveStorage } from './libs.ts';
export type { StCssLib, StDOMPurify, StFuseConstructor, StLibs } from './libs.ts';
export { baseIteratee, cloneDeep, createBowser, createFuseClass, createHandlebars, createHljs, createLocalforage, debounce, detectIsMobile, entriesOf, escapeHtml, getPath, hasPath, isEqual, isPlainObject, lodashSubset, mergeDeep, parseUserAgent, sanitizeHtmlFallback, setPath, throttle, toPath, toStringValue, } from './libs-pure.ts';
export type { StBowser, StBowserParser, StDebounced, StFuseInstance, StFuseOptions, StFuseResult, StHandlebars, StHandlebarsTemplate, StHljs, StHljsResult, StIteratee, StLodash, StLocalforage, StSanitizeOptions, StStorageLike, StUaInfo, } from './libs-pure.ts';
export { PT_EXT_MOUNT_ID, ST_EXT_DOCK_ID, ST_EXT_PANEL_ID, ST_LOADER_ID, ST_ROOT_ID, ST_STYLE_ID, ST_THEME_VARS_ID, ST_TOASTS_ID, TRACKED_MOUNT_IDS, addedChildrenSince, applyThemeVars, captureMounts, clearToasts, createDomWatcher, disposeSkeleton, installSkeleton, removeHeadBodyNodes, setLoader, showToast, syncChatMirror, } from './dom.ts';
export type { StDomWatcher, StSkeleton, StSkeletonOptions } from './dom.ts';
export { createJQuery } from './jquery.ts';
export type { StAjaxOptions, StJQueryCollection, StJQueryStatic, StJQueryXhr } from './jquery.ts';
export { ARGUMENT_TYPE, POPUP_RESULT, POPUP_TYPE, callGenericPopup, createPopupClass, createSlashCommandClass, createSlashCommandParser, makeSlashCommand, } from './slash.ts';
export type { StPopupClass, StPopupInstance, StPopupOptions, StSlashCommandClass, StSlashCommandDescriptor, StSlashCommandObject, StSlashCommandParserFace, } from './slash.ts';
export { createAccountStorage, createPowerUser, createStContext, estimateTokens } from './context.ts';
export type { StCharacter, StContext, StContextDeps, StContextHandle } from './context.ts';

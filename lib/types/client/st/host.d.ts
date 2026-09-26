/**
 * 兼容宿主实现：createStHost()。
 *
 * 对外契约（酒馆面板只用这些）：install / load / unload / emit / setThemeVars / toast / loaded / dispose。
 *
 * 注入的全局（install 时建立，dispose 时按原样还原）：
 * - window.SillyTavern = { libs, getContext, eventSource, event_types, eventTypes, ... }
 * - window.__tavernSt  ← 桩模块取值入口（Node 半改写的 import 会读它，键名必须完全一致）：
 *     eventSource, event_types, eventTypes, extension_settings, power_user, saveSettingsDebounced,
 *     saveMetadataDebounced, getRequestHeaders, renderTemplateAsync, renderExtensionTemplateAsync,
 *     substituteParams, substituteParamsExtended, chat_metadata, chatMetadata, isMobile, DOMPurify,
 *     Bowser, accountStorage, SlashCommandParser, SlashCommand, ARGUMENT_TYPE, executeSlashCommands,
 *     callGenericPopup, Popup, POPUP_TYPE, POPUP_RESULT, toastr, getContext, characters, this_chid,
 *     name1, name2, main_api, onlineStatus, getSlideToggleOptions, initMovingUI, favsToHotswap
 *     说明：有真实实现的挂真实对象；没有真实实现的挂**函数型 no-op**（返回 undefined），
 *     保证扩展的 typeof x === 'function' 判断不会失败。extension_settings / power_user /
 *     chat_metadata 与 getContext() 返回的是同一个稳定对象。
 * - window.toastr = { info, success, warning, error, clear }
 * - window.$ / window.jQuery = 迷你 jQuery（页面已有 jQuery 时不覆盖）
 * - window._ = 自带 lodash 子集（页面已有 lodash 时不覆盖）
 * - window.__tavernStStub(path)：未实现时给一个保守默认（Node 半可覆盖）
 *
 * 健壮性：所有对外方法都 try/catch；扩展加载窗口内的异常会归因到该扩展并写进 load() 的 error。
 */
import type { StHost, StToastr } from './types.ts';
declare global {
    interface Window {
        /** ST 兼容全局（libs + getContext）。 */
        SillyTavern?: Record<string, unknown>;
        /** 桩模块取值入口（Node 半改写的 import 读它）。 */
        __tavernSt?: Record<string, unknown>;
        /** ST 的 toastr 契约。 */
        toastr?: StToastr;
        /** 迷你 jQuery（页面没有 jQuery 时才写入）。 */
        $?: unknown;
        /** 迷你 jQuery 别名。 */
        jQuery?: unknown;
        /** 深链模块兜底 URL 工厂（Node 半可覆盖）。 */
        __tavernStStub?: (path: string) => string;
        /** 页面已有的 lodash（存在则复用）。 */
        _?: unknown;
        /** 页面已有的 lodash（别名）。 */
        lodash?: unknown;
    }
}
/** extension_settings 的 localStorage 键。 */
export declare const ST_SETTINGS_KEY = "dsh.portable-tavern.st.extension-settings.v1";
/** chat_metadata 的 localStorage 键。 */
export declare const ST_METADATA_KEY = "dsh.portable-tavern.st.chat-metadata.v1";
/**
 * 创建兼容宿主。酒馆面板只创建一个（useState(() => createStHost())[0]），
 * install() 可以在 React StrictMode 下被 install → dispose → install 反复调用。
 */
export declare function createStHost(): StHost;

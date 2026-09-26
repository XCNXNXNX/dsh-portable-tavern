# window.__tavernSt 契约（兼容宿主 <-> Node 半桩生成器）

Node 半在安装扩展时，会把扩展里指向 SillyTavern 内部的 import（例如
import { power_user } from '../../../../power-user.js'）改写成按需生成的桩模块。
桩模块统一这样取值：

    const host = (typeof window !== 'undefined' && window.__tavernSt) || {}
    export const eventSource = (host.eventSource !== undefined ? host.eventSource : noop)

因此兼容宿主在 install() 时会把真实实现挂到 window.__tavernSt（普通对象），
dispose() 时 delete window.__tavernSt（若原本已存在则还原原值）。

## 键名清单（必须完全一致）

| 键 | 取值 |
| --- | --- |
| eventSource | 真实事件总线（StEventSource） |
| event_types / eventTypes | 真实事件常量表 |
| extension_settings | 稳定对象（与 getContext().extensionSettings 同一个引用） |
| power_user | 稳定对象（本宿主给常用字段的默认值） |
| saveSettingsDebounced | 真实（防抖 500ms 写 localStorage + 通知面板 onSettings） |
| saveMetadataDebounced | 真实（防抖 500ms 写 chat_metadata） |
| getRequestHeaders | 真实（返回 Content-Type: application/json） |
| renderExtensionTemplateAsync | 真实（/tavern-ext/<ext>/<tpl>.html + Handlebars，失败返回空串） |
| renderTemplateAsync | 真实（走 /tavern-ext/template/<tpl>.html） |
| substituteParams / substituteParamsExtended | 真实（{{user}} {{char}} {{time}} {{date}} {{newline}} 等） |
| chat_metadata / chatMetadata | 稳定对象（与 getContext().chatMetadata 同一个引用） |
| isMobile | boolean |
| DOMPurify / Bowser | 真实（libs 里的实现） |
| accountStorage | 函数型对象：可当 no-op 函数调用，也有 getItem/setItem/removeItem/clear/keys（Promise） |
| SlashCommandParser | 真实注册表（addCommand 存表，执行抛清晰错误） |
| SlashCommand | 真实类（fromProps / fromJson） |
| ARGUMENT_TYPE | 真实常量 |
| executeSlashCommands | 真实函数：抛清晰错误 + onWarn（本宿主没有命令管线） |
| callGenericPopup / Popup / POPUP_TYPE / POPUP_RESULT | 真实（window.confirm / prompt 实现） |
| toastr | 真实（info/success/warning/error/clear → 宿主 toast） |
| getContext | 真实（返回完整 ST context，动态字段每次刷新） |
| characters | 稳定数组（最多一个角色，内容随镜像刷新） |
| this_chid | 0（有角色）/ undefined（无角色） |
| name1 / name2 / main_api / onlineStatus | 随镜像刷新 |
| getSlideToggleOptions / initMovingUI / favsToHotswap | 函数型 no-op（返回 undefined） |

要点：

1. 有真实实现的挂真实对象；没有真实实现的也必须是函数型 no-op，
   不能留空 —— 留空会退回桩模块的默认值，函数型 no-op 至少不会在
   typeof 判断里失败。
2. extension_settings / power_user / chat_metadata 是稳定引用，
   与 getContext() 返回的是同一个对象（扩展直接改字段即可生效）。
3. name1 / name2 / this_chid / characters / main_api / onlineStatus 会
   在每次 getContext() 与每次镜像轮询（约 900ms）时刷新；桩模块在
   模块顶层读到的值可能偏旧，需要实时的请用 getContext()。
4. 宿主这一侧的名单维护在 src/client/st/host.ts 的 buildStubHost() 与本文件里；
   Node 半的桩生成器请同步维护同一份名单。

## 其它注入的全局

- window.SillyTavern = { libs, getContext, eventSource, event_types, eventTypes, version }
- window.toastr = { info, success, warning, error, clear }
- window.$ / window.jQuery = 迷你 jQuery（页面已有 jQuery 时不覆盖）
- window._ / window.lodash = 自带 lodash 子集（页面已有 lodash 时不覆盖）
- window.__tavernStStub(path)：仅在缺失时写一个保守默认（返回桩路由 URL）；
  Node 半若有自己的桩路由可以覆盖它，宿主自身不调用这个函数。

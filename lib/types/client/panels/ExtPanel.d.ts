/**
 * 酒馆插件商店 / 扩展管理面板。
 *
 * 五段式布局：内置美化主题（自带社区美化插件的门面）、已安装扩展的启停与
 * 卸载、四种来源的安装入口、社区推荐清单、兼容性日志。数据一律走 TavernApi
 * （extList / extCatalog / extInstall / extRemove），组件自己不 fetch，也不关心
 * 宿主把扩展装在了哪个目录。
 */
import type * as React from 'react';
import type { TavernApi } from '../api.ts';
export interface ExtPanelProps {
    /** 数据访问层。 */
    api: TavernApi;
    /** 当前已启用（已加载）的扩展 id 集合。 */
    enabled: string[];
    /** 切换某个扩展的启用状态。 */
    onToggle: (id: string, on: boolean) => void;
    /** 已安装扩展发生变化（安装/删除成功）后通知父组件重新拉取列表与重新加载。 */
    onChanged: () => void;
    /** 兼容宿主产生的日志（加载失败、被桩掉的模块、告警）。 */
    log: string[];
    /** 当前生效的内置主题 id（'' 表示无）。 */
    theme: string;
    /** 应用内置主题；传 '' 表示清除。 */
    onTheme: (id: string) => void;
}
/** 酒馆插件商店 / 扩展管理面板。 */
export declare function ExtPanel(props: ExtPanelProps): React.ReactElement;

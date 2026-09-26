/**
 * 队伍编辑器面板：一支队伍的名称、成员、旁白者，以及每个成员各自的模型接入。
 *
 * 纯受控组件 -- 面板自己不持有队伍数据，任何编辑都构造一份新的 Party 交给
 * props.onChange，持久化（队伍库存取 / localStorage）由父组件负责。队伍模型、
 * 预设表与解析工具全部复用 client/party.ts，本文件只做展示与交互。
 */
import type * as React from 'react';
import { type Party } from '../../protocol.ts';
/** PartyPanel 的全部输入：受控的队伍、编辑回调、队伍库与模型选项。 */
export interface PartyPanelProps {
    /** 当前正在编辑的队伍（受控）。 */
    party: Party;
    /** 任何编辑都通过它整份替换（父组件负责持久化）。 */
    onChange: (next: Party) => void;
    /** 已保存的队伍库。 */
    library: Party[];
    /** 把当前队伍存入队伍库（按 id 覆盖）。 */
    onSave: () => void;
    /** 从队伍库载入一支队伍到桌面。 */
    onLoad: (id: string) => void;
    /** 从队伍库删除一支队伍。 */
    onDelete: (id: string) => void;
    /** DSH 可用模型列表，供每个成员单独指定模型。 */
    modelOptions: {
        provider: string;
        model: string;
        label: string;
    }[];
    /** 全局自定义接口是否已配置完整。 */
    customConfigured: boolean;
    /** 全局自定义接口的模型名，用于「跟随全局」的说明文字。 */
    customModel: string;
}
/**
 * 队伍编辑器：队伍总览条 + 队伍级设置 + 成员卡片列表 + 队伍库。
 *
 * 所有写入路径都走 props.onChange(新对象)，不修改 props 里的任何引用；
 * 成员卡片默认全部展开，点总览条里的头像可展开并滚动到对应成员。
 */
export declare function PartyPanel(props: PartyPanelProps): React.ReactElement;

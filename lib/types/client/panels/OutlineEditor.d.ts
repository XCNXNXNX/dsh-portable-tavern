import type * as React from 'react';
import type { AdventureSetup, PartyMember } from '../../protocol.ts';
import type { TavernApi } from '../api.ts';
/** 编辑器需要的全部输入。 */
export interface OutlineEditorProps {
    /** 数据访问层。 */
    api: TavernApi;
    /** 当前队伍，用于让 AI 按队伍来写剧本。 */
    party: PartyMember[];
    /** 受控的剧本 + 大纲。 */
    setup: AdventureSetup;
    /** 任何编辑都整份替换。 */
    onChange: (next: AdventureSetup) => void;
    /** 当前聊天模型路由，编码为 provider::model 或 custom::。 */
    chatModel: string;
    /** 已经触发过的节点 id（只读展示用）。 */
    firedBeats: string[];
}
/**
 * 剧本与大纲编辑器：上半写底本，下半编排节点。
 * @param props - 数据访问层、当前队伍、受控的 setup 与它的写回函数。
 */
export declare function OutlineEditor(props: OutlineEditorProps): React.ReactElement;

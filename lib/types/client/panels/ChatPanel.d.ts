/**
 * 聊天面板：把便携酒馆原先挤在 PortableTavern 里的 renderChat 抽成独立面板，
 * 并加上“和队伍成员单独聊天”的能力 —— 每个会话目标（角色卡 / 每名队员）各有
 * 一条对话记录，点顶部的 chip 就能换人说话；冒险进行中时还能把商量的结论直接
 * 送回冒险窗口的行动输入框。
 *
 * 纯受控组件：面板自己不持有对话数据，threads / target / chatModel 都由父组件
 * 传入并回写，持久化与标签页切换留在父组件。本文件不 import PortableTavern，
 * 用到的 cleanPlaceholders / avatarGradient 等小工具在这里各留一份等价实现。
 */
import type * as React from 'react';
import type { CharCard, ChatMessage, Party, TavernSpec } from '../../protocol.ts';
import type { TavernApi } from '../api.ts';
/**
 * 聊天面板的全部输入。面板是纯受控的：对话记录、当前目标与模型路由都由父组件
 * 持有，面板只负责渲染与回写。
 */
export interface ChatPanelProps {
    api: TavernApi;
    /** 当前角色卡，可能为空。 */
    card: CharCard | null;
    /** 角色卡头像（data URL）。 */
    cardAvatar: string;
    /** 角色卡对应的 spec，用于生成头像渐变兜底。 */
    spec: TavernSpec;
    /** 当前队伍。 */
    party: Party;
    /** 每个会话目标各自的对话记录：键是 'card' 或成员 id。 */
    threads: Record<string, ChatMessage[]>;
    onThreads: (next: Record<string, ChatMessage[]>) => void;
    /** 当前打开的目标：'card' 或成员 id。 */
    target: string;
    onTarget: (next: string) => void;
    /** 全局系统提示词。 */
    globalPrompt: string;
    /** 当前模型路由，编码为 provider::model 或 custom::。 */
    chatModel: string;
    onModel: (next: string) => void;
    modelOptions: {
        provider: string;
        model: string;
        label: string;
    }[];
    customConfigured: boolean;
    customModel: string;
    /** 正在进行的冒险（没有就是 undefined），成员聊天需要知道。 */
    adventure?: {
        scene: string;
        beat: string;
        encounter: {
            title: string;
            description: string;
            options: string[];
        } | null;
    };
    /** 把这次商量的计划带进冒险窗口。 */
    onCarryPlan: (plan: string) => void;
    /** 没有角色卡时引导用户去创建。 */
    onGotoCharacter: () => void;
}
/**
 * 聊天面板本体。
 *
 * 目标解析：props.target 指向一个已不存在的成员时，本帧按 'card' 渲染，
 * 并在 effect 里把 target 纠正回 'card'（渲染期间绝不调用 onTarget）。
 * 冒险横幅在角色卡与成员两种目标下都会显示；“把计划带进冒险”按钮两边都给，
 * 摘要里的称呼随当前目标变化（成员名 / 角色名）。
 * @param props - 见 {@link ChatPanelProps}。
 */
export declare function ChatPanel(props: ChatPanelProps): React.ReactElement;

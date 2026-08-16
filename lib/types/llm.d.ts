/**
 * LLM-backed helpers shared by the /api/dsh-portable-tavern routes. Everything
 * rides the official `@deepseek-ai/dsh-llm` service (ctx.llm) — one-shot
 * hand-built calls, no agent loop, no DSH source changes.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { GenerateOptions, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import type { CharCard, ChatMessage, LlmCustom, TavernSpec } from './protocol.ts';
/** Stable generation prompt used by generate/worldbook. */
export declare const SYSTEM = "\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684 SillyTavern \u89D2\u8272\u5361\u64B0\u5199\u4E13\u5BB6\uFF0C\u64C5\u957F\u5851\u9020\u9C9C\u6D3B\u3001\u7ACB\u4F53\u3001\u6709\u8BB0\u5FC6\u70B9\u7684\u89D2\u8272\u3002\u4F60\u4E25\u683C\u9075\u5FAA\u7528\u6237\u7684\u8F93\u51FA\u8981\u6C42\uFF0C\u901A\u8FC7\u8C03\u7528\u5DE5\u5177\u6216\u8F93\u51FA JSON \u8FD4\u56DE\u7ED3\u679C\u3002";
/** A custom-endpoint completion result in the same shape the routes consume. */
export interface CompletionResult {
    text: string;
    toolCalls: {
        name: string;
        arguments: string;
    }[];
}
/**
 * One OpenAI-compatible chat completion against the user's own endpoint.
 * The API key lives only in the Authorization header of this one request;
 * errors are redacted so the key can never leak into logs or the UI.
 */
export declare function customComplete(custom: LlmCustom, options: {
    system?: string;
    messages: {
        role: 'user' | 'assistant';
        content: string;
    }[];
    temperature?: number;
    maxTokens?: number;
}): Promise<CompletionResult>;
/** True when the custom endpoint is fully configured. */
export declare function customReady(custom: LlmCustom | undefined | null): custom is LlmCustom;
/** Tool schema the generate route offers so the model returns structured card data. */
export declare const CARD_TOOL: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            name: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            personality: {
                type: string;
                description: string;
            };
            scenario: {
                type: string;
                description: string;
            };
            first_mes: {
                type: string;
                description: string;
            };
            mes_example: {
                type: string;
                description: string;
            };
            creator_notes: {
                type: string;
                description: string;
            };
            system_prompt: {
                type: string;
                description: string;
            };
            alternate_greetings: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            tags: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
        required: string[];
    };
};
/** Resolve the model route: the user's default selection, else the first provider/model. */
export declare function resolveRoute(ctx: Context): Promise<{
    provider: string;
    model: string;
    reasoningEffort?: ReasoningEffortId;
}>;
/** Stream one call and collect visible text plus any emitted tool calls. */
export declare function streamCompletion(ctx: Context, options: GenerateOptions): Promise<{
    text: string;
    toolCalls: {
        name: string;
        arguments: string;
    }[];
}>;
/** Stream one call and return only the visible text. */
export declare function streamText(ctx: Context, options: GenerateOptions): Promise<string>;
export declare function buildPrompt(spec: TavernSpec): string;
export declare function buildWorldbookPrompt(spec: TavernSpec, card: CharCard | null): string;
export declare function buildChatSystem(card: CharCard, globalPrompt?: string): string;
/** Prefer a tool-call argument, then plain-text JSON (with a tolerant repair). */
export declare function parseResult(result: {
    text: string;
    toolCalls: {
        name: string;
        arguments: string;
    }[];
}): Record<string, unknown> | null;
/** Generate the card data, retrying once with a stricter plain-JSON prompt on failure. */
export declare function generateCard(ctx: Context, spec: TavernSpec, version: string, custom?: LlmCustom): Promise<{
    card: CharCard;
    rawText: string;
    fallback: boolean;
}>;
/** Generate world-book entries from the spec or an existing card. */
export declare function generateWorldbook(ctx: Context, spec: TavernSpec, card: CharCard | null, custom?: LlmCustom): Promise<{
    entries: unknown[];
    rawText: string;
}>;
/** List available models plus the current default route. */
export declare function listModels(ctx: Context): Promise<{
    options: {
        provider: string;
        model: string;
        label: string;
    }[];
    current: {
        provider: string;
        model: string;
    } | null;
}>;
/** Produce the character's reply for one chat turn. */
export declare function chatReply(ctx: Context, card: CharCard, messages: ChatMessage[], provider?: string, model?: string, globalPrompt?: string, custom?: LlmCustom): Promise<string>;
/** Round-trip test of a user-supplied endpoint (settings 「测试连接」). */
export declare function testCustom(custom: LlmCustom): Promise<{
    ok: true;
    latencyMs: number;
    reply: string;
}>;

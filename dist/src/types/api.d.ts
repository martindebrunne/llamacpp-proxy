/**
 * OpenAI API compatible types
 */
export interface Message {
    role: "user" | "assistant" | "system";
    content: string | null;
    reasoning_content?: string;
    reasoning?: string;
    tool_calls?: ToolCall[];
}
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
export interface ChatCompletionRequest {
    model: string;
    messages: Message[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    chat_template_kwargs?: ChatTemplateKwargs;
}
export interface ChatTemplateKwargs {
    enable_thinking?: boolean;
    [key: string]: unknown;
}
export interface Choice {
    index: number;
    message?: Message;
    delta?: Delta;
    finish_reason: string | null;
}
export interface Delta {
    role?: "assistant";
    content?: string;
    tool_calls?: ToolCall[];
    reasoning_content?: string;
    reasoning?: string;
}
export interface ChatCompletionResponse {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: Choice[];
    usage: Usage;
}
export interface ChatCompletionChunk {
    id: string;
    object: "chat.completion.chunk";
    created: number;
    model: string;
    choices: Choice[];
    usage?: Usage;
}
export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
export interface Model {
    id: string;
    object: "model";
    owned_by: string;
}
export interface ModelList {
    object: "list";
    data: Model[];
}
export interface ErrorResponse {
    error: {
        type: string;
        message: string;
        code?: string;
    };
}
//# sourceMappingURL=api.d.ts.map
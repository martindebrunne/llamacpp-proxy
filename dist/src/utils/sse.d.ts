/**
 * Server-Sent Events (SSE) utilities
 */
import type { ChatCompletionChunk, Choice, Delta, Usage } from "../types/index.js";
/**
 * Parse an SSE event block
 */
export declare function parseSseEventBlock(block: string): {
    type: "done";
} | {
    type: "json";
    data: unknown;
} | {
    type: "raw";
    data: string;
} | null;
/**
 * Serialize a JSON object to SSE format
 */
export declare function serializeSseEvent(json: unknown): string;
/**
 * Create an SSE chunk from template
 */
export declare function createSseChunkFromTemplate(baseChunk: Partial<ChatCompletionChunk> | undefined, choice: Partial<Choice> | undefined, delta: Partial<Delta> | undefined, model: string | undefined, finishReason?: string | null): ChatCompletionChunk;
/**
 * Split SSE buffer into complete blocks
 */
export declare function splitSseBlocks(buffer: string): {
    complete: string[];
    remainder: string;
};
/**
 * Create a usage chunk for appending token usage
 */
export declare function createUsageChunk(baseChunk: Partial<ChatCompletionChunk> | undefined, choice: Partial<Choice> | undefined, model: string | undefined, usage: Usage): ChatCompletionChunk;
//# sourceMappingURL=sse.d.ts.map
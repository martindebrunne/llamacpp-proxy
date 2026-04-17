/**
 * Reasoning content utilities
 */
import type { Message, Delta } from "../types/index.js";
/**
 * Extract all XML blocks from text
 */
export declare function extractAllXmlBlocks(text: string): string[];
/**
 * Pick the best recovered output from reasoning text
 */
export declare function pickBestRecoveredOutput(reasoningText: string): string | null;
/**
 * Strip reasoning fields from an object
 */
export declare function stripReasoningFields<T extends {
    reasoning_content?: unknown;
    reasoning?: unknown;
}>(obj: T): void;
/**
 * Recover message content from reasoning when content is empty
 */
export declare function recoverMessageFromReasoning(message: Message | null | undefined): Message | null | undefined;
/**
 * Recover delta content from reasoning when content is empty
 */
export declare function recoverDeltaFromReasoning(delta: Delta | null | undefined): Delta | null;
//# sourceMappingURL=reasoning.d.ts.map
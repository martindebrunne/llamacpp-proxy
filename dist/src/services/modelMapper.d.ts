/**
 * Model mapping service
 * Handles transformation of model names for thinking mode
 */
import type { ChatCompletionRequest } from "../types/index.js";
/**
 * Extract the real model name from incoming model name
 * Removes -Think or -No-Think suffix to get the actual model
 */
export declare function extractRealModel(incomingModel: string | undefined): string | null;
/**
 * Check if model name has a suffix
 */
export declare function hasModelSuffix(model: string | undefined): boolean;
/**
 * Check if model is in No-Think mode
 */
export declare function isNoThinkMode(model: string | undefined): boolean;
/**
 * Check if model is in Think mode
 */
export declare function isThinkMode(model: string | undefined): boolean;
/**
 * Map the request body based on model mode
 * - No-Think: return body unchanged
 * - Think: add enable_thinking to chat_template_kwargs
 * - Unknown: return body unchanged
 */
export declare function mapRequest(body: ChatCompletionRequest | Record<string, unknown>): ChatCompletionRequest;
//# sourceMappingURL=modelMapper.d.ts.map
/**
 * Model mapping service
 * Handles transformation of model names for thinking mode
 */

import type { ChatCompletionRequest } from "../types/index.js";

/**
 * Extract the real model name from incoming model name
 * Removes -Think or -No-Think suffix to get the actual model
 */
export function extractRealModel(incomingModel: string | undefined): string | null {
  if (!incomingModel) return null;

  // Remove -Think suffix
  if (incomingModel.endsWith("-Think")) {
    return incomingModel.slice(0, -6);
  }

  // Remove -No-Think suffix
  if (incomingModel.endsWith("-No-Think")) {
    return incomingModel.slice(0, -11);
  }

  // No suffix, return as-is
  return incomingModel;
}

/**
 * Check if model name has a suffix
 */
export function hasModelSuffix(model: string | undefined): boolean {
  if (!model) return false;
  return model.includes("-Think") || model.includes("-No-Think");
}

/**
 * Check if model is in No-Think mode
 */
export function isNoThinkMode(model: string | undefined): boolean {
  return model?.includes("No-Think") ?? false;
}

/**
 * Check if model is in Think mode
 */
export function isThinkMode(model: string | undefined): boolean {
  if (!model) return false;
  return model.includes("Think") && !model.includes("No-Think");
}

/**
 * Map the request body based on model mode
 * - No-Think: return body unchanged
 * - Think: add enable_thinking to chat_template_kwargs
 * - Unknown: return body unchanged
 */
export function mapRequest(body: ChatCompletionRequest | Record<string, unknown>): ChatCompletionRequest {
  const model = (body.model || "") as string;

  // Mode No-Think: return body unchanged
  if (isNoThinkMode(model)) {
    return body as ChatCompletionRequest;
  }

  // Mode Think: transformation with enable_thinking
  if (isThinkMode(model)) {
    const realModel = extractRealModel(model);
    return {
      ...body,
      model: realModel || model,
      chat_template_kwargs: {
        ...(body.chat_template_kwargs || {}),
        enable_thinking: true,
      },
    } as ChatCompletionRequest;
  }

  // Unknown model: return body unchanged
  return body as ChatCompletionRequest;
}

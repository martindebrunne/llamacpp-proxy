/**
 * Response sanitizer service
 * Handles JSON response sanitization for thinking mode
 */

import { recoverMessageFromReasoning } from "../utils/reasoning.js";
import { isNonEmptyArray } from "../utils/typeGuards.js";
import type { Choice, Message } from "../types/index.js";

/**
 * Check if model is in No-Think mode
 */
function isNoThinkMode(model: string | undefined): boolean {
  return model?.includes("No-Think") ?? false;
}

/**
 * Sanitize a choice object
 */
function sanitizeJsonChoice(choice: Choice | null | undefined): Choice | null {
  if (!choice || typeof choice !== "object") return null;

  const cleanChoice = { ...choice };

  if (cleanChoice.delta) {
    const recoveredDelta = recoverMessageFromReasoning(cleanChoice.delta as Message);
    if (!recoveredDelta || (recoveredDelta as Message | null) === null) return null;
    cleanChoice.delta = recoveredDelta as typeof cleanChoice.delta;
    return cleanChoice;
  }

  if (cleanChoice.message) {
    const recoveredMessage = recoverMessageFromReasoning(cleanChoice.message);
    if (!recoveredMessage) return null;
    const hasContent = recoveredMessage.content !== null && recoveredMessage.content !== undefined;
    const hasToolCalls = isNonEmptyArray(recoveredMessage.tool_calls);

    if (!hasContent && !hasToolCalls) return null;

    cleanChoice.message = recoveredMessage;
    return cleanChoice;
  }

  return cleanChoice;
}

/**
 * Sanitize JSON response text
 * - Removes reasoning fields in Think mode
 * - Preserves usage metadata
 * - Recovers content from reasoning when needed
 */
export function sanitizeJsonText(text: string, incomingModel: string | undefined): string {
  // Mode No-Think: return text unchanged
  if (isNoThinkMode(incomingModel)) {
    return text;
  }

  try {
    const parsed = JSON.parse(text);
    const usage = parsed?.usage;

    if (Array.isArray(parsed?.choices)) {
      parsed.choices = parsed.choices.map(sanitizeJsonChoice).filter(Boolean) as Choice[];
    }

    if (parsed?.message && typeof parsed.message === "object") {
      const recovered = recoverMessageFromReasoning(parsed.message as Message);
      if (recovered) {
        parsed.message = recovered;
      }
    }

    if (usage) {
      parsed.usage = usage;
    }

    return JSON.stringify(parsed);
  } catch {
    return text;
  }
}

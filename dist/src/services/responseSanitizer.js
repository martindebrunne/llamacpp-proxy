/**
 * Response sanitizer service
 * Handles JSON response sanitization for thinking mode
 */
import { recoverMessageFromReasoning } from "../utils/reasoning.js";
import { isNonEmptyArray } from "../utils/typeGuards.js";
/**
 * Check if model is in No-Think mode
 */
function isNoThinkMode(model) {
    return model?.includes("No-Think") ?? false;
}
/**
 * Sanitize a choice object
 */
function sanitizeJsonChoice(choice) {
    if (!choice || typeof choice !== "object")
        return null;
    const cleanChoice = { ...choice };
    if (cleanChoice.delta) {
        const recoveredDelta = recoverMessageFromReasoning(cleanChoice.delta);
        if (!recoveredDelta || recoveredDelta === null)
            return null;
        cleanChoice.delta = recoveredDelta;
        return cleanChoice;
    }
    if (cleanChoice.message) {
        const recoveredMessage = recoverMessageFromReasoning(cleanChoice.message);
        if (!recoveredMessage)
            return null;
        const hasContent = recoveredMessage.content !== null && recoveredMessage.content !== undefined;
        const hasToolCalls = isNonEmptyArray(recoveredMessage.tool_calls);
        if (!hasContent && !hasToolCalls)
            return null;
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
export function sanitizeJsonText(text, incomingModel) {
    // Mode No-Think: return text unchanged
    if (isNoThinkMode(incomingModel)) {
        return text;
    }
    try {
        const parsed = JSON.parse(text);
        const usage = parsed?.usage;
        if (Array.isArray(parsed?.choices)) {
            parsed.choices = parsed.choices.map(sanitizeJsonChoice).filter(Boolean);
        }
        if (parsed?.message && typeof parsed.message === "object") {
            const recovered = recoverMessageFromReasoning(parsed.message);
            if (recovered) {
                parsed.message = recovered;
            }
        }
        if (usage) {
            parsed.usage = usage;
        }
        return JSON.stringify(parsed);
    }
    catch {
        return text;
    }
}
//# sourceMappingURL=responseSanitizer.js.map
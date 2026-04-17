/**
 * Reasoning content utilities
 */
import { isNonEmptyString, hasUsableContent, isNonEmptyArray } from "./typeGuards.js";
/**
 * Extract all XML blocks from text
 */
export function extractAllXmlBlocks(text) {
    const blocks = [];
    const pattern = /<([a-zA-Z_][\w:-]*)>[\s\S]*?<\/\1>/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const block = match[0]?.trim();
        if (block)
            blocks.push(block);
    }
    return blocks;
}
/**
 * Pick the best recovered output from reasoning text
 */
export function pickBestRecoveredOutput(reasoningText) {
    const trimmed = reasoningText.trim();
    if (!trimmed)
        return null;
    const xmlBlocks = extractAllXmlBlocks(trimmed);
    if (xmlBlocks.length > 0) {
        return xmlBlocks[xmlBlocks.length - 1] ?? null;
    }
    const looksLikeBrokenXml = trimmed.includes("<") || trimmed.includes("</") || trimmed.includes("/>");
    if (looksLikeBrokenXml) {
        return null;
    }
    return trimmed;
}
/**
 * Strip reasoning fields from an object
 */
export function stripReasoningFields(obj) {
    if (!obj || typeof obj !== "object")
        return;
    delete obj.reasoning_content;
    delete obj.reasoning;
}
/**
 * Recover message content from reasoning when content is empty
 */
export function recoverMessageFromReasoning(message) {
    if (!message || typeof message !== "object")
        return message;
    const cleanMessage = { ...message };
    const hasContent = hasUsableContent(cleanMessage.content);
    const hasToolCalls = isNonEmptyArray(cleanMessage.tool_calls);
    if (!hasContent && !hasToolCalls) {
        const recovered = pickBestRecoveredOutput(cleanMessage.reasoning_content ?? cleanMessage.reasoning ?? "");
        if (isNonEmptyString(recovered)) {
            cleanMessage.content = recovered;
        }
    }
    stripReasoningFields(cleanMessage);
    return cleanMessage;
}
/**
 * Recover delta content from reasoning when content is empty
 */
export function recoverDeltaFromReasoning(delta) {
    if (!delta || typeof delta !== "object")
        return null;
    const cleanDelta = { ...delta };
    const hasRole = cleanDelta.role === "assistant";
    const hasContent = hasUsableContent(cleanDelta.content);
    const hasToolCalls = isNonEmptyArray(cleanDelta.tool_calls);
    if (!hasContent && !hasToolCalls && !hasRole) {
        const recovered = pickBestRecoveredOutput(cleanDelta.reasoning_content ?? cleanDelta.reasoning ?? "");
        if (isNonEmptyString(recovered)) {
            cleanDelta.content = recovered;
        }
    }
    stripReasoningFields(cleanDelta);
    const finalHasContent = hasUsableContent(cleanDelta.content);
    const finalHasToolCalls = isNonEmptyArray(cleanDelta.tool_calls);
    const finalHasRole = cleanDelta.role === "assistant";
    if (!finalHasContent && !finalHasToolCalls && !finalHasRole) {
        return null;
    }
    return cleanDelta;
}
//# sourceMappingURL=reasoning.js.map
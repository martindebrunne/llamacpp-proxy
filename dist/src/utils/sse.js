/**
 * Server-Sent Events (SSE) utilities
 */
/**
 * Parse an SSE event block
 */
export function parseSseEventBlock(block) {
    const lines = block.split(/\r?\n/);
    const dataLines = [];
    for (const line of lines) {
        if (line.startsWith("data: ")) {
            dataLines.push(line.slice(6));
        }
    }
    if (dataLines.length === 0)
        return null;
    const payload = dataLines.join("\n");
    if (payload === "[DONE]") {
        return { type: "done" };
    }
    try {
        return { type: "json", data: JSON.parse(payload) };
    }
    catch {
        return { type: "raw", data: payload };
    }
}
/**
 * Serialize a JSON object to SSE format
 */
export function serializeSseEvent(json) {
    return `data: ${JSON.stringify(json)}\n\n`;
}
/**
 * Create an SSE chunk from template
 */
export function createSseChunkFromTemplate(baseChunk, choice, delta, model, finishReason = null) {
    return {
        id: baseChunk?.id ?? "proxy-stream",
        object: baseChunk?.object ?? "chat.completion.chunk",
        created: baseChunk?.created ?? Math.floor(Date.now() / 1000),
        model: baseChunk?.model ?? model ?? "unknown",
        choices: [
            {
                index: choice?.index ?? 0,
                delta: delta ?? {},
                finish_reason: finishReason,
            },
        ],
    };
}
/**
 * Split SSE buffer into complete blocks
 */
export function splitSseBlocks(buffer) {
    const normalized = buffer.replace(/\r\n/g, "\n");
    const parts = normalized.split("\n\n");
    const complete = parts.slice(0, -1);
    const remainder = parts[parts.length - 1] ?? "";
    return { complete, remainder };
}
/**
 * Create a usage chunk for appending token usage
 */
export function createUsageChunk(baseChunk, choice, model, usage) {
    return {
        ...createSseChunkFromTemplate(baseChunk, choice, {}, model),
        usage,
    };
}
//# sourceMappingURL=sse.js.map
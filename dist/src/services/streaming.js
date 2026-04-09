/**
 * Streaming service
 * Handles real-time SSE streaming with reasoning content recovery
 */
import { parseSseEventBlock, serializeSseEvent, createSseChunkFromTemplate, splitSseBlocks, } from "../utils/sse.js";
import { pickBestRecoveredOutput } from "../utils/reasoning.js";
import { isNonEmptyString, isNonEmptyArray, hasUsableContent } from "../utils/typeGuards.js";
import { error } from "../../lib/index.js";
/**
 * Forward streaming response with real-time processing
 */
export async function forwardStreamingResponse(req, res, upstream, mapped, _upstreamPath, startTime) {
    const body = upstream.body;
    if (!body) {
        res.end();
        return;
    }
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let rawResponseText = "";
    let sseBuffer = "";
    const state = {
        assistantRoleSent: false,
        accumulatedReasoning: "",
        sawUsefulContent: false,
        sawToolCalls: false,
        sawDone: false,
        lastUsage: null,
    };
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunkText = decoder.decode(value, { stream: true });
            rawResponseText += chunkText;
            sseBuffer += chunkText;
            const { complete, remainder } = splitSseBlocks(sseBuffer);
            sseBuffer = remainder;
            for (const block of complete) {
                if (!block.trim())
                    continue;
                const event = parseSseEventBlock(block);
                if (!event)
                    continue;
                if (event.type === "done") {
                    state.sawDone = true;
                    continue;
                }
                if (event.type !== "json") {
                    continue;
                }
                const chunk = event.data;
                if (!chunk || !Array.isArray(chunk.choices) || chunk.choices.length === 0) {
                    if (chunk?.usage) {
                        state.lastUsage = chunk.usage;
                    }
                    continue;
                }
                if (chunk?.usage) {
                    state.lastUsage = chunk.usage;
                }
                for (const choice of chunk.choices) {
                    const delta = choice?.delta;
                    const message = choice?.message;
                    if (delta && typeof delta === "object") {
                        if (delta.role === "assistant" && !state.assistantRoleSent) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { role: "assistant" }, mapped?.model)));
                            state.assistantRoleSent = true;
                        }
                        if (hasUsableContent(delta.content)) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { content: delta.content }, mapped?.model)));
                            state.sawUsefulContent = true;
                        }
                        if (isNonEmptyArray(delta.tool_calls)) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { tool_calls: delta.tool_calls }, mapped?.model)));
                            state.sawToolCalls = true;
                        }
                        if (isNonEmptyString(delta.reasoning_content)) {
                            state.accumulatedReasoning += delta.reasoning_content;
                        }
                        else if (isNonEmptyString(delta.reasoning)) {
                            state.accumulatedReasoning += delta.reasoning;
                        }
                    }
                    else if (message && typeof message === "object") {
                        if (!state.assistantRoleSent) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { role: "assistant" }, mapped?.model)));
                            state.assistantRoleSent = true;
                        }
                        if (hasUsableContent(message.content)) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { content: message.content }, mapped?.model)));
                            state.sawUsefulContent = true;
                        }
                        if (isNonEmptyArray(message.tool_calls)) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { tool_calls: message.tool_calls }, mapped?.model)));
                            state.sawToolCalls = true;
                        }
                        if (isNonEmptyString(message.reasoning_content)) {
                            state.accumulatedReasoning += message.reasoning_content;
                        }
                        else if (isNonEmptyString(message.reasoning)) {
                            state.accumulatedReasoning += message.reasoning;
                        }
                    }
                }
            }
        }
        const trailing = decoder.decode();
        if (trailing) {
            rawResponseText += trailing;
            sseBuffer += trailing;
        }
        if (sseBuffer.trim()) {
            const event = parseSseEventBlock(sseBuffer);
            if (event?.type === "done") {
                state.sawDone = true;
            }
            else if (event?.type === "json" && event.data?.usage) {
                state.lastUsage = event.data.usage;
            }
        }
        // Recover content from reasoning if no useful content was seen
        if (!state.sawUsefulContent && !state.sawToolCalls) {
            const recovered = pickBestRecoveredOutput(state.accumulatedReasoning);
            if (isNonEmptyString(recovered)) {
                if (!state.assistantRoleSent) {
                    res.write(serializeSseEvent(createSseChunkFromTemplate({ id: "proxy-recovered-role" }, { index: 0 }, { role: "assistant" }, mapped?.model)));
                }
                const recoveredChunk = createSseChunkFromTemplate({ id: "proxy-recovered-content" }, { index: 0 }, { content: recovered }, mapped?.model);
                if (state.lastUsage) {
                    recoveredChunk.usage = state.lastUsage;
                }
                res.write(serializeSseEvent(recoveredChunk));
            }
        }
        // Send usage chunk if available
        if (state.lastUsage && (state.sawUsefulContent || state.sawToolCalls)) {
            const usageChunk = {
                ...createSseChunkFromTemplate({ id: "proxy-usage" }, { index: 0 }, {}, mapped?.model),
                usage: state.lastUsage,
            };
            res.write(serializeSseEvent(usageChunk));
        }
        res.write("data: [DONE]\n\n");
        res.end();
        const duration = Date.now() - startTime;
        const responseForLog = { text: rawResponseText, json: null };
        try {
            responseForLog.json = JSON.parse(rawResponseText);
        }
        catch { }
        // Log request (deferred to avoid circular dependency)
        const { requestLog } = await import("../../lib/index.js");
        await requestLog({
            method: req.method,
            path: req.originalUrl,
            incomingModel: req.body?.model,
            upstreamModel: mapped?.model,
            thinking: mapped?.chat_template_kwargs?.enable_thinking,
            status: upstream.statusCode,
            duration,
            requestPayload: req.body,
            responsePayload: responseForLog.json || responseForLog.text,
        });
    }
    catch (e) {
        const duration = Date.now() - startTime;
        error("Streaming request failed", `${req.originalUrl} | ${String(e)}`);
        if (!res.headersSent) {
            res.status(500).json({
                error: "proxy_error",
                message: String(e),
            });
        }
        else {
            try {
                res.end();
            }
            catch { }
        }
        // Log error request
        const { requestLog } = await import("../../lib/index.js");
        await requestLog({
            method: req.method,
            path: req.originalUrl,
            incomingModel: req.body?.model,
            upstreamModel: mapped?.model,
            thinking: mapped?.chat_template_kwargs?.enable_thinking,
            status: 500,
            duration,
            requestPayload: req.body,
            responsePayload: { text: rawResponseText, json: null },
        });
    }
    finally {
        try {
            reader.releaseLock();
        }
        catch { }
    }
}
//# sourceMappingURL=streaming.js.map
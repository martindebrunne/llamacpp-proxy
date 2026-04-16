/**
 * Streaming service
 * Handles real-time SSE streaming with reasoning content recovery
 */
import { parseSseEventBlock, serializeSseEvent, createSseChunkFromTemplate, splitSseBlocks, } from "../utils/sse.js";
import { pickBestRecoveredOutput } from "../utils/reasoning.js";
import { isNonEmptyString, isNonEmptyArray, hasUsableContent } from "../utils/typeGuards.js";
import { error, consoleRequestLogEnd, logRequestEnd, logStreamChunk } from "../../lib/index.js";
/**
 * Log request end for streaming routes (console only)
 */
async function logStreamingRequestEnd(req, mapped, status, duration, responseBodySize, correlationId) {
    const upstreamModel = mapped?.model;
    const thinking = mapped?.chat_template_kwargs?.enable_thinking;
    const thinkingMode = thinking !== undefined ? String(thinking) : undefined;
    consoleRequestLogEnd({
        method: req.method,
        path: req.originalUrl,
        status,
        duration,
        size: responseBodySize,
        upstreamModel,
        thinkingMode,
        stream: true,
        correlationId,
    });
}
/**
 * Forward streaming response with real-time processing
 */
export async function forwardStreamingResponse(req, res, upstream, mapped, _upstreamPath, startTime) {
    res.setTimeout(0);
    const body = upstream.body;
    if (!body) {
        res.end();
        return;
    }
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let rawResponseText = "";
    let sseBuffer = "";
    let responseBodySize = 0;
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
                    const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
                    // Log stream chunk to file (Option C - Hybrid)
                    const correlationId = req.correlationId;
                    if (correlationId) {
                        // Only log chunks that have content or tool calls
                        const hasContent = delta?.content || message?.content;
                        const hasToolCalls = delta?.tool_calls || message?.tool_calls;
                        if (hasContent || hasToolCalls) {
                            logStreamChunk({
                                timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
                                type: "STREAM_CHUNK",
                                correlationId,
                                chunkIndex: 0,
                                data: chunk,
                            });
                        }
                    }
                    if (delta && typeof delta === "object") {
                        if (delta.role === "assistant" && !state.assistantRoleSent) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { role: "assistant" }, mapped?.model, null)));
                            state.assistantRoleSent = true;
                        }
                        if (hasUsableContent(delta.content)) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { content: delta.content }, mapped?.model, null)));
                            state.sawUsefulContent = true;
                        }
                        if (isNonEmptyArray(delta.tool_calls)) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { tool_calls: delta.tool_calls }, mapped?.model, null)));
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
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { role: "assistant" }, mapped?.model, null)));
                            state.assistantRoleSent = true;
                        }
                        if (hasUsableContent(message.content)) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { content: message.content }, mapped?.model, null)));
                            state.sawUsefulContent = true;
                        }
                        if (isNonEmptyArray(message.tool_calls)) {
                            res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, { tool_calls: message.tool_calls }, mapped?.model, null)));
                            state.sawToolCalls = true;
                        }
                        if (isNonEmptyString(message.reasoning_content)) {
                            state.accumulatedReasoning += message.reasoning_content;
                        }
                        else if (isNonEmptyString(message.reasoning)) {
                            state.accumulatedReasoning += message.reasoning;
                        }
                    }
                    if (finishReason !== null) {
                        res.write(serializeSseEvent(createSseChunkFromTemplate(chunk, choice, {}, mapped?.model, finishReason)));
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
        const duration = Date.now() - startTime;
        responseBodySize = Buffer.byteLength(rawResponseText, "utf-8");
        // Log to console FIRST (synchronous)
        const correlationId = req.correlationId;
        req.requestEndLoggedByService = true;
        await logStreamingRequestEnd(req, mapped, upstream.status, duration, responseBodySize, correlationId);
        // Then write response
        res.write("data: [DONE]\n\n");
        res.end();
        // Then log to file (async)
        const upstreamModel = mapped?.model;
        const thinking = mapped?.chat_template_kwargs?.enable_thinking;
        const thinkingMode = thinking !== undefined ? String(thinking) : undefined;
        const responseForLog = { text: rawResponseText, json: null };
        try {
            responseForLog.json = JSON.parse(rawResponseText);
        }
        catch { }
        await logRequestEnd({
            timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            type: "REQUEST_END",
            correlationId,
            status: upstream.status,
            duration,
            responseSize: responseBodySize,
            stream: true,
            upstreamModel,
            thinkingMode,
            responsePayload: responseForLog.json || responseForLog.text,
        });
    }
    catch (e) {
        const duration = Date.now() - startTime;
        const correlationId = req.correlationId;
        req.requestEndLoggedByService = true;
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
        await logRequestEnd({
            timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            type: "REQUEST_END",
            correlationId,
            status: 500,
            duration,
            responseSize: Buffer.byteLength(rawResponseText, "utf-8"),
            stream: true,
            upstreamModel: mapped?.model,
            thinkingMode: undefined,
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
/**
 * Forward streaming response without transformation (No-Think passthrough)
 */
export async function forwardRawStreamingResponse(req, res, upstream, mapped, _upstreamPath, startTime) {
    res.setTimeout(0);
    const body = upstream.body;
    if (!body) {
        const duration = Date.now() - startTime;
        const correlationId = req.correlationId;
        req.requestEndLoggedByService = true;
        await logStreamingRequestEnd(req, mapped, upstream.status, duration, 0, correlationId);
        res.end();
        await logRequestEnd({
            timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            type: "REQUEST_END",
            correlationId,
            status: upstream.status,
            duration,
            responseSize: 0,
            stream: true,
            upstreamModel: mapped?.model,
            thinkingMode: undefined,
            responsePayload: null,
        });
        return;
    }
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let rawResponseText = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            rawResponseText += decoder.decode(value, { stream: true });
            res.write(Buffer.from(value));
        }
        const trailing = decoder.decode();
        if (trailing) {
            rawResponseText += trailing;
        }
        const duration = Date.now() - startTime;
        const responseBodySize = Buffer.byteLength(rawResponseText, "utf-8");
        const correlationId = req.correlationId;
        req.requestEndLoggedByService = true;
        await logStreamingRequestEnd(req, mapped, upstream.status, duration, responseBodySize, correlationId);
        res.end();
        await logRequestEnd({
            timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            type: "REQUEST_END",
            correlationId,
            status: upstream.status,
            duration,
            responseSize: responseBodySize,
            stream: true,
            upstreamModel: mapped?.model,
            thinkingMode: undefined,
            responsePayload: rawResponseText,
        });
    }
    catch (e) {
        const duration = Date.now() - startTime;
        const correlationId = req.correlationId;
        req.requestEndLoggedByService = true;
        error("Raw streaming request failed", `${req.originalUrl} | ${String(e)}`);
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
        await logRequestEnd({
            timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            type: "REQUEST_END",
            correlationId,
            status: 500,
            duration,
            responseSize: Buffer.byteLength(rawResponseText, "utf-8"),
            stream: true,
            upstreamModel: mapped?.model,
            thinkingMode: undefined,
            responsePayload: rawResponseText,
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
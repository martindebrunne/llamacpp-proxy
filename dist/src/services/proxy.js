/**
 * Main proxy service
 * Handles JSON POST requests and response sanitization
 */
import { config } from "../config/index.js";
import { mapRequest, isNoThinkMode } from "./modelMapper.js";
import { forwardStreamingResponse } from "./streaming.js";
import { sanitizeJsonText } from "./responseSanitizer.js";
import { error, consoleRequestLogEnd } from "../../lib/index.js";
import { logRequestEnd } from "../../lib/logger.js";
/**
 * Collect response from upstream
 */
async function collectResponse(upstream) {
    const body = upstream.body;
    if (!body)
        return null;
    const chunks = [];
    const reader = body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            chunks.push(value);
        }
    }
    finally {
        reader.cancel();
    }
    const buffer = Buffer.concat(chunks);
    const text = buffer.toString("utf-8");
    try {
        const json = JSON.parse(text);
        return { text, json };
    }
    catch {
        return { text, json: null };
    }
}
/**
 * Log request end for intercepted routes (console only)
 */
async function logInterceptedRequestEnd(req, mapped, status, duration, responseBodySize, correlationId) {
    const upstreamModel = mapped?.model;
    const thinking = mapped?.chat_template_kwargs?.enable_thinking;
    const thinkingMode = thinking !== undefined ? String(thinking) : undefined;
    consoleRequestLogEnd({
        method: req.method,
        path: req.originalUrl || req.url,
        status,
        duration,
        size: responseBodySize,
        upstreamModel,
        thinkingMode,
        stream: false,
        correlationId,
    });
}
/**
 * Forward JSON POST request
 */
export async function forwardJsonPost(req, res, upstreamPath) {
    const startTime = Date.now();
    let response = null;
    try {
        const mapped = mapRequest(req.body);
        const upstream = await fetch(`${config.LLAMA_ORIGIN}${upstreamPath}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(req.headers.authorization
                    ? { Authorization: req.headers.authorization }
                    : {}),
            },
            body: JSON.stringify(mapped),
        });
        const contentType = upstream.headers.get("content-type");
        if (contentType)
            res.setHeader("Content-Type", contentType);
        if (!upstream.body) {
            res.end();
            const duration = Date.now() - startTime;
            const correlationId = req.correlationId;
            if (correlationId) {
                const upstreamModel = mapped?.model;
                const thinking = mapped?.chat_template_kwargs?.enable_thinking;
                const thinkingMode = thinking !== undefined ? String(thinking) : undefined;
                await writeRequestEndToLog(correlationId, upstream.status, duration, response, upstreamModel, thinkingMode);
            }
            return;
        }
        const isNoThink = isNoThinkMode(req.body?.model);
        const isEventStream = (contentType || "").toLowerCase().includes("text/event-stream");
        if (isEventStream && !isNoThink) {
            return await forwardStreamingResponse(req, res, upstream, mapped, upstreamPath, startTime);
        }
        response = await collectResponse(upstream);
        let responseBodySize = 0;
        let sanitizedText = "";
        if (response?.text) {
            sanitizedText = sanitizeJsonText(response.text, req.body?.model);
            responseBodySize = Buffer.byteLength(sanitizedText, "utf-8");
        }
        const duration = Date.now() - startTime;
        const correlationId = req.correlationId;
        // Log to console FIRST (synchronous)
        await logInterceptedRequestEnd(req, mapped, upstream.status, duration, responseBodySize, correlationId);
        // Then write response
        if (response?.text) {
            res.write(Buffer.from(sanitizedText, "utf-8"));
        }
        res.end();
        // Then log to file (async)
        const upstreamModel = mapped?.model;
        const thinking = mapped?.chat_template_kwargs?.enable_thinking;
        const thinkingMode = thinking !== undefined ? String(thinking) : undefined;
        await writeRequestEndToLog(correlationId, upstream.status, duration, response, upstreamModel, thinkingMode);
    }
    catch (e) {
        const duration = Date.now() - startTime;
        const correlationId = req.correlationId;
        error("Request failed", `${req.originalUrl} | ${String(e)}`);
        res.status(500).json({
            error: "proxy_error",
            message: String(e),
        });
        await writeRequestEndToLog(correlationId, 500, duration, response, undefined, undefined);
    }
}
/**
 * Log request end with timing and payloads to file
 */
async function writeRequestEndToLog(correlationId, status, duration, response, upstreamModel, thinkingMode) {
    await logRequestEnd({
        timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        type: "REQUEST_END",
        correlationId,
        status,
        duration,
        responseSize: response?.text ? Buffer.byteLength(response.text, "utf-8") : 0,
        stream: false,
        upstreamModel,
        thinkingMode,
        responsePayload: response?.json ?? response?.text ?? null,
    });
}
//# sourceMappingURL=proxy.js.map
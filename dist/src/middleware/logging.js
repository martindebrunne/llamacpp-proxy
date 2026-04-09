/**
 * Logging middleware
 * Logs incoming requests and responses with correlation IDs
 */
import { consoleRequestLogStart, consoleRequestLogEnd, logRequestStart, generateCorrelationId, } from "../../lib/logger.js";
// Store logging state per request using a WeakMap
const requestState = new WeakMap();
export function loggingMiddleware(req, res, next) {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();
    // Extract model and thinking mode from request
    const incomingModel = req.body?.model;
    const thinkingMode = extractThinkingMode(req.body);
    // Store state for use when response completes
    requestState.set(req, {
        startTime,
        correlationId,
        incomingModel,
        thinkingMode,
    });
    // Log request start immediately
    consoleRequestLogStart({
        method: req.method,
        path: req.originalUrl || req.url,
        incomingModel,
        thinkingMode,
        correlationId,
    });
    // Also log to file (async, non-blocking)
    logRequestStart({
        timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        type: "REQUEST_START",
        correlationId,
        method: req.method,
        path: req.originalUrl || req.url,
        stream: false, // Will be updated by proxy/streaming services
        incomingModel,
        upstreamModel: undefined,
        thinkingMode,
        requestPayload: req.body,
    });
    // Hook to log after response
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - startTime;
        // Capture response body size (skip if chunk is a callback)
        let responseBodySize = 0;
        if (chunk && typeof chunk !== 'function') {
            responseBodySize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding || 'utf8');
        }
        // Get stored state
        const state = requestState.get(req);
        if (state) {
            // Log request end to console
            consoleRequestLogEnd({
                method: req.method,
                path: req.originalUrl || req.url,
                status: res.statusCode,
                duration,
                size: responseBodySize,
                upstreamModel: undefined, // Will be set by proxy services
                thinkingMode: state.thinkingMode,
                stream: false, // Will be set by proxy/streaming services
                correlationId: state.correlationId,
            });
            // Note: File logging for request end is handled by proxy/streaming services
            // to include upstream model and full response payload
        }
        return originalEnd.apply(this, [chunk, encoding, cb]);
    };
    next();
}
/**
 * Extract thinking mode from request body
 */
export function extractThinkingMode(body) {
    if (!body || typeof body !== 'object')
        return undefined;
    const typedBody = body;
    // Check for enable_thinking in chat_template_kwargs
    const chatTemplateKwargs = typedBody.chat_template_kwargs;
    if (chatTemplateKwargs?.enable_thinking !== undefined) {
        return String(chatTemplateKwargs.enable_thinking);
    }
    // Check for thinking mode directly
    if (typedBody.thinking !== undefined) {
        return String(typedBody.thinking);
    }
    return undefined;
}
/**
 * Update logging state for streaming requests
 */
export function updateStreamingState(req, stream, upstreamModel) {
    const state = requestState.get(req);
    if (state) {
        // Update the file log with stream info and upstream model
        // This is called by the streaming service when it starts
        logRequestStart({
            timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            type: "REQUEST_START",
            correlationId: state.correlationId,
            method: req.method,
            path: req.originalUrl || req.url,
            stream,
            incomingModel: state.incomingModel,
            upstreamModel,
            thinkingMode: state.thinkingMode,
            requestPayload: req.loggedRequestBody || req.body,
        });
    }
}
/**
 * Set the request body for logging (called before upstream request)
 */
export function setRequestBodyForLogging(req, body) {
    const state = requestState.get(req);
    if (state) {
        // Update the logged request body
        req.loggedRequestBody = body;
    }
}
/**
 * Log a stream chunk (for streaming responses)
 */
export async function logStreamChunk(correlationId, chunkIndex, data) {
    const { logStreamChunk: logChunk } = await import("../../lib/logger.js");
    await logChunk({
        timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
        type: "STREAM_CHUNK",
        correlationId,
        chunkIndex,
        data,
    });
}
//# sourceMappingURL=logging.js.map
/**
 * Logging middleware
 * Logs incoming requests and responses with correlation IDs
 */

import type { Request, Response, NextFunction } from "express";
import {
  consoleRequestLogStart,
  consoleRequestLogEnd,
  logRequestStart,
  generateCorrelationId,
} from "../../lib/logger.js";

interface LoggingState {
  startTime: number;
  correlationId: string;
  incomingModel?: string;
  thinkingMode?: string;
}

// Store logging state per request using a WeakMap
const requestState = new WeakMap<Request, LoggingState>();

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();

  // Expose correlation ID to downstream services (proxy/streaming)
  // that emit request-end and stream logs.
  (req as any).correlationId = correlationId;
  
  // Extract model and thinking mode from request
  const incomingModel = (req.body as { model?: string })?.model;
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
  res.end = function (this: Response, chunk?: string | Buffer, encoding?: string | Buffer | (() => void), cb?: () => void): Response {
    const duration = Date.now() - startTime;
    
    // Capture response body size (skip if chunk is a callback)
    let responseBodySize = 0;
    if (chunk && typeof chunk !== 'function') {
      responseBodySize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk as string, encoding as BufferEncoding || 'utf8');
    }
    
    // Get stored state
    const state = requestState.get(req);
    if (state) {
      const requestEndLoggedByService = (req as any).requestEndLoggedByService === true;

      if (!requestEndLoggedByService) {
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
      }
      
      // Note: File logging for request end is handled by proxy/streaming services
      // to include upstream model and full response payload
    }
    
    return originalEnd.apply(this, [chunk, encoding, cb] as any);
  } as any;

  next();
}

/**
 * Extract thinking mode from request body
 */
export function extractThinkingMode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  
  const typedBody = body as Record<string, unknown>;
  
  // Check for enable_thinking in chat_template_kwargs
  const chatTemplateKwargs = typedBody.chat_template_kwargs as Record<string, unknown> | undefined;
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
export function updateStreamingState(req: Request, stream: boolean, upstreamModel?: string): void {
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
      requestPayload: (req as any).loggedRequestBody || req.body,
    });
  }
}

/**
 * Set the request body for logging (called before upstream request)
 */
export function setRequestBodyForLogging(req: Request, body: unknown): void {
  const state = requestState.get(req);
  if (state) {
    // Update the logged request body
    (req as any).loggedRequestBody = body;
  }
}

/**
 * Log a stream chunk (for streaming responses)
 */
export async function logStreamChunk(correlationId: string, chunkIndex: number, data: unknown): Promise<void> {
  const { logStreamChunk: logChunk } = await import("../../lib/logger.js");
  await logChunk({
    timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    type: "STREAM_CHUNK",
    correlationId,
    chunkIndex,
    data,
  });
}
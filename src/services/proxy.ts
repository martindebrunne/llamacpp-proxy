/**
 * Main proxy service
 * Handles JSON POST requests and response sanitization
 */

import type { Request, Response as ExpressResponse } from "express";
import { config } from "../config/index.js";
import { mapRequest, isNoThinkMode } from "./modelMapper.js";
import { forwardStreamingResponse, forwardRawStreamingResponse } from "./streaming.js";
import { sanitizeJsonText } from "./responseSanitizer.js";
import { error, consoleRequestLogEnd } from "../../lib/index.js";
import { logRequestEnd } from "../../lib/logger.js";
import { setRequestBodyForLogging, updateStreamingState } from "../middleware/logging.js";

interface ResponseCollection {
  text: string;
  json: unknown | null;
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === "AbortError";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Collect response from upstream
 */
async function collectResponse(upstream: globalThis.Response): Promise<ResponseCollection | null> {
  const body = upstream.body;
  if (!body) return null;

  const chunks: Buffer[] = [];
  const reader = body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.cancel();
  }

  const buffer = Buffer.concat(chunks);
  const text = buffer.toString("utf-8");

  try {
    const json = JSON.parse(text);
    return { text, json };
  } catch {
    return { text, json: null };
  }
}

/**
 * Log request end for intercepted routes (console only)
 */
async function logInterceptedRequestEnd(
  req: Request,
  mapped: unknown,
  status: number,
  duration: number,
  responseBodySize: number,
  correlationId: string
): Promise<void> {
  const upstreamModel = (mapped as { model?: string })?.model;
  const thinking = (mapped as { chat_template_kwargs?: { enable_thinking?: boolean } })?.chat_template_kwargs?.enable_thinking;
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
export async function forwardJsonPost(
  req: Request,
  res: ExpressResponse,
  upstreamPath: string
): Promise<void> {
  const startTime = Date.now();
  let response: ResponseCollection | null = null;
  res.setTimeout(config.PROXY_TIMEOUT_MS);

  try {
    const mapped = mapRequest(req.body);
    setRequestBodyForLogging(req, mapped);

    const upstream = await fetchWithTimeout(`${config.LLAMA_ORIGIN}${upstreamPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization
          ? { Authorization: req.headers.authorization }
          : {}),
      },
      body: JSON.stringify(mapped),
    }, config.UPSTREAM_FETCH_TIMEOUT_MS);

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.status(upstream.status);

    if (!upstream.body) {
      const duration = Date.now() - startTime;
      const correlationId = (req as any).correlationId;
      const upstreamModel = (mapped as { model?: string })?.model;
      const thinking = (mapped as { chat_template_kwargs?: { enable_thinking?: boolean } })?.chat_template_kwargs?.enable_thinking;
      const thinkingMode = thinking !== undefined ? String(thinking) : undefined;

      (req as any).requestEndLoggedByService = true;
      await logInterceptedRequestEnd(req, mapped, upstream.status, duration, 0, correlationId);
      res.end();

      if (correlationId) {
        await writeRequestEndToLog(correlationId, upstream.status, duration, response, upstreamModel, thinkingMode);
      }
      return;
    }

    const isNoThink = isNoThinkMode(req.body?.model);
    const isEventStream = (contentType || "").toLowerCase().includes("text/event-stream");

    if (isEventStream) {
      updateStreamingState(req, true, (mapped as { model?: string })?.model);

      if (isNoThink) {
        return await forwardRawStreamingResponse(req, res, upstream, mapped, upstreamPath, startTime);
      }

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
    const correlationId = (req as any).correlationId;
    
    // Log to console FIRST (synchronous)
    (req as any).requestEndLoggedByService = true;
    await logInterceptedRequestEnd(req, mapped, upstream.status, duration, responseBodySize, correlationId);
    
    // Then write response
    if (response?.text) {
      res.write(Buffer.from(sanitizedText, "utf-8"));
    }
    res.end();
    
    // Then log to file (async)
    const upstreamModel = (mapped as { model?: string })?.model;
    const thinking = (mapped as { chat_template_kwargs?: { enable_thinking?: boolean } })?.chat_template_kwargs?.enable_thinking;
    const thinkingMode = thinking !== undefined ? String(thinking) : undefined;
    await writeRequestEndToLog(correlationId, upstream.status, duration, response, upstreamModel, thinkingMode);
  } catch (e) {
    const duration = Date.now() - startTime;
    const correlationId = (req as any).correlationId;
    const status = isAbortError(e) ? 504 : 500;
    const message = isAbortError(e)
      ? `Upstream request timed out after ${config.UPSTREAM_FETCH_TIMEOUT_MS}ms`
      : String(e);
    error("Request failed", `${req.originalUrl} | ${String(e)}`);

    (req as any).requestEndLoggedByService = true;
    await logInterceptedRequestEnd(req, null, status, duration, 0, correlationId);

    res.status(status).json({
      error: "proxy_error",
      message,
    });

    await writeRequestEndToLog(correlationId, status, duration, response, undefined, undefined);
  }
}

/**
 * Log request end with timing and payloads to file
 */
async function writeRequestEndToLog(
  correlationId: string,
  status: number,
  duration: number,
  response: ResponseCollection | null,
  upstreamModel: string | undefined,
  thinkingMode: string | undefined
): Promise<void> {
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

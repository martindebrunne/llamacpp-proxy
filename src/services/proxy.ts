/**
 * Main proxy service
 * Handles JSON POST requests and response sanitization
 */

import type { Request, Response } from "express";
import { config } from "../config/index.js";
import { mapRequest, isNoThinkMode } from "./modelMapper.js";
import { forwardStreamingResponse } from "./streaming.js";
import { sanitizeJsonText } from "./responseSanitizer.js";
import { error } from "../../lib/index.js";

interface ResponseCollection {
  text: string;
  json: unknown | null;
}

/**
 * Collect response from upstream
 */
async function collectResponse(upstream: Response): Promise<ResponseCollection | null> {
  const body = (upstream as Response & { body?: ReadableStream }).body;
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
 * Forward JSON POST request
 */
export async function forwardJsonPost(
  req: Request,
  res: Response,
  upstreamPath: string
): Promise<void> {
  const startTime = Date.now();
  let response: ResponseCollection | null = null;

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
    if (contentType) res.setHeader("Content-Type", contentType);

    if (!upstream.body) {
      res.end();
      const duration = Date.now() - startTime;
      await logRequest(req, upstreamPath, startTime, mapped, upstream.status, duration, response);
      return;
    }

    const isNoThink = isNoThinkMode(req.body?.model);
    const isEventStream = (contentType || "").toLowerCase().includes("text/event-stream");

    if (isEventStream && !isNoThink) {
      return await forwardStreamingResponse(req, res, upstream as unknown as Response & { body?: ReadableStream }, mapped, upstreamPath, startTime);
    }

    response = await collectResponse(upstream as unknown as Response & { body?: ReadableStream });

    if (response?.text) {
      const sanitizedText = sanitizeJsonText(response.text, req.body?.model);
      res.write(Buffer.from(sanitizedText, "utf-8"));
    }

    res.end();

    const duration = Date.now() - startTime;
    await logRequest(req, upstreamPath, startTime, mapped, upstream.status, duration, response);
  } catch (e) {
    const duration = Date.now() - startTime;
    error("Request failed", `${req.originalUrl} | ${String(e)}`);

    res.status(500).json({
      error: "proxy_error",
      message: String(e),
    });

    await logRequest(req, upstreamPath, startTime, null, 500, duration, response);
  }
}

/**
 * Log request with timing and payloads
 */
async function logRequest(
  _req: Request,
  _upstreamPath: string,
  _startTime: number,
  _mapped: unknown,
  _status: number,
  _duration: number,
  _response: ResponseCollection | null
): Promise<void> {
  // Logging is handled by middleware for passthrough requests
  // This function is kept for potential future use
}

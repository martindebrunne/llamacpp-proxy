/**
 * Server-Sent Events (SSE) utilities
 */

import type { ChatCompletionChunk, Choice, Delta, Usage } from "../types/index.js";

/**
 * Parse an SSE event block
 */
export function parseSseEventBlock(block: string): { type: "done" } | { type: "json"; data: unknown } | { type: "raw"; data: string } | null {
  const lines = block.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      dataLines.push(line.slice(6));
    }
  }

  if (dataLines.length === 0) return null;

  const payload = dataLines.join("\n");

  if (payload === "[DONE]") {
    return { type: "done" };
  }

  try {
    return { type: "json", data: JSON.parse(payload) };
  } catch {
    return { type: "raw", data: payload };
  }
}

/**
 * Serialize a JSON object to SSE format
 */
export function serializeSseEvent(json: unknown): string {
  return `data: ${JSON.stringify(json)}\n\n`;
}

/**
 * Create an SSE chunk from template
 */
export function createSseChunkFromTemplate(
  baseChunk: Partial<ChatCompletionChunk> | undefined,
  choice: Partial<Choice> | undefined,
  delta: Partial<Delta> | undefined,
  model: string | undefined,
  finishReason: string | null = null
): ChatCompletionChunk {
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
export function splitSseBlocks(buffer: string): { complete: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const complete = parts.slice(0, -1);
  const remainder = parts[parts.length - 1] ?? "";
  return { complete, remainder };
}

/**
 * Create a usage chunk for appending token usage
 */
export function createUsageChunk(
  baseChunk: Partial<ChatCompletionChunk> | undefined,
  choice: Partial<Choice> | undefined,
  model: string | undefined,
  usage: Usage
): ChatCompletionChunk {
  return {
    ...createSseChunkFromTemplate(baseChunk, choice, {}, model),
    usage,
  };
}
import { describe, it, expect, vi } from "vitest";
import type { Request, Response as ExpressResponse } from "express";
import { forwardRawStreamingResponse } from "../../src/services/streaming.js";

function makeStreamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  let index = 0;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index++] ?? ""));
    },
  });
}

describe("forwardRawStreamingResponse", () => {
  it("passes through SSE chunks unchanged for No-Think mode", async () => {
    const upstreamBody = [
      "data: {\"id\":\"1\",\"choices\":[{\"delta\":{\"content\":\"Hi\"},\"finish_reason\":null}]}\n\n",
      "data: {\"id\":\"1\",\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n",
      "data: [DONE]\n\n",
    ];

    const upstream = new Response(makeStreamFromChunks(upstreamBody), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });

    const writes: string[] = [];
    const req = {
      method: "POST",
      originalUrl: "/v1/chat/completions",
      correlationId: "corr-raw-1",
    } as unknown as Request;

    const res = {
      setTimeout: vi.fn(),
      write: vi.fn((chunk: unknown) => {
        writes.push(Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : String(chunk));
      }),
      end: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      headersSent: false,
    } as unknown as ExpressResponse;

    await forwardRawStreamingResponse(req, res, upstream, { model: "MyModel-No-Think" }, "/v1/chat/completions", Date.now());

    const joined = writes.join("");
    expect(joined).toContain("\"content\":\"Hi\"");
    expect(joined).toContain("\"finish_reason\":\"stop\"");
    expect(joined).toContain("data: [DONE]");
    expect(res.end).toHaveBeenCalled();
  });
});
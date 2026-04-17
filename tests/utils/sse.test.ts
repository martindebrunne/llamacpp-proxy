import { describe, it, expect } from "vitest";
import { createSseChunkFromTemplate } from "../../src/utils/sse.js";

describe("SSE utils", () => {
  it("sets finish_reason to null by default", () => {
    const chunk = createSseChunkFromTemplate(
      { id: "chunk-1", model: "m1" },
      { index: 0 },
      { content: "hello" },
      "m1"
    );

    expect(chunk.choices[0]?.finish_reason).toBeNull();
  });

  it("preserves explicit finish_reason for agent/tool-calling compatibility", () => {
    const chunk = createSseChunkFromTemplate(
      { id: "chunk-2", model: "m2" },
      { index: 0 },
      {},
      "m2",
      "tool_calls"
    );

    expect(chunk.choices[0]?.finish_reason).toBe("tool_calls");
  });
});
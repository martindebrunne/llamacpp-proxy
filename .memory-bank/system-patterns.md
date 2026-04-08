# System Patterns: Llama Proxy

## Architecture Pattern
**Single-file Proxy Server** - Express.js application with selective route interception, conditional response sanitization, usage metadata preservation, real-time streaming, and passthrough proxying.

## Component Diagram
```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│   Client        │         │   Proxy Server       │         │   llama-server  │
│   (Cline)       │◄───────►│   (Express:4000)     │◄───────►│   (8080)        │
└─────────────────┘         └──────────────────────┘         └─────────────────┘
        │                              │                              │
        │  POST /chat/completions      │  mapRequest()                │
        │  model: *-Think              │  → enable_thinking           │
        │─────────────────────────────►│─────────────────────────────►│
        │                              │                              │
        │                              │  forwardStreamingResponse()  │
        │                              │  → real-time chunks          │
        │  SSE stream ◄────────────────┤◄─────────────────────────────┤
        │  (content + usage chunk)     │                              │
        │                              │                              │
        │  Other routes (WS, etc.)     │  passthrough                 │
        │─────────────────────────────►│─────────────────────────────►│
```

## Key Patterns

### 1. Model Abstraction Pattern
Logical model names abstract the real underlying model:
- `Qwen3.5-35B-A3B-T-Think` → enables thinking mode
- `Qwen3.5-35B-A3B-T-No-Think` → disables thinking mode (passthrough)

### 2. Selective Interception Pattern
Only OpenAI-compatible routes are intercepted and parsed:
- `/chat/completions`, `/v1/chat/completions`
- `/completions`, `/v1/completions`

All other routes passthrough via `http-proxy-middleware`.

### 3. Conditional Sanitization Pattern
Response sanitization is applied only in Think mode:

```javascript
// No-Think mode: passthrough
if (incomingModel.includes("No-Think")) {
  return text;  // No transformation
}

// Think mode: sanitization
if (contentType.includes("text/event-stream")) {
  return forwardStreamingResponse();  // Real-time processing
}
```

### 4. Real-Time Streaming Pattern
Streaming responses are processed in real-time:

```javascript
async function forwardStreamingResponse(req, res, upstream) {
  const reader = upstream.body.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunkText = decoder.decode(value);
    const { complete, remainder } = splitSseBlocks(sseBuffer);
    
    for (const block of complete) {
      const event = parseSseEventBlock(block);
      // Process and write each chunk immediately
      res.write(serializeSseEvent(chunk));
    }
  }
}
```

### 5. Usage Metadata Pattern
Usage metadata is written in a separate chunk after content:

```javascript
// After content chunks
if (lastUsage && (sawUsefulContent || sawToolCalls)) {
  res.write(
    serializeSseEvent({
      id: "proxy-usage",
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: REAL_MODEL,
      choices: [{ index: 0, delta: {}, finish_reason: null }],
      usage: lastUsage,
    })
  );
}
```

### 6. Content Recovery Pattern
Content is recovered from reasoning when empty:

```javascript
function recoverDeltaFromReasoning(delta) {
  const cleanDelta = { ...delta };
  
  if (!hasUsableContent(cleanDelta.content) && !hasToolCalls) {
    const recovered = pickBestRecoveredOutput(
      cleanDelta.reasoning_content ?? cleanDelta.reasoning
    );
    if (isNonEmptyString(recovered)) {
      cleanDelta.content = recovered;
    }
  }
  
  stripReasoningFields(cleanDelta);
  return cleanDelta;
}
```

### 7. Error Handling Pattern
Comprehensive error handling with proper cleanup:

```javascript
try {
  // Streaming logic
} catch (e) {
  // Error handling
  if (!res.headersSent) {
    res.status(500).json({ error: "proxy_error", message: String(e) });
  }
} finally {
  try {
    reader.releaseLock();
  } catch {}
}
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single-file architecture | Simplicity, easy deployment |
| No authentication | Local/trusted network assumption |
| Model name suffix convention | Intuitive client UX |
| Real-time streaming | More efficient than buffering |
| Separate usage chunk | Easier for clients to parse |
| 5min timeout | Long-running completions |
| Conditional sanitization | No-Think mode is pure passthrough |
| Think mode filtering | Hide reasoning fields from client |
| Usage metadata preservation | Required for token billing/monitoring |
| Comprehensive error handling | Prevent resource leaks |

## Response Flow Comparison

### Think Mode Flow (Real-Time)
```
Client Request (Qwen3.5-35B-A3B-T-Think)
    ↓
mapRequest() → Transform model + enable_thinking: true
    ↓
upstream response
    ↓
forwardStreamingResponse() → Process chunks in real-time
    ↓
Write content chunks immediately
    ↓
Write usage chunk (separate)
    ↓
Write [DONE]
```

### No-Think Mode Flow
```
Client Request (Qwen3.5-35B-A3B-T-No-Think)
    ↓
mapRequest() → Return body unchanged
    ↓
upstream response
    ↓
Passthrough unchanged
    ↓
Stream original response with usage to client
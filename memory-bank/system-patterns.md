# System Patterns: Llama Proxy

## Architecture Pattern
**Single-file Proxy Server** - Express.js application with selective route interception and passthrough proxying.

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
        │                              │  forwardJsonPost()           │
        │                              │  → streaming response        │
        │  SSE stream ◄────────────────┤◄─────────────────────────────┤
        │                              │                              │
        │  Other routes (WS, etc.)     │  passthrough                 │
        │─────────────────────────────►│─────────────────────────────►│
```

## Key Patterns

### 1. Model Abstraction Pattern
Logical model names abstract the real underlying model:
- `Qwen3.5-35B-A3B-T-Think` → enables thinking mode
- `Qwen3.5-35B-A3B-T-No-Think` → disables thinking mode

### 2. Selective Interception Pattern
Only OpenAI-compatible routes are intercepted and parsed:
- `/chat/completions`, `/v1/chat/completions`
- `/completions`, `/v1/completions`

All other routes passthrough via `http-proxy-middleware`.

### 3. Streaming Passthrough Pattern
Response streaming is handled via `ReadableStream`:
```javascript
const reader = upstream.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  res.write(Buffer.from(value));
}
```

### 4. Header Passthrough Pattern
Authorization headers are forwarded unchanged:
```javascript
...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single-file architecture | Simplicity, easy deployment |
| No authentication | Local/trusted network assumption |
| Model name suffix convention | Intuitive client UX |
| Streaming via ReadableStream | Native Node.js, no dependencies |
| 5min timeout | Long-running completions |
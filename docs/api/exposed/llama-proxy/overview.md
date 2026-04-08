# llamacpp-proxy API Overview

## Purpose
This proxy provides an OpenAI-compatible interface to a local llama.cpp server, with **dynamic model detection** and **thinking mode support**.

## Architecture
```
Client → Proxy (4000) → llama-server (8080)
```

## Key Features
- **Dynamic Model Detection**: Automatically extracts real model name from incoming requests
- **Thinking Mode Support**: Enable/disable via `*-Think` and `*-No-Think` suffixes
- **Real-Time Streaming**: SSE-style streaming responses processed in real-time
- **Passthrough**: All non-intercepted routes forwarded to upstream
- **Auth Passthrough**: Authorization headers forwarded to upstream
- **Conditional Sanitization**: Response filtering only in Think mode
- **Usage Metadata Preservation**: Token consumption data preserved in separate chunk

## Model Naming

| Client Model | Upstream Model | Behavior |
|--------------|----------------|----------|
| `MyModel-Think` | `MyModel` | Enables `enable_thinking: true` |
| `MyModel-No-Think` | `MyModel` | Passthrough (no transformation) |
| `MyModel` | `MyModel` | Passthrough (no transformation) |

## Request Flow

### Think Mode (`*-Think`)
1. Client sends request with model `MyModel-Think`
2. Proxy parses JSON body (for intercepted routes)
3. `extractRealModel()` extracts `MyModel`
4. `mapRequest()` transforms model name and adds `enable_thinking: true`
5. Request forwarded to upstream with transformed body
6. Response processed in real-time via `forwardStreamingResponse()`
7. Content chunks written immediately
8. Usage metadata written in separate chunk
9. `[DONE]` marker written

### No-Think Mode (`*-No-Think`)
1. Client sends request with model `MyModel-No-Think`
2. Proxy parses JSON body (for intercepted routes)
3. `mapRequest()` returns body unchanged
4. Request forwarded to upstream unchanged
5. Response passed through unchanged
6. Usage metadata preserved
7. Original response streamed to client

## Response Format
Responses are forwarded from upstream, with conditional processing:

| Mode | Request Transformed | Response Sanitized | Usage in Separate Chunk |
|------|--------------------|--------------------|------------------------|
| Think | ✅ Yes | ✅ Yes (reasoning filtered) | ✅ Yes |
| No-Think | ❌ No | ❌ No (passthrough) | ✅ Yes |

## Usage Metadata
The `usage` field contains token consumption data:

```json
{
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

This metadata is written in a separate chunk after content chunks for easier client parsing.

## Streaming Architecture

### Real-Time Processing
```
Read chunk → Parse → Write immediately → Next chunk
```

### Benefits
- Lower memory usage
- Faster first byte
- Better for long responses
- Cleaner separation of usage metadata

## Usage Recommendations

| Use Case | Model | Mode |
|----------|-------|------|
| Complex tasks, best answers | `MyModel-Think` | Thinking enabled |
| Simple tasks, no transformation | `MyModel-No-Think` | Passthrough |
| Minimal overhead | `MyModel` | Passthrough |
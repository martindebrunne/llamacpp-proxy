# Llama Proxy API Overview

## Purpose
This proxy provides an OpenAI-compatible interface to a local llama.cpp server, with model name abstraction for controlling thinking mode, conditional response sanitization, usage metadata preservation, and real-time streaming.

## Architecture
```
Client → Proxy (4000) → llama-server (8080)
```

## Key Features
- **Model Abstraction**: Logical model names (`*-Think`, `*-No-Think`) map to real upstream model
- **Real-Time Streaming**: SSE-style streaming responses processed in real-time
- **Passthrough**: All non-intercepted routes forwarded to upstream
- **Auth Passthrough**: Authorization headers forwarded to upstream
- **Conditional Sanitization**: Response filtering only in Think mode
- **Usage Metadata Preservation**: Token consumption data preserved in separate chunk

## Request Flow

### Think Mode (`*-Think`)
1. Client sends request with model `Qwen3.5-35B-A3B-T-Think`
2. Proxy parses JSON body (for intercepted routes)
3. `mapRequest()` transforms model name and adds `enable_thinking: true`
4. Request forwarded to upstream with transformed body
5. Response processed in real-time via `forwardStreamingResponse()`
6. Content chunks written immediately
7. Usage metadata written in separate chunk
8. `[DONE]` marker written

### No-Think Mode (`*-No-Think`)
1. Client sends request with model `Qwen3.5-35B-A3B-T-No-Think`
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

### Before (v1.0.8)
```
Collect all chunks → Buffer response → Process → Write to client
```

### After (v1.0.9)
```
Read chunk → Parse → Write immediately → Next chunk
```

### Benefits
- Lower memory usage
- Faster first byte
- Better for long responses
- Cleaner separation of usage metadata

## Usage Recommendations

| Use Case | Model | Version |
|----------|-------|---------|
| Complex tasks, best answers | `*-Think` | proxy2.js |
| Simple tasks, no transformation | `*-No-Think` | proxy2.js |
| Minimal overhead | Any | proxy.js |
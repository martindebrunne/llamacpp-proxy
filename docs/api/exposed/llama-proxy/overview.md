# Llama Proxy API Overview

## Purpose
This proxy provides an OpenAI-compatible interface to a local llama.cpp server, with model name abstraction for controlling thinking mode and conditional response sanitization.

## Architecture
```
Client → Proxy (4000) → llama-server (8080)
```

## Key Features
- **Model Abstraction**: Logical model names (`*-Think`, `*-No-Think`) map to real upstream model
- **Streaming**: SSE-style streaming responses forwarded unchanged
- **Passthrough**: All non-intercepted routes forwarded to upstream
- **Auth Passthrough**: Authorization headers forwarded to upstream
- **Conditional Sanitization**: Response filtering only in Think mode

## Request Flow

### Think Mode (`*-Think`)
1. Client sends request with model `Qwen3.5-35B-A3B-T-Think`
2. Proxy parses JSON body (for intercepted routes)
3. `mapRequest()` transforms model name and adds `enable_thinking: true`
4. Request forwarded to upstream with transformed body
5. Response collected and sanitized (reasoning fields filtered)
6. Clean response streamed back to client

### No-Think Mode (`*-No-Think`)
1. Client sends request with model `Qwen3.5-35B-A3B-T-No-Think`
2. Proxy parses JSON body (for intercepted routes)
3. `mapRequest()` returns body unchanged
4. Request forwarded to upstream unchanged
5. Response collected and passed through unchanged
6. Original response streamed back to client

## Response Format
Responses are forwarded from upstream, with conditional processing:

| Mode | Request Transformed | Response Sanitized |
|------|--------------------|--------------------|
| Think | ✅ Yes | ✅ Yes (reasoning filtered) |
| No-Think | ❌ No | ❌ No (passthrough) |

## Usage Recommendations

| Use Case | Model | Version |
|----------|-------|---------|
| Complex tasks, best answers | `*-Think` | proxy2.js |
| Simple tasks, no transformation | `*-No-Think` | proxy2.js |
| Minimal overhead | Any | proxy.js |
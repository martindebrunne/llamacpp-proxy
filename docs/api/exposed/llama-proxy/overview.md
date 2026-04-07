# Llama Proxy API Overview

## Purpose
This proxy provides an OpenAI-compatible interface to a local llama.cpp server, with model name abstraction for controlling thinking mode.

## Architecture
```
Client → Proxy (4000) → llama-server (8080)
```

## Key Features
- **Model Abstraction**: Logical model names (`*-Think`, `*-No-Think`) map to real upstream model
- **Streaming**: SSE-style streaming responses forwarded unchanged
- **Passthrough**: All non-intercepted routes forwarded to upstream
- **Auth Passthrough**: Authorization headers forwarded to upstream

## Request Flow
1. Client sends request to proxy endpoint
2. Proxy parses JSON body (for intercepted routes)
3. `mapRequest()` transforms model name and adds `enable_thinking` flag
4. Request forwarded to upstream with transformed body
5. Streaming response forwarded back to client

## Response Format
Responses are forwarded unchanged from upstream, preserving:
- Status code
- Content-Type header
- Streaming chunks
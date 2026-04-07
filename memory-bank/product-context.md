# Product Context: Llama Proxy

## Problem Statement
Local llama.cpp servers expose the real model name directly, but clients need a way to toggle thinking mode without knowing the underlying model. This creates friction when integrating with tools like Cline that expect OpenAI-compatible APIs.

## Solution
A proxy layer that:
1. Intercepts model names from client requests
2. Maps them to the real upstream model
3. Injects `enable_thinking` flag via `chat_template_kwargs`
4. Forwards requests and streaming responses unchanged

## User Experience Goals
- **Transparency**: Clients use familiar OpenAI-compatible endpoints
- **Simplicity**: Toggle thinking mode via model name suffix (`-Think` / `-No-Think`)
- **Compatibility**: No client-side changes required

## How It Works
```
Client → Proxy (4000) → llama-server (8080)
   │           │              │
   │  model: *-Think   │              │
   │──────────────────►│              │
   │                   │ model: REAL_MODEL + enable_thinking: true
   │                   │─────────────►│
   │                   │◄─────────────┤
   │  SSE stream ◄─────┤◄─────────────┤
```

## Success Metrics
- Zero client modifications needed
- Streaming responses work identically to upstream
- Model abstraction is seamless
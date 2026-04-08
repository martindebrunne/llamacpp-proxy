# Active Context: Llama Proxy

## Current Work Focus
Enhanced proxy2.js with conditional response sanitization and No-Think passthrough mode.

## Recent Changes
| Date | Change |
|------|--------|
| 2026-08-08 | Created proxy2.js with response sanitization for reasoning models |
| 2026-08-08 | Added reasoning field filtering (reasoning_content, reasoning) |
| 2026-08-08 | Added XML block extraction from reasoning text |
| 2026-08-08 | Added SSE parsing and reconstruction |
| 2026-08-08 | Added JSON sanitization for choices and messages |
| 2026-08-08 | Added content recovery from reasoning when content is empty |
| 2026-08-08 | Modified mapRequest() to return body unchanged in No-Think mode |
| 2026-08-08 | Modified sanitizeResponseText() to skip sanitization in No-Think mode |
| 2026-08-08 | Updated forwardJsonPost() to pass incomingModel to sanitizeResponseText() |

## Next Steps
- Monitor proxy2.js performance with Think/No-Think modes
- Consider adding configuration for sanitization toggle
- Document No-Think passthrough behavior

## Important Patterns
- Model name transformation via `chat_template_kwargs`
- Streaming response passthrough via `ReadableStream`
- Selective route interception for OpenAI-compatible endpoints
- **Async logging with queue-based batching**
- **Log rotation (time and size-based)**
- **Console logging with compressed format**
- **File logging with complete request/response payloads (no truncation)**
- **Thinking mode indicator (✓/✗)**
- **Status indicator (✓200/✗500)**
- **Command line port configuration (proxyPort:upstreamPort)**
- **Port configuration priority: CLI > ENV > defaults**
- **Conditional response sanitization (Think mode only)**
- **No-Think mode passthrough (no transformation)**

## Learnings
- Single-file Express apps are simple to deploy
- Native `fetch()` works well for proxying
- `http-proxy-middleware` handles WebSocket passthrough automatically
- Queue-based logging prevents blocking request handling
- Response collection allows logging streaming responses
- Console logging provides real-time debugging visibility
- File logging preserves full request/response details
- Command line arguments provide convenient port configuration
- Environment variables serve as fallback configuration
- npm scripts provide convenient entry point
- Dual logging (console compressed + file full) is optimal for debugging
- No truncation ensures complete debugging data in logs
- **proxy2.js provides better answers with Think mode enabled**
- **No-Think mode in proxy2.js is now pure passthrough**
- **Reasoning field filtering only applies to Think mode**
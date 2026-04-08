# Active Context: Llama Proxy

## Current Work Focus
Preserve usage metadata (token consumption) in SSE and JSON responses.

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
| 2026-08-08 | Added lastUsage variable to buildCleanSseFromEvents() |
| 2026-08-08 | Preserve usage metadata from upstream chunks in SSE responses |
| 2026-08-08 | Add usage to last chunk before [DONE] in SSE responses |
| 2026-08-08 | Preserve usage in sanitizeJsonText() for JSON responses |

## Next Steps
- Monitor token consumption data in client applications
- Consider adding usage metrics to logs

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
- **Usage metadata preservation in SSE and JSON responses**

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
- **Usage metadata must be explicitly preserved during sanitization**
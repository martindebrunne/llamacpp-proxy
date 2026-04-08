# Active Context: Llama Proxy

## Current Work Focus
Removed payload truncation from file logs to preserve complete request/response data.

## Recent Changes
| Date | Change |
|------|--------|
| 2026-07-04 | Created memory-bank documentation |
| 2026-07-04 | Created docs/api and docs/features structure |
| 2026-07-04 | Added async logger module (lib/logger.js) |
| 2026-07-04 | Integrated logging into proxy.js |
| 2026-07-04 | Created logs/ directory with README |
| 2026-07-04 | Added request/response payload logging |
| 2026-07-04 | Added response collection for streaming responses |
| 2026-07-04 | Fixed ReadableStream locked error |
| 2026-07-04 | Created scripts/view-logs.js compressed log viewer |
| 2026-07-04 | Added thinking mode indicator to logs |
| 2026-07-04 | Removed verbose payload logging from main logs |
| 2026-07-04 | Added console logging with compressed format |
| 2026-07-04 | Added thinking mode indicator (✓/✗) in console |
| 2026-07-04 | Added status indicator (✓200/✗500) in console |
| 2026-07-04 | Added command line port configuration (node proxy.js 3000:8081) |
| 2026-07-04 | Added port parsing with environment variable fallback |
| 2026-07-04 | Created package.json with npm start script |
| 2026-07-04 | Fixed log file format to include full request/response payloads |
| 2026-07-04 | Removed payload truncation from file logs |

## Next Steps
- Monitor console output for debugging
- Consider adding log level filtering option

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
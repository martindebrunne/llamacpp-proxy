# Active Context: Llama Proxy

## Current Work Focus
Initial project setup and architecture documentation.

## Recent Changes
| Date | Change |
|------|--------|
| 2026-07-04 | Created memory-bank documentation |
| 2026-07-04 | Created docs/api and docs/features structure |

## Next Steps
- Add tests (if needed)
- Add environment configuration support
- Consider authentication for non-local access

## Important Patterns
- Model name transformation via `chat_template_kwargs`
- Streaming response passthrough via `ReadableStream`
- Selective route interception for OpenAI-compatible endpoints

## Learnings
- Single-file Express apps are simple to deploy
- Native `fetch()` works well for proxying
- `http-proxy-middleware` handles WebSocket passthrough automatically
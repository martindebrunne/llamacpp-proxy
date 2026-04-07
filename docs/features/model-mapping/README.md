# Model Mapping Feature

## Purpose
Transform logical model names (`*-Think`, `*-No-Think`) into upstream-compatible requests with `enable_thinking` flag.

## Scope
- Intercept model names from client requests
- Map to real upstream model (`Qwen3.5-35B-A3B-T`)
- Inject `enable_thinking` flag via `chat_template_kwargs`

## Entry Points
- `mapRequest()` function in `proxy.js`
- Intercepted routes: `/chat/completions`, `/v1/chat/completions`, `/completions`, `/v1/completions`

## Related Documentation
- [API Overview](../../api/exposed/llama-proxy/overview.md)
- [System Patterns](../../memory-bank/system-patterns.md)
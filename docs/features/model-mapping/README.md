# Model Mapping Feature

## Purpose
Transform logical model names (`*-Think`, `*-No-Think`) into upstream-compatible requests with `enable_thinking` flag.

## Scope
- Intercept model names from client requests
- Map to real upstream model (`Qwen3.5-35B-A3B-T`)
- Inject `enable_thinking` flag via `chat_template_kwargs`
- Conditional response sanitization (Think mode only)
- Preserve usage metadata (token consumption)

## Entry Points
- `mapRequest()` function in `proxy2.js`
- Intercepted routes: `/chat/completions`, `/v1/chat/completions`, `/completions`, `/v1/completions`

## Behavior by Mode

### Think Mode (`*-Think`)
```javascript
// Request transformation
{
  "model": "Qwen3.5-35B-A3B-T-Think"
}
→
{
  "model": "Qwen3.5-35B-A3B-T",
  "chat_template_kwargs": {
    "enable_thinking": true
  }
}

// Response sanitization
- Filter reasoning_content fields
- Filter reasoning fields
- Reconstruct clean SSE/JSON
- Recover content from reasoning if empty
- Preserve usage metadata (prompt_tokens, completion_tokens, total_tokens)
```

### No-Think Mode (`*-No-Think`)
```javascript
// Request transformation
{
  "model": "Qwen3.5-35B-A3B-T-No-Think"
}
→
{
  "model": "Qwen3.5-35B-A3B-T-No-Think"  // Unchanged
}

// Response sanitization
- No transformation (passthrough)
- Original response preserved
- Usage metadata preserved (prompt_tokens, completion_tokens, total_tokens)
```

## Related Documentation
- [API Overview](../../api/exposed/llama-proxy/overview.md)
- [System Patterns](../../memory-bank/system-patterns.md)
- [Tech Context](../../memory-bank/tech-context.md)
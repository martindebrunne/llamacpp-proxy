# Model Mapping Feature

## Purpose
Transform logical model names (`*-Think`, `*-No-Think`) into upstream-compatible requests with `enable_thinking` flag.

## Scope
- Intercept model names from client requests
- Map to real upstream model (`Qwen3.5-35B-A3B-T`)
- Inject `enable_thinking` flag via `chat_template_kwargs`
- Conditional response sanitization (Think mode only)
- Preserve usage metadata (token consumption)
- Real-time streaming with separate usage chunk

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

// Response processing (real-time streaming)
- Process chunks in real-time via forwardStreamingResponse()
- Filter reasoning_content fields
- Filter reasoning fields
- Recover content from reasoning if empty
- Write usage metadata in separate chunk
- Write [DONE] marker
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

// Response processing (passthrough)
- No transformation
- Original response preserved
- Usage metadata preserved
```

## Helper Functions

| Function | Purpose |
|----------|---------|
| `isNonEmptyObject()` | Check if value is a non-empty object |
| `hasUsableContent()` | Check if value has usable content (string, array, object) |
| `recoverMessageFromReasoning()` | Recover content from reasoning field |
| `recoverDeltaFromReasoning()` | Recover content from reasoning field in delta |
| `parseSseEventBlock()` | Parse SSE event block |
| `serializeSseEvent()` | Serialize JSON to SSE format |
| `createSseChunkFromTemplate()` | Create SSE chunk from template |
| `splitSseBlocks()` | Split SSE buffer into complete blocks |

## Related Documentation
- [API Overview](../../api/exposed/llama-proxy/overview.md)
- [System Patterns](../../memory-bank/system-patterns.md)
- [Tech Context](../../memory-bank/tech-context.md)
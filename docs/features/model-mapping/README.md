# Model Mapping Feature

## Purpose
Transform logical model names (`*-Think`, `*-No-Think`) into upstream-compatible requests with `enable_thinking` flag. **Dynamic model detection** extracts the real model name from incoming requests.

## Scope
- Intercept model names from client requests
- **Dynamically extract real model name** (remove `-Think` or `-No-Think` suffix)
- Inject `enable_thinking` flag via `chat_template_kwargs`
- Conditional response sanitization (Think mode only)
- Preserve usage metadata (token consumption)
- Real-time streaming with separate usage chunk

## Entry Points
- `mapRequest()` function in `src/services/modelMapper.ts`
- `extractRealModel()` function in `src/services/modelMapper.ts`
- Intercepted routes: `/chat/completions`, `/v1/chat/completions`, `/completions`, `/v1/completions`

## Behavior by Mode

### Think Mode (`*-Think`)
```javascript
// Request transformation
{
  "model": "MyModel-Think"
}
→
{
  "model": "MyModel",
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
  "model": "MyModel-No-Think"
}
→
{
  "model": "MyModel-No-Think"  // Unchanged
}

// Response processing (passthrough)
- No transformation
- Original response preserved
- Usage metadata preserved
```

### Unknown Model (no suffix)
```javascript
// Request transformation
{
  "model": "MyModel"
}
→
{
  "model": "MyModel"  // Unchanged
}

// Response processing (passthrough)
- No transformation
- Original response preserved
```

## Helper Functions

| Function | Purpose |
|----------|---------|
| `extractRealModel()` | Extract real model name by removing `-Think` or `-No-Think` suffix |
| `hasModelSuffix()` | Check if model has a suffix |
| `isNonEmptyObject()` | Check if value is a non-empty object |
| `hasUsableContent()` | Check if value has usable content (string, array, object) |
| `recoverMessageFromReasoning()` | Recover content from reasoning field |
| `recoverDeltaFromReasoning()` | Recover content from reasoning field in delta |
| `parseSseEventBlock()` | Parse SSE event block |
| `serializeSseEvent()` | Serialize JSON to SSE format |
| `createSseChunkFromTemplate()` | Create SSE chunk from template |
| `splitSseBlocks()` | Split SSE buffer into complete blocks |

## Dynamic Model Detection

The proxy automatically detects the real model name from any incoming request:

| Incoming Model | Upstream Model |
|----------------|----------------|
| `Qwen3.5-35B-A3B-T-Think` | `Qwen3.5-35B-A3B-T` |
| `Llama3-70B-Think` | `Llama3-70B` |
| `MyCustomModel-No-Think` | `MyCustomModel` |

This makes the proxy **compatible with any model** served by llama.cpp.

## Related Documentation
- [API Overview](../../api/exposed/llama-proxy/overview.md)
- [System Patterns](../../../.memory-bank/system-patterns.md)
- [Tech Context](../../../.memory-bank/tech-context.md)

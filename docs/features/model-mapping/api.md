# Model Mapping API

## Field Mappings

### Input (Client Request)
```json
{
  "model": "MyModel-Think",
  "messages": [...],
  "chat_template_kwargs": {}
}
```

### Output (Upstream Request)
```json
{
  "model": "MyModel",
  "messages": [...],
  "chat_template_kwargs": {
    "enable_thinking": true
  }
}
```

## Transformation Rules

| Input Model Pattern | Output Model | enable_thinking |
|---------------------|--------------|-----------------|
| `*-Think` | `MyModel` (suffix removed) | `true` |
| `*-No-Think` | `MyModel-No-Think` (unchanged) | Passthrough (unchanged) |
| Other | Unchanged | Unchanged |

## Dynamic Model Detection

The proxy automatically extracts the real model name from any incoming request:

| Client Model | Extracted Model |
|--------------|-----------------|
| `Qwen3.5-35B-A3B-T-Think` | `Qwen3.5-35B-A3B-T` |
| `Llama3-70B-Think` | `Llama3-70B` |
| `MyCustomModel-No-Think` | `MyCustomModel-No-Think` |

This makes the proxy compatible with **any model** served by llama.cpp.

## chat_template_kwargs Handling

- If `chat_template_kwargs` exists in request: merged with `enable_thinking`
- If `chat_template_kwargs` doesn't exist: created with `enable_thinking` only

### Example: Merge
```json
// Input
{
  "chat_template_kwargs": {
    "temperature": 0.7
  }
}

// Output
{
  "chat_template_kwargs": {
    "temperature": 0.7,
    "enable_thinking": true
  }
}
```

## Helper Functions

| Function | Purpose |
|----------|---------|
| `extractRealModel(model)` | Extract real model by removing `-Think` or `-No-Think` suffix |
| `hasModelSuffix(model)` | Check if model has a suffix |
| `mapRequest(body)` | Transform request body for upstream |
# Model Mapping API

## Field Mappings

### Input (Client Request)
```json
{
  "model": "Qwen3.5-35B-A3B-T-Think",
  "messages": [...],
  "chat_template_kwargs": {}
}
```

### Output (Upstream Request)
```json
{
  "model": "Qwen3.5-35B-A3B-T",
  "messages": [...],
  "chat_template_kwargs": {
    "enable_thinking": true
  }
}
```

## Transformation Rules

| Input Model Pattern | Output Model | enable_thinking |
|---------------------|--------------|-----------------|
| `*-Think` | `Qwen3.5-35B-A3B-T` | `true` |
| `*-No-Think` | `Qwen3.5-35B-A3B-T` | `false` |
| Other | Unchanged | Unchanged |

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
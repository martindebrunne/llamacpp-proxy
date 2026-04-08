# Code Specification: Llama Proxy

## Coding Standards

### File Structure
- Single-file application (`proxy.js`)
- No submodules or separate files

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Constants | UPPERCASE_SNAKE_CASE | `PROXY_PORT`, `LLAMA_ORIGIN` |
| Functions | camelCase | `mapRequest()`, `forwardJsonPost()` |
| Variables | camelCase | `app`, `reader`, `contentType` |
| Routes | kebab-case or snake-case | `/chat/completions`, `/v1/models` |

### Code Style
- ES modules (`import`/`export`)
- Double quotes for strings
- Semicolons required
- 2-space indentation (Express default)

## Error Handling

### Pattern
```javascript
try {
  // operation
} catch (e) {
  console.error(`[ERROR] ${req.originalUrl}`, e);
  res.status(500).json({
    error: "proxy_error",
    message: String(e),
  });
}
```

### Error Response Format
```json
{
  "error": "proxy_error",
  "message": "<error string>"
}
```

## Logging
- Info: `[POST] <url> -> <upstream> \| incoming=<model> \| upstream=<model> \| thinking=<bool>`
- Error: `[ERROR] <url> <error>`

## Import Style
```javascript
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
```

## Async/Await
- Used for `forwardJsonPost()`
- Top-level await not used
- Error handling via try/catch
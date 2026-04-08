# Tech Context: Llama Proxy

## Technologies Used

| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js | Runtime | Latest |
| Express.js | Web framework | Latest |
| http-proxy-middleware | Proxy routing | Latest |

## Dependencies
```json
{
  "dependencies": {
    "express": "^4.x",
    "http-proxy-middleware": "^3.x"
  }
}
```

## Development Setup

### Prerequisites
- Node.js installed
- llama-server running on `http://127.0.0.1:8080`

### Starting the Proxy
```bash
node proxy.js
```

### Client Configuration
```javascript
{
  baseURL: "http://127.0.0.1:4000",
  apiKey: "any-value", // not validated
  model: "Qwen3.5-35B-A3B-T-Think" // or *-No-Think
}
```

## Environment Variables
None required - all configuration is hardcoded in `proxy.js`:
- `PROXY_HOST`: 127.0.0.1
- `PROXY_PORT`: 4000
- `LLAMA_ORIGIN`: http://127.0.0.1:8080
- `REAL_MODEL`: Qwen3.5-35B-A3B-T

## Technical Constraints
- Local network only (127.0.0.1)
- No authentication
- 5MB JSON body limit on intercepted routes
- 300s timeout for proxy connections
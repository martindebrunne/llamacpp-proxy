# Changelog: Llama Proxy

All notable changes to this project will be documented in this file.

## [1.0.11] - 2026-08-08

### Added
- Logging middleware for passthrough requests
- Complete request tracking for all routes (intercepted and passthrough)

---

## [1.0.10] - 2026-08-08

### Changed
- Updated `/v1/models` route to fetch upstream models and add Think/No-Think variants
- Added fallback to basic model list if upstream is unavailable
- Added llama.cpp compatibility warning to documentation

### Added
- Dynamic model listing from upstream llama.cpp server
- Think/No-Think variants for all upstream models

---

## [1.0.9] - 2026-08-08

### Changed
- Refactored streaming response handling: `forwardStreamingResponse()` writes chunks in real-time
- Added `isNonEmptyObject()` and `hasUsableContent()` helper functions
- Added `recoverMessageFromReasoning()` and `recoverDeltaFromReasoning()` functions
- Added `parseSseEventBlock()`, `serializeSseEvent()`, `createSseChunkFromTemplate()`, `splitSseBlocks()` utilities
- Usage metadata now written in separate chunk after content
- Added comprehensive error handling with try/catch/finally
- Removed `buildCleanSseFromEvents()` in favor of real-time streaming

### Fixed
- Streaming responses now processed more efficiently
- Usage metadata appears in dedicated chunk for easier client parsing

---

## [1.0.8] - 2026-08-08

### Fixed
- Preserve usage metadata in SSE responses (buildCleanSseFromEvents)
- Preserve usage metadata in JSON responses (sanitizeJsonText)
- Token consumption data now correctly forwarded to clients

---

## [1.0.7] - 2026-08-08

### Added
- proxy2.js: Enhanced version with conditional response sanitization
- Reasoning field filtering (reasoning_content, reasoning)
- XML block extraction from reasoning text
- SSE parsing and reconstruction
- JSON sanitization for choices/messages
- Content recovery from reasoning
- No-Think mode passthrough (no transformation)

### Changed
- mapRequest(): Returns body unchanged in No-Think mode
- sanitizeResponseText(): Skips sanitization in No-Think mode
- forwardJsonPost(): Passes incomingModel to sanitizeResponseText()

### Security
- No-Think mode now preserves original response without filtering

---

## [1.0.6] - 2026-07-04

### Added
- Async logger module (lib/logger.js)
- Request/response payload logging
- Response collection for streaming responses
- Console logging with compressed format
- Thinking mode indicator (✓/✗)
- Status indicator (✓200/✗500)
- Command line port configuration (node proxy.js 3000:8081)
- Port parsing with environment variable fallback
- package.json with npm start script

### Fixed
- ReadableStream locked error
- Log file format to include full request/response payloads
- Removed payload truncation from file logs

---

## [1.0.0] - 2026-07-04

### Added
- Initial release
- Express.js proxy server
- Model name transformation (Think/No-Think)
- OpenAI-compatible API endpoints
- Streaming response passthrough
- Authorization header passthrough
- WebSocket passthrough via http-proxy-middleware
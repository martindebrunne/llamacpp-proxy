# Changelog: Llama Proxy

## [1.0.7] - 2026-07-04

### Changed
- Removed payload truncation from file logs
- File logs now contain complete request/response payloads

## [1.0.6] - 2026-07-04

### Fixed
- Log file format now includes full request/response payloads

### Changed
- Console: compressed format (no payloads)
- File: full format with request/response payloads (truncated to 2000 chars)

## [1.0.5] - 2026-07-04

### Added
- Command line port configuration (`node proxy.js 3000:8081`)
- Port parsing with fallback to environment variables

### Changed
- Port configuration now supports command line arguments with priority over environment variables

## [1.0.4] - 2026-07-04

### Added
- Console logging with compressed format (`requestLogConsole`)
- Thinking mode indicator (✓/✗) in console output
- Status indicator (✓200/✗500) in console output

### Changed
- Console output now shows compressed logs in real-time
- File logs still contain full request/response payloads

## [1.0.3] - 2026-07-04

### Added
- Compressed log viewer (`scripts/view-logs.js`)
- Thinking mode indicator in logs (`thinking=true/false`)
- Compressed terminal output with summary statistics

### Changed
- Removed request/response payload logging from main logs to reduce verbosity
- Log format now cleaner: timestamp, level, method, path, models, thinking, status, duration

## [1.0.2] - 2026-07-04

### Added
- Request payload logging (full JSON body)
- Response payload logging (full JSON response)
- Response collection for streaming responses
- Payload truncation (2000 chars max) to prevent unbounded log growth
- Structured payload logging with JSON parsing when possible

### Changed
- Log format now includes `request=` and `response=` fields
- Response collection happens concurrently with streaming

## [1.0.1] - 2026-07-04

### Added
- Asynchronous logging module (`lib/logger.js`)
- Human-readable log files in `logs/` directory
- Log rotation (time-based: daily, size-based: 10MB)
- Graceful shutdown handlers (SIGTERM, SIGINT) with log flushing
- Request duration tracking
- Queue-based log batching for non-blocking writes

### Changed
- Replaced `console.log` with async logger for request logs
- Startup messages now use logger instead of console

## [1.0.0] - 2026-07-04

### Added
- Initial release
- Proxy server with Express.js
- OpenAI-compatible route interception
- Model name transformation (`*-Think` / `*-No-Think`)
- Streaming response forwarding
- Passthrough proxy for all other routes
- `/models` endpoint
- Memory bank documentation
- API documentation structure
- Feature documentation structure
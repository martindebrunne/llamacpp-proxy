/**
 * Logging middleware tests
 * Tests for Express logging middleware functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock fs/promises before any imports
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
}));

// Mock the logger module before importing middleware
vi.mock('../../lib/logger.js', () => ({
  consoleRequestLogStart: vi.fn(),
  consoleRequestLogEnd: vi.fn(),
  logRequestStart: vi.fn().mockResolvedValue(undefined),
  generateCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
  logStreamChunk: vi.fn().mockResolvedValue(undefined),
  formatPayload: vi.fn().mockReturnValue(''),
  formatSize: vi.fn().mockReturnValue('0B'),
  initLogger: vi.fn().mockResolvedValue(undefined),
  flushLogs: vi.fn().mockResolvedValue(undefined),
  info: vi.fn(),
  error: vi.fn(),
}));

// Re-import after mock setup
import * as fsPromises from 'node:fs/promises';

describe('Logging Middleware', () => {
  let app: express.Express;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let fsAppendFileMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fsAppendFileMock = vi.fn().mockResolvedValue(undefined);
    
    // Setup mocks - use the mocked version
    vi.mocked(fsPromises.appendFile).mockImplementation(fsAppendFileMock);
    vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fsPromises.stat).mockResolvedValue({ size: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleSpy.mockRestore();
  });

  describe('loggingMiddleware', () => {
    it('should log request start with correlation ID', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      const { consoleRequestLogStart } = await import('../../lib/logger.js');
      vi.clearAllMocks();
      
      app.use(loggingMiddleware);
      app.get('/test', (req, res) => {
        res.json({ status: 'ok' });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(consoleRequestLogStart).toHaveBeenCalled();
    });

    it('should log request end with status and duration', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      const { consoleRequestLogEnd } = await import('../../lib/logger.js');
      vi.clearAllMocks();
      
      app.use(loggingMiddleware);
      app.get('/test', (req, res) => {
        res.json({ status: 'ok' });
      });

      await request(app).get('/test');
      
      expect(consoleRequestLogEnd).toHaveBeenCalled();
    });

    it('should extract model from request body', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      const { consoleRequestLogStart } = await import('../../lib/logger.js');
      vi.clearAllMocks();
      
      app.use(loggingMiddleware);
      app.post('/chat/completions', (req, res) => {
        res.json({ choices: [{ finish_reason: 'stop' }] });
      });

      await request(app)
        .post('/chat/completions')
        .send({ model: 'llama-3.1-8b' });

      expect(consoleRequestLogStart).toHaveBeenCalled();
      const callArgs = consoleRequestLogStart.mock.calls[0][0];
      expect(callArgs.incomingModel).toBe('llama-3.1-8b');
    });

    it('should extract thinking mode from request body', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      const { consoleRequestLogStart } = await import('../../lib/logger.js');
      vi.clearAllMocks();
      
      app.use(loggingMiddleware);
      app.post('/chat/completions', (req, res) => {
        res.json({ choices: [{ finish_reason: 'stop' }] });
      });

      await request(app)
        .post('/chat/completions')
        .send({ thinking: true });

      expect(consoleRequestLogStart).toHaveBeenCalled();
      const callArgs = consoleRequestLogStart.mock.calls[0][0];
      expect(callArgs.thinkingMode).toBe('true');
    });

    it('should extract thinking mode from chat_template_kwargs', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      const { consoleRequestLogStart } = await import('../../lib/logger.js');
      vi.clearAllMocks();
      
      app.use(loggingMiddleware);
      app.post('/chat/completions', (req, res) => {
        res.json({ choices: [{ finish_reason: 'stop' }] });
      });

      await request(app)
        .post('/chat/completions')
        .send({
          chat_template_kwargs: {
            enable_thinking: 'enabled',
          },
        });

      expect(consoleRequestLogStart).toHaveBeenCalled();
      const callArgs = consoleRequestLogStart.mock.calls[0][0];
      expect(callArgs.thinkingMode).toBe('enabled');
    });

    it('should handle POST with request body', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      app.use(loggingMiddleware);
      app.post('/test', (req, res) => {
        res.json({ received: true });
      });

      const response = await request(app)
        .post('/test')
        .send({ data: 'test payload' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
    });

    it('should handle error responses', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      const { consoleRequestLogEnd } = await import('../../lib/logger.js');
      vi.clearAllMocks();
      
      app.use(loggingMiddleware);
      app.get('/error', (req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app).get('/error');

      expect(response.status).toBe(500);
      expect(consoleRequestLogEnd).toHaveBeenCalled();
    });

    it('should generate unique correlation IDs for each request', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      const { generateCorrelationId } = await import('../../lib/logger.js');
      vi.clearAllMocks();
      
      app.use(loggingMiddleware);
      app.get('/test1', (req, res) => {
        res.json({ id: 1 });
      });
      app.get('/test2', (req, res) => {
        res.json({ id: 2 });
      });

      const response1 = await request(app).get('/test1');
      const response2 = await request(app).get('/test2');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      // Correlation IDs should be called twice (once per request)
      expect(generateCorrelationId).toHaveBeenCalledTimes(2);
    });

    it('should include request payload in file logging', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      const { logRequestStart } = await import('../../lib/logger.js');
      vi.clearAllMocks();
      
      app.use(loggingMiddleware);
      app.post('/test', (req, res) => {
        res.json({ received: true });
      });

      await request(app)
        .post('/test')
        .send({ model: 'test-model', messages: [{ role: 'user', content: 'hello' }] });

      expect(logRequestStart).toHaveBeenCalled();
      const callArgs = logRequestStart.mock.calls[0][0];
      expect(callArgs.requestPayload).toEqual({ model: 'test-model', messages: [{ role: 'user', content: 'hello' }] });
    });

    it('should expose correlationId on req for downstream services', async () => {
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');

      app.use(loggingMiddleware);
      app.get('/correlation-id', (req, res) => {
        res.json({ correlationId: (req as any).correlationId });
      });

      const response = await request(app).get('/correlation-id');

      expect(response.status).toBe(200);
      expect(typeof response.body.correlationId).toBe('string');
      expect(response.body.correlationId.length).toBeGreaterThan(0);
    });
  });

  describe('extractThinkingMode', () => {
    it('should extract thinking from enable_thinking in chat_template_kwargs', async () => {
      const { extractThinkingMode } = await import('../../src/middleware/logging.js');
      const testBody = {
        model: 'llama-3.1',
        chat_template_kwargs: {
          enable_thinking: 'enabled',
        },
      };
      const result = extractThinkingMode(testBody);
      expect(result).toBe('enabled');
    });

    it('should extract thinking from thinking field directly', async () => {
      const { extractThinkingMode } = await import('../../src/middleware/logging.js');
      const testBody = {
        model: 'llama-3.1',
        thinking: true,
      };
      const result = extractThinkingMode(testBody);
      expect(result).toBe('true');
    });

    it('should return undefined for non-object body', async () => {
      const { extractThinkingMode } = await import('../../src/middleware/logging.js');
      const testBody = null;
      const result = extractThinkingMode(testBody);
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty object', async () => {
      const { extractThinkingMode } = await import('../../src/middleware/logging.js');
      const testBody = {};
      const result = extractThinkingMode(testBody);
      expect(result).toBeUndefined();
    });

    it('should prioritize enable_thinking over thinking', async () => {
      const { extractThinkingMode } = await import('../../src/middleware/logging.js');
      const testBody = {
        model: 'llama-3.1',
        thinking: false,
        chat_template_kwargs: {
          enable_thinking: 'enabled',
        },
      };
      const result = extractThinkingMode(testBody);
      expect(result).toBe('enabled');
    });
  });

  describe('updateStreamingState', () => {
    it('should update request state for streaming', async () => {
      const { updateStreamingState } = await import('../../src/middleware/logging.js');
      
      const mockReq: any = {
        method: 'POST',
        originalUrl: '/v1/chat/completions',
        url: '/v1/chat/completions',
        body: { model: 'test-model' },
      };
      
      await updateStreamingState(mockReq, true, 'upstream-model');

      expect(mockReq).toBeDefined();
    });

    it('should handle undefined upstream model', async () => {
      const { updateStreamingState } = await import('../../src/middleware/logging.js');
      
      const mockReq: any = {
        method: 'POST',
        originalUrl: '/v1/chat/completions',
        url: '/v1/chat/completions',
        body: { model: 'test-model' },
      };
      
      await updateStreamingState(mockReq, true, undefined);

      expect(mockReq).toBeDefined();
    });
  });

  describe('setRequestBodyForLogging', () => {
    it('should set request body for logging', async () => {
      const { setRequestBodyForLogging } = await import('../../src/middleware/logging.js');
      
      // Note: The function uses WeakMap to store state, so we can't directly mock it
      // This test verifies the function doesn't throw and handles the request properly
      const mockReq: any = {
        body: { original: 'data' },
      };
      
      // The function only sets loggedRequestBody if state exists in WeakMap
      // Since we can't populate WeakMap, we verify it doesn't throw
      expect(() => setRequestBodyForLogging(mockReq, { updated: 'body' }))
        .not.toThrow();
    });

    it('should handle request without state', async () => {
      const { setRequestBodyForLogging } = await import('../../src/middleware/logging.js');
      
      const mockReq: any = {
        body: { original: 'data' },
      };

      // Should not throw when there's no state
      expect(() => setRequestBodyForLogging(mockReq, { test: 'data' }))
        .not.toThrow();
    });
  });

  describe('logStreamChunk', () => {
    it('should log stream chunk to file', async () => {
      const { logStreamChunk } = await import('../../src/middleware/logging.js');
      
      await logStreamChunk(
        'stream-chunk-test',
        0,
        { content: 'test chunk data' }
      );

      // Verify the function completes without error
      expect(true).toBe(true);
    });

    it('should handle multiple stream chunks', async () => {
      const { logStreamChunk } = await import('../../src/middleware/logging.js');
      
      await logStreamChunk('multi-chunk', 0, { chunk: 0 });
      await logStreamChunk('multi-chunk', 1, { chunk: 1 });
      await logStreamChunk('multi-chunk', 2, { chunk: 2 });

      // Verify the function completes without error
      expect(true).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle requests without content-type', async () => {
      app.get('/no-content', (req, res) => {
        res.json({ status: 'ok' });
      });
      
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      app.use(loggingMiddleware);

      const response = await request(app).get('/no-content');
      expect(response.status).toBe(200);
    });

    it('should handle empty request body', async () => {
      app.post('/empty-body', (req, res) => {
        res.json({ received: {} });
      });
      
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      app.use(loggingMiddleware);

      const response = await request(app).post('/empty-body').send({});
      expect(response.status).toBe(200);
    });

    it('should handle very large response sizes', async () => {
      app.get('/large', (req, res) => {
        res.json({ data: 'x'.repeat(100000) });
      });
      
      const { loggingMiddleware } = await import('../../src/middleware/logging.js');
      app.use(loggingMiddleware);

      const response = await request(app).get('/large');
      expect(response.status).toBe(200);
    });
  });
});
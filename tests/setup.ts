/**
 * Test setup file
 * Provides mocks for console, file system, and date for deterministic testing
 */

import { vi } from 'vitest';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
}));

// Capture console.log output
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Get captured console.log calls
export function getConsoleCalls() {
  return consoleSpy.mock.calls.map((call) => call[0]);
}

// Reset all mocks
export function resetMocks() {
  consoleSpy.mockClear();
  consoleErrorSpy.mockClear();
}

// Cleanup after each test
afterEach(() => {
  resetMocks();
});

// Cleanup after all tests
afterAll(() => {
  consoleSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});
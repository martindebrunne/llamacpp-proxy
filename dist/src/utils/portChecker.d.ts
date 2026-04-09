/**
 * Port availability checker
 * Provides utilities to check if a port is available and find an available port
 */
/**
 * Check if a port is available
 * @param port - The port number to check
 * @returns Promise resolving to true if port is available
 */
export declare function isPortAvailable(port: number): Promise<boolean>;
/**
 * Find an available port starting from the given port
 * @param startPort - The starting port to check
 * @param maxAttempts - Maximum number of ports to try (default: 10)
 * @returns Promise resolving to an available port number
 */
export declare function findAvailablePort(startPort: number, maxAttempts?: number): Promise<number>;
//# sourceMappingURL=portChecker.d.ts.map
/**
 * Port availability checker
 * Provides utilities to check if a port is available and find an available port
 */
import net from "net";
/**
 * Check if a port is available
 * @param port - The port number to check
 * @returns Promise resolving to true if port is available
 */
export function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", (err) => {
            if (err.code === "EADDRINUSE") {
                resolve(false);
            }
            else {
                resolve(false);
            }
        });
        server.once("listening", () => {
            server.close();
            resolve(true);
        });
        server.listen(port, "127.0.0.1");
    });
}
/**
 * Find an available port starting from the given port
 * @param startPort - The starting port to check
 * @param maxAttempts - Maximum number of ports to try (default: 10)
 * @returns Promise resolving to an available port number
 */
export async function findAvailablePort(startPort, maxAttempts = 10) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const port = startPort + attempt;
        const available = await isPortAvailable(port);
        if (available) {
            return port;
        }
    }
    throw new Error(`No available ports found after trying ${maxAttempts} ports starting from ${startPort}`);
}
//# sourceMappingURL=portChecker.js.map
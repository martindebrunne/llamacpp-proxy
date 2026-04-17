/**
 * Response sanitizer service
 * Handles JSON response sanitization for thinking mode
 */
/**
 * Sanitize JSON response text
 * - Removes reasoning fields in Think mode
 * - Preserves usage metadata
 * - Recovers content from reasoning when needed
 */
export declare function sanitizeJsonText(text: string, incomingModel: string | undefined): string;
//# sourceMappingURL=responseSanitizer.d.ts.map
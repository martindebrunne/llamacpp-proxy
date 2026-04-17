/**
 * Type guard utilities
 */
export declare function isNonEmptyString(value: unknown): value is string;
export declare function isNonEmptyArray<T>(value: unknown): value is T[];
export declare function isNonEmptyObject(value: unknown): value is Record<string, unknown>;
export declare function hasUsableContent(value: unknown): boolean;
//# sourceMappingURL=typeGuards.d.ts.map
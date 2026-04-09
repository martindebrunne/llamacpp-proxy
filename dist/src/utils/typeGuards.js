/**
 * Type guard utilities
 */
export function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}
export function isNonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}
export function isNonEmptyObject(value) {
    return (!!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length > 0);
}
export function hasUsableContent(value) {
    return (isNonEmptyString(value) ||
        isNonEmptyArray(value) ||
        isNonEmptyObject(value));
}
//# sourceMappingURL=typeGuards.js.map
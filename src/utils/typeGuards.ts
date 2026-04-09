/**
 * Type guard utilities
 */

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

export function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

export function hasUsableContent(value: unknown): boolean {
  return (
    isNonEmptyString(value) ||
    isNonEmptyArray(value) ||
    isNonEmptyObject(value)
  );
}
/** unstable_cache serializes Date fields to strings — normalize for callers. */
export function toIsoTimestamp(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(String(value)).toISOString();
}

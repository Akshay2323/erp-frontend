/** Laravel list endpoints may return `[]`, `{ items: [...] }`, or `{}` when empty. */
export function normalizeApiList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as T[];
  }
  return [];
}

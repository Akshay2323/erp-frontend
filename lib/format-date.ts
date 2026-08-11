/**
 * Deterministic date text for SSR + client (same string in Node and the browser).
 * Do not use `toLocaleDateString()` without a locale — it causes hydration mismatches.
 */
export function formatDisplayDate(value: string | null | undefined): string {
  if (value == null || value === "") return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

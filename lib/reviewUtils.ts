// ─── Shared Review Utilities ─────────────────────────────────────────────────
// Extracted from the product hub page for reuse across product comparison,
// collections, and anywhere aggregated review data is needed.

/** Count occurrences of items in a pros/cons array across reviews. */
export function topItems(
  reviews: Array<{ pros?: string[]; cons?: string[]; [k: string]: unknown }>,
  field: "pros" | "cons",
  n: number,
): Array<{ text: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    for (const item of (r[field] ?? []) as string[]) {
      if (item?.trim()) counts.set(item.trim(), (counts.get(item.trim()) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([text, count]) => ({ text, count }));
}

/** Health score color config used across UI. */
export function scoreColor(score: number): { ring: string; text: string; bg: string } {
  if (score >= 70) return { ring: "#10b981", text: "#059669", bg: "#d1fae5" };
  if (score >= 40) return { ring: "#f59e0b", text: "#d97706", bg: "#fef3c7" };
  return { ring: "#ef4444", text: "#dc2626", bg: "#fee2e2" };
}

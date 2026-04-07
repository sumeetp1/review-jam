// ─── Trust Tier Styling ──────────────────────────────────────────────────────
// Shared tier visual config. Extracted from profile page for reuse
// across public profiles, review cards, and follow system.

export function getTierStyle(score: number): { bg: string; text: string; emoji: string } {
  if (score >= 500) return { bg: "bg-amber-900/40 border border-amber-700", text: "text-amber-300", emoji: "🏆" };
  if (score >= 250) return { bg: "bg-violet-900/40 border border-violet-700", text: "text-violet-300", emoji: "⭐" };
  if (score >= 100) return { bg: "bg-emerald-900/40 border border-emerald-700", text: "text-emerald-300", emoji: "✅" };
  if (score >= 50)  return { bg: "bg-blue-900/40 border border-blue-700", text: "text-blue-300", emoji: "🔵" };
  return { bg: "bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]", text: "text-slate-500 dark:text-zinc-400", emoji: "🌱" };
}

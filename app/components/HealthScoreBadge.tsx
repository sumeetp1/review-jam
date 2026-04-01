"use client";

import { useState } from "react";
import type { HealthBreakdown } from "../../lib/healthScore";

type Props = {
  score: number;
  breakdown?: HealthBreakdown;
};

export default function HealthScoreBadge({ score, breakdown }: Props) {
  const [expanded, setExpanded] = useState(false);

  const color =
    score >= 70
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
      : score >= 40
      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
      : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";

  const ringColor =
    score >= 70 ? "stroke-emerald-500" : score >= 40 ? "stroke-amber-500" : "stroke-red-500";

  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-semibold tabular-nums ${color} transition hover:opacity-80`}
        title="Review Health Score"
      >
        <svg width="16" height="16" viewBox="0 0 36 36" className="shrink-0">
          <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.15" />
          <circle
            cx="18" cy="18" r="16"
            fill="none"
            className={ringColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 18 18)"
          />
        </svg>
        {score}
      </button>

      {expanded && breakdown && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 w-48">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-2">Score Breakdown</p>
          <ScoreRow label="Quality" value={breakdown.quality} max={40} />
          <ScoreRow label="Engagement" value={breakdown.engagement} max={25} />
          <ScoreRow label="Credibility" value={breakdown.credibility} max={20} />
          <ScoreRow label="Freshness" value={breakdown.freshness} max={15} />
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 mb-0.5">
        <span>{label}</span>
        <span className="tabular-nums">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

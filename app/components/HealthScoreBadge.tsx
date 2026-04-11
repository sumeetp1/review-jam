"use client";

import { useState } from "react";
import type { HealthBreakdown } from "../../lib/healthScore";

type Props = {
  score: number;
  breakdown?: HealthBreakdown;
};

export default function HealthScoreBadge({ score, breakdown }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { pill, dot } =
    score >= 70
      ? { pill: "bg-emerald-50 text-[#66bb6a] border-emerald-200", dot: "bg-[#66bb6a]" }
      : score >= 40
      ? { pill: "bg-amber-50 text-[#ffa726] border-amber-200", dot: "bg-[#ffa726]" }
      : { pill: "bg-red-50 text-[#ef5350] border-red-200", dot: "bg-[#ef5350]" };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        title="Review Health Score — click for breakdown"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold tabular-nums transition hover:opacity-80 ${pill}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        {score}
      </button>

      {expanded && breakdown && (
        <div className="absolute top-full right-0 mt-1.5 z-50 bg-white border border-[#f5ddc0] rounded-xl shadow-xl p-3 w-52">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-semibold text-[#4a3828]">Review Health</p>
            <span className={`text-[11px] font-bold tabular-nums ${score >= 70 ? "text-[#66bb6a]" : score >= 40 ? "text-[#ffa726]" : "text-[#ef5350]"}`}>{score}/100</span>
          </div>
          <div className="space-y-1.5">
            <ScoreBar label="Quality" value={breakdown.quality} max={40} color="bg-blue-500" />
            <ScoreBar label="Engagement" value={breakdown.engagement} max={25} color="bg-[#ffa726]" />
            <ScoreBar label="Credibility" value={breakdown.credibility} max={20} color="bg-[#66bb6a]" />
            <ScoreBar label="Freshness" value={breakdown.freshness} max={15} color="bg-violet-500" />
          </div>
          <p className="text-[10px] text-[#8b7560] mt-2.5 leading-relaxed">Higher score = higher payout share</p>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] text-[#8b7560] mb-0.5">
        <span>{label}</span>
        <span className="tabular-nums font-medium">{value}<span className="text-[#c4a882]">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-[#ffecd2] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

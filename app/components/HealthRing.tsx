"use client";

import { scoreColor } from "../../lib/reviewUtils";

// ─── Health Score Ring ───────────────────────────────────────────────────────
// Extracted from the product hub page for reuse across product comparison,
// collections, and public profiles.

export default function HealthRing({ score, size = 92 }: { score: number; size?: number }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const col = scoreColor(score);
  const fontSize = Math.round(size * 0.2);
  const half = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={half} cy={half} r={r} fill="none" stroke="#27272a" strokeWidth="7" />
        <circle
          cx={half} cy={half} r={r} fill="none" stroke={col.ring} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`} style={{ transition: "stroke-dasharray .6s ease" }}
        />
        <text
          x={half} y={half} textAnchor="middle" dominantBaseline="central"
          fontSize={fontSize} fontWeight="800" fill={col.text}
          className="rotate-90" style={{ transformOrigin: `${half}px ${half}px` }}
        >
          {score}
        </text>
      </svg>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: col.text }}>
        Neutral Score
      </span>
    </div>
  );
}

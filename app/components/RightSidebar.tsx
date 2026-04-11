"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "./Avatar";
import type { ReviewData } from "./ReviewCard";

type Props = {
  allReviews: ReviewData[];
};

type SortMode = "score" | "likes" | "helpful";

const SORT_LABELS: Record<SortMode, string> = {
  score:   "Top score",
  likes:   "Most liked",
  helpful: "Most helpful",
};

function ScorePip({ score }: { score: number }) {
  const cls =
    score >= 70 ? "bg-[#34d399]" :
    score >= 40 ? "bg-[#fbbf24]" : "bg-[#4a4458]";
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cls} mt-0.5`} />
  );
}

export default function RightSidebar({ allReviews }: Props) {
  const [sort, setSort] = useState<SortMode>("score");

  const sorted = useMemo(() => {
    return [...allReviews]
      .filter((r) => r.summary || r.marketingQuote || r.content)
      .sort((a, b) => {
        if (sort === "score")   return (b.healthScore ?? 0) - (a.healthScore ?? 0);
        if (sort === "likes")   return (b.likesCount ?? 0) - (a.likesCount ?? 0);
        if (sort === "helpful") return (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0);
        return 0;
      })
      .slice(0, 10);
  }, [allReviews, sort]);

  return (
    <aside className="hidden lg:flex flex-col w-[240px] xl:w-[256px] pl-0 pr-0 py-5 sticky top-0 h-screen overflow-y-auto border-l border-[#2a2535] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

      {/* Header */}
      <div className="px-4 pb-3 border-b border-[#2a2535]">
        <h2 className="text-[13px] font-bold text-[#e8e4f0] mb-2">Top Reviews</h2>
        {/* Sort tabs */}
        <div className="flex gap-0.5 bg-[#1c1826] rounded-lg p-0.5">
          {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-md transition ${
                sort === s
                  ? "bg-[#1c1826] text-[#e8e4f0] shadow-sm"
                  : "text-[#8b839e] hover:text-[#cbc5d9]"
              }`}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Review list */}
      <div className="flex-1 divide-y divide-[#2a2535]/60">
        {sorted.length === 0 && (
          <p className="px-4 py-6 text-[12px] text-[#4a4458] text-center">No reviews yet.</p>
        )}
        {sorted.map((r, i) => {
          const snippet = r.summary || r.marketingQuote || r.content?.slice(0, 80);
          const score = r.healthScore ?? 0;
          return (
            <div key={r.id} className="px-4 py-3 hover:bg-[#231e2e] transition group">
              {/* Rank + product */}
              <div className="flex items-start gap-2 mb-1">
                <span className="text-[11px] font-bold text-[#3a3348] tabular-nums w-5 shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {r.productId && !r.productId.startsWith("organic_") ? (
                    <Link href={`/product/${r.productId}`} className="text-[12px] font-semibold text-[#e8e4f0] truncate group-hover:text-[#e04c8a] transition hover:underline block">
                      {r.productName}
                    </Link>
                  ) : (
                    <p className="text-[12px] font-semibold text-[#e8e4f0] truncate group-hover:text-[#e04c8a] transition">
                      {r.productName}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Avatar name={r.reviewerName} size="xs" />
                    <span className="text-[10px] text-[#8b839e] truncate">{r.reviewerName}</span>
                    {r.rating != null && (
                      <span className="text-[10px] text-[#f9a8d4] tabular-nums shrink-0">★{r.rating}</span>
                    )}
                  </div>
                </div>
                {/* Score */}
                <div className="flex flex-col items-end shrink-0 gap-0.5">
                  <ScorePip score={score} />
                  <span className={`text-[10px] font-bold tabular-nums ${
                    score >= 70 ? "text-[#34d399]"
                    : score >= 40 ? "text-[#fbbf24]"
                    : "text-[#4a4458]"
                  }`}>{score > 0 ? score : ""}</span>
                </div>
              </div>

              {/* Snippet */}
              {snippet && (
                <p className="text-[11px] text-[#8b839e] leading-relaxed line-clamp-2 ml-7">
                  &ldquo;{snippet}&rdquo;
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-3 ml-7 mt-1.5 text-[10px] text-[#4a4458]">
                {(r.likesCount ?? 0) > 0 && <span>👍 {r.likesCount}</span>}
                {(r.helpfulCount ?? 0) > 0 && <span>✓ {r.helpfulCount}</span>}
                {r.category && (
                  <span className="ml-auto text-[9px] font-medium uppercase tracking-wide text-[#3a3348]">
                    {r.category}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 border-t border-[#2a2535]">
        <p className="text-[10px] text-[#4a4458]">
          Rankings update in real-time based on score, likes and helpfulness.
        </p>
      </div>
    </aside>
  );
}

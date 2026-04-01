"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";

type VersionEntry = {
  id: string;
  versionNumber: number;
  versionLabel: string;
  content: string;
  rating: number;
  pros?: string[];
  cons?: string[];
  mediaUrls?: string[];
  createdAt: string;
};

type Props = {
  reviewId: string;
  originalReview: {
    content?: string;
    rating?: number;
    pros?: string[];
    cons?: string[];
    createdAt?: string;
  };
};

export default function ReviewTimeline({ reviewId, originalReview }: Props) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const q = query(
          collection(db, "reviews", reviewId, "versions"),
          orderBy("versionNumber", "asc"),
        );
        const snap = await getDocs(q);
        setVersions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VersionEntry)));
      } catch {
        // Index may not exist yet
      } finally {
        setLoading(false);
      }
    })();
  }, [reviewId]);

  if (loading) {
    return <p className="text-[12px] text-slate-400 py-2">Loading timeline...</p>;
  }

  const allEntries = [
    {
      label: "Original Review",
      content: originalReview.content,
      rating: originalReview.rating,
      pros: originalReview.pros,
      cons: originalReview.cons,
      date: originalReview.createdAt,
    },
    ...versions.map((v) => ({
      label: v.versionLabel,
      content: v.content,
      rating: v.rating,
      pros: v.pros,
      cons: v.cons,
      date: v.createdAt,
    })),
  ];

  return (
    <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
        Review Timeline
      </p>
      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-700" />

        {allEntries.map((entry, i) => (
          <div key={i} className="relative pb-4 last:pb-0">
            {/* Dot */}
            <div className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 ${
              i === allEntries.length - 1
                ? "bg-slate-800 dark:bg-slate-200 border-slate-800 dark:border-slate-200"
                : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
            }`} />

            <div className="ml-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {entry.label}
                </span>
                {entry.rating != null && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">
                    ★ {entry.rating}
                  </span>
                )}
              </div>
              {entry.date && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">
                  {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
              {entry.content && (
                <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                  {entry.content}
                </p>
              )}
              {entry.pros && entry.pros.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.pros.map((p, j) => (
                    <span key={j} className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                      + {p}
                    </span>
                  ))}
                </div>
              )}
              {entry.cons && entry.cons.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.cons.map((c, j) => (
                    <span key={j} className="text-[10px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                      - {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

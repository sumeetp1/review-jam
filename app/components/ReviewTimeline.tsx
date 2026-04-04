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
  const [selectedIdx, setSelectedIdx] = useState(-1); // -1 = none selected (pills only)

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
    return <p className="text-[12px] text-slate-400 py-1 animate-pulse">Loading journey...</p>;
  }

  if (versions.length === 0) return null;

  const allEntries = [
    {
      label: "Original",
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

  const selected = selectedIdx >= 0 ? allEntries[selectedIdx] : null;

  return (
    <div>
      {/* Journey pills */}
      <div className="flex gap-1.5 flex-wrap">
        {allEntries.map((entry, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelectedIdx(selectedIdx === i ? -1 : i)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
              selectedIdx === i
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
            }`}
          >
            {i === 0 ? "Original" : entry.label}
            {entry.rating != null && (
              <span className={`ml-1 ${selectedIdx === i ? "text-amber-200" : "text-amber-500 dark:text-amber-400"}`}>
                {"★"} {entry.rating}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Selected entry detail */}
      {selected && (
        <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-200">
              {selectedIdx === 0 ? "Original Review" : selected.label}
            </span>
            {selected.date && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {new Date(selected.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
          {selected.content && (
            <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
              {selected.content}
            </p>
          )}
          {selected.pros && selected.pros.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {selected.pros.map((p, j) => (
                <span key={j} className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                  + {p}
                </span>
              ))}
            </div>
          )}
          {selected.cons && selected.cons.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.cons.map((c, j) => (
                <span key={j} className="text-[10px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                  - {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

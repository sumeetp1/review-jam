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
};

export default function ReviewTimeline({ reviewId }: Props) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

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
    return <p className="text-[11px] text-slate-400 py-1 animate-pulse">Loading updates...</p>;
  }

  if (versions.length === 0) return null;

  return (
    <div className="mt-2 relative pl-4 border-l-2 border-indigo-200 dark:border-indigo-800/60 ml-1">
      {versions.map((v, i) => (
        <div key={v.id} className="pb-3 last:pb-0">
          {/* Thread dot */}
          <div className="absolute -left-[5px] mt-1.5 w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500" style={{ top: "auto" }} />

          {/* Clickable label */}
          <button
            type="button"
            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            className="flex items-center gap-2 group"
          >
            <span className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 group-hover:underline transition-colors">
              {v.versionLabel}
            </span>
            {v.rating != null && (
              <span className="text-[10px] text-amber-500 dark:text-amber-400 tabular-nums">
                {"★"} {v.rating}
              </span>
            )}
            {v.createdAt && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {expandedIdx === i ? "▾" : "▸"}
            </span>
          </button>

          {/* Expanded content */}
          {expandedIdx === i && (
            <div className="mt-1.5 ml-0.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              {v.content && (
                <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed mb-2 whitespace-pre-wrap">
                  {v.content}
                </p>
              )}
              {v.pros && v.pros.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {v.pros.map((p, j) => (
                    <span key={j} className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                      + {p}
                    </span>
                  ))}
                </div>
              )}
              {v.cons && v.cons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {v.cons.map((c, j) => (
                    <span key={j} className="text-[10px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                      - {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

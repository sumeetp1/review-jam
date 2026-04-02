"use client";

import { useState } from "react";
import {
  collection, getDocs, addDoc, updateDoc, doc,
  increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

// ─── Shared types (imported by page + NewLogWizard) ───────────────────────────

export const ENTRY_TYPES = [
  { key: "delivery",  icon: "📦", label: "Delivery"      },
  { key: "service",   icon: "🔧", label: "Service"       },
  { key: "issue",     icon: "⚠️",  label: "Issue"         },
  { key: "milestone", icon: "🏁", label: "Milestone"     },
  { key: "mod",       icon: "✨", label: "Upgrade"       },
  { key: "accident",  icon: "💥", label: "Incident"      },
  { key: "trip",      icon: "🛣️",  label: "Long Trip"     },
  { key: "general",   icon: "📝", label: "Update"        },
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number]["key"];

export type LogEntry = {
  id: string;
  type: EntryType;
  title: string;
  content: string;
  usageLabel?: string;
  rating?: number | null;
  pros?: string[];
  cons?: string[];
  likesCount: number;
  likedBy: string[];
  createdAt: string;
};

export type OwnershipLog = {
  id: string;
  productId: string;
  ownerId: string;
  ownerName: string;
  variantId?: string | null;
  variantName?: string | null;
  purchaseDate?: string | null;
  title: string;
  coverMetric?: string | null;
  status: "active" | "sold" | "lemon";
  totalEntries: number;
  lastEntryAt: string;
  likesCount: number;
  likedBy: string[];
  createdAt: string;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  sold:   "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  lemon:  "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active Owner",
  sold:   "Sold",
  lemon:  "Lemon 🍋",
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  log: OwnershipLog;
  currentUserId?: string;
  currentUserName?: string;
  onLikeLog: (logId: string, likedBy: string[]) => void;
};

export default function OwnershipLogCard({ log, currentUserId, currentUserName, onLikeLog }: Props) {
  const [expanded, setExpanded]         = useState(false);
  const [entries, setEntries]           = useState<LogEntry[] | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  // Entry composer state
  const [entryType, setEntryType]       = useState<EntryType>("general");
  const [entryTitle, setEntryTitle]     = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [entryUsage, setEntryUsage]     = useState("");
  const [entryRating, setEntryRating]   = useState<number | null>(null);
  const [entryPros, setEntryPros]       = useState("");
  const [entryCons, setEntryCons]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleExpand() {
    if (expanded) { setExpanded(false); return; }
    if (entries)  { setExpanded(true);  return; }
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "ownershipLogs", log.id, "entries"));
      const fetched = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as LogEntry))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setEntries(fetched);
      setExpanded(true);
    } catch (e) { console.error(e); }
    finally     { setIsLoading(false); }
  }

  async function handleLikeEntry(entryId: string, likedBy: string[]) {
    if (!currentUserId) return;
    const has = likedBy.includes(currentUserId);
    setEntries((prev) =>
      prev?.map((e) =>
        e.id !== entryId ? e : {
          ...e,
          likesCount: has ? Math.max(0, e.likesCount - 1) : e.likesCount + 1,
          likedBy: has ? e.likedBy.filter((x) => x !== currentUserId) : [...e.likedBy, currentUserId],
        }
      ) ?? prev
    );
    await updateDoc(doc(db, "ownershipLogs", log.id, "entries", entryId), {
      likesCount: increment(has ? -1 : 1),
      likedBy:    has ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
    });
  }

  async function handleAddEntry() {
    if (!currentUserId || !entryTitle.trim() || !entryContent.trim()) return;
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const newEntry = {
        type:       entryType,
        title:      entryTitle.trim(),
        content:    entryContent.trim(),
        usageLabel: entryUsage.trim() || null,
        rating:     entryRating,
        pros:       entryPros.split("\n").map((s) => s.trim()).filter(Boolean),
        cons:       entryCons.split("\n").map((s) => s.trim()).filter(Boolean),
        likesCount: 0,
        likedBy:    [],
        createdAt:  now,
      };
      const ref = await addDoc(collection(db, "ownershipLogs", log.id, "entries"), newEntry);
      await updateDoc(doc(db, "ownershipLogs", log.id), {
        totalEntries: increment(1),
        lastEntryAt:  now,
      });
      setEntries((prev) => [...(prev ?? []), { id: ref.id, ...newEntry }]);
      // reset
      setEntryTitle(""); setEntryContent(""); setEntryUsage("");
      setEntryRating(null); setEntryPros(""); setEntryCons("");
      setEntryType("general"); setShowComposer(false);
    } catch (e) { console.error(e); }
    finally     { setIsSubmitting(false); }
  }

  const isOwner   = currentUserId === log.ownerId;
  const hasLiked  = currentUserId ? log.likedBy.includes(currentUserId) : false;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* ── Log header ── */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
              {log.ownerName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{log.ownerName}</p>
              {log.variantName && (
                <p className="text-[11px] text-slate-500 dark:text-slate-500 truncate">{log.variantName}</p>
              )}
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[log.status] ?? STATUS_STYLE.active}`}>
            {STATUS_LABEL[log.status] ?? "Active"}
          </span>
        </div>

        <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{log.title}</h3>

        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 dark:text-slate-500 flex-wrap">
          {log.coverMetric && (
            <span className="font-medium text-slate-700 dark:text-slate-300">📍 {log.coverMetric}</span>
          )}
          <span>{log.totalEntries} update{log.totalEntries !== 1 ? "s" : ""}</span>
          {log.purchaseDate && (
            <span>
              Since {new Date(log.purchaseDate + "-01").toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </span>
          )}
          <span className="ml-auto text-[10px]">
            {new Date(log.lastEntryAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handleExpand}
            className="flex-1 text-center text-[12px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {isLoading ? "Loading…" : expanded ? "▲ Collapse timeline" : `▼ Read full log (${log.totalEntries})`}
          </button>
          <button
            type="button"
            onClick={() => onLikeLog(log.id, log.likedBy)}
            className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border transition ${
              hasLiked
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            ♥ {log.likesCount}
          </button>
        </div>
      </div>

      {/* ── Timeline ── */}
      {expanded && entries !== null && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-slate-500 dark:text-slate-500">No entries yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {entries.map((entry, idx) => {
                const typeObj  = ENTRY_TYPES.find((t) => t.key === entry.type) ?? ENTRY_TYPES[7];
                const entryLiked = currentUserId ? entry.likedBy.includes(currentUserId) : false;
                return (
                  <div key={entry.id} className="px-4 py-4 flex gap-3">
                    {/* Timeline spine */}
                    <div className="flex flex-col items-center gap-0 shrink-0 pt-0.5" style={{ width: 24 }}>
                      <span className="text-[17px] leading-none">{typeObj.icon}</span>
                      {idx < entries.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1.5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-600">
                            {typeObj.label}
                          </span>
                          {entry.usageLabel && (
                            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                              @ {entry.usageLabel}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-600 shrink-0 whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>

                      <h4 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{entry.title}</h4>

                      {entry.rating != null && (
                        <p className="text-[12px] text-amber-500 dark:text-amber-400 mt-0.5">
                          {"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}
                          <span className="ml-1 text-slate-400 dark:text-slate-600">{entry.rating}/5</span>
                        </p>
                      )}

                      <p className="text-[13px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed whitespace-pre-line">{entry.content}</p>

                      {((entry.pros?.length ?? 0) > 0 || (entry.cons?.length ?? 0) > 0) && (
                        <div className="grid grid-cols-2 gap-3 mt-2.5">
                          {(entry.pros?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-500 mb-1">✓ Pros</p>
                              {entry.pros!.map((p, i) => (
                                <p key={i} className="text-[12px] text-slate-600 dark:text-slate-400 leading-snug">· {p}</p>
                              ))}
                            </div>
                          )}
                          {(entry.cons?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-500 mb-1">✗ Cons</p>
                              {entry.cons!.map((c, i) => (
                                <p key={i} className="text-[12px] text-slate-600 dark:text-slate-400 leading-snug">· {c}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleLikeEntry(entry.id, entry.likedBy)}
                        className={`mt-2 flex items-center gap-1 text-[11px] font-medium transition ${
                          entryLiked
                            ? "text-rose-500 dark:text-rose-400"
                            : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
                        }`}
                      >
                        ♥{entry.likesCount > 0 ? ` ${entry.likesCount}` : ""}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Add entry (owner only) ── */}
          {isOwner && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              {!showComposer ? (
                <button
                  type="button"
                  onClick={() => setShowComposer(true)}
                  className="w-full text-center text-[12px] font-medium text-violet-600 dark:text-violet-400 border border-dashed border-violet-300 dark:border-violet-700 rounded-lg py-2 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition"
                >
                  + Add update to this log
                </button>
              ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">New log entry</p>

                  {/* Type selector */}
                  <div className="flex gap-1.5 flex-wrap">
                    {ENTRY_TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setEntryType(t.key)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition ${
                          entryType === t.key
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={entryTitle}
                      onChange={(e) => setEntryTitle(e.target.value)}
                      placeholder="Entry title*"
                      className="col-span-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    <input
                      value={entryUsage}
                      onChange={(e) => setEntryUsage(e.target.value)}
                      placeholder="Usage (e.g. 25,000 km)"
                      className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    <select
                      value={entryRating ?? ""}
                      onChange={(e) => setEntryRating(e.target.value ? Number(e.target.value) : null)}
                      className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100"
                    >
                      <option value="">Rating (optional)</option>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>{"★".repeat(n)} {n}/5</option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={entryContent}
                    onChange={(e) => setEntryContent(e.target.value)}
                    placeholder="Share your experience in detail…*"
                    rows={4}
                    className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <textarea
                      value={entryPros}
                      onChange={(e) => setEntryPros(e.target.value)}
                      placeholder={"Pros\n(one per line)"}
                      rows={3}
                      className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
                    />
                    <textarea
                      value={entryCons}
                      onChange={(e) => setEntryCons(e.target.value)}
                      placeholder={"Cons\n(one per line)"}
                      rows={3}
                      className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddEntry}
                      disabled={isSubmitting || !entryTitle.trim() || !entryContent.trim()}
                      className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition"
                    >
                      {isSubmitting ? "Posting…" : "Post Entry"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowComposer(false)}
                      className="px-4 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

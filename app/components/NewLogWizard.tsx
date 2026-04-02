"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ENTRY_TYPES, EntryType, OwnershipLog } from "./OwnershipLogCard";

type Props = {
  productId: string;
  productName: string;
  variants: { id: string; name: string }[];
  userId: string;
  userName: string;
  onCreated: (log: OwnershipLog) => void;
  onClose: () => void;
};

export default function NewLogWizard({
  productId, productName, variants,
  userId, userName, onCreated, onClose,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1: log metadata ──────────────────────────────────────────────────
  const [title, setTitle]             = useState(`My ${productName} Ownership Log`);
  const [variantId, setVariantId]     = useState("");
  const [variantName, setVariantName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [coverMetric, setCoverMetric] = useState("");
  const [status, setStatus]           = useState<"active" | "sold" | "lemon">("active");

  // ── Step 2: first entry ───────────────────────────────────────────────────
  const [entryType, setEntryType]       = useState<EntryType>("delivery");
  const [entryTitle, setEntryTitle]     = useState("Initial Impressions & Delivery");
  const [entryUsage, setEntryUsage]     = useState("0 km");
  const [entryContent, setEntryContent] = useState("");
  const [entryRating, setEntryRating]   = useState<number | null>(null);
  const [entryPros, setEntryPros]       = useState("");
  const [entryCons, setEntryCons]       = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState("");

  function handleVariantChange(id: string) {
    setVariantId(id);
    setVariantName(variants.find((v) => v.id === id)?.name ?? "");
  }

  async function handleSubmit() {
    if (!entryContent.trim()) { setError("Please write your initial impressions."); return; }
    setIsSubmitting(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const logData = {
        productId,
        productName,
        ownerId:      userId,
        ownerName:    userName,
        variantId:    variantId    || null,
        variantName:  variantName  || null,
        purchaseDate: purchaseDate || null,
        title:        title.trim(),
        coverMetric:  coverMetric.trim() || null,
        status,
        totalEntries: 1,
        lastEntryAt:  now,
        likesCount:   0,
        likedBy:      [],
        createdAt:    now,
      };
      const logRef = await addDoc(collection(db, "ownershipLogs"), logData);

      const firstEntry = {
        type:       entryType,
        title:      entryTitle.trim() || "Initial Impressions",
        content:    entryContent.trim(),
        usageLabel: entryUsage.trim() || null,
        rating:     entryRating,
        pros:       entryPros.split("\n").map((s) => s.trim()).filter(Boolean),
        cons:       entryCons.split("\n").map((s) => s.trim()).filter(Boolean),
        likesCount: 0,
        likedBy:    [],
        createdAt:  now,
      };
      await addDoc(collection(db, "ownershipLogs", logRef.id, "entries"), firstEntry);

      onCreated({ id: logRef.id, ...logData } as OwnershipLog);
    } catch (e: any) {
      setError("Something went wrong. Please try again.");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Start Ownership Log</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {[1, 2].map((n) => (
                <div key={n} className={`h-1 rounded-full transition-all ${n === step ? "w-6 bg-violet-600" : n < step ? "w-6 bg-violet-300 dark:bg-violet-700" : "w-3 bg-slate-200 dark:bg-slate-700"}`} />
              ))}
              <span className="text-[11px] text-slate-500 dark:text-slate-500 ml-1">Step {step} of 2</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">✕</button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* ── Step 1 ── */}
          {step === 1 && (
            <>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 block mb-1.5">Log Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 placeholder-slate-400"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1">
                  e.g. "My Maruti Swift 2022 — 2 years, 35,000 km"
                </p>
              </div>

              {variants.length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 block mb-1.5">Variant / Trim</label>
                  <select
                    value={variantId}
                    onChange={(e) => handleVariantChange(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100"
                  >
                    <option value="">Select variant (optional)</option>
                    {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 block mb-1.5">Purchase Month</label>
                  <input
                    type="month"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 block mb-1.5">Coverage So Far</label>
                  <input
                    value={coverMetric}
                    onChange={(e) => setCoverMetric(e.target.value)}
                    placeholder="e.g. 35,000 km"
                    className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 block mb-1.5">Ownership Status</label>
                <div className="flex gap-2">
                  {(["active", "sold", "lemon"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
                        status === s
                          ? s === "active"
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : s === "sold"
                            ? "bg-slate-700 text-white border-slate-700"
                            : "bg-red-600 text-white border-red-600"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {s === "active" ? "✅ Active" : s === "sold" ? "Sold" : "Lemon 🍋"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!title.trim()}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition"
              >
                Next: Write first entry →
              </button>
            </>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <>
              <p className="text-[12px] text-slate-500 dark:text-slate-500">
                Write your first log entry — delivery impressions, first drive, anything you noticed right away.
              </p>

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
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
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
                  placeholder="Entry title"
                  className="col-span-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 placeholder-slate-400"
                />
                <input
                  value={entryUsage}
                  onChange={(e) => setEntryUsage(e.target.value)}
                  placeholder="Odometer (e.g. 0 km)"
                  className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 placeholder-slate-400"
                />
                <select
                  value={entryRating ?? ""}
                  onChange={(e) => setEntryRating(e.target.value ? Number(e.target.value) : null)}
                  className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100"
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
                placeholder="Share your first impressions — build quality, delivery experience, initial drive, anything that stood out…"
                rows={6}
                className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <textarea
                  value={entryPros}
                  onChange={(e) => setEntryPros(e.target.value)}
                  placeholder={"First impression pros\n(one per line)"}
                  rows={3}
                  className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
                />
                <textarea
                  value={entryCons}
                  onChange={(e) => setEntryCons(e.target.value)}
                  placeholder={"Initial concerns\n(one per line)"}
                  rows={3}
                  className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !entryContent.trim()}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                >
                  {isSubmitting ? "Creating…" : "🚀 Launch Ownership Log"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

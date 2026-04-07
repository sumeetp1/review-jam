"use client";

import { useState, useRef } from "react";
import {
  collection, addDoc, getDocs, query, where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { incrementTrustScore } from "../../lib/trustScore";
import { updateUserBadges } from "../../lib/badges";
import { slugify, categoryToSlug } from "../../lib/slugify";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
};

type ImportMode = "paste" | "csv";

const SOURCE_PLATFORMS = ["Amazon", "Reddit", "YouTube", "Blog", "Other"] as const;
type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

type ParsedRow = {
  productName: string;
  sourcePlatform: string;
  rating: number;
  content: string;
  pros: string;
  cons: string;
};

export default function ReviewImportModal({ isOpen, onClose, userId, userName }: Props) {
  const [mode, setMode] = useState<ImportMode>("paste");

  // Paste mode state
  const [productName, setProductName] = useState("");
  const [sourcePlatform, setSourcePlatform] = useState<SourcePlatform>("Amazon");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [prosText, setProsText] = useState("");
  const [consText, setConsText] = useState("");

  // CSV mode state
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successCount, setSuccessCount] = useState(0);

  // ── CSV Parsing ──────────────────────────────────────────────────────────
  function parseCSV(text: string): ParsedRow[] {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const requiredCols = ["productname", "sourceplatform", "rating", "content"];
    for (const col of requiredCols) {
      if (!header.includes(col)) throw new Error(`Missing required column: ${col}`);
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < header.length) continue;

      const row: Record<string, string> = {};
      header.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });

      const r = Number(row.rating);
      if (!row.productname || !row.content || isNaN(r) || r < 1 || r > 5) continue;

      rows.push({
        productName: row.productname,
        sourcePlatform: row.sourceplatform || "Other",
        rating: Math.round(r),
        content: row.content,
        pros: row.pros || "",
        cons: row.cons || "",
      });
    }
    return rows;
  }

  // Handle quoted CSV fields
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError("");
    setCsvRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) throw new Error("No valid rows found in CSV.");
        setCsvRows(rows);
      } catch (err) {
        setCsvError(err instanceof Error ? err.message : "Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
  }

  // ── Import a single review ──────────────────────────────────────────────
  async function importSingleReview(
    reviewProductName: string,
    reviewContent: string,
    reviewRating: number,
    reviewSource: string,
    reviewPros: string[],
    reviewCons: string[],
  ): Promise<void> {
    // 1. AI moderation
    const agentResponse = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewContent,
        reviewerName: userName,
        pros: reviewPros,
        cons: reviewCons,
      }),
    });
    const agentData = await agentResponse.json();

    if (!agentResponse.ok || !agentData?.success || !agentData?.analysis) {
      throw new Error(
        typeof agentData?.error === "string" && agentData.error.trim()
          ? agentData.error
          : "Unable to validate this review right now. Please try again.",
      );
    }
    if (agentData.analysis.isGenuine !== true) {
      throw new Error(`AI Quality Control: ${agentData.analysis.reason || "Review quality check failed."}`);
    }

    const marketingQuote: string = agentData.analysis?.marketingQuote || "";

    // 2. Find or create product
    const subjectSlug = slugify(reviewProductName);
    const communitySlug = categoryToSlug("Imported");
    let productId = `imported_${Date.now()}`;

    try {
      const existingSnap = await getDocs(
        query(collection(db, "products"), where("slug", "==", subjectSlug)),
      );
      if (!existingSnap.empty) {
        productId = existingSnap.docs[0].id;
      } else {
        const hubDoc = await addDoc(collection(db, "products"), {
          name: reviewProductName,
          slug: subjectSlug,
          brandName: "",
          category: "Imported",
          communitySlug,
          communitySeeded: true,
          subjectType: "product",
          campaignId: "organic",
          endDate: "",
          reviewCount: 0,
          avgRating: 0,
          avgHealthScore: 0,
          topQuote: "",
          totalLikes: 0,
          discoveryRank: 0,
          hasVerifiedOwner: false,
          bountyPool: 0,
          bountyPoolRemaining: 0,
          bountyStatus: "inactive",
          createdAt: new Date().toISOString(),
        });
        productId = hubDoc.id;
      }
    } catch (err) {
      console.warn("Hub auto-creation failed for import, using fallback ID:", err);
    }

    // 3. Create review doc
    await addDoc(collection(db, "reviews"), {
      content: reviewContent,
      rating: reviewRating,
      reviewerId: userId,
      reviewerName: userName,
      productId,
      productName: reviewProductName,
      productSlug: subjectSlug,
      communitySlug,
      category: "Imported",
      campaignId: "organic",
      likesCount: 0,
      likedBy: [],
      helpfulCount: 0,
      helpfulBy: [],
      notHelpfulCount: 0,
      notHelpfulBy: [],
      commentCount: 0,
      versionCount: 1,
      marketingQuote,
      pros: reviewPros,
      cons: reviewCons,
      summary: "",
      mediaUrls: [],
      isCampaignReview: false,
      eligibleForPayout: false,
      isVerifiedPurchase: false,
      isImported: true,
      importSource: reviewSource,
      biasFlag: agentData.analysis?.biasFlag ?? false,
      createdAt: new Date().toISOString(),
    });

    // 4. Trust score (less than organic: +2 vs +5)
    await incrementTrustScore(userId, "imported_review", 2).catch(() => {});

    // 5. Badges
    await updateUserBadges(userId).catch(() => {});
  }

  // ── Submit handlers ──────────────────────────────────────────────────────
  async function handlePasteSubmit() {
    setError("");
    if (!productName.trim()) { setError("Product name is required."); return; }
    if (!content.trim()) { setError("Review text is required."); return; }

    setSubmitting(true);
    try {
      const prosArr = prosText.split(",").map((s) => s.trim()).filter(Boolean);
      const consArr = consText.split(",").map((s) => s.trim()).filter(Boolean);

      await importSingleReview(
        productName.trim(),
        content.trim(),
        rating,
        sourcePlatform,
        prosArr,
        consArr,
      );

      setSuccessCount(1);
      // Reset form
      setProductName("");
      setContent("");
      setProsText("");
      setConsText("");
      setRating(5);
      setSourcePlatform("Amazon");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCSVImport() {
    setError("");
    if (csvRows.length === 0) { setError("No rows to import."); return; }

    setSubmitting(true);
    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      try {
        const prosArr = row.pros.split(",").map((s) => s.trim()).filter(Boolean);
        const consArr = row.cons.split(",").map((s) => s.trim()).filter(Boolean);

        await importSingleReview(
          row.productName,
          row.content,
          row.rating,
          row.sourcePlatform,
          prosArr,
          consArr,
        );
        imported++;
      } catch (err) {
        errors.push(`Row ${i + 1} (${row.productName}): ${err instanceof Error ? err.message : "Failed"}`);
      }
    }

    setSuccessCount(imported);
    if (errors.length > 0) {
      setError(`${errors.length} row(s) failed:\n${errors.slice(0, 3).join("\n")}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ""}`);
    }
    setCsvRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSubmitting(false);
  }

  function handleClose() {
    setError("");
    setSuccessCount(0);
    setCsvRows([]);
    setCsvError("");
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.06]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Import Reviews</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tab toggle */}
        <div className="flex border-b border-slate-200 dark:border-white/[0.06]">
          {(["paste", "csv"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); setSuccessCount(0); }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                mode === m
                  ? "border-indigo-500 text-slate-900 dark:text-zinc-100"
                  : "border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
              }`}
            >
              {m === "paste" ? "Paste Review" : "CSV Upload"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Success banner */}
          {successCount > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm text-emerald-600 dark:text-emerald-400">
              Successfully imported {successCount} review{successCount !== 1 ? "s" : ""}.
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-sm text-rose-600 dark:text-rose-400 whitespace-pre-wrap">
              {error}
            </div>
          )}

          {/* ── Paste Mode ── */}
          {mode === "paste" && (
            <>
              {/* Product name */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-zinc-400 mb-1">Product name *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Sony WH-1000XM5"
                  className="w-full text-sm bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Source platform */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-zinc-400 mb-1">Source platform</label>
                <select
                  value={sourcePlatform}
                  onChange={(e) => setSourcePlatform(e.target.value as SourcePlatform)}
                  className="w-full text-sm bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {SOURCE_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Rating */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-zinc-400 mb-1">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-xl transition-colors ${
                        star <= rating ? "text-amber-400" : "text-slate-300 dark:text-zinc-600"
                      }`}
                    >
                      &#9733;
                    </button>
                  ))}
                </div>
              </div>

              {/* Review text */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-zinc-400 mb-1">Review text *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  placeholder="Paste your review here..."
                  className="w-full text-sm bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Pros */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-zinc-400 mb-1">Pros (comma-separated)</label>
                <input
                  type="text"
                  value={prosText}
                  onChange={(e) => setProsText(e.target.value)}
                  placeholder="e.g. Great battery, Comfortable, Good ANC"
                  className="w-full text-sm bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Cons */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-zinc-400 mb-1">Cons (comma-separated)</label>
                <input
                  type="text"
                  value={consText}
                  onChange={(e) => setConsText(e.target.value)}
                  placeholder="e.g. Heavy, Expensive"
                  className="w-full text-sm bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={submitting}
                className="w-full bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {submitting ? "Importing..." : "Import Review"}
              </button>
            </>
          )}

          {/* ── CSV Mode ── */}
          {mode === "csv" && (
            <>
              <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-zinc-400 mb-1">Upload CSV file</label>
                <p className="text-[11px] text-slate-400 dark:text-zinc-600 mb-2">
                  Expected columns: productName, sourcePlatform, rating, content, pros, cons
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="w-full text-sm text-slate-600 dark:text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-500/10 file:text-indigo-600 dark:file:text-indigo-400 hover:file:bg-indigo-500/20 file:cursor-pointer file:transition"
                />
              </div>

              {csvError && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-sm text-rose-600 dark:text-rose-400">
                  {csvError}
                </div>
              )}

              {/* Preview table */}
              {csvRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-slate-500 dark:text-zinc-400">
                    {csvRows.length} row{csvRows.length !== 1 ? "s" : ""} parsed
                  </p>
                  <div className="overflow-x-auto -mx-1 rounded-lg border border-slate-200 dark:border-white/[0.06]">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wide bg-slate-50 dark:bg-white/[0.02]">
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Product</th>
                          <th className="px-3 py-2 font-medium">Source</th>
                          <th className="px-3 py-2 font-medium">Rating</th>
                          <th className="px-3 py-2 font-medium">Preview</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                        {csvRows.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-400 dark:text-zinc-600">{i + 1}</td>
                            <td className="px-3 py-2 text-slate-800 dark:text-zinc-200 max-w-[120px] truncate">{row.productName}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-zinc-400">{row.sourcePlatform}</td>
                            <td className="px-3 py-2 text-amber-500 dark:text-amber-400">{"*".repeat(row.rating)}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-zinc-500 max-w-[160px] truncate">{row.content}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {csvRows.length > 10 && (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-600">
                      Showing first 10 of {csvRows.length} rows.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleCSVImport}
                    disabled={submitting}
                    className="w-full bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-indigo-500 transition disabled:opacity-50"
                  >
                    {submitting ? "Importing..." : `Import All (${csvRows.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

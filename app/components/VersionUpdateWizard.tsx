"use client";

import { useState, useRef } from "react";
import {
  collection, addDoc, doc, updateDoc, increment as firestoreIncrement,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { CATEGORY_SUB_RATINGS } from "./ReviewWizard";

const VERSION_LABELS = [
  "1 Month Update",
  "3 Month Update",
  "6 Month Update",
  "1 Year Update",
  "Long-term Update",
];

type Props = {
  reviewId: string;
  existingVersionCount: number;
  productName: string;
  category: string;
  onClose: () => void;
  onSaved?: () => void;
};

export default function VersionUpdateWizard({
  reviewId,
  existingVersionCount,
  productName,
  category,
  onClose,
  onSaved,
}: Props) {
  const [versionLabel, setVersionLabel] = useState(VERSION_LABELS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [proInput, setProInput] = useState("");
  const [conInput, setConInput] = useState("");
  const [subRatings, setSubRatings] = useState<Record<string, number>>({});
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const subRatingKeys = CATEGORY_SUB_RATINGS[category] ?? [];
  const finalLabel = versionLabel === "Custom" ? customLabel : versionLabel;

  const handleSubmit = async () => {
    setError("");
    if (!finalLabel.trim()) { setError("Please select or enter a version label."); return; }
    if (rating === 0) { setError("Please select a rating."); return; }
    if (content.trim().length < 20) { setError("Please write at least 20 characters."); return; }

    setSubmitting(true);
    try {
      // Upload media
      const mediaUrls: string[] = [];
      for (const file of mediaFiles) {
        const storageRef = ref(storage, `reviews/${reviewId}/v${existingVersionCount + 1}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        mediaUrls.push(await getDownloadURL(storageRef));
      }

      const versionData = {
        versionNumber: existingVersionCount + 1,
        versionLabel: finalLabel,
        content: content.trim(),
        rating,
        subRatings,
        pros,
        cons,
        mediaUrls,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "reviews", reviewId, "versions"), versionData);

      // Update parent review metadata
      await updateDoc(doc(db, "reviews", reviewId), {
        versionCount: firestoreIncrement(1),
        latestVersionLabel: finalLabel,
        lastUpdatedAt: new Date().toISOString(),
      });

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save update.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-start px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Post an Update</h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{productName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-sm">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Version label */}
          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Update type</label>
            <div className="flex flex-wrap gap-1.5">
              {[...VERSION_LABELS, "Custom"].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setVersionLabel(l)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    versionLabel === l
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                      : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {versionLabel === "Custom" && (
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g., 2 Year Update"
                className="mt-2 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100"
              />
            )}
          </div>

          {/* Rating */}
          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Updated rating</label>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} className="text-xl transition-transform hover:scale-110 leading-none">
                  <span className={rating >= star ? "text-amber-400" : "text-slate-200 dark:text-slate-700"}>★</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sub-ratings */}
          {subRatingKeys.length > 0 && (
            <div className="space-y-2">
              <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300">Sub-ratings</label>
              {subRatingKeys.map((attr) => (
                <div key={attr} className="flex items-center justify-between">
                  <span className="text-[12px] text-slate-600 dark:text-slate-400">{attr}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setSubRatings((p) => ({ ...p, [attr]: star }))} className="text-base transition-transform hover:scale-110 leading-none">
                        <span className={(subRatings[attr] ?? 0) >= star ? "text-amber-400" : "text-slate-200 dark:text-slate-700"}>★</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">What changed?</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="How has your experience changed since your last review?"
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">{content.trim().length}/20 min</p>
          </div>

          {/* Pros */}
          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">New pros</label>
            <div className="flex gap-2 mb-1">
              <input type="text" value={proInput} onChange={(e) => setProInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (proInput.trim()) { setPros((p) => [...p, proInput.trim()]); setProInput(""); } } }}
                placeholder="Add a pro" className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100" />
              <button type="button" onClick={() => { if (proInput.trim()) { setPros((p) => [...p, proInput.trim()]); setProInput(""); } }}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition">Add</button>
            </div>
            {pros.length > 0 && <div className="flex flex-wrap gap-1">{pros.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[11px] font-medium">
                + {p} <button type="button" onClick={() => setPros((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 text-emerald-400 hover:text-emerald-700">×</button>
              </span>
            ))}</div>}
          </div>

          {/* Cons */}
          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">New cons</label>
            <div className="flex gap-2 mb-1">
              <input type="text" value={conInput} onChange={(e) => setConInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (conInput.trim()) { setCons((p) => [...p, conInput.trim()]); setConInput(""); } } }}
                placeholder="Add a con" className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100" />
              <button type="button" onClick={() => { if (conInput.trim()) { setCons((p) => [...p, conInput.trim()]); setConInput(""); } }}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition">Add</button>
            </div>
            {cons.length > 0 && <div className="flex flex-wrap gap-1">{cons.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-[11px] font-medium">
                - {c} <button type="button" onClick={() => setCons((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 text-red-400 hover:text-red-700">×</button>
              </span>
            ))}</div>}
          </div>

          {/* Media */}
          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Photos</label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files) setMediaFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              + Add photos
            </button>
            {mediaFiles.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">{mediaFiles.length} file(s) selected</p>
            )}
          </div>

          {error && <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            {submitting ? "Saving..." : "Post Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

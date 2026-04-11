"use client";

import { useState, useRef } from "react";
import {
  collection, addDoc, doc, updateDoc, increment as firestoreIncrement,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";

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

  // Free-form sub-rating dimensions for version updates
  const [customDimensions, setCustomDimensions] = useState<string[]>(["", "", ""]);
  const subRatingKeys = customDimensions.filter((d) => d.trim() !== "");
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-[#1c1826] rounded-xl max-w-lg w-full shadow-lg border border-[#2a2535] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-start px-5 pt-5 pb-4 border-b border-[#2a2535] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#e8e4f0]">Post an Update</h2>
            <p className="text-[12px] text-[#8b839e] mt-0.5">{productName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8b839e] hover:text-[#cbc5d9] p-1 rounded-md hover:bg-[#231e2e] text-sm">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Version label */}
          <div>
            <label className="block text-[12px] font-medium text-[#cbc5d9] mb-1.5">Update type</label>
            <div className="flex flex-wrap gap-1.5">
              {[...VERSION_LABELS, "Custom"].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setVersionLabel(l)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    versionLabel === l
                      ? "bg-[#e04c8a] text-white border-[#e04c8a]"
                      : "bg-[#1c1826] text-[#cbc5d9] border-[#2a2535] hover:border-[#3a3348]"
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
                className="mt-2 w-full bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3a3348] text-[#e8e4f0]"
              />
            )}
          </div>

          {/* Rating */}
          <div>
            <label className="block text-[12px] font-medium text-[#cbc5d9] mb-1.5">Updated rating</label>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} className="text-xl transition-transform hover:scale-110 leading-none">
                  <span className={rating >= star ? "text-amber-400" : "text-[#2a2535]"}>★</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sub-ratings — free-form dimensions */}
          <div className="space-y-2">
            <label className="block text-[12px] font-medium text-[#cbc5d9]">Rate specific aspects <span className="font-normal text-[#8b839e]">(optional)</span></label>
            {customDimensions.map((dim, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text" value={dim}
                  onChange={(e) => { const u = [...customDimensions]; u[idx] = e.target.value; setCustomDimensions(u); }}
                  placeholder={`Dimension ${idx + 1}`}
                  className="flex-1 bg-[#1c1826] border border-[#2a2535] rounded-lg px-2.5 py-1.5 text-xs outline-none text-[#e8e4f0]"
                />
                {dim.trim() && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setSubRatings((p) => ({ ...p, [dim.trim()]: star }))} className="text-base transition-transform hover:scale-110 leading-none">
                        <span className={(subRatings[dim.trim()] ?? 0) >= star ? "text-amber-400" : "text-[#2a2535]"}>★</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {customDimensions.length < 5 && (
              <button type="button" onClick={() => setCustomDimensions((d) => [...d, ""])} className="text-[11px] text-[#e04c8a] hover:underline">+ Add dimension</button>
            )}
          </div>

          {/* Content */}
          <div>
            <label className="block text-[12px] font-medium text-[#cbc5d9] mb-1.5">What changed?</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="How has your experience changed since your last review?"
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3a3348] text-[#e8e4f0] placeholder:text-[#4a4458] resize-none"
            />
            <p className="text-[10px] text-[#8b839e] mt-0.5">{content.trim().length}/20 min</p>
          </div>

          {/* Pros */}
          <div>
            <label className="block text-[12px] font-medium text-[#cbc5d9] mb-1.5">New pros</label>
            <div className="flex gap-2 mb-1">
              <input type="text" value={proInput} onChange={(e) => setProInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (proInput.trim()) { setPros((p) => [...p, proInput.trim()]); setProInput(""); } } }}
                placeholder="Add a pro" className="flex-1 bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3a3348] text-[#e8e4f0]" />
              <button type="button" onClick={() => { if (proInput.trim()) { setPros((p) => [...p, proInput.trim()]); setProInput(""); } }}
                className="px-3 py-2 bg-[#1c1826] text-[#cbc5d9] rounded-lg text-sm font-medium hover:bg-[#231e2e] transition">Add</button>
            </div>
            {pros.length > 0 && <div className="flex flex-wrap gap-1">{pros.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-emerald-950/30 text-emerald-500 px-2 py-0.5 rounded text-[11px] font-medium">
                + {p} <button type="button" onClick={() => setPros((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 text-emerald-500 hover:text-emerald-500">×</button>
              </span>
            ))}</div>}
          </div>

          {/* Cons */}
          <div>
            <label className="block text-[12px] font-medium text-[#cbc5d9] mb-1.5">New cons</label>
            <div className="flex gap-2 mb-1">
              <input type="text" value={conInput} onChange={(e) => setConInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (conInput.trim()) { setCons((p) => [...p, conInput.trim()]); setConInput(""); } } }}
                placeholder="Add a con" className="flex-1 bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3a3348] text-[#e8e4f0]" />
              <button type="button" onClick={() => { if (conInput.trim()) { setCons((p) => [...p, conInput.trim()]); setConInput(""); } }}
                className="px-3 py-2 bg-[#1c1826] text-[#cbc5d9] rounded-lg text-sm font-medium hover:bg-[#231e2e] transition">Add</button>
            </div>
            {cons.length > 0 && <div className="flex flex-wrap gap-1">{cons.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-red-950/30 text-[#f87171] px-2 py-0.5 rounded text-[11px] font-medium">
                - {c} <button type="button" onClick={() => setCons((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 text-[#fca5a5] hover:text-[#f87171]">×</button>
              </span>
            ))}</div>}
          </div>

          {/* Media */}
          <div>
            <label className="block text-[12px] font-medium text-[#cbc5d9] mb-1.5">Photos</label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files) setMediaFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="px-3 py-2 bg-[#1c1826] text-[#cbc5d9] rounded-lg text-sm font-medium hover:bg-[#231e2e] transition">
              + Add photos
            </button>
            {mediaFiles.length > 0 && (
              <p className="text-[11px] text-[#8b839e] mt-1">{mediaFiles.length} file(s) selected</p>
            )}
          </div>

          {error && <p className="text-[12px] text-[#f87171]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2a2535] shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2.5 bg-[#e04c8a] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            {submitting ? "Saving..." : "Post Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

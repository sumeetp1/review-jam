"use client";

import { useState } from "react";
import {
  SUGGESTED_CATEGORIES,
} from "../../../lib/constants";
import { AVAILABLE_CATEGORIES } from "../../../lib/constants";
import type { ReviewFormData } from "./index";
import StarPicker from "./StarPicker";
import ModalShell from "./ModalShell";

export default function GenericReviewForm({
  productInfo,
  onSubmit,
  onClose,
}: {
  productInfo?: { name: string; category: string };
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [productName, setProductName] = useState(productInfo?.name ?? "");
  const [category, setCategory] = useState(productInfo?.category ?? AVAILABLE_CATEGORIES[0]);
  const [overallRating, setOverallRating] = useState(0);
  const [content, setContent] = useState("");
  const [isHonest, setIsHonest] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!productInfo && !productName.trim()) {
      setError("Please enter the product name.");
      return;
    }
    if (overallRating === 0) {
      setError("Please select a rating.");
      return;
    }
    if (content.trim().length < 20) {
      setError(`Please write at least 20 characters (${content.trim().length} so far).`);
      return;
    }
    if (!isHonest) {
      setError("Please confirm this is your honest opinion.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        productName: productInfo?.name ?? productName,
        category: productInfo?.category ?? category,
        productSource: "purchased",
        usageDuration: "1_4_weeks",
        purchaseChannel: "other",
        overallRating,
        subRatings: {},
        pros: [],
        cons: [],
        content,
        summary: "",
        bestFor: [],
        mediaFiles: [],
        isCampaignReview: false,
        reviewType: "generic",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="flex justify-between items-start px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Quick review</h2>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            Generic reviews are not eligible for payouts
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-sm shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
        {!productInfo && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              What are you reviewing? <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Sony WH-1000XM5"
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
        )}

        {!productInfo && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
            <input
              type="text"
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Tech, EV Charging, Construction..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-slate-100"
            />
            <datalist id="category-suggestions">
              {SUGGESTED_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
        )}

        {productInfo && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Reviewing</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{productInfo.name}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Overall rating <span className="text-red-400">*</span>
          </label>
          <StarPicker value={overallRating} onChange={setOverallRating} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Your review <span className="text-red-400">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your experience with this product..."
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm h-28 resize-y focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <p className={`text-right text-[11px] tabular-nums ${
            content.trim().length >= 20 ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400"
          }`}>
            {content.trim().length} chars
          </p>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={isHonest}
            onChange={(e) => setIsHonest(e.target.checked)}
            className="mt-0.5 accent-slate-900 shrink-0"
          />
          <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            I confirm this is my honest, independent opinion. <span className="text-red-400">*</span>
          </span>
        </label>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/40">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-[1.4] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {isSubmitting ? "Posting..." : "Post review"}
        </button>
      </div>
    </ModalShell>
  );
}

"use client";

import { useState } from "react";
import {
  SUGGESTED_CATEGORIES,
  getSubjectConfig,
  SUBJECT_TYPE_OPTIONS,
} from "../../../lib/constants";
import { AVAILABLE_CATEGORIES } from "../../../lib/constants";
import type { SubjectType } from "../../../lib/types";
import type { ReviewFormData } from "./index";
import StarPicker from "./StarPicker";
import OptionButton from "./OptionButton";
import ModalShell from "./ModalShell";

export default function GenericReviewForm({
  productInfo,
  subjectType: initialSubjectType = "product",
  onSubmit,
  onClose,
}: {
  productInfo?: { name: string; category: string };
  subjectType?: SubjectType;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [subjectType, setSubjectType] = useState<SubjectType>(initialSubjectType);
  const cfg = getSubjectConfig(subjectType);
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
      setError(`Please enter the ${cfg.label.toLowerCase()} name.`);
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
        productSource: cfg.sourceOptions[0]?.value ?? "purchased",
        usageDuration: cfg.durationOptions[0]?.value ?? "1_4_weeks",
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
        subjectType,
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
      <div className="flex justify-between items-start px-5 pt-5 pb-4 border-b border-[#2a2535] shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[#e8e4f0]">Quick review</h2>
          <p className="text-[11px] text-[#fbbf24] mt-0.5">
            Generic reviews are not eligible for payouts
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#8b839e] hover:text-[#cbc5d9] p-1 rounded-md hover:bg-[#231e2e] text-sm shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
        {/* Subject type picker */}
        {!productInfo && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#cbc5d9]">
              What type of thing are you reviewing?
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {SUBJECT_TYPE_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  selected={subjectType === opt.value}
                  onClick={() => setSubjectType(opt.value)}
                >
                  {opt.icon} {opt.label}
                </OptionButton>
              ))}
            </div>
          </div>
        )}

        {!productInfo && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#cbc5d9]">
              {cfg.nameLabel} <span className="text-[#fca5a5]">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={cfg.namePlaceholder}
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3a3348] text-[#e8e4f0] placeholder:text-[#4a4458]"
            />
          </div>
        )}

        {!productInfo && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#cbc5d9]">Category</label>
            <input
              type="text"
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Tech, Roads & Routes, Restaurants..."
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm outline-none text-[#e8e4f0]"
            />
            <datalist id="category-suggestions">
              {SUGGESTED_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
        )}

        {productInfo && (
          <div className="bg-[#1c1826] rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-[#8b839e] mb-0.5">Reviewing</p>
            <p className="text-sm font-medium text-[#e8e4f0]">{productInfo.name}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#cbc5d9]">
            Overall rating <span className="text-[#fca5a5]">*</span>
          </label>
          <StarPicker value={overallRating} onChange={setOverallRating} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#cbc5d9]">
            Your review <span className="text-[#fca5a5]">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Share your experience with this ${cfg.label.toLowerCase()}...`}
            className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm h-28 resize-y focus:outline-none focus:ring-1 focus:ring-[#3a3348] text-[#e8e4f0] placeholder:text-[#4a4458]"
          />
          <p className={`text-right text-[11px] tabular-nums ${
            content.trim().length >= 20 ? "text-[#34d399]" : "text-[#8b839e]"
          }`}>
            {content.trim().length} chars
          </p>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={isHonest}
            onChange={(e) => setIsHonest(e.target.checked)}
            className="mt-0.5 accent-[#e04c8a] shrink-0"
          />
          <span className="text-xs text-[#cbc5d9] leading-relaxed">
            I confirm this is my honest, independent opinion. <span className="text-[#fca5a5]">*</span>
          </span>
        </label>

        {error && (
          <p className="text-xs text-[#f87171] px-3 py-2 bg-red-950/30 rounded-lg border border-red-900">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#2a2535] flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 border border-[#2a2535] text-[#cbc5d9] py-2 rounded-lg text-sm font-medium hover:bg-[#231e2e] transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-[1.4] bg-[#e04c8a] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {isSubmitting ? "Posting..." : "Post review"}
        </button>
      </div>
    </ModalShell>
  );
}

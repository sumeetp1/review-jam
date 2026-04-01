"use client";

import { useState, useRef } from "react";
import { User } from "firebase/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewFormData = {
  productName: string;
  category: string;
  productSource: "brand_sent" | "purchased" | "gift";
  usageDuration: "less_1_week" | "1_4_weeks" | "1_3_months" | "3_plus_months";
  purchaseChannel: "amazon" | "brand_website" | "retail" | "other";
  overallRating: number;
  subRatings: Record<string, number>;
  pros: string[];
  cons: string[];
  content: string;
  summary: string;
  bestFor: string[];
  mediaFiles: File[];
  isCampaignReview: boolean;
  reviewType: "campaign" | "verified" | "generic";
  productCode?: string;
  forkedFromReviewId?: string;
  forkedFromReviewerName?: string;
  channelId?: string;
  channelSlug?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const AVAILABLE_CATEGORIES = [
  "Tech", "Home", "SaaS", "Automotive", "Beauty",
  "Gaming", "Fitness", "Travel", "Finance",
];

export const CATEGORY_SUB_RATINGS: Record<string, string[]> = {
  Tech:       ["Performance",    "Build Quality",    "Value for Money"],
  Home:       ["Durability",     "Design",           "Ease of Use"],
  SaaS:       ["Features",       "Ease of Use",      "Customer Support"],
  Automotive: ["Performance",    "Comfort",          "Value for Money"],
  Beauty:     ["Results",        "Ingredients",      "Packaging"],
  Gaming:     ["Graphics",       "Gameplay",         "Value for Money"],
  Fitness:    ["Effectiveness",  "Build Quality",    "Value for Money"],
  Travel:     ["Comfort",        "Amenities",        "Value for Money"],
  Finance:    ["Ease of Use",    "Features",         "Support"],
};

const USAGE_DURATIONS = [
  { value: "less_1_week"   as const, label: "< 1 week" },
  { value: "1_4_weeks"     as const, label: "1–4 weeks" },
  { value: "1_3_months"    as const, label: "1–3 months" },
  { value: "3_plus_months" as const, label: "3+ months" },
];

const PURCHASE_CHANNELS = [
  { value: "amazon"        as const, label: "Amazon" },
  { value: "brand_website" as const, label: "Brand website" },
  { value: "retail"        as const, label: "Retail store" },
  { value: "other"         as const, label: "Other" },
];

// ─── Star Picker ──────────────────────────────────────────────────────────────

function StarPicker({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const textSize = size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className={`${textSize} transition-transform hover:scale-110 leading-none`}
          aria-label={`${star} star`}
        >
          <span
            className={
              (hovered || value) >= star
                ? "text-amber-400"
                : "text-slate-200 dark:text-slate-700"
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Chip Input ───────────────────────────────────────────────────────────────

function ChipInput({
  items,
  onAdd,
  onRemove,
  placeholder,
  maxItems = 10,
}: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
  maxItems?: number;
}) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed) && items.length < maxItems) {
      onAdd(trimmed);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim() || items.length >= maxItems}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition"
        >
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md text-xs font-medium"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 ml-0.5 leading-none text-sm"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Option Button ────────────────────────────────────────────────────────────

function OptionButton({
  selected,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
        selected
          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
          : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 disabled:opacity-40"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Shared modal shell ───────────────────────────────────────────────────────

function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {children}
      </div>
    </div>
  );
}

// ─── Generic (quick / unpaid) Review Form ────────────────────────────────────

function GenericReviewForm({
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
              Product name <span className="text-red-400">*</span>
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
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-slate-100"
            >
              {AVAILABLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
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
            placeholder="Share your experience with this product…"
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
          {isSubmitting ? "Posting…" : "Post review"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Main Wizard (Campaign / Verified / Organic) ──────────────────────────────

type ForkSource = {
  reviewId: string;
  reviewerName: string;
  productName: string;
  category: string;
  productId?: string;
};

type Props = {
  user: User;
  mode: "organic" | "campaign" | "verified" | "generic";
  productInfo?: { name: string; category: string };
  isCampaignReview?: boolean;
  forkSource?: ForkSource;
  channelId?: string;
  channelSlug?: string;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onClose: () => void;
};

const STEP_LABELS = ["Context", "Your Review", "Finish"];

export default function ReviewWizard({
  user: _user,
  mode,
  productInfo,
  isCampaignReview = false,
  forkSource,
  channelId,
  channelSlug,
  onSubmit,
  onClose,
}: Props) {
  // If forking, pre-fill product info from the fork source
  const effectiveProductInfo = forkSource
    ? { name: forkSource.productName, category: forkSource.category }
    : productInfo;

  // Wrap onSubmit to inject fork/channel metadata
  const wrappedSubmit = async (data: ReviewFormData) => {
    if (forkSource) {
      data.forkedFromReviewId = forkSource.reviewId;
      data.forkedFromReviewerName = forkSource.reviewerName;
    }
    if (channelId) { data.channelId = channelId; }
    if (channelSlug) { data.channelSlug = channelSlug; }
    return onSubmit(data);
  };

  // Generic mode delegates to a simpler component
  if (mode === "generic") {
    return (
      <GenericReviewForm
        productInfo={effectiveProductInfo}
        onSubmit={wrappedSubmit}
        onClose={onClose}
      />
    );
  }

  return (
    <FullReviewWizard
      mode={mode}
      productInfo={effectiveProductInfo}
      isCampaignReview={isCampaignReview}
      onSubmit={wrappedSubmit}
      onClose={onClose}
    />
  );
}

// ─── Full Wizard (Campaign / Verified / Organic) ──────────────────────────────

function FullReviewWizard({
  mode,
  productInfo,
  isCampaignReview,
  onSubmit,
  onClose,
}: Omit<Props, "user">) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1 ──
  const [productName, setProductName] = useState(productInfo?.name ?? "");
  const [category, setCategory] = useState(productInfo?.category ?? AVAILABLE_CATEGORIES[0]);
  const [productCode, setProductCode] = useState("");
  const [usageDuration, setUsageDuration] = useState<ReviewFormData["usageDuration"]>("1_4_weeks");
  const [purchaseChannel, setPurchaseChannel] = useState<ReviewFormData["purchaseChannel"]>("amazon");
  const [overallRating, setOverallRating] = useState(0);
  const [subRatings, setSubRatings] = useState<Record<string, number>>({});

  // ── Step 2 ──
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");

  // ── Step 3 ──
  const [bestFor, setBestFor] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isHonestOpinion, setIsHonestOpinion] = useState(false);

  const subRatingKeys = CATEGORY_SUB_RATINGS[category] ?? [];

  // ── Validation ──
  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (mode === "organic" && !productName.trim()) {
        setError("Please enter the product name.");
        return false;
      }
      if (mode === "verified" && !productCode.trim()) {
        setError("Please enter your product code to verify ownership.");
        return false;
      }
      if (overallRating === 0) {
        setError("Please select an overall rating.");
        return false;
      }
    }
    if (s === 2) {
      if (pros.length === 0) {
        setError("Please add at least one thing you liked.");
        return false;
      }
      if (content.trim().length < 80) {
        setError(`Review needs at least 80 characters (${content.trim().length}/80 so far).`);
        return false;
      }
      if (content.trim().length > 1000) {
        setError("Review must be under 1000 characters.");
        return false;
      }
      if (summary.trim().length < 10) {
        setError("Please add a one-line summary (min 10 characters).");
        return false;
      }
    }
    if (s === 3) {
      if (!isHonestOpinion) {
        setError("Please confirm this is your honest opinion.");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    setError("");
    if (!validateStep(step)) return;
    setStep((s) => s + 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    const combined = [...mediaFiles, ...incoming].slice(0, 3);
    setMediaFiles(combined);
    setMediaPreviews(combined.map((f) => URL.createObjectURL(f)));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (idx: number) => {
    const newFiles = mediaFiles.filter((_, i) => i !== idx);
    setMediaFiles(newFiles);
    setMediaPreviews(newFiles.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async () => {
    setError("");
    if (!validateStep(3)) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        productName: mode === "campaign" ? (productInfo?.name ?? "") : productName,
        category: mode === "campaign" ? (productInfo?.category ?? category) : category,
        productSource: isCampaignReview ? "brand_sent" : "purchased",
        usageDuration,
        purchaseChannel,
        overallRating,
        subRatings,
        pros,
        cons,
        content,
        summary,
        bestFor,
        mediaFiles,
        isCampaignReview: isCampaignReview ?? false,
        reviewType: mode === "campaign" ? "campaign" : mode === "verified" ? "verified" : "campaign",
        productCode: mode === "verified" ? productCode : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerLabel =
    mode === "verified" ? "Verified purchase review" :
    mode === "campaign" ? "Campaign review" :
    "Write a review";

  const headerSub =
    mode === "verified" ? "Earns based on engagement · Verify with your product code" :
    mode === "campaign" ? "Earns based on engagement · Disclosed as campaign review" :
    null;

  return (
    <ModalShell onClose={onClose}>
      {/* ── Header ── */}
      <div className="flex justify-between items-start px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{headerLabel}</h2>
          {headerSub && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">{headerSub}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-sm shrink-0"
        >
          ✕
        </button>
      </div>

      {/* ── Step Progress ── */}
      <div className="px-5 py-3 shrink-0">
        <div className="flex items-center">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    i + 1 < step
                      ? "bg-emerald-500 text-white"
                      : i + 1 === step
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                <span
                  className={`text-[11px] font-medium hidden sm:block ${
                    i + 1 === step
                      ? "text-slate-800 dark:text-slate-200"
                      : "text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`h-px flex-1 mx-2 ${
                    i + 1 < step
                      ? "bg-emerald-300 dark:bg-emerald-700"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="overflow-y-auto flex-1 px-5">

        {/* ════ STEP 1: Context ════ */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            {mode === "organic" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Product name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Sony WH-1000XM5"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Reviewing</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{productInfo?.name}</p>
              </div>
            )}

            {mode === "organic" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-slate-100"
                >
                  {AVAILABLE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Product code for verified purchases */}
            {mode === "verified" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Product code <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="Barcode, serial number, or order ID"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Found on the product packaging, receipt, or order confirmation.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Overall rating <span className="text-red-400">*</span>
              </label>
              <StarPicker value={overallRating} onChange={setOverallRating} />
            </div>

            {subRatingKeys.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Rate specific aspects <span className="font-normal">(optional)</span>
                </label>
                <div className="space-y-2">
                  {subRatingKeys.map((attr) => (
                    <div key={attr} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-400 w-36 shrink-0">{attr}</span>
                      <StarPicker
                        size="sm"
                        value={subRatings[attr] ?? 0}
                        onChange={(v) => setSubRatings((prev) => ({ ...prev, [attr]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                How long have you used it?
              </label>
              <div className="flex gap-2 flex-wrap">
                {USAGE_DURATIONS.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    selected={usageDuration === opt.value}
                    onClick={() => setUsageDuration(opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </div>

            {mode !== "campaign" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Where did you buy it?
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PURCHASE_CHANNELS.map((opt) => (
                    <OptionButton
                      key={opt.value}
                      selected={purchaseChannel === opt.value}
                      onClick={() => setPurchaseChannel(opt.value)}
                    >
                      {opt.label}
                    </OptionButton>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ STEP 2: Written Review ════ */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                What did you like? <span className="text-red-400">*</span>{" "}
                <span className="font-normal text-slate-400">(at least one)</span>
              </label>
              <ChipInput
                items={pros}
                onAdd={(item) => setPros((p) => [...p, item])}
                onRemove={(idx) => setPros((p) => p.filter((_, i) => i !== idx))}
                placeholder="e.g. Long battery life"
                maxItems={8}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                What could be better?{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <ChipInput
                items={cons}
                onAdd={(item) => setCons((p) => [...p, item])}
                onRemove={(idx) => setCons((p) => p.filter((_, i) => i !== idx))}
                placeholder="e.g. Expensive carrying case"
                maxItems={8}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Your full review <span className="text-red-400">*</span>{" "}
                <span className="font-normal text-slate-400">(80–1000 characters)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share your full experience — what worked, what surprised you, who this is ideal for…"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm h-32 resize-y focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <p
                className={`text-right text-[11px] tabular-nums ${
                  content.trim().length > 1000
                    ? "text-red-500"
                    : content.trim().length >= 80
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "text-slate-400"
                }`}
              >
                {content.trim().length} / 1000
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                One-line summary <span className="text-red-400">*</span>{" "}
                <span className="font-normal text-slate-400">(10–100 chars — shown as your headline)</span>
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={100}
                placeholder="e.g. The best noise-cancelling headphones I've ever owned"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
          </div>
        )}

        {/* ════ STEP 3: Finish ════ */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Best for{" "}
                <span className="font-normal text-slate-400">(optional — helps buyers find this review)</span>
              </label>
              <ChipInput
                items={bestFor}
                onAdd={(item) => setBestFor((p) => [...p, item])}
                onRemove={(idx) => setBestFor((p) => p.filter((_, i) => i !== idx))}
                placeholder="e.g. frequent travelers, home cooks…"
                maxItems={5}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Photos{" "}
                <span className="font-normal text-slate-400">(up to 3 — optional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex gap-2 flex-wrap">
                {mediaPreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-black/80"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {mediaFiles.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-500 transition text-2xl"
                  >
                    +
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Reviews with photos get 1.5× engagement weight in payouts.
              </p>
            </div>

            <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              {isCampaignReview && (
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-slate-900 shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    I received this product as part of a brand review campaign.
                  </span>
                </label>
              )}
              {mode === "verified" && (
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-slate-900 shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    I am a verified purchaser of this product.
                  </span>
                </label>
              )}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHonestOpinion}
                  onChange={(e) => setIsHonestOpinion(e.target.checked)}
                  className="mt-0.5 accent-slate-900 shrink-0"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  I confirm this is my honest, independent opinion.{" "}
                  <span className="text-red-400">*</span>
                </span>
              </label>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-2 mb-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/40">
            {error}
          </p>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => { setError(""); setStep((s) => s - 1); }}
            className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            className="flex-[1.4] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition"
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-[1.4] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition disabled:opacity-50"
          >
            {isSubmitting ? "Submitting…" : "Submit review"}
          </button>
        )}
      </div>
    </ModalShell>
  );
}

"use client";

import { useState, useRef } from "react";
import {
  SUGGESTED_CATEGORIES,
  PURCHASE_CHANNELS,
  getSubjectConfig,
  SUBJECT_TYPE_OPTIONS,
} from "../../../lib/constants";
import { AVAILABLE_CATEGORIES } from "../../../lib/constants";
import type { SubjectType } from "../../../lib/types";
import type { ReviewFormData, ProductVariant } from "./index";
import StarPicker from "./StarPicker";
import ChipInput from "./ChipInput";
import OptionButton from "./OptionButton";
import ModalShell from "./ModalShell";

// ─── Types ──────────────────────────────────────────────────────────────────

type ReceiptVerification = {
  status: "idle" | "checking" | "verified" | "failed";
  storeName?: string | null;
  purchaseDate?: string | null;
  detectedProduct?: string | null;
  confidence?: string;
};

type Props = {
  mode: "organic" | "verified" | "generic";
  subjectType?: SubjectType;
  productInfo?: { name: string; category: string; variants?: ProductVariant[] };
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onClose: () => void;
};

export default function FullReviewWizard({
  mode,
  subjectType: initialSubjectType = "product",
  productInfo,
  onSubmit,
  onClose,
}: Props) {
  const [subjectType, setSubjectType] = useState<SubjectType>(initialSubjectType);
  const cfg = getSubjectConfig(subjectType);

  const STEP_LABELS = ["Context", "Your Review", subjectType === "product" ? "Proof of Purchase" : "Verification", "Finish"];
  const totalSteps = STEP_LABELS.length;

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1 ──
  const [productName, setProductName] = useState(productInfo?.name ?? "");
  const [category, setCategory] = useState(productInfo?.category ?? AVAILABLE_CATEGORIES[0]);
  const [productCode, setProductCode] = useState("");
  const [variantId, setVariantId] = useState("");
  const [variantName, setVariantName] = useState("");
  const [usageDuration, setUsageDuration] = useState(cfg.durationOptions[0]?.value ?? "1_4_weeks");
  const [productSource, setProductSource] = useState(cfg.sourceOptions[0]?.value ?? "purchased");
  const [purchaseChannel, setPurchaseChannel] = useState("amazon");
  const [location, setLocation] = useState("");
  const [overallRating, setOverallRating] = useState(0);
  const [subRatings, setSubRatings] = useState<Record<string, number>>({});

  // ── Step 2 ──
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");

  // ── Proof of Purchase (step 3, non-campaign only) ──
  const [receiptVerification, setReceiptVerification] = useState<ReceiptVerification>({ status: "idle" });
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // ── Finish step ──
  const [bestFor, setBestFor] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isHonestOpinion, setIsHonestOpinion] = useState(false);

  // Free-form sub-rating dimensions — reviewer adds their own
  const [customDimensions, setCustomDimensions] = useState<string[]>(["", "", ""]);
  const subRatingKeys = customDimensions.filter((d) => d.trim() !== "");

  // ── Validation ──
  const finishStepNumber = totalSteps;

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
      if ((productInfo?.variants?.length ?? 0) > 0 && !variantId) {
        setError("Please select the variant you reviewed.");
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
    // Step 3 = Proof of Purchase — no required fields, skip freely
    // Finish step — always requires honest opinion checkbox
    if (s === finishStepNumber) {
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

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WEBP, etc.).");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Receipt image must be under 6 MB.");
      return;
    }
    setError("");
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    setReceiptVerification({ status: "checking" });

    // Convert to base64 and call verify-receipt API
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // strip data URL prefix -> keep only base64 body
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/verify-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
          productName: productInfo?.name ?? productName,
        }),
      });

      const data = await res.json();
      if (data.success && data.isVerified) {
        setReceiptVerification({
          status: "verified",
          storeName: data.storeName,
          purchaseDate: data.purchaseDate,
          detectedProduct: data.detectedProduct,
          confidence: data.confidence,
        });
      } else {
        setReceiptVerification({ status: "failed" });
      }
    } catch {
      setReceiptVerification({ status: "failed" });
    }

    if (receiptInputRef.current) receiptInputRef.current.value = "";
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptVerification({ status: "idle" });
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
        productName: productInfo?.name ?? productName,
        category: productInfo?.category ?? category,
        productSource,
        usageDuration,
        purchaseChannel: cfg.showPurchaseChannel ? purchaseChannel : "other",
        overallRating,
        subRatings,
        pros,
        cons,
        content,
        summary,
        bestFor,
        mediaFiles,
        isCampaignReview: false,
        reviewType: mode === "verified" ? "verified" : "organic",
        subjectType,
        location: location || undefined,
        productCode: mode === "verified" ? productCode : undefined,
        variantId: variantId || undefined,
        variantName: variantName || undefined,
        isVerifiedPurchase: receiptVerification.status === "verified",
        receiptVerification: receiptVerification.status === "verified"
          ? {
              storeName: receiptVerification.storeName,
              purchaseDate: receiptVerification.purchaseDate,
              detectedProduct: receiptVerification.detectedProduct,
              confidence: receiptVerification.confidence,
            }
          : undefined,
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
    `Review a ${cfg.label.toLowerCase()}`;

  const headerSub =
    mode === "verified" ? "Earns based on engagement \u00b7 Verify with your product code" :
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
                  {i + 1 < step ? "\u2713" : i + 1}
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
            {/* Subject type picker — only in organic mode (user chooses what they're reviewing) */}
            {mode === "organic" && !productInfo && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  What type of thing are you reviewing?
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {SUBJECT_TYPE_OPTIONS.map((opt) => (
                    <OptionButton
                      key={opt.value}
                      selected={subjectType === opt.value}
                      onClick={() => {
                        setSubjectType(opt.value);
                        setProductSource(
                          (getSubjectConfig(opt.value)).sourceOptions[0]?.value ?? "purchased"
                        );
                        setUsageDuration(
                          (getSubjectConfig(opt.value)).durationOptions[0]?.value ?? "1_4_weeks"
                        );
                      }}
                    >
                      {opt.icon} {opt.label}
                    </OptionButton>
                  ))}
                </div>
              </div>
            )}

            {mode === "organic" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {cfg.nameLabel} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder={cfg.namePlaceholder}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Reviewing</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{productInfo?.name}</p>
              </div>
            )}

            {/* Variant picker — shown when the product has SKUs */}
            {(productInfo?.variants?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Which variant did you review?{" "}
                  <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {productInfo!.variants!.map((v) => (
                    <OptionButton
                      key={v.id}
                      selected={variantId === v.id}
                      onClick={() => { setVariantId(v.id); setVariantName(v.name); }}
                    >
                      {v.name}
                    </OptionButton>
                  ))}
                </div>
              </div>
            )}

            {mode === "organic" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
                <input
                  type="text"
                  list="category-suggestions-full"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Tech, Roads & Routes, Restaurants..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-slate-100"
                />
                <datalist id="category-suggestions-full">
                  {SUGGESTED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
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

            {/* Location field — shown for places, routes, businesses, events */}
            {cfg.showLocation && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {cfg.locationLabel}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={cfg.locationPlaceholder}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Overall rating <span className="text-red-400">*</span>
              </label>
              <StarPicker value={overallRating} onChange={setOverallRating} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Rate specific aspects <span className="font-normal">(optional — add your own dimensions)</span>
              </label>
              <div className="space-y-2">
                {customDimensions.map((dim, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={dim}
                      onChange={(e) => {
                        const updated = [...customDimensions];
                        updated[idx] = e.target.value;
                        setCustomDimensions(updated);
                      }}
                      placeholder={cfg.suggestedDimensions[idx] ? `e.g. ${cfg.suggestedDimensions[idx]}` : `Dimension ${idx + 1}`}
                      className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    {dim.trim() && (
                      <StarPicker
                        size="sm"
                        value={subRatings[dim.trim()] ?? 0}
                        onChange={(v) => setSubRatings((prev) => ({ ...prev, [dim.trim()]: v }))}
                      />
                    )}
                  </div>
                ))}
                {customDimensions.length < 5 && (
                  <button type="button" onClick={() => setCustomDimensions((d) => [...d, ""])}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
                    + Add dimension
                  </button>
                )}
              </div>
            </div>

            {/* Source — adaptive per subject type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {cfg.sourceLabel}
              </label>
              <div className="flex gap-2 flex-wrap">
                {cfg.sourceOptions.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    selected={productSource === opt.value}
                    onClick={() => setProductSource(opt.value)}
                  >
                    {opt.label}
                  </OptionButton>
                ))}
              </div>
            </div>

            {/* Duration — adaptive per subject type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {cfg.durationLabel}
              </label>
              <div className="flex gap-2 flex-wrap">
                {cfg.durationOptions.map((opt) => (
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

            {/* Purchase channel — only for products */}
            {cfg.showPurchaseChannel && (
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
                {cfg.proLabel} <span className="text-red-400">*</span>{" "}
                <span className="font-normal text-slate-400">(at least one)</span>
              </label>
              <ChipInput
                items={pros}
                onAdd={(item) => setPros((p) => [...p, item])}
                onRemove={(idx) => setPros((p) => p.filter((_, i) => i !== idx))}
                placeholder={cfg.proPlaceholder}
                maxItems={8}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {cfg.conLabel}{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <ChipInput
                items={cons}
                onAdd={(item) => setCons((p) => [...p, item])}
                onRemove={(idx) => setCons((p) => p.filter((_, i) => i !== idx))}
                placeholder={cfg.conPlaceholder}
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
                placeholder={cfg.reviewPlaceholder}
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

        {/* ════ STEP 3: Proof of Purchase ════ */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-0.5">
                ✓ Verified Owner badge
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                Upload a receipt or order screenshot and we'll verify your purchase. Verified reviews earn a trust badge and higher credibility scores. This step is optional — you can skip it.
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReceiptChange}
            />

            {receiptVerification.status === "idle" && !receiptPreview && (
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-8 flex flex-col items-center gap-2 text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-500 dark:hover:text-slate-300 transition"
              >
                <span className="text-3xl">🧾</span>
                <span className="text-sm font-medium">Upload receipt or order screenshot</span>
                <span className="text-[11px]">JPG, PNG, WEBP · max 6 MB</span>
              </button>
            )}

            {receiptVerification.status === "checking" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Parsing receipt...</p>
              </div>
            )}

            {(receiptVerification.status === "verified" || receiptVerification.status === "failed") && receiptPreview && (
              <div className="space-y-3">
                {/* Receipt thumbnail */}
                <div className="relative w-full max-h-48 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receiptPreview} alt="Receipt" className="w-full object-contain max-h-48" />
                  <button
                    type="button"
                    onClick={clearReceipt}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full text-[11px] flex items-center justify-center hover:bg-black/80"
                  >
                    ×
                  </button>
                </div>

                {receiptVerification.status === "verified" ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-2.5 space-y-1">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <span>✓</span> Purchase verified
                    </p>
                    {receiptVerification.storeName && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        <span className="font-medium">Store:</span> {receiptVerification.storeName}
                      </p>
                    )}
                    {receiptVerification.purchaseDate && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        <span className="font-medium">Date:</span>{" "}
                        {new Date(receiptVerification.purchaseDate).toLocaleDateString(undefined, {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </p>
                    )}
                    {receiptVerification.detectedProduct && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        <span className="font-medium">Product:</span> {receiptVerification.detectedProduct}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
                      Could not verify purchase
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      We couldn&apos;t read a store name and date from this image. Try a clearer photo, or skip this step.
                    </p>
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-400 underline underline-offset-2"
                    >
                      Try a different image
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
              Your receipt is used only for verification and is not stored or shared.
            </p>

            <button
              type="button"
              onClick={() => { setError(""); setStep((s) => s + 1); }}
              className="w-full text-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1 transition underline-offset-2 hover:underline"
            >
              Skip — continue without verification
            </button>
          </div>
        )}

        {/* ════ STEP 3 (campaign) / STEP 4 (non-campaign): Finish ════ */}
        {step === finishStepNumber && (
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
                placeholder="e.g. frequent travelers, home cooks..."
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
                Reviews with photos get 1.5x engagement weight in payouts.
              </p>
            </div>

            <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
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

        {step < totalSteps ? (
          <button
            type="button"
            onClick={goNext}
            disabled={receiptVerification.status === "checking"}
            className="flex-[1.4] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition disabled:opacity-50"
          >
            {receiptVerification.status === "checking" ? "Verifying..." : "Continue \u2192"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-[1.4] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit review"}
          </button>
        )}
      </div>
    </ModalShell>
  );
}

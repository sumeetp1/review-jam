"use client";

import { User } from "firebase/auth";
import type { SubjectType } from "../../../lib/types";
import GenericReviewForm from "./GenericReviewForm";
import FullReviewWizard from "./FullReviewWizard";

// Re-export constants for backward compatibility
export { SUGGESTED_CATEGORIES, AVAILABLE_CATEGORIES } from "../../../lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewFormData = {
  productName: string;
  category: string;
  productSource: string;
  usageDuration: string;
  purchaseChannel: string;
  overallRating: number;
  subRatings: Record<string, number>;
  pros: string[];
  cons: string[];
  content: string;
  summary: string;
  bestFor: string[];
  mediaFiles: File[];
  isCampaignReview: boolean;
  reviewType: "organic" | "verified" | "generic";
  subjectType: SubjectType;
  location?: string;
  productCode?: string;
  channelId?: string;
  channelSlug?: string;
  variantId?: string;
  variantName?: string;
  isVerifiedPurchase?: boolean;
  receiptVerification?: {
    storeName?: string | null;
    purchaseDate?: string | null;
    detectedProduct?: string | null;
    confidence?: string;
  };
};

export type ProductVariant = { id: string; name: string };

// ─── Main Orchestrator ────────────────────────────────────────────────────────

type Props = {
  user: User;
  mode: "organic" | "verified" | "generic";
  productInfo?: { name: string; category: string; variants?: ProductVariant[]; subjectType?: SubjectType };
  channelId?: string;
  channelSlug?: string;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onClose: () => void;
};

export default function ReviewWizard({
  user: _user,
  mode,
  productInfo,
  channelId,
  channelSlug,
  onSubmit,
  onClose,
}: Props) {
  // Wrap onSubmit to inject channel metadata
  const wrappedSubmit = async (data: ReviewFormData) => {
    if (channelId) { data.channelId = channelId; }
    if (channelSlug) { data.channelSlug = channelSlug; }
    return onSubmit(data);
  };

  const subjectType = productInfo?.subjectType ?? "product";

  // Generic mode delegates to a simpler component
  if (mode === "generic") {
    return (
      <GenericReviewForm
        productInfo={productInfo}
        subjectType={subjectType}
        onSubmit={wrappedSubmit}
        onClose={onClose}
      />
    );
  }

  return (
    <FullReviewWizard
      mode={mode}
      productInfo={productInfo}
      subjectType={subjectType}
      onSubmit={wrappedSubmit}
      onClose={onClose}
    />
  );
}

"use client";

import { User } from "firebase/auth";
import GenericReviewForm from "./GenericReviewForm";
import FullReviewWizard from "./FullReviewWizard";

// Re-export constants for backward compatibility
export { SUGGESTED_CATEGORIES, AVAILABLE_CATEGORIES } from "../../../lib/constants";

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
  reviewType: "organic" | "verified" | "generic";
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
  productInfo?: { name: string; category: string; variants?: ProductVariant[] };
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

  // Generic mode delegates to a simpler component
  if (mode === "generic") {
    return (
      <GenericReviewForm
        productInfo={productInfo}
        onSubmit={wrappedSubmit}
        onClose={onClose}
      />
    );
  }

  return (
    <FullReviewWizard
      mode={mode}
      productInfo={productInfo}
      onSubmit={wrappedSubmit}
      onClose={onClose}
    />
  );
}

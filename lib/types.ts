// ─── Shared Types ────────────────────────────────────────────────────────────
// Canonical type definitions used across the codebase.

import type { HealthBreakdown } from "./healthScore";

// ─── Subject Types ──────────────────────────────────────────────────────────

export type SubjectType =
  | "product"      // Physical/digital products
  | "place"        // Parks, landmarks, buildings, neighborhoods
  | "route"        // Roads, highways, trails, bike paths
  | "service"      // Government services, utilities, contractors
  | "business"     // Local businesses, restaurants, shops
  | "event"        // Concerts, conferences, meetups
  | "experience";  // Courses, classes, programs, subscriptions

export const SUBJECT_TYPES: SubjectType[] = [
  "product", "place", "route", "service", "business", "event", "experience",
];

// ─── Review ──────────────────────────────────────────────────────────────────

export type ReviewData = {
  id: string;
  reviewerName?: string;
  category?: string;
  productName?: string;
  rating?: number;
  content?: string;
  summary?: string;
  marketingQuote?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string[];
  subRatings?: Record<string, number>;
  mediaUrls?: string[];
  likesCount?: number;
  likedBy?: string[];
  helpfulCount?: number;
  notHelpfulCount?: number;
  helpfulBy?: string[];
  notHelpfulBy?: string[];
  commentCount?: number;
  campaignId?: string;
  productId?: string;
  isCampaignReview?: boolean;
  productSource?: string;
  usageDuration?: string;
  badges?: string[];
  healthScore?: number;
  healthScoreBreakdown?: HealthBreakdown;
  versionCount?: number;
  latestVersionLabel?: string;
  channelSlug?: string;
  channelId?: string;
  productSlug?: string;
  communitySlug?: string;
  reviewerId?: string;
  createdAt?: string;
  variantId?: string;
  variantName?: string;
  isVerifiedPurchase?: boolean;
  isAnchorReview?: boolean;
  subjectType?: SubjectType;
  location?: string;
};

export type ReviewSummary = {
  id: string;
  productName: string;
  category?: string;
  rating: number;
  likesCount: number;
  summary?: string;
  marketingQuote?: string;
  createdAt: string;
  campaignId: string;
  versionCount?: number;
  latestVersionLabel?: string;
  healthScore?: number;
};

export type ReviewAnalysis = {
  isGenuine: boolean;
  reason: string;
  marketingQuote: string;
  biasFlag: boolean;
};

export type ScoredReview = {
  review: any;
  healthScore: number;
  categoryMultiplier?: number;
  weightedScore?: number;
};

// ─── Comment ─────────────────────────────────────────────────────────────────

export type Comment = {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  parentCommentId?: string | null;
  depth?: number;
};

// ─── Product ─────────────────────────────────────────────────────────────────

export type ProductEntry = {
  id: string;
  name: string;
  brandName: string;
  category: string;
  campaignId: string;
  endDate: string;
  communitySeeded?: boolean;
  slug?: string;
  communitySlug?: string;
  coverImage?: string;
  reviewCount: number;
  avgRating: number;
  avgHealthScore: number;
  topQuote: string;
  totalLikes: number;
  discoveryRank: number;
  hasVerifiedOwner: boolean;
  bountyPool: number;
  bountyPoolRemaining: number;
  bountyStatus: string;
};

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  category: string;
  communitySlug: string;
  communityTags?: string[];
  avgRating?: number;
  reviewCount?: number;
  communitySeeded?: boolean;
};

export type BrandProduct = {
  id: string;
  name: string;
  brandName: string;
  brandEmail?: string;
  category: string;
  campaignId: string;
  endDate?: string;
  budget?: number;
  createdAt?: string;
};

export type BrandReview = {
  id: string;
  reviewerName: string;
  rating: number;
  content: string;
  summary?: string;
  marketingQuote?: string;
  likesCount: number;
  helpfulCount?: number;
  pros?: string[];
  cons?: string[];
  campaignId: string;
  productName: string;
  createdAt: string;
  mediaUrls?: string[];
};

export type SidebarProduct = {
  id: string;
  name: string;
  brandName: string;
};

// ─── Community / Channel ─────────────────────────────────────────────────────

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  memberCount: number;
  reviewCount: number;
  creatorName: string;
};

export type Channel = {
  id: string;
  slug: string;
  iconEmoji: string;
  memberCount: number;
  category: string;
};

// ─── Discussion / Q&A ────────────────────────────────────────────────────────

export type DiscussionPost = {
  id: string;
  authorId: string;
  authorName: string;
  type: "question" | "tip" | "issue" | "general";
  body: string;
  upvotes: number;
  upvotedBy: string[];
  createdAt: string;
};

export type QAAnswer = {
  id: string;
  questionId: string;
  productId: string;
  authorId: string;
  authorName: string;
  body: string;
  isVerifiedOwner: boolean;
  upvotes: number;
  upvotedBy: string[];
  createdAt: string;
};

// ─── Ledger / Payout ─────────────────────────────────────────────────────────

export type LedgerEntry = {
  id: string;
  campaignId: string;
  productName: string;
  amount: number;
  rawLikes: number;
  hasPhoto: boolean;
  status: string;
  paidAt: string;
};

// ─── Admin ───────────────────────────────────────────────────────────────────

export type ModerationEvent = {
  id: string;
  reviewerName: string;
  reviewPreview: string;
  isGenuine: boolean;
  reason: string;
  marketingQuote?: string;
  source: "deterministic" | "ai";
  createdAt: string;
};

export type CampaignApplication = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productName: string;
  brandName: string;
  campaignId: string;
  notes: string;
  status: string;
  appliedAt: string;
};

export type DateRangeFilter = "24h" | "7d" | "30d" | "all";
export type SourceFilter = "all" | "deterministic" | "ai";

// ─── UI ──────────────────────────────────────────────────────────────────────

export type SortKey = "discovery" | "reviews" | "rating" | "likes" | "newest";
export type FeedTab = "foryou" | "trending";

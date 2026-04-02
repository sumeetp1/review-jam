// ─── Review Health Score ─────────────────────────────────────────────────────
// Composite 0–100 score that determines payout weighting.

export type HealthBreakdown = {
  quality: number;     // max 40
  engagement: number;  // max 25
  credibility: number; // max 20
  freshness: number;   // max 15
};

export type HealthResult = {
  score: number;
  breakdown: HealthBreakdown;
};

type ReviewInput = {
  content?: string;
  summary?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string[];
  subRatings?: Record<string, number>;
  mediaUrls?: string[];
  likesCount?: number;
  helpfulCount?: number;
  commentCount?: number;
  forkCount?: number;
  productSource?: string;
  isVerifiedPurchase?: boolean;
  versionCount?: number;
  createdAt?: string;
};

export function computeHealthScore(
  review: ReviewInput,
  reviewerBadgeCount: number,
  reviewerReviewCount: number,
): HealthResult {
  // ── Quality (40 pts, with Critical Balance penalty) ───────────────────────
  const contentLen = (review.content ?? "").length;
  const contentPts = contentLen >= 300 ? 10 : contentLen >= 100 ? 5 : contentLen >= 50 ? 2 : 0;
  const prosPts    = Math.min((review.pros?.length ?? 0), 5);
  const consPts    = Math.min((review.cons?.length ?? 0), 5);
  const subKeys    = Object.keys(review.subRatings ?? {}).length;
  const subPts     = subKeys >= 3 ? 5 : subKeys >= 2 ? 3 : subKeys >= 1 ? 1 : 0;
  const mediaPts   = (review.mediaUrls?.length ?? 0) > 0 ? 5 : 0;
  const summaryPts = (review.summary ?? "").length >= 10 ? 5 : 0;
  const bestForPts = (review.bestFor?.length ?? 0) > 0 ? 5 : 0;
  // Critical Balance penalty: no cons listed signals an overly one-sided review
  const balancePenalty = (review.cons?.length ?? 0) === 0 ? 15 : 0;
  const quality    = Math.max(0, contentPts + prosPts + consPts + subPts + mediaPts + summaryPts + bestForPts - balancePenalty);

  // ── Engagement (25 pts) ───────────────────────────────────────────────────
  const likesPts   = Math.min(Math.log2((review.likesCount ?? 0) + 1) * 2, 8);
  const helpPts    = Math.min(Math.log2((review.helpfulCount ?? 0) + 1) * 2, 7);
  const commentPts = Math.min((review.commentCount ?? 0), 5);
  const forkPts    = Math.min((review.forkCount ?? 0) * 2.5, 5);
  const engagement = likesPts + helpPts + commentPts + forkPts;

  // ── Credibility (max 35 pts) ──────────────────────────────────────────────
  const badgePts      = Math.min(reviewerBadgeCount * 2, 10);
  const reviewCtPts   = Math.min(reviewerReviewCount, 5);
  // isVerifiedPurchase (receipt-verified) is weighted much higher than a
  // self-declared "purchased" source signal (+20 vs +5)
  const verifiedPts   = review.isVerifiedPurchase ? 20
                      : review.productSource === "purchased" ? 5
                      : 0;
  const credibility   = badgePts + reviewCtPts + verifiedPts;

  // ── Freshness (15 pts) ────────────────────────────────────────────────────
  const versionPts = Math.min(((review.versionCount ?? 1) - 1) * 5, 10);
  let recencyPts   = 0;
  if (review.createdAt) {
    const daysOld = (Date.now() - new Date(review.createdAt).getTime()) / 86_400_000;
    recencyPts = daysOld < 7 ? 5 : daysOld < 30 ? 3 : daysOld < 90 ? 1 : 0;
  }
  const freshness = versionPts + recencyPts;

  const score = Math.round(quality + engagement + credibility + freshness);

  return {
    score: Math.min(score, 100),
    breakdown: {
      quality:     Math.round(quality),
      engagement:  Math.round(engagement),
      credibility: Math.round(credibility),
      freshness:   Math.round(freshness),
    },
  };
}

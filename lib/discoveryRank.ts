// ─── Discovery Rank (DR) ─────────────────────────────────────────────────────
//
// DR = (weightedAvgHealthScore × reviewCount) / log(daysSinceLastReview + 2)
//
// Weight per review uses a bias multiplier — penalises over-positive /
// marketing-speak reviews flagged by the AI agent:
//     biasFlag === true  → 0.8×
//     biasFlag === false → 1.0×
//
// The log denominator keeps stale products from permanently dominating the
// feed — a product reviewed yesterday ranks higher than one with the same
// aggregate score last reviewed six months ago.

export type DRReviewInput = {
  healthScore?: number;       // 0–100; defaults to 0 if missing
  isCampaignReview?: boolean; // kept for data compatibility, no longer affects ranking
  biasFlag?: boolean;         // true = over-positive/marketing-speak (0.8× penalty)
  createdAt?: string;         // ISO date string; used to find most-recent review
};

/**
 * Calculates the Discovery Rank for a product given its review array.
 *
 * @param reviews - All reviews for the product
 * @returns A non-negative float. Higher = more discoverable.
 */
export function calculateDiscoveryRank(reviews: DRReviewInput[]): number {
  if (!reviews || reviews.length === 0) return 0;

  // Weighted average health score
  let totalWeight = 0;
  let weightedScoreSum = 0;

  for (const r of reviews) {
    const score    = typeof r.healthScore === "number" ? r.healthScore : 0;
    const biasMult = r.biasFlag === true ? 0.8 : 1.0;
    const weight   = biasMult;
    weightedScoreSum += score * weight;
    totalWeight += weight;
  }

  const weightedAvgHealthScore = totalWeight > 0 ? weightedScoreSum / totalWeight : 0;
  const reviewCount = reviews.length;

  // Find the most-recent review date
  let latestMs = 0;
  for (const r of reviews) {
    if (r.createdAt) {
      const ms = new Date(r.createdAt).getTime();
      if (ms > latestMs) latestMs = ms;
    }
  }

  const daysSinceLastReview =
    latestMs > 0
      ? Math.max(0, (Date.now() - latestMs) / 86_400_000)
      : 365; // treat dateless products as very stale

  // DR formula — log base e (natural log)
  const dr = (weightedAvgHealthScore * reviewCount) / Math.log(daysSinceLastReview + 2);

  return Math.max(0, dr);
}

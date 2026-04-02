// ─── Discovery Rank (DR) ─────────────────────────────────────────────────────
//
// DR = (weightedAvgHealthScore × reviewCount) / log(daysSinceLastReview + 2)
//
// Organic reviews (isCampaignReview === false) get a 1.2× health score
// multiplier to reward unsolicited feedback. Campaign reviews use 1.0×.
//
// The log denominator keeps stale products from permanently dominating the
// feed — a product reviewed yesterday ranks higher than one with the same
// aggregate score last reviewed six months ago.

export type DRReviewInput = {
  healthScore?: number;       // 0–100; defaults to 0 if missing
  isCampaignReview?: boolean; // false = organic (1.2× weight), true = campaign (1.0×)
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

  // Weighted average health score (organic 1.2×, campaign 1.0×)
  let totalWeight = 0;
  let weightedScoreSum = 0;

  for (const r of reviews) {
    const score  = typeof r.healthScore === "number" ? r.healthScore : 0;
    const weight = r.isCampaignReview === false ? 1.2 : 1.0;
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

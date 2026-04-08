// ─── Carousel Data Fetching ──────────────────────────────────────────────────
// Shared data layer for Amazon carousel image generation.
// Extracts the same Firestore query pattern used by the widget API route.

import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { computeHealthScore } from "../healthScore";
import { topItems } from "../reviewUtils";
import type { CarouselData, CarouselReview } from "./types";

/**
 * Fetch all data needed to render a carousel image for a product.
 * Returns null if the product doesn't exist.
 */
export async function fetchCarouselData(productId: string): Promise<CarouselData | null> {
  // ── Fetch product ────────────────────────────────────────────────────────
  const productSnap = await getDoc(doc(db, "products", productId));
  if (!productSnap.exists()) return null;

  const product = productSnap.data();

  // ── Fetch reviews (by productId OR campaignId, deduplicated) ─────────────
  const [byProductId, byCampaignId] = await Promise.all([
    getDocs(query(collection(db, "reviews"), where("productId", "==", productId))),
    product.campaignId
      ? getDocs(query(collection(db, "reviews"), where("campaignId", "==", product.campaignId)))
      : Promise.resolve(null),
  ]);

  const reviewMap = new Map<string, Record<string, unknown>>();
  byProductId.docs.forEach((d) => reviewMap.set(d.id, d.data() as Record<string, unknown>));
  byCampaignId?.docs.forEach((d) => reviewMap.set(d.id, d.data() as Record<string, unknown>));

  const reviews = Array.from(reviewMap.values());
  const reviewCount = reviews.length;

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const avgRating = reviewCount
    ? reviews.reduce((s, r) => s + ((r.rating as number) || 0), 0) / reviewCount
    : 0;

  const healthScores = reviews.map((r) => {
    if (typeof r.healthScore === "number") return r.healthScore;
    const { score } = computeHealthScore(r as Parameters<typeof computeHealthScore>[0], 0, 0);
    return score;
  });

  const avgHealthScore = healthScores.length
    ? healthScores.reduce((s, n) => s + n, 0) / healthScores.length
    : 0;

  // ── Top pros/cons (with counts) ──────────────────────────────────────────
  const topProsData = topItems(reviews as Array<{ pros?: string[]; cons?: string[] }>, "pros", 3);
  const topConsData = topItems(reviews as Array<{ pros?: string[]; cons?: string[] }>, "cons", 3);

  // ── Top reviews (highest health score, must have summary) ────────────────
  const reviewsWithScores = reviews.map((r, i) => ({
    raw: r,
    healthScore: healthScores[i],
  }));

  const sorted = [...reviewsWithScores]
    .filter((r) => r.raw.summary || r.raw.marketingQuote || r.raw.content)
    .sort((a, b) => b.healthScore - a.healthScore);

  const topReviews: CarouselReview[] = sorted.slice(0, 3).map((r) => ({
    reviewerName: (r.raw.reviewerName as string) || "Anonymous",
    rating: (r.raw.rating as number) || 0,
    summary: (r.raw.summary as string) || (r.raw.marketingQuote as string) || truncate((r.raw.content as string) || "", 150),
    content: (r.raw.content as string) || "",
    healthScore: r.healthScore,
    pros: ((r.raw.pros as string[]) || []).slice(0, 3),
    usageDuration: (r.raw.usageDuration as string) || undefined,
  }));

  const spotlight = sorted[0]
    ? {
        reviewerName: (sorted[0].raw.reviewerName as string) || "Anonymous",
        rating: (sorted[0].raw.rating as number) || 0,
        summary: (sorted[0].raw.summary as string) || (sorted[0].raw.marketingQuote as string) || truncate((sorted[0].raw.content as string) || "", 250),
        content: (sorted[0].raw.content as string) || "",
        healthScore: sorted[0].healthScore,
        pros: ((sorted[0].raw.pros as string[]) || []).slice(0, 4),
        usageDuration: (sorted[0].raw.usageDuration as string) || undefined,
      }
    : null;

  return {
    productId,
    productName: truncate((product.name as string) || "Product", 60),
    brandName: (product.brandName as string) || "",
    category: (product.category as string) || "",
    communitySlug: (product.communitySlug as string) || "",
    productSlug: (product.slug as string) || "",
    avgRating,
    avgHealthScore,
    reviewCount,
    topPros: topProsData,
    topCons: topConsData,
    topReviews,
    spotlightReview: spotlight,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "\u2026";
}

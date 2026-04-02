import { NextResponse } from "next/server";
import {
  collection, getDocs, query, where,
  doc, updateDoc, increment, addDoc, getDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { computeHealthScore } from "../../../lib/healthScore";

// ─── Global Dividend Payout ───────────────────────────────────────────────────
//
// Formula: user_share = globalPool × (healthScore × categoryMultiplier)
//                       ─────────────────────────────────────────────────
//                       Σ (healthScore × categoryMultiplier) for all eligible
//
// Eligibility: isVerifiedPurchase === true  (hard gate — no exceptions)
// categoryMultiplier: pulled from the review's parent channel doc (default 1)

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { globalPool } = body as { globalPool?: number };

    if (!globalPool || typeof globalPool !== "number" || globalPool <= 0) {
      return NextResponse.json(
        { success: false, error: "A positive globalPool amount (USD) is required." },
        { status: 400 },
      );
    }

    // ── 1. Fetch all reviews; gate on isVerifiedPurchase ─────────────────────
    const allSnap = await getDocs(collection(db, "reviews"));
    const allReviews: any[] = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const eligible = allReviews.filter(
      (r) => r.isVerifiedPurchase === true && r.reviewerId,
    );

    if (eligible.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No verified-purchase reviews found. Cannot distribute funds.",
      });
    }

    // ── 2. Cache channel multipliers to minimise Firestore reads ─────────────
    const channelCache: Record<string, number> = {};

    async function getChannelMultiplier(channelId?: string): Promise<number> {
      if (!channelId) return 1;
      if (channelCache[channelId] !== undefined) return channelCache[channelId];
      try {
        const snap = await getDoc(doc(db, "channels", channelId));
        if (!snap.exists()) { channelCache[channelId] = 1; return 1; }
        const data = snap.data();
        let mult: number = data.multiplier ?? 1;
        // Honour expiry: if a brand-sponsored bounty has lapsed, fall back to 1×
        if (data.multiplierExpiresAt) {
          const expiresMs = new Date(data.multiplierExpiresAt).getTime();
          if (Date.now() > expiresMs) mult = 1;
        }
        channelCache[channelId] = mult;
        return mult;
      } catch {
        channelCache[channelId] = 1;
        return 1;
      }
    }

    // ── 3. Score every eligible review ────────────────────────────────────────
    type ScoredReview = {
      review: any;
      healthScore: number;
      categoryMultiplier: number;
      weightedScore: number;
    };

    const scoredReviews: ScoredReview[] = [];

    for (const review of eligible) {
      // Resolve reviewer stats for accurate health score
      let badgeCount = 0;
      let reviewerReviewCount = 0;
      try {
        const userSnap = await getDoc(doc(db, "users", review.reviewerId));
        if (userSnap.exists()) {
          badgeCount = (userSnap.data().badges ?? []).length;
        }
        const rSnap = await getDocs(
          query(collection(db, "reviews"), where("reviewerId", "==", review.reviewerId)),
        );
        reviewerReviewCount = rSnap.size;
      } catch { /* non-fatal */ }

      const { score: healthScore } = computeHealthScore(review, badgeCount, reviewerReviewCount);

      // Persist refreshed score back to the review doc
      await updateDoc(doc(db, "reviews", review.id), {
        healthScore,
        healthScoreUpdatedAt: new Date().toISOString(),
      });

      const categoryMultiplier = await getChannelMultiplier(review.channelId);
      const weightedScore = healthScore * categoryMultiplier;

      scoredReviews.push({ review, healthScore, categoryMultiplier, weightedScore });
    }

    // ── 4. Sum denominator ────────────────────────────────────────────────────
    const totalWeight = scoredReviews.reduce((sum, r) => sum + r.weightedScore, 0);

    if (totalWeight === 0) {
      return NextResponse.json({
        success: false,
        error: "All eligible reviews have a weighted score of 0. Cannot distribute funds.",
      });
    }

    // ── 5. Distribute ─────────────────────────────────────────────────────────
    const paidAt = new Date().toISOString();
    let payoutsMade = 0;
    let totalDistributed = 0;

    for (const { review, healthScore, categoryMultiplier, weightedScore } of scoredReviews) {
      if (weightedScore <= 0) continue;

      const share = globalPool * (weightedScore / totalWeight);
      totalDistributed += share;

      await updateDoc(doc(db, "users", review.reviewerId), {
        walletBalance: increment(share),
        totalEarned: increment(share),
      });

      await addDoc(collection(db, "payoutLedger"), {
        userId: review.reviewerId,
        reviewerName: review.reviewerName || "Anonymous",
        reviewId: review.id,
        payoutType: "global_dividend",
        productName: review.productName || "",
        productId: review.productId || "",
        categoryMultiplier,
        amount: share,
        healthScore,
        weightedScore,
        rawLikes: review.likesCount || 0,
        hasPhoto: !!(review.mediaUrls?.length),
        status: "paid",
        paidAt,
      });

      await addDoc(collection(db, "notifications"), {
        userId: review.reviewerId,
        type: "payout_approved",
        title: "Monthly dividend received!",
        body: `$${share.toFixed(2)} from the platform pool`,
        read: false,
        createdAt: paidAt,
      });

      payoutsMade++;
    }

    const uniqueReviewers = new Set(
      scoredReviews.filter((r) => r.weightedScore > 0).map((r) => r.review.reviewerId),
    ).size;

    return NextResponse.json({
      success: true,
      message: `Distributed $${totalDistributed.toFixed(2)} across ${payoutsMade} review${payoutsMade !== 1 ? "s" : ""} from ${uniqueReviewers} reviewer${uniqueReviewers !== 1 ? "s" : ""}.`,
      stats: {
        totalReviews: allReviews.length,
        eligibleReviews: eligible.length,
        payoutsMade,
        uniqueReviewers,
        totalDistributed,
      },
    });

  } catch (error) {
    console.error("Payout API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during dividend distribution." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  collection, getDocs, query, where,
  doc, updateDoc, increment, addDoc, getDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { computeHealthScore } from "../../../lib/healthScore";

// ─── Review Bounty System ────────────────────────────────────────────────────
//
// Brands fund a bounty pool on a product. Reviewers earn a share based on
// review quality (health score), regardless of sentiment.
//
// POST /api/bounty — two actions:
//
// { action: "fund", productId, amount, maxPerReview, minHealthScore, durationDays }
//   → Creates/updates a bounty on a product
//
// { action: "distribute", productId }
//   → Distributes the bounty pool to qualifying reviews (batch at close)

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── Fund a bounty ─────────────────────────────────────────────────────
    if (action === "fund") {
      const { productId, amount, maxPerReview, minHealthScore, durationDays } = body;

      if (!productId || !amount || amount <= 0) {
        return NextResponse.json({ success: false, error: "productId and a positive amount are required." }, { status: 400 });
      }

      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) {
        return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + (durationDays || 30) * 24 * 60 * 60 * 1000).toISOString();

      await updateDoc(productRef, {
        bountyPool: amount,
        bountyPoolRemaining: amount,
        bountyMaxPerReview: maxPerReview || 25,
        bountyMinHealthScore: minHealthScore || 60,
        bountyExpiresAt: expiresAt,
        bountyFundedAt: now.toISOString(),
        bountyStatus: "active",
      });

      return NextResponse.json({
        success: true,
        message: `Bounty of $${amount} funded on "${productSnap.data().name}" for ${durationDays || 30} days. Min health score: ${minHealthScore || 60}, max per review: $${maxPerReview || 25}.`,
      });
    }

    // ── Distribute a bounty (batch at close) ──────────────────────────────
    if (action === "distribute") {
      const { productId } = body;

      if (!productId) {
        return NextResponse.json({ success: false, error: "productId is required." }, { status: 400 });
      }

      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) {
        return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
      }

      const product = productSnap.data();
      const pool = product.bountyPoolRemaining ?? product.bountyPool ?? 0;
      const maxPerReview = product.bountyMaxPerReview ?? 25;
      const minScore = product.bountyMinHealthScore ?? 60;

      if (pool <= 0) {
        return NextResponse.json({ success: false, error: "No bounty funds remaining." });
      }

      // Fetch all reviews for this product
      const reviewSnap = await getDocs(
        query(collection(db, "reviews"), where("productId", "==", productId)),
      );
      const allReviews = reviewSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filter to eligible: verified purchase + not already paid from this bounty
      const eligible = allReviews.filter((r: any) =>
        r.isVerifiedPurchase === true &&
        r.reviewerId &&
        !r.bountyPaid,
      );

      if (eligible.length === 0) {
        return NextResponse.json({ success: false, error: "No eligible unpaid reviews found." });
      }

      // Recompute health scores and filter by minimum
      type ScoredReview = { review: any; healthScore: number };
      const scored: ScoredReview[] = [];

      for (const review of eligible) {
        let badgeCount = 0;
        let reviewerReviewCount = 0;
        try {
          const userSnap = await getDoc(doc(db, "users", (review as any).reviewerId));
          if (userSnap.exists()) badgeCount = (userSnap.data().badges ?? []).length;
          const rSnap = await getDocs(
            query(collection(db, "reviews"), where("reviewerId", "==", (review as any).reviewerId)),
          );
          reviewerReviewCount = rSnap.size;
        } catch {}

        const { score } = computeHealthScore(review as any, badgeCount, reviewerReviewCount);

        // Update the stored health score
        await updateDoc(doc(db, "reviews", review.id), {
          healthScore: score,
          healthScoreUpdatedAt: new Date().toISOString(),
        });

        if (score >= minScore) {
          scored.push({ review, healthScore: score });
        }
      }

      if (scored.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No reviews meet the minimum health score of ${minScore}.`,
        });
      }

      // Distribute proportionally by health score, capped at maxPerReview
      const totalHealthScore = scored.reduce((s, r) => s + r.healthScore, 0);
      const paidAt = new Date().toISOString();
      let totalDistributed = 0;
      let payoutsMade = 0;

      for (const { review, healthScore } of scored) {
        const rawShare = pool * (healthScore / totalHealthScore);
        const share = Math.min(rawShare, maxPerReview);
        if (share <= 0) continue;

        totalDistributed += share;

        // Pay the reviewer
        await updateDoc(doc(db, "users", (review as any).reviewerId), {
          walletBalance: increment(share),
          totalEarned: increment(share),
        });

        // Mark review as bounty-paid
        await updateDoc(doc(db, "reviews", review.id), {
          bountyPaid: true,
          bountyAmount: share,
          bountyPaidAt: paidAt,
        });

        // Ledger entry
        await addDoc(collection(db, "payoutLedger"), {
          userId: (review as any).reviewerId,
          reviewerName: (review as any).reviewerName || "Anonymous",
          reviewId: review.id,
          payoutType: "bounty",
          productName: product.name || "",
          productId,
          amount: share,
          healthScore,
          weightedScore: healthScore,
          categoryMultiplier: 1,
          rawLikes: (review as any).likesCount || 0,
          hasPhoto: !!((review as any).mediaUrls?.length),
          status: "paid",
          paidAt,
        });

        // Notification
        await addDoc(collection(db, "notifications"), {
          userId: (review as any).reviewerId,
          type: "bounty_payout",
          title: "Bounty reward received!",
          body: `$${share.toFixed(2)} for your review of ${product.name}`,
          read: false,
          createdAt: paidAt,
        });

        payoutsMade++;
      }

      // Update product bounty remaining
      const remaining = Math.max(0, pool - totalDistributed);
      await updateDoc(productRef, {
        bountyPoolRemaining: remaining,
        bountyStatus: remaining <= 0 ? "exhausted" : "active",
        bountyLastDistributedAt: paidAt,
      });

      return NextResponse.json({
        success: true,
        message: `Distributed $${totalDistributed.toFixed(2)} across ${payoutsMade} reviews. $${remaining.toFixed(2)} remaining in pool.`,
        stats: {
          totalReviews: allReviews.length,
          eligibleReviews: eligible.length,
          qualifyingReviews: scored.length,
          payoutsMade,
          totalDistributed,
          remaining,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action. Use 'fund' or 'distribute'." }, { status: 400 });

  } catch (error) {
    console.error("Bounty API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}

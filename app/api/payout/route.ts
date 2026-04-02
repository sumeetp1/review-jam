import { NextResponse } from "next/server";
import {
  collection, getDocs, query, where,
  doc, updateDoc, increment, addDoc, getDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { computeHealthScore } from "../../../lib/healthScore";

export async function POST(req: Request) {
  try {
    const { campaignId, budget } = await req.json();

    if (!campaignId || !budget) {
      return NextResponse.json(
        { success: false, error: "Missing Campaign ID or Budget" },
        { status: 400 }
      );
    }

    const q = query(collection(db, "reviews"), where("campaignId", "==", campaignId));
    const snapshot = await getDocs(q);
    const reviews: any[] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (reviews.length === 0) {
      return NextResponse.json({ success: false, error: "No reviews found for this campaign." });
    }

    // Compute health scores for all reviews before distributing
    const scoredReviews: { review: any; score: number }[] = [];
    for (const review of reviews) {
      let badgeCount = 0;
      let reviewCount = 0;
      if (review.reviewerId) {
        try {
          const userSnap = await getDoc(doc(db, "users", review.reviewerId));
          if (userSnap.exists()) {
            const u = userSnap.data();
            badgeCount = (u.badges ?? []).length;
          }
          const rq = query(collection(db, "reviews"), where("reviewerId", "==", review.reviewerId));
          const rSnap = await getDocs(rq);
          reviewCount = rSnap.size;
        } catch { /* ignore */ }
      }
      const { score } = computeHealthScore(review, badgeCount, reviewCount);
      scoredReviews.push({ review, score });
      // Persist updated score on the review doc
      await updateDoc(doc(db, "reviews", review.id), {
        healthScore: score,
        healthScoreUpdatedAt: new Date().toISOString(),
      });
    }

    const totalWeight = scoredReviews.reduce((sum, r) => sum + r.score, 0);

    if (totalWeight === 0) {
      return NextResponse.json({
        success: false,
        error: "All reviews have a health score of 0. Cannot distribute funds.",
      });
    }

    const paidAt = new Date().toISOString();
    let payoutsMade = 0;

    for (const { review, score } of scoredReviews) {
      if (score > 0 && review.reviewerId) {
        const share = (score / totalWeight) * budget;

        await updateDoc(doc(db, "users", review.reviewerId), {
          walletBalance: increment(share),
          totalEarned: increment(share),
        });

        await addDoc(collection(db, "payoutLedger"), {
          userId: review.reviewerId,
          reviewerName: review.reviewerName || "Anonymous",
          reviewId: review.id,
          campaignId,
          productName: review.productName || "",
          productId: review.productId || "",
          amount: share,
          healthScore: score,
          rawLikes: review.likesCount || 0,
          hasPhoto: !!(review.mediaUrls && review.mediaUrls.length > 0),
          status: "paid",
          paidAt,
        });

        await addDoc(collection(db, "notifications"), {
          userId: review.reviewerId,
          type: "payout_approved",
          title: "Payout received!",
          body: `$${share.toFixed(2)} from ${review.productName || "campaign"}`,
          read: false,
          createdAt: paidAt,
        });

        payoutsMade++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Distributed $${Number(budget).toFixed(2)} across ${payoutsMade} reviewer${payoutsMade !== 1 ? "s" : ""}!`,
    });

  } catch (error) {
    console.error("Payout API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error during payout." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import {
  collection, getDocs, query, where,
  doc, updateDoc, increment, addDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

// Reviews with photos contribute 1.5× their likes weight
const PHOTO_MULTIPLIER = 1.5;

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

    // Compute weighted likes — photos get 1.5× multiplier
    const weightedLikes = (r: any) => {
      const hasPhoto = r.mediaUrls && r.mediaUrls.length > 0;
      return (r.likesCount || 0) * (hasPhoto ? PHOTO_MULTIPLIER : 1);
    };

    const totalWeight = reviews.reduce((sum, r) => sum + weightedLikes(r), 0);

    if (totalWeight === 0) {
      return NextResponse.json({
        success: false,
        error: "No likes on any reviews. Cannot distribute funds.",
      });
    }

    const paidAt = new Date().toISOString();
    let payoutsMade = 0;

    for (const review of reviews) {
      const wt = weightedLikes(review);
      if (wt > 0 && review.reviewerId) {
        const share = (wt / totalWeight) * budget;

        // Update wallet balance
        await updateDoc(doc(db, "users", review.reviewerId), {
          walletBalance: increment(share),
          totalEarned: increment(share),
        });

        // Create a ledger entry so the reviewer can see the breakdown
        await addDoc(collection(db, "payoutLedger"), {
          userId: review.reviewerId,
          reviewerName: review.reviewerName || "Anonymous",
          reviewId: review.id,
          campaignId,
          productName: review.productName || "",
          productId: review.productId || "",
          amount: share,
          rawLikes: review.likesCount || 0,
          weightedLikes: wt,
          hasPhoto: !!(review.mediaUrls && review.mediaUrls.length > 0),
          status: "paid",
          paidAt,
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

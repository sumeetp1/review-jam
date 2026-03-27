import { NextResponse } from "next/server";
import { collection, query, where, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../../lib/firebase"; 

export async function POST(request: Request) {
  try {
    // 1. The request tells the Agent which campaign just ended
    const { campaignId, budget } = await request.json(); // e.g., $10,000

    // 2. Fetch EVERY review submitted for this specific campaign
    const reviewsRef = collection(db, "reviews");
    const q = query(reviewsRef, where("campaignId", "==", campaignId));
    const snapshot = await getDocs(q);

    const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Calculate the absolute total of all likes across all reviews
    // Using your example: 55 + 5 + 5 + 5... = 100 total likes
    let totalCampaignLikes = 0;
    reviews.forEach(review => {
      totalCampaignLikes += (review.likesCount || 0);
    });

    if (totalCampaignLikes === 0) {
      return NextResponse.json({ success: true, message: "No likes generated. Refund brand." });
    }

    // 4. The Proportional Math & Payout Loop
    for (const review of reviews) {
      const likes = review.likesCount || 0;
      
      if (likes > 0) {
        // e.g., 55 / 100 = 0.55 (55%)
        const percentageShare = likes / totalCampaignLikes; 
        
        // e.g., 0.55 * $10,000 = $5,500
        const payoutAmount = percentageShare * budget; 

        // 5. Deposit the exact proportion into the Reviewer's Wallet
        const reviewerRef = doc(db, "users", review.reviewerId);
        await updateDoc(reviewerRef, {
          walletBalance: increment(payoutAmount)
        });

        // 6. Update the review to show how much it earned
        const individualReviewRef = doc(db, "reviews", review.id);
        await updateDoc(individualReviewRef, {
          totalEarned: payoutAmount
        });
      }
    }

    // 7. Mark Campaign as Completed so this script can't be run twice!
    const campaignRef = doc(db, "campaigns", campaignId);
    await updateDoc(campaignRef, { status: "completed" });

    return NextResponse.json({ success: true, message: "Proportional payouts distributed!" });

  } catch (error) {
    console.error("End of Campaign Agent Error:", error);
    return NextResponse.json({ success: false, error: "Distribution failed." }, { status: 500 });
  }
}
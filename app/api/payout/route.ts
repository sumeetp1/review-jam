import { NextResponse } from "next/server";
import { collection, query, where, getDocs, doc, updateDoc, increment } from "firebase/firestore";

// Make sure this path correctly points to your firebase setup!
import { db } from "../../../lib/firebase"; 

export async function POST(request: Request) {
  try {
    const { campaignId, budget } = await request.json();

    // 1. Fetch EVERY review submitted for this specific campaign
    const reviewsRef = collection(db, "reviews");
    const q = query(reviewsRef, where("campaignId", "==", campaignId));
    const snapshot = await getDocs(q);

    const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Calculate the absolute total of all likes across all reviews
    let totalCampaignLikes = 0;
    reviews.forEach(review => {
      totalCampaignLikes += (review.likesCount || 0);
    });

    // Prevent dividing by zero if no one liked anything!
    if (totalCampaignLikes === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No likes generated for this campaign yet. Cannot distribute funds." 
      }, { status: 400 });
    }

    // 3. The Proportional Math & Payout Loop
    for (const review of reviews) {
      const likes = review.likesCount || 0;
      
      // Only pay out if the review got likes AND it's not an organic review
      if (likes > 0 && review.reviewerId && review.campaignId !== "organic") {
        const percentageShare = likes / totalCampaignLikes; 
        const payoutAmount = percentageShare * budget; 

        // Deposit into the Reviewer's Wallet
        try {
          const reviewerRef = doc(db, "users", review.reviewerId);
          await updateDoc(reviewerRef, {
            walletBalance: increment(payoutAmount)
          });
        } catch (walletError) {
          console.error(`Skipping wallet update for ${review.reviewerId} - user doc might not exist yet.`);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully distributed $${budget} proportionally across ${totalCampaignLikes} total likes!` 
    });

  } catch (error) {
    console.error("End of Campaign Agent Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
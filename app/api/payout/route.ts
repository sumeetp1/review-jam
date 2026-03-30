import { NextResponse } from "next/server";
import { collection, getDocs, query, where, doc, updateDoc, increment } from "firebase/firestore";
// Adjust this import path if your firebase.ts is located elsewhere
import { db } from "../../../lib/firebase"; 

export async function POST(req: Request) {
  try {
    // 1. Receive the dynamic inputs from the Admin Panel
    const { campaignId, budget } = await req.json();

    if (!campaignId || !budget) {
      return NextResponse.json({ success: false, error: "Missing Campaign ID or Budget" }, { status: 400 });
    }

    // 2. Fetch all reviews tied to this specific campaign
    const q = query(collection(db, "reviews"), where("campaignId", "==", campaignId));
    const snapshot = await getDocs(q);
    
    // The famous TypeScript 'any[]' fix!
    const reviews: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (reviews.length === 0) {
      return NextResponse.json({ success: false, error: "No reviews found for this campaign." });
    }

    // 3. Calculate the Total Market Cap of Likes
    let totalLikes = 0;
    reviews.forEach(review => {
      totalLikes += (review.likesCount || 0);
    });

    if (totalLikes === 0) {
      return NextResponse.json({ success: false, error: "No likes on any reviews. Cannot distribute funds." });
    }

    // 4. Distribute the Pool Proportionally
    let payoutsMade = 0;
    for (const review of reviews) {
      const likes = review.likesCount || 0;
      
      // Only pay users who actually got likes
      if (likes > 0 && review.reviewerId) {
        // The Math: (User's Likes / Total Likes) * Total Budget
        const userShare = (likes / totalLikes) * budget;
        
        // Securely increment the user's wallet in Firebase
        const userRef = doc(db, "users", review.reviewerId);
        await updateDoc(userRef, {
          walletBalance: increment(userShare)
        });
        
        payoutsMade++;
      }
    }

    // 5. Send the success receipt back to the Admin Panel
    return NextResponse.json({ 
      success: true, 
      message: `Distributed $${budget} across ${payoutsMade} reviewers!` 
    });

  } catch (error) {
    console.error("Payout API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error during payout." }, { status: 500 });
  }
}
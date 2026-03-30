"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation"; 
// Notice we added 'query' and 'where' to filter the database!
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, addDoc } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "../../../lib/firebase";

export default function ProductPage() {
  const params = useParams();
  const productId = params.productId as string; // Grabs the ID right out of the URL

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));

    async function fetchProductAndReviews() {
      if (!productId) return;
      
      try {
        // 1. Fetch the Product Info
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          setProduct({ id: productSnap.id, ...productSnap.data() });
        }

        // 2. Fetch ONLY reviews for this specific product
        const reviewsRef = collection(db, "reviews");
        const q = query(reviewsRef, where("productId", "==", productId));
        const snapshot = await getDocs(q);
        
        const fetchedReviews: any[] = [];
        snapshot.forEach((doc) => fetchedReviews.push({ id: doc.id, ...doc.data() }));
        
        setReviews(fetchedReviews);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProductAndReviews();
    return () => unsubscribe();
  }, [productId]);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newReviewText.trim() || !product) return;

    // Send to AI Agent for Quality Control (Just like before)
    const agentResponse = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewContent: newReviewText, reviewerName: user.displayName }),
    });
    const agentData = await agentResponse.json();

    if (!agentResponse.ok || !agentData?.success || !agentData?.analysis) {
      const serverMsg =
        typeof agentData?.error === "string" && agentData.error.trim()
          ? agentData.error
          : "Unable to validate this review right now. Please try again.";
      alert(serverMsg);
      return;
    }

    if (agentData.analysis.isGenuine !== true) {
      alert(`Rejected by AI Quality Control: ${agentData.analysis.reason || "Review quality check failed."}`);
      return;
    }

    // Save genuine review with the Product ID attached
    const newReview = {
      content: newReviewText,
      rating: newRating,
      reviewerId: user.uid,
      reviewerName: user.displayName,
      productId: productId, // <--- Crucial step for organizing data
      category: product.category,
      campaignId: product.campaignId || "default", 
      likesCount: 0,
      likedBy: [],
      marketingQuote: agentData.analysis?.marketingQuote || "",
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setReviews([{ id: docRef.id, ...newReview }, ...reviews]);
    setNewReviewText("");
  }

  async function handleLike(reviewId: string, currentLikedBy: string[] = []) {
    if (!user) {
      alert("Please log in to like a review.");
      return;
    }

    const hasLiked = currentLikedBy.includes(user.uid);

    // Optimistic UI Update
    setReviews((current) => current.map((review) => {
      if (review.id === reviewId) {
        return hasLiked 
          ? { ...review, likesCount: Math.max(0, (review.likesCount || 0) - 1), likedBy: review.likedBy.filter((id: string) => id !== user.uid) }
          : { ...review, likesCount: (review.likesCount || 0) + 1, likedBy: [...(review.likedBy || []), user.uid] };
      }
      return review;
    }));

    // Save Like to Database (Money is handled separately by the Admin Agent now)
    const reviewRef = doc(db, "reviews", reviewId);
    await updateDoc(reviewRef, {
      likesCount: increment(hasLiked ? -1 : 1),
      likedBy: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });
  }

  if (isLoading) return <div className="min-h-[40vh] flex items-center justify-center text-sm text-slate-500 dark:text-slate-500 bg-white dark:bg-slate-950">Loading…</div>;
  if (!product) return <div className="p-8 text-center text-sm text-red-600 dark:text-red-400 bg-white dark:bg-slate-950">Product not found.</div>;

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      <div className="max-w-xl mx-auto border-x border-slate-200/80 dark:border-slate-800 min-h-screen">
        
        <div className="px-4 py-4 border-b border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">{product.category}</p>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug">{product.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5">{product.brandName}</p>
          <span className="inline-block mt-3 text-[11px] font-medium text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
            Active pool
          </span>
        </div>

        {user ? (
          <form onSubmit={handleSubmitReview} className="p-4 border-b border-slate-200/80 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Write a review</h2>
            <textarea
              value={newReviewText}
              onChange={(e) => setNewReviewText(e.target.value)}
              placeholder="What stood out?"
              className="w-full border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 mb-3 h-24 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600"
              required
            />
            <div className="flex justify-between items-center gap-3">
              <select value={newRating} onChange={(e) => setNewRating(Number(e.target.value))} className="border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
                {[5, 4, 3, 2, 1].map(num => <option key={num} value={num}>{num} ★</option>)}
              </select>
              <button type="submit" className="text-sm font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-full hover:opacity-90">Post</button>
            </div>
          </form>
        ) : (
          <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-500">Sign in to post a review.</p>
          </div>
        )}
        
        <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
          <div className="px-4 py-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide">Reviews</h3>
          </div>
          {reviews.map((review) => {
            const hasLiked = user && review.likedBy?.includes(user.uid);
            return (
              <div key={review.id} className="px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{review.reviewerName || "Anonymous"}</p>
                  <span className="text-xs text-amber-800 dark:text-amber-400/90 tabular-nums shrink-0">★ {review.rating}</span>
                </div>
                <p className="text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{review.content}</p>
                
                {review.marketingQuote && (
                  <div className="mt-2 border-l border-slate-300 dark:border-slate-600 pl-2.5">
                    <p className="text-[13px] text-slate-500 dark:text-slate-500">"{review.marketingQuote}"</p>
                  </div>
                )}
                
                <div className="flex justify-between items-center mt-3 text-[13px] text-slate-500 dark:text-slate-500">
                  <button 
                    type="button"
                    onClick={() => handleLike(review.id, review.likedBy)}
                    className={`font-medium rounded-md px-2 py-1 -ml-2 transition-colors ${hasLiked ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                  >
                    👍 {review.likesCount || 0}
                  </button>
                </div>
              </div>
            );
          })}
          {reviews.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-500">No reviews yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
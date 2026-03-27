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

    if (agentData.analysis && agentData.analysis.isGenuine === false) {
      alert(`Rejected by AI Quality Control: ${agentData.analysis.reason}`);
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

  if (isLoading) return <div className="p-10 text-center">Loading product data...</div>;
  if (!product) return <div className="p-10 text-center text-red-500">Product not found.</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <div className="max-w-3xl mx-auto">
        
        {/* Product Header Card */}
        <div className="bg-blue-600 text-white p-8 rounded-lg shadow-lg mb-8">
          <p className="text-blue-200 text-sm font-bold tracking-wider uppercase mb-1">{product.category}</p>
          <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
          <p className="text-blue-100 text-lg">by {product.brandName}</p>
          <div className="mt-4 inline-block bg-white text-blue-800 px-4 py-1 rounded-full text-sm font-bold">
            💰 Active Reward Campaign
          </div>
        </div>

        {/* Review Form */}
        {user ? (
          <form onSubmit={handleSubmitReview} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Write a Review for {product.name}</h2>
            <textarea
              value={newReviewText}
              onChange={(e) => setNewReviewText(e.target.value)}
              placeholder="What did you think about this product?"
              className="w-full border border-gray-300 rounded p-3 mb-4 h-24 text-black"
              required
            />
            <div className="flex justify-between items-center">
              <select value={newRating} onChange={(e) => setNewRating(Number(e.target.value))} className="border border-gray-300 rounded p-1 text-black">
                {[5, 4, 3, 2, 1].map(num => <option key={num} value={num}>{num} Stars</option>)}
              </select>
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700">Submit Review</button>
            </div>
          </form>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8 text-center">
            <p className="text-gray-600">Please log in to write a review and participate in the campaign.</p>
          </div>
        )}
        
        {/* Reviews Feed */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Customer Reviews</h3>
          {reviews.map((review) => {
            const hasLiked = user && review.likedBy?.includes(user.uid);
            return (
              <div key={review.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <p className="text-gray-700 text-lg mb-2">"{review.content}"</p>
                {review.reviewerName && <p className="text-sm text-gray-500 mb-4">- {review.reviewerName}</p>}
                
                {review.marketingQuote && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-3 my-3">
                    <p className="text-sm text-blue-800 italic"><strong>AI Marketer:</strong> "{review.marketingQuote}"</p>
                  </div>
                )}
                
                <div className="flex justify-between items-center border-t pt-4 mt-2 text-sm">
                  <span className="font-semibold text-yellow-500">Rating: {review.rating} / 5</span>
                  <button 
                    onClick={() => handleLike(review.id, review.likedBy)}
                    className={`flex items-center gap-1 px-3 py-1 rounded transition-colors ${hasLiked ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-gray-100 hover:bg-blue-50 text-gray-600'}`}
                  >
                    {hasLiked ? '👍 Liked' : '👍 Like'} ({review.likesCount || 0})
                  </button>
                </div>
              </div>
            );
          })}
          {reviews.length === 0 && <p className="text-gray-500 italic">No reviews yet for {product.name}. Be the first!</p>}
        </div>
      </div>
    </main>
  );
}
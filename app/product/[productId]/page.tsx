"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection, query, where, getDocs, doc, getDoc,
  updateDoc, increment, arrayUnion, arrayRemove, addDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth, storage } from "../../../lib/firebase";
import { updateUserBadges } from "../../../lib/badges";
import ReviewWizard, { ReviewFormData } from "../../components/ReviewWizard";
import ReviewCard from "../../components/ReviewCard";

export default function ProductPage() {
  const params = useParams();
  const productId = params.productId as string;

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState<"campaign" | "verified" | "generic" | null>(null);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Check if current user already reviewed this product
  useEffect(() => {
    if (!user || reviews.length === 0) return;
    setHasAlreadyReviewed(reviews.some((r) => r.reviewerId === user.uid));
  }, [user, reviews]);

  useEffect(() => {
    async function fetchProductAndReviews() {
      if (!productId) return;
      try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          setProduct({ id: productSnap.id, ...productSnap.data() });
        }

        const q = query(collection(db, "reviews"), where("productId", "==", productId));
        const snapshot = await getDocs(q);
        const fetched: any[] = [];
        snapshot.forEach((d) => fetched.push({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        setReviews(fetched);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchProductAndReviews();
  }, [productId]);

  const handleReviewSubmit = async (data: ReviewFormData) => {
    if (!user || !product) throw new Error("Missing user or product.");

    if (hasAlreadyReviewed) {
      throw new Error("You have already submitted a review for this product.");
    }

    // Upload images (best-effort)
    const mediaUrls: string[] = [];
    if (data.mediaFiles.length > 0) {
      try {
        for (const file of data.mediaFiles) {
          const fileRef = storageRef(storage, `reviews/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          mediaUrls.push(await getDownloadURL(fileRef));
        }
      } catch (err) {
        console.warn("Image upload failed, continuing without images:", err);
      }
    }

    let marketingQuote = data.summary || "";

    // Generic reviews skip AI validation and are not eligible for payouts
    if (data.reviewType !== "generic") {
      const agentResponse = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewContent: data.content,
          reviewerName: user.displayName,
          pros: data.pros,
          cons: data.cons,
          summary: data.summary,
        }),
      });
      const agentData = await agentResponse.json();

      if (!agentResponse.ok || !agentData?.success || !agentData?.analysis) {
        throw new Error(
          typeof agentData?.error === "string" && agentData.error.trim()
            ? agentData.error
            : "Unable to validate this review right now. Please try again."
        );
      }
      if (agentData.analysis.isGenuine !== true) {
        throw new Error(`AI Quality Control: ${agentData.analysis.reason || "Review quality check failed."}`);
      }
      marketingQuote = agentData.analysis?.marketingQuote || data.summary || "";
    }

    const newReview = {
      content: data.content,
      rating: data.overallRating,
      reviewerId: user.uid,
      reviewerName: user.displayName,
      productId,
      productName: product.name,
      category: product.category,
      campaignId: product.campaignId || "default",
      likesCount: 0,
      likedBy: [],
      helpfulCount: 0,
      helpfulBy: [],
      notHelpfulCount: 0,
      notHelpfulBy: [],
      commentCount: 0,
      marketingQuote,
      pros: data.pros,
      cons: data.cons,
      summary: data.summary,
      productSource: data.productSource,
      usageDuration: data.usageDuration,
      purchaseChannel: data.purchaseChannel,
      subRatings: data.subRatings,
      bestFor: data.bestFor,
      mediaUrls,
      reviewType: data.reviewType,
      productCode: data.productCode ?? null,
      isCampaignReview: data.reviewType === "campaign",
      // Generic reviews excluded from payout pool
      eligibleForPayout: data.reviewType !== "generic",
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setReviews((prev) => [{ id: docRef.id, ...newReview }, ...prev]);
    setHasAlreadyReviewed(true);
    if (data.reviewType !== "generic") updateUserBadges(user.uid).catch(() => {});
  };

  const handleLike = async (reviewId: string, likedBy: string[] = []) => {
    if (!user) return;
    const hasLiked = likedBy.includes(user.uid);

    setReviews((current) =>
      current.map((r) => {
        if (r.id !== reviewId) return r;
        return hasLiked
          ? { ...r, likesCount: Math.max(0, (r.likesCount || 0) - 1), likedBy: r.likedBy.filter((id: string) => id !== user.uid) }
          : { ...r, likesCount: (r.likesCount || 0) + 1, likedBy: [...(r.likedBy || []), user.uid] };
      })
    );

    const reviewRef = doc(db, "reviews", reviewId);
    await updateDoc(reviewRef, {
      likesCount: increment(hasLiked ? -1 : 1),
      likedBy: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleHelpful = async (reviewId: string, helpfulBy: string[] = []) => {
    if (!user) return;
    const has = helpfulBy.includes(user.uid);
    setReviews((cur) =>
      cur.map((r) =>
        r.id !== reviewId ? r : has
          ? { ...r, helpfulCount: Math.max(0, (r.helpfulCount || 0) - 1), helpfulBy: (r.helpfulBy || []).filter((id: string) => id !== user.uid) }
          : { ...r, helpfulCount: (r.helpfulCount || 0) + 1, helpfulBy: [...(r.helpfulBy || []), user.uid] }
      )
    );
    await updateDoc(doc(db, "reviews", reviewId), {
      helpfulCount: increment(has ? -1 : 1),
      helpfulBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleNotHelpful = async (reviewId: string, notHelpfulBy: string[] = []) => {
    if (!user) return;
    const has = notHelpfulBy.includes(user.uid);
    setReviews((cur) =>
      cur.map((r) =>
        r.id !== reviewId ? r : has
          ? { ...r, notHelpfulCount: Math.max(0, (r.notHelpfulCount || 0) - 1), notHelpfulBy: (r.notHelpfulBy || []).filter((id: string) => id !== user.uid) }
          : { ...r, notHelpfulCount: (r.notHelpfulCount || 0) + 1, notHelpfulBy: [...(r.notHelpfulBy || []), user.uid] }
      )
    );
    await updateDoc(doc(db, "reviews", reviewId), {
      notHelpfulCount: increment(has ? -1 : 1),
      notHelpfulBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-slate-500 dark:text-slate-500 bg-white dark:bg-slate-950">
        Loading…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-sm text-red-600 dark:text-red-400 bg-white dark:bg-slate-950">
        Product not found.
      </div>
    );
  }

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : null;

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {reviewMode && user && (
        <ReviewWizard
          user={user}
          mode={reviewMode}
          productInfo={{ name: product.name, category: product.category }}
          isCampaignReview={reviewMode === "campaign"}
          onSubmit={handleReviewSubmit}
          onClose={() => setReviewMode(null)}
        />
      )}

      <div className="max-w-xl mx-auto border-x border-slate-200/80 dark:border-slate-800 min-h-screen">

        {/* Back link */}
        <div className="px-4 pt-3 pb-1">
          <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">
            ← Home
          </Link>
        </div>

        {/* Product header */}
        <div className="px-4 py-4 border-b border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">
            {product.category}
          </p>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug">
            {product.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5">{product.brandName}</p>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
              Active pool
            </span>
            {avgRating && (
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                ★ {avgRating} avg · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Write review CTA */}
        <div className="px-4 py-4 border-b border-slate-200/80 dark:border-slate-800">
          {!user ? (
            <p className="text-sm text-slate-500 dark:text-slate-500 text-center">
              Sign in to post a review.
            </p>
          ) : hasAlreadyReviewed ? (
            <p className="text-sm text-slate-500 dark:text-slate-500 text-center py-1">
              You&apos;ve already reviewed this product. Thank you!
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewMode("verified")}
                  className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium py-2.5 rounded-lg hover:opacity-90 transition"
                >
                  I own this product
                </button>
                <button
                  type="button"
                  onClick={() => setReviewMode("campaign")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-lg transition"
                >
                  Campaign reviewer
                </button>
              </div>
              <button
                type="button"
                onClick={() => setReviewMode("generic")}
                className="w-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                Quick review (no payout)
              </button>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                Verified &amp; campaign reviews earn based on engagement.
              </p>
            </div>
          )}
        </div>

        {/* Reviews list */}
        <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
          <div className="px-4 py-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide">
              Reviews{reviews.length > 0 ? ` · ${reviews.length}` : ""}
            </h3>
          </div>

          {reviews.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-500">
              No reviews yet. Be the first!
            </p>
          ) : (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                currentUserId={user?.uid}
                currentUserName={user?.displayName ?? undefined}
                onLike={handleLike}
                onHelpful={handleHelpful}
                onNotHelpful={handleNotHelpful}
                showPoolLink={false}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

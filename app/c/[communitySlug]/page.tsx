"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  collection, query, where, getDocs, addDoc, doc, updateDoc,
  increment, arrayUnion, arrayRemove, deleteDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { db, auth, storage } from "../../../lib/firebase";
import { useAuth } from "../../../lib/hooks/useAuth";
import { updateUserBadges } from "../../../lib/badges";
import { computeHealthScore } from "../../../lib/healthScore";
import ReviewCard, { type ReviewData } from "../../components/ReviewCard";
import ReviewWizard, { type ReviewFormData } from "../../components/ReviewWizard";
import BottomNav from "../../components/BottomNav";

import type { Community, ProductCard } from "../../../lib/types";

export default function CommunityPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [showReviewWizard, setShowReviewWizard] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "likes" | "score">("newest");
  const [activeTab, setActiveTab] = useState<"reviews" | "products">("products");

  // Load community + products + reviews
  useEffect(() => {
    (async () => {
      try {
        // Load community (from channels collection)
        const snap = await getDocs(query(collection(db, "channels"), where("slug", "==", communitySlug)));
        const ch = snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Community);
        setCommunity(ch);

        // Load products in this community (canonical + tagged)
        const [canonSnap, taggedSnap] = await Promise.all([
          getDocs(query(collection(db, "products"), where("communitySlug", "==", communitySlug))),
          getDocs(query(collection(db, "products"), where("communityTags", "array-contains", communitySlug))),
        ]);

        const seen = new Set<string>();
        const prods: ProductCard[] = [];
        for (const d of [...canonSnap.docs, ...taggedSnap.docs]) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          const data = d.data();
          if (data.slug) prods.push({ id: d.id, ...data } as ProductCard);
        }

        // Enrich with review counts
        if (prods.length > 0) {
          const revSnap = await getDocs(
            query(collection(db, "reviews"), where("communitySlug", "==", communitySlug))
          ).catch(() => null);
          const revsByProduct = new Map<string, any[]>();
          revSnap?.docs.forEach((d) => {
            const r = d.data();
            const arr = revsByProduct.get(r.productId) ?? [];
            arr.push(r);
            revsByProduct.set(r.productId, arr);
          });
          for (const p of prods) {
            const rs = revsByProduct.get(p.id) ?? [];
            p.reviewCount = rs.length;
            p.avgRating = rs.length > 0 ? rs.reduce((s, r) => s + (r.rating || 0), 0) / rs.length : undefined;
          }
        }

        setProducts(prods.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0)));

        // Load channel reviews (community-level reviews, not product-specific)
        if (ch) {
          const rSnap = await getDocs(query(collection(db, "reviews"), where("channelId", "==", ch.id)));
          setReviews(rSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewData)));
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [communitySlug]);

  // Check membership
  useEffect(() => {
    if (!user || !community) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, "channelMembers"), where("channelId", "==", community.id), where("userId", "==", user.uid))
      );
      setIsMember(!snap.empty);
    })();
  }, [user, community]);

  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(() => {});

  const handleJoinLeave = async () => {
    if (!user || !community) { handleLogin(); return; }
    if (isMember) {
      const snap = await getDocs(
        query(collection(db, "channelMembers"), where("channelId", "==", community.id), where("userId", "==", user.uid))
      );
      for (const d of snap.docs) await deleteDoc(d.ref);
      await updateDoc(doc(db, "channels", community.id), { memberCount: increment(-1) });
      setIsMember(false);
      setCommunity((c) => c ? { ...c, memberCount: Math.max(0, c.memberCount - 1) } : c);
    } else {
      await addDoc(collection(db, "channelMembers"), {
        channelId: community.id, userId: user.uid, joinedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "channels", community.id), { memberCount: increment(1) });
      setIsMember(true);
      setCommunity((c) => c ? { ...c, memberCount: c.memberCount + 1 } : c);
    }
  };

  const handleReviewSubmit = async (data: ReviewFormData) => {
    if (!user || !community) throw new Error("Must be signed in.");
    const mediaUrls: string[] = [];
    for (const file of data.mediaFiles) {
      const fileRef = storageRef(storage, `reviews/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      mediaUrls.push(await getDownloadURL(fileRef));
    }
    let marketingQuote = data.summary || "";
    let biasFlag = false;
    if (data.reviewType !== "generic") {
      const resp = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewContent: data.content, reviewerName: user.displayName, pros: data.pros, cons: data.cons, summary: data.summary }),
      });
      const result = await resp.json();
      if (result.analysis?.isGenuine === false) throw new Error(result.analysis?.reason || "Review did not pass quality check.");
      if (result.analysis?.marketingQuote) marketingQuote = result.analysis.marketingQuote;
      biasFlag = result.analysis?.biasFlag ?? false;
    }
    const { score, breakdown } = computeHealthScore(
      { ...data, mediaUrls, content: data.content, likesCount: 0, helpfulCount: 0, commentCount: 0 }, 0, 0,
    );
    const newReview: Record<string, unknown> = {
      productName: data.productName, category: data.category,
      rating: data.overallRating, subRatings: data.subRatings,
      content: data.content, summary: data.summary, marketingQuote,
      pros: data.pros, cons: data.cons, bestFor: data.bestFor, mediaUrls,
      reviewerId: user.uid, reviewerName: user.displayName || "Anonymous",
      likesCount: 0, likedBy: [], helpfulCount: 0, helpfulBy: [],
      notHelpfulCount: 0, notHelpfulBy: [], commentCount: 0, forkCount: 0, versionCount: 1,
      campaignId: "organic", isCampaignReview: data.isCampaignReview,
      reviewType: data.reviewType, productSource: data.productSource,
      usageDuration: data.usageDuration, eligibleForPayout: data.reviewType !== "generic",
      biasFlag, channelId: community.id, channelSlug: community.slug,
      communitySlug, healthScore: score, healthScoreBreakdown: breakdown,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setReviews((prev) => [{ id: docRef.id, ...newReview } as ReviewData, ...prev]);
    await updateDoc(doc(db, "channels", community.id), { reviewCount: increment(1) });
    setCommunity((c) => c ? { ...c, reviewCount: c.reviewCount + 1 } : c);
    if (data.reviewType !== "generic") updateUserBadges(user.uid).catch(() => {});
  };

  const handleLike = async (reviewId: string, likedBy: string[] = []) => {
    if (!user) { handleLogin(); return; }
    const has = likedBy.includes(user.uid);
    setReviews((cur) => cur.map((r) => r.id !== reviewId ? r : has
      ? { ...r, likesCount: Math.max(0, (r.likesCount || 0) - 1), likedBy: (r.likedBy || []).filter((id) => id !== user.uid) }
      : { ...r, likesCount: (r.likesCount || 0) + 1, likedBy: [...(r.likedBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      likesCount: increment(has ? -1 : 1),
      likedBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleHelpful = async (reviewId: string, helpfulBy: string[] = []) => {
    if (!user) { handleLogin(); return; }
    const has = helpfulBy.includes(user.uid);
    setReviews((cur) => cur.map((r) => r.id !== reviewId ? r : has
      ? { ...r, helpfulCount: Math.max(0, (r.helpfulCount || 0) - 1), helpfulBy: (r.helpfulBy || []).filter((id) => id !== user.uid) }
      : { ...r, helpfulCount: (r.helpfulCount || 0) + 1, helpfulBy: [...(r.helpfulBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      helpfulCount: increment(has ? -1 : 1),
      helpfulBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const sorted = [...reviews].sort((a, b) => {
    if (sortBy === "likes") return (b.likesCount || 0) - (a.likesCount || 0);
    if (sortBy === "score") return (b.healthScore || 0) - (a.healthScore || 0);
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-zinc-400">Community not found</p>
        <button type="button" onClick={() => router.push("/c")} className="text-sm text-zinc-300 underline">
          Browse communities
        </button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#09090b]/95 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0 mr-1">
              <Image src="/logo-dark.svg" alt="Review Jam" width={90} height={22} />
            </Link>
            <button type="button" onClick={() => router.push("/c")} className="text-zinc-500 hover:text-zinc-300 shrink-0 text-lg leading-none">
              ←
            </button>
            <span className="text-2xl leading-none">{community.iconEmoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-zinc-100 truncate">rj/{community.slug}</h1>
              <p className="text-[11px] text-zinc-500">{community.memberCount} members · {products.length} products · {community.reviewCount} reviews</p>
            </div>
            <button
              type="button"
              onClick={handleJoinLeave}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition shrink-0 ${
                isMember
                  ? "border border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]"
                  : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30"
              }`}
            >
              {isMember ? "Joined" : "Join"}
            </button>
          </div>
          <p className="text-[12px] text-zinc-400 mt-2 line-clamp-2">{community.description}</p>

          {/* Tab bar */}
          <div className="flex gap-4 mt-3">
            {(["products", "reviews"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`text-[12px] font-medium pb-1 border-b-2 transition capitalize ${
                  activeTab === tab
                    ? "border-indigo-400 text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "products" ? `Products (${products.length})` : `Reviews (${reviews.length})`}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Products tab */}
        {activeTab === "products" && (
          products.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-500 text-sm mb-1">No products in this community yet</p>
              <p className="text-[12px] text-zinc-600">Admins can assign products here from the admin panel.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => {
                const isTagged = p.communitySlug !== communitySlug;
                return (
                  <Link
                    key={p.id}
                    href={`/c/${p.communitySlug}/${p.slug}`}
                    className="group glass-card p-4 flex flex-col gap-2.5 hover:border-white/10 hover:shadow-md hover:shadow-black/20 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-semibold text-zinc-100 group-hover:text-indigo-400 leading-snug transition-colors">{p.name}</h3>
                        <p className="text-[12px] text-zinc-500 mt-0.5">{p.brandName}</p>
                      </div>
                      {isTagged && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-400 bg-indigo-950/30 border border-indigo-500/20 px-1.5 py-0.5 rounded shrink-0">
                          #{p.communitySlug}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] bg-white/[0.04] text-zinc-400 px-2 py-0.5 rounded-md font-medium border border-white/[0.06]">{p.category}</span>
                      {p.avgRating && p.avgRating > 0 && (
                        <span className="text-[11px] text-amber-400 font-medium">★ {p.avgRating.toFixed(1)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-auto pt-1 border-t border-white/[0.06]">
                      <span>{p.reviewCount ?? 0} review{(p.reviewCount ?? 0) !== 1 ? "s" : ""}</span>
                      <span className="text-[10px] text-zinc-600 font-mono">rj/{p.communitySlug}/{p.slug}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* Reviews tab */}
        {activeTab === "reviews" && (
          <>
            {/* Sort tabs */}
            <div className="flex gap-3 mb-4">
              {(["newest", "likes", "score"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSortBy(s)}
                  className={`text-[12px] font-medium pb-1 border-b-2 transition ${
                    sortBy === s
                      ? "border-indigo-400 text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s === "newest" ? "Newest" : s === "likes" ? "Most Liked" : "Top Score"}
                </button>
              ))}
            </div>

            <div className="divide-y divide-white/[0.06]">
              {sorted.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-zinc-500 text-sm mb-2">No community reviews yet</p>
                  <button type="button" onClick={() => user ? setShowReviewWizard(true) : handleLogin()} className="text-sm text-zinc-300 underline">
                    Be the first to post
                  </button>
                </div>
              ) : (
                sorted.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    currentUserId={user?.uid}
                    currentUserName={user?.displayName || undefined}
                    onLike={handleLike}
                    onHelpful={handleHelpful}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => user ? setShowReviewWizard(true) : handleLogin()}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/20 flex items-center justify-center text-2xl font-light hover:bg-indigo-400 transition z-40"
        title="Write a review"
      >
        +
      </button>

      {showReviewWizard && user && (
        <ReviewWizard
          user={user}
          mode="verified"
          productInfo={{ name: "", category: community.category }}
          channelId={community.id}
          channelSlug={community.slug}
          onSubmit={handleReviewSubmit}
          onClose={() => setShowReviewWizard(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}

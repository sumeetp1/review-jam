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
import ReviewWizard, { ReviewFormData, type ProductVariant } from "../../components/ReviewWizard";
import ReviewCard from "../../components/ReviewCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscussionPost = {
  id: string;
  authorId: string;
  authorName: string;
  type: "question" | "tip" | "issue" | "general";
  body: string;
  upvotes: number;
  upvotedBy: string[];
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topItems(
  reviews: any[],
  field: "pros" | "cons",
  n: number
): { text: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    for (const item of (r[field] ?? [])) {
      if (item?.trim()) counts.set(item.trim(), (counts.get(item.trim()) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([text, count]) => ({ text, count }));
}

function scoreColor(score: number) {
  if (score >= 70) return { ring: "#10b981", text: "#059669", bg: "#d1fae5" };
  if (score >= 40) return { ring: "#f59e0b", text: "#d97706", bg: "#fef3c7" };
  return { ring: "#ef4444", text: "#dc2626", bg: "#fee2e2" };
}

// ─── Health Score Ring ────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const r   = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  const col  = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7"
          className="dark:[stroke:#334155]" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={col.ring} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          style={{ transition: "stroke-dasharray .6s ease" }}
        />
        <text x="46" y="46" textAnchor="middle" dominantBaseline="central"
          fontSize="18" fontWeight="800" fill={col.text}
          className="rotate-90" style={{ transformOrigin: "46px 46px" }}>
          {score}
        </text>
      </svg>
      <span className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: col.text }}>
        Neutral Score
      </span>
    </div>
  );
}

// ─── Discussion thread (product-level) ────────────────────────────────────────

const POST_TYPES = [
  { key: "question", icon: "❓", label: "Question" },
  { key: "tip",      icon: "💡", label: "Tip"      },
  { key: "issue",    icon: "⚠️",  label: "Issue"    },
  { key: "general",  icon: "💬", label: "General"  },
] as const;

function DiscussionFeed({
  productId,
  posts,
  currentUserId,
  currentUserName,
  onUpvote,
  onNewPost,
}: {
  productId: string;
  posts: DiscussionPost[];
  currentUserId?: string;
  currentUserName?: string;
  onUpvote: (id: string, upvotedBy: string[]) => void;
  onNewPost: (post: DiscussionPost) => void;
}) {
  const [body, setBody]   = useState("");
  const [type, setType]   = useState<DiscussionPost["type"]>("question");
  const [busy, setBusy]   = useState(false);
  const [open, setOpen]   = useState(false);

  async function submit() {
    if (!currentUserId || !body.trim()) return;
    setBusy(true);
    try {
      const data = {
        productId, authorId: currentUserId,
        authorName: currentUserName ?? "Anonymous",
        type, body: body.trim(), upvotes: 0, upvotedBy: [],
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "productDiscussions"), data);
      onNewPost({ id: ref.id, ...data });
      setBody(""); setType("question"); setOpen(false);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  const sorted = [...posts].sort((a, b) => b.upvotes - a.upvotes);

  return (
    <div className="space-y-3">
      {/* Composer */}
      {currentUserId && (
        open ? (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex gap-1.5 flex-wrap">
              {POST_TYPES.map((t) => (
                <button key={t.key} type="button" onClick={() => setType(t.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition
                    ${type === t.key
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Ask an owner, share a tip, report a known issue…"
              rows={3}
              className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={submit}
                disabled={busy || !body.trim()}
                className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition">
                {busy ? "Posting…" : "Post"}
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="px-4 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(true)}
            className="w-full text-[13px] font-medium text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition">
            + Ask a question or share a tip
          </button>
        )
      )}

      {sorted.length === 0 && !open && (
        <div className="py-10 text-center text-slate-400 dark:text-slate-600 text-sm">
          <p className="text-2xl mb-1">💬</p>
          No discussions yet.{currentUserId ? " Start one above." : " Sign in to post."}
        </div>
      )}

      {sorted.map((post) => {
        const meta      = POST_TYPES.find((t) => t.key === post.type) ?? POST_TYPES[3];
        const hasVoted  = currentUserId ? post.upvotedBy.includes(currentUserId) : false;
        return (
          <div key={post.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex gap-3">
            {/* Upvote */}
            <button type="button" onClick={() => onUpvote(post.id, post.upvotedBy)}
              className={`flex flex-col items-center gap-0.5 shrink-0 pt-0.5 transition ${
                hasVoted ? "text-violet-600 dark:text-violet-400" : "text-slate-300 dark:text-slate-600 hover:text-slate-500"
              }`}>
              <span className="text-base leading-none">▲</span>
              <span className="text-[11px] font-bold tabular-nums">{post.upvotes}</span>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500">
                  {meta.icon} {meta.label}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-600">·</span>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{post.authorName}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">
                  {new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{post.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ownership Journey card ────────────────────────────────────────────────────
// Groups all reviews from the same reviewer into a single collapsible card.
// If versionCount > 1, shows a journey header; ReviewCard already handles
// the timeline internally when expanded.

function OwnershipJourneyCard({
  reviews,
  currentUserId,
  currentUserName,
  onLike,
  onHelpful,
  onNotHelpful,
}: {
  reviews: any[];         // all reviews for one reviewer (usually just 1, but grouped)
  currentUserId?: string;
  currentUserName?: string;
  onLike: (id: string, likedBy: string[]) => void;
  onHelpful: (id: string, helpfulBy: string[]) => void;
  onNotHelpful: (id: string, notHelpfulBy: string[]) => void;
}) {
  // The primary review is the one with the most likes (or just the first)
  const primary = [...reviews].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))[0];
  const isJourney = (primary.versionCount ?? 1) > 1;

  return (
    <div className={isJourney ? "border border-violet-200 dark:border-violet-800/50 rounded-xl overflow-hidden" : ""}>
      {isJourney && (
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-200 dark:border-violet-800/50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            📋 Ownership Journey
          </span>
          <span className="text-[10px] text-violet-500 dark:text-violet-500 ml-auto">
            {primary.versionCount} updates · {primary.latestVersionLabel ?? ""}
          </span>
        </div>
      )}
      <ReviewCard
        review={primary}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onLike={onLike}
        onHelpful={onHelpful}
        onNotHelpful={onNotHelpful}
        showPoolLink={false}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FeedTab = "logs" | "discussion";

export default function ProductPage() {
  const params    = useParams();
  const productId = params.productId as string;

  // Core data
  const [product, setProduct]       = useState<any>(null);
  const [reviews, setReviews]       = useState<any[]>([]);
  const [variants, setVariants]     = useState<ProductVariant[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionPost[]>([]);
  const [user, setUser]             = useState<User | null>(null);
  const [isLoading, setIsLoading]   = useState(true);

  // UI
  const [feedTab, setFeedTab]                 = useState<FeedTab>("logs");
  const [reviewMode, setReviewMode]           = useState<"campaign" | "verified" | "generic" | null>(null);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [verifiedOnly, setVerifiedOnly]       = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState("all");

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || reviews.length === 0) return;
    setHasAlreadyReviewed(reviews.some((r) => r.reviewerId === user.uid));
  }, [user, reviews]);

  // Data fetch
  useEffect(() => {
    async function load() {
      if (!productId) return;
      try {
        // Core data — product, variants, reviews must all succeed together
        const [productSnap, variantSnap, reviewsSnap] = await Promise.all([
          getDoc(doc(db, "products", productId)),
          getDocs(collection(db, "products", productId, "productVariants")),
          getDocs(query(collection(db, "reviews"), where("productId", "==", productId))),
        ]);

        if (productSnap.exists()) setProduct({ id: productSnap.id, ...productSnap.data() });

        setVariants(variantSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string })));

        const fetched: any[] = [];
        reviewsSnap.forEach((d) => fetched.push({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        setReviews(fetched);
      } catch (err) {
        console.error("Error loading product:", err);
      } finally {
        setIsLoading(false);
      }

      // Discussions fetched separately — a missing Firestore index won't
      // crash the product load; the Discussion tab simply shows empty.
      try {
        const discSnap = await getDocs(
          query(collection(db, "productDiscussions"), where("productId", "==", productId))
        );
        const disc = discSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as DiscussionPost))
          .sort((a, b) => b.upvotes - a.upvotes);
        setDiscussions(disc);
      } catch {
        // Index not ready yet — discussions tab shows empty, not a crash
      }
    }
    load();
  }, [productId]);

  // Derived
  const filteredReviews  = selectedVariantId === "all"
    ? reviews
    : reviews.filter((r) => r.variantId === selectedVariantId);

  const displayedReviews = verifiedOnly
    ? filteredReviews.filter((r) => r.isVerifiedPurchase === true)
    : filteredReviews;

  const avgRating = displayedReviews.length > 0
    ? (displayedReviews.reduce((s, r) => s + (r.rating || 0), 0) / displayedReviews.length)
    : 0;

  const avgHealthScore = displayedReviews.length > 0
    ? Math.round(displayedReviews.reduce((s, r) => s + (r.healthScore || 0), 0) / displayedReviews.length)
    : 0;

  const topPros = topItems(displayedReviews, "pros", 5);
  const topCons = topItems(displayedReviews, "cons", 5);

  // Group reviews into ownership journeys (by reviewer)
  const journeyMap = new Map<string, any[]>();
  for (const r of displayedReviews) {
    const key = r.reviewerId ?? r.id;
    if (!journeyMap.has(key)) journeyMap.set(key, []);
    journeyMap.get(key)!.push(r);
  }
  const journeys = Array.from(journeyMap.values())
    .sort((a, b) => {
      const aTop = a[0];
      const bTop = b[0];
      return (bTop.likesCount || 0) - (aTop.likesCount || 0);
    });

  // Handlers
  const handleReviewSubmit = async (data: ReviewFormData) => {
    if (!user || !product) throw new Error("Missing user or product.");
    if (hasAlreadyReviewed) throw new Error("You have already submitted a review for this product.");

    const mediaUrls: string[] = [];
    if (data.mediaFiles.length > 0) {
      try {
        for (const file of data.mediaFiles) {
          const fileRef = storageRef(storage, `reviews/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          mediaUrls.push(await getDownloadURL(fileRef));
        }
      } catch { /* best-effort */ }
    }

    let marketingQuote = data.summary || "";
    if (data.reviewType !== "generic") {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewContent: data.content, reviewerName: user.displayName,
          pros: data.pros, cons: data.cons, summary: data.summary,
        }),
      });
      const agentData = await res.json();
      if (!res.ok || !agentData?.success || !agentData?.analysis) {
        throw new Error(typeof agentData?.error === "string" && agentData.error.trim()
          ? agentData.error : "Unable to validate review right now.");
      }
      if (agentData.analysis.isGenuine !== true) {
        throw new Error(`AI Quality Control: ${agentData.analysis.reason || "Review quality check failed."}`);
      }
      marketingQuote = agentData.analysis?.marketingQuote || data.summary || "";
    }

    const newReview = {
      content: data.content, rating: data.overallRating,
      reviewerId: user.uid, reviewerName: user.displayName,
      productId, productName: product.name, category: product.category,
      campaignId: product.campaignId || "default",
      likesCount: 0, likedBy: [], helpfulCount: 0, helpfulBy: [],
      notHelpfulCount: 0, notHelpfulBy: [], commentCount: 0,
      marketingQuote, pros: data.pros, cons: data.cons, summary: data.summary,
      productSource: data.productSource, usageDuration: data.usageDuration,
      purchaseChannel: data.purchaseChannel, subRatings: data.subRatings,
      bestFor: data.bestFor, mediaUrls, reviewType: data.reviewType,
      productCode: data.productCode ?? null,
      isCampaignReview: data.reviewType === "campaign",
      eligibleForPayout: data.reviewType !== "generic",
      isVerifiedPurchase: data.isVerifiedPurchase ?? false,
      variantId: data.variantId ?? null, variantName: data.variantName ?? null,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setReviews((prev) => [{ id: docRef.id, ...newReview }, ...prev]);
    setHasAlreadyReviewed(true);
    if (data.reviewType !== "generic") updateUserBadges(user.uid).catch(() => {});
  };

  const makeReviewUpdater = (
    field: string,
    field2: string,
    collectionName: string,
  ) => async (reviewId: string, byArr: string[] = []) => {
    if (!user) return;
    const has = byArr.includes(user.uid);
    setReviews((cur) => cur.map((r) =>
      r.id !== reviewId ? r : {
        ...r,
        [field]:  Math.max(0, (r[field] || 0) + (has ? -1 : 1)),
        [field2]: has
          ? (r[field2] || []).filter((x: string) => x !== user.uid)
          : [...(r[field2] || []), user.uid],
      }
    ));
    await updateDoc(doc(db, collectionName, reviewId), {
      [field]:  increment(has ? -1 : 1),
      [field2]: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleLike        = makeReviewUpdater("likesCount",     "likedBy",      "reviews");
  const handleHelpful     = makeReviewUpdater("helpfulCount",   "helpfulBy",    "reviews");
  const handleNotHelpful  = makeReviewUpdater("notHelpfulCount","notHelpfulBy", "reviews");

  const handleUpvotePost = async (postId: string, upvotedBy: string[]) => {
    if (!user) return;
    const has = upvotedBy.includes(user.uid);
    setDiscussions((cur) => cur.map((p) =>
      p.id !== postId ? p : {
        ...p,
        upvotes:   has ? Math.max(0, p.upvotes - 1) : p.upvotes + 1,
        upvotedBy: has ? p.upvotedBy.filter((x) => x !== user.uid) : [...p.upvotedBy, user.uid],
      }
    ));
    await updateDoc(doc(db, "productDiscussions", postId), {
      upvotes:   increment(has ? -1 : 1),
      upvotedBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

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

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {reviewMode && user && (
        <ReviewWizard
          user={user}
          mode={reviewMode}
          productInfo={{ name: product.name, category: product.category, variants }}
          isCampaignReview={reviewMode === "campaign"}
          onSubmit={handleReviewSubmit}
          onClose={() => setReviewMode(null)}
        />
      )}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Home</Link>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-4">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest mb-0.5">{product.category}</p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">{product.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500">{product.brandName}</p>
        </div>
      </div>

      {/* ── Two-column hub ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex flex-col md:flex-row gap-5">

          {/* ═══════════════════════════════════════════════════════════════
              LEFT COLUMN — Specs & Stats (40%)
          ═══════════════════════════════════════════════════════════════ */}
          <div className="md:w-2/5 space-y-4 shrink-0">

            {/* Health score + rating summary card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-4">
                {avgHealthScore > 0
                  ? <HealthRing score={avgHealthScore} />
                  : (
                    <div className="w-[92px] h-[92px] rounded-full border-4 border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                      <span className="text-[11px] text-slate-400 text-center leading-tight">No<br/>data</span>
                    </div>
                  )
                }
                <div className="flex-1 min-w-0">
                  {avgRating > 0 && (
                    <div className="flex items-center gap-1 mb-1">
                      {[1,2,3,4,5].map((n) => (
                        <span key={n} className={`text-base ${n <= Math.round(avgRating) ? "text-amber-400" : "text-slate-200 dark:text-slate-700"}`}>★</span>
                      ))}
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 ml-1">{avgRating.toFixed(1)}</span>
                    </div>
                  )}
                  <p className="text-[12px] text-slate-500 dark:text-slate-500">
                    {displayedReviews.length} review{displayedReviews.length !== 1 ? "s" : ""}
                    {verifiedOnly && <span className="ml-1 text-emerald-600 dark:text-emerald-400">· verified</span>}
                  </p>
                  <span className="inline-block mt-1.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                    Active pool
                  </span>
                </div>
              </div>

              {/* Verified toggle */}
              <button
                type="button"
                onClick={() => setVerifiedOnly((v) => !v)}
                className={`mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                  verifiedOnly
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
              >
                <span>{verifiedOnly ? "✓" : "○"}</span>
                {verifiedOnly ? "Showing verified owners only" : "Show verified owners only"}
              </button>
            </div>

            {/* AI Pros / Cons summary */}
            {(topPros.length > 0 || topCons.length > 0) && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
                  Community Summary
                </p>
                {topPros.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-500 mb-1.5">✓ Loved for</p>
                    <div className="space-y-1.5">
                      {topPros.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, (p.count / (topPros[0]?.count || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[12px] text-slate-700 dark:text-slate-300 min-w-0 flex-shrink-0 max-w-[65%] truncate text-right">{p.text}</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold shrink-0">×{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {topPros.length > 0 && topCons.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800" />
                )}
                {topCons.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-500 mb-1.5">⚠ Common issues</p>
                    <div className="space-y-1.5">
                      {topCons.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-red-400 dark:bg-red-500 rounded-full"
                              style={{ width: `${Math.min(100, (c.count / (topCons[0]?.count || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[12px] text-slate-700 dark:text-slate-300 min-w-0 flex-shrink-0 max-w-[65%] truncate text-right">{c.text}</span>
                          <span className="text-[10px] text-red-600 dark:text-red-500 font-bold shrink-0">×{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SKU / Variant picker */}
            {variants.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2.5">
                  Variants & SKUs
                </p>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedVariantId("all")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border transition ${
                      selectedVariantId === "all"
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span>All variants</span>
                    <span className="opacity-60">{reviews.length}</span>
                  </button>
                  {variants.map((v) => {
                    const vc    = reviews.filter((r) => r.variantId === v.id).length;
                    const vavg  = vc > 0
                      ? (reviews.filter((r) => r.variantId === v.id).reduce((s, r) => s + (r.rating || 0), 0) / vc).toFixed(1)
                      : null;
                    const sel   = selectedVariantId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border transition ${
                          sel
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className="truncate">{v.name}</span>
                        <span className="flex items-center gap-1.5 shrink-0 ml-2">
                          {vavg && <span className={sel ? "text-amber-200" : "text-amber-500"}>★ {vavg}</span>}
                          <span className="opacity-60">({vc})</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Write review CTA */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-3">
                Own this product?
              </p>
              {!user ? (
                <p className="text-sm text-slate-500 dark:text-slate-500 text-center py-1">Sign in to post a review.</p>
              ) : hasAlreadyReviewed ? (
                <p className="text-[12px] text-slate-500 dark:text-slate-500 text-center py-1">
                  ✓ You&apos;ve reviewed this. Use "Post Update" on your review to add updates.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setReviewMode("verified")}
                      className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[12px] font-semibold py-2.5 rounded-lg hover:opacity-90 transition">
                      I own this
                    </button>
                    <button type="button" onClick={() => setReviewMode("campaign")}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold py-2.5 rounded-lg transition">
                      Campaign
                    </button>
                  </div>
                  <button type="button" onClick={() => setReviewMode("generic")}
                    className="w-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[12px] py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition">
                    Quick review (no payout)
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">
                    Verified &amp; campaign reviews earn from the pool.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RIGHT COLUMN — The Feed (60%)
          ═══════════════════════════════════════════════════════════════ */}
          <div className="flex-1 min-w-0">

            {/* Feed tab bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-4 bg-white dark:bg-slate-900 rounded-t-xl overflow-hidden border border-b-0">
              {([
                { id: "logs",       label: "📋 Owner Logs",   count: journeys.length   },
                { id: "discussion", label: "💬 Discussion",   count: discussions.length },
              ] as { id: FeedTab; label: string; count: number }[]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedTab(tab.id)}
                  className={`flex-1 px-4 py-3 text-[12px] font-semibold flex items-center justify-center gap-1.5 transition border-b-2 -mb-px ${
                    feedTab === tab.id
                      ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                      : "border-transparent text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      feedTab === tab.id
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Owner Logs ── */}
            {feedTab === "logs" && (
              <div className="space-y-4">
                {journeys.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-14 text-center">
                    <p className="text-2xl mb-2">📋</p>
                    <p className="text-sm text-slate-500 dark:text-slate-500">No owner logs yet.</p>
                    {user && !hasAlreadyReviewed && (
                      <button type="button" onClick={() => setReviewMode("verified")}
                        className="mt-3 text-[12px] font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                        Start your ownership log →
                      </button>
                    )}
                  </div>
                ) : (
                  journeys.map((group, i) => (
                    <OwnershipJourneyCard
                      key={group[0].id ?? i}
                      reviews={group}
                      currentUserId={user?.uid}
                      currentUserName={user?.displayName ?? undefined}
                      onLike={handleLike}
                      onHelpful={handleHelpful}
                      onNotHelpful={handleNotHelpful}
                    />
                  ))
                )}
              </div>
            )}

            {/* ── Discussion ── */}
            {feedTab === "discussion" && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <DiscussionFeed
                  productId={productId}
                  posts={discussions}
                  currentUserId={user?.uid}
                  currentUserName={user?.displayName ?? undefined}
                  onUpvote={handleUpvotePost}
                  onNewPost={(p) => setDiscussions((prev) => [p, ...prev])}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

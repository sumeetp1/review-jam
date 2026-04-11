"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  collection, query, where, getDocs, doc, getDoc,
  updateDoc, increment, arrayUnion, arrayRemove, addDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../../lib/firebase";
import { useAuth } from "../../../../lib/hooks/useAuth";
import { updateUserBadges } from "../../../../lib/badges";
import ReviewWizard, { ReviewFormData, type ProductVariant } from "../../../components/ReviewWizard";
import VersionUpdateWizard from "../../../components/VersionUpdateWizard";

import type { DiscussionPost, QAAnswer } from "../../../../lib/types";
import DiscussionFeed from "../../../components/ProductHub/DiscussionFeed";
import QAFeed from "../../../components/ProductHub/QAFeed";
import OwnershipJourneyCard from "../../../components/ProductHub/OwnershipJourneyCard";
import CommunityTagManager from "../../../components/ProductHub/CommunityTagManager";
import BuyLinksCard from "../../../components/ProductHub/BuyLinksCard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { topItems, scoreColor } from "../../../../lib/reviewUtils";
import HealthRing from "../../../components/HealthRing";


// ─── Main page ────────────────────────────────────────────────────────────────

type FeedTab = "logs" | "qa" | "discussion";

export default function ProductHubPage({ params }: { params: Promise<{ communitySlug: string; productSlug: string }> }) {
  const { communitySlug, productSlug } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionPost[]>([]);
  const [qaAnswers, setQaAnswers] = useState<Map<string, QAAnswer[]>>(new Map());
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [feedTab, setFeedTab] = useState<FeedTab>("logs");
  const [reviewMode, setReviewMode] = useState<"verified" | null>(null);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState("all");
  const [updatingReview, setUpdatingReview] = useState<any | null>(null);

  useEffect(() => {
    if (!user || reviews.length === 0) return;
    setHasAlreadyReviewed(reviews.some((r) => r.reviewerId === user.uid));
  }, [user, reviews]);

  useEffect(() => {
    async function load() {
      try {
        // Look up product by communitySlug + slug
        const prodSnap = await getDocs(
          query(collection(db, "products"),
            where("communitySlug", "==", communitySlug),
            where("slug", "==", productSlug))
        );
        if (prodSnap.empty) { setIsLoading(false); return; }
        const prodDoc = prodSnap.docs[0];
        const productId = prodDoc.id;
        const productData = { id: productId, ...prodDoc.data() };
        setProduct(productData);

        const [variantSnap, reviewsSnap] = await Promise.all([
          getDocs(collection(db, "products", productId, "productVariants")),
          getDocs(query(collection(db, "reviews"), where("productId", "==", productId))),
        ]);
        setVariants(variantSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string })));
        const fetched: any[] = [];
        reviewsSnap.forEach((d) => fetched.push({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        setReviews(fetched);

        try {
          const discSnap = await getDocs(query(collection(db, "productDiscussions"), where("productId", "==", productId)));
          setDiscussions(discSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DiscussionPost)).sort((a, b) => b.upvotes - a.upvotes));
        } catch { /* index not ready */ }

        try {
          const answersSnap = await getDocs(query(collection(db, "productDiscussionAnswers"), where("productId", "==", productId)));
          const map = new Map<string, QAAnswer[]>();
          answersSnap.docs.forEach((d) => {
            const a = { id: d.id, ...d.data() } as QAAnswer;
            const arr = map.get(a.questionId) ?? []; arr.push(a); map.set(a.questionId, arr);
          });
          setQaAnswers(map);
        } catch { /* index not ready */ }
      } catch (err) { console.error(err); }
      setIsLoading(false);
    }
    load();
  }, [communitySlug, productSlug]);

  const filteredReviews = selectedVariantId === "all" ? reviews : reviews.filter((r) => r.variantId === selectedVariantId);
  const displayedReviews = verifiedOnly ? filteredReviews.filter((r) => r.isVerifiedPurchase === true) : filteredReviews;
  const avgRating = displayedReviews.length > 0 ? displayedReviews.reduce((s, r) => s + (r.rating || 0), 0) / displayedReviews.length : 0;
  const avgHealthScore = displayedReviews.length > 0 ? Math.round(displayedReviews.reduce((s, r) => s + (r.healthScore || 0), 0) / displayedReviews.length) : 0;
  const topPros = topItems(displayedReviews, "pros", 5);
  const topCons = topItems(displayedReviews, "cons", 5);

  const journeyMap = new Map<string, any[]>();
  for (const r of displayedReviews) { const key = r.reviewerId ?? r.id; if (!journeyMap.has(key)) journeyMap.set(key, []); journeyMap.get(key)!.push(r); }
  const journeys = Array.from(journeyMap.values()).sort((a, b) => (b[0].likesCount || 0) - (a[0].likesCount || 0));

  const verifiedOwnerIds = new Set<string>(reviews.filter((r) => r.isVerifiedPurchase === true && r.reviewerId).map((r) => r.reviewerId as string));
  const qaQuestions = discussions.filter((d) => d.type === "question");
  const generalDiscussions = discussions.filter((d) => d.type !== "question");

  const handleReviewSubmit = async (data: ReviewFormData) => {
    if (!user || !product) throw new Error("Missing user or product.");
    if (hasAlreadyReviewed) throw new Error("You have already submitted a review for this product.");
    const mediaUrls: string[] = [];
    if (data.mediaFiles.length > 0) {
      try { for (const file of data.mediaFiles) { const fileRef = storageRef(storage, `reviews/${user.uid}/${Date.now()}_${file.name}`); await uploadBytes(fileRef, file); mediaUrls.push(await getDownloadURL(fileRef)); } } catch { /* best-effort */ }
    }
    let marketingQuote = data.summary || "";
    if (data.reviewType !== "generic") {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewContent: data.content, reviewerName: user.displayName, pros: data.pros, cons: data.cons, summary: data.summary }) });
      const agentData = await res.json();
      if (!res.ok || !agentData?.success || !agentData?.analysis) throw new Error(typeof agentData?.error === "string" && agentData.error.trim() ? agentData.error : "Unable to validate review right now.");
      if (agentData.analysis.isGenuine !== true) throw new Error(`AI Quality Control: ${agentData.analysis.reason || "Review quality check failed."}`);
      marketingQuote = agentData.analysis?.marketingQuote || data.summary || "";
    }
    const newReview: any = {
      content: data.content, rating: data.overallRating,
      reviewerId: user.uid, reviewerName: user.displayName,
      productId: product.id, productName: product.name, category: product.category,
      productSlug, communitySlug,
      campaignId: "organic",
      likesCount: 0, likedBy: [], helpfulCount: 0, helpfulBy: [],
      notHelpfulCount: 0, notHelpfulBy: [], commentCount: 0,
      marketingQuote, pros: data.pros, cons: data.cons, summary: data.summary,
      productSource: data.productSource, usageDuration: data.usageDuration,
      purchaseChannel: data.purchaseChannel, subRatings: data.subRatings,
      bestFor: data.bestFor, mediaUrls, reviewType: data.reviewType,
      subjectType: data.subjectType ?? product.subjectType ?? "product",
      location: data.location ?? null,
      productCode: data.productCode ?? null,
      isCampaignReview: false,
      eligibleForPayout: data.reviewType !== "generic",
      isVerifiedPurchase: data.isVerifiedPurchase ?? false,
      variantId: data.variantId ?? null, variantName: data.variantName ?? null,
      createdAt: new Date().toISOString(),
    };
    // Check if this is an anchor review (reviewer has an accepted seeding invite for this product)
    let anchorInviteId: string | null = null;
    let anchorPayAmount = 0;
    try {
      const invSnap = await getDocs(query(
        collection(db, "seedingInvites"),
        where("userId", "==", user.uid),
        where("productId", "==", product.id),
        where("status", "==", "accepted"),
      ));
      if (!invSnap.empty) {
        anchorInviteId = invSnap.docs[0].id;
        anchorPayAmount = invSnap.docs[0].data().anchorPayoutAmount ?? 50;
        newReview.isAnchorReview = true;
        newReview.eligibleForPayout = false;
        newReview.productSource = "received_for_review";
      }
    } catch {}

    const docRef = await addDoc(collection(db, "reviews"), newReview);

    // Complete anchor invite flow: mark invite, pay reviewer
    if (anchorInviteId) {
      try {
        await updateDoc(doc(db, "seedingInvites", anchorInviteId), {
          status: "completed", reviewId: docRef.id, completedAt: new Date().toISOString(),
        });
        await updateDoc(doc(db, "users", user.uid), { walletBalance: increment(anchorPayAmount), totalEarned: increment(anchorPayAmount) });
        await addDoc(collection(db, "payoutLedger"), {
          userId: user.uid, reviewerName: user.displayName || "Anonymous",
          reviewId: docRef.id, payoutType: "anchor_review",
          productName: product.name, productId: product.id,
          amount: anchorPayAmount, healthScore: 0, weightedScore: 0, categoryMultiplier: 1,
          rawLikes: 0, hasPhoto: mediaUrls.length > 0, status: "paid", paidAt: new Date().toISOString(),
        });
        await addDoc(collection(db, "notifications"), {
          userId: user.uid, type: "anchor_payout",
          title: "Anchor review payment received!",
          body: `$${anchorPayAmount.toFixed(2)} for your anchor review of ${product.name}`,
          read: false, createdAt: new Date().toISOString(),
        });
      } catch {}
    }

    setReviews((prev) => [{ id: docRef.id, ...newReview }, ...prev]);
    setHasAlreadyReviewed(true);
    if (data.reviewType !== "generic") updateUserBadges(user.uid).catch(() => {});
  };

  const makeUpdater = (field: string, field2: string) => async (reviewId: string, byArr: string[] = []) => {
    if (!user) return;
    const has = byArr.includes(user.uid);
    setReviews((cur) => cur.map((r) => r.id !== reviewId ? r : { ...r, [field]: Math.max(0, (r[field] || 0) + (has ? -1 : 1)), [field2]: has ? (r[field2] || []).filter((x: string) => x !== user.uid) : [...(r[field2] || []), user.uid] }));
    await updateDoc(doc(db, "reviews", reviewId), { [field]: increment(has ? -1 : 1), [field2]: has ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  };
  const handleLike = makeUpdater("likesCount", "likedBy");
  const handleHelpful = makeUpdater("helpfulCount", "helpfulBy");
  const handleNotHelpful = makeUpdater("notHelpfulCount", "notHelpfulBy");

  const handleUpvotePost = async (postId: string, upvotedBy: string[]) => {
    if (!user) return;
    const has = upvotedBy.includes(user.uid);
    setDiscussions((cur) => cur.map((p) => p.id !== postId ? p : { ...p, upvotes: has ? Math.max(0, p.upvotes - 1) : p.upvotes + 1, upvotedBy: has ? p.upvotedBy.filter((x) => x !== user.uid) : [...p.upvotedBy, user.uid] }));
    await updateDoc(doc(db, "productDiscussions", postId), { upvotes: increment(has ? -1 : 1), upvotedBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  };

  const handleSubmitAnswer = async (questionId: string, body: string) => {
    if (!user || !product) return;
    const isVerifiedOwner = verifiedOwnerIds.has(user.uid);
    const data: Omit<QAAnswer, "id"> = { questionId, productId: product.id, authorId: user.uid, authorName: user.displayName ?? "Anonymous", body, isVerifiedOwner, upvotes: 0, upvotedBy: [], createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, "productDiscussionAnswers"), data);
    const newAnswer: QAAnswer = { id: ref.id, ...data };
    setQaAnswers((prev) => { const next = new Map(prev); const arr = next.get(questionId) ?? []; next.set(questionId, [newAnswer, ...arr]); return next; });
  };

  const handleUpvoteAnswer = async (answerId: string, questionId: string, upvotedBy: string[]) => {
    if (!user) return;
    const has = upvotedBy.includes(user.uid);
    setQaAnswers((prev) => { const next = new Map(prev); const arr = (next.get(questionId) ?? []).map((a) => a.id !== answerId ? a : { ...a, upvotes: has ? Math.max(0, a.upvotes - 1) : a.upvotes + 1, upvotedBy: has ? a.upvotedBy.filter((x) => x !== user.uid) : [...a.upvotedBy, user.uid] }); next.set(questionId, arr); return next; });
    await updateDoc(doc(db, "productDiscussionAnswers", answerId), { upvotes: increment(has ? -1 : 1), upvotedBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  };

  if (isLoading) return <div className="min-h-[40vh] flex items-center justify-center text-sm text-[#8b839e] bg-[#13111a]">Loading…</div>;
  if (!product) return (
    <div className="min-h-screen bg-[#13111a] flex flex-col items-center justify-center gap-3 px-4">
      <p className="text-[#8b839e]">Product not found</p>
      <button type="button" onClick={() => router.push(`/c/${communitySlug}`)} className="text-sm text-[#cbc5d9] underline">← Back to community</button>
    </div>
  );

  const currentUserId = user?.uid;
  const currentUserName = user?.displayName ?? undefined;

  return (
    <main className="min-h-screen bg-[#13111a] text-[#e8e4f0]">
      {/* Review Wizard */}
      {reviewMode && user && (
        <ReviewWizard user={user} mode={reviewMode} productInfo={{ name: product.name, category: product.category, variants, subjectType: product.subjectType ?? "product" }} onSubmit={handleReviewSubmit} onClose={() => setReviewMode(null)} />
      )}

      {/* Version Update Wizard */}
      {updatingReview && user && (
        <VersionUpdateWizard reviewId={updatingReview.id} existingVersionCount={updatingReview.versionCount ?? 1} productName={updatingReview.productName ?? ""} category={updatingReview.category ?? ""} onSaved={() => { const reviewId = updatingReview.id; setReviews((prev) => prev.map((r) => r.id !== reviewId ? r : { ...r, versionCount: (r.versionCount ?? 1) + 1, createdAt: new Date().toISOString() })); setUpdatingReview(null); }} onClose={() => setUpdatingReview(null)} />
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#13111a]/95 backdrop-blur-md border-b border-[#2a2535]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="shrink-0 md">
            <Image src="/logo-dark.svg" alt="Review Jam" width={100} height={24} />
          </Link>
          <Link href={`/c/${communitySlug}`} className="text-sm text-[#8b839e] hover:underline ml-2 flex items-center gap-1">
            ← <span className="font-mono text-[12px]">rj/{communitySlug}</span>
          </Link>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-4">
          <p className="text-[11px] font-medium text-[#8b839e] uppercase tracking-widest mb-0.5">{product.category}</p>
          <div className="flex items-start gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-[#e8e4f0] leading-snug">{product.name}</h1>
            {product.communitySeeded && !reviews.some((r: any) => r.isVerifiedPurchase === true) && (
              <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 border border-violet-200 px-2 py-1 rounded-full">🌱 Community Seeded</span>
            )}
            {product.communitySeeded && reviews.some((r: any) => r.isVerifiedPurchase === true) && (
              <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#34d399] bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">✅ Verified</span>
            )}
            {product.bountyStatus === "active" && (product.bountyPoolRemaining ?? 0) > 0 && (
              <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#fbbf24] bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                💰 ${(product.bountyPoolRemaining ?? 0).toFixed(0)} Bounty Pool
              </span>
            )}
          </div>
          <p className="text-sm text-[#8b839e]">{product.brandName}</p>

          {/* Community tags row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Link href={`/c/${communitySlug}`} className="text-[11px] font-semibold bg-[#1c1826] text-[#cbc5d9] px-2 py-0.5 rounded-full hover:opacity-80 transition">
              #{communitySlug}
            </Link>
            {(product.communityTags ?? []).map((tag: string) => (
              <Link key={tag} href={`/c/${tag}`} className="text-[11px] font-semibold bg-[#231e2e] text-[#e04c8a] border border-[#2a2535] px-2 py-0.5 rounded-full hover:bg-[#1c1826] transition">
                #{tag}
              </Link>
            ))}
            <span className="text-[10px] font-mono text-[#8b839e]">rj/{communitySlug}/{productSlug}</span>
          </div>
        </div>
      </div>

      {/* Two-column hub */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex flex-col md gap-5">

          {/* LEFT COLUMN */}
          <div className="md space-y-4 shrink-0">

            {/* Health + rating */}
            <div className="bg-[#1c1826] rounded-xl border border-[#2a2535] p-4">
              <div className="flex items-center gap-4">
                {avgHealthScore > 0 ? <HealthRing score={avgHealthScore} /> : <div className="w-[92px] h-[92px] rounded-full border-4 border-[#2a2535] flex items-center justify-center shrink-0"><span className="text-[11px] text-[#8b839e] text-center leading-tight">No<br/>data</span></div>}
                <div className="flex-1 min-w-0">
                  {avgRating > 0 && <div className="flex items-center gap-1 mb-1">{[1,2,3,4,5].map((n) => <span key={n} className={`text-base ${n <= Math.round(avgRating) ? "text-[#fbbf24]" : "text-[#3a3348]"}`}>★</span>)}<span className="text-sm font-semibold text-[#e8e4f0] ml-1">{avgRating.toFixed(1)}</span></div>}
                  <p className="text-[12px] text-[#8b839e]">{displayedReviews.length} review{displayedReviews.length !== 1 ? "s" : ""}{verifiedOnly && <span className="ml-1 text-[#34d399]">· verified</span>}</p>
                  <span className="inline-block mt-1.5 text-[10px] font-medium text-[#34d399] bg-emerald-50 px-2 py-0.5 rounded">Active pool</span>
                </div>
              </div>
              <button type="button" onClick={() => setVerifiedOnly((v) => !v)} className={`mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition ${verifiedOnly ? "bg-emerald-50 text-[#34d399] border-emerald-200" : "bg-[#1c1826] text-[#8b839e] border-[#2a2535] hover:border-[#2a2535]"}`}><span>{verifiedOnly ? "✓" : "○"}</span>{verifiedOnly ? "Showing verified owners only" : "Show verified owners only"}</button>
            </div>

            {/* Pros / Cons */}
            {(topPros.length > 0 || topCons.length > 0) && (
              <div className="bg-[#1c1826] rounded-xl border border-[#2a2535] p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b839e]">Community Summary</p>
                {topPros.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#34d399] mb-1.5">✓ Loved for</p><div className="space-y-1.5">{topPros.map((p, i) => <div key={i} className="flex items-center gap-2"><div className="flex-1 bg-[#1c1826] rounded-full h-1.5 overflow-hidden"><div className="h-full bg-[#34d399] rounded-full" style={{ width: `${Math.min(100, (p.count / (topPros[0]?.count || 1)) * 100)}%` }} /></div><span className="text-[12px] text-[#cbc5d9] min-w-0 flex-shrink-0 max-w-[65%] truncate text-right">{p.text}</span><span className="text-[10px] text-[#34d399] font-bold shrink-0">×{p.count}</span></div>)}</div></div>}
                {topPros.length > 0 && topCons.length > 0 && <div className="border-t border-[#2a2535]" />}
                {topCons.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#f87171] mb-1.5">⚠ Common issues</p><div className="space-y-1.5">{topCons.map((c, i) => <div key={i} className="flex items-center gap-2"><div className="flex-1 bg-[#1c1826] rounded-full h-1.5 overflow-hidden"><div className="h-full bg-[#f87171] rounded-full" style={{ width: `${Math.min(100, (c.count / (topCons[0]?.count || 1)) * 100)}%` }} /></div><span className="text-[12px] text-[#cbc5d9] min-w-0 flex-shrink-0 max-w-[65%] truncate text-right">{c.text}</span><span className="text-[10px] text-[#f87171] font-bold shrink-0">×{c.count}</span></div>)}</div></div>}
              </div>
            )}

            {/* Variants */}
            {variants.length > 0 && (
              <div className="bg-[#1c1826] rounded-xl border border-[#2a2535] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b839e] mb-2.5">Variants & SKUs</p>
                <div className="space-y-1.5">
                  <button type="button" onClick={() => setSelectedVariantId("all")} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border transition ${selectedVariantId === "all" ? "bg-[#e04c8a] text-white border-[#e04c8a]" : "bg-[#1c1826] text-[#cbc5d9] border-[#2a2535] hover:border-[#2a2535]"}`}><span>All variants</span><span className="opacity-60">{reviews.length}</span></button>
                  {variants.map((v) => { const vc = reviews.filter((r) => r.variantId === v.id).length; const vavg = vc > 0 ? (reviews.filter((r) => r.variantId === v.id).reduce((s, r) => s + (r.rating || 0), 0) / vc).toFixed(1) : null; const sel = selectedVariantId === v.id; return <button key={v.id} type="button" onClick={() => setSelectedVariantId(v.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border transition ${sel ? "bg-violet-600 text-white border-violet-600" : "bg-[#1c1826] text-[#cbc5d9] border-[#2a2535] hover:border-[#2a2535]"}`}><span className="truncate">{v.name}</span><span className="flex items-center gap-1.5 shrink-0 ml-2">{vavg && <span className={sel ? "text-amber-200" : "text-[#fbbf24]"}>★ {vavg}</span>}<span className="opacity-60">({vc})</span></span></button>; })}
                </div>
              </div>
            )}

            {/* Where to Buy */}
            {product.buyLinks && product.buyLinks.length > 0 && (
              <BuyLinksCard buyLinks={product.buyLinks} />
            )}

            {/* Write review CTA */}
            <div className="bg-[#1c1826] rounded-xl border border-[#2a2535] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b839e] mb-3">Write a review</p>
              {!user ? <p className="text-sm text-[#8b839e] text-center py-1">Sign in to post a review.</p>
              : hasAlreadyReviewed ? <p className="text-[12px] text-[#8b839e] text-center py-1">✓ You&apos;ve reviewed this. Use &quot;+ New Entry&quot; on your review to add updates.</p>
              : <div className="space-y-2">
                  <button type="button" onClick={() => setReviewMode("verified")} className="w-full btn-brand text-[13px] font-semibold py-3 rounded-lg transition">Post a Review</button>
                  <p className="text-[10px] text-[#8b839e] text-center">Share your honest experience with this product.</p>
                </div>
              }
            </div>

            {/* Admin: community hashtags */}
            <CommunityTagManager product={product} currentUserEmail={user?.email} onTagsUpdated={(tags) => setProduct((p: any) => ({ ...p, communityTags: tags }))} />
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex-1 min-w-0">
            {/* Feed tabs */}
            <div className="flex border-b border-[#2a2535] mb-4 bg-[#1c1826] rounded-t-xl overflow-hidden border border-b-0">
              {([{ id: "logs", label: "📋 Owner Logs", count: journeys.length }, { id: "qa", label: "❓ Ask an Owner", count: qaQuestions.length }, { id: "discussion", label: "💬 Discussion", count: generalDiscussions.length }] as { id: FeedTab; label: string; count: number }[]).map((tab) => (
                <button key={tab.id} type="button" onClick={() => setFeedTab(tab.id)} className={`flex-1 px-3 py-3 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition border-b-2 -mb-px ${feedTab === tab.id ? "border-[#e04c8a] text-[#e8e4f0] bg-[#1c1826]" : "border-transparent text-[#8b839e] bg-[#1c1826] hover:text-[#cbc5d9]"}`}>
                  {tab.label}
                  {tab.count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${feedTab === tab.id ? "bg-[#e04c8a] text-white" : "bg-[#1c1826] text-[#8b839e]"}`}>{tab.count}</span>}
                </button>
              ))}
            </div>

            {feedTab === "logs" && <div className="space-y-4">{journeys.length === 0 ? <div className="bg-[#1c1826] rounded-xl border border-[#2a2535] py-14 text-center"><p className="text-2xl mb-2">📋</p><p className="text-sm text-[#8b839e]">No owner logs yet.</p>{user && !hasAlreadyReviewed && <button type="button" onClick={() => setReviewMode("verified")} className="mt-3 text-[12px] font-semibold text-violet-600 hover:underline">Start your ownership log →</button>}</div> : journeys.map((group, i) => <OwnershipJourneyCard key={group[0].id ?? i} reviews={group} currentUserId={currentUserId} currentUserName={currentUserName} onLike={handleLike} onHelpful={handleHelpful} onNotHelpful={handleNotHelpful} onNewEntry={(review) => setUpdatingReview(review)} />)}</div>}

            {feedTab === "qa" && <div className="bg-[#1c1826] rounded-xl border border-[#2a2535] p-4"><QAFeed productId={product.id} questions={qaQuestions} qaAnswers={qaAnswers} currentUserId={currentUserId} currentUserName={currentUserName} verifiedOwnerIds={verifiedOwnerIds} onNewQuestion={(post) => setDiscussions((prev) => [post, ...prev])} onUpvoteQuestion={handleUpvotePost} onSubmitAnswer={handleSubmitAnswer} onUpvoteAnswer={handleUpvoteAnswer} /></div>}

            {feedTab === "discussion" && <div className="bg-[#1c1826] rounded-xl border border-[#2a2535] p-4"><DiscussionFeed productId={product.id} posts={generalDiscussions} currentUserId={currentUserId} currentUserName={currentUserName} onUpvote={handleUpvotePost} onNewPost={(p) => setDiscussions((prev) => [p, ...prev])} /></div>}
          </div>
        </div>
      </div>
    </main>
  );
}

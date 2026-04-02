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
import OwnershipLogCard, { OwnershipLog } from "../../components/OwnershipLogCard";
import NewLogWizard from "../../components/NewLogWizard";
import DiscussionFeed, { DiscussionThread } from "../../components/DiscussionFeed";

// ─── Tab definition ───────────────────────────────────────────────────────────

type Tab = "wiki" | "logs" | "discussion" | "reviews";

// ─── Wiki helpers ─────────────────────────────────────────────────────────────

function topItems(reviews: any[], field: "pros" | "cons", n: number): string[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    for (const item of (r[field] ?? [])) {
      if (item?.trim()) counts.set(item.trim(), (counts.get(item.trim()) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([text, count]) => ({ text, count })) as any;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductPage() {
  const params    = useParams();
  const productId = params.productId as string;

  // ── Core data ────────────────────────────────────────────────────────────
  const [product, setProduct]         = useState<any>(null);
  const [reviews, setReviews]         = useState<any[]>([]);
  const [variants, setVariants]       = useState<ProductVariant[]>([]);
  const [user, setUser]               = useState<User | null>(null);
  const [isLoading, setIsLoading]     = useState(true);

  // ── Hub data ─────────────────────────────────────────────────────────────
  const [ownershipLogs, setOwnershipLogs]   = useState<OwnershipLog[]>([]);
  const [discussions, setDiscussions]       = useState<DiscussionThread[]>([]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState<Tab>("wiki");
  const [reviewMode, setReviewMode]       = useState<"campaign" | "verified" | "generic" | null>(null);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [verifiedOnly, setVerifiedOnly]   = useState(false);
  const [selectedVariantId, setSelectedVariantId]   = useState("all");
  const [showNewLog, setShowNewLog]       = useState(false);
  const [hasLog, setHasLog]               = useState(false);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || reviews.length === 0) return;
    setHasAlreadyReviewed(reviews.some((r) => r.reviewerId === user.uid));
  }, [user, reviews]);

  useEffect(() => {
    if (!user || ownershipLogs.length === 0) return;
    setHasLog(ownershipLogs.some((l) => l.ownerId === user.uid));
  }, [user, ownershipLogs]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!productId) return;
      try {
        const [productSnap, variantSnap, reviewsSnap, logsSnap, discussionsSnap] = await Promise.all([
          getDoc(doc(db, "products", productId)),
          getDocs(collection(db, "products", productId, "productVariants")),
          getDocs(query(collection(db, "reviews"), where("productId", "==", productId))),
          getDocs(query(collection(db, "ownershipLogs"), where("productId", "==", productId))),
          getDocs(query(collection(db, "discussions"), where("productId", "==", productId))),
        ]);

        if (productSnap.exists()) setProduct({ id: productSnap.id, ...productSnap.data() });

        setVariants(variantSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string })));

        const fetchedReviews: any[] = [];
        reviewsSnap.forEach((d) => fetchedReviews.push({ id: d.id, ...d.data() }));
        fetchedReviews.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        setReviews(fetchedReviews);

        const fetchedLogs = logsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as OwnershipLog))
          .sort((a, b) => new Date(b.lastEntryAt).getTime() - new Date(a.lastEntryAt).getTime());
        setOwnershipLogs(fetchedLogs);

        const fetchedThreads = discussionsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as DiscussionThread))
          .sort((a, b) => b.upvotes - a.upvotes);
        setDiscussions(fetchedThreads);
      } catch (err) {
        console.error("Error fetching product hub data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [productId]);

  // ── Derived review data ───────────────────────────────────────────────────
  const filteredReviews   = selectedVariantId === "all"
    ? reviews
    : reviews.filter((r) => r.variantId === selectedVariantId);

  const displayedReviews  = verifiedOnly
    ? filteredReviews.filter((r) => r.isVerifiedPurchase === true)
    : filteredReviews;

  const avgRating         = displayedReviews.length > 0
    ? (displayedReviews.reduce((s, r) => s + (r.rating || 0), 0) / displayedReviews.length).toFixed(1)
    : null;

  // ── Wiki derivations ──────────────────────────────────────────────────────
  const topPros  = topItems(reviews, "pros", 6)  as { text: string; count: number }[];
  const topCons  = topItems(reviews, "cons", 6)  as { text: string; count: number }[];
  const specs    = product?.specs as { label: string; value: string }[] | undefined;
  const skus     = product?.verifiedSkus as string[] | undefined;

  // ── Review handlers ───────────────────────────────────────────────────────
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
      const res  = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewContent: data.content,
          reviewerName:  user.displayName,
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

  const handleLike = async (reviewId: string, likedBy: string[] = []) => {
    if (!user) return;
    const has = likedBy.includes(user.uid);
    setReviews((cur) => cur.map((r) =>
      r.id !== reviewId ? r : has
        ? { ...r, likesCount: Math.max(0, (r.likesCount || 0) - 1), likedBy: r.likedBy.filter((id: string) => id !== user.uid) }
        : { ...r, likesCount: (r.likesCount || 0) + 1, likedBy: [...(r.likedBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      likesCount: increment(has ? -1 : 1),
      likedBy:    has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleHelpful = async (reviewId: string, helpfulBy: string[] = []) => {
    if (!user) return;
    const has = helpfulBy.includes(user.uid);
    setReviews((cur) => cur.map((r) =>
      r.id !== reviewId ? r : has
        ? { ...r, helpfulCount: Math.max(0, (r.helpfulCount || 0) - 1), helpfulBy: (r.helpfulBy || []).filter((id: string) => id !== user.uid) }
        : { ...r, helpfulCount: (r.helpfulCount || 0) + 1, helpfulBy: [...(r.helpfulBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      helpfulCount: increment(has ? -1 : 1),
      helpfulBy:    has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleNotHelpful = async (reviewId: string, notHelpfulBy: string[] = []) => {
    if (!user) return;
    const has = notHelpfulBy.includes(user.uid);
    setReviews((cur) => cur.map((r) =>
      r.id !== reviewId ? r : has
        ? { ...r, notHelpfulCount: Math.max(0, (r.notHelpfulCount || 0) - 1), notHelpfulBy: (r.notHelpfulBy || []).filter((id: string) => id !== user.uid) }
        : { ...r, notHelpfulCount: (r.notHelpfulCount || 0) + 1, notHelpfulBy: [...(r.notHelpfulBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      notHelpfulCount: increment(has ? -1 : 1),
      notHelpfulBy:    has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  // ── Log handlers ──────────────────────────────────────────────────────────
  const handleLikeLog = async (logId: string, likedBy: string[]) => {
    if (!user) return;
    const has = likedBy.includes(user.uid);
    setOwnershipLogs((cur) => cur.map((l) =>
      l.id !== logId ? l : {
        ...l,
        likesCount: has ? Math.max(0, l.likesCount - 1) : l.likesCount + 1,
        likedBy: has ? l.likedBy.filter((x) => x !== user.uid) : [...l.likedBy, user.uid],
      }
    ));
    await updateDoc(doc(db, "ownershipLogs", logId), {
      likesCount: increment(has ? -1 : 1),
      likedBy:    has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  // ── Discussion handlers ───────────────────────────────────────────────────
  const handleUpvoteThread = async (threadId: string, upvotedBy: string[]) => {
    if (!user) return;
    const has = upvotedBy.includes(user.uid);
    setDiscussions((cur) => cur.map((t) =>
      t.id !== threadId ? t : {
        ...t,
        upvotes:   has ? Math.max(0, t.upvotes - 1) : t.upvotes + 1,
        upvotedBy: has ? t.upvotedBy.filter((x) => x !== user.uid) : [...t.upvotedBy, user.uid],
      }
    ));
    await updateDoc(doc(db, "discussions", threadId), {
      upvotes:   increment(has ? -1 : 1),
      upvotedBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  // ── Loading / not found ───────────────────────────────────────────────────
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

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "wiki",       label: "📖 Wiki"                          },
    { id: "logs",       label: "📋 Logs",   count: ownershipLogs.length  },
    { id: "discussion", label: "💬 Discuss", count: discussions.length    },
    { id: "reviews",    label: "⭐ Reviews", count: displayedReviews.length },
  ];

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Modals */}
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
      {showNewLog && user && (
        <NewLogWizard
          productId={productId}
          productName={product.name}
          variants={variants}
          userId={user.uid}
          userName={user.displayName ?? "Anonymous"}
          onCreated={(log) => {
            setOwnershipLogs((prev) => [log, ...prev]);
            setHasLog(true);
            setShowNewLog(false);
            setActiveTab("logs");
          }}
          onClose={() => setShowNewLog(false)}
        />
      )}

      <div className="max-w-xl mx-auto border-x border-slate-200/80 dark:border-slate-800 min-h-screen">

        {/* Back */}
        <div className="px-4 pt-3 pb-1">
          <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Home</Link>
        </div>

        {/* ── Product header ─────────────────────────────────────────────── */}
        <div className="px-4 py-4 border-b border-slate-200/80 dark:border-slate-800">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">
            {product.category}
          </p>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug">{product.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5">{product.brandName}</p>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
              Active pool
            </span>
            {avgRating && (
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                ★ {avgRating} · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </span>
            )}
            {ownershipLogs.length > 0 && (
              <span className="text-[11px] font-medium text-violet-700 dark:text-violet-400">
                {ownershipLogs.length} owner log{ownershipLogs.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Variant aggregate pills */}
          {variants.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {variants.map((v) => {
                const vc  = reviews.filter((r) => r.variantId === v.id).length;
                const vavg = vc > 0
                  ? (reviews.filter((r) => r.variantId === v.id).reduce((s, r) => s + (r.rating || 0), 0) / vc).toFixed(1)
                  : null;
                return (
                  <div key={v.id} className="text-[11px] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{v.name}</span>
                    {vavg
                      ? <span className="ml-1.5 text-amber-500 dark:text-amber-400">★ {vavg}</span>
                      : <span className="ml-1.5 text-slate-400">No reviews</span>}
                    <span className="ml-1 text-slate-400">({vc})</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-200/80 dark:border-slate-800 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-[12px] font-semibold whitespace-nowrap flex items-center gap-1.5 transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            ZONE 1 — WIKI
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "wiki" && (
          <div className="px-4 py-5 space-y-6">
            {/* About */}
            {product.description && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">About</h2>
                <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed">{product.description}</p>
              </section>
            )}

            {/* Specs table */}
            {specs && specs.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">Specifications</h2>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-[13px]">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {specs.map((s, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-slate-50 dark:bg-slate-900/50" : ""}>
                          <td className="px-4 py-2.5 font-medium text-slate-500 dark:text-slate-500 w-2/5">{s.label}</td>
                          <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Verified SKUs */}
            {skus && skus.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">Verified SKUs</h2>
                <div className="flex flex-wrap gap-1.5">
                  {skus.map((sku) => (
                    <span key={sku} className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                      {sku}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Community highlights — from aggregated pros/cons */}
            {reviews.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-3">
                  Community Verdict · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {topPros.length > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-500 mb-2">✓ Loved for</p>
                      {topPros.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 mb-1.5 last:mb-0">
                          <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-snug">{p.text}</p>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold shrink-0">×{p.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {topCons.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-500 mb-2">⚠ Common Issues</p>
                      {topCons.map((c, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 mb-1.5 last:mb-0">
                          <p className="text-[12px] text-slate-700 dark:text-slate-300 leading-snug">{c.text}</p>
                          <span className="text-[10px] text-red-600 dark:text-red-500 font-bold shrink-0">×{c.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Ownership log teaser */}
            {ownershipLogs.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">
                  Ownership Logs
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab("logs")}
                  className="w-full text-left bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl p-3 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition"
                >
                  <p className="text-[13px] font-semibold text-violet-800 dark:text-violet-300">
                    {ownershipLogs.length} owner{ownershipLogs.length !== 1 ? "s" : ""} keeping live logs →
                  </p>
                  <p className="text-[11px] text-violet-600 dark:text-violet-500 mt-0.5">
                    Real ownership journeys with service records, issues, and milestones.
                  </p>
                </button>
              </section>
            )}

            {reviews.length === 0 && !specs && (
              <div className="py-12 text-center text-slate-400 dark:text-slate-600 text-sm">
                <p className="text-2xl mb-2">📖</p>
                <p>Wiki is empty. Add specs or be the first to review.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ZONE 2 — OWNERSHIP LOGS
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "logs" && (
          <div className="px-4 py-5 space-y-4">
            {/* CTA */}
            {user && !hasLog && (
              <button
                type="button"
                onClick={() => setShowNewLog(true)}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white text-sm font-semibold py-3 rounded-xl transition"
              >
                📋 Start your ownership log
              </button>
            )}
            {user && hasLog && (
              <p className="text-[12px] text-center text-slate-500 dark:text-slate-500">
                Your log is active. Expand it below to add updates.
              </p>
            )}
            {!user && (
              <p className="text-[12px] text-center text-slate-500 dark:text-slate-500 py-2">
                Sign in to start an ownership log.
              </p>
            )}

            {/* Log list */}
            {ownershipLogs.length === 0 ? (
              <div className="py-10 text-center text-slate-400 dark:text-slate-600 text-sm">
                <p className="text-3xl mb-2">📋</p>
                <p>No ownership logs yet.</p>
                <p className="text-[12px] mt-1">Be the first to document your ownership journey.</p>
              </div>
            ) : (
              ownershipLogs.map((log) => (
                <OwnershipLogCard
                  key={log.id}
                  log={log}
                  currentUserId={user?.uid}
                  currentUserName={user?.displayName ?? undefined}
                  onLikeLog={handleLikeLog}
                />
              ))
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ZONE 3 — DISCUSSION
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "discussion" && (
          <div className="px-4 py-5">
            <DiscussionFeed
              threads={discussions}
              productId={productId}
              currentUserId={user?.uid}
              currentUserName={user?.displayName ?? undefined}
              onUpvoteThread={handleUpvoteThread}
              onNewThread={(t) => setDiscussions((prev) => [t, ...prev])}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ZONE 4 — REVIEWS (legacy, full existing UX)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "reviews" && (
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {/* Write review CTA */}
            <div className="px-4 py-4">
              {!user ? (
                <p className="text-sm text-slate-500 dark:text-slate-500 text-center">Sign in to post a review.</p>
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

            {/* Variant filter */}
            {variants.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Filter by variant</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedVariantId("all")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      selectedVariantId === "all"
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    All ({reviews.length})
                  </button>
                  {variants.map((v) => {
                    const cnt = reviews.filter((r) => r.variantId === v.id).length;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          selectedVariantId === v.id
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {v.name} ({cnt})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reviews header + verified toggle */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide">
                Reviews{displayedReviews.length > 0 ? ` · ${displayedReviews.length}` : ""}
                {verifiedOnly && <span className="ml-1 normal-case text-emerald-600 dark:text-emerald-400">· verified only</span>}
              </h3>
              <button
                type="button"
                onClick={() => setVerifiedOnly((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition shrink-0 ${
                  verifiedOnly
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <span>{verifiedOnly ? "✓" : "○"}</span>
                Verified owners only
              </button>
            </div>

            {displayedReviews.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-500">
                {selectedVariantId !== "all" ? "No reviews for this variant yet." : "No reviews yet. Be the first!"}
              </p>
            ) : (
              displayedReviews.map((review) => (
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
        )}
      </div>
    </main>
  );
}

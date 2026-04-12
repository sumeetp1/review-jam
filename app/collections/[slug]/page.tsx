"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { scoreColor } from "../../../lib/reviewUtils";
import type { Collection, ProductEntry } from "../../../lib/types";

// ─── Health Score Circle (matches explore page) ─────────────────────────────

function HealthCircle({ score }: { score: number }) {
  const size = 40;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score, 100) / 100;
  const offset = circumference * (1 - progress);
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="drop-shadow-md">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-900 dark:text-white">
        {score}
      </span>
    </div>
  );
}

// ─── Sort options ───────────────────────────────────────────────────────────

type CollectionSort = "health" | "rating" | "reviews";

const SORT_OPTIONS: { key: CollectionSort; label: string }[] = [
  { key: "health", label: "Health score" },
  { key: "rating", label: "Rating" },
  { key: "reviews", label: "Reviews" },
];

// ─── Main page ──────────────────────────────────────────────────────────────

export default function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [collectionData, setCollectionData] = useState<Collection | null>(null);
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<CollectionSort>("health");

  useEffect(() => {
    async function load() {
      try {
        // Find collection by slug
        const collSnap = await getDocs(
          query(collection(db, "collections"), where("slug", "==", slug))
        );
        if (collSnap.empty) {
          setIsLoading(false);
          return;
        }

        const collDoc = collSnap.docs[0];
        const coll = { id: collDoc.id, ...collDoc.data() } as Collection;
        setCollectionData(coll);

        if (coll.productIds.length === 0) {
          setIsLoading(false);
          return;
        }

        // Fetch products and reviews
        const [prodSnap, revSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "reviews")),
        ]);

        const productMap = new Map<string, any>();
        prodSnap.docs.forEach((d) => {
          if (coll.productIds.includes(d.id)) {
            productMap.set(d.id, { id: d.id, ...d.data() });
          }
        });

        const allReviews = revSnap.docs.map((d) => d.data());

        const entries: ProductEntry[] = coll.productIds
          .filter((pid) => productMap.has(pid))
          .map((pid) => {
            const prod = productMap.get(pid)!;
            const prodReviews = allReviews.filter(
              (r) => r.productId === pid || r.campaignId === prod.campaignId
            );

            const reviewCount = prodReviews.length;
            const avgRating = reviewCount
              ? prodReviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount
              : 0;
            const reviewsWithHealth = prodReviews.filter((r) => r.healthScore != null);
            const avgHealthScore = reviewsWithHealth.length
              ? Math.round(reviewsWithHealth.reduce((s, r) => s + r.healthScore, 0) / reviewsWithHealth.length)
              : 0;
            const totalLikes = prodReviews.reduce((s, r) => s + (r.likesCount || 0), 0);
            const topReview = [...prodReviews].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))[0];
            const topQuote = topReview?.summary || topReview?.marketingQuote || "";

            return {
              id: pid,
              name: prod.name,
              brandName: prod.brandName,
              category: prod.category,
              campaignId: prod.campaignId,
              endDate: prod.endDate,
              communitySeeded: prod.communitySeeded === true,
              slug: prod.slug,
              communitySlug: prod.communitySlug,
              coverImage: prod.coverImage,
              reviewCount,
              avgRating,
              avgHealthScore,
              totalLikes,
              bountyPool: prod.bountyPool ?? 0,
              bountyPoolRemaining: prod.bountyPoolRemaining ?? 0,
              bountyStatus: prod.bountyStatus ?? "",
              topQuote,
              discoveryRank: 0,
              hasVerifiedOwner: prodReviews.some((r) => r.isVerifiedPurchase === true),
            };
          });

        setProducts(entries);
      } catch (error) {
        console.error("Failed to load collection:", error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [slug]);

  const sorted = [...products].sort((a, b) => {
    if (sortKey === "health") return b.avgHealthScore - a.avgHealthScore;
    if (sortKey === "rating") return b.avgRating - a.avgRating;
    return b.reviewCount - a.reviewCount;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] flex items-center justify-center text-slate-500 dark:text-zinc-500 text-sm animate-pulse">
        Loading...
      </div>
    );
  }

  if (!collectionData) {
    return (
      <main className="min-h-screen bg-white dark:bg-[#09090b] text-slate-800 dark:text-zinc-200 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500 dark:text-zinc-500 text-sm">Collection not found.</p>
        <Link href="/collections" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          Back to Collections
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-[#09090b] text-slate-800 dark:text-zinc-200">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/collections"
            className="text-sm text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200 transition shrink-0"
          >
            &larr; Collections
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Collection info */}
        <div className="flex items-start gap-4">
          <span className="text-4xl leading-none shrink-0">{collectionData.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">{collectionData.name}</h1>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 mt-1">
              by {collectionData.creatorName} &middot; {collectionData.productIds.length} product{collectionData.productIds.length !== 1 ? "s" : ""}
              {collectionData.isOfficial && (
                <span className="ml-2 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                  Official
                </span>
              )}
            </p>
            {collectionData.description && (
              <p className="text-[13px] text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {collectionData.description}
              </p>
            )}
          </div>
        </div>

        {/* Sort options */}
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortKey(opt.key)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition ${
                sortKey === opt.key
                  ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                  : "bg-white dark:bg-white/[0.03] text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {sorted.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-500 dark:text-zinc-500 text-sm">This collection has no products yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((p) => (
              <Link
                key={p.id}
                href={p.slug && p.communitySlug ? `/c/${p.communitySlug}/${p.slug}` : `/product/${p.id}`}
                className="group glass-card flex flex-col overflow-hidden hover:border-slate-200 dark:hover:border-white/10 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-black/20 transition"
              >
                {/* Cover image */}
                <div className="relative">
                  {p.coverImage ? (
                    <div className="relative w-full h-40 overflow-hidden bg-slate-100 dark:bg-zinc-900 shrink-0">
                      <img
                        src={p.coverImage}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
                        {p.avgRating > 0 && (
                          <span className="text-[11px] font-semibold text-white flex items-center gap-0.5">
                            <span className="text-amber-400">&#9733;</span> {p.avgRating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center shrink-0">
                      <span className="text-4xl opacity-30 select-none">&#128230;</span>
                    </div>
                  )}

                  {p.avgHealthScore > 0 && (
                    <div className="absolute top-2 right-2" title={`Health Score: ${p.avgHealthScore}/100`}>
                      <HealthCircle score={p.avgHealthScore} />
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-snug transition-colors">
                        {p.name}
                      </h3>
                      <p className="text-[12px] text-slate-500 dark:text-zinc-500 mt-0.5">{p.brandName}</p>
                    </div>
                    {!p.coverImage && p.avgRating > 0 && (
                      <span className="text-[11px] text-amber-500 dark:text-amber-400 font-semibold shrink-0">&#9733; {p.avgRating.toFixed(1)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium border border-slate-200 dark:border-white/[0.06]">
                      {p.category}
                    </span>
                  </div>

                  {p.topQuote && (
                    <p className="text-[12px] text-slate-500 dark:text-zinc-500 leading-relaxed line-clamp-2 italic">
                      &ldquo;{p.topQuote}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-500 mt-auto pt-2 border-t border-slate-200 dark:border-white/[0.06]">
                    <span>{p.reviewCount} review{p.reviewCount !== 1 ? "s" : ""}</span>
                    <span>&#128077; {p.totalLikes}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

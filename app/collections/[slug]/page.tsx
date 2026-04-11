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
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#e8e4f0]">
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
      <div className="min-h-screen bg-[#13111a] flex items-center justify-center text-[#8b839e] text-sm animate-pulse">
        Loading...
      </div>
    );
  }

  if (!collectionData) {
    return (
      <main className="min-h-screen bg-[#13111a] text-[#e8e4f0] flex flex-col items-center justify-center gap-4">
        <p className="text-[#8b839e] text-sm">Collection not found.</p>
        <Link href="/collections" className="text-sm text-[#e04c8a] hover:underline">
          Back to Collections
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#13111a] text-[#e8e4f0]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#13111a]/95 backdrop-blur-md border-b border-[#2a2535]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/collections"
            className="text-sm text-[#8b839e] hover:text-[#e8e4f0] transition shrink-0"
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
            <h1 className="text-xl font-bold text-[#e8e4f0]">{collectionData.name}</h1>
            <p className="text-[13px] text-[#8b839e] mt-1">
              by {collectionData.creatorName} &middot; {collectionData.productIds.length} product{collectionData.productIds.length !== 1 ? "s" : ""}
              {collectionData.isOfficial && (
                <span className="ml-2 text-[10px] font-semibold text-[#e04c8a] bg-[#e04c8a]/12 px-1.5 py-0.5 rounded-full">
                  Official
                </span>
              )}
            </p>
            {collectionData.description && (
              <p className="text-[13px] text-[#cbc5d9] mt-2 leading-relaxed">
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
                  ? "bg-[#e04c8a]/20 text-[#e04c8a] border-[#e04c8a]/30"
                  : "bg-[#1c1826] text-[#8b839e] border-[#2a2535] hover:bg-[#231e2e]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {sorted.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[#8b839e] text-sm">This collection has no products yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm lg gap-4">
            {sorted.map((p) => (
              <Link
                key={p.id}
                href={p.slug && p.communitySlug ? `/c/${p.communitySlug}/${p.slug}` : `/product/${p.id}`}
                className="group glass-card flex flex-col overflow-hidden hover:border-[#2a2535] hover:shadow-md hover:shadow-[#2a2535]/50 transition"
              >
                {/* Cover image */}
                <div className="relative">
                  {p.coverImage ? (
                    <div className="relative w-full h-40 overflow-hidden bg-[#1c1826] shrink-0">
                      <img
                        src={p.coverImage}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
                        {p.avgRating > 0 && (
                          <span className="text-[11px] font-semibold text-white flex items-center gap-0.5">
                            <span className="text-[#fde68a]">&#9733;</span> {p.avgRating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-[#1c1826] to-[#2a2535] flex items-center justify-center shrink-0">
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
                      <h3 className="text-[14px] font-semibold text-[#e8e4f0] group-hover:text-[#e04c8a] leading-snug transition-colors">
                        {p.name}
                      </h3>
                      <p className="text-[12px] text-[#8b839e] mt-0.5">{p.brandName}</p>
                    </div>
                    {!p.coverImage && p.avgRating > 0 && (
                      <span className="text-[11px] text-[#fbbf24] font-semibold shrink-0">&#9733; {p.avgRating.toFixed(1)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] bg-[#1c1826] text-[#8b839e] px-2 py-0.5 rounded-full font-medium border border-[#2a2535]">
                      {p.category}
                    </span>
                  </div>

                  {p.topQuote && (
                    <p className="text-[12px] text-[#8b839e] leading-relaxed line-clamp-2 italic">
                      &ldquo;{p.topQuote}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-[#8b839e] mt-auto pt-2 border-t border-[#2a2535]">
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

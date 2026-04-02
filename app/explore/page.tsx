"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { calculateDiscoveryRank } from "../../lib/discoveryRank";

type ProductEntry = {
  id: string;
  name: string;
  brandName: string;
  category: string;
  campaignId: string;
  endDate: string;
  // Computed
  reviewCount: number;
  avgRating: number;
  topQuote: string;
  totalLikes: number;
  discoveryRank: number;
};

const CATEGORIES = ["All", "Tech", "Home", "SaaS", "Automotive", "Beauty", "Gaming", "Fitness", "Travel", "Finance"];

type SortKey = "discovery" | "reviews" | "rating" | "likes" | "newest";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "discovery", label: "🔥 Discovery" },
  { key: "likes",     label: "Most liked" },
  { key: "reviews",   label: "Most reviewed" },
  { key: "rating",    label: "Highest rated" },
  { key: "newest",    label: "Newest" },
];

export default function ExplorePage() {
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("discovery");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [prodSnap, revSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "reviews")),
        ]);

        const reviews = revSnap.docs.map((d) => d.data());

        const entries: ProductEntry[] = prodSnap.docs.map((d) => {
          const prod = d.data();
          const prodReviews = reviews.filter((r) => r.productId === d.id || r.campaignId === prod.campaignId);

          const reviewCount = prodReviews.length;
          const avgRating = reviewCount
            ? prodReviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount
            : 0;
          const totalLikes = prodReviews.reduce((s, r) => s + (r.likesCount || 0), 0);
          const topReview = [...prodReviews].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))[0];
          const topQuote = topReview?.summary || topReview?.marketingQuote || "";
          const discoveryRank = calculateDiscoveryRank(
            prodReviews.map((r) => ({
              healthScore: r.healthScore,
              isCampaignReview: r.isCampaignReview,
              createdAt: r.createdAt,
            }))
          );

          return {
            id: d.id,
            name: prod.name,
            brandName: prod.brandName,
            category: prod.category,
            campaignId: prod.campaignId,
            endDate: prod.endDate,
            reviewCount,
            avgRating,
            totalLikes,
            topQuote,
            discoveryRank,
          };
        });

        setProducts(entries);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const now = Date.now();
  const isActive = (p: ProductEntry) => !p.endDate || new Date(p.endDate).getTime() > now;

  const filtered = products
    .filter((p) => categoryFilter === "All" || p.category === categoryFilter)
    .filter((p) =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brandName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortKey === "discovery") return b.discoveryRank - a.discoveryRank;
      if (sortKey === "reviews")   return b.reviewCount - a.reviewCount;
      if (sortKey === "rating")    return b.avgRating - a.avgRating;
      if (sortKey === "likes")     return b.totalLikes - a.totalLikes;
      // newest
      return new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime();
    });

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <div className="border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Home</Link>
            <Link href="/campaigns" className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">
              Apply to review →
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Explore products</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5">
            Discover products with authentic, engagement-ranked reviews.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {/* Search + sort row */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <input
            type="search"
            placeholder="Search products or brands…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <div className="flex gap-1 shrink-0">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSortKey(opt.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition ${
                  sortKey === opt.key
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                    : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border transition ${
                categoryFilter === cat
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                  : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No products found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2.5 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 group-hover:underline leading-snug">
                      {p.name}
                    </h3>
                    <p className="text-[12px] text-slate-500 dark:text-slate-500 mt-0.5">{p.brandName}</p>
                  </div>
                  {isActive(p) && (
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded shrink-0">Live</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">{p.category}</span>
                  {p.avgRating > 0 && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">★ {p.avgRating.toFixed(1)}</span>
                  )}
                </div>

                {p.topQuote && (
                  <p className="text-[13px] text-slate-600 dark:text-slate-400 italic leading-snug line-clamp-2">
                    "{p.topQuote}"
                  </p>
                )}

                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-500 mt-auto pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>{p.reviewCount} review{p.reviewCount !== 1 ? "s" : ""}</span>
                  <span>👍 {p.totalLikes} likes</span>
                  {sortKey === "discovery" && p.discoveryRank > 0 && (
                    <span className="ml-auto text-amber-600 dark:text-amber-400 font-semibold">
                      🔥 {p.discoveryRank.toFixed(1)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

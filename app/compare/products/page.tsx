"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { topItems, scoreColor } from "../../../lib/reviewUtils";
import HealthRing from "../../components/HealthRing";

// ─── Types ──────────────────────────────────────────────────────────────────

type CompareProduct = {
  id: string;
  name: string;
  brandName: string;
  category: string;
  coverImage?: string;
  slug?: string;
  communitySlug?: string;
};

type CompareStats = {
  avgRating: number;
  avgHealthScore: number;
  reviewCount: number;
  verifiedCount: number;
  topPros: { text: string; count: number }[];
  topCons: { text: string; count: number }[];
};

// ─── Main page ──────────────────────────────────────────────────────────────

export default function CompareProductsWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-[#09090b] flex items-center justify-center text-slate-500 dark:text-zinc-500 text-sm animate-pulse">
          Loading...
        </div>
      }
    >
      <CompareProductsPage />
    </Suspense>
  );
}

function CompareProductsPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [stats, setStats] = useState<Map<string, CompareStats>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      setIsLoading(false);
      return;
    }

    async function load() {
      try {
        // Fetch products
        const prodPromises = ids.map((id) => getDoc(doc(db, "products", id)));
        const prodDocs = await Promise.all(prodPromises);

        const prods: CompareProduct[] = [];
        prodDocs.forEach((d) => {
          if (d.exists()) {
            const data = d.data();
            prods.push({
              id: d.id,
              name: data.name,
              brandName: data.brandName,
              category: data.category,
              coverImage: data.coverImage,
              slug: data.slug,
              communitySlug: data.communitySlug,
            });
          }
        });
        setProducts(prods);

        // Fetch all reviews
        const revSnap = await getDocs(collection(db, "reviews"));
        const allReviews = revSnap.docs.map((d) => d.data());

        // Compute stats per product
        const statsMap = new Map<string, CompareStats>();
        for (const prod of prods) {
          const prodDoc = prodDocs.find((d) => d.id === prod.id);
          const campaignId = prodDoc?.data()?.campaignId;
          const prodReviews = allReviews.filter(
            (r) => r.productId === prod.id || r.campaignId === campaignId
          );

          const reviewCount = prodReviews.length;
          const avgRating = reviewCount
            ? prodReviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount
            : 0;
          const reviewsWithHealth = prodReviews.filter((r) => r.healthScore != null);
          const avgHealthScore = reviewsWithHealth.length
            ? Math.round(
                reviewsWithHealth.reduce((s, r) => s + r.healthScore, 0) / reviewsWithHealth.length
              )
            : 0;
          const verifiedCount = prodReviews.filter((r) => r.isVerifiedPurchase === true).length;
          const topPros = topItems(prodReviews, "pros", 3);
          const topCons = topItems(prodReviews, "cons", 3);

          statsMap.set(prod.id, {
            avgRating,
            avgHealthScore,
            reviewCount,
            verifiedCount,
            topPros,
            topCons,
          });
        }
        setStats(statsMap);
      } catch (error) {
        console.error("Failed to load comparison:", error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [idsParam]);

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (!isLoading && ids.length === 0) {
    return (
      <main className="min-h-screen bg-white dark:bg-[#09090b] text-slate-800 dark:text-zinc-200 flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">Compare Products</h1>
        <p className="text-slate-500 dark:text-zinc-500 text-sm text-center max-w-md">
          Select products to compare from the explore page. You can compare up to 3 products side by side.
        </p>
        <Link
          href="/explore"
          className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Go to Explore
        </Link>
      </main>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] flex items-center justify-center text-slate-500 dark:text-zinc-500 text-sm animate-pulse">
        Loading comparison...
      </div>
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function bestIdx(values: number[]): number {
    let max = -Infinity;
    let idx = -1;
    values.forEach((v, i) => {
      if (v > max) {
        max = v;
        idx = i;
      }
    });
    return idx;
  }

  const healthScores = products.map((p) => stats.get(p.id)?.avgHealthScore ?? 0);
  const ratings = products.map((p) => stats.get(p.id)?.avgRating ?? 0);
  const reviewCounts = products.map((p) => stats.get(p.id)?.reviewCount ?? 0);
  const verifiedCounts = products.map((p) => stats.get(p.id)?.verifiedCount ?? 0);

  const bestHealth = bestIdx(healthScores);
  const bestRating = bestIdx(ratings);
  const bestReviews = bestIdx(reviewCounts);
  const bestVerified = bestIdx(verifiedCounts);

  function winnerBg(idx: number, bestIdx: number): string {
    if (products.length < 2) return "";
    return idx === bestIdx ? "bg-emerald-500/5 dark:bg-emerald-500/10" : "";
  }

  // ─── Stars ────────────────────────────────────────────────────────────────

  function Stars({ rating }: { rating: number }) {
    return (
      <div className="flex items-center gap-1">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`text-sm ${star <= Math.round(rating) ? "text-amber-400" : "text-slate-300 dark:text-zinc-700"}`}
            >
              &#9733;
            </span>
          ))}
        </div>
        <span className="text-[12px] font-semibold text-slate-700 dark:text-zinc-300">
          {rating.toFixed(1)}
        </span>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-white dark:bg-[#09090b] text-slate-800 dark:text-zinc-200">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/explore"
            className="text-sm text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200 transition shrink-0"
          >
            &larr; Explore
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-slate-900 dark:text-zinc-100 leading-tight">
              Product Comparison
            </h1>
            <p className="text-[12px] text-slate-500 dark:text-zinc-500 hidden sm:block">
              {products.length} product{products.length !== 1 ? "s" : ""} side by side
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Mobile: stacked, Medium+: horizontal scroll table */}

        {/* Desktop comparison table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-3 pr-4 pl-2 text-slate-400 dark:text-zinc-500 font-medium text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-white/[0.06] sticky left-0 bg-white dark:bg-[#09090b] min-w-[140px]">
                  &nbsp;
                </th>
                {products.map((p) => (
                  <th
                    key={p.id}
                    className="py-3 px-4 border-b border-slate-200 dark:border-white/[0.06] min-w-[200px]"
                  >
                    <Link
                      href={
                        p.slug && p.communitySlug
                          ? `/c/${p.communitySlug}/${p.slug}`
                          : `/product/${p.id}`
                      }
                      className="block text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    >
                      <div className="text-[14px] font-semibold text-slate-900 dark:text-zinc-100">
                        {p.name}
                      </div>
                      <div className="text-[12px] text-slate-500 dark:text-zinc-500 font-normal mt-0.5">
                        {p.brandName}
                      </div>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Health Score */}
              <tr>
                <td className="py-4 pr-4 pl-2 text-[13px] font-medium text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-white/[0.03] sticky left-0 bg-white dark:bg-[#09090b]">
                  Health Score
                </td>
                {products.map((p, i) => {
                  const s = stats.get(p.id);
                  return (
                    <td
                      key={p.id}
                      className={`py-4 px-4 border-b border-slate-100 dark:border-white/[0.03] ${winnerBg(i, bestHealth)}`}
                    >
                      {s && s.avgHealthScore > 0 ? (
                        <HealthRing score={s.avgHealthScore} size={72} />
                      ) : (
                        <span className="text-[12px] text-slate-400 dark:text-zinc-600">No data</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Rating */}
              <tr>
                <td className="py-3 pr-4 pl-2 text-[13px] font-medium text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-white/[0.03] sticky left-0 bg-white dark:bg-[#09090b]">
                  Average Rating
                </td>
                {products.map((p, i) => {
                  const s = stats.get(p.id);
                  return (
                    <td
                      key={p.id}
                      className={`py-3 px-4 border-b border-slate-100 dark:border-white/[0.03] ${winnerBg(i, bestRating)}`}
                    >
                      {s && s.avgRating > 0 ? (
                        <Stars rating={s.avgRating} />
                      ) : (
                        <span className="text-[12px] text-slate-400 dark:text-zinc-600">No ratings</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Review Count */}
              <tr>
                <td className="py-3 pr-4 pl-2 text-[13px] font-medium text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-white/[0.03] sticky left-0 bg-white dark:bg-[#09090b]">
                  Review Count
                </td>
                {products.map((p, i) => {
                  const s = stats.get(p.id);
                  return (
                    <td
                      key={p.id}
                      className={`py-3 px-4 border-b border-slate-100 dark:border-white/[0.03] text-[14px] font-semibold text-slate-700 dark:text-zinc-300 ${winnerBg(i, bestReviews)}`}
                    >
                      {s?.reviewCount ?? 0}
                    </td>
                  );
                })}
              </tr>

              {/* Top Pros */}
              <tr>
                <td className="py-3 pr-4 pl-2 text-[13px] font-medium text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-white/[0.03] sticky left-0 bg-white dark:bg-[#09090b]">
                  Top Pros
                </td>
                {products.map((p) => {
                  const s = stats.get(p.id);
                  return (
                    <td
                      key={p.id}
                      className="py-3 px-4 border-b border-slate-100 dark:border-white/[0.03]"
                    >
                      {s && s.topPros.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {s.topPros.map((item) => (
                            <span
                              key={item.text}
                              className="text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20"
                            >
                              {item.text}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[12px] text-slate-400 dark:text-zinc-600">None</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Top Cons */}
              <tr>
                <td className="py-3 pr-4 pl-2 text-[13px] font-medium text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-white/[0.03] sticky left-0 bg-white dark:bg-[#09090b]">
                  Top Cons
                </td>
                {products.map((p) => {
                  const s = stats.get(p.id);
                  return (
                    <td
                      key={p.id}
                      className="py-3 px-4 border-b border-slate-100 dark:border-white/[0.03]"
                    >
                      {s && s.topCons.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {s.topCons.map((item) => (
                            <span
                              key={item.text}
                              className="text-[11px] font-medium bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-500/20"
                            >
                              {item.text}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[12px] text-slate-400 dark:text-zinc-600">None</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Verified Owners */}
              <tr>
                <td className="py-3 pr-4 pl-2 text-[13px] font-medium text-slate-700 dark:text-zinc-300 border-b border-slate-100 dark:border-white/[0.03] sticky left-0 bg-white dark:bg-[#09090b]">
                  Verified Owners
                </td>
                {products.map((p, i) => {
                  const s = stats.get(p.id);
                  return (
                    <td
                      key={p.id}
                      className={`py-3 px-4 border-b border-slate-100 dark:border-white/[0.03] text-[14px] font-semibold text-slate-700 dark:text-zinc-300 ${winnerBg(i, bestVerified)}`}
                    >
                      {s?.verifiedCount ?? 0}
                    </td>
                  );
                })}
              </tr>

              {/* Category */}
              <tr>
                <td className="py-3 pr-4 pl-2 text-[13px] font-medium text-slate-700 dark:text-zinc-300 sticky left-0 bg-white dark:bg-[#09090b]">
                  Category
                </td>
                {products.map((p) => (
                  <td
                    key={p.id}
                    className="py-3 px-4"
                  >
                    <span className="text-[11px] bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium border border-slate-200 dark:border-white/[0.06]">
                      {p.category}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <div className="md:hidden space-y-6">
          {products.map((p, i) => {
            const s = stats.get(p.id);
            return (
              <div
                key={p.id}
                className="glass-card p-5 space-y-4"
              >
                <Link
                  href={
                    p.slug && p.communitySlug
                      ? `/c/${p.communitySlug}/${p.slug}`
                      : `/product/${p.id}`
                  }
                  className="block"
                >
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                    {p.name}
                  </h3>
                  <p className="text-[12px] text-slate-500 dark:text-zinc-500">{p.brandName}</p>
                </Link>

                {s && s.avgHealthScore > 0 && (
                  <div className="flex justify-center">
                    <HealthRing score={s.avgHealthScore} size={72} />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[18px] font-bold text-slate-900 dark:text-zinc-100">
                      {s?.avgRating ? s.avgRating.toFixed(1) : "--"}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium uppercase">Rating</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-slate-900 dark:text-zinc-100">
                      {s?.reviewCount ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium uppercase">Reviews</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-slate-900 dark:text-zinc-100">
                      {s?.verifiedCount ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-medium uppercase">Verified</div>
                  </div>
                </div>

                {s && s.topPros.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-600 mb-1.5">Pros</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.topPros.map((item) => (
                        <span
                          key={item.text}
                          className="text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20"
                        >
                          {item.text}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {s && s.topCons.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-600 mb-1.5">Cons</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.topCons.map((item) => (
                        <span
                          key={item.text}
                          className="text-[11px] font-medium bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-500/20"
                        >
                          {item.text}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-white/[0.06]">
                  <span className="text-[11px] bg-slate-50 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium border border-slate-200 dark:border-white/[0.06]">
                    {p.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

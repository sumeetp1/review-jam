"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { calculateDiscoveryRank } from "../../lib/discoveryRank";

function isBoosted(channel: { multiplier?: number; multiplierExpiresAt?: string }): boolean {
  if (!channel.multiplier || channel.multiplier <= 1) return false;
  if (channel.multiplierExpiresAt && Date.now() > new Date(channel.multiplierExpiresAt).getTime()) return false;
  return true;
}

type ProductEntry = {
  id: string;
  name: string;
  brandName: string;
  category: string;
  campaignId: string;
  endDate: string;
  communitySeeded?: boolean;
  slug?: string;
  communitySlug?: string;
  // Computed
  reviewCount: number;
  avgRating: number;
  topQuote: string;
  totalLikes: number;
  discoveryRank: number;
  hasVerifiedOwner: boolean;
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

// ─── Create Hub Modal ─────────────────────────────────────────────────────────

type AiPreview = {
  brandName: string;
  category: string;
  description: string;
  specs: { label: string; value: string }[];
  variants: string[];
  verifiedSkus: string[];
};

function CreateHubModal({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string;
  onClose: () => void;
  onCreated: (productId: string) => void;
}) {
  const [name, setName]         = useState(initialName);
  const [step, setStep]         = useState<"input" | "preview" | "done">("input");
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview]   = useState<AiPreview | null>(null);
  const [productId, setProductId] = useState("");
  const [error, setError]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleGenerate() {
    if (!name.trim() || name.trim().length < 2) { setError("Please enter a product name."); return; }
    setError("");
    setIsLoading(true);
    try {
      const res  = await fetch("/api/seed-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setPreview(data.data);
      setProductId(data.productId);
      setStep("preview");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
              {step === "preview" ? "AI-Generated Preview" : "Create Product Hub"}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">
              {step === "preview"
                ? "Review the details Gemini generated — then launch the hub."
                : "Gemini will auto-fill specs, variants, and a description."}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Step 1 — input */}
          {step === "input" && (
            <>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 block mb-1.5">
                  Product Name
                </label>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                  placeholder="e.g. Sony WH-1000XM5, iPhone 16 Pro, Vitamix 5200…"
                  className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-300 dark:text-slate-100 placeholder-slate-400"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1.5">
                  Be specific — include the model number for best results.
                </p>
              </div>

              {error && <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleGenerate}
                  disabled={isLoading || name.trim().length < 2}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                  {isLoading
                    ? <><span className="animate-spin text-base">⟳</span> Asking Gemini…</>
                    : <><span>✨</span> Generate with AI</>}
                </button>
                <button type="button" onClick={onClose}
                  className="px-4 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Step 2 — AI preview */}
          {step === "preview" && preview && (
            <>
              {/* Identity row */}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">{name}</p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-500">
                    {preview.brandName && <>{preview.brandName} · </>}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{preview.category}</span>
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-1 rounded-full shrink-0">
                  ✨ AI Generated
                </span>
              </div>

              {/* Description */}
              {preview.description && (
                <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {preview.description}
                </p>
              )}

              {/* Specs */}
              {preview.specs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">Specs</p>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {preview.specs.map((s, i) => (
                      <div key={i} className={`flex gap-4 px-3 py-2 text-[12px] ${i % 2 === 0 ? "bg-slate-50 dark:bg-slate-800/50" : "bg-white dark:bg-slate-900"}`}>
                        <span className="text-slate-500 dark:text-slate-500 w-28 shrink-0">{s.label}</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Variants */}
              {preview.variants.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">Variants</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.variants.map((v, i) => (
                      <span key={i} className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SKUs */}
              {preview.verifiedSkus.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2">SKUs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.verifiedSkus.map((s, i) => (
                      <span key={i} className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 text-[11px] text-amber-700 dark:text-amber-400">
                <span className="font-bold">Community Seeded</span> — this hub will be tagged until a verified owner posts a review.
              </div>

              {error && <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => onCreated(productId)}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                  🚀 Launch Product Hub
                </button>
                <button type="button" onClick={() => setStep("input")}
                  className="px-4 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  ← Edit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("discovery");
  const [searchQuery, setSearchQuery] = useState("");
  const [boostedCategories, setBoostedCategories] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [prodSnap, revSnap, channelSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "reviews")),
          getDocs(collection(db, "channels")),
        ]);

        // Build the set of categories that have an active bounty multiplier
        const boosted = new Set<string>();
        channelSnap.docs.forEach((d) => {
          const ch = d.data();
          if (isBoosted(ch) && ch.category) boosted.add(ch.category as string);
        });
        setBoostedCategories(boosted);

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
            communitySeeded: prod.communitySeeded === true,
            slug: prod.slug,
            communitySlug: prod.communitySlug,
            reviewCount,
            avgRating,
            totalLikes,
            topQuote,
            discoveryRank,
            hasVerifiedOwner: prodReviews.some((r) => r.isVerifiedPurchase === true),
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
      {showCreateModal && (
        <CreateHubModal
          initialName={searchQuery.trim()}
          onClose={() => setShowCreateModal(false)}
          onCreated={(productId) => {
            setShowCreateModal(false);
            router.push(`/product/${productId}`); // redirects to /c/... after migration
          }}
        />
      )}
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="shrink-0">
            <Image src="/logo.svg" alt="Review Jam" width={110} height={26} className="dark:hidden" />
            <Image src="/logo-dark.svg" alt="Review Jam" width={110} height={26} className="hidden dark:block" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">Explore products</h1>
            <p className="text-[12px] text-slate-500 dark:text-slate-500 hidden sm:block">
              Authentic, engagement-ranked reviews
            </p>
          </div>
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
          {CATEGORIES.map((cat) => {
            const active  = categoryFilter === cat;
            const boosted = cat !== "All" && boostedCategories.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border transition ${
                  active
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                    : boosted
                    ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                {boosted && <span aria-label="Boosted category">🔥</span>}
                {cat}
                {boosted && <span className="text-[9px] font-bold tracking-wide uppercase text-orange-600 dark:text-orange-400">Boosted</span>}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <p className="text-slate-400 dark:text-slate-600 text-sm">
              {searchQuery.trim()
                ? <>No results for <span className="font-semibold text-slate-600 dark:text-slate-400">"{searchQuery}"</span></>
                : "No products found."}
            </p>
            {searchQuery.trim().length >= 2 && (
              <div className="flex flex-col items-center gap-2 text-center max-w-sm">
                <p className="text-[12px] text-slate-500 dark:text-slate-500">
                  This product doesn't have a hub yet. Create one and Gemini will auto-fill the specs, variants, and description.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
                >
                  <span>✨</span> Create Product Hub for "{searchQuery}"
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={p.slug && p.communitySlug ? `/c/${p.communitySlug}/${p.slug}` : `/product/${p.id}`}
                className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2.5 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 group-hover:underline leading-snug">
                      {p.name}
                    </h3>
                    <p className="text-[12px] text-slate-500 dark:text-slate-500 mt-0.5">{p.brandName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isActive(p) && (
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">Live</span>
                    )}
                    {p.communitySeeded && !p.hasVerifiedOwner && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded">
                        🌱 Seeded
                      </span>
                    )}
                  </div>
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

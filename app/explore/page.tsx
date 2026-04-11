"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { calculateDiscoveryRank } from "../../lib/discoveryRank";
import type { Collection } from "../../lib/types";

function isBoosted(channel: { multiplier?: number; multiplierExpiresAt?: string }): boolean {
  if (!channel.multiplier || channel.multiplier <= 1) return false;
  if (channel.multiplierExpiresAt && Date.now() > new Date(channel.multiplierExpiresAt).getTime()) return false;
  return true;
}

import type { ProductEntry, SortKey } from "../../lib/types";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "discovery", label: "🔥 Discovery" },
  { key: "likes",     label: "Most liked" },
  { key: "reviews",   label: "Most reviewed" },
  { key: "rating",    label: "Highest rated" },
  { key: "newest",    label: "Newest" },
];

// ─── Health Score Circle ──────────────────────────────────────────────────────

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
        {/* Background circle */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        {/* Progress arc */}
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
  onCreated: (productId: string, slug: string, communitySlug: string) => void;
}) {
  const [name, setName]         = useState(initialName);
  const [step, setStep]         = useState<"input" | "preview" | "done">("input");
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview]   = useState<AiPreview | null>(null);
  const [productId, setProductId] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [productCommunitySlug, setProductCommunitySlug] = useState("");
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
      setProductSlug(data.slug ?? "");
      setProductCommunitySlug(data.communitySlug ?? "");
      setStep("preview");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#1c1826] rounded-2xl w-full max-w-lg border border-[#2a2535] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2535]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#e8e4f0]">
              {step === "preview" ? "AI-Generated Preview" : "Create Product Hub"}
            </h2>
            <p className="text-[11px] text-[#8b839e] mt-0.5">
              {step === "preview"
                ? "Review the details Gemini generated — then launch the hub."
                : "Gemini will auto-fill specs, variants, and a description."}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="text-[#8b839e] hover:text-[#e8e4f0] w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#231e2e] transition text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Step 1 — input */}
          {step === "input" && (
            <>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[#8b839e] block mb-1.5">
                  Product Name
                </label>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                  placeholder="e.g. Sony WH-1000XM5, iPhone 16 Pro, Vitamix 5200…"
                  className="w-full text-sm bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-violet-500/40 text-[#e8e4f0] placeholder-[#4a4458]"
                />
                <p className="text-[11px] text-[#8b839e] mt-1.5">
                  Be specific — include the model number for best results.
                </p>
              </div>

              {error && <p className="text-[12px] text-[#fca5a5]">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleGenerate}
                  disabled={isLoading || name.trim().length < 2}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                  {isLoading
                    ? <><span className="animate-spin text-base">⟳</span> Asking Gemini…</>
                    : <><span>✨</span> Generate with AI</>}
                </button>
                <button type="button" onClick={onClose}
                  className="px-4 text-sm text-[#8b839e] border border-[#2a2535] rounded-xl hover:bg-[#231e2e] transition">
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
                  <p className="text-[15px] font-bold text-[#e8e4f0] truncate">{name}</p>
                  <p className="text-[12px] text-[#8b839e]">
                    {preview.brandName && <>{preview.brandName} · </>}
                    <span className="font-medium text-[#cbc5d9]">{preview.category}</span>
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-violet-400 bg-violet-950/40 border border-violet-800 px-2 py-1 rounded-full shrink-0">
                  ✨ AI Generated
                </span>
              </div>

              {/* Description */}
              {preview.description && (
                <p className="text-[13px] text-[#8b839e] leading-relaxed">
                  {preview.description}
                </p>
              )}

              {/* Specs */}
              {preview.specs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b839e] mb-2">Specs</p>
                  <div className="rounded-lg border border-[#2a2535] overflow-hidden">
                    {preview.specs.map((s, i) => (
                      <div key={i} className={`flex gap-4 px-3 py-2 text-[12px] ${i % 2 === 0 ? "bg-[#1c1826]" : "bg-transparent"}`}>
                        <span className="text-[#8b839e] w-28 shrink-0">{s.label}</span>
                        <span className="text-[#e8e4f0] font-medium">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Variants */}
              {preview.variants.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b839e] mb-2">Variants</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.variants.map((v, i) => (
                      <span key={i} className="text-[11px] font-medium bg-[#1c1826] text-[#cbc5d9] px-2.5 py-1 rounded-md border border-[#2a2535]">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SKUs */}
              {preview.verifiedSkus.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b839e] mb-2">SKUs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.verifiedSkus.map((s, i) => (
                      <span key={i} className="text-[11px] font-mono bg-[#1c1826] text-[#8b839e] px-2 py-0.5 rounded border border-[#2a2535]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#231e2e] border border-[#e04c8a]/20 rounded-lg px-3 py-2.5 text-[11px] text-[#e04c8a]">
                <span className="font-bold">Community Seeded</span> — this hub will be tagged until a verified owner posts a review.
              </div>

              {error && <p className="text-[12px] text-[#fca5a5]">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => onCreated(productId, productSlug, productCommunitySlug)}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                  🚀 Launch Product Hub
                </button>
                <button type="button" onClick={() => setStep("input")}
                  className="px-4 text-sm text-[#8b839e] border border-[#2a2535] rounded-xl hover:bg-[#231e2e] transition">
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

export default function ExplorePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#13111a] flex items-center justify-center text-[#8b839e] text-sm animate-pulse">Loading...</div>}>
      <ExplorePage />
    </Suspense>
  );
}

function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("discovery");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [boostedCategories, setBoostedCategories] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [featuredCollections, setFeaturedCollections] = useState<Collection[]>([]);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const [prodSnap, revSnap, channelSnap, collSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "reviews")),
          getDocs(collection(db, "channels")),
          getDocs(collection(db, "collections")),
        ]);

        // Build the set of categories that have an active bounty multiplier
        const boosted = new Set<string>();
        channelSnap.docs.forEach((d) => {
          const ch = d.data();
          if (isBoosted(ch) && ch.category) boosted.add(ch.category as string);
        });
        setBoostedCategories(boosted);

        // Build dynamic category list from channels
        const allCats = new Set<string>();
        channelSnap.docs.forEach((d) => { const cat = d.data().category; if (cat) allCats.add(cat as string); });
        setDynamicCategories([...allCats].sort());

        // Featured collections (newest 6)
        const colls: Collection[] = collSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Collection))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 6);
        setFeaturedCollections(colls);

        const reviews = revSnap.docs.map((d) => d.data());

        const entries: ProductEntry[] = prodSnap.docs.map((d) => {
          const prod = d.data();
          const prodReviews = reviews.filter((r) => r.productId === d.id || r.campaignId === prod.campaignId);

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
            coverImage: prod.coverImage,
            reviewCount,
            avgRating,
            avgHealthScore,
            totalLikes,
            bountyPool: prod.bountyPool ?? 0,
            bountyPoolRemaining: prod.bountyPoolRemaining ?? 0,
            bountyStatus: prod.bountyStatus ?? "",
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
    <main className="min-h-screen bg-[#13111a] text-[#e8e4f0]">
      {showCreateModal && (
        <CreateHubModal
          initialName={searchQuery.trim()}
          onClose={() => setShowCreateModal(false)}
          onCreated={(productId, slug, communitySlug) => {
            setShowCreateModal(false);
            if (slug && communitySlug) {
              router.push(`/c/${communitySlug}/${slug}`);
            } else {
              router.push(`/product/${productId}`);
            }
          }}
        />
      )}
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#13111a]/95 backdrop-blur-md border-b border-[#2a2535]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="shrink-0 md:hidden">
            <Image src="/logo-dark.svg" alt="Review Jam" width={110} height={26} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-[#e8e4f0] leading-tight">Explore products</h1>
            <p className="text-[12px] text-[#8b839e] hidden sm:block">
              Authentic, engagement-ranked reviews
            </p>
          </div>
          <Link
            href="/collections"
            className="flex items-center gap-1.5 text-sm font-medium text-[#8b839e] hover:text-[#e04c8a] transition shrink-0"
          >
            <span>📚</span>
            <span className="hidden sm:inline">Collections</span>
          </Link>
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
            className="flex-1 bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#e04c8a]/30 text-[#e8e4f0] placeholder-[#4a4458]"
          />
          <div className="flex gap-1 shrink-0">
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
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {["All", ...dynamicCategories].map((cat) => {
            const active  = categoryFilter === cat;
            const boosted = cat !== "All" && boostedCategories.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`whitespace-nowrap flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border transition ${
                  active
                    ? "bg-[#e04c8a]/20 text-[#e04c8a] border-[#e04c8a]/30"
                    : boosted
                    ? "bg-violet-50 text-violet-600 border-violet-300 hover:bg-violet-100"
                    : "bg-[#1c1826] text-[#8b839e] border-[#2a2535] hover:bg-[#231e2e]"
                }`}
              >
                {boosted && <span aria-label="Boosted category">🔥</span>}
                {cat}
                {boosted && <span className="text-[9px] font-bold tracking-wide uppercase text-violet-400">Boosted</span>}
              </button>
            );
          })}
        </div>

        {/* Featured collections */}
        {featuredCollections.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b839e]">Collections</p>
              <Link href="/collections" className="text-[11px] text-[#e04c8a] hover:underline font-medium">
                View all
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
              {featuredCollections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.slug}`}
                  className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2a2535] bg-[#1c1826] hover:bg-[#231e2e] hover:border-[#e04c8a]/30 transition"
                >
                  <span className="text-lg leading-none">{c.emoji}</span>
                  <span className="text-[12px] font-medium text-[#cbc5d9] whitespace-nowrap">{c.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="py-12 text-center text-[#8b839e] text-sm animate-pulse">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <p className="text-[#8b839e] text-sm">
              {searchQuery.trim()
                ? <>No results for <span className="font-semibold text-[#cbc5d9]">"{searchQuery}"</span></>
                : "No products found."}
            </p>
            {searchQuery.trim().length >= 2 && (
              <div className="flex flex-col items-center gap-2 text-center max-w-sm">
                <p className="text-[12px] text-[#8b839e]">
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
            {filtered.map((p) => {
              const isCompareSelected = compareIds.has(p.id);
              return (
                <div key={p.id} className="relative">
                  <Link
                    href={p.slug && p.communitySlug ? `/c/${p.communitySlug}/${p.slug}` : `/product/${p.id}`}
                    className={`group glass-card flex flex-col overflow-hidden hover:border-[#2a2535] hover:shadow-md hover:shadow-[#2a2535]/50 transition ${
                      isCompareSelected ? "ring-2 ring-[#e04c8a]/50" : ""
                    }`}
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
                            {isActive(p) && (
                              <span className="text-[10px] font-semibold text-white bg-[#34d399]/90 px-1.5 py-0.5 rounded-full backdrop-blur-sm">Live</span>
                            )}
                            {p.bountyStatus === "active" && p.bountyPoolRemaining > 0 && (
                              <span className="text-[10px] font-semibold text-white bg-[#fbbf24]/90 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                                &#128176; ${p.bountyPoolRemaining.toFixed(0)} bounty
                              </span>
                            )}
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

                      {/* Health score circle — top right */}
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
                        <span className="text-[11px] bg-[#1c1826] text-[#8b839e] px-2 py-0.5 rounded-full font-medium border border-[#2a2535]">{p.category}</span>
                        {p.communitySeeded && !p.hasVerifiedOwner && (
                          <span className="text-[10px] font-medium text-violet-400 bg-violet-950/40 px-1.5 py-0.5 rounded-full border border-violet-800">
                            &#127793; Seeded
                          </span>
                        )}
                      </div>

                      {p.topQuote && (
                        <p className="text-[12px] text-[#8b839e] leading-relaxed line-clamp-2 italic">
                          &ldquo;{p.topQuote}&rdquo;
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-[#8b839e] mt-auto pt-2 border-t border-[#2a2535]">
                        <span>{p.reviewCount} review{p.reviewCount !== 1 ? "s" : ""}</span>
                        <span>&#128077; {p.totalLikes}</span>
                        {sortKey === "discovery" && p.discoveryRank > 0 && (
                          <span className="ml-auto text-[#e04c8a] font-semibold">
                            &#128293; {p.discoveryRank.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Compare checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCompareIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) {
                          next.delete(p.id);
                        } else if (next.size < 3) {
                          next.add(p.id);
                        }
                        return next;
                      });
                    }}
                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition ${
                      isCompareSelected
                        ? "bg-[#e04c8a] border-[#e04c8a] text-white"
                        : "bg-[#1c1826]/80 border-[#2a2535] text-transparent hover:border-[#f472b6] hover:text-[#f472b6]"
                    }`}
                    title={isCompareSelected ? "Remove from comparison" : "Add to comparison"}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating compare bar */}
      {compareIds.size >= 2 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#e8e4f0] text-white px-5 py-3 rounded-2xl shadow-2xl border border-[#cbc5d9]">
          <span className="text-sm font-medium">
            {compareIds.size} product{compareIds.size !== 1 ? "s" : ""} selected
          </span>
          <Link
            href={`/compare/products?ids=${Array.from(compareIds).join(",")}`}
            className="bg-[#e04c8a] hover:bg-[#e04c8a] text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition"
          >
            Compare
          </Link>
          <button
            type="button"
            onClick={() => setCompareIds(new Set())}
            className="text-sm text-[#8b839e] hover:text-white transition"
          >
            Clear
          </button>
        </div>
      )}
    </main>
  );
}

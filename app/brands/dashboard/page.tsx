"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection, getDocs, query, where, doc, updateDoc,
} from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider } from "../../../lib/firebase";
import { useAuth } from "../../../lib/hooks/useAuth";
import Avatar from "../../components/Avatar";

import type { BrandProduct as Campaign, BrandReview as Review, BrandResponse, BuyLink } from "../../../lib/types";

type ReviewWithResponse = Review & {
  brandResponse?: BrandResponse;
  productId?: string;
};

export default function BrandDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewWithResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [bountyProductId, setBountyProductId] = useState("");
  const [bountyAmount, setBountyAmount] = useState("500");
  const [bountyMaxPerReview, setBountyMaxPerReview] = useState("25");
  const [bountyMinScore, setBountyMinScore] = useState("60");
  const [bountyDuration, setBountyDuration] = useState("30");
  const [isBountyLoading, setIsBountyLoading] = useState(false);
  const [bountyMessage, setBountyMessage] = useState("");
  const [isDistributing, setIsDistributing] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Buy Links state
  const [buyLinksMap, setBuyLinksMap] = useState<Record<string, BuyLink[]>>({});
  const [buyLinkFormOpen, setBuyLinkFormOpen] = useState<string | null>(null);
  const [newLinkRetailer, setNewLinkRetailer] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkPrice, setNewLinkPrice] = useState("");
  const [isSavingBuyLink, setIsSavingBuyLink] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user?.email) {
      loadBrandData(user.email).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function loadBrandData(email: string) {
    // Find campaigns belonging to this brand email
    const q = query(collection(db, "products"), where("brandEmail", "==", email.toLowerCase()));
    const snap = await getDocs(q);

    if (snap.empty) {
      setIsAuthorized(false);
      return;
    }

    setIsAuthorized(true);
    const fetchedCampaigns: Campaign[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
    setCampaigns(fetchedCampaigns);

    // Load buy links from product docs
    const linksMap: Record<string, BuyLink[]> = {};
    for (const d of snap.docs) {
      const data = d.data();
      if (data.buyLinks && Array.isArray(data.buyLinks)) {
        linksMap[d.id] = data.buyLinks as BuyLink[];
      }
    }
    setBuyLinksMap(linksMap);

    // Fetch all reviews for these campaigns
    const campaignIds = fetchedCampaigns.map((c) => c.campaignId);
    // Map campaignId → productId for attaching productId to reviews
    const campaignToProduct: Record<string, string> = {};
    for (const c of fetchedCampaigns) {
      campaignToProduct[c.campaignId] = c.id;
    }
    const reviews: ReviewWithResponse[] = [];

    for (const cid of campaignIds) {
      const rq = query(collection(db, "reviews"), where("campaignId", "==", cid));
      const rsnap = await getDocs(rq);
      rsnap.forEach((d) => {
        const data = d.data();
        reviews.push({ id: d.id, ...data, productId: data.productId || campaignToProduct[cid] } as ReviewWithResponse);
      });
    }

    reviews.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    setAllReviews(reviews);
  }

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch {}
  };

  async function handleFundBounty() {
    if (!bountyProductId) return;
    setIsBountyLoading(true);
    setBountyMessage("");
    try {
      const res = await fetch("/api/bounty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fund",
          productId: bountyProductId,
          amount: Number(bountyAmount),
          maxPerReview: Number(bountyMaxPerReview),
          minHealthScore: Number(bountyMinScore),
          durationDays: Number(bountyDuration),
        }),
      });
      const data = await res.json();
      setBountyMessage(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
      if (data.success && user?.email) loadBrandData(user.email);
    } catch {
      setBountyMessage("❌ Failed to fund bounty. Please try again.");
    } finally {
      setIsBountyLoading(false);
    }
  }

  async function handleDistribute(productId: string) {
    setIsDistributing(productId);
    try {
      const res = await fetch("/api/bounty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "distribute", productId }),
      });
      const data = await res.json();
      alert(data.success ? data.message : data.error);
      if (data.success && user?.email) loadBrandData(user.email);
    } catch {
      alert("Failed to distribute bounty.");
    } finally {
      setIsDistributing(null);
    }
  }

  async function handleBrandRespond(reviewId: string, productId: string, responseBody: string) {
    setIsSubmittingResponse(true);
    try {
      const res = await fetch("/api/brand-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          reviewId,
          productId,
          brandEmail: user?.email,
          body: responseBody,
        }),
      });
      if (res.ok) {
        // Update local state to reflect the response
        setAllReviews((prev: ReviewWithResponse[]) =>
          prev.map((r: ReviewWithResponse) =>
            r.id === reviewId
              ? {
                  ...r,
                  brandResponse: {
                    body: responseBody,
                    respondedBy: user?.email || "",
                    respondedAt: new Date().toISOString(),
                  },
                }
              : r,
          ),
        );
        setRespondingTo(null);
        setResponseText("");
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsSubmittingResponse(false);
    }
  }

  async function handleAddBuyLink(productId: string) {
    if (!newLinkRetailer.trim() || !newLinkUrl.trim()) return;
    setIsSavingBuyLink(true);
    try {
      const newLink: BuyLink = {
        retailer: newLinkRetailer.trim(),
        url: newLinkUrl.trim(),
        price: newLinkPrice.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      const updated = [...(buyLinksMap[productId] || []), newLink];
      await updateDoc(doc(db, "products", productId), { buyLinks: updated });
      setBuyLinksMap((prev) => ({ ...prev, [productId]: updated }));
      setNewLinkRetailer("");
      setNewLinkUrl("");
      setNewLinkPrice("");
      setBuyLinkFormOpen(null);
    } catch (e) {
      console.error("Failed to add buy link:", e);
    } finally {
      setIsSavingBuyLink(false);
    }
  }

  async function handleRemoveBuyLink(productId: string, index: number) {
    const current = buyLinksMap[productId] || [];
    const updated = current.filter((_, i) => i !== index);
    try {
      await updateDoc(doc(db, "products", productId), { buyLinks: updated });
      setBuyLinksMap((prev) => ({ ...prev, [productId]: updated }));
    } catch (e) {
      console.error("Failed to remove buy link:", e);
    }
  }

  const filteredReviews = selectedCampaign === "all"
    ? allReviews
    : allReviews.filter((r) => r.campaignId === selectedCampaign);

  const avgRating = filteredReviews.length
    ? (filteredReviews.reduce((s, r) => s + (r.rating || 0), 0) / filteredReviews.length).toFixed(1)
    : null;

  const totalLikes = filteredReviews.reduce((s, r) => s + (r.likesCount || 0), 0);

  const exportQuotes = () => {
    const quotes = filteredReviews
      .filter((r) => r.summary || r.marketingQuote)
      .map((r) => {
        const q = r.summary || r.marketingQuote || "";
        return `"${q}" — ${r.reviewerName}`;
      });
    if (quotes.length === 0) return alert("No marketing quotes available.");
    const text = quotes.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marketing-quotes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b] text-slate-500 dark:text-zinc-400 text-sm animate-pulse">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-white dark:bg-[#09090b] flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Brand Dashboard</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm max-w-xs text-center">
          Sign in with the email used when setting up your campaign to access your brand analytics.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          className="bg-slate-900 dark:bg-white text-white dark:text-[#09090b] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 dark:hover:bg-zinc-200 transition"
        >
          Sign in with Google
        </button>
        <Link href="/brands" className="text-sm text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300">Don&apos;t have a campaign yet? →</Link>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-white dark:bg-[#09090b] flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">No campaigns found</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm max-w-sm text-center">
          We couldn&apos;t find any campaigns associated with <strong className="text-slate-900 dark:text-white">{user.email}</strong>.
          Make sure your campaign was created with this email, or contact us to get set up.
        </p>
        <div className="flex gap-3">
          <Link href="/brands" className="text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-[#09090b] px-4 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-zinc-200 transition">
            Request a campaign
          </Link>
          <button type="button" onClick={() => { auth.signOut(); }} className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition">
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-[#09090b] text-slate-800 dark:text-zinc-200">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-zinc-500 uppercase tracking-wide mb-0.5">Brand Dashboard</p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{campaigns[0]?.brandName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exportQuotes}
              className="text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition"
            >
              Export quotes
            </button>
            <button
              type="button"
              onClick={() => auth.signOut()}
              className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Campaign selector */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCampaign("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedCampaign === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            }`}
          >
            All campaigns
          </button>
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCampaign(c.campaignId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedCampaign === c.campaignId
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Reviews",     value: filteredReviews.length },
            { label: "Avg rating",  value: avgRating ? `★ ${avgRating}` : "—" },
            { label: "Total likes", value: totalLikes },
            { label: "Responded",   value: filteredReviews.filter((r: ReviewWithResponse) => r.brandResponse).length },
            { label: "Quotes ready", value: filteredReviews.filter(r => r.summary || r.marketingQuote).length },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Fund a Review Bounty ── */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
            💰 Fund a Review Bounty
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
            Incentivize honest reviews by funding a bounty pool. Payouts are based on review quality (health score), not sentiment — negative reviews earn the same as positive ones.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wide mb-1 font-semibold">Product</label>
              <select
                value={bountyProductId}
                onChange={(e) => setBountyProductId(e.target.value)}
                className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-2.5 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
              >
                <option value="">Select a product</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wide mb-1 font-semibold">Pool Amount ($)</label>
              <input
                type="number"
                value={bountyAmount}
                onChange={(e) => setBountyAmount(e.target.value)}
                min="50"
                className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-2.5 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wide mb-1 font-semibold">Max per review ($)</label>
              <input
                type="number"
                value={bountyMaxPerReview}
                onChange={(e) => setBountyMaxPerReview(e.target.value)}
                min="5"
                className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-2.5 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wide mb-1 font-semibold">Min health score (0-100)</label>
              <input
                type="number"
                value={bountyMinScore}
                onChange={(e) => setBountyMinScore(e.target.value)}
                min="0" max="100"
                className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-2.5 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wide mb-1 font-semibold">Duration (days)</label>
              <input
                type="number"
                value={bountyDuration}
                onChange={(e) => setBountyDuration(e.target.value)}
                min="7" max="90"
                className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-2.5 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFundBounty}
                disabled={isBountyLoading || !bountyProductId || !bountyAmount}
                className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-zinc-500 text-white font-bold rounded-lg text-sm transition"
              >
                {isBountyLoading ? "Funding..." : "Fund Bounty"}
              </button>
            </div>
          </div>

          {bountyMessage && (
            <p className={`text-xs font-semibold ${bountyMessage.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
              {bountyMessage}
            </p>
          )}

          {/* Active bounties */}
          {campaigns.filter((c: any) => c.bountyStatus === "active" && (c.bountyPoolRemaining ?? 0) > 0).length > 0 && (
            <div className="mt-4 border-t border-slate-200 dark:border-white/[0.06] pt-4">
              <p className="text-[11px] text-slate-500 dark:text-zinc-500 uppercase tracking-wide font-semibold mb-2">Active Bounties</p>
              <div className="space-y-2">
                {campaigns.filter((c: any) => c.bountyStatus === "active").map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between bg-slate-50 dark:bg-white/[0.03] rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        ${(c.bountyPoolRemaining ?? 0).toFixed(0)} remaining of ${(c.bountyPool ?? 0).toFixed(0)}
                        {c.bountyExpiresAt && <span> · Expires {new Date(c.bountyExpiresAt).toLocaleDateString()}</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDistribute(c.id)}
                      disabled={isDistributing === c.id}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-zinc-800 text-white transition"
                    >
                      {isDistributing === c.id ? "..." : "Distribute"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Buy Links Management ── */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
            🛒 Retailer Buy Links
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
            Add links to where customers can purchase your products. These are displayed on each product&apos;s hub page.
          </p>
          <div className="space-y-4">
            {campaigns.map((c) => {
              const links = buyLinksMap[c.id] || [];
              return (
                <div key={c.id} className="bg-slate-50 dark:bg-white/[0.02] rounded-lg border border-slate-100 dark:border-white/[0.04] p-3">
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">{c.name}</p>
                  {links.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {links.map((link, i) => (
                        <div key={i} className="flex items-center justify-between bg-white dark:bg-white/[0.03] rounded-lg px-3 py-2 border border-slate-200 dark:border-white/[0.06]">
                          <div className="min-w-0 flex-1">
                            <span className="text-[12px] font-semibold text-slate-700 dark:text-zinc-300">{link.retailer}</span>
                            {link.price && <span className="ml-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{link.price}</span>}
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{link.url}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveBuyLink(c.id, i)}
                            className="ml-2 text-[11px] text-red-500 hover:text-red-400 font-semibold transition shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {buyLinkFormOpen === c.id ? (
                    <div className="space-y-2 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={newLinkRetailer}
                          onChange={(e) => setNewLinkRetailer(e.target.value)}
                          placeholder="Retailer name"
                          className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-2 text-slate-900 dark:text-white text-[12px] outline-none focus:border-indigo-500 transition"
                        />
                        <input
                          type="url"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-2 text-slate-900 dark:text-white text-[12px] outline-none focus:border-indigo-500 transition"
                        />
                        <input
                          type="text"
                          value={newLinkPrice}
                          onChange={(e) => setNewLinkPrice(e.target.value)}
                          placeholder="$29.99 (optional)"
                          className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-lg p-2 text-slate-900 dark:text-white text-[12px] outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddBuyLink(c.id)}
                          disabled={isSavingBuyLink || !newLinkRetailer.trim() || !newLinkUrl.trim()}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-zinc-500 text-white transition"
                        >
                          {isSavingBuyLink ? "Saving..." : "Save Link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBuyLinkFormOpen(null); setNewLinkRetailer(""); setNewLinkUrl(""); setNewLinkPrice(""); }}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setBuyLinkFormOpen(c.id); setNewLinkRetailer(""); setNewLinkUrl(""); setNewLinkPrice(""); }}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition"
                    >
                      + Add Link
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top marketing quotes */}
        {filteredReviews.filter(r => r.summary || r.marketingQuote).length > 0 && (
          <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide mb-3">
              Top marketing quotes
            </h3>
            <div className="space-y-2">
              {filteredReviews
                .filter((r) => r.summary || r.marketingQuote)
                .slice(0, 6)
                .map((r) => (
                  <div key={r.id} className="flex items-start gap-2">
                    <span className="text-amber-500 dark:text-amber-400 text-sm shrink-0">★ {r.rating}</span>
                    <div>
                      <p className="text-[14px] text-slate-900 dark:text-white leading-snug">"{r.summary || r.marketingQuote}"</p>
                      <p className="text-[12px] text-slate-500 dark:text-zinc-500 mt-0.5">— {r.reviewerName} · {r.likesCount} likes</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Reviews Needing Response */}
        {(() => {
          const needingResponse = filteredReviews.filter((r: ReviewWithResponse) => !r.brandResponse);
          if (needingResponse.length === 0) return null;
          return (
            <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.06]">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  Reviews needing response
                  <span className="text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                    {needingResponse.length}
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06] max-h-[500px] overflow-y-auto">
                {needingResponse.map((r) => (
                  <div key={r.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={r.reviewerName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{r.reviewerName}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                            <span className="text-amber-500 dark:text-amber-400">★ {r.rating}</span>
                            <span>👍 {r.likesCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {(r.summary || r.marketingQuote) && (
                      <p className="text-[13px] text-slate-700 dark:text-zinc-300 font-medium mb-1 line-clamp-2">
                        {r.summary || r.marketingQuote}
                      </p>
                    )}
                    {r.content && !(r.summary || r.marketingQuote) && (
                      <p className="text-[13px] text-slate-500 dark:text-zinc-400 mb-1 line-clamp-2">
                        {r.content}
                      </p>
                    )}
                    {respondingTo === r.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Write your official response..."
                          rows={3}
                          className="w-full bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] rounded-lg p-2.5 text-[13px] text-slate-700 dark:text-zinc-300 outline-none focus:border-indigo-500 transition resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => r.productId && handleBrandRespond(r.id, r.productId, responseText)}
                            disabled={isSubmittingResponse || !responseText.trim()}
                            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-zinc-500 text-white transition"
                          >
                            {isSubmittingResponse ? "Submitting..." : "Submit Response"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRespondingTo(null); setResponseText(""); }}
                            className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setRespondingTo(r.id); setResponseText(""); }}
                        className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition"
                      >
                        Respond
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Reviews list */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/[0.06]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">All reviews ({filteredReviews.length})</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06] max-h-[600px] overflow-y-auto">
            {filteredReviews.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500 dark:text-zinc-400 text-center">No reviews yet for this campaign.</p>
            ) : (
              filteredReviews.map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.reviewerName} size="sm" />
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{r.reviewerName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[12px] text-slate-500 dark:text-zinc-400">
                      <span className="text-amber-500 dark:text-amber-400">★ {r.rating}</span>
                      <span>👍 {r.likesCount}</span>
                    </div>
                  </div>
                  {(r.summary || r.marketingQuote) && (
                    <p className="text-[13px] text-indigo-500 dark:text-indigo-300 font-medium mb-1">"{r.summary || r.marketingQuote}"</p>
                  )}
                  {r.pros && r.pros.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-1">
                      {r.pros.map((p, i) => (
                        <span key={i} className="text-[11px] bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md">✓ {p}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-[13px] text-slate-700 dark:text-zinc-300 leading-relaxed">{r.content}</p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
                    {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {r.mediaUrls && r.mediaUrls.length > 0 && <span className="ml-2">📸 {r.mediaUrls.length} photo{r.mediaUrls.length > 1 ? "s" : ""}</span>}
                  </p>

                  {/* Brand response section */}
                  {r.brandResponse ? (
                    <div className="mt-2 ml-4 pl-3 border-l-2 border-indigo-500/50">
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg p-2.5">
                        <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">
                          Responded
                        </span>
                        <p className="text-[12px] text-slate-700 dark:text-zinc-300 leading-relaxed mt-1.5 whitespace-pre-wrap">
                          {r.brandResponse.body}
                        </p>
                      </div>
                    </div>
                  ) : respondingTo === r.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Write your official response..."
                        rows={3}
                        className="w-full bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] rounded-lg p-2.5 text-[13px] text-slate-700 dark:text-zinc-300 outline-none focus:border-indigo-500 transition resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => r.productId && handleBrandRespond(r.id, r.productId, responseText)}
                          disabled={isSubmittingResponse || !responseText.trim()}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-zinc-500 text-white transition"
                        >
                          {isSubmittingResponse ? "Submitting..." : "Submit Response"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRespondingTo(null); setResponseText(""); }}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setRespondingTo(r.id); setResponseText(""); }}
                      className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 transition"
                    >
                      Respond
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

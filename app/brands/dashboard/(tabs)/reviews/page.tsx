"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../../lib/firebase";
import { useBrandHub } from "../../components/BrandHubContext";
import type { ReviewWithResponse } from "../../components/BrandHubContext";
import type { BuyLink } from "../../../../../lib/types";
import Avatar from "../../../../components/Avatar";

export default function ReviewsPage() {
  const {
    user,
    campaigns,
    allReviews,
    setAllReviews,
    buyLinksMap,
    setBuyLinksMap,
    selectedCampaign,
    setSelectedCampaign,
    refreshData,
  } = useBrandHub();

  // Bounty state
  const [bountyProductId, setBountyProductId] = useState("");
  const [bountyAmount, setBountyAmount] = useState("500");
  const [bountyMaxPerReview, setBountyMaxPerReview] = useState("25");
  const [bountyMinScore, setBountyMinScore] = useState("60");
  const [bountyDuration, setBountyDuration] = useState("30");
  const [isBountyLoading, setIsBountyLoading] = useState(false);
  const [bountyMessage, setBountyMessage] = useState("");
  const [isDistributing, setIsDistributing] = useState<string | null>(null);

  // Response state
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Buy Links state
  const [buyLinkFormOpen, setBuyLinkFormOpen] = useState<string | null>(null);
  const [newLinkRetailer, setNewLinkRetailer] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkPrice, setNewLinkPrice] = useState("");
  const [isSavingBuyLink, setIsSavingBuyLink] = useState(false);

  const filteredReviews =
    selectedCampaign === "all"
      ? allReviews
      : allReviews.filter((r) => r.campaignId === selectedCampaign);

  const avgRating = filteredReviews.length
    ? (filteredReviews.reduce((s, r) => s + (r.rating || 0), 0) / filteredReviews.length).toFixed(1)
    : null;

  const totalLikes = filteredReviews.reduce((s, r) => s + (r.likesCount || 0), 0);

  // ── Handlers ────────────────────────────────────────────────────────────────

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
      setBountyMessage(data.success ? `\u2705 ${data.message}` : `\u274C ${data.error}`);
      if (data.success) refreshData();
    } catch {
      setBountyMessage("\u274C Failed to fund bounty. Please try again.");
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
      if (data.success) refreshData();
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
      // Silently fail
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

  const exportQuotes = () => {
    const quotes = filteredReviews
      .filter((r) => r.summary || r.marketingQuote)
      .map((r) => {
        const q = r.summary || r.marketingQuote || "";
        return `"${q}" \u2014 ${r.reviewerName}`;
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

  return (
    <div className="space-y-6">
      {/* Campaign selector pills */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          type="button"
          onClick={() => setSelectedCampaign("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            selectedCampaign === "all"
              ? "bg-[#e04c8a] text-white"
              : "bg-[#1c1826] text-[#3a3348] hover:bg-[#231e2e]"
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
                ? "bg-[#e04c8a] text-white"
                : "bg-[#1c1826] text-[#3a3348] hover:bg-[#231e2e]"
            }`}
          >
            {c.name}
          </button>
        ))}
        <div className="ml-auto">
          <button
            type="button"
            onClick={exportQuotes}
            className="text-xs font-medium bg-[#e04c8a] hover:bg-[#d84315] text-white px-3 py-2 rounded-lg transition"
          >
            Export quotes
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Reviews",      value: filteredReviews.length },
          { label: "Avg rating",   value: avgRating ? `\u2605 ${avgRating}` : "\u2014" },
          { label: "Total likes",  value: totalLikes },
          { label: "Responded",    value: filteredReviews.filter((r: ReviewWithResponse) => r.brandResponse).length },
          { label: "Quotes ready", value: filteredReviews.filter((r) => r.summary || r.marketingQuote).length },
        ].map((s) => (
          <div key={s.label} className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-4">
            <p className="text-2xl font-bold text-[#e8e4f0] tabular-nums">{s.value}</p>
            <p className="text-xs text-[#8b839e] uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Fund a Review Bounty */}
      <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#e8e4f0] flex items-center gap-2 mb-1">
          {"\u{1F4B0}"} Fund a Review Bounty
        </h3>
        <p className="text-xs text-[#8b839e] leading-relaxed mb-4">
          Incentivize honest reviews by funding a bounty pool. Payouts are based on review quality (health score), not sentiment.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] text-[#8b839e] uppercase tracking-wide mb-1 font-semibold">Product</label>
            <select
              value={bountyProductId}
              onChange={(e) => setBountyProductId(e.target.value)}
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2.5 text-[#e8e4f0] text-sm outline-none focus:border-[#f472b6] transition"
            >
              <option value="">Select a product</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[#8b839e] uppercase tracking-wide mb-1 font-semibold">Pool Amount ($)</label>
            <input
              type="number"
              value={bountyAmount}
              onChange={(e) => setBountyAmount(e.target.value)}
              min="50"
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2.5 text-[#e8e4f0] text-sm outline-none focus:border-[#f472b6] transition"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#8b839e] uppercase tracking-wide mb-1 font-semibold">Max per review ($)</label>
            <input
              type="number"
              value={bountyMaxPerReview}
              onChange={(e) => setBountyMaxPerReview(e.target.value)}
              min="5"
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2.5 text-[#e8e4f0] text-sm outline-none focus:border-[#f472b6] transition"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#8b839e] uppercase tracking-wide mb-1 font-semibold">Min health score (0-100)</label>
            <input
              type="number"
              value={bountyMinScore}
              onChange={(e) => setBountyMinScore(e.target.value)}
              min="0" max="100"
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2.5 text-[#e8e4f0] text-sm outline-none focus:border-[#f472b6] transition"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#8b839e] uppercase tracking-wide mb-1 font-semibold">Duration (days)</label>
            <input
              type="number"
              value={bountyDuration}
              onChange={(e) => setBountyDuration(e.target.value)}
              min="7" max="90"
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2.5 text-[#e8e4f0] text-sm outline-none focus:border-[#f472b6] transition"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleFundBounty}
              disabled={isBountyLoading || !bountyProductId || !bountyAmount}
              className="w-full px-5 py-2.5 bg-[#34d399] hover:bg-[#4caf50] disabled:bg-[#2a2535] disabled:text-[#8b839e] text-white font-bold rounded-lg text-sm transition"
            >
              {isBountyLoading ? "Funding..." : "Fund Bounty"}
            </button>
          </div>
        </div>

        {bountyMessage && (
          <p className={`text-xs font-semibold ${bountyMessage.startsWith("\u2705") ? "text-green-400" : "text-[#f87171]"}`}>
            {bountyMessage}
          </p>
        )}

        {/* Active bounties */}
        {campaigns.filter((c: any) => c.bountyStatus === "active" && (c.bountyPoolRemaining ?? 0) > 0).length > 0 && (
          <div className="mt-4 border-t border-[#2a2535] pt-4">
            <p className="text-[11px] text-[#8b839e] uppercase tracking-wide font-semibold mb-2">Active Bounties</p>
            <div className="space-y-2">
              {campaigns.filter((c: any) => c.bountyStatus === "active").map((c: any) => (
                <div key={c.id} className="flex items-center justify-between bg-[#231e2e] rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[#e8e4f0]">{c.name}</p>
                    <p className="text-[11px] text-[#8b839e]">
                      ${(c.bountyPoolRemaining ?? 0).toFixed(0)} remaining of ${(c.bountyPool ?? 0).toFixed(0)}
                      {c.bountyExpiresAt && <span> &middot; Expires {new Date(c.bountyExpiresAt).toLocaleDateString()}</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDistribute(c.id)}
                    disabled={isDistributing === c.id}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#e04c8a] hover:bg-[#d84315] disabled:bg-[#2a2535] text-white transition"
                  >
                    {isDistributing === c.id ? "..." : "Distribute"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Buy Links Management */}
      <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#e8e4f0] flex items-center gap-2 mb-1">
          {"\u{1F6D2}"} Retailer Buy Links
        </h3>
        <p className="text-xs text-[#8b839e] leading-relaxed mb-4">
          Add links to where customers can purchase your products. These are displayed on each product&apos;s hub page.
        </p>
        <div className="space-y-4">
          {campaigns.map((c) => {
            const links = buyLinksMap[c.id] || [];
            return (
              <div key={c.id} className="bg-[#231e2e] rounded-lg border border-[#2a2535] p-3">
                <p className="text-sm font-medium text-[#e8e4f0] mb-2">{c.name}</p>
                {links.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {links.map((link, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#1c1826] rounded-lg px-3 py-2 border border-[#2a2535]">
                        <div className="min-w-0 flex-1">
                          <span className="text-[12px] font-semibold text-[#cbc5d9]">{link.retailer}</span>
                          {link.price && <span className="ml-2 text-[11px] text-[#6ee7b7] font-medium">{link.price}</span>}
                          <p className="text-[10px] text-[#8b839e] truncate">{link.url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBuyLink(c.id, i)}
                          className="ml-2 text-[11px] text-[#f87171] hover:text-[#fca5a5] font-semibold transition shrink-0"
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
                        className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2 text-[#e8e4f0] text-[12px] outline-none focus:border-[#f472b6] transition"
                      />
                      <input
                        type="url"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2 text-[#e8e4f0] text-[12px] outline-none focus:border-[#f472b6] transition"
                      />
                      <input
                        type="text"
                        value={newLinkPrice}
                        onChange={(e) => setNewLinkPrice(e.target.value)}
                        placeholder="$29.99 (optional)"
                        className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2 text-[#e8e4f0] text-[12px] outline-none focus:border-[#f472b6] transition"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddBuyLink(c.id)}
                        disabled={isSavingBuyLink || !newLinkRetailer.trim() || !newLinkUrl.trim()}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#e04c8a] hover:bg-[#d84315] disabled:bg-[#2a2535] disabled:text-[#8b839e] text-white transition"
                      >
                        {isSavingBuyLink ? "Saving..." : "Save Link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBuyLinkFormOpen(null); setNewLinkRetailer(""); setNewLinkUrl(""); setNewLinkPrice(""); }}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-[#8b839e] hover:text-[#e8e4f0] hover:bg-[#231e2e] transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setBuyLinkFormOpen(c.id); setNewLinkRetailer(""); setNewLinkUrl(""); setNewLinkPrice(""); }}
                    className="text-[11px] font-semibold text-[#f472b6] hover:text-[#f9a8d4] transition"
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
      {filteredReviews.filter((r) => r.summary || r.marketingQuote).length > 0 && (
        <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#cbc5d9] uppercase tracking-wide mb-3">
            Top marketing quotes
          </h3>
          <div className="space-y-2">
            {filteredReviews
              .filter((r) => r.summary || r.marketingQuote)
              .slice(0, 6)
              .map((r) => (
                <div key={r.id} className="flex items-start gap-2">
                  <span className="text-[#fde68a] text-sm shrink-0">{"\u2605"} {r.rating}</span>
                  <div>
                    <p className="text-[14px] text-[#e8e4f0] leading-snug">&ldquo;{r.summary || r.marketingQuote}&rdquo;</p>
                    <p className="text-[12px] text-[#8b839e] mt-0.5">&mdash; {r.reviewerName} &middot; {r.likesCount} likes</p>
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
          <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2a2535]">
              <h3 className="text-sm font-semibold text-[#e8e4f0] flex items-center gap-2">
                Reviews needing response
                <span className="text-[11px] font-medium bg-[#fbbf24]/10 text-[#fbbf24] px-2 py-0.5 rounded-full">
                  {needingResponse.length}
                </span>
              </h3>
            </div>
            <div className="divide-y divide-[#2a2535] max-h-[500px] overflow-y-auto">
              {needingResponse.map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={r.reviewerName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#e8e4f0] truncate">{r.reviewerName}</p>
                        <div className="flex items-center gap-2 text-[11px] text-[#8b839e]">
                          <span className="text-[#fde68a]">{"\u2605"} {r.rating}</span>
                          <span>{"\u{1F44D}"} {r.likesCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {(r.summary || r.marketingQuote) && (
                    <p className="text-[13px] text-[#cbc5d9] font-medium mb-1 line-clamp-2">
                      {r.summary || r.marketingQuote}
                    </p>
                  )}
                  {r.content && !(r.summary || r.marketingQuote) && (
                    <p className="text-[13px] text-[#8b839e] mb-1 line-clamp-2">
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
                        className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2.5 text-[13px] text-[#cbc5d9] outline-none focus:border-[#f472b6] transition resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => r.productId && handleBrandRespond(r.id, r.productId, responseText)}
                          disabled={isSubmittingResponse || !responseText.trim()}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#e04c8a] hover:bg-[#d84315] disabled:bg-[#2a2535] disabled:text-[#8b839e] text-white transition"
                        >
                          {isSubmittingResponse ? "Submitting..." : "Submit Response"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRespondingTo(null); setResponseText(""); }}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-[#8b839e] hover:text-[#e8e4f0] hover:bg-[#231e2e] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setRespondingTo(r.id); setResponseText(""); }}
                      className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#e04c8a] text-white hover:bg-[#d84315] transition"
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

      {/* All reviews list */}
      <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2535]">
          <h3 className="text-sm font-semibold text-[#e8e4f0]">All reviews ({filteredReviews.length})</h3>
        </div>
        <div className="divide-y divide-[#2a2535] max-h-[600px] overflow-y-auto">
          {filteredReviews.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[#8b839e] text-center">No reviews yet for this campaign.</p>
          ) : (
            filteredReviews.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.reviewerName} size="sm" />
                    <p className="text-sm font-medium text-[#e8e4f0]">{r.reviewerName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[12px] text-[#8b839e]">
                    <span className="text-[#fde68a]">{"\u2605"} {r.rating}</span>
                    <span>{"\u{1F44D}"} {r.likesCount}</span>
                  </div>
                </div>
                {(r.summary || r.marketingQuote) && (
                  <p className="text-[13px] text-[#f472b6] font-medium mb-1">&ldquo;{r.summary || r.marketingQuote}&rdquo;</p>
                )}
                {r.pros && r.pros.length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-1">
                    {r.pros.map((p, i) => (
                      <span key={i} className="text-[11px] bg-[#34d399]/10 text-[#34d399] px-2 py-0.5 rounded-md">{"\u2713"} {p}</span>
                    ))}
                  </div>
                )}
                <p className="text-[13px] text-[#cbc5d9] leading-relaxed">{r.content}</p>
                <p className="text-[11px] text-[#8b839e] mt-1">
                  {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  {r.mediaUrls && r.mediaUrls.length > 0 && <span className="ml-2">{"\u{1F4F8}"} {r.mediaUrls.length} photo{r.mediaUrls.length > 1 ? "s" : ""}</span>}
                </p>

                {/* Brand response section */}
                {r.brandResponse ? (
                  <div className="mt-2 ml-4 pl-3 border-l-2 border-[#e04c8a]/50">
                    <div className="bg-[#e04c8a]/5 rounded-lg p-2.5">
                      <span className="text-[10px] font-semibold bg-[#e04c8a]/12 text-[#e04c8a] px-1.5 py-0.5 rounded-full">
                        Responded
                      </span>
                      <p className="text-[12px] text-[#cbc5d9] leading-relaxed mt-1.5 whitespace-pre-wrap">
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
                      className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2.5 text-[13px] text-[#cbc5d9] outline-none focus:border-[#f472b6] transition resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => r.productId && handleBrandRespond(r.id, r.productId, responseText)}
                        disabled={isSubmittingResponse || !responseText.trim()}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#e04c8a] hover:bg-[#d84315] disabled:bg-[#2a2535] disabled:text-[#8b839e] text-white transition"
                      >
                        {isSubmittingResponse ? "Submitting..." : "Submit Response"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRespondingTo(null); setResponseText(""); }}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-[#8b839e] hover:text-[#e8e4f0] hover:bg-[#231e2e] transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setRespondingTo(r.id); setResponseText(""); }}
                    className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#e04c8a]/12 text-[#f472b6] hover:bg-[#e04c8a]/20 transition"
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
  );
}

"use client";

import { useState } from "react";
import { collection, addDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function AnchorSeeding() {
  const [trustedReviewers, setTrustedReviewers] = useState<{ id: string; displayName?: string; email?: string; trustScore?: number }[]>([]);
  const [isLoadingReviewers, setIsLoadingReviewers] = useState(false);
  const [anchorProductId, setAnchorProductId] = useState("");
  const [anchorPayout, setAnchorPayout] = useState("50");
  const [anchorExistingCount, setAnchorExistingCount] = useState(0);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [seedingMessage, setSeedingMessage] = useState("");
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; category: string; slug?: string; communitySlug?: string }[]>([]);

  const MIN_USAGE_DAYS: Record<string, number> = {
    Tech: 14, Home: 21, SaaS: 14, Automotive: 30, Beauty: 14,
    Gaming: 14, Fitness: 21, Travel: 7, Finance: 14,
  };

  async function loadProductsForSeeding() {
    try {
      const snap = await getDocs(collection(db, "products"));
      setAllProducts(snap.docs.map((d) => ({ id: d.id, name: d.data().name, category: d.data().category, slug: d.data().slug, communitySlug: d.data().communitySlug })));
    } catch {}
  }

  async function checkAnchorCount(productId: string) {
    try {
      const snap = await getDocs(query(collection(db, "seedingInvites"), where("productId", "==", productId)));
      const active = snap.docs.filter((d) => !["declined", "expired"].includes(d.data().status));
      setAnchorExistingCount(active.length);
    } catch { setAnchorExistingCount(0); }
  }

  async function loadTrustedReviewers() {
    setIsLoadingReviewers(true);
    setSeedingMessage("");
    try {
      const q = query(
        collection(db, "users"),
        where("trustScore", ">", 250),
        orderBy("trustScore", "desc"),
        limit(50),
      );
      const snap = await getDocs(q);
      setTrustedReviewers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any)));
    } catch {
      setSeedingMessage("❌ Could not load reviewers — ensure a Firestore index exists on trustScore.");
    } finally {
      setIsLoadingReviewers(false);
    }
  }

  async function handleInviteReviewer(reviewer: { id: string; displayName?: string }) {
    if (!anchorProductId) { setSeedingMessage("❌ Select a product first."); return; }
    if (anchorExistingCount >= 5) { setSeedingMessage("❌ Max 5 anchor reviews per product."); return; }

    const product = allProducts.find((p) => p.id === anchorProductId);
    if (!product) { setSeedingMessage("❌ Product not found."); return; }

    const minDays = MIN_USAGE_DAYS[product.category] ?? 14;

    setInvitingUserId(reviewer.id);
    setSeedingMessage("");
    try {
      await addDoc(collection(db, "seedingInvites"), {
        userId: reviewer.id,
        userName: reviewer.displayName || "Unknown",
        productId: product.id,
        productName: product.name,
        productSlug: product.slug || null,
        communitySlug: product.communitySlug || null,
        category: product.category,
        minUsageDays: minDays,
        anchorPayoutAmount: Number(anchorPayout),
        status: "invited",
        invitedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, "notifications"), {
        userId: reviewer.id,
        type: "seeding_invite",
        title: `Anchor review invite: ${product.name}`,
        body: `Review Jam has selected you to write an anchor review for ${product.name}. You'll receive $${anchorPayout} for a quality review after ${minDays} days of usage. Check your profile to accept.`,
        link: "/profile",
        read: false,
        createdAt: new Date().toISOString(),
      });
      setAnchorExistingCount((c) => c + 1);
      setSeedingMessage(`✅ Anchor invite sent to ${reviewer.displayName || reviewer.id} for ${product.name} ($${anchorPayout}, ${minDays}-day min usage).`);
    } catch {
      setSeedingMessage("❌ Failed to send invite.");
    } finally {
      setInvitingUserId(null);
    }
  }

  return (
    <div className="mt-8 bg-[#1c1826] p-8 rounded-3xl border border-[#2a2535] shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-[#e8e4f0]">🎯 Anchor Reviews</h2>
        <span className="text-xs px-3 py-1 rounded-full bg-[#e04c8a]/20 text-[#e04c8a] border border-[#e04c8a]/30 font-semibold">
          Max 5 per product
        </span>
      </div>
      <p className="text-[#8b839e] text-sm mb-6">
        Select a product, then invite top reviewers (trust &gt; 250) to write anchor reviews. Review Jam pays reviewers directly. Reviewers must use the product for the minimum period before submitting.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: Product selection + config */}
        <div>
          <h3 className="text-base font-bold text-[#cbc5d9] mb-4">Select product</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={anchorProductId}
                onChange={(e) => { setAnchorProductId(e.target.value); if (e.target.value) checkAnchorCount(e.target.value); }}
                className="flex-1 bg-[#1c1826] border border-[#2a2535] rounded-xl p-3 text-[#e8e4f0] outline-none focus:border-[#f472b6] transition text-sm"
              >
                <option value="">Select a product</option>
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
              <button type="button" onClick={loadProductsForSeeding} className="bg-[#1c1826] hover:bg-[rgba(251,191,36,0.12)] text-[#cbc5d9] font-semibold px-3 py-1.5 rounded-xl transition text-xs shrink-0">
                Refresh
              </button>
            </div>

            {anchorProductId && (
              <div className="bg-[#1c1826] rounded-xl p-3 border border-[#2a2535] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8b839e]">Anchors used</span>
                  <span className={`text-xs font-bold ${anchorExistingCount >= 5 ? "text-[#fca5a5]" : "text-[#6ee7b7]"}`}>
                    {anchorExistingCount} / 5
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8b839e]">Min usage period</span>
                  <span className="text-xs font-semibold text-[#e8e4f0]">
                    {MIN_USAGE_DAYS[allProducts.find((p) => p.id === anchorProductId)?.category ?? "Tech"] ?? 14} days
                  </span>
                </div>
                <div>
                  <label className="text-xs text-[#8b839e]">Payout per review ($)</label>
                  <input
                    type="number" min="10" value={anchorPayout} onChange={(e) => setAnchorPayout(e.target.value)}
                    className="w-full mt-1 bg-[#1c1826] border border-[#2a2535] rounded-lg p-2 text-[#e8e4f0] outline-none text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Trusted reviewers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#cbc5d9]">Trusted reviewers</h3>
            <button
              type="button"
              onClick={loadTrustedReviewers}
              disabled={isLoadingReviewers}
              className="text-xs bg-[#1c1826] hover:bg-[rgba(251,191,36,0.12)] text-[#cbc5d9] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {isLoadingReviewers ? "Loading…" : "Load (trust > 250)"}
            </button>
          </div>

          {trustedReviewers.length === 0 && !isLoadingReviewers && (
            <p className="text-sm text-[#8b839e] text-center py-8">
              Click &quot;Load&quot; to fetch reviewers with trust score &gt; 250.
            </p>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {trustedReviewers.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-[#1c1826] border border-[#2a2535] rounded-xl p-3">
                <div>
                  <p className="text-sm font-semibold text-[#e8e4f0]">{r.displayName || r.id}</p>
                  <p className="text-[11px] text-[#8b839e]">{r.email} · ⭐ {r.trustScore} trust</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInviteReviewer(r)}
                  disabled={invitingUserId === r.id || anchorExistingCount >= 5 || !anchorProductId}
                  className="text-xs bg-[#e04c8a] hover:bg-[#d84315] text-white font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0 ml-3"
                >
                  {invitingUserId === r.id ? "Sending…" : "Invite"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {seedingMessage && (
        <div className={`mt-5 p-3 rounded-xl border text-sm font-bold font-mono ${seedingMessage.includes("❌") ? "bg-[#f87171]/10 border-[#f87171]/50 text-[#f87171]" : "bg-[#34d399]/10 border-[#34d399]/50 text-[#34d399]"}`}>
          {seedingMessage}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection, getDocs, query, where,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";
import { db, auth, googleProvider } from "../../../lib/firebase";

type Campaign = {
  id: string;
  name: string;
  brandName: string;
  brandEmail?: string;
  category: string;
  campaignId: string;
  endDate: string;
  budget?: number;
  createdAt: string;
};

type Review = {
  id: string;
  reviewerName: string;
  rating: number;
  content: string;
  summary?: string;
  marketingQuote?: string;
  likesCount: number;
  helpfulCount?: number;
  pros?: string[];
  cons?: string[];
  campaignId: string;
  productName: string;
  createdAt: string;
  mediaUrls?: string[];
};

export default function BrandDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u?.email) {
        await loadBrandData(u.email);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

    // Fetch all reviews for these campaigns
    const campaignIds = fetchedCampaigns.map((c) => c.campaignId);
    const reviews: Review[] = [];

    for (const cid of campaignIds) {
      const rq = query(collection(db, "reviews"), where("campaignId", "==", cid));
      const rsnap = await getDocs(rq);
      rsnap.forEach((d) => reviews.push({ id: d.id, ...d.data() } as Review));
    }

    reviews.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    setAllReviews(reviews);
  }

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch {}
  };

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm animate-pulse">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-white">Brand Dashboard</h2>
        <p className="text-slate-400 text-sm max-w-xs text-center">
          Sign in with the email used when setting up your campaign to access your brand analytics.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          className="bg-white text-slate-950 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-100 transition"
        >
          Sign in with Google
        </button>
        <Link href="/brands" className="text-sm text-slate-500 hover:text-slate-300">Don&apos;t have a campaign yet? →</Link>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-white">No campaigns found</h2>
        <p className="text-slate-400 text-sm max-w-sm text-center">
          We couldn&apos;t find any campaigns associated with <strong className="text-white">{user.email}</strong>.
          Make sure your campaign was created with this email, or contact us to get set up.
        </p>
        <div className="flex gap-3">
          <Link href="/brands" className="text-sm font-medium bg-white text-slate-950 px-4 py-2 rounded-lg hover:bg-slate-100 transition">
            Request a campaign
          </Link>
          <button type="button" onClick={() => { auth.signOut(); }} className="text-sm text-slate-400 hover:text-white transition">
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Brand Dashboard</p>
            <h1 className="text-lg font-semibold text-white">{campaigns[0]?.brandName}</h1>
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
              className="text-xs text-slate-400 hover:text-white transition"
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
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Reviews",     value: filteredReviews.length },
            { label: "Avg rating",  value: avgRating ? `★ ${avgRating}` : "—" },
            { label: "Total likes", value: totalLikes },
            { label: "Quotes ready", value: filteredReviews.filter(r => r.summary || r.marketingQuote).length },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Top marketing quotes */}
        {filteredReviews.filter(r => r.summary || r.marketingQuote).length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Top marketing quotes
            </h3>
            <div className="space-y-2">
              {filteredReviews
                .filter((r) => r.summary || r.marketingQuote)
                .slice(0, 6)
                .map((r) => (
                  <div key={r.id} className="flex items-start gap-2">
                    <span className="text-amber-400 text-sm shrink-0">★ {r.rating}</span>
                    <div>
                      <p className="text-[14px] text-white leading-snug">"{r.summary || r.marketingQuote}"</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">— {r.reviewerName} · {r.likesCount} likes</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Reviews list */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white">All reviews ({filteredReviews.length})</h3>
          </div>
          <div className="divide-y divide-slate-700/60 max-h-[600px] overflow-y-auto">
            {filteredReviews.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">No reviews yet for this campaign.</p>
            ) : (
              filteredReviews.map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-medium text-slate-300 shrink-0">
                        {r.reviewerName?.charAt(0) || "A"}
                      </span>
                      <p className="text-sm font-medium text-white">{r.reviewerName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[12px] text-slate-400">
                      <span className="text-amber-400">★ {r.rating}</span>
                      <span>👍 {r.likesCount}</span>
                    </div>
                  </div>
                  {(r.summary || r.marketingQuote) && (
                    <p className="text-[13px] text-indigo-300 font-medium mb-1">"{r.summary || r.marketingQuote}"</p>
                  )}
                  {r.pros && r.pros.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-1">
                      {r.pros.map((p, i) => (
                        <span key={i} className="text-[11px] bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-md">✓ {p}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-[13px] text-slate-300 leading-relaxed">{r.content}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {r.mediaUrls && r.mediaUrls.length > 0 && <span className="ml-2">📸 {r.mediaUrls.length} photo{r.mediaUrls.length > 1 ? "s" : ""}</span>}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

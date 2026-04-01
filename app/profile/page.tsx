"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  doc, getDoc, updateDoc,
  collection, query, where, getDocs, orderBy, limit,
} from "firebase/firestore";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import VersionUpdateWizard from "../components/VersionUpdateWizard";
import { ALL_BADGES, getBadgeById } from "../../lib/badges";

const AVAILABLE_CATEGORIES = [
  "Tech", "Home", "SaaS", "Automotive", "Beauty",
  "Gaming", "Fitness", "Travel", "Finance",
];

type LedgerEntry = {
  id: string;
  campaignId: string;
  productName: string;
  amount: number;
  rawLikes: number;
  hasPhoto: boolean;
  status: string;
  paidAt: string;
};

type ReviewSummary = {
  id: string;
  productName: string;
  category?: string;
  rating: number;
  likesCount: number;
  summary?: string;
  marketingQuote?: string;
  createdAt: string;
  campaignId: string;
  versionCount?: number;
  latestVersionLabel?: string;
  healthScore?: number;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewSummary[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "earnings" | "interests">("overview");
  const [updatingReview, setUpdatingReview] = useState<ReviewSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await Promise.all([
          fetchUserData(currentUser),
          fetchLedger(currentUser.uid),
          fetchMyReviews(currentUser.uid),
        ]);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function fetchUserData(currentUser: User) {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      setWalletBalance(data.walletBalance || 0);
      setTotalEarned(data.totalEarned || data.walletBalance || 0);
      setInterests(data.interests || []);
      setBadges(data.badges || []);
    }
  }

  async function fetchLedger(uid: string) {
    try {
      const q = query(
        collection(db, "payoutLedger"),
        where("userId", "==", uid),
        orderBy("paidAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      setLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry)));
    } catch {
      // Index may not exist yet; silently skip
    }
  }

  async function fetchMyReviews(uid: string) {
    try {
      const q = query(
        collection(db, "reviews"),
        where("reviewerId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      setMyReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewSummary)));
    } catch {
      // Index may not exist yet; silently skip
    }
  }

  const handleSaveInterests = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { interests });
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch {
      setSaveMessage("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-8 gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Sign in to view your profile</h2>
        <Link href="/" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">← Home</Link>
      </div>
    );
  }

  const avgRating = myReviews.length
    ? (myReviews.reduce((s, r) => s + (r.rating || 0), 0) / myReviews.length).toFixed(1)
    : null;

  const TABS = [
    { id: "overview",  label: "Overview" },
    { id: "reviews",   label: `Reviews (${myReviews.length})` },
    { id: "earnings",  label: `Earnings (${ledger.length})` },
    { id: "interests", label: "Interests" },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Nav */}
      <nav className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3 flex justify-between items-center">
        <Link href="/" className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">← Home</Link>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900"
        >
          Sign out
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Identity card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full flex items-center justify-center text-lg font-medium shrink-0">
            {user.displayName?.charAt(0) || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{user.displayName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-500 truncate">{user.email}</p>
            {badges.length > 0 && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {badges.map((bid) => {
                  const b = getBadgeById(bid);
                  return b ? (
                    <span key={bid} title={b.description} className="inline-flex items-center gap-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">
                      {b.emoji} {b.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Reviews", value: myReviews.length },
            { label: "Avg rating", value: avgRating ? `★ ${avgRating}` : "—" },
            { label: "Total earned", value: `$${totalEarned.toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center">
              <p className="text-xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{s.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Wallet */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-0.5">Available balance</p>
            <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">${walletBalance.toFixed(2)}</p>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-600 max-w-[140px] text-right leading-relaxed">
            Credited when campaigns close
          </span>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ── Overview ── */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Badges</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_BADGES.map((b) => {
                    const earned = badges.includes(b.id);
                    return (
                      <div
                        key={b.id}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          earned
                            ? "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                            : "opacity-35 border-slate-100 dark:border-slate-800/50"
                        }`}
                      >
                        <span className="text-xl block mb-1">{b.emoji}</span>
                        <p className="text-[12px] font-medium text-slate-800 dark:text-slate-200 leading-tight">{b.label}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-500 leading-snug mt-0.5">{b.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── My Reviews ── */}
            {activeTab === "reviews" && (
              <div className="space-y-3">
                {myReviews.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-500">No reviews yet.</p>
                ) : (
                  myReviews.map((r) => (
                    <div key={r.id} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.productName}</p>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 shrink-0">★ {r.rating}</span>
                      </div>
                      {(r.summary || r.marketingQuote) && (
                        <p className="text-[13px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                          "{r.summary || r.marketingQuote}"
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 dark:text-slate-500 flex-wrap">
                        <span>👍 {r.likesCount || 0}</span>
                        {r.healthScore != null && (
                          <span className={`font-medium ${r.healthScore >= 70 ? "text-emerald-600 dark:text-emerald-400" : r.healthScore >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                            Score: {r.healthScore}
                          </span>
                        )}
                        <span>{new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        {r.campaignId !== "organic" && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Campaign</span>
                        )}
                        {(r.versionCount ?? 0) > 1 && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{r.versionCount} updates</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setUpdatingReview(r)}
                          className="ml-auto text-[11px] font-medium text-slate-600 dark:text-slate-300 px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                          Post Update
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Version Update Wizard */}
            {updatingReview && (
              <VersionUpdateWizard
                reviewId={updatingReview.id}
                existingVersionCount={updatingReview.versionCount ?? 1}
                productName={updatingReview.productName}
                category={updatingReview.category ?? "Tech"}
                onClose={() => setUpdatingReview(null)}
                onSaved={() => {
                  setMyReviews((prev) => prev.map((r) =>
                    r.id === updatingReview.id
                      ? { ...r, versionCount: (r.versionCount ?? 1) + 1 }
                      : r
                  ));
                }}
              />
            )}

            {/* ── Earnings Ledger ── */}
            {activeTab === "earnings" && (
              <div className="space-y-3">
                {ledger.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-500">No payouts yet. Earn by getting likes on your campaign reviews.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="text-left text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                            <th className="pb-2 pr-4 font-medium">Product</th>
                            <th className="pb-2 pr-4 font-medium">Likes</th>
                            <th className="pb-2 pr-4 font-medium">Photo</th>
                            <th className="pb-2 pr-4 font-medium">Earned</th>
                            <th className="pb-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {ledger.map((e) => (
                            <tr key={e.id}>
                              <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-200 max-w-[140px] truncate">{e.productName || e.campaignId}</td>
                              <td className="py-2 pr-4 text-slate-600 dark:text-slate-400 tabular-nums">{e.rawLikes}</td>
                              <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">{e.hasPhoto ? "1.5×" : "—"}</td>
                              <td className="py-2 pr-4 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">${e.amount.toFixed(2)}</td>
                              <td className="py-2 text-slate-500 dark:text-slate-500 tabular-nums whitespace-nowrap">
                                {new Date(e.paidAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">
                      Photo reviews earn 1.5× their likes weight in payout calculations.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ── Interests ── */}
            {activeTab === "interests" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-500">Used to personalize your default feed.</p>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setInterests((prev) =>
                          prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                        )
                      }
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        interests.includes(cat)
                          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                          : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveInterests}
                    disabled={isSaving}
                    className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                  {saveMessage && (
                    <span className="text-sm text-emerald-600 dark:text-emerald-500">{saveMessage}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

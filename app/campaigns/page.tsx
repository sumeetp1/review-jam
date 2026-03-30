"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection, getDocs, addDoc, query, where,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";
import { db, auth, googleProvider } from "../../lib/firebase";

type Campaign = {
  id: string;
  name: string;
  brandName: string;
  category: string;
  campaignId: string;
  endDate: string;
  description?: string;
  budget?: number;
  createdAt: string;
};

type Application = {
  id: string;
  productId: string;
  status: "applied" | "approved" | "rejected" | "product_sent" | "reviewed";
};

const STATUS_CONFIG: Record<Application["status"], { label: string; color: string }> = {
  applied:      { label: "Applied",        color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40" },
  approved:     { label: "Approved",       color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" },
  rejected:     { label: "Not selected",   color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30" },
  product_sent: { label: "Product sent",   color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" },
  reviewed:     { label: "Reviewed",       color: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Apply modal state
  const [applyTarget, setApplyTarget] = useState<Campaign | null>(null);
  const [applyNote, setApplyNote] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("All");
  const CATEGORIES = ["All", "Tech", "Home", "SaaS", "Automotive", "Beauty", "Gaming", "Fitness", "Travel", "Finance"];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      await fetchCampaigns();
      if (u) await fetchApplications(u.uid);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function fetchCampaigns() {
    const snap = await getDocs(collection(db, "products"));
    const now = new Date();
    const list: Campaign[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (!data.endDate || new Date(data.endDate) > now) {
        list.push({ id: d.id, ...data } as Campaign);
      }
    });
    list.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    setCampaigns(list);
  }

  async function fetchApplications(uid: string) {
    const q = query(collection(db, "campaignApplications"), where("userId", "==", uid));
    const snap = await getDocs(q);
    setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Application)));
  }

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch {}
  };

  const getApplicationStatus = (productId: string): Application["status"] | null => {
    const app = applications.find((a) => a.productId === productId);
    return app?.status ?? null;
  };

  const handleApply = async () => {
    if (!user || !applyTarget) return;
    setIsApplying(true);
    try {
      const doc = await addDoc(collection(db, "campaignApplications"), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        productId: applyTarget.id,
        campaignId: applyTarget.campaignId,
        productName: applyTarget.name,
        brandName: applyTarget.brandName,
        notes: applyNote.trim(),
        status: "applied",
        appliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setApplications((prev) => [...prev, { id: doc.id, productId: applyTarget.id, status: "applied" }]);
      setApplyTarget(null);
      setApplyNote("");
    } finally {
      setIsApplying(false);
    }
  };

  const getTimeRemaining = (endDateStr: string) => {
    const total = Date.parse(endDateStr) - Date.now();
    if (total <= 0) return "Ended";
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    if (days > 0) return `${days}d left`;
    return `${hours}h left`;
  };

  const displayed = campaigns.filter(
    (c) => categoryFilter === "All" || c.category === categoryFilter
  );

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Apply Modal */}
      {applyTarget && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-lg border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
              Apply to review
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {applyTarget.name} — {applyTarget.brandName}
            </p>

            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                Why do you want to review this product?{" "}
                <span className="font-normal">(optional)</span>
              </label>
              <textarea
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder="Tell the brand why you're a great fit…"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              If selected, the brand will ship you the product. You'll then post an honest review through this platform and earn based on engagement.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setApplyTarget(null); setApplyNote(""); }}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying}
                className="flex-[1.4] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {isApplying ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:underline">← Home</Link>
            {user ? (
              <Link href="/profile" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">My applications</Link>
            ) : (
              <button type="button" onClick={handleLogin} className="text-sm font-medium text-slate-900 dark:text-slate-100 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-900">
                Sign in
              </button>
            )}
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Review campaigns</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5">
            Apply to receive products and earn based on how helpful your review is.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { step: "1", text: "Apply to a campaign" },
            { step: "2", text: "Brand ships you the product" },
            { step: "3", text: "Post your honest review" },
            { step: "4", text: "Earn based on engagement" },
          ].map((s) => (
            <div key={s.step} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center shrink-0">{s.step}</span>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-tight">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5">
        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 [&::-webkit-scrollbar]:hidden">
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

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Loading campaigns…</div>
        ) : displayed.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">No active campaigns in this category.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayed.map((c) => {
              const status = getApplicationStatus(c.id);
              const timeLeft = getTimeRemaining(c.endDate);
              return (
                <div key={c.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{c.name}</h3>
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded shrink-0">Live</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-500">{c.brandName}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">{c.category}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-500">{timeLeft}</span>
                  </div>

                  {c.description && (
                    <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{c.description}</p>
                  )}

                  <div className="mt-auto">
                    {status ? (
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium ${STATUS_CONFIG[status].color}`}>
                        {STATUS_CONFIG[status].label}
                      </div>
                    ) : !user ? (
                      <button
                        type="button"
                        onClick={handleLogin}
                        className="w-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        Sign in to apply
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setApplyTarget(c)}
                        className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
                      >
                        Apply to review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

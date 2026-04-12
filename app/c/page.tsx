"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import CreateChannelModal from "../components/CreateChannelModal";

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  memberCount: number;
  reviewCount: number;
  creatorName: string;
  coverImage?: string;
};

// Default banner images per category (Unsplash, small & optimized)
const CATEGORY_BANNERS: Record<string, string> = {
  Tech:       "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=200&fit=crop&q=75",
  Gaming:     "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=600&h=200&fit=crop&q=75",
  Beauty:     "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=200&fit=crop&q=75",
  Home:       "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=200&fit=crop&q=75",
  Fitness:    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=200&fit=crop&q=75",
  Automotive: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&h=200&fit=crop&q=75",
  Finance:    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=200&fit=crop&q=75",
  Travel:     "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=200&fit=crop&q=75",
  SaaS:       "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=200&fit=crop&q=75",
};

function getBannerImage(c: Community): string | null {
  return c.coverImage || CATEGORY_BANNERS[c.category] || null;
}

export default function CommunitiesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "channels"), orderBy("memberCount", "desc")));
        setCommunities(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Community)));
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const filtered = communities.filter((c) => {
    if (filterCategory !== "All" && c.category !== filterCategory) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.slug.toLowerCase().includes(s) || c.description.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0 md:hidden">
            <Image src="/logo.svg" alt="Review Jam" width={110} height={26} className="dark:hidden" />
            <Image src="/logo-dark.svg" alt="Review Jam" width={110} height={26} className="hidden dark:block" />
          </Link>
          <h1 className="text-base font-bold text-slate-900 dark:text-zinc-100 hidden sm:block">Communities</h1>
          {user ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-3.5 py-2 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 rounded-lg text-sm font-medium hover:bg-indigo-500/30 transition shrink-0"
            >
              + Create
            </button>
          ) : <div className="w-[76px]" />}
        </div>

        {/* Search + filter */}
        <div className="max-w-5xl mx-auto px-4 md:px-8 pb-3 flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-zinc-500 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities..."
              className="w-full pl-9 pr-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 transition"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition"
          >
            <option value="All">All categories</option>
            {[...new Set(communities.map((c) => c.category).filter(Boolean))].sort().map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Community grid (desktop) / list (mobile) */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
        {loading ? (
          <p className="text-center text-sm text-slate-500 dark:text-zinc-500 py-12 animate-pulse">Loading communities...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] rounded-full flex items-center justify-center text-xl mx-auto mb-3">🔍</div>
            <p className="text-slate-500 dark:text-zinc-400 text-sm mb-3">No communities found</p>
            {user && (
              <button type="button" onClick={() => setShowCreate(true)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                Create the first one
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: card grid */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => (
                <Link
                  key={c.id}
                  href={`/c/${c.slug}`}
                  className="group glass-card overflow-hidden hover:border-indigo-500/20 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-black/20 transition-all"
                >
                  {/* Banner image */}
                  <div className="h-20 bg-gradient-to-r from-indigo-500 to-violet-500 relative overflow-hidden">
                    {getBannerImage(c) && (
                      <img
                        src={getBannerImage(c)!}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute -bottom-5 left-4 w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-xl shadow-sm">
                      {c.iconEmoji}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-4 pt-7 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">rj/{c.slug}</h3>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-white/[0.04] px-1.5 py-0.5 rounded font-medium border border-slate-200 dark:border-white/[0.06]">{c.category}</span>
                    </div>
                    <p className="text-[12px] text-slate-500 dark:text-zinc-400 line-clamp-2 mb-3 leading-relaxed">{c.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-500">
                        <span className="tabular-nums">{c.memberCount.toLocaleString()} members</span>
                        <span className="tabular-nums">{c.reviewCount.toLocaleString()} reviews</span>
                      </div>
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Visit →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Mobile: compact list */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
              {filtered.map((c) => (
                <Link
                  key={c.id}
                  href={`/c/${c.slug}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors -mx-2 px-2 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] flex items-center justify-center text-base shrink-0">
                    {c.iconEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-900 dark:text-zinc-100 leading-tight">rj/{c.slug}</p>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 bg-slate-50 dark:bg-white/[0.04] px-1.5 py-0.5 rounded font-medium border border-slate-200 dark:border-white/[0.06]">{c.category}</span>
                    </div>
                    <p className="text-[12px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">{c.description}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500 dark:text-zinc-500 tabular-nums">{c.memberCount.toLocaleString()} members</span>
                  <svg className="w-4 h-4 text-slate-400 dark:text-zinc-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {showCreate && user && (
        <CreateChannelModal
          userId={user.uid}
          userName={user.displayName || "Anonymous"}
          onClose={() => setShowCreate(false)}
          onCreated={(slug) => {
            window.location.href = `/c/${slug}`;
          }}
        />
      )}
    </div>
  );
}

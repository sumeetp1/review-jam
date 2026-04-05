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
};

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
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <Image src="/logo.svg" alt="Review Jam" width={110} height={26} className="dark:hidden" />
            <Image src="/logo-dark.svg" alt="Review Jam" width={110} height={26} className="hidden dark:block" />
          </Link>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 hidden sm:block">Communities</h1>
          {user ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-3.5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:opacity-90 transition shrink-0"
            >
              + Create
            </button>
          ) : <div className="w-[76px]" />}
        </div>

        {/* Search + filter */}
        <div className="max-w-6xl mx-auto px-4 md:px-8 pb-3 flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities..."
              className="w-full pl-9 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 dark:focus:border-indigo-600 dark:text-slate-100 dark:placeholder-slate-500 transition"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm outline-none dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 dark:focus:border-indigo-600 transition"
          >
            <option value="All">All categories</option>
            {[...new Set(communities.map((c) => c.category).filter(Boolean))].sort().map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Community list */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
        {loading ? (
          <p className="text-center text-sm text-slate-400 py-12 animate-pulse">Loading communities...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-xl mx-auto mb-3">🔍</div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">No communities found</p>
            {user && (
              <button type="button" onClick={() => setShowCreate(true)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                Create the first one
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors -mx-2 px-2 rounded-lg"
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base shrink-0">
                  {c.iconEmoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-tight">rj/{c.slug}</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-medium">{c.category}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{c.description}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                  <span className="tabular-nums">{c.memberCount.toLocaleString()} members</span>
                  <span className="hidden sm:inline tabular-nums">{c.reviewCount.toLocaleString()} reviews</span>
                </div>

                {/* Chevron */}
                <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
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

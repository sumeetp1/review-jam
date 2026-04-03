"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import BottomNav from "../components/BottomNav";
import CreateChannelModal from "../components/CreateChannelModal";
import { AVAILABLE_CATEGORIES } from "../components/ReviewWizard";

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

  const grouped = new Map<string, Community[]>();
  for (const c of filtered) {
    const list = grouped.get(c.category) ?? [];
    list.push(c);
    grouped.set(c.category, list);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <Image src="/logo.svg" alt="Review Jam" width={110} height={26} className="dark:hidden" />
            <Image src="/logo-dark.svg" alt="Review Jam" width={110} height={26} className="hidden dark:block" />
          </Link>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Communities</h1>
          {user ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:opacity-90 transition shrink-0"
            >
              + Create
            </button>
          ) : <div className="w-[76px]" />}
        </div>

        {/* Search + filter */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search communities…"
            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-slate-100"
          >
            <option value="All">All</option>
            {AVAILABLE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-slate-400 py-12">Loading communities...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-2">No communities found</p>
            {user && (
              <button type="button" onClick={() => setShowCreate(true)} className="text-sm text-slate-600 dark:text-slate-300 underline">
                Create the first one
              </button>
            )}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([category, coms]) => (
            <div key={category} className="mb-6">
              <h2 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {coms.map((c) => (
                  <Link
                    key={c.id}
                    href={`/c/${c.slug}`}
                    className="block p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none">{c.iconEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-900 dark:text-slate-100">rj/{c.slug}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{c.memberCount} members</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{c.reviewCount} reviews</span>
                        </div>
                        <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{c.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
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

      <BottomNav />
    </div>
  );
}

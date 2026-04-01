"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  collection, query, where, getDocs, orderBy, limit,
  doc, addDoc, deleteDoc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { User } from "firebase/auth";
import type { ReviewData } from "./ReviewCard";
import CreateChannelModal from "./CreateChannelModal";

// ─── Types ─────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  name: string;
  brandName: string;
  campaignId: string;
  endDate: string;
  budget?: number;
};

type Channel = {
  id: string;
  slug: string;
  name: string;
  iconEmoji: string;
  memberCount: number;
  category: string;
};

type Props = {
  user: User | null;
  products: Product[];
  trendingInsights: ReviewData[];
  allReviews: ReviewData[];
  onLogin: () => void;
  onLogout: () => void;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function getTimeRemaining(endDate: string): { label: string; urgency: "hot" | "warm" | "cool" } {
  const ms = new Date(endDate).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return { label: "Ended", urgency: "cool" };
  if (days === 1) return { label: "Last day!", urgency: "hot" };
  if (days <= 3) return { label: `${days}d left`, urgency: "hot" };
  if (days <= 7) return { label: `${days}d left`, urgency: "warm" };
  return { label: `${days}d left`, urgency: "cool" };
}

// ─── Section Shell ─────────────────────────────────────────────────────────

function Section({ title, icon, action, children }: {
  title: string;
  icon?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <h2 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          {icon && <span>{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ─── User Card ─────────────────────────────────────────────────────────────

function UserCard({ user, onLogin, onLogout }: { user: User | null; onLogin: () => void; onLogout: () => void }) {
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [badgeCount, setBadgeCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (!user) { setWalletBalance(null); setBadgeCount(0); setReviewCount(0); return; }
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "reviews"), where("reviewerId", "==", user.uid)));
        setReviewCount(snap.size);
      } catch { /* ignore */ }
      try {
        const uSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", user.uid)));
        if (!uSnap.empty) {
          const d = uSnap.docs[0].data();
          setWalletBalance(d.walletBalance ?? 0);
          setBadgeCount((d.badges ?? []).length);
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="p-4">
        <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          Sign in to track earnings, join channels, and get personalised reviews.
        </p>
        <button
          type="button"
          onClick={onLogin}
          className="btn-brand w-full text-sm font-semibold py-2 px-4 rounded-lg"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 flex items-center gap-3">
      {/* Avatar with amber ring */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
          {user.displayName?.charAt(0) ?? "?"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[13px] text-slate-900 dark:text-slate-100 truncate">{user.displayName}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {walletBalance !== null && walletBalance > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">${walletBalance.toFixed(2)}</span>
          )}
          {badgeCount > 0 && <span>{badgeCount} badge{badgeCount !== 1 ? "s" : ""}</span>}
          {reviewCount > 0 && <span>{reviewCount} review{reviewCount !== 1 ? "s" : ""}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="text-[11px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition shrink-0"
      >
        Out
      </button>
    </div>
  );
}

// ─── Channels Section ──────────────────────────────────────────────────────

function ChannelsSection({ user, onLogin }: { user: User | null; onLogin: () => void }) {
  const [joinedChannels, setJoinedChannels] = useState<Channel[]>([]);
  const [popularChannels, setPopularChannels] = useState<Channel[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Load popular channels
        const snap = await getDocs(query(collection(db, "channels"), orderBy("memberCount", "desc"), limit(8)));
        const all: Channel[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Channel));

        if (user) {
          // Find which ones the user has joined
          const memberSnap = await getDocs(query(collection(db, "channelMembers"), where("userId", "==", user.uid)));
          const joinedIds = new Set(memberSnap.docs.map((d) => d.data().channelId));
          setJoinedChannels(all.filter((c) => joinedIds.has(c.id)).slice(0, 5));
          setPopularChannels(all.filter((c) => !joinedIds.has(c.id)).slice(0, 4));
        } else {
          setPopularChannels(all.slice(0, 5));
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  const handleJoin = async (channel: Channel) => {
    if (!user) { onLogin(); return; }
    setJoining(channel.id);
    try {
      await addDoc(collection(db, "channelMembers"), {
        channelId: channel.id,
        userId: user.uid,
        joinedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "channels", channel.id), { memberCount: increment(1) });
      setJoinedChannels((prev) => [...prev, channel]);
      setPopularChannels((prev) => prev.filter((c) => c.id !== channel.id));
    } catch { /* ignore */ }
    setJoining(null);
  };

  const channelRow = (ch: Channel, joined: boolean) => (
    <Link
      key={ch.id}
      href={`/channels/${ch.slug}`}
      className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition group"
    >
      <span className="text-base leading-none w-6 text-center shrink-0">{ch.iconEmoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition truncate">
          r/{ch.slug}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">{ch.memberCount.toLocaleString()} members</p>
      </div>
      {!joined && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); handleJoin(ch); }}
          disabled={joining === ch.id}
          className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition disabled:opacity-50"
        >
          {joining === ch.id ? "…" : "+ Join"}
        </button>
      )}
    </Link>
  );

  return (
    <>
      {/* Joined channels */}
      {joinedChannels.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {joinedChannels.map((ch) => channelRow(ch, true))}
        </div>
      )}

      {/* Separator */}
      {joinedChannels.length > 0 && popularChannels.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Discover</p>
        </div>
      )}

      {/* Popular / discover */}
      {popularChannels.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {popularChannels.map((ch) => channelRow(ch, false))}
        </div>
      )}

      {/* Empty */}
      {joinedChannels.length === 0 && popularChannels.length === 0 && (
        <p className="px-3 py-3 text-[12px] text-slate-400">No channels yet.</p>
      )}

      {/* Footer row */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <Link href="/channels" className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-medium">
          Explore all channels →
        </Link>
        {user && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition font-medium"
          >
            + Create
          </button>
        )}
      </div>

      {showCreate && user && (
        <CreateChannelModal
          userId={user.uid}
          userName={user.displayName || "Anonymous"}
          onClose={() => setShowCreate(false)}
          onCreated={(slug) => { window.location.href = `/channels/${slug}`; }}
        />
      )}
    </>
  );
}

// ─── Campaigns Section ─────────────────────────────────────────────────────

function CampaignsSection({ products, getReviewCount }: { products: Product[]; getReviewCount: (campaignId: string) => number }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
      {products.length === 0 && (
        <p className="px-3 py-3 text-[12px] text-slate-400">No active campaigns.</p>
      )}
      {products.slice(0, 4).map((product) => {
        const { label, urgency } = getTimeRemaining(product.endDate);
        const totalMs = 30 * 86_400_000; // assume 30-day max
        const remainMs = Math.max(0, new Date(product.endDate).getTime() - Date.now());
        const pct = Math.min((remainMs / totalMs) * 100, 100);
        return (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="block px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition group"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[12px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition leading-snug truncate">
                {product.name}
              </p>
              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                urgency === "hot"
                  ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                  : urgency === "warm"
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}>
                {label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-500 mb-1.5">{product.brandName} · {getReviewCount(product.campaignId)} reviews</p>
            {/* Days remaining bar */}
            <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${urgency === "hot" ? "bg-red-500" : urgency === "warm" ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Leaderboard Section ───────────────────────────────────────────────────

const RANK_EMOJI = ["🥇", "🥈", "🥉"];

function LeaderboardSection({ allReviews }: { allReviews: ReviewData[] }) {
  // Deduplicate by reviewer, take highest healthScore per reviewer
  const byReviewer = new Map<string, ReviewData>();
  for (const r of allReviews) {
    if (!r.reviewerId || r.reviewerId === "seed_user") continue;
    const existing = byReviewer.get(r.reviewerId);
    if (!existing || (r.healthScore ?? 0) > (existing.healthScore ?? 0)) {
      byReviewer.set(r.reviewerId, r);
    }
  }
  const top = Array.from(byReviewer.values())
    .filter((r) => (r.healthScore ?? 0) > 0)
    .sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0))
    .slice(0, 5);

  if (top.length === 0) {
    return <p className="px-3 py-3 text-[12px] text-slate-400">No scored reviews yet.</p>;
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
      {top.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2.5 px-3 py-2">
          <span className="text-base leading-none w-6 text-center shrink-0">
            {i < 3 ? RANK_EMOJI[i] : <span className="text-[11px] font-bold text-slate-400">{i + 1}.</span>}
          </span>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
            {r.reviewerName?.charAt(0) ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-slate-800 dark:text-slate-200 truncate">{r.reviewerName ?? "Anonymous"}</p>
            {r.category && <p className="text-[10px] text-slate-400 dark:text-slate-500">{r.category}</p>}
          </div>
          <span className={`text-[11px] font-bold tabular-nums shrink-0 ${
            (r.healthScore ?? 0) >= 70 ? "text-emerald-600 dark:text-emerald-400"
            : (r.healthScore ?? 0) >= 40 ? "text-amber-600 dark:text-amber-400"
            : "text-slate-500"
          }`}>
            {r.healthScore}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Trending Quotes Section ───────────────────────────────────────────────

function TrendingSection({ insights }: { insights: ReviewData[] }) {
  if (insights.length === 0) {
    return <p className="px-3 py-3 text-[12px] text-slate-400">Nothing trending yet.</p>;
  }
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
      {insights.slice(0, 4).map((r) => (
        <div key={r.id} className="px-3 py-2.5 flex gap-2.5">
          <div className="w-0.5 bg-gradient-to-b from-amber-400 to-orange-400 rounded-full shrink-0 self-stretch" />
          <div className="min-w-0">
            <p className="text-[12px] text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 italic mb-1">
              "{r.summary || r.marketingQuote}"
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              <span className="font-medium text-slate-500 dark:text-slate-400">{r.reviewerName}</span>
              {r.productName ? ` on ${r.productName}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────

export default function RightSidebar({ user, products, trendingInsights, allReviews, onLogin, onLogout }: Props) {
  const getReviewCount = (campaignId: string) => allReviews.filter((r) => r.campaignId === campaignId).length;

  return (
    <aside className="hidden lg:flex flex-col w-[280px] xl:w-[300px] pl-5 xl:pl-6 py-5 sticky top-0 h-screen overflow-y-auto text-[13px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

      {/* ── User Card ── */}
      <Section title="Account" icon="👤">
        <UserCard user={user} onLogin={onLogin} onLogout={onLogout} />
      </Section>

      {/* ── Channels ── */}
      <Section
        title="Channels"
        icon="📡"
        action={
          <Link href="/channels" className="text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:underline">
            View all
          </Link>
        }
      >
        <ChannelsSection user={user} onLogin={onLogin} />
      </Section>

      {/* ── Live Campaigns ── */}
      <Section
        title="Live Campaigns"
        icon="🔥"
        action={
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Live
          </span>
        }
      >
        <CampaignsSection products={products} getReviewCount={getReviewCount} />
      </Section>

      {/* ── Leaderboard ── */}
      <Section title="Top Reviewers" icon="🏆">
        <LeaderboardSection allReviews={allReviews} />
      </Section>

      {/* ── Trending Quotes ── */}
      <Section title="Trending" icon="💬">
        <TrendingSection insights={trendingInsights} />
      </Section>

      {/* ── Footer ── */}
      <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-600 flex flex-wrap gap-x-3 gap-y-1 px-0.5 pb-6">
        <Link href="/brands" className="hover:text-amber-600 dark:hover:text-amber-400 transition">For brands</Link>
        <Link href="/explore" className="hover:text-amber-600 dark:hover:text-amber-400 transition">Explore</Link>
        <Link href="/channels" className="hover:text-amber-600 dark:hover:text-amber-400 transition">Channels</Link>
        <Link href="/campaigns" className="hover:text-amber-600 dark:hover:text-amber-400 transition">Campaigns</Link>
        <span className="hover:text-slate-600 cursor-pointer">Terms</span>
        <span className="hover:text-slate-600 cursor-pointer">Privacy</span>
        <p className="w-full mt-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          © 2026 Review Jam
        </p>
      </div>
    </aside>
  );
}

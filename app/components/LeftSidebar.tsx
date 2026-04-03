"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  collection, query, where, getDocs, orderBy, limit,
  doc, addDoc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { User } from "firebase/auth";
import CreateChannelModal from "./CreateChannelModal";

type Product = {
  id: string;
  name: string;
  brandName: string;
};

type Channel = {
  id: string;
  slug: string;
  iconEmoji: string;
  memberCount: number;
  category: string;
};

type Props = {
  user: User | null;
  products: Product[];
  isDarkMode: boolean;
  onToggleDark: () => void;
  onPostReview: () => void;
  onQuickReview: () => void;
  onLogin: () => void;
  activeCategoryFilter: string;
  onClearFilter: () => void;
};

// ─── Section divider + label ────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">
      {label}
    </p>
  );
}

function Divider() {
  return <div className="border-t border-slate-100 dark:border-slate-800/80 mx-2 my-1" />;
}

// ─── Single nav row ─────────────────────────────────────────────────────────

function NavRow({
  href,
  icon,
  label,
  active,
  right,
  onClick,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const cls = `flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition select-none cursor-pointer ${
    active
      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 font-semibold"
      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60 font-medium"
  }`;

  const inner = (
    <>
      <span className="w-5 text-center leading-none shrink-0 text-[15px]">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {right && <span className="shrink-0">{right}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`w-full text-left ${cls}`}>
      {inner}
    </button>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function LeftSidebar({
  user, products, isDarkMode, onToggleDark,
  onPostReview, onQuickReview, onLogin,
  activeCategoryFilter, onClearFilter,
}: Props) {
  const pathname = usePathname();
  const [joinedChannels, setJoinedChannels] = useState<Channel[]>([]);
  const [popularChannels, setPopularChannels] = useState<Channel[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  // Load channels
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "channels"), orderBy("memberCount", "desc"), limit(10)));
        const all: Channel[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Channel));
        if (user) {
          const mSnap = await getDocs(query(collection(db, "channelMembers"), where("userId", "==", user.uid)));
          const joinedIds = new Set(mSnap.docs.map((d) => d.data().channelId));
          setJoinedChannels(all.filter((c) => joinedIds.has(c.id)));
          setPopularChannels(all.filter((c) => !joinedIds.has(c.id)));
        } else {
          setPopularChannels(all);
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  const handleJoin = async (e: React.MouseEvent, ch: Channel) => {
    e.preventDefault();
    if (!user) { onLogin(); return; }
    setJoining(ch.id);
    try {
      await addDoc(collection(db, "channelMembers"), { channelId: ch.id, userId: user.uid, joinedAt: new Date().toISOString() });
      await updateDoc(doc(db, "channels", ch.id), { memberCount: increment(1) });
      setJoinedChannels((p) => [...p, { ...ch, memberCount: ch.memberCount + 1 }]);
      setPopularChannels((p) => p.filter((c) => c.id !== ch.id));
    } catch { /* ignore */ }
    setJoining(null);
  };

  const visibleJoined = showAllChannels ? joinedChannels : joinedChannels.slice(0, 5);
  const visiblePopular = showAllChannels ? popularChannels : popularChannels.slice(0, user ? 3 : 5);

  return (
    <>
      <aside className="hidden md:flex flex-col w-[240px] xl:w-[256px] h-screen sticky top-0 border-r border-slate-200/80 dark:border-slate-800 overflow-y-auto pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

        {/* Logo */}
        <div className="px-3 pt-4 pb-2 shrink-0">
          <Link href="/" onClick={onClearFilter}>
            <img src="/logo.svg" alt="Review Jam" width={130} height={32} className="dark:hidden" />
            <img src="/logo-dark.svg" alt="Review Jam" width={130} height={32} className="hidden dark:block" />
          </Link>
        </div>

        {/* Write buttons */}
        <div className="px-2 pb-1 space-y-1 shrink-0">
          <button type="button" onClick={user ? onPostReview : onLogin}
            className="btn-brand w-full text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5">
            <span>✍️</span> Post a review
          </button>
          <button type="button" onClick={user ? onQuickReview : onLogin}
            className="w-full text-[12px] text-slate-500 dark:text-slate-400 py-1.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-300 hover:text-amber-600 dark:hover:border-amber-800 dark:hover:text-amber-400 transition">
            Quick review (no payout)
          </button>
        </div>

        {/* ── Navigation ─────────────────────────────── */}
        <SectionHeader label="Navigate" />
        <nav className="px-1">
          <NavRow href="/" icon="🏠" label="Home" active={pathname === "/" && activeCategoryFilter === "All"} onClick={onClearFilter} />
          <NavRow href="/explore" icon="🔍" label="Explore" active={pathname === "/explore"} />
          <NavRow href="/c" icon="📡" label="Communities" active={pathname.startsWith("/c")} />
          <NavRow href="/profile" icon="👤" label="Profile" active={pathname === "/profile"} />
          <NavRow href="/brands" icon="🏢" label="For brands" active={pathname === "/brands"} />
          <NavRow href="/admin" icon="⚡" label="Admin" active={pathname === "/admin"} />
        </nav>

        <Divider />

        {/* ── Your Channels ───────────────────────────── */}
        <SectionHeader label="Your channels" />
        <div className="px-1">
          {joinedChannels.length === 0 && !user && (
            <p className="px-2 py-1 text-[12px] text-slate-400 dark:text-slate-500">
              <button type="button" onClick={onLogin} className="text-amber-600 dark:text-amber-400 hover:underline">Sign in</button> to join channels
            </p>
          )}
          {joinedChannels.length === 0 && user && (
            <p className="px-2 py-1 text-[12px] text-slate-400 dark:text-slate-500">No channels joined yet.</p>
          )}
          {visibleJoined.map((ch) => (
            <NavRow key={ch.id} href={`/c/${ch.slug}`} icon={ch.iconEmoji} label={`rj/${ch.slug}`}
              active={pathname === `/c/${ch.slug}`}
              right={<span className="text-[10px] text-slate-400 tabular-nums">{ch.memberCount.toLocaleString()}</span>}
            />
          ))}
          {joinedChannels.length > 5 && (
            <button type="button" onClick={() => setShowAllChannels((v) => !v)}
              className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition">
              {showAllChannels ? "Show less" : `See ${joinedChannels.length - 5} more…`}
            </button>
          )}
        </div>

        <Divider />

        {/* ── Discover communities ─────────────────────── */}
        <SectionHeader label="Communities" />
        <div className="px-1">
          {visiblePopular.map((ch) => (
            <NavRow key={ch.id} href={`/c/${ch.slug}`} icon={ch.iconEmoji} label={`rj/${ch.slug}`}
              active={pathname === `/c/${ch.slug}`}
              right={
                <button type="button" onClick={(e) => handleJoin(e, ch)} disabled={joining === ch.id}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-50 transition">
                  {joining === ch.id ? "…" : "+ Join"}
                </button>
              }
            />
          ))}
          {popularChannels.length > (user ? 3 : 5) && (
            <button type="button" onClick={() => setShowAllChannels((v) => !v)}
              className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition">
              {showAllChannels ? "Show less" : `See ${popularChannels.length - (user ? 3 : 5)} more…`}
            </button>
          )}
          <div className="flex gap-2 px-2 py-1">
            <Link href="/c" className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-medium">All communities</Link>
            {user && (
              <button type="button" onClick={() => setShowCreate(true)} className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition">
                + Create
              </button>
            )}
          </div>
        </div>

        <Divider />

        {/* ── Resources ───────────────────────────────── */}
        <SectionHeader label="Resources" />
        <nav className="px-1">
          <NavRow href="/brands" icon="📈" label="Advertise on Review Jam" />
          <NavRow href="/brands/dashboard" icon="📊" label="Brand dashboard" />
          <NavRow icon={isDarkMode ? "☀️" : "🌙"} label={isDarkMode ? "Light mode" : "Dark mode"} onClick={onToggleDark} />
        </nav>

        <Divider />

        {/* ── Footer ──────────────────────────────────── */}
        <div className="px-3 pt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 dark:text-slate-600">
          <span className="cursor-pointer hover:text-slate-600">Terms</span>
          <span className="cursor-pointer hover:text-slate-600">Privacy</span>
          <Link href="/brands" className="hover:text-slate-600">Brands</Link>
          <p className="w-full mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            © 2026 Review Jam
          </p>
        </div>
      </aside>

      {showCreate && user && (
        <CreateChannelModal
          userId={user.uid}
          userName={user.displayName || "Anonymous"}
          onClose={() => setShowCreate(false)}
          onCreated={(slug) => { window.location.href = `/c/${slug}`; }}
        />
      )}
    </>
  );
}

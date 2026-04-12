"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  collection, query, where, getDocs, orderBy, limit,
  doc, addDoc, updateDoc, increment,
} from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";
import CreateChannelModal from "./CreateChannelModal";

import type { Channel } from "../../lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="border-t border-slate-200 dark:border-white/[0.06] mx-2 my-1" />;
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-600 select-none">
      {label}
    </p>
  );
}

function NavRow({
  href, icon, label, active, right, onClick, collapsed,
}: {
  href?: string; icon: React.ReactNode; label: string;
  active?: boolean; right?: React.ReactNode; onClick?: () => void;
  collapsed?: boolean;
}) {
  const cls = `flex items-center ${collapsed ? "justify-center" : "gap-2.5"} px-2 py-1.5 rounded-md text-[13px] transition select-none cursor-pointer ${
    active
      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/10 font-semibold"
      : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] font-medium"
  }`;

  const inner = (
    <>
      <span className="w-5 text-center leading-none shrink-0 text-[15px]">{icon}</span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && right && <span className="shrink-0">{right}</span>}
    </>
  );

  const el = href ? (
    <Link href={href} onClick={onClick} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={`w-full text-left ${cls}`}>{inner}</button>
  );

  if (collapsed) {
    return (
      <div className="relative group">
        {el}
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-100 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50">
          {label}
        </div>
      </div>
    );
  }

  return el;
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function GlobalSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [joinedChannels, setJoinedChannels] = useState<Channel[]>([]);
  const [popularChannels, setPopularChannels] = useState<Channel[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  // Hydration-safe: read localStorage after mount
  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setIsCollapsed(true);
  }, []);

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

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleLogin = () => signInWithPopup(auth, googleProvider).catch(() => {});

  const handleJoin = async (e: React.MouseEvent, ch: Channel) => {
    e.preventDefault();
    if (!user) { handleLogin(); return; }
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
      <aside className={`hidden md:flex flex-col ${isCollapsed ? "w-[60px]" : "w-[240px] xl:w-[256px]"} h-screen sticky top-0 border-r border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#09090b] overflow-y-auto overflow-x-hidden pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-all duration-200 shrink-0`}>

        {/* Collapse toggle */}
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-end"} px-3 pt-4 pb-2 shrink-0`}>
          <button
            type="button"
            onClick={toggleCollapse}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 dark:text-zinc-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-zinc-400 transition"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isCollapsed ? (
                <polyline points="6 3 11 8 6 13" />
              ) : (
                <polyline points="10 3 5 8 10 13" />
              )}
            </svg>
          </button>
        </div>

        {/* Post a review */}
        <div className="px-2 pb-1 shrink-0">
          <Link
            href="/feed?compose=true"
            className={`btn-brand w-full text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 ${isCollapsed ? "px-0" : "px-4"}`}
          >
            <span>✍️</span>
            {!isCollapsed && "Post a review"}
          </Link>
        </div>

        {/* ── Navigation ─────────────────────────────── */}
        <SectionHeader label="Navigate" collapsed={isCollapsed} />
        <nav className="px-1">
          <NavRow href="/feed" icon="🏠" label="Feed" active={pathname === "/feed"} collapsed={isCollapsed} />
          <NavRow href="/explore" icon="🔍" label="Explore" active={pathname === "/explore"} collapsed={isCollapsed} />
          <NavRow href="/c" icon="📡" label="Communities" active={pathname === "/c"} collapsed={isCollapsed} />
          <NavRow href="/collections" icon="📚" label="Collections" active={pathname.startsWith("/collections")} collapsed={isCollapsed} />
          <NavRow href="/profile" icon="👤" label="Profile" active={pathname === "/profile"} collapsed={isCollapsed} />
          <NavRow href="/brands" icon="🏢" label="For brands" active={pathname.startsWith("/brands")} collapsed={isCollapsed} />
          <NavRow href="/admin" icon="⚡" label="Admin" active={pathname === "/admin"} collapsed={isCollapsed} />
        </nav>

        {!isCollapsed && (
          <>
            <div className="border-t border-slate-200 dark:border-white/[0.06] mx-2 my-1" />

            {/* ── Your Channels ───────────────────────────── */}
            <SectionHeader label="Your communities" collapsed={false} />
            <div className="px-1">
              {joinedChannels.length === 0 && !user && (
                <p className="px-2 py-1 text-[12px] text-slate-500 dark:text-zinc-500">
                  <button type="button" onClick={handleLogin} className="text-indigo-600 dark:text-indigo-400 hover:underline">Sign in</button> to join communities
                </p>
              )}
              {joinedChannels.length === 0 && user && (
                <p className="px-2 py-1 text-[12px] text-slate-500 dark:text-zinc-500">No communities joined yet.</p>
              )}
              {visibleJoined.map((ch) => (
                <NavRow key={ch.id} href={`/c/${ch.slug}`} icon={ch.iconEmoji} label={`rj/${ch.slug}`}
                  active={pathname === `/c/${ch.slug}`}
                  right={<span className="text-[10px] text-slate-400 dark:text-zinc-600 tabular-nums">{ch.memberCount.toLocaleString()}</span>}
                />
              ))}
              {joinedChannels.length > 5 && (
                <button type="button" onClick={() => setShowAllChannels((v) => !v)}
                  className="w-full text-left px-2 py-1 text-[11px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition">
                  {showAllChannels ? "Show less" : `See ${joinedChannels.length - 5} more\u2026`}
                </button>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-white/[0.06] mx-2 my-1" />

            {/* ── Discover communities ─────────────────────── */}
            <SectionHeader label="Communities" collapsed={false} />
            <div className="px-1">
              {visiblePopular.map((ch) => (
                <NavRow key={ch.id} href={`/c/${ch.slug}`} icon={ch.iconEmoji} label={`rj/${ch.slug}`}
                  active={pathname === `/c/${ch.slug}`}
                  right={
                    <button type="button" onClick={(e) => handleJoin(e, ch)} disabled={joining === ch.id}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/10 disabled:opacity-50 transition">
                      {joining === ch.id ? "\u2026" : "+ Join"}
                    </button>
                  }
                />
              ))}
              {popularChannels.length > (user ? 3 : 5) && (
                <button type="button" onClick={() => setShowAllChannels((v) => !v)}
                  className="w-full text-left px-2 py-1 text-[11px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition">
                  {showAllChannels ? "Show less" : `See ${popularChannels.length - (user ? 3 : 5)} more\u2026`}
                </button>
              )}
              <div className="flex gap-2 px-2 py-1">
                <Link href="/c" className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium">All communities</Link>
                {user && (
                  <button type="button" onClick={() => setShowCreate(true)} className="text-[11px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition">
                    + Create
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-white/[0.06] mx-2 my-1" />

            {/* ── Resources ───────────────────────────────── */}
            <SectionHeader label="Resources" collapsed={false} />
            <nav className="px-1">
              <NavRow href="/brands" icon="📈" label="Advertise on Review Jam" />
              <NavRow href="/brands/dashboard" icon="📊" label="Brand dashboard" />
              <NavRow icon={isDarkMode ? "☀️" : "🌙"} label={isDarkMode ? "Light mode" : "Dark mode"} onClick={toggleDarkMode} />
            </nav>

            <div className="border-t border-slate-200 dark:border-white/[0.06] mx-2 my-1" />

            {/* ── Footer ──────────────────────────────────── */}
            <div className="px-3 pt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 dark:text-zinc-600">
              <span className="cursor-pointer hover:text-slate-500 dark:hover:text-zinc-400">Terms</span>
              <span className="cursor-pointer hover:text-slate-500 dark:hover:text-zinc-400">Privacy</span>
              <Link href="/brands" className="hover:text-slate-500 dark:hover:text-zinc-400">Brands</Link>
              <p className="w-full mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                &copy; 2026 Review Jam
              </p>
            </div>
          </>
        )}

        {/* Collapsed: dark mode toggle + minimal icons */}
        {isCollapsed && (
          <div className="px-1 mt-2">
            <div className="border-t border-slate-200 dark:border-white/[0.06] mx-2 my-1" />
            <NavRow icon={isDarkMode ? "☀️" : "🌙"} label={isDarkMode ? "Light mode" : "Dark mode"} onClick={toggleDarkMode} collapsed />
          </div>
        )}
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

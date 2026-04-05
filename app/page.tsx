"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { useAuth } from "../lib/hooks/useAuth";
import Avatar from "./components/Avatar";

export default function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    setIsDarkMode(next);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] relative overflow-hidden">

      {/* Glow effects (dark only) */}
      <div className="hidden dark:block absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse,rgba(99,102,241,0.12)_0%,transparent_70%)] pointer-events-none" aria-hidden="true" />
      <div className="hidden dark:block absolute top-[50px] right-[15%] w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(168,85,247,0.08)_0%,transparent_70%)] pointer-events-none" aria-hidden="true" />

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 md:px-8 h-14 shrink-0 relative z-10 border-b border-slate-200 dark:border-white/[0.06]">
        <Link href="/" className="flex items-center">
          <Image src="/logo.svg" alt="Review Jam" width={110} height={26} priority className="dark:hidden" />
          <Image src="/logo-dark.svg" alt="Review Jam" width={110} height={26} priority className="hidden dark:block" />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/feed" className="text-sm font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition hidden md:inline-block">
            Feed
          </Link>
          <Link href="/c" className="text-sm font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition hidden md:inline-block">
            Communities
          </Link>
          <Link href="/explore" className="text-sm font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition hidden md:inline-block">
            Products
          </Link>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition text-slate-500 dark:text-zinc-500 text-sm"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? "\u2600\uFE0F" : "\uD83C\uDF19"}
          </button>
          {user ? (
            <Link href="/profile" className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition">
              <Avatar name={user.displayName} src={user.photoURL} size="sm" className="w-8 h-8" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Hero — centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16 relative z-10">

        {/* Status pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[13px] text-indigo-600 dark:text-indigo-400 font-medium mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse-glow" />
          2,400+ verified reviews and counting
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-[56px] font-extrabold text-center leading-[1.05] tracking-[-2px] mb-4 animate-fade-in text-slate-900 dark:text-zinc-50">
          The review platform<br />built on <span className="text-gradient">trust</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-slate-500 dark:text-zinc-500 text-center mb-10 max-w-[460px] leading-relaxed">
          Quality-scored reviews from verified owners. No gaming the system — authentic experiences only.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="w-full max-w-[520px] mb-10">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 pointer-events-none"
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands, categories..."
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] backdrop-blur-sm text-[15px] outline-none text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 dark:focus:ring-0 dark:focus:bg-white/[0.06] transition-all"
              autoComplete="off"
            />
          </div>
        </form>

        {/* Quick links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm mb-12">
          <Link href="/feed" className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 font-medium transition">
            Feed
          </Link>
          <span className="text-slate-300 dark:text-zinc-700">|</span>
          <Link href="/feed?compose=true" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition">
            Write a Review
          </Link>
          <span className="text-slate-300 dark:text-zinc-700">|</span>
          <Link href="/explore" className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 font-medium transition">
            Explore Products
          </Link>
          <span className="text-slate-300 dark:text-zinc-700">|</span>
          <Link href="/c" className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 font-medium transition">
            Browse Communities
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-6 md:gap-14 pt-8 border-t border-slate-200 dark:border-white/[0.06] w-full max-w-md">
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-500 dark:text-emerald-400 tracking-tight">92</div>
            <div className="text-[10px] md:text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-1 leading-tight">Health Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">2.4K</div>
            <div className="text-[10px] md:text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-1 leading-tight">Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">9</div>
            <div className="text-[10px] md:text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-1 leading-tight">Communities</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">850+</div>
            <div className="text-[10px] md:text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-1 leading-tight">Products</div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, getCountFromServer } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";
import { db, auth, googleProvider } from "../lib/firebase";
import Avatar from "./components/Avatar";

export default function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [stats, setStats] = useState({ reviews: 0, products: 0 });

  useEffect(() => {
    if (
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [revSnap, prodSnap] = await Promise.all([
          getCountFromServer(collection(db, "reviews")),
          getCountFromServer(collection(db, "products")),
        ]);
        setStats({ reviews: revSnap.data().count, products: prodSnap.data().count });
      } catch {}
    })();
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
      setIsDarkMode(true);
    }
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
    <div className="min-h-screen flex flex-col transition-colors duration-200 bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/30 dark:bg-none dark:bg-slate-950">

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 md:px-8 h-14 shrink-0">
        <Link href="/" className="flex items-center">
          <Image src="/logo.svg" alt="Review Jam" width={110} height={26} priority className="dark:hidden" />
          <Image src="/logo-dark.svg" alt="Review Jam" width={110} height={26} priority className="hidden dark:block" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/60 dark:hover:bg-slate-800 transition text-slate-500 dark:text-slate-400 text-sm"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? "\u2600\uFE0F" : "\uD83C\uDF19"}
          </button>
          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/feed" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition px-3 py-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800">
                My Feed
              </Link>
              <Link href="/profile" className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/60 dark:hover:bg-slate-800 transition">
                <Avatar name={user.displayName} src={user.photoURL} size="sm" className="w-8 h-8" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden md:inline max-w-[120px] truncate">{user.displayName}</span>
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="text-sm font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Hero — centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">

        {/* Logo mark */}
        <div className="mb-4">
          <Image src="/logo.svg" alt="Review Jam" width={220} height={52} className="dark:hidden" />
          <Image src="/logo-dark.svg" alt="Review Jam" width={220} height={52} className="hidden dark:block" />
        </div>

        {/* Tagline */}
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 text-center mb-2 max-w-lg font-medium">
          Discover trusted reviews. Share your experience.
        </p>
        <p className="text-sm md:text-base text-slate-400 dark:text-slate-500 text-center mb-8 max-w-md">
          Join a community-driven marketplace where honest opinions are valued and rewarded.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="w-full max-w-[580px] mb-8">
          <div className="relative group">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
              width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a product, brand, or category..."
              className="w-full pl-12 pr-4 py-3.5 md:py-4 rounded-full border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-base outline-none shadow-sm hover:shadow-md focus:shadow-lg focus:border-indigo-400 dark:focus:border-indigo-500 transition-all dark:text-slate-100 dark:placeholder-slate-500"
              autoComplete="off"
            />
          </div>
        </form>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <Link
            href="/feed"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-indigo-200 dark:border-indigo-800 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Write a Review
          </Link>
          <Link
            href="/explore"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-600 dark:hover:text-indigo-400 transition bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            Explore Products
          </Link>
          <Link
            href="/c"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-600 dark:hover:text-indigo-400 transition bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
            Browse Communities
          </Link>
        </div>

        {/* Stats */}
        {(stats.reviews > 0 || stats.products > 0) && (
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.reviews.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Reviews</p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.products.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Products</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

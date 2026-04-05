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
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] relative overflow-x-hidden">

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
          <Link href="/compare" className="text-sm font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition hidden md:inline-block">
            Why Review Jam
          </Link>
          <Link href="/brands" className="text-sm font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition hidden md:inline-block">
            For Brands
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

      {/* ─── HERO ─── */}
      <section className="flex flex-col items-center px-4 pt-16 md:pt-24 pb-16 relative z-10">

        {/* Status pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[13px] text-indigo-600 dark:text-indigo-400 font-medium mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse-glow" />
          The review platform built on trust
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-[56px] font-extrabold text-center leading-[1.05] tracking-[-2px] mb-5 animate-fade-in text-slate-900 dark:text-zinc-50">
          Ads get attention.<br />
          <span className="text-gradient">Reviews close the sale.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-slate-500 dark:text-zinc-400 text-center mb-10 max-w-[560px] leading-relaxed">
          93% of consumers read reviews before buying. Review Jam is where honest, quality-scored reviews from verified owners turn browsers into buyers.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="w-full max-w-[520px] mb-8">
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

        {/* CTA buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          <Link
            href="/feed?compose=true"
            className="btn-brand px-6 py-3 rounded-xl text-sm font-semibold"
          >
            Write a Review
          </Link>
          <Link
            href="/explore"
            className="px-6 py-3 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition"
          >
            Explore Products
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-6 md:gap-14 pt-8 border-t border-slate-200 dark:border-white/[0.06] w-full max-w-md">
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-500 dark:text-emerald-400 tracking-tight">92</div>
            <div className="text-[10px] md:text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-1 leading-tight">Avg Health Score</div>
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
      </section>

      {/* ─── THE PURCHASE DECISION LAYER ─── */}
      <section className="relative z-10 px-4 md:px-8 py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight mb-4">
            The purchase decision happens at the <span className="text-gradient">reviews</span>
          </h2>
          <p className="text-base md:text-lg text-slate-500 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            The entire advertising industry creates awareness. But the actual buying decision? That happens when a customer reads reviews. And right now, that moment is broken.
          </p>
        </div>

        {/* Funnel visual */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-0 justify-center">
            <div className="glass-card px-5 py-3 text-center">
              <div className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Ads</div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500">Create awareness</div>
            </div>
            <svg className="w-6 h-6 text-slate-300 dark:text-zinc-700 rotate-90 md:rotate-0 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <div className="glass-card px-5 py-3 text-center">
              <div className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Customer researches</div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500">Checks reviews</div>
            </div>
            <svg className="w-6 h-6 text-slate-300 dark:text-zinc-700 rotate-90 md:rotate-0 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <div className="relative px-5 py-3 text-center rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 border-2 border-indigo-500/30">
              <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Review Jam</div>
              <div className="text-[11px] text-indigo-500/70 dark:text-indigo-400/60">Trusted reviews</div>
            </div>
            <svg className="w-6 h-6 text-slate-300 dark:text-zinc-700 rotate-90 md:rotate-0 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <div className="glass-card px-5 py-3 text-center">
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Purchase</div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500">Confident decision</div>
            </div>
          </div>
        </div>

        {/* Three broken things */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
          <div className="glass-card px-6 py-5">
            <div className="text-2xl mb-3">💰</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Paid reviews</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              Influencers say what brands pay them to say. 5 stars, no cons, marketing language. You know it when you see it.
            </p>
          </div>
          <div className="glass-card px-6 py-5">
            <div className="text-2xl mb-3">😤</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Rage reviews</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              Only the furious bother to write. You get 1-star rants or 5-star fluff. The honest middle? Missing.
            </p>
          </div>
          <div className="glass-card px-6 py-5">
            <div className="text-2xl mb-3">🕳️</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Zero reviews</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              New and niche products have no reviews at all. No reviews, no trust, no purchases. You buy blind.
            </p>
          </div>
        </div>
      </section>

      {/* ─── HOW REVIEW JAM IS DIFFERENT ─── */}
      <section className="relative z-10 px-4 md:px-8 py-20 md:py-28 border-t border-slate-100 dark:border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight mb-4">
            The honest middle.<br className="hidden md:block" /> <span className="text-gradient">Quality-scored and verified.</span>
          </h2>
          <p className="text-base md:text-lg text-slate-500 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            Review Jam rewards thorough, honest reviews — not positive ones. Our algorithms penalize bias, verify purchases, and score quality transparently.
          </p>
        </div>

        {/* The Missing Middle visual */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4 mb-16">
          {/* Paid review */}
          <div className="glass-card px-5 py-5 opacity-60">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-500 text-sm">★★★★★</span>
              <span className="text-[10px] font-medium text-red-500 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">BIAS FLAGGED</span>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 italic leading-relaxed">
              &quot;This is literally the best product I have ever used! Life-changing! Must buy for everyone!&quot;
            </p>
            <div className="mt-3 text-[11px] text-slate-400 dark:text-zinc-600">No cons listed. No details. Sponsored.</div>
          </div>

          {/* Review Jam review — highlighted */}
          <div className="relative px-5 py-5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border-2 border-indigo-500/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-600 dark:bg-indigo-500 text-white text-[10px] font-bold rounded-full tracking-wide">REVIEW JAM</div>
            <div className="flex items-center gap-2 mb-3 mt-1">
              <span className="text-yellow-500 text-sm">★★★★☆</span>
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Health 78</span>
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Verified</span>
            </div>
            <p className="text-[13px] text-slate-700 dark:text-zinc-300 leading-relaxed">
              Solid build quality and great battery life. Camera is good but struggles in low light. After 3 months, here is my honest take...
            </p>
            <div className="mt-3 flex gap-2 text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400">3 pros</span>
              <span className="text-slate-300 dark:text-zinc-700">|</span>
              <span className="text-red-500 dark:text-red-400">2 cons</span>
              <span className="text-slate-300 dark:text-zinc-700">|</span>
              <span className="text-indigo-600 dark:text-indigo-400">3-month update</span>
            </div>
          </div>

          {/* Rage review */}
          <div className="glass-card px-5 py-5 opacity-60">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-500 text-sm">★☆☆☆☆</span>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 italic leading-relaxed">
              &quot;WORST PRODUCT EVER. Broke after 2 days. DO NOT BUY. Company is a scam!!!&quot;
            </p>
            <div className="mt-3 text-[11px] text-slate-400 dark:text-zinc-600">No pros listed. No details. Day-one rage.</div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="glass-card px-6 py-5 flex gap-4">
            <div className="text-2xl shrink-0 mt-0.5">🔬</div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Health Score (0-100)</h3>
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                Every review gets a transparent quality score based on depth, engagement, credibility, and freshness. Not sentiment — substance.
              </p>
            </div>
          </div>
          <div className="glass-card px-6 py-5 flex gap-4">
            <div className="text-2xl shrink-0 mt-0.5">🧾</div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Receipt verification</h3>
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                AI-powered receipt OCR confirms real purchases. Not a checkbox — actual proof of ownership scanned and verified.
              </p>
            </div>
          </div>
          <div className="glass-card px-6 py-5 flex gap-4">
            <div className="text-2xl shrink-0 mt-0.5">📈</div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Ownership Journey</h3>
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                Reviews evolve. See how opinions change at 1 month, 3 months, 6 months, 1 year. Not first impressions — long-term truth.
              </p>
            </div>
          </div>
          <div className="glass-card px-6 py-5 flex gap-4">
            <div className="text-2xl shrink-0 mt-0.5">🚫</div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Bias detection</h3>
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                AI flags over-positive reviews automatically. No cons listed? -15 Health Score. Marketing language? Flagged and penalized.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOR BRANDS ─── */}
      <section className="relative z-10 px-4 md:px-8 py-20 md:py-28 border-t border-slate-100 dark:border-white/[0.04]">
        {/* Accent glow */}
        <div className="hidden dark:block absolute top-[100px] left-[10%] w-[500px] h-[400px] bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,transparent_70%)] pointer-events-none" aria-hidden="true" />

        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[12px] text-purple-600 dark:text-purple-400 font-semibold mb-4 tracking-wide uppercase">
            For Brands
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight mb-4">
            Your ads get clicks.<br /><span className="text-gradient">Our reviews get customers.</span>
          </h2>
          <p className="text-base md:text-lg text-slate-500 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            You spend thousands on ads to drive traffic. But when customers check reviews and find nothing — or find fakes — your ad spend leaks. Review Jam plugs that leak.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4 mb-12">
          <div className="glass-card px-6 py-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-lg mb-4">🚀</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Solve the cold start</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              New products have zero reviews. No reviews means no trust means no sales. Fund a bounty pool and get genuine, detailed reviews from trusted reviewers before launch.
            </p>
          </div>
          <div className="glass-card px-6 py-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-lg mb-4">💎</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Convert ad traffic</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              Embed trust widgets on your product pages. When customers arrive from ads, they see verified, quality-scored reviews that close the sale instead of driving them to Amazon.
            </p>
          </div>
          <div className="glass-card px-6 py-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-lg mb-4">📢</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Community discovery</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              In each community — Gaming, Tech, Beauty — the best-reviewed products surface organically. Great reviews become free, trusted publicity.
            </p>
          </div>
        </div>

        <div className="max-w-xl mx-auto text-center">
          <Link href="/brands" className="btn-brand px-8 py-3.5 rounded-xl text-sm font-semibold inline-block">
            Learn more for brands
          </Link>
          <p className="text-[12px] text-slate-400 dark:text-zinc-600 mt-3">
            Brand funding is decoupled from review sentiment. You can&apos;t buy stars — you fund a trust ecosystem.
          </p>
        </div>
      </section>

      {/* ─── FOR REVIEWERS ─── */}
      <section className="relative z-10 px-4 md:px-8 py-20 md:py-28 border-t border-slate-100 dark:border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold mb-4 tracking-wide uppercase">
            For Reviewers
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight mb-4">
            Your honest opinion has value.<br /><span className="text-gradient">Literally.</span>
          </h2>
          <p className="text-base md:text-lg text-slate-500 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            Write detailed, honest reviews and earn from the engagement they generate. Not for being positive — for being thorough.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4 mb-12">
          <div className="glass-card px-6 py-5 flex gap-4">
            <div className="text-2xl shrink-0 mt-0.5">💰</div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Earn from engagement</h3>
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                Your payout is proportional to your review&apos;s Health Score and engagement. More thorough, more helpful, more earned.
              </p>
            </div>
          </div>
          <div className="glass-card px-6 py-5 flex gap-4">
            <div className="text-2xl shrink-0 mt-0.5">🏆</div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Build your reputation</h3>
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                Progress from Newcomer to Legend. Earn badges for verified purchases, prolific reviewing, and category expertise.
              </p>
            </div>
          </div>
          <div className="glass-card px-6 py-5 flex gap-4">
            <div className="text-2xl shrink-0 mt-0.5">🔄</div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Update over time</h3>
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                Post version updates at 1 month, 3 months, 6 months, 1 year. Your review grows with your ownership experience.
              </p>
            </div>
          </div>
          <div className="glass-card px-6 py-5 flex gap-4">
            <div className="text-2xl shrink-0 mt-0.5">🍴</div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-1">Fork and counter</h3>
              <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
                Disagree with a review? Fork it and write your counter-take. Diverse perspectives are rewarded, not silenced.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-xl mx-auto text-center">
          <Link href="/feed?compose=true" className="btn-brand px-8 py-3.5 rounded-xl text-sm font-semibold inline-block">
            Write your first review
          </Link>
        </div>
      </section>

      {/* ─── COMPARISON ─── */}
      <section className="relative z-10 px-4 md:px-8 py-20 md:py-28 border-t border-slate-100 dark:border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight mb-4">
            Not another review platform.<br /><span className="text-gradient">A fundamentally different model.</span>
          </h2>
        </div>

        <div className="max-w-3xl mx-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 dark:border-white/[0.06]">
                <th className="py-3 pr-4 text-slate-400 dark:text-zinc-500 font-medium text-[12px] uppercase tracking-wider">Feature</th>
                <th className="py-3 px-4 text-indigo-600 dark:text-indigo-400 font-bold text-[12px] uppercase tracking-wider">Review Jam</th>
                <th className="py-3 px-4 text-slate-400 dark:text-zinc-500 font-medium text-[12px] uppercase tracking-wider">Amazon</th>
                <th className="py-3 px-4 text-slate-400 dark:text-zinc-500 font-medium text-[12px] uppercase tracking-wider">Trustpilot</th>
                <th className="py-3 pl-4 text-slate-400 dark:text-zinc-500 font-medium text-[12px] uppercase tracking-wider">Influencers</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              <tr className="border-b border-slate-100 dark:border-white/[0.03]">
                <td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">Reviewer incentive</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Engagement-based pay</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">None</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">None</td>
                <td className="py-3 pl-4 text-red-500 dark:text-red-400">Pay-per-post</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-white/[0.03]">
                <td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">Quality scoring</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Health Score 0-100</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">Stars only</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">Stars only</td>
                <td className="py-3 pl-4 text-slate-400 dark:text-zinc-600">None</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-white/[0.03]">
                <td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">Bias detection</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">AI + algorithmic</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">Basic filters</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">Manual reports</td>
                <td className="py-3 pl-4 text-red-500 dark:text-red-400">None (incentive misaligned)</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-white/[0.03]">
                <td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">Purchase verification</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Receipt OCR</td>
                <td className="py-3 px-4 text-amber-500 dark:text-amber-400">Order-linked</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">Self-reported</td>
                <td className="py-3 pl-4 text-red-500 dark:text-red-400">Brand-sent products</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">Review evolution</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Ownership Journey</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">Static edits</td>
                <td className="py-3 px-4 text-slate-400 dark:text-zinc-600">None</td>
                <td className="py-3 pl-4 text-slate-400 dark:text-zinc-600">One-time content</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative z-10 px-4 md:px-8 py-20 md:py-28 border-t border-slate-100 dark:border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight mb-4">
            How it works
          </h2>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl mx-auto mb-4 font-bold text-indigo-600 dark:text-indigo-400">1</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Review honestly</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              Write a detailed review with real pros, real cons, and your genuine experience. Upload photos. Verify your purchase with a receipt.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-xl mx-auto mb-4 font-bold text-purple-600 dark:text-purple-400">2</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Get quality-scored</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              Your review earns a Health Score based on thoroughness, balance, and verification. AI moderation ensures genuineness. Bias gets flagged.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-xl mx-auto mb-4 font-bold text-emerald-600 dark:text-emerald-400">3</div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Earn from engagement</h3>
            <p className="text-[13px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              The more helpful your review, the more you earn. Payouts are proportional to Health Score and engagement — not star ratings.
            </p>
          </div>
        </div>
      </section>

      {/* ─── BOTTOM CTA ─── */}
      <section className="relative z-10 px-4 md:px-8 py-20 md:py-28 border-t border-slate-100 dark:border-white/[0.04]">
        <div className="hidden dark:block absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" aria-hidden="true" />

        <div className="max-w-xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-zinc-50 tracking-tight mb-4">
            Ready to join the trust economy?
          </h2>
          <p className="text-base text-slate-500 dark:text-zinc-400 mb-8">
            Whether you write reviews, build products, or just want to make smarter buying decisions — Review Jam is where trust lives.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/feed?compose=true"
              className="btn-brand px-8 py-3.5 rounded-xl text-sm font-semibold"
            >
              Start reviewing
            </Link>
            <Link
              href="/brands"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition"
            >
              I&apos;m a brand
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 px-4 md:px-8 py-8 border-t border-slate-200 dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm text-slate-400 dark:text-zinc-600">
            <Link href="/" className="hover:text-slate-600 dark:hover:text-zinc-400 transition">
              <Image src="/logo.svg" alt="Review Jam" width={90} height={22} className="dark:hidden opacity-50 hover:opacity-80 transition" />
              <Image src="/logo-dark.svg" alt="Review Jam" width={90} height={22} className="hidden dark:block opacity-50 hover:opacity-80 transition" />
            </Link>
          </div>
          <div className="flex items-center gap-6 text-[13px] text-slate-400 dark:text-zinc-600">
            <Link href="/feed" className="hover:text-slate-600 dark:hover:text-zinc-400 transition">Feed</Link>
            <Link href="/explore" className="hover:text-slate-600 dark:hover:text-zinc-400 transition">Products</Link>
            <Link href="/c" className="hover:text-slate-600 dark:hover:text-zinc-400 transition">Communities</Link>
            <Link href="/brands" className="hover:text-slate-600 dark:hover:text-zinc-400 transition">For Brands</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc,
  updateDoc, increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInWithPopup, signOut } from "firebase/auth";
import { db, auth, googleProvider, storage } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";
import { updateUserBadges } from "../../lib/badges";
import ReviewWizard, { ReviewFormData } from "../components/ReviewWizard";
import { calculateDiscoveryRank } from "../../lib/discoveryRank";
import { incrementTrustScore } from "../../lib/trustScore";
import ReviewCard, { type ReviewData } from "../components/ReviewCard";
import RightSidebar from "../components/RightSidebar";
import LeftSidebar from "../components/LeftSidebar";
import Avatar from "../components/Avatar";
import NotificationBell from "../components/NotificationBell";

import type { FeedTab } from "../../lib/types";

export default function FeedPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);

  const { user } = useAuth();
  const [userInterests, setUserInterests] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("All");
  const [feedTab, setFeedTab] = useState<FeedTab>("foryou");

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [reviewMode, setReviewMode] = useState<"organic" | "verified" | "generic" | null>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [boostedCategories, setBoostedCategories] = useState<Set<string>>(new Set());
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);

  const categoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));

    if (user) {
      const userRef = doc(db, "users", user.uid);
      getDoc(userRef).then((userSnap) => {
        if (userSnap.exists()) {
          setUserInterests(userSnap.data().interests || []);
        } else {
          setShowOnboarding(true);
        }
      });
    } else {
      setUserInterests([]);
    }
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
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

  const scrollCategories = (direction: "left" | "right") => {
    categoriesRef.current?.scrollBy({
      left: direction === "left" ? -250 : 250,
      behavior: "smooth",
    });
  };

  async function fetchInitialData() {
    setIsLoading(true);
    try {
      const [prodSnap, revSnap, channelSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "reviews")),
        getDocs(collection(db, "channels")),
      ]);

      const boosted = new Set<string>();
      channelSnap.forEach((d) => {
        const ch = d.data();
        const hasActiveBounty =
          ch.multiplier && ch.multiplier > 1 &&
          (!ch.multiplierExpiresAt || Date.now() < new Date(ch.multiplierExpiresAt).getTime());
        if (hasActiveBounty && ch.category) boosted.add(ch.category as string);
      });
      setBoostedCategories(boosted);

      // Build dynamic categories from channels
      const allCats = new Set<string>();
      channelSnap.forEach((d) => { const cat = d.data().category; if (cat) allCats.add(cat as string); });
      setDynamicCategories([...allCats].sort());

      const fetchedProducts: any[] = [];
      prodSnap.forEach((d) => fetchedProducts.push({ id: d.id, ...d.data() }));
      setProducts(fetchedProducts);

      const fetchedReviews: any[] = [];
      revSnap.forEach((d) => fetchedReviews.push({ id: d.id, ...d.data() }));
      // Sort by Discovery Rank by default so the "For You" feed surfaces the
      // most engaging recent reviews rather than all-time like leaders.
      // Each review's own DR is computed as a single-item product (itself).
      fetchedReviews.sort((a, b) => {
        const drA = calculateDiscoveryRank([{ healthScore: a.healthScore, isCampaignReview: a.isCampaignReview, biasFlag: a.biasFlag, createdAt: a.createdAt }]);
        const drB = calculateDiscoveryRank([{ healthScore: b.healthScore, isCampaignReview: b.isCampaignReview, biasFlag: b.biasFlag, createdAt: b.createdAt }]);
        return drB - drA;
      });
      setAllReviews(fetchedReviews);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch {}
  };
  const handleLogout = async () => {
    try { await signOut(auth); setUserInterests([]); } catch {}
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.displayName,
        interests: selectedInterests,
        walletBalance: 0,
        totalEarned: 0,
        trustScore: 0,
        badges: [],
        createdAt: new Date().toISOString(),
      });
      setUserInterests(selectedInterests);
      setShowOnboarding(false);
    } catch {}
  };

  const handleReviewSubmit = async (data: ReviewFormData) => {
    if (!user) throw new Error("You must be signed in to post a review.");

    // Upload images (best-effort)
    const mediaUrls: string[] = [];
    if (data.mediaFiles.length > 0) {
      try {
        for (const file of data.mediaFiles) {
          const fileRef = storageRef(storage, `reviews/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          mediaUrls.push(await getDownloadURL(fileRef));
        }
      } catch (err) {
        console.warn("Image upload failed:", err);
      }
    }

    let marketingQuote = data.summary || "";
    let biasFlag = false;

    // Generic reviews skip AI validation and are not eligible for payouts
    if (data.reviewType !== "generic") {
      const agentResponse = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewContent: data.content,
          reviewerName: user.displayName,
          pros: data.pros,
          cons: data.cons,
          summary: data.summary,
        }),
      });
      const agentData = await agentResponse.json();

      if (!agentResponse.ok || !agentData?.success || !agentData?.analysis) {
        throw new Error(
          typeof agentData?.error === "string" && agentData.error.trim()
            ? agentData.error
            : "Unable to validate this review right now. Please try again."
        );
      }
      if (agentData.analysis.isGenuine !== true) {
        throw new Error(`AI Quality Control: ${agentData.analysis.reason || "Review quality check failed."}`);
      }
      marketingQuote = agentData.analysis?.marketingQuote || data.summary || "";
      biasFlag = agentData.analysis?.biasFlag ?? false;
    }

    const newReview: Record<string, unknown> = {
      content: data.content,
      rating: data.overallRating,
      reviewerId: user.uid,
      reviewerName: user.displayName,
      productId: `organic_${Date.now()}`,
      productName: data.productName,
      category: data.category,
      campaignId: "organic",
      likesCount: 0,
      likedBy: [],
      helpfulCount: 0,
      helpfulBy: [],
      notHelpfulCount: 0,
      notHelpfulBy: [],
      commentCount: 0,
      versionCount: 1,
      marketingQuote,
      pros: data.pros,
      cons: data.cons,
      summary: data.summary,
      productSource: data.productSource,
      usageDuration: data.usageDuration,
      purchaseChannel: data.purchaseChannel,
      subRatings: data.subRatings,
      bestFor: data.bestFor,
      mediaUrls,
      reviewType: data.reviewType,
      productCode: data.productCode ?? null,
      isCampaignReview: false,
      eligibleForPayout: data.reviewType !== "generic",
      isVerifiedPurchase: data.isVerifiedPurchase ?? false,
      biasFlag,
      createdAt: new Date().toISOString(),
    };

    // Channel metadata
    if (data.channelId) { newReview.channelId = data.channelId; }
    if (data.channelSlug) { newReview.channelSlug = data.channelSlug; }

    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setAllReviews((prev) => [{ id: docRef.id, ...newReview } as ReviewData, ...prev]);

    // Reward the submitter
    incrementTrustScore(user.uid, "organic_review", 5).catch(() => {});

    if (data.reviewType !== "generic") updateUserBadges(user.uid).catch(() => {});
  };

  const handleLike = async (reviewId: string, likedBy: string[] = []) => {
    if (!user) { handleLogin(); return; }
    const hasLiked = likedBy.includes(user.uid);
    setAllReviews((cur) => cur.map((r) => r.id !== reviewId ? r : hasLiked
      ? { ...r, likesCount: Math.max(0, (r.likesCount || 0) - 1), likedBy: r.likedBy.filter((id: string) => id !== user.uid) }
      : { ...r, likesCount: (r.likesCount || 0) + 1, likedBy: [...(r.likedBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      likesCount: increment(hasLiked ? -1 : 1),
      likedBy: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleHelpful = async (reviewId: string, helpfulBy: string[] = []) => {
    if (!user) { handleLogin(); return; }
    const has = helpfulBy.includes(user.uid);
    setAllReviews((cur) => cur.map((r) => r.id !== reviewId ? r : has
      ? { ...r, helpfulCount: Math.max(0, (r.helpfulCount || 0) - 1), helpfulBy: r.helpfulBy.filter((id: string) => id !== user.uid) }
      : { ...r, helpfulCount: (r.helpfulCount || 0) + 1, helpfulBy: [...(r.helpfulBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      helpfulCount: increment(has ? -1 : 1),
      helpfulBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
    if (!has) {
      const review = allReviews.find((r) => r.id === reviewId);
      if (review?.reviewerId) {
        incrementTrustScore(review.reviewerId, "helpful_vote", 3).catch(() => {});
      }
    }
  };

  const handleNotHelpful = async (reviewId: string, notHelpfulBy: string[] = []) => {
    if (!user) { handleLogin(); return; }
    const has = notHelpfulBy.includes(user.uid);
    setAllReviews((cur) => cur.map((r) => r.id !== reviewId ? r : has
      ? { ...r, notHelpfulCount: Math.max(0, (r.notHelpfulCount || 0) - 1), notHelpfulBy: r.notHelpfulBy.filter((id: string) => id !== user.uid) }
      : { ...r, notHelpfulCount: (r.notHelpfulCount || 0) + 1, notHelpfulBy: [...(r.notHelpfulBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      notHelpfulCount: increment(has ? -1 : 1),
      notHelpfulBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  // ── Feed tab logic ────────────────────────────────────────────────────────

  // Trending: engagement velocity = likes / max(1, days since post)
  const trendingScore = (r: any) => {
    const daysSince = Math.max(1, (currentTime - new Date(r.createdAt).getTime()) / 86400000);
    return (r.likesCount || 0) / daysSince;
  };

  const baseFiltered = allReviews.filter((review) => {
    const matchesSearch =
      review.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.marketingQuote?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.productName?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesCategory = true;
    if (activeCategoryFilter !== "All") {
      matchesCategory = review.category === activeCategoryFilter;
    }

    return matchesSearch && matchesCategory;
  });

  const displayedReviews = (() => {
    if (feedTab === "trending") {
      return [...baseFiltered].sort((a, b) => trendingScore(b) - trendingScore(a));
    }
    // "foryou" — filter by interests when no category override
    if (activeCategoryFilter === "All" && userInterests.length > 0 && searchQuery === "") {
      return baseFiltered.filter((r) => userInterests.includes(r.category));
    }
    return baseFiltered;
  })();

  const trendingInsights = allReviews
    .filter((r) => (r.summary || r.marketingQuote) && r.likesCount > 0)
    .slice(0, 3);

  const FEED_TABS: { id: FeedTab; label: string }[] = [
    { id: "foryou",   label: "For you" },
    { id: "trending", label: "Trending" },
  ];

  return (
    <main className="min-h-screen bg-white dark:bg-[#09090b] text-slate-500 dark:text-zinc-300 transition-colors duration-200">

      {reviewMode && user && (
        <ReviewWizard
          user={user}
          mode={reviewMode}
          onSubmit={handleReviewSubmit}
          onClose={() => setReviewMode(null)}
        />
      )}

      {showOnboarding && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 max-w-md w-full shadow-lg border border-slate-200 dark:border-white/[0.06]">
            <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 mb-1">What are you into?</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">Personalise your feed.</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {dynamicCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedInterests((prev) =>
                    prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                  )}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    selectedInterests.includes(cat)
                      ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                      : "bg-white dark:bg-white/[0.03] text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/[0.06]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleCompleteOnboarding} className="w-full bg-indigo-600 dark:bg-indigo-600 text-white dark:text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Mobile Nav */}
      <nav className="md:hidden bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/[0.06] sticky top-0 z-40">
        {!showMobileSearch ? (
          <div className="px-3 h-12 flex justify-between items-center">
            <Link href="/" className="flex items-center">
              <Image src="/logo.svg" alt="Review Jam" width={118} height={28} priority className="dark:hidden" />
              <Image src="/logo-dark.svg" alt="Review Jam" width={118} height={28} priority className="hidden dark:block" />
            </Link>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowMobileSearch(true)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 dark:hover:bg-white/[0.04] transition" aria-label="Search">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </button>
              <button type="button" onClick={() => setShowMobileMenu((v) => !v)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 dark:hover:bg-white/[0.04] transition" aria-label="Menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-700 dark:text-zinc-300"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-3 h-12 flex items-center gap-2">
            <input
              type="search"
              autoFocus
              placeholder="Search reviews…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-slate-100 dark:bg-white/[0.06] rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500/30 dark:focus:ring-indigo-500/30 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500"
            />
            <button type="button" onClick={() => { setShowMobileSearch(false); setSearchQuery(""); }} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-sm font-medium shrink-0">
              ✕
            </button>
          </div>
        )}
      </nav>

      {/* Mobile slide-down menu */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
          <div className="absolute top-0 right-0 w-72 bg-white dark:bg-zinc-900 h-full shadow-xl border-l border-slate-200 dark:border-white/[0.06] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <div className="flex justify-end p-3">
              <button type="button" onClick={() => setShowMobileMenu(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-500 dark:text-zinc-500 text-lg">
                ✕
              </button>
            </div>

            {/* User section */}
            <div className="px-4 pb-4 border-b border-white/[0.06] dark:border-white/[0.06]">
              {user ? (
                <div className="flex items-center gap-3">
                  <Avatar name={user.displayName} src={user.photoURL} size="lg" className="w-11 h-11" />
                  <div className="min-w-0">
                    <p className="font-semibold text-base text-zinc-100 dark:text-zinc-100 truncate">{user.displayName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { handleLogin(); setShowMobileMenu(false); }} className="w-full bg-indigo-600 dark:bg-indigo-600 text-white dark:text-white text-sm font-medium py-3 rounded-lg hover:opacity-90 transition">
                  Sign in with Google
                </button>
              )}
            </div>

            {/* Nav links */}
            <nav className="py-2">
              {[
                { href: "/profile",    label: "Profile",        icon: "👤" },
                { href: "/explore",    label: "Explore",        icon: "🔍" },
                { href: "/brands",     label: "For brands",     icon: "🏢" },
                { href: "/brands/dashboard", label: "Brand dashboard", icon: "📊" },
                { href: "/admin",      label: "Admin",          icon: "⚡" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-zinc-300 dark:text-zinc-300 hover:bg-white/[0.04] dark:hover:bg-white/[0.04] transition"
                >
                  <span aria-hidden className="text-lg w-6 text-center">{item.icon}</span> {item.label}
                </Link>
              ))}
              <button type="button" onClick={() => { toggleDarkMode(); }} className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-zinc-300 dark:text-zinc-300 hover:bg-white/[0.04] dark:hover:bg-white/[0.04] transition w-full text-left">
                <span aria-hidden className="text-lg w-6 text-center">{isDarkMode ? "☀️" : "🌙"}</span> {isDarkMode ? "Light mode" : "Dark mode"}
              </button>
            </nav>

            {/* Logout */}
            {user && (
              <div className="border-t border-white/[0.06] dark:border-white/[0.06] p-4">
                <button type="button" onClick={() => { handleLogout(); setShowMobileMenu(false); }} className="text-sm text-rose-400 dark:text-rose-400 font-medium">
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex justify-center">

        {/* Left Sidebar */}
        <LeftSidebar
          user={user}
          products={products}
          isDarkMode={isDarkMode}
          onToggleDark={toggleDarkMode}
          onPostReview={() => setReviewMode("verified")}
          onQuickReview={() => setReviewMode("generic")}
          onLogin={handleLogin}
          activeCategoryFilter={activeCategoryFilter}
          onClearFilter={() => setActiveCategoryFilter("All")}
        />

        {/* Center: Feed */}
        <main className="w-full md:w-[600px] md:max-w-[600px] md:shrink-0 md:border-x border-white/[0.06] dark:border-white/[0.06] min-h-screen">

          <div className="sticky top-12 md:top-0 z-30 bg-white/95 dark:bg-[#09090b]/90 backdrop-blur-sm border-b border-white/[0.06] dark:border-white/[0.06]">
            <div className="hidden md:flex items-center justify-between h-12 px-4 border-b border-white/[0.06] dark:border-white/[0.06]">
              <h1 className="text-lg font-semibold text-zinc-100 dark:text-zinc-100">Home</h1>
              {user && <NotificationBell userId={user.uid} />}
            </div>

            {/* Feed Tabs */}
            <div className="flex border-b border-white/[0.06] dark:border-white/[0.06]">
              {FEED_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedTab(tab.id)}
                  className={`flex-1 py-3.5 md:py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    feedTab === tab.id
                      ? "border-indigo-500 text-indigo-400 dark:text-indigo-400"
                      : "border-transparent text-zinc-500 dark:text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Desktop search + category pills */}
            <div className="hidden md:block px-4 py-3">
              <input
                type="search"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.06] dark:bg-white/[0.06] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500/30 dark:focus:ring-indigo-500/30 text-zinc-100 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-500 border border-white/[0.06] dark:border-white/[0.06]"
              />
              <div className="relative mt-2.5 flex items-center">
                <button type="button" onClick={() => scrollCategories("left")} className="absolute left-0 z-10 p-1 bg-gradient-to-r from-[#09090b] via-[#09090b] to-transparent dark:from-[#09090b] dark:via-[#09090b] text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-300 transition h-full flex items-center justify-start w-8" aria-label="Scroll left">
                  <span className="text-lg leading-none">‹</span>
                </button>
                <div ref={categoriesRef} className="flex gap-1.5 overflow-x-auto snap-x scroll-smooth px-7 w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <button type="button" onClick={() => setActiveCategoryFilter("All")} className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border transition snap-start ${activeCategoryFilter === "All" ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-sm shadow-indigo-500/10" : "bg-white/[0.03] dark:bg-white/[0.03] text-zinc-400 dark:text-zinc-400 border-white/[0.06] dark:border-white/[0.06] hover:border-indigo-500/30 hover:text-indigo-400 dark:hover:border-indigo-500/30 dark:hover:text-indigo-400"}`}>
                    All
                  </button>
                  {dynamicCategories.map((cat) => {
                    const isActive  = activeCategoryFilter === cat;
                    const isBoosted = boostedCategories.has(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setActiveCategoryFilter(cat)}
                        className={`whitespace-nowrap flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border transition snap-start ${
                          isActive
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-sm shadow-indigo-500/10"
                            : isBoosted
                            ? "bg-violet-500/10 dark:bg-violet-500/10 text-violet-400 dark:text-violet-400 border-violet-500/20 dark:border-violet-500/20 hover:bg-violet-500/20 dark:hover:bg-violet-500/20"
                            : "bg-white/[0.03] dark:bg-white/[0.03] text-zinc-400 dark:text-zinc-400 border-white/[0.06] dark:border-white/[0.06] hover:border-indigo-500/30 hover:text-indigo-400 dark:hover:border-indigo-500/30 dark:hover:text-indigo-400"
                        }`}
                      >
                        {isBoosted && <span aria-hidden>🔥</span>}
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => scrollCategories("right")} className="absolute right-0 z-10 p-1 bg-gradient-to-l from-[#09090b] via-[#09090b] to-transparent dark:from-[#09090b] dark:via-[#09090b] text-zinc-500 hover:text-zinc-300 dark:hover:text-zinc-300 transition h-full flex items-center justify-end w-8" aria-label="Scroll right">
                  <span className="text-lg leading-none">›</span>
                </button>
              </div>
            </div>

            {/* Mobile: horizontal category chips only (no search, no arrows) */}
            <div className="md:hidden px-3 py-2">
              <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button type="button" onClick={() => setActiveCategoryFilter("All")} className={`whitespace-nowrap px-3.5 py-2 rounded-full text-[13px] font-medium border transition shrink-0 ${activeCategoryFilter === "All" ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" : "bg-white/[0.03] dark:bg-white/[0.03] text-zinc-400 dark:text-zinc-400 border-white/[0.06] dark:border-white/[0.06]"}`}>
                  All
                </button>
                {dynamicCategories.map((cat) => {
                  const isActive  = activeCategoryFilter === cat;
                  const isBoosted = boostedCategories.has(cat);
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setActiveCategoryFilter(cat)}
                      className={`whitespace-nowrap flex items-center gap-1 px-3.5 py-2 rounded-full text-[13px] font-medium border transition shrink-0 ${
                        isActive
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                          : isBoosted
                          ? "bg-violet-500/10 dark:bg-violet-500/10 text-violet-400 dark:text-violet-400 border-violet-500/20 dark:border-violet-500/20"
                          : "bg-white/[0.03] dark:bg-white/[0.03] text-zinc-400 dark:text-zinc-400 border-white/[0.06] dark:border-white/[0.06]"
                      }`}
                    >
                      {isBoosted && <span aria-hidden>🔥</span>}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Feed */}
          <div className="divide-y divide-white/[0.06] dark:divide-white/[0.06]">
            {isLoading ? (
              <div className="py-12 text-center text-zinc-600 text-sm animate-pulse">Loading…</div>
            ) : displayedReviews.length === 0 ? (
              <div className="py-14 px-6 text-center flex flex-col items-center max-w-sm mx-auto">
                <div className="w-10 h-10 bg-white/[0.06] dark:bg-white/[0.06] rounded-full flex items-center justify-center text-sm mb-3 text-zinc-500">📝</div>
                <h3 className="text-sm font-semibold text-zinc-100 dark:text-zinc-100 mb-1">No posts yet</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-5 leading-relaxed">
                  When people review in this view, they will show up here.
                </p>
                <button type="button" onClick={() => { if (!user) handleLogin(); else setReviewMode("verified"); }} className="text-sm font-medium bg-indigo-600 dark:bg-indigo-600 text-white dark:text-white px-4 py-2 rounded-full hover:opacity-90 transition">
                  Write a review
                </button>
              </div>
            ) : (
              displayedReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  currentUserId={user?.uid}
                  currentUserName={user?.displayName ?? undefined}
                  onLike={handleLike}
                  onHelpful={handleHelpful}
                  onNotHelpful={handleNotHelpful}
                  showPoolLink
                />
              ))
            )}
          </div>
        </main>

        {/* Right Sidebar */}
        <RightSidebar allReviews={allReviews} />
      </div>

      {/* Mobile FAB — Post a review */}
      <button
        type="button"
        onClick={() => { if (!user) handleLogin(); else setReviewMode("verified"); }}
        className="md:hidden fixed right-4 z-40 w-14 h-14 rounded-full btn-brand flex items-center justify-center active:scale-95 transition"
        style={{ bottom: "calc(56px + env(safe-area-inset-bottom, 0px) + 16px)" }}
        aria-label="Post a review"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </main>
  );
}

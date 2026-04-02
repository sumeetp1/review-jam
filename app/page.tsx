"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc,
  updateDoc, increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { db, auth, googleProvider, storage } from "../lib/firebase";
import { updateUserBadges } from "../lib/badges";
import ReviewWizard, { ReviewFormData, AVAILABLE_CATEGORIES } from "./components/ReviewWizard";
import { calculateDiscoveryRank } from "../lib/discoveryRank";
import ReviewCard, { type ReviewData } from "./components/ReviewCard";
import RightSidebar from "./components/RightSidebar";
import LeftSidebar from "./components/LeftSidebar";
import Avatar from "./components/Avatar";

type FeedTab = "foryou" | "trending" | "campaigns";

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);

  const [user, setUser] = useState<User | null>(null);
  const [userInterests, setUserInterests] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("All");
  const [feedTab, setFeedTab] = useState<FeedTab>("foryou");

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [reviewMode, setReviewMode] = useState<"organic" | "verified" | "generic" | null>(null);
  const [forkSource, setForkSource] = useState<{ reviewId: string; reviewerName: string; productName: string; category: string; productId?: string } | null>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isDarkMode, setIsDarkMode] = useState(false);

  const categoriesRef = useRef<HTMLDivElement>(null);

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

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserInterests(userSnap.data().interests || []);
        } else {
          setShowOnboarding(true);
        }
      } else {
        setUserInterests([]);
      }
      fetchInitialData();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
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

  const scrollCategories = (direction: "left" | "right") => {
    categoriesRef.current?.scrollBy({
      left: direction === "left" ? -250 : 250,
      behavior: "smooth",
    });
  };

  async function fetchInitialData() {
    setIsLoading(true);
    try {
      const [prodSnap, revSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "reviews")),
      ]);

      const fetchedProducts: any[] = [];
      prodSnap.forEach((d) => fetchedProducts.push({ id: d.id, ...d.data() }));
      setProducts(fetchedProducts);

      const fetchedReviews: any[] = [];
      revSnap.forEach((d) => fetchedReviews.push({ id: d.id, ...d.data() }));
      // Sort by Discovery Rank by default so the "For You" feed surfaces the
      // most engaging recent reviews rather than all-time like leaders.
      // Each review's own DR is computed as a single-item product (itself).
      fetchedReviews.sort((a, b) => {
        const drA = calculateDiscoveryRank([{ healthScore: a.healthScore, isCampaignReview: a.isCampaignReview, createdAt: a.createdAt }]);
        const drB = calculateDiscoveryRank([{ healthScore: b.healthScore, isCampaignReview: b.isCampaignReview, createdAt: b.createdAt }]);
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
      forkCount: 0,
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
      createdAt: new Date().toISOString(),
    };

    // Fork metadata
    if (data.forkedFromReviewId) {
      newReview.forkedFromReviewId = data.forkedFromReviewId;
      newReview.forkedFromReviewerName = data.forkedFromReviewerName;
      // Increment fork count on original
      await updateDoc(doc(db, "reviews", data.forkedFromReviewId), { forkCount: increment(1) });
      setAllReviews((cur) => cur.map((r) => r.id === data.forkedFromReviewId ? { ...r, forkCount: (r.forkCount || 0) + 1 } : r));
      await addDoc(collection(db, "reviewForks"), {
        originalReviewId: data.forkedFromReviewId,
        forkReviewId: "", // will update after
        forkerId: user.uid,
        forkerName: user.displayName,
        createdAt: new Date().toISOString(),
      });
    }

    // Channel metadata
    if (data.channelId) { newReview.channelId = data.channelId; }
    if (data.channelSlug) { newReview.channelSlug = data.channelSlug; }

    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setAllReviews((prev) => [{ id: docRef.id, ...newReview } as ReviewData, ...prev]);
    setForkSource(null);

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

  const handleFork = (review: ReviewData) => {
    if (!user) { handleLogin(); return; }
    setForkSource({
      reviewId: review.id,
      reviewerName: review.reviewerName || "Anonymous",
      productName: review.productName || "",
      category: review.category || "Tech",
      productId: review.productId,
    });
    setReviewMode("verified");
  };

  const getReviewCount = (campaignId: string) =>
    allReviews.filter((r) => r.campaignId === campaignId).length;

  const getTimeRemaining = (endDateStr: string) => {
    if (!endDateStr) return "Ongoing";
    const total = Date.parse(endDateStr) - currentTime;
    if (total <= 0) return "Ended";
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${minutes}m`;
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
    if (feedTab === "campaigns") {
      return baseFiltered.filter((r) => r.campaignId && r.campaignId !== "organic");
    }
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
    { id: "foryou",    label: "For you" },
    { id: "trending",  label: "Trending" },
    { id: "campaigns", label: "Campaigns" },
  ];

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 transition-colors duration-200">

      {reviewMode && user && (
        <ReviewWizard
          user={user}
          mode={reviewMode}
          forkSource={forkSource ?? undefined}
          onSubmit={handleReviewSubmit}
          onClose={() => { setReviewMode(null); setForkSource(null); }}
        />
      )}

      {showOnboarding && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-md w-full shadow-lg border border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">What are you into?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">Personalise your feed.</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {AVAILABLE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedInterests((prev) =>
                    prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                  )}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    selectedInterests.includes(cat)
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900"
                      : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleCompleteOnboarding} className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Mobile Nav */}
      <nav className="md:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40">
        {!showMobileSearch ? (
          <div className="px-3 h-12 flex justify-between items-center">
            <Link href="/" className="flex items-center">
              <Image src="/logo.svg" alt="Review Jam" width={118} height={28} priority className="dark:hidden" />
              <Image src="/logo-dark.svg" alt="Review Jam" width={118} height={28} priority className="hidden dark:block" />
            </Link>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowMobileSearch(true)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition" aria-label="Search">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-400"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </button>
              <button type="button" onClick={() => setShowMobileMenu((v) => !v)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition" aria-label="Menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-700 dark:text-slate-300"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
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
              className="flex-1 bg-slate-100 dark:bg-slate-900 rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <button type="button" onClick={() => { setShowMobileSearch(false); setSearchQuery(""); }} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium shrink-0">
              ✕
            </button>
          </div>
        )}
      </nav>

      {/* Mobile slide-down menu */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
          <div className="absolute top-0 right-0 w-72 bg-white dark:bg-slate-900 h-full shadow-xl border-l border-slate-200 dark:border-slate-800 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <div className="flex justify-end p-3">
              <button type="button" onClick={() => setShowMobileMenu(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-lg">
                ✕
              </button>
            </div>

            {/* User section */}
            <div className="px-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              {user ? (
                <div className="flex items-center gap-3">
                  <Avatar name={user.displayName} src={user.photoURL} size="lg" className="w-11 h-11" />
                  <div className="min-w-0">
                    <p className="font-semibold text-base text-slate-900 dark:text-slate-100 truncate">{user.displayName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { handleLogin(); setShowMobileMenu(false); }} className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium py-3 rounded-lg hover:opacity-90 transition">
                  Sign in with Google
                </button>
              )}
            </div>

            {/* Nav links */}
            <nav className="py-2">
              {[
                { href: "/profile",    label: "Profile",   icon: "👤" },
                { href: "/explore",    label: "Explore",   icon: "🔍" },
                { href: "/campaigns",  label: "Campaigns", icon: "🎯" },
                { href: "/brands",     label: "For brands",icon: "🏢" },
                { href: "/brands/dashboard", label: "Brand dashboard", icon: "📊" },
                { href: "/admin",      label: "Admin",     icon: "⚡" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <span aria-hidden className="text-lg w-6 text-center">{item.icon}</span> {item.label}
                </Link>
              ))}
              <button type="button" onClick={() => { toggleDarkMode(); }} className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition w-full text-left">
                <span aria-hidden className="text-lg w-6 text-center">{isDarkMode ? "☀️" : "🌙"}</span> {isDarkMode ? "Light mode" : "Dark mode"}
              </button>
            </nav>

            {/* Logout */}
            {user && (
              <div className="border-t border-slate-100 dark:border-slate-800 p-4">
                <button type="button" onClick={() => { handleLogout(); setShowMobileMenu(false); }} className="text-sm text-red-600 dark:text-red-400 font-medium">
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
        <main className="w-full md:w-[600px] md:max-w-[600px] md:shrink-0 md:border-x border-slate-200/80 dark:border-slate-800 min-h-screen">

          <div className="sticky top-12 md:top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800">
            <div className="hidden md:flex items-center h-12 px-4 border-b border-slate-100 dark:border-slate-800/80">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Home</h1>
            </div>

            {/* Feed Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800/80">
              {FEED_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedTab(tab.id)}
                  className={`flex-1 py-3.5 md:py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    feedTab === tab.id
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
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
                className="w-full bg-slate-100 dark:bg-slate-900/80 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500 border border-slate-200/80 dark:border-slate-800"
              />
              <div className="relative mt-2.5 flex items-center">
                <button type="button" onClick={() => scrollCategories("left")} className="absolute left-0 z-10 p-1 bg-gradient-to-r from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition h-full flex items-center justify-start w-8" aria-label="Scroll left">
                  <span className="text-lg leading-none">‹</span>
                </button>
                <div ref={categoriesRef} className="flex gap-1.5 overflow-x-auto snap-x scroll-smooth px-7 w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <button type="button" onClick={() => setActiveCategoryFilter("All")} className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border transition snap-start ${activeCategoryFilter === "All" ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/30" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-300 hover:text-amber-600 dark:hover:border-amber-700 dark:hover:text-amber-400"}`}>
                    All
                  </button>
                  {AVAILABLE_CATEGORIES.map((cat) => (
                    <button type="button" key={cat} onClick={() => setActiveCategoryFilter(cat)} className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border transition snap-start ${activeCategoryFilter === cat ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/30" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-300 hover:text-amber-600 dark:hover:border-amber-700 dark:hover:text-amber-400"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => scrollCategories("right")} className="absolute right-0 z-10 p-1 bg-gradient-to-l from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition h-full flex items-center justify-end w-8" aria-label="Scroll right">
                  <span className="text-lg leading-none">›</span>
                </button>
              </div>
            </div>

            {/* Mobile: horizontal category chips only (no search, no arrows) */}
            <div className="md:hidden px-3 py-2">
              <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button type="button" onClick={() => setActiveCategoryFilter("All")} className={`whitespace-nowrap px-3.5 py-2 rounded-full text-[13px] font-medium border transition shrink-0 ${activeCategoryFilter === "All" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"}`}>
                  All
                </button>
                {AVAILABLE_CATEGORIES.map((cat) => (
                  <button type="button" key={cat} onClick={() => setActiveCategoryFilter(cat)} className={`whitespace-nowrap px-3.5 py-2 rounded-full text-[13px] font-medium border transition shrink-0 ${activeCategoryFilter === cat ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Campaigns strip — tablet only (mobile uses bottom nav Campaigns tab) */}
          <div className="hidden md:block lg:hidden border-b border-slate-200/80 dark:border-slate-800 px-3 py-3 bg-slate-50/80 dark:bg-slate-900/40">
            <h3 className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Active pools</h3>
            <div className="flex gap-2 overflow-x-auto snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {products.map((product) => (
                <Link href={`/product/${product.id}`} key={product.id} className="min-w-[220px] snap-start bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-medium text-xs text-slate-900 dark:text-slate-100 line-clamp-1">{product.name}</h4>
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded shrink-0">Live</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                    <span>{getTimeRemaining(product.endDate)}</span>
                    <span>{getReviewCount(product.campaignId)} reviews</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Feed */}
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
            ) : displayedReviews.length === 0 ? (
              <div className="py-14 px-6 text-center flex flex-col items-center max-w-sm mx-auto">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-sm mb-3 text-slate-400">📝</div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">No posts yet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-500 mb-5 leading-relaxed">
                  {feedTab === "campaigns" ? "No campaign reviews yet." : "When people review in this view, they will show up here."}
                </p>
                {feedTab !== "campaigns" && (
                  <button type="button" onClick={() => { if (!user) handleLogin(); else setReviewMode("verified"); }} className="text-sm font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-full hover:opacity-90 transition">
                    Write a review
                  </button>
                )}
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
                  onFork={handleFork}
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
        className="md:hidden fixed bottom-[76px] right-4 z-40 w-14 h-14 rounded-full btn-brand flex items-center justify-center active:scale-95 transition"
        aria-label="Post a review"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </main>
  );
}

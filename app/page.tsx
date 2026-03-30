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
import ReviewCard from "./components/ReviewCard";

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

  const [showReviewWizard, setShowReviewWizard] = useState(false);
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
      fetchedReviews.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
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

    // AI validation
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

    // Save to Firestore
    const newReview = {
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
      marketingQuote: agentData.analysis?.marketingQuote || data.summary || "",
      pros: data.pros,
      cons: data.cons,
      summary: data.summary,
      productSource: data.productSource,
      usageDuration: data.usageDuration,
      purchaseChannel: data.purchaseChannel,
      subRatings: data.subRatings,
      bestFor: data.bestFor,
      mediaUrls,
      isCampaignReview: false,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setAllReviews((prev) => [{ id: docRef.id, ...newReview }, ...prev]);

    // Update badges in background
    updateUserBadges(user.uid).catch(() => {});
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

      {showReviewWizard && user && (
        <ReviewWizard
          user={user}
          mode="organic"
          onSubmit={handleReviewSubmit}
          onClose={() => setShowReviewWizard(false)}
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
      <nav className="md:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40 px-3 h-12 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <Image src="/logo.svg" alt="Review Jam" width={118} height={28} priority className="dark:hidden" />
          <Image src="/logo-dark.svg" alt="Review Jam" width={118} height={28} priority className="hidden dark:block" />
        </Link>
        {user ? (
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-medium">
            {user.displayName?.charAt(0)}
          </div>
        ) : (
          <button onClick={handleLogin} className="text-sm font-medium text-slate-900 dark:text-slate-100 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900">
            Sign in
          </button>
        )}
      </nav>

      <div className="max-w-7xl mx-auto flex justify-center">

        {/* Left Nav */}
        <aside className="hidden md:flex flex-col w-[260px] xl:w-[275px] h-screen sticky top-0 border-r border-slate-200/80 dark:border-slate-800 px-3 py-4 pr-4 xl:pr-6">
          <Link href="/" className="mb-6 px-2">
            <Image src="/logo.svg" alt="Review Jam" width={152} height={36} priority className="dark:hidden" />
            <Image src="/logo-dark.svg" alt="Review Jam" width={152} height={36} priority className="hidden dark:block" />
          </Link>

          <nav className="flex flex-col gap-0.5 mb-6">
            {[
              { href: "/",           label: "Home",      icon: "🏠",  onClick: () => setActiveCategoryFilter("All") },
              { href: "/explore",    label: "Explore",   icon: "🔍" },
              { href: "/campaigns",  label: "Campaigns", icon: "🎯" },
              { href: "/brands",     label: "For brands",icon: "🏢" },
              { href: "/brands/dashboard", label: "Brand dashboard", icon: "📊" },
              { href: "/admin",      label: "Admin",     icon: "⚡" },
              { href: "/profile",    label: "Profile",   icon: "👤" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={item.onClick}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition"
              >
                <span aria-hidden>{item.icon}</span> {item.label}
              </Link>
            ))}
            <button type="button" onClick={toggleDarkMode} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition w-full text-left">
              <span aria-hidden>{isDarkMode ? "☀️" : "🌙"}</span> {isDarkMode ? "Light" : "Dark"}
            </button>
          </nav>

          <button
            type="button"
            onClick={() => { if (!user) handleLogin(); else setShowReviewWizard(true); }}
            className="w-full max-w-[200px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium py-2.5 px-4 rounded-full hover:bg-slate-800 dark:hover:bg-white transition"
          >
            Post
          </button>
        </aside>

        {/* Center: Feed */}
        <main className="w-full md:w-[600px] md:max-w-[600px] md:shrink-0 border-x border-slate-200/80 dark:border-slate-800 min-h-screen pb-20 md:pb-0">

          <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800">
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
                  className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    feedTab === tab.id
                      ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-3 md:px-4 md:py-3">
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
                  <button type="button" onClick={() => setActiveCategoryFilter("All")} className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border transition snap-start ${activeCategoryFilter === "All" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
                    All
                  </button>
                  {AVAILABLE_CATEGORIES.map((cat) => (
                    <button type="button" key={cat} onClick={() => setActiveCategoryFilter(cat)} className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border transition snap-start ${activeCategoryFilter === cat ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
                      {cat}
                    </button>
                  ))}
                </div>

                <button type="button" onClick={() => scrollCategories("right")} className="absolute right-0 z-10 p-1 bg-gradient-to-l from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition h-full flex items-center justify-end w-8" aria-label="Scroll right">
                  <span className="text-lg leading-none">›</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile campaigns strip */}
          <div className="lg:hidden border-b border-slate-200/80 dark:border-slate-800 px-3 py-3 bg-slate-50/80 dark:bg-slate-900/40">
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
                  <button type="button" onClick={() => { if (!user) handleLogin(); else setShowReviewWizard(true); }} className="text-sm font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-full hover:opacity-90 transition">
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
                  showPoolLink
                />
              ))
            )}
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="hidden lg:block w-[300px] xl:w-[320px] pl-6 xl:pl-8 py-4 sticky top-0 h-screen overflow-y-auto text-[13px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="rounded-xl p-3 mb-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-medium">
              {user ? user.displayName?.charAt(0) : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-900 dark:text-slate-100 leading-tight truncate">{user ? user.displayName : "Guest"}</p>
              {user ? (
                <button type="button" onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 mt-0.5 transition">Log out</button>
              ) : (
                <button type="button" onClick={handleLogin} className="text-xs text-slate-600 dark:text-slate-400 hover:underline mt-0.5">Sign in</button>
              )}
            </div>
          </div>

          <div className="rounded-xl p-4 mb-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-3">Trending</h2>
            <div className="space-y-3">
              {trendingInsights.length > 0 ? trendingInsights.map((insight) => (
                <div key={insight.id}>
                  <p className="text-[11px] text-slate-500 dark:text-slate-500 mb-0.5">{insight.productName || insight.category}</p>
                  <p className="text-[13px] text-slate-800 dark:text-slate-200 leading-snug">"{insight.summary || insight.marketingQuote}"</p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-500 mt-1">{insight.reviewerName}</p>
                </div>
              )) : <p className="text-[13px] text-slate-500 dark:text-slate-500">Nothing trending yet.</p>}
            </div>
          </div>

          <div className="rounded-xl p-4 mb-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-3">Active pools</h2>
            <div className="space-y-3">
              {products.length > 0 ? products.map((product) => (
                <Link href={`/product/${product.id}`} key={product.id} className="block group py-1 -mx-1 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <div className="flex justify-between items-start gap-2 mb-0.5">
                    <h4 className="font-medium text-[13px] text-slate-900 dark:text-slate-100 group-hover:underline truncate pr-1">{product.name}</h4>
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">Live</span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-500 mb-1">{product.brandName}</p>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-500">
                    <span>{new Date(product.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    <span className="tabular-nums">{getReviewCount(product.campaignId)} reviews</span>
                  </div>
                </Link>
              )) : <p className="text-[13px] text-slate-500 dark:text-slate-500">No pools right now.</p>}
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500 dark:text-slate-600 flex flex-wrap gap-x-3 gap-y-1 px-1">
            <Link href="/brands" className="hover:underline">For brands</Link>
            <Link href="/explore" className="hover:underline">Explore</Link>
            <Link href="/campaigns" className="hover:underline">Campaigns</Link>
            <span className="hover:underline cursor-pointer">Terms</span>
            <span className="hover:underline cursor-pointer">Privacy</span>
            <p className="w-full mt-2 text-slate-400 dark:text-slate-600">© 2026 Review Jam</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

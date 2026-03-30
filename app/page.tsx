"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link"; 
import Image from "next/image";
import { collection, getDocs, doc, getDoc, setDoc, addDoc } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth"; 
import { db, auth, googleProvider } from "../lib/firebase";

const AVAILABLE_CATEGORIES = ["Tech", "Home", "SaaS", "Automotive", "Beauty", "Gaming", "Fitness", "Travel", "Finance"];

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  
  const [user, setUser] = useState<User | null>(null);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("All");
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showOrganicModal, setShowOrganicModal] = useState(false);
  const [organicProduct, setOrganicProduct] = useState("");
  const [organicCategory, setOrganicCategory] = useState(AVAILABLE_CATEGORIES[0]);
  const [organicRating, setOrganicRating] = useState(5);
  const [organicContent, setOrganicContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isDarkMode, setIsDarkMode] = useState(false);

  // NEW: Reference for the Category Slider
  const categoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
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
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDarkMode(true);
    }
  };

  // NEW: Arrow Scrolling Function
  const scrollCategories = (direction: "left" | "right") => {
    if (categoriesRef.current) {
      const scrollAmount = 250;
      categoriesRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  async function fetchInitialData() {
    setIsLoading(true);
    try {
      const prodSnap = await getDocs(collection(db, "products"));
      const fetchedProducts: any[] = [];
      prodSnap.forEach((doc) => fetchedProducts.push({ id: doc.id, ...doc.data() }));
      setProducts(fetchedProducts);

      const revSnap = await getDocs(collection(db, "reviews"));
      const fetchedReviews: any[] = [];
      revSnap.forEach((doc) => fetchedReviews.push({ id: doc.id, ...doc.data() }));
      fetchedReviews.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
      setAllReviews(fetchedReviews);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) {} };
  const handleLogout = async () => { try { await signOut(auth); setUserInterests([]); } catch (error) {} };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email, displayName: user.displayName, interests: selectedInterests, walletBalance: 0, createdAt: new Date().toISOString()
      });
      setUserInterests(selectedInterests);
      setShowOnboarding(false);
    } catch (error) {}
  };

  const handleSubmitOrganicReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organicContent.trim() || !organicProduct.trim()) return;
    setIsSubmitting(true);

    try {
      const agentResponse = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewContent: organicContent, reviewerName: user.displayName }),
      });
      const agentData = await agentResponse.json();

      if (!agentResponse.ok || !agentData?.success || !agentData?.analysis) {
        const serverMsg =
          typeof agentData?.error === "string" && agentData.error.trim()
            ? agentData.error
            : "Unable to validate this review right now. Please try again.";
        alert(serverMsg);
        setIsSubmitting(false);
        return;
      }

      if (agentData.analysis.isGenuine !== true) {
        alert(`Rejected by AI Quality Control: ${agentData.analysis.reason || "Review quality check failed."}`);
        setIsSubmitting(false);
        return;
      }

      const newReview = {
        content: organicContent,
        rating: organicRating,
        reviewerId: user.uid,
        reviewerName: user.displayName,
        productId: `organic_${Date.now()}`,
        productName: organicProduct, 
        category: organicCategory,
        campaignId: "organic", 
        likesCount: 0,
        likedBy: [],
        marketingQuote: agentData.analysis?.marketingQuote || "",
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "reviews"), newReview);
      setAllReviews([{ id: docRef.id, ...newReview }, ...allReviews]);
      setShowOrganicModal(false);
      setOrganicProduct(""); setOrganicContent(""); setOrganicRating(5);
      alert("Organic review published!");

    } catch (error) {
      console.error("Error adding organic review:", error);
      alert("Failed to post review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReviewCount = (campaignId: string) => allReviews.filter(r => r.campaignId === campaignId).length;

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

  const displayedReviews = allReviews.filter(review => {
    const matchesSearch = review.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (review.marketingQuote && review.marketingQuote.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (review.productName && review.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    let matchesCategory = true;
    if (activeCategoryFilter !== "All") matchesCategory = review.category === activeCategoryFilter;
    else if (userInterests.length > 0 && searchQuery === "") matchesCategory = userInterests.includes(review.category);

    return matchesSearch && matchesCategory;
  });

  const trendingInsights = allReviews.filter(r => r.marketingQuote && r.likesCount > 0).slice(0, 3);

  return (
    // NEW: Added 'antialiased' here to thin out the font rendering globally!
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 transition-colors duration-200">
      
      {/* MODAL */}
      {showOrganicModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-md w-full shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">New review</h2>
              <button type="button" onClick={() => setShowOrganicModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleSubmitOrganicReview} className="space-y-3">
              <div>
                <input type="text" value={organicProduct} onChange={(e) => setOrganicProduct(e.target.value)} required placeholder="Product name" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500" />
              </div>
              <div className="flex gap-2">
                <select value={organicCategory} onChange={(e) => setOrganicCategory(e.target.value)} className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-slate-100">
                  {AVAILABLE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select value={organicRating} onChange={(e) => setOrganicRating(Number(e.target.value))} className="w-[4.5rem] shrink-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm outline-none dark:text-slate-100">
                  {[5, 4, 3, 2, 1].map(num => <option key={num} value={num}>{num} ★</option>)}
                </select>
              </div>
              <div>
                <textarea value={organicContent} onChange={(e) => setOrganicContent(e.target.value)} required placeholder="Share your experience…" className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm h-28 resize-y focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button 
                  type="button" 
                  onClick={() => setShowOrganicModal(false)} 
                  className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="flex-[1.4] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition disabled:opacity-50"
                >
                {isSubmitting ? "Checking…" : "Post"}
              </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE TOP NAVIGATION */}
      <nav className="md:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40 px-3 h-12 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <Image src="/logo.svg" alt="Review Jam" width={118} height={28} priority className="dark:hidden" />
          <Image src="/logo-dark.svg" alt="Review Jam" width={118} height={28} priority className="hidden dark:block" />
        </Link>
        {user ? (
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-medium">{user.displayName?.charAt(0)}</div>
        ) : (
          <button onClick={handleLogin} className="text-sm font-medium text-slate-900 dark:text-slate-100 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900">Sign in</button>
        )}
      </nav>

      {/* MAIN LAYOUT */}
      <div className="max-w-7xl mx-auto flex justify-center">
        
        {/* LEFT COLUMN: Fixed Navigation */}
        <aside className="hidden md:flex flex-col w-[260px] xl:w-[275px] h-screen sticky top-0 border-r border-slate-200/80 dark:border-slate-800 px-3 py-4 pr-4 xl:pr-6">
          <Link href="/" className="mb-6 px-2">
            <Image src="/logo.svg" alt="Review Jam" width={152} height={36} priority className="dark:hidden" />
            <Image src="/logo-dark.svg" alt="Review Jam" width={152} height={36} priority className="hidden dark:block" />
          </Link>

          <nav className="flex flex-col gap-0.5 mb-6">
            <button type="button" onClick={() => setActiveCategoryFilter("All")} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition text-left ${activeCategoryFilter === "All" ? "bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/80"}`}>
              <span className="text-base opacity-90" aria-hidden>🏠</span> Home
            </button>
            <Link href="/brands" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition">
              <span className="text-base opacity-90" aria-hidden>🏢</span> For brands
            </Link>
            <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition">
              <span className="text-base opacity-90" aria-hidden>⚡</span> Admin
            </Link>
            <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition">
              <span className="text-base opacity-90" aria-hidden>👤</span> Profile
            </Link>
            <button type="button" onClick={toggleDarkMode} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition w-full text-left">
              <span className="text-base opacity-90" aria-hidden>{isDarkMode ? "☀️" : "🌙"}</span> {isDarkMode ? "Light" : "Dark"}
            </button>
          </nav>

          <button type="button" onClick={() => { if (!user) handleLogin(); else setShowOrganicModal(true); }} className="w-full max-w-[200px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium py-2.5 px-4 rounded-full hover:bg-slate-800 dark:hover:bg-white transition">
            Post
          </button>
        </aside>

        {/* CENTER COLUMN: The Feed */}
        <main className="w-full md:w-[600px] md:max-w-[600px] md:shrink-0 border-x border-slate-200/80 dark:border-slate-800 min-h-screen pb-20 md:pb-0">
          
          <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800">
            <div className="hidden md:flex items-center h-12 px-4 border-b border-slate-100 dark:border-slate-800/80">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Home</h1>
            </div>
            <div className="p-3 md:px-4 md:py-3">
            <input type="search" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900/80 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500 border border-slate-200/80 dark:border-slate-800" />
            
            <div className="relative mt-2.5 flex items-center">
              <button 
                type="button"
                onClick={() => scrollCategories("left")} 
                className="absolute left-0 z-10 p-1 bg-gradient-to-r from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition h-full flex items-center justify-start w-8"
                aria-label="Scroll categories left"
              >
                <span className="text-lg leading-none">‹</span>
              </button>

              <div 
                ref={categoriesRef} 
                className="flex gap-1.5 overflow-x-auto snap-x scroll-smooth px-7 w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                <button type="button" onClick={() => setActiveCategoryFilter("All")} className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border transition snap-start ${activeCategoryFilter === "All" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"}`}>For you</button>
                {AVAILABLE_CATEGORIES.map(cat => (
                  <button type="button" key={cat} onClick={() => setActiveCategoryFilter(cat)} className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-medium border transition snap-start ${activeCategoryFilter === cat ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"}`}>{cat}</button>
                ))}
              </div>

              <button 
                type="button"
                onClick={() => scrollCategories("right")} 
                className="absolute right-0 z-10 p-1 bg-gradient-to-l from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition h-full flex items-center justify-end w-8"
                aria-label="Scroll categories right"
              >
                <span className="text-lg leading-none">›</span>
              </button>
            </div>
            </div>
          </div>

          {/* Mobile Only: Active Campaigns Swipe Row */}
          <div className="lg:hidden border-b border-slate-200/80 dark:border-slate-800 px-3 py-3 bg-slate-50/80 dark:bg-slate-900/40">
            <h3 className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Active pools</h3>
            <div className="flex gap-2 overflow-x-auto snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {products.map(product => (
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

          {/* Feed Content */}
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {isLoading ? (
               <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
            ) : displayedReviews.length === 0 ? (
              <div className="py-14 px-6 text-center flex flex-col items-center max-w-sm mx-auto">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-sm mb-3 text-slate-400">📝</div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">No posts yet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-500 mb-5 leading-relaxed">When people review in this view, they will show up here.</p>
                <button type="button" onClick={() => { if (!user) handleLogin(); else setShowOrganicModal(true); }} className="text-sm font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-full hover:opacity-90 transition">Write a review</button>
              </div>
            ) : (
              displayedReviews.map(review => (
                <article key={review.id} className="px-3 py-3 md:px-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-medium">
                      {review.reviewerName?.charAt(0) || "A"}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1 min-w-0 flex-wrap text-[15px] leading-tight">
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[10rem] sm:max-w-none">{review.reviewerName || "Anonymous"}</span>
                          <span className="text-slate-500 dark:text-slate-500 text-[13px]">· {review.category}</span>
                        </div>
                        <span className="text-[11px] font-medium text-amber-800 dark:text-amber-400/90 tabular-nums shrink-0">★ {review.rating}</span>
                      </div>
                      
                      {review.productName && <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-1">{review.productName}</p>}
                      
                      <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed font-normal mb-2 whitespace-pre-wrap">{review.content}</p>
                      
                      {review.marketingQuote && (
                        <div className="mb-2 border-l border-slate-300 dark:border-slate-600 pl-2.5">
                          <p className="text-[13px] text-slate-500 dark:text-slate-500 leading-snug">"{review.marketingQuote}"</p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-500 max-w-md text-[13px]">
                        <button type="button" className="flex items-center gap-1.5 font-medium hover:text-slate-800 dark:hover:text-slate-300 rounded-md py-0.5 -ml-1 px-1 hover:bg-slate-100/80 dark:hover:bg-slate-800/50">
                          <span className="opacity-80" aria-hidden>👍</span> {review.likesCount || 0}
                        </button>
                        {review.campaignId !== "organic" && (
                          <Link href={`/product/${review.productId}`} className="font-medium text-slate-600 dark:text-slate-400 hover:underline shrink-0">
                            Pool →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </main>

        {/* RIGHT COLUMN: Trending & Active Campaigns */}
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
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-3">
              Trending
            </h2>
            <div className="space-y-3">
              {trendingInsights.length > 0 ? trendingInsights.map(insight => (
                <div key={insight.id} className="cursor-default">
                  <p className="text-[11px] text-slate-500 dark:text-slate-500 mb-0.5">{insight.productName || insight.category}</p>
                  <p className="text-[13px] text-slate-800 dark:text-slate-200 leading-snug">"{insight.marketingQuote}"</p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-500 mt-1">{insight.reviewerName}</p>
                </div>
              )) : (
                <p className="text-[13px] text-slate-500 dark:text-slate-500 leading-relaxed">Nothing trending yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-3">
              Active pools
            </h2>
            <div className="space-y-3">
              {products.length > 0 ? products.map((product) => (
                <Link href={`/product/${product.id}`} key={product.id} className="block group py-1 -mx-1 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <div className="flex justify-between items-start gap-2 mb-0.5">
                    <h4 className="font-medium text-[13px] text-slate-900 dark:text-slate-100 group-hover:underline truncate pr-1">{product.name}</h4>
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">Live</span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-500 mb-1">{product.brandName}</p>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-500">
                    <span>{new Date(product.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    <span className="tabular-nums">{getReviewCount(product.campaignId)} reviews</span>
                  </div>
                </Link>
              )) : (
                <p className="text-[13px] text-slate-500 dark:text-slate-500">No pools right now.</p>
              )}
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500 dark:text-slate-600 flex flex-wrap gap-x-3 gap-y-1 px-1">
            <Link href="/brands" className="hover:underline">For brands</Link>
            <span className="hover:underline cursor-pointer">Terms</span>
            <span className="hover:underline cursor-pointer">Privacy</span>
            <p className="w-full mt-2 text-slate-400 dark:text-slate-600">© 2026 Review Jam</p>
          </div>
        </aside>

      </div>
    </main>
  );
}
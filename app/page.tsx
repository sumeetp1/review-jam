"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link"; 
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

      if (agentData.analysis && agentData.analysis.isGenuine === false) {
        alert(`Rejected by AI Quality Control: ${agentData.analysis.reason}`);
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
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 antialiased">
      
      {/* MODAL */}
      {showOrganicModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-xl border border-transparent dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">Draft a Review</h2>
              <button onClick={() => setShowOrganicModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold">✕</button>
            </div>
            <form onSubmit={handleSubmitOrganicReview} className="space-y-4">
              <div>
                <input type="text" value={organicProduct} onChange={(e) => setOrganicProduct(e.target.value)} required placeholder="Product Name (e.g. Dyson V15)" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500 outline-none dark:text-white dark:placeholder-slate-500" />
              </div>
              <div className="flex gap-4">
                <select value={organicCategory} onChange={(e) => setOrganicCategory(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm outline-none dark:text-white">
                  {AVAILABLE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select value={organicRating} onChange={(e) => setOrganicRating(Number(e.target.value))} className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm outline-none dark:text-white">
                  {[5, 4, 3, 2, 1].map(num => <option key={num} value={num}>{num} ★</option>)}
                </select>
              </div>
              <div>
                <textarea value={organicContent} onChange={(e) => setOrganicContent(e.target.value)} required placeholder="What's your honest take?" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm h-32 focus:ring-1 focus:ring-indigo-500 outline-none dark:text-white dark:placeholder-slate-500" />
              </div>
              {/* --- NEW: CANCEL & SUBMIT BUTTONS --- */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowOrganicModal(false)} 
                  className="w-1/3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-2.5 rounded-lg font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-2/3 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50"
                >
                {isSubmitting ? "AI Quality Check..." : "Post Review"}
              </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE TOP NAVIGATION */}
      <nav className="md:hidden bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 h-14 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">Review Jam</h1>
        {user ? (
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-semibold text-sm">{user.displayName?.charAt(0)}</div>
        ) : (
          <button onClick={handleLogin} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Sign In</button>
        )}
      </nav>

      {/* MAIN LAYOUT */}
      <div className="max-w-7xl mx-auto flex justify-center">
        
        {/* LEFT COLUMN: Fixed Navigation */}
        <aside className="hidden md:flex flex-col w-[275px] h-screen sticky top-0 border-r border-slate-100 dark:border-slate-800 p-4 pt-6 pr-8">
          <Link href="/" className="mb-8 px-4">
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">Review Jam</h1>
          </Link>

          <nav className="flex flex-col gap-1 mb-8">
            <button onClick={() => setActiveCategoryFilter("All")} className={`flex items-center gap-4 px-4 py-3 rounded-full font-semibold text-[17px] transition ${activeCategoryFilter === "All" ? "font-bold bg-slate-50 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"}`}>
              <span className="text-xl">🏠</span> Home
            </button>
            <Link href="/brands" className="flex items-center gap-4 px-4 py-3 rounded-full font-semibold text-[17px] hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition">
              <span className="text-xl">🏢</span> For Brands
            </Link>
            <Link href="/admin" className="flex items-center gap-4 px-4 py-3 rounded-full font-semibold text-[17px] hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition">
              <span className="text-xl">⚡</span> Admin Center
            </Link>
            <Link href="/profile" className="flex items-center gap-4 px-4 py-3 rounded-full font-semibold text-[17px] hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition">
              <span className="text-xl">👤</span> Profile
            </Link>
            
            {/* DARK MODE TOGGLE */}
            <button onClick={toggleDarkMode} className="flex items-center gap-4 px-4 py-3 rounded-full font-semibold text-[17px] hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition w-full text-left">
              <span className="text-xl">{isDarkMode ? "☀️" : "🌙"}</span> {isDarkMode ? "Light Mode" : "Dark Mode"}
            </button>
          </nav>

          <button onClick={() => { if (!user) handleLogin(); else setShowOrganicModal(true); }} className="w-full bg-indigo-600 text-white font-bold text-[17px] py-3.5 rounded-full shadow hover:bg-indigo-700 transition">
            Post a Review
          </button>

        
        </aside>

        {/* CENTER COLUMN: The Feed */}
        <main className="w-full md:w-[600px] border-r border-slate-100 dark:border-slate-800 min-h-screen pb-20 md:pb-0">
          
          {/* Sticky Header & Search */}
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 p-4 pb-2">
            <input type="text" placeholder="Search products, brands, or reviews..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-100 dark:bg-slate-900 rounded-full px-5 py-2 text-sm outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 transition dark:text-white dark:placeholder-slate-500 border border-transparent dark:border-slate-700" />
            
            {/* NEW: Arrow Controlled Categories */}
            <div className="relative mt-3 flex items-center">
              
              {/* Left Arrow Button */}
              <button 
                onClick={() => scrollCategories("left")} 
                className="absolute left-0 z-10 p-1 bg-gradient-to-r from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 text-slate-400 hover:text-slate-800 dark:hover:text-white transition h-full flex items-center justify-start w-10"
              >
                <span className="text-xl -mt-1 font-bold">‹</span>
              </button>

              {/* The Hidden Scrollbar Container */}
              <div 
                ref={categoriesRef} 
                className="flex gap-2 overflow-x-auto snap-x scroll-smooth px-6 w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                <button onClick={() => setActiveCategoryFilter("All")} className={`whitespace-nowrap px-4 py-1.5 rounded-full font-semibold text-[13px] border transition snap-start ${activeCategoryFilter === "All" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"}`}>For You</button>
                {AVAILABLE_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategoryFilter(cat)} className={`whitespace-nowrap px-4 py-1.5 rounded-full font-semibold text-[13px] border transition snap-start ${activeCategoryFilter === cat ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"}`}>{cat}</button>
                ))}
              </div>

              {/* Right Arrow Button */}
              <button 
                onClick={() => scrollCategories("right")} 
                className="absolute right-0 z-10 p-1 bg-gradient-to-l from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 text-slate-400 hover:text-slate-800 dark:hover:text-white transition h-full flex items-center justify-end w-10"
              >
                <span className="text-xl -mt-1 font-bold">›</span>
              </button>
            </div>
          </div>

          {/* Mobile Only: Active Campaigns Swipe Row */}
          <div className="lg:hidden border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/30">
            <h3 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">🔥 Active Reward Pools</h3>
            <div className="flex gap-3 overflow-x-auto snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {products.map(product => (
                <Link href={`/product/${product.id}`} key={product.id} className="min-w-[240px] snap-start bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-[13px] text-slate-900 dark:text-white line-clamp-1">{product.name}</h4>
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 rounded">Pool</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                    <span>⏳ {getTimeRemaining(product.endDate)}</span>
                    <span>📝 {getReviewCount(product.campaignId)} revs</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Feed Content */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
               <div className="p-8 text-center text-slate-400 font-medium animate-pulse text-sm">Loading feed...</div>
            ) : displayedReviews.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-xl mb-4 text-slate-400">📝</div>
                <h3 className="font-semibold text-[17px] text-slate-900 dark:text-slate-100 mb-1">Nothing here yet</h3>
                <p className="text-[15px] text-slate-500 dark:text-slate-400 mb-6">Be the first to share your thoughts in this category.</p>
                <button onClick={() => { if (!user) handleLogin(); else setShowOrganicModal(true); }} className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-5 py-2 rounded-full text-[15px]">Draft a Review</button>
              </div>
            ) : (
              displayedReviews.map(review => (
                <article key={review.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition cursor-pointer">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-sm">
                      {review.reviewerName?.charAt(0) || "A"}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 hover:underline">{review.reviewerName || "Anonymous"}</span>
                          <span className="text-[14px] text-slate-500 dark:text-slate-400 truncate">· {review.category}</span>
                        </div>
                        <span className="text-[11px] font-bold text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded">★ {review.rating}</span>
                      </div>
                      
                      {review.productName && <p className="text-[13px] font-medium text-indigo-600 dark:text-indigo-400 mb-1">{review.productName}</p>}
                      
                      <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-normal mb-3 whitespace-pre-wrap">{review.content}</p>
                      
                      {review.marketingQuote && (
                        <div className="mb-3 border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                          <p className="text-[14px] text-slate-500 dark:text-slate-400 font-medium leading-snug">"{review.marketingQuote}"</p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 max-w-md">
                        <button className="flex items-center gap-1.5 text-[13px] font-medium hover:text-indigo-600 dark:hover:text-indigo-400 group">
                          <span className="p-1.5 rounded-full group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition">👍</span> {review.likesCount || 0}
                        </button>
                        {review.campaignId !== "organic" && (
                          <Link href={`/product/${review.productId}`} className="text-[13px] font-semibold text-green-600 dark:text-green-400 hover:underline">
                            View Reward Pool →
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
        <aside className="hidden lg:block w-[350px] pl-8 py-6 sticky top-0 h-screen overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* TOP RIGHT PROFILE WIDGET */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 mb-6 border border-slate-100 dark:border-slate-800/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-sm">
              {user ? user.displayName?.charAt(0) : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] leading-tight text-slate-900 dark:text-slate-100 truncate">{user ? user.displayName : "Guest Mode"}</p>
              {user ? (
                <button onClick={handleLogout} className="text-[12px] text-red-500 hover:text-red-600 font-bold mt-0.5 transition">Log out</button>
              ) : (
                <button onClick={handleLogin} className="text-[12px] text-indigo-500 hover:text-indigo-600 font-bold mt-0.5 transition">Sign in securely</button>
              )}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 mb-6 border border-slate-100 dark:border-slate-800/60">
            <h2 className="text-[17px] font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              ✨ Trending Insights
            </h2>
            <div className="space-y-4">
              {trendingInsights.length > 0 ? trendingInsights.map(insight => (
                <div key={insight.id} className="cursor-pointer group">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{insight.productName || insight.category}</p>
                  <p className="text-[14px] text-slate-800 dark:text-slate-200 font-medium leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">"{insight.marketingQuote}"</p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">— {insight.reviewerName}</p>
                </div>
              )) : (
                <p className="text-[14px] text-slate-500 dark:text-slate-400">Not enough data to generate insights yet.</p>
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/60">
            <h2 className="text-[17px] font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              💰 Active Pools
            </h2>
            <div className="space-y-4">
              {products.length > 0 ? products.map((product) => (
                <Link href={`/product/${product.id}`} key={product.id} className="block group">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="font-semibold text-[14px] text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate pr-2">{product.name}</h4>
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 rounded flex-shrink-0">Live</span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-2">by {product.brandName}</p>
                  <div className="flex justify-between items-center text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    <span>Ends: {new Date(product.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">{getReviewCount(product.campaignId)} entries</span>
                  </div>
                </Link>
              )) : (
                <p className="text-[14px] text-slate-500 dark:text-slate-400">No active pools right now.</p>
              )}
            </div>
          </div>

          <div className="mt-8 text-[13px] text-slate-500 dark:text-slate-500 flex flex-wrap gap-x-3 gap-y-1 px-2">
            <Link href="/brands" className="hover:underline">For Brands</Link>
            <span className="hover:underline cursor-pointer">Terms of Service</span>
            <span className="hover:underline cursor-pointer">Privacy Policy</span>
            <p className="w-full mt-2">© 2026 Review Jam</p>
          </div>
        </aside>

      </div>
    </main>
  );
}
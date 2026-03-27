"use client";

import { useEffect, useState } from "react";
import Link from "next/link"; 
import { collection, getDocs, doc, getDoc, setDoc, addDoc } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth"; 
import { db, auth, googleProvider } from "../lib/firebase";

const AVAILABLE_CATEGORIES = ["Tech", "Home", "SaaS", "Automotive", "Beauty", "Gaming"];

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

  // LIVE TIMER STATE
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
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

  // Update timer every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  // HELPER FUNCTIONS FOR TIMER AND COUNTS
  const getReviewCount = (campaignId: string) => {
    return allReviews.filter(r => r.campaignId === campaignId).length;
  };

  const getTimeRemaining = (endDateStr: string) => {
    if (!endDateStr) return "Ongoing";
    const total = Date.parse(endDateStr) - currentTime;
    if (total <= 0) return "Ended";
    
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h ${minutes}m left`;
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* ORGANIC REVIEW MODAL */}
      {showOrganicModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-900">Write a Review</h2>
              <button onClick={() => setShowOrganicModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSubmitOrganicReview} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Product or Service Name</label>
                <input type="text" value={organicProduct} onChange={(e) => setOrganicProduct(e.target.value)} required placeholder="e.g., Dyson V15 Vacuum" className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                  <select value={organicCategory} onChange={(e) => setOrganicCategory(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 outline-none">
                    {AVAILABLE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Rating</label>
                  <select value={organicRating} onChange={(e) => setOrganicRating(Number(e.target.value))} className="w-full border border-slate-300 rounded-xl p-3 outline-none">
                    {[5, 4, 3, 2, 1].map(num => <option key={num} value={num}>{num} ★</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Your Review</label>
                <textarea value={organicContent} onChange={(e) => setOrganicContent(e.target.value)} required placeholder="What are your honest thoughts?" className="w-full border border-slate-300 rounded-xl p-3 h-32 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition disabled:bg-indigo-300">
                {isSubmitting ? "Processing with AI..." : "Publish Review"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ONBOARDING MODAL */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-10 max-w-lg w-full text-center shadow-2xl border border-slate-100">
             <h2 className="text-3xl font-black text-slate-900 mb-2">Welcome to Review Jam!</h2>
             <p className="text-slate-500 mb-8 text-lg">Pick a few categories you love to personalize your feed.</p>
             <div className="flex flex-wrap justify-center gap-3 mb-10">
               {AVAILABLE_CATEGORIES.map(cat => (
                 <button key={cat} onClick={() => setSelectedInterests(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                   className={`px-5 py-2.5 rounded-full font-bold transition-all duration-200 ${selectedInterests.includes(cat) ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                 >
                   {cat}
                 </button>
               ))}
             </div>
             <button onClick={handleCompleteOnboarding} disabled={selectedInterests.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 disabled:bg-slate-300 transition">Curate My Feed</button>
           </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-indigo-600 tracking-tight leading-none">Review Jam</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Genuine Reviews</span>
          </div>
          
          <div>
            {user ? (
              <div className="flex items-center gap-5">
                <Link href="/brands" className="text-sm text-slate-600 hover:text-indigo-600 font-bold transition">For Brands</Link>
                <Link href="/admin" className="text-sm text-slate-400 hover:text-indigo-600 font-bold transition">Admin</Link>
                <Link href="/profile" className="text-sm text-slate-600 hover:text-indigo-600 font-bold transition">My Profile</Link>
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  {user.displayName?.charAt(0)}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <Link href="/brands" className="text-sm text-slate-600 hover:text-indigo-600 font-bold transition">For Brands</Link>
                <button onClick={handleLogin} className="bg-slate-900 text-white px-5 py-2 rounded-full shadow hover:bg-slate-800 transition font-bold text-sm">Sign In</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 3-COLUMN SOCIAL LAYOUT */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-3 hidden lg:block">
          <div className="sticky top-24 space-y-2">
            <button 
              onClick={() => {
                if (!user) alert("Please log in to write a review!");
                else setShowOrganicModal(true);
              }}
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-indigo-700 hover:shadow-indigo-200 transition-all mb-8 flex justify-center items-center gap-2"
            >
              <span>✍️</span> Review Anything
            </button>

            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 px-3">Explore</h3>
            <button onClick={() => setActiveCategoryFilter("All")} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${activeCategoryFilter === "All" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>🔥 For You</button>
            {AVAILABLE_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategoryFilter(cat)} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors ${activeCategoryFilter === cat ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}># {cat}</button>
            ))}
          </div>
        </div>

        {/* MIDDLE COLUMN: The Feed */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
            <span className="pl-4 text-xl">🔍</span>
            <input type="text" placeholder="Search reviews, products, or quotes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-3 text-slate-800 placeholder-slate-400 outline-none" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="pr-4 text-slate-400 hover:text-slate-600 font-bold">✕</button>}
          </div>

          <div className="flex justify-between items-end pb-2 border-b border-slate-200">
            <h2 className="text-xl font-black text-slate-800">{searchQuery ? "Search Results" : (activeCategoryFilter === "All" ? "Top Reviews" : `${activeCategoryFilter} Reviews`)}</h2>
          </div>
          
          {isLoading ? (
             <div className="text-center p-10 text-slate-400 font-bold animate-pulse">Loading the jam...</div>
          ) : displayedReviews.length === 0 ? (
            <div className="text-center p-16 bg-white rounded-3xl border border-dashed border-slate-300 text-slate-500">
              <p className="font-bold text-lg mb-2">No reviews found.</p>
              <p className="text-sm">Be the first to write a review in this category!</p>
            </div>
          ) : (
            displayedReviews.map(review => (
              <div key={review.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                      {review.reviewerName?.charAt(0) || "A"}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">{review.reviewerName || "Anonymous"}</p>
                      <div className="flex items-center gap-2">
                         <p className="text-xs font-bold text-indigo-500 uppercase">{review.category || "General"}</p>
                         {review.productName && <span className="text-xs text-slate-400 font-medium">• {review.productName}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-md font-black text-xs">★ {review.rating}/5</span>
                </div>
                
                <p className="text-slate-800 text-lg leading-relaxed mb-4">"{review.content}"</p>
                
                {review.marketingQuote && (
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl mb-4">
                    <p className="text-sm text-indigo-900 font-medium">✨ "{review.marketingQuote}"</p>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-sm pt-4 border-t border-slate-100">
                  {review.campaignId === "organic" ? (
                    <span className="text-slate-400 font-medium italic">Organic Review</span>
                  ) : (
                    <Link href={`/product/${review.productId}`} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                      View Campaign →
                    </Link>
                  )}
                  <span className="flex items-center gap-1.5 font-bold text-slate-600 bg-slate-100 px-4 py-1.5 rounded-full">
                    👍 {review.likesCount || 0}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: Upgraded Layout with Gap and Timers */}
        {/* RIGHT COLUMN */}
        <div className="lg:col-span-3 hidden lg:block">
          <div className="sticky top-24 bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
            <h3 className="text-lg font-black mb-6 flex items-center gap-2">
              <span className="text-green-400 animate-pulse">●</span> Active Campaigns
            </h3>
            
            <div className="flex flex-col gap-5">
              {products.map((product) => (
                <Link href={`/product/${product.id}`} key={product.id}>
                  <div className="group bg-slate-800 p-5 rounded-2xl border border-slate-700 hover:border-indigo-500 hover:bg-slate-800/80 transition-all cursor-pointer shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{product.category}</span>
                      <div className="text-[10px] font-black text-green-400 bg-green-400/10 px-2 py-1 rounded">💰 Pool Active</div>
                    </div>
                    
                    <h4 className="font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors line-clamp-1">{product.name}</h4>
                    <p className="text-xs text-slate-400 mb-4">by {product.brandName}</p>
                    
                    {/* HERE IS THE NEW TIMEZONE AND TIMER FOOTER */}
                    <div className="pt-3 border-t border-slate-700/50">
                      
                      {/* 1. The Localized Date String */}
                      <p className="text-[10px] text-slate-400 mb-3 font-medium bg-slate-900/50 inline-block px-2 py-1 rounded">
                        Ends: {new Date(product.endDate).toLocaleString(undefined, { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric', 
                          hour: 'numeric', 
                          minute: '2-digit' 
                        })}
                      </p>

                      {/* 2. The Live Countdown and Review Count */}
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <span className="text-orange-400">⏳</span> {getTimeRemaining(product.endDate)}
                        </div>
                        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <span className="text-indigo-400">📝</span> {getReviewCount(product.campaignId)} reviews
                        </div>
                      </div>
                      
                    </div>
                  </div>
                </Link>
              ))}
              
              {products.length === 0 && (
                <div className="text-center p-6 border border-dashed border-slate-700 rounded-2xl">
                  <p className="text-slate-500 text-sm font-bold">No active campaigns.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
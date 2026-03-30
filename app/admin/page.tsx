"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// REPLACE THIS WITH YOUR EXACT GOOGLE LOGIN EMAIL
const ADMIN_EMAIL = "sumit.pandey75@gmail.com"; 

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [newProdName, setNewProdName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newCategory, setNewCategory] = useState("Tech");
  const [newCampaignId, setNewCampaignId] = useState("");
  const [endDateLocal, setEndDateLocal] = useState(""); 
  const [isCreating, setIsCreating] = useState(false);
  const [payoutCampId, setPayoutCampId] = useState("");
  const [payoutBudget, setPayoutBudget] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isAuthLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-bold animate-pulse">Verifying Security Credentials...</div>;
  if (!user) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10"><p className="text-xl text-slate-400 mb-4">Please log in to access the Admin Dashboard.</p><Link href="/" className="bg-indigo-600 px-6 py-2 rounded-xl font-bold hover:bg-indigo-500 transition">Go Home to Login</Link></div>;
  if (user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase().trim()) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10"><p className="text-red-500 font-black text-5xl mb-2">ACCESS DENIED</p><p className="text-slate-400 mb-8 text-lg">Logged in as {user?.email || "Unknown"}.</p><Link href="/" className="bg-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-600 transition">Return to Market</Link></div>;

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const universalEndDate = new Date(endDateLocal).toISOString();

      await addDoc(collection(db, "products"), {
        name: newProdName,
        brandName: newBrandName,
        category: newCategory,
        campaignId: newCampaignId || `camp_${Date.now()}`,
        endDate: universalEndDate, 
        createdAt: new Date().toISOString()
      });
      alert("Campaign Created Successfully! It is now live on the homepage.");
      setNewProdName(""); setNewBrandName(""); setNewCampaignId(""); setEndDateLocal("");
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign.");
    } finally {
      setIsCreating(false);
    }
  };

  // --- NEW: DUMMY DATA SEEDER FUNCTION ---
  const handleSeedDatabase = async () => {
    const confirm = window.confirm("Are you sure? This will push 3 campaigns and 10 reviews to your live database.");
    if (!confirm) return;
    setIsProcessing(true);
    setStatusMessage("Injecting dummy data... please wait.");

    try {
      const now = new Date();
      
      // 1. Create 3 Active Campaigns
      const campaigns = [
        { name: "Sony WH-1000XM6", brandName: "Sony", category: "Tech", campaignId: "camp_sony1", endDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString() }, // 4 days from now
        { name: "Lumina Smart Desk", brandName: "Lumina", category: "Home", campaignId: "camp_lumina", endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() }, // 2 days from now
        { name: "FitTrack Pro App", brandName: "FitTrack", category: "Fitness", campaignId: "camp_fit", endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString() } // 10 days
      ];

      for (const camp of campaigns) {
        await addDoc(collection(db, "products"), { ...camp, createdAt: now.toISOString() });
      }

      // 2. Create 10 Realistic Reviews
      const reviews = [
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "camp_sony1", content: "The noise cancellation is literally black magic. I work in a loud open office and when I put these on, the world ceases to exist. Bass is punchy but not overwhelming. Battery easily lasts 3 days of heavy use.", reviewerName: "Alex Chen", rating: 5, likesCount: 124, marketingQuote: "The noise cancellation is literally black magic." },
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "camp_sony1", content: "Great sound, but the clamping force is a bit tight on my head compared to the Bose ones. Still worth it for the battery life alone.", reviewerName: "Sarah J.", rating: 4, likesCount: 45, marketingQuote: "Worth it for the battery life alone." },
        { productName: "Lumina Smart Desk", category: "Home", campaignId: "camp_lumina", content: "Finally pulled the trigger on this standing desk. The built-in OLED screen for Pomodoro timers is a game changer for my ADHD. Assembly took about 45 minutes.", reviewerName: "Marcus T.", rating: 5, likesCount: 89, marketingQuote: "A game changer for my ADHD." },
        { productName: "FitTrack Pro App", category: "Fitness", campaignId: "camp_fit", content: "The AI workout generator is surprisingly good. It adjusts when I tell it my shoulder is sore. Deducting one star because the Apple Watch sync sometimes drops out.", reviewerName: "Elena R.", rating: 4, likesCount: 22, marketingQuote: "The AI workout generator is surprisingly good." },
        { productName: "Notion", category: "SaaS", campaignId: "organic", content: "It's basically my second brain at this point. I run my entire freelance business out of it. It can get overwhelming if you over-engineer your dashboards, though.", reviewerName: "David K.", rating: 5, likesCount: 210, marketingQuote: "It's basically my second brain at this point." },
        { productName: "Dyson V15", category: "Home", campaignId: "organic", content: "The laser that shows the dust on the floor is simultaneously the coolest and most disgusting feature ever invented. I had no idea my floors were that dirty. Powerful vacuum.", reviewerName: "Jessica W.", rating: 5, likesCount: 340, marketingQuote: "The coolest and most disgusting feature ever invented." },
        { productName: "Tesla Model 3", category: "Automotive", campaignId: "organic", content: "The instant torque never gets old. Autopilot on highway commutes completely changes your energy levels when you get home from work. Build quality issues seem mostly resolved in this year's model.", reviewerName: "Chris M.", rating: 4, likesCount: 156, marketingQuote: "The instant torque never gets old." },
        { productName: "Fenty Beauty Foundation", category: "Beauty", campaignId: "organic", content: "Finally a shade range that actually respects undertones. It oxidizes slightly after an hour, so maybe buy one shade lighter than you think you need.", reviewerName: "Aisha P.", rating: 4, likesCount: 67, marketingQuote: "Finally a shade range that actually respects undertones." },
        { productName: "Elden Ring", category: "Gaming", campaignId: "organic", content: "I have died 400 times and I will gladly die 400 more. The open world design makes getting stuck less frustrating because you can just go somewhere else. Masterpiece.", reviewerName: "Tom H.", rating: 5, likesCount: 489, marketingQuote: "I have died 400 times and I will gladly die 400 more." },
        { productName: "Robinhood", category: "Finance", campaignId: "organic", content: "UI is unmatched for beginners, but the customer support is non-existent. Good for playing around with small amounts, but I wouldn't trust it for my main retirement account.", reviewerName: "Nate D.", rating: 3, likesCount: 88, marketingQuote: "UI is unmatched for beginners." },
      ];

      for (const rev of reviews) {
        await addDoc(collection(db, "reviews"), { 
          ...rev, 
          productId: rev.campaignId === "organic" ? `org_${Math.random()}` : `prod_${Math.random()}`,
          reviewerId: "dummy_user",
          likedBy: [],
          createdAt: new Date(now.getTime() - Math.random() * 1000000000).toISOString() // random past dates
        });
      }

      setStatusMessage("✅ Success! The homepage is now fully populated.");
    } catch (error) {
      console.error(error);
      setStatusMessage("❌ Error injecting data.");
    } finally {
      setIsProcessing(false);
    }
  };

  async function handleDistributePayouts() {
    if (!payoutCampId || !payoutBudget) return alert("Please enter both ID and Budget.");
    const confirm = window.confirm(`Distribute $${payoutBudget} to winners of ${payoutCampId}?`);
    if (!confirm) return;
    
    setIsProcessing(true);
    setStatusMessage(`Calculating payouts for ${payoutCampId}...`);

    try {
      const response = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // USING THE DYNAMIC INPUTS HERE:
        body: JSON.stringify({ campaignId: payoutCampId, budget: Number(payoutBudget) }), 
      });
      const data = await response.json();
      if (data.success) setStatusMessage(`✅ Success: ${data.message}`);
      else setStatusMessage(`❌ Error: ${data.error}`);
    } catch (error) {
      setStatusMessage("❌ Critical Error: Could not reach the payout agent.");
    } finally {
      setIsProcessing(false);
      setPayoutCampId("");
      setPayoutBudget("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 p-10 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-2">
          <h1 className="text-4xl font-black text-indigo-400">Command Center</h1>
          <Link href="/" className="text-slate-400 hover:text-white font-bold transition">← Back to Site</Link>
        </div>
        <p className="text-slate-400 mb-10 border-b border-slate-700 pb-4">Logged in as Admin: {user?.email}</p>

        {/* --- NEW: ONE-CLICK SEED BUTTON --- */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 p-6 rounded-3xl border border-indigo-500/30 mb-8 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">🧪 Test Environment Seeder</h2>
            <p className="text-indigo-200 text-sm">Populate your UI with highly realistic dummy campaigns and reviews instantly.</p>
          </div>
          <button 
            onClick={handleSeedDatabase} 
            disabled={isProcessing}
            className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-8 rounded-xl transition disabled:opacity-50 whitespace-nowrap"
          >
            {isProcessing ? "Injecting Data..." : "Generate Dummy Data"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: Launch New Campaign */}
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">🚀 Launch New Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">Product Name</label>
                <input type="text" required value={newProdName} onChange={e => setNewProdName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Brand Name</label>
                  <input type="text" required value={newBrandName} onChange={e => setNewBrandName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none">
                    <option value="Tech">Tech</option>
                    <option value="Home">Home</option>
                    <option value="SaaS">SaaS</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Automotive">Automotive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Campaign ID</label>
                  <input type="text" required value={newCampaignId} onChange={e => setNewCampaignId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" placeholder="e.g. camp_123" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">End Date & Time</label>
                  <input type="datetime-local" required value={endDateLocal} onChange={e => setEndDateLocal(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
                </div>
              </div>
              <button type="submit" disabled={isCreating} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black mt-2 hover:bg-indigo-500 transition disabled:opacity-50">
                {isCreating ? "Publishing..." : "Launch Campaign Live"}
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: Payout Manager */}
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">💰 Manage Payouts</h2>
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 mb-4 space-y-4">
              
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">Target Campaign ID</label>
                <input type="text" value={payoutCampId} onChange={e => setPayoutCampId(e.target.value)} placeholder="e.g. camp_123" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">Total Pool Budget ($)</label>
                <input type="number" value={payoutBudget} onChange={e => setPayoutBudget(e.target.value)} placeholder="1000" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" />
              </div>

              <button onClick={handleDistributePayouts} disabled={isProcessing} className={`w-full py-4 mt-2 rounded-xl font-black shadow-lg transition-all ${isProcessing ? "bg-slate-700 text-slate-400" : "bg-green-500 hover:bg-green-400 text-slate-900"}`}>
                {isProcessing ? "Processing Blockchain Tx..." : "Distribute Funds"}
              </button>
            </div>
            
            {statusMessage && (
              <div className={`mt-4 p-4 rounded-xl border font-mono text-sm font-bold ${statusMessage.includes('❌') ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-green-900/30 border-green-500/50 text-green-400'}`}>
                {statusMessage}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
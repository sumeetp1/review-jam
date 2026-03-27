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

  // Campaign States
  const [newProdName, setNewProdName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newCategory, setNewCategory] = useState("Tech");
  const [newCampaignId, setNewCampaignId] = useState("");
  const [endDateLocal, setEndDateLocal] = useState(""); // NEW: Duration State
  const [isCreating, setIsCreating] = useState(false);

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
      // NEW: Convert the local time you picked into a Universal UTC string!
      const universalEndDate = new Date(endDateLocal).toISOString();

      await addDoc(collection(db, "products"), {
        name: newProdName,
        brandName: newBrandName,
        category: newCategory,
        campaignId: newCampaignId || `camp_${Date.now()}`,
        endDate: universalEndDate, // SAVING THE UNIVERSAL END DATE
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

  async function handleDistributePayouts() {
    const confirm = window.confirm("Are you sure you want to distribute funds?");
    if (!confirm) return;
    setIsProcessing(true);
    setStatusMessage("Calculating proportional payouts...");

    try {
      const response = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: "camp_01", budget: 10000 }), 
      });
      const data = await response.json();
      if (data.success) setStatusMessage(`✅ Success: ${data.message}`);
      else setStatusMessage(`❌ Error: ${data.error}`);
    } catch (error) {
      setStatusMessage("❌ Critical Error: Could not reach the payout agent.");
    } finally {
      setIsProcessing(false);
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
                  <input 
                    type="datetime-local" 
                    required 
                    value={endDateLocal} 
                    onChange={e => setEndDateLocal(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" 
                  />
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
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 mb-4">
              <p className="font-black text-xl text-white mb-1">Dummy Campaign (EV Charger)</p>
              <div className="flex gap-4 text-sm font-bold mb-4">
                <span className="text-green-400">Total Pot: $10,000</span>
                <span className="text-indigo-400">ID: camp_01</span>
              </div>
              <button onClick={handleDistributePayouts} disabled={isProcessing} className={`w-full py-4 rounded-xl font-black shadow-lg transition-all ${isProcessing ? "bg-slate-700 text-slate-400" : "bg-green-500 hover:bg-green-400 text-slate-900"}`}>
                {isProcessing ? "Processing..." : "Distribute Funds"}
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
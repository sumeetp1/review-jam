"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { db, auth } from "../../lib/firebase";

// Ensure these match the ones on your homepage!
const AVAILABLE_CATEGORIES = ["Tech", "Home", "SaaS", "Automotive", "Beauty", "Gaming"];

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [interests, setInterests] = useState<string[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch the user's private data from Firestore
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data();
            setWalletBalance(data.walletBalance || 0);
            setInterests(data.interests || []);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const toggleInterest = (category: string) => {
    setInterests(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleSaveInterests = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveMessage("");

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { interests: interests });
      setSaveMessage("Interests updated successfully!");
      
      // Clear the success message after 3 seconds
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Error updating interests:", error);
      setSaveMessage("Failed to update interests.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/"; // Redirect to homepage after logout
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading profile...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-10">
        <h2 className="text-2xl font-bold mb-4">Please log in to view your profile</h2>
        <Link href="/" className="text-blue-600 hover:underline font-bold">Go back Home</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      
      {/* Simple Navigation */}
      <nav className="bg-white border-b border-gray-200 px-10 py-4 flex justify-between items-center">
        <Link href="/">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight hover:opacity-80 transition">
            ← Back to Market
          </h1>
        </Link>
        <button onClick={handleLogout} className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-full hover:bg-red-100 transition font-bold">
          Sign Out
        </button>
      </nav>

      <div className="max-w-3xl mx-auto p-10 space-y-8">
        
        {/* User Header */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-6">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold">
            {user.displayName?.charAt(0) || "U"}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{user.displayName}</h2>
            <p className="text-gray-500">{user.email}</p>
          </div>
        </div>

        {/* The Wallet / Earnings Component */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-700 p-8 rounded-2xl shadow-lg text-white">
          <h3 className="text-green-100 font-medium uppercase tracking-wider mb-2">Available Balance</h3>
          <p className="text-6xl font-black mb-4">${walletBalance.toFixed(2)}</p>
          <p className="text-sm text-green-100 bg-black/20 inline-block px-3 py-1 rounded">
            Funds are deposited automatically when campaigns end.
          </p>
        </div>

        {/* Interests Editor */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-2">My Interests</h3>
          <p className="text-gray-500 mb-6">Update what you want to see on your personalized feed.</p>
          
          <div className="flex flex-wrap gap-3 mb-8">
            {AVAILABLE_CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => toggleInterest(cat)}
                className={`px-4 py-2 rounded-full font-semibold border-2 transition-colors ${
                  interests.includes(cat) 
                    ? "bg-blue-600 text-white border-blue-600" 
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSaveInterests}
              disabled={isSaving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            {saveMessage && (
              <span className="text-green-600 font-medium">{saveMessage}</span>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
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
    return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-sm text-slate-500">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-8">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Sign in to view your profile</h2>
        <Link href="/" className="text-sm text-slate-600 dark:text-slate-400 hover:underline">← Home</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      
      <nav className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3 flex justify-between items-center max-w-2xl mx-auto md:max-w-3xl">
        <Link href="/" className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">
          ← Home
        </Link>
        <button type="button" onClick={handleLogout} className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900">
          Sign out
        </button>
      </nav>

      <div className="max-w-2xl md:max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full flex items-center justify-center text-lg font-medium">
            {user.displayName?.charAt(0) || "U"}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">{user.displayName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-500 truncate">{user.email}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">Balance</h3>
          <p className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">${walletBalance.toFixed(2)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 leading-relaxed">
            Payouts are credited when campaigns close.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Feed interests</h3>
          <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">Used to personalize your default feed.</p>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {AVAILABLE_CATEGORIES.map(cat => (
              <button 
                key={cat}
                type="button"
                onClick={() => toggleInterest(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  interests.includes(cat) 
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" 
                    : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button 
              type="button"
              onClick={handleSaveInterests}
              disabled={isSaving}
              className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            {saveMessage && (
              <span className="text-sm text-emerald-600 dark:text-emerald-500">{saveMessage}</span>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
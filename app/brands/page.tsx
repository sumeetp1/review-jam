"use client";

import { useState } from "react";
import Link from "next/link";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function BrandsPage() {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState("1000");
  const [duration, setDuration] = useState("7"); // NEW STATE
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "leads"), {
        companyName,
        email,
        budget: Number(budget),
        duration: Number(duration), // SAVING DURATION
        status: "new",
        createdAt: new Date().toISOString(),
      });
      setIsSuccess(true);
    } catch (error) {
      console.error("Error submitting lead:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white font-sans selection:bg-indigo-500">
      <nav className="border-b border-slate-800 px-10 py-6 flex justify-between items-center">
        <Link href="/">
          <h1 className="text-2xl font-black text-white tracking-tight leading-none hover:text-indigo-400 transition">
            Review Jam <span className="text-indigo-500">for Brands</span>
          </h1>
        </Link>
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white transition">
          ← Back to Marketplace
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-5xl font-black mb-6 leading-tight">Get genuine reviews from real users.</h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Stop hoping for organic feedback. Launch a reward pool on Review Jam and get high-quality, AI-verified reviews for your product in hours, not months. You only pay for performance.
          </p>
          <ul className="space-y-4 font-bold text-slate-300">
            <li className="flex items-center gap-3"><span className="text-green-400">✓</span> AI Quality Control filters out spam</li>
            <li className="flex items-center gap-3"><span className="text-green-400">✓</span> Pay only for community-liked reviews</li>
            <li className="flex items-center gap-3"><span className="text-green-400">✓</span> Shareable URLs for your customers</li>
          </ul>
        </div>

        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
          {isSuccess ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-2xl font-black mb-2">Application Received!</h3>
              <p className="text-slate-400">Our team will email you within 24 hours to set up your campaign.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h3 className="text-xl font-black mb-4">Launch a Campaign</h3>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Company / Product Name</label>
                <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Work Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Budget ($)</label>
                  <select value={budget} onChange={e => setBudget(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="500">$500</option>
                    <option value="1000">$1,000</option>
                    <option value="5000">$5,000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Duration</label>
                  <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-lg hover:bg-indigo-500 transition disabled:opacity-50 mt-4">
                {isSubmitting ? "Submitting..." : "Request Access"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
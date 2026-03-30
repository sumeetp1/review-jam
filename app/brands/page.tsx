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
    <main className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased">
      <nav className="border-b border-slate-800/80 px-4 sm:px-8 py-3 flex justify-between items-center max-w-5xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white hover:text-slate-300 transition">
          Review Jam <span className="text-slate-500 font-medium">/ Brands</span>
        </Link>
        <Link href="/" className="text-sm font-medium text-slate-400 hover:text-white transition">
          ← Home
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12 md:py-16 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-start">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-4 leading-snug tracking-tight">Real reviews from real users.</h2>
          <p className="text-slate-400 text-[15px] mb-6 leading-relaxed">
            Launch a reward pool and collect AI-checked reviews fast. Pay for performance, not noise.
          </p>
          <ul className="space-y-3 text-[15px] text-slate-300 font-normal">
            <li className="flex items-start gap-2"><span className="text-emerald-500 shrink-0">✓</span> Automated quality checks reduce spam</li>
            <li className="flex items-start gap-2"><span className="text-emerald-500 shrink-0">✓</span> Reward engagement that resonates</li>
            <li className="flex items-start gap-2"><span className="text-emerald-500 shrink-0">✓</span> Shareable campaign links</li>
          </ul>
        </div>

        <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800">
          {isSuccess ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold text-white mb-2">Thanks — we received your request</h3>
              <p className="text-sm text-slate-400 leading-relaxed">We will follow up by email within one business day.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">Get started</h3>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Company or product</label>
                <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-slate-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Work email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-slate-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Budget ($)</label>
                  <select value={budget} onChange={e => setBudget(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-slate-600">
                    <option value="500">$500</option>
                    <option value="1000">$1,000</option>
                    <option value="5000">$5,000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Duration</label>
                  <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-slate-600">
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-white text-slate-950 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition disabled:opacity-50 mt-2">
                {isSubmitting ? "Sending…" : "Request access"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
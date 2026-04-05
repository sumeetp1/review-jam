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
    <main className="min-h-screen bg-[#09090b] text-zinc-200 font-sans antialiased">
      <nav className="border-b border-white/[0.06] px-4 sm:px-8 py-3 flex justify-between items-center max-w-5xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white hover:text-zinc-300 transition">
          Review Jam <span className="text-zinc-500 font-medium">/ Brands</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/brands/dashboard" className="text-sm font-medium text-zinc-400 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white transition">
            ← Home
          </Link>
        </div>
      </nav>

      {/* Hero + form */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12 md:py-16 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-start">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-4 leading-snug tracking-tight">Real reviews from real users.</h2>
          <p className="text-zinc-400 text-[15px] mb-6 leading-relaxed">
            Launch a reward pool and collect AI-checked reviews fast. Pay for performance, not noise.
          </p>
          <ul className="space-y-3 text-[15px] text-zinc-300 font-normal">
            <li className="flex items-start gap-2"><span className="text-emerald-500 shrink-0">✓</span> Automated quality checks reduce spam</li>
            <li className="flex items-start gap-2"><span className="text-emerald-500 shrink-0">✓</span> Reward engagement that resonates</li>
            <li className="flex items-start gap-2"><span className="text-emerald-500 shrink-0">✓</span> Shareable product review links</li>
          </ul>
        </div>

        <div className="bg-white/[0.03] p-6 rounded-xl border border-white/[0.06]">
          {isSuccess ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold text-white mb-2">Thanks — we received your request</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">We will follow up by email within one business day.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-1">Get started</h3>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Company or product</label>
                <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full bg-[#09090b] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Work email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#09090b] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Budget ($)</label>
                  <select value={budget} onChange={e => setBudget(e.target.value)} className="w-full bg-[#09090b] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                    <option value="500">$500</option>
                    <option value="1000">$1,000</option>
                    <option value="5000">$5,000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Duration</label>
                  <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-[#09090b] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-white text-[#09090b] py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-200 transition disabled:opacity-50 mt-2">
                {isSubmitting ? "Sending…" : "Request access"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Feature cards ──────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-14">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-8 text-center">Everything brands get</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

            {/* Card 1 — AI Quality */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">🤖</div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">AI Quality Control</h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Every review is scored by our AI for authenticity and depth. Spam and generic reviews are rejected automatically.
                </p>
              </div>
              <div className="mt-auto">
                <span className="text-[11px] font-medium bg-white/[0.05] text-zinc-400 px-2 py-1 rounded-md">All tiers</span>
              </div>
            </div>

            {/* Card 2 — Pay for performance */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-lg">💰</div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Pay for Performance</h3>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Reward pools pay reviewers based on engagement — likes, helpful votes, and comment depth. You pay for impact.
                </p>
              </div>
              <div className="mt-auto">
                <span className="text-[11px] font-medium bg-white/[0.05] text-zinc-400 px-2 py-1 rounded-md">All tiers</span>
              </div>
            </div>

            {/* Card 3 — Trust Widget ⭐ FEATURED */}
            <div className="bg-gradient-to-br from-amber-950/60 to-orange-950/40 border border-amber-700/40 rounded-xl p-5 flex flex-col gap-3 relative overflow-hidden">
              {/* Glow accent */}
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between gap-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg">🧩</div>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wide">$500+ tier</span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Embeddable Trust Widget</h3>
                <p className="text-[13px] text-zinc-300 leading-relaxed">
                  Paste a live widget on your website, Shopify store, or landing page. Shows your Health Score, star rating, top pros &amp; cons, and a direct review link — auto-updated hourly.
                </p>
              </div>

              {/* Mini widget mockup */}
              <div className="bg-[#09090b]/60 border border-white/[0.06] rounded-lg p-3 text-[11px] font-mono text-zinc-400 my-1">
                <span className="text-amber-400">&lt;iframe</span>{" "}
                <span className="text-zinc-500">src=</span>
                <span className="text-emerald-400">&quot;reviewjam.com/api/widget/…&quot;</span>
                {" "}<span className="text-amber-400">/&gt;</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-amber-300/80 flex items-center gap-1">✓ iframe</span>
                <span className="text-[11px] text-amber-300/80 flex items-center gap-1">✓ React component</span>
                <span className="text-[11px] text-amber-300/80 flex items-center gap-1">✓ Light / Dark / Auto</span>
              </div>

              <div className="mt-auto pt-1">
                <Link
                  href="/brands/widgets"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition"
                >
                  Generate your widget →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Tier comparison ────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-14">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-8 text-center">Compare tiers</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-4 text-zinc-500 font-medium w-1/2">Feature</th>
                  <th className="text-center py-3 px-4 text-zinc-400 font-medium">Starter<br/><span className="text-xs font-normal text-zinc-600">$500</span></th>
                  <th className="text-center py-3 px-4 text-zinc-400 font-medium">Growth<br/><span className="text-xs font-normal text-zinc-600">$1,000</span></th>
                  <th className="text-center py-3 px-4 text-amber-400 font-semibold">Scale<br/><span className="text-xs font-normal text-amber-600">$5,000+</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {[
                  ["Product listing",       true,  true,  true ],
                  ["AI moderation",         true,  true,  true ],
                  ["Brand dashboard",       true,  true,  true ],
                  ["Marketing quote export",true,  true,  true ],
                  ["🧩 Trust Widget embed",  true,  true,  true ],
                  ["Custom listing duration", false, true, true],
                  ["Priority placement",    false, false, true ],
                  ["Dedicated account manager", false, false, true],
                ].map(([label, s, g, sc]) => (
                  <tr key={String(label)} className="hover:bg-white/[0.02] transition">
                    <td className={`py-3 px-4 ${label === "🧩 Trust Widget embed" ? "text-amber-300 font-medium" : "text-zinc-300"}`}>
                      {String(label)}
                    </td>
                    <td className="text-center py-3 px-4">{s ? <span className="text-emerald-500">✓</span> : <span className="text-zinc-700">—</span>}</td>
                    <td className="text-center py-3 px-4">{g ? <span className="text-emerald-500">✓</span> : <span className="text-zinc-700">—</span>}</td>
                    <td className="text-center py-3 px-4">{sc ? <span className="text-emerald-400 font-semibold">✓</span> : <span className="text-zinc-700">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/brands/widgets"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition shadow-lg shadow-amber-900/30"
            >
              🧩 Generate Trust Widget
            </Link>
            <Link
              href="/brands/dashboard"
              className="px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-200 rounded-lg text-sm font-medium transition border border-white/[0.06]"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
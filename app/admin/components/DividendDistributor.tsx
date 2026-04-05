"use client";

interface DividendDistributorProps {
  globalPool: string;
  setGlobalPool: React.Dispatch<React.SetStateAction<string>>;
  dividendStats: { totalReviews: number; eligibleReviews: number; payoutsMade: number; uniqueReviewers: number; totalDistributed: number } | null;
  setDividendStats: React.Dispatch<React.SetStateAction<{ totalReviews: number; eligibleReviews: number; payoutsMade: number; uniqueReviewers: number; totalDistributed: number } | null>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  statusMessage: string;
  setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
}

export default function DividendDistributor({
  globalPool,
  setGlobalPool,
  dividendStats,
  setDividendStats,
  isProcessing,
  setIsProcessing,
  statusMessage,
  setStatusMessage,
}: DividendDistributorProps) {
  async function handleDistributeDividend() {
    const pool = Number(globalPool);
    if (!pool || pool <= 0) return alert("Enter a positive Global Pool amount.");
    const confirmed = window.confirm(
      `Distribute $${pool.toFixed(2)} as a platform-wide monthly dividend?\n\nOnly reviews with a verified purchase receipt qualify. This cannot be undone.`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setDividendStats(null);
    setStatusMessage("Scanning verified reviews and computing weighted scores…");

    try {
      const response = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalPool: pool }),
      });
      const data = await response.json();
      if (data.success) {
        setStatusMessage(`✅ ${data.message}`);
        setDividendStats(data.stats ?? null);
        setGlobalPool("");
      } else {
        setStatusMessage(`❌ ${data.error}`);
      }
    } catch {
      setStatusMessage("❌ Critical Error: Could not reach the payout service.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
      <h2 className="text-2xl font-bold mb-1">💰 Monthly Dividend</h2>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">
        Platform-wide distribution. Only reviews with a <span className="text-green-400 font-semibold">verified purchase receipt</span> qualify.
        Each reviewer&apos;s share = <code className="text-xs text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">Pool × (score × multiplier) / Σ scores</code>
      </p>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 mb-4 space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-400 mb-1">Global Pool Amount ($)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={globalPool}
            onChange={(e) => setGlobalPool(e.target.value)}
            placeholder="e.g. 5000"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-green-500 transition"
          />
        </div>

        <button
          type="button"
          onClick={handleDistributeDividend}
          disabled={isProcessing || !globalPool}
          className={`w-full py-4 mt-2 rounded-xl font-black shadow-lg transition-all text-base ${
            isProcessing || !globalPool
              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-400 text-slate-900"
          }`}
        >
          {isProcessing ? "Calculating & distributing…" : "🏦 Distribute Monthly Dividend"}
        </button>
      </div>

      {dividendStats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Total reviews", value: dividendStats.totalReviews },
            { label: "Eligible (verified)", value: dividendStats.eligibleReviews },
            { label: "Payouts made", value: dividendStats.payoutsMade },
            { label: "Unique reviewers", value: dividendStats.uniqueReviewers },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900 rounded-xl border border-slate-700 p-3 text-center">
              <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {statusMessage && (
        <div className={`p-4 rounded-xl border font-mono text-sm font-bold ${statusMessage.includes("❌") ? "bg-red-900/30 border-red-500/50 text-red-400" : "bg-green-900/30 border-green-500/50 text-green-400"}`}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}

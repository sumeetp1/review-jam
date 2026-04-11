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
    setStatusMessage("Scanning verified reviews and computing weighted scores\u2026");

    try {
      const response = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalPool: pool }),
      });
      const data = await response.json();
      if (data.success) {
        setStatusMessage(`\u2705 ${data.message}`);
        setDividendStats(data.stats ?? null);
        setGlobalPool("");
      } else {
        setStatusMessage(`\u274C ${data.error}`);
      }
    } catch {
      setStatusMessage("\u274C Critical Error: Could not reach the payout service.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="bg-[#1c1826] p-8 rounded-3xl border border-[#2a2535] shadow-2xl">
      <h2 className="text-2xl font-bold mb-1">💰 Monthly Dividend</h2>
      <p className="text-sm text-[#8b839e] mb-6 leading-relaxed">
        Platform-wide distribution. Only reviews with a <span className="text-[#34d399] font-semibold">verified purchase receipt</span> qualify.
        Each reviewer&apos;s share = <code className="text-xs text-[#e04c8a] bg-[#1c1826] px-1 py-0.5 rounded">Pool &times; (score &times; multiplier) / &Sigma; scores</code>
      </p>

      <div className="bg-[#1c1826] p-6 rounded-2xl border border-[#2a2535] mb-4 space-y-4">
        <div>
          <label className="block text-sm font-bold text-[#8b839e] mb-1">Global Pool Amount ($)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={globalPool}
            onChange={(e) => setGlobalPool(e.target.value)}
            placeholder="e.g. 5000"
            className="w-full bg-[#1c1826] border border-[#2a2535] rounded-xl p-3 text-[#e8e4f0] outline-none focus:border-[#34d399] transition"
          />
        </div>

        <button
          type="button"
          onClick={handleDistributeDividend}
          disabled={isProcessing || !globalPool}
          className={`w-full py-4 mt-2 rounded-xl font-black shadow-lg transition-all text-base ${
            isProcessing || !globalPool
              ? "bg-[#2a2535] text-[#8b839e] cursor-not-allowed"
              : "bg-[#34d399] hover:bg-[#4caf50] text-white"
          }`}
        >
          {isProcessing ? "Calculating & distributing\u2026" : "🏦 Distribute Monthly Dividend"}
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
            <div key={s.label} className="bg-[#1c1826] rounded-xl border border-[#2a2535] p-3 text-center">
              <p className="text-xl font-bold text-[#e8e4f0] tabular-nums">{s.value}</p>
              <p className="text-[11px] text-[#8b839e] uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {statusMessage && (
        <div className={`p-4 rounded-xl border font-mono text-sm font-bold ${statusMessage.includes("\u274C") ? "bg-[#f87171]/10 border-[#f87171]/50 text-[#f87171]" : "bg-[#34d399]/10 border-[#34d399]/50 text-[#34d399]"}`}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}

"use client";

import type { ModerationEvent, DateRangeFilter, SourceFilter } from "../../../lib/types";

interface ModerationDashboardProps {
  moderationEvents: ModerationEvent[];
  isLoadingModeration: boolean;
  dateRangeFilter: DateRangeFilter;
  setDateRangeFilter: React.Dispatch<React.SetStateAction<DateRangeFilter>>;
  sourceFilter: SourceFilter;
  setSourceFilter: React.Dispatch<React.SetStateAction<SourceFilter>>;
}

export default function ModerationDashboard({
  moderationEvents,
  isLoadingModeration,
  dateRangeFilter,
  setDateRangeFilter,
  sourceFilter,
  setSourceFilter,
}: ModerationDashboardProps) {
  const nowMs = Date.now();
  const rangeToMs: Record<DateRangeFilter, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    all: Number.POSITIVE_INFINITY,
  };

  const filteredEvents = moderationEvents.filter((event) => {
    const createdAtMs = Date.parse(event.createdAt || "");
    const isWithinRange =
      dateRangeFilter === "all" || (Number.isFinite(createdAtMs) && nowMs - createdAtMs <= rangeToMs[dateRangeFilter]);
    const matchesSource = sourceFilter === "all" || event.source === sourceFilter;
    return isWithinRange && matchesSource;
  });

  const blockedEvents = filteredEvents.filter((event) => event.isGenuine === false);
  const reasonCounts = blockedEvents.reduce<Record<string, number>>((acc, event) => {
    const key = event.reason?.trim() || "Unknown rejection reason";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const approvalRate = filteredEvents.length
    ? Math.round(((filteredEvents.length - blockedEvents.length) / filteredEvents.length) * 100)
    : 0;

  const handleExportModerationCsv = () => {
    if (filteredEvents.length === 0) {
      alert("No moderation rows available for the selected filters.");
      return;
    }

    const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = [
      "createdAt",
      "reviewerName",
      "source",
      "isGenuine",
      "reason",
      "reviewPreview",
      "marketingQuote",
    ];
    const rows = filteredEvents.map((event) =>
      [
        event.createdAt || "",
        event.reviewerName || "Anonymous",
        event.source || "",
        String(event.isGenuine),
        event.reason || "",
        event.reviewPreview || "",
        event.marketingQuote || "",
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `moderation-events-${dateRangeFilter}-${sourceFilter}-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 bg-white p-8 rounded-3xl border border-[#f5ddc0] shadow-2xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">🛡️ Moderation Reason Dashboard</h2>
          <p className="text-[#8b7560] text-sm">
            Recent moderation outcomes from the `moderationEvents` stream.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#e65100]/20 text-[#e65100] border border-[#e65100]/30">
            Loaded {moderationEvents.length}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-bold text-[#8b7560] uppercase mb-1">Date Range</label>
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
            className="bg-[#ffecd2] border border-[#f5ddc0] rounded-xl p-2.5 text-sm text-[#4a3828] outline-none"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#8b7560] uppercase mb-1">Source</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="bg-[#ffecd2] border border-[#f5ddc0] rounded-xl p-2.5 text-sm text-[#4a3828] outline-none"
          >
            <option value="all">All sources</option>
            <option value="deterministic">Deterministic checks</option>
            <option value="ai">AI moderation</option>
          </select>
        </div>
        <button
          onClick={handleExportModerationCsv}
          className="md:ml-auto bg-[#e65100] hover:bg-[#d84315] text-white font-bold px-4 py-2.5 rounded-xl transition"
        >
          Export CSV
        </button>
      </div>

      {isLoadingModeration ? (
        <div className="text-[#8b7560] font-semibold animate-pulse">Loading moderation analytics...</div>
      ) : moderationEvents.length === 0 ? (
        <div className="text-[#8b7560]">No moderation events yet. Submit some reviews to populate this dashboard.</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-[#8b7560]">No events match the current date/source filters.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#ffecd2] border border-[#f5ddc0] rounded-2xl p-4">
              <p className="text-[#8b7560] text-xs font-bold uppercase">Total Checked</p>
              <p className="text-2xl font-black text-[#4a3828] mt-1">{filteredEvents.length}</p>
            </div>
            <div className="bg-[#ffecd2] border border-[#f5ddc0] rounded-2xl p-4">
              <p className="text-[#8b7560] text-xs font-bold uppercase">Blocked</p>
              <p className="text-2xl font-black text-[#ef5350] mt-1">{blockedEvents.length}</p>
            </div>
            <div className="bg-[#ffecd2] border border-[#f5ddc0] rounded-2xl p-4">
              <p className="text-[#8b7560] text-xs font-bold uppercase">Approved</p>
              <p className="text-2xl font-black text-[#66bb6a] mt-1">{filteredEvents.length - blockedEvents.length}</p>
            </div>
            <div className="bg-[#ffecd2] border border-[#f5ddc0] rounded-2xl p-4">
              <p className="text-[#8b7560] text-xs font-bold uppercase">Approval Rate</p>
              <p className="text-2xl font-black text-[#e65100] mt-1">{approvalRate}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#ffecd2] border border-[#f5ddc0] rounded-2xl p-5">
              <h3 className="font-bold text-lg mb-4">Top Rejection Reasons</h3>
              {topReasons.length === 0 ? (
                <p className="text-[#8b7560] text-sm">No blocked reviews in this sample window.</p>
              ) : (
                <div className="space-y-3">
                  {topReasons.map(([reason, count]) => (
                    <div key={reason}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <p className="text-[#5c4a38] font-medium truncate pr-3">{reason}</p>
                        <p className="text-[#e65100] font-bold">{count}</p>
                      </div>
                      <div className="h-2 w-full bg-[#fff8f3] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#e65100] rounded-full"
                          style={{ width: `${Math.max(8, (count / blockedEvents.length) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#ffecd2] border border-[#f5ddc0] rounded-2xl p-5">
              <h3 className="font-bold text-lg mb-4">Recent Blocked Reviews</h3>
              {blockedEvents.length === 0 ? (
                <p className="text-[#8b7560] text-sm">No blocked reviews yet.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {blockedEvents.slice(0, 12).map((event) => (
                    <div key={event.id} className="border border-[#ef5350]/20 bg-[#ef5350]/5 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-[#ef5350]">{event.reviewerName || "Anonymous"}</p>
                        <p className="text-[11px] text-[#8b7560]">{event.source}</p>
                      </div>
                      <p className="text-[13px] text-[#5c4a38] mb-2 line-clamp-2">{event.reviewPreview}</p>
                      <p className="text-[12px] font-semibold text-[#ef5350]">Reason: {event.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

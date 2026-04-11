"use client";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import type { CampaignApplication } from "../../../lib/types";

interface ApplicationsManagerProps {
  applications: CampaignApplication[];
  setApplications: React.Dispatch<React.SetStateAction<CampaignApplication[]>>;
  isLoadingApplications: boolean;
  appStatusFilter: "all" | "applied" | "approved" | "rejected" | "product_sent";
  setAppStatusFilter: React.Dispatch<React.SetStateAction<"all" | "applied" | "approved" | "rejected" | "product_sent">>;
  updatingAppId: string | null;
  setUpdatingAppId: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function ApplicationsManager({
  applications,
  setApplications,
  isLoadingApplications,
  appStatusFilter,
  setAppStatusFilter,
  updatingAppId,
  setUpdatingAppId,
}: ApplicationsManagerProps) {
  return (
    <div className="mt-8 bg-[#1c1826] p-8 rounded-3xl border border-[#2a2535] shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">📋 Campaign Applications</h2>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#e04c8a]/20 text-[#e04c8a] border border-[#e04c8a]/30">
          {applications.length} total
        </span>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(["applied", "approved", "rejected", "product_sent", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setAppStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              appStatusFilter === s
                ? "bg-[#e04c8a] text-white"
                : "bg-[#1c1826] text-[#cbc5d9] hover:bg-[rgba(251,191,36,0.12)]"
            }`}
          >
            {s === "product_sent" ? "Product sent" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1 opacity-70">
                ({applications.filter(a => a.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoadingApplications ? (
        <div className="text-[#8b839e] animate-pulse text-sm">Loading applications\u2026</div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {applications
            .filter(a => appStatusFilter === "all" || a.status === appStatusFilter)
            .map((app) => (
              <div key={app.id} className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-[#e8e4f0]">{app.userName}</p>
                    <p className="text-xs text-[#8b839e]">{app.userEmail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-[#e04c8a]">{app.productName}</p>
                    <p className="text-xs text-[#8b839e]">{app.brandName}</p>
                  </div>
                </div>

                {app.notes && (
                  <p className="text-sm text-[#cbc5d9] italic mb-2 border-l-2 border-[#3a3348] pl-2">
                    &quot;{app.notes}&quot;
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                    app.status === "approved"     ? "bg-[#34d399]/10 text-[#34d399]" :
                    app.status === "rejected"     ? "bg-[#f87171]/10 text-[#f87171]" :
                    app.status === "product_sent" ? "bg-[#fbbf24]/10 text-[#fbbf24]" :
                    app.status === "reviewed"     ? "bg-[#1c1826] text-[#cbc5d9]" :
                    "bg-blue-100 text-blue-600"
                  }`}>
                    {app.status}
                  </span>

                  {app.status === "applied" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={updatingAppId === app.id}
                        onClick={async () => {
                          setUpdatingAppId(app.id);
                          await updateDoc(doc(db, "campaignApplications", app.id), { status: "approved", updatedAt: new Date().toISOString() });
                          setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "approved" } : a));
                          setUpdatingAppId(null);
                        }}
                        className="text-xs bg-[#34d399] hover:bg-[#4caf50] text-white px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={updatingAppId === app.id}
                        onClick={async () => {
                          setUpdatingAppId(app.id);
                          await updateDoc(doc(db, "campaignApplications", app.id), { status: "rejected", updatedAt: new Date().toISOString() });
                          setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "rejected" } : a));
                          setUpdatingAppId(null);
                        }}
                        className="text-xs bg-[#1c1826] hover:bg-[rgba(251,191,36,0.12)] text-[#cbc5d9] px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {app.status === "approved" && (
                    <button
                      type="button"
                      disabled={updatingAppId === app.id}
                      onClick={async () => {
                        setUpdatingAppId(app.id);
                        await updateDoc(doc(db, "campaignApplications", app.id), { status: "product_sent", updatedAt: new Date().toISOString() });
                        setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "product_sent" } : a));
                        setUpdatingAppId(null);
                      }}
                      className="text-xs bg-[#fbbf24] hover:bg-[#ff9800] text-white px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
                    >
                      Mark product sent
                    </button>
                  )}
                </div>
              </div>
            ))}
          {applications.filter(a => appStatusFilter === "all" || a.status === appStatusFilter).length === 0 && (
            <p className="text-[#8b839e] text-sm">No applications with status &quot;{appStatusFilter}&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
}

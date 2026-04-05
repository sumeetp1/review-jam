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
    <div className="mt-8 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">📋 Campaign Applications</h2>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
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
                ? "bg-indigo-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
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
        <div className="text-slate-400 animate-pulse text-sm">Loading applications…</div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {applications
            .filter(a => appStatusFilter === "all" || a.status === appStatusFilter)
            .map((app) => (
              <div key={app.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-white">{app.userName}</p>
                    <p className="text-xs text-slate-400">{app.userEmail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-indigo-300">{app.productName}</p>
                    <p className="text-xs text-slate-500">{app.brandName}</p>
                  </div>
                </div>

                {app.notes && (
                  <p className="text-sm text-slate-300 italic mb-2 border-l-2 border-slate-600 pl-2">
                    &quot;{app.notes}&quot;
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                    app.status === "approved"     ? "bg-emerald-900/40 text-emerald-400" :
                    app.status === "rejected"     ? "bg-red-900/40 text-red-400" :
                    app.status === "product_sent" ? "bg-amber-900/40 text-amber-400" :
                    app.status === "reviewed"     ? "bg-slate-700 text-slate-300" :
                    "bg-blue-900/40 text-blue-400"
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
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
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
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
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
                      className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
                    >
                      Mark product sent
                    </button>
                  )}
                </div>
              </div>
            ))}
          {applications.filter(a => appStatusFilter === "all" || a.status === appStatusFilter).length === 0 && (
            <p className="text-slate-400 text-sm">No applications with status &quot;{appStatusFilter}&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
}

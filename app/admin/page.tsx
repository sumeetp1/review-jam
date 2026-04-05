"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";

import { ADMIN_EMAIL } from "../../lib/constants";
import type { ModerationEvent, DateRangeFilter, SourceFilter, CampaignApplication } from "../../lib/types";

import DataSeeder from "./components/DataSeeder";
import CampaignCreator from "./components/CampaignCreator";
import DividendDistributor from "./components/DividendDistributor";
import AnchorSeeding from "./components/AnchorSeeding";
import ApplicationsManager from "./components/ApplicationsManager";
import ModerationDashboard from "./components/ModerationDashboard";

export default function AdminDashboard() {
  const { user, loading: isAuthLoading } = useAuth();

  // Shared state for DividendDistributor (needs statusMessage visible alongside seeder)
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Applications state
  const [applications, setApplications] = useState<CampaignApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [appStatusFilter, setAppStatusFilter] = useState<"all" | "applied" | "approved" | "rejected" | "product_sent">("applied");
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

  // Dividend state
  const [globalPool, setGlobalPool] = useState("");
  const [dividendStats, setDividendStats] = useState<{ totalReviews: number; eligibleReviews: number; payoutsMade: number; uniqueReviewers: number; totalDistributed: number } | null>(null);

  // AI moderation toggle
  const [aiCheckEnabled, setAiCheckEnabled] = useState(true);
  const [isTogglingAi, setIsTogglingAi] = useState(false);

  // Moderation events state
  const [moderationEvents, setModerationEvents] = useState<ModerationEvent[]>([]);
  const [isLoadingModeration, setIsLoadingModeration] = useState(true);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("7d");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase().trim()) return;

    async function fetchApplications() {
      setIsLoadingApplications(true);
      try {
        const snap = await getDocs(query(collection(db, "campaignApplications"), orderBy("appliedAt", "desc"), limit(200)));
        setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampaignApplication)));
      } catch (error) {
        console.error("Failed to load applications:", error);
      } finally {
        setIsLoadingApplications(false);
      }
    }

    fetchApplications();

    async function fetchModerationEvents() {
      setIsLoadingModeration(true);
      try {
        const moderationQuery = query(
          collection(db, "moderationEvents"),
          orderBy("createdAt", "desc"),
          limit(300)
        );
        const snapshot = await getDocs(moderationQuery);
        const events = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ModerationEvent[];
        setModerationEvents(events);
      } catch (error) {
        console.error("Failed to load moderation events:", error);
      } finally {
        setIsLoadingModeration(false);
      }
    }

    fetchModerationEvents();

    // Load AI check toggle state
    getDoc(doc(db, "config", "moderation")).then((snap) => {
      if (snap.exists()) setAiCheckEnabled(snap.data().aiCheckEnabled !== false);
    }).catch(() => {});
  }, [user]);

  if (isAuthLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-bold animate-pulse">Verifying Security Credentials...</div>;
  if (!user) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10"><p className="text-xl text-slate-400 mb-4">Please log in to access the Admin Dashboard.</p><Link href="/" className="bg-indigo-600 px-6 py-2 rounded-xl font-bold hover:bg-indigo-500 transition">Go Home to Login</Link></div>;
  if (user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase().trim()) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10"><p className="text-red-500 font-black text-5xl mb-2">ACCESS DENIED</p><p className="text-slate-400 mb-8 text-lg">Logged in as {user?.email || "Unknown"}.</p><Link href="/" className="bg-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-600 transition">Return to Market</Link></div>;

  const handleToggleAiCheck = async () => {
    setIsTogglingAi(true);
    const next = !aiCheckEnabled;
    try {
      await setDoc(doc(db, "config", "moderation"), { aiCheckEnabled: next }, { merge: true });
      setAiCheckEnabled(next);
    } catch (e) {
      console.error("Failed to update AI check config", e);
      alert("Failed to save setting.");
    } finally {
      setIsTogglingAi(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 p-10 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-2">
          <h1 className="text-4xl font-black text-indigo-400">Command Center</h1>
          <Link href="/" className="text-slate-400 hover:text-white font-bold transition">← Back to Site</Link>
        </div>
        <p className="text-slate-400 mb-10 border-b border-slate-700 pb-4">Logged in as Admin: {user?.email}</p>

        <DataSeeder user={user} />

        {/* --- AI MODERATION TOGGLE --- */}
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 mb-8 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">🤖 AI Review Moderation</h2>
            <p className="text-slate-400 text-sm">
              {aiCheckEnabled
                ? "Reviews are being screened by Gemini before posting."
                : "AI check is OFF — all reviews post instantly without moderation."}
            </p>
          </div>
          <button
            onClick={handleToggleAiCheck}
            disabled={isTogglingAi}
            className={`relative inline-flex items-center gap-3 font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 ${
              aiCheckEnabled
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-slate-600 hover:bg-slate-500 text-slate-200"
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${aiCheckEnabled ? "bg-white" : "bg-slate-400"}`} />
            {isTogglingAi ? "Saving…" : aiCheckEnabled ? "AI Check: ON" : "AI Check: OFF"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN: Launch New Campaign */}
          <CampaignCreator />

          {/* RIGHT COLUMN: Monthly Dividend */}
          <DividendDistributor
            globalPool={globalPool}
            setGlobalPool={setGlobalPool}
            dividendStats={dividendStats}
            setDividendStats={setDividendStats}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
            statusMessage={statusMessage}
            setStatusMessage={setStatusMessage}
          />
        </div>

        {/* ── Anchor Reviews ── */}
        <AnchorSeeding />

        {/* ── Campaign Applications ── */}
        <ApplicationsManager
          applications={applications}
          setApplications={setApplications}
          isLoadingApplications={isLoadingApplications}
          appStatusFilter={appStatusFilter}
          setAppStatusFilter={setAppStatusFilter}
          updatingAppId={updatingAppId}
          setUpdatingAppId={setUpdatingAppId}
        />

        {/* ── Moderation Dashboard ── */}
        <ModerationDashboard
          moderationEvents={moderationEvents}
          isLoadingModeration={isLoadingModeration}
          dateRangeFilter={dateRangeFilter}
          setDateRangeFilter={setDateRangeFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
        />
      </div>
    </main>
  );
}

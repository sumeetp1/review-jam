"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query, doc, getDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
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
import BuyLinksManager from "./components/BuyLinksManager";

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

  // Allowed emails
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);

  // AI moderation toggle
  const [aiCheckEnabled, setAiCheckEnabled] = useState(true);
  const [isTogglingAi, setIsTogglingAi] = useState(false);

  // Weekly digest
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [digestResult, setDigestResult] = useState<string | null>(null);

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

    // Load allowed emails
    getDoc(doc(db, "config", "allowedEmails")).then((snap) => {
      if (snap.exists()) setAllowedEmails(snap.data().emails || []);
    }).catch(() => {}).finally(() => setIsLoadingEmails(false));
  }, [user]);

  if (isAuthLoading) return <div className="min-h-screen bg-[#13111a] flex items-center justify-center text-[#8b839e] font-bold animate-pulse">Verifying Security Credentials...</div>;
  if (!user) return <div className="min-h-screen bg-[#13111a] flex flex-col items-center justify-center text-[#e8e4f0] p-10"><p className="text-xl text-[#8b839e] mb-4">Please log in to access the Admin Dashboard.</p><Link href="/" className="bg-[#e04c8a] px-6 py-2 rounded-xl font-bold hover:bg-[#d84315] text-white transition">Go Home to Login</Link></div>;
  if (user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase().trim()) return <div className="min-h-screen bg-[#13111a] flex flex-col items-center justify-center text-[#e8e4f0] p-10"><p className="text-[#f87171] font-black text-5xl mb-2">ACCESS DENIED</p><p className="text-[#8b839e] mb-8 text-lg">Logged in as {user?.email || "Unknown"}.</p><Link href="/" className="bg-[#e8e4f0] px-6 py-3 rounded-xl font-bold hover:bg-[#cbc5d9] text-white transition">Return to Market</Link></div>;

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

  const handleSendDigest = async () => {
    setIsSendingDigest(true);
    setDigestResult(null);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-digest" }),
      });
      const data = await res.json();
      if (data.success) {
        setDigestResult(`Sent ${data.sent} digest email${data.sent !== 1 ? "s" : ""}.`);
      } else {
        setDigestResult(`Error: ${data.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error("Failed to send digest:", e);
      setDigestResult("Failed to send digest emails.");
    } finally {
      setIsSendingDigest(false);
    }
  };

  const handleAddEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (allowedEmails.map(e => e.toLowerCase()).includes(email)) { setNewEmail(""); return; }
    try {
      await setDoc(doc(db, "config", "allowedEmails"), { emails: arrayUnion(email) }, { merge: true });
      setAllowedEmails((prev) => [...prev, email]);
      setNewEmail("");
    } catch (e) {
      console.error("Failed to add email:", e);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return;
    try {
      await setDoc(doc(db, "config", "allowedEmails"), { emails: arrayRemove(email) }, { merge: true });
      setAllowedEmails((prev) => prev.filter((e) => e !== email));
    } catch (e) {
      console.error("Failed to remove email:", e);
    }
  };

  return (
    <main className="min-h-screen bg-[#13111a] p-10 text-[#e8e4f0] font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-2">
          <h1 className="text-4xl font-black text-[#e04c8a]">Command Center</h1>
          <Link href="/" className="text-[#8b839e] hover:text-[#e8e4f0] font-bold transition">&larr; Back to Site</Link>
        </div>
        <p className="text-[#8b839e] mb-10 border-b border-[#2a2535] pb-4">Logged in as Admin: {user?.email}</p>

        <DataSeeder user={user} />

        {/* --- AI MODERATION TOGGLE --- */}
        <div className="bg-[#1c1826] p-6 rounded-3xl border border-[#2a2535] mb-8 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-[#e8e4f0] mb-1">🤖 AI Review Moderation</h2>
            <p className="text-[#8b839e] text-sm">
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
                ? "bg-[#34d399] hover:bg-[#4caf50] text-white"
                : "bg-[#3a3348] hover:bg-[#c9a87e] text-white"
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${aiCheckEnabled ? "bg-[#1c1826]" : "bg-[#8b839e]"}`} />
            {isTogglingAi ? "Saving\u2026" : aiCheckEnabled ? "AI Check: ON" : "AI Check: OFF"}
          </button>
        </div>

        {/* --- WEEKLY DIGEST --- */}
        <div className="bg-[#1c1826] p-6 rounded-3xl border border-[#2a2535] mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-[#e8e4f0] mb-1">Weekly Digest Emails</h2>
            <p className="text-[#8b839e] text-sm">
              Send a personalised weekly digest to every user with new reviews, earnings, and trending categories.
            </p>
            {digestResult && (
              <p className={`text-sm mt-2 font-medium ${digestResult.startsWith("Error") || digestResult.startsWith("Failed") ? "text-[#f87171]" : "text-[#34d399]"}`}>
                {digestResult}
              </p>
            )}
          </div>
          <button
            onClick={handleSendDigest}
            disabled={isSendingDigest}
            className="bg-[#e04c8a] hover:bg-[#d84315] disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition whitespace-nowrap"
          >
            {isSendingDigest ? "Sending..." : "Send Weekly Digest"}
          </button>
        </div>

        {/* --- ALLOWED EMAILS --- */}
        <div className="bg-[#1c1826] p-6 rounded-3xl border border-[#2a2535] mb-8 shadow-lg">
          <h2 className="text-xl font-bold text-[#e8e4f0] mb-1">🔐 Site Access — Allowed Emails</h2>
          <p className="text-[#8b839e] text-sm mb-4">Only these email addresses can access the site. Admin email is always allowed.</p>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
              placeholder="email@example.com"
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#1c1826] border border-[#2a2535] text-[#e8e4f0] text-sm placeholder:text-[#4a4458] outline-none focus:border-[#f472b6]"
            />
            <button onClick={handleAddEmail} className="bg-[#e04c8a] hover:bg-[#d84315] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
              Add
            </button>
          </div>
          {isLoadingEmails ? (
            <p className="text-[#8b839e] text-sm">Loading...</p>
          ) : (
            <div className="space-y-2">
              {/* Admin email — always shown, can't remove */}
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#1c1826]/50 border border-[#2a2535]/50">
                <span className="text-sm text-[#cbc5d9]">{ADMIN_EMAIL}</span>
                <span className="text-[11px] text-[#8b839e] font-medium">ADMIN</span>
              </div>
              {allowedEmails.filter(e => e.toLowerCase() !== ADMIN_EMAIL.toLowerCase()).map((email) => (
                <div key={email} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#1c1826]/50 border border-[#2a2535]/50">
                  <span className="text-sm text-[#cbc5d9]">{email}</span>
                  <button onClick={() => handleRemoveEmail(email)} className="text-[#f87171] hover:text-[#fca5a5] text-sm font-bold transition">Remove</button>
                </div>
              ))}
              {allowedEmails.filter(e => e.toLowerCase() !== ADMIN_EMAIL.toLowerCase()).length === 0 && (
                <p className="text-[#8b839e] text-sm">No additional emails added yet.</p>
              )}
            </div>
          )}
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

        {/* ── Buy Links Manager ── */}
        <BuyLinksManager />

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

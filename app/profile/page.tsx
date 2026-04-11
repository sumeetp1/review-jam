"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  doc, getDoc, updateDoc,
  collection, query, where, getDocs, orderBy, limit,
} from "firebase/firestore";
import { signOut, type User } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";
import VersionUpdateWizard from "../components/VersionUpdateWizard";
import ReferralPanel from "../components/ReferralPanel";
import { ALL_BADGES, getBadgeById } from "../../lib/badges";
import Avatar from "../components/Avatar";
import ReviewImportModal from "../components/ReviewImportModal";
import { getTierLabel } from "../../lib/trustScore";
import { getTierStyle } from "../../lib/trustTiers";


import type { LedgerEntry, ReviewSummary } from "../../lib/types";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [walletBalance, setWalletBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [trustScore, setTrustScore] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewSummary[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "earnings" | "interests" | "invites" | "referrals">("overview");
  const [updatingReview, setUpdatingReview] = useState<ReviewSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [anchorInvites, setAnchorInvites] = useState<any[]>([]);
  const [updatingInviteId, setUpdatingInviteId] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      Promise.all([
        fetchUserData(user),
        fetchLedger(user.uid),
        fetchMyReviews(user.uid),
        fetchAnchorInvites(user.uid),
        fetchCategories(),
      ]).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function fetchUserData(currentUser: User) {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      setWalletBalance(data.walletBalance || 0);
      setTotalEarned(data.totalEarned || data.walletBalance || 0);
      setTrustScore(data.trustScore || 0);
      setInterests(data.interests || []);
      setBadges(data.badges || []);
      setBio(data.bio || "");
    }
  }

  async function fetchLedger(uid: string) {
    try {
      const q = query(
        collection(db, "payoutLedger"),
        where("userId", "==", uid),
        orderBy("paidAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      setLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry)));
    } catch {
      // Index may not exist yet; silently skip
    }
  }

  async function fetchMyReviews(uid: string) {
    try {
      const q = query(
        collection(db, "reviews"),
        where("reviewerId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      setMyReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewSummary)));
    } catch {
      // Index may not exist yet; silently skip
    }
  }

  async function fetchCategories() {
    try {
      const snap = await getDocs(collection(db, "channels"));
      const cats = new Set<string>();
      snap.docs.forEach((d) => { const cat = d.data().category; if (cat) cats.add(cat as string); });
      setAvailableCategories([...cats].sort());
    } catch {}
  }

  async function fetchAnchorInvites(uid: string) {
    try {
      const q = query(collection(db, "seedingInvites"), where("userId", "==", uid));
      const snap = await getDocs(q);
      setAnchorInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.invitedAt ?? "").localeCompare(a.invitedAt ?? "")));
    } catch {}
  }

  async function handleAcceptInvite(inviteId: string) {
    setUpdatingInviteId(inviteId);
    try {
      await updateDoc(doc(db, "seedingInvites", inviteId), { status: "accepted", acceptedAt: new Date().toISOString() });
      setAnchorInvites((prev) => prev.map((inv) => inv.id === inviteId ? { ...inv, status: "accepted", acceptedAt: new Date().toISOString() } : inv));
    } catch {}
    setUpdatingInviteId(null);
  }

  async function handleDeclineInvite(inviteId: string) {
    setUpdatingInviteId(inviteId);
    try {
      await updateDoc(doc(db, "seedingInvites", inviteId), { status: "declined", declinedAt: new Date().toISOString() });
      setAnchorInvites((prev) => prev.map((inv) => inv.id === inviteId ? { ...inv, status: "declined", declinedAt: new Date().toISOString() } : inv));
    } catch {}
    setUpdatingInviteId(null);
  }

  const handleSaveInterests = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { interests });
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch {
      setSaveMessage("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBio = async () => {
    if (!user) return;
    setIsSavingBio(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { bio });
    } catch {}
    setIsSavingBio(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f3] text-sm text-[#8b7560]">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f3] p-8 gap-3">
        <h2 className="text-base font-semibold text-[#4a3828]">Sign in to view your profile</h2>
        <Link href="/" className="text-sm text-[#8b7560] hover:underline">← Home</Link>
      </div>
    );
  }

  const avgRating = myReviews.length
    ? (myReviews.reduce((s, r) => s + (r.rating || 0), 0) / myReviews.length).toFixed(1)
    : null;

  const pendingInvites = anchorInvites.filter((i) => i.status === "invited" || i.status === "accepted");
  const TABS = [
    { id: "overview",   label: "Overview" },
    { id: "reviews",    label: `Reviews (${myReviews.length})` },
    { id: "invites",    label: `Invites${pendingInvites.length > 0 ? ` (${pendingInvites.length})` : ""}` },
    { id: "referrals",  label: "Referrals" },
    { id: "earnings",   label: `Earnings (${ledger.length})` },
    { id: "interests",  label: "Interests" },
  ] as const;

  return (
    <main className="min-h-screen bg-[#fff8f3] text-[#4a3828]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-[#fff8f3]/95 backdrop-blur-md border-b border-[#f5ddc0]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="shrink-0 md">
            <Image src="/logo.svg" alt="Review Jam" width={110} height={26} />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-medium text-[#8b7560] hover:text-[#e57373] px-2 py-1 rounded-md hover:bg-[#fff0e6]"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm py-6 space-y-5">
        {/* Identity card */}
        <div className="bg-white p-5 rounded-xl border border-[#f5ddc0] flex items-center gap-4">
          <Avatar name={user.displayName} src={user.photoURL} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[#4a3828] truncate">{user.displayName}</h2>
            <p className="text-sm text-[#8b7560] truncate">{user.email}</p>
            {/* Trust Tier badge */}
            {(() => {
              const { bg, text, emoji } = getTierStyle(trustScore);
              return (
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${bg} ${text}`}>
                    {emoji} {getTierLabel(trustScore)}
                    <span className="font-normal opacity-70">· {trustScore} pts</span>
                  </span>
                </div>
              );
            })()}
            {badges.length > 0 && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {badges.map((bid) => {
                  const b = getBadgeById(bid);
                  return b ? (
                    <span key={bid} title={b.description} className="inline-flex items-center gap-0.5 text-[11px] bg-[#ffecd2] text-[#8b7560] px-2 py-0.5 rounded-md font-medium">
                      {b.emoji} {b.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <Link href={`/reviewer/${user.uid}`} className="text-[11px] font-medium text-[#e65100] hover:underline mt-1.5 inline-block">
              View public profile &rarr;
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm gap-3">
          {[
            { label: "Reviews", value: myReviews.length },
            { label: "Avg rating", value: avgRating ? `★ ${avgRating}` : "—" },
            { label: "Total earned", value: `$${totalEarned.toFixed(2)}` },
            { label: "Trust score", value: trustScore, sub: getTierLabel(trustScore) },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#f5ddc0] p-4 text-center">
              <p className="text-xl font-semibold text-[#4a3828] tabular-nums">{s.value}</p>
              <p className="text-[11px] text-[#8b7560] mt-0.5 uppercase tracking-wide">{s.label}</p>
              {"sub" in s && s.sub && (
                <p className="text-[10px] text-[#e65100] font-medium mt-0.5">{s.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Wallet */}
        <div className="bg-white p-4 rounded-xl border border-[#f5ddc0] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#8b7560] uppercase tracking-wide mb-0.5">Available balance</p>
            <p className="text-2xl font-semibold tabular-nums text-[#4a3828]">${walletBalance.toFixed(2)}</p>
          </div>
          <span className="text-xs text-[#8b7560] max-w-[140px] text-right leading-relaxed">
            Credited based on engagement
          </span>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-[#f5ddc0] overflow-hidden">
          <div className="flex border-b border-[#f5ddc0] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? "border-[#e65100] text-[#4a3828]"
                    : "border-transparent text-[#8b7560] hover:text-[#5c4a38]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ── Overview ── */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#4a3828]">Badges</h3>
                <div className="grid grid-cols-2 sm gap-2">
                  {ALL_BADGES.map((b) => {
                    const earned = badges.includes(b.id);
                    return (
                      <div
                        key={b.id}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          earned
                            ? "bg-[#ffecd2] border-[#f5ddc0]"
                            : "opacity-35 border-[#f5ddc0]"
                        }`}
                      >
                        <span className="text-xl block mb-1">{b.emoji}</span>
                        <p className="text-[12px] font-medium text-[#4a3828] leading-tight">{b.label}</p>
                        <p className="text-[11px] text-[#8b7560] leading-snug mt-0.5">{b.description}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-4 border-t border-[#f5ddc0]">
                  <h3 className="text-sm font-semibold text-[#4a3828] mb-2">Bio</h3>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Write a short bio about yourself..."
                    maxLength={280}
                    rows={3}
                    className="w-full text-sm bg-white border border-[#f5ddc0] rounded-lg p-3 text-[#4a3828] placeholder:text-[#b89878] focus:outline-none focus:ring-1 focus:ring-[#e65100] resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-[#8b7560]">{bio.length}/280</span>
                    <button
                      type="button"
                      onClick={handleSaveBio}
                      disabled={isSavingBio}
                      className="text-xs font-medium bg-[#e65100] text-white px-3 py-1.5 rounded-lg hover:bg-[#e65100] transition disabled:opacity-50"
                    >
                      {isSavingBio ? "Saving\u2026" : "Save bio"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── My Reviews ── */}
            {activeTab === "reviews" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#5c4a38]">Your reviews</p>
                  <button
                    type="button"
                    onClick={() => setShowImportModal(true)}
                    className="text-[12px] font-medium text-[#e65100] px-3 py-1.5 rounded-lg border border-[#e65100]/20 hover:bg-[#e65100]/10 transition"
                  >
                    Import Reviews
                  </button>
                </div>
                {myReviews.length === 0 ? (
                  <p className="text-sm text-[#8b7560]">No reviews yet.</p>
                ) : (
                  myReviews.map((r) => (
                    <div key={r.id} className="border border-[#f5ddc0] rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-[#4a3828]">{r.productName}</p>
                        <span className="text-[11px] text-[#ffa726] shrink-0">★ {r.rating}</span>
                      </div>
                      {(r.summary || r.marketingQuote) && (
                        <p className="text-[13px] text-[#8b7560] mt-0.5 leading-snug">
                          "{r.summary || r.marketingQuote}"
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#8b7560] flex-wrap">
                        <span>👍 {r.likesCount || 0}</span>
                        {r.healthScore != null && (
                          <span className={`font-medium ${r.healthScore >= 70 ? "text-[#66bb6a]" : r.healthScore >= 40 ? "text-[#ffa726]" : "text-[#e57373]"}`}>
                            Score: {r.healthScore}
                          </span>
                        )}
                        <span>{new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        {(r.versionCount ?? 0) > 1 && (
                          <span className="text-blue-400 font-medium">{r.versionCount} updates</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setUpdatingReview(r)}
                          className="ml-auto text-[11px] font-medium text-[#5c4a38] px-2 py-0.5 border border-[#f5ddc0] rounded hover:bg-[#fff0e6] transition"
                        >
                          Post Update
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Review Import Modal */}
            <ReviewImportModal
              isOpen={showImportModal}
              onClose={() => {
                setShowImportModal(false);
                // Refresh reviews list after import
                if (user) fetchMyReviews(user.uid);
              }}
              userId={user.uid}
              userName={user.displayName || "Anonymous"}
            />

            {/* Version Update Wizard */}
            {updatingReview && (
              <VersionUpdateWizard
                reviewId={updatingReview.id}
                existingVersionCount={updatingReview.versionCount ?? 1}
                productName={updatingReview.productName}
                category={updatingReview.category ?? "Tech"}
                onClose={() => setUpdatingReview(null)}
                onSaved={() => {
                  setMyReviews((prev) => prev.map((r) =>
                    r.id === updatingReview.id
                      ? { ...r, versionCount: (r.versionCount ?? 1) + 1 }
                      : r
                  ));
                }}
              />
            )}

            {/* ── Earnings Ledger ── */}
            {activeTab === "earnings" && (
              <div className="space-y-3">
                {ledger.length === 0 ? (
                  <p className="text-sm text-[#8b7560]">No payouts yet. Earn by getting likes on your verified reviews.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="text-left text-[11px] text-[#8b7560] uppercase tracking-wide">
                            <th className="pb-2 pr-4 font-medium">Product</th>
                            <th className="pb-2 pr-4 font-medium">Likes</th>
                            <th className="pb-2 pr-4 font-medium">Photo</th>
                            <th className="pb-2 pr-4 font-medium">Earned</th>
                            <th className="pb-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f5ddc0]">
                          {ledger.map((e) => (
                            <tr key={e.id}>
                              <td className="py-2 pr-4 font-medium text-[#4a3828] max-w-[140px] truncate">{e.productName || e.campaignId}</td>
                              <td className="py-2 pr-4 text-[#8b7560] tabular-nums">{e.rawLikes}</td>
                              <td className="py-2 pr-4 text-[#8b7560]">{e.hasPhoto ? "1.5×" : "—"}</td>
                              <td className="py-2 pr-4 text-[#66bb6a] font-semibold tabular-nums">${e.amount.toFixed(2)}</td>
                              <td className="py-2 text-[#8b7560] tabular-nums whitespace-nowrap">
                                {new Date(e.paidAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-[#8b7560]">
                      Photo reviews earn 1.5× their likes weight in payout calculations.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ── Interests ── */}
            {/* ── Invites ── */}
            {activeTab === "invites" && (
              <div className="space-y-3">
                {anchorInvites.length === 0 ? (
                  <p className="text-sm text-[#8b7560] text-center py-8">No anchor review invites yet.</p>
                ) : (
                  anchorInvites.map((inv) => (
                    <div key={inv.id} className={`p-4 rounded-xl border transition ${
                      inv.status === "completed" ? "border-emerald-800 bg-emerald-950/20" :
                      inv.status === "declined" ? "border-[#f5ddc0] opacity-60" :
                      "border-[#f5ddc0] bg-white"
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#4a3828]">{inv.productName}</p>
                          <p className="text-[12px] text-[#8b7560] mt-0.5">
                            {inv.category} · {inv.minUsageDays}-day minimum usage · ${inv.anchorPayoutAmount} payout
                          </p>
                          <p className="text-[11px] text-[#8b7560] mt-1">
                            Invited {inv.invitedAt ? new Date(inv.invitedAt).toLocaleDateString() : ""}
                            {inv.acceptedAt && <span> · Accepted {new Date(inv.acceptedAt).toLocaleDateString()}</span>}
                          </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {inv.status === "invited" && (
                            <>
                              <button type="button" onClick={() => handleAcceptInvite(inv.id)} disabled={updatingInviteId === inv.id}
                                className="text-[12px] font-semibold bg-[#66bb6a] text-white px-3 py-1.5 rounded-lg hover:bg-[#66bb6a] disabled:opacity-50 transition">
                                Accept
                              </button>
                              <button type="button" onClick={() => handleDeclineInvite(inv.id)} disabled={updatingInviteId === inv.id}
                                className="text-[12px] font-medium text-[#8b7560] px-3 py-1.5 rounded-lg border border-[#f5ddc0] hover:bg-[#fff0e6] disabled:opacity-50 transition">
                                Decline
                              </button>
                            </>
                          )}
                          {inv.status === "accepted" && inv.productSlug && inv.communitySlug && (
                            <Link href={`/c/${inv.communitySlug}/${inv.productSlug}`}
                              className="text-[12px] font-semibold bg-[#e65100] text-white px-3 py-1.5 rounded-lg hover:bg-[#e65100] transition">
                              Write Review
                            </Link>
                          )}
                          {inv.status === "completed" && (
                            <span className="text-[11px] font-bold text-[#66bb6a] bg-emerald-950/40 px-2 py-1 rounded-full">
                              Completed · ${inv.anchorPayoutAmount}
                            </span>
                          )}
                          {inv.status === "declined" && (
                            <span className="text-[11px] text-[#8b7560]">Declined</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Referrals ── */}
            {activeTab === "referrals" && (
              <ReferralPanel
                userId={user.uid}
                userName={user.displayName || "Anonymous"}
                userEmail={user.email || ""}
              />
            )}

            {activeTab === "interests" && (
              <div className="space-y-4">
                <p className="text-sm text-[#8b7560]">Used to personalize your default feed.</p>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setInterests((prev) =>
                          prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                        )
                      }
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        interests.includes(cat)
                          ? "bg-[#e65100] text-white border-[#e65100]"
                          : "bg-white text-[#8b7560] border-[#f5ddc0] hover:border-[#f5ddc0]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveInterests}
                    disabled={isSaving}
                    className="bg-[#e65100] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#e65100] transition disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                  {saveMessage && (
                    <span className="text-sm text-[#66bb6a]">{saveMessage}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

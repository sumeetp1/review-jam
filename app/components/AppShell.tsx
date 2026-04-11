"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";
import { ADMIN_EMAIL } from "../../lib/constants";
import { redeemReferralCode } from "../../lib/referral";
import GlobalSidebar from "./GlobalSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isMarketingPage = pathname === "/" || pathname === "/compare" || pathname === "/brands";

  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [loadingAllowlist, setLoadingAllowlist] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "config", "allowedEmails"))
      .then((snap) => {
        const emails: string[] = snap.exists() ? (snap.data().emails || []) : [];
        const combined = [...new Set([ADMIN_EMAIL.toLowerCase(), ...emails.map((e: string) => e.toLowerCase())])];
        setAllowedEmails(combined);
      })
      .catch(() => {
        setAllowedEmails([ADMIN_EMAIL.toLowerCase()]);
      })
      .finally(() => setLoadingAllowlist(false));
  }, []);

  const isAllowed = user?.email && allowedEmails.includes(user.email.toLowerCase());

  // ── Access gate ──
  if (loading || loadingAllowlist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#13111a]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#e04c8a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#4a4458]">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#13111a] px-4">
        <div className="text-center max-w-sm">
          <img src="/logo-dark.svg" alt="Review Jam" width={120} height={30} className="mx-auto mb-6" />
          <h1 className="text-xl font-bold text-[#e8e4f0] mb-2">Invite only</h1>
          <p className="text-sm text-[#8b839e] mb-6">This site is currently in private preview. Sign in with an invited Google account to continue.</p>
          <button
            onClick={() => signInWithPopup(auth, googleProvider).catch(() => {})}
            className="btn-brand px-6 py-3 rounded-xl text-sm font-semibold w-full"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    const handleRedeem = async () => {
      if (!inviteCode.trim() || !user?.email) return;
      setIsRedeeming(true);
      setRedeemError("");
      setRedeemSuccess(false);
      try {
        await redeemReferralCode(inviteCode.trim(), user.email);
        setRedeemSuccess(true);
        const snap = await getDoc(doc(db, "config", "allowedEmails"));
        const emails: string[] = snap.exists() ? (snap.data().emails || []) : [];
        const combined = [...new Set([ADMIN_EMAIL.toLowerCase(), ...emails.map((e: string) => e.toLowerCase())])];
        setAllowedEmails(combined);
      } catch (err: any) {
        setRedeemError(err.message || "Failed to redeem code.");
      } finally {
        setIsRedeeming(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#13111a] px-4">
        <div className="text-center max-w-sm">
          <img src="/logo-dark.svg" alt="Review Jam" width={120} height={30} className="mx-auto mb-6" />
          <h1 className="text-xl font-bold text-[#e8e4f0] mb-2">Access restricted</h1>
          <p className="text-sm text-[#8b839e] mb-1">Signed in as <span className="font-medium text-[#cbc5d9]">{user.email}</span></p>
          <p className="text-sm text-[#8b839e] mb-6">This account doesn&apos;t have access. Contact the admin for an invite.</p>
          <button
            onClick={() => signOut(auth)}
            className="px-6 py-3 rounded-xl text-sm font-semibold border border-[#2a2535] text-[#cbc5d9] hover:bg-[#1c1826] transition w-full"
          >
            Sign out
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#2a2535]" />
            <span className="text-xs text-[#4a4458]">or</span>
            <div className="flex-1 h-px bg-[#2a2535]" />
          </div>

          {/* Invite code redemption */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#cbc5d9]">Have an invite code?</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="RJ-XXXXXX"
                maxLength={9}
                className="flex-1 bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2.5 text-sm text-[#e8e4f0] placeholder:text-[#4a4458] outline-none focus:border-[#e04c8a] transition font-mono text-center tracking-wider"
              />
              <button
                type="button"
                onClick={handleRedeem}
                disabled={isRedeeming || !inviteCode.trim()}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#e04c8a] hover:bg-[#c0357a] disabled:bg-[#2a2535] disabled:text-[#4a4458] text-white transition shrink-0"
              >
                {isRedeeming ? "..." : "Redeem"}
              </button>
            </div>
            {redeemError && (
              <p className="text-[12px] font-medium text-[#f87171]">{redeemError}</p>
            )}
            {redeemSuccess && (
              <p className="text-[12px] font-medium text-[#34d399]">
                Code redeemed! You now have access.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Normal app ──
  return (
    <div className="flex min-h-full flex-1">
      {!isMarketingPage && <GlobalSidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        {!isMarketingPage && (
          <div className="hidden md:flex items-center justify-between sticky top-0 z-30 bg-[#13111a]/95 backdrop-blur-sm border-b border-[#2a2535] px-4 py-2.5">
            <Link href="/">
              <img src="/logo-dark.svg" alt="Review Jam" width={120} height={30} />
            </Link>
            <nav className="flex items-center gap-5">
              <Link href="/feed" className={`text-sm font-medium transition ${pathname === "/feed" ? "text-[#e04c8a]" : "text-[#8b839e] hover:text-[#e8e4f0]"}`}>
                Feed
              </Link>
              <Link href="/c" className={`text-sm font-medium transition ${pathname.startsWith("/c") ? "text-[#e04c8a]" : "text-[#8b839e] hover:text-[#e8e4f0]"}`}>
                Communities
              </Link>
              <Link href="/explore" className={`text-sm font-medium transition ${pathname === "/explore" ? "text-[#e04c8a]" : "text-[#8b839e] hover:text-[#e8e4f0]"}`}>
                Products
              </Link>
              <Link href="/collections" className={`text-sm font-medium transition ${pathname.startsWith("/collections") ? "text-[#e04c8a]" : "text-[#8b839e] hover:text-[#e8e4f0]"}`}>
                Collections
              </Link>
            </nav>
          </div>
        )}
        <div className="flex-1 pb-[56px] md:pb-0">{children}</div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";
import { ADMIN_EMAIL } from "../../lib/constants";
import GlobalSidebar from "./GlobalSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isMarketingPage = pathname === "/" || pathname === "/compare" || pathname === "/brands";

  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [loadingAllowlist, setLoadingAllowlist] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "config", "allowedEmails"))
      .then((snap) => {
        const emails: string[] = snap.exists() ? (snap.data().emails || []) : [];
        // Admin is always allowed
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
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-zinc-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b] px-4">
        <div className="text-center max-w-sm">
          <img src="/logo.svg" alt="Review Jam" width={120} height={30} className="mx-auto mb-6 dark:hidden" />
          <img src="/logo-dark.svg" alt="Review Jam" width={120} height={30} className="mx-auto mb-6 hidden dark:block" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2">Invite only</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">This site is currently in private preview. Sign in with an invited Google account to continue.</p>
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b] px-4">
        <div className="text-center max-w-sm">
          <img src="/logo.svg" alt="Review Jam" width={120} height={30} className="mx-auto mb-6 dark:hidden" />
          <img src="/logo-dark.svg" alt="Review Jam" width={120} height={30} className="mx-auto mb-6 hidden dark:block" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2">Access restricted</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-1">Signed in as <span className="font-medium text-slate-700 dark:text-zinc-300">{user.email}</span></p>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">This account doesn&apos;t have access. Contact the admin for an invite.</p>
          <button
            onClick={() => signOut(auth)}
            className="px-6 py-3 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition w-full"
          >
            Sign out
          </button>
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
          <div className="hidden md:flex items-center justify-between sticky top-0 z-30 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/[0.06] px-4 py-2.5">
            <Link href="/">
              <img src="/logo.svg" alt="Review Jam" width={120} height={30} className="dark:hidden" />
              <img src="/logo-dark.svg" alt="Review Jam" width={120} height={30} className="hidden dark:block" />
            </Link>
            <nav className="flex items-center gap-5">
              <Link href="/feed" className={`text-sm font-medium transition ${pathname === "/feed" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"}`}>
                Feed
              </Link>
              <Link href="/c" className={`text-sm font-medium transition ${pathname.startsWith("/c") ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"}`}>
                Communities
              </Link>
              <Link href="/explore" className={`text-sm font-medium transition ${pathname === "/explore" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"}`}>
                Products
              </Link>
            </nav>
          </div>
        )}
        <div className="flex-1 pb-[56px] md:pb-0">{children}</div>
      </div>
    </div>
  );
}

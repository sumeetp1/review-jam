"use client";

import Link from "next/link";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../../../lib/firebase";
import { BrandHubProvider, useBrandHub } from "./BrandHubContext";
import TabNav from "./TabNav";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { user, campaigns, isLoading, isAuthorized } = useBrandHub();

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch {}
  };

  // Loading gate
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#13111a] text-[#8b839e] text-sm animate-pulse">
        Loading...
      </div>
    );
  }

  // Sign-in gate
  if (!user) {
    return (
      <main className="min-h-screen bg-[#13111a] flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-[#e8e4f0]">Brand Dashboard</h2>
        <p className="text-[#8b839e] text-sm max-w-xs text-center">
          Sign in with the email used when setting up your campaign to access your brand analytics.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          className="bg-[#e8e4f0] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#cbc5d9] transition"
        >
          Sign in with Google
        </button>
        <Link href="/brands" className="text-sm text-[#8b839e] hover:text-[#cbc5d9]">
          Don&apos;t have a campaign yet? &rarr;
        </Link>
      </main>
    );
  }

  // Unauthorized gate
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#13111a] flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-[#e8e4f0]">No campaigns found</h2>
        <p className="text-[#8b839e] text-sm max-w-sm text-center">
          We couldn&apos;t find any campaigns associated with <strong className="text-[#e8e4f0]">{user.email}</strong>.
          Make sure your campaign was created with this email, or contact us to get set up.
        </p>
        <div className="flex gap-3">
          <Link href="/brands" className="text-sm font-medium bg-[#e8e4f0] text-white px-4 py-2 rounded-lg hover:bg-[#cbc5d9] transition">
            Request a campaign
          </Link>
          <button type="button" onClick={() => auth.signOut()} className="text-sm text-[#8b839e] hover:text-[#e8e4f0] transition">
            Sign out
          </button>
        </div>
      </main>
    );
  }

  // Authorized — full shell
  return (
    <div className="min-h-screen bg-[#13111a] text-[#e8e4f0]">
      {/* Header */}
      <div className="border-b border-[#2a2535] bg-[#231e2e]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8b839e] uppercase tracking-wide mb-0.5">Brand Hub</p>
            <h1 className="text-lg font-semibold text-[#e8e4f0]">{campaigns[0]?.brandName}</h1>
          </div>
          <button
            type="button"
            onClick={() => auth.signOut()}
            className="text-xs text-[#8b839e] hover:text-[#e8e4f0] transition"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <TabNav />

      {/* Content area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
        {children}
      </div>
    </div>
  );
}

export default function BrandHubShell({ children }: { children: React.ReactNode }) {
  return (
    <BrandHubProvider>
      <ShellInner>{children}</ShellInner>
    </BrandHubProvider>
  );
}

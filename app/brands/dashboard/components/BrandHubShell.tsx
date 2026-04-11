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
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f3] text-[#8b7560] text-sm animate-pulse">
        Loading...
      </div>
    );
  }

  // Sign-in gate
  if (!user) {
    return (
      <main className="min-h-screen bg-[#fff8f3] flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-[#4a3828]">Brand Dashboard</h2>
        <p className="text-[#8b7560] text-sm max-w-xs text-center">
          Sign in with the email used when setting up your campaign to access your brand analytics.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          className="bg-[#4a3828] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#5c4a38] transition"
        >
          Sign in with Google
        </button>
        <Link href="/brands" className="text-sm text-[#8b7560] hover:text-[#5c4a38]">
          Don&apos;t have a campaign yet? &rarr;
        </Link>
      </main>
    );
  }

  // Unauthorized gate
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#fff8f3] flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-lg font-semibold text-[#4a3828]">No campaigns found</h2>
        <p className="text-[#8b7560] text-sm max-w-sm text-center">
          We couldn&apos;t find any campaigns associated with <strong className="text-[#4a3828]">{user.email}</strong>.
          Make sure your campaign was created with this email, or contact us to get set up.
        </p>
        <div className="flex gap-3">
          <Link href="/brands" className="text-sm font-medium bg-[#4a3828] text-white px-4 py-2 rounded-lg hover:bg-[#5c4a38] transition">
            Request a campaign
          </Link>
          <button type="button" onClick={() => auth.signOut()} className="text-sm text-[#8b7560] hover:text-[#4a3828] transition">
            Sign out
          </button>
        </div>
      </main>
    );
  }

  // Authorized — full shell
  return (
    <div className="min-h-screen bg-[#fff8f3] text-[#4a3828]">
      {/* Header */}
      <div className="border-b border-[#f5ddc0] bg-[#fff0e6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#8b7560] uppercase tracking-wide mb-0.5">Brand Hub</p>
            <h1 className="text-lg font-semibold text-[#4a3828]">{campaigns[0]?.brandName}</h1>
          </div>
          <button
            type="button"
            onClick={() => auth.signOut()}
            className="text-xs text-[#8b7560] hover:text-[#4a3828] transition"
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

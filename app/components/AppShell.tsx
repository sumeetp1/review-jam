"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSidebar from "./GlobalSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <div className="flex min-h-full flex-1">
      {!isHomePage && <GlobalSidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        {!isHomePage && (
          <div className="hidden md:block sticky top-0 z-30 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/[0.06] px-4 py-2.5">
            <Link href="/">
              <img src="/logo.svg" alt="Review Jam" width={120} height={30} className="dark:hidden" />
              <img src="/logo-dark.svg" alt="Review Jam" width={120} height={30} className="hidden dark:block" />
            </Link>
          </div>
        )}
        <div className="flex-1 pb-[56px] md:pb-0">{children}</div>
      </div>
    </div>
  );
}

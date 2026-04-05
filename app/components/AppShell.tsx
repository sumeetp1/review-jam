"use client";

import { usePathname } from "next/navigation";
import GlobalSidebar from "./GlobalSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <div className="min-h-full flex-1">
      {!isHomePage && <GlobalSidebar />}
      <div className={`flex-1 flex flex-col min-w-0 ${!isHomePage ? "md:ml-[60px]" : ""}`}>
        <div className="flex-1 pb-[56px] md:pb-0">{children}</div>
      </div>
    </div>
  );
}

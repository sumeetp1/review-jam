"use client";

import GlobalSidebar from "./GlobalSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <GlobalSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 pb-[56px] md:pb-0">{children}</div>
      </div>
    </div>
  );
}

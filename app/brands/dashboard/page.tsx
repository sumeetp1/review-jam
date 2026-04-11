"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/brands/dashboard/overview"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#13111a]">
      <p className="text-sm text-[#8b839e] animate-pulse">Loading...</p>
    </div>
  );
}

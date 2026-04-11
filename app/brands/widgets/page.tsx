"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WidgetsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/brands/dashboard/widget-studio"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff8f3]">
      <p className="text-sm text-[#8b7560] animate-pulse">Redirecting...</p>
    </div>
  );
}

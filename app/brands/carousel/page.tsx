"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CarouselRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/brands/dashboard/amazon-images"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b]">
      <p className="text-sm text-zinc-400 animate-pulse">Redirecting...</p>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CarouselRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/brands/dashboard/amazon-images"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff8f3]">
      <p className="text-sm text-[#8b7560] animate-pulse">Redirecting...</p>
    </div>
  );
}

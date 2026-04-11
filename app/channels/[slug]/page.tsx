"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChannelSlugRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  useEffect(() => { router.replace(`/c/${slug}`); }, [slug, router]);
  return (
    <div className="min-h-screen bg-[#13111a] flex items-center justify-center text-sm text-[#8b839e]">
      Redirecting…
    </div>
  );
}

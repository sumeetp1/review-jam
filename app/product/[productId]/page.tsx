"use client";

/**
 * Legacy product route — redirects to the new slug-based community URL.
 * /product/[firestoreId]  →  /c/[communitySlug]/[slug]
 *
 * If the product hasn't been migrated yet (no slug/communitySlug),
 * we redirect to /explore as a safe fallback.
 */

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function ProductIdRedirect({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();

  useEffect(() => {
    if (!productId) return;
    getDoc(doc(db, "products", productId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.slug && data.communitySlug) {
          router.replace(`/c/${data.communitySlug}/${data.slug}`);
          return;
        }
      }
      // Fallback — product not found or not yet migrated
      router.replace("/explore");
    }).catch(() => router.replace("/explore"));
  }, [productId, router]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center text-sm text-slate-400">
      Loading product…
    </div>
  );
}

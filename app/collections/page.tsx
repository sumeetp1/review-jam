"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";
import CreateCollectionModal from "../components/CreateCollectionModal";
import type { Collection } from "../../lib/types";

export default function CollectionsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [trustScore, setTrustScore] = useState(0);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/explore");
    }
  }, [user, loading, router]);

  // Fetch collections and user trust score
  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const [collSnap, userDoc] = await Promise.all([
          getDocs(collection(db, "collections")),
          getDoc(doc(db, "users", user!.uid)),
        ]);

        const items: Collection[] = collSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Collection))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setCollections(items);

        if (userDoc.exists()) {
          setTrustScore(userDoc.data().trustScore ?? 0);
        }
      } catch (error) {
        console.error("Failed to load collections:", error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#13111a] flex items-center justify-center text-[#8b839e] text-sm animate-pulse">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#13111a] text-[#e8e4f0]">
      {showCreate && (
        <CreateCollectionModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          userId={user.uid}
          userName={user.displayName || "Anonymous"}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#13111a]/95 backdrop-blur-md border-b border-[#2a2535]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-[#e8e4f0] leading-tight">Collections</h1>
            <p className="text-[12px] text-[#8b839e] hidden sm:block">
              Curated product lists by the community
            </p>
          </div>
          {trustScore >= 100 && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
            >
              <span>+</span> Create Collection
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {isLoading ? (
          <div className="py-12 text-center text-[#8b839e] text-sm animate-pulse">Loading...</div>
        ) : collections.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[#8b839e] text-sm">No collections yet. Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.slug}`}
                className="group glass-card flex flex-col overflow-hidden hover:border-[#2a2535] hover:shadow-md hover:shadow-[#2a2535]/50 transition"
              >
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none shrink-0">{c.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-[#e8e4f0] group-hover:text-[#e04c8a] leading-snug transition-colors">
                        {c.name}
                      </h3>
                      <p className="text-[12px] text-[#8b839e] mt-0.5">
                        by {c.creatorName}
                      </p>
                    </div>
                  </div>

                  {c.description && (
                    <p className="text-[12px] text-[#8b839e] leading-relaxed line-clamp-2">
                      {c.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-[#8b839e] mt-auto pt-2 border-t border-[#2a2535]">
                    <span>{c.productIds.length} product{c.productIds.length !== 1 ? "s" : ""}</span>
                    {c.isOfficial && (
                      <span className="text-[10px] font-semibold text-[#e04c8a] bg-[#e04c8a]/12 px-1.5 py-0.5 rounded-full">
                        Official
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

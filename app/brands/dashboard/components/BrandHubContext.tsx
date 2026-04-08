"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../lib/hooks/useAuth";

import type { BrandProduct as Campaign, BrandReview as Review, BrandResponse, BuyLink } from "../../../../lib/types";

export type ReviewWithResponse = Review & {
  brandResponse?: BrandResponse;
  productId?: string;
};

type BrandHubContextType = {
  user: any;
  campaigns: Campaign[];
  allReviews: ReviewWithResponse[];
  buyLinksMap: Record<string, BuyLink[]>;
  setBuyLinksMap: React.Dispatch<React.SetStateAction<Record<string, BuyLink[]>>>;
  setAllReviews: React.Dispatch<React.SetStateAction<ReviewWithResponse[]>>;
  selectedCampaign: string;
  setSelectedCampaign: (id: string) => void;
  baseUrl: string;
  refreshData: () => Promise<void>;
  isLoading: boolean;
  isAuthorized: boolean;
};

const BrandHubContext = createContext<BrandHubContextType | null>(null);

export function useBrandHub() {
  const ctx = useContext(BrandHubContext);
  if (!ctx) throw new Error("useBrandHub must be used within a BrandHubProvider");
  return ctx;
}

export function BrandHubProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewWithResponse[]>([]);
  const [buyLinksMap, setBuyLinksMap] = useState<Record<string, BuyLink[]>>({});
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://reviewjam.com";

  const loadBrandData = useCallback(async (email: string) => {
    const q = query(collection(db, "products"), where("brandEmail", "==", email.toLowerCase()));
    const snap = await getDocs(q);

    if (snap.empty) {
      setIsAuthorized(false);
      return;
    }

    setIsAuthorized(true);
    const fetchedCampaigns: Campaign[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
    setCampaigns(fetchedCampaigns);

    // Load buy links from product docs
    const linksMap: Record<string, BuyLink[]> = {};
    for (const d of snap.docs) {
      const data = d.data();
      if (data.buyLinks && Array.isArray(data.buyLinks)) {
        linksMap[d.id] = data.buyLinks as BuyLink[];
      }
    }
    setBuyLinksMap(linksMap);

    // Fetch all reviews for these campaigns
    const campaignIds = fetchedCampaigns.map((c) => c.campaignId);
    const campaignToProduct: Record<string, string> = {};
    for (const c of fetchedCampaigns) {
      campaignToProduct[c.campaignId] = c.id;
    }
    const reviews: ReviewWithResponse[] = [];

    for (const cid of campaignIds) {
      const rq = query(collection(db, "reviews"), where("campaignId", "==", cid));
      const rsnap = await getDocs(rq);
      rsnap.forEach((d) => {
        const data = d.data();
        reviews.push({ id: d.id, ...data, productId: data.productId || campaignToProduct[cid] } as ReviewWithResponse);
      });
    }

    reviews.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    setAllReviews(reviews);
  }, []);

  const refreshData = useCallback(async () => {
    if (user?.email) {
      await loadBrandData(user.email);
    }
  }, [user, loadBrandData]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.email) {
      loadBrandData(user.email).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [user, authLoading, loadBrandData]);

  return (
    <BrandHubContext.Provider
      value={{
        user,
        campaigns,
        allReviews,
        buyLinksMap,
        setBuyLinksMap,
        setAllReviews,
        selectedCampaign,
        setSelectedCampaign,
        baseUrl,
        refreshData,
        isLoading,
        isAuthorized,
      }}
    >
      {children}
    </BrandHubContext.Provider>
  );
}

import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

export type Badge = {
  id: string;
  label: string;
  emoji: string;
  description: string;
};

export const ALL_BADGES: Badge[] = [
  { id: "verified_buyer",     label: "Verified Buyer",      emoji: "✅", description: "Reviewed a product they personally purchased" },
  { id: "campaign_reviewer",  label: "Campaign Reviewer",   emoji: "🎯", description: "Participated in a brand review campaign" },
  { id: "prolific_reviewer",  label: "Prolific Reviewer",   emoji: "✍️", description: "Posted 5 or more reviews" },
  { id: "photo_reviewer",     label: "Photo Reviewer",      emoji: "📸", description: "Included photos in at least one review" },
  { id: "tech_expert",        label: "Tech Expert",         emoji: "💻", description: "3+ reviews in Tech" },
  { id: "home_expert",        label: "Home Expert",         emoji: "🏠", description: "3+ reviews in Home" },
  { id: "beauty_expert",      label: "Beauty Expert",       emoji: "💄", description: "3+ reviews in Beauty" },
  { id: "gaming_expert",      label: "Gaming Expert",       emoji: "🎮", description: "3+ reviews in Gaming" },
  { id: "fitness_expert",     label: "Fitness Expert",      emoji: "💪", description: "3+ reviews in Fitness" },
  { id: "saas_expert",        label: "SaaS Expert",         emoji: "☁️", description: "3+ reviews in SaaS" },
  { id: "automotive_expert",  label: "Auto Expert",         emoji: "🚗", description: "3+ reviews in Automotive" },
  { id: "travel_expert",      label: "Travel Expert",       emoji: "✈️", description: "3+ reviews in Travel" },
  { id: "finance_expert",     label: "Finance Expert",      emoji: "💰", description: "3+ reviews in Finance" },
];

export function getBadgeById(id: string): Badge | undefined {
  return ALL_BADGES.find((b) => b.id === id);
}

export async function updateUserBadges(userId: string): Promise<string[]> {
  const q = query(collection(db, "reviews"), where("reviewerId", "==", userId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map((d) => d.data());

  const earned: string[] = [];

  if (reviews.some((r) => r.productSource === "purchased")) {
    earned.push("verified_buyer");
  }
  if (reviews.some((r) => r.isCampaignReview === true)) {
    earned.push("campaign_reviewer");
  }
  if (reviews.length >= 5) {
    earned.push("prolific_reviewer");
  }
  if (reviews.some((r) => r.mediaUrls && r.mediaUrls.length > 0)) {
    earned.push("photo_reviewer");
  }

  // Category expert: 3+ reviews in same category
  const categoryCounts: Record<string, number> = {};
  reviews.forEach((r) => {
    if (r.category) {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    }
  });
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count >= 3) {
      const expertId = `${cat.toLowerCase()}_expert`;
      if (ALL_BADGES.some((b) => b.id === expertId)) {
        earned.push(expertId);
      }
    }
  }

  try {
    await updateDoc(doc(db, "users", userId), { badges: earned });
  } catch {
    // User doc may not exist yet for newly registered users; ignore
  }

  return earned;
}

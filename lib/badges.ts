import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

export type Badge = {
  id: string;
  label: string;
  emoji: string;
  description: string;
};

// Base badges — always available
export const BASE_BADGES: Badge[] = [
  { id: "verified_buyer",     label: "Verified Buyer",      emoji: "✅", description: "Reviewed a product they personally purchased" },
  { id: "prolific_reviewer",  label: "Prolific Reviewer",   emoji: "✍️", description: "Posted 5 or more reviews" },
  { id: "photo_reviewer",     label: "Photo Reviewer",      emoji: "📸", description: "Included photos in at least one review" },
];

// Dynamic category expert badges are generated at runtime from review data.
// Any category with 3+ reviews earns a "[Category] Expert" badge.
// For backward compatibility, ALL_BADGES includes base badges; getBadgeById
// also checks for dynamic expert badge IDs.

export const ALL_BADGES = BASE_BADGES;

export function getBadgeById(id: string): Badge | undefined {
  const base = BASE_BADGES.find((b) => b.id === id);
  if (base) return base;

  // Dynamic expert badge: id format is "category_expert" (e.g. "tech_expert", "ev_charging_expert")
  if (id.endsWith("_expert")) {
    const catPart = id.slice(0, -"_expert".length).replace(/_/g, " ");
    const label = catPart.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return { id, label: `${label} Expert`, emoji: "🏅", description: `3+ reviews in ${label}` };
  }
  return undefined;
}

export async function updateUserBadges(userId: string): Promise<string[]> {
  const q = query(collection(db, "reviews"), where("reviewerId", "==", userId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map((d) => d.data());

  const earned: string[] = [];

  if (reviews.some((r) => r.productSource === "purchased")) {
    earned.push("verified_buyer");
  }
  if (reviews.length >= 5) {
    earned.push("prolific_reviewer");
  }
  if (reviews.some((r) => r.mediaUrls && r.mediaUrls.length > 0)) {
    earned.push("photo_reviewer");
  }

  // Dynamic category expert: 3+ reviews in any category
  const categoryCounts: Record<string, number> = {};
  reviews.forEach((r) => {
    if (r.category) {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    }
  });
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count >= 3) {
      const expertId = `${cat.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_expert`;
      earned.push(expertId);
    }
  }

  try {
    await updateDoc(doc(db, "users", userId), { badges: earned });
  } catch {
    // User doc may not exist yet for newly registered users; ignore
  }

  return earned;
}

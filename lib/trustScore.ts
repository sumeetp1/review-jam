import { doc, increment, getDoc, updateDoc, addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";

const MILESTONES = [50, 100, 250, 500, 1000];

export function getTierLabel(score: number): string {
  if (score >= 500) return "Legend";
  if (score >= 250) return "Authority";
  if (score >= 100) return "Trusted";
  if (score >= 50) return "Contributor";
  return "Newcomer";
}

export async function incrementTrustScore(
  userId: string,
  event: string,
  delta: number,
): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { trustScore: increment(delta) });
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const newScore: number = snap.data().trustScore ?? 0;
    const oldScore = newScore - delta;

    for (const milestone of MILESTONES) {
      if (oldScore < milestone && newScore >= milestone) {
        await addDoc(collection(db, "notifications"), {
          userId,
          type: "trust_milestone",
          title: `You've reached ${getTierLabel(milestone)}!`,
          body: `Your trust score hit ${milestone}. Keep it up!`,
          read: false,
          createdAt: new Date().toISOString(),
        });
        break;
      }
    }
  } catch {
    // Non-critical — fail silently
  }
}

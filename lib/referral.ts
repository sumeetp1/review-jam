// ─── Referral System ────────────────────────────────────────────────────────
// Generate and redeem invite codes for the allowlist gate.

import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, query, where, getDocs,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { MAX_REFERRAL_CODES } from "./constants";
import type { ReferralCode } from "./types";

// ── Generate a new referral code ────────────────────────────────────────────

export async function generateReferralCode(
  userId: string,
  userName: string,
  userEmail: string,
): Promise<string> {
  // Check how many codes the user has already generated
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const codesGenerated = userSnap.exists()
    ? (userSnap.data().referralCodesGenerated ?? 0)
    : 0;

  if (codesGenerated >= MAX_REFERRAL_CODES) {
    throw new Error(`You have already generated the maximum of ${MAX_REFERRAL_CODES} invite codes.`);
  }

  // Generate code: RJ-XXXXXX (6 random uppercase alphanumeric chars)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const code = `RJ-${suffix}`;

  // Write the referral code doc
  await setDoc(doc(db, "referralCodes", code), {
    creatorId: userId,
    creatorName: userName,
    creatorEmail: userEmail.toLowerCase(),
    createdAt: new Date().toISOString(),
    status: "active",
  });

  // Increment the user's generated count
  await updateDoc(userRef, {
    referralCodesGenerated: increment(1),
  });

  return code;
}

// ── Redeem a referral code ──────────────────────────────────────────────────

export async function redeemReferralCode(
  code: string,
  email: string,
): Promise<void> {
  const codeRef = doc(db, "referralCodes", code.toUpperCase().trim());
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) {
    throw new Error("Invalid invite code.");
  }

  const data = codeSnap.data();

  if (data.status !== "active") {
    throw new Error("This invite code has already been used.");
  }

  // Mark code as used
  await updateDoc(codeRef, {
    usedBy: email.toLowerCase(),
    usedAt: new Date().toISOString(),
    status: "used",
  });

  // Add email to the allowlist
  await setDoc(
    doc(db, "config", "allowedEmails"),
    { emails: arrayUnion(email.toLowerCase()) },
    { merge: true },
  );
}

// ── Get all referral codes for a user ───────────────────────────────────────

export async function getUserReferralCodes(
  userId: string,
): Promise<ReferralCode[]> {
  const q = query(
    collection(db, "referralCodes"),
    where("creatorId", "==", userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReferralCode));
}

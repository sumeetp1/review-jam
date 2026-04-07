import {
  collection, getDocs, query, where, doc, getDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { sendEmail } from "../../../lib/sendgrid";
import {
  welcomeEmail,
  weeklyDigestEmail,
  payoutNotificationEmail,
  newFollowerEmail,
} from "../../../lib/emailTemplates";
import { jsonError, jsonSuccess } from "../../../lib/api";

// ─── Email Lifecycle API ─────────────────────────────────────────────────────
//
// POST /api/email
//
// Actions:
//   send-welcome   { userId }
//   send-digest    (no params — sends to all users)
//   send-payout    { userId, amount, productName }
//   send-follower  { userId, followerName, followerTrustScore }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── Welcome Email ──────────────────────────────────────────────────────
    if (action === "send-welcome") {
      const { userId } = body;
      if (!userId) return jsonError("userId is required.", 400);

      const userSnap = await getDoc(doc(db, "users", userId));
      if (!userSnap.exists()) return jsonError("User not found.", 404);

      const userData = userSnap.data();
      if (!userData.email) return jsonError("User has no email address.", 400);

      const { subject, html } = welcomeEmail(userData.displayName || "");
      const sent = await sendEmail(userData.email, subject, html);

      return jsonSuccess({ sent: sent ? 1 : 0 });
    }

    // ── Weekly Digest ──────────────────────────────────────────────────────
    if (action === "send-digest") {
      const usersSnap = await getDocs(collection(db, "users"));
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneWeekAgoISO = oneWeekAgo.toISOString();

      let sentCount = 0;

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        if (!userData.email) continue;

        const userInterests: string[] = userData.interests || [];

        // Count new reviews in user's interest categories from last 7 days
        let newReviewCount = 0;
        if (userInterests.length > 0) {
          try {
            // Firestore "in" queries support up to 30 values
            const interestBatch = userInterests.slice(0, 30);
            const reviewsSnap = await getDocs(
              query(
                collection(db, "reviews"),
                where("category", "in", interestBatch),
              ),
            );
            // Filter client-side for date range (Firestore can't combine "in" + range on different fields easily)
            newReviewCount = reviewsSnap.docs.filter((d) => {
              const createdAt = d.data().createdAt;
              return createdAt && createdAt >= oneWeekAgoISO;
            }).length;
          } catch {
            // If interests query fails, fall back to 0
          }
        }

        // Sum payouts from last 7 days for this user
        let weeklyEarnings = 0;
        try {
          const payoutsSnap = await getDocs(
            query(
              collection(db, "payoutLedger"),
              where("userId", "==", userDoc.id),
            ),
          );
          for (const pDoc of payoutsSnap.docs) {
            const pData = pDoc.data();
            if (pData.paidAt && pData.paidAt >= oneWeekAgoISO) {
              weeklyEarnings += pData.amount || 0;
            }
          }
        } catch {
          // Non-fatal — keep earnings at 0
        }

        // Get follower count
        let followerCount = 0;
        try {
          const followersSnap = await getDocs(
            query(
              collection(db, "follows"),
              where("followingId", "==", userDoc.id),
            ),
          );
          followerCount = followersSnap.size;
        } catch {
          // Non-fatal
        }

        // Top categories = user's own interests (capped at 5)
        const topCategories = userInterests.slice(0, 5);

        const { subject, html } = weeklyDigestEmail({
          userName: userData.displayName || "",
          newReviewCount,
          topCategories,
          earnings: weeklyEarnings,
          followerCount,
        });

        const sent = await sendEmail(userData.email, subject, html);
        if (sent) sentCount++;
      }

      return jsonSuccess({ sent: sentCount });
    }

    // ── Payout Notification ────────────────────────────────────────────────
    if (action === "send-payout") {
      const { userId, amount, productName } = body;
      if (!userId || amount == null || !productName) {
        return jsonError("userId, amount, and productName are required.", 400);
      }

      const userSnap = await getDoc(doc(db, "users", userId));
      if (!userSnap.exists()) return jsonError("User not found.", 404);

      const userData = userSnap.data();
      if (!userData.email) return jsonError("User has no email address.", 400);

      const { subject, html } = payoutNotificationEmail({
        userName: userData.displayName || "",
        amount,
        productName,
        totalEarned: userData.totalEarned || 0,
      });

      const sent = await sendEmail(userData.email, subject, html);
      return jsonSuccess({ sent: sent ? 1 : 0 });
    }

    // ── New Follower Notification ──────────────────────────────────────────
    if (action === "send-follower") {
      const { userId, followerName, followerTrustScore } = body;
      if (!userId || !followerName) {
        return jsonError("userId and followerName are required.", 400);
      }

      const userSnap = await getDoc(doc(db, "users", userId));
      if (!userSnap.exists()) return jsonError("User not found.", 404);

      const userData = userSnap.data();
      if (!userData.email) return jsonError("User has no email address.", 400);

      const { subject, html } = newFollowerEmail({
        userName: userData.displayName || "",
        followerName,
        followerTrustScore: followerTrustScore ?? 0,
      });

      const sent = await sendEmail(userData.email, subject, html);
      return jsonSuccess({ sent: sent ? 1 : 0 });
    }

    return jsonError("Invalid action. Use: send-welcome, send-digest, send-payout, send-follower.", 400);

  } catch (error) {
    console.error("Email API Error:", error);
    return jsonError("Internal server error.", 500);
  }
}

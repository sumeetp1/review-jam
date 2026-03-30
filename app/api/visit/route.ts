import { NextResponse } from "next/server";
import {
  doc,
  getDoc,
  increment,
  runTransaction,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

/** Matches UUID v4 (cookie value from crypto.randomUUID). */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Firestore: allow read/write on `siteStats/aggregates` and `uniqueVisitorIds/{id}`
 * for your web client key (same as other server routes using `lib/firebase`).
 */
export async function GET() {
  try {
    const snap = await getDoc(doc(db, "siteStats", "aggregates"));
    const n = snap.data()?.uniqueVisitors;
    return NextResponse.json({
      uniqueVisitors: typeof n === "number" ? n : 0,
    });
  } catch (e) {
    console.error("visit GET:", e);
    return NextResponse.json({ uniqueVisitors: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const visitorId = body?.visitorId;
    if (typeof visitorId !== "string" || !UUID_V4.test(visitorId)) {
      return NextResponse.json({ error: "Invalid visitor id" }, { status: 400 });
    }

    const statsRef = doc(db, "siteStats", "aggregates");
    const visitorRef = doc(db, "uniqueVisitorIds", visitorId);

    const uniqueVisitors = await runTransaction(db, async (transaction) => {
      const vSnap = await transaction.get(visitorRef);
      const sSnap = await transaction.get(statsRef);
      const current =
        typeof sSnap.data()?.uniqueVisitors === "number"
          ? sSnap.data()!.uniqueVisitors
          : 0;

      if (vSnap.exists()) {
        return current;
      }

      transaction.set(visitorRef, {
        firstSeen: new Date().toISOString(),
      });

      transaction.set(
        statsRef,
        {
          uniqueVisitors: increment(1),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return current + 1;
    });

    return NextResponse.json({ success: true, uniqueVisitors });
  } catch (e) {
    console.error("visit POST:", e);
    return NextResponse.json(
      { success: false, error: "Failed to record visit" },
      { status: 500 }
    );
  }
}

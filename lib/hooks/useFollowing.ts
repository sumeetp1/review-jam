import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useFollowing(userId: string | undefined): Set<string> {
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "follows"), where("followerId", "==", userId));
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.docs.forEach((d) => ids.add(d.data().followingId));
      setFollowing(ids);
    }, () => {});
    return () => unsub();
  }, [userId]);

  return following;
}

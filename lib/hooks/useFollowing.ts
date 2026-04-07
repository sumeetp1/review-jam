import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useFollowing(userId: string | undefined): { following: Set<string>; loading: boolean } {
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setFollowing(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "follows"), where("followerId", "==", userId));
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.docs.forEach((d) => ids.add(d.data().followingId));
      setFollowing(ids);
      setLoading(false);
    }, () => {
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  return { following, loading };
}

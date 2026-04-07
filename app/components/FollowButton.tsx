"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

type Props = {
  targetUserId: string;
  currentUserId?: string;
  currentUserName?: string;
};

export default function FollowButton({ targetUserId, currentUserId, currentUserName }: Props) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followDocId, setFollowDocId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Don't render if not logged in or viewing own profile
  const hidden = !currentUserId || targetUserId === currentUserId;

  useEffect(() => {
    if (hidden) return;

    let cancelled = false;

    async function check() {
      const q = query(
        collection(db, "follows"),
        where("followerId", "==", currentUserId),
        where("followingId", "==", targetUserId),
      );
      const snap = await getDocs(q);
      if (cancelled) return;
      if (!snap.empty) {
        setIsFollowing(true);
        setFollowDocId(snap.docs[0].id);
      } else {
        setIsFollowing(false);
        setFollowDocId(null);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [currentUserId, targetUserId, hidden]);

  if (hidden) return null;

  const handleFollow = async () => {
    if (busy || !currentUserId) return;
    setBusy(true);
    try {
      // Create follow doc
      const docRef = await addDoc(collection(db, "follows"), {
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: new Date().toISOString(),
      });
      setFollowDocId(docRef.id);
      setIsFollowing(true);

      // Update counters
      await Promise.all([
        updateDoc(doc(db, "users", targetUserId), { followerCount: increment(1) }),
        updateDoc(doc(db, "users", currentUserId), { followingCount: increment(1) }),
      ]);

      // Create notification
      await addDoc(collection(db, "notifications"), {
        userId: targetUserId,
        type: "new_follower",
        title: "New follower",
        body: `${currentUserName || "Someone"} started following you`,
        link: `/reviewer/${currentUserId}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Follow failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleUnfollow = async () => {
    if (busy || !currentUserId || !followDocId) return;
    setBusy(true);
    try {
      // Delete follow doc
      await deleteDoc(doc(db, "follows", followDocId));
      setIsFollowing(false);
      setFollowDocId(null);

      // Decrement counters
      await Promise.all([
        updateDoc(doc(db, "users", targetUserId), { followerCount: increment(-1) }),
        updateDoc(doc(db, "users", currentUserId), { followingCount: increment(-1) }),
      ]);
    } catch (err) {
      console.error("Unfollow failed:", err);
    } finally {
      setBusy(false);
    }
  };

  if (isFollowing) {
    return (
      <button
        type="button"
        onClick={handleUnfollow}
        disabled={busy}
        className="text-xs font-semibold px-4 py-1.5 rounded-lg transition border border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-zinc-300 hover:border-red-300 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 group"
      >
        <span className="group-hover:hidden">Following</span>
        <span className="hidden group-hover:inline">Unfollow</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleFollow}
      disabled={busy}
      className="text-xs font-semibold px-4 py-1.5 rounded-lg transition bg-indigo-600 text-white hover:bg-indigo-500"
    >
      Follow
    </button>
  );
}

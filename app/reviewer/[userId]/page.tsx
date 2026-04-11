"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  collection, query, where, getDocs, doc, getDoc,
  orderBy, limit, getCountFromServer,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/hooks/useAuth";
import { getTierLabel } from "../../../lib/trustScore";
import { getTierStyle } from "../../../lib/trustTiers";
import { getBadgeById } from "../../../lib/badges";
import Avatar from "../../components/Avatar";
import ReviewCard from "../../components/ReviewCard";
import FollowButton from "../../components/FollowButton";
import type { ReviewData } from "../../../lib/types";

type UserData = {
  displayName?: string;
  photoURL?: string;
  bio?: string;
  trustScore?: number;
  badges?: string[];
};

export default function ReviewerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { user: currentUser } = useAuth();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      setLoading(true);

      // Fetch user doc
      const userSnap = await getDoc(doc(db, "users", userId));
      if (!userSnap.exists()) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setUserData(userSnap.data() as UserData);

      // Fetch reviews
      try {
        const reviewsQ = query(
          collection(db, "reviews"),
          where("reviewerId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(20),
        );
        const reviewsSnap = await getDocs(reviewsQ);
        setReviews(
          reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewData)),
        );
      } catch {
        // Index may not exist yet
      }

      // Count followers
      try {
        const followsQ = query(
          collection(db, "follows"),
          where("followingId", "==", userId),
        );
        const countSnap = await getCountFromServer(followsQ);
        setFollowersCount(countSnap.data().count);
      } catch {
        // Ignore if collection doesn't exist
      }

      setLoading(false);
    }

    load();
  }, [userId]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f3] text-sm text-[#8b7560]">
        Loading...
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !userData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f3] p-8 gap-3">
        <h2 className="text-base font-semibold text-[#4a3828]">
          Reviewer not found
        </h2>
        <Link
          href="/feed"
          className="text-sm text-[#8b7560] hover:underline"
        >
          &larr; Back to feed
        </Link>
      </div>
    );
  }

  // ── Computed values ────────────────────────────────────────────────────────
  const trustScore = userData.trustScore || 0;
  const badges = userData.badges || [];
  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        ).toFixed(1)
      : null;
  const { bg, text, emoji } = getTierStyle(trustScore);

  return (
    <main className="min-h-screen bg-[#fff8f3] text-[#4a3828]">
      <div className="max-w-3xl mx-auto px-4 sm py-6 space-y-5">
        {/* Back link */}
        <Link
          href="/feed"
          className="text-sm text-[#8b7560] hover:underline inline-block"
        >
          &larr; Back to feed
        </Link>

        {/* Identity card */}
        <div className="bg-white p-5 rounded-xl border border-[#f5ddc0] flex items-center gap-4">
          <Avatar
            name={userData.displayName}
            src={userData.photoURL}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-[#4a3828] truncate">
              {userData.displayName || "Anonymous"}
            </h1>
            {userData.bio && (
              <p className="text-sm text-[#8b7560] mt-0.5 line-clamp-2">
                {userData.bio}
              </p>
            )}
            {/* Trust Tier badge */}
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${bg} ${text}`}
              >
                {emoji} {getTierLabel(trustScore)}
                <span className="font-normal opacity-70">
                  &middot; {trustScore} pts
                </span>
              </span>
            </div>
            {/* Earned badges */}
            {badges.length > 0 && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {badges.map((bid) => {
                  const b = getBadgeById(bid);
                  return b ? (
                    <span
                      key={bid}
                      title={b.description}
                      className="inline-flex items-center gap-0.5 text-[11px] bg-[#ffecd2] text-[#8b7560] px-2 py-0.5 rounded-md font-medium"
                    >
                      {b.emoji} {b.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            {/* Follow button */}
            {currentUser && currentUser.uid !== userId && (
              <div className="mt-2">
                <FollowButton targetUserId={userId} />
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm gap-3">
          {[
            { label: "Reviews", value: reviews.length },
            {
              label: "Avg rating",
              value: avgRating ? `\u2605 ${avgRating}` : "\u2014",
            },
            {
              label: "Trust score",
              value: trustScore,
              sub: getTierLabel(trustScore),
            },
            { label: "Followers", value: followersCount },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-[#f5ddc0] p-4 text-center"
            >
              <p className="text-xl font-semibold text-[#4a3828] tabular-nums">
                {s.value}
              </p>
              <p className="text-[11px] text-[#8b7560] mt-0.5 uppercase tracking-wide">
                {s.label}
              </p>
              {"sub" in s && s.sub && (
                <p className="text-[10px] text-[#e65100] font-medium mt-0.5">
                  {s.sub}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Reviews section */}
        <div>
          <h2 className="text-sm font-semibold text-[#4a3828] mb-3">
            Reviews
          </h2>
          {reviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#f5ddc0] p-8 text-center">
              <p className="text-sm text-[#8b7560]">
                No reviews yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  currentUserId={currentUser?.uid}
                  currentUserName={
                    currentUser?.displayName || undefined
                  }
                  showPoolLink={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

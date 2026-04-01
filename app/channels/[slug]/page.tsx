"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  collection, query, where, getDocs, addDoc, doc, updateDoc,
  increment, arrayUnion, arrayRemove, orderBy, deleteDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { db, auth, storage } from "../../../lib/firebase";
import { updateUserBadges } from "../../../lib/badges";
import { computeHealthScore } from "../../../lib/healthScore";
import ReviewCard, { type ReviewData } from "../../components/ReviewCard";
import ReviewWizard, { type ReviewFormData } from "../../components/ReviewWizard";
import BottomNav from "../../components/BottomNav";

type Channel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  memberCount: number;
  reviewCount: number;
  creatorName: string;
};

export default function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [showReviewWizard, setShowReviewWizard] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "likes" | "score">("newest");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Load channel
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "channels"), where("slug", "==", slug)));
        if (snap.empty) { setLoading(false); return; }
        const ch = { id: snap.docs[0].id, ...snap.docs[0].data() } as Channel;
        setChannel(ch);

        // Load reviews for this channel
        const rSnap = await getDocs(query(collection(db, "reviews"), where("channelId", "==", ch.id)));
        setReviews(rSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewData)));
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [slug]);

  // Check membership
  useEffect(() => {
    if (!user || !channel) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, "channelMembers"), where("channelId", "==", channel.id), where("userId", "==", user.uid))
      );
      setIsMember(!snap.empty);
    })();
  }, [user, channel]);

  const handleLogin = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(() => {});

  const handleJoinLeave = async () => {
    if (!user || !channel) { handleLogin(); return; }
    if (isMember) {
      // Leave
      const snap = await getDocs(
        query(collection(db, "channelMembers"), where("channelId", "==", channel.id), where("userId", "==", user.uid))
      );
      for (const d of snap.docs) await deleteDoc(d.ref);
      await updateDoc(doc(db, "channels", channel.id), { memberCount: increment(-1) });
      setIsMember(false);
      setChannel((ch) => ch ? { ...ch, memberCount: Math.max(0, ch.memberCount - 1) } : ch);
    } else {
      // Join
      await addDoc(collection(db, "channelMembers"), {
        channelId: channel.id,
        userId: user.uid,
        joinedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "channels", channel.id), { memberCount: increment(1) });
      setIsMember(true);
      setChannel((ch) => ch ? { ...ch, memberCount: ch.memberCount + 1 } : ch);
    }
  };

  const handleReviewSubmit = async (data: ReviewFormData) => {
    if (!user || !channel) throw new Error("Must be signed in.");

    const mediaUrls: string[] = [];
    for (const file of data.mediaFiles) {
      const fileRef = storageRef(storage, `reviews/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      mediaUrls.push(await getDownloadURL(fileRef));
    }

    let marketingQuote = data.summary || "";
    if (data.reviewType !== "generic") {
      const resp = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewContent: data.content,
          reviewerName: user.displayName,
          pros: data.pros,
          cons: data.cons,
          summary: data.summary,
        }),
      });
      const result = await resp.json();
      if (result.isGenuine === false) throw new Error(result.reason || "Review did not pass quality check.");
      if (result.marketingQuote) marketingQuote = result.marketingQuote;
    }

    const { score, breakdown } = computeHealthScore(
      { ...data, mediaUrls, content: data.content, likesCount: 0, helpfulCount: 0, commentCount: 0 },
      0, 0,
    );

    const newReview: Record<string, unknown> = {
      productName: data.productName,
      category: data.category,
      rating: data.overallRating,
      subRatings: data.subRatings,
      content: data.content,
      summary: data.summary,
      marketingQuote,
      pros: data.pros,
      cons: data.cons,
      bestFor: data.bestFor,
      mediaUrls,
      reviewerId: user.uid,
      reviewerName: user.displayName || "Anonymous",
      likesCount: 0,
      likedBy: [],
      helpfulCount: 0,
      helpfulBy: [],
      notHelpfulCount: 0,
      notHelpfulBy: [],
      commentCount: 0,
      forkCount: 0,
      versionCount: 1,
      campaignId: "organic",
      isCampaignReview: data.isCampaignReview,
      reviewType: data.reviewType,
      productSource: data.productSource,
      usageDuration: data.usageDuration,
      eligibleForPayout: data.reviewType !== "generic",
      channelId: channel.id,
      channelSlug: channel.slug,
      healthScore: score,
      healthScoreBreakdown: breakdown,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setReviews((prev) => [{ id: docRef.id, ...newReview } as ReviewData, ...prev]);

    // Bump channel review count
    await updateDoc(doc(db, "channels", channel.id), { reviewCount: increment(1) });
    setChannel((ch) => ch ? { ...ch, reviewCount: ch.reviewCount + 1 } : ch);

    if (data.reviewType !== "generic") updateUserBadges(user.uid).catch(() => {});
  };

  const handleLike = async (reviewId: string, likedBy: string[] = []) => {
    if (!user) { handleLogin(); return; }
    const hasLiked = likedBy.includes(user.uid);
    setReviews((cur) => cur.map((r) => r.id !== reviewId ? r : hasLiked
      ? { ...r, likesCount: Math.max(0, (r.likesCount || 0) - 1), likedBy: (r.likedBy || []).filter((id) => id !== user.uid) }
      : { ...r, likesCount: (r.likesCount || 0) + 1, likedBy: [...(r.likedBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      likesCount: increment(hasLiked ? -1 : 1),
      likedBy: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleHelpful = async (reviewId: string, helpfulBy: string[] = []) => {
    if (!user) { handleLogin(); return; }
    const has = helpfulBy.includes(user.uid);
    setReviews((cur) => cur.map((r) => r.id !== reviewId ? r : has
      ? { ...r, helpfulCount: Math.max(0, (r.helpfulCount || 0) - 1), helpfulBy: (r.helpfulBy || []).filter((id) => id !== user.uid) }
      : { ...r, helpfulCount: (r.helpfulCount || 0) + 1, helpfulBy: [...(r.helpfulBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      helpfulCount: increment(has ? -1 : 1),
      helpfulBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleNotHelpful = async (reviewId: string, notHelpfulBy: string[] = []) => {
    if (!user) { handleLogin(); return; }
    const has = notHelpfulBy.includes(user.uid);
    setReviews((cur) => cur.map((r) => r.id !== reviewId ? r : has
      ? { ...r, notHelpfulCount: Math.max(0, (r.notHelpfulCount || 0) - 1), notHelpfulBy: (r.notHelpfulBy || []).filter((id) => id !== user.uid) }
      : { ...r, notHelpfulCount: (r.notHelpfulCount || 0) + 1, notHelpfulBy: [...(r.notHelpfulBy || []), user.uid] }
    ));
    await updateDoc(doc(db, "reviews", reviewId), {
      notHelpfulCount: increment(has ? -1 : 1),
      notHelpfulBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  // Sort
  const sorted = [...reviews].sort((a, b) => {
    if (sortBy === "likes") return (b.likesCount || 0) - (a.likesCount || 0);
    if (sortBy === "score") return (b.healthScore || 0) - (a.healthScore || 0);
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-slate-500 dark:text-slate-400">Channel not found</p>
        <button type="button" onClick={() => router.push("/channels")} className="text-sm text-slate-600 dark:text-slate-300 underline">
          Browse channels
        </button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push("/channels")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0">
              ←
            </button>
            <span className="text-2xl leading-none">{channel.iconEmoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">r/{channel.slug}</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{channel.memberCount} members · {channel.reviewCount} reviews</p>
            </div>
            <button
              type="button"
              onClick={handleJoinLeave}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                isMember
                  ? "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90"
              }`}
            >
              {isMember ? "Joined" : "Join"}
            </button>
          </div>
          <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{channel.description}</p>

          {/* Sort tabs */}
          <div className="flex gap-4 mt-3">
            {(["newest", "likes", "score"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                className={`text-[12px] font-medium pb-1 border-b-2 transition ${
                  sortBy === s
                    ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100"
                    : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
                }`}
              >
                {s === "newest" ? "Newest" : s === "likes" ? "Most Liked" : "Top Score"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Reviews */}
      <div className="max-w-2xl mx-auto divide-y divide-slate-100 dark:divide-slate-800/60">
        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-2">No reviews in this channel yet</p>
            <button type="button" onClick={() => user ? setShowReviewWizard(true) : handleLogin()} className="text-sm text-slate-600 dark:text-slate-300 underline">
              Be the first to post
            </button>
          </div>
        ) : (
          sorted.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={user?.uid}
              currentUserName={user?.displayName || undefined}
              onLike={handleLike}
              onHelpful={handleHelpful}
              onNotHelpful={handleNotHelpful}
            />
          ))
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => user ? setShowReviewWizard(true) : handleLogin()}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full shadow-lg flex items-center justify-center text-2xl font-light hover:opacity-90 transition z-40"
        title="Write a review"
      >
        +
      </button>

      {/* Review wizard */}
      {showReviewWizard && user && (
        <ReviewWizard
          user={user}
          mode="verified"
          productInfo={{ name: "", category: channel.category }}
          channelId={channel.id}
          channelSlug={channel.slug}
          onSubmit={handleReviewSubmit}
          onClose={() => setShowReviewWizard(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  collection, query, where, getDocs, addDoc, orderBy,
  doc, updateDoc, increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getBadgeById } from "../../lib/badges";
import HealthScoreBadge from "./HealthScoreBadge";
import ReviewTimeline from "./ReviewTimeline";
import type { HealthBreakdown } from "../../lib/healthScore";

// ─── Types ────────────────────────────────────────────────────────────────────

const USAGE_LABELS: Record<string, string> = {
  less_1_week:    "< 1 week",
  "1_4_weeks":    "1–4 weeks",
  "1_3_months":   "1–3 months",
  "3_plus_months":"3+ months",
};

const SOURCE_LABELS: Record<string, string> = {
  brand_sent: "Sent by brand",
  purchased:  "Purchased",
  gift:       "Gift",
};

export type ReviewData = {
  id: string;
  reviewerName?: string;
  category?: string;
  productName?: string;
  rating?: number;
  content?: string;
  summary?: string;
  marketingQuote?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string[];
  subRatings?: Record<string, number>;
  mediaUrls?: string[];
  likesCount?: number;
  likedBy?: string[];
  helpfulCount?: number;
  notHelpfulCount?: number;
  helpfulBy?: string[];
  notHelpfulBy?: string[];
  commentCount?: number;
  campaignId?: string;
  productId?: string;
  isCampaignReview?: boolean;
  productSource?: string;
  usageDuration?: string;
  badges?: string[];
  healthScore?: number;
  healthScoreBreakdown?: HealthBreakdown;
  forkedFromReviewId?: string;
  forkedFromReviewerName?: string;
  forkCount?: number;
  versionCount?: number;
  latestVersionLabel?: string;
  channelSlug?: string;
  channelId?: string;
  reviewerId?: string;
  createdAt?: string;
};

type Comment = {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  parentCommentId?: string | null;
  depth?: number;
};

type Props = {
  review: ReviewData;
  currentUserId?: string;
  currentUserName?: string;
  onLike?: (reviewId: string, likedBy: string[]) => void;
  onHelpful?: (reviewId: string, helpfulBy: string[]) => void;
  onNotHelpful?: (reviewId: string, notHelpfulBy: string[]) => void;
  onFork?: (review: ReviewData) => void;
  showPoolLink?: boolean;
};

// ─── Comment Thread ───────────────────────────────────────────────────────────

function CommentThread({
  reviewId,
  currentUserId,
  currentUserName,
}: {
  reviewId: string;
  currentUserId?: string;
  currentUserName?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "reviewComments"),
        where("reviewId", "==", reviewId),
        orderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)));
    } catch {
      // Firestore index may not exist yet; fail silently
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!currentUserId || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const commentData: Record<string, unknown> = {
        reviewId,
        userId: currentUserId,
        userName: currentUserName || "Anonymous",
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
        parentCommentId: replyingTo?.id ?? null,
        depth: replyingTo ? Math.min((comments.find((c) => c.id === replyingTo.id)?.depth ?? 0) + 1, 2) : 0,
      };
      const ref = await addDoc(collection(db, "reviewComments"), commentData);
      setComments((prev) => [...prev, { id: ref.id, ...commentData } as Comment]);
      await updateDoc(doc(db, "reviews", reviewId), { commentCount: increment(1) });
      setNewComment("");
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Build threaded view: top-level first, then children nested
  const topLevel = comments.filter((c) => !c.parentCommentId);
  const childrenOf = (parentId: string) => comments.filter((c) => c.parentCommentId === parentId);

  const renderComment = (c: Comment, depth: number) => (
    <div key={c.id} style={{ marginLeft: depth * 20 }}>
      <div className="flex gap-2">
        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
          {c.userName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300 mr-1">{c.userName}</span>
          <span className="text-[12px] text-slate-600 dark:text-slate-400">{c.content}</span>
          {currentUserId && depth < 2 && (
            <button
              type="button"
              onClick={() => setReplyingTo({ id: c.id, userName: c.userName })}
              className="ml-2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Reply
            </button>
          )}
        </div>
      </div>
      {childrenOf(c.id).map((child) => renderComment(child, depth + 1))}
    </div>
  );

  return (
    <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
      {!loaded ? (
        <button
          type="button"
          onClick={loadComments}
          className="text-[12px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition"
        >
          {loading ? "Loading…" : "Load comments"}
        </button>
      ) : (
        <div className="space-y-2">
          {comments.length === 0 && (
            <p className="text-[12px] text-slate-400 dark:text-slate-600">No comments yet.</p>
          )}
          {topLevel.map((c) => renderComment(c, 0))}

          {currentUserId && (
            <div className="pt-1">
              {replyingTo && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-slate-500">Replying to {replyingTo.userName}</span>
                  <button type="button" onClick={() => setReplyingTo(null)} className="text-[10px] text-slate-400 hover:text-slate-600">✕</button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitComment(); } }}
                  placeholder={replyingTo ? `Reply to ${replyingTo.userName}…` : "Add a comment…"}
                  className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 md:px-2.5 md:py-1.5 text-sm md:text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  className="px-3 py-2.5 md:px-2.5 md:py-1.5 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg text-sm md:text-[12px] font-medium disabled:opacity-40 hover:opacity-90 transition"
                >
                  {submitting ? "…" : "Post"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export default function ReviewCard({
  review,
  currentUserId,
  currentUserName,
  onLike,
  onHelpful,
  onNotHelpful,
  onFork,
  showPoolLink = true,
}: Props) {
  const [showComments, setShowComments] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const hasLiked       = !!(currentUserId && review.likedBy?.includes(currentUserId));
  const hasHelpful     = !!(currentUserId && review.helpfulBy?.includes(currentUserId));
  const hasNotHelpful  = !!(currentUserId && review.notHelpfulBy?.includes(currentUserId));

  const headline    = review.summary || review.marketingQuote || null;
  const hasPros     = review.pros && review.pros.length > 0;
  const hasCons     = review.cons && review.cons.length > 0;
  const hasBestFor  = review.bestFor && review.bestFor.length > 0;
  const hasMedia    = review.mediaUrls && review.mediaUrls.length > 0;
  const hasSubRatings = review.subRatings && Object.keys(review.subRatings).length > 0;
  const usageLabel  = review.usageDuration ? USAGE_LABELS[review.usageDuration] : null;
  const sourceLabel = review.productSource ? SOURCE_LABELS[review.productSource] : null;
  const commentCount = review.commentCount ?? 0;

  const reviewerBadges = (review.badges ?? [])
    .map(getBadgeById)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <article className="px-4 py-4 md:px-4 md:py-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-slate-600 dark:text-slate-300 text-sm md:text-xs font-medium">
          {review.reviewerName?.charAt(0) || "A"}
        </div>

        <div className="flex-1 min-w-0">
          {/* Reviewer name + badges + category + rating */}
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap leading-tight">
              <span className="font-medium text-[15px] text-slate-900 dark:text-slate-100 truncate max-w-[10rem] sm:max-w-none">
                {review.reviewerName || "Anonymous"}
              </span>
              {reviewerBadges.length > 0 && (
                <span className="flex gap-0.5">
                  {reviewerBadges.map((b) => (
                    <span key={b!.id} title={b!.description} className="text-sm leading-none">
                      {b!.emoji}
                    </span>
                  ))}
                </span>
              )}
              {review.category && (
                <span className="text-slate-500 dark:text-slate-500 text-[13px]">· {review.category}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {review.healthScore != null && (
                <HealthScoreBadge score={review.healthScore} breakdown={review.healthScoreBreakdown} />
              )}
              {review.rating != null && (
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400/90 tabular-nums">
                  ★ {review.rating}
                </span>
              )}
            </div>
          </div>

          {/* Forked-from banner */}
          {review.forkedFromReviewId && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <span>⑂</span> Forked from {review.forkedFromReviewerName || "another review"}
            </p>
          )}

          {/* Product name + context badges */}
          {review.productName && (
            <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5 flex-wrap">
              <span>{review.productName}</span>
              {usageLabel && (
                <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                  {usageLabel}
                </span>
              )}
              {sourceLabel && review.isCampaignReview && (
                <span className="text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                  {sourceLabel}
                </span>
              )}
              {review.channelSlug && (
                <a href={`/channels/${review.channelSlug}`} className="text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded hover:underline">
                  rj/{review.channelSlug}
                </a>
              )}
              {(review.versionCount ?? 0) > 1 && (
                <button type="button" onClick={() => setShowTimeline((v) => !v)}
                  className="text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition">
                  {review.versionCount} updates
                </button>
              )}
            </p>
          )}

          {/* Summary headline */}
          {headline && (
            <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug mb-1.5">
              {headline}
            </p>
          )}

          {/* Sub-ratings */}
          {hasSubRatings && (
            <div className="flex gap-3 flex-wrap mb-2">
              {Object.entries(review.subRatings!).map(([attr, val]) => (
                <span key={attr} className="text-[11px] text-slate-500 dark:text-slate-500">
                  {attr}:{" "}
                  <span className="text-amber-500 dark:text-amber-400">{"★".repeat(val)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Pros */}
          {hasPros && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {review.pros!.map((pro, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md">
                  ✓ {pro}
                </span>
              ))}
            </div>
          )}

          {/* Cons */}
          {hasCons && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {review.cons!.map((con, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-md">
                  – {con}
                </span>
              ))}
            </div>
          )}

          {/* Review body */}
          {review.content && (
            <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed font-normal mb-2 whitespace-pre-wrap">
              {review.content}
            </p>
          )}

          {/* Media thumbnails */}
          {hasMedia && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {review.mediaUrls!.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="w-24 h-24 md:w-20 md:h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-90 transition"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Best for */}
          {hasBestFor && (
            <div className="flex flex-wrap gap-1 mb-2">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mr-0.5">Best for:</span>
              {review.bestFor!.map((tag, i) => (
                <span key={i} className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-1 text-[13px] md:text-[13px] text-slate-500 dark:text-slate-500 mt-2 md:mt-1 -ml-2 md:-ml-1">
            {/* Like */}
            <button
              type="button"
              onClick={() => onLike?.(review.id, review.likedBy ?? [])}
              disabled={!onLike}
              className={`flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 transition-colors ${
                hasLiked
                  ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 font-medium"
                  : "hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              } disabled:cursor-default`}
            >
              <span aria-hidden>👍</span>
              <span className="tabular-nums">{review.likesCount || 0}</span>
            </button>

            {/* Helpful */}
            <button
              type="button"
              onClick={() => onHelpful?.(review.id, review.helpfulBy ?? [])}
              disabled={!onHelpful}
              className={`flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 transition-colors ${
                hasHelpful
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                  : "hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              } disabled:cursor-default`}
            >
              <span aria-hidden>✓</span>
              <span className="tabular-nums">{review.helpfulCount || 0}</span>
            </button>

            {/* Not helpful */}
            <button
              type="button"
              onClick={() => onNotHelpful?.(review.id, review.notHelpfulBy ?? [])}
              disabled={!onNotHelpful}
              className={`flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 transition-colors ${
                hasNotHelpful
                  ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                  : "hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              } disabled:cursor-default`}
              title="Not helpful"
            >
              <span aria-hidden>✗</span>
            </button>

            {/* Comments toggle */}
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
            >
              <span aria-hidden>💬</span>
              <span className="tabular-nums">{commentCount}</span>
            </button>

            {/* Fork */}
            {onFork && (
              <button
                type="button"
                onClick={() => onFork(review)}
                className="flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
                title="Fork — write your take on this review"
              >
                <span aria-hidden>⑂</span>
                {(review.forkCount ?? 0) > 0 && <span className="tabular-nums">{review.forkCount}</span>}
              </button>
            )}

            {/* Share */}
            <button
              type="button"
              onClick={() => {
                const text = `"${review.summary || review.content?.slice(0, 80)}" — ${review.reviewerName} on ${review.productName}`;
                if (navigator.share) {
                  navigator.share({ text }).catch(() => {});
                } else if (navigator.clipboard) {
                  navigator.clipboard.writeText(text);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
              title="Share"
            >
              <span aria-hidden>↗</span>
            </button>

            {/* Pool link */}
            {showPoolLink && review.campaignId && review.campaignId !== "organic" && review.productId && (
              <Link
                href={`/product/${review.productId}`}
                className="ml-auto font-medium text-slate-600 dark:text-slate-400 hover:underline shrink-0 py-2 px-2.5 md:py-1 md:px-1.5"
              >
                Pool →
              </Link>
            )}
          </div>

          {/* Version timeline */}
          {showTimeline && (
            <ReviewTimeline
              reviewId={review.id}
              originalReview={{
                content: review.content,
                rating: review.rating,
                pros: review.pros,
                cons: review.cons,
                createdAt: review.createdAt,
              }}
            />
          )}

          {/* Comments thread */}
          {showComments && (
            <CommentThread
              reviewId={review.id}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
            />
          )}
        </div>
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { getBadgeById } from "../../lib/badges";
import HealthScoreBadge from "./HealthScoreBadge";
import ReviewTimeline from "./ReviewTimeline";
import Avatar from "./Avatar";
import CommentThread from "./CommentThread";
import type { ReviewData } from "../../lib/types";
import { USAGE_LABELS, SOURCE_LABELS } from "../../lib/constants";

// Re-export for consumers that import from ReviewCard
export type { ReviewData } from "../../lib/types";

type Props = {
  review: ReviewData;
  currentUserId?: string;
  currentUserName?: string;
  onLike?: (reviewId: string, likedBy: string[]) => void;
  onHelpful?: (reviewId: string, helpfulBy: string[]) => void;
  onNotHelpful?: (reviewId: string, notHelpfulBy: string[]) => void;
  showPoolLink?: boolean;
};

// ─── Main Card ────────────────────────────────────────────────────────────────

export default function ReviewCard({
  review,
  currentUserId,
  currentUserName,
  onLike,
  onHelpful,
  onNotHelpful,
  showPoolLink = true,
}: Props) {
  const [showComments, setShowComments] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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
        <Avatar name={review.reviewerName} size="md" />

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
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                  ★ {review.rating}
                </span>
              )}
            </div>
          </div>

          {/* Product name + context badges */}
          {review.productName && (
            <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5 flex-wrap">
              {review.productSlug && review.communitySlug ? (
                <Link href={`/c/${review.communitySlug}/${review.productSlug}`} className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors">
                  {review.productName}
                </Link>
              ) : review.productId && !review.productId.startsWith("organic_") ? (
                <Link href={`/product/${review.productId}`} className="font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors">
                  {review.productName}
                </Link>
              ) : (
                <span>{review.productName}</span>
              )}
              {usageLabel && (
                <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                  {usageLabel}
                </span>
              )}
              {/* Verified Owner badge */}
              {review.isVerifiedPurchase && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
                  ✓ Verified Owner
                </span>
              )}
              {/* Anchor review badge */}
              {review.isAnchorReview && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800/50">
                  🎯 Received for review
                </span>
              )}
              {(review.communitySlug || review.channelSlug) && (
                <a href={`/c/${review.communitySlug || review.channelSlug}`} className="text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded hover:underline">
                  rj/{review.communitySlug || review.channelSlug}
                </a>
              )}
              {review.variantName && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded border border-violet-100 dark:border-violet-900/40">
                  🎨 {review.variantName}
                </span>
              )}
              {(review.versionCount ?? 0) > 1 && (
                <span className="text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                  {review.versionCount} updates
                </span>
              )}
            </p>
          )}

          {/* Summary headline */}
          {headline && (
            <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug mb-1">
              {headline}
            </p>
          )}

          {/* Read more / Show less toggle */}
          {(review.content || hasPros || hasCons || hasSubRatings || hasMedia || hasBestFor) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[12px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-1.5 transition-colors"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}

          {/* Expandable details */}
          {expanded && (
            <>
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

              {/* Ownership journey — nested thread under original review */}
              {(review.versionCount ?? 0) > 1 && (
                <ReviewTimeline reviewId={review.id} />
              )}
            </>
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
                  ? "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 font-medium"
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

            {/* Copy link (reference) */}
            <button
              type="button"
              onClick={() => {
                const path = review.communitySlug && review.productSlug
                  ? `/c/${review.communitySlug}/${review.productSlug}?review=${review.id}`
                  : `/product/${review.productId}?review=${review.id}`;
                const url = `${window.location.origin}${path}`;
                navigator.clipboard?.writeText(url).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                });
              }}
              className={`flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 transition-colors ${
                linkCopied
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                  : "hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              }`}
              title="Copy review link"
            >
              <span aria-hidden>{linkCopied ? "✓" : "🔗"}</span>
              {linkCopied && <span className="text-[11px]">Copied</span>}
            </button>

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

            {/* Product hub link */}
            {showPoolLink && review.productId && !review.productId.startsWith("organic_") && (
              <Link
                href={`/product/${review.productId}`}
                className="ml-auto font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline shrink-0 py-2 px-2.5 md:py-1 md:px-1.5 transition-colors"
              >
                View hub →
              </Link>
            )}
          </div>

          {/* Version timeline (shown inline above for versionCount > 1) */}

          {/* Comments thread */}
          {showComments && (
            <CommentThread
              reviewId={review.id}
              reviewerId={review.reviewerId}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
            />
          )}
        </div>
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { getBadgeById } from "../../lib/badges";
import HealthScoreBadge from "./HealthScoreBadge";
import ReviewTimeline from "./ReviewTimeline";
import Avatar from "./Avatar";
import CommentThread from "./CommentThread";
import BrandResponseCard from "./BrandResponseCard";
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
    <article className="px-4 py-4 md:px-4 md:py-3 bg-white border border-[#f5ddc0] rounded-2xl hover:bg-[#fff0e6] transition-colors">
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar name={review.reviewerName} size="md" />

        <div className="flex-1 min-w-0">
          {/* Reviewer name + badges + category + rating */}
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap leading-tight">
              {review.reviewerId ? (
                <Link href={`/reviewer/${review.reviewerId}`} className="font-medium text-[15px] text-[#4a3828] truncate max-w-[10rem] sm:max-w-none hover:text-[#e65100] transition-colors">
                  {review.reviewerName || "Anonymous"}
                </Link>
              ) : (
                <span className="font-medium text-[15px] text-[#4a3828] truncate max-w-[10rem] sm:max-w-none">
                  {review.reviewerName || "Anonymous"}
                </span>
              )}
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
                <span className="text-[#8b7560] text-[13px]">· {review.category}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {review.healthScore != null && (
                <HealthScoreBadge score={review.healthScore} breakdown={review.healthScoreBreakdown} />
              )}
              {review.rating != null && (
                <span className="text-[11px] font-medium text-[#ffa726] tabular-nums">
                  ★ {review.rating}
                </span>
              )}
            </div>
          </div>

          {/* Product name + context badges */}
          {review.productName && (
            <p className="text-[13px] text-[#8b7560] mb-1 flex items-center gap-1.5 flex-wrap">
              {review.productSlug && review.communitySlug ? (
                <Link href={`/c/${review.communitySlug}/${review.productSlug}`} className="font-medium text-[#5c4a38] hover:text-[#e65100] hover:underline transition-colors">
                  {review.productName}
                </Link>
              ) : review.productId && !review.productId.startsWith("organic_") ? (
                <Link href={`/product/${review.productId}`} className="font-medium text-[#5c4a38] hover:text-[#e65100] hover:underline transition-colors">
                  {review.productName}
                </Link>
              ) : (
                <span>{review.productName}</span>
              )}
              {usageLabel && (
                <span className="text-[10px] font-medium bg-[#ffecd2] text-[#8b7560] px-1.5 py-0.5 rounded">
                  {usageLabel}
                </span>
              )}
              {/* Verified Owner badge */}
              {review.isVerifiedPurchase && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-[#66bb6a]/10 text-[#66bb6a] px-1.5 py-0.5 rounded border border-[#66bb6a]/20">
                  ✓ Verified Owner
                </span>
              )}
              {/* Anchor review badge */}
              {review.isAnchorReview && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-[#81d4fa]/10 text-[#81d4fa] px-1.5 py-0.5 rounded border border-[#81d4fa]/20">
                  🎯 Received for review
                </span>
              )}
              {/* Imported review badge */}
              {review.isImported && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-[#ffecd2] text-[#8b7560] px-1.5 py-0.5 rounded border border-[#f5ddc0]">
                  Imported{review.importSource ? ` from ${review.importSource.charAt(0).toUpperCase() + review.importSource.slice(1)}` : ""}
                </span>
              )}
              {(review.communitySlug || review.channelSlug) && (
                <a href={`/c/${review.communitySlug || review.channelSlug}`} className="text-[10px] font-medium bg-[#e65100]/10 text-[#e65100] px-1.5 py-0.5 rounded border border-[#e65100]/20 hover:underline">
                  rj/{review.communitySlug || review.channelSlug}
                </a>
              )}
              {review.variantName && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-[#ce93d8]/10 text-[#ce93d8] px-1.5 py-0.5 rounded border border-[#ce93d8]/20">
                  🎨 {review.variantName}
                </span>
              )}
              {(review.versionCount ?? 0) > 1 && (
                <span className="text-[10px] font-medium bg-[#81d4fa]/10 text-[#81d4fa] px-1.5 py-0.5 rounded border border-[#81d4fa]/20">
                  {review.versionCount} updates
                </span>
              )}
            </p>
          )}

          {/* Summary headline */}
          {headline && (
            <p className="text-[15px] font-semibold text-[#4a3828] leading-snug mb-1">
              {headline}
            </p>
          )}

          {/* Read more / Show less toggle */}
          {(review.content || hasPros || hasCons || hasSubRatings || hasMedia || hasBestFor) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[12px] font-medium text-[#e65100] hover:text-[#e65100] mb-1.5 transition-colors"
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
                    <span key={attr} className="text-[11px] text-[#8b7560]">
                      {attr}:{" "}
                      <span className="text-[#ffa726]">{"★".repeat(val)}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Pros */}
              {hasPros && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {review.pros!.map((pro, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-[#66bb6a]/10 text-[#66bb6a] px-2 py-0.5 rounded-md border border-[#66bb6a]/20">
                      ✓ {pro}
                    </span>
                  ))}
                </div>
              )}

              {/* Cons */}
              {hasCons && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {review.cons!.map((con, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-[#f48fb1]/10 text-[#f48fb1] px-2 py-0.5 rounded-md border border-[#f48fb1]/20">
                      – {con}
                    </span>
                  ))}
                </div>
              )}

              {/* Review body */}
              {review.content && (
                <p className="text-[15px] text-[#5c4a38] leading-relaxed font-normal mb-2 whitespace-pre-wrap">
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
                        className="w-24 h-24 md:w-20 md:h-20 object-cover rounded-lg border border-[#f5ddc0] hover:opacity-90 transition"
                      />
                    </a>
                  ))}
                </div>
              )}

              {/* Best for */}
              {hasBestFor && (
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-[11px] text-[#8b7560] mr-0.5">Best for:</span>
                  {review.bestFor!.map((tag, i) => (
                    <span key={i} className="text-[11px] bg-[#ffecd2] text-[#8b7560] px-2 py-0.5 rounded-md">
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
          <div className="flex items-center gap-1 text-[13px] md:text-[13px] text-[#8b7560] mt-2 md:mt-1 -ml-2 md:-ml-1 flex-wrap">
            {/* Like */}
            <button
              type="button"
              onClick={() => onLike?.(review.id, review.likedBy ?? [])}
              disabled={!onLike}
              className={`flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 transition-colors ${
                hasLiked
                  ? "text-[#e65100] bg-[#e65100]/10 font-medium"
                  : "hover:text-[#5c4a38] hover:bg-[#fff0e6]"
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
                  ? "text-[#66bb6a] bg-[#66bb6a]/10"
                  : "hover:text-[#5c4a38] hover:bg-[#fff0e6]"
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
                  ? "text-[#f48fb1] bg-[#f48fb1]/10"
                  : "hover:text-[#5c4a38] hover:bg-[#fff0e6]"
              } disabled:cursor-default`}
              title="Not helpful"
            >
              <span aria-hidden>✗</span>
            </button>

            {/* Comments toggle */}
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 hover:text-[#5c4a38] hover:bg-[#fff0e6] transition-colors"
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
                  ? "text-[#66bb6a] bg-[#66bb6a]/10"
                  : "hover:text-[#5c4a38] hover:bg-[#fff0e6]"
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
              className="flex items-center gap-1.5 rounded-lg py-2 px-2.5 md:py-1 md:px-1.5 hover:text-[#5c4a38] hover:bg-[#fff0e6] transition-colors"
              title="Share"
            >
              <span aria-hidden>↗</span>
            </button>

            {/* Product hub link */}
            {showPoolLink && review.productId && !review.productId.startsWith("organic_") && (
              <Link
                href={`/product/${review.productId}`}
                className="ml-auto font-medium text-[#8b7560] hover:text-[#e65100] hover:underline shrink-0 py-2 px-2.5 md:py-1 md:px-1.5 transition-colors"
              >
                View hub →
              </Link>
            )}
          </div>

          {/* Version timeline (shown inline above for versionCount > 1) */}

          {/* Brand Response */}
          {review.brandResponse && (
            <BrandResponseCard
              brandResponse={review.brandResponse}
              productId={review.productId || ""}
              reviewId={review.id}
              currentUserEmail={undefined}
            />
          )}

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

"use client";

import Link from "next/link";

const USAGE_LABELS: Record<string, string> = {
  less_1_week:   "< 1 week",
  "1_4_weeks":   "1–4 weeks",
  "1_3_months":  "1–3 months",
  "3_plus_months": "3+ months",
};

const SOURCE_LABELS: Record<string, string> = {
  brand_sent:    "Sent by brand",
  purchased:     "Purchased",
  gift:          "Gift",
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
  campaignId?: string;
  productId?: string;
  isCampaignReview?: boolean;
  productSource?: string;
  usageDuration?: string;
};

type Props = {
  review: ReviewData;
  currentUserId?: string;
  onLike?: (reviewId: string, likedBy: string[]) => void;
  showPoolLink?: boolean;
};

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="tabular-nums text-amber-500 dark:text-amber-400 text-[13px]" aria-label={`${rating} out of ${max} stars`}>
      {"★".repeat(rating)}
      <span className="text-slate-200 dark:text-slate-700">{"★".repeat(max - rating)}</span>
    </span>
  );
}

export default function ReviewCard({ review, currentUserId, onLike, showPoolLink = true }: Props) {
  const hasLiked = !!(currentUserId && review.likedBy?.includes(currentUserId));

  // Prefer summary over legacy marketingQuote; fall back to none
  const headline = review.summary || review.marketingQuote || null;

  const hasPros = review.pros && review.pros.length > 0;
  const hasCons = review.cons && review.cons.length > 0;
  const hasBestFor = review.bestFor && review.bestFor.length > 0;
  const hasMedia = review.mediaUrls && review.mediaUrls.length > 0;
  const hasSubRatings =
    review.subRatings && Object.keys(review.subRatings).length > 0;
  const usageLabel = review.usageDuration ? USAGE_LABELS[review.usageDuration] : null;
  const sourceLabel = review.productSource ? SOURCE_LABELS[review.productSource] : null;

  return (
    <article className="px-3 py-3 md:px-4 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-medium">
          {review.reviewerName?.charAt(0) || "A"}
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: name + category + rating */}
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1 min-w-0 flex-wrap leading-tight">
              <span className="font-medium text-[15px] text-slate-900 dark:text-slate-100 truncate max-w-[10rem] sm:max-w-none">
                {review.reviewerName || "Anonymous"}
              </span>
              {review.category && (
                <span className="text-slate-500 dark:text-slate-500 text-[13px]">· {review.category}</span>
              )}
            </div>
            {review.rating != null && (
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400/90 tabular-nums shrink-0">
                ★ {review.rating}
              </span>
            )}
          </div>

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
                  {attr}: <span className="text-amber-500 dark:text-amber-400">{"★".repeat(val)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Pros */}
          {hasPros && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {review.pros!.map((pro, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md"
                >
                  ✓ {pro}
                </span>
              ))}
            </div>
          )}

          {/* Cons */}
          {hasCons && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {review.cons!.map((con, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-md"
                >
                  – {con}
                </span>
              ))}
            </div>
          )}

          {/* Main review body */}
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
                    className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-90 transition"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Best for tags */}
          {hasBestFor && (
            <div className="flex flex-wrap gap-1 mb-2">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mr-0.5">Best for:</span>
              {review.bestFor!.map((tag, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer: like + pool link */}
          <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-500 max-w-md text-[13px] mt-1">
            <button
              type="button"
              onClick={() => onLike?.(review.id, review.likedBy ?? [])}
              disabled={!onLike}
              className={`flex items-center gap-1.5 font-medium rounded-md py-0.5 -ml-1 px-1 transition-colors ${
                hasLiked
                  ? "text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800"
                  : "hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              } disabled:cursor-default`}
            >
              <span aria-hidden>👍</span> {review.likesCount || 0}
            </button>

            {showPoolLink && review.campaignId && review.campaignId !== "organic" && review.productId && (
              <Link
                href={`/product/${review.productId}`}
                className="font-medium text-slate-600 dark:text-slate-400 hover:underline shrink-0"
              >
                Pool →
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

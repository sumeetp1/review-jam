"use client";

import Link from "next/link";
import { useBrandHub } from "../../components/BrandHubContext";
import type { ReviewWithResponse } from "../../components/BrandHubContext";

export default function OverviewPage() {
  const { campaigns, allReviews, selectedCampaign } = useBrandHub();

  const filteredReviews =
    selectedCampaign === "all"
      ? allReviews
      : allReviews.filter((r) => r.campaignId === selectedCampaign);

  const avgRating = filteredReviews.length
    ? (filteredReviews.reduce((s, r) => s + (r.rating || 0), 0) / filteredReviews.length).toFixed(1)
    : null;

  const totalLikes = filteredReviews.reduce((s, r) => s + (r.likesCount || 0), 0);
  const respondedCount = filteredReviews.filter((r: ReviewWithResponse) => r.brandResponse).length;
  const quotesReady = filteredReviews.filter((r) => r.summary || r.marketingQuote).length;

  const recentReviews = [...filteredReviews]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Stats cards
  const stats = [
    { label: "Reviews",      value: filteredReviews.length },
    { label: "Avg rating",   value: avgRating ? `\u2605 ${avgRating}` : "\u2014" },
    { label: "Total likes",  value: totalLikes },
    { label: "Responded",    value: respondedCount },
    { label: "Quotes ready", value: quotesReady },
  ];

  // Quick action cards
  const quickActions = [
    {
      icon: "\u{1F9E9}",
      title: "Widget Studio",
      description: "Configure and preview embeddable trust widgets for your site",
      href: "/brands/dashboard/widget-studio",
    },
    {
      icon: "\u{1F6D2}",
      title: "Amazon Images",
      description: "Generate review carousel images for your Amazon listings",
      href: "/brands/dashboard/amazon-images",
    },
    {
      icon: "\u{1F50C}",
      title: "Integrations",
      description: "Get embed code for Shopify, WordPress, and custom sites",
      href: "/brands/dashboard/integrations",
    },
    {
      icon: "\u{1F4AC}",
      title: "Reviews",
      description: "Manage reviews, bounties, buy links, and brand responses",
      href: "/brands/dashboard/reviews",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Campaign selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {/* handled at context level — no-op here, just display */}}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white"
        >
          All campaigns
        </button>
        {campaigns.map((c) => (
          <span
            key={c.id}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] text-zinc-300"
          >
            {c.name}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
            <p className="text-xs text-zinc-400 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions grid */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.12] transition group"
            >
              <span className="text-2xl">{action.icon}</span>
              <h3 className="text-sm font-semibold text-white mt-2 group-hover:text-indigo-300 transition">
                {action.title}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent reviews */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent reviews</h3>
          <Link
            href="/brands/dashboard/reviews"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
          >
            View all &rarr;
          </Link>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {recentReviews.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-400 text-center">
              No reviews yet.
            </p>
          ) : (
            recentReviews.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{r.reviewerName}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{r.productName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-zinc-400">
                    <span className="text-amber-400">{"\u2605"} {r.rating}</span>
                    <span>{"\u{1F44D}"} {r.likesCount}</span>
                  </div>
                </div>
                {(r.summary || r.marketingQuote) && (
                  <p className="text-[13px] text-indigo-300 font-medium mb-1 line-clamp-1">
                    &ldquo;{r.summary || r.marketingQuote}&rdquo;
                  </p>
                )}
                <p className="text-[13px] text-zinc-300 leading-relaxed line-clamp-2">{r.content}</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  {r.brandResponse && (
                    <span className="ml-2 text-indigo-400">Responded</span>
                  )}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

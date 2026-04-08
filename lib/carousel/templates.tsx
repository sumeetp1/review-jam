/* eslint-disable @next/next/no-img-element */
// ─── Amazon Carousel Image Templates ─────────────────────────────────────────
// Each template returns JSX for Satori/ImageResponse (2000x2000).
// Satori constraints: flexbox only, no CSS Grid, no transforms,
// no SVG <text>, only ASCII chars unless font supports them.

import { scoreColor } from "../reviewUtils";
import type { CarouselData, CarouselTheme } from "./types";

// ─── Palette ────────────────────────────────────────────────────────────────

function palette(theme: CarouselTheme) {
  const isLight = theme === "light";
  return {
    bg:       isLight ? "#ffffff" : "#0f172a",
    card:     isLight ? "#f8fafc" : "#1e293b",
    border:   isLight ? "#e2e8f0" : "#334155",
    text:     isLight ? "#0f172a" : "#f1f5f9",
    sub:      isLight ? "#64748b" : "#94a3b8",
    muted:    isLight ? "#94a3b8" : "#64748b",
    accent:   "#6366f1",
    accentBg: isLight ? "#eef2ff" : "#1e1b4b",
    star:     "#f59e0b",
    starEmpty: isLight ? "#e2e8f0" : "#334155",
    proText:  "#059669",
    proBg:    isLight ? "#d1fae5" : "#064e3b",
    conText:  "#dc2626",
    conBg:    isLight ? "#fee2e2" : "#7f1d1d",
  };
}

// SVG star path (5-pointed star in 24x24 viewBox)
const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z";

/** Render a row of 5 star SVGs — filled or empty based on rating */
function StarRow({ rating, size = 36, gap = 6, filledColor = "#f59e0b", emptyColor = "#e2e8f0" }: { rating: number; size?: number; gap?: number; filledColor?: string; emptyColor?: string }) {
  const full = Math.round(rating);
  return (
    <div style={{ display: "flex", alignItems: "center", gap }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <path d={STAR_PATH} fill={i < full ? filledColor : emptyColor} />
        </svg>
      ))}
    </div>
  );
}

// ─── Common Layout Shell ────────────────────────────────────────────────────

function Shell({
  children,
  qrDataUrl,
  theme,
  productUrl,
}: {
  children: React.ReactNode;
  qrDataUrl: string;
  theme: CarouselTheme;
  productUrl: string;
}) {
  const p = palette(theme);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 2000,
        height: 2000,
        background: p.bg,
        fontFamily: "Geist, sans-serif",
      }}
    >
      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "48px 80px",
          background: "linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)",
        }}
      >
        {/* Shield icon (paths only, no <text>) */}
        <svg width="52" height="52" viewBox="0 0 128 128">
          <path
            d="M64 8L16 26V62C16 90 36 112 64 120C92 112 112 90 112 62V26L64 8Z"
            fill="rgba(255,255,255,0.25)"
          />
          <path
            d="M64 20L28 34V62C28 84 44 102 64 108C84 102 100 84 100 62V34L64 20Z"
            fill="rgba(255,255,255,0.15)"
          />
          {/* Star inside shield instead of text "R" */}
          <path
            d="M64 42l7.5 15.2 16.8 2.4-12.15 11.85 2.87 16.75L64 80.5l-15.02 7.7 2.87-16.75L39.7 59.6l16.8-2.4L64 42z"
            fill="rgba(255,255,255,0.9)"
          />
        </svg>

        <span
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-0.02em",
            marginLeft: 20,
          }}
        >
          ReviewJam
        </span>

        <div style={{ display: "flex", flex: 1 }} />

        <span
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "0.05em",
          }}
        >
          VERIFIED REVIEWS
        </span>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "60px 80px",
        }}
      >
        {children}
      </div>

      {/* ── Bottom Bar ───────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "40px 80px",
          borderTop: `2px solid ${p.border}`,
          background: p.card,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: p.text }}>
            Read full reviews on ReviewJam.com
          </span>
          <span style={{ fontSize: 24, color: p.sub }}>
            {productUrl}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <img
              src={qrDataUrl}
              width={180}
              height={180}
              alt="QR"
              style={{ borderRadius: 12 }}
            />
            <span style={{ fontSize: 20, color: p.sub, fontWeight: 600 }}>
              Scan for reviews
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Template A: Health Score Overview ───────────────────────────────────────

export function HealthOverviewTemplate(
  data: CarouselData,
  qrDataUrl: string,
  theme: CarouselTheme,
  productUrl: string,
) {
  const p = palette(theme);
  const score = Math.round(data.avgHealthScore);
  const col = scoreColor(score);
  const ringSize = 420;

  return (
    <Shell qrDataUrl={qrDataUrl} theme={theme} productUrl={productUrl}>
      {/* Product name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
        <span style={{ fontSize: 56, fontWeight: 700, color: p.text, textAlign: "center" as const }}>
          {data.productName}
        </span>
        <span style={{ fontSize: 32, color: p.sub, marginTop: 8 }}>
          by {data.brandName}
        </span>
      </div>

      {/* Health ring */}
      <div style={{ display: "flex", justifyContent: "center", margin: "40px 0" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            border: `14px solid ${col.ring}`,
            background: col.bg,
          }}
        >
          <span style={{ fontSize: 140, fontWeight: 800, color: col.text, lineHeight: 1 }}>
            {score > 0 ? score : "--"}
          </span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: col.text,
              letterSpacing: "0.1em",
              marginTop: 8,
            }}
          >
            HEALTH SCORE
          </span>
        </div>
      </div>

      {/* Rating + reviews */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <StarRow rating={data.avgRating} size={48} gap={8} emptyColor={p.starEmpty} />
          <span style={{ fontSize: 44, fontWeight: 700, color: p.text }}>
            {data.avgRating > 0 ? data.avgRating.toFixed(1) : "--"}
          </span>
        </div>
        <span style={{ fontSize: 30, color: p.sub }}>
          Based on {data.reviewCount} verified review{data.reviewCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Trust badge */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 48 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: p.accentBg,
            border: `2px solid ${p.accent}`,
            borderRadius: 16,
            padding: "16px 32px",
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 600, color: p.accent }}>
            Verified and Unbiased Reviews
          </span>
        </div>
      </div>
    </Shell>
  );
}

// ─── Template B: Top Reviews ────────────────────────────────────────────────

export function TopReviewsTemplate(
  data: CarouselData,
  qrDataUrl: string,
  theme: CarouselTheme,
  productUrl: string,
) {
  const p = palette(theme);
  const reviews = data.topReviews.slice(0, 3);

  return (
    <Shell qrDataUrl={qrDataUrl} theme={theme} productUrl={productUrl}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 48, fontWeight: 700, color: p.text }}>
            {data.productName}
          </span>
          <span style={{ fontSize: 28, color: p.sub, marginTop: 4 }}>
            by {data.brandName}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <StarRow rating={data.avgRating} size={32} gap={4} emptyColor={p.starEmpty} />
          <span style={{ fontSize: 32, fontWeight: 700, color: p.text }}>
            {data.avgRating.toFixed(1)}
          </span>
          <span style={{ fontSize: 26, color: p.sub }}>
            ({data.reviewCount})
          </span>
        </div>
      </div>

      {/* Review cards */}
      {reviews.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
          {reviews.map((r, i) => {
            const rCol = scoreColor(r.healthScore);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: p.card,
                  border: `2px solid ${p.border}`,
                  borderRadius: 24,
                  padding: "40px 48px",
                  flex: 1,
                }}
              >
                <span style={{ fontSize: 34, color: p.text, lineHeight: 1.5 }}>
                  {`"${truncateText(r.summary, 140)}"`}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20 }}>
                  <StarRow rating={r.rating} size={24} gap={3} emptyColor={p.starEmpty} />
                  <span style={{ fontSize: 24, color: p.sub }}>
                    -- {r.reviewerName}
                  </span>
                  <div style={{ display: "flex", flex: 1 }} />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: rCol.bg,
                      borderRadius: 10,
                      padding: "6px 16px",
                    }}
                  >
                    <span style={{ fontSize: 22, fontWeight: 700, color: rCol.text }}>
                      HS {r.healthScore}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 36, color: p.muted }}>No reviews yet</span>
        </div>
      )}
    </Shell>
  );
}

// ─── Template C: Pros & Cons ────────────────────────────────────────────────

export function ProsConsTemplate(
  data: CarouselData,
  qrDataUrl: string,
  theme: CarouselTheme,
  productUrl: string,
) {
  const p = palette(theme);
  const score = Math.round(data.avgHealthScore);
  const col = scoreColor(score);

  return (
    <Shell qrDataUrl={qrDataUrl} theme={theme} productUrl={productUrl}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 40, marginBottom: 48 }}>
        {/* Health ring (small) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 160,
            height: 160,
            borderRadius: 80,
            border: `8px solid ${col.ring}`,
            background: col.bg,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 56, fontWeight: 800, color: col.text, lineHeight: 1 }}>
            {score > 0 ? score : "--"}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: col.text, letterSpacing: "0.08em", marginTop: 4 }}>
            HEALTH
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 48, fontWeight: 700, color: p.text }}>
            {data.productName}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
            <StarRow rating={data.avgRating} size={28} gap={4} emptyColor={p.starEmpty} />
            <span style={{ fontSize: 28, fontWeight: 600, color: p.text }}>
              {data.avgRating.toFixed(1)} / 5
            </span>
            <span style={{ fontSize: 24, color: p.sub }}>
              - {data.reviewCount} reviews
            </span>
          </div>
        </div>
      </div>

      {/* Two-column pros/cons */}
      <div style={{ display: "flex", gap: 40, flex: 1 }}>
        {/* Pros column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            background: p.card,
            border: `2px solid ${p.border}`,
            borderRadius: 24,
            padding: 48,
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: p.proText, letterSpacing: "0.08em", marginBottom: 32 }}>
            TOP PROS
          </span>
          {data.topPros.length > 0 ? (
            data.topPros.map((pro, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: p.proBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 24, color: p.proText, fontWeight: 700 }}>+</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 30, fontWeight: 600, color: p.text }}>{pro.text}</span>
                  <span style={{ fontSize: 22, color: p.sub, marginTop: 4 }}>Mentioned {pro.count}x</span>
                </div>
              </div>
            ))
          ) : (
            <span style={{ fontSize: 28, color: p.muted }}>No data yet</span>
          )}
        </div>

        {/* Cons column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            background: p.card,
            border: `2px solid ${p.border}`,
            borderRadius: 24,
            padding: 48,
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: p.conText, letterSpacing: "0.08em", marginBottom: 32 }}>
            TOP CONS
          </span>
          {data.topCons.length > 0 ? (
            data.topCons.map((con, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: p.conBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 24, color: p.conText, fontWeight: 700 }}>-</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 30, fontWeight: 600, color: p.text }}>{con.text}</span>
                  <span style={{ fontSize: 22, color: p.sub, marginTop: 4 }}>Mentioned {con.count}x</span>
                </div>
              </div>
            ))
          ) : (
            <span style={{ fontSize: 28, color: p.muted }}>No data yet</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
        <span style={{ fontSize: 24, color: p.sub }}>
          Based on {data.reviewCount} verified review{data.reviewCount !== 1 ? "s" : ""}
        </span>
      </div>
    </Shell>
  );
}

// ─── Template D: Review Spotlight ───────────────────────────────────────────

export function ReviewSpotlightTemplate(
  data: CarouselData,
  qrDataUrl: string,
  theme: CarouselTheme,
  productUrl: string,
) {
  const p = palette(theme);
  const review = data.spotlightReview;

  if (!review) {
    return (
      <Shell qrDataUrl={qrDataUrl} theme={theme} productUrl={productUrl}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <span style={{ fontSize: 48, fontWeight: 700, color: p.text }}>{data.productName}</span>
          <span style={{ fontSize: 36, color: p.muted }}>No reviews yet</span>
        </div>
      </Shell>
    );
  }

  const rCol = scoreColor(review.healthScore);

  return (
    <Shell qrDataUrl={qrDataUrl} theme={theme} productUrl={productUrl}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <StarRow rating={review.rating} size={36} gap={6} emptyColor={p.starEmpty} />
        <span style={{ fontSize: 26, fontWeight: 700, color: p.accent, letterSpacing: "0.1em" }}>
          FEATURED REVIEW
        </span>
      </div>

      {/* Quote card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: p.card,
          border: `2px solid ${p.border}`,
          borderRadius: 28,
          padding: "56px 64px",
          flex: 1,
        }}
      >
        <span style={{ fontSize: 44, color: p.text, lineHeight: 1.5 }}>
          {`"${truncateText(review.summary, 240)}"`}
        </span>

        {/* Reviewer info */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40 }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: p.text }}>
            -- {review.reviewerName}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: rCol.bg,
              borderRadius: 10,
              padding: "6px 16px",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, color: rCol.text }}>
              Health Score: {review.healthScore}
            </span>
          </div>
        </div>

        {review.usageDuration && (
          <span style={{ fontSize: 24, color: p.sub, marginTop: 12 }}>
            Used for: {formatDuration(review.usageDuration)}
          </span>
        )}

        {/* Pros */}
        {review.pros.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: p.proText, letterSpacing: "0.08em" }}>
              TOP PROS
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {review.pros.map((pro, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: p.proBg,
                    borderRadius: 10,
                    padding: "8px 20px",
                  }}
                >
                  <span style={{ fontSize: 22, color: p.proText, fontWeight: 600 }}>
                    + {pro}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flex: 1 }} />

        {/* Product footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 32, borderTop: `2px solid ${p.border}`, paddingTop: 28 }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: p.text }}>
            {data.productName}
          </span>
          <span style={{ fontSize: 24, color: p.sub }}>
            - {data.avgRating.toFixed(1)}/5 - {data.reviewCount} reviews
          </span>
        </div>
      </div>
    </Shell>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncateText(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "...";
}

function formatDuration(dur: string): string {
  const map: Record<string, string> = {
    less_1_week: "< 1 week",
    "1_4_weeks": "1-4 weeks",
    "1_3_months": "1-3 months",
    "3_plus_months": "3+ months",
  };
  return map[dur] || dur;
}

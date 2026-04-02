import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { computeHealthScore } from "../../../../lib/healthScore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function starsHtml(rating: number) {
  const full = Math.round(rating);
  const empty = 5 - full;
  return "★".repeat(Math.max(0, full)) + "☆".repeat(Math.max(0, empty));
}

function scoreColor(score: number): { text: string; bg: string; ring: string } {
  if (score >= 70) return { text: "#059669", bg: "#d1fae5", ring: "#10b981" };
  if (score >= 40) return { text: "#d97706", bg: "#fef3c7", ring: "#f59e0b" };
  return { text: "#dc2626", bg: "#fee2e2", ring: "#ef4444" };
}

// Aggregate pros/cons across reviews, ranked by frequency
function topItems(reviews: Array<{ pros?: string[]; cons?: string[] }>, field: "pros" | "cons", n: number): string[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    for (const item of (r[field] ?? [])) {
      if (item?.trim()) counts.set(item.trim(), (counts.get(item.trim()) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([text]) => text);
}

// ─── HTML Generator ──────────────────────────────────────────────────────────

function buildWidgetHtml(opts: {
  productId: string;
  productName: string;
  brandName: string;
  avgRating: number;
  avgHealthScore: number;
  reviewCount: number;
  topPros: string[];
  topCons: string[];
  theme: "light" | "dark" | "auto";
  baseUrl: string;
}): string {
  const { productId, productName, brandName, avgRating, avgHealthScore, reviewCount, topPros, topCons, theme, baseUrl } = opts;
  const score = Math.round(avgHealthScore);
  const col = scoreColor(score);

  // Static palette resolved at render time for light/dark/auto
  const isLight = theme !== "dark";
  const bg       = isLight ? "#ffffff" : "#0f172a";
  const card     = isLight ? "#f8fafc" : "#1e293b";
  const border   = isLight ? "#e2e8f0" : "#334155";
  const text     = isLight ? "#0f172a" : "#f1f5f9";
  const sub      = isLight ? "#64748b" : "#94a3b8";

  // `auto` adds a media query that overrides variables
  const autoMedia = theme === "auto" ? `
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a; --card: #1e293b; --border: #334155;
        --text: #f1f5f9; --sub: #94a3b8;
      }
    }` : "";

  const vars = theme === "auto"
    ? `:root { --bg:#ffffff;--card:#f8fafc;--border:#e2e8f0;--text:#0f172a;--sub:#64748b; }`
    : `:root { --bg:${bg};--card:${card};--border:${border};--text:${text};--sub:${sub}; }`;

  const prosHtml = topPros.length
    ? `<div class="section">
        <p class="sect-title pros">✓ Top Pros</p>
        ${topPros.map(p => `<div class="pill"><div class="dot pro"></div><span>${esc(p)}</span></div>`).join("")}
       </div>` : "";

  const consHtml = topCons.length
    ? `<div class="section">
        <p class="sect-title cons">✗ Top Cons</p>
        ${topCons.map(c => `<div class="pill"><div class="dot con"></div><span>${esc(c)}</span></div>`).join("")}
       </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(productName)} – Review Jam Trust Widget</title>
<style>
${vars}
${autoMedia}
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:var(--bg);color:var(--text);
  font-size:13px;line-height:1.5;padding:10px;
}
.widget{
  background:var(--bg);border:1px solid var(--border);
  border-radius:14px;overflow:hidden;max-width:340px;margin:0 auto;
  box-shadow:0 1px 4px rgba(0,0,0,.07),0 6px 20px rgba(0,0,0,.06);
}
.head{
  padding:10px 14px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  background:var(--card);
}
.logo{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
.logo b{color:#f59e0b}
.body{padding:14px 14px 12px}
.prod{font-size:15px;font-weight:700;color:var(--text);line-height:1.25;margin-bottom:1px}
.brand{font-size:11px;color:var(--sub);margin-bottom:12px}
.score-row{display:flex;align-items:center;gap:11px;margin-bottom:13px}
.ring{
  width:56px;height:56px;border-radius:50%;flex-shrink:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:${col.bg};border:3px solid ${col.ring};
}
.ring-num{font-size:20px;font-weight:800;color:${col.text};line-height:1}
.ring-lbl{font-size:8px;font-weight:600;text-transform:uppercase;color:${col.text};opacity:.75;letter-spacing:.05em}
.meta{}
.stars{font-size:14px;color:#f59e0b;letter-spacing:1px;margin-bottom:1px}
.rating{font-size:12px;font-weight:600;color:var(--text)}
.rating span{color:var(--sub);font-weight:400}
.hs-lbl{font-size:10px;color:var(--sub);margin-top:1px}
.section{margin-bottom:9px}
.sect-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.sect-title.pros{color:#059669}
.sect-title.cons{color:#dc2626}
.pill{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text);margin-bottom:3px}
.dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.dot.pro{background:#10b981}
.dot.con{background:#ef4444}
.cta{
  display:block;margin-top:13px;padding:9px 14px;
  background:linear-gradient(135deg,#f59e0b 0%,#ea580c 100%);
  color:#fff;text-decoration:none;border-radius:9px;
  font-size:13px;font-weight:600;text-align:center;
  transition:opacity .15s ease;
}
.cta:hover{opacity:.88}
.foot{
  padding:8px 14px;border-top:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;gap:5px;
  background:var(--card);
}
.foot-txt{font-size:10px;color:var(--sub)}
.foot a{font-size:10px;font-weight:600;color:#f59e0b;text-decoration:none}
</style>
</head>
<body>
<div class="widget">
  <div class="head">
    <span class="logo">Review<b>Jam</b> Trust Widget</span>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  </div>

  <div class="body">
    <div class="prod">${esc(productName)}</div>
    <div class="brand">by ${esc(brandName)}</div>

    <div class="score-row">
      <div class="ring">
        <span class="ring-num">${score > 0 ? score : "—"}</span>
        ${score > 0 ? '<span class="ring-lbl">Neutral</span>' : ""}
      </div>
      <div class="meta">
        <div class="stars">${starsHtml(avgRating)}</div>
        <div class="rating">
          ${avgRating > 0 ? avgRating.toFixed(1) : "—"}
          <span>· ${reviewCount} review${reviewCount !== 1 ? "s" : ""}</span>
        </div>
        <div class="hs-lbl">Neutral Health Score · Review Jam</div>
      </div>
    </div>

    ${prosHtml}
    ${consHtml}

    <a class="cta"
       href="${esc(baseUrl)}/product/${esc(productId)}"
       target="_blank"
       rel="noopener noreferrer">
      Review us on Review Jam →
    </a>
  </div>

  <div class="foot">
    <span class="foot-txt">Powered by</span>
    <a href="${esc(baseUrl)}" target="_blank" rel="noopener noreferrer">Review Jam</a>
  </div>
</div>
</body>
</html>`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const url = new URL(request.url);
  const themeParam = url.searchParams.get("theme") ?? "auto";
  const theme = (["light", "dark", "auto"].includes(themeParam) ? themeParam : "auto") as
    | "light"
    | "dark"
    | "auto";

  // Derive base URL for links inside the widget
  const baseUrl = `${url.protocol}//${url.host}`;

  try {
    // ── Fetch product ──────────────────────────────────────────────────────
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      return new Response("Product not found", { status: 404 });
    }

    const product = productSnap.data();

    // ── Fetch reviews (by productId OR campaignId) ─────────────────────────
    const [byProductId, byCampaignId] = await Promise.all([
      getDocs(query(collection(db, "reviews"), where("productId", "==", productId))),
      product.campaignId
        ? getDocs(query(collection(db, "reviews"), where("campaignId", "==", product.campaignId)))
        : Promise.resolve(null),
    ]);

    const reviewMap = new Map<string, Record<string, unknown>>();
    byProductId.docs.forEach((d) => reviewMap.set(d.id, d.data() as Record<string, unknown>));
    byCampaignId?.docs.forEach((d) => reviewMap.set(d.id, d.data() as Record<string, unknown>));

    const reviews = Array.from(reviewMap.values());

    // ── Compute aggregate stats ────────────────────────────────────────────
    const reviewCount = reviews.length;

    const avgRating = reviewCount
      ? reviews.reduce((s, r) => s + ((r.rating as number) || 0), 0) / reviewCount
      : 0;

    // Use stored healthScore when available; fall back to computing it
    const healthScores = reviews.map((r) => {
      if (typeof r.healthScore === "number") return r.healthScore;
      const { score } = computeHealthScore(r as Parameters<typeof computeHealthScore>[0], 0, 0);
      return score;
    });

    const avgHealthScore = healthScores.length
      ? healthScores.reduce((s, n) => s + n, 0) / healthScores.length
      : 0;

    const topPros = topItems(reviews as Array<{ pros?: string[]; cons?: string[] }>, "pros", 3);
    const topCons = topItems(reviews as Array<{ pros?: string[]; cons?: string[] }>, "cons", 3);

    // ── Build and return HTML ──────────────────────────────────────────────
    const html = buildWidgetHtml({
      productId,
      productName: (product.name as string) || "Product",
      brandName: (product.brandName as string) || "",
      avgRating,
      avgHealthScore,
      reviewCount,
      topPros,
      topCons,
      theme,
      baseUrl,
    });

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Allow embedding in iframes from any origin
        "X-Frame-Options": "ALLOWALL",
        "Content-Security-Policy": "frame-ancestors *",
        // Cache for 1 hour, serve stale for up to 24 h while revalidating
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[widget] Error generating widget:", err);
    return new Response("Failed to load widget", { status: 500 });
  }
}

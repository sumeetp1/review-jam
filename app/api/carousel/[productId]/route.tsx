// ─── Amazon Carousel Image API ──────────────────────────────────────────────
// GET /api/carousel/[productId]?template=health-overview&theme=light
// Returns: 2000x2000 PNG image for Amazon product carousel upload.

import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";
import QRCode from "qrcode";
import { fetchCarouselData } from "../../../../lib/carousel/data";
import { VALID_TEMPLATES } from "../../../../lib/carousel/types";
import type { TemplateName, CarouselTheme } from "../../../../lib/carousel/types";
import {
  HealthOverviewTemplate,
  TopReviewsTemplate,
  ProsConsTemplate,
  ReviewSpotlightTemplate,
} from "../../../../lib/carousel/templates";

export const runtime = "nodejs";

// ── Font loading (cached at module scope, loaded once per cold start) ───────

let _fontCache: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer | null> {
  if (_fontCache) return _fontCache;
  try {
    const buf = await readFile(
      join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"),
    );
    _fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _fontCache;
  } catch {
    return null;
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const url = new URL(request.url);

  // Parse query params
  const templateParam = url.searchParams.get("template") ?? "health-overview";
  const themeParam = url.searchParams.get("theme") ?? "light";

  const template: TemplateName = VALID_TEMPLATES.includes(templateParam as TemplateName)
    ? (templateParam as TemplateName)
    : "health-overview";

  const theme: CarouselTheme = themeParam === "dark" ? "dark" : "light";

  try {
    // ── Fetch data ────────────────────────────────────────────────────────
    const data = await fetchCarouselData(productId);
    if (!data) {
      return new Response("Product not found", { status: 404 });
    }

    // ── Generate QR code ──────────────────────────────────────────────────
    const baseUrl = `${url.protocol}//${url.host}`;
    const productPath = data.communitySlug && data.productSlug
      ? `/c/${data.communitySlug}/${data.productSlug}`
      : `/product/${productId}`;
    const productUrl = `${baseUrl}${productPath}`;

    let qrDataUrl: string;
    try {
      qrDataUrl = await QRCode.toDataURL(productUrl, {
        width: 200,
        margin: 1,
        color: { dark: "#4a3828", light: "#fff8f3" },
      });
    } catch {
      // Fallback: 1px transparent PNG if QR generation fails
      qrDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    }

    // ── Select and render template ────────────────────────────────────────
    let jsx: React.ReactElement;
    switch (template) {
      case "top-reviews":
        jsx = TopReviewsTemplate(data, qrDataUrl, theme, productUrl);
        break;
      case "pros-cons":
        jsx = ProsConsTemplate(data, qrDataUrl, theme, productUrl);
        break;
      case "review-spotlight":
        jsx = ReviewSpotlightTemplate(data, qrDataUrl, theme, productUrl);
        break;
      default:
        jsx = HealthOverviewTemplate(data, qrDataUrl, theme, productUrl);
    }

    // ── Build fonts config ────────────────────────────────────────────────
    const font = await loadFont();
    const fonts = font
      ? [
          { name: "Geist", data: font, style: "normal" as const, weight: 400 as const },
          // Re-use regular for bold — Satori will still respect fontWeight in layout
          { name: "Geist", data: font, style: "normal" as const, weight: 700 as const },
        ]
      : [];

    // ── Generate PNG ──────────────────────────────────────────────────────
    return new ImageResponse(jsx, {
      width: 2000,
      height: 2000,
      fonts,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Content-Disposition": `inline; filename="reviewjam-${data.productSlug || productId}-${template}.png"`,
      },
    });
  } catch (err) {
    console.error("[carousel] Error generating image:", err);
    return new Response("Failed to generate carousel image", { status: 500 });
  }
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useBrandHub } from "../../components/BrandHubContext";
import { TEMPLATE_OPTIONS } from "../../../../../lib/carousel/types";
import type { TemplateName, CarouselTheme } from "../../../../../lib/carousel/types";

export default function AmazonImagesPage() {
  const { campaigns } = useBrandHub();

  const [selectedProduct, setSelectedProduct] = useState(campaigns[0] ?? null);
  const [template, setTemplate] = useState<TemplateName>("health-overview");
  const [theme, setTheme] = useState<CarouselTheme>("light");
  const [imgKey, setImgKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    if (!selectedProduct && campaigns.length > 0) {
      setSelectedProduct(campaigns[0]);
    }
  }, [campaigns, selectedProduct]);

  useEffect(() => {
    setImgKey((k) => k + 1);
  }, [template, theme, selectedProduct]);

  const getImageUrl = useCallback(
    (tmpl: TemplateName) => {
      if (!selectedProduct) return "";
      return `/api/carousel/${selectedProduct.id}?template=${tmpl}&theme=${theme}`;
    },
    [selectedProduct, theme],
  );

  const downloadImage = useCallback(
    async (tmpl: TemplateName) => {
      const url = getImageUrl(tmpl);
      if (!url) return;
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `reviewjam-${selectedProduct?.name?.replace(/\s+/g, "-").toLowerCase() || "product"}-${tmpl}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      } catch (err) {
        console.error("Download failed:", err);
      }
    },
    [getImageUrl, selectedProduct],
  );

  const handleDownload = async () => {
    setDownloading(true);
    await downloadImage(template);
    setDownloading(false);
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    for (const t of TEMPLATE_OPTIONS) {
      await downloadImage(t.id);
    }
    setDownloadingAll(false);
  };

  const THEMES: { id: CarouselTheme; label: string; emoji: string; note: string }[] = [
    { id: "light", label: "Light", emoji: "\u2600\uFE0F", note: "Recommended for Amazon" },
    { id: "dark",  label: "Dark",  emoji: "\u{1F319}", note: "High contrast pop" },
  ];

  return (
    <div className="space-y-6">
      {/* Intro banner */}
      <div className="bg-gradient-to-r from-[#e04c8a]/12 to-[#f472b6]/10 border border-[#e04c8a]/20 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#e04c8a] mb-1">
          Put your reviews in the Amazon carousel
        </h2>
        <p className="text-xs text-[#8b839e] leading-relaxed max-w-2xl">
          Generate high-resolution review images (2000x2000 PNG) to upload as product images on Amazon.
          Each image includes your Health Score, top reviews, and a QR code that links shoppers directly to your Review Jam page.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* Left panel: settings */}
        <div className="space-y-6">

          {/* Product selector */}
          <div>
            <h3 className="text-xs font-semibold text-[#8b839e] uppercase tracking-wide mb-3">
              1 &mdash; Select product
            </h3>
            <div className="space-y-2">
              {campaigns.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProduct(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    selectedProduct?.id === p.id
                      ? "bg-[#e04c8a]/12 border-[#e04c8a]/40 text-[#e8e4f0]"
                      : "bg-[#1c1826] border-[#2a2535] text-[#cbc5d9] hover:border-[#e6c9a0]"
                  }`}
                >
                  <p className="text-sm font-medium leading-tight">{p.name}</p>
                  <p className="text-xs text-[#8b839e] mt-0.5">{p.brandName} &middot; {p.category}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Template picker */}
          <div>
            <h3 className="text-xs font-semibold text-[#8b839e] uppercase tracking-wide mb-3">
              2 &mdash; Choose template
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={`text-left p-3 rounded-xl border transition ${
                    template === t.id
                      ? "bg-[#e04c8a]/12 border-[#e04c8a]/40"
                      : "bg-[#1c1826] border-[#2a2535] hover:border-[#e6c9a0]"
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  <p className={`text-xs font-medium mt-1 ${template === t.id ? "text-[#e04c8a]" : "text-[#cbc5d9]"}`}>
                    {t.label}
                  </p>
                  <p className="text-[10px] text-[#8b839e] mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Theme picker */}
          <div>
            <h3 className="text-xs font-semibold text-[#8b839e] uppercase tracking-wide mb-3">
              3 &mdash; Choose theme
            </h3>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition ${
                    theme === t.id
                      ? "bg-[#e04c8a]/12 border-[#e04c8a]/40 text-[#e04c8a]"
                      : "bg-[#1c1826] border-[#2a2535] text-[#8b839e] hover:border-[#e6c9a0]"
                  }`}
                >
                  <span className="text-lg">{t.emoji}</span>
                  {t.label}
                  <span className="text-[10px] text-[#4a4458]">{t.note}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Download buttons */}
          {selectedProduct && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#e04c8a] to-[#f472b6] text-white font-semibold text-sm hover:from-[#d84315] hover:to-[#ff7043] transition disabled:opacity-50"
              >
                {downloading ? "Generating\u2026" : `Download ${TEMPLATE_OPTIONS.find((t) => t.id === template)?.label} PNG`}
              </button>
              <button
                type="button"
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                className="w-full py-3 rounded-xl border border-[#2a2535] text-[#cbc5d9] text-sm font-medium hover:bg-[#231e2e] transition disabled:opacity-50"
              >
                {downloadingAll ? "Generating all\u2026" : "Download All 4 Templates"}
              </button>
            </div>
          )}

          {/* How-to */}
          <div className="bg-[#231e2e] border border-[#2a2535] rounded-xl p-5 space-y-2.5">
            <h4 className="text-xs font-semibold text-[#cbc5d9] mb-3">How to use</h4>
            {[
              ["1\uFE0F\u20E3", "Download the image(s) you want"],
              ["2\uFE0F\u20E3", "Go to Amazon Seller Central \u2192 Edit Listing \u2192 Images"],
              ["3\uFE0F\u20E3", "Upload as one of your additional product images (slots 2-9)"],
              ["4\uFE0F\u20E3", "Shoppers scan the QR code to read full reviews on ReviewJam"],
            ].map(([icon, text]) => (
              <div key={String(text)} className="flex items-start gap-2.5 text-xs text-[#8b839e]">
                <span className="shrink-0">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: preview */}
        <div>
          <h3 className="text-xs font-semibold text-[#8b839e] uppercase tracking-wide mb-3">
            Preview
          </h3>

          {selectedProduct ? (
            <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-4">
              <div className="relative aspect-square rounded-lg overflow-hidden bg-[#231e2e] border border-[#2a2535]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={imgKey}
                  src={getImageUrl(template)}
                  alt={`${selectedProduct.name} - ${template} carousel image`}
                  className="w-full h-full object-contain"
                  loading="eager"
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-[#4a4458]">
                  2000x2000 PNG &middot; Amazon-ready
                </p>
                <p className="text-[11px] text-[#4a4458]">
                  Cached for 1 hour
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-12 flex items-center justify-center">
              <p className="text-[#8b839e] text-sm">Select a product to preview</p>
            </div>
          )}

          {/* Specs */}
          <div className="mt-6 bg-[#231e2e] border border-[#2a2535] rounded-xl p-5 space-y-2.5">
            <h4 className="text-xs font-semibold text-[#cbc5d9] mb-3">Image specifications</h4>
            {[
              ["\u{1F4D0}", "2000x2000px \u2014 meets Amazon zoom requirement (min 1000px)"],
              ["\u{1F4F8}", "PNG format \u2014 crisp text, Amazon-compatible"],
              ["\u{1F3AF}", "Live Health Score with colour-coded ring"],
              ["\u{1F4CA}", "Aggregated pros, cons, and ratings from all reviews"],
              ["\u{1F4F1}", "QR code linking to your Review Jam product page"],
              ["\u{1F504}", "Images update with latest review data when re-downloaded"],
            ].map(([icon, text]) => (
              <div key={String(text)} className="flex items-start gap-2.5 text-xs text-[#8b839e]">
                <span className="shrink-0">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

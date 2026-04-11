"use client";

import { useState, useEffect } from "react";
import { useBrandHub } from "../../components/BrandHubContext";
import {
  iframeSnippet,
  shopifySnippet,
} from "../../../../../lib/widgetSnippets";

export default function IntegrationsPage() {
  const { campaigns, baseUrl } = useBrandHub();

  const [selectedProduct, setSelectedProduct] = useState(campaigns[0] ?? null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProduct && campaigns.length > 0) {
      setSelectedProduct(campaigns[0]);
    }
  }, [campaigns, selectedProduct]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const shopifyCode = selectedProduct ? shopifySnippet(selectedProduct.id, baseUrl) : "";
  const iframeCode = selectedProduct ? iframeSnippet(selectedProduct.id, "auto", baseUrl) : "";

  return (
    <div className="space-y-6">
      {/* Product selector */}
      <div>
        <h3 className="text-xs font-semibold text-[#8b839e] uppercase tracking-wide mb-3">
          Select product
        </h3>
        <div className="flex gap-2 flex-wrap">
          {campaigns.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProduct(p)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                selectedProduct?.id === p.id
                  ? "bg-[#e04c8a]/12 border-[#e04c8a]/40 text-[#e8e4f0]"
                  : "bg-[#1c1826] border-[#2a2535] text-[#cbc5d9] hover:border-[#e6c9a0]"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {selectedProduct && (
        <div className="space-y-8">

          {/* ── Shopify ── */}
          <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#34d399]/10 border border-[#34d399]/30 flex items-center justify-center">
                <span className="text-xl">{"\u{1F6CD}\uFE0F"}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#e8e4f0]">Shopify</h3>
                <p className="text-xs text-[#8b839e]">Add review widgets to your Shopify storefront</p>
              </div>
            </div>

            {/* Code block */}
            <div className="relative mb-4">
              <pre className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-4 text-[11px] text-[#cbc5d9] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {shopifyCode}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(shopifyCode, "shopify")}
                className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  copiedKey === "shopify"
                    ? "bg-[#34d399] text-white"
                    : "bg-[#1c1826] hover:bg-[#231e2e] text-[#e8e4f0]"
                }`}
              >
                {copiedKey === "shopify" ? "\u2713 Copied!" : "Copy"}
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#cbc5d9] mb-1">Setup guide</p>
              {[
                "In your Shopify Admin, go to Online Store \u2192 Themes \u2192 Customize",
                "Navigate to the product page template",
                'Add a "Custom Liquid" section below the product description',
                "Paste the snippet above and save",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-[#8b839e]">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#e04c8a] text-white text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── WordPress ── */}
          <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <span className="text-xl">{"\u{1F310}"}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#e8e4f0]">WordPress</h3>
                <p className="text-xs text-[#8b839e]">Embed in Gutenberg blocks or WooCommerce product pages</p>
              </div>
            </div>

            {/* Code block */}
            <div className="relative mb-4">
              <pre className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-4 text-[11px] text-[#cbc5d9] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {iframeCode}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(iframeCode, "wordpress")}
                className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  copiedKey === "wordpress"
                    ? "bg-[#34d399] text-white"
                    : "bg-[#1c1826] hover:bg-[#231e2e] text-[#e8e4f0]"
                }`}
              >
                {copiedKey === "wordpress" ? "\u2713 Copied!" : "Copy"}
              </button>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-[#cbc5d9] mb-2">Option 1: Gutenberg Editor</p>
                <div className="space-y-2">
                  {[
                    'In the WordPress editor, add a "Custom HTML" block',
                    "Paste the iframe snippet above",
                    "Switch to Preview to verify the widget renders correctly",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs text-[#8b839e]">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#cbc5d9] mb-2">Option 2: WooCommerce Product Page</p>
                <div className="space-y-2">
                  {[
                    "Go to Appearance \u2192 Theme File Editor",
                    "Open single-product.php (or your WooCommerce product template)",
                    "Paste the snippet after the product description section",
                    "Save the file and verify on a product page",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs text-[#8b839e]">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Custom Website ── */}
          <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/30 flex items-center justify-center">
                <span className="text-xl">{"\u{1F4BB}"}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#e8e4f0]">Custom Website</h3>
                <p className="text-xs text-[#8b839e]">Drop the iframe into any HTML page</p>
              </div>
            </div>

            {/* Code block */}
            <div className="relative mb-4">
              <pre className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-4 text-[11px] text-[#cbc5d9] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {iframeCode}
              </pre>
              <button
                type="button"
                onClick={() => handleCopy(iframeCode, "custom")}
                className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  copiedKey === "custom"
                    ? "bg-[#34d399] text-white"
                    : "bg-[#1c1826] hover:bg-[#231e2e] text-[#e8e4f0]"
                }`}
              >
                {copiedKey === "custom" ? "\u2713 Copied!" : "Copy"}
              </button>
            </div>

            <p className="text-xs text-[#8b839e] leading-relaxed">
              Paste this snippet anywhere in your HTML. The widget is fully responsive, supports light/dark/auto themes, and auto-updates every hour with the latest review data. Change <code className="text-[#cbc5d9] bg-[#1c1826] px-1 py-0.5 rounded">theme=auto</code> to <code className="text-[#cbc5d9] bg-[#1c1826] px-1 py-0.5 rounded">theme=light</code> or <code className="text-[#cbc5d9] bg-[#1c1826] px-1 py-0.5 rounded">theme=dark</code> to force a specific mode.
            </p>
          </div>
        </div>
      )}

      {!selectedProduct && (
        <div className="bg-[#1c1826] border border-[#2a2535] rounded-xl p-12 flex items-center justify-center">
          <p className="text-[#8b839e] text-sm">Select a product above to generate integration code</p>
        </div>
      )}
    </div>
  );
}

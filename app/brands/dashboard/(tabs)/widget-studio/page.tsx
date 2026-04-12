"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBrandHub } from "../../components/BrandHubContext";
import {
  iframeSnippet,
  reactSnippet,
  htmlSnippet,
  shopifySnippet,
} from "../../../../../lib/widgetSnippets";

type Theme = "auto" | "light" | "dark";
type SnippetTab = "iframe" | "react" | "html";
type WidgetSize = "compact" | "standard" | "wide";

const SIZE_MAP: Record<WidgetSize, number> = {
  compact: 280,
  standard: 360,
  wide: 480,
};

const THEMES: { id: Theme; label: string }[] = [
  { id: "auto",  label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark",  label: "Dark" },
];

const SIZES: { id: WidgetSize; label: string; width: number }[] = [
  { id: "compact",  label: "Compact",  width: 280 },
  { id: "standard", label: "Standard", width: 360 },
  { id: "wide",     label: "Wide",     width: 480 },
];

const SNIPPET_TABS: { id: SnippetTab; label: string }[] = [
  { id: "iframe", label: "iframe" },
  { id: "react",  label: "React" },
  { id: "html",   label: "HTML" },
];

export default function WidgetStudioPage() {
  const { campaigns, baseUrl } = useBrandHub();

  const [selectedProduct, setSelectedProduct] = useState(campaigns[0] ?? null);
  const [theme, setTheme] = useState<Theme>("auto");
  const [size, setSize] = useState<WidgetSize>("standard");
  const [snippetTab, setSnippetTab] = useState<SnippetTab>("iframe");
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    if (!selectedProduct && campaigns.length > 0) {
      setSelectedProduct(campaigns[0]);
    }
  }, [campaigns, selectedProduct]);

  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [theme, selectedProduct, size]);

  const getSnippet = useCallback(() => {
    if (!selectedProduct) return "";
    if (snippetTab === "iframe") return iframeSnippet(selectedProduct.id, theme, baseUrl);
    if (snippetTab === "react")  return reactSnippet(selectedProduct.id, theme, baseUrl);
    return htmlSnippet(selectedProduct.id, theme, baseUrl);
  }, [selectedProduct, theme, snippetTab, baseUrl]);

  const handleCopy = async (text?: string) => {
    try {
      await navigator.clipboard.writeText(text || getSnippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const widgetUrl = selectedProduct
    ? `${baseUrl}/api/widget/${selectedProduct.id}?theme=${theme}`
    : "";

  const widthPx = SIZE_MAP[size];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── Left panel: settings ─────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Product selector */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              Select product
            </h3>
            <div className="space-y-2">
              {campaigns.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProduct(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    selectedProduct?.id === p.id
                      ? "bg-indigo-500/10 border-indigo-500/40 text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-zinc-300 hover:border-white/[0.12]"
                  }`}
                >
                  <p className="text-sm font-medium leading-tight">{p.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{p.brandName} &middot; {p.category}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Theme toggle */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              Theme
            </h3>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition text-center ${
                    theme === t.id
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:border-white/[0.12]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-600 mt-2">
              &ldquo;Auto&rdquo; follows the visitor&apos;s system preference.
            </p>
          </div>

          {/* Widget size */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              Widget size
            </h3>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSize(s.id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-xs font-medium transition ${
                    size === s.id
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:border-white/[0.12]"
                  }`}
                >
                  {s.label}
                  <span className="text-[10px] opacity-70">{s.width}px</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel: preview + actions ─────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            Live preview
          </h3>

          {selectedProduct ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 flex flex-col items-center">
              {/* Simulated browser chrome */}
              <div
                className="bg-white/[0.05] rounded-t-xl px-4 py-2.5 flex items-center gap-2 border border-white/[0.06] border-b-0"
                style={{ width: `${Math.min(widthPx + 20, 500)}px`, maxWidth: "100%" }}
              >
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                </div>
                <div className="flex-1 bg-white/[0.06] rounded-md px-3 py-1 text-[10px] text-zinc-500 font-mono truncate">
                  {baseUrl}/api/widget/{selectedProduct.id}
                </div>
              </div>

              {/* iframe embed */}
              <div
                className="border border-white/[0.06] border-t-0 rounded-b-xl overflow-hidden bg-[#09090b]"
                style={{ width: `${Math.min(widthPx + 20, 500)}px`, maxWidth: "100%" }}
              >
                <iframe
                  key={iframeKey}
                  src={`/api/widget/${selectedProduct.id}?theme=${theme}`}
                  width="100%"
                  height="420"
                  style={{ border: "none", display: "block" }}
                  title="Widget preview"
                  scrolling="no"
                />
              </div>

              <p className="text-[11px] text-zinc-600 mt-3 text-center">
                Auto-refreshes when you change settings.
              </p>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 flex items-center justify-center">
              <p className="text-zinc-500 text-sm">Select a product to preview the widget</p>
            </div>
          )}

          {/* Action bar */}
          {selectedProduct && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCopy(widgetUrl)}
                className="flex-1 min-w-[140px] text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg transition text-center"
              >
                {copied ? "\u2713 Copied!" : "Copy Widget Link"}
              </button>
              <Link
                href="/brands/dashboard/integrations"
                className="flex-1 min-w-[140px] text-xs font-medium border border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] px-4 py-2.5 rounded-lg transition text-center"
              >
                Get Shopify Code
              </Link>
              <a
                href={widgetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-zinc-400 hover:text-white px-4 py-2.5 rounded-lg transition"
              >
                View Full Page &rarr;
              </a>
            </div>
          )}

          {/* Collapsible View Code section */}
          {selectedProduct && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setCodeOpen(!codeOpen)}
                className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-zinc-300 hover:bg-white/[0.03] transition"
              >
                <span>View Code</span>
                <span className={`transition-transform ${codeOpen ? "rotate-180" : ""}`}>
                  {"\u25BC"}
                </span>
              </button>
              {codeOpen && (
                <div className="px-5 pb-5 space-y-3">
                  {/* Snippet tabs */}
                  <div className="flex gap-1">
                    {SNIPPET_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSnippetTab(tab.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                          snippetTab === tab.id
                            ? "bg-white/[0.06] text-white border-transparent"
                            : "bg-transparent text-zinc-500 border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Code block */}
                  <div className="relative">
                    <pre className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-[11px] text-zinc-300 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                      {getSnippet()}
                    </pre>
                    <button
                      type="button"
                      onClick={() => handleCopy()}
                      className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                        copied
                          ? "bg-emerald-600 text-white"
                          : "bg-white/[0.06] hover:bg-white/[0.08] text-zinc-200"
                      }`}
                    >
                      {copied ? "\u2713 Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

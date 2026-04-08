"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider } from "../../../lib/firebase";
import { useAuth } from "../../../lib/hooks/useAuth";
import { TEMPLATE_OPTIONS } from "../../../lib/carousel/types";
import type { BrandProduct as Product } from "../../../lib/types";
import type { TemplateName, CarouselTheme } from "../../../lib/carousel/types";

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BrandCarouselPage() {
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [template, setTemplate] = useState<TemplateName>("health-overview");
  const [theme, setTheme] = useState<CarouselTheme>("light");
  const [imgKey, setImgKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://reviewjam.com";

  // ── Load products ────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (user?.email) {
      loadProducts(user.email).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    setImgKey((k) => k + 1);
  }, [template, theme, selectedProduct]);

  async function loadProducts(email: string) {
    const q = query(
      collection(db, "products"),
      where("brandEmail", "==", email.toLowerCase()),
    );
    const snap = await getDocs(q);
    if (snap.empty) { setIsAuthorized(false); return; }
    setIsAuthorized(true);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
    setProducts(list);
    setSelectedProduct(list[0] ?? null);
  }

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch {}
  };

  // ── Download helpers ─────────────────────────────────────────────────────

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

  // ── Loading / auth gates ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b] text-slate-500 dark:text-zinc-400 text-sm animate-pulse">
        Loading&hellip;
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-white dark:bg-[#09090b] flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-1">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Sign in to create Amazon images
        </h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm max-w-xs text-center">
          Use the same email as your Review Jam brand account.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          className="bg-slate-900 dark:bg-white text-white dark:text-[#09090b] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 dark:hover:bg-zinc-200 transition"
        >
          Sign in with Google
        </button>
        <Link href="/brands" className="text-sm text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition">
          Don&apos;t have a product listed? &rarr;
        </Link>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-white dark:bg-[#09090b] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">No products found</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm max-w-sm">
          We couldn&apos;t find any products for <strong className="text-slate-900 dark:text-white">{user.email}</strong>.
        </p>
        <div className="flex gap-3 mt-1">
          <Link href="/brands" className="text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-[#09090b] px-4 py-2 rounded-lg hover:bg-slate-700 dark:hover:bg-zinc-200 transition">
            List a product
          </Link>
          <button type="button" onClick={() => auth.signOut()} className="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition">
            Sign out
          </button>
        </div>
      </main>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────

  const THEMES: { id: CarouselTheme; label: string; emoji: string; note: string }[] = [
    { id: "light", label: "Light", emoji: "☀️", note: "Recommended for Amazon" },
    { id: "dark",  label: "Dark",  emoji: "🌙", note: "High contrast pop" },
  ];

  return (
    <main className="min-h-screen bg-white dark:bg-[#09090b] text-slate-800 dark:text-zinc-200">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Link href="/brands" className="text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition">Brands</Link>
              <span className="text-zinc-700">/</span>
              <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Amazon Carousel</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">🛒</span> Amazon Carousel Image Generator
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/brands/widgets"
              className="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              Embed Widgets
            </Link>
            <Link
              href="/brands/dashboard"
              className="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              &larr; Dashboard
            </Link>
            <button
              type="button"
              onClick={() => auth.signOut()}
              className="text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        {/* Intro banner */}
        <div className="bg-gradient-to-r from-indigo-950/40 to-violet-950/30 border border-indigo-800/40 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-indigo-300 mb-1">
            Put your reviews in the Amazon carousel
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
            Generate high-resolution review images (2000&times;2000 PNG) to upload as product images on Amazon.
            Each image includes your Health Score, top reviews, and a QR code that links shoppers directly to your Review Jam page.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── Left panel: settings ───────────────────────────────────── */}
          <div className="space-y-6">

            {/* Product selector */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                1 &mdash; Select product
              </h3>
              <div className="space-y-2">
                {products.map((p) => (
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

            {/* Template picker */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
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
                        ? "bg-indigo-500/10 border-indigo-500/40"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <p className={`text-xs font-medium mt-1 ${template === t.id ? "text-indigo-300" : "text-zinc-300"}`}>
                      {t.label}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme picker */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
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
                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                        : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:border-white/[0.12]"
                    }`}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    {t.label}
                    <span className="text-[10px] text-zinc-600">{t.note}</span>
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
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition disabled:opacity-50"
                >
                  {downloading ? "Generating\u2026" : `Download ${TEMPLATE_OPTIONS.find((t) => t.id === template)?.label} PNG`}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="w-full py-3 rounded-xl border border-white/[0.08] text-zinc-300 text-sm font-medium hover:bg-white/[0.04] transition disabled:opacity-50"
                >
                  {downloadingAll ? "Generating all\u2026" : "Download All 4 Templates"}
                </button>
              </div>
            )}

            {/* How-to */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-2.5">
              <h4 className="text-xs font-semibold text-zinc-300 mb-3">How to use</h4>
              {[
                ["1️⃣", "Download the image(s) you want"],
                ["2️⃣", "Go to Amazon Seller Central \u2192 Edit Listing \u2192 Images"],
                ["3️⃣", "Upload as one of your additional product images (slots 2-9)"],
                ["4️⃣", "Shoppers scan the QR code to read full reviews on ReviewJam"],
              ].map(([icon, text]) => (
                <div key={String(text)} className="flex items-start gap-2.5 text-xs text-zinc-400">
                  <span className="shrink-0">{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right panel: preview ──────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              Preview
            </h3>

            {selectedProduct ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                {/* Image preview */}
                <div className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.04]">
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
                  <p className="text-[11px] text-zinc-600">
                    2000&times;2000 PNG &middot; Amazon-ready
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    Cached for 1 hour
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 flex items-center justify-center">
                <p className="text-zinc-500 text-sm">Select a product to preview</p>
              </div>
            )}

            {/* Specs */}
            <div className="mt-6 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-2.5">
              <h4 className="text-xs font-semibold text-zinc-300 mb-3">Image specifications</h4>
              {[
                ["📐", "2000\u00d72000px \u2014 meets Amazon zoom requirement (min 1000px)"],
                ["📸", "PNG format \u2014 crisp text, Amazon-compatible"],
                ["🎯", "Live Health Score with colour-coded ring"],
                ["📊", "Aggregated pros, cons, and ratings from all reviews"],
                ["📱", "QR code linking to your Review Jam product page"],
                ["🔄", "Images update with latest review data when re-downloaded"],
              ].map(([icon, text]) => (
                <div key={String(text)} className="flex items-start gap-2.5 text-xs text-zinc-400">
                  <span className="shrink-0">{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider } from "../../../lib/firebase";
import { useAuth } from "../../../lib/hooks/useAuth";

import type { BrandProduct as Product } from "../../../lib/types";

type Theme = "auto" | "light" | "dark";
type SnippetTab = "iframe" | "react" | "html";

// ─── Snippet generators ───────────────────────────────────────────────────────

function iframeSnippet(productId: string, theme: Theme, baseUrl: string) {
  return `<iframe
  src="${baseUrl}/api/widget/${productId}?theme=${theme}"
  width="360"
  height="420"
  frameborder="0"
  scrolling="no"
  style="border:none;border-radius:14px;overflow:hidden;"
  title="Review Jam Trust Widget"
  loading="lazy"
></iframe>`;
}

function reactSnippet(productId: string, theme: Theme, baseUrl: string) {
  return `// ReviewJamWidget.tsx
export function ReviewJamWidget() {
  return (
    <iframe
      src="${baseUrl}/api/widget/${productId}?theme=${theme}"
      width={360}
      height={420}
      style={{ border: "none", borderRadius: 14, overflow: "hidden" }}
      title="Review Jam Trust Widget"
      loading="lazy"
    />
  );
}`;
}

function htmlSnippet(productId: string, theme: Theme, baseUrl: string) {
  return `<!-- Review Jam Trust Widget -->
<div style="width:360px;">
  <iframe
    src="${baseUrl}/api/widget/${productId}?theme=${theme}"
    width="360"
    height="420"
    frameborder="0"
    scrolling="no"
    style="border:none;border-radius:14px;"
    title="Review Jam Trust Widget"
    loading="lazy"
  ></iframe>
</div>`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandWidgetsPage() {
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [theme, setTheme] = useState<Theme>("auto");
  const [snippetTab, setSnippetTab] = useState<SnippetTab>("iframe");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); // force reload on settings change

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://reviewjam.com";

  useEffect(() => {
    if (authLoading) return;
    if (user?.email) {
      loadProducts(user.email).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Reload preview when theme changes
  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [theme, selectedProduct]);

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

  const getSnippet = useCallback(() => {
    if (!selectedProduct) return "";
    if (snippetTab === "iframe") return iframeSnippet(selectedProduct.id, theme, baseUrl);
    if (snippetTab === "react")  return reactSnippet(selectedProduct.id, theme, baseUrl);
    return htmlSnippet(selectedProduct.id, theme, baseUrl);
  }, [selectedProduct, theme, snippetTab, baseUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getSnippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // ── Loading / auth gates ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090b] text-slate-500 dark:text-zinc-400 text-sm animate-pulse">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-white dark:bg-[#09090b] flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-1">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sign in to access your widgets</h2>
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
          Don&apos;t have a product listed? →
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
          Widgets are available on the $500+ tier.
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

  // ── Main UI ───────────────────────────────────────────────────────────────

  const snippet = getSnippet();
  const SNIPPET_TABS: { id: SnippetTab; label: string }[] = [
    { id: "iframe", label: "iframe" },
    { id: "react",  label: "React" },
    { id: "html",   label: "HTML" },
  ];
  const THEMES: { id: Theme; label: string; emoji: string }[] = [
    { id: "auto",  label: "Auto",  emoji: "🔄" },
    { id: "light", label: "Light", emoji: "☀️" },
    { id: "dark",  label: "Dark",  emoji: "🌙" },
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
              <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Trust Widgets</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">🧩</span> Brand Trust Widget Generator
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/brands/dashboard"
              className="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              ← Dashboard
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
        <div className="bg-gradient-to-r from-amber-950/40 to-orange-950/30 border border-amber-800/40 rounded-xl p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-amber-300 mb-1">Embed verified trust on any page</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Paste the widget on your website, Shopify store, landing page, or app.
              It shows live Health Score, star rating, top pros &amp; cons, and a direct link to your review page — auto-updated every hour.
            </p>
          </div>
          <div className="shrink-0 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-amber-400 font-medium uppercase tracking-wide">Plan</p>
            <p className="text-lg font-bold text-amber-300">$500+</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── Left panel: settings ─────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Product selector */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                1 — Select product
              </h3>
              <div className="space-y-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProduct(p)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      selectedProduct?.id === p.id
                        ? "bg-amber-500/10 border-amber-500/40 text-white"
                        : "bg-white/[0.03] border-white/[0.06] text-zinc-300 hover:border-white/[0.12]"
                    }`}
                  >
                    <p className="text-sm font-medium leading-tight">{p.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{p.brandName} · {p.category}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme picker */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                2 — Choose theme
              </h3>
              <div className="flex gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition ${
                      theme === t.id
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:border-white/[0.12]"
                    }`}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600 mt-2">
                "Auto" follows the visitor&apos;s system preference.
              </p>
            </div>

            {/* Code snippet */}
            {selectedProduct && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                  3 — Copy embed code
                </h3>

                {/* Tabs */}
                <div className="flex gap-1 mb-3">
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
                    {snippet}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                      copied
                        ? "bg-emerald-600 text-white"
                        : "bg-white/[0.06] hover:bg-white/[0.08] text-zinc-200"
                    }`}
                  >
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                </div>

                {/* Direct widget URL */}
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 text-[10px] bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-zinc-500 font-mono truncate">
                    {baseUrl}/api/widget/{selectedProduct.id}?theme={theme}
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${baseUrl}/api/widget/${selectedProduct.id}?theme=${theme}`,
                      )
                    }
                    className="shrink-0 text-[11px] text-zinc-500 hover:text-white border border-white/[0.06] hover:border-white/[0.12] px-2.5 py-2 rounded-lg transition"
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right panel: live preview ─────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
              Live preview
            </h3>

            {selectedProduct ? (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 flex flex-col items-center">
                {/* Simulated browser chrome */}
                <div className="w-full max-w-[380px] bg-white/[0.05] rounded-t-xl px-4 py-2.5 flex items-center gap-2 border border-white/[0.06] border-b-0">
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
                <div className="w-full max-w-[380px] border border-white/[0.06] border-t-0 rounded-b-xl overflow-hidden bg-[#09090b]">
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
                  Live data is cached for up to 1 hour.
                </p>
              </div>
            ) : (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 flex items-center justify-center">
                <p className="text-zinc-500 text-sm">Select a product to preview the widget</p>
              </div>
            )}

            {/* Feature checklist */}
            <div className="mt-6 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-2.5">
              <h4 className="text-xs font-semibold text-zinc-300 mb-3">What the widget shows</h4>
              {[
                ["🔢", "Live Health Score (0–100) with colour-coded ring"],
                ["⭐", "Average star rating + review count"],
                ["✅", "Top 3 most-mentioned pros (aggregated from all reviews)"],
                ["⚠️", "Top 3 most-mentioned cons (aggregated from all reviews)"],
                ["🔗", "\"Review us on Review Jam\" CTA linked to your product page"],
                ["🔄", "Auto-updated every hour — no rebuild needed"],
                ["🎨", "Light / Dark / Auto theme support"],
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

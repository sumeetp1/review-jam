"use client";

import type { BuyLink } from "../../../lib/types";

export default function BuyLinksCard({ buyLinks }: { buyLinks: BuyLink[] }) {
  if (!buyLinks || buyLinks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.06] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-600 mb-2.5 flex items-center gap-1.5">
        <span className="text-sm">🛒</span> Where to Buy
      </p>
      <div className="space-y-1.5">
        {buyLinks.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.05] transition group"
          >
            <span className="text-slate-700 dark:text-zinc-300 font-semibold truncate">{link.retailer}</span>
            <span className="flex items-center gap-2 shrink-0 ml-2">
              {link.price && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{link.price}</span>
              )}
              <span className="text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition">↗</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

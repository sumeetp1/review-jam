"use client";

import type { BuyLink } from "../../../lib/types";

export default function BuyLinksCard({ buyLinks }: { buyLinks: BuyLink[] }) {
  if (!buyLinks || buyLinks.length === 0) return null;

  return (
    <div className="bg-[#1c1826] rounded-xl border border-[#2a2535] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b839e] mb-2.5 flex items-center gap-1.5">
        <span className="text-sm">🛒</span> Where to Buy
      </p>
      <div className="space-y-1.5">
        {buyLinks.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border border-[#2a2535] bg-[#1c1826] hover:border-[#3a3348] hover:bg-[#231e2e] transition group"
          >
            <span className="text-[#cbc5d9] font-semibold truncate">{link.retailer}</span>
            <span className="flex items-center gap-2 shrink-0 ml-2">
              {link.price && (
                <span className="text-[#34d399] font-semibold">{link.price}</span>
              )}
              <span className="text-[#8b839e] group-hover:text-[#cbc5d9] transition">↗</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

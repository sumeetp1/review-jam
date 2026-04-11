"use client";

import type { BuyLink } from "../../../lib/types";

export default function BuyLinksCard({ buyLinks }: { buyLinks: BuyLink[] }) {
  if (!buyLinks || buyLinks.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#f5ddc0] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b7560] mb-2.5 flex items-center gap-1.5">
        <span className="text-sm">🛒</span> Where to Buy
      </p>
      <div className="space-y-1.5">
        {buyLinks.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border border-[#f5ddc0] bg-white hover:border-[#d4b896] hover:bg-[#fff0e6] transition group"
          >
            <span className="text-[#5c4a38] font-semibold truncate">{link.retailer}</span>
            <span className="flex items-center gap-2 shrink-0 ml-2">
              {link.price && (
                <span className="text-[#66bb6a] font-semibold">{link.price}</span>
              )}
              <span className="text-[#8b7560] group-hover:text-[#5c4a38] transition">↗</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

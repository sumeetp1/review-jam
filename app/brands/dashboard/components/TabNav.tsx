"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview",       href: "/brands/dashboard/overview",       icon: "\u{1F4CA}" },
  { label: "Widget Studio",  href: "/brands/dashboard/widget-studio",  icon: "\u{1F9E9}" },
  { label: "Amazon Images",  href: "/brands/dashboard/amazon-images",  icon: "\u{1F6D2}" },
  { label: "Integrations",   href: "/brands/dashboard/integrations",   icon: "\u{1F50C}" },
  { label: "Reviews",        href: "/brands/dashboard/reviews",        icon: "\u{1F4AC}" },
];

export default function TabNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-[#f5ddc0] bg-[#fff0e6]">
      <div className="max-w-6xl mx-auto px-4 sm:px-8">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide py-2 -mb-px">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname?.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? "bg-[#e65100] text-white"
                    : "bg-white text-[#d4b896] hover:bg-[#fff0e6]"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

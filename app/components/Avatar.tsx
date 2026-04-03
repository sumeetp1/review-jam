"use client";

import { useState } from "react";

// ── Deterministic hash ────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  }
  // Mix with a second pass so short strings like "?" get variance
  for (let i = s.length - 1; i >= 0; i--) {
    h = (((h << 3) ^ h) + s.charCodeAt(i) * 1000003) >>> 0;
  }
  return h;
}

// ── Identicon SVG ─────────────────────────────────────────────────────────────
// 5×5 grid, columns 0-2 mirrored to columns 4-3 (GitHub-style)
// Background: HSL derived from hash; cells: semi-transparent white

function Identicon({ seed, className }: { seed: string; className: string }) {
  const h = hashStr(seed);

  const hue = h % 360;
  const sat = 42 + ((h >> 8) % 34);   // 42-75 %
  const lit = 42 + ((h >> 16) % 18);  // 42-60 %
  const bg = `hsl(${hue},${sat}%,${lit}%)`;

  // 15 bits → 5 rows × 3 unique columns → mirrored to 5 columns
  const bits = Array.from({ length: 15 }, (_, i) => Boolean((h >> i) & 1));

  // Ensure at least 4 cells are ON (prevents nearly-blank avatars)
  const onCount = bits.filter(Boolean).length;
  if (onCount < 4) {
    const extras = [2, 6, 10, 14];
    extras.slice(0, 4 - onCount).forEach((i) => { bits[i] = true; });
  }

  const grid: boolean[][] = Array.from({ length: 5 }, (_, row) => [
    bits[row * 3 + 0],
    bits[row * 3 + 1],
    bits[row * 3 + 2],
    bits[row * 3 + 1],
    bits[row * 3 + 0],
  ]);

  // SVG viewBox: 50×50 → each cell is 10×10, 1px inset padding
  return (
    <svg viewBox="0 0 50 50" className={className} aria-hidden="true">
      <rect width="50" height="50" fill={bg} />
      {grid.flatMap((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={x * 10 + 1.5}
              y={y * 10 + 1.5}
              width={7}
              height={7}
              rx={1.5}
              fill="rgba(255,255,255,0.88)"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

// ── Community avatar (emoji-based with gradient ring) ─────────────────────────

const COMMUNITY_GRADIENTS = [
  ["from-amber-400", "to-orange-500"],
  ["from-violet-500", "to-purple-600"],
  ["from-sky-400",   "to-blue-500"],
  ["from-emerald-400","to-teal-500"],
  ["from-rose-400",  "to-pink-500"],
  ["from-indigo-400","to-blue-600"],
  ["from-fuchsia-400","to-pink-600"],
  ["from-lime-400",  "to-green-500"],
  ["from-cyan-400",  "to-sky-500"],
  ["from-red-400",   "to-rose-600"],
];

function CommunityIcon({ emoji, seed, className }: { emoji?: string | null; seed: string; className: string }) {
  const [from, to] = COMMUNITY_GRADIENTS[hashStr(seed) % COMMUNITY_GRADIENTS.length];
  return (
    <div className={`bg-gradient-to-br ${from} ${to} flex items-center justify-center rounded-full shrink-0 ${className}`}>
      <span className="leading-none select-none">{emoji || "📦"}</span>
    </div>
  );
}

// ── Main Avatar component ─────────────────────────────────────────────────────

type Props = {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** Pass an emoji (e.g. community icon) to render a CommunityIcon instead of identicon */
  emoji?: string | null;
};

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
  xs: "w-5 h-5",
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-14 h-14",
};

const EMOJI_TEXT: Record<NonNullable<Props["size"]>, string> = {
  xs: "text-[10px]",
  sm: "text-sm",
  md: "text-xl",
  lg: "text-3xl",
};

export default function Avatar({ name, src, size = "md", className = "", emoji }: Props) {
  const [imgError, setImgError] = useState(false);
  const seed = name?.trim() || "?";
  const sizeClass = SIZE_CLASSES[size];
  const emojiSize = EMOJI_TEXT[size];

  // 1. Real photo
  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name ?? ""}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover shrink-0 ${sizeClass} ${className}`}
      />
    );
  }

  // 2. Community emoji icon
  if (emoji) {
    return (
      <CommunityIcon
        emoji={emoji}
        seed={seed}
        className={`${sizeClass} ${emojiSize} ${className}`}
      />
    );
  }

  // 3. Identicon fallback for users
  return (
    <Identicon seed={seed} className={`rounded-full shrink-0 ${sizeClass} ${className}`} />
  );
}

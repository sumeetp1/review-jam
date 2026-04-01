"use client";

import { useState } from "react";

// Deterministic color palette based on name hash
const GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-violet-500 to-purple-600",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-indigo-400 to-blue-600",
  "from-fuchsia-400 to-pink-600",
  "from-lime-400 to-green-500",
  "from-cyan-400 to-sky-500",
  "from-red-400 to-rose-600",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getGradient(name: string): string {
  return GRADIENTS[hashName(name) % GRADIENTS.length];
}

type Props = {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-xs",
  lg: "w-14 h-14 text-lg",
};

export default function Avatar({ name, src, size = "md", className = "" }: Props) {
  const [imgError, setImgError] = useState(false);

  const initial = (name?.trim().charAt(0) || "?").toUpperCase();
  const gradient = getGradient(name || "?");
  const sizeClass = SIZE_CLASSES[size];

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

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white shrink-0 ${sizeClass} ${className}`}
    >
      {initial}
    </div>
  );
}

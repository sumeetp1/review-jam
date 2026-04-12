"use client";

import { useState } from "react";

export default function StarPicker({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const textSize = size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className={`${textSize} transition-transform hover:scale-110 leading-none`}
          aria-label={`${star} star`}
        >
          <span
            className={
              (hovered || value) >= star
                ? "text-amber-400"
                : "text-slate-200 dark:text-slate-700"
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

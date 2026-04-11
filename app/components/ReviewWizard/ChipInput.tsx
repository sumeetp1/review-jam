"use client";

import { useState } from "react";

export default function ChipInput({
  items,
  onAdd,
  onRemove,
  placeholder,
  maxItems = 10,
}: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
  maxItems?: number;
}) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed) && items.length < maxItems) {
      onAdd(trimmed);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#3a3348] text-[#e8e4f0] placeholder:text-[#4a4458]"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim() || items.length >= maxItems}
          className="px-3 py-2 bg-[#1c1826] text-[#cbc5d9] rounded-lg text-sm font-medium hover:bg-[#231e2e] disabled:opacity-40 transition"
        >
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-[#1c1826] text-[#cbc5d9] px-2.5 py-1 rounded-md text-xs font-medium"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-[#8b839e] hover:text-[#cbc5d9] ml-0.5 leading-none text-sm"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

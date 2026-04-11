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
          className="flex-1 bg-white border border-[#f5ddc0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4b896] text-[#4a3828] placeholder:text-[#b89878]"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim() || items.length >= maxItems}
          className="px-3 py-2 bg-[#ffecd2] text-[#5c4a38] rounded-lg text-sm font-medium hover:bg-[#fff0e6] disabled:opacity-40 transition"
        >
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-[#ffecd2] text-[#5c4a38] px-2.5 py-1 rounded-md text-xs font-medium"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-[#8b7560] hover:text-[#5c4a38] ml-0.5 leading-none text-sm"
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

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
          className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim() || items.length >= maxItems}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition"
        >
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md text-xs font-medium"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 ml-0.5 leading-none text-sm"
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

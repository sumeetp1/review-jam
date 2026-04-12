"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ className }: { className?: string }) {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDarkMode;
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    setIsDarkMode(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        "w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition text-slate-500 dark:text-zinc-500 text-sm"
      }
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? "☀️" : "🌙"}
    </button>
  );
}

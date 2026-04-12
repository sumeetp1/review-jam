"use client";

import { useEffect } from "react";

/**
 * Initializes the dark/light theme from localStorage on mount.
 * Default is dark. Runs once in the layout — no UI rendered.
 */
export default function ThemeProvider() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return null;
}

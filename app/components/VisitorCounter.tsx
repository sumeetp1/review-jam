"use client";

import { useEffect, useState } from "react";

const COOKIE_NAME = "rj_vid";
const SESSION_KEY = "rj_visit_posted";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name: string, value: string, maxAgeDays = 400) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export default function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let vid = getCookie(COOKIE_NAME);
    if (!vid || !isUuidV4(vid)) {
      vid = crypto.randomUUID();
      setCookie(COOKIE_NAME, vid);
    }

    const finalVid = vid;

    (async () => {
      try {
        const posted = sessionStorage.getItem(SESSION_KEY) === "1";

        if (!posted) {
          const res = await fetch("/api/visit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visitorId: finalVid }),
          });
          const data = await res.json();
          sessionStorage.setItem(SESSION_KEY, "1");
          if (data.success && typeof data.uniqueVisitors === "number") {
            setCount(data.uniqueVisitors);
            return;
          }
        }

        const res = await fetch("/api/visit");
        const data = await res.json();
        if (typeof data.uniqueVisitors === "number") {
          setCount(data.uniqueVisitors);
        }
      } catch {
        setCount(null);
      }
    })();
  }, []);

  return (
    <div className="text-center py-2 px-4 text-xs text-[#8b839e] border-t border-[#2a2535] bg-[#1c1826]">
      {count === null ? (
        <span className="opacity-70">Visitors</span>
      ) : (
        <span>
          <span className="tabular-nums font-medium text-[#cbc5d9]">
            {count.toLocaleString()}
          </span>{" "}
          unique visitors
        </span>
      )}
    </div>
  );
}

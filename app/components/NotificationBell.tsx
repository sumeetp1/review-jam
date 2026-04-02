"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection, query, where, onSnapshot,
  writeBatch, doc, orderBy, limit,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  trust_milestone: "⭐",
  helpful_vote: "✓",
  comment: "💬",
  payout_approved: "💰",
  fork: "⑂",
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(30),
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notif)));
    }, () => { /* index may not exist yet */ });
    return () => unsub();
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const handleToggle = async () => {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      const unread = notifs.filter((n) => !n.read);
      if (unread.length > 0) {
        const batch = writeBatch(db);
        for (const n of unread) {
          batch.update(doc(db, "notifications", n.id), { read: true });
        }
        batch.commit().catch(() => {});
        setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        aria-label="Notifications"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-600 dark:text-slate-400"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[15px] h-[15px] bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifs.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No notifications yet</p>
            ) : (
              notifs.map((n) => (
                <div key={n.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <div className="flex items-start gap-2.5">
                    <span className="text-sm mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? "🔔"}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">{n.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.body}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import type { DiscussionPost } from "../../../lib/types";

const POST_TYPES = [
  { key: "question", icon: "❓", label: "Question" },
  { key: "tip", icon: "💡", label: "Tip" },
  { key: "issue", icon: "⚠️", label: "Issue" },
  { key: "general", icon: "💬", label: "General" },
] as const;

export default function DiscussionFeed({ productId, posts, currentUserId, currentUserName, onUpvote, onNewPost }: {
  productId: string; posts: DiscussionPost[]; currentUserId?: string; currentUserName?: string;
  onUpvote: (id: string, upvotedBy: string[]) => void; onNewPost: (post: DiscussionPost) => void;
}) {
  const [body, setBody] = useState(""); const [type, setType] = useState<DiscussionPost["type"]>("general");
  const [busy, setBusy] = useState(false); const [open, setOpen] = useState(false);
  async function submit() {
    if (!currentUserId || !body.trim()) return; setBusy(true);
    try {
      const data = { productId, authorId: currentUserId, authorName: currentUserName ?? "Anonymous", type, body: body.trim(), upvotes: 0, upvotedBy: [], createdAt: new Date().toISOString() };
      const ref = await addDoc(collection(db, "productDiscussions"), data);
      onNewPost({ id: ref.id, ...data }); setBody(""); setType("general"); setOpen(false);
    } catch (e) { console.error(e); } finally { setBusy(false); }
  }
  const sorted = [...posts].sort((a, b) => b.upvotes - a.upvotes);
  return (
    <div className="space-y-3">
      {currentUserId && (open ? (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex gap-1.5 flex-wrap">{POST_TYPES.filter(t => t.key !== "question").map((t) => <button key={t.key} type="button" onClick={() => setType(t.key)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${type === t.key ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>{t.icon} {t.label}</button>)}</div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share a tip, report a known issue, or start a general discussion…" rows={3} className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none" />
          <div className="flex gap-2"><button type="button" onClick={submit} disabled={busy || !body.trim()} className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition">{busy ? "Posting…" : "Post"}</button><button type="button" onClick={() => setOpen(false)} className="px-4 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">Cancel</button></div>
        </div>
      ) : <button type="button" onClick={() => setOpen(true)} className="w-full text-[13px] font-medium text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition">+ Share a tip or start a discussion</button>)}
      {sorted.length === 0 && !open && <div className="py-10 text-center text-slate-400 dark:text-slate-600 text-sm"><p className="text-2xl mb-1">💬</p>No discussions yet.{currentUserId ? " Start one above." : " Sign in to post."}</div>}
      {sorted.map((post) => { const meta = POST_TYPES.find((t) => t.key === post.type) ?? POST_TYPES[3]; const hasVoted = currentUserId ? post.upvotedBy.includes(currentUserId) : false; return (
        <div key={post.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex gap-3">
          <button type="button" onClick={() => onUpvote(post.id, post.upvotedBy)} className={`flex flex-col items-center gap-0.5 shrink-0 pt-0.5 transition ${hasVoted ? "text-violet-600 dark:text-violet-400" : "text-slate-300 dark:text-slate-600 hover:text-slate-500"}`}><span className="text-base leading-none">▲</span><span className="text-[11px] font-bold tabular-nums">{post.upvotes}</span></button>
          <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-1 flex-wrap"><span className="text-[10px] font-bold text-slate-500 dark:text-slate-500">{meta.icon} {meta.label}</span><span className="text-[10px] text-slate-400 dark:text-slate-600">·</span><span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{post.authorName}</span><span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">{new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div><p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{post.body}</p></div>
        </div>
      ); })}
    </div>
  );
}

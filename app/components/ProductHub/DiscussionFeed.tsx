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
        <div className="border border-[#f5ddc0] rounded-xl p-4 space-y-3 bg-[#ffecd2]">
          <div className="flex gap-1.5 flex-wrap">{POST_TYPES.filter(t => t.key !== "question").map((t) => <button key={t.key} type="button" onClick={() => setType(t.key)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${type === t.key ? "bg-[#4a3828] text-white border-[#4a3828]" : "bg-white text-[#5c4a38] border-[#f5ddc0] hover:border-[#d4b896]"}`}>{t.icon} {t.label}</button>)}</div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share a tip, report a known issue, or start a general discussion…" rows={3} className="w-full text-sm bg-white border border-[#f5ddc0] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#d4b896] text-[#4a3828] placeholder:text-[#b89878] resize-none" />
          <div className="flex gap-2"><button type="button" onClick={submit} disabled={busy || !body.trim()} className="flex-1 bg-[#4a3828] text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition">{busy ? "Posting…" : "Post"}</button><button type="button" onClick={() => setOpen(false)} className="px-4 text-sm text-[#8b7560] border border-[#f5ddc0] rounded-lg hover:bg-[#fff0e6] transition">Cancel</button></div>
        </div>
      ) : <button type="button" onClick={() => setOpen(true)} className="w-full text-[13px] font-medium text-[#8b7560] border border-dashed border-[#d4b896] rounded-xl py-2.5 hover:bg-[#fff0e6] transition">+ Share a tip or start a discussion</button>)}
      {sorted.length === 0 && !open && <div className="py-10 text-center text-[#8b7560] text-sm"><p className="text-2xl mb-1">💬</p>No discussions yet.{currentUserId ? " Start one above." : " Sign in to post."}</div>}
      {sorted.map((post) => { const meta = POST_TYPES.find((t) => t.key === post.type) ?? POST_TYPES[3]; const hasVoted = currentUserId ? post.upvotedBy.includes(currentUserId) : false; return (
        <div key={post.id} className="bg-white border border-[#f5ddc0] rounded-xl p-3.5 flex gap-3">
          <button type="button" onClick={() => onUpvote(post.id, post.upvotedBy)} className={`flex flex-col items-center gap-0.5 shrink-0 pt-0.5 transition ${hasVoted ? "text-violet-600" : "text-[#d4b896] hover:text-[#8b7560]"}`}><span className="text-base leading-none">▲</span><span className="text-[11px] font-bold tabular-nums">{post.upvotes}</span></button>
          <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-1 flex-wrap"><span className="text-[10px] font-bold text-[#8b7560]">{meta.icon} {meta.label}</span><span className="text-[10px] text-[#8b7560]">·</span><span className="text-[11px] font-medium text-[#5c4a38]">{post.authorName}</span><span className="text-[10px] text-[#8b7560] ml-auto">{new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div><p className="text-[13px] text-[#5c4a38] leading-relaxed">{post.body}</p></div>
        </div>
      ); })}
    </div>
  );
}

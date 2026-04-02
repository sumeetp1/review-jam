"use client";

import { useState } from "react";
import {
  collection, getDocs, addDoc, updateDoc, doc,
  increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiscussionType = "question" | "comparison" | "rant" | "tip";

export type DiscussionThread = {
  id: string;
  productId: string;
  authorId: string;
  authorName: string;
  type: DiscussionType;
  title: string;
  body: string;
  upvotes: number;
  upvotedBy: string[];
  replyCount: number;
  isPinned?: boolean;
  createdAt: string;
};

type Reply = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  upvotes: number;
  upvotedBy: string[];
  createdAt: string;
};

const TYPE_META: Record<DiscussionType, { icon: string; label: string; style: string }> = {
  question:   { icon: "❓", label: "Question",   style: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  comparison: { icon: "⚡", label: "Comparison", style: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  rant:       { icon: "😤", label: "Rant",        style: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" },
  tip:        { icon: "💡", label: "Tip",         style: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
};

// ─── Main feed ────────────────────────────────────────────────────────────────

type FeedProps = {
  threads: DiscussionThread[];
  productId: string;
  currentUserId?: string;
  currentUserName?: string;
  onUpvoteThread: (threadId: string, upvotedBy: string[]) => void;
  onNewThread: (thread: DiscussionThread) => void;
};

export default function DiscussionFeed({
  threads, productId, currentUserId, currentUserName,
  onUpvoteThread, onNewThread,
}: FeedProps) {
  const [showComposer, setShowComposer] = useState(false);
  const [newType, setNewType]           = useState<DiscussionType>("question");
  const [newTitle, setNewTitle]         = useState("");
  const [newBody, setNewBody]           = useState("");
  const [isPosting, setIsPosting]       = useState(false);

  async function handlePostThread() {
    if (!currentUserId || !newTitle.trim() || !newBody.trim()) return;
    setIsPosting(true);
    try {
      const data = {
        productId,
        authorId:   currentUserId,
        authorName: currentUserName ?? "Anonymous",
        type:       newType,
        title:      newTitle.trim(),
        body:       newBody.trim(),
        upvotes:    0,
        upvotedBy:  [],
        replyCount: 0,
        isPinned:   false,
        createdAt:  new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "discussions"), data);
      onNewThread({ id: ref.id, ...data });
      setNewTitle(""); setNewBody(""); setNewType("question"); setShowComposer(false);
    } catch (e) { console.error(e); }
    finally     { setIsPosting(false); }
  }

  return (
    <div className="space-y-3">
      {/* Composer */}
      {currentUserId && (
        showComposer ? (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">Start a thread</p>

            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(TYPE_META) as DiscussionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                    newType === t
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  {TYPE_META[t].icon} {TYPE_META[t].label}
                </button>
              ))}
            </div>

            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Thread title*"
              className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="What's on your mind?*"
              rows={4}
              className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePostThread}
                disabled={isPosting || !newTitle.trim() || !newBody.trim()}
                className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold py-2 rounded-lg disabled:opacity-50 transition hover:opacity-90"
              >
                {isPosting ? "Posting…" : "Post Thread"}
              </button>
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="px-4 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="w-full text-[13px] font-medium text-slate-600 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
          >
            + Ask a question or start a discussion
          </button>
        )
      )}

      {threads.length === 0 && !showComposer && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-500 py-10">
          No discussions yet.{currentUserId ? " Be the first to ask a question!" : " Sign in to start a thread."}
        </p>
      )}

      {/* Sort pinned first */}
      {[...threads]
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.upvotes - a.upvotes;
        })
        .map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onUpvote={onUpvoteThread}
          />
        ))}
    </div>
  );
}

// ─── Thread card ──────────────────────────────────────────────────────────────

function ThreadCard({
  thread, currentUserId, currentUserName, onUpvote,
}: {
  thread: DiscussionThread;
  currentUserId?: string;
  currentUserName?: string;
  onUpvote: (threadId: string, upvotedBy: string[]) => void;
}) {
  const [expanded, setExpanded]             = useState(false);
  const [replies, setReplies]               = useState<Reply[] | null>(null);
  const [isLoadingReplies, setIsLoading]    = useState(false);
  const [replyBody, setReplyBody]           = useState("");
  const [isPosting, setIsPosting]           = useState(false);

  async function loadReplies() {
    if (replies !== null) { setExpanded((v) => !v); return; }
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "discussions", thread.id, "replies"));
      const fetched = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Reply))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setReplies(fetched);
      setExpanded(true);
    } catch (e) { console.error(e); }
    finally     { setIsLoading(false); }
  }

  async function handleReply() {
    if (!currentUserId || !replyBody.trim()) return;
    setIsPosting(true);
    try {
      const r = {
        authorId:   currentUserId,
        authorName: currentUserName ?? "Anonymous",
        body:       replyBody.trim(),
        upvotes:    0,
        upvotedBy:  [],
        createdAt:  new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "discussions", thread.id, "replies"), r);
      await updateDoc(doc(db, "discussions", thread.id), { replyCount: increment(1) });
      setReplies((prev) => [...(prev ?? []), { id: ref.id, ...r }]);
      setReplyBody("");
    } catch (e) { console.error(e); }
    finally     { setIsPosting(false); }
  }

  async function handleUpvoteReply(replyId: string, upvotedBy: string[]) {
    if (!currentUserId) return;
    const has = upvotedBy.includes(currentUserId);
    setReplies((prev) =>
      prev?.map((r) =>
        r.id !== replyId ? r : {
          ...r,
          upvotes:   has ? Math.max(0, r.upvotes - 1) : r.upvotes + 1,
          upvotedBy: has ? r.upvotedBy.filter((x) => x !== currentUserId) : [...r.upvotedBy, currentUserId],
        }
      ) ?? prev
    );
    await updateDoc(doc(db, "discussions", thread.id, "replies", replyId), {
      upvotes:   increment(has ? -1 : 1),
      upvotedBy: has ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
    });
  }

  const meta      = TYPE_META[thread.type] ?? TYPE_META.question;
  const hasUpvoted = currentUserId ? thread.upvotedBy.includes(currentUserId) : false;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4">
        {thread.isPinned && (
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1.5">📌 Pinned</p>
        )}
        <div className="flex items-start gap-3">
          {/* Upvote column */}
          <button
            type="button"
            onClick={() => onUpvote(thread.id, thread.upvotedBy)}
            className={`flex flex-col items-center gap-0.5 shrink-0 pt-0.5 transition ${
              hasUpvoted ? "text-violet-600 dark:text-violet-400" : "text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
            }`}
          >
            <span className="text-[16px] leading-none">▲</span>
            <span className="text-[11px] font-bold tabular-nums leading-none">{thread.upvotes}</span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.style}`}>
                {meta.icon} {meta.label}
              </span>
            </div>
            <h4 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{thread.title}</h4>
            <p className="text-[13px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{thread.body}</p>
            <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-500 dark:text-slate-500 flex-wrap">
              <span className="font-medium text-slate-600 dark:text-slate-400">{thread.authorName}</span>
              <span>·</span>
              <span>{new Date(thread.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              <button
                type="button"
                onClick={loadReplies}
                className="ml-auto flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition"
              >
                {isLoadingReplies ? "Loading…" : (
                  <>💬 {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Replies ── */}
      {expanded && replies !== null && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {replies.length > 0 && (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {replies.map((reply) => {
                const hasUpvotedReply = currentUserId ? reply.upvotedBy.includes(currentUserId) : false;
                return (
                  <div key={reply.id} className="px-4 py-3 flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                      {reply.authorName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{reply.authorName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-600">
                          {new Date(reply.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{reply.body}</p>
                      <button
                        type="button"
                        onClick={() => handleUpvoteReply(reply.id, reply.upvotedBy)}
                        className={`mt-1 flex items-center gap-0.5 text-[11px] font-medium transition ${
                          hasUpvotedReply
                            ? "text-violet-600 dark:text-violet-400"
                            : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
                        }`}
                      >
                        ▲{reply.upvotes > 0 ? ` ${reply.upvotes}` : ""}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reply composer */}
          {currentUserId ? (
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 flex gap-2 border-t border-slate-100 dark:border-slate-800">
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); }
                }}
                placeholder="Write a reply…"
                className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <button
                type="button"
                onClick={handleReply}
                disabled={isPosting || !replyBody.trim()}
                className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-lg disabled:opacity-50 transition hover:opacity-90"
              >
                {isPosting ? "…" : "Reply"}
              </button>
            </div>
          ) : (
            <p className="px-4 py-3 text-[12px] text-slate-500 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
              Sign in to reply.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  collection, query, where, getDocs, addDoc,
  doc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import Avatar from "./Avatar";
import type { Comment } from "../../lib/types";

export default function CommentThread({
  reviewId,
  reviewerId,
  currentUserId,
  currentUserName,
}: {
  reviewId: string;
  reviewerId?: string;
  currentUserId?: string;
  currentUserName?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-load comments when thread mounts
  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadComments = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "reviewComments"),
        where("reviewId", "==", reviewId)
      );
      const snap = await getDocs(q);
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Comment))
        .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      setComments(sorted);
    } catch {
      // Firestore query failed; show empty state
    } finally {
      setLoaded(true);
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!currentUserId || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const commentData: Record<string, unknown> = {
        reviewId,
        userId: currentUserId,
        userName: currentUserName || "Anonymous",
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
        parentCommentId: replyingTo?.id ?? null,
        depth: replyingTo ? Math.min((comments.find((c) => c.id === replyingTo.id)?.depth ?? 0) + 1, 2) : 0,
      };
      const ref = await addDoc(collection(db, "reviewComments"), commentData);
      setComments((prev) => [...prev, { id: ref.id, ...commentData } as Comment]);
      await updateDoc(doc(db, "reviews", reviewId), { commentCount: increment(1) });
      if (reviewerId && reviewerId !== currentUserId) {
        addDoc(collection(db, "notifications"), {
          userId: reviewerId,
          type: "comment",
          title: "New comment on your review",
          body: `${currentUserName || "Someone"}: ${newComment.trim().slice(0, 80)}`,
          read: false,
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }
      setNewComment("");
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Build threaded view: top-level first, then children nested
  const topLevel = comments.filter((c) => !c.parentCommentId);
  const childrenOf = (parentId: string) => comments.filter((c) => c.parentCommentId === parentId);

  const renderComment = (c: Comment, depth: number) => (
    <div key={c.id} style={{ marginLeft: depth * 20 }}>
      <div className="flex gap-2">
        <Avatar name={c.userName} size="xs" />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300 mr-1">{c.userName}</span>
          <span className="text-[12px] text-slate-600 dark:text-slate-400">{c.content}</span>
          {currentUserId && depth < 2 && (
            <button
              type="button"
              onClick={() => setReplyingTo({ id: c.id, userName: c.userName })}
              className="ml-2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Reply
            </button>
          )}
        </div>
      </div>
      {childrenOf(c.id).map((child) => renderComment(child, depth + 1))}
    </div>
  );

  return (
    <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
      {loading ? (
        <p className="text-[12px] text-slate-400 dark:text-slate-500">Loading comments...</p>
      ) : (
        <div className="space-y-2">
          {comments.length === 0 && (
            <p className="text-[12px] text-slate-400 dark:text-slate-600">No comments yet.</p>
          )}
          {topLevel.map((c) => renderComment(c, 0))}

          {currentUserId && (
            <div className="pt-1">
              {replyingTo && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-slate-500">Replying to {replyingTo.userName}</span>
                  <button type="button" onClick={() => setReplyingTo(null)} className="text-[10px] text-slate-400 hover:text-slate-600">&#x2715;</button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitComment(); } }}
                  placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : "Add a comment..."}
                  className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 md:px-2.5 md:py-1.5 text-sm md:text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  className="px-3 py-2.5 md:px-2.5 md:py-1.5 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg text-sm md:text-[12px] font-medium disabled:opacity-40 hover:opacity-90 transition"
                >
                  {submitting ? "..." : "Post"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import type { DiscussionPost, QAAnswer } from "../../../lib/types";

export default function QAFeed({ productId, questions, qaAnswers, currentUserId, currentUserName, verifiedOwnerIds, onNewQuestion, onUpvoteQuestion, onSubmitAnswer, onUpvoteAnswer }: {
  productId: string; questions: DiscussionPost[]; qaAnswers: Map<string, QAAnswer[]>;
  currentUserId?: string; currentUserName?: string; verifiedOwnerIds: Set<string>;
  onNewQuestion: (post: DiscussionPost) => void; onUpvoteQuestion: (id: string, upvotedBy: string[]) => void;
  onSubmitAnswer: (questionId: string, body: string) => Promise<void>;
  onUpvoteAnswer: (answerId: string, questionId: string, upvotedBy: string[]) => void;
}) {
  const [composerOpen, setComposerOpen] = useState(false); const [questionBody, setQuestionBody] = useState(""); const [questionBusy, setQuestionBusy] = useState(false);
  const [expandedQs, setExpandedQs] = useState<Set<string>>(new Set()); const [answerBodies, setAnswerBodies] = useState<Record<string, string>>({});
  const [answerBusy, setAnswerBusy] = useState<Record<string, boolean>>({});
  const isVerified = currentUserId ? verifiedOwnerIds.has(currentUserId) : false;
  async function submitQuestion() {
    if (!currentUserId || !questionBody.trim()) return; setQuestionBusy(true);
    try { const data = { productId, authorId: currentUserId, authorName: currentUserName ?? "Anonymous", type: "question" as const, body: questionBody.trim(), upvotes: 0, upvotedBy: [], createdAt: new Date().toISOString() }; const ref = await addDoc(collection(db, "productDiscussions"), data); onNewQuestion({ id: ref.id, ...data }); setQuestionBody(""); setComposerOpen(false); } catch (e) { console.error(e); } finally { setQuestionBusy(false); }
  }
  function toggleQ(id: string) { setExpandedQs((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  async function submitAnswer(questionId: string) {
    const body = (answerBodies[questionId] ?? "").trim(); if (!currentUserId || !body) return;
    setAnswerBusy((p) => ({ ...p, [questionId]: true }));
    try { await onSubmitAnswer(questionId, body); setAnswerBodies((p) => ({ ...p, [questionId]: "" })); } catch (e) { console.error(e); } finally { setAnswerBusy((p) => ({ ...p, [questionId]: false })); }
  }
  const sorted = [...questions].sort((a, b) => b.upvotes - a.upvotes);
  return (
    <div className="space-y-3">
      {currentUserId && (composerOpen ? (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">❓ Ask a question</p>
          <textarea value={questionBody} onChange={(e) => setQuestionBody(e.target.value)} placeholder="e.g. How long does the battery last on a single charge?" rows={3} className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none" />
          <div className="flex gap-2"><button type="button" onClick={submitQuestion} disabled={questionBusy || !questionBody.trim()} className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition">{questionBusy ? "Posting…" : "Post Question"}</button><button type="button" onClick={() => setComposerOpen(false)} className="px-4 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">Cancel</button></div>
        </div>
      ) : <button type="button" onClick={() => setComposerOpen(true)} className="w-full text-[13px] font-medium text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition">❓ Ask a question</button>)}
      {sorted.length === 0 && !composerOpen && <div className="py-10 text-center text-slate-400 dark:text-slate-600 text-sm"><p className="text-2xl mb-1">❓</p>No questions yet.{currentUserId ? " Be the first to ask." : " Sign in to ask."}</div>}
      {sorted.map((q) => { const answers = qaAnswers.get(q.id) ?? []; const isExpanded = expandedQs.has(q.id); const hasVoted = currentUserId ? q.upvotedBy.includes(currentUserId) : false; return (
        <div key={q.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3.5 flex gap-3">
            <button type="button" onClick={() => onUpvoteQuestion(q.id, q.upvotedBy)} className={`flex flex-col items-center gap-0.5 shrink-0 pt-0.5 transition ${hasVoted ? "text-violet-600 dark:text-violet-400" : "text-slate-300 dark:text-slate-600 hover:text-slate-500"}`}><span className="text-base leading-none">▲</span><span className="text-[11px] font-bold tabular-nums">{q.upvotes}</span></button>
            <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-1 flex-wrap"><span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{q.authorName}</span><span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">{new Date(q.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div><p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{q.body}</p><button type="button" onClick={() => toggleQ(q.id)} className="mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">{isExpanded ? "▲ Hide" : `▼ ${answers.length} answer${answers.length !== 1 ? "s" : ""}`}</button></div>
          </div>
          {isExpanded && <div className="border-t border-slate-100 dark:border-slate-800">
            {answers.length === 0 && <p className="text-[12px] text-slate-400 dark:text-slate-600 px-4 py-3">No answers yet.</p>}
            {answers.sort((a, b) => b.upvotes - a.upvotes).map((ans) => { const ansVoted = currentUserId ? ans.upvotedBy.includes(currentUserId) : false; return (
              <div key={ans.id} className="flex gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                <button type="button" onClick={() => onUpvoteAnswer(ans.id, q.id, ans.upvotedBy)} className={`flex flex-col items-center gap-0.5 shrink-0 pt-0.5 transition ${ansVoted ? "text-violet-600 dark:text-violet-400" : "text-slate-300 dark:text-slate-600 hover:text-slate-500"}`}><span className="text-xs leading-none">▲</span><span className="text-[10px] font-bold tabular-nums">{ans.upvotes}</span></button>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-0.5 flex-wrap"><span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{ans.authorName}</span>{ans.isVerifiedOwner && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">✓ Verified Answer</span>}</div><p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{ans.body}</p></div>
              </div>
            ); })}
            {currentUserId && <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 space-y-2">{isVerified && <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">✓ You&apos;ll post as Verified Owner</p>}<textarea value={answerBodies[q.id] ?? ""} onChange={(e) => setAnswerBodies((p) => ({ ...p, [q.id]: e.target.value }))} placeholder="Write your answer…" rows={2} className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-slate-300 dark:text-slate-100 dark:placeholder-slate-500 resize-none" /><button type="button" onClick={() => submitAnswer(q.id)} disabled={answerBusy[q.id] || !(answerBodies[q.id] ?? "").trim()} className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[12px] font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-90 transition">{answerBusy[q.id] ? "Posting…" : "Post Answer"}</button></div>}
          </div>}
        </div>
      ); })}
    </div>
  );
}

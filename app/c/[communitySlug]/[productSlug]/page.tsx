"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  collection, query, where, getDocs, doc, getDoc,
  updateDoc, increment, arrayUnion, arrayRemove, addDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth, storage } from "../../../../lib/firebase";
import { updateUserBadges } from "../../../../lib/badges";
import ReviewWizard, { ReviewFormData, type ProductVariant } from "../../../components/ReviewWizard";
import ReviewCard from "../../../components/ReviewCard";
import VersionUpdateWizard from "../../../components/VersionUpdateWizard";

const ADMIN_EMAIL = "sumit.pandey75@gmail.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscussionPost = {
  id: string; authorId: string; authorName: string;
  type: "question" | "tip" | "issue" | "general";
  body: string; upvotes: number; upvotedBy: string[]; createdAt: string;
};

type QAAnswer = {
  id: string; questionId: string; productId: string;
  authorId: string; authorName: string; body: string;
  isVerifiedOwner: boolean; upvotes: number; upvotedBy: string[]; createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topItems(reviews: any[], field: "pros" | "cons", n: number) {
  const counts = new Map<string, number>();
  for (const r of reviews) for (const item of (r[field] ?? [])) {
    if (item?.trim()) counts.set(item.trim(), (counts.get(item.trim()) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([text, count]) => ({ text, count }));
}

function scoreColor(score: number) {
  if (score >= 70) return { ring: "#10b981", text: "#059669", bg: "#d1fae5" };
  if (score >= 40) return { ring: "#f59e0b", text: "#d97706", bg: "#fef3c7" };
  return { ring: "#ef4444", text: "#dc2626", bg: "#fee2e2" };
}

function HealthRing({ score }: { score: number }) {
  const r = 36; const circ = 2 * Math.PI * r; const fill = circ * (score / 100); const col = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" className="dark:[stroke:#334155]" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={col.ring} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`} style={{ transition: "stroke-dasharray .6s ease" }} />
        <text x="46" y="46" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="800"
          fill={col.text} className="rotate-90" style={{ transformOrigin: "46px 46px" }}>{score}</text>
      </svg>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: col.text }}>Neutral Score</span>
    </div>
  );
}

const POST_TYPES = [
  { key: "question", icon: "❓", label: "Question" },
  { key: "tip", icon: "💡", label: "Tip" },
  { key: "issue", icon: "⚠️", label: "Issue" },
  { key: "general", icon: "💬", label: "General" },
] as const;

function DiscussionFeed({ productId, posts, currentUserId, currentUserName, onUpvote, onNewPost }: {
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

function QAFeed({ productId, questions, qaAnswers, currentUserId, currentUserName, verifiedOwnerIds, onNewQuestion, onUpvoteQuestion, onSubmitAnswer, onUpvoteAnswer }: {
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

function OwnershipJourneyCard({ reviews, currentUserId, currentUserName, onLike, onHelpful, onNotHelpful, onNewEntry }: {
  reviews: any[]; currentUserId?: string; currentUserName?: string;
  onLike: (id: string, likedBy: string[]) => void; onHelpful: (id: string, helpfulBy: string[]) => void;
  onNotHelpful: (id: string, notHelpfulBy: string[]) => void;
  onNewEntry?: (review: any) => void;
}) {
  const primary = [...reviews].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))[0];
  const isJourney = (primary.versionCount ?? 1) > 1;
  const isOwner = currentUserId && currentUserId === primary.reviewerId;
  return (
    <div className={isJourney ? "border border-violet-200 dark:border-violet-800/50 rounded-xl overflow-hidden" : ""}>
      {isJourney && <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-200 dark:border-violet-800/50"><span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">📋 Ownership Journey</span><span className="text-[10px] text-violet-500 dark:text-violet-500 ml-auto">{primary.versionCount} updates · {primary.latestVersionLabel ?? ""}</span></div>}
      <ReviewCard review={primary} currentUserId={currentUserId} currentUserName={currentUserName} onLike={onLike} onHelpful={onHelpful} onNotHelpful={onNotHelpful} showPoolLink={false} />
      {isOwner && onNewEntry && (
        <div className="flex items-center gap-2 px-3 pb-3">
          <button type="button" onClick={() => onNewEntry(primary)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30">+ New Entry</button>
        </div>
      )}
    </div>
  );
}

// ─── Community Hashtag Manager (admin only) ────────────────────────────────────

function CommunityTagManager({ product, currentUserEmail, onTagsUpdated }: {
  product: any; currentUserEmail?: string | null; onTagsUpdated: (tags: string[]) => void;
}) {
  const isAdmin = currentUserEmail === ADMIN_EMAIL;
  const [tags, setTags] = useState<string[]>(product.communityTags ?? []);
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  async function addTag() {
    const t = newTag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "");
    if (!t || tags.includes(t)) { setNewTag(""); return; }
    setBusy(true);
    try {
      await updateDoc(doc(db, "products", product.id), { communityTags: arrayUnion(t) });
      const updated = [...tags, t];
      setTags(updated);
      onTagsUpdated(updated);
      setNewTag("");
    } catch (e) { console.error(e); }
    setBusy(false);
  }

  async function removeTag(t: string) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "products", product.id), { communityTags: arrayRemove(t) });
      const updated = tags.filter((x) => x !== t);
      setTags(updated);
      onTagsUpdated(updated);
    } catch (e) { console.error(e); }
    setBusy(false);
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800/50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">⚡ Admin — Community Tags</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-[11px] font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-2 py-0.5 rounded-full">
          #{product.communitySlug} <span className="opacity-60 font-normal">home</span>
        </span>
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 px-2 py-0.5 rounded-full">
            #{t}
            <button type="button" onClick={() => removeTag(t)} disabled={busy} className="text-indigo-400 hover:text-red-500 transition leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          placeholder="community-slug"
          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-indigo-400 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <button type="button" onClick={addTag} disabled={busy || !newTag.trim()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-lg disabled:opacity-50 transition">
          + Tag
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FeedTab = "logs" | "qa" | "discussion";

export default function ProductHubPage({ params }: { params: Promise<{ communitySlug: string; productSlug: string }> }) {
  const { communitySlug, productSlug } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionPost[]>([]);
  const [qaAnswers, setQaAnswers] = useState<Map<string, QAAnswer[]>>(new Map());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [feedTab, setFeedTab] = useState<FeedTab>("logs");
  const [reviewMode, setReviewMode] = useState<"campaign" | "verified" | "generic" | null>(null);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState("all");
  const [updatingReview, setUpdatingReview] = useState<any | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || reviews.length === 0) return;
    setHasAlreadyReviewed(reviews.some((r) => r.reviewerId === user.uid));
  }, [user, reviews]);

  useEffect(() => {
    async function load() {
      try {
        // Look up product by communitySlug + slug
        const prodSnap = await getDocs(
          query(collection(db, "products"),
            where("communitySlug", "==", communitySlug),
            where("slug", "==", productSlug))
        );
        if (prodSnap.empty) { setIsLoading(false); return; }
        const prodDoc = prodSnap.docs[0];
        const productId = prodDoc.id;
        const productData = { id: productId, ...prodDoc.data() };
        setProduct(productData);

        const [variantSnap, reviewsSnap] = await Promise.all([
          getDocs(collection(db, "products", productId, "productVariants")),
          getDocs(query(collection(db, "reviews"), where("productId", "==", productId))),
        ]);
        setVariants(variantSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string })));
        const fetched: any[] = [];
        reviewsSnap.forEach((d) => fetched.push({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        setReviews(fetched);

        try {
          const discSnap = await getDocs(query(collection(db, "productDiscussions"), where("productId", "==", productId)));
          setDiscussions(discSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DiscussionPost)).sort((a, b) => b.upvotes - a.upvotes));
        } catch { /* index not ready */ }

        try {
          const answersSnap = await getDocs(query(collection(db, "productDiscussionAnswers"), where("productId", "==", productId)));
          const map = new Map<string, QAAnswer[]>();
          answersSnap.docs.forEach((d) => {
            const a = { id: d.id, ...d.data() } as QAAnswer;
            const arr = map.get(a.questionId) ?? []; arr.push(a); map.set(a.questionId, arr);
          });
          setQaAnswers(map);
        } catch { /* index not ready */ }
      } catch (err) { console.error(err); }
      setIsLoading(false);
    }
    load();
  }, [communitySlug, productSlug]);

  const filteredReviews = selectedVariantId === "all" ? reviews : reviews.filter((r) => r.variantId === selectedVariantId);
  const displayedReviews = verifiedOnly ? filteredReviews.filter((r) => r.isVerifiedPurchase === true) : filteredReviews;
  const avgRating = displayedReviews.length > 0 ? displayedReviews.reduce((s, r) => s + (r.rating || 0), 0) / displayedReviews.length : 0;
  const avgHealthScore = displayedReviews.length > 0 ? Math.round(displayedReviews.reduce((s, r) => s + (r.healthScore || 0), 0) / displayedReviews.length) : 0;
  const topPros = topItems(displayedReviews, "pros", 5);
  const topCons = topItems(displayedReviews, "cons", 5);

  const journeyMap = new Map<string, any[]>();
  for (const r of displayedReviews) { const key = r.reviewerId ?? r.id; if (!journeyMap.has(key)) journeyMap.set(key, []); journeyMap.get(key)!.push(r); }
  const journeys = Array.from(journeyMap.values()).sort((a, b) => (b[0].likesCount || 0) - (a[0].likesCount || 0));

  const verifiedOwnerIds = new Set<string>(reviews.filter((r) => r.isVerifiedPurchase === true && r.reviewerId).map((r) => r.reviewerId as string));
  const qaQuestions = discussions.filter((d) => d.type === "question");
  const generalDiscussions = discussions.filter((d) => d.type !== "question");

  const handleReviewSubmit = async (data: ReviewFormData) => {
    if (!user || !product) throw new Error("Missing user or product.");
    if (hasAlreadyReviewed) throw new Error("You have already submitted a review for this product.");
    const mediaUrls: string[] = [];
    if (data.mediaFiles.length > 0) {
      try { for (const file of data.mediaFiles) { const fileRef = storageRef(storage, `reviews/${user.uid}/${Date.now()}_${file.name}`); await uploadBytes(fileRef, file); mediaUrls.push(await getDownloadURL(fileRef)); } } catch { /* best-effort */ }
    }
    let marketingQuote = data.summary || "";
    if (data.reviewType !== "generic") {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewContent: data.content, reviewerName: user.displayName, pros: data.pros, cons: data.cons, summary: data.summary }) });
      const agentData = await res.json();
      if (!res.ok || !agentData?.success || !agentData?.analysis) throw new Error(typeof agentData?.error === "string" && agentData.error.trim() ? agentData.error : "Unable to validate review right now.");
      if (agentData.analysis.isGenuine !== true) throw new Error(`AI Quality Control: ${agentData.analysis.reason || "Review quality check failed."}`);
      marketingQuote = agentData.analysis?.marketingQuote || data.summary || "";
    }
    const newReview: any = {
      content: data.content, rating: data.overallRating,
      reviewerId: user.uid, reviewerName: user.displayName,
      productId: product.id, productName: product.name, category: product.category,
      productSlug, communitySlug,
      campaignId: product.campaignId || "default",
      likesCount: 0, likedBy: [], helpfulCount: 0, helpfulBy: [],
      notHelpfulCount: 0, notHelpfulBy: [], commentCount: 0,
      marketingQuote, pros: data.pros, cons: data.cons, summary: data.summary,
      productSource: data.productSource, usageDuration: data.usageDuration,
      purchaseChannel: data.purchaseChannel, subRatings: data.subRatings,
      bestFor: data.bestFor, mediaUrls, reviewType: data.reviewType,
      productCode: data.productCode ?? null,
      isCampaignReview: data.reviewType === "campaign",
      eligibleForPayout: data.reviewType !== "generic",
      isVerifiedPurchase: data.isVerifiedPurchase ?? false,
      variantId: data.variantId ?? null, variantName: data.variantName ?? null,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, "reviews"), newReview);
    setReviews((prev) => [{ id: docRef.id, ...newReview }, ...prev]);
    setHasAlreadyReviewed(true);
    if (data.reviewType !== "generic") updateUserBadges(user.uid).catch(() => {});
  };

  const makeUpdater = (field: string, field2: string) => async (reviewId: string, byArr: string[] = []) => {
    if (!user) return;
    const has = byArr.includes(user.uid);
    setReviews((cur) => cur.map((r) => r.id !== reviewId ? r : { ...r, [field]: Math.max(0, (r[field] || 0) + (has ? -1 : 1)), [field2]: has ? (r[field2] || []).filter((x: string) => x !== user.uid) : [...(r[field2] || []), user.uid] }));
    await updateDoc(doc(db, "reviews", reviewId), { [field]: increment(has ? -1 : 1), [field2]: has ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  };
  const handleLike = makeUpdater("likesCount", "likedBy");
  const handleHelpful = makeUpdater("helpfulCount", "helpfulBy");
  const handleNotHelpful = makeUpdater("notHelpfulCount", "notHelpfulBy");

  const handleUpvotePost = async (postId: string, upvotedBy: string[]) => {
    if (!user) return;
    const has = upvotedBy.includes(user.uid);
    setDiscussions((cur) => cur.map((p) => p.id !== postId ? p : { ...p, upvotes: has ? Math.max(0, p.upvotes - 1) : p.upvotes + 1, upvotedBy: has ? p.upvotedBy.filter((x) => x !== user.uid) : [...p.upvotedBy, user.uid] }));
    await updateDoc(doc(db, "productDiscussions", postId), { upvotes: increment(has ? -1 : 1), upvotedBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  };

  const handleSubmitAnswer = async (questionId: string, body: string) => {
    if (!user || !product) return;
    const isVerifiedOwner = verifiedOwnerIds.has(user.uid);
    const data: Omit<QAAnswer, "id"> = { questionId, productId: product.id, authorId: user.uid, authorName: user.displayName ?? "Anonymous", body, isVerifiedOwner, upvotes: 0, upvotedBy: [], createdAt: new Date().toISOString() };
    const ref = await addDoc(collection(db, "productDiscussionAnswers"), data);
    const newAnswer: QAAnswer = { id: ref.id, ...data };
    setQaAnswers((prev) => { const next = new Map(prev); const arr = next.get(questionId) ?? []; next.set(questionId, [newAnswer, ...arr]); return next; });
  };

  const handleUpvoteAnswer = async (answerId: string, questionId: string, upvotedBy: string[]) => {
    if (!user) return;
    const has = upvotedBy.includes(user.uid);
    setQaAnswers((prev) => { const next = new Map(prev); const arr = (next.get(questionId) ?? []).map((a) => a.id !== answerId ? a : { ...a, upvotes: has ? Math.max(0, a.upvotes - 1) : a.upvotes + 1, upvotedBy: has ? a.upvotedBy.filter((x) => x !== user.uid) : [...a.upvotedBy, user.uid] }); next.set(questionId, arr); return next; });
    await updateDoc(doc(db, "productDiscussionAnswers", answerId), { upvotes: increment(has ? -1 : 1), upvotedBy: has ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  };

  if (isLoading) return <div className="min-h-[40vh] flex items-center justify-center text-sm text-slate-500 dark:text-slate-500 bg-white dark:bg-slate-950">Loading…</div>;
  if (!product) return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center gap-3 px-4">
      <p className="text-slate-500 dark:text-slate-400">Product not found</p>
      <button type="button" onClick={() => router.push(`/c/${communitySlug}`)} className="text-sm text-slate-600 dark:text-slate-300 underline">← Back to community</button>
    </div>
  );

  const currentUserId = user?.uid;
  const currentUserName = user?.displayName ?? undefined;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Review Wizard */}
      {reviewMode && user && (
        <ReviewWizard user={user} mode={reviewMode} productInfo={{ name: product.name, category: product.category, variants }} isCampaignReview={reviewMode === "campaign"} onSubmit={handleReviewSubmit} onClose={() => setReviewMode(null)} />
      )}

      {/* Version Update Wizard */}
      {updatingReview && user && (
        <VersionUpdateWizard reviewId={updatingReview.id} existingVersionCount={updatingReview.versionCount ?? 1} productName={updatingReview.productName ?? ""} category={updatingReview.category ?? ""} onSaved={() => { const reviewId = updatingReview.id; setReviews((prev) => prev.map((r) => r.id !== reviewId ? r : { ...r, versionCount: (r.versionCount ?? 1) + 1, createdAt: new Date().toISOString() })); setUpdatingReview(null); }} onClose={() => setUpdatingReview(null)} />
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="shrink-0">
            <Image src="/logo.svg" alt="Review Jam" width={100} height={24} className="dark:hidden" />
            <Image src="/logo-dark.svg" alt="Review Jam" width={100} height={24} className="hidden dark:block" />
          </Link>
          <Link href={`/c/${communitySlug}`} className="text-sm text-slate-500 dark:text-slate-400 hover:underline ml-2 flex items-center gap-1">
            ← <span className="font-mono text-[12px]">rj/{communitySlug}</span>
          </Link>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-4">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest mb-0.5">{product.category}</p>
          <div className="flex items-start gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">{product.name}</h1>
            {product.communitySeeded && !reviews.some((r: any) => r.isVerifiedPurchase === true) && (
              <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 px-2 py-1 rounded-full">🌱 Community Seeded</span>
            )}
            {product.communitySeeded && reviews.some((r: any) => r.isVerifiedPurchase === true) && (
              <span className="mt-0.5 shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-full">✅ Verified</span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-500">{product.brandName}</p>

          {/* Community tags row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Link href={`/c/${communitySlug}`} className="text-[11px] font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-2 py-0.5 rounded-full hover:opacity-80 transition">
              #{communitySlug}
            </Link>
            {(product.communityTags ?? []).map((tag: string) => (
              <Link key={tag} href={`/c/${tag}`} className="text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 px-2 py-0.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition">
                #{tag}
              </Link>
            ))}
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">rj/{communitySlug}/{productSlug}</span>
          </div>
        </div>
      </div>

      {/* Two-column hub */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex flex-col md:flex-row gap-5">

          {/* LEFT COLUMN */}
          <div className="md:w-2/5 space-y-4 shrink-0">

            {/* Health + rating */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center gap-4">
                {avgHealthScore > 0 ? <HealthRing score={avgHealthScore} /> : <div className="w-[92px] h-[92px] rounded-full border-4 border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0"><span className="text-[11px] text-slate-400 text-center leading-tight">No<br/>data</span></div>}
                <div className="flex-1 min-w-0">
                  {avgRating > 0 && <div className="flex items-center gap-1 mb-1">{[1,2,3,4,5].map((n) => <span key={n} className={`text-base ${n <= Math.round(avgRating) ? "text-amber-400" : "text-slate-200 dark:text-slate-700"}`}>★</span>)}<span className="text-sm font-semibold text-slate-900 dark:text-slate-100 ml-1">{avgRating.toFixed(1)}</span></div>}
                  <p className="text-[12px] text-slate-500 dark:text-slate-500">{displayedReviews.length} review{displayedReviews.length !== 1 ? "s" : ""}{verifiedOnly && <span className="ml-1 text-emerald-600 dark:text-emerald-400">· verified</span>}</p>
                  <span className="inline-block mt-1.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">Active pool</span>
                </div>
              </div>
              <button type="button" onClick={() => setVerifiedOnly((v) => !v)} className={`mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition ${verifiedOnly ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700" : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}><span>{verifiedOnly ? "✓" : "○"}</span>{verifiedOnly ? "Showing verified owners only" : "Show verified owners only"}</button>
            </div>

            {/* Pros / Cons */}
            {(topPros.length > 0 || topCons.length > 0) && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Community Summary</p>
                {topPros.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-500 mb-1.5">✓ Loved for</p><div className="space-y-1.5">{topPros.map((p, i) => <div key={i} className="flex items-center gap-2"><div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (p.count / (topPros[0]?.count || 1)) * 100)}%` }} /></div><span className="text-[12px] text-slate-700 dark:text-slate-300 min-w-0 flex-shrink-0 max-w-[65%] truncate text-right">{p.text}</span><span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold shrink-0">×{p.count}</span></div>)}</div></div>}
                {topPros.length > 0 && topCons.length > 0 && <div className="border-t border-slate-100 dark:border-slate-800" />}
                {topCons.length > 0 && <div><p className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-500 mb-1.5">⚠ Common issues</p><div className="space-y-1.5">{topCons.map((c, i) => <div key={i} className="flex items-center gap-2"><div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-red-400 dark:bg-red-500 rounded-full" style={{ width: `${Math.min(100, (c.count / (topCons[0]?.count || 1)) * 100)}%` }} /></div><span className="text-[12px] text-slate-700 dark:text-slate-300 min-w-0 flex-shrink-0 max-w-[65%] truncate text-right">{c.text}</span><span className="text-[10px] text-red-600 dark:text-red-500 font-bold shrink-0">×{c.count}</span></div>)}</div></div>}
              </div>
            )}

            {/* Variants */}
            {variants.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-2.5">Variants & SKUs</p>
                <div className="space-y-1.5">
                  <button type="button" onClick={() => setSelectedVariantId("all")} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border transition ${selectedVariantId === "all" ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100" : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}><span>All variants</span><span className="opacity-60">{reviews.length}</span></button>
                  {variants.map((v) => { const vc = reviews.filter((r) => r.variantId === v.id).length; const vavg = vc > 0 ? (reviews.filter((r) => r.variantId === v.id).reduce((s, r) => s + (r.rating || 0), 0) / vc).toFixed(1) : null; const sel = selectedVariantId === v.id; return <button key={v.id} type="button" onClick={() => setSelectedVariantId(v.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium border transition ${sel ? "bg-violet-600 text-white border-violet-600" : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}><span className="truncate">{v.name}</span><span className="flex items-center gap-1.5 shrink-0 ml-2">{vavg && <span className={sel ? "text-amber-200" : "text-amber-500"}>★ {vavg}</span>}<span className="opacity-60">({vc})</span></span></button>; })}
                </div>
              </div>
            )}

            {/* Write review CTA */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-3">Own this product?</p>
              {!user ? <p className="text-sm text-slate-500 dark:text-slate-500 text-center py-1">Sign in to post a review.</p>
              : hasAlreadyReviewed ? <p className="text-[12px] text-slate-500 dark:text-slate-500 text-center py-1">✓ You&apos;ve reviewed this. Use &quot;+ New Entry&quot; on your review to add updates.</p>
              : <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setReviewMode("verified")} className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[12px] font-semibold py-2.5 rounded-lg hover:opacity-90 transition">I own this</button>
                    <button type="button" onClick={() => setReviewMode("campaign")} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold py-2.5 rounded-lg transition">Sponsored</button>
                  </div>
                  <button type="button" onClick={() => setReviewMode("generic")} className="w-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[12px] py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition">Quick review (no payout)</button>
                  <p className="text-[10px] text-slate-400 text-center">Verified &amp; sponsored reviews earn from the pool.</p>
                </div>
              }
            </div>

            {/* Admin: community hashtags */}
            <CommunityTagManager product={product} currentUserEmail={user?.email} onTagsUpdated={(tags) => setProduct((p: any) => ({ ...p, communityTags: tags }))} />
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex-1 min-w-0">
            {/* Feed tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-4 bg-white dark:bg-slate-900 rounded-t-xl overflow-hidden border border-b-0">
              {([{ id: "logs", label: "📋 Owner Logs", count: journeys.length }, { id: "qa", label: "❓ Ask an Owner", count: qaQuestions.length }, { id: "discussion", label: "💬 Discussion", count: generalDiscussions.length }] as { id: FeedTab; label: string; count: number }[]).map((tab) => (
                <button key={tab.id} type="button" onClick={() => setFeedTab(tab.id)} className={`flex-1 px-3 py-3 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition border-b-2 -mb-px ${feedTab === tab.id ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900" : "border-transparent text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                  {tab.label}
                  {tab.count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${feedTab === tab.id ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>{tab.count}</span>}
                </button>
              ))}
            </div>

            {feedTab === "logs" && <div className="space-y-4">{journeys.length === 0 ? <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 py-14 text-center"><p className="text-2xl mb-2">📋</p><p className="text-sm text-slate-500 dark:text-slate-500">No owner logs yet.</p>{user && !hasAlreadyReviewed && <button type="button" onClick={() => setReviewMode("verified")} className="mt-3 text-[12px] font-semibold text-violet-600 dark:text-violet-400 hover:underline">Start your ownership log →</button>}</div> : journeys.map((group, i) => <OwnershipJourneyCard key={group[0].id ?? i} reviews={group} currentUserId={currentUserId} currentUserName={currentUserName} onLike={handleLike} onHelpful={handleHelpful} onNotHelpful={handleNotHelpful} onNewEntry={(review) => setUpdatingReview(review)} />)}</div>}

            {feedTab === "qa" && <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"><QAFeed productId={product.id} questions={qaQuestions} qaAnswers={qaAnswers} currentUserId={currentUserId} currentUserName={currentUserName} verifiedOwnerIds={verifiedOwnerIds} onNewQuestion={(post) => setDiscussions((prev) => [post, ...prev])} onUpvoteQuestion={handleUpvotePost} onSubmitAnswer={handleSubmitAnswer} onUpvoteAnswer={handleUpvoteAnswer} /></div>}

            {feedTab === "discussion" && <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"><DiscussionFeed productId={product.id} posts={generalDiscussions} currentUserId={currentUserId} currentUserName={currentUserName} onUpvote={handleUpvotePost} onNewPost={(p) => setDiscussions((prev) => [p, ...prev])} /></div>}
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { collection, query, where, getDocs, addDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AVAILABLE_CATEGORIES } from "./ReviewWizard";

type Props = {
  userId: string;
  userName: string;
  onClose: () => void;
  onCreated?: (slug: string) => void;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default function CreateChannelModal({ userId, userName, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(AVAILABLE_CATEGORIES[0]);
  const [iconEmoji, setIconEmoji] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(slugify(val));
  };

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) { setError("Please enter a channel name."); return; }
    if (!slug.trim()) { setError("Please enter a valid slug."); return; }
    if (description.trim().length < 10) { setError("Description must be at least 10 characters."); return; }

    setSubmitting(true);
    try {
      // Check slug uniqueness
      const existing = await getDocs(query(collection(db, "channels"), where("slug", "==", slug)));
      if (!existing.empty) {
        setError(`Channel "r/${slug}" already exists. Choose a different name.`);
        setSubmitting(false);
        return;
      }

      const channelRef = await addDoc(collection(db, "channels"), {
        name: name.trim(),
        slug,
        description: description.trim(),
        category,
        creatorId: userId,
        creatorName: userName,
        memberCount: 1,
        reviewCount: 0,
        iconEmoji: iconEmoji || "📦",
        createdAt: new Date().toISOString(),
        isOfficial: false,
      });

      // Add creator as first member
      await addDoc(collection(db, "channelMembers"), {
        channelId: channelRef.id,
        userId,
        joinedAt: new Date().toISOString(),
      });

      onCreated?.(slug);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-start px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create a Channel</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-sm">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Channel name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Smartphones"
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Slug <span className="text-slate-400 font-normal">r/{slug || "..."}</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this channel about?"
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 dark:text-slate-100 resize-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-slate-100"
            >
              {AVAILABLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Icon emoji (optional)</label>
            <input
              type="text"
              value={iconEmoji}
              onChange={(e) => setIconEmoji(e.target.value.slice(0, 2))}
              placeholder="📦"
              className="w-20 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {error && <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            {submitting ? "Creating..." : "Create Channel"}
          </button>
        </div>
      </div>
    </div>
  );
}

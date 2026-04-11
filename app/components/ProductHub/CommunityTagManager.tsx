"use client";

import { useState } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { ADMIN_EMAIL } from "../../../lib/constants";

export default function CommunityTagManager({ product, currentUserEmail, onTagsUpdated }: {
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
    <div className="bg-white rounded-xl border border-[#ffab91] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#e65100] mb-2">⚡ Admin — Community Tags</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-[11px] font-semibold bg-[#4a3828] text-white px-2 py-0.5 rounded-full">
          #{product.communitySlug} <span className="opacity-60 font-normal">home</span>
        </span>
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#fff0e6] text-[#e65100] border border-[#ffab91] px-2 py-0.5 rounded-full">
            #{t}
            <button type="button" onClick={() => removeTag(t)} disabled={busy} className="text-[#ff8a65] hover:text-[#ef5350] transition leading-none">×</button>
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
          className="flex-1 bg-[#ffecd2] border border-[#f5ddc0] rounded-lg px-3 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-[#ff8a65] text-[#4a3828] placeholder:text-[#b89878]"
        />
        <button type="button" onClick={addTag} disabled={busy || !newTag.trim()} className="px-3 py-1.5 bg-[#e65100] hover:bg-[#e65100]/90 text-white text-[12px] font-semibold rounded-lg disabled:opacity-50 transition">
          + Tag
        </button>
      </div>
    </div>
  );
}

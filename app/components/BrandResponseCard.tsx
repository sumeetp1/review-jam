"use client";

import { useState } from "react";

type Props = {
  brandResponse: {
    body: string;
    respondedBy: string;
    respondedAt: string;
    editedAt?: string;
  };
  productId: string;
  brandEmail?: string;
  currentUserEmail?: string;
  reviewId: string;
  onEdit?: (reviewId: string, newBody: string) => void;
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear}y ago`;
}

export default function BrandResponseCard({
  brandResponse,
  productId,
  brandEmail,
  currentUserEmail,
  reviewId,
  onEdit,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(brandResponse.body);
  const [isSaving, setIsSaving] = useState(false);
  const [displayBody, setDisplayBody] = useState(brandResponse.body);
  const [editedAt, setEditedAt] = useState(brandResponse.editedAt);

  const isBrandOwner =
    currentUserEmail && brandEmail && currentUserEmail.toLowerCase() === brandEmail.toLowerCase();

  async function handleSave() {
    if (!editBody.trim() || editBody.trim() === displayBody) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/brand-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          reviewId,
          productId,
          brandEmail,
          body: editBody.trim(),
        }),
      });

      if (res.ok) {
        setDisplayBody(editBody.trim());
        setEditedAt(new Date().toISOString());
        setIsEditing(false);
        onEdit?.(reviewId, editBody.trim());
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="ml-0 md:ml-12 mt-3 pl-4 border-l-2 border-[#e04c8a]/50">
      <div className="bg-[#231e2e] rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-semibold bg-[#1c1826] text-[#e04c8a] px-2 py-0.5 rounded-full">
            Official Response
          </span>
          <span className="text-[11px] text-[#8b839e]">
            {timeAgo(brandResponse.respondedAt)}
            {editedAt && " \u00b7 edited"}
          </span>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className="w-full bg-[#1c1826] border border-[#2a2535] rounded-lg p-2.5 text-[13px] text-[#cbc5d9] outline-none focus:border-[#f472b6] transition resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !editBody.trim()}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#e04c8a] hover:bg-[#e04c8a]/90 disabled:bg-[#1c1826] disabled:text-[#8b839e] text-white transition"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditBody(displayBody);
                  setIsEditing(false);
                }}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg text-[#8b839e] hover:text-[#cbc5d9] hover:bg-[#231e2e] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-[#cbc5d9] leading-relaxed whitespace-pre-wrap">
              {displayBody}
            </p>
            {isBrandOwner && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="mt-2 text-[11px] font-medium text-[#e04c8a] hover:text-[#f472b6] transition-colors"
              >
                Edit
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

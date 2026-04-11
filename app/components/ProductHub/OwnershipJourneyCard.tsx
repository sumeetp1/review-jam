"use client";

import ReviewCard from "../ReviewCard";

export default function OwnershipJourneyCard({ reviews, currentUserId, currentUserName, onLike, onHelpful, onNotHelpful, onNewEntry }: {
  reviews: any[]; currentUserId?: string; currentUserName?: string;
  onLike: (id: string, likedBy: string[]) => void; onHelpful: (id: string, helpfulBy: string[]) => void;
  onNotHelpful: (id: string, notHelpfulBy: string[]) => void;
  onNewEntry?: (review: any) => void;
}) {
  const primary = [...reviews].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))[0];
  const isJourney = (primary.versionCount ?? 1) > 1;
  const isOwner = currentUserId && currentUserId === primary.reviewerId;
  return (
    <div className={isJourney ? "border border-violet-800 rounded-xl overflow-hidden" : ""}>
      {isJourney && <div className="flex items-center gap-2 px-4 py-2 bg-violet-950/30 border-b border-violet-800"><span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">📋 Ownership Journey</span><span className="text-[10px] text-violet-400 ml-auto">{primary.versionCount} updates · {primary.latestVersionLabel ?? ""}</span></div>}
      <ReviewCard review={primary} currentUserId={currentUserId} currentUserName={currentUserName} onLike={onLike} onHelpful={onHelpful} onNotHelpful={onNotHelpful} showPoolLink={false} />
      {isOwner && onNewEntry && (
        <div className="flex items-center gap-2 px-3 pb-3">
          <button type="button" onClick={() => onNewEntry(primary)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition text-violet-400 border-violet-300 hover:bg-violet-950/30">+ New Entry</button>
        </div>
      )}
    </div>
  );
}

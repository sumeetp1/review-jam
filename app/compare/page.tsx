"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../lib/hooks/useAuth";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../lib/firebase";
import Avatar from "../components/Avatar";

const platforms = [
  {
    name: "Review Jam",
    highlight: true,
    description: "Engagement-weighted review marketplace with transparent quality scoring",
    features: {
      incentiveModel: { value: "Engagement-based payouts", score: "best" },
      qualityScoring: { value: "Health Score (0-100)", score: "best" },
      biasDetection: { value: "AI + algorithmic penalty", score: "best" },
      purchaseVerification: { value: "Receipt OCR", score: "best" },
      reviewEvolution: { value: "Ownership Journey (1mo-1yr)", score: "best" },
      communityFeatures: { value: "Category communities + tags", score: "best" },
      brandTools: { value: "Bounty pools + widgets + analytics", score: "best" },
      coldStartSolution: { value: "Bounty-funded trusted reviews", score: "best" },
      transparentScoring: { value: "Full breakdown visible", score: "best" },
      reviewerReputation: { value: "Trust tiers + badges", score: "best" },
    },
  },
  {
    name: "Amazon Reviews",
    highlight: false,
    description: "Marketplace-native reviews tied to Amazon purchases",
    features: {
      incentiveModel: { value: "None", score: "bad" },
      qualityScoring: { value: "Star rating only", score: "bad" },
      biasDetection: { value: "Basic automated filters", score: "mid" },
      purchaseVerification: { value: "Order-linked badge", score: "good" },
      reviewEvolution: { value: "Static edits", score: "bad" },
      communityFeatures: { value: "None", score: "bad" },
      brandTools: { value: "Vine program (invite-only)", score: "mid" },
      coldStartSolution: { value: "Vine samples", score: "mid" },
      transparentScoring: { value: "Hidden algorithm", score: "bad" },
      reviewerReputation: { value: "Top Reviewer badge", score: "mid" },
    },
  },
  {
    name: "Trustpilot",
    highlight: false,
    description: "Brand-solicited review collection platform",
    features: {
      incentiveModel: { value: "None", score: "bad" },
      qualityScoring: { value: "Star rating only", score: "bad" },
      biasDetection: { value: "Manual reports + basic AI", score: "mid" },
      purchaseVerification: { value: "Self-reported", score: "bad" },
      reviewEvolution: { value: "None", score: "bad" },
      communityFeatures: { value: "None", score: "bad" },
      brandTools: { value: "Review invitations + widgets", score: "good" },
      coldStartSolution: { value: "Email solicitation", score: "mid" },
      transparentScoring: { value: "TrustScore visible", score: "mid" },
      reviewerReputation: { value: "Review count only", score: "bad" },
    },
  },
  {
    name: "G2 / Capterra",
    highlight: false,
    description: "B2B software review platforms with gift card incentives",
    features: {
      incentiveModel: { value: "One-time gift cards", score: "mid" },
      qualityScoring: { value: "Star rating + dimensions", score: "mid" },
      biasDetection: { value: "Manual moderation", score: "mid" },
      purchaseVerification: { value: "LinkedIn verification", score: "mid" },
      reviewEvolution: { value: "None", score: "bad" },
      communityFeatures: { value: "Category pages", score: "mid" },
      brandTools: { value: "Review collection + badges", score: "good" },
      coldStartSolution: { value: "Gift card campaigns", score: "mid" },
      transparentScoring: { value: "Partial breakdown", score: "mid" },
      reviewerReputation: { value: "None", score: "bad" },
    },
  },
  {
    name: "Influencer Marketing",
    highlight: false,
    description: "Brand-funded content creators reviewing products",
    features: {
      incentiveModel: { value: "Pay-per-post (brand-directed)", score: "bad" },
      qualityScoring: { value: "None", score: "bad" },
      biasDetection: { value: "None (incentive misaligned)", score: "bad" },
      purchaseVerification: { value: "Brand-sent products", score: "bad" },
      reviewEvolution: { value: "One-time content", score: "bad" },
      communityFeatures: { value: "Platform-specific audiences", score: "mid" },
      brandTools: { value: "Full creative control", score: "good" },
      coldStartSolution: { value: "Paid placements", score: "mid" },
      transparentScoring: { value: "None", score: "bad" },
      reviewerReputation: { value: "Follower count", score: "mid" },
    },
  },
];

const featureLabels: Record<string, { label: string; description: string }> = {
  incentiveModel: { label: "Reviewer incentive", description: "How reviewers are motivated to write" },
  qualityScoring: { label: "Quality scoring", description: "How review quality is measured" },
  biasDetection: { label: "Bias detection", description: "How fake or biased reviews are caught" },
  purchaseVerification: { label: "Purchase verification", description: "How real purchases are confirmed" },
  reviewEvolution: { label: "Review evolution", description: "Whether reviews update over time" },
  communityFeatures: { label: "Community features", description: "Community and social organization" },
  brandTools: { label: "Brand tools", description: "What brands get for their investment" },
  coldStartSolution: { label: "Cold start solution", description: "How new products get their first reviews" },
  transparentScoring: { label: "Scoring transparency", description: "Whether users can see how scores work" },
  reviewerReputation: { label: "Reviewer reputation", description: "How reviewer credibility is tracked" },
};

const scoreColor = (score: string) => {
  if (score === "best") return "text-[#66bb6a] font-medium";
  if (score === "good") return "text-blue-600";
  if (score === "mid") return "text-[#ffa726]";
  return "text-[#8b7560]";
};

const scoreIcon = (score: string) => {
  if (score === "best") return "●";
  if (score === "good") return "◐";
  if (score === "mid") return "○";
  return "—";
};

export default function ComparePage() {
  const { user } = useAuth();
  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch {}
  };

  return (
    <div className="min-h-screen bg-[#fff8f3]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md h-14 shrink-0 relative z-10 border-b border-[#f5ddc0]">
        <Link href="/" className="flex items-center">
          <Image src="/logo.svg" alt="Review Jam" width={110} height={26} priority />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/feed" className="text-sm font-medium text-[#8b7560] hover:text-[#4a3828] transition hidden md:inline-block">Feed</Link>
          <Link href="/c" className="text-sm font-medium text-[#8b7560] hover:text-[#4a3828] transition hidden md:inline-block">Communities</Link>
          <Link href="/explore" className="text-sm font-medium text-[#8b7560] hover:text-[#4a3828] transition hidden md:inline-block">Products</Link>
          {user ? (
            <Link href="/profile" className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-[#fff0e6] transition">
              <Avatar name={user.displayName} src={user.photoURL} size="sm" className="w-8 h-8" />
            </Link>
          ) : (
            <button type="button" onClick={handleLogin} className="text-sm font-medium bg-[#4a3828] text-white px-4 py-2 rounded-lg hover:opacity-90 transition">Sign in</button>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 md pt-16 md pb-12 text-center">
        <h1 className="text-3xl md font-extrabold text-[#4a3828] tracking-tight mb-4">
          Not another review platform.<br />
          <span className="text-gradient">A fundamentally different model.</span>
        </h1>
        <p className="text-base md text-[#8b7560] max-w-2xl mx-auto leading-relaxed mb-6">
          See how Review Jam compares to existing review platforms across every dimension that matters for trust, quality, and genuine consumer insight.
        </p>
      </section>

      {/* Core Insight */}
      <section className="px-4 md pb-16">
        <div className="max-w-3xl mx-auto glass-card px-6 md py-6 text-center">
          <p className="text-sm md text-[#5c4a38] leading-relaxed">
            <span className="font-bold text-[#4a3828]">The core difference:</span> Other platforms measure reviews by star ratings. Review Jam measures reviews by <span className="font-bold text-[#e65100]">quality, depth, and engagement</span>. Reviewers are paid to be thorough, not positive. Brand funding is decoupled from review sentiment.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-4 md pb-20">
        <div className="max-w-6xl mx-auto overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-4 pr-4 pl-2 text-[#8b7560] font-medium text-[11px] uppercase tracking-wider border-b border-[#f5ddc0] sticky left-0 bg-white min-w-[160px]">
                  Feature
                </th>
                {platforms.map((p) => (
                  <th
                    key={p.name}
                    className={`py-4 px-3 text-[11px] uppercase tracking-wider border-b min-w-[140px] ${
                      p.highlight
                        ? "text-[#e65100] font-bold bg-[#e65100]/[0.03] border-[#f5ddc0]"
                        : "text-[#8b7560] font-medium border-[#f5ddc0]"
                    }`}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(featureLabels).map(([key, { label, description }]) => (
                <tr key={key} className="group">
                  <td className="py-3.5 pr-4 pl-2 border-b border-[#f5ddc0] sticky left-0 bg-white">
                    <div className="text-[13px] font-medium text-[#5c4a38]">{label}</div>
                    <div className="text-[11px] text-[#8b7560] mt-0.5">{description}</div>
                  </td>
                  {platforms.map((p) => {
                    const feat = p.features[key as keyof typeof p.features];
                    return (
                      <td
                        key={p.name}
                        className={`py-3.5 px-3 border-b text-[13px] leading-relaxed ${
                          p.highlight
                            ? "bg-[#e65100]/[0.03] border-[#f5ddc0]"
                            : "border-[#f5ddc0]"
                        } ${scoreColor(feat.score)}`}
                      >
                        <span className="mr-1.5">{scoreIcon(feat.score)}</span>
                        {feat.value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="max-w-6xl mx-auto mt-4 flex items-center gap-6 text-[11px] text-[#8b7560]">
          <span><span className="text-[#66bb6a]">●</span> Best in class</span>
          <span><span className="text-blue-500">◐</span> Strong</span>
          <span><span className="text-[#ffa726]">○</span> Partial</span>
          <span>— Not available</span>
        </div>
      </section>

      {/* Deep Dive Sections */}
      <section className="px-4 md pb-20">
        <div className="max-w-4xl mx-auto space-y-12">

          {/* Why incentives matter */}
          <div className="glass-card px-6 md py-8">
            <h2 className="text-xl font-bold text-[#4a3828] mb-3">Why incentive alignment matters</h2>
            <p className="text-[14px] text-[#5c4a38] leading-relaxed mb-4">
              The biggest problem in reviews isn&apos;t fake reviews — it&apos;s misaligned incentives. When influencers are paid per post, they write what brands want. When nobody is paid at all, only the furious bother to write. The honest middle — detailed, balanced ownership experiences — is missing.
            </p>
            <div className="grid md gap-4">
              <div className="bg-[#ef5350]/5 rounded-xl px-5 py-4 border border-[#ef5350]/10">
                <div className="text-sm font-semibold text-[#ef5350] mb-2">Misaligned incentive</div>
                <p className="text-[13px] text-[#8b7560]">Paid to be positive. No cons listed. Marketing language. Sounds like an ad — because it is one.</p>
              </div>
              <div className="bg-[#66bb6a]/5 rounded-xl px-5 py-4 border border-[#66bb6a]/10">
                <div className="text-sm font-semibold text-[#66bb6a] mb-2">Review Jam incentive</div>
                <p className="text-[13px] text-[#8b7560]">Paid to be thorough. Health Score rewards depth, balance, and verification. Bias gets penalized, not rewarded.</p>
              </div>
            </div>
          </div>

          {/* Cold start */}
          <div className="glass-card px-6 md py-8">
            <h2 className="text-xl font-bold text-[#4a3828] mb-3">The cold start problem</h2>
            <p className="text-[14px] text-[#5c4a38] leading-relaxed mb-4">
              New products face a death spiral: no reviews leads to no trust leads to no purchases leads to no reviews. Every platform struggles with this. Here&apos;s how each one tries to solve it — and why most solutions make the trust problem worse.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-[13px] font-semibold text-[#e65100] min-w-[100px] shrink-0">Review Jam</span>
                <span className="text-[13px] text-[#5c4a38]">Brands fund bounty pools. Trusted reviewers write genuine, detailed reviews with pros AND cons. The funding is decoupled from sentiment — you can&apos;t buy stars.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[13px] font-medium text-[#8b7560] min-w-[100px] shrink-0">Amazon Vine</span>
                <span className="text-[13px] text-[#8b7560]">Free products sent to Vine reviewers. Creates obligation bias — hard to write negative reviews about gifts.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[13px] font-medium text-[#8b7560] min-w-[100px] shrink-0">Trustpilot</span>
                <span className="text-[13px] text-[#8b7560]">Email solicitation after purchase. Relies on existing customers, so new products with few sales get few invites.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[13px] font-medium text-[#8b7560] min-w-[100px] shrink-0">Influencers</span>
                <span className="text-[13px] text-[#8b7560]">Paid placements generate content, but audiences know it&apos;s sponsored. Trust is low from the start.</span>
              </div>
            </div>
          </div>

          {/* Health Score deep dive */}
          <div className="glass-card px-6 md py-8">
            <h2 className="text-xl font-bold text-[#4a3828] mb-3">Quality scoring: stars vs Health Score</h2>
            <p className="text-[14px] text-[#5c4a38] leading-relaxed mb-4">
              Star ratings tell you sentiment. Health Score tells you substance. A 3-star review with detailed pros, cons, photos, and 6-month ownership updates is infinitely more useful than a 5-star &quot;Great product!&quot; — and our scoring reflects that.
            </p>
            <div className="grid grid-cols-2 md gap-3">
              <div className="text-center px-3 py-4 rounded-xl bg-[#e65100]/5 border border-[#e65100]/10">
                <div className="text-2xl font-extrabold text-[#e65100]">40</div>
                <div className="text-[11px] text-[#8b7560] mt-1 font-medium">Quality</div>
                <div className="text-[10px] text-[#8b7560] mt-0.5">Content depth, pros/cons, media</div>
              </div>
              <div className="text-center px-3 py-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <div className="text-2xl font-extrabold text-purple-600">25</div>
                <div className="text-[11px] text-[#8b7560] mt-1 font-medium">Engagement</div>
                <div className="text-[10px] text-[#8b7560] mt-0.5">Likes, helpful votes, comments</div>
              </div>
              <div className="text-center px-3 py-4 rounded-xl bg-[#66bb6a]/5 border border-[#66bb6a]/10">
                <div className="text-2xl font-extrabold text-[#66bb6a]">20</div>
                <div className="text-[11px] text-[#8b7560] mt-1 font-medium">Credibility</div>
                <div className="text-[10px] text-[#8b7560] mt-0.5">Badges, verified purchase, history</div>
              </div>
              <div className="text-center px-3 py-4 rounded-xl bg-[#ffa726]/5 border border-[#ffa726]/10">
                <div className="text-2xl font-extrabold text-[#ffa726]">15</div>
                <div className="text-[11px] text-[#8b7560] mt-1 font-medium">Freshness</div>
                <div className="text-[10px] text-[#8b7560] mt-0.5">Recency, version updates</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="px-4 md py-16 md border-t border-[#f5ddc0] text-center">
        <h2 className="text-2xl md font-extrabold text-[#4a3828] tracking-tight mb-4">
          Ready to experience the difference?
        </h2>
        <p className="text-base text-[#8b7560] mb-8 max-w-lg mx-auto">
          Join the review platform where honesty is rewarded, quality is transparent, and trust is built in.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/feed?compose=true" className="btn-brand px-8 py-3.5 rounded-xl text-sm font-semibold">
            Start reviewing
          </Link>
          <Link href="/brands" className="px-8 py-3.5 rounded-xl text-sm font-semibold border border-[#f5ddc0] text-[#5c4a38] hover:bg-[#fff0e6] transition">
            I&apos;m a brand
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 md py-8 border-t border-[#f5ddc0]">
        <div className="max-w-4xl mx-auto flex flex-col md items-center justify-between gap-4">
          <Link href="/" className="flex items-center">
            <Image src="/logo.svg" alt="Review Jam" width={90} height={22} className="opacity-50 hover:opacity-80 transition" />
          </Link>
          <div className="flex items-center gap-6 text-[13px] text-[#8b7560]">
            <Link href="/feed" className="hover:text-[#5c4a38] transition">Feed</Link>
            <Link href="/explore" className="hover:text-[#5c4a38] transition">Products</Link>
            <Link href="/c" className="hover:text-[#5c4a38] transition">Communities</Link>
            <Link href="/brands" className="hover:text-[#5c4a38] transition">For Brands</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

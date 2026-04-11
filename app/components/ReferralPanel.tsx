"use client";

import { useEffect, useState } from "react";
import { generateReferralCode, getUserReferralCodes } from "../../lib/referral";
import { MAX_REFERRAL_CODES } from "../../lib/constants";
import type { ReferralCode } from "../../lib/types";

type Props = {
  userId: string;
  userName: string;
  userEmail: string;
};

export default function ReferralPanel({ userId, userName, userEmail }: Props) {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    getUserReferralCodes(userId)
      .then((fetched) => {
        setCodes(fetched.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [userId]);

  const usedCount = codes.filter((c) => c.status === "used").length;
  const atLimit = codes.length >= MAX_REFERRAL_CODES;

  async function handleGenerate() {
    setIsGenerating(true);
    setError("");
    try {
      const code = await generateReferralCode(userId, userName, userEmail);
      setCodes((prev) => [
        {
          id: code,
          creatorId: userId,
          creatorName: userName,
          creatorEmail: userEmail,
          createdAt: new Date().toISOString(),
          status: "active" as const,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to generate code.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  if (isLoading) {
    return (
      <div className="text-sm text-[#8b839e] animate-pulse py-8 text-center">
        Loading referral codes...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#e8e4f0]">Invite Friends</h3>
          <p className="text-[12px] text-[#8b839e] mt-0.5">
            {usedCount} of {MAX_REFERRAL_CODES} used
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={atLimit || isGenerating}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#e04c8a] hover:bg-[#e04c8a]/90 disabled:bg-[#1c1826] disabled:text-[#8b839e] text-white transition"
        >
          {isGenerating ? "Generating..." : atLimit ? "Limit reached" : "Generate Invite Code"}
        </button>
      </div>

      {error && (
        <p className="text-[12px] font-medium text-[#f87171]">{error}</p>
      )}

      {/* Usage bar */}
      <div className="w-full bg-[#1c1826] rounded-full h-1.5">
        <div
          className="bg-[#e04c8a] h-1.5 rounded-full transition-all"
          style={{ width: `${(codes.length / MAX_REFERRAL_CODES) * 100}%` }}
        />
      </div>

      {/* Codes list */}
      {codes.length === 0 ? (
        <p className="text-sm text-[#8b839e] text-center py-6">
          No invite codes generated yet. Create one to invite a friend.
        </p>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => (
            <div
              key={code.id}
              className="flex items-center justify-between bg-[#1c1826] border border-[#2a2535] rounded-lg px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono font-semibold text-[#e8e4f0]">
                    {code.id}
                  </code>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      code.status === "active"
                        ? "bg-[#34d399]/12 text-[#34d399]"
                        : "bg-[#1c1826] text-[#8b839e]"
                    }`}
                  >
                    {code.status === "active" ? "Active" : "Used"}
                  </span>
                </div>
                {code.usedBy && (
                  <p className="text-[11px] text-[#8b839e] mt-0.5">
                    Redeemed by {code.usedBy}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(code.id)}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition shrink-0 ml-2 ${
                  copiedCode === code.id
                    ? "bg-[#34d399]/12 text-[#34d399]"
                    : "bg-[#1c1826] text-[#cbc5d9] hover:bg-[#231e2e]"
                }`}
              >
                {copiedCode === code.id ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[#8b839e] leading-relaxed">
        Share your invite code with friends. When they redeem it, they get instant access to Review Jam.
      </p>
    </div>
  );
}

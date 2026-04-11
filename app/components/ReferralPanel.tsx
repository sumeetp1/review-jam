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
      <div className="text-sm text-[#8b7560] animate-pulse py-8 text-center">
        Loading referral codes...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#4a3828]">Invite Friends</h3>
          <p className="text-[12px] text-[#8b7560] mt-0.5">
            {usedCount} of {MAX_REFERRAL_CODES} used
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={atLimit || isGenerating}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#e65100] hover:bg-[#e65100]/90 disabled:bg-[#ffecd2] disabled:text-[#8b7560] text-white transition"
        >
          {isGenerating ? "Generating..." : atLimit ? "Limit reached" : "Generate Invite Code"}
        </button>
      </div>

      {error && (
        <p className="text-[12px] font-medium text-[#ef5350]">{error}</p>
      )}

      {/* Usage bar */}
      <div className="w-full bg-[#ffecd2] rounded-full h-1.5">
        <div
          className="bg-[#e65100] h-1.5 rounded-full transition-all"
          style={{ width: `${(codes.length / MAX_REFERRAL_CODES) * 100}%` }}
        />
      </div>

      {/* Codes list */}
      {codes.length === 0 ? (
        <p className="text-sm text-[#8b7560] text-center py-6">
          No invite codes generated yet. Create one to invite a friend.
        </p>
      ) : (
        <div className="space-y-2">
          {codes.map((code) => (
            <div
              key={code.id}
              className="flex items-center justify-between bg-white border border-[#f5ddc0] rounded-lg px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono font-semibold text-[#4a3828]">
                    {code.id}
                  </code>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      code.status === "active"
                        ? "bg-[#66bb6a]/10 text-[#66bb6a]"
                        : "bg-[#ffecd2] text-[#8b7560]"
                    }`}
                  >
                    {code.status === "active" ? "Active" : "Used"}
                  </span>
                </div>
                {code.usedBy && (
                  <p className="text-[11px] text-[#8b7560] mt-0.5">
                    Redeemed by {code.usedBy}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(code.id)}
                className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition shrink-0 ml-2 ${
                  copiedCode === code.id
                    ? "bg-[#66bb6a]/10 text-[#66bb6a]"
                    : "bg-[#ffecd2] text-[#5c4a38] hover:bg-[#fff0e6]"
                }`}
              >
                {copiedCode === code.id ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[#8b7560] leading-relaxed">
        Share your invite code with friends. When they redeem it, they get instant access to Review Jam.
      </p>
    </div>
  );
}

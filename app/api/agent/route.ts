import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tryParseJson, generateWithFallback } from "../../../lib/gemini";
import { jsonError, jsonSuccess } from "../../../lib/api";
import type { ReviewAnalysis } from "../../../lib/types";

function reject(reason: string): ReviewAnalysis {
  return { isGenuine: false, reason, marketingQuote: "", biasFlag: false };
}

function runDeterministicChecks(reviewContent: string): ReviewAnalysis | null {
  const normalized = reviewContent.trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const lower = normalized.toLowerCase();

  if (words.length < 6) {
    return reject("Review is too short. Please add meaningful detail.");
  }

  const explicitFakePattern =
    /\b(test|dummy|fake|sample|lorem ipsum|trial review|placeholder)\b/i;
  if (explicitFakePattern.test(lower)) {
    return reject("Review appears to be a test/dummy submission.");
  }

  const keyboardMashPattern = /(.)\1{5,}|(?:^|\s)(asdf|qwerty|zxcv|poiuy|lkjhg)(?:\s|$)/i;
  if (keyboardMashPattern.test(lower)) {
    return reject("Review contains keyboard mashing or repeated gibberish.");
  }

  const uniqueRatio = new Set(words.map((w) => w.toLowerCase())).size / words.length;
  if (words.length >= 10 && uniqueRatio < 0.45) {
    return reject("Review appears repetitive and low-quality.");
  }

  if (!/[a-z]/i.test(normalized)) {
    return reject("Review must contain readable text feedback.");
  }

  return null;
}

function normalizeAnalysis(raw: Record<string, unknown>): ReviewAnalysis | null {
  if (typeof raw.isGenuine !== "boolean") return null;
  const str = (v: unknown) =>
    typeof v === "string" ? v : v == null ? "" : String(v);
  return {
    isGenuine: raw.isGenuine,
    reason: str(raw.reason),
    marketingQuote: str(raw.marketingQuote),
    biasFlag: raw.biasFlag === true,
  };
}


async function logModerationEvent(args: {
  reviewerName?: string;
  reviewContent: string;
  analysis: ReviewAnalysis;
  source: "deterministic" | "ai";
}) {
  try {
    await addDoc(collection(db, "moderationEvents"), {
      reviewerName: args.reviewerName || "Anonymous",
      reviewPreview: args.reviewContent.slice(0, 280),
      isGenuine: args.analysis.isGenuine,
      reason: args.analysis.reason || "",
      marketingQuote: args.analysis.marketingQuote || "",
      biasFlag: args.analysis.biasFlag ?? false,
      source: args.source,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log moderation event:", error);
  }
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      reviewContent,
      reviewerName,
      pros,
      cons,
      summary,
    }: {
      reviewContent: string;
      reviewerName?: string;
      pros?: string[];
      cons?: string[];
      summary?: string;
    } = body;

    if (typeof reviewContent !== "string" || !reviewContent.trim()) {
      return jsonError("Review content is required");
    }

    // Check if AI moderation is disabled by admin
    try {
      const configSnap = await getDoc(doc(db, "config", "moderation"));
      if (configSnap.exists() && configSnap.data().aiCheckEnabled === false) {
        const bypassAnalysis: ReviewAnalysis = {
          isGenuine: true,
          reason: "",
          marketingQuote: summary?.trim() || reviewContent.slice(0, 80),
          biasFlag: false,
        };
        return jsonSuccess({ analysis: bypassAnalysis });
      }
    } catch {
      // If config fetch fails, proceed normally
    }

    const preCheckFailure = runDeterministicChecks(reviewContent);
    if (preCheckFailure) {
      await logModerationEvent({
        reviewerName,
        reviewContent,
        analysis: preCheckFailure,
        source: "deterministic",
      });
      return jsonSuccess({ analysis: preCheckFailure });
    }

    if (!process.env.GEMINI_API_KEY) {
      return jsonError("AI moderation is unavailable. Try again later.", 503);
    }

    // Build structured context for AI from all review fields
    const prosText = pros && pros.length > 0 ? `Pros: ${pros.join(", ")}` : "";
    const consText = cons && cons.length > 0 ? `Cons: ${cons.join(", ")}` : "";
    const summaryText = summary ? `Headline: "${summary}"` : "";
    const structuredContext = [summaryText, prosText, consText]
      .filter(Boolean)
      .join("\n");

    const systemInstruction = `
You are a strict Quality Control Agent for a product review marketplace. Your job is to assess whether a review is genuine, balanced, and from real product experience.

You MUST return a JSON object with this exact structure:
{
  "isGenuine": boolean,
  "reason": "string",
  "marketingQuote": "string",
  "biasFlag": boolean
}

RULES FOR REJECTION (set isGenuine to false):
1. Keyboard mashing or gibberish text.
2. Explicit admission it is a test, fake, dummy, or trial review.
3. Review is completely unrelated to any real product experience.
4. Pure promotional text with no personal experience or opinion.
5. Contradictions between the headline, pros/cons, and main text that suggest the reviewer didn't use the product.

BIAS FLAG (set biasFlag to true — does NOT reject the review, just flags it):
- The review reads like marketing copy: excessive superlatives ("absolutely amazing", "life-changing", "the best I've ever used"), no acknowledgement of any weakness or trade-off.
- Over-positivity: every single aspect is praised with zero criticism or nuance.
- Language that feels written to sell rather than to inform a buyer making a decision.
- Absence of any concrete negative detail despite the reviewer claiming long-term use.
Set biasFlag to false if the review is balanced, contains meaningful criticism, or is negative/mixed overall.

APPROVAL CRITERIA:
- Personal first-hand experience with the product is evident.
- The review is helpful to a buyer even if negative.
- Pros/cons (if provided) align with the main review text.

If rejected: set isGenuine to false, write a clear stern reason, leave marketingQuote empty.
If approved: set isGenuine to true, leave reason empty, and use the headline (if provided) as the marketingQuote. If no headline is provided, extract a compelling 5-12 word quote from the review text.
    `.trim();

    const prompt = `
${systemInstruction}

Reviewer: ${reviewerName || "Anonymous"}
${structuredContext ? `\n${structuredContext}` : ""}
Full Review: "${reviewContent}"

Analyze and return JSON.
    `.trim();

    const responseText = await generateWithFallback(prompt, { responseMimeType: "application/json" });

    const parsedRaw = tryParseJson(responseText);
    if (!parsedRaw || typeof parsedRaw !== "object") {
      return jsonError("Invalid moderation response format from AI.", 502);
    }

    const analysis = normalizeAnalysis(parsedRaw as Record<string, unknown>);
    if (!analysis) {
      return jsonError("Incomplete moderation response from AI.", 502);
    }

    // If summary was provided and review is genuine, use it as the marketing quote
    if (analysis.isGenuine && summary && summary.trim().length >= 10) {
      analysis.marketingQuote = summary.trim();
    }

    await logModerationEvent({
      reviewerName,
      reviewContent,
      analysis,
      source: "ai",
    });

    return jsonSuccess({ analysis });

  } catch (error) {
    console.error("AI Agent Error:", error);
    return jsonError("Failed to process review with AI.", 500);
  }
}

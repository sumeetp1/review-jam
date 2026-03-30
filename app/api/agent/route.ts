import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../../lib/firebase";

// Initialize the Gemini API Brain
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

type ReviewAnalysis = {
  isGenuine: boolean;
  reason: string;
  marketingQuote: string;
};

function reject(reason: string) {
  return { isGenuine: false, reason, marketingQuote: "" };
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

  // Very low unique-word ratio often indicates generic junk or repeated text.
  const uniqueRatio = new Set(words.map((w) => w.toLowerCase())).size / words.length;
  if (words.length >= 10 && uniqueRatio < 0.45) {
    return reject("Review appears repetitive and low-quality.");
  }

  const hasLetters = /[a-z]/i.test(normalized);
  if (!hasLetters) {
    return reject("Review must contain readable text feedback.");
  }

  return null;
}

function isValidAnalysis(payload: unknown): payload is ReviewAnalysis {
  if (!payload || typeof payload !== "object") return false;
  const maybe = payload as Record<string, unknown>;
  return (
    typeof maybe.isGenuine === "boolean" &&
    typeof maybe.reason === "string" &&
    typeof maybe.marketingQuote === "string"
  );
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
      source: args.source,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log moderation event:", error);
  }
}

export async function POST(req: Request) {
  try {
    const { reviewContent, reviewerName } = await req.json();

    if (typeof reviewContent !== "string" || !reviewContent.trim()) {
      return NextResponse.json({ error: "Review content is required" }, { status: 400 });
    }

    const preCheckFailure = runDeterministicChecks(reviewContent);
    if (preCheckFailure) {
      await logModerationEvent({
        reviewerName,
        reviewContent,
        analysis: preCheckFailure,
        source: "deterministic",
      });
      return NextResponse.json({ success: true, analysis: preCheckFailure }, { status: 200 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "AI moderation is unavailable. Try again later." },
        { status: 503 }
      );
    }

    // We use gemini-1.5-flash because it is lightning fast and perfect for JSON tasks
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // Forcing the AI to return clean JSON
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // The Ruthless System Prompt
    const systemInstruction = `
    You are a ruthless, highly strict Quality Control Agent for a product review platform. Your job is to analyze incoming reviews and filter out spam.

    You MUST return a JSON object with this exact structure:
    {
      "isGenuine": boolean,
      "reason": "string",
      "marketingQuote": "string"
    }

    RULES FOR REJECTION (Set isGenuine to false):
    1. If the text contains keyboard mashing (e.g., "asdfg", "qwerty").
    2. If the user explicitly states it is a test, fake, dummy, or trial review.
    3. If the review is less than 3 words long.
    4. If the text is completely unrelated to evaluating a product or service.

    If rejected, provide a stern "reason" (e.g., "Review contains keyboard mashing and lacks genuine feedback.") and leave the marketingQuote empty.
    If accepted, set isGenuine to true, leave reason empty, and extract a compelling 5-10 word "marketingQuote" from their text.
    `;

    // Constructing the final prompt
    const prompt = `
    ${systemInstruction}
    
    Reviewer Name: ${reviewerName || "Anonymous"}
    Review Content: "${reviewContent}"
    
    Analyze this review and return the JSON.
    `;

    // Wake up the AI and get the response
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid moderation response format from AI." },
        { status: 502 }
      );
    }

    if (!isValidAnalysis(parsed)) {
      return NextResponse.json(
        { success: false, error: "Incomplete moderation response from AI." },
        { status: 502 }
      );
    }

    const analysis: ReviewAnalysis = {
      isGenuine: parsed.isGenuine,
      reason: parsed.reason,
      marketingQuote: parsed.marketingQuote,
    };

    await logModerationEvent({
      reviewerName,
      reviewContent,
      analysis,
      source: "ai",
    });

    // Send it back to the frontend!
    return NextResponse.json({ success: true, analysis });

  } catch (error) {
    console.error("AI Agent Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to process review with AI." 
    }, { status: 500 });
  }
}
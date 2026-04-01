import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
].filter(Boolean) as string[];

type ReceiptData = {
  storeName: string | null;
  purchaseDate: string | null;
  detectedProduct: string | null;
  isVerified: boolean;
  confidence: "high" | "medium" | "low" | "none";
};

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try { return JSON.parse(fence[1].trim()); } catch { /* fall through */ }
    }
    return null;
  }
}

function isModelNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; message?: string };
  return e.status === 404 || (typeof e.message === "string" && e.message.toLowerCase().includes("not found"));
}

async function parseReceiptWithGemini(
  imageBase64: string,
  mimeType: string,
  productHint: string,
): Promise<ReceiptData> {
  const prompt = `You are a receipt parsing assistant. Carefully examine this receipt or order confirmation image.

Extract the following fields:
- storeName: The retailer or store name (e.g. "Amazon", "Best Buy", "Target"). null if not visible.
- purchaseDate: The purchase date in ISO format YYYY-MM-DD. null if not visible.
- detectedProduct: The product name or SKU on the receipt most closely matching "${productHint}". null if not found.
- isVerified: true if you can clearly identify at least a store name AND a purchase date. false otherwise.
- confidence: "high" if storeName + date + product are all found, "medium" if storeName + date found, "low" if only one field found, "none" if nothing readable.

Return ONLY a JSON object with exactly these keys: storeName, purchaseDate, detectedProduct, isVerified, confidence.
Do not include any explanation or markdown outside the JSON.`;

  let lastError: unknown = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ]);

      const text = result.response.text().trim();
      const parsed = tryParseJson(text);

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Gemini returned non-JSON response");
      }

      const raw = parsed as Record<string, unknown>;
      return {
        storeName: typeof raw.storeName === "string" ? raw.storeName : null,
        purchaseDate: typeof raw.purchaseDate === "string" ? raw.purchaseDate : null,
        detectedProduct: typeof raw.detectedProduct === "string" ? raw.detectedProduct : null,
        isVerified: raw.isVerified === true,
        confidence: (["high", "medium", "low", "none"].includes(raw.confidence as string)
          ? raw.confidence
          : "none") as ReceiptData["confidence"],
      };
    } catch (error) {
      lastError = error;
      if (isModelNotFoundError(error)) continue;
      throw error;
    }
  }

  throw lastError ?? new Error("No Gemini models available.");
}

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Receipt verification is currently unavailable." },
        { status: 503 },
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType, productName } = body as {
      imageBase64?: string;
      mimeType?: string;
      productName?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ success: false, error: "imageBase64 is required." }, { status: 400 });
    }

    if (!mimeType || !mimeType.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "A valid image mimeType is required." }, { status: 400 });
    }

    // Safety: cap payload at ~8 MB of base64 (~6 MB actual image)
    if (imageBase64.length > 11_000_000) {
      return NextResponse.json({ success: false, error: "Image is too large. Please use an image under 6 MB." }, { status: 413 });
    }

    const result = await parseReceiptWithGemini(imageBase64, mimeType, productName ?? "");

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("verify-receipt error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to parse receipt. Please try again." },
      { status: 500 },
    );
  }
}

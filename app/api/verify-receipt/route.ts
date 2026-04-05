import { tryParseJson, generateMultimodalWithFallback } from "../../../lib/gemini";
import { jsonError, jsonSuccess } from "../../../lib/api";

type ReceiptData = {
  storeName: string | null;
  purchaseDate: string | null;
  detectedProduct: string | null;
  isVerified: boolean;
  confidence: "high" | "medium" | "low" | "none";
};

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

  const text = await generateMultimodalWithFallback(
    [prompt, { inlineData: { mimeType, data: imageBase64 } }],
    { responseMimeType: "application/json" },
  );

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
}

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return jsonError("Receipt verification is currently unavailable.", 503);
    }

    const body = await req.json();
    const { imageBase64, mimeType, productName } = body as {
      imageBase64?: string;
      mimeType?: string;
      productName?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return jsonError("imageBase64 is required.");
    }

    if (!mimeType || !mimeType.startsWith("image/")) {
      return jsonError("A valid image mimeType is required.");
    }

    // Safety: cap payload at ~8 MB of base64 (~6 MB actual image)
    if (imageBase64.length > 11_000_000) {
      return jsonError("Image is too large. Please use an image under 6 MB.", 413);
    }

    const result = await parseReceiptWithGemini(imageBase64, mimeType, productName ?? "");

    return jsonSuccess(result as unknown as Record<string, unknown>);
  } catch (error) {
    console.error("verify-receipt error:", error);
    return jsonError("Failed to parse receipt. Please try again.", 500);
  }
}

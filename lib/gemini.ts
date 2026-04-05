// ─── Shared Gemini AI Client ─────────────────────────────────────────────────
// Server-only: used by API routes that call Gemini.

import { GoogleGenerativeAI } from "@google/generative-ai";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite-preview-06-17",
  "gemini-2.0-flash",
].filter(Boolean) as string[];

/** Try to parse a string as JSON, handling markdown code fences. */
export function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* fall through */
      }
    }
    // last resort: find first {...}
    const brace = trimmed.match(/\{[\s\S]*\}/);
    if (brace) {
      try {
        return JSON.parse(brace[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

/** Check if a Gemini error indicates the model was not found. */
export function isModelNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { status?: number; message?: string };
  if (maybe.status === 404) return true;
  return typeof maybe.message === "string" && maybe.message.toLowerCase().includes("not found");
}

/**
 * Generate text with automatic model fallback.
 * Tries each model in MODEL_CANDIDATES until one succeeds.
 */
export async function generateWithFallback(
  prompt: string,
  options?: { responseMimeType?: string },
): Promise<string> {
  let lastError: unknown = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(options?.responseMimeType
          ? { generationConfig: { responseMimeType: options.responseMimeType } }
          : {}),
      });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      lastError = error;
      if (isModelNotFoundError(error)) continue;
      throw error;
    }
  }

  throw lastError ?? new Error("No Gemini models are available for this API key.");
}

/**
 * Generate content with multimodal input (text + image) and model fallback.
 */
export async function generateMultimodalWithFallback(
  parts: any[],
  options?: { responseMimeType?: string },
): Promise<string> {
  let lastError: unknown = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(options?.responseMimeType
          ? { generationConfig: { responseMimeType: options.responseMimeType } }
          : {}),
      });
      const result = await model.generateContent(parts);
      return result.response.text().trim();
    } catch (error) {
      lastError = error;
      if (isModelNotFoundError(error)) continue;
      throw error;
    }
  }

  throw lastError ?? new Error("No Gemini models are available for this API key.");
}

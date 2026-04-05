import { collection, addDoc, doc, writeBatch } from "firebase/firestore";
import { jsonError, jsonSuccess } from "../../../lib/api";
import { db } from "../../../lib/firebase";
import { slugify, categoryToSlug } from "../../../lib/slugify";
import { genAI, MODEL_CANDIDATES, tryParseJson } from "../../../lib/gemini";

// Categories are open — any non-empty string is valid
type Category = string;

type SeedResult = {
  brandName: string;
  category: Category;
  description: string;
  specs: { label: string; value: string }[];
  variants: string[];
  verifiedSkus: string[];
};


function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function validateAndNormalize(raw: Record<string, unknown>): SeedResult | null {
  const rawCat = str(raw.category).trim();
  if (!rawCat) return null;
  // Title-case normalize the category
  const category = rawCat.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  const specs = Array.isArray(raw.specs)
    ? raw.specs
        .filter((s): s is { label: unknown; value: unknown } =>
          s && typeof s === "object"
        )
        .map((s) => ({ label: str(s.label), value: str(s.value) }))
        .filter((s) => s.label && s.value)
        .slice(0, 8)
    : [];

  const variants = Array.isArray(raw.variants)
    ? raw.variants.map(str).filter(Boolean).slice(0, 6)
    : [];

  const verifiedSkus = Array.isArray(raw.verifiedSkus)
    ? raw.verifiedSkus.map(str).filter(Boolean).slice(0, 8)
    : [];

  const brandName = str(raw.brandName) || str(raw.brand) || "Unknown Brand";
  const description = str(raw.description) || "";

  return { brandName, category, description, specs, variants, verifiedSkus };
}

// ─── Gemini call ──────────────────────────────────────────────────────────────

async function callGemini(productName: string): Promise<SeedResult | null> {
  const prompt = `You are a product database seeding assistant. Given a product name, return a JSON object with accurate, factual information about that product.

Product name: "${productName}"

Return ONLY a JSON object (no markdown, no explanation) with this exact shape:
{
  "brandName": "The manufacturer brand name",
  "category": "One of exactly: Tech, Home, SaaS, Automotive, Beauty, Gaming, Fitness, Travel, Finance",
  "description": "2-3 sentence factual product description highlighting key features",
  "specs": [
    { "label": "spec name", "value": "spec value with units" }
  ],
  "variants": ["variant or colour name 1", "variant or colour name 2"],
  "verifiedSkus": ["MODEL-NUMBER-1", "MODEL-NUMBER-2"]
}

Rules:
- specs: 3 to 6 entries, most important technical specifications only (e.g. battery life, weight, dimensions, key features)
- variants: 2 to 5 entries — colour options, storage tiers, trim levels, subscription plans, etc.
- verifiedSkus: official model numbers or SKUs if known; empty array [] if unknown
- category MUST be one of the 9 options listed exactly
- If the product is fictional or you have no real knowledge of it, still return your best guess based on the name`;

  for (const modelId of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelId });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = tryParseJson(text);
      if (parsed && typeof parsed === "object") {
        const normalized = validateAndNormalize(parsed as Record<string, unknown>);
        if (normalized) return normalized;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { productName?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const productName = body.productName?.trim();
  if (!productName || productName.length < 2) {
    return jsonError("Product name is required (min 2 characters)", 400);
  }
  if (productName.length > 120) {
    return jsonError("Product name is too long", 400);
  }

  // ── Step 1: Call Gemini ───────────────────────────────────────────────────
  const aiData = await callGemini(productName);

  // ── Step 2: Build product doc (with or without AI data) ──────────────────
  const now = new Date().toISOString();
  const resolvedCategory = aiData?.category ?? ("Tech" as Category);
  const productSlug      = slugify(productName);
  const communitySlug    = categoryToSlug(resolvedCategory);

  const productDoc = aiData
    ? {
        name: productName,
        slug: productSlug,
        communitySlug,
        brandName: aiData.brandName,
        category: aiData.category,
        description: aiData.description,
        specs: aiData.specs,
        verifiedSkus: aiData.verifiedSkus,
        campaignId: "organic",
        communitySeeded: true,
        aiSeeded: true,
        endDate: null,
        budget: null,
        createdAt: now,
      }
    : {
        name: productName,
        slug: productSlug,
        communitySlug,
        brandName: "",
        category: "Tech" as Category,
        description: "",
        specs: [],
        verifiedSkus: [],
        campaignId: "organic",
        communitySeeded: true,
        aiSeeded: false,
        endDate: null,
        budget: null,
        createdAt: now,
      };

  // ── Step 3: Write to Firestore ────────────────────────────────────────────
  try {
    const productRef = await addDoc(collection(db, "products"), productDoc);

    const variants = aiData?.variants ?? [];
    if (variants.length > 0) {
      const batch = writeBatch(db);
      for (const vName of variants) {
        const vRef = doc(collection(db, "products", productRef.id, "productVariants"));
        batch.set(vRef, { name: vName, createdAt: now });
      }
      await batch.commit();
    }

    return jsonSuccess({
      productId: productRef.id,
      slug: productSlug,
      communitySlug,
      data: aiData
        ? { ...aiData }
        : { brandName: "", category: "Tech", description: "", specs: [], variants: [], verifiedSkus: [] },
    });
  } catch (err) {
    console.error("[seed-product] Firestore write failed:", err);
    return jsonError("Failed to create product. Please try again.", 500);
  }
}

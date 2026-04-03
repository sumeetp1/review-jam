/**
 * Converts a human-readable string into a URL-safe slug.
 * "Sony WH-1000XM6" → "sony-wh-1000xm6"
 * "Linear"          → "linear"
 * "Whoop 5.0"       → "whoop-5-0"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Derives a community slug from a product category.
 * "Tech" → "tech", "SaaS" → "saas", "Automotive" → "automotive"
 */
export function categoryToSlug(category: string): string {
  return slugify(category);
}

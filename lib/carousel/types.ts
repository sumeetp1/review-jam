// ─── Amazon Carousel Image Types ─────────────────────────────────────────────

export type TemplateName = "health-overview" | "top-reviews" | "pros-cons" | "review-spotlight";
export type CarouselTheme = "light" | "dark";

export type TemplateOption = {
  id: TemplateName;
  label: string;
  description: string;
  icon: string;
};

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: "health-overview",  label: "Health Score Overview", description: "Big health ring + rating + review count",     icon: "🎯" },
  { id: "top-reviews",      label: "Top Reviews",          description: "3 highlighted review snippets with ratings",   icon: "⭐" },
  { id: "pros-cons",        label: "Pros & Cons",          description: "Aggregated top pros and cons side by side",    icon: "⚖️" },
  { id: "review-spotlight",  label: "Review Spotlight",     description: "Single standout review featured large",        icon: "🔦" },
];

export const VALID_TEMPLATES: TemplateName[] = TEMPLATE_OPTIONS.map((t) => t.id);

export type CarouselReview = {
  reviewerName: string;
  rating: number;
  summary: string;
  content: string;
  healthScore: number;
  pros: string[];
  usageDuration?: string;
};

export type CarouselData = {
  productId: string;
  productName: string;
  brandName: string;
  category: string;
  communitySlug: string;
  productSlug: string;
  avgRating: number;
  avgHealthScore: number;
  reviewCount: number;
  topPros: Array<{ text: string; count: number }>;
  topCons: Array<{ text: string; count: number }>;
  topReviews: CarouselReview[];
  spotlightReview: CarouselReview | null;
};

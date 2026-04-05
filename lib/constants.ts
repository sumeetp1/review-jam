// ─── Shared Constants ────────────────────────────────────────────────────────

export const ADMIN_EMAIL = "sumit.pandey75@gmail.com";

export const SUGGESTED_CATEGORIES = [
  "Tech", "Home", "SaaS", "Automotive", "Beauty",
  "Gaming", "Fitness", "Travel", "Finance",
  "Food & Drink", "Health", "Education", "Infrastructure", "Services",
];

// Legacy alias
export const AVAILABLE_CATEGORIES = SUGGESTED_CATEGORIES;

export const USAGE_LABELS: Record<string, string> = {
  less_1_week:    "< 1 week",
  "1_4_weeks":    "1\u20134 weeks",
  "1_3_months":   "1\u20133 months",
  "3_plus_months":"3+ months",
};

export const USAGE_DURATIONS = [
  { value: "less_1_week"   as const, label: "< 1 week" },
  { value: "1_4_weeks"     as const, label: "1\u20134 weeks" },
  { value: "1_3_months"    as const, label: "1\u20133 months" },
  { value: "3_plus_months" as const, label: "3+ months" },
];

export const PURCHASE_CHANNELS = [
  { value: "amazon"        as const, label: "Amazon" },
  { value: "brand_website" as const, label: "Brand website" },
  { value: "retail"        as const, label: "Retail store" },
  { value: "other"         as const, label: "Other" },
];

export const SOURCE_LABELS: Record<string, string> = {
  purchased:  "Purchased",
  gift:       "Gift",
};

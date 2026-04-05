// ─── Shared Constants ────────────────────────────────────────────────────────

import type { SubjectType } from "./types";

export const ADMIN_EMAIL = "sumit.pandey75@gmail.com";

export const SUGGESTED_CATEGORIES = [
  "Tech", "Home", "SaaS", "Automotive", "Beauty",
  "Gaming", "Fitness", "Travel", "Finance",
  "Food & Drink", "Health", "Education", "Infrastructure", "Services",
  "Places", "Roads & Routes", "Government", "Events",
  "Restaurants", "Entertainment", "Real Estate",
  "Transportation", "Utilities", "Local Business",
  "Courses & Classes", "Outdoors & Nature",
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

// ─── Subject Type Configuration ──────────────────────────────────────────────
// Drives adaptive form labels, fields, and suggested sub-rating dimensions
// based on what kind of entity the reviewer is reviewing.

export type SubjectTypeConfig = {
  label: string;             // Display name (e.g. "Product", "Place")
  icon: string;              // Emoji icon for the type selector
  nameLabel: string;         // Label for the name field
  namePlaceholder: string;   // Placeholder for the name field
  sourceLabel: string;       // Label for "how did you get this?"
  sourceOptions: { value: string; label: string }[];
  durationLabel: string;     // Label for the duration/usage field
  durationOptions: { value: string; label: string }[];
  showPurchaseChannel: boolean;
  showLocation: boolean;
  locationLabel?: string;
  locationPlaceholder?: string;
  suggestedDimensions: string[];  // Pre-suggested sub-rating dimensions
  reviewPlaceholder: string;      // Placeholder for the review textarea
  proLabel: string;               // Label for pros
  conLabel: string;               // Label for cons
  proPlaceholder: string;
  conPlaceholder: string;
};

export const SUBJECT_TYPE_CONFIGS: Record<SubjectType, SubjectTypeConfig> = {
  product: {
    label: "Product",
    icon: "📦",
    nameLabel: "What product are you reviewing?",
    namePlaceholder: "e.g. Sony WH-1000XM5",
    sourceLabel: "How did you get it?",
    sourceOptions: [
      { value: "purchased", label: "Purchased" },
      { value: "gift", label: "Received as gift" },
      { value: "brand_sent", label: "Sent by brand" },
    ],
    durationLabel: "How long have you used it?",
    durationOptions: [
      { value: "less_1_week", label: "< 1 week" },
      { value: "1_4_weeks", label: "1\u20134 weeks" },
      { value: "1_3_months", label: "1\u20133 months" },
      { value: "3_plus_months", label: "3+ months" },
    ],
    showPurchaseChannel: true,
    showLocation: false,
    suggestedDimensions: ["Quality", "Value", "Design"],
    reviewPlaceholder: "Share your full experience \u2014 what worked, what surprised you, who this is ideal for...",
    proLabel: "What did you like?",
    conLabel: "What could be better?",
    proPlaceholder: "e.g. Long battery life",
    conPlaceholder: "e.g. Expensive carrying case",
  },
  place: {
    label: "Place",
    icon: "📍",
    nameLabel: "What place are you reviewing?",
    namePlaceholder: "e.g. Central Park, Golden Gate Bridge",
    sourceLabel: "How did you experience it?",
    sourceOptions: [
      { value: "visited", label: "Visited" },
      { value: "lived_nearby", label: "Live nearby" },
      { value: "frequent_visitor", label: "Frequent visitor" },
    ],
    durationLabel: "How long was your visit?",
    durationOptions: [
      { value: "quick_stop", label: "Quick stop" },
      { value: "few_hours", label: "A few hours" },
      { value: "full_day", label: "Full day" },
      { value: "multiple_days", label: "Multiple days" },
    ],
    showPurchaseChannel: false,
    showLocation: true,
    locationLabel: "Location",
    locationPlaceholder: "e.g. San Francisco, CA",
    suggestedDimensions: ["Cleanliness", "Safety", "Accessibility", "Scenery"],
    reviewPlaceholder: "Describe your experience at this place \u2014 what stood out, what to expect, tips for visitors...",
    proLabel: "What was great about it?",
    conLabel: "What could be improved?",
    proPlaceholder: "e.g. Beautiful views",
    conPlaceholder: "e.g. Limited parking",
  },
  route: {
    label: "Road / Route",
    icon: "🛣️",
    nameLabel: "What road or route are you reviewing?",
    namePlaceholder: "e.g. Highway 101 from SF to LA",
    sourceLabel: "How do you use this route?",
    sourceOptions: [
      { value: "daily_commute", label: "Daily commute" },
      { value: "frequent_travel", label: "Travel frequently" },
      { value: "one_time", label: "One-time trip" },
      { value: "occasional", label: "Occasionally" },
    ],
    durationLabel: "How long have you been using this route?",
    durationOptions: [
      { value: "first_time", label: "First time" },
      { value: "few_months", label: "A few months" },
      { value: "1_plus_years", label: "1+ years" },
      { value: "long_time", label: "Many years" },
    ],
    showPurchaseChannel: false,
    showLocation: true,
    locationLabel: "Route location",
    locationPlaceholder: "e.g. San Francisco to Los Angeles, CA",
    suggestedDimensions: ["Surface Condition", "Safety", "Lighting", "Signage", "Scenic Value"],
    reviewPlaceholder: "Describe the road conditions, safety, scenic value, and anything drivers or travelers should know...",
    proLabel: "What's good about this route?",
    conLabel: "What are the issues?",
    proPlaceholder: "e.g. Scenic ocean views",
    conPlaceholder: "e.g. Potholes near exit 42",
  },
  service: {
    label: "Service",
    icon: "🔧",
    nameLabel: "What service are you reviewing?",
    namePlaceholder: "e.g. DMV online renewal, Xfinity support",
    sourceLabel: "How did you use this service?",
    sourceOptions: [
      { value: "used_online", label: "Used online" },
      { value: "used_in_person", label: "Visited in person" },
      { value: "phone_call", label: "Phone/video call" },
      { value: "ongoing", label: "Ongoing subscription" },
    ],
    durationLabel: "How long have you used this service?",
    durationOptions: [
      { value: "one_time", label: "One-time use" },
      { value: "less_1_month", label: "< 1 month" },
      { value: "1_6_months", label: "1\u20136 months" },
      { value: "6_plus_months", label: "6+ months" },
    ],
    showPurchaseChannel: false,
    showLocation: false,
    suggestedDimensions: ["Reliability", "Speed", "Value", "Customer Support"],
    reviewPlaceholder: "Describe your experience with this service \u2014 how responsive, reliable, and helpful was it...",
    proLabel: "What worked well?",
    conLabel: "What needs improvement?",
    proPlaceholder: "e.g. Fast response time",
    conPlaceholder: "e.g. Long hold times",
  },
  business: {
    label: "Business",
    icon: "🏪",
    nameLabel: "What business are you reviewing?",
    namePlaceholder: "e.g. Joe's Pizza, Main Street Barbershop",
    sourceLabel: "How did you interact?",
    sourceOptions: [
      { value: "customer", label: "Customer" },
      { value: "regular", label: "Regular customer" },
      { value: "first_visit", label: "First visit" },
      { value: "delivery_order", label: "Delivery/online order" },
    ],
    durationLabel: "How long have you been a customer?",
    durationOptions: [
      { value: "first_visit", label: "First visit" },
      { value: "few_visits", label: "A few visits" },
      { value: "regular", label: "Regular (months)" },
      { value: "loyal", label: "Loyal customer (years)" },
    ],
    showPurchaseChannel: false,
    showLocation: true,
    locationLabel: "Location",
    locationPlaceholder: "e.g. 123 Main St, Portland, OR",
    suggestedDimensions: ["Quality", "Service", "Ambiance", "Value", "Wait Time"],
    reviewPlaceholder: "Describe your experience at this business \u2014 quality, service, atmosphere, value for money...",
    proLabel: "What did you love?",
    conLabel: "What fell short?",
    proPlaceholder: "e.g. Amazing fresh pasta",
    conPlaceholder: "e.g. Small seating area",
  },
  event: {
    label: "Event",
    icon: "🎪",
    nameLabel: "What event are you reviewing?",
    namePlaceholder: "e.g. WWDC 2025, Austin City Limits",
    sourceLabel: "How did you attend?",
    sourceOptions: [
      { value: "in_person", label: "Attended in person" },
      { value: "virtual", label: "Attended virtually" },
      { value: "volunteer", label: "Volunteered" },
      { value: "speaker", label: "Speaker/performer" },
    ],
    durationLabel: "Event duration",
    durationOptions: [
      { value: "few_hours", label: "A few hours" },
      { value: "one_day", label: "One day" },
      { value: "multi_day", label: "Multi-day" },
      { value: "ongoing", label: "Ongoing/recurring" },
    ],
    showPurchaseChannel: false,
    showLocation: true,
    locationLabel: "Venue / location",
    locationPlaceholder: "e.g. Moscone Center, San Francisco",
    suggestedDimensions: ["Organization", "Content", "Venue", "Value", "Networking"],
    reviewPlaceholder: "Describe the event \u2014 organization, content quality, venue, crowd, and whether it was worth attending...",
    proLabel: "What was great?",
    conLabel: "What could be better?",
    proPlaceholder: "e.g. Top-notch speakers",
    conPlaceholder: "e.g. Poor Wi-Fi at venue",
  },
  experience: {
    label: "Experience",
    icon: "🎓",
    nameLabel: "What experience are you reviewing?",
    namePlaceholder: "e.g. Coursera ML course, CrossFit membership",
    sourceLabel: "How are you participating?",
    sourceOptions: [
      { value: "enrolled", label: "Enrolled / signed up" },
      { value: "completed", label: "Completed" },
      { value: "trial", label: "Free trial" },
      { value: "gifted", label: "Gift / scholarship" },
    ],
    durationLabel: "How long have you been doing this?",
    durationOptions: [
      { value: "just_started", label: "Just started" },
      { value: "few_weeks", label: "A few weeks" },
      { value: "few_months", label: "A few months" },
      { value: "completed", label: "Completed / 6+ months" },
    ],
    showPurchaseChannel: false,
    showLocation: false,
    suggestedDimensions: ["Content Quality", "Instructor", "Value", "Difficulty", "Support"],
    reviewPlaceholder: "Describe your experience \u2014 what you learned, how it was delivered, who it's best for...",
    proLabel: "What stood out?",
    conLabel: "What was lacking?",
    proPlaceholder: "e.g. Hands-on projects",
    conPlaceholder: "e.g. Outdated material",
  },
};

// Helper: get config for a subject type (defaults to product)
export function getSubjectConfig(type?: SubjectType | string): SubjectTypeConfig {
  return SUBJECT_TYPE_CONFIGS[(type as SubjectType) ?? "product"] ?? SUBJECT_TYPE_CONFIGS.product;
}

// Subject type display labels for the type picker
export const SUBJECT_TYPE_OPTIONS = Object.entries(SUBJECT_TYPE_CONFIGS).map(
  ([value, config]) => ({ value: value as SubjectType, label: config.label, icon: config.icon })
);

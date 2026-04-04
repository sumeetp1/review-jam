# Review Jam — Full Product Context

> Last updated: 2026-04-04
> Codebase: `/review-marketplace` (Next.js 16, Firebase, Gemini AI)

---

## 1. What Review Jam Is

Review Jam is an **engagement-weighted review marketplace**. It is not an influencer platform and not an affiliate network.

The core idea: verified product owners write honest reviews (positive or negative), those reviews earn payouts proportional to the engagement they generate, and brands sponsor product pages — not individual reviewers. A scathing 1-star review that earns 400 likes earns more than a glowing 5-star nobody reads.

Key design principles:
- **Brand interest is decoupled from review sentiment** — brands fund a pool, engagement decides who earns
- **Organic reviews outrank paid reviews** in discovery (1.2× weight multiplier)
- **Bias is penalised algorithmically** — health score -15 for reviews with no cons, 0.8× weight if flagged
- **Ownership evolves over time** — reviewers post 1-month, 6-month, 1-year updates (Ownership Journey)
- **Community-first structure** — every product lives inside a community at `/c/[community]/[product]`

---

## 2. URL Structure

| Route | Description |
|---|---|
| `/` | Homepage — review feed, category filter, featured products |
| `/explore` | Browse all products by discovery rank, rating, likes |
| `/c` | All communities list (searchable, filterable) |
| `/c/[communitySlug]` | Community home — products, reviews, members |
| `/c/[communitySlug]/[productSlug]` | Product hub — reviews, Q&A, Ownership Journey, forks |
| `/profile` | Reviewer profile — wallet, earnings, trust score, badges, history |
| `/brands` | Brand landing page |
| `/brands/dashboard` | Brand dashboard — view reviews, manage bounties |
| `/brands/widgets` | Embed widget generator |
| `/admin` | Admin dashboard (restricted to ADMIN_EMAIL) |
| `/product/[productId]` | Legacy route — redirects to slug-based URL |
| `/channels`, `/channels/[slug]` | Legacy routes — redirect to `/c` |

### Slug routing

Products are addressed by slug pair, not Firestore ID:

```
/c/tech/sony-wh-1000xm6
/c/saas/linear-project-management
/c/fitness/whoop-5-0-band
```

Lookup query: `where("communitySlug","==", x) + where("slug","==", y)`

---

## 3. Data Model

### Firestore Collections

| Collection | Purpose |
|---|---|
| `products` | Product hubs |
| `reviews` | All reviews |
| `channels` | Communities |
| `channelMembers` | User → community membership |
| `users` | User profiles, trust score, wallet |
| `payoutLedger` | Payout history per reviewer |
| `moderationEvents` | AI + deterministic moderation audit log |
| `reviewComments` | Threaded comments on reviews |
| `reviewForks` | Counter-take / fork relationships |
| `productDiscussions` | Q&A posts on product pages |
| `productDiscussionAnswers` | Answers to Q&A (with verifiedOwner flag) |
| `campaignApplications` | Applications to brand campaigns |
| `inventory` | Seeded product inventory for trusted reviewers |
| `seedingInvites` | Trusted reviewer invitations |
| `leads` | Brand enquiry signups |
| `notifications` | Per-user notification feed |
| `reviews/[id]/versions` | (subcollection) Ownership Journey version entries |
| `products/[id]/productVariants` | (subcollection) Product colour/size variants |

---

### `products` document

```typescript
{
  name: string
  brandName: string
  brandEmail: string            // lowercase — used to auth brand dashboard
  category: string              // see Category List below
  slug: string                  // e.g. "sony-wh-1000xm6"
  communitySlug: string         // canonical community, e.g. "tech"
  communityTags?: string[]      // cross-referenced communities (admin-only to add)
  coverImage?: string           // hero image URL
  description?: string
  specs?: { label: string; value: string }[]
  variants?: string[]           // names (written to subcollection)
  verifiedSkus?: string[]       // SKUs accepted for receipt verification
  budget?: number               // campaign budget in dollars
  endDate: string               // ISO — when campaign/pool closes
  campaignId: string            // unique identifier, or "organic"
  communitySeeded?: boolean     // true if no verified owner has reviewed yet
  createdAt: string
}
```

**Category list:** Tech · Home · SaaS · Automotive · Beauty · Gaming · Fitness · Travel · Finance

---

### `reviews` document

```typescript
{
  productId: string
  productName: string
  productSlug?: string
  communitySlug?: string
  category: string
  campaignId: string            // "organic" | campaign ID
  reviewerId: string            // Firebase UID
  reviewerName: string

  rating: number                // 1–5
  summary?: string              // headline shown on card
  content: string               // full review text
  pros?: string[]               // up to 5
  cons?: string[]               // up to 5
  bestFor?: string[]
  subRatings?: Record<string, number>  // e.g. { Performance: 4, Build: 5 }
  mediaUrls?: string[]          // image / video URLs

  // Engagement
  likesCount: number
  likedBy: string[]
  helpfulCount: number
  helpfulBy: string[]
  notHelpfulCount: number
  notHelpfulBy: string[]
  commentCount: number

  // Quality scores
  healthScore: number           // 0–100
  healthScoreBreakdown: {
    quality: number             // max 40
    engagement: number          // max 25
    credibility: number         // max 20 (+20 if verified purchase)
    freshness: number           // max 15
  }

  // Variant
  variantId?: string
  variantName?: string          // e.g. "Midnight Black"

  // Source & verification
  productSource: "purchased" | "brand_sent" | "gift"
  isVerifiedPurchase?: boolean  // receipt OCR verified
  usageDuration: "less_1_week" | "1_4_weeks" | "1_3_months" | "3_plus_months"
  purchaseChannel?: "amazon" | "brand_website" | "retail" | "other"

  // Review type
  isCampaignReview: boolean
  reviewType: "verified" | "campaign" | "generic"
  eligibleForPayout?: boolean

  // Versioning
  versionCount?: number
  latestVersionLabel?: string
  lastUpdatedAt?: string

  // Forking
  forkedFromReviewId?: string
  forkedFromReviewerName?: string
  forkCount?: number

  // Moderation
  biasFlag?: boolean            // over-positive / marketing language flagged

  // Legacy community fields
  channelId?: string
  channelSlug?: string          // kept for backward compat; prefer communitySlug

  createdAt: string
}
```

---

### `users` document

```typescript
{
  email: string
  displayName?: string
  photoURL?: string
  trustScore: number
  badges: string[]              // e.g. ["verified_buyer", "tech_expert"]
  walletBalance: number
  totalEarned: number
  interests: string[]           // product categories
  createdAt: string
}
```

---

### `channels` (communities) document

```typescript
{
  slug: string                  // matches product.communitySlug
  name: string
  description: string
  category: string
  iconEmoji: string
  memberCount: number
  reviewCount: number
  multiplier: number            // 1.0 = normal, 1.5+ = boosted (🔥 badge)
  multiplierExpiresAt?: string
  multiplierSponsoredBy?: string
  isOfficial: boolean
  creatorId: string
  creatorName: string
  createdAt: string
}
```

---

### `payoutLedger` document

```typescript
{
  userId: string
  campaignId: string
  productName: string
  amount: number                // dollars
  rawLikes: number
  hasPhoto: boolean
  status: "pending" | "paid"
  paidAt: string
}
```

---

### `reviewVersions` subcollection (`reviews/[id]/versions`)

```typescript
{
  versionNumber: number         // 2, 3, 4... (original is implicitly v1)
  versionLabel: string          // "1 Month Update" | "3 Month Update" | "1 Year Update"
  content: string
  rating: number
  pros: string[]
  cons: string[]
  subRatings: Record<string, number>
  mediaUrls: string[]
  createdAt: string
}
```

---

## 4. Algorithms

### Health Score (0–100)

Computed by `lib/healthScore.ts`. Determines payout priority.

```
QUALITY (max 40)
  content length:  300+ chars = 10 | 100–299 = 5 | 50–99 = 2 | < 50 = 0
  pros:            1 pt each, up to 5
  cons:            1 pt each, up to 5
  sub-ratings:     3+ keys = 5 | 2 = 3 | 1 = 1 | 0 = 0
  media:           5 pts if mediaUrls.length > 0
  summary:         5 pts if 10+ chars
  bestFor tags:    5 pts if present
  PENALTY:         -15 if cons array is empty (Critical Balance)

ENGAGEMENT (max 25)
  likes:     log₂(count + 1) × 2  → max ~8
  helpful:   log₂(count + 1) × 2  → max ~7
  comments:  min(count, 5)         → max 5
  forks:     min(count × 2.5, 5)  → max 5

CREDIBILITY (max 20, can spike to 35 with verified purchase)
  badges:                 min(count × 2, 10)
  reviewer review count:  min(count, 5)
  verified purchase:      +20 (instead of +5 for self-reported)

FRESHNESS (max 15)
  version updates:  min((versionCount - 1) × 5, 10)
  recency:          < 7 days = 5 | < 30 days = 3 | < 90 days = 1 | older = 0

TOTAL = min(quality + engagement + credibility + freshness, 100)
```

Badge: 🟢 70+ · 🟡 40–69 · 🔴 < 40

---

### Discovery Rank

Computed by `lib/discoveryRank.ts`. Determines order on Explore and Home feed.

```
DR = (weightedAvgHealthScore × reviewCount) / log(daysSinceLastReview + 2)

Weight per review:
  organic + unbiased:   1.2 × 1.0 = 1.20  (highest)
  organic + biased:     1.2 × 0.8 = 0.96
  campaign + unbiased:  1.0 × 1.0 = 1.00
  campaign + biased:    1.0 × 0.8 = 0.80  (lowest)
```

Log denominator penalises stale products. Reviews with no timestamp treated as 365 days old.

---

## 5. Review Submission Flow

Three entry points in `ReviewWizard`:

| Type | Gate | Payout eligible |
|---|---|---|
| Generic | Any logged-in user | No |
| Campaign | Must enter valid campaign code / SKU | Yes (from campaign pool) |
| Verified | Must upload purchase receipt (OCR verified) | Higher weight |

**Steps:**
1. Select product (or type new name)
2. Choose review type
3. Enter rating + summary + pros/cons + content + sub-ratings + variant + usage duration
4. Optionally upload media (photos/videos)
5. Submit → deterministic pre-checks → AI moderation (Gemini) → write to Firestore

**Moderation logic:**
1. Deterministic (no API cost): word count ≥ 6, no gibberish, no test keywords, vocabulary diversity ≥ 0.45
2. AI (Gemini): genuine experience check, balanced check, marketing-copy detection
3. `biasFlag = true` if: excessive superlatives, zero criticism, marketing language, contradictions
4. All moderation decisions logged to `moderationEvents`

Admin can disable AI moderation globally via `/admin` → AI Check toggle.

---

## 6. Receipt Verification

Endpoint: `POST /api/verify-receipt`

- Accepts: image (base64, max 6 MB)
- Model: Gemini vision (same fallback chain)
- Extracts: store name, purchase date, detected product, confidence
- Returns: `{ isVerified: boolean, storeName, purchaseDate, detectedProduct, confidence }`
- On success: sets `isVerifiedPurchase: true` on the review
- Health score impact: +20 credibility points (vs. +5 for self-reported)

---

## 7. Communities

Communities live in the `channels` Firestore collection (legacy name, UI shows "Communities").

- Each community has a **slug** that matches product `communitySlug`
- Products have a **canonical** community (`communitySlug`) — one only
- Products can be **cross-referenced** into other communities (`communityTags[]`) — admin-only action
- Community page (`/c/[slug]`) shows: canonical products + tagged products (with `#origin-community` badge)
- Users can join/leave communities
- Communities can be **boosted** (`multiplier > 1`) — shown with 🔥 badge on Explore and Home

---

## 8. Ownership Journey

When a reviewer has owned a product for months, they can post version updates:

- Click "Add Update" on their review → `VersionUpdateWizard` modal
- Each update creates a doc in `reviews/[id]/versions` subcollection
- Parent review `versionCount` and `latestVersionLabel` update
- Product hub shows an **Ownership Journey** card when `versionCount > 1`
- Freshness health score benefits: up to +10 pts from versions
- Seeded examples: Alex Chen's Sony review (v1 → 3mo → 6mo), Chris Meyers' Rivian (v1 → 3mo → 1yr)

---

## 9. Forking / Counter-Takes

Any user can fork a review to add a differing perspective:

- Creates `reviewForks` collection entry linking original → fork
- Original review gets `forkCount` incremented
- Product hub shows forked reviews in a split "Original vs Counter-take" panel
- Disagreements (pros/cons that differ) highlighted
- Seeded examples: Priya forks Alex (Sony XM6), Leo forks Tom (PS5 Pro, 3★ vs 5★)

---

## 10. Trust Score & Badges

**Automatic badges** (computed from review history):
- `verified_buyer` — any review with `productSource = "purchased"`
- `campaign_reviewer` — participated in a campaign
- `prolific_reviewer` — 5+ reviews submitted
- `photo_reviewer` — uploaded media in any review
- `[category]_expert` — 3+ reviews in same category (e.g. `tech_expert`, `fitness_expert`)

**Trust score tiers:**
| Score | Tier | Emoji |
|---|---|---|
| 500+ | Legend | 🏆 |
| 250–499 | Authority | ⭐ |
| 100–249 | Trusted | ✅ |
| 50–99 | Contributor | 🔵 |
| 0–49 | Newcomer | 🌱 |

Milestones (50, 100, 250, 500, 1000) trigger in-app notifications.

---

## 11. Brand Features

Brands are identified by email (`brandEmail` on product doc — no separate auth).

### Brand Dashboard (`/brands/dashboard`)
- View all products belonging to their email
- See all reviews per product (sorted by likes/engagement)
- Create **sponsored bounties** on community categories (1.5× or 2.0× multiplier)
- Cannot approve, reject, or delete reviews

### Brand Widget (`/brands/widgets`)
- Generates embed code (`<iframe>`) for external websites
- Widget shows product + review form
- Reviews from widget tagged with source
- Visits tracked via `/api/visit`

---

## 12. Admin Features

Restricted to `ADMIN_EMAIL = "sumit.pandey75@gmail.com"`.

| Feature | Description |
|---|---|
| Create product | Form to create product hub with variants + specs |
| Campaign applications | Approve / reject / mark product sent |
| Moderation log | AI + deterministic decisions, filter by date/source |
| AI toggle | Enable/disable Gemini checks globally |
| Seed database | Wipe + repopulate with 9 canonical products + 21 reviews + 9 communities |
| Migrate product slugs | Add `slug` + `communitySlug` to legacy products |
| Trusted reviewer management | Invite reviewers, assign to inventory |
| Payout statistics | Total distributed, eligible reviews, unique reviewers |
| Seed personal data | Create profile + 3 verified reviews for admin account |
| Community tag manager | Add/remove `communityTags` on any product |

---

## 13. AI / Gemini Usage

All Gemini calls share the same model fallback chain:

```typescript
const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,       // override via env
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite-preview-06-17",
  "gemini-2.0-flash",
].filter(Boolean)
```

Endpoints that call Gemini:
- `/api/agent` — review moderation + bias detection
- `/api/verify-receipt` — receipt OCR + purchase verification
- `/api/seed-product` — AI product enrichment (auto-fills brand/category/specs/variants)

---

## 14. Avatars & Visual Identity

### User avatars
- Real photo if `photoURL` is set (Google account photo)
- Falls back to **identicon** (deterministic 5×5 grid, GitHub-style) derived from display name hash
- Each name produces a unique HSL color + mirrored pattern — no two look alike

### Community icons
- Emoji icon set on community creation (stored as `iconEmoji`)
- Rendered with gradient ring in sidebar and community pages
- Passed as `emoji` prop to `Avatar` component

### Color theme
- **Brand**: indigo (#6366f1) → violet (#8b5cf6)
- **Stars / ratings**: amber (gold — universal convention)
- **Tier 1 badge**: amber (Legend 🏆)
- **Boosted**: violet
- **Seeded**: violet
- **Health score**: emerald (good) · amber (ok) · red (poor)
- **Verified owner**: emerald

---

## 15. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Firestore (client SDK) |
| Auth | Firebase Auth (Google OAuth) |
| Storage | Firebase Storage (media uploads) |
| AI | Google Generative AI (Gemini) |
| Deployment | Vercel |
| Repo | GitHub (`sumeetp1/review-jam`) — main branch only |

### Environment variables

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
GEMINI_API_KEY
GEMINI_MODEL              # optional, has fallbacks
```

---

## 16. Seed Data (Reference)

After running Admin → Seed Database:

| Product | Community | Slug | Cover |
|---|---|---|---|
| Sony WH-1000XM6 | tech | `sony-wh-1000xm6` | headphones photo |
| Lumina Smart Standing Desk | home | `lumina-smart-standing-desk` | desk photo |
| Linear — Project Management | saas | `linear-project-management` | laptop photo |
| Rivian R2 SUV | automotive | `rivian-r2-suv` | EV photo |
| Rhode Peptide Lip Treatment | beauty | `rhode-peptide-lip-treatment` | cosmetics photo |
| PlayStation 5 Pro | gaming | `playstation-5-pro` | console photo |
| Whoop 5.0 Band | fitness | `whoop-5-0-band` | wearable photo |
| IHG One Rewards — Indigo Hotels | travel | `ihg-one-rewards-indigo-hotels` | hotel photo |
| Robinhood Gold | finance | `robinhood-gold` | finance photo |

Each product has 3 variants and 4–5 specs. 21 reviews seeded covering:
- Ownership journeys (Sony × 3 versions, Rivian × 3 versions, Whoop × 2 versions)
- Forked counter-takes (Sony, Rivian, PS5 Pro, Whoop)
- Bias-flagged review with no cons (Sony)
- Mixed ratings (3★, 4★, 5★)
- Photo media on 5 reviews (Sony, Lumina, Rivian, PS5, Whoop)
- Threaded comments on Sony and Linear
- Q&A answers with Verified Owner badges (Sony, Rivian, Linear)
- 9 canonical communities matching product `communitySlug` values

---

## 17. What Is Not Yet Built (Planned)

### Sponsor Pool model (designed, not implemented)

The next major feature decouples brand sponsorship from individual review assignment:

- Brand deposits a budget into a `sponsorPools` document on a product
- Any verified purchaser can write freely — no brand approval gate
- Payout calculated weekly based on each review's share of total pool engagement
- Formula: `share = reviewEngagementScore / totalPoolEngagement; payout = min(share × budget, perReviewCap)`
- Engagement score: `likes×1 + helpfulVotes×1.5 + comments×2 + forks×3`
- Negative reviews fully eligible — the pool is rating-agnostic
- Brand interest decoupled from review sentiment entirely

Requires: `sponsorPools` collection, payout engine update, brand dashboard pool creation UI, product hub pool indicator, reviewer profile pool earnings view.

---

## 18. Key Design Decisions & Rationale

| Decision | Rationale |
|---|---|
| Organic reviews weighted 1.2× over campaign | Surfaces honest signal above paid promotion |
| Bias flag reduces weight (0.8×) but doesn't delete | Transparency — reviewer knows, community sees |
| No cons = -15 health score penalty | Structurally discourages marketing-speak reviews |
| Brands cannot approve/reject reviews | Preserves editorial independence |
| Single canonical community per product | Clean URL + clear ownership; cross-tagging for discovery |
| `channels` Firestore collection kept | Legacy data compatibility; UI shows "Communities" |
| Gemini fallback chain | Graceful degradation if primary model is unavailable |
| Client-side Firestore SDK | Avoids server round-trips for all read operations |
| All commits directly to `main` | Single-branch deployment workflow |

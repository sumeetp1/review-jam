# Review Jam — Full Product Context (April 2026)

> **How to use:** Paste this entire file into Gemini as your first message. It gives full context of what Review Jam is, what's built, the complete technical stack, every feature implemented so far, and the known gaps. Then ask Gemini to help brainstorm next features or structural changes.

---

## What is Review Jam?

Review Jam is a **paid review marketplace** — a platform at the intersection of consumer reviews, brand marketing, and community-driven content.

> **Brands pay a budget to get authentic product reviews. Reviewers earn a share of that budget based on the quality of their review.**

Unlike traditional review platforms (Amazon, Google, Trustpilot) where reviews are free and uncompensated, Review Jam creates a direct economic incentive loop:

- **Brands** get real, detailed, structured reviews with photos, pros/cons, and marketing quotes — instead of paying for ads nobody trusts.
- **Consumers** get paid for the time and effort they put into honest reviews — proportional to how good and how engaged their review is.
- **Community** gets a Reddit-style social layer — channels (rj/tech, rj/beauty), comment threads, review forks (write your counter-take), and version updates (come back in 3 months and tell us how the product held up).

---

## The Problem We're Solving

**For consumers:**
- You spend 20 minutes writing a detailed Amazon review with photos, pros/cons, breakdown — and get nothing. Amazon profits. Brand profits. You don't.
- Fake reviews are everywhere. People don't trust reviews anymore. No system validates quality or rewards authenticity.

**For brands:**
- Influencer marketing is expensive, opaque, often inauthentic.
- Running ads is expensive and people tune them out.
- Getting honest, detailed, structured reviews at scale is hard and slow.
- Brands have no easy way to get real-world usage feedback beyond star ratings.

**What Review Jam does differently:**
- Reviews are scored 0–100 by a Health Score (quality, engagement, credibility, freshness) — not just star ratings.
- Payout is proportional to Health Score — writing better reviews literally pays more.
- Reviews can be updated over time (1mo, 3mo, 1yr updates) — a product's review quality improves over time rather than decaying.
- Community moderation through forking, likes, helpfulness votes, and threaded comments.

---

## Current Stage

**Early-stage MVP — fully functional, running on Firebase, deployed via Vercel. Not yet publicly launched.**

### All Features Currently Implemented

#### Core Review System
- **ReviewWizard** — 7-step modal: Context → Your Review → Proof of Purchase (organic only) → Finish
  - Campaign reviews: 3 steps (no receipt step)
  - Organic reviews: 4 steps (includes receipt upload step)
  - Fields: product name, category, overall rating, sub-ratings (Sound/Comfort/Battery etc.), content, pros, cons, summary, "best for" tags, media uploads, usage duration, purchase channel
  - Media upload to Firebase Storage with preview
- **Organic Verified Reviews** — proof-of-purchase flow
  - Step 3: Upload receipt photo → Gemini Vision parses it (store name, date, detected product)
  - `isVerifiedPurchase: true` stored on review if Gemini confirms purchase
  - Badge: `✓ Verified Owner` (emerald) for organic verified reviews
  - Badge: `📦 Product Provided` (amber) for campaign reviews
- **ReviewCard** — full display: avatar, name, badge stack, star rating, health score, variant tag, transparency badges, content, pros/cons pills, media gallery, action bar
- **Review Actions:** Like (toggle), Helpful (toggle), Not Helpful (toggle), Fork, Comment, Timeline
- **Review Timeline** — version history display (original → updates)
- **VersionUpdateWizard** — post a 1mo/3mo/6mo/1yr update to an existing review

#### Health Score System
- **Formula:** Quality(40) + Engagement(25) + Credibility(20) + Freshness(15) = 0–100
  - Quality: content length, pros count, cons count, sub-ratings, media, summary, best-for
  - Engagement: log-scaled likes, helpful votes, comments, forks
  - Credibility: reviewer badge count, reviewer review count, verified purchase
  - Freshness: version update count, recency of review
- **HealthScoreBadge component** — score pill that expands into breakdown popover
- Computed and stored on review creation in admin seeder and campaign reviews

#### Discovery Rank Algorithm
- **Formula:** `DR = (weightedAvgHealthScore × reviewCount) / log(daysSinceLastReview + 2)`
- Organic reviews get 1.2× health score weight vs campaign reviews (1.0×)
- `/explore` page defaults to "🔥 Discovery" sort, shows DR score badge per card
- Home feed (`/`) sorts by per-review DR on load (replaces raw likes sort)
- Pure utility in `lib/discoveryRank.ts`

#### Parent-Child SKU Variant Support
- Products have a `productVariants` subcollection `{ id, name, createdAt }`
- ReviewWizard requires variant selection when product has variants (step 1)
- Reviews store `variantId` and `variantName`
- ProductDetail page: per-SKU aggregate stats row + variant filter pills
- Admin campaign creation: dynamic variant rows with add/remove
- Seeder seeds all 9 campaigns with 2–4 named variants

#### Campaign System
- Brands create campaigns with budget + duration via `/brands` lead form
- Admin creates campaign products via `/admin`
- Reviewers browse active campaigns at `/campaigns` and apply
- Admin manages applications (approve/reject/product_sent) at `/admin`
- Campaign reviews: `isCampaignReview: true`, `eligibleForPayout: true`
- Payout distribution: `POST /api/payout` — splits budget proportionally by health score

#### Brand Trust Widget System
- **`/api/widget/[productId]`** — GET returns standalone HTML (no root layout, iframe-safe)
  - Fetches live product + reviews from Firestore
  - Computes weighted avg Health Score (uses stored `healthScore`, falls back to `computeHealthScore()`)
  - Aggregates top-3 pros/cons by mention frequency across all reviews
  - Self-contained inline-CSS card: score ring (green/amber/red), stars, review count, pros/cons, CTA button
  - `?theme=light|dark|auto` — auto respects `prefers-color-scheme`
  - Cache headers: `s-maxage=3600, stale-while-revalidate=86400`
  - `frame-ancestors *` — works in any third-party iframe
- **`/brands/widgets`** — widget generator UI (brand auth-gated)
  - Product selector + theme picker (Auto/Light/Dark)
  - Live iframe preview with fake browser chrome
  - Three copy-ready snippets: `<iframe>`, React component, plain HTML
  - Copy URL button for raw endpoint
- **`/brands` landing page** — feature card grid + tier comparison table
  - Trust Widget highlighted as "$500+ tier" feature with amber styling
  - Tier table: Starter ($500) / Growth ($1,000) / Scale ($5,000+)

#### Community Layer
- **Channels** — `rj/` prefixed (e.g. `rj/tech`, `rj/beauty`)
- `/channels` — directory of all channels, create new, join/leave
- `/channels/[slug]` — channel feed, post reviews within channel, sort by score/likes/new
- **Review Forking** — write a counter-review that references the original
- **Threaded Comments** — on individual reviews, max depth 2
- **Version Updates** — update a review after 1mo, 3mo, 6mo, 1yr

#### User System
- **Firebase Auth** — Google Sign-In only
- **Onboarding modal** — select interest categories on first login → personalises feed
- **`/profile`** — wallet balance, earnings ledger, badges, review history with health scores, interests
- **Badges** — 13 badges: Verified Buyer, Campaign Reviewer, Prolific Reviewer, Photo Reviewer, 9× Category Expert (Tech/Home/Beauty/Gaming/Fitness/SaaS/Auto/Travel/Finance)
- **Avatar** — deterministic gradient (10 options, hash by name) with `<Avatar>` component (xs/sm/md/lg sizes)

#### Feed & Explore
- **Home feed** — tabs: For You / Trending / Campaigns
  - For You: filtered by user interest categories
  - Trending: likes/daysSince velocity score
  - Campaigns: only campaign reviews
  - Sorted by Discovery Rank on load
- **`/explore`** — product grid: search, category filter, sort (🔥 Discovery / Most liked / Most reviewed / Highest rated / Newest)
- **Category chips** — horizontal scroll, all 9 categories + All

#### Admin Panel (`/admin`)
- **Seed Database** — deletes all and inserts 9 campaigns + 45 reviews + channels + comments + forks
- **Seed Widget Demo** — non-destructive: adds SonicPulse X1 under sumit.pandey75@gmail.com with 6 rich reviews
- **AI Moderation Toggle** — enable/disable Gemini review checking via `config/moderation` doc
- **Campaign Applications** — approve/reject/mark product sent
- **Payout Distribution** — enter campaign ID + budget → calls `/api/payout`
- **Moderation Events log** — date range filter, source filter, CSV export, approval rate stats

#### AI Integration (Gemini)
- **`/api/agent`** — review moderation: checks if review is genuine, returns `isGenuine`, `reason`, `marketingQuote`
- **`/api/verify-receipt`** — receipt OCR: Gemini Vision parses uploaded receipt image, returns `storeName`, `purchaseDate`, `detectedProduct`, `isVerified`, `confidence`
- Model chain: env `GEMINI_MODEL` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-1.5-flash`

---

## Complete Tech Stack

| Layer | Detail |
|-------|--------|
| Framework | Next.js 16.2.1 (Turbopack), App Router |
| React | React 19, all pages `"use client"` |
| Styling | Tailwind CSS v4, `@theme inline` in globals.css, amber brand `#f59e0b` |
| Database | Firebase Firestore (client SDK — no Admin SDK) |
| Auth | Firebase Auth, Google Sign-In only |
| Storage | Firebase Storage — review photos |
| AI | Google Gemini 2.0 Flash — moderation + Vision receipt parsing |
| Hosting | Vercel |
| Payments | None — walletBalance is a Firestore number |

**Important Next.js 16 notes:**
- Dynamic route params are `Promise<{ param: string }>` — must `await params`
- Client component dynamic params use `use(params)` from React
- API routes return `new Response(html, { headers })` — no NextResponse needed for HTML
- No pages router — App Router only

---

## Complete File Structure

```
app/
  page.tsx                    — Home feed (For You/Trending/Campaigns tabs)
  layout.tsx                  — Root layout (BottomNav, VisitorCounter, Geist fonts)
  globals.css                 — Tailwind v4 + CSS variables
  explore/page.tsx            — Product browser with Discovery Rank sort
  campaigns/page.tsx          — Active campaign browser + application flow
  channels/page.tsx           — Channel directory
  channels/[slug]/page.tsx    — Individual channel feed
  product/[productId]/page.tsx — Product detail + variant filter + reviews
  profile/page.tsx            — User wallet, badges, review history
  brands/page.tsx             — Brand landing page (features + tier table)
  brands/dashboard/page.tsx   — Brand analytics (reviews, quotes, likes)
  brands/widgets/page.tsx     — Trust Widget generator (auth-gated)
  admin/page.tsx              — Admin panel (seed, moderate, payout, applications)
  api/
    agent/route.ts            — Gemini review moderation
    payout/route.ts           — Budget distribution by health score
    verify-receipt/route.ts   — Gemini Vision receipt OCR
    visit/route.ts            — Unique visitor counter
    widget/[productId]/route.ts — Standalone widget HTML endpoint
  components/
    ReviewCard.tsx            — Core review display unit
    ReviewWizard.tsx          — 7-step review creation modal
    HealthScoreBadge.tsx      — Score pill with breakdown popover
    Avatar.tsx                — Gradient avatar with initials fallback
    LeftSidebar.tsx           — Left nav (channels, campaigns, links)
    RightSidebar.tsx          — Top Reviews leaderboard
    BottomNav.tsx             — Mobile 5-tab bar
    ReviewTimeline.tsx        — Version history display
    VersionUpdateWizard.tsx   — Post review update modal
    CreateChannelModal.tsx    — Create rj/ channel modal
    VisitorCounter.tsx        — Unique visitor tracker

lib/
  firebase.ts                 — Firebase app, db, auth, storage, googleProvider
  healthScore.ts              — computeHealthScore(review, badgeCount, reviewCount)
  discoveryRank.ts            — calculateDiscoveryRank(reviews[]) → DR score
  badges.ts                   — ALL_BADGES const + updateUserBadges(userId)
```

---

## Firestore Collections (Complete Schema)

| Collection | Key Fields |
|-----------|-----------|
| `users` | `uid`, `email`, `displayName`, `interests[]`, `walletBalance`, `totalEarned`, `badges[]`, `createdAt` |
| `reviews` | `productId`, `productName`, `category`, `campaignId`, `reviewerId`, `reviewerName`, `rating`, `content`, `pros[]`, `cons[]`, `summary`, `marketingQuote`, `isCampaignReview`, `isVerifiedPurchase`, `healthScore`, `healthScoreBreakdown{}`, `likesCount`, `likedBy[]`, `helpfulCount`, `helpfulBy[]`, `notHelpfulCount`, `notHelpfulBy[]`, `commentCount`, `forkCount`, `versionCount`, `variantId`, `variantName`, `channelId`, `channelSlug`, `mediaUrls[]`, `subRatings{}`, `bestFor[]`, `productSource`, `usageDuration`, `purchaseChannel`, `eligibleForPayout`, `createdAt` |
| `reviews/{id}/versions` | `content`, `rating`, `pros[]`, `cons[]`, `summary`, `label` (e.g. "1 Month Update"), `createdAt` |
| `reviewComments` | `reviewId`, `userId`, `userName`, `content`, `parentCommentId`, `depth`, `createdAt` |
| `reviewForks` | `originalReviewId`, `forkReviewId`, `forkerId`, `forkerName`, `createdAt` |
| `products` | `name`, `brandName`, `brandEmail`, `category`, `campaignId`, `description`, `budget`, `endDate`, `createdAt` |
| `products/{id}/productVariants` | `name`, `createdAt` |
| `channels` | `name`, `slug`, `description`, `category`, `memberCount`, `createdBy`, `createdAt` |
| `channelMembers` | `channelId`, `userId`, `joinedAt` |
| `campaignApplications` | `userId`, `userName`, `userEmail`, `productId`, `productName`, `brandName`, `campaignId`, `notes`, `status` (applied/approved/rejected/product_sent), `appliedAt` |
| `payoutLedger` | `userId`, `userName`, `campaignId`, `amount`, `healthScore`, `rank`, `createdAt` |
| `leads` | `companyName`, `email`, `budget`, `duration`, `status`, `createdAt` |
| `moderationEvents` | `reviewerName`, `reviewPreview`, `isGenuine`, `reason`, `marketingQuote`, `source`, `createdAt` |
| `siteStats` | `uniqueVisitors`, `lastUpdated` |
| `config` | `aiCheckEnabled` (doc: `moderation`) |

**Not yet implemented (gaps):**
- `notifications` collection — needed for reputation system
- `trustScore` field on `users` — needed for reputation system

---

## How the Money Works

1. Brand creates campaign with budget (e.g. $500), sends products to approved reviewers.
2. Reviewers write reviews. Each gets a Health Score (0–100).
3. Admin distributes: `POST /api/payout` splits budget proportionally by Health Score.
   ```
   Reviewer A score 80  →  80/180 = 44%  →  $220
   Reviewer B score 60  →  60/180 = 33%  →  $165
   Reviewer C score 40  →  40/180 = 22%  →  $110
   ```
4. Earnings sit in `walletBalance` + `payoutLedger` entry. No real payment rails yet.

---

## Known Gaps / Not Built Yet

1. **No real payment rails** — walletBalance is a Firestore number; no Stripe/bank transfer
2. **No email notifications** — no emails when approved for campaign, payout sent, comment reply
3. **No real-time updates** — feed doesn't auto-refresh; must reload
4. **No full-text search** — client-side filter only on already-loaded data
5. **No feed pagination** — loads all reviews at once, will break at scale
6. **No onboarding walkthrough** — new users land on feed cold
7. **Single admin hardcoded** — ADMIN_EMAIL const in admin/page.tsx
8. **No brand self-serve** — brands can't create campaigns; goes through admin
9. **No reviewer analytics** — can't see who viewed/shared their reviews
10. **No follow system** — can't follow reviewers or channels
11. **No PWA / service worker** — manifest exists but no offline support
12. **No referral system** — no growth mechanism
13. **trustScore + reputation system** — partially designed, not yet implemented (see below)
14. **notifications collection** — not yet implemented

---

## PENDING TASK: User Reputation System

This is the next feature to build. Full spec:

### 1. Add `trustScore` to users collection
- Field: `trustScore: number` (default 0, minimum 0)
- New utility: `lib/trustScore.ts` — `incrementTrustScore(userId, event, delta)` function
  - Writes `trustScore: increment(delta)` to `users/{userId}`
  - Reads new total → checks for milestone crossing → fires notification if milestone hit
- Increment rules:
  - **+3** when someone marks the user's review as `Helpful`
  - **+5** when the user posts an organic review (`isCampaignReview === false`)
  - **+10** when someone forks the user's review
- Milestones: 50, 100, 250, 500, 1000 → trigger a "New milestone" notification

### 2. notifications Firestore collection
```
notifications/{id}
  userId: string        ← recipient
  type: "payout_approved" | "comment" | "trust_milestone" | "helpful_vote" | "fork"
  title: string
  body: string
  link?: string         ← e.g. /product/xxx or /profile
  read: boolean
  createdAt: string
```

### 3. Notification triggers
- **payout_approved** — in `app/api/payout/route.ts`: for each payout winner, `addDoc(notifications, {...})`
- **comment** — in `app/channels/[slug]/page.tsx` (and wherever comments are posted): notify the review author
- **trust_milestone** — in `lib/trustScore.ts`: after incrementing, if new total crosses 50/100/250/500/1000

### 4. NotificationBell component (new `app/components/NotificationBell.tsx`)
- Bell icon (SVG) with unread count badge (amber circle)
- Click → dropdown panel slides down (max 5 items)
- Each item: icon by type, title, body, relative time, read/unread dot
- "Mark all read" button → batch-updates `read: true`
- Loads notifications via `onSnapshot` (real-time) for the logged-in user
- Unread count derived from snapshot

### 5. Wire NotificationBell into the header
- Add to desktop nav in `app/page.tsx` (right of the search bar)
- Also show in mobile menu panel

### 6. Display trustScore on profile
- Show `trustScore` in `/profile` page stats row alongside wallet balance
- Add trust tier labels: Newcomer (0–49) / Contributor (50–99) / Trusted (100–249) / Authority (250–499) / Legend (500+)

---

## Brand Identity & Tone

- **Name:** Review Jam
- **Brand color:** Amber/Orange (`#f59e0b` → `#f97316`)
- **Tone:** Honest, direct, community-first. Reddit meets Glassdoor meets a marketplace.
- **Channel prefix:** `rj/` (our version of Reddit's `r/`)
- **Dark mode:** Fully supported site-wide. Default follows system preference.

---

## Coding Conventions (Important for New Sessions)

- All pages are `"use client"` — no server components yet
- Dynamic params: `const { productId } = use(params)` in client components, `await params` in API routes
- Tailwind v4: use `@theme inline` for CSS variables, not `tailwind.config.js`
- Firebase: always import from `../../lib/firebase` (client SDK only)
- No `import type` needed for Firestore — types inferred from SDK
- Commit directly to `main` branch — no feature branches or PRs
- Health Score: always use `computeHealthScore()` from `lib/healthScore.ts`, never reimplement inline
- Avatar: always use `<Avatar>` component, never raw `<div>` initial circles
- Channel slugs: always `rj/` prefix, not `r/`

---

*Review Jam — April 2026*

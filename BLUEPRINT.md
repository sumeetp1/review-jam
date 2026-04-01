# Review Jam — Technical Blueprint & Handover Document

> **Purpose:** Complete technical reference for engineering teams taking over maintenance and scaling of the Review Jam platform.
> **Last updated:** April 2026
> **Branch:** `main`
> **Repo:** https://github.com/sumeetp1/review-jam

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [File & Folder Structure](#4-file--folder-structure)
5. [Page Routes & Wireframes](#5-page-routes--wireframes)
6. [Component Library](#6-component-library)
7. [Firestore Data Models](#7-firestore-data-models)
8. [API Routes](#8-api-routes)
9. [Business Logic](#9-business-logic)
10. [Authentication](#10-authentication)
11. [Environment Variables](#11-environment-variables)
12. [Local Development Setup](#12-local-development-setup)
13. [Build & Deployment](#13-build--deployment)
14. [Firebase Setup Checklist](#14-firebase-setup-checklist)
15. [Known Limitations & Scaling Notes](#15-known-limitations--scaling-notes)

---

## 1. Product Overview

Review Jam is a **paid review marketplace** where:

- **Consumers** write product reviews and earn a share of a brand's campaign budget proportional to the quality of their review (measured by a "Health Score").
- **Brands** create campaigns with a budget, send products to reviewers, and get authentic reviews with marketing quotes.
- **Community** features (Reddit-style channels, forking reviews, comment threads) drive engagement and trust.

### Core User Flows

```
CONSUMER
  → Sign in with Google
  → Browse campaigns → Apply → Receive product
  → Write review (multi-step wizard)
  → Earn payout when brand distributes budget

BRAND
  → Fill in lead form on /brands
  → Admin creates campaign in /admin
  → Approve reviewer applications
  → Trigger payout via /admin → /api/payout

COMMUNITY
  → Create / join channels (rj/slug)
  → Fork existing reviews (write a counter-review)
  → Comment on reviews (threaded, max depth 2)
  → Post version updates (1mo / 3mo / 6mo / 1yr)
```

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 16.2.1 | App Router, no Pages Router |
| UI Library | React | 19.2.4 | Client components (`"use client"`) |
| Styling | Tailwind CSS | v4 | `@theme inline` config in globals.css, no tailwind.config.ts |
| Database | Firebase Firestore | 12.11.0 | Client SDK (not Admin SDK) |
| Auth | Firebase Auth | 12.11.0 | Google OAuth only |
| Storage | Firebase Storage | 12.11.0 | Review media uploads |
| AI Moderation | Google Generative AI (Gemini) | ^0.24.1 | Server-side only via `/api/agent` |
| Language | TypeScript | ^5 | Strict mode off |
| Package Manager | npm | — | `package-lock.json` committed |
| Hosting | Vercel (assumed) | — | Standard Next.js deploy |

### Key Architectural Decisions

- **No backend server** — all data access uses the Firebase client SDK directly from the browser. No Node.js server layer for reads/writes.
- **No React Server Components** — every page is `"use client"`. Data is fetched inside `useEffect` on the client.
- **No state management library** — React `useState` / `useEffect` only.
- **AI moderation runs server-side** — Gemini API key is protected; only called from `/api/agent` route handler.
- **Health score is computed client-side** — `lib/healthScore.ts` is a pure function imported wherever needed; no Cloud Function required.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                             │
│                                                                      │
│  ┌─────────────┐  ┌────────────────────────────────────────────┐    │
│  │ LeftSidebar │  │              Main Feed / Page              │    │
│  │  - Navigate │  │  ┌──────────────────────────────────────┐  │    │
│  │  - Channels │  │  │           ReviewCard ×N              │  │    │
│  │  - Campaigns│  │  │  Avatar · HealthScoreBadge            │  │    │
│  │  - Resources│  │  │  CommentThread · ReviewTimeline       │  │    │
│  └─────────────┘  │  └──────────────────────────────────────┘  │    │
│                   │  ReviewWizard (modal) · VersionUpdate (modal)│   │
│  ┌─────────────┐  └────────────────────────────────────────────┘    │
│  │RightSidebar │                                                     │
│  │ Top Reviews │  ┌──────────────────────────────────────────────┐  │
│  │  leaderboard│  │              BottomNav (mobile)              │  │
│  └─────────────┘  └──────────────────────────────────────────────┘  │
└────────────────┬──────────────────────────────────────┬─────────────┘
                 │ Firebase SDK (direct)                 │ fetch()
                 ▼                                       ▼
┌───────────────────────────────┐   ┌────────────────────────────────┐
│        Firebase               │   │      Next.js API Routes        │
│                               │   │                                │
│  ┌─────────────────────────┐  │   │  POST /api/agent               │
│  │      Firestore          │  │   │    → Gemini AI moderation      │
│  │  15+ collections        │  │   │                                │
│  │  (see Section 7)        │  │   │  POST /api/payout              │
│  └─────────────────────────┘  │   │    → Budget distribution       │
│  ┌─────────────────────────┐  │   │                                │
│  │  Firebase Auth          │  │   │  GET/POST /api/visit           │
│  │  Google OAuth provider  │  │   │    → Unique visitor tracking   │
│  └─────────────────────────┘  │   └────────────────────────────────┘
│  ┌─────────────────────────┐  │               │
│  │  Firebase Storage       │  │               ▼
│  │  /reviews/{userId}/...  │  │   ┌────────────────────────────────┐
│  └─────────────────────────┘  │   │  Google Generative AI          │
└───────────────────────────────┘   │  (Gemini 2.0 Flash)            │
                                    └────────────────────────────────┘
```

---

## 4. File & Folder Structure

```
review-marketplace/
│
├── app/                              # Next.js App Router root
│   ├── layout.tsx                    # Root HTML shell (fonts, meta, dark mode class)
│   ├── globals.css                   # Global styles, Tailwind import, CSS vars, .btn-brand
│   ├── page.tsx                      # Homepage — main review feed
│   │
│   ├── admin/
│   │   └── page.tsx                  # Admin panel (campaigns, moderation, payout, seed)
│   │
│   ├── api/
│   │   ├── agent/route.ts            # POST — AI review moderation (Gemini)
│   │   ├── payout/route.ts           # POST — campaign budget distribution
│   │   └── visit/route.ts            # GET/POST — unique visitor counter
│   │
│   ├── brands/
│   │   ├── page.tsx                  # Brand marketing & lead capture
│   │   └── dashboard/page.tsx        # Brand analytics dashboard
│   │
│   ├── campaigns/
│   │   └── page.tsx                  # Campaign listing & application
│   │
│   ├── channels/
│   │   ├── page.tsx                  # Channel directory
│   │   └── [slug]/page.tsx           # Individual channel feed
│   │
│   ├── explore/
│   │   └── page.tsx                  # Product browser with filters
│   │
│   ├── product/
│   │   └── [productId]/page.tsx      # Product detail + reviews
│   │
│   ├── profile/
│   │   └── page.tsx                  # User profile, wallet, earnings, reviews
│   │
│   └── components/                   # Shared UI components
│       ├── Avatar.tsx                # Colorful gradient avatar with initials fallback
│       ├── BottomNav.tsx             # Mobile bottom navigation (5 tabs)
│       ├── CreateChannelModal.tsx    # Channel creation form + slug validation
│       ├── HealthScoreBadge.tsx      # Score pill with expandable breakdown
│       ├── LeftSidebar.tsx           # Desktop left nav (channels, campaigns, links)
│       ├── ReviewCard.tsx            # Review display card (likes, comments, fork, timeline)
│       ├── ReviewTimeline.tsx        # Version history vertical timeline
│       ├── ReviewWizard.tsx          # Multi-step review creation wizard (7 steps)
│       ├── RightSidebar.tsx          # Desktop right panel (top reviews leaderboard)
│       ├── VersionUpdateWizard.tsx   # Post a version update to an existing review
│       └── VisitorCounter.tsx        # Unique visitor badge in header
│
├── lib/
│   ├── badges.ts                     # 13 badge definitions + updateUserBadges()
│   ├── firebase.ts                   # Firebase app init — exports db, auth, storage
│   └── healthScore.ts                # computeHealthScore() pure function
│
├── public/
│   ├── logo.svg                      # Light mode wordmark
│   ├── logo-dark.svg                 # Dark mode wordmark
│   ├── icon-192.png                  # PWA icon
│   ├── icon-512.png                  # PWA icon
│   └── manifest.json                 # PWA manifest
│
├── .env.local                        # Firebase + Gemini keys (not committed)
├── next.config.ts                    # Next.js config (minimal)
├── tsconfig.json                     # TypeScript config
├── package.json                      # Dependencies + scripts
└── BLUEPRINT.md                      # This file
```

---

## 5. Page Routes & Wireframes

### 5.1 `/` — Home Feed

```
┌──────────────────────────────────────────────────────────────────────┐
│ [logo]           Review Jam             [🔍 search] [Sign in]        │  ← Mobile header
├──────────────┬─────────────────────────────────────┬─────────────────┤
│ LEFT SIDEBAR │            MAIN FEED                │  RIGHT SIDEBAR  │
│              │                                     │                 │
│  Navigate    │  [✍️ Post a review]                  │  Top Reviews    │
│  🏠 Home     │  [Quick review]                     │  ┌─────────────┐│
│  🔍 Explore  │                                     │  │Sort tabs    ││
│  📡 Channels │  [For You][Trending][Campaigns]     │  │Score/Likes/ ││
│  🎯 Campaigns│                                     │  │Helpful      ││
│  👤 Profile  │  [All][Tech][Home][Beauty]...       │  └─────────────┘│
│  🏢 Brands   │                                     │  1. Product A   │
│  ⚡ Admin    │  ┌─────────────────────────────┐    │     reviewer    │
│              │  │ ReviewCard                  │    │     "quote..."  │
│  Your chnnls │  │ [avatar] Name · rj/tech     │    │  2. Product B   │
│  rj/tech     │  │ ★★★★☆  [score badge]        │    │     ...         │
│  rj/beauty   │  │ "Review summary headline"   │    │  3. ...         │
│              │  │ Full review content...      │    │                 │
│  Communities │  │ [👍 12][✓ 5][⑂ Fork]        │    │                 │
│  rj/gaming   │  │ [💬 3 comments]             │    │                 │
│  + Join      │  └─────────────────────────────┘    │                 │
│              │                                     │                 │
│  Live Camps  │  ┌─────────────────────────────┐    │                 │
│  🎁 Product  │  │ ReviewCard ...              │    │                 │
│     A  3d    │  └─────────────────────────────┘    │                 │
│  🎁 Product  │                                     │                 │
│     B  7d    │                                     │                 │
│              │                                     │                 │
│  Resources   │                                     │                 │
│  📈 Advertise│                                     │                 │
│  🌙 Dark mode│                                     │                 │
├──────────────┴─────────────────────────────────────┴─────────────────┤
│            [🏠 Home][🔍 Explore][📡 Channels][👤 Profile]            │  ← Mobile only
└──────────────────────────────────────────────────────────────────────┘
```

**Left sidebar:** hidden on mobile, `w-[240px]` on md+, `w-[256px]` on xl+
**Right sidebar:** hidden below lg, `w-[240px]` on lg+, `w-[256px]` on xl+
**Main feed:** fluid width between sidebars, max-w-2xl centered

---

### 5.2 `/admin` — Admin Panel

```
┌──────────────────────────────────────────────────────┐
│  ⚡ Admin  [Applications][Moderation][Payout]        │
│            [Create Product][Seed Data]               │
├──────────────────────────────────────────────────────┤
│  Applications tab:                                   │
│  ┌────────────────────────────────────────────────┐  │
│  │ Name · Product · Date · [Approve][Reject]      │  │
│  │ Name · Product · Date · [Mark Sent]            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Moderation tab:                                     │
│  Filter: [24h][7d][30d][All]  Source: [AI][Det.]    │
│  ┌────────────────────────────────────────────────┐  │
│  │ ✅/❌ Reviewer · Preview · Reason · Source     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Access:** Hard-coded email check (`sumit.pandey75@gmail.com`). Replace with Firestore `admins` collection for multi-admin support.

---

### 5.3 `/profile` — User Profile

```
┌──────────────────────────────────────────────┐
│  [Avatar] Name                               │
│           💰 $12.50 wallet · 8 reviews       │
│           [Overview][Reviews][Earnings]      │
│           [Interests]                        │
├──────────────────────────────────────────────┤
│  Overview:  Badges grid (emoji + label)      │
│                                              │
│  Reviews:   ReviewCard list + [Post Update]  │
│                                              │
│  Earnings:  Table: Product · Amount · Date   │
│             Health Score · Campaign ID       │
│                                              │
│  Interests: Category toggle chips           │
└──────────────────────────────────────────────┘
```

---

### 5.4 `/channels` — Channel Directory

```
┌──────────────────────────────────────────────┐
│  Channels  [Search...]  [All][Tech][Beauty]  │
│            [+ Create channel]                │
├──────────────────────────────────────────────┤
│  TECH                                        │
│  ┌──────────────────────────────────────┐    │
│  │ 💻 rj/tech · 1.2k members · 89 revs │    │
│  │ [+ Join]                             │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  BEAUTY                                      │
│  ┌──────────────────────────────────────┐    │
│  │ 💄 rj/beauty · 830 members           │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

---

### 5.5 `/channels/[slug]` — Channel Feed

```
┌──────────────────────────────────────────────┐
│  💻 rj/tech                                  │
│  "Everything about consumer tech"            │
│  1,234 members · [Join / Leave]              │
├──────────────────────────────────────────────┤
│  [Sort: New / Top / Hot]                     │
│  ReviewCard × N  (channel-specific reviews)  │
│  [+ Write a review for this channel] (FAB)   │
└──────────────────────────────────────────────┘
```

---

### 5.6 `/campaigns` — Campaign Listing

```
┌───────────────────────────────────────────────┐
│  Live Campaigns  [All][Tech][Beauty]...        │
├───────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐  │
│  │ 🎁 Product Name · BrandCo · Tech        │  │
│  │ 💰 $500 budget · ⏱ 5 days left          │  │
│  │ [Applied ✓] or [Apply Now]              │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

---

### 5.7 ReviewWizard — Multi-step Modal

```
Step 1/7  ━━━░░░░░░░  Product & Category
          Product name · Category dropdown

Step 2/7  ━━━━━░░░░░  Source & Duration
          How did you get it? · How long used?

Step 3/7  ━━━━━━━░░░  Star Ratings
          Overall ★★★★☆ + category sub-ratings

Step 4/7  ━━━━━━━━░░  Pros & Cons
          + Add pro  /  + Add con

Step 5/7  ━━━━━━━━━░  Written Review
          Summary (headline) + Full content + Best for

Step 6/7  ━━━━━━━━━━  Media
          Drag & drop photos (max 5)

Step 7/7  Review & Submit
          Preview card + [Submit Review]
```

---

## 6. Component Library

### `<Avatar name src size />`

Renders a user avatar. If `src` (photoURL) is valid, shows the real image. Otherwise renders a gradient circle with the first initial. Color is deterministic per name (hash-based, 10 gradient options).

```tsx
<Avatar name="Alice"  size="xs" />   // 5×5 — comment threads
<Avatar name="Alice"  size="sm" />   // 7×7 — dashboard rows
<Avatar name="Alice"  size="md" />   // 9×9 — review cards (default)
<Avatar name="Alice"  size="lg" />   // 14×14 — profile page
<Avatar name="Alice"  src={user.photoURL} size="lg" />  // real photo
```

---

### `<ReviewCard review currentUserId onLike onHelpful onNotHelpful onFork />`

The core display unit. Renders:
- Reviewer name, avatar, badges, channel tag (`rj/slug`), rating, health score
- Forked-from banner (if `forkedFromReviewId` set)
- Review content with summary, pros/cons, sub-ratings, media grid
- Action bar: Like · Helpful · Not Helpful · Fork · Comment toggle · Timeline toggle
- Expandable CommentThread (threaded, max depth 2)
- Expandable ReviewTimeline (version history)

**Key internal state:**
- `showComments` — toggles comment thread
- `showTimeline` — toggles version timeline
- `replyingTo` — tracks which comment is being replied to

---

### `<ReviewWizard onSubmit onClose reviewMode forkSource />`

7-step form modal. Uploads media to Firebase Storage, then calls `onSubmit(ReviewFormData)`. The parent (`page.tsx`) handles the actual Firestore write.

**Props:**
- `reviewMode: "verified" | "generic" | "campaign"` — controls which fields are shown
- `forkSource` — pre-populates reviewer name and sets `forkedFromReviewId`

---

### `<HealthScoreBadge score breakdown />`

A small colored pill (emerald ≥70, amber ≥40, red <40). Click to expand a popover showing 4 score bars (Quality/Engagement/Credibility/Freshness) with raw values.

---

### `<LeftSidebar user products isDarkMode onToggleDark onPostReview onQuickReview onLogin activeCategoryFilter onClearFilter />`

Fetches its own channel data from Firestore on mount. Shows joined channels (if signed in) and popular channels with inline join functionality. Handles `CreateChannelModal` internally.

---

### `<RightSidebar allReviews />`

Pure display component. Receives `allReviews[]` from parent, computes top 10 sorted by score/likes/helpful using `useMemo`. No Firestore calls.

---

### `<ReviewTimeline reviewId originalReview />`

Fetches `reviews/{reviewId}/versions` subcollection on mount, sorted by `versionNumber` asc. Renders a vertical dot-connected timeline from original through all updates.

---

### `<VersionUpdateWizard review onClose />`

Writes a new document to `reviews/{review.id}/versions`, increments `versionCount`, and sets `latestVersionLabel` on the parent review doc. Version labels: `1 Month Update`, `3 Month Update`, `6 Month Update`, `1 Year Update`, `Long-term Update`, `Custom`.

---

### `<BottomNav />`

5 tabs: Home · Explore · Channels · Profile · (Post — amber FAB center). Active tab color: amber. Uses `usePathname()` to track active route. Includes `env(safe-area-inset-bottom)` padding for iOS.

---

## 7. Firestore Data Models

### `users/{userId}`

```
{
  email:          string
  displayName:    string
  interests:      string[]          // ["Tech", "Beauty", ...]
  walletBalance:  number            // current earnable balance in USD
  totalEarned:    number            // lifetime earnings
  badges:         string[]          // badge IDs e.g. ["verified_buyer", "tech_expert"]
  reviewCount:    number            // total reviews authored
  createdAt:      string            // ISO timestamp
}
```

---

### `reviews/{reviewId}`

```
{
  reviewerId:             string    // Firebase Auth UID
  reviewerName:           string
  productId:              string    // ref to products/{id}
  productName:            string
  category:               string    // "Tech" | "Beauty" | ...
  rating:                 number    // 1–5
  content:                string    // full review text
  summary:                string    // headline (shown as bold title)
  marketingQuote:         string    // AI-extracted or user-written quote
  pros:                   string[]
  cons:                   string[]
  bestFor:                string[]  // ["Heavy users", "Beginners", ...]
  subRatings:             object    // { "Performance": 4, "Build Quality": 5 }
  mediaUrls:              string[]  // Firebase Storage download URLs
  likesCount:             number
  likedBy:                string[]  // user IDs
  helpfulCount:           number
  notHelpfulCount:        number
  helpfulBy:              string[]  // user IDs
  notHelpfulBy:           string[]  // user IDs
  commentCount:           number
  isCampaignReview:       boolean
  campaignId:             string | null
  productSource:          "brand_sent" | "purchased" | "gift"
  usageDuration:          "less_1_week" | "1_4_weeks" | "1_3_months" | "3_plus_months"
  badges:                 string[]  // reviewer badges at time of posting
  healthScore:            number    // 0–100, set by payout trigger or admin seed
  healthScoreBreakdown:   object    // { quality, engagement, credibility, freshness }
  forkedFromReviewId:     string | null
  forkedFromReviewerName: string | null
  forkCount:              number
  versionCount:           number
  latestVersionLabel:     string    // "1 Month Update" etc.
  channelId:              string | null
  channelSlug:            string | null
  createdAt:              string    // ISO timestamp
}
```

**Subcollection:** `reviews/{reviewId}/versions/{versionId}`

```
{
  versionNumber:  number
  versionLabel:   string    // "1 Month Update" | "Custom" | ...
  rating:         number
  content:        string
  pros:           string[]
  cons:           string[]
  createdAt:      string
}
```

---

### `reviewComments/{commentId}`

```
{
  reviewId:         string    // parent review
  userId:           string
  userName:         string
  content:          string
  createdAt:        string
  parentCommentId:  string | null   // null = top-level
  depth:            number          // 0 = top-level, 1 = reply, 2 = reply to reply (max)
}
```

---

### `reviewForks/{forkId}`

```
{
  originalReviewId:  string
  forkedBy:          string    // userId
  forkedAt:          string
}
```

---

### `products/{productId}`

```
{
  name:        string
  brandName:   string
  category:    string
  description: string
  campaignId:  string    // same as productId (or separate)
  budget:      number    // USD
  endDate:     string    // ISO date
  createdAt:   string
}
```

---

### `channels/{channelId}`

```
{
  slug:         string    // URL-safe, unique e.g. "tech-gadgets"
  name:         string    // Display name
  description:  string
  category:     string
  iconEmoji:    string    // e.g. "💻"
  memberCount:  number
  reviewCount:  number
  creatorId:    string
  creatorName:  string
  createdAt:    string
}
```

---

### `channelMembers/{memberId}`

```
{
  channelId:  string
  userId:     string
  joinedAt:   string
}
```

**Query pattern:** `where("userId", "==", uid)` to get user's channels; `where("channelId", "==", id)` to get members.

---

### `campaignApplications/{appId}`

```
{
  userId:      string
  userEmail:   string
  userName:    string
  productId:   string
  campaignId:  string
  productName: string
  brandName:   string
  notes:       string
  status:      "applied" | "approved" | "rejected" | "product_sent" | "reviewed"
  appliedAt:   string
  updatedAt:   string
}
```

---

### `payoutLedger/{ledgerId}`

```
{
  userId:       string
  reviewerName: string
  reviewId:     string
  campaignId:   string
  productName:  string
  productId:    string
  amount:       number    // USD, 2dp
  healthScore:  number
  rawLikes:     number
  hasPhoto:     boolean
  status:       "paid"
  paidAt:       string
}
```

---

### `leads/{leadId}`

```
{
  companyName: string
  email:       string
  budget:      string
  duration:    string
  status:      "new"
  createdAt:   string
}
```

---

### `moderationEvents/{eventId}`

```
{
  reviewerName:   string
  reviewPreview:  string    // first 80 chars of review
  isGenuine:      boolean
  reason:         string    // rejection reason or ""
  marketingQuote: string
  source:         "ai" | "deterministic"
  createdAt:      string
}
```

---

### `siteStats/aggregates`

```
{
  uniqueVisitors: number
  updatedAt:      string
}
```

---

### `config/moderation`

```
{
  aiCheckEnabled: boolean   // toggle AI moderation on/off from admin panel
}
```

---

## 8. API Routes

### `POST /api/agent` — AI Moderation

**Called by:** ReviewWizard before submitting a review.

**Request body:**
```json
{
  "reviewContent": "string",
  "reviewerName":  "string",
  "pros":          ["string"],
  "cons":          ["string"],
  "summary":       "string"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "isGenuine":      true,
    "reason":         "",
    "marketingQuote": "Extracted standout quote"
  }
}
```

**Pipeline:**
1. Deterministic checks (word count, keyboard mash, fake keywords, word diversity)
2. If checks pass + `aiCheckEnabled == true`, call Gemini
3. Gemini models tried in order: env `GEMINI_MODEL` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-1.5-flash`
4. Log to `moderationEvents` collection

---

### `POST /api/payout` — Budget Distribution

**Called by:** Admin panel "Distribute Payout" button.

**Request body:**
```json
{
  "campaignId": "string",
  "budget":     500
}
```

**Response:**
```json
{
  "success": true,
  "message": "Distributed $500 across 8 reviewers!"
}
```

**Pipeline:**
1. Query all reviews with `campaignId`
2. For each review: fetch reviewer's badge count + review count from Firestore
3. Compute `healthScore` via `computeHealthScore()`
4. Distribute: `share = (healthScore / sumAllScores) * budget`
5. `updateDoc` user wallet + `addDoc` to `payoutLedger`
6. Persist `healthScore` back to review doc

---

### `GET /api/visit` — Visitor Count

Returns `{ uniqueVisitors: number }`.

### `POST /api/visit` — Track Visitor

**Request body:** `{ "visitorId": "<uuid-v4>" }`

Uses Firestore transaction: stores visitor ID in `uniqueVisitorIds/{id}`, increments `siteStats/aggregates.uniqueVisitors`. Deduplicates by visitor ID.

---

## 9. Business Logic

### 9.1 Health Score Formula

```
Score = Quality(40) + Engagement(25) + Credibility(20) + Freshness(15)
                                                                  = max 100

Quality (max 40):
  Content length:     chars >500→10, >200→7, >100→4, else 1
  Has pros:           +5
  Has cons:           +5
  Sub-ratings filled: +5
  Has media:          +5
  Has summary:        +5
  Has bestFor tags:   +5

Engagement (max 25):
  Likes:    Math.min(Math.log2(likesCount + 1) * 2, 8)
  Helpful:  Math.min(Math.log2(helpfulCount + 1) * 2, 7)
  Comments: Math.min(commentCount, 5)
  Forks:    Math.min(forkCount, 5)

Credibility (max 20):
  Badges:      Math.min(badgeCount * 2, 10)
  ReviewCount: Math.min(reviewCount, 5)
  Verified:    isCampaignReview ? 5 : 0

Freshness (max 15):
  VersionUpdates: Math.min(versionCount * 2.5, 10)
  Recency:        daysAgo<7→5, <30→3, <90→1, else 0
```

### 9.2 Payout Distribution

Total budget shared proportionally by health score:

```
reviewerShare = (reviewHealthScore / sumOfAllReviewerScores) * totalBudget
```

Persisted as a `payoutLedger` entry and credited to the user's `walletBalance`.

### 9.3 Review Versioning

- Original review stored in `reviews/{id}`
- Each update creates a new document in `reviews/{id}/versions/{versionId}`
- `versionCount` and `latestVersionLabel` updated on parent doc
- Timeline fetches subcollection ordered by `versionNumber asc`

### 9.4 Review Forking

- User forks a review → ReviewWizard pre-populated with `forkedFromReviewId` + `forkedFromReviewerName`
- Submission creates a brand-new review doc with `forkedFromReviewId` field set
- Original review's `forkCount` is incremented via `increment(1)`
- `reviewForks` collection stores the linkage for audit

### 9.5 Comment Threading

- Comments stored flat in `reviewComments` collection with `parentCommentId` and `depth` fields
- Depth 0 = top-level; depth 1 = reply; depth 2 = reply to reply (max — Reply button hidden at depth ≥ 2)
- `renderComment()` is recursive: renders children of each top-level comment indented by `depth * 20px`

### 9.6 Badge Awarding

`updateUserBadges(userId)` in `lib/badges.ts`:
- Fetches all reviews by user
- Awards `verified_buyer` if any `productSource == "purchased"`
- Awards `campaign_reviewer` if any `isCampaignReview == true`
- Awards `prolific_reviewer` if `reviewCount >= 5`
- Awards `photo_reviewer` if any review has `mediaUrls.length > 0`
- Awards category expert (`tech_expert` etc.) if ≥3 reviews in that category
- Writes updated badge array back to `users/{userId}`

### 9.7 Channel Slugs

Format: `rj/slug` (displayed), `/channels/slug` (URL). Slug is `slugify(name)`:
- Lowercase
- Replace spaces/non-alphanumeric with `-`
- Collapse multiple dashes
- Truncate to 32 chars
- Uniqueness checked via pre-create Firestore query (race condition acceptable at current scale)

---

## 10. Authentication

- **Provider:** Google OAuth only (`GoogleAuthProvider`)
- **Trigger:** "Sign in" button or any gated action (post review, join channel, apply to campaign)
- **Session:** Firebase handles token refresh automatically
- **User doc:** Created/merged in `users/{uid}` on first sign-in via `setDoc(..., { merge: true })`
- **Admin check:** Hard-coded email string in `app/admin/page.tsx`. Upgrade to Firestore `admins` collection for multi-admin support.
- **No roles/claims:** Currently no Firebase custom claims. All authorization is handled client-side by checking `user.email`.

---

## 11. Environment Variables

Create `.env.local` at project root (never commit this file):

```bash
# Firebase — all NEXT_PUBLIC so they are available in the browser
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Google Generative AI — SERVER ONLY (no NEXT_PUBLIC prefix)
GEMINI_API_KEY=

# Optional: override default Gemini model
GEMINI_MODEL=gemini-2.0-flash
```

**Where to find these values:**
- Firebase vars → Firebase Console → Project Settings → Your apps → SDK setup and configuration
- `GEMINI_API_KEY` → Google AI Studio → API keys (https://aistudio.google.com)

---

## 12. Local Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/sumeetp1/review-jam.git
cd review-jam

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local   # (or create manually — see Section 11)
# Fill in Firebase + Gemini keys

# 4. Start dev server
npm run dev
# App runs at http://localhost:3000

# 5. Build for production
npm run build

# 6. Run production build locally
npm start
```

**Requirements:**
- Node.js ≥ 20
- npm ≥ 10

---

## 13. Build & Deployment

### Vercel (Recommended)

1. Connect GitHub repo to Vercel
2. Set all env vars in Vercel Dashboard → Project → Settings → Environment Variables
3. Deploy — Vercel auto-detects Next.js, no config needed
4. Every push to `main` triggers automatic redeploy

### Build Output

```
Route (app)
  ○  /                     Static
  ○  /admin                Static
  ○  /brands               Static
  ○  /brands/dashboard     Static
  ○  /campaigns            Static
  ○  /channels             Static
  ƒ  /channels/[slug]      Dynamic (server-rendered)
  ○  /explore              Static
  ○  /profile              Static
  ƒ  /product/[productId]  Dynamic (server-rendered)
  ƒ  /api/agent            Dynamic
  ƒ  /api/payout           Dynamic
  ƒ  /api/visit            Dynamic
```

Static pages are pre-rendered at build time. All data is fetched client-side via `useEffect` + Firebase SDK (so "Static" here means no SSR data fetching, not that content is hard-coded).

---

## 14. Firebase Setup Checklist

When setting up Firebase for a new environment:

### Firestore

- [ ] Create Firestore database in **production mode**
- [ ] Add the following composite indexes (required for queries to work):

| Collection | Fields | Order |
|-----------|--------|-------|
| `reviews` | `campaignId` ASC, `createdAt` DESC | — |
| `reviews` | `reviewerId` ASC, `createdAt` DESC | — |
| `reviews` | `channelId` ASC, `likesCount` DESC | — |
| `channelMembers` | `userId` ASC, `joinedAt` DESC | — |
| `channelMembers` | `channelId` ASC, `userId` ASC | — |
| `campaignApplications` | `userId` ASC, `status` ASC | — |
| `payoutLedger` | `userId` ASC, `paidAt` DESC | — |
| `moderationEvents` | `createdAt` DESC | — |
| `channels` | `memberCount` DESC | — |

### Firestore Security Rules (recommended starting point)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Public read on reviews, products, channels
    match /reviews/{id} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null
        && (request.auth.uid == resource.data.reviewerId
            || request.resource.data.keys().hasOnly(['likesCount','likedBy',
               'helpfulCount','helpfulBy','notHelpfulCount','notHelpfulBy',
               'commentCount','forkCount','healthScore','healthScoreBreakdown',
               'versionCount','latestVersionLabel']));
    }

    match /reviews/{reviewId}/versions/{vId} {
      allow read: if true;
      allow create: if request.auth != null;
    }

    match /reviewComments/{id} {
      allow read: if true;
      allow create: if request.auth != null;
    }

    match /reviewForks/{id} {
      allow read: if true;
      allow create: if request.auth != null;
    }

    match /products/{id}    { allow read: if true; }
    match /channels/{id}    { allow read: if true; allow write: if request.auth != null; }
    match /channelMembers/{id} { allow read, write: if request.auth != null; }

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /campaignApplications/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null; // tighten to admin email in production
    }

    match /payoutLedger/{id} {
      allow read: if request.auth != null
        && request.auth.uid == resource.data.userId;
    }

    // Everything else: admin only (server-side API routes bypass rules)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Firebase Auth

- [ ] Enable **Google** sign-in provider
- [ ] Add your domain to **Authorized domains** (Settings → Auth → Authorized domains)

### Firebase Storage

- [ ] Enable Storage
- [ ] Set Storage rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /reviews/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 10 * 1024 * 1024   // 10MB max
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## 15. Known Limitations & Scaling Notes

| Area | Current State | Recommendation at Scale |
|------|--------------|------------------------|
| **Auth** | Google OAuth only | Add email/password, Apple, Twitter providers |
| **Admin access** | Hard-coded email check | Use Firebase custom claims or `admins` collection |
| **Health score** | Computed client-side on payout trigger | Move to Cloud Function triggered on review write |
| **Payout** | Manual trigger from admin panel | Automate with Cloud Scheduler (daily/weekly) |
| **Channel slug uniqueness** | Pre-create query check (race condition possible) | Use a Firestore transaction or Cloud Function |
| **Media uploads** | All in Storage `/reviews/{userId}/` (no size limits enforced client-side) | Enforce via Storage rules + server-side validation |
| **Feed pagination** | Loads ALL reviews on mount | Implement Firestore cursor-based pagination |
| **Search** | Client-side filter on loaded reviews | Integrate Algolia or Typesense for full-text search |
| **Notifications** | None | Add Firebase Cloud Messaging (FCM) for push |
| **Emails** | None | Add SendGrid/Resend for payout receipts, application updates |
| **Rate limiting** | None on API routes | Add middleware rate limiting (Upstash Redis) |
| **Error monitoring** | Console.log only | Add Sentry for error tracking |
| **Analytics** | Visitor counter only | Add Firebase Analytics or PostHog |
| **Testing** | No tests | Add Vitest + React Testing Library |
| **Dark mode persistence** | `localStorage` via class on `<html>` | Already handled — survives refresh |
| **PWA** | Manifest + icons exist, no service worker | Add `next-pwa` for offline support |

---

*This document was auto-generated from source inspection of the Review Jam codebase. Keep it updated as new features are added.*

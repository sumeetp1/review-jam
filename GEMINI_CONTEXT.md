# Review Jam — Product Context for AI Brainstorm Session

> **How to use this document:** Paste this entire file into Gemini as your first message. It gives Gemini full context of what Review Jam is, what it's built with, what already exists, and what stage we're at. Then ask Gemini to help brainstorm the next set of features or structural changes.

---

## What is Review Jam?

Review Jam is a **paid review marketplace** — a platform that sits at the intersection of consumer reviews, brand marketing, and community-driven content. The core idea is simple:

> **Brands pay a budget to get authentic product reviews. Reviewers earn a share of that budget based on the quality of their review.**

Unlike traditional review platforms (Amazon, Google, Trustpilot) where reviews are free and uncompensated, Review Jam creates a direct economic incentive loop:

- **Brands** get real, detailed, structured reviews with photos, pros/cons, and marketing quotes — instead of paying for ads that nobody trusts.
- **Consumers** get paid for the time and effort they put into honest reviews — not with gift cards or discounts, but actual money distributed proportionally by how good their review is.
- **Community** gets a Reddit-style social layer — channels (rj/tech, rj/beauty), comment threads, review forks (write your counter-take), and version updates (come back in 3 months and tell us how it held up).

---

## The Problem We're Solving

**For consumers:**
- You spend 20 minutes writing a detailed Amazon review with photos, pros and cons, a detailed breakdown — and get nothing. Amazon profits. The brand profits. You don't.
- Fake reviews are everywhere. People don't trust reviews anymore. There's no system that validates quality or rewards authenticity.

**For brands:**
- Influencer marketing is expensive, opaque, and often inauthentic.
- Running ads is expensive and people tune them out.
- Getting honest, detailed, structured reviews at scale is hard and slow.
- Brands have no easy way to get real-world usage feedback beyond one-star/five-star ratings.

**What Review Jam does differently:**
- Reviews are scored 0–100 by a "Health Score" (quality of content, engagement, reviewer credibility, freshness) — not just star ratings.
- Payout is proportional to Health Score — so writing better reviews literally pays more.
- Reviews can be updated over time (1 month, 3 month, 1 year updates) — so a product's review quality improves over time rather than decaying.
- Community moderation through forking (anyone can write a counter-review), likes, helpfulness votes, and threaded comments.

---

## Who Is the Target User?

**Reviewers (Consumers):**
- Age 22–40, tech-comfortable
- Already write reviews on Amazon/Reddit/YouTube — just not getting paid for it
- Value honesty and specificity — not looking to just say nice things
- Want to build a "reviewer reputation" over time
- Categories: Tech, Home, Beauty, Gaming, Fitness, SaaS, Automotive, Travel, Finance

**Brands:**
- DTC (direct-to-consumer) brands launching new products
- SaaS companies wanting authentic user testimonials
- Mid-size brands ($1k–$50k/month marketing budget) who can't afford influencers at scale
- E-commerce brands who want more than star ratings

**Community:**
- People who follow product categories the way Reddit users follow subreddits
- People who want to discover products through real community opinions
- Power reviewers who want to build a reputation and following within a niche

---

## Current Stage

This is an **early-stage MVP** — fully functional, running on Firebase, deployed via Vercel. It is not yet publicly launched. The current build includes:

- Full review creation wizard (7 steps, media uploads, sub-ratings, pros/cons)
- Campaign system (brands post campaigns → reviewers apply → admin approves → reviewer writes review → payout distributed)
- Health Score algorithm (0–100, computed from quality/engagement/credibility/freshness)
- Reddit-style community (channels, comment threads, review forking, version updates)
- Amber/orange brand identity, dark mode, mobile-first layout with bottom nav
- Admin panel (review moderation via Gemini AI, payout distribution, campaign management)
- User profiles with earnings, badges, review history

---

## How the Money Works (Payout System)

1. Brand creates a campaign with a **budget** (e.g. $500) and sends products to approved reviewers.
2. Reviewers write reviews. Each review gets a **Health Score** (0–100).
3. When the brand distributes (triggered from admin panel), the budget is split **proportionally by Health Score**:
   ```
   Reviewer A score: 80  →  80/(80+60+40) = 44%  →  $220
   Reviewer B score: 60  →  60/180        = 33%  →  $165
   Reviewer C score: 40  →  40/180        = 22%  →  $110
   ```
4. Earnings sit in a `walletBalance` field on the user's Firestore document. (No real payment rails yet — this is the next major gap.)

**Health Score Formula:**
- **Quality (40 pts):** Content length, pros/cons, sub-ratings, media, summary, best-for tags
- **Engagement (25 pts):** Likes, helpful votes, comments, forks — log-scaled
- **Credibility (20 pts):** Reviewer badges, total review count, verified purchase
- **Freshness (15 pts):** Version updates, recency of review

---

## Current Tech Stack (Summary)

| Layer | What we use |
|-------|------------|
| Frontend | Next.js 16.2 + React 19, App Router, all `"use client"` |
| Styling | Tailwind CSS v4, CSS variables, amber brand color (`#f59e0b`) |
| Database | Firebase Firestore (client SDK, no Admin SDK) |
| Auth | Firebase Auth — Google Sign-In only |
| Storage | Firebase Storage — review photo uploads |
| AI | Google Gemini 2.0 Flash — content moderation (server-side only) |
| Hosting | Vercel |
| Payments | None yet — wallet balance is a Firestore number field |

---

## Current Page Structure

| Route | What it does |
|-------|-------------|
| `/` | Main feed — all reviews, filter by category, tabs: For You / Trending / Campaigns |
| `/explore` | Product browser — sort/filter products, see review counts and ratings |
| `/campaigns` | Browse active campaigns, apply to review a product |
| `/channels` | Reddit-style community directory — browse/create/join channels |
| `/channels/[slug]` | Individual channel feed (e.g. rj/tech) |
| `/product/[id]` | Product detail page with all its reviews |
| `/profile` | User wallet, earnings ledger, badges, review history, interests |
| `/brands` | Landing page for brands, lead capture form |
| `/brands/dashboard` | Brand analytics (basic) |
| `/admin` | Admin panel — moderation, payout, campaign creation, seed data |

---

## Current Component Architecture

The UI is built around these main components:

- **ReviewCard** — the core unit. Shows everything about a review: avatar, name, badges, rating, health score, content, pros/cons, media, action bar (like/helpful/fork/comment/timeline).
- **ReviewWizard** — 7-step review creation modal with media uploads and AI moderation.
- **LeftSidebar** — Reddit-style left nav with channels, campaigns, navigation links.
- **RightSidebar** — Top Reviews leaderboard (sortable by score/likes/helpful).
- **HealthScoreBadge** — Score pill that expands into a breakdown popover.
- **Avatar** — Gradient avatar with initials fallback; consistent color per name.
- **BottomNav** — Mobile tab bar (5 tabs) with iOS safe-area support.
- **ReviewTimeline** — Version history display (original → 1mo → 3mo etc.).
- **VersionUpdateWizard** — Post an update to an existing review.
- **CreateChannelModal** — Create a new rj/ channel.

---

## Firestore Collections (Data Layer)

| Collection | What it stores |
|-----------|---------------|
| `users` | Profile, wallet balance, badges, interests |
| `reviews` | Full review data including health score, forks, versions |
| `reviews/{id}/versions` | Version updates subcollection |
| `reviewComments` | Threaded comments (max depth 2) |
| `reviewForks` | Fork relationships between reviews |
| `products` | Campaign products |
| `channels` | Community channels |
| `channelMembers` | User ↔ channel membership |
| `campaignApplications` | Reviewer applications to campaigns |
| `payoutLedger` | Payout history per user per campaign |
| `leads` | Brand signup interest from /brands |
| `moderationEvents` | AI moderation log |
| `siteStats` | Unique visitor counter |
| `config` | Feature flags (AI moderation on/off) |

---

## What's NOT Built Yet (Known Gaps)

These are known gaps that need to be addressed as we scale:

1. **No real payment rails** — Wallet balance is a number in Firestore. No Stripe, no bank transfer, no actual money movement.
2. **No email system** — No notifications when you're approved for a campaign, when payout is sent, when someone replies to your comment.
3. **No real-time updates** — Feed doesn't refresh live. You have to reload to see new reviews.
4. **No search** — Client-side filter only on already-loaded reviews. No full-text search.
5. **Feed pagination** — Loads all reviews at once. Will break at scale.
6. **No onboarding flow** — New users land on the feed with no walkthrough.
7. **No reviewer verification** — Anyone can claim to have bought a product. No purchase verification layer.
8. **Single admin** — Admin panel is hard-coded to one email address.
9. **No brand self-serve** — Brands can't create campaigns themselves; it goes through admin.
10. **No analytics for reviewers** — Reviewers can't see who viewed or shared their reviews.
11. **No follow system** — Can't follow reviewers or channels for personalised feed.
12. **No PWA / offline** — Manifest exists but no service worker.
13. **No referral or invite system** — No growth mechanism built in.
14. **Mobile review wizard** — Works but is not fully optimised for small screens.

---

## Brand Identity & Tone

- **Name:** Review Jam
- **Brand color:** Amber / Orange (`#f59e0b` → `#f97316` gradient)
- **Tone:** Honest, direct, community-first. Not corporate. Feels like Reddit meets Glassdoor meets a marketplace.
- **Channel prefix:** `rj/` (our version of Reddit's `r/`)
- **Tagline idea (not finalised):** "Real reviews. Real money."

---

## What I Want to Brainstorm With You

I'm at a point where the MVP is functional and I want to think about:

1. **What features would make the biggest difference in getting the first 100 active reviewers?**
2. **What would make brands actually willing to pay $500–$5,000 per campaign?**
3. **What engagement mechanics would make the community sticky (come back daily)?**
4. **Are there any structural problems with the current model I should address before scaling?**
5. **What's the right monetisation model — does the current payout structure make sense?**
6. **What would the v2 of this platform look like if we had 6 months of engineering time?**

Feel free to challenge assumptions, suggest alternatives to the current model, or highlight risks I haven't thought of. I'm looking for honest, strategic thinking — not just a list of features.

---

*Review Jam MVP — April 2026*

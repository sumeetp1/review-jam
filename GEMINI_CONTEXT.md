# Review Jam — Product Vision & Context

> **How to use this file:** Paste it into Gemini (or any AI assistant) as your first message when you want help thinking about Review Jam — new features, product decisions, copy, flows, or anything else. It gives the full picture of what the product is, what it's trying to do, and where it's heading. Updated April 2026.

---

## The Problem

Online reviews are broken in two distinct ways — and most people in the industry have only tried to fix one of them.

The first problem is **manufactured positivity**. Brands pay influencers, run incentive schemes, or set up structured campaigns where reviewers are rewarded for writing nice things. The incentive is completely misaligned — the reviewer gets paid whether the review is honest or not, so flattering, useless reviews pile up. Anyone who has scrolled through a suspiciously five-star product on Amazon with 2,000 identical, breathless reviews knows exactly what this looks like. The reviews exist to game an algorithm, not to help a buyer.

The second problem is **no reason to be good**. The honest reviewer — the person who bought something with their own money, lived with it for six months, and formed a genuinely nuanced opinion — earns nothing from writing it down. Their detailed, photographed, carefully balanced review gets buried under sponsored content. There's no structural reason to invest the time. So most don't, or they keep it short. The best-informed voices in any product category are silent because the system gives them no reason to speak.

Review Jam is an attempt to fix both at the same time.

---

## The Core Idea

Review Jam is a **review marketplace where engagement determines earnings, not sentiment**.

The mechanism is simple: a verified product owner writes a review. That review earns money in proportion to the engagement it generates — likes, helpful votes, comments, counter-arguments. A scathing one-star review that 400 people find useful earns more than a glowing five-star that nobody reads. Brands can fund a pool of money attached to a product page, but they do not get to decide which reviews earn from it. The community decides that, through their engagement.

This decouples the brand's financial interest from the content of the review. The brand is no longer buying praise. They're buying authentic signal and reach. The reviewer's incentive is no longer "say something nice" — it's "say something true that other people find worth reading."

---

## Who It's For

**Reviewers** are the core of the product. Review Jam treats them as professionals, not participants. They have a portfolio of reviews, an earnings history, a trust tier, and badges that reflect their expertise. A reviewer who has spent two years building detailed, well-researched reviews of fitness wearables in the Fitness community is someone with real credibility — and the platform reflects that. They earn more per review because their credibility weight is higher. They're known as a trusted voice in their community because their track record is visible.

Importantly, a reviewer on Review Jam has every reason to post a negative review. If a product disappoints them and they write a specific, honest, well-evidenced critique — and the community agrees it's useful — they earn from the sponsor pool just as much as the enthusiast who loved it. This is the structural shift. Honest negative reviews are financially valuable here. They're not elsewhere.

**Community members** are buyers, enthusiasts, and curious readers who engage with reviews — liking, flagging as helpful, commenting, debating. Their collective judgment is what the engagement signal is built from. They're not just passive consumers of content; their upvotes and comments are what determine which reviews rise and which fall. The crowd replaces the editorial team.

**Brands** join the platform to get genuine, unfiltered signal on how their product is actually experienced in the real world. They see everything — the praise, the criticisms, the ownership journeys showing how the product holds up after a year, the counter-takes from people who disagree with each other. They fund pools to attract more reviews. What they don't get is control over what those reviews say. Brands who are confident in their product should embrace this. Brands who aren't will learn something valuable.

---

## How the Product Works

### Communities and Products

Everything on Review Jam is organised into communities. Each community is a topic — Tech, Fitness, SaaS, Automotive, Beauty, Gaming, Travel, Finance, and any niche community a user chooses to create. Every product lives inside a community with a clean, readable address: `rj/tech/sony-wh-1000xm6` or `rj/fitness/whoop-5-0-band`. The community comes first in the URL because it matters — a product exists in context, and the people in that community are the most qualified to evaluate it.

A product has one canonical community (where it primarily lives) but can be cross-referenced into others. A pair of running shoes might live in the Fitness community but be tagged into the Trail Running community as well, so it surfaces there too.

---

### Writing a Review

When someone wants to review a product, they go through a structured wizard. They're asked how they got the product (bought it themselves, brand sent it to them, received as a gift), how long they've used it, which variant or version they have. Then the substantive review: a star rating, a headline, structured pros and cons (up to five each), full written content, sub-ratings on specific dimensions relevant to that category (for headphones, that might be sound quality, comfort, noise cancellation; for a SaaS tool, reliability, ease of use, value), and optionally photos or videos.

Two kinds of review carry extra weight:

**Verified reviews** — the reviewer uploads a photo of their purchase receipt. The platform reads it using AI (Gemini vision), extracts the store, date, and product, and if it checks out, marks the review as verified. This matters because verified reviews are provably from real buyers. They carry more credibility weight in the health score and therefore earn more from sponsor pools.

**Campaign-disclosed reviews** — when a brand has specifically engaged a reviewer (for instance, by sending them a product to test), that relationship must be disclosed. The review card shows it clearly. These reviews earn less algorithmic weight than organic reviews because the relationship creates potential for bias — even if the review itself is honest.

All reviews pass through moderation before going live. Simple automated checks catch gibberish, test submissions, and obvious junk instantly. Then an AI layer reads the full review and assesses whether it sounds like genuine personal experience, whether it's balanced, and whether it contains marketing language rather than buyer language. Reviews that read like press releases get flagged. Flagged reviews aren't deleted — they stay up — but they earn less in the ranking and in payouts. Transparency, not censorship.

---

### The Health Score

Every review has a Health Score between 0 and 100. It's calculated automatically and shown as a colour-coded badge — green for a strong score, amber for middling, red for weak. It combines four things:

**Quality** covers the completeness of the review. Length, structure, whether it has pros and cons, whether it includes sub-ratings on specific dimensions, whether it has photos. Reviews with no cons listed take a significant penalty. This is intentional — a review with nothing negative is either a miracle product or marketing copy, and the system treats it with suspicion.

**Engagement** measures how useful other people found the review. Likes, helpful votes, comments, and counter-takes all contribute. These are weighted logarithmically so that gaming them with inauthentic activity doesn't scale efficiently.

**Credibility** reflects the reviewer's track record. How many reviews have they written? What badges have they earned? Most importantly, is this a verified purchase? A reviewer with a receipt-verified purchase and an established track record in a category earns significantly more credibility weight than an anonymous newcomer.

**Freshness** rewards reviewers who maintain their reviews over time. A review updated a year after the original post is more valuable than one that hasn't been touched. Version updates — "3 Month Update", "1 Year Update" — contribute directly to the freshness score.

The Health Score is not just a display metric. It determines how much a reviewer earns from sponsor pools. Writing a better review isn't just better for readers — it pays more.

---

### Ownership Journeys

Most review platforms treat a review as a static document. You write it after unboxing, it lives there forever, and it gradually becomes less relevant as the product ages. Review Jam treats reviews as living things.

A reviewer who buys something today writes their initial impressions. Three months later, they come back and post a "3 Month Update" — did the battery degrade? Did the software improve? Did the product reveal flaws that weren't visible in the first week? A year later, another update. Each update can change the rating.

The product page shows these updates as an Ownership Journey — a timeline that shows how a reviewer's opinion evolved. A product with consistent five-star updates after a year looks fundamentally different from one with a burst of five-stars at launch and silence thereafter. A product whose rating drifts from four stars to two over eighteen months is telling a buyer something important.

Each update also earns freshness credit in the health score. Reviewers have an ongoing financial incentive to maintain their reviews, not just write and forget. The platform is designed to make review portfolios worth building over time.

---

### Counter-Takes

Any reviewer can fork an existing review to offer a different perspective. This is called a Counter-Take.

If someone reads a glowing review of a product and genuinely disagrees based on their own experience, they write a counter-take. The product hub shows both reviews side-by-side — original and counter-take — with the specific points of disagreement highlighted explicitly. If the original says "battery life is excellent" and the counter-taker says "battery degraded after four months", that disagreement is surfaced directly.

Counter-takes aren't antagonistic. They're a way of saying: here is another genuine experience, it differed from this one, and here's how. For buyers, this is enormously useful — you can see the range of experiences a product produces, not just an averaged rating. Counter-takes contribute to the original review's engagement score, so writing a counter-take benefits the original reviewer too.

---

### Trust Scores and Badges

Reviewers build reputation over time. Trust Score accumulates as you write verified reviews, earn engagement, and help others. Badges are earned automatically based on your review history:

- **Verified Buyer** — at least one receipt-verified review
- **Prolific Reviewer** — five or more reviews published
- **Photo Reviewer** — included photos or video in a review
- **Category Expert** — three or more reviews in the same category (Tech Expert, Fitness Expert, etc.)
- **Campaign Reviewer** — participated in a disclosed brand campaign

Trust tiers run from Newcomer → Contributor → Trusted → Authority → Legend. Higher trust means higher credibility weight in the health score, which means more earnings per review at equivalent engagement levels. The system rewards building a genuine track record — not just writing a lot, but writing well and being trusted by the community.

---

### What Brands Get

Brands find their products through a simple dashboard using their email address — no separate account setup. They can see every review written about their product: the ratings, the content, the engagement numbers, the reviewer breakdown. They can see exactly what people love and exactly what people criticise.

What they cannot do: approve or reject reviews, delete content, contact reviewers through the platform, or know in advance who will write about their product.

What they can do: fund a sponsor pool to attract more reviewers to their product, sponsor community bounties to increase payouts in a specific category, and embed a review widget on their own website that lets their customers review directly.

For a brand confident in their product, this is an extremely powerful credibility signal. The reviews they show are provably unfiltered. For a brand not confident in their product, it's a useful mirror.

---

## The Sponsor Pool (Coming Soon)

The current payout model ties earnings to campaigns — a brand creates a campaign, reviewers are associated with it, and payouts are distributed based on engagement. The next evolution completely reimagines this.

The **Sponsor Pool** model works like this:

A brand goes to their product page and deposits a budget — say, £2,000. They set a per-review cap (the maximum any single review can earn, say £80), a minimum engagement threshold (a review has to earn at least some engagement before being eligible at all), and an expiry date.

The pool sits on the product page, visible to anyone thinking about writing a review. It says, essentially: there is money available here for anyone who writes a verified review of this product and earns community engagement. There is no application. There is no approval process. Anyone who has bought the product can write.

Weekly, the payout engine runs. It looks at every review written while the pool was active, calculates an engagement score for each one (likes, helpful votes, comments, and counter-takes each carry different weights), and distributes the pool proportionally. Each reviewer gets their share of the total, capped at the per-review maximum.

The brand has no idea going into this whether the money will go mostly to glowing enthusiasts or to pointed critics. The payout engine doesn't care about sentiment. Neither should the brand, if what they actually want is authentic signal and genuine reach.

This is the cleanest structural expression of Review Jam's founding principle: brand investment buys distribution and truth, not praise.

---

## What Makes This Different

**From Amazon reviews:** Amazon has no financial incentive structure for reviewers, minimal purchase verification, and brands can influence rankings through various mechanisms. Review Jam pays based on quality and engagement, verifies purchases via AI receipt reading, and structurally penalises marketing-speak in the scoring algorithm.

**From influencer platforms:** Influencer deals pay for reach and typically ask for positive or at least brand-safe content. Review Jam pays for engagement and is completely agnostic about sentiment. The audience decides what's worth reading, not the brand.

**From affiliate sites:** Affiliate review sites earn commission on sales, which creates a strong structural incentive to recommend buying. Review Jam earns based on engagement — a review that honestly tells someone this product isn't right for them is just as financially valuable as one that drives a purchase.

**From traditional product journalism:** Professional reviews are typically written after a few days or weeks with a press sample, often under deadline. Review Jam's Ownership Journey model means the most credible reviews come from people who have lived with a product for a year or more and kept updating their honest assessment.

---

## Design Philosophy

Review Jam is not neutral on quality. The algorithms are deliberately pointed in one direction: thorough, honest, useful reviews rise; shallow, manufactured, one-sided reviews sink. Every design decision is made with this in mind.

Reviews with no criticisms take a structural penalty. Marketing language gets flagged and loses ranking weight. Organic reviews earn more than paid-campaign reviews in discovery. Verified purchases carry more credibility than unverified ones. Reviewers who maintain their reviews over time earn more than those who write and vanish.

The platform also respects that negative reviews are valuable — not something to be tolerated or minimised, but actively good. A well-written, specific, fair negative review is useful to buyers and useful to brands. It should be the financially rational thing to write when a product genuinely disappoints. On Review Jam, it is.

---

## Current Product State (April 2026)

Review Jam is a working web app. What exists today:

- Community-organised product hubs at `rj/[community]/[product]`
- Review submission with three types: organic, campaign-disclosed, verified-purchase
- AI-powered receipt verification (Gemini) for verified reviews
- AI moderation on all reviews (Gemini), with full audit log
- Health Score on every review, calculated automatically
- Discovery Rank for products, driving Explore page ordering
- Ownership Journey — version history on reviews, timeline view
- Counter-takes (forks) with side-by-side disagreement panels
- Q&A on product pages ("Ask an Owner"), with verified-owner answers
- Threaded comments on reviews
- Trust Score and badge system for reviewers
- Wallet and payout history on reviewer profiles
- Brand dashboard for viewing reviews and managing bounties
- Community pages with join/leave, member counts, and boosted multipliers
- Admin dashboard for moderation oversight, seeding, and data management
- Embeddable widget for brands to add to their own websites
- Identicon avatars (GitHub-style) for users without a profile photo
- Indigo/violet colour theme, dark mode throughout

The Sponsor Pool model is designed and specified — it's the next major build.

---

## When Helping With This Product

A few things to keep front of mind:

Brands are never in editorial control. Any idea that gives brands power over what gets said — even soft power, like the ability to "highlight" or "pin" certain reviews — would undermine the whole thing.

Engagement is the currency, not sentiment. Features should reward reviews that other people find useful, not reviews that say nice things.

The community is the signal. Products live in communities. Reviewers build reputation within communities. Discovery flows through community engagement. Features that isolate products from community context weaken the product.

Reviewers are professionals here. The tone toward them should be "you're building something valuable over time" not "thanks for your contribution." Payouts, trust tiers, portfolios, badges — all of this is about treating reviewing as a craft worth investing in.

Honesty is structurally enforced, not asked for nicely. The algorithms penalise marketing-speak, reward balance, and weight verified ownership higher. New features should be consistent with this directional pressure.

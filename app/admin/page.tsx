"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, getDocs, limit, orderBy, query, where, doc, updateDoc, setDoc, getDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { computeHealthScore } from "../../lib/healthScore";

// REPLACE THIS WITH YOUR EXACT GOOGLE LOGIN EMAIL
const ADMIN_EMAIL = "sumit.pandey75@gmail.com"; 

type ModerationEvent = {
  id: string;
  reviewerName: string;
  reviewPreview: string;
  isGenuine: boolean;
  reason: string;
  marketingQuote?: string;
  source: "deterministic" | "ai";
  createdAt: string;
};

type DateRangeFilter = "24h" | "7d" | "30d" | "all";
type SourceFilter = "all" | "deterministic" | "ai";

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [newProdName, setNewProdName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandEmail, setNewBrandEmail] = useState("");
  const [newCategory, setNewCategory] = useState("Tech");
  const [newCampaignId, setNewCampaignId] = useState("");
  const [endDateLocal, setEndDateLocal] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [variantRows, setVariantRows] = useState<string[]>([""]);

  // Applications state
  type CampaignApplication = {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    productId: string;
    productName: string;
    brandName: string;
    campaignId: string;
    notes: string;
    status: string;
    appliedAt: string;
  };
  const [applications, setApplications] = useState<CampaignApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [appStatusFilter, setAppStatusFilter] = useState<"all" | "applied" | "approved" | "rejected" | "product_sent">("applied");
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);
  const [globalPool, setGlobalPool] = useState("");
  const [dividendStats, setDividendStats] = useState<{ totalReviews: number; eligibleReviews: number; payoutsMade: number; uniqueReviewers: number; totalDistributed: number } | null>(null);
  // Expert Seeding
  const [seedInventory, setSeedInventory] = useState<{ id: string; productName: string; brandName: string; category: string; quantity: number; status: string }[]>([]);
  const [trustedReviewers, setTrustedReviewers] = useState<{ id: string; displayName?: string; email?: string; trustScore?: number }[]>([]);
  const [isLoadingReviewers, setIsLoadingReviewers] = useState(false);
  const [invProduct, setInvProduct] = useState("");
  const [invBrand, setInvBrand] = useState("");
  const [invCategory, setInvCategory] = useState("Tech");
  const [invQty, setInvQty] = useState("1");
  const [invNotes, setInvNotes] = useState("");
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [selectedInvId, setSelectedInvId] = useState("");
  const [seedingMessage, setSeedingMessage] = useState("");

  const [aiCheckEnabled, setAiCheckEnabled] = useState(true);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [moderationEvents, setModerationEvents] = useState<ModerationEvent[]>([]);
  const [isLoadingModeration, setIsLoadingModeration] = useState(true);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("7d");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase().trim()) return;

    async function fetchApplications() {
      setIsLoadingApplications(true);
      try {
        const snap = await getDocs(query(collection(db, "campaignApplications"), orderBy("appliedAt", "desc"), limit(200)));
        setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampaignApplication)));
      } catch (error) {
        console.error("Failed to load applications:", error);
      } finally {
        setIsLoadingApplications(false);
      }
    }

    fetchApplications();

    async function fetchModerationEvents() {
      setIsLoadingModeration(true);
      try {
        const moderationQuery = query(
          collection(db, "moderationEvents"),
          orderBy("createdAt", "desc"),
          limit(300)
        );
        const snapshot = await getDocs(moderationQuery);
        const events = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ModerationEvent[];
        setModerationEvents(events);
      } catch (error) {
        console.error("Failed to load moderation events:", error);
      } finally {
        setIsLoadingModeration(false);
      }
    }

    fetchModerationEvents();

    // Load AI check toggle state
    getDoc(doc(db, "config", "moderation")).then((snap) => {
      if (snap.exists()) setAiCheckEnabled(snap.data().aiCheckEnabled !== false);
    }).catch(() => {});
  }, [user]);

  if (isAuthLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 font-bold animate-pulse">Verifying Security Credentials...</div>;
  if (!user) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10"><p className="text-xl text-slate-400 mb-4">Please log in to access the Admin Dashboard.</p><Link href="/" className="bg-indigo-600 px-6 py-2 rounded-xl font-bold hover:bg-indigo-500 transition">Go Home to Login</Link></div>;
  if (user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase().trim()) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-10"><p className="text-red-500 font-black text-5xl mb-2">ACCESS DENIED</p><p className="text-slate-400 mb-8 text-lg">Logged in as {user?.email || "Unknown"}.</p><Link href="/" className="bg-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-600 transition">Return to Market</Link></div>;

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const universalEndDate = new Date(endDateLocal).toISOString();

      const productRef = await addDoc(collection(db, "products"), {
        name: newProdName,
        brandName: newBrandName,
        brandEmail: newBrandEmail.trim().toLowerCase(),
        category: newCategory,
        campaignId: newCampaignId || `camp_${Date.now()}`,
        endDate: universalEndDate,
        description: newDescription.trim(),
        budget: newBudget ? Number(newBudget) : null,
        createdAt: new Date().toISOString(),
      });

      // Write variants to subcollection
      const validVariants = variantRows.map((v) => v.trim()).filter(Boolean);
      if (validVariants.length > 0) {
        const batch = writeBatch(db);
        for (const name of validVariants) {
          const variantRef = doc(collection(db, "products", productRef.id, "productVariants"));
          batch.set(variantRef, { name, createdAt: new Date().toISOString() });
        }
        await batch.commit();
      }

      alert(`Campaign Created Successfully! ${validVariants.length > 0 ? `${validVariants.length} variant(s) added.` : ""} It is now live on the homepage.`);
      setNewProdName(""); setNewBrandName(""); setNewBrandEmail(""); setNewCampaignId(""); setEndDateLocal(""); setNewDescription(""); setNewBudget("");
      setVariantRows([""]);
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleAiCheck = async () => {
    setIsTogglingAi(true);
    const next = !aiCheckEnabled;
    try {
      await setDoc(doc(db, "config", "moderation"), { aiCheckEnabled: next }, { merge: true });
      setAiCheckEnabled(next);
    } catch (e) {
      console.error("Failed to update AI check config", e);
      alert("Failed to save setting.");
    } finally {
      setIsTogglingAi(false);
    }
  };

  const handleSeedDatabase = async () => {
    const confirmed = window.confirm("This will DELETE all existing products, reviews, channels, discussions, and engagement data, then insert fresh seed data. Continue?");
    if (!confirmed) return;
    setIsProcessing(true);
    setStatusMessage("Clearing existing data…");

    try {
      const now = new Date();
      const day = 24 * 60 * 60 * 1000;

      // ── Clear existing data (all collections) ────────────────────────────
      const [prodSnap, revSnap, chSnap, cmSnap, rcSnap, rfSnap, discSnap, qaSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "reviews")),
        getDocs(collection(db, "channels")),
        getDocs(collection(db, "channelMembers")),
        getDocs(collection(db, "reviewComments")),
        getDocs(collection(db, "reviewForks")),
        getDocs(collection(db, "productDiscussions")),
        getDocs(collection(db, "productDiscussionAnswers")),
      ]);
      await Promise.all([
        ...prodSnap.docs.map((d) => deleteDoc(d.ref)),
        ...revSnap.docs.map((d) => deleteDoc(d.ref)),
        ...chSnap.docs.map((d) => deleteDoc(d.ref)),
        ...cmSnap.docs.map((d) => deleteDoc(d.ref)),
        ...rcSnap.docs.map((d) => deleteDoc(d.ref)),
        ...rfSnap.docs.map((d) => deleteDoc(d.ref)),
        ...discSnap.docs.map((d) => deleteDoc(d.ref)),
        ...qaSnap.docs.map((d) => deleteDoc(d.ref)),
      ]);

      setStatusMessage("Inserting campaigns & variants…");

      // ── 9 campaigns — one per category, with variants & specs ────────────
      const campaigns = [
        {
          name: "Sony WH-1000XM6",
          brandName: "Sony", brandEmail: "sony@brands.com", category: "Tech",
          campaignId: "camp_sony",
          slug: "sony-wh-1000xm6", communitySlug: "tech", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80&fit=crop",
          description: "Next-gen noise-cancelling headphones. 40hr battery, multipoint Bluetooth 5.3, LDAC Hi-Res Audio.",
          budget: 5000, endDate: new Date(now.getTime() + 6 * day).toISOString(),
          variants: ["Midnight Black", "Platinum Silver", "Indigo Blue"],
          specs: [
            { label: "Driver", value: "40mm dynamic" },
            { label: "Battery", value: "40 hrs (ANC on)" },
            { label: "Bluetooth", value: "5.3, LDAC, multipoint" },
            { label: "Weight", value: "250 g" },
            { label: "ANC", value: "Dual-chip QN3 processor" },
          ],
          verifiedSkus: ["WH1000XM6/B", "WH1000XM6/S", "WH1000XM6/L"],
        },
        {
          name: "Lumina Smart Standing Desk",
          brandName: "Lumina", brandEmail: "lumina@brands.com", category: "Home",
          campaignId: "camp_lumina",
          slug: "lumina-smart-standing-desk", communitySlug: "home", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=800&q=80&fit=crop",
          description: "OLED control panel, 4-preset memory, integrated cable management tray, whisper-quiet dual motor.",
          budget: 3000, endDate: new Date(now.getTime() + 4 * day).toISOString(),
          variants: ["48\" Walnut Top", "60\" White Top", "72\" Black Top"],
          specs: [
            { label: "Height range", value: "24–50 inches" },
            { label: "Motor", value: "Dual brushless, 120kg load" },
            { label: "Noise level", value: "< 45 dB" },
            { label: "Display", value: "OLED touch panel" },
            { label: "Warranty", value: "5 years" },
          ],
          verifiedSkus: ["LMN-48W", "LMN-60W", "LMN-72B"],
        },
        {
          name: "Linear — Project Management",
          brandName: "Linear", brandEmail: "linear@brands.com", category: "SaaS",
          campaignId: "camp_linear",
          slug: "linear-project-management", communitySlug: "saas", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80&fit=crop",
          description: "The issue tracker built for high-performance engineering teams. Keyboard-first, blazingly fast.",
          budget: 2000, endDate: new Date(now.getTime() + 14 * day).toISOString(),
          variants: ["Free Tier", "Plus Plan ($8/user/mo)", "Enterprise"],
          specs: [
            { label: "Integrations", value: "GitHub, GitLab, Figma, Slack" },
            { label: "API", value: "GraphQL + REST" },
            { label: "SSO", value: "SAML (Enterprise only)" },
            { label: "Uptime SLA", value: "99.9% (Enterprise)" },
          ],
          verifiedSkus: [],
        },
        {
          name: "Rivian R2 SUV",
          brandName: "Rivian", brandEmail: "rivian@brands.com", category: "Automotive",
          campaignId: "camp_rivian",
          slug: "rivian-r2-suv", communitySlug: "automotive", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80&fit=crop",
          description: "All-electric adventure SUV. 300mi range, quad-motor option, hands-free highway driving.",
          budget: 8000, endDate: new Date(now.getTime() + 10 * day).toISOString(),
          variants: ["Standard Range · RWD", "Long Range · AWD", "Max Pack · Quad-Motor"],
          specs: [
            { label: "Range (EPA)", value: "240 / 290 / 330 mi" },
            { label: "0–60 mph", value: "4.5s / 3.8s / 3.0s" },
            { label: "Charging", value: "AC (11kW) + DC (216kW)" },
            { label: "Cargo", value: "2,500L total (frunk + trunk + gear tunnel)" },
            { label: "ADAS", value: "Highway Assist (hands-free)" },
          ],
          verifiedSkus: ["R2-SR-RWD-2025", "R2-LR-AWD-2025", "R2-MAX-QM-2025"],
        },
        {
          name: "Rhode Peptide Lip Treatment",
          brandName: "Rhode", brandEmail: "rhode@brands.com", category: "Beauty",
          campaignId: "camp_rhode",
          slug: "rhode-peptide-lip-treatment", communitySlug: "beauty", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80&fit=crop",
          description: "Peptide-rich gloss that plumps and hydrates. 9 active ingredients including shea butter and peptide complex.",
          budget: 1500, endDate: new Date(now.getTime() + 7 * day).toISOString(),
          variants: ["Salted Caramel", "Glazed Donut", "Watermelon Slice", "Unscented"],
          specs: [
            { label: "Size", value: "10 mL" },
            { label: "Key ingredients", value: "Peptide complex, shea butter, cupuaçu butter" },
            { label: "Finish", value: "Glossy, non-sticky" },
            { label: "Cruelty-free", value: "Yes" },
          ],
          verifiedSkus: ["RH-LIP-SC", "RH-LIP-GD", "RH-LIP-WM", "RH-LIP-UN"],
        },
        {
          name: "PlayStation 5 Pro",
          brandName: "Sony", brandEmail: "sony@brands.com", category: "Gaming",
          campaignId: "camp_ps5pro",
          slug: "playstation-5-pro", communitySlug: "gaming", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=800&q=80&fit=crop",
          description: "45% faster GPU than PS5, PSSR AI upscaling, 2TB SSD. Free 3-month PS Plus for campaign reviewers.",
          budget: 6000, endDate: new Date(now.getTime() + 5 * day).toISOString(),
          variants: ["Disc Edition", "Digital Edition"],
          specs: [
            { label: "GPU", value: "AMD RDNA 4, 33.5 TFLOPS" },
            { label: "CPU", value: "Zen 2, 3.85 GHz" },
            { label: "RAM", value: "16GB GDDR6" },
            { label: "Storage", value: "2TB NVMe SSD" },
            { label: "Resolution", value: "Up to 8K via PSSR" },
          ],
          verifiedSkus: ["CFI-7000UX", "CFI-7000B01"],
        },
        {
          name: "Whoop 5.0 Band",
          brandName: "Whoop", brandEmail: "whoop@brands.com", category: "Fitness",
          campaignId: "camp_whoop",
          slug: "whoop-5-0-band", communitySlug: "fitness", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=800&q=80&fit=crop",
          description: "Continuous health monitoring — HRV, skin temperature, sleep stages, blood oxygen. No screen.",
          budget: 2500, endDate: new Date(now.getTime() + 9 * day).toISOString(),
          variants: ["Onyx Black", "Stone Grey", "Desert Tan"],
          specs: [
            { label: "Sensors", value: "PPG, EDA, skin temp, SPO2, accel" },
            { label: "Battery", value: "4–5 days, slide-to-charge" },
            { label: "Water resistance", value: "IP68, 10ATM" },
            { label: "Subscription", value: "$30/mo or $239/yr" },
          ],
          verifiedSkus: [],
        },
        {
          name: "IHG One Rewards — Indigo Hotels",
          brandName: "IHG", brandEmail: "ihg@brands.com", category: "Travel",
          campaignId: "camp_ihg",
          slug: "ihg-one-rewards-indigo-hotels", communitySlug: "travel", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80&fit=crop",
          description: "Boutique hotel collection with neighbourhood-led design. Reviewers receive a 2-night complimentary stay.",
          budget: 10000, endDate: new Date(now.getTime() + 21 * day).toISOString(),
          variants: ["Hotel Indigo Edinburgh", "Hotel Indigo Dubai", "Hotel Indigo NYC"],
          specs: [
            { label: "Properties", value: "125+ worldwide" },
            { label: "Loyalty tier", value: "Silver/Gold/Platinum/Ambassador" },
            { label: "Points value", value: "~0.5¢ per point" },
            { label: "Free night cert", value: "On card anniversary" },
          ],
          verifiedSkus: [],
        },
        {
          name: "Robinhood Gold",
          brandName: "Robinhood", brandEmail: "robinhood@brands.com", category: "Finance",
          campaignId: "camp_robinhood",
          slug: "robinhood-gold", communitySlug: "finance", communityTags: [],
          coverImage: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&fit=crop",
          description: "5% APY on uninvested cash, 3% IRA match, margin at 6.5%, instant deposits up to $50K.",
          budget: 4000, endDate: new Date(now.getTime() + 12 * day).toISOString(),
          variants: ["Monthly · $5/mo", "Annual · $50/yr"],
          specs: [
            { label: "Cash APY", value: "5.00% (Gold members)" },
            { label: "Margin rate", value: "6.5%" },
            { label: "IRA match", value: "3% on contributions" },
            { label: "Instant deposit", value: "Up to $50,000" },
            { label: "SIPC", value: "Up to $500K" },
          ],
          verifiedSkus: [],
        },
      ];

      const campDocs: Record<string, string> = {};
      const campVariantIds: Record<string, Record<string, string>> = {};

      for (const c of campaigns) {
        const { variants, specs, verifiedSkus, ...productData } = c;
        const ref = await addDoc(collection(db, "products"), {
          ...productData,
          specs: specs ?? [],
          verifiedSkus: verifiedSkus ?? [],
          createdAt: now.toISOString(),
        });
        campDocs[c.campaignId] = ref.id;
        const varMap: Record<string, string> = {};
        if (variants.length > 0) {
          const batch = writeBatch(db);
          for (const vName of variants) {
            const vRef = doc(collection(db, "products", ref.id, "productVariants"));
            batch.set(vRef, { name: vName, createdAt: now.toISOString() });
            varMap[vName] = vRef.id;
          }
          await batch.commit();
        }
        campVariantIds[c.campaignId] = varMap;
      }

      setStatusMessage("Inserting reviews…");

      const ago = (days: number) => new Date(now.getTime() - days * day).toISOString();
      const vid  = (campId: string, vName: string) => campVariantIds[campId]?.[vName] ?? null;

      // ── Reviews — designed to exercise every feature ──────────────────────
      // Features tested per review:
      //   isVerifiedPurchase: true  → Verified Owners toggle
      //   biasFlag: true            → Discovery Rank penalty, AI moderation log
      //   versionCount > 1          → Ownership Journey card in the Hub
      //   cons: []                  → Critical Balance penalty (-15 quality)
      //   isCampaignReview: false   → organic weight boost (1.2×) in Discovery Rank
      //   forkCount > 0             → Fork UI on ReviewCard
      //   high likesCount           → engagement score, payout weighting
      const reviews: any[] = [

        // ── TECH · Sony WH-1000XM6 ───────────────────────────────────────────

        // [0] Verified owner, organic, no bias, will get 2 version updates → Ownership Journey
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "organic",
          productId: campDocs["camp_sony"], productSlug: "sony-wh-1000xm6", communitySlug: "tech",
          variantName: "Midnight Black", variantId: vid("camp_sony","Midnight Black"),
          reviewerName: "Alex Chen", reviewerId: "seed_u1", rating: 5,
          summary: "Best ANC headphones I have ever owned — 14 months in",
          content: "Bought these the week they launched after years on the Bose QC35. The noise cancellation is in a completely different league — it removes the low-frequency London Underground rumble entirely, not just attenuates it. Battery genuinely lasts me three full work days. Multipoint pairing between my MacBook and iPhone is seamless.",
          pros: ["Class-leading ANC", "40hr battery", "Multipoint seamless", "Comfortable all-day"],
          cons: ["Clamping force tight on large heads", "App is bloated"],
          likesCount: 341, helpfulCount: 112, forkCount: 2, commentCount: 3,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "3_plus_months",
          eligibleForPayout: false, reviewType: "verified",
          mediaUrls: [
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80&fit=crop",
            "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=500&q=80&fit=crop",
          ],
          createdAt: ago(45) },

        // [1] Campaign review, not verified, will get 1 version update
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "camp_sony",
          productId: campDocs["camp_sony"], productSlug: "sony-wh-1000xm6", communitySlug: "tech",
          variantName: "Platinum Silver", variantId: vid("camp_sony","Platinum Silver"),
          reviewerName: "Priya Singh", reviewerId: "seed_u2", rating: 4,
          summary: "Worth it for multipoint alone",
          content: "Switching between my MacBook and iPhone is instant. No Bluetooth menu diving. The LDAC support means music from Tidal sounds genuinely hi-res. Clamping force slightly tight but loosens after a week. Not quite Bose on comfort but wins on everything else.",
          pros: ["Multipoint pairing", "LDAC Hi-Res", "Sound quality"],
          cons: ["Tight clamp initially", "ANC not quite Bose-level on wind noise"],
          likesCount: 178, helpfulCount: 67, forkCount: 1, commentCount: 2,
          isVerifiedPurchase: false, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_3_months",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(30) },

        // [2] BIAS FLAG: no cons — triggers Critical Balance -15 health penalty
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "camp_sony",
          productId: campDocs["camp_sony"], productSlug: "sony-wh-1000xm6", communitySlug: "tech",
          variantName: "Indigo Blue", variantId: vid("camp_sony","Indigo Blue"),
          reviewerName: "BrandPartner99", reviewerId: "seed_u3", rating: 5,
          summary: "Absolutely perfect in every way — 10/10 no notes",
          content: "This is the most incredible product I have ever used. The sound is perfect. The ANC is perfect. The battery is perfect. The design is perfect. I cannot find a single thing wrong with it. Everyone should buy these immediately they are simply flawless.",
          pros: ["Perfect sound", "Perfect ANC", "Perfect battery"],
          cons: [],  // <-- triggers Critical Balance penalty
          likesCount: 12, helpfulCount: 3, forkCount: 0, commentCount: 0,
          isVerifiedPurchase: false, isCampaignReview: true,
          biasFlag: true,  // <-- seeded as flagged for AI moderation log
          productSource: "brand_sent", usageDuration: "less_1_week",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(5) },

        // [3] Verified organic, different variant
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "organic",
          productId: campDocs["camp_sony"], productSlug: "sony-wh-1000xm6", communitySlug: "tech",
          variantName: "Indigo Blue", variantId: vid("camp_sony","Indigo Blue"),
          reviewerName: "Sam Williams", reviewerId: "seed_u4", rating: 5,
          summary: "The Indigo Blue is the colourway of the year",
          content: "Sounds identical to the black but the colour attracts compliments constantly. Matte finish resists fingerprints unlike the glossy silver. Sound-wise this sits noticeably above my old Bose QC45 — bass is deeper and treble is less fatiguing over long sessions.",
          pros: ["Stunning matte finish", "Deep bass", "Non-fatiguing treble"],
          cons: ["Wish more colour options existed", "App still needs work"],
          likesCount: 89, helpfulCount: 34, forkCount: 0, commentCount: 1,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "1_3_months",
          eligibleForPayout: false, reviewType: "verified",
          createdAt: ago(20) },

        // ── HOME · Lumina Standing Desk ──────────────────────────────────────

        // [4] Verified, organic, high engagement, good balance
        { productName: "Lumina Smart Standing Desk", category: "Home", campaignId: "organic",
          productId: campDocs["camp_lumina"], productSlug: "lumina-smart-standing-desk", communitySlug: "home",
          variantName: "60\" White Top", variantId: vid("camp_lumina","60\" White Top"),
          reviewerName: "Marcus Thompson", reviewerId: "seed_u5", rating: 5,
          summary: "OLED Pomodoro timer changed how I work",
          content: "The built-in OLED timer is the killer feature nobody mentions. Set a 25-minute focus block, stand for the second half — it is now completely automatic. Assembly took 40 minutes solo. Every cable routes through the integrated tray. Wobble at full height is minimal even with three monitors.",
          pros: ["OLED timer genius", "Cable management excellent", "Stable at max height", "App integration works"],
          cons: ["Assembly instructions could be clearer", "App occasionally disconnects"],
          likesCount: 267, helpfulCount: 89, forkCount: 1, commentCount: 4,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "3_plus_months",
          eligibleForPayout: false, reviewType: "verified",
          mediaUrls: [
            "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=500&q=80&fit=crop",
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80&fit=crop",
          ],
          createdAt: ago(60) },

        // [5] Campaign review
        { productName: "Lumina Smart Standing Desk", category: "Home", campaignId: "camp_lumina",
          productId: campDocs["camp_lumina"], productSlug: "lumina-smart-standing-desk", communitySlug: "home",
          variantName: "48\" Walnut Top", variantId: vid("camp_lumina","48\" Walnut Top"),
          reviewerName: "Sophie Kim", reviewerId: "seed_u6", rating: 4,
          summary: "Best desk under $800 for single-monitor setups",
          content: "Compared seven desks before choosing this. For a single monitor the 48-inch is perfect. The walnut veneer looks genuinely premium — not cheap laminate. App reminders to stand actually work because the desk itself buzzes. Wish the surface was slightly deeper front-to-back.",
          pros: ["Premium walnut finish", "App reminders", "Solid motor"],
          cons: ["Shallow depth for dual monitor arms", "No USB-C hub built in"],
          likesCount: 134, helpfulCount: 45, forkCount: 0, commentCount: 2,
          isVerifiedPurchase: false, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_3_months",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(14) },

        // [6] Verified, organic
        { productName: "Lumina Smart Standing Desk", category: "Home", campaignId: "organic",
          productId: campDocs["camp_lumina"], productSlug: "lumina-smart-standing-desk", communitySlug: "home",
          variantName: "72\" Black Top", variantId: vid("camp_lumina","72\" Black Top"),
          reviewerName: "Derek Liu", reviewerId: "seed_u7", rating: 5,
          summary: "Triple-monitor setup, zero wobble",
          content: "Three 27-inch monitors plus a laptop stand and the 72-inch has room to spare. Motor is whisper-quiet — nobody in my open office notices when I raise it. Black top hides cable management perfectly. Two people needed for assembly given the weight but that is expected.",
          pros: ["Enormous surface", "Whisper-quiet motor", "Zero wobble at max height"],
          cons: ["Heavy — needs two people to assemble", "Premium price"],
          likesCount: 198, helpfulCount: 72, forkCount: 0, commentCount: 2,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "3_plus_months",
          eligibleForPayout: false, reviewType: "verified",
          createdAt: ago(35) },

        // ── SAAS · Linear ────────────────────────────────────────────────────

        // [7] Campaign, verified purchase (unusual for SaaS but tests the toggle)
        { productName: "Linear — Project Management", category: "SaaS", campaignId: "camp_linear",
          productId: campDocs["camp_linear"], productSlug: "linear-project-management", communitySlug: "saas",
          variantName: "Plus Plan ($8/user/mo)", variantId: vid("camp_linear","Plus Plan ($8/user/mo)"),
          reviewerName: "David Kim", reviewerId: "seed_u8", rating: 5,
          summary: "Jira killer — and I say that as a certified Jira admin",
          content: "Our 18-person engineering team migrated from Jira in a single afternoon. Creating an issue is three keystrokes. Cycles give our sprints actual structure. GitHub sync means no manual status updates. Six months in, nobody has asked to go back. The keyboard shortcut system alone saves me 45 minutes a week.",
          pros: ["Instant issue creation (3 keystrokes)", "Cycles track velocity naturally", "GitHub sync is flawless", "Fast as a native app"],
          cons: ["No Gantt chart for stakeholders", "Free tier member limit too low"],
          likesCount: 312, helpfulCount: 134, forkCount: 3, commentCount: 6,
          isVerifiedPurchase: true, isCampaignReview: true,
          productSource: "purchased", usageDuration: "3_plus_months",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(25) },

        // [8] Campaign, not verified
        { productName: "Linear — Project Management", category: "SaaS", campaignId: "camp_linear",
          productId: campDocs["camp_linear"], productSlug: "linear-project-management", communitySlug: "saas",
          variantName: "Free Tier", variantId: vid("camp_linear","Free Tier"),
          reviewerName: "Anita Rao", reviewerId: "seed_u9", rating: 4,
          summary: "The free tier is legitimately useful for solo devs",
          content: "I run a one-person dev shop and the free tier covers everything I need. Keyboard shortcuts feel native rather than learned. Issue creation is so fast I actually log things I would normally ignore. Upgrade limits are frustrating if you add contractors.",
          pros: ["Free tier generous for solo", "Keyboard-first design", "Views are flexible"],
          cons: ["Free tier member limit", "No time tracking built in"],
          likesCount: 89, helpfulCount: 34, forkCount: 0, commentCount: 1,
          isVerifiedPurchase: false, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_3_months",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(18) },

        // ── AUTOMOTIVE · Rivian R2 ───────────────────────────────────────────

        // [9] Verified owner, organic, high engagement, will get versions
        { productName: "Rivian R2 SUV", category: "Automotive", campaignId: "organic",
          productId: campDocs["camp_rivian"], productSlug: "rivian-r2-suv", communitySlug: "automotive",
          variantName: "Max Pack · Quad-Motor", variantId: vid("camp_rivian","Max Pack · Quad-Motor"),
          reviewerName: "Chris Meyers", reviewerId: "seed_u10", rating: 5,
          summary: "10,000 miles in — still the best vehicle decision I've made",
          content: "Took it through Zion, Arches, and a 3,000-mile cross-country trip. The gear tunnel has replaced my entire rooftop cargo setup. Highway Assist is hands-free on any divided highway and actually trustworthy. Software updates have fixed every single issue I logged in the first month. Charging network smaller than Tesla but Electrify America works without app drama.",
          pros: ["Off-road capability genuine", "Gear tunnel genius", "OTA updates actually fix things", "Interior space class-leading"],
          cons: ["Charging network smaller than Tesla", "Service centres too few", "Camp Mode limited vs Tesla"],
          likesCount: 456, helpfulCount: 198, forkCount: 2, commentCount: 8,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "3_plus_months",
          eligibleForPayout: false, reviewType: "verified",
          mediaUrls: [
            "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=500&q=80&fit=crop",
            "https://images.unsplash.com/photo-1558618047-3e8e001c1e1e?w=500&q=80&fit=crop",
          ],
          createdAt: ago(90) },

        // [10] Campaign review
        { productName: "Rivian R2 SUV", category: "Automotive", campaignId: "camp_rivian",
          productId: campDocs["camp_rivian"], productSlug: "rivian-r2-suv", communitySlug: "automotive",
          variantName: "Long Range · AWD", variantId: vid("camp_rivian","Long Range · AWD"),
          reviewerName: "Olivia Park", reviewerId: "seed_u11", rating: 4,
          summary: "Best family EV if you have kids and a driveway charger",
          content: "Three car seats fit without anyone losing a hip — the flat floor is the trick. 290 miles of EPA range means we charge once per week at home for our 60-mile daily routine. Software updates arrive OTA and have been genuinely improving the product monthly. Service centre access remains the weak point.",
          pros: ["Family interior space", "290mi range sufficient", "OTA updates frequent", "Frunk storage useful"],
          cons: ["Service centre scarcity", "App still has rough edges"],
          likesCount: 213, helpfulCount: 78, forkCount: 1, commentCount: 3,
          isVerifiedPurchase: false, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_3_months",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(22) },

        // ── BEAUTY · Rhode Lip Treatment ─────────────────────────────────────

        // [11] Verified, organic, high engagement
        { productName: "Rhode Peptide Lip Treatment", category: "Beauty", campaignId: "organic",
          productId: campDocs["camp_rhode"], productSlug: "rhode-peptide-lip-treatment", communitySlug: "beauty",
          variantName: "Glazed Donut", variantId: vid("camp_rhode","Glazed Donut"),
          reviewerName: "Aisha Patel", reviewerId: "seed_u12", rating: 5,
          summary: "Two months in — lips are genuinely different",
          content: "I was deeply sceptical. Lip glosses do not plump lips — that is marketing speak. Two months of daily use later and the vertical lip lines I have had since my 30s are measurably reduced. The glaze finish photographs beautifully without that sticky latex feel other glosses have. Repurchased twice.",
          pros: ["Real plumping over time", "Non-sticky glaze finish", "Hydration lasts 4–5 hours", "Photographs well"],
          cons: ["Small tube for the price", "Glazed Donut scent divisive"],
          likesCount: 378, helpfulCount: 145, forkCount: 1, commentCount: 5,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "3_plus_months",
          eligibleForPayout: false, reviewType: "verified",
          createdAt: ago(55) },

        // [12] Campaign review
        { productName: "Rhode Peptide Lip Treatment", category: "Beauty", campaignId: "camp_rhode",
          productId: campDocs["camp_rhode"], productSlug: "rhode-peptide-lip-treatment", communitySlug: "beauty",
          variantName: "Watermelon Slice", variantId: vid("camp_rhode","Watermelon Slice"),
          reviewerName: "Zoe Taylor", reviewerId: "seed_u13", rating: 4,
          summary: "Watermelon Slice is summer in a tube — legitimately",
          content: "The scent is genuinely watermelon rather than generic fruit candy. Light pink tint flatters every skin tone in my friend group (we tested across four people, four very different undertones). Applies clean, lasts about 3 hours before you need to reapply. Packaging could be more sustainable.",
          pros: ["Authentic scent", "Universal tint", "Clean application", "Non-sticky"],
          cons: ["3-hour wear before reapplication", "Plastic packaging not great"],
          likesCount: 134, helpfulCount: 56, forkCount: 0, commentCount: 2,
          isVerifiedPurchase: false, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_3_months",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(8) },

        // ── GAMING · PlayStation 5 Pro ───────────────────────────────────────

        // [13] Campaign, verified purchase, high engagement
        { productName: "PlayStation 5 Pro", category: "Gaming", campaignId: "camp_ps5pro",
          productId: campDocs["camp_ps5pro"], productSlug: "playstation-5-pro", communitySlug: "gaming",
          variantName: "Disc Edition", variantId: vid("camp_ps5pro","Disc Edition"),
          reviewerName: "Tom Harrison", reviewerId: "seed_u14", rating: 5,
          summary: "PSSR makes 60fps ray tracing actually possible",
          content: "Spider-Man 2 at 60fps with full ray tracing is genuinely stunning — this would require a $2,000 PC to achieve natively. PSSR upscaling is not perfect on every title but the best implementations are indistinguishable from native 4K. DualSense haptics remain the most underrated innovation in gaming. The extra storage alone justifies the upgrade from base PS5 if you own more than 15 games.",
          pros: ["PSSR enables 60fps RT in flagship titles", "2TB SSD essential", "DualSense haptics still best-in-class", "Backward compat perfect"],
          cons: ["PSSR inconsistent across games", "Premium price", "No 8K games exist yet"],
          likesCount: 534, helpfulCount: 234, forkCount: 3, commentCount: 9,
          isVerifiedPurchase: true, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_3_months",
          eligibleForPayout: true, reviewType: "campaign",
          mediaUrls: [
            "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=500&q=80&fit=crop",
            "https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=500&q=80&fit=crop",
          ],
          createdAt: ago(12) },

        // [14] Organic, honest mixed review
        { productName: "PlayStation 5 Pro", category: "Gaming", campaignId: "organic",
          productId: campDocs["camp_ps5pro"], productSlug: "playstation-5-pro", communitySlug: "gaming",
          variantName: "Digital Edition", variantId: vid("camp_ps5pro","Digital Edition"),
          reviewerName: "Leo Santos", reviewerId: "seed_u15", rating: 3,
          summary: "Honest take: only worth it if your library is first-party",
          content: "The hardware is excellent. But if you predominantly play multiplatform games or indie titles the PSSR uplift is marginal. I own 40 games and maybe 8 have meaningful Pro enhancements. If your library is Spider-Man, Horizon, GT7, and first-party exclusives this is a no-brainer. If it's COD, FIFA, and Minecraft — save the $200.",
          pros: ["Performance uplift real in supported titles", "2TB welcome", "DualSense unchanged from PS5"],
          cons: ["PSSR support patchy", "Price premium hard to justify for multiplatform gamers", "No 4K Blu-ray on Digital"],
          likesCount: 234, helpfulCount: 123, forkCount: 0, commentCount: 4,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "1_3_months",
          eligibleForPayout: false, reviewType: "verified",
          createdAt: ago(8) },

        // ── FITNESS · Whoop 5.0 ──────────────────────────────────────────────

        // [15] Verified, organic, will get version update
        { productName: "Whoop 5.0 Band", category: "Fitness", campaignId: "organic",
          productId: campDocs["camp_whoop"], productSlug: "whoop-5-0-band", communitySlug: "fitness",
          variantName: "Onyx Black", variantId: vid("camp_whoop","Onyx Black"),
          reviewerName: "Elena Rodriguez", reviewerId: "seed_u16", rating: 5,
          summary: "Caught an illness 48hrs before symptoms via HRV",
          content: "Six months in and I have completely restructured my training blocks around recovery scores. The most useful moment was when my HRV dropped 18% below baseline for no obvious reason — I rested that day instead of training hard, and 48 hours later got a cold. The device literally predicted my illness. Skin temperature tracking is the sleeper feature — it explains the bad sleep nights I couldn't otherwise account for.",
          pros: ["HRV genuinely predictive", "Sleep staging accurate", "Skin temp catches illness early", "Comfortable to sleep in"],
          cons: ["Subscription model expensive long-term", "No screen means phone dependency", "Community features underdeveloped"],
          likesCount: 289, helpfulCount: 134, forkCount: 1, commentCount: 5,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "3_plus_months",
          eligibleForPayout: false, reviewType: "verified",
          mediaUrls: [
            "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500&q=80&fit=crop",
          ],
          createdAt: ago(70) },

        // [16] Campaign review
        { productName: "Whoop 5.0 Band", category: "Fitness", campaignId: "camp_whoop",
          productId: campDocs["camp_whoop"], productSlug: "whoop-5-0-band", communitySlug: "fitness",
          variantName: "Stone Grey", variantId: vid("camp_whoop","Stone Grey"),
          reviewerName: "James Okafor", reviewerId: "seed_u17", rating: 4,
          summary: "The data nerd's fitness tracker",
          content: "If you want a screen showing your heart rate during workouts this is the wrong device. If you want to understand whether your body is ready to push hard or needs rest, this is the best tool available. Strain coach accuracy improves significantly after month two once the algorithm has enough baseline data.",
          pros: ["Strain coaching gets smarter over time", "Screenless means no distraction", "Battery 4 days consistent"],
          cons: ["Subscription expensive", "Algorithm needs 4–6 weeks to calibrate", "No GPS"],
          likesCount: 145, helpfulCount: 67, forkCount: 0, commentCount: 2,
          isVerifiedPurchase: false, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_3_months",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(16) },

        // ── TRAVEL · IHG Indigo Hotels ───────────────────────────────────────

        // [17] Verified, organic
        { productName: "IHG One Rewards — Indigo Hotels", category: "Travel", campaignId: "organic",
          productId: campDocs["camp_ihg"], productSlug: "ihg-one-rewards-indigo-hotels", communitySlug: "travel",
          variantName: "Hotel Indigo Edinburgh", variantId: vid("camp_ihg","Hotel Indigo Edinburgh"),
          reviewerName: "Priya Nair", reviewerId: "seed_u18", rating: 5,
          summary: "Staff recommended a whisky bar that isn't on any app",
          content: "The Hotel Indigo Edinburgh experience is built around neighbourhood knowledge. The concierge sent me to a 40-year-old whisky bar that locals use, not tourists. Room design is genuinely thoughtful — the tiles reference the local geology. Not a generic hotel that happens to have a fashionable lobby. Points redemption is unnecessarily complex but the stays themselves are exceptional.",
          pros: ["Neighbourhood character genuine", "Staff local knowledge outstanding", "Design rooted in location"],
          cons: ["Points redemption complex", "App check-in unreliable"],
          likesCount: 189, helpfulCount: 78, forkCount: 0, commentCount: 3,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "1_4_weeks",
          eligibleForPayout: false, reviewType: "verified",
          createdAt: ago(40) },

        // [18] Campaign review
        { productName: "IHG One Rewards — Indigo Hotels", category: "Travel", campaignId: "camp_ihg",
          productId: campDocs["camp_ihg"], productSlug: "ihg-one-rewards-indigo-hotels", communitySlug: "travel",
          variantName: "Hotel Indigo NYC", variantId: vid("camp_ihg","Hotel Indigo NYC"),
          reviewerName: "Rachel Torres", reviewerId: "seed_u19", rating: 4,
          summary: "Midtown location is genuinely underpriced for what it is",
          content: "Walking distance to MoMA, Rockefeller, and the Park without the midtown hotel premium. The art deco lobby makes check-in feel like an arrival rather than a transaction. Rooms are compact but designed with zero wasted space — the storage solutions are actually clever. Breakfast quality inconsistent across visits.",
          pros: ["Location unbeatable for midtown", "Art deco lobby", "Room layout clever", "Upgrade on Ambassador tier"],
          cons: ["Rooms genuinely small", "Breakfast inconsistent", "Gym basic"],
          likesCount: 123, helpfulCount: 56, forkCount: 0, commentCount: 2,
          isVerifiedPurchase: false, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_4_weeks",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(11) },

        // ── FINANCE · Robinhood Gold ─────────────────────────────────────────

        // [19] Verified, honest mixed — tests low health score
        { productName: "Robinhood Gold", category: "Finance", campaignId: "organic",
          productId: campDocs["camp_robinhood"], productSlug: "robinhood-gold", communitySlug: "finance",
          variantName: "Annual · $50/yr", variantId: vid("camp_robinhood","Annual · $50/yr"),
          reviewerName: "Nate Diaz", reviewerId: "seed_u20", rating: 3,
          summary: "Great UI, outgrown by anyone beyond beginner level",
          content: "For parking emergency cash at 5% APY and trading options on your phone, Robinhood Gold is genuinely excellent. As a long-term investor trying to build a serious portfolio, I hit its ceiling quickly. No screeners, no bond purchasing, no proper tax-loss harvesting, customer support is email-only and slow. The interface is the best in the industry — I wish the tools matched it.",
          pros: ["5% APY on cash competitive", "UI best in class", "Options trading simple", "Instant deposits convenient"],
          cons: ["No bond purchasing", "Weak screeners", "Customer support email-only and slow", "No true tax-loss harvesting"],
          likesCount: 156, helpfulCount: 89, forkCount: 0, commentCount: 3,
          isVerifiedPurchase: true, isCampaignReview: false,
          productSource: "purchased", usageDuration: "3_plus_months",
          eligibleForPayout: false, reviewType: "verified",
          createdAt: ago(35) },

        // [20] Campaign review
        { productName: "Robinhood Gold", category: "Finance", campaignId: "camp_robinhood",
          productId: campDocs["camp_robinhood"], productSlug: "robinhood-gold", communitySlug: "finance",
          variantName: "Monthly · $5/mo", variantId: vid("camp_robinhood","Monthly · $5/mo"),
          reviewerName: "Kenji Tanaka", reviewerId: "seed_u21", rating: 4,
          summary: "APY alone covers the subscription fee in the first month",
          content: "On $20,000 in idle cash, the 5% APY generates $83/month — the subscription costs $5. The math is obvious. Instant deposit limit increase from $1,000 to $50,000 was the feature that made me upgrade. Margin rates at 6.5% are competitive with Interactive Brokers. Interface is genuinely the best for quick trades.",
          pros: ["APY pays for itself immediately", "Instant deposit increase", "Margin rate competitive", "Slick interface"],
          cons: ["No fixed income products", "Customer support still weak"],
          likesCount: 112, helpfulCount: 45, forkCount: 0, commentCount: 1,
          isVerifiedPurchase: false, isCampaignReview: true,
          productSource: "brand_sent", usageDuration: "1_3_months",
          eligibleForPayout: true, reviewType: "campaign",
          createdAt: ago(9) },
      ];

      // Write reviews with computed health scores
      const reviewIds: string[] = [];
      for (const rev of reviews) {
        const reviewData = {
          likedBy: [], helpfulBy: [], notHelpfulBy: [],
          notHelpfulCount: 0,
          versionCount: 1,
          mediaUrls: [],
          subRatings: {},
          ...rev,
        };
        const { score, breakdown } = computeHealthScore(reviewData, 0, 0);
        const ref = await addDoc(collection(db, "reviews"), {
          ...reviewData,
          healthScore: score,
          healthScoreBreakdown: breakdown,
          healthScoreUpdatedAt: now.toISOString(),
        });
        reviewIds.push(ref.id);
      }

      setStatusMessage("Inserting channels (with one boosted category)…");

      // ── Communities — one per product category, slugs match product.communitySlug ─
      // Two are BOOSTED to test the 🔥 Boosted badge on Explore + Home pages
      const sampleChannels = [
        { name: "Tech", slug: "tech",
          description: "Consumer tech reviews, comparisons, and buyer guides.", category: "Tech", iconEmoji: "💻",
          multiplier: 1, multiplierExpiresAt: null },
        { name: "Home & Ergonomics", slug: "home",
          description: "Smart home, furniture, and ergonomics reviews.", category: "Home", iconEmoji: "🏠",
          multiplier: 1, multiplierExpiresAt: null },
        { name: "SaaS & Dev Tools", slug: "saas",
          description: "Software reviews from real users and developers. No fluff.", category: "SaaS", iconEmoji: "⚙️",
          // BOOSTED — tests the 🔥 Boosted badge
          multiplier: 1.5,
          multiplierExpiresAt: new Date(now.getTime() + 30 * day).toISOString(),
          multiplierSponsoredBy: "Linear" },
        { name: "Automotive & EV", slug: "automotive",
          description: "Car, EV, and transport ownership reviews.", category: "Automotive", iconEmoji: "🚗",
          multiplier: 1, multiplierExpiresAt: null },
        { name: "Beauty & Skincare", slug: "beauty",
          description: "Ingredient-led beauty reviews and routine breakdowns.", category: "Beauty", iconEmoji: "✨",
          // BOOSTED — tests the 🔥 Boosted badge
          multiplier: 2.0,
          multiplierExpiresAt: new Date(now.getTime() + 30 * day).toISOString(),
          multiplierSponsoredBy: "Rhode" },
        { name: "Gaming", slug: "gaming",
          description: "Console and PC gaming reviews and comparisons.", category: "Gaming", iconEmoji: "🎮",
          multiplier: 1, multiplierExpiresAt: null },
        { name: "Fitness & Health", slug: "fitness",
          description: "Fitness trackers, gym gear, and wellness reviews.", category: "Fitness", iconEmoji: "💪",
          multiplier: 1, multiplierExpiresAt: null },
        { name: "Travel & Hospitality", slug: "travel",
          description: "Hotel, airline, and travel product reviews.", category: "Travel", iconEmoji: "✈️",
          multiplier: 1, multiplierExpiresAt: null },
        { name: "Finance & Investing", slug: "finance",
          description: "Fintech and investing platform reviews.", category: "Finance", iconEmoji: "💰",
          multiplier: 1, multiplierExpiresAt: null },
      ];

      const channelIds: Record<string, string> = {};
      for (const ch of sampleChannels) {
        const ref = await addDoc(collection(db, "channels"), {
          ...ch,
          creatorId: "seed_admin",
          creatorName: "Admin",
          memberCount: Math.floor(Math.random() * 200) + 20,
          reviewCount: 0,
          createdAt: now.toISOString(),
          isOfficial: true,
        });
        channelIds[ch.slug] = ref.id;
      }

      setStatusMessage("Adding version updates (Ownership Journey cards)…");

      // ── Version updates — tests the Ownership Journey card in the Hub ────
      // Review [0] — Alex Chen's Sony review gets 3-month and 6-month updates
      if (reviewIds[0]) {
        await addDoc(collection(db, "reviews", reviewIds[0], "versions"), {
          versionNumber: 2, versionLabel: "3 Month Update",
          content: "Three months in and the ear cushions have broken in perfectly — now the most comfortable headphones I have owned. ANC is still class-leading. Battery performance unchanged at 38+ hours. App had a major update that simplified the equaliser. Still my daily driver.",
          rating: 5, pros: ["Ear cushions broken in nicely", "App improved"], cons: ["App was poor initially"], subRatings: {}, mediaUrls: [],
          createdAt: ago(15),
        });
        await addDoc(collection(db, "reviews", reviewIds[0], "versions"), {
          versionNumber: 3, versionLabel: "6 Month Update",
          content: "Six months and 400+ hours of use. The headband padding has flattened slightly but comfort is still excellent. I flew Tokyo-London with these and the ANC handled the cabin drone better than anything else I tested on the flight. I lent them to a colleague and she ordered a pair the same day.",
          rating: 5, pros: ["Still best-in-class ANC", "Held up to intensive use"], cons: ["Headband padding flattening slightly"], subRatings: {}, mediaUrls: [],
          createdAt: ago(2),
        });
        await updateDoc(doc(db, "reviews", reviewIds[0]), {
          versionCount: 3, latestVersionLabel: "6 Month Update", lastUpdatedAt: ago(2),
        });
      }

      // Review [9] — Chris Meyers' Rivian review gets 3-month and 1-year updates
      if (reviewIds[9]) {
        await addDoc(collection(db, "reviews", reviewIds[9], "versions"), {
          versionNumber: 2, versionLabel: "3 Month Update",
          content: "5,000 miles in. First service was mobile — Rivian sent a technician to my driveway. A tonneau cover fit perfectly and expanded cargo utility further. One OTA update added bidirectional charging (V2H) which is genuinely useful during power outages. Charging anxiety gone after installing a Level 2 home charger.",
          rating: 5, pros: ["Mobile service outstanding", "OTA added V2H charging", "Charging anxiety gone with home L2"], cons: ["Third-party accessory ecosystem still thin"], subRatings: {}, mediaUrls: [],
          createdAt: ago(60),
        });
        await addDoc(collection(db, "reviews", reviewIds[9], "versions"), {
          versionNumber: 3, versionLabel: "1 Year Update",
          content: "10,000 miles and the R2 continues to improve through software. The latest update added predictive range calculation that accounts for my actual driving patterns rather than EPA estimates. Rear seat entertainment system added via OTA. One hardware issue — a door seal replacement handled perfectly under warranty within 48 hours. Best vehicle I have owned.",
          rating: 5, pros: ["OTA improvements continuous", "Predictive range excellent now", "Warranty service fast"], cons: ["Charging network still Tesla-size gap"], subRatings: {}, mediaUrls: [],
          createdAt: ago(3),
        });
        await updateDoc(doc(db, "reviews", reviewIds[9]), {
          versionCount: 3, latestVersionLabel: "1 Year Update", lastUpdatedAt: ago(3),
        });
      }

      // Review [15] — Elena's Whoop review gets a 1-year update
      if (reviewIds[15]) {
        await addDoc(collection(db, "reviews", reviewIds[15], "versions"), {
          versionNumber: 2, versionLabel: "1 Year Update",
          content: "One year in. The algorithm has become eerily accurate — it predicted a period of overtraining I was heading into before I noticed the symptoms. Sleep stage accuracy verified against a clinical sleep study (I did one for work reasons) and it was within 7% on all stages. The subscription is expensive but the health insight ROI is real for me.",
          rating: 5, pros: ["Algorithm accuracy improves continuously", "Sleep staging near-clinical accuracy after 1yr"], cons: ["Annual subscription adds up", "Band material showing wear on clasp after 12mo"], subRatings: {}, mediaUrls: [],
          createdAt: ago(5),
        });
        await updateDoc(doc(db, "reviews", reviewIds[15]), {
          versionCount: 2, latestVersionLabel: "1 Year Update", lastUpdatedAt: ago(5),
        });
      }

      setStatusMessage("Adding forks…");

      // ── Forks — tests fork badge and fork count on ReviewCard ────────────
      // Review [1] forks review [0] (Priya forks Alex's Sony review)
      if (reviewIds[0] && reviewIds[1]) {
        await updateDoc(doc(db, "reviews", reviewIds[1]), {
          forkedFromReviewId: reviewIds[0],
          forkedFromReviewerName: "Alex Chen",
        });
        await updateDoc(doc(db, "reviews", reviewIds[0]), { forkCount: 2 });
        await addDoc(collection(db, "reviewForks"), {
          originalReviewId: reviewIds[0], forkReviewId: reviewIds[1],
          forkerId: "seed_u2", forkerName: "Priya Singh", createdAt: ago(28),
        });
      }

      // Review [10] forks review [9] (Olivia forks Chris's Rivian review)
      if (reviewIds[9] && reviewIds[10]) {
        await updateDoc(doc(db, "reviews", reviewIds[10]), {
          forkedFromReviewId: reviewIds[9],
          forkedFromReviewerName: "Chris Meyers",
        });
        await updateDoc(doc(db, "reviews", reviewIds[9]), { forkCount: 2 });
        await addDoc(collection(db, "reviewForks"), {
          originalReviewId: reviewIds[9], forkReviewId: reviewIds[10],
          forkerId: "seed_u11", forkerName: "Olivia Park", createdAt: ago(20),
        });
      }

      setStatusMessage("Adding threaded comments…");

      // ── Comments — tests nested comments & commentCount badge ─────────────
      if (reviewIds[0]) {
        const c1 = await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[0], userId: "seed_u5", userName: "Marcus Thompson",
          content: "Completely agree on the ANC. Have you tried these on a long-haul flight? Curious how they handle cabin pressure.",
          createdAt: ago(12), parentCommentId: null, depth: 0,
        });
        await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[0], userId: "seed_u1", userName: "Alex Chen",
          content: "Tokyo-London and the cabin drone was almost completely gone. Way better than the QC45 I used on the same route last year.",
          createdAt: ago(11), parentCommentId: c1.id, depth: 1,
        });
        await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[0], userId: "seed_u4", userName: "Sam Williams",
          content: "Just to add — I wear the Indigo Blue on flights and can confirm the same experience. The low-frequency rumble disappears entirely.",
          createdAt: ago(10), parentCommentId: c1.id, depth: 1,
        });
        const c2 = await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[0], userId: "seed_u9", userName: "Anita Rao",
          content: "How do these compare to the Bose QC Ultra? That's my current set.",
          createdAt: ago(8), parentCommentId: null, depth: 0,
        });
        await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[0], userId: "seed_u1", userName: "Alex Chen",
          content: "ANC is better on the Sony for low-frequency (engines, traffic). Bose is still ahead on mid-frequency (voices, AC). Comfort goes to Bose slightly. Sound quality Sony wins clearly with LDAC.",
          createdAt: ago(7), parentCommentId: c2.id, depth: 1,
        });
        await updateDoc(doc(db, "reviews", reviewIds[0]), { commentCount: 5 });
      }

      if (reviewIds[7]) {
        const c1 = await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[7], userId: "seed_u8", userName: "David Kim",
          content: "For anyone coming from Jira — the migration is easier than you think. Linear has a Jira importer that took our 3,000 issues in under an hour.",
          createdAt: ago(20), parentCommentId: null, depth: 0,
        });
        await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[7], userId: "seed_u9", userName: "Anita Rao",
          content: "Can confirm this. Solo dev migration from Jira was 20 minutes including cleaning up old closed issues.",
          createdAt: ago(19), parentCommentId: c1.id, depth: 1,
        });
        await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[7], userId: "seed_u6", userName: "Sophie Kim",
          content: "Does the Gantt chart gap cause issues with stakeholder reporting? That is my team's main concern.",
          createdAt: ago(18), parentCommentId: null, depth: 0,
        });
        await updateDoc(doc(db, "reviews", reviewIds[7]), { commentCount: 3 });
      }

      setStatusMessage("Adding Discussion posts…");

      // ── Discussion posts — tests the Discussion tab in the Product Hub ───
      // Sony product discussions
      if (campDocs["camp_sony"]) {
        await addDoc(collection(db, "productDiscussions"), {
          productId: campDocs["camp_sony"], authorId: "seed_u5", authorName: "Marcus Thompson",
          type: "question", body: "Does anyone know if these work well with hearing aids? My dad has mild hearing loss and is considering them for air travel.",
          upvotes: 12, upvotedBy: [], createdAt: ago(5),
        });
        await addDoc(collection(db, "productDiscussions"), {
          productId: campDocs["camp_sony"], authorId: "seed_u9", authorName: "Anita Rao",
          type: "comparison", body: "Sony XM6 vs Bose QC Ultra — I tested both for two weeks. Sony wins on: ANC (especially engine noise), sound quality (LDAC), battery. Bose wins on: comfort (especially clamping), mid-frequency ANC (voices/AC), build quality. For commuting: Sony. For office all-day wear: Bose.",
          upvotes: 34, upvotedBy: [], createdAt: ago(8),
        });
        await addDoc(collection(db, "productDiscussions"), {
          productId: campDocs["camp_sony"], authorId: "seed_u3", authorName: "BrandPartner99",
          type: "issue", body: "Anyone else getting Bluetooth dropout when walking past microwaves? Noticed it twice in my office kitchen.",
          upvotes: 7, upvotedBy: [], createdAt: ago(3),
        });
      }

      // Rivian product discussions
      if (campDocs["camp_rivian"]) {
        await addDoc(collection(db, "productDiscussions"), {
          productId: campDocs["camp_rivian"], authorId: "seed_u10", authorName: "Chris Meyers",
          type: "tip", body: "Pro tip: enable camp mode via the vehicle settings menu, not the app. The app version has a bug where it turns off after 4 hours. Vehicle menu version runs all night. Took me three camping trips to figure this out.",
          upvotes: 67, upvotedBy: [], createdAt: ago(15),
        });
        await addDoc(collection(db, "productDiscussions"), {
          productId: campDocs["camp_rivian"], authorId: "seed_u11", authorName: "Olivia Park",
          type: "question", body: "What third-party cargo accessories are compatible with the gear tunnel? Specifically looking for a bike-rack adapter.",
          upvotes: 23, upvotedBy: [], createdAt: ago(7),
        });
        await addDoc(collection(db, "productDiscussions"), {
          productId: campDocs["camp_rivian"], authorId: "seed_u20", authorName: "Nate Diaz",
          type: "rant", body: "Service centre situation is genuinely unacceptable. Nearest one to me is 280 miles away. Had a door seal issue (minor) and getting it fixed required a 560-mile round trip or waiting 6 weeks for mobile service. Love the vehicle, but Rivian need to address this before expanding sales further.",
          upvotes: 89, upvotedBy: [], createdAt: ago(4),
        });
      }

      // Linear product discussions
      if (campDocs["camp_linear"]) {
        await addDoc(collection(db, "productDiscussions"), {
          productId: campDocs["camp_linear"], authorId: "seed_u8", authorName: "David Kim",
          type: "tip", body: "Keyboard shortcut that changed my life: 'C' to create issue from anywhere, then Tab-Tab to set priority, Tab-Tab-Tab to set assignee. Never touch the mouse for issue creation again.",
          upvotes: 45, upvotedBy: [], createdAt: ago(10),
        });
        await addDoc(collection(db, "productDiscussions"), {
          productId: campDocs["camp_linear"], authorId: "seed_u6", authorName: "Sophie Kim",
          type: "question", body: "How do you handle stakeholder roadmap visibility? We moved to Linear from Jira and PMs are asking for a Gantt view. What's everyone using?",
          upvotes: 31, upvotedBy: [], createdAt: ago(6),
        });
      }

      setStatusMessage("Adding comparison forks for Counter-Take feature…");

      // ── Extra fork: PS5 Pro — Leo's honest 3-star counter-take on Tom's 5-star ─
      // This is the richest disagreement in the seed set: same product, very different views
      if (reviewIds[13] && reviewIds[14]) {
        await updateDoc(doc(db, "reviews", reviewIds[14]), {
          forkedFromReviewId: reviewIds[13],
          forkedFromReviewerName: "Tom Harrison",
        });
        await updateDoc(doc(db, "reviews", reviewIds[13]), { forkCount: 3 });
        await addDoc(collection(db, "reviewForks"), {
          originalReviewId: reviewIds[13], forkReviewId: reviewIds[14],
          forkerId: "seed_u15", forkerName: "Leo Santos", createdAt: ago(7),
        });
      }

      // ── Extra fork: Whoop — James's subscription-sceptic counter-take on Elena's ─
      if (reviewIds[15] && reviewIds[16]) {
        await updateDoc(doc(db, "reviews", reviewIds[16]), {
          forkedFromReviewId: reviewIds[15],
          forkedFromReviewerName: "Elena Rodriguez",
        });
        await updateDoc(doc(db, "reviews", reviewIds[15]), { forkCount: 2 });
        await addDoc(collection(db, "reviewForks"), {
          originalReviewId: reviewIds[15], forkReviewId: reviewIds[16],
          forkerId: "seed_u17", forkerName: "James Okafor", createdAt: ago(14),
        });
      }

      setStatusMessage("Adding Q&A answers (Ask an Owner feature)…");

      // ── Q&A Answers (productDiscussionAnswers) ─────────────────────────────
      // Verified owners reply to questions in their product's Q&A tab.
      // isVerifiedOwner === true for reviewers who have isVerifiedPurchase: true.

      // Sony — question about hearing aids (Alex Chen is verified owner of Sony)
      const sonyDiscSnap = await getDocs(
        query(collection(db, "productDiscussions"), where("productId", "==", campDocs["camp_sony"]))
      ).catch(() => null);
      if (sonyDiscSnap) {
        const hearingQ = sonyDiscSnap.docs.find(d => d.data().type === "question");
        if (hearingQ) {
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: hearingQ.id, productId: campDocs["camp_sony"],
            authorId: "seed_u1", authorName: "Alex Chen",
            body: "Great question. I can't speak to hearing aids specifically, but the Ambient Sound / transparency mode on these is genuinely well-tuned — it lets through speech without the digital artefacts you get on most competitors. The ANC also has a 'Voice Priority' setting that preserves conversation frequencies. I'd strongly suggest your dad tests in-store. The Sony store staff in London let me spend 40 minutes testing before I bought.",
            isVerifiedOwner: true, upvotes: 14, upvotedBy: [], createdAt: ago(4),
          });
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: hearingQ.id, productId: campDocs["camp_sony"],
            authorId: "seed_u4", authorName: "Sam Williams",
            body: "I'd echo the above — transparent mode on this is the best I've heard. One thing worth knowing: you can run Transparency and light ANC simultaneously on the XM6, which might be exactly what your dad needs on flights.",
            isVerifiedOwner: true, upvotes: 6, upvotedBy: [], createdAt: ago(3),
          });
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: hearingQ.id, productId: campDocs["camp_sony"],
            authorId: "seed_u9", authorName: "Anita Rao",
            body: "Not an owner but an audiologist once told me that over-ear ANC headphones can actually work well alongside certain hearing aids because they're not blocking the ear canal. Worth getting professional advice either way.",
            isVerifiedOwner: false, upvotes: 3, upvotedBy: [], createdAt: ago(2),
          });
        }
      }

      // Rivian — question about cargo accessories (Chris Meyers is verified owner)
      const rivianDiscSnap = await getDocs(
        query(collection(db, "productDiscussions"), where("productId", "==", campDocs["camp_rivian"]))
      ).catch(() => null);
      if (rivianDiscSnap) {
        const cargoQ = rivianDiscSnap.docs.find(d => d.data().type === "question");
        if (cargoQ) {
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: cargoQ.id, productId: campDocs["camp_rivian"],
            authorId: "seed_u10", authorName: "Chris Meyers",
            body: "I've tested three systems over 10,000 miles. The Rock Tamers Gear Tunnel Organizer ($189) is the best value. The Decked system is excellent for serious off-road and van-life use but pricey. Rivian's official accessories are overpriced for what they are. For a bike rack specifically — the Yakima HoldUp EVO hitches directly to the Rivian receiver and handles two e-bikes without any sway issues.",
            isVerifiedOwner: true, upvotes: 31, upvotedBy: [], createdAt: ago(5),
          });
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: cargoQ.id, productId: campDocs["camp_rivian"],
            authorId: "seed_u11", authorName: "Olivia Park",
            body: "Confirming the Yakima recommendation — it's what we use for our kids' bikes and it's solid. The R2's hitch rating is high enough for e-bikes without issue.",
            isVerifiedOwner: false, upvotes: 9, upvotedBy: [], createdAt: ago(4),
          });
        }
      }

      // Linear — question about stakeholder roadmap (David Kim is verified owner)
      const linearDiscSnap = await getDocs(
        query(collection(db, "productDiscussions"), where("productId", "==", campDocs["camp_linear"]))
      ).catch(() => null);
      if (linearDiscSnap) {
        const roadmapQ = linearDiscSnap.docs.find(d => d.data().type === "question");
        if (roadmapQ) {
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: roadmapQ.id, productId: campDocs["camp_linear"],
            authorId: "seed_u8", authorName: "David Kim",
            body: "We solved this with a Linear → Notion sync via Make (formerly Integromat). Linear stays as source of truth for engineers; Notion shows a curated roadmap view for PMs and investors that auto-updates whenever we move issues between cycles. The setup took about 2 hours and has saved hours of manual status updates every week. Happy to share the template if anyone wants it.",
            isVerifiedOwner: true, upvotes: 23, upvotedBy: [], createdAt: ago(4),
          });
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: roadmapQ.id, productId: campDocs["camp_linear"],
            authorId: "seed_u9", authorName: "Anita Rao",
            body: "Simpler approach for solo devs: I export the active cycle to a Google Sheet once a week via the Linear API. Three lines of code in a Google Apps Script runs automatically every Monday. PMs get a Gantt-ish view without me lifting a finger.",
            isVerifiedOwner: false, upvotes: 11, upvotedBy: [], createdAt: ago(3),
          });
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: roadmapQ.id, productId: campDocs["camp_linear"],
            authorId: "seed_u6", authorName: "Sophie Kim",
            body: "We just use the Linear roadmap view directly and share a read-only link with stakeholders. It's not a Gantt but PMs have accepted it after we explained the cycle-based planning model. Expectation setting was the actual fix, not a tool change.",
            isVerifiedOwner: false, upvotes: 7, upvotedBy: [], createdAt: ago(2),
          });
        }
      }

      setStatusMessage(`✅ Done! Seeded ${campaigns.length} products (with slug + communitySlug), ${reviews.length} reviews (${reviews.filter(r => r.isVerifiedPurchase).length} verified, ${reviews.filter(r => r.biasFlag).length} bias-flagged), ${sampleChannels.length} communities (${sampleChannels.filter(c => c.multiplier > 1).length} boosted), 3 ownership journeys, 4 forks (Sony, Rivian, PS5, Whoop), threaded comments, discussion posts, and Q&A answers. All product links now route via /c/[community]/[slug].`);
    } catch (error) {
      console.error(error);
      setStatusMessage("❌ Error seeding data. Check console.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeedWidgetDemo = async () => {
    const confirmed = window.confirm(
      "This will add a demo campaign + 6 rich reviews for sumit.pandey75@gmail.com WITHOUT deleting any existing data. Continue?"
    );
    if (!confirmed) return;
    setIsProcessing(true);
    setStatusMessage("Creating widget demo campaign…");

    try {
      const now = new Date();
      const day = 24 * 60 * 60 * 1000;
      const ago = (days: number) => new Date(now.getTime() - days * day).toISOString();

      // ── Create product ────────────────────────────────────────────────────
      const productRef = await addDoc(collection(db, "products"), {
        name: "SonicPulse X1 Wireless Earbuds",
        brandName: "SonicPulse",
        brandEmail: "sumit.pandey75@gmail.com",
        category: "Tech",
        campaignId: "camp_sonicpulse_demo",
        description:
          "Premium true-wireless earbuds with hybrid ANC, 32hr total battery (8hr + 24hr case), IPX5, and multipoint for two devices simultaneously.",
        budget: 2500,
        endDate: new Date(now.getTime() + 10 * day).toISOString(),
        createdAt: now.toISOString(),
      });

      // ── Create variants ───────────────────────────────────────────────────
      const variantNames = ["Obsidian Black", "Arctic White", "Midnight Navy"];
      const variantMap: Record<string, string> = {};
      const vBatch = writeBatch(db);
      for (const vName of variantNames) {
        const vRef = doc(collection(db, "products", productRef.id, "productVariants"));
        vBatch.set(vRef, { name: vName, createdAt: now.toISOString() });
        variantMap[vName] = vRef.id;
      }
      await vBatch.commit();

      setStatusMessage("Creating reviews with health scores…");

      // ── Reviews — rich data with computed healthScore ─────────────────────
      const reviewSeeds = [
        {
          variantName: "Obsidian Black",
          reviewerName: "Alex Chen",
          rating: 5,
          summary: "Best ANC earbuds under $200 — by a mile",
          content:
            "I commute on the London Underground every day and these have transformed the experience. The hybrid ANC actually removes the low-frequency train rumble rather than just attenuating it. Call quality is so good my colleagues thought I was in a quiet room. The 8-hour playtime per charge is class-leading at this price.",
          pros: ["Outstanding ANC", "8hr battery", "Crystal-clear calls", "Secure fit"],
          cons: ["Slightly bulky charging case"],
          likesCount: 214,
          helpfulCount: 87,
          forkCount: 2,
          commentCount: 5,
          isCampaignReview: true,
          isVerifiedPurchase: false,
          createdAt: ago(3),
        },
        {
          variantName: "Arctic White",
          reviewerName: "Priya Singh",
          rating: 4,
          summary: "Multipoint is the killer feature nobody talks about",
          content:
            "Switching between my MacBook and iPhone happens in under two seconds. No re-pairing, no bluetooth menu diving. The ANC is excellent for open-plan offices but loses slightly to Sony at the very top. Sound signature is balanced rather than bass-heavy which I prefer for podcast listening.",
          pros: ["Multipoint pairing", "Balanced sound", "Comfortable for long sessions"],
          cons: ["App could be better", "ANC not quite Sony-level"],
          likesCount: 131,
          helpfulCount: 54,
          forkCount: 1,
          commentCount: 3,
          isCampaignReview: true,
          isVerifiedPurchase: false,
          createdAt: ago(5),
        },
        {
          variantName: "Midnight Navy",
          reviewerName: "Sam Williams",
          rating: 5,
          summary: "IPX5 means I stopped worrying about the gym",
          content:
            "Deadlifted through a full hour of heavy sweating and these did not skip a beat. The ear hooks keep them locked in during burpees and box jumps. Navy colourway looks premium without the fingerprint magnet issues of glossy black. Honestly surprised these aren't more hyped.",
          pros: ["IPX5 waterproofing", "Secure ear hook", "Premium look"],
          cons: ["No wireless charging case"],
          likesCount: 88,
          helpfulCount: 41,
          forkCount: 0,
          commentCount: 2,
          isCampaignReview: true,
          isVerifiedPurchase: false,
          createdAt: ago(7),
        },
        {
          variantName: "Obsidian Black",
          reviewerName: "Maria Lopez",
          rating: 5,
          summary: "32 hours total — I charge once a week",
          content:
            "The math: 8hr buds + 24hr case means a full week of one-hour commutes on a single charge cycle. The USB-C case charges to full in under an hour. This has genuinely removed battery anxiety from my daily routine. Combined with the fast-pair on Android, setup was under 60 seconds.",
          pros: ["32hr total battery", "Fast USB-C charge", "Android fast-pair"],
          cons: ["iOS app is basic"],
          likesCount: 176,
          helpfulCount: 69,
          forkCount: 1,
          commentCount: 4,
          isCampaignReview: false,
          isVerifiedPurchase: true,
          createdAt: ago(10),
        },
        {
          variantName: "Arctic White",
          reviewerName: "Dan Torres",
          rating: 4,
          summary: "Transparency mode is underrated for city walking",
          content:
            "The transparency mode is tuned well enough that I can hear traffic and conversations without removing the earbuds. Most competitors make transparency sound digital and tinny — this actually sounds natural. Would like a bit more customisation in the EQ app.",
          pros: ["Natural transparency mode", "Good default EQ", "Comfortable"],
          cons: ["EQ app limited", "Touch controls take getting used to"],
          likesCount: 97,
          helpfulCount: 38,
          forkCount: 0,
          commentCount: 1,
          isCampaignReview: false,
          isVerifiedPurchase: true,
          createdAt: ago(14),
        },
        {
          variantName: "Midnight Navy",
          reviewerName: "Jessica Park",
          rating: 5,
          summary: "Converted a confirmed Bose loyalist",
          content:
            "I have owned every generation of QuietComfort earbuds. My partner bought these and I kept 'borrowing' them until I finally ordered my own. The fit is more secure than Bose, the ANC is within touching distance at half the price, and the 32-hour case capacity is embarrassing for Bose to compare against.",
          pros: ["ANC rivals Bose at half price", "Secure fit", "Huge case battery"],
          cons: ["Call audio slightly below Bose"],
          likesCount: 243,
          helpfulCount: 102,
          forkCount: 3,
          commentCount: 6,
          isCampaignReview: false,
          isVerifiedPurchase: true,
          createdAt: ago(2),
        },
      ];

      for (const r of reviewSeeds) {
        const { score, breakdown } = computeHealthScore(
          {
            content: r.content,
            summary: r.summary,
            pros: r.pros,
            cons: r.cons,
            likesCount: r.likesCount,
            helpfulCount: r.helpfulCount,
            forkCount: r.forkCount,
            commentCount: r.commentCount,
            productSource: r.isVerifiedPurchase ? "purchased" : "campaign",
            versionCount: 1,
            createdAt: r.createdAt,
            mediaUrls: [],
            subRatings: { "Sound Quality": 5, "Comfort": 4, "Battery": 5 },
            bestFor: ["Commuters", "Gym"],
          },
          0,
          0,
        );

        await addDoc(collection(db, "reviews"), {
          productId: productRef.id,
          productName: "SonicPulse X1 Wireless Earbuds",
          category: "Tech",
          campaignId: "camp_sonicpulse_demo",
          variantId: variantMap[r.variantName] ?? null,
          variantName: r.variantName,
          reviewerName: r.reviewerName,
          reviewerId: `seed_${r.reviewerName.replace(/\s/g, "_").toLowerCase()}`,
          rating: r.rating,
          summary: r.summary,
          marketingQuote: r.summary,
          content: r.content,
          pros: r.pros,
          cons: r.cons,
          likesCount: r.likesCount,
          likedBy: [],
          helpfulCount: r.helpfulCount,
          helpfulBy: [],
          notHelpfulCount: 0,
          notHelpfulBy: [],
          commentCount: r.commentCount,
          forkCount: r.forkCount,
          versionCount: 1,
          isCampaignReview: r.isCampaignReview,
          isVerifiedPurchase: r.isVerifiedPurchase,
          eligibleForPayout: true,
          subRatings: { "Sound Quality": 5, "Comfort": 4, "Battery": 5 },
          bestFor: ["Commuters", "Gym"],
          mediaUrls: [],
          productSource: r.isVerifiedPurchase ? "purchased" : "campaign",
          healthScore: score,
          healthScoreBreakdown: breakdown,
          healthScoreUpdatedAt: now.toISOString(),
          createdAt: r.createdAt,
        });
      }

      setStatusMessage(
        `✅ Widget demo ready! Campaign "SonicPulse X1" created with ${reviewSeeds.length} reviews for sumit.pandey75@gmail.com. Go to /brands/widgets to see the widget.`
      );
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Error seeding widget demo. Check console.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Community + Slug migration ────────────────────────────────────────────
  const handleMigrateProductSlugs = async () => {
    const confirmed = window.confirm(
      "This will add 'slug' and 'communitySlug' fields to ALL products that are missing them.\n\nThis is safe to run multiple times — it skips products that already have slugs. Continue?"
    );
    if (!confirmed) return;
    setIsProcessing(true);
    setStatusMessage("Migrating product slugs…");

    function slugify(text: string): string {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    }

    try {
      const snap = await getDocs(collection(db, "products"));
      let updated = 0;
      let skipped = 0;
      const slugCounts = new Map<string, number>();

      for (const d of snap.docs) {
        const data = d.data();
        if (data.slug && data.communitySlug) { skipped++; continue; }

        const baseSlug = slugify(data.name || "product");
        const communitySlug = slugify(data.category || "general");

        // Deduplicate: if slug already used, append a counter
        const count = slugCounts.get(baseSlug) ?? 0;
        slugCounts.set(baseSlug, count + 1);
        const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;

        await updateDoc(doc(db, "products", d.id), {
          slug,
          communitySlug,
          communityTags: data.communityTags ?? [],
        });
        updated++;
      }

      setStatusMessage(`✅ Migration complete! ${updated} products updated, ${skipped} already had slugs.`);
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Migration failed. Check console.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Personal Data seeder for sumit.pandey75@gmail.com ────────────────────
  const handleSeedPersonalData = async () => {
    if (!user) { alert("Sign in first."); return; }
    const confirmed = window.confirm(
      `This will create/update profile data and reviews attributed to the currently logged-in user (${user.email}).\n\nMake sure you are signed in as sumit.pandey75@gmail.com. Continue?`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setStatusMessage("Seeding personal data…");

    try {
      const now = new Date();
      const ago = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

      // ── 1. Upsert user document ──────────────────────────────────────────
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        displayName: user.displayName || "Sumit Pandey",
        email: user.email,
        trustScore: 340,
        badges: ["first_review", "verified_owner", "helpful_reviewer", "early_adopter"],
        interests: ["Tech", "SaaS", "Automotive", "Fitness"],
        walletBalance: 47.50,
        totalEarned: 127.80,
        reviewCount: 3,
        updatedAt: now.toISOString(),
      }).catch(async () => {
        // Doc may not exist yet — create it
        await addDoc(collection(db, "users"), {
          uid: user.uid,
          displayName: user.displayName || "Sumit Pandey",
          email: user.email,
          trustScore: 340,
          badges: ["first_review", "verified_owner", "helpful_reviewer", "early_adopter"],
          interests: ["Tech", "SaaS", "Automotive", "Fitness"],
          walletBalance: 47.50,
          totalEarned: 127.80,
          reviewCount: 3,
          createdAt: now.toISOString(),
        });
      });

      // ── 2. Look up product IDs ────────────────────────────────────────────
      const [sonySnap, linearSnap, whoop5Snap] = await Promise.all([
        getDocs(query(collection(db, "products"), where("name", "==", "Sony WH-1000XM6"))),
        getDocs(query(collection(db, "products"), where("name", "==", "Linear"))),
        getDocs(query(collection(db, "products"), where("name", "==", "Whoop 5.0"))),
      ]);

      const sonyId   = sonySnap.docs[0]?.id   ?? null;
      const linearId = linearSnap.docs[0]?.id ?? null;
      const whoopId  = whoop5Snap.docs[0]?.id ?? null;

      // ── 3. Sony WH-1000XM6 review — with Ownership Journey entries ───────
      const sonyReview = {
        productId: sonyId,
        productName: "Sony WH-1000XM6",
        category: "Tech",
        campaignId: "organic",
        rating: 5,
        subRatings: { "Sound Quality": 5, "ANC": 5, "Comfort": 4, "Battery": 5 },
        content:
          "Coming from Bose QC45, the XM6 is a generational leap. The ANC is genuinely eerie — I tested it on a packed train and the carriage vanished. Multipoint pairing between MacBook and iPhone is seamless; no disconnect dance. Build quality feels intentional — the matte finish resists fingerprints and the hinge clicks with satisfying precision. Wear detection pauses audio the instant you lift an ear cup.",
        summary: "The ANC benchmark just moved again — and Sony owns it",
        marketingQuote: "The ANC benchmark just moved again — and Sony owns it",
        pros: ["Class-leading ANC", "Seamless multipoint pairing", "Wear detection", "Premium matte build"],
        cons: ["No analog input", "App feels dated"],
        bestFor: ["Frequent flyers", "Open-plan offices"],
        mediaUrls: [],
        reviewerId: user.uid,
        reviewerName: user.displayName || "Sumit Pandey",
        likesCount: 47,
        likedBy: [],
        helpfulCount: 29,
        helpfulBy: [],
        notHelpfulCount: 0,
        notHelpfulBy: [],
        commentCount: 3,
        forkCount: 0,
        versionCount: 3,
        latestVersionLabel: "6-Month Update",
        campaignId2: "organic",
        isCampaignReview: false,
        isVerifiedPurchase: true,
        reviewType: "verified",
        productSource: "purchased",
        usageDuration: "6 months",
        eligibleForPayout: true,
        biasFlag: false,
        healthScore: 88,
        healthScoreBreakdown: {
          contentLength: 20, hasMedia: 0, hasProsAndCons: 15, hasSummary: 10,
          engagement: 15, recency: 10, verifiedPurchase: 15, versionUpdates: 3,
        },
        createdAt: ago(180),
      };

      const sonyRef = await addDoc(collection(db, "reviews"), sonyReview);

      // Version 1 — initial purchase (already reflected in the review)
      // Version 2 — 3-Month Update
      await addDoc(collection(db, "reviewVersions"), {
        reviewId: sonyRef.id,
        productId: sonyId,
        productName: "Sony WH-1000XM6",
        reviewerId: user.uid,
        reviewerName: user.displayName || "Sumit Pandey",
        versionLabel: "3-Month Update",
        versionNumber: 2,
        rating: 5,
        content:
          "Three months in: the ear-pad cushions have softened noticeably and long sessions (3+ hours) are genuinely comfortable now. Battery still hits 29–30 hours in real use. ANC firmware update last month improved wind-noise rejection on my commute.",
        pros: ["Ear pads soften with use", "Great ANC firmware updates"],
        cons: ["Still no analog input"],
        createdAt: ago(90),
      });

      // Version 3 — 6-Month Update
      await addDoc(collection(db, "reviewVersions"), {
        reviewId: sonyRef.id,
        productId: sonyId,
        productName: "Sony WH-1000XM6",
        reviewerId: user.uid,
        reviewerName: user.displayName || "Sumit Pandey",
        versionLabel: "6-Month Update",
        versionNumber: 3,
        rating: 5,
        content:
          "Half a year of daily use. The only thing that's changed is my appreciation for multipoint — I now pair to iPad as well. Build is holding up immaculately, no creak or hinge wear. Still the best all-round headphone you can buy at this price. Would purchase again without hesitation.",
        pros: ["Zero build degradation at 6 months", "Multipoint still works flawlessly"],
        cons: ["App still hasn't improved"],
        createdAt: ago(1),
      });

      // ── 4. Linear review ─────────────────────────────────────────────────
      const linearReview = {
        productId: linearId,
        productName: "Linear",
        category: "SaaS",
        campaignId: "organic",
        rating: 5,
        subRatings: { "Speed": 5, "UX": 5, "Integrations": 4, "Value": 5 },
        content:
          "Linear replaced Jira for our 12-person team eight months ago and the productivity delta is measurable. Issue creation is keyboard-first and takes under 3 seconds. Cycle planning is visual and drag-and-drop without the lag. The GitHub integration means PRs close issues automatically — no manual bookkeeping. The API is clean enough that our eng lead built a custom Slack-to-Linear bridge in an afternoon.",
        summary: "Jira is a legacy tax. Linear is what project management should feel like.",
        marketingQuote: "Jira is a legacy tax. Linear is what project management should feel like.",
        pros: ["Sub-second response times", "Keyboard-first", "Clean API", "GitHub sync"],
        cons: ["Reporting dashboard is basic", "Guest seats are limited on lower plans"],
        bestFor: ["Engineering teams", "Startups", "Remote teams"],
        mediaUrls: [],
        reviewerId: user.uid,
        reviewerName: user.displayName || "Sumit Pandey",
        likesCount: 112,
        likedBy: [],
        helpfulCount: 67,
        helpfulBy: [],
        notHelpfulCount: 1,
        notHelpfulBy: [],
        commentCount: 8,
        forkCount: 0,
        versionCount: 1,
        isCampaignReview: false,
        isVerifiedPurchase: true,
        reviewType: "verified",
        productSource: "purchased",
        usageDuration: "8 months",
        eligibleForPayout: true,
        biasFlag: false,
        healthScore: 91,
        healthScoreBreakdown: {
          contentLength: 20, hasMedia: 0, hasProsAndCons: 15, hasSummary: 10,
          engagement: 18, recency: 10, verifiedPurchase: 15, versionUpdates: 3,
        },
        createdAt: ago(60),
      };

      await addDoc(collection(db, "reviews"), linearReview);

      // ── 5. Whoop 5.0 review ──────────────────────────────────────────────
      const whoopReview = {
        productId: whoopId,
        productName: "Whoop 5.0",
        category: "Fitness",
        campaignId: "organic",
        rating: 4,
        subRatings: { "Accuracy": 4, "Battery": 5, "App": 4, "Comfort": 5 },
        content:
          "I was sceptical of the subscription model but seven months in, Whoop has genuinely changed my training. Recovery scores kept me honest during a heavy block — I ignored the red day once and tweaked my shoulder. The strain coach is surprisingly accurate; my HRV trend over 6 months shows clear adaptation. The band is comfortable enough to forget entirely, which is the highest praise for a wearable. Battery life has been closer to 5 days for me, not the claimed 7, but I charge during morning calls so it's a non-issue.",
        summary: "The subscription is worth it if you actually act on the data",
        marketingQuote: "The subscription is worth it if you actually act on the data",
        pros: ["HRV tracking is accurate", "Comfortable 24/7 wear", "Strain coach is honest"],
        cons: ["Subscription on top of hardware cost", "Battery life < claimed"],
        bestFor: ["Endurance athletes", "Data-driven trainers", "Sleep optimisers"],
        mediaUrls: [],
        reviewerId: user.uid,
        reviewerName: user.displayName || "Sumit Pandey",
        likesCount: 83,
        likedBy: [],
        helpfulCount: 51,
        helpfulBy: [],
        notHelpfulCount: 2,
        notHelpfulBy: [],
        commentCount: 5,
        forkCount: 0,
        versionCount: 1,
        isCampaignReview: false,
        isVerifiedPurchase: true,
        reviewType: "verified",
        productSource: "purchased",
        usageDuration: "7 months",
        eligibleForPayout: true,
        biasFlag: false,
        healthScore: 85,
        healthScoreBreakdown: {
          contentLength: 20, hasMedia: 0, hasProsAndCons: 15, hasSummary: 10,
          engagement: 15, recency: 10, verifiedPurchase: 15, versionUpdates: 0,
        },
        createdAt: ago(30),
      };

      await addDoc(collection(db, "reviews"), whoopReview);

      // ── 6. Verified Q&A answer on Sony hearing-aid question ──────────────
      if (sonyId) {
        // Find the Sony hearing-aid discussion question
        const discussionSnap = await getDocs(
          query(collection(db, "productDiscussions"), where("productId", "==", sonyId))
        ).catch(() => null);

        const hearingQ = discussionSnap?.docs.find((d) =>
          (d.data().body as string || "").toLowerCase().includes("hearing")
        );

        if (hearingQ) {
          await addDoc(collection(db, "productDiscussionAnswers"), {
            questionId: hearingQ.id,
            productId: sonyId,
            authorId: user.uid,
            authorName: user.displayName || "Sumit Pandey",
            body: "Confirmed owner here — the XM6 is NOT a hearing aid and Sony explicitly states it doesn't amplify ambient sound for hearing-impaired users. That said, the Ambient Sound mode (max setting) does boost environmental audio noticeably, which I use at low volume when I need situational awareness. It helped a friend with mild hearing loss follow conversations in quiet rooms, but please consult an audiologist for anything clinical.",
            isVerifiedOwner: true,
            upvotes: 18,
            upvotedBy: [],
            createdAt: ago(5),
          });
        }
      }

      setStatusMessage(
        `✅ Personal data seeded for ${user.email}! Profile updated (trust 340, 4 badges), 3 reviews added (Sony with 2 version updates, Linear, Whoop), and a verified Q&A answer posted.`
      );
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Error seeding personal data. Check console.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Expert Seeding handlers ───────────────────────────────────────────────
  async function handleAddInventory(e: React.FormEvent) {
    e.preventDefault();
    setSeedingMessage("");
    try {
      const ref = await addDoc(collection(db, "inventory"), {
        productName: invProduct.trim(),
        brandName: invBrand.trim(),
        category: invCategory,
        quantity: Number(invQty),
        notes: invNotes.trim(),
        status: "available",
        createdAt: new Date().toISOString(),
      });
      setSeedInventory((prev) => [
        ...prev,
        { id: ref.id, productName: invProduct.trim(), brandName: invBrand.trim(), category: invCategory, quantity: Number(invQty), status: "available" },
      ]);
      setSeedingMessage(`✅ "${invProduct.trim()}" added to seeding inventory.`);
      setInvProduct(""); setInvBrand(""); setInvQty("1"); setInvNotes("");
    } catch {
      setSeedingMessage("❌ Failed to add inventory item.");
    }
  }

  async function loadTrustedReviewers() {
    setIsLoadingReviewers(true);
    setSeedingMessage("");
    try {
      const q = query(
        collection(db, "users"),
        where("trustScore", ">", 250),
        orderBy("trustScore", "desc"),
        limit(50),
      );
      const snap = await getDocs(q);
      setTrustedReviewers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any)));
    } catch {
      setSeedingMessage("❌ Could not load reviewers — ensure a Firestore index exists on trustScore.");
    } finally {
      setIsLoadingReviewers(false);
    }
  }

  async function handleInviteReviewer(reviewer: { id: string; displayName?: string }) {
    setInvitingUserId(reviewer.id);
    setSeedingMessage("");
    try {
      await addDoc(collection(db, "seedingInvites"), {
        userId: reviewer.id,
        userName: reviewer.displayName || "Unknown",
        inventoryId: selectedInvId || null,
        status: "invited",
        invitedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, "notifications"), {
        userId: reviewer.id,
        type: "seeding_invite",
        title: "You've been invited to review a product!",
        body: "Review Jam has selected you as a trusted reviewer for a seeding opportunity. Check your email for details.",
        read: false,
        createdAt: new Date().toISOString(),
      });
      setSeedingMessage(`✅ Invite sent to ${reviewer.displayName || reviewer.id}.`);
    } catch {
      setSeedingMessage("❌ Failed to send invite.");
    } finally {
      setInvitingUserId(null);
    }
  }

  async function handleDistributeDividend() {
    const pool = Number(globalPool);
    if (!pool || pool <= 0) return alert("Enter a positive Global Pool amount.");
    const confirmed = window.confirm(
      `Distribute $${pool.toFixed(2)} as a platform-wide monthly dividend?\n\nOnly reviews with a verified purchase receipt qualify. This cannot be undone.`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setDividendStats(null);
    setStatusMessage("Scanning verified reviews and computing weighted scores…");

    try {
      const response = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalPool: pool }),
      });
      const data = await response.json();
      if (data.success) {
        setStatusMessage(`✅ ${data.message}`);
        setDividendStats(data.stats ?? null);
        setGlobalPool("");
      } else {
        setStatusMessage(`❌ ${data.error}`);
      }
    } catch {
      setStatusMessage("❌ Critical Error: Could not reach the payout service.");
    } finally {
      setIsProcessing(false);
    }
  }

  const nowMs = Date.now();
  const rangeToMs: Record<DateRangeFilter, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    all: Number.POSITIVE_INFINITY,
  };

  const filteredEvents = moderationEvents.filter((event) => {
    const createdAtMs = Date.parse(event.createdAt || "");
    const isWithinRange =
      dateRangeFilter === "all" || (Number.isFinite(createdAtMs) && nowMs - createdAtMs <= rangeToMs[dateRangeFilter]);
    const matchesSource = sourceFilter === "all" || event.source === sourceFilter;
    return isWithinRange && matchesSource;
  });

  const blockedEvents = filteredEvents.filter((event) => event.isGenuine === false);
  const reasonCounts = blockedEvents.reduce<Record<string, number>>((acc, event) => {
    const key = event.reason?.trim() || "Unknown rejection reason";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const approvalRate = filteredEvents.length
    ? Math.round(((filteredEvents.length - blockedEvents.length) / filteredEvents.length) * 100)
    : 0;

  const handleExportModerationCsv = () => {
    if (filteredEvents.length === 0) {
      alert("No moderation rows available for the selected filters.");
      return;
    }

    const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = [
      "createdAt",
      "reviewerName",
      "source",
      "isGenuine",
      "reason",
      "reviewPreview",
      "marketingQuote",
    ];
    const rows = filteredEvents.map((event) =>
      [
        event.createdAt || "",
        event.reviewerName || "Anonymous",
        event.source || "",
        String(event.isGenuine),
        event.reason || "",
        event.reviewPreview || "",
        event.marketingQuote || "",
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `moderation-events-${dateRangeFilter}-${sourceFilter}-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-900 p-10 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-2">
          <h1 className="text-4xl font-black text-indigo-400">Command Center</h1>
          <Link href="/" className="text-slate-400 hover:text-white font-bold transition">← Back to Site</Link>
        </div>
        <p className="text-slate-400 mb-10 border-b border-slate-700 pb-4">Logged in as Admin: {user?.email}</p>

        {/* --- NEW: ONE-CLICK SEED BUTTON --- */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 p-6 rounded-3xl border border-indigo-500/30 mb-8 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">🧪 Test Environment Seeder</h2>
            <p className="text-indigo-200 text-sm">Populate your UI with highly realistic dummy campaigns and reviews instantly.</p>
          </div>
          <button 
            onClick={handleSeedDatabase} 
            disabled={isProcessing}
            className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-8 rounded-xl transition disabled:opacity-50 whitespace-nowrap"
          >
            {isProcessing ? "Injecting Data..." : "Generate Dummy Data"}
          </button>
        </div>

        {/* --- WIDGET DEMO SEEDER --- */}
        <div className="bg-gradient-to-r from-amber-950/60 to-orange-950/40 p-6 rounded-3xl border border-amber-700/40 mb-8 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">🧩 Seed Widget Demo</h2>
            <p className="text-amber-200/70 text-sm">
              Adds a &quot;SonicPulse X1&quot; campaign with 6 rich reviews under{" "}
              <span className="text-amber-300 font-mono">sumit.pandey75@gmail.com</span> —
              does <strong>not</strong> delete existing data.
            </p>
          </div>
          <button
            onClick={handleSeedWidgetDemo}
            disabled={isProcessing}
            className="bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 px-8 rounded-xl transition disabled:opacity-50 whitespace-nowrap"
          >
            {isProcessing ? "Seeding…" : "Seed Widget Demo"}
          </button>
        </div>

        {/* --- COMMUNITY SLUG MIGRATION --- */}
        <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/40 p-6 rounded-3xl border border-emerald-700/40 mb-8 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">🗂️ Migrate Product Slugs</h2>
            <p className="text-emerald-200/70 text-sm">
              Adds <span className="font-mono text-emerald-300">slug</span> and{" "}
              <span className="font-mono text-emerald-300">communitySlug</span> to all products so they work on{" "}
              <span className="font-mono text-emerald-300">/c/[community]/[product]</span> URLs.
              Safe to run multiple times.
            </p>
          </div>
          <button
            onClick={handleMigrateProductSlugs}
            disabled={isProcessing}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl transition disabled:opacity-50 whitespace-nowrap"
          >
            {isProcessing ? "Migrating…" : "Run Migration"}
          </button>
        </div>

        {/* --- PERSONAL DATA SEEDER --- */}
        <div className="bg-gradient-to-r from-violet-950/60 to-purple-950/40 p-6 rounded-3xl border border-violet-700/40 mb-8 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">👤 Seed Personal Data</h2>
            <p className="text-violet-200/70 text-sm">
              Creates profile + 3 verified reviews (Sony with Ownership Journey, Linear, Whoop 5.0) attributed to{" "}
              <span className="text-violet-300 font-mono">sumit.pandey75@gmail.com</span>.
              Sign in as that account first.
            </p>
          </div>
          <button
            onClick={handleSeedPersonalData}
            disabled={isProcessing}
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-8 rounded-xl transition disabled:opacity-50 whitespace-nowrap"
          >
            {isProcessing ? "Seeding…" : "Seed My Data"}
          </button>
        </div>

        {/* --- AI MODERATION TOGGLE --- */}
        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 mb-8 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">🤖 AI Review Moderation</h2>
            <p className="text-slate-400 text-sm">
              {aiCheckEnabled
                ? "Reviews are being screened by Gemini before posting."
                : "AI check is OFF — all reviews post instantly without moderation."}
            </p>
          </div>
          <button
            onClick={handleToggleAiCheck}
            disabled={isTogglingAi}
            className={`relative inline-flex items-center gap-3 font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 ${
              aiCheckEnabled
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-slate-600 hover:bg-slate-500 text-slate-200"
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${aiCheckEnabled ? "bg-white" : "bg-slate-400"}`} />
            {isTogglingAi ? "Saving…" : aiCheckEnabled ? "AI Check: ON" : "AI Check: OFF"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT COLUMN: Launch New Campaign */}
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">🚀 Launch New Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">Product Name</label>
                <input type="text" required value={newProdName} onChange={e => setNewProdName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Brand Name</label>
                  <input type="text" required value={newBrandName} onChange={e => setNewBrandName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none">
                    <option value="Tech">Tech</option>
                    <option value="Home">Home</option>
                    <option value="SaaS">SaaS</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Automotive">Automotive</option>
                    <option value="Fitness">Fitness</option>
                    <option value="Travel">Travel</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Brand Email (for dashboard access)</label>
                  <input type="email" value={newBrandEmail} onChange={e => setNewBrandEmail(e.target.value)} placeholder="brand@company.com" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Pool Budget ($)</label>
                  <input type="number" value={newBudget} onChange={e => setNewBudget(e.target.value)} placeholder="e.g. 500" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">Campaign Description (shown to applicants)</label>
                <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="What reviewers should know about this product…" rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">Campaign ID</label>
                  <input type="text" required value={newCampaignId} onChange={e => setNewCampaignId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" placeholder="e.g. camp_123" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1">End Date & Time</label>
                  <input type="datetime-local" required value={endDateLocal} onChange={e => setEndDateLocal(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none" />
                </div>
              </div>
              {/* Variants / SKUs */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-slate-400">
                    Variants / SKUs{" "}
                    <span className="font-normal text-slate-500 text-xs">(optional — e.g. "Black 256GB", "Blue 128GB")</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setVariantRows((rows) => [...rows, ""])}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    + Add variant
                  </button>
                </div>
                <div className="space-y-2">
                  {variantRows.map((v, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={v}
                        onChange={(e) => setVariantRows((rows) => rows.map((r, i) => (i === idx ? e.target.value : r)))}
                        placeholder={`Variant ${idx + 1} — e.g. Blue · 128GB`}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm placeholder-slate-600"
                      />
                      {variantRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setVariantRows((rows) => rows.filter((_, i) => i !== idx))}
                          className="px-3 text-slate-500 hover:text-red-400 transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={isCreating} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black mt-2 hover:bg-indigo-500 transition disabled:opacity-50">
                {isCreating ? "Publishing..." : "Launch Campaign Live"}
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: Monthly Dividend */}
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-1">💰 Monthly Dividend</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Platform-wide distribution. Only reviews with a <span className="text-green-400 font-semibold">verified purchase receipt</span> qualify.
              Each reviewer's share = <code className="text-xs text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">Pool × (score × multiplier) / Σ scores</code>
            </p>

            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 mb-4 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">Global Pool Amount ($)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={globalPool}
                  onChange={(e) => setGlobalPool(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-green-500 transition"
                />
              </div>

              <button
                type="button"
                onClick={handleDistributeDividend}
                disabled={isProcessing || !globalPool}
                className={`w-full py-4 mt-2 rounded-xl font-black shadow-lg transition-all text-base ${
                  isProcessing || !globalPool
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-400 text-slate-900"
                }`}
              >
                {isProcessing ? "Calculating & distributing…" : "🏦 Distribute Monthly Dividend"}
              </button>
            </div>

            {dividendStats && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Total reviews", value: dividendStats.totalReviews },
                  { label: "Eligible (verified)", value: dividendStats.eligibleReviews },
                  { label: "Payouts made", value: dividendStats.payoutsMade },
                  { label: "Unique reviewers", value: dividendStats.uniqueReviewers },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-900 rounded-xl border border-slate-700 p-3 text-center">
                    <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {statusMessage && (
              <div className={`p-4 rounded-xl border font-mono text-sm font-bold ${statusMessage.includes("❌") ? "bg-red-900/30 border-red-500/50 text-red-400" : "bg-green-900/30 border-green-500/50 text-green-400"}`}>
                {statusMessage}
              </div>
            )}
          </div>

        </div>

        {/* ── Expert Seeding ── */}
        <div className="mt-8 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">🧪 Expert Seeding</h2>
            <span className="text-xs px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold">
              Brand inventory → trusted reviewers
            </span>
          </div>
          <p className="text-slate-400 text-sm mb-6">
            Log products sent by brands for seeding, then invite reviewers with a Trust Score &gt; 250 to write anchor reviews.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: Add inventory item */}
            <div>
              <h3 className="text-base font-bold text-slate-300 mb-4">Add inventory item</h3>
              <form onSubmit={handleAddInventory} className="space-y-3">
                <input
                  type="text" required value={invProduct} onChange={(e) => setInvProduct(e.target.value)}
                  placeholder="Product name"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-violet-500 transition text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text" required value={invBrand} onChange={(e) => setInvBrand(e.target.value)}
                    placeholder="Brand name"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm"
                  />
                  <select
                    value={invCategory} onChange={(e) => setInvCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm"
                  >
                    {["Tech","Home","SaaS","Beauty","Gaming","Automotive","Fitness","Travel","Finance"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number" min="1" value={invQty} onChange={(e) => setInvQty(e.target.value)}
                    placeholder="Quantity"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm"
                  />
                  <input
                    type="text" value={invNotes} onChange={(e) => setInvNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm"
                  />
                </div>
                <button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition text-sm">
                  + Add to Inventory
                </button>
              </form>

              {/* Inventory list */}
              {seedInventory.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">This session</p>
                  {seedInventory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedInvId(item.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition text-sm ${
                        selectedInvId === item.id
                          ? "border-violet-500 bg-violet-900/20 text-white"
                          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-[11px] text-slate-500">{item.brandName} · {item.category} · qty {item.quantity}</p>
                      </div>
                      {selectedInvId === item.id && <span className="text-violet-400 text-xs font-bold">Selected</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Trusted reviewers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-300">Trusted reviewers</h3>
                <button
                  type="button"
                  onClick={loadTrustedReviewers}
                  disabled={isLoadingReviewers}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {isLoadingReviewers ? "Loading…" : "Load (trust > 250)"}
                </button>
              </div>

              {trustedReviewers.length === 0 && !isLoadingReviewers && (
                <p className="text-sm text-slate-500 text-center py-8">
                  Click "Load" to fetch reviewers with trust score &gt; 250.
                </p>
              )}

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {trustedReviewers.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl p-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{r.displayName || r.id}</p>
                      <p className="text-[11px] text-slate-500">{r.email} · ⭐ {r.trustScore} trust</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInviteReviewer(r)}
                      disabled={invitingUserId === r.id}
                      className="text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0 ml-3"
                    >
                      {invitingUserId === r.id ? "Sending…" : "Invite"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {seedingMessage && (
            <div className={`mt-5 p-3 rounded-xl border text-sm font-bold font-mono ${seedingMessage.includes("❌") ? "bg-red-900/30 border-red-500/50 text-red-400" : "bg-green-900/30 border-green-500/50 text-green-400"}`}>
              {seedingMessage}
            </div>
          )}
        </div>

        {/* ── Campaign Applications ── */}
        <div className="mt-8 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">📋 Campaign Applications</h2>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {applications.length} total
            </span>
          </div>

          {/* Status filter */}
          <div className="flex gap-2 flex-wrap mb-5">
            {(["applied", "approved", "rejected", "product_sent", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAppStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  appStatusFilter === s
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {s === "product_sent" ? "Product sent" : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== "all" && (
                  <span className="ml-1 opacity-70">
                    ({applications.filter(a => a.status === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoadingApplications ? (
            <div className="text-slate-400 animate-pulse text-sm">Loading applications…</div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {applications
                .filter(a => appStatusFilter === "all" || a.status === appStatusFilter)
                .map((app) => (
                  <div key={app.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-semibold text-white">{app.userName}</p>
                        <p className="text-xs text-slate-400">{app.userEmail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-indigo-300">{app.productName}</p>
                        <p className="text-xs text-slate-500">{app.brandName}</p>
                      </div>
                    </div>

                    {app.notes && (
                      <p className="text-sm text-slate-300 italic mb-2 border-l-2 border-slate-600 pl-2">
                        "{app.notes}"
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                        app.status === "approved"     ? "bg-emerald-900/40 text-emerald-400" :
                        app.status === "rejected"     ? "bg-red-900/40 text-red-400" :
                        app.status === "product_sent" ? "bg-amber-900/40 text-amber-400" :
                        app.status === "reviewed"     ? "bg-slate-700 text-slate-300" :
                        "bg-blue-900/40 text-blue-400"
                      }`}>
                        {app.status}
                      </span>

                      {app.status === "applied" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={updatingAppId === app.id}
                            onClick={async () => {
                              setUpdatingAppId(app.id);
                              await updateDoc(doc(db, "campaignApplications", app.id), { status: "approved", updatedAt: new Date().toISOString() });
                              setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "approved" } : a));
                              setUpdatingAppId(null);
                            }}
                            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={updatingAppId === app.id}
                            onClick={async () => {
                              setUpdatingAppId(app.id);
                              await updateDoc(doc(db, "campaignApplications", app.id), { status: "rejected", updatedAt: new Date().toISOString() });
                              setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "rejected" } : a));
                              setUpdatingAppId(null);
                            }}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {app.status === "approved" && (
                        <button
                          type="button"
                          disabled={updatingAppId === app.id}
                          onClick={async () => {
                            setUpdatingAppId(app.id);
                            await updateDoc(doc(db, "campaignApplications", app.id), { status: "product_sent", updatedAt: new Date().toISOString() });
                            setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "product_sent" } : a));
                            setUpdatingAppId(null);
                          }}
                          className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg font-medium transition disabled:opacity-50"
                        >
                          Mark product sent
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              {applications.filter(a => appStatusFilter === "all" || a.status === appStatusFilter).length === 0 && (
                <p className="text-slate-400 text-sm">No applications with status "{appStatusFilter}".</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">🛡️ Moderation Reason Dashboard</h2>
              <p className="text-slate-400 text-sm">
                Recent moderation outcomes from the `moderationEvents` stream.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Loaded {moderationEvents.length}
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date Range</label>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
                className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white outline-none"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Source</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white outline-none"
              >
                <option value="all">All sources</option>
                <option value="deterministic">Deterministic checks</option>
                <option value="ai">AI moderation</option>
              </select>
            </div>
            <button
              onClick={handleExportModerationCsv}
              className="md:ml-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl transition"
            >
              Export CSV
            </button>
          </div>

          {isLoadingModeration ? (
            <div className="text-slate-400 font-semibold animate-pulse">Loading moderation analytics...</div>
          ) : moderationEvents.length === 0 ? (
            <div className="text-slate-400">No moderation events yet. Submit some reviews to populate this dashboard.</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-slate-400">No events match the current date/source filters.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                  <p className="text-slate-400 text-xs font-bold uppercase">Total Checked</p>
                  <p className="text-2xl font-black text-white mt-1">{filteredEvents.length}</p>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                  <p className="text-slate-400 text-xs font-bold uppercase">Blocked</p>
                  <p className="text-2xl font-black text-red-400 mt-1">{blockedEvents.length}</p>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                  <p className="text-slate-400 text-xs font-bold uppercase">Approved</p>
                  <p className="text-2xl font-black text-green-400 mt-1">{filteredEvents.length - blockedEvents.length}</p>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                  <p className="text-slate-400 text-xs font-bold uppercase">Approval Rate</p>
                  <p className="text-2xl font-black text-indigo-300 mt-1">{approvalRate}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                  <h3 className="font-bold text-lg mb-4">Top Rejection Reasons</h3>
                  {topReasons.length === 0 ? (
                    <p className="text-slate-400 text-sm">No blocked reviews in this sample window.</p>
                  ) : (
                    <div className="space-y-3">
                      {topReasons.map(([reason, count]) => (
                        <div key={reason}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <p className="text-slate-300 font-medium truncate pr-3">{reason}</p>
                            <p className="text-indigo-300 font-bold">{count}</p>
                          </div>
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.max(8, (count / blockedEvents.length) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                  <h3 className="font-bold text-lg mb-4">Recent Blocked Reviews</h3>
                  {blockedEvents.length === 0 ? (
                    <p className="text-slate-400 text-sm">No blocked reviews yet.</p>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {blockedEvents.slice(0, 12).map((event) => (
                        <div key={event.id} className="border border-red-500/20 bg-red-900/10 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-bold text-red-300">{event.reviewerName || "Anonymous"}</p>
                            <p className="text-[11px] text-slate-500">{event.source}</p>
                          </div>
                          <p className="text-[13px] text-slate-300 mb-2 line-clamp-2">{event.reviewPreview}</p>
                          <p className="text-[12px] font-semibold text-red-400">Reason: {event.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
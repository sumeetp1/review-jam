"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, getDocs, limit, orderBy, query, doc, updateDoc, setDoc, getDoc, deleteDoc, writeBatch } from "firebase/firestore";
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
  const [payoutCampId, setPayoutCampId] = useState("");
  const [payoutBudget, setPayoutBudget] = useState("");
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
    const confirmed = window.confirm("This will DELETE all existing products and reviews, then insert fresh dummy data across all categories. Continue?");
    if (!confirmed) return;
    setIsProcessing(true);
    setStatusMessage("Clearing existing data…");

    try {
      const now = new Date();
      const day = 24 * 60 * 60 * 1000;

      // ── Clear existing data ──────────────────────────────────────────────
      const [prodSnap, revSnap, chSnap, cmSnap, rcSnap, rfSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "reviews")),
        getDocs(collection(db, "channels")),
        getDocs(collection(db, "channelMembers")),
        getDocs(collection(db, "reviewComments")),
        getDocs(collection(db, "reviewForks")),
      ]);
      await Promise.all([
        ...prodSnap.docs.map((d) => deleteDoc(d.ref)),
        ...revSnap.docs.map((d) => deleteDoc(d.ref)),
        ...chSnap.docs.map((d) => deleteDoc(d.ref)),
        ...cmSnap.docs.map((d) => deleteDoc(d.ref)),
        ...rcSnap.docs.map((d) => deleteDoc(d.ref)),
        ...rfSnap.docs.map((d) => deleteDoc(d.ref)),
      ]);

      setStatusMessage("Inserting campaigns…");

      // ── 9 Active campaigns — one per category, with variants ──────────────
      const campaigns = [
        {
          name: "Sony WH-1000XM6", brandName: "Sony", brandEmail: "sony@brands.com", category: "Tech",
          campaignId: "camp_sony", description: "Next-gen noise-cancelling headphones. 40hr battery, multipoint, LDAC.",
          budget: 5000, endDate: new Date(now.getTime() + 6 * day).toISOString(),
          variants: ["Midnight Black", "Platinum Silver", "Indigo Blue"],
        },
        {
          name: "Lumina Smart Standing Desk", brandName: "Lumina", brandEmail: "lumina@brands.com", category: "Home",
          campaignId: "camp_lumina", description: "OLED control panel, memory presets, cable management tray included.",
          budget: 3000, endDate: new Date(now.getTime() + 4 * day).toISOString(),
          variants: ["48\" Walnut Top", "60\" White Top", "72\" Black Top"],
        },
        {
          name: "Linear — Project Management", brandName: "Linear", brandEmail: "linear@brands.com", category: "SaaS",
          campaignId: "camp_linear", description: "The issue tracker built for high-performance teams. Free trial for reviewers.",
          budget: 2000, endDate: new Date(now.getTime() + 14 * day).toISOString(),
          variants: ["Free Tier", "Plus Plan", "Enterprise Plan"],
        },
        {
          name: "Rivian R2 SUV", brandName: "Rivian", brandEmail: "rivian@brands.com", category: "Automotive",
          campaignId: "camp_rivian", description: "All-electric adventure SUV. 300mi range, quad-motor, hands-free highway.",
          budget: 8000, endDate: new Date(now.getTime() + 10 * day).toISOString(),
          variants: ["Standard Range · RWD", "Long Range · AWD", "Max Pack · Quad-Motor"],
        },
        {
          name: "Rhode Peptide Lip Treatment", brandName: "Rhode", brandEmail: "rhode@brands.com", category: "Beauty",
          campaignId: "camp_rhode", description: "Peptide-rich gloss that plumps and hydrates in 30 seconds.",
          budget: 1500, endDate: new Date(now.getTime() + 7 * day).toISOString(),
          variants: ["Salted Caramel", "Glazed Donut", "Watermelon Slice", "Unscented"],
        },
        {
          name: "PlayStation 5 Pro", brandName: "Sony", brandEmail: "sony@brands.com", category: "Gaming",
          campaignId: "camp_ps5pro", description: "8K-ready, 45% faster GPU, PSSR upscaling. Free 3-month PS Plus included.",
          budget: 6000, endDate: new Date(now.getTime() + 5 * day).toISOString(),
          variants: ["Disc Edition", "Digital Edition"],
        },
        {
          name: "Whoop 5.0 Band", brandName: "Whoop", brandEmail: "whoop@brands.com", category: "Fitness",
          campaignId: "camp_whoop", description: "Continuous health monitoring — HRV, skin temp, sleep stages. No screen.",
          budget: 2500, endDate: new Date(now.getTime() + 9 * day).toISOString(),
          variants: ["Onyx Black", "Stone Grey", "Desert Tan"],
        },
        {
          name: "IHG One Rewards — Indigo Hotels", brandName: "IHG", brandEmail: "ihg@brands.com", category: "Travel",
          campaignId: "camp_ihg", description: "Experience Hotel Indigo stays worldwide. Reviewers get 2-night comp stay.",
          budget: 10000, endDate: new Date(now.getTime() + 21 * day).toISOString(),
          variants: ["Hotel Indigo Edinburgh", "Hotel Indigo Dubai", "Hotel Indigo NYC"],
        },
        {
          name: "Robinhood Gold", brandName: "Robinhood", brandEmail: "robinhood@brands.com", category: "Finance",
          campaignId: "camp_robinhood", description: "5% APY on uninvested cash, 3% IRA match, instant deposits up to $50K.",
          budget: 4000, endDate: new Date(now.getTime() + 12 * day).toISOString(),
          variants: ["Monthly Plan · $5/mo", "Annual Plan · $50/yr"],
        },
      ];

      const campDocs: Record<string, string> = {};
      // maps campaignId → { variantName → variantId }
      const campVariantIds: Record<string, Record<string, string>> = {};

      setStatusMessage("Inserting campaigns & variants…");
      for (const c of campaigns) {
        const { variants, ...productData } = c;
        const ref = await addDoc(collection(db, "products"), { ...productData, createdAt: now.toISOString() });
        campDocs[c.campaignId] = ref.id;

        // Write variants to subcollection
        const varMap: Record<string, string> = {};
        if (variants && variants.length > 0) {
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

      // ── 45 reviews across all categories ─────────────────────────────────
      const ago = (days: number) => new Date(now.getTime() - days * day).toISOString();

      // Helper to look up a seeded variant ID by campaign + variant name
      const vid = (campId: string, vName: string) => campVariantIds[campId]?.[vName] ?? null;

      const reviews = [
        // ── Tech — Sony WH-1000XM6 ──────────────────────────────────────────
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "camp_sony", productId: campDocs["camp_sony"], variantName: "Midnight Black", variantId: vid("camp_sony", "Midnight Black"), reviewerName: "Alex Chen", rating: 5, summary: "Noise cancellation is literal black magic", content: "I work in a loud open-plan office and when I put these on, the world ceases to exist. Bass is punchy but not overwhelming and the battery easily lasts three days of heavy use. Best purchase I made this year.", pros: ["Incredible ANC", "40hr battery", "Comfortable"], cons: ["Slightly pricey"], likesCount: 214, isCampaignReview: true, createdAt: ago(3) },
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "camp_sony", productId: campDocs["camp_sony"], variantName: "Platinum Silver", variantId: vid("camp_sony", "Platinum Silver"), reviewerName: "Priya S.", rating: 4, summary: "Worth it for battery life alone", content: "Great sound and the multipoint connection finally works reliably. Clamping force is a touch tight on my head versus the Bose QC45. Still the best ANC headphones you can buy right now.", pros: ["Multipoint works great", "LDAC support"], cons: ["Tight clamp"], likesCount: 87, isCampaignReview: true, createdAt: ago(5) },
        { productName: "Sony WH-1000XM6", category: "Tech", campaignId: "camp_sony", productId: campDocs["camp_sony"], variantName: "Indigo Blue", variantId: vid("camp_sony", "Indigo Blue"), reviewerName: "Sam W.", rating: 5, summary: "Indigo Blue is the best colourway Sony has ever done", content: "Sounds identical to the black version but this colourway gets compliments every single day. The matte finish resists fingerprints perfectly. If you were on the fence, get the blue.", pros: ["Stunning colourway", "Matte finish", "ANC class-leading"], cons: ["Wish it came in more colours"], likesCount: 63, isCampaignReview: true, createdAt: ago(7) },
        { productName: "MacBook Pro M4", category: "Tech", campaignId: "organic", productId: "org_1", reviewerName: "Dan T.", rating: 5, summary: "The performance jump from M2 is real", content: "Compiling my entire React monorepo went from 4 minutes to 47 seconds. The display is still the best on any laptop. Fan never turns on even during heavy builds. This is the first laptop I have owned where I genuinely cannot find a complaint.", pros: ["M4 performance", "Silent", "Battery"], cons: [], likesCount: 341, isCampaignReview: false, createdAt: ago(12) },
        { productName: "Kindle Scribe", category: "Tech", campaignId: "organic", productId: "org_2", reviewerName: "Maria L.", rating: 4, summary: "Finally a Kindle worth taking notes on", content: "The writing experience is close enough to paper that I have stopped keeping a physical notebook. Syncing handwritten notes to Notion still has some rough edges but Amazon is improving it monthly.", pros: ["Paper-like screen", "Massive battery"], cons: ["Note sync needs work"], likesCount: 56, isCampaignReview: false, createdAt: ago(8) },
        { productName: "Anker MagGo 3-in-1", category: "Tech", campaignId: "organic", productId: "org_3", reviewerName: "Jake M.", rating: 5, summary: "One cable to rule my entire desk", content: "Phone, watch, and AirPods all charging simultaneously from one cable. The MagSafe click is satisfying and it holds the phone at a perfect angle for Standby mode. Bedside essential.", pros: ["Clean desk", "Fast charge"], cons: ["A bit expensive"], likesCount: 128, isCampaignReview: false, createdAt: ago(2) },

        // ── Home — Lumina Standing Desk ─────────────────────────────────────
        { productName: "Lumina Smart Standing Desk", category: "Home", campaignId: "camp_lumina", productId: campDocs["camp_lumina"], variantName: "60\" White Top", variantId: vid("camp_lumina", "60\" White Top"), reviewerName: "Marcus T.", rating: 5, summary: "Game changer for my ADHD", content: "The built-in OLED display for Pomodoro timers has genuinely transformed my workday. Assembly took 45 minutes solo and every cable routes cleanly through the built-in tray. Wobble at standing height is minimal.", pros: ["OLED timer", "Cable management", "Solid at height"], cons: ["Assembly instructions unclear"], likesCount: 143, isCampaignReview: true, createdAt: ago(4) },
        { productName: "Lumina Smart Standing Desk", category: "Home", campaignId: "camp_lumina", productId: campDocs["camp_lumina"], variantName: "48\" Walnut Top", variantId: vid("camp_lumina", "48\" Walnut Top"), reviewerName: "Sophie K.", rating: 4, summary: "Best standing desk under $800", content: "I compared seven desks before choosing this one. The app integration is genuinely useful for reminding you to stand. Wish the desktop surface was a bit deeper front-to-back for dual monitors.", pros: ["App reminders", "Great price"], cons: ["Shallow desktop"], likesCount: 61, isCampaignReview: true, createdAt: ago(6) },
        { productName: "Lumina Smart Standing Desk", category: "Home", campaignId: "camp_lumina", productId: campDocs["camp_lumina"], variantName: "72\" Black Top", variantId: vid("camp_lumina", "72\" Black Top"), reviewerName: "Derek L.", rating: 5, summary: "The 72-inch is worth every penny for dual monitors", content: "Three monitors, a laptop stand, and an ultra-wide all fit with space to spare. The black top hides cable ties perfectly. The motor is whisper-quiet — nobody in my open office can hear it moving.", pros: ["Enormous surface", "Quiet motor", "Hides cables"], cons: ["Heavy — need two people to assemble"], likesCount: 98, isCampaignReview: true, createdAt: ago(3) },
        { productName: "Dyson V15 Detect", category: "Home", campaignId: "organic", productId: "org_4", reviewerName: "Jessica W.", rating: 5, summary: "The coolest and most disgusting feature ever", content: "The laser that reveals dust on hard floors is simultaneously amazing and deeply horrifying. I had no idea how dirty my floors actually were. Suction is unmatched and the HEPA filtration means no dust back in the air.", pros: ["Laser detect", "HEPA", "Powerful"], cons: ["Short battery on max"], likesCount: 397, isCampaignReview: false, createdAt: ago(15) },
        { productName: "Instant Pot Duo 7-in-1", category: "Home", campaignId: "organic", productId: "org_5", reviewerName: "Rachel C.", rating: 5, summary: "Replaced five appliances with one", content: "Pressure cooker, slow cooker, rice cooker, steamer, sauté pan, yogurt maker, and warmer. My kitchen counter is finally clear. Pulled pork in 90 minutes from frozen is genuinely magic.", pros: ["7 functions", "Easy clean", "Compact"], cons: ["Learning curve for pressure"], likesCount: 213, isCampaignReview: false, createdAt: ago(20) },

        // ── SaaS — Linear ───────────────────────────────────────────────────
        { productName: "Linear — Project Management", category: "SaaS", campaignId: "camp_linear", productId: campDocs["camp_linear"], variantName: "Plus Plan", variantId: vid("camp_linear", "Plus Plan"), reviewerName: "David K.", rating: 5, summary: "Jira killer. And I mean that.", content: "Our 12-person engineering team switched from Jira six months ago and nobody wants to go back. Creating an issue takes 3 seconds. Cycles actually help us ship faster. The GitHub sync is flawless.", pros: ["Instant issue creation", "Cycle tracking", "GitHub sync"], cons: ["No Gantt chart"], likesCount: 276, isCampaignReview: true, createdAt: ago(7) },
        { productName: "Linear — Project Management", category: "SaaS", campaignId: "camp_linear", productId: campDocs["camp_linear"], variantName: "Free Tier", variantId: vid("camp_linear", "Free Tier"), reviewerName: "Anita R.", rating: 4, summary: "Best PM tool for small teams", content: "The keyboard shortcuts alone save me an hour a week. Views are customizable enough that both our designers and engineers are happy. Wish the free tier allowed more members.", pros: ["Keyboard-first", "Fast UI"], cons: ["Free tier limit"], likesCount: 89, isCampaignReview: true, createdAt: ago(9) },
        { productName: "Linear — Project Management", category: "SaaS", campaignId: "camp_linear", productId: campDocs["camp_linear"], variantName: "Enterprise Plan", variantId: vid("camp_linear", "Enterprise Plan"), reviewerName: "Tom R.", rating: 5, summary: "Enterprise plan is worth it for SSO alone", content: "We manage 200 engineers across 14 teams. The Enterprise audit log and SAML SSO were blockers for our security team and Linear handled both without friction. Onboarding support was outstanding.", pros: ["SAML SSO", "Audit log", "Priority support"], cons: ["Price jump from Plus is steep"], likesCount: 44, isCampaignReview: true, createdAt: ago(5) },
        { productName: "Notion", category: "SaaS", campaignId: "organic", productId: "org_6", reviewerName: "Tom B.", rating: 5, summary: "My second brain for five years running", content: "I run my entire freelance business out of Notion — CRM, project tracker, invoices, knowledge base. The AI features are now actually good. Can get overwhelming if you over-engineer your setup.", pros: ["Flexible", "AI writing", "Great templates"], cons: ["Performance on large DBs"], likesCount: 318, isCampaignReview: false, createdAt: ago(30) },
        { productName: "Figma", category: "SaaS", campaignId: "organic", productId: "org_7", reviewerName: "Lisa N.", rating: 5, summary: "Design collaboration solved", content: "The moment a client can comment directly on a design in their browser without installing anything, the whole handoff process changes. Dev mode has genuinely closed the gap between design and engineering.", pros: ["Browser-based", "Dev mode", "Components"], cons: ["Offline mode limited"], likesCount: 194, isCampaignReview: false, createdAt: ago(25) },

        // ── Automotive — Rivian R2 ──────────────────────────────────────────
        { productName: "Rivian R2 SUV", category: "Automotive", campaignId: "camp_rivian", productId: campDocs["camp_rivian"], variantName: "Max Pack · Quad-Motor", variantId: vid("camp_rivian", "Max Pack · Quad-Motor"), reviewerName: "Chris M.", rating: 5, summary: "The EV for people who actually go outside", content: "Took this through two national parks and a cross-country road trip. The gear tunnel is genius and the air suspension adjustments for off-road feel like cheating. Highway Assist is hands-free and actually trustworthy.", pros: ["Off-road capability", "Gear tunnel", "Range"], cons: ["Charging network smaller than Tesla"], likesCount: 287, isCampaignReview: true, createdAt: ago(5) },
        { productName: "Rivian R2 SUV", category: "Automotive", campaignId: "camp_rivian", productId: campDocs["camp_rivian"], variantName: "Long Range · AWD", variantId: vid("camp_rivian", "Long Range · AWD"), reviewerName: "Olivia P.", rating: 4, summary: "Family car of the future, today", content: "Three car seats fit without anyone losing a hip. The flat floor makes it feel enormous inside. Software updates have fixed most of the early launch bugs. Rivian service needs more locations.", pros: ["Interior space", "OTA updates", "Frunk"], cons: ["Service centers rare"], likesCount: 134, isCampaignReview: true, createdAt: ago(8) },
        { productName: "Rivian R2 SUV", category: "Automotive", campaignId: "camp_rivian", productId: campDocs["camp_rivian"], variantName: "Standard Range · RWD", variantId: vid("camp_rivian", "Standard Range · RWD"), reviewerName: "Lena K.", rating: 4, summary: "Best value EV if you don't need the range", content: "For city driving and weekend trips the Standard Range is plenty. 240 miles covers my week easily. You save $12k over the AWD and the daily drive is identical. Only upgrade if you go off-road regularly.", pros: ["Great value", "Smooth ride", "Software polish"], cons: ["240mi range limiting for road trips"], likesCount: 77, isCampaignReview: true, createdAt: ago(11) },
        { productName: "Tesla Model Y", category: "Automotive", campaignId: "organic", productId: "org_8", reviewerName: "Nathan F.", rating: 4, summary: "Autopilot on highway commutes changes everything", content: "After two years the initial excitement wears off but the practicality only grows. Boot space is enormous, supercharger network is unbeatable, and FSD has improved enough that I actually use it daily.", pros: ["Supercharger network", "FSD improvements", "Cargo space"], cons: ["Build quality inconsistent"], likesCount: 221, isCampaignReview: false, createdAt: ago(18) },

        // ── Beauty — Rhode Lip Treatment ────────────────────────────────────
        { productName: "Rhode Peptide Lip Treatment", category: "Beauty", campaignId: "camp_rhode", productId: campDocs["camp_rhode"], variantName: "Glazed Donut", variantId: vid("camp_rhode", "Glazed Donut"), reviewerName: "Aisha P.", rating: 5, summary: "Best lip product I have ever owned", content: "I have tried every lip mask on the market and this is the one I keep reaching for. The peptides actually do something — my lips are noticeably plumper after two weeks of daily use. The glaze finish photographs beautifully.", pros: ["Real plumping", "Great finish", "Smells amazing"], cons: ["Small tube"], likesCount: 312, isCampaignReview: true, createdAt: ago(3) },
        { productName: "Rhode Peptide Lip Treatment", category: "Beauty", campaignId: "camp_rhode", productId: campDocs["camp_rhode"], variantName: "Salted Caramel", variantId: vid("camp_rhode", "Salted Caramel"), reviewerName: "Zoe T.", rating: 4, summary: "Hype that is actually justified", content: "I was deeply skeptical given the influencer marketing but after a month I understand the obsession. Stays on longer than most glosses and the hydration is real. Packaging could be more sustainable.", pros: ["Long-lasting", "Hydration", "Non-sticky"], cons: ["Packaging wasteful"], likesCount: 98, isCampaignReview: true, createdAt: ago(6) },
        { productName: "Rhode Peptide Lip Treatment", category: "Beauty", campaignId: "camp_rhode", productId: campDocs["camp_rhode"], variantName: "Watermelon Slice", variantId: vid("camp_rhode", "Watermelon Slice"), reviewerName: "Mia J.", rating: 5, summary: "Watermelon Slice is summer in a tube", content: "The scent alone is worth it. Applies like a dream and the light pink tint works on every skin tone. I have repurchased three times — once for me, twice as gifts. Nobody has been disappointed.", pros: ["Beautiful scent", "Subtle tint", "Lightweight"], cons: ["Sells out fast"], likesCount: 74, isCampaignReview: true, createdAt: ago(4) },
        { productName: "Charlotte Tilbury Flawless Filter", category: "Beauty", campaignId: "organic", productId: "org_9", reviewerName: "Monica R.", rating: 5, summary: "My skin but better in a bottle", content: "This is the product I reach for when I want to look effortless. One pump mixed into my moisturizer gives a glow that looks like you slept eight hours. Does not photograph as cakey as some primers.", pros: ["Natural glow", "Flexible coverage", "Skin prep"], cons: ["Expensive for the size"], likesCount: 167, isCampaignReview: false, createdAt: ago(11) },
        { productName: "Fenty Beauty Pro Filt'r Foundation", category: "Beauty", campaignId: "organic", productId: "org_10", reviewerName: "Jade W.", rating: 4, summary: "Finally a shade range that respects undertones", content: "Fifty shades actually cover the full spectrum. It oxidizes slightly after an hour so buy one shade lighter than your match. Transfer-proof claim is real — it did not budge through a wedding.", pros: ["Shade range", "Transfer-proof", "Buildable"], cons: ["Slight oxidation"], likesCount: 203, isCampaignReview: false, createdAt: ago(22) },

        // ── Gaming — PlayStation 5 Pro ───────────────────────────────────────
        { productName: "PlayStation 5 Pro", category: "Gaming", campaignId: "camp_ps5pro", productId: campDocs["camp_ps5pro"], variantName: "Disc Edition", variantId: vid("camp_ps5pro", "Disc Edition"), reviewerName: "Tom H.", rating: 5, summary: "This is what 4K gaming was supposed to look like", content: "PSSR upscaling genuinely competes with native 4K in most titles. Spider-Man 2 runs at a locked 60 with ray tracing that would have required a PC costing three times as much. The DualSense haptics still feel like magic.", pros: ["PSSR upscaling", "60fps RT mode", "DualSense"], cons: ["No disc drive in base model"], likesCount: 521, isCampaignReview: true, createdAt: ago(2) },
        { productName: "PlayStation 5 Pro", category: "Gaming", campaignId: "camp_ps5pro", productId: campDocs["camp_ps5pro"], variantName: "Digital Edition", variantId: vid("camp_ps5pro", "Digital Edition"), reviewerName: "Leo S.", rating: 4, summary: "For hardcore gamers only — casuals stick with base PS5", content: "The performance difference is real but only in supported titles. If your library is mostly indie games or cross-gen titles you will not notice. For those playing Horizon, GT7, and first-party exclusives — massive upgrade.", pros: ["Performance boost", "Backward compat", "Game library"], cons: ["Premium price", "Limited PSSR titles"], likesCount: 178, isCampaignReview: true, createdAt: ago(4) },
        { productName: "Elden Ring: Shadow of the Erdtree", category: "Gaming", campaignId: "organic", productId: "org_11", reviewerName: "Sarah L.", rating: 5, summary: "I have died 800 times and I regret nothing", content: "FromSoftware outdid themselves with the DLC. The new areas are bigger than most full games. Messmer is the best boss fight I have experienced in 30 years of gaming. If you liked the base game this is essential.", pros: ["New bosses", "Map size", "Lore"], cons: ["Steep difficulty curve"], likesCount: 634, isCampaignReview: false, createdAt: ago(14) },
        { productName: "Nintendo Switch 2", category: "Gaming", campaignId: "organic", productId: "org_12", reviewerName: "Ben K.", rating: 5, summary: "Nintendo still makes the most fun hardware", content: "The C button for GameChat is awkward at first but the mouse-click Joy-Con is a genuine innovation. Mario Kart World is the best launch title since Breath of the Wild. Docked mode now actually holds up on a 4K TV.", pros: ["Mouse Joy-Con", "OLED screen", "GameChat"], cons: ["C button learning curve"], likesCount: 289, isCampaignReview: false, createdAt: ago(7) },

        // ── Fitness — Whoop 5.0 ─────────────────────────────────────────────
        { productName: "Whoop 5.0 Band", category: "Fitness", campaignId: "camp_whoop", productId: campDocs["camp_whoop"], variantName: "Onyx Black", variantId: vid("camp_whoop", "Onyx Black"), reviewerName: "Elena R.", rating: 5, summary: "Changed how I think about recovery", content: "Three months in and I have completely restructured my training around HRV and recovery scores. Caught an oncoming illness two days before symptoms by noticing my HRV drop. Skin temperature tracking is the sleeper feature.", pros: ["HRV tracking", "Sleep staging", "Illness early warning"], cons: ["Subscription required"], likesCount: 198, isCampaignReview: true, createdAt: ago(4) },
        { productName: "Whoop 5.0 Band", category: "Fitness", campaignId: "camp_whoop", productId: campDocs["camp_whoop"], variantName: "Stone Grey", variantId: vid("camp_whoop", "Stone Grey"), reviewerName: "James O.", rating: 4, summary: "Best fitness tracker if you are serious about data", content: "The screenless design was weird at first but I love not being distracted by notifications during workouts. Strain coach suggestions are actually intelligent. Wish the community features were more fleshed out.", pros: ["No distractions", "Smart coaching", "Battery life"], cons: ["Pricey subscription", "Community features weak"], likesCount: 87, isCampaignReview: true, createdAt: ago(7) },
        { productName: "Whoop 5.0 Band", category: "Fitness", campaignId: "camp_whoop", productId: campDocs["camp_whoop"], variantName: "Desert Tan", variantId: vid("camp_whoop", "Desert Tan"), reviewerName: "Nina P.", rating: 5, summary: "Desert Tan looks incredible with everything", content: "I bought the Desert Tan because it pairs with gym wear and office wear equally well. The band itself is comfortable enough to sleep in — which you have to do for accurate sleep tracking. Six months in and I wouldn't swap it.", pros: ["Versatile colourway", "Sleep comfort", "Accurate data"], cons: ["Tan shows wear slightly over time"], likesCount: 52, isCampaignReview: true, createdAt: ago(6) },
        { productName: "Peloton Bike+", category: "Fitness", campaignId: "organic", productId: "org_13", reviewerName: "Amanda C.", rating: 4, summary: "Expensive but I have not skipped a Monday in eight months", content: "The instructors make or break this purchase. Alex Toussaint's classes have genuinely improved my cardio base. Sold my gym membership and it paid for itself in six months. The rotating screen for floor workouts is underrated.", pros: ["Instructor quality", "Screen rotates", "Community"], cons: ["High upfront cost"], likesCount: 156, isCampaignReview: false, createdAt: ago(9) },

        // ── Travel — IHG Indigo Hotels ──────────────────────────────────────
        { productName: "IHG One Rewards — Indigo Hotels", category: "Travel", campaignId: "camp_ihg", productId: campDocs["camp_ihg"], variantName: "Hotel Indigo Edinburgh", variantId: vid("camp_ihg", "Hotel Indigo Edinburgh"), reviewerName: "Priya N.", rating: 5, summary: "Boutique hotel that actually has personality", content: "Stayed at Hotel Indigo Edinburgh for a long weekend. It felt genuinely connected to the neighbourhood — the staff recommended a hidden whisky bar that no travel app listed. Design is beautiful without feeling precious.", pros: ["Local character", "Staff knowledge", "Design"], cons: ["Points redemption complex"], likesCount: 143, isCampaignReview: true, createdAt: ago(5) },
        { productName: "IHG One Rewards — Indigo Hotels", category: "Travel", campaignId: "camp_ihg", productId: campDocs["camp_ihg"], variantName: "Hotel Indigo Dubai", variantId: vid("camp_ihg", "Hotel Indigo Dubai"), reviewerName: "Carlos M.", rating: 4, summary: "Loyalty program finally worth it for frequent travelers", content: "Ambassador status means I get an upgrade almost every stay. The free weekend night certificate alone covers the annual fee twice over. App check-in works 80% of the time which is better than most chains.", pros: ["Upgrade frequency", "Free night cert", "App check-in"], cons: ["App bugs occasionally"], likesCount: 67, isCampaignReview: true, createdAt: ago(10) },
        { productName: "IHG One Rewards — Indigo Hotels", category: "Travel", campaignId: "camp_ihg", productId: campDocs["camp_ihg"], variantName: "Hotel Indigo NYC", variantId: vid("camp_ihg", "Hotel Indigo NYC"), reviewerName: "Rachel T.", rating: 5, summary: "The NYC location is in the perfect spot", content: "Walking distance to everything Midtown without the midtown hotel premium. The art deco lobby makes every check-in feel like an event. Room was compact but brilliantly designed — zero wasted space.", pros: ["Location", "Lobby design", "Smart room layout"], cons: ["Rooms on the small side"], likesCount: 89, isCampaignReview: true, createdAt: ago(8) },
        { productName: "Away Carry-On Luggage", category: "Travel", campaignId: "organic", productId: "org_14", reviewerName: "Hannah B.", rating: 5, summary: "The last suitcase you will ever buy", content: "Four years, 60 flights, and it still looks new. The compression mechanism lets me overpack without paying checked bag fees. The built-in battery was removed from newer models which is a shame but the shell quality is unmatched.", pros: ["Durability", "Compression", "Spinner wheels"], cons: ["No battery on new models"], likesCount: 234, isCampaignReview: false, createdAt: ago(35) },

        // ── Finance — Robinhood Gold ────────────────────────────────────────
        { productName: "Robinhood Gold", category: "Finance", campaignId: "camp_robinhood", productId: campDocs["camp_robinhood"], variantName: "Monthly Plan · $5/mo", variantId: vid("camp_robinhood", "Monthly Plan · $5/mo"), reviewerName: "Nate D.", rating: 4, summary: "5% APY on cash finally makes this account worth it", content: "The Gold subscription pays for itself with the APY on idle cash. Margin rates are still high but the instant deposit limit increase was the feature that made me upgrade. Interface is still the best in the business for quick trades.", pros: ["5% APY", "Instant deposits", "Clean UI"], cons: ["Margin rates high", "No bonds"], likesCount: 112, isCampaignReview: true, createdAt: ago(6) },
        { productName: "Robinhood Gold", category: "Finance", campaignId: "camp_robinhood", productId: campDocs["camp_robinhood"], variantName: "Annual Plan · $50/yr", variantId: vid("camp_robinhood", "Annual Plan · $50/yr"), reviewerName: "Kenji T.", rating: 3, summary: "Great UI, thin on serious investing tools", content: "If you are day trading or just parking emergency cash the UI and APY are genuinely excellent. As a long-term investor I miss screeners, bond purchasing, and proper tax loss harvesting tools. Good for beginners, outgrown by intermediates.", pros: ["Clean interface", "APY", "Options easy"], cons: ["No bonds", "Weak screeners", "CS still poor"], likesCount: 78, isCampaignReview: true, createdAt: ago(9) },
        { productName: "Wealthfront", category: "Finance", campaignId: "organic", productId: "org_15", reviewerName: "Grace S.", rating: 5, summary: "Set it and forget it investing that actually works", content: "Tax-loss harvesting alone has saved me more than the management fee costs. The Path planning tool showed me I could retire three years earlier than I thought. Portfolio line of credit at 5% beats any HELOC I have seen.", pros: ["Tax-loss harvesting", "Path planner", "Portfolio credit line"], cons: ["No individual stock picking"], likesCount: 189, isCampaignReview: false, createdAt: ago(28) },
      ];

      const reviewIds: string[] = [];
      for (const rev of reviews) {
        const reviewData = {
          ...rev,
          reviewerId: "seed_user",
          likedBy: [],
          helpfulCount: 0,
          helpfulBy: [],
          notHelpfulCount: 0,
          notHelpfulBy: [],
          commentCount: 0,
          forkCount: 0,
          versionCount: 1,
          eligibleForPayout: rev.isCampaignReview,
          reviewType: rev.isCampaignReview ? "campaign" : "verified",
          mediaUrls: [],
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

      setStatusMessage("Inserting channels…");

      // ── Sample channels ──────────────────────────────────────────────────
      const sampleChannels = [
        { name: "Smartphones", slug: "smartphones", description: "Reviews of the latest smartphones, cases, and accessories", category: "Tech", iconEmoji: "📱" },
        { name: "Standing Desks", slug: "standing-desks", description: "Standing desk reviews, ergonomics tips, and setup inspiration", category: "Home", iconEmoji: "🪑" },
        { name: "Skincare", slug: "skincare", description: "Skincare product reviews, routines, and ingredient breakdowns", category: "Beauty", iconEmoji: "✨" },
        { name: "Electric Vehicles", slug: "electric-vehicles", description: "EV reviews, charging tips, and road trip reports", category: "Automotive", iconEmoji: "⚡" },
      ];

      const channelIds: Record<string, string> = {};
      for (const ch of sampleChannels) {
        const ref = await addDoc(collection(db, "channels"), {
          ...ch,
          creatorId: "seed_admin",
          creatorName: "Admin",
          memberCount: 5,
          reviewCount: 0,
          createdAt: now.toISOString(),
          isOfficial: true,
        });
        channelIds[ch.slug] = ref.id;
      }

      setStatusMessage("Adding engagement data…");

      // ── Version updates on first 2 reviews ───────────────────────────────
      if (reviewIds.length >= 2) {
        // 3-month update on first review
        await addDoc(collection(db, "reviews", reviewIds[0], "versions"), {
          versionNumber: 2,
          versionLabel: "3 Month Update",
          content: "Three months in and the noise cancellation is still best-in-class. The ear cushions have broken in nicely and comfort has improved significantly. Battery still holds 38+ hours.",
          rating: 5,
          subRatings: {},
          pros: ["Broken-in comfort", "Consistent ANC"],
          cons: ["App still bloated"],
          mediaUrls: [],
          createdAt: ago(1),
        });
        await updateDoc(doc(db, "reviews", reviewIds[0]), {
          versionCount: 2,
          latestVersionLabel: "3 Month Update",
          lastUpdatedAt: ago(1),
        });

        // 6-month update on second review
        await addDoc(collection(db, "reviews", reviewIds[1], "versions"), {
          versionNumber: 2,
          versionLabel: "6 Month Update",
          content: "After six months of daily use, the headband padding shows slight wear but the sound quality is unchanged. Multipoint has become essential for my workflow switching between phone and laptop.",
          rating: 4,
          subRatings: {},
          pros: ["Multipoint essential", "Sound quality holds"],
          cons: ["Headband wear"],
          mediaUrls: [],
          createdAt: ago(1),
        });
        await updateDoc(doc(db, "reviews", reviewIds[1]), {
          versionCount: 2,
          latestVersionLabel: "6 Month Update",
          lastUpdatedAt: ago(1),
        });
      }

      // ── Fork: third review forks the first ───────────────────────────────
      if (reviewIds.length >= 3) {
        await updateDoc(doc(db, "reviews", reviewIds[2]), {
          forkedFromReviewId: reviewIds[0],
          forkedFromReviewerName: "Alex Chen",
        });
        await updateDoc(doc(db, "reviews", reviewIds[0]), { forkCount: 1 });
        await addDoc(collection(db, "reviewForks"), {
          originalReviewId: reviewIds[0],
          forkReviewId: reviewIds[2],
          forkerId: "seed_user",
          forkerName: "Dan T.",
          createdAt: ago(10),
        });
      }

      // ── Threaded comments ────────────────────────────────────────────────
      if (reviewIds.length >= 1) {
        const c1 = await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[0],
          userId: "seed_user_2",
          userName: "Marcus T.",
          content: "Totally agree about the ANC. Have you tried them on a plane?",
          createdAt: ago(2),
          parentCommentId: null,
          depth: 0,
        });
        await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[0],
          userId: "seed_user",
          userName: "Alex Chen",
          content: "Yes! Used them on a 12-hour flight to Tokyo. Complete silence even during takeoff.",
          createdAt: ago(1),
          parentCommentId: c1.id,
          depth: 1,
        });
        await addDoc(collection(db, "reviewComments"), {
          reviewId: reviewIds[0],
          userId: "seed_user_3",
          userName: "Sophie K.",
          content: "How do they compare to the Bose QC Ultra?",
          createdAt: ago(1),
          parentCommentId: null,
          depth: 0,
        });
        await updateDoc(doc(db, "reviews", reviewIds[0]), { commentCount: 3 });
      }

      setStatusMessage(`✅ Done! Inserted ${campaigns.length} campaigns, ${reviews.length} reviews, ${sampleChannels.length} channels, version updates, forks, and threaded comments.`);
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

  async function handleDistributePayouts() {
    if (!payoutCampId || !payoutBudget) return alert("Please enter both ID and Budget.");
    const confirm = window.confirm(`Distribute $${payoutBudget} to winners of ${payoutCampId}?`);
    if (!confirm) return;
    
    setIsProcessing(true);
    setStatusMessage(`Calculating payouts for ${payoutCampId}...`);

    try {
      const response = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // USING THE DYNAMIC INPUTS HERE:
        body: JSON.stringify({ campaignId: payoutCampId, budget: Number(payoutBudget) }), 
      });
      const data = await response.json();
      if (data.success) setStatusMessage(`✅ Success: ${data.message}`);
      else setStatusMessage(`❌ Error: ${data.error}`);
    } catch (error) {
      setStatusMessage("❌ Critical Error: Could not reach the payout agent.");
    } finally {
      setIsProcessing(false);
      setPayoutCampId("");
      setPayoutBudget("");
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

          {/* RIGHT COLUMN: Payout Manager */}
          <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">💰 Manage Payouts</h2>
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 mb-4 space-y-4">
              
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">Target Campaign ID</label>
                <input type="text" value={payoutCampId} onChange={e => setPayoutCampId(e.target.value)} placeholder="e.g. camp_123" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">Total Pool Budget ($)</label>
                <input type="number" value={payoutBudget} onChange={e => setPayoutBudget(e.target.value)} placeholder="1000" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" />
              </div>

              <button onClick={handleDistributePayouts} disabled={isProcessing} className={`w-full py-4 mt-2 rounded-xl font-black shadow-lg transition-all ${isProcessing ? "bg-slate-700 text-slate-400" : "bg-green-500 hover:bg-green-400 text-slate-900"}`}>
                {isProcessing ? "Processing Blockchain Tx..." : "Distribute Funds"}
              </button>
            </div>
            
            {statusMessage && (
              <div className={`mt-4 p-4 rounded-xl border font-mono text-sm font-bold ${statusMessage.includes('❌') ? 'bg-red-900/30 border-red-500/50 text-red-400' : 'bg-green-900/30 border-green-500/50 text-green-400'}`}>
                {statusMessage}
              </div>
            )}
          </div>

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
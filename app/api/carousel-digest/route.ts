import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { sendEmail } from "../../../lib/sendgrid";
import { carouselDigestEmail } from "../../../lib/emailTemplates";
import { TEMPLATE_OPTIONS } from "../../../lib/carousel/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reviewjam.co";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all products
    const productsSnap = await getDocs(collection(db, "products"));
    const products = productsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Array<{
      id: string;
      name?: string;
      brandName?: string;
      brandEmail?: string;
    }>;

    // Group products by brandEmail
    const brandMap = new Map<
      string,
      { brandName: string; products: Array<{ id: string; name: string }> }
    >();

    for (const p of products) {
      if (!p.brandEmail) continue;
      const entry = brandMap.get(p.brandEmail) || {
        brandName: p.brandName || "Brand",
        products: [],
      };
      entry.products.push({ id: p.id, name: p.name || "Product" });
      brandMap.set(p.brandEmail, entry);
    }

    // Send digest email per brand
    let sent = 0;

    for (const [email, brand] of brandMap) {
      const emailProducts = brand.products.map((p) => ({
        name: p.name,
        downloadLinks: TEMPLATE_OPTIONS.map((t) => ({
          label: t.label,
          url: `${SITE_URL}/api/carousel/${p.id}?template=${t.id}`,
        })),
      }));

      const { subject, html } = carouselDigestEmail({
        brandName: brand.brandName,
        products: emailProducts,
        hubUrl: `${SITE_URL}/brand`,
      });

      const ok = await sendEmail(email, subject, html);
      if (ok) sent++;
    }

    return Response.json({ success: true, sent });
  } catch (err) {
    console.error("[carousel-digest] Error:", err);
    return Response.json(
      { error: "Failed to send carousel digest emails" },
      { status: 500 },
    );
  }
}

// ─── HTML Email Templates ────────────────────────────────────────────────────
// All templates use inline CSS for maximum email-client compatibility.
// Shared layout: white card, max-width 600 px, indigo (#4f46e5) accents.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reviewjam.co";

// ── Shared layout wrapper ────────────────────────────────────────────────────

function layout(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background-color:#4f46e5;padding:24px 32px;">
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Review Jam</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            You received this because you have an account on Review Jam.<br/>
            <a href="${SITE_URL}" style="color:#4f46e5;text-decoration:none;">reviewjam.co</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function ctaButton(label: string, href: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="background-color:#4f46e5;border-radius:8px;padding:12px 28px;">
    <a href="${href}" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">${label}</a>
  </td></tr>
</table>`;
}

// ── Welcome Email ────────────────────────────────────────────────────────────

export function welcomeEmail(userName: string): { subject: string; html: string } {
  const firstName = userName?.split(" ")[0] || "there";
  const html = layout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b;">Welcome to Review Jam, ${firstName}!</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      You just joined a marketplace built on trust-first reviews. Here, quality matters more than quantity &mdash; and you earn real money for writing honest, helpful reviews.
    </p>
    <h3 style="margin:0 0 12px;font-size:16px;color:#1e293b;">Quick-start tips</h3>
    <ol style="margin:0 0 8px;padding-left:20px;font-size:14px;color:#475569;line-height:1.8;">
      <li><strong>Browse your feed</strong> &mdash; discover products in categories you care about.</li>
      <li><strong>Write your first review</strong> &mdash; be specific, include pros &amp; cons, and attach a photo for bonus trust.</li>
      <li><strong>Earn &amp; grow</strong> &mdash; the higher your trust score, the more you earn from the monthly dividend pool.</li>
    </ol>
    ${ctaButton("Explore Your Feed", `${SITE_URL}/feed`)}
    <p style="margin:0;font-size:13px;color:#94a3b8;">Happy reviewing!</p>
  `);

  return { subject: "Welcome to Review Jam!", html };
}

// ── Weekly Digest Email ──────────────────────────────────────────────────────

interface DigestData {
  userName: string;
  newReviewCount: number;
  topCategories: string[];
  earnings: number;
  followerCount: number;
}

export function weeklyDigestEmail(data: DigestData): { subject: string; html: string } {
  const firstName = data.userName?.split(" ")[0] || "there";
  const categoriesList = data.topCategories.length > 0
    ? data.topCategories.map((c) => `<span style="display:inline-block;background-color:#eef2ff;color:#4f46e5;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;margin:0 4px 4px 0;">${c}</span>`).join("")
    : `<span style="font-size:13px;color:#94a3b8;">No new categories this week</span>`;

  const html = layout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b;">Your Weekly Digest, ${firstName}</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Here is what happened on Review Jam this past week.
    </p>

    <!-- Stats row -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:16px;background-color:#f8fafc;border-radius:8px;text-align:center;width:33%;">
          <p style="margin:0;font-size:24px;font-weight:800;color:#4f46e5;">${data.newReviewCount}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">New Reviews</p>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:16px;background-color:#f8fafc;border-radius:8px;text-align:center;width:33%;">
          <p style="margin:0;font-size:24px;font-weight:800;color:#059669;">$${data.earnings.toFixed(2)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Earned</p>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:16px;background-color:#f8fafc;border-radius:8px;text-align:center;width:33%;">
          <p style="margin:0;font-size:24px;font-weight:800;color:#1e293b;">${data.followerCount}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Followers</p>
        </td>
      </tr>
    </table>

    <h3 style="margin:0 0 8px;font-size:14px;color:#1e293b;">Trending Categories</h3>
    <p style="margin:0 0 20px;">${categoriesList}</p>

    ${ctaButton("View Your Feed", `${SITE_URL}/feed`)}
  `);

  return { subject: "Your Weekly Review Jam Digest", html };
}

// ── Payout Notification Email ────────────────────────────────────────────────

interface PayoutData {
  userName: string;
  amount: number;
  productName: string;
  totalEarned: number;
}

export function payoutNotificationEmail(data: PayoutData): { subject: string; html: string } {
  const firstName = data.userName?.split(" ")[0] || "there";
  const html = layout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b;">You earned $${data.amount.toFixed(2)}!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Congrats, ${firstName}! Your review of <strong>${data.productName}</strong> just earned you a payout.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:16px;background-color:#f0fdf4;border-radius:8px;text-align:center;width:50%;">
          <p style="margin:0;font-size:24px;font-weight:800;color:#059669;">$${data.amount.toFixed(2)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">This Payout</p>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:16px;background-color:#f8fafc;border-radius:8px;text-align:center;width:50%;">
          <p style="margin:0;font-size:24px;font-weight:800;color:#1e293b;">$${data.totalEarned.toFixed(2)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Lifetime Earnings</p>
        </td>
      </tr>
    </table>

    ${ctaButton("View Your Profile", `${SITE_URL}/feed`)}
    <p style="margin:0;font-size:13px;color:#94a3b8;">Keep writing quality reviews to earn more.</p>
  `);

  return { subject: `You earned $${data.amount.toFixed(2)} on Review Jam!`, html };
}

// ── New Follower Email ───────────────────────────────────────────────────────

interface FollowerData {
  userName: string;
  followerName: string;
  followerTrustScore: number;
}

export function newFollowerEmail(data: FollowerData): { subject: string; html: string } {
  const firstName = data.userName?.split(" ")[0] || "there";
  const html = layout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b;">${data.followerName} started following you</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hey ${firstName}, you have a new follower on Review Jam!
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="padding:16px;background-color:#f8fafc;border-radius:8px;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1e293b;">${data.followerName}</p>
        <p style="margin:0;font-size:13px;color:#64748b;">Trust Score: <strong style="color:#4f46e5;">${data.followerTrustScore}</strong></p>
      </td></tr>
    </table>

    ${ctaButton("View Their Profile", `${SITE_URL}/feed`)}
  `);

  return { subject: `${data.followerName} started following you`, html };
}

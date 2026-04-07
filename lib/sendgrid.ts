import sgMail from "@sendgrid/mail";

// ─── SendGrid Client ────────────────────────────────────────────────────────
// Initialised lazily — if SENDGRID_API_KEY is missing the helper logs a
// warning and silently no-ops so the rest of the app doesn't crash.

const API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@reviewjam.co";

let initialised = false;

function ensureInit() {
  if (initialised) return;
  if (!API_KEY) {
    console.warn("[sendgrid] SENDGRID_API_KEY is not set — emails will not be sent.");
    return;
  }
  sgMail.setApiKey(API_KEY);
  initialised = true;
}

/**
 * Send a single transactional email via SendGrid.
 * Returns `true` if the email was accepted, `false` otherwise.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  ensureInit();

  if (!API_KEY) {
    console.warn("[sendgrid] Skipping email — no API key configured.");
    return false;
  }

  try {
    await sgMail.send({ to, from: FROM_EMAIL, subject, html });
    return true;
  } catch (error) {
    console.error("[sendgrid] Failed to send email:", error);
    return false;
  }
}

// utils/sendEmail.js
//
// Sends transactional email via Brevo's HTTP API (https://api.brevo.com/v3/smtp/email)
// instead of SMTP. Render's free tier blocks outbound traffic on SMTP ports
// (25, 465, 587) as of Sept 26, 2025 — this goes out over normal HTTPS (443),
// which is never blocked, so it works identically on localhost and on Render free tier.
//
// Same function signature as before: sendEmail({ to, subject, html }) -> { sent: boolean }
// so no other file in the project needs to change.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@northfieldschool.io";
const FROM_NAME = process.env.FROM_NAME || "Northfield School";

async function sendEmail({ to, subject, html }) {
  if (!BREVO_API_KEY) {
    console.error(`[email] BREVO_API_KEY is not set — cannot send "${subject}" to ${to}`);
    return { sent: false, error: "BREVO_API_KEY missing" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[email] Failed to send "${subject}" to ${to}: ${response.status} ${errBody}`);
      return { sent: false, error: `Brevo API error ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    console.log(`[email] Sent "${subject}" to ${to} (messageId: ${data.messageId || "n/a"})`);
    return { sent: true, messageId: data.messageId };
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

module.exports = sendEmail;

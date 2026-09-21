const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null; // not configured — caller should handle this gracefully
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // true for port 465, false for 587/others
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

// Sends an email. Never throws — logs and returns { sent: false, reason } on any failure,
// so a broken/missing email config never breaks the feature that triggered it
// (e.g. a demo signup should still work even if the email can't be sent).
async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] SMTP not configured — skipped sending "${subject}" to ${to}`);
    return { sent: false, reason: "SMTP not configured" };
  }

  try {
    await t.sendMail({
      from: `"${process.env.FROM_NAME || "Northfield School"}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = sendEmail;
const express = require("express");
const SubscriptionRequest = require("../models/SubscriptionRequest");
const sendEmail = require("../utils/sendEmail");
const { protect, allow } = require("../middleware/auth");

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@school.io", password: "admin123" },
  { role: "Teacher", email: "teacher@school.io", password: "teacher123" },
  { role: "Student", email: "arjun@school.io", password: "student123" },
  { role: "Parent", email: "arjun.parent@mail.com", password: "parent123" },
];

const router = express.Router();

const planLabels = { demo: "7-Day Demo", monthly: "Monthly", six_month: "6-Month", annual: "Annual" };

// Base URL of the live site — used to build clickable links inside emails,
// since a relative link like "/login.html" has no meaning outside a browser tab.
// Falls back to localhost if not set, so local testing still works.
const APP_URL = (process.env.APP_URL || "http://localhost:5000").replace(/\/$/, "");

function emailShell(bodyHtml) {
  return `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="font-family: Georgia, serif; font-size: 20px; font-weight: 600; color: #1B2430; margin-bottom: 4px;">
        🗂️ Northfield School
      </div>
      <div style="height: 3px; background: #2F6D5E; width: 40px; margin-bottom: 22px;"></div>
      ${bodyHtml}
      <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #E4DFD3; font-size: 12px; color: #4B5563;">
        This is an automated message from Northfield School's management system.
      </div>
    </div>
  `;
}

// Public — homepage pricing cards and the demo request button both hit this
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, schoolName, planType } = req.body;
    if (!name || !email || !schoolName || !planType) {
      return res.status(400).json({ message: "Name, email, school name, and plan are required" });
    }
    const validPlans = ["demo", "monthly", "six_month", "annual"];
    if (!validPlans.includes(planType)) {
      return res.status(400).json({ message: "Invalid plan type" });
    }

    const isDemo = planType === "demo";
    const requestData = { name, email, phone, schoolName, planType };

    if (isDemo) {
      // Demo requests are instant — no admin review needed
      requestData.status = "approved";
      requestData.approvedAt = new Date();
      requestData.trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const request = await SubscriptionRequest.create(requestData);

    let emailResult = { sent: false };
    if (isDemo) {
      const expiryStr = request.trialEndsAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      emailResult = await sendEmail({
        to: email,
        subject: "Your Northfield School demo is ready",
        html: emailShell(`
          <p style="font-size:15px; color:#1B2430;">Hi ${name},</p>
          <p style="font-size:14px; color:#4B5563; line-height:1.6;">
            Your free 7-day demo for <strong>${schoolName}</strong> is ready — no waiting, no approval needed.
          </p>
          <div style="background:#E4F0EC; border-radius:6px; padding:16px 20px; margin:20px 0;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.03em; color:#2F6D5E; font-weight:600; margin-bottom:10px;">Demo logins — explore every portal</div>
            ${DEMO_ACCOUNTS.map((a) => `
              <div style="font-size:13.5px; margin-bottom:8px;">
                <strong>${a.role}:</strong> ${a.email} / ${a.password}
              </div>
            `).join("")}
          </div>
          <p style="font-size:13px; color:#4B5563;">Free access until <strong>${expiryStr}</strong>. Subscribe any time to keep going after that.</p>
          <div style="text-align:center; margin: 24px 0;">
            <a href="${APP_URL}/login.html" style="display:inline-block; background:#C0392B; color:#fff; text-decoration:none; font-weight:600; font-size:14px; padding:12px 28px; border-radius:5px;">Log in now →</a>
          </div>
          <p style="font-size:13px; color:#4B5563;">This is a shared demo account for exploring the product — please don't enter real student or payment data.</p>
        `),
      });
    } else {
      // Paid plan — send an acknowledgement now, and a separate email once admin approves
      emailResult = await sendEmail({
        to: email,
        subject: `We received your ${planLabels[planType]} plan request`,
        html: emailShell(`
          <p style="font-size:15px; color:#1B2430;">Hi ${name},</p>
          <p style="font-size:14px; color:#4B5563; line-height:1.6;">
            Thanks for requesting the <strong>${planLabels[planType]}</strong> plan for <strong>${schoolName}</strong>.
            Our team reviews requests manually and will follow up within one business day.
          </p>
        `),
      });
    }

    const response = {
      message: isDemo
        ? "Your 7-day demo is ready — log in below to explore."
        : "Thanks — your request has been sent. Our team will review and grant access soon.",
      id: request._id,
      emailSent: emailResult.sent,
    };

    if (isDemo) {
      response.demoCredentials = DEMO_ACCOUNTS;
      response.trialEndsAt = request.trialEndsAt;
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin-only from here down
router.use(protect, allow("admin"));

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const requests = await SubscriptionRequest.find(filter).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const all = await SubscriptionRequest.find();
    const byStatus = {};
    const byPlan = {};
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byPlan[r.planType] = (byPlan[r.planType] || 0) + 1;
    }
    res.json({ total: all.length, byStatus, byPlan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id/approve", async (req, res) => {
  try {
    const request = await SubscriptionRequest.findByIdAndUpdate(
      req.params.id,
      { status: "approved", approvedAt: new Date(), notes: req.body.notes || "" },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: "Request not found" });

    const emailResult = await sendEmail({
      to: request.email,
      subject: "Your Northfield School access has been approved",
      html: emailShell(`
        <p style="font-size:15px; color:#1B2430;">Hi ${request.name},</p>
        <p style="font-size:14px; color:#4B5563; line-height:1.6;">
          Good news — your <strong>${planLabels[request.planType]}</strong> plan for <strong>${request.schoolName}</strong> has been approved.
        </p>
        <p style="font-size:14px; color:#4B5563; line-height:1.6;">
          Our team will be in touch shortly with your login details and next steps.
        </p>
      `),
    });

    res.json({ request, emailSent: emailResult.sent });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id/reject", async (req, res) => {
  try {
    const request = await SubscriptionRequest.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", notes: req.body.notes || "" },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json(request);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await SubscriptionRequest.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

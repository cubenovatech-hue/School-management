const express = require("express");
const SubscriptionRequest = require("../models/SubscriptionRequest");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();

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
    const request = await SubscriptionRequest.create({ name, email, phone, schoolName, planType });
    res.status(201).json({
      message: "Thanks — your request has been sent. Our team will reach out to grant access.",
      id: request._id,
    });
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
    res.json(request);
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
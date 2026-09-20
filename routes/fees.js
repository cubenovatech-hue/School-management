const express = require("express");
const Fee = require("../models/Fee");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/", allow("admin"), async (req, res) => {
  try {
    const fees = await Fee.find().populate("student");
    res.json(fees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/student/:studentId", async (req, res) => {
  try {
    let fee = await Fee.findOne({ student: req.params.studentId });
    if (!fee) fee = await Fee.create({ student: req.params.studentId, totalDue: 0, payments: [] });
    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/student/:studentId/payment", allow("admin"), async (req, res) => {
  try {
    const { amount, method, note } = req.body;
    const fee = await Fee.findOne({ student: req.params.studentId });
    if (!fee) return res.status(404).json({ message: "Fee record not found" });
    fee.payments.push({ amount, method, note, recordedBy: req.user._id });
    await fee.save();
    res.status(201).json(fee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/student/:studentId/due", allow("admin"), async (req, res) => {
  try {
    const fee = await Fee.findOneAndUpdate(
      { student: req.params.studentId },
      { totalDue: req.body.totalDue },
      { new: true, upsert: true }
    );
    res.json(fee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Summary for dashboard: total collected, total due, defaulters
router.get("/summary/overview", allow("admin"), async (req, res) => {
  try {
    const fees = await Fee.find().populate("student");
    let totalDue = 0,
      totalPaid = 0;
    const defaulters = [];
    for (const f of fees) {
      const paid = f.payments.reduce((s, p) => s + p.amount, 0);
      totalDue += f.totalDue;
      totalPaid += paid;
      const balance = f.totalDue - paid;
      if (balance > 0) defaulters.push({ student: f.student, balance });
    }
    res.json({ totalDue, totalPaid, totalOutstanding: totalDue - totalPaid, defaulters });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

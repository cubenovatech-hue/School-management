const express = require("express");
const Fee = require("../models/Fee");
const Student = require("../models/Student");
const { Message } = require("../models/Misc");
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

// Restrict non-admins to their own (or their child's) fee record
function canAccessStudentFee(req, studentId) {
  if (req.user.role === "admin") return true;
  if (req.user.role === "student") return req.user.studentProfile && req.user.studentProfile.toString() === studentId;
  if (req.user.role === "parent") return (req.user.children || []).some((c) => c.toString() === studentId);
  return false;
}

router.get("/student/:studentId", async (req, res) => {
  try {
    if (!canAccessStudentFee(req, req.params.studentId)) {
      return res.status(403).json({ message: "Not authorized to view this fee record" });
    }
    let fee = await Fee.findOne({ student: req.params.studentId });
    if (!fee) fee = await Fee.create({ student: req.params.studentId, components: [], payments: [] });
    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Preview who would be notified for a payment, before actually recording it
router.get("/student/:studentId/notify-preview", allow("admin"), async (req, res) => {
  try {
    const User = require("../models/User");
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const recipients = [];
    if (student.userAccount) {
      const u = await User.findById(student.userAccount);
      if (u) recipients.push({ role: "student", email: u.email });
    }
    if (student.parentUser) {
      const u = await User.findById(student.parentUser);
      if (u) recipients.push({ role: "parent", email: u.email });
    }
    res.json({ recipients });
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

    const newPayment = fee.payments[fee.payments.length - 1];
    const receiptLink = `/pages/receipt.html?studentId=${req.params.studentId}&paymentId=${newPayment._id}`;
    const totalDue = fee.components.reduce((s, c) => s + c.amount, 0);
    const totalPaid = fee.payments.reduce((s, p) => s + p.amount, 0);
    const balance = totalDue - totalPaid;

    // Notify the student and parent, if they have login accounts
    const student = await Student.findById(req.params.studentId);
    const notifiedRecipients = [];
    if (student) {
      const notifyBody =
        `Payment of ₹${amount.toLocaleString("en-IN")} received successfully for ${student.name}. ` +
        (balance > 0 ? `Remaining balance: ₹${balance.toLocaleString("en-IN")}.` : `Fees fully paid — thank you!`) +
        ` Tap below to view your receipt.`;

      const User = require("../models/User");
      if (student.userAccount) {
        const u = await User.findById(student.userAccount);
        if (u) {
          await Message.create({ from: req.user._id, to: u._id, body: notifyBody, type: "fee_receipt", link: receiptLink });
          notifiedRecipients.push({ role: "student", email: u.email });
        }
      }
      if (student.parentUser) {
        const u = await User.findById(student.parentUser);
        if (u) {
          await Message.create({ from: req.user._id, to: u._id, body: notifyBody, type: "fee_receipt", link: receiptLink });
          notifiedRecipients.push({ role: "parent", email: u.email });
        }
      }
    }

    res.status(201).json({ fee, notifiedRecipients });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Replace the full set of fee components (Tuition / Lab / Transport / Other) for a student
router.put("/student/:studentId/components", allow("admin"), async (req, res) => {
  try {
    const { components } = req.body; // [{ type, label, amount }, ...]
    const fee = await Fee.findOneAndUpdate(
      { student: req.params.studentId },
      { components },
      { new: true, upsert: true }
    );
    res.json(fee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Single payment + student + school info, shaped for a printable receipt
router.get("/student/:studentId/receipt/:paymentId", async (req, res) => {
  try {
    if (!canAccessStudentFee(req, req.params.studentId)) {
      return res.status(403).json({ message: "Not authorized to view this receipt" });
    }
    const fee = await Fee.findOne({ student: req.params.studentId }).populate({
      path: "student",
      populate: { path: "schoolClass" },
    });
    if (!fee) return res.status(404).json({ message: "Fee record not found" });
    const payment = fee.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    // Balance as of this payment (chronological running total)
    const sorted = [...fee.payments].sort((a, b) => new Date(a.date) - new Date(b.date));
    const idx = sorted.findIndex((p) => p._id.toString() === payment._id.toString());
    const paidUpToThis = sorted.slice(0, idx + 1).reduce((s, p) => s + p.amount, 0);
    const totalDue = fee.components.reduce((s, c) => s + c.amount, 0);

    res.json({
      student: fee.student,
      components: fee.components,
      payment,
      totalDue,
      balanceAfterThisPayment: totalDue - paidUpToThis,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
      const due = f.components.reduce((s, c) => s + c.amount, 0);
      const paid = f.payments.reduce((s, p) => s + p.amount, 0);
      totalDue += due;
      totalPaid += paid;
      const balance = due - paid;
      if (balance > 0) defaulters.push({ student: f.student, balance });
    }
    res.json({ totalDue, totalPaid, totalOutstanding: totalDue - totalPaid, defaulters });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

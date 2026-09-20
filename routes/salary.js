const express = require("express");
const Salary = require("../models/Salary");
const Teacher = require("../models/Teacher");
const User = require("../models/User");
const { Message } = require("../models/Misc");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

function canAccessTeacherSalary(req, teacherId) {
  if (req.user.role === "admin") return true;
  if (req.user.role === "teacher") return req.user.teacherProfile && req.user.teacherProfile.toString() === teacherId;
  return false;
}

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// Admin: list all salary records (optionally filter by month or status)
router.get("/", allow("admin"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.month) filter.month = req.query.month;
    if (req.query.status) filter.status = req.query.status;
    const records = await Salary.find(filter).populate("teacher").sort({ month: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/summary/overview", allow("admin"), async (req, res) => {
  try {
    const records = await Salary.find();
    let totalPaid = 0,
      totalPending = 0,
      pendingCount = 0;
    for (const r of records) {
      const net = r.basicPay + r.allowances - r.deductions;
      if (r.status === "paid") totalPaid += net;
      else {
        totalPending += net;
        pendingCount++;
      }
    }
    res.json({ totalPaid, totalPending, pendingCount, totalRecords: records.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// One teacher's own salary history (admin can view any; teacher only their own)
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    if (!canAccessTeacherSalary(req, req.params.teacherId)) {
      return res.status(403).json({ message: "Not authorized to view this salary record" });
    }
    const records = await Salary.find({ teacher: req.params.teacherId }).sort({ month: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Preview: which account will be notified when this salary is marked paid
router.get("/teacher/:teacherId/notify-preview", allow("admin"), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.teacherId);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    let recipient = null;
    if (teacher.userAccount) {
      const u = await User.findById(teacher.userAccount);
      if (u) recipient = { email: u.email };
    }
    res.json({ recipient });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create (or update, if same teacher+month exists and still pending) a salary record
router.post("/", allow("admin"), async (req, res) => {
  try {
    const { teacher, month, basicPay, allowances, deductions, note } = req.body;
    if (!teacher || !month) return res.status(400).json({ message: "Teacher and month are required" });

    const record = await Salary.findOneAndUpdate(
      { teacher, month },
      { basicPay: basicPay || 0, allowances: allowances || 0, deductions: deductions || 0, note: note || "" },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(record);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "A record for this teacher and month already exists." });
    }
    res.status(400).json({ message: err.message });
  }
});

// Mark a salary record as paid — this is the explicit, admin-confirmed action that notifies the teacher
router.put("/:id/pay", allow("admin"), async (req, res) => {
  try {
    const record = await Salary.findById(req.params.id).populate("teacher");
    if (!record) return res.status(404).json({ message: "Salary record not found" });
    if (record.status === "paid") return res.status(400).json({ message: "This record is already marked as paid" });

    record.status = "paid";
    record.paidDate = new Date();
    record.method = req.body.method || record.method;
    await record.save();

    const slipLink = `/pages/salary-slip.html?salaryId=${record._id}`;
    const net = record.basicPay + record.allowances - record.deductions;
    const notifyBody =
      `Your salary for ${monthLabel(record.month)} has been paid — ₹${net.toLocaleString("en-IN")} net. ` +
      `Tap below to view your salary slip.`;

    let notified = null;
    if (record.teacher.userAccount) {
      const u = await User.findById(record.teacher.userAccount);
      if (u) {
        await Message.create({ from: req.user._id, to: u._id, body: notifyBody, type: "salary_slip", link: slipLink });
        notified = { email: u.email };
      }
    }

    res.json({ record, notified });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Printable slip data
router.get("/:id/slip", async (req, res) => {
  try {
    const record = await Salary.findById(req.params.id).populate("teacher");
    if (!record) return res.status(404).json({ message: "Salary record not found" });
    if (!canAccessTeacherSalary(req, record.teacher._id.toString())) {
      return res.status(403).json({ message: "Not authorized to view this slip" });
    }
    res.json({ record, monthLabel: monthLabel(record.month) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", allow("admin"), async (req, res) => {
  try {
    const record = await Salary.findById(req.params.id);
    if (record && record.status === "paid") {
      return res.status(400).json({ message: "Paid records can't be deleted, to keep an accurate history." });
    }
    await Salary.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

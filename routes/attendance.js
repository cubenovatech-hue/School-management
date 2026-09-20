const express = require("express");
const Attendance = require("../models/Attendance");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

// Mark attendance in bulk for a class on a date
// body: { schoolClass, date, records: [{ student, status, remark }] }
router.post("/mark", allow("admin", "teacher"), async (req, res) => {
  try {
    const { schoolClass, date, records } = req.body;
    const day = new Date(date);
    const ops = records.map((r) => ({
      updateOne: {
        filter: { student: r.student, date: day },
        update: {
          $set: {
            student: r.student,
            schoolClass,
            date: day,
            status: r.status,
            remark: r.remark || "",
            markedBy: req.user.teacherProfile || null,
          },
        },
        upsert: true,
      },
    }));
    await Attendance.bulkWrite(ops);
    res.json({ message: `Attendance marked for ${records.length} students` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/class/:classId", allow("admin", "teacher"), async (req, res) => {
  try {
    const filter = { schoolClass: req.params.classId };
    if (req.query.date) {
      const d = new Date(req.query.date);
      filter.date = d;
    }
    const records = await Attendance.find(filter).populate("student");
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Attendance % + history for one student (student/parent/admin/teacher)
router.get("/student/:studentId", async (req, res) => {
  try {
    const records = await Attendance.find({ student: req.params.studentId }).sort({ date: -1 });
    const total = records.length;
    const present = records.filter((r) => r.status === "present" || r.status === "late").length;
    const percentage = total ? Math.round((present / total) * 1000) / 10 : 100;
    res.json({ percentage, total, present, records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Low-attendance alert list (below threshold, default 75%)
router.get("/alerts/low", allow("admin", "teacher"), async (req, res) => {
  try {
    const threshold = Number(req.query.threshold) || 75;
    const all = await Attendance.find().populate("student");
    const byStudent = {};
    for (const r of all) {
      if (!r.student) continue;
      const id = r.student._id.toString();
      if (!byStudent[id]) byStudent[id] = { student: r.student, total: 0, present: 0 };
      byStudent[id].total++;
      if (r.status === "present" || r.status === "late") byStudent[id].present++;
    }
    const alerts = Object.values(byStudent)
      .map((s) => ({ ...s, percentage: Math.round((s.present / s.total) * 1000) / 10 }))
      .filter((s) => s.percentage < threshold);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const express = require("express");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const SchoolClass = require("../models/SchoolClass");
const Attendance = require("../models/Attendance");
const Fee = require("../models/Fee");
const Lead = require("../models/Lead");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/admin", allow("admin"), async (req, res) => {
  try {
    const [studentCount, teacherCount, classCount, leadCount] = await Promise.all([
      Student.countDocuments({ status: "active" }),
      Teacher.countDocuments(),
      SchoolClass.countDocuments(),
      Lead.countDocuments({ stage: { $nin: ["enrolled", "lost"] } }),
    ]);

    const fees = await Fee.find();
    const totalPaid = fees.reduce((s, f) => s + f.payments.reduce((a, p) => a + p.amount, 0), 0);
    const totalDue = fees.reduce((s, f) => s + f.totalDue, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await Attendance.find({ date: today });
    const presentToday = todayAttendance.filter((a) => a.status === "present" || a.status === "late").length;

    const leads = await Lead.find();
    const byStage = {};
    for (const l of leads) byStage[l.stage] = (byStage[l.stage] || 0) + 1;

    res.json({
      studentCount,
      teacherCount,
      classCount,
      activeLeads: leadCount,
      feeCollected: totalPaid,
      feeOutstanding: totalDue - totalPaid,
      todayAttendance: { present: presentToday, total: todayAttendance.length },
      leadsByStage: byStage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/teacher", allow("teacher"), async (req, res) => {
  try {
    const teacher = await require("../models/Teacher").findOne({ userAccount: req.user._id }).populate("assignedClasses");
    const classIds = teacher ? teacher.assignedClasses.map((c) => c._id) : [];
    const studentCount = await Student.countDocuments({ schoolClass: { $in: classIds } });
    res.json({ teacher, classCount: classIds.length, studentCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/student", allow("student"), async (req, res) => {
  try {
    const studentId = req.user.studentProfile;
    const attendance = await Attendance.find({ student: studentId });
    const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
    const percentage = attendance.length ? Math.round((present / attendance.length) * 1000) / 10 : 100;
    const fee = await Fee.findOne({ student: studentId });
    res.json({
      attendancePercentage: percentage,
      feeBalance: fee ? fee.balance : 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/parent", allow("parent"), async (req, res) => {
  try {
    const children = await Student.find({ _id: { $in: req.user.children } }).populate("schoolClass");
    const results = [];
    for (const child of children) {
      const attendance = await Attendance.find({ student: child._id });
      const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
      const percentage = attendance.length ? Math.round((present / attendance.length) * 1000) / 10 : 100;
      const fee = await Fee.findOne({ student: child._id });
      results.push({
        child,
        attendancePercentage: percentage,
        feeBalance: fee ? fee.balance : 0,
      });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

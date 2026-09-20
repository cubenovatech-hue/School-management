const express = require("express");
const Student = require("../models/Student");
const Fee = require("../models/Fee");
const User = require("../models/User");
const generatePassword = require("../utils/generatePassword");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

// List students (admin/teacher see all; parent sees only their children; student sees self)
router.get("/", async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "parent") {
      filter._id = { $in: req.user.children };
    } else if (req.user.role === "student") {
      filter._id = req.user.studentProfile;
    } else if (req.query.classId) {
      filter.schoolClass = req.query.classId;
    }
    const students = await Student.find(filter).populate("schoolClass");
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate("schoolClass");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", allow("admin"), async (req, res) => {
  try {
    const { loginEmail, guardianLoginEmail, labFee, transportFee, ...studentFields } = req.body;

    const student = await Student.create(studentFields);

    const components = [];
    if (student.feeStructureAmount) {
      components.push({ type: "tuition", label: "Tuition Fee", amount: Number(student.feeStructureAmount) });
    }
    if (labFee) {
      components.push({ type: "lab", label: "Lab Fee", amount: Number(labFee) });
    }
    if (transportFee) {
      components.push({ type: "transport", label: "Transport Fee", amount: Number(transportFee) });
    }
    await Fee.create({ student: student._id, components, payments: [] });

    const credentials = {};

    // Auto-create a login account for the student, if an email was given
    if (loginEmail) {
      const existing = await User.findOne({ email: loginEmail.toLowerCase() });
      if (existing) {
        credentials.studentAccountError = `An account with ${loginEmail} already exists — student record was still created.`;
      } else {
        const password = generatePassword();
        const studentUser = await User.create({
          name: student.name,
          email: loginEmail,
          password,
          role: "student",
          avatarColor: "#C97A2B",
          studentProfile: student._id,
        });
        student.userAccount = studentUser._id;
        await student.save();
        credentials.student = { email: loginEmail, password };
      }
    }

    // Auto-create a login account for the parent/guardian, if an email was given
    if (guardianLoginEmail) {
      const existing = await User.findOne({ email: guardianLoginEmail.toLowerCase() });
      if (existing) {
        // Guardian already has an account (e.g. a sibling already enrolled) — just link this child
        existing.children = existing.children || [];
        if (!existing.children.some((c) => c.toString() === student._id.toString())) {
          existing.children.push(student._id);
          await existing.save();
        }
        student.parentUser = existing._id;
        await student.save();
        credentials.parentLinked = `Linked to existing parent account (${guardianLoginEmail}).`;
      } else {
        const password = generatePassword();
        const parentUser = await User.create({
          name: `${student.name.split(" ")[0]}'s Guardian`,
          email: guardianLoginEmail,
          password,
          role: "parent",
          avatarColor: "#8B4F9E",
          children: [student._id],
        });
        student.parentUser = parentUser._id;
        student.guardianEmail = guardianLoginEmail;
        await student.save();
        credentials.parent = { email: guardianLoginEmail, password };
      }
    }

    res.status(201).json({ student, credentials });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", allow("admin"), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", allow("admin"), async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: "Student removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

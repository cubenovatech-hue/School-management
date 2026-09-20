const express = require("express");
const Teacher = require("../models/Teacher");
const User = require("../models/User");
const generatePassword = require("../utils/generatePassword");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/", async (req, res) => {
  try {
    const teachers = await Teacher.find().populate("assignedClasses");
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", allow("admin"), async (req, res) => {
  try {
    const teacher = await Teacher.create(req.body);

    const credentials = {};
    if (teacher.email) {
      const existing = await User.findOne({ email: teacher.email.toLowerCase() });
      if (existing) {
        credentials.accountError = `An account with ${teacher.email} already exists — teacher record was still created.`;
      } else {
        const password = generatePassword();
        const teacherUser = await User.create({
          name: teacher.name,
          email: teacher.email,
          password,
          role: "teacher",
          avatarColor: "#3A5BA0",
          teacherProfile: teacher._id,
        });
        teacher.userAccount = teacherUser._id;
        await teacher.save();
        credentials.teacher = { email: teacher.email, password };
      }
    }

    res.status(201).json({ teacher, credentials });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", allow("admin"), async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", allow("admin"), async (req, res) => {
  try {
    await Teacher.findByIdAndDelete(req.params.id);
    res.json({ message: "Teacher removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
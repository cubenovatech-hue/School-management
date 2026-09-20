const express = require("express");
const { Exam, Grade } = require("../models/Exam");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.classId) filter.schoolClass = req.query.classId;
    const exams = await Exam.find(filter).populate("schoolClass");
    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", allow("admin", "teacher"), async (req, res) => {
  try {
    const exam = await Exam.create(req.body);
    res.status(201).json(exam);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Enter/update grades in bulk
// body: { examId, entries: [{ student, marksObtained, remark }] }
router.post("/grades", allow("admin", "teacher"), async (req, res) => {
  try {
    const { examId, entries } = req.body;
    const ops = entries.map((e) => ({
      updateOne: {
        filter: { exam: examId, student: e.student },
        update: { $set: { exam: examId, student: e.student, marksObtained: e.marksObtained, remark: e.remark || "" } },
        upsert: true,
      },
    }));
    await Grade.bulkWrite(ops);
    res.json({ message: `Grades saved for ${entries.length} students` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/grades/exam/:examId", async (req, res) => {
  try {
    const grades = await Grade.find({ exam: req.params.examId }).populate("student");
    res.json(grades);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/grades/student/:studentId", async (req, res) => {
  try {
    const grades = await Grade.find({ student: req.params.studentId }).populate({
      path: "exam",
      populate: { path: "schoolClass" },
    });
    res.json(grades);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

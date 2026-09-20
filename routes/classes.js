const express = require("express");
const SchoolClass = require("../models/SchoolClass");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/", async (req, res) => {
  try {
    const classes = await SchoolClass.find().populate("classTeacher");
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", allow("admin"), async (req, res) => {
  try {
    const cls = await SchoolClass.create(req.body);
    res.status(201).json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", allow("admin"), async (req, res) => {
  try {
    const cls = await SchoolClass.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", allow("admin"), async (req, res) => {
  try {
    await SchoolClass.findByIdAndDelete(req.params.id);
    res.json({ message: "Class removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

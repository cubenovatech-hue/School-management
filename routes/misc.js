const express = require("express");
const { TimetableSlot, Announcement, Message } = require("../models/Misc");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

/* ---------- Timetable ---------- */
router.get("/timetable/class/:classId", async (req, res) => {
  try {
    const slots = await TimetableSlot.find({ schoolClass: req.params.classId })
      .populate("teacher")
      .sort({ day: 1, period: 1 });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/timetable/teacher/:teacherId", async (req, res) => {
  try {
    const slots = await TimetableSlot.find({ teacher: req.params.teacherId })
      .populate("schoolClass")
      .sort({ day: 1, period: 1 });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/timetable", allow("admin"), async (req, res) => {
  try {
    const slot = await TimetableSlot.findOneAndUpdate(
      { schoolClass: req.body.schoolClass, day: req.body.day, period: req.body.period },
      req.body,
      { new: true, upsert: true }
    );
    res.status(201).json(slot);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/timetable/:id", allow("admin"), async (req, res) => {
  try {
    await TimetableSlot.findByIdAndDelete(req.params.id);
    res.json({ message: "Slot removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- Announcements ---------- */
router.get("/announcements", async (req, res) => {
  try {
    const audienceMap = { admin: null, teacher: "teachers", student: "students", parent: "parents" };
    const aud = audienceMap[req.user.role];
    const filter = aud ? { $or: [{ audience: "all" }, { audience: aud }] } : {};
    const list = await Announcement.find(filter).populate("postedBy", "name role").sort({ pinned: -1, createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/announcements", allow("admin", "teacher"), async (req, res) => {
  try {
    const ann = await Announcement.create({ ...req.body, postedBy: req.user._id });
    res.status(201).json(ann);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/announcements/:id", allow("admin", "teacher"), async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: "Announcement removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- Messages (internal teacher <-> parent etc.) ---------- */
router.get("/messages/thread/:otherUserId", async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [
        { from: req.user._id, to: req.params.otherUserId },
        { from: req.params.otherUserId, to: req.user._id },
      ],
    }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/messages/inbox", async (req, res) => {
  try {
    const msgs = await Message.find({ to: req.user._id }).populate("from", "name role").sort({ createdAt: -1 });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/messages", async (req, res) => {
  try {
    const msg = await Message.create({ from: req.user._id, to: req.body.to, body: req.body.body });
    res.status(201).json(msg);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/messages/:id/read", async (req, res) => {
  try {
    const msg = await Message.findOneAndUpdate({ _id: req.params.id, to: req.user._id }, { read: true }, { new: true });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
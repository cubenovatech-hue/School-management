const express = require("express");
const ContactMessage = require("../models/ContactMessage");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();

// Public — anyone on the homepage can submit, no login required
router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email, and message are all required" });
    }
    const saved = await ContactMessage.create({ name, email, message });
    res.status(201).json({ message: "Thanks — your message has been sent to the school." , id: saved._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin-only from here down
router.use(protect, allow("admin"));

router.get("/", async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id/read", async (req, res) => {
  try {
    const msg = await ContactMessage.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
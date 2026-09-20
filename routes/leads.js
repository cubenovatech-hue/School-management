const express = require("express");
const Lead = require("../models/Lead");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect, allow("admin"));

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.stage) filter.stage = req.query.stage;
    const leads = await Lead.find(filter).populate("ownerStaff", "name email").sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Kanban board grouped by stage
router.get("/board", async (req, res) => {
  try {
    const leads = await Lead.find().populate("ownerStaff", "name");
    const stages = ["new", "contacted", "visit_scheduled", "application_submitted", "enrolled", "lost"];
    const board = Object.fromEntries(stages.map((s) => [s, []]));
    for (const lead of leads) board[lead.stage].push(lead);
    res.json(board);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Follow-ups due today or overdue
router.get("/followups/due", async (req, res) => {
  try {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const leads = await Lead.find({
      nextFollowUp: { $lte: now },
      stage: { $nin: ["enrolled", "lost"] },
    }).sort({ nextFollowUp: 1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/pipeline/stats", async (req, res) => {
  try {
    const leads = await Lead.find();
    const bySource = {};
    const byStage = {};
    for (const l of leads) {
      bySource[l.source] = (bySource[l.source] || 0) + 1;
      byStage[l.stage] = (byStage[l.stage] || 0) + 1;
    }
    const enrolled = byStage.enrolled || 0;
    const lost = byStage.lost || 0;
    const closed = enrolled + lost;
    const conversionRate = closed ? Math.round((enrolled / closed) * 1000) / 10 : 0;
    res.json({ total: leads.length, bySource, byStage, conversionRate });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const lead = await Lead.create({
      ...req.body,
      ownerStaff: req.body.ownerStaff || req.user._id,
      activities: [{ type: "note", text: "Lead created", createdBy: req.user._id }],
    });
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("ownerStaff", "name email")
      .populate("activities.createdBy", "name");
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const { stage, nextFollowUp, lostReason, ...rest } = req.body;

    if (stage && stage !== lead.stage) {
      lead.activities.push({
        type: "stage_change",
        text: `Stage changed: ${lead.stage} -> ${stage}`,
        createdBy: req.user._id,
      });
      lead.stage = stage;
    }
    if (nextFollowUp !== undefined) lead.nextFollowUp = nextFollowUp;
    if (lostReason !== undefined) lead.lostReason = lostReason;
    Object.assign(lead, rest);

    await lead.save();
    res.json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/:id/activity", async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    lead.activities.push({
      type: req.body.type || "note",
      text: req.body.text,
      createdBy: req.user._id,
    });
    await lead.save();
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ message: "Lead removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

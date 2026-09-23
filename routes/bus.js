const express = require("express");
const Bus = require("../models/Bus");
const Student = require("../models/Student");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();

const APP_URL = (process.env.APP_URL || "http://localhost:5000").replace(/\/$/, "");

/* ---------------- Admin management ---------------- */
router.get("/", protect, allow("admin"), async (req, res) => {
  try {
    const buses = await Bus.find().populate("assignedClasses");
    res.json(buses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", protect, allow("admin"), async (req, res) => {
  try {
    const { busNumber, routeName, driverName, driverPhone, assignedClasses } = req.body;
    const bus = await Bus.create({ busNumber, routeName, driverName, driverPhone, assignedClasses: assignedClasses || [] });
    res.status(201).json({ bus, driverLink: `${APP_URL}/pages/driver-track.html?busId=${bus._id}&token=${bus.trackingToken}` });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "A bus with that number already exists." });
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", protect, allow("admin"), async (req, res) => {
  try {
    const { busNumber, routeName, driverName, driverPhone, assignedClasses } = req.body;
    const bus = await Bus.findByIdAndUpdate(
      req.params.id,
      { busNumber, routeName, driverName, driverPhone, assignedClasses },
      { new: true }
    );
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    res.json(bus);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", protect, allow("admin"), async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.json({ message: "Bus removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/driver-link", protect, allow("admin"), async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    res.json({ driverLink: `${APP_URL}/pages/driver-track.html?busId=${bus._id}&token=${bus.trackingToken}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------------- Driver endpoints (token-based, no login) ---------------- */
// The driver's page never logs in — it just needs to know the correct token
// for this specific bus, which admin shares as part of the driver link.
router.post("/:id/location", async (req, res) => {
  try {
    const { token, lat, lng, speedKmh } = req.body;
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    if (!token || token !== bus.trackingToken) {
      return res.status(403).json({ message: "Invalid tracking link" });
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    bus.currentLocation = { lat, lng, speedKmh: speedKmh || null, updatedAt: new Date() };
    bus.sharingActive = true;
    await bus.save();
    res.json({ message: "Location updated" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/:id/stop-sharing", async (req, res) => {
  try {
    const { token } = req.body;
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    if (!token || token !== bus.trackingToken) {
      return res.status(403).json({ message: "Invalid tracking link" });
    }
    bus.sharingActive = false;
    await bus.save();
    res.json({ message: "Sharing stopped" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Driver's own page also needs to read back the bus name/route to display, via token
router.get("/:id/info", async (req, res) => {
  try {
    const { token } = req.query;
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });
    if (!token || token !== bus.trackingToken) {
      return res.status(403).json({ message: "Invalid tracking link" });
    }
    res.json({ busNumber: bus.busNumber, routeName: bus.routeName, driverName: bus.driverName, sharingActive: bus.sharingActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------------- Parent/student viewing (scoped to their class) ---------------- */
async function getAccessibleClassIds(user) {
  if (user.role === "student" && user.studentProfile) {
    const student = await Student.findById(user.studentProfile);
    return student && student.schoolClass ? [student.schoolClass.toString()] : [];
  }
  if (user.role === "parent" && user.children && user.children.length) {
    const students = await Student.find({ _id: { $in: user.children } });
    return students.filter((s) => s.schoolClass).map((s) => s.schoolClass.toString());
  }
  return [];
}

router.get("/mine", protect, allow("student", "parent"), async (req, res) => {
  try {
    const classIds = await getAccessibleClassIds(req.user);
    if (!classIds.length) return res.json([]);
    const buses = await Bus.find({ assignedClasses: { $in: classIds } });
    res.json(buses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/location", protect, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: "Bus not found" });

    if (req.user.role === "admin") {
      return res.json(bus);
    }
    const classIds = await getAccessibleClassIds(req.user);
    const isAssigned = bus.assignedClasses.some((c) => classIds.includes(c.toString()));
    if (!isAssigned) return res.status(403).json({ message: "Not authorized to view this bus" });

    res.json(bus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
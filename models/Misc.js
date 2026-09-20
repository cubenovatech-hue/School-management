const mongoose = require("mongoose");

const timetableSlotSchema = new mongoose.Schema(
  {
    schoolClass: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      required: true,
    },
    period: { type: Number, required: true }, // 1..8
    subject: { type: String, required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    startTime: { type: String }, // "09:00"
    endTime: { type: String }, // "09:45"
  },
  { timestamps: true }
);
timetableSlotSchema.index({ schoolClass: 1, day: 1, period: 1 }, { unique: true });

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    audience: {
      type: String,
      enum: ["all", "teachers", "students", "parents"],
      default: "all",
    },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = {
  TimetableSlot: mongoose.model("TimetableSlot", timetableSlotSchema),
  Announcement: mongoose.model("Announcement", announcementSchema),
  Message: mongoose.model("Message", messageSchema),
};

const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["note", "call", "email", "visit", "stage_change"], default: "note" },
    text: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    childName: { type: String, required: true },
    interestedGrade: { type: String, required: true },
    guardianName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    source: {
      type: String,
      enum: ["walk_in", "website", "referral", "phone", "event", "social_media", "other"],
      default: "other",
    },
    stage: {
      type: String,
      enum: ["new", "contacted", "visit_scheduled", "application_submitted", "enrolled", "lost"],
      default: "new",
    },
    ownerStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin/staff handling the lead
    nextFollowUp: { type: Date },
    lostReason: { type: String },
    activities: [activitySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);

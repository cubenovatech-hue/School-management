const mongoose = require("mongoose");

const subscriptionRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    schoolName: { type: String, required: true },
    planType: {
      type: String,
      enum: ["demo", "monthly", "six_month", "annual"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedAt: { type: Date },
    trialEndsAt: { type: Date }, // set only for auto-approved demo requests
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubscriptionRequest", subscriptionRequestSchema);

const mongoose = require("mongoose");
const crypto = require("crypto");

const busSchema = new mongoose.Schema(
  {
    busNumber: { type: String, required: true, unique: true }, // e.g. "Bus 4"
    routeName: { type: String, required: true }, // e.g. "Route A — North Zone"
    driverName: { type: String, required: true },
    driverPhone: { type: String },
    assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass" }],
    trackingToken: { type: String, required: true, unique: true, default: () => crypto.randomBytes(16).toString("hex") },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      speedKmh: { type: Number },
      updatedAt: { type: Date },
    },
    sharingActive: { type: Boolean, default: false }, // true while the driver's page is actively sending
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bus", busSchema);
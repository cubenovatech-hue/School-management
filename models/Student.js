const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    admissionNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    dob: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    schoolClass: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass" },
    rollNo: { type: String },
    parentUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userAccount: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guardianPhone: { type: String },
    guardianEmail: { type: String },
    address: { type: String },
    status: { type: String, enum: ["active", "alumni", "inactive"], default: "active" },
    feeStructureAmount: { type: Number, default: 0 }, // total fee due for the year
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);

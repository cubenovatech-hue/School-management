const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subjectSpecialty: { type: String },
    phone: { type: String },
    email: { type: String },
    userAccount: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass" }],
    joinDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Teacher", teacherSchema);

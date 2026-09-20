const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    schoolClass: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent", "late", "excused"], required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    remark: { type: String },
  },
  { timestamps: true }
);

// One attendance record per student per day
attendanceSchema.index({ student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);

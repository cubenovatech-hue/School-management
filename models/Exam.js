const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g. "Mid-Term 2026"
    schoolClass: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", required: true },
    subject: { type: String, required: true },
    date: { type: Date, required: true },
    maxMarks: { type: Number, required: true, default: 100 },
  },
  { timestamps: true }
);

const gradeSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    marksObtained: { type: Number, required: true },
    remark: { type: String },
  },
  { timestamps: true }
);
gradeSchema.index({ exam: 1, student: 1 }, { unique: true });

module.exports = {
  Exam: mongoose.model("Exam", examSchema),
  Grade: mongoose.model("Grade", gradeSchema),
};

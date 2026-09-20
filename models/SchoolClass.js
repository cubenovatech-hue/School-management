const mongoose = require("mongoose");

const schoolClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "Grade 8"
    section: { type: String, required: true }, // e.g. "A"
    classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    subjects: [{ type: String }],
    room: { type: String },
  },
  { timestamps: true }
);

schoolClassSchema.index({ name: 1, section: 1 }, { unique: true });

module.exports = mongoose.model("SchoolClass", schoolClassSchema);

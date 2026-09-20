const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["admin", "teacher", "student", "parent"],
      required: true,
    },
    // Links a parent account to their child/children (Student _ids)
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    // Links a student user account to their Student profile
    studentProfile: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    // Links a teacher user account to their Teacher profile
    teacherProfile: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
    avatarColor: { type: String, default: "#2F6D5E" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    month: { type: String, required: true }, // "YYYY-MM", e.g. "2026-09"
    basicPay: { type: Number, required: true, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    paidDate: { type: Date },
    method: { type: String, enum: ["cash", "bank_transfer", "upi", "cheque"], default: "bank_transfer" },
    note: { type: String },
  },
  { timestamps: true }
);

salarySchema.index({ teacher: 1, month: 1 }, { unique: true });

salarySchema.virtual("netPay").get(function () {
  return this.basicPay + this.allowances - this.deductions;
});

salarySchema.set("toJSON", { virtuals: true });
salarySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Salary", salarySchema);
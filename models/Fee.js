const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    method: { type: String, enum: ["cash", "card", "bank_transfer", "upi", "cheque"], default: "cash" },
    note: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

const feeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, unique: true },
    totalDue: { type: Number, required: true, default: 0 },
    payments: [paymentSchema],
  },
  { timestamps: true }
);

feeSchema.virtual("totalPaid").get(function () {
  return this.payments.reduce((sum, p) => sum + p.amount, 0);
});

feeSchema.virtual("balance").get(function () {
  return this.totalDue - this.payments.reduce((sum, p) => sum + p.amount, 0);
});

feeSchema.set("toJSON", { virtuals: true });
feeSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Fee", feeSchema);

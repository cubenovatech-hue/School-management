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

const feeComponentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["tuition", "lab", "transport", "other"], required: true },
    label: { type: String, required: true }, // e.g. "Tuition Fee", "Lab Fee", "Bus Fee (8 km)"
    amount: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const feeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, unique: true },
    components: { type: [feeComponentSchema], default: [] },
    payments: [paymentSchema],
  },
  { timestamps: true }
);

feeSchema.virtual("totalDue").get(function () {
  return this.components.reduce((sum, c) => sum + c.amount, 0);
});

feeSchema.virtual("totalPaid").get(function () {
  return this.payments.reduce((sum, p) => sum + p.amount, 0);
});

feeSchema.virtual("balance").get(function () {
  return this.totalDue - this.totalPaid;
});

feeSchema.set("toJSON", { virtuals: true });
feeSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Fee", feeSchema);
const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    author: { type: String },
    isbn: { type: String },
    totalCopies: { type: Number, default: 1 },
    availableCopies: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const issueSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    finePerDay: { type: Number, default: 2 },
  },
  { timestamps: true }
);

issueSchema.virtual("status").get(function () {
  if (this.returnDate) return "returned";
  return this.dueDate < new Date() ? "overdue" : "issued";
});

issueSchema.virtual("fine").get(function () {
  const end = this.returnDate || new Date();
  if (end <= this.dueDate) return 0;
  const daysLate = Math.ceil((end - this.dueDate) / (1000 * 60 * 60 * 24));
  return daysLate * this.finePerDay;
});

issueSchema.set("toJSON", { virtuals: true });
issueSchema.set("toObject", { virtuals: true });

module.exports = {
  Book: mongoose.model("Book", bookSchema),
  BookIssue: mongoose.model("BookIssue", issueSchema),
};

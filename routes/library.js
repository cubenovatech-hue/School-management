const express = require("express");
const { Book, BookIssue } = require("../models/Library");
const { protect, allow } = require("../middleware/auth");

const router = express.Router();
router.use(protect);

router.get("/books", async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/books", allow("admin"), async (req, res) => {
  try {
    const book = await Book.create({ ...req.body, availableCopies: req.body.totalCopies });
    res.status(201).json(book);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/issue", allow("admin"), async (req, res) => {
  try {
    const { book: bookId, student, dueDate } = req.body;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });
    if (book.availableCopies < 1) return res.status(400).json({ message: "No copies available" });

    book.availableCopies -= 1;
    await book.save();

    const issue = await BookIssue.create({ book: bookId, student, dueDate });
    res.status(201).json(issue);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/return/:issueId", allow("admin"), async (req, res) => {
  try {
    const issue = await BookIssue.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ message: "Issue record not found" });
    if (issue.returnDate) return res.status(400).json({ message: "Already returned" });

    issue.returnDate = new Date();
    await issue.save();

    const book = await Book.findById(issue.book);
    book.availableCopies += 1;
    await book.save();

    res.json(issue);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/issues", async (req, res) => {
  try {
    const filter = {};
    if (req.query.studentId) filter.student = req.query.studentId;
    if (req.query.status === "outstanding") filter.returnDate = null;
    const issues = await BookIssue.find(filter).populate("book").populate("student");
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

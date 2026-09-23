require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/students", require("./routes/students"));
app.use("/api/teachers", require("./routes/teachers"));
app.use("/api/classes", require("./routes/classes"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/exams", require("./routes/exams"));
app.use("/api/fees", require("./routes/fees"));
app.use("/api/leads", require("./routes/leads"));
app.use("/api/library", require("./routes/library"));
app.use("/api/misc", require("./routes/misc"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/subscriptions", require("./routes/subscriptions"));
app.use("/api/salary", require("./routes/salary"));
app.use("/api/chat", require("./routes/chat"));

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() }));

// Fallback to home.html for any unmatched non-API path
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

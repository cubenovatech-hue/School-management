const express = require("express");
const { Announcement } = require("../models/Misc");

const router = express.Router();

// ---- Edit this block to match your actual school's details ----
const SCHOOL_INFO = `
School name: Northfield School
Class timings: Monday–Saturday, 8:00 AM – 3:30 PM. Closed Sundays and public holidays.
Office hours: Monday–Saturday, 8:00 AM – 4:30 PM.
Culture & values: Northfield emphasizes curiosity, discipline, and community. Students take part in weekly clubs (robotics, debate, art) alongside academics.
Sports: A strong sports program with an Annual Sports Day (see live announcements below for the current date/details).
Admissions: Prospective families can request a free 7-day demo or a paid plan from the homepage pricing section; actual admissions enquiries go through the school office.
`.trim();

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

router.post("/", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "A message is required" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.json({
        reply: "The chatbot isn't configured yet — please contact the school office directly for now.",
      });
    }

    // Pull a few recent announcements so the bot can answer live questions
    // (e.g. "when is sports day?") accurately instead of guessing.
    const announcements = await Announcement.find().sort({ pinned: -1, createdAt: -1 }).limit(6);
    const announcementsBlock = announcements.length
      ? announcements.map((a) => `- ${a.title}: ${a.body}`).join("\n")
      : "No current announcements.";

    const systemPrompt = `You are the friendly front-desk assistant for a school's website chatbot. Answer questions about the school using ONLY the information given below. Keep answers short (2-4 sentences), warm, and specific. If something isn't covered by the information below, say you're not sure and suggest contacting the school office — never make up specific facts (dates, names, policies) that aren't provided here.

SCHOOL INFORMATION:
${SCHOOL_INFO}

CURRENT ANNOUNCEMENTS (most current source for dates/events):
${announcementsBlock}`;

    // Keep only the last few turns to control token usage/cost
    const trimmedHistory = Array.isArray(history) ? history.slice(-6) : [];

    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedHistory.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"),
      { role: "user", content: message },
    ];

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: 300,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("[chat] Groq API error:", groqRes.status, errText);
      return res.json({ reply: "Sorry, I'm having trouble answering right now — please try again in a moment." });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I didn't quite catch that — could you rephrase?";
    res.json({ reply });
  } catch (err) {
    console.error("[chat] Unexpected error:", err.message);
    res.status(500).json({ reply: "Something went wrong — please try again." });
  }
});

module.exports = router;
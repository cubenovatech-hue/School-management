
const express = require("express");
const { Announcement } = require("../models/Misc");

const router = express.Router();

const SCHOOL_INFO = `
School name: Northfield School
Class timings: Monday–Saturday, 8:00 AM – 3:30 PM. Closed Sundays and public holidays.
Office hours: Monday–Saturday, 8:00 AM – 4:30 PM.
Culture & values: Northfield emphasizes curiosity, discipline, and community. Students take part in weekly clubs (robotics, debate, art) alongside academics.
Sports: A strong sports program with an Annual Sports Day (see live announcements below for the current date/details).
Admissions: Prospective families can request a free 7-day demo or a paid plan from the homepage pricing section; actual admissions enquiries go through the school office.
`.trim();

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `
You are the friendly, professional front-desk assistant for Northfield School.

YOUR LANGUAGE RULES:
1. Automatically identify the language used in the latest visitor message.
2. Reply in the same language as the visitor.
3. Support English, Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali, Marathi, and other languages.
4. If the visitor writes in Tanglish or another mixed-language style, respond naturally in a similar style.
5. Do not automatically translate the visitor's question into English.
6. Keep the language simple, natural, polite, and easy to understand.

YOUR ANSWER STYLE:
1. Give short, direct answers by default (normally 2–4 sentences).
2. Use headings and bullet points when they improve readability.
3. Use Markdown tables when the visitor asks for comparisons, schedules, lists of structured information, or other data that is clearer in a table.
4. Give longer explanations only when the visitor requests details.
5. Avoid repeating information unnecessarily.
6. End with 1–3 useful, relevant follow-up questions when appropriate. Write these in the visitor's language.
7. Do not suggest irrelevant follow-up questions.

ACCURACY RULES:
1. Answer school-related questions using ONLY the supplied school information and current announcements.
2. Never invent dates, fees, staff names, admission requirements, examination schedules, or school policies.
3. If information is unavailable, politely say that you do not have that information and suggest contacting the school office.
4. Distinguish confirmed announcements from general information.
5. You may answer greetings politely in the visitor's language.
6. If a question is unrelated to the school, briefly explain that you are the Northfield School assistant and offer help with school-related questions.

SCHOOL INFORMATION:
${SCHOOL_INFO}

CURRENT SCHOOL ANNOUNCEMENTS:
{{ANNOUNCEMENTS}}
`;

router.post("/", async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        reply: "Please enter a message."
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        reply: "Please keep your message under 2,000 characters."
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        reply: "The chatbot is temporarily unavailable. Please contact the Northfield School office."
      });
    }

    // Retrieve recent school announcements.
    const announcements = await Announcement.find()
      .sort({ pinned: -1, createdAt: -1 })
      .limit(6)
      .lean();

    const announcementsBlock = announcements.length
      ? announcements
          .map((a) => `- ${a.title}: ${a.body}`)
          .join("\n")
      : "No current announcements.";

    const systemPrompt = SYSTEM_PROMPT.replace(
      "{{ANNOUNCEMENTS}}",
      announcementsBlock
    );

    // Keep only valid recent conversation messages.
    const trimmedHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              ["user", "assistant"].includes(m.role) &&
              typeof m.content === "string" &&
              m.content.trim()
          )
          .slice(-8)
          .map((m) => ({
            role: m.role,
            content: m.content.slice(0, 2000)
          }))
      : [];

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...trimmedHistory,
      {
        role: "user",
        content: message.trim()
      }
    ];

    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.4,
          max_tokens: 550
        })
      }
    );

    if (!groqRes.ok) {
      const errText = await groqRes.text();

      console.error(
        "[chat] Groq API error:",
        groqRes.status,
        errText
      );

      return res.status(502).json({
        reply: "Sorry, I'm having trouble answering right now. Please try again in a moment."
      });
    }

    const data = await groqRes.json();

    const reply =
      data.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn't understand that. Could you please rephrase?";

    return res.json({ reply });

  } catch (err) {
    console.error("[chat] Unexpected error:", err);

    return res.status(500).json({
      reply: "Something went wrong. Please try again."
    });
  }
});

module.exports = router;

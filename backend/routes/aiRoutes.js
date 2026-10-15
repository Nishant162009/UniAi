const express = require("express");
const router = express.Router();
const askAI = require("../services/ai");
const enricher = require("../services/enricher");
const { aiLimiter } = require("../security/server-headers");
const supabase = require("../supabase");

/**
 * Reads the Supabase access token the browser already sends (Authorization: Bearer ...)
 * and puts the verified user on req.user, so aiLimiter limits PER USER (not per IP).
 * Signed-out visitors still work (they fall back to the IP limit). To make chat
 * sign-in only, change the `return next()` for "no token" into a 401.
 */
async function optionalUser(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return next();
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data && data.user) req.user = data.user;
  } catch (err) {
    /* an invalid token is treated like no token */
  }
  next();
}

router.post("/chat", optionalUser, aiLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.json({ reply: "Please enter a valid message!" });
    }
    const question = message.trim().slice(0, 1500); // cap what a single message can cost

    // 1. Find matching schools (select * so the 70/30 rule can see every column)
    const { data, error } = await supabase
      .from("universities")
      .select("*")
      .textSearch("name", question, { config: "english", type: "websearch" })
      .limit(5);

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({ error: "Could not load university data. Please try again." });
    }

    // Fallback: top 5 by rank
    let rows = data;
    if (!rows || rows.length === 0) {
      const fallback = await supabase.from("universities").select("*").order("qs_rank", { ascending: true }).limit(5);
      rows = fallback.data || [];
    }

    // 2. Add the cached AI estimates (never calls the model here, so chat stays fast and free)
    const merged = await enricher.applyCached(rows);
    const est = (u, field) => (u._provenance && u._provenance[field] === "ai" ? " (AI estimate)" : "");

    const universityContext = merged
      .map(
        (u) =>
          `Uni: ${u.name} | Country: ${u.country}${est(u, "country")} | Rank: ${u.qs_rank} | Fee: ${u.tuition_fee}${est(u, "tuition_fee")} | ` +
          `IELTS: ${u.ielts ?? "n/a"}${est(u, "ielts")} | Link: ${u.website}`
      )
      .join("\n");

    const prompt = `
Data Context:
${universityContext}

Student Question:
${question}

Instructions:
- Answer the student's question clearly.
- Values marked (AI estimate) are not official. When you use one, say it is an estimate and tell the student to confirm it on the university's official website.
- DO NOT use markdown like ** or *.
- Use standard HTML tags for layout formatting:
  - Wrap key university names or numbers inside <strong> tags.
  - Structure lists using <ul> and <li> tags.
  - Use <br> tags for line breaks between points.
- Keep it extremely clean, structured, and easy to read.
`;

    const aiResponse = await askAI(prompt);
    const replyText = aiResponse.reply || aiResponse;

    res.json({ reply: replyText });
  } catch (err) {
    console.error("Route Error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." }); // details stay in the server log
  }
});

module.exports = router;
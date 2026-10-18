const express = require("express");
const router = express.Router();
const askAI = require("../services/ai");
const enricher = require("../services/enricher");
const { aiLimiter } = require("../security/server-headers");
const supabase = require("../supabase");

/* ==========================================================================
   Freemium access: signed-in users chat normally; a signed-out visitor gets
   ONE free message, then must sign in (the browser shows the sign-in modal
   when it receives the 429 below).
   ========================================================================== */

const FREE_GUEST_MESSAGES = 1;
const GUEST_TTL_MS = 24 * 60 * 60 * 1000; // a guest's usage is forgotten after 24h

// key -> { count, at }. In memory, so it also resets when the server restarts.
// That is fine for a showcase; use a Supabase table or Redis if you need it durable.
const guestUsage = new Map();

setInterval(() => {
  const cutoff = Date.now() - GUEST_TTL_MS;
  for (const [key, entry] of guestUsage) {
    if (entry.at < cutoff) guestUsage.delete(key);
  }
}, 60 * 60 * 1000).unref();

/** Keys used to recognise one guest: their IP and (if sent) their browser's anon id. */
function guestKeys(req) {
  const keys = [`ip:${req.ip}`];
  const anon = String(req.headers["x-anon-id"] || "");
  if (/^[a-z0-9_-]{6,64}$/i.test(anon)) keys.push(`id:${anon}`);
  return keys;
}

const usedBy = (key) => {
  const entry = guestUsage.get(key);
  return entry && Date.now() - entry.at < GUEST_TTL_MS ? entry.count : 0;
};

/**
 * Reads the Supabase access token the browser sends (Authorization: Bearer ...)
 * and puts the verified user on req.user, so aiLimiter limits PER USER.
 * - No token            -> guest (handled by guestGate below)
 * - Token that is valid -> signed-in user
 * - Token that is bad   -> 401, so the browser can say "session expired"
 *                          instead of quietly treating them as a guest.
 */
async function optionalUser(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return next();

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
    req.user = data.user;
    return next();
  } catch (err) {
    console.error("Auth check failed:", err);
    return res.status(401).json({ error: "Could not verify your session." });
  }
}

/**
 * Lets signed-in users straight through. For guests it reserves one of their
 * free messages BEFORE the model runs (so parallel requests can't sneak extra
 * messages through) and hands the reservation back if the request fails, so a
 * server error doesn't cost them their free message.
 */
function guestGate(req, res, next) {
  if (req.user) return next();

  const keys = guestKeys(req);

  if (keys.some((key) => usedBy(key) >= FREE_GUEST_MESSAGES)) {
    return res.status(429).json({
      error: "free_limit",
      message: "You've used your free message. Sign in to keep chatting."
    });
  }

  keys.forEach((key) => {
    guestUsage.set(key, { count: usedBy(key) + 1, at: Date.now() });
  });

  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) return; // success: message stays used
    keys.forEach((key) => {
      const entry = guestUsage.get(key);
      if (entry) entry.count = Math.max(0, entry.count - 1);
    });
  });

  next();
}

/* ========================================================================== */

router.post("/chat", optionalUser, guestGate, aiLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      // 400 (not 200) so a guest isn't charged their free message for an empty send
      return res.status(400).json({ reply: "Please enter a valid message!" });
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
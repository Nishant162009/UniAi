/* ==========================================================================
   UniAI — POST /ai/interview (routes/interviewRoutes.js)

   Mount in server.js:
     const interviewRoutes = require("./routes/interviewRoutes");
     app.use("/ai/interview", interviewRoutes);       // next to app.use("/ai", aiRoutes)

   Signed-in users only (unlike /ai/chat there is no free guest message: an
   interview is several model calls). Reuses your aiLimiter (per user, per
   minute) and adds a daily cap so one account can't run up the bill.

   Body: { country, history, style?, total?, profile? }  (see services/interview.js)
   ========================================================================== */

const express = require("express");
const router = express.Router();

const supabase = require("../supabase");
const { aiLimiter } = require("../security/server-headers");
const { interviewTurn } = require("../services/interview");

const DAILY_LIMIT = 60; // model calls per user per day (a 10-question interview is 11)
const DAY_MS = 24 * 60 * 60 * 1000;

// userId -> { count, at }. In memory, so it also resets when the server restarts.
const usage = new Map();

setInterval(() => {
  const cutoff = Date.now() - DAY_MS;
  for (const [id, entry] of usage) if (entry.at < cutoff) usage.delete(id);
}, 60 * 60 * 1000).unref();

async function requireUser(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "sign_in_required", message: "Sign in to practise your visa interview." });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: "invalid_session", message: "Your session expired. Please sign in again." });
    }
    req.user = data.user;
    return next();
  } catch (err) {
    console.error("Interview auth check failed:", err);
    return res.status(401).json({ error: "invalid_session", message: "Could not verify your session." });
  }
}

function dailyCap(req, res, next) {
  const id = req.user.id;
  const entry = usage.get(id);
  const used = entry && Date.now() - entry.at < DAY_MS ? entry.count : 0;

  if (used >= DAILY_LIMIT) {
    return res.status(429).json({ error: "daily_limit", message: "You've reached today's practice limit. Come back tomorrow." });
  }

  usage.set(id, { count: used + 1, at: entry && used ? entry.at : Date.now() });

  // A failed call hands the reservation back.
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) return;
    const e = usage.get(id);
    if (e) e.count = Math.max(0, e.count - 1);
  });

  next();
}

router.post("/", requireUser, dailyCap, aiLimiter, async (req, res) => {
  try {
    const { country, history, style, total, profile } = req.body || {};
    const result = await interviewTurn({
      country: String(country || ""),
      history,
      style: String(style || ""),
      total,
      profile
    });
    return res.json(result);
  } catch (err) {
    if (err && err.status === 400) return res.status(400).json({ error: "bad_request", message: err.message });
    console.error("Interview error:", err);
    return res.status(502).json({ error: "model_error", message: "Couldn't get a response just now. Please try again." });
  }
});

module.exports = router;
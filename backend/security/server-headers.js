/* ==========================================================================
   UniAI — server security headers + AI rate limit (Express)

   I have not seen your server file, so this is a drop-in module:

     npm i helmet express-rate-limit
     const { applySecurity, aiLimiter } = require("./security/server-headers");
     applySecurity(app);                       // BEFORE express.static / routes
     app.post("/ai/chat", aiLimiter, ...);     // before your chat handler

   Roll out in two steps: leave CSP_REPORT_ONLY = true, open every page and
   check the browser console for "Content-Security-Policy-Report-Only"
   warnings, add whatever legitimate host is missing, THEN set it to false.
   ========================================================================== */

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const ipKeyGenerator = rateLimit.ipKeyGenerator || ((ip) => ip); // helper exists in express-rate-limit 8+

const CSP_REPORT_ONLY = true;
const isProd = process.env.NODE_ENV === "production";

function applySecurity(app) {
  app.disable("x-powered-by");
  if (isProd) app.set("trust proxy", 1); // Render sits behind a proxy; needed for real client IPs

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        reportOnly: CSP_REPORT_ONLY,
        directives: {
          defaultSrc: ["'self'"],
          // 'unsafe-inline' is needed today because index.html has inline scripts and
          // onclick="" handlers. That limits how much CSP can stop an XSS bug, so the
          // escaping you already do (esc / escapeHTML / textContent) stays important.
          scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:", "https:"], // university logos/banners come from many hosts
          connectSrc: [
            "'self'",
            "https://*.supabase.co",
            "wss://*.supabase.co",
            "https://api.exchangerate-api.com",
            "https://restcountries.com"
          ],
          mediaSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"], // the real fix for clickjacking (security.js only backs it up)
          ...(isProd ? { upgradeInsecureRequests: [] } : {})
        }
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginEmbedderPolicy: false, // would block third-party logos/fonts
      hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false
    })
  );

  // Voice input in Uni Buddy needs the microphone; nothing else needs sensors.
  app.use((req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(self), payment=()");
    next();
  });
}

/**
 * /ai/chat costs you money on every call. Verify the Supabase token BEFORE this
 * runs, then limit per user (falls back to IP for anything unauthenticated).
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12, // 12 messages a minute per user is plenty for a human
  standardHeaders: true,
  legacyHeaders: false,
  // per signed-in user, else per IP (IPv6 addresses are grouped so one person can't dodge the limit)
  keyGenerator: (req) => (req.user && req.user.id) || ipKeyGenerator(req.ip),
  message: { error: "You're sending messages too fast. Please wait a moment." }
});

module.exports = { applySecurity, aiLimiter };
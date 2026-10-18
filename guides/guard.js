/* ==========================================================================
   UniAI — guide page guard (freemium)
   Include on EVERY page inside /guides/ (see the <head> snippet below).

   Access rule: a signed-out visitor can read ONE guide for free.
   Any other guide sends them to index.html, where the sign-in modal opens;
   after login they continue to the guide they asked for.

   <head> snippet (must come before any other scripts):

     <style id="auth-gate">html{visibility:hidden}</style>
     <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
     <script src="guard.js"></script>
   ========================================================================== */

(async () => {
  "use strict";

  // Same values as CONFIG in script.js
  const SUPABASE_URL = "https://fmphoudjslmwsebqttlf.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcGhvdWRqc2xtd3NlYnF0dGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NjAxNTQsImV4cCI6MjA5OTQzNjE1NH0.w10MlWop_go_qp7eIyYYFIy3ts38ReYmZJjQJqKZKmM";

  // Must match CONFIG.STORAGE.free and CONFIG.FREE.guides in script.js
  const FREE_KEY = "uniai-free-use";
  const FREE_GUIDES = 1;

  const page = location.pathname.split("/").pop() || "";
  const slug = page.replace(/\.html.*$/i, "");

  const reveal = () => {
    const gate = document.getElementById("auth-gate");
    if (gate) gate.remove();
  };

  const kick = () => {
    location.replace(
      `../index.html?login=required&next=${encodeURIComponent("guides/" + page)}`
    );
  };

  /** true = this guide may be read for free (and is recorded as the free one). */
  const claimFreeGuide = () => {
    if (!slug) return false;

    let d = {};
    try {
      d = JSON.parse(localStorage.getItem(FREE_KEY) || "{}") || {};
    } catch (err) {
      d = {};
    }

    const used = Array.isArray(d.guides) ? d.guides : [];

    if (used.includes(slug)) return true;
    if (used.length >= FREE_GUIDES) return false;

    d.guides = [...used, slug];
    try {
      localStorage.setItem(FREE_KEY, JSON.stringify(d));
    } catch (err) {
      return false; // can't record it, so don't hand out free access (fail closed)
    }
    return true;
  };

  /** Small bar telling a guest this is their free guide. */
  const showFreeBanner = () => {
    const mount = () => {
      if (document.getElementById("free-guide-banner")) return;

      const bar = document.createElement("div");
      bar.id = "free-guide-banner";
      bar.style.cssText =
        "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;" +
        "display:flex;gap:12px;align-items:center;max-width:calc(100vw - 24px);" +
        "padding:10px 16px;border-radius:999px;font:600 13px system-ui,sans-serif;" +
        "color:#fff;background:linear-gradient(135deg,#6d5dfb,#8b7bff);" +
        "box-shadow:0 8px 24px rgba(109,93,251,.35);";

      const text = document.createElement("span");
      text.textContent = "🎁 This is your free guide";

      const link = document.createElement("a");
      link.textContent = "Sign in to unlock all →";
      link.href = `../index.html?login=required&next=${encodeURIComponent("guides/" + page)}`;
      link.style.cssText = "color:#fff;text-decoration:underline;white-space:nowrap;";

      bar.append(text, link);
      document.body.appendChild(bar);
    };

    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  };

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await client.auth.getSession();

    if (data && data.session) {
      reveal(); // signed in: every guide is open
    } else if (claimFreeGuide()) {
      reveal(); // guest reading their one free guide
      showFreeBanner();
    } else {
      kick(); // free guide already used on a different guide
    }
  } catch (err) {
    kick(); // fail closed
  }
})();
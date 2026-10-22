/* ==========================================================================
   UniAI — Session safety (security.js)

   What this does (client side only — see the note at the bottom):

     1. Idle sign-out. If a signed-in tab sits unattended for IDLE_MINUTES it
        warns for WARN_SECONDS, then signs out and wipes the personal data
        kept in the browser (library / shared computers).
     2. Safe sign-out. Pushes unsynced changes to the account BEFORE signing
        out, for both the idle timeout and the manual "Sign out" buttons.
        (Without this, edits made in the last seconds are lost: sync.js can
        no longer upload once the session is gone.)
     3. Anti-framing. If another website embeds UniAI in an <iframe>
        (clickjacking the sign-in dialog), the page hides itself.
     4. A console warning against pasting code (self-XSS scams).

   Load order — AFTER sync.js and script.js:
     <script src="JS/sync.js"></script>
     <script src="JS/script.js"></script>
     <script src="JS/security.js"></script>

   Change settings without editing this file by defining, before it loads:
     <script>window.UniAISecurityConfig = { IDLE_MINUTES: 15 };</script>
   ========================================================================== */

(function () {
  "use strict";

  const OPTIONS = Object.assign(
    {
      IDLE_MINUTES: 240, // 0 turns idle sign-out off (was 30: signed people out whenever a tab was left or resumed)
      WARN_SECONDS: 60, // warning shown this long before sign-out
      LOGOUT_ON_RETURN: false, // true = also sign out when the site is opened after a long absence
      ALLOW_FRAMING: false, // true only if you deliberately embed UniAI elsewhere
      FLUSH_TIMEOUT_MS: 4000 // never block sign-out longer than this waiting for sync
    },
    window.UniAISecurityConfig || {}
  );

  const ACTIVE_KEY = "uniai-last-active"; // shared between tabs; not synced to the account
  const NOTICE_KEY = "uniai-idle-notice"; // survives the reload after sign-out
  const bootAt = Date.now();

  /* ------------------------------------------------------------------------
     1. Anti-framing
     ------------------------------------------------------------------------ */

  if (!OPTIONS.ALLOW_FRAMING && window.top !== window.self) {
    let sameOrigin = true;
    try {
      void window.top.location.href; // throws when the parent is another origin
    } catch (err) {
      sameOrigin = false;
    }

    if (!sameOrigin) {
      document.documentElement.style.display = "none";
      try {
        window.top.location = window.self.location.href; // break out if the browser allows it
      } catch (err) {
        /* sandboxed frame: staying hidden is the fallback */
      }
      return;
    }
  }

  /* ------------------------------------------------------------------------
     2. Console warning
     ------------------------------------------------------------------------ */

  try {
    console.log("%cStop!", "color:#ef4444;font-size:34px;font-weight:800;");
    console.log(
      "%cThis console is for developers. If someone told you to paste something here, it is a scam that can take over your account.",
      "font-size:14px;"
    );
  } catch (err) {
    /* ignore */
  }

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function sync() {
    return window.UniAISync || null;
  }

  function signedIn() {
    try {
      const s = sync();
      if (s) return Boolean(s.status().signedIn);
    } catch (err) {
      /* fall through */
    }
    try {
      return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
    } catch (err) {
      return false;
    }
  }

  /** Push anything still waiting to be uploaded, but never hang the sign-out. */
  async function flush() {
    try {
      const s = sync();
      if (!s) return;
      const st = s.status();
      if (!st.signedIn || !st.pending.length) return;
      await Promise.race([s.syncNow(), sleep(OPTIONS.FLUSH_TIMEOUT_MS)]);
    } catch (err) {
      /* signing out matters more than a failed upload */
    }
  }

  /* ------------------------------------------------------------------------
     Activity tracking (shared across tabs through localStorage)
     ------------------------------------------------------------------------ */

  let lastWrite = 0;
  let warning = false;
  let signingOut = false;

  function touch(force) {
    const now = Date.now();
    if (!force && now - lastWrite < 5000) return;
    lastWrite = now;
    try {
      localStorage.setItem(ACTIVE_KEY, String(now));
    } catch (err) {
      /* storage blocked: idle tracking just falls back to this page load */
    }
  }

  function lastActive() {
    try {
      return Number(localStorage.getItem(ACTIVE_KEY)) || bootAt;
    } catch (err) {
      return bootAt;
    }
  }

  /* ------------------------------------------------------------------------
     Warning banner
     ------------------------------------------------------------------------ */

  let bar = null;

  function injectStyles() {
    if (document.getElementById("sx-styles")) return;
    const style = document.createElement("style");
    style.id = "sx-styles";
    style.textContent =
      ".sx-bar{position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:100000;" +
      "display:flex;align-items:center;gap:16px;max-width:min(560px,calc(100vw - 24px));padding:14px 16px 14px 18px;border-radius:16px;" +
      "background:var(--card-bg,#17191f);color:var(--text,#f5f7fa);border:1px solid var(--border,#282c34);" +
      "box-shadow:0 18px 50px rgba(0,0,0,.4);font:500 .88rem/1.45 var(--font-body,system-ui,sans-serif);animation:sx-in .25s ease both}" +
      ".sx-bar.warn{border-color:#f59e0b}.sx-bar.ok{border-color:#10b981}" +
      ".sx-bar b{display:block;font-family:var(--font-display,inherit);font-size:.95rem;margin-bottom:2px}" +
      ".sx-bar span{color:var(--text-muted,#9da3ae)}.sx-bar em{font-style:normal;font-weight:700;color:var(--text,#f5f7fa)}" +
      ".sx-bar button{flex:0 0 auto;border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;color:#fff;" +
      "background:linear-gradient(135deg,var(--primary,#6d5dfb),var(--primary-dark,#5848e8))}" +
      "@keyframes sx-in{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}" +
      "@media(prefers-reduced-motion:reduce){.sx-bar{animation:none}}";
    document.head.appendChild(style);
  }

  function showBar(kind, title, html, buttonLabel) {
    injectStyles();
    if (!bar) {
      bar = document.createElement("div");
      bar.setAttribute("role", kind === "warn" ? "alertdialog" : "status");
      bar.setAttribute("aria-live", kind === "warn" ? "assertive" : "polite");
      document.body.appendChild(bar);
    }
    bar.className = "sx-bar " + kind;
    bar.innerHTML =
      "<div><b></b><span></span></div>" + (buttonLabel ? '<button type="button"></button>' : "");
    bar.querySelector("b").textContent = title;
    bar.querySelector("span").innerHTML = html; // only ever our own strings + a number
    if (buttonLabel) {
      const btn = bar.querySelector("button");
      btn.textContent = buttonLabel;
      btn.addEventListener("click", () => {
        touch(true);
        hideWarning();
      });
    }
  }

  function hideBar() {
    if (bar) {
      bar.remove();
      bar = null;
    }
  }

  function showWarning(seconds) {
    const text = "You'll be signed out in <em>" + Math.max(0, seconds) + "</em>s to keep your account safe.";
    if (!warning || !bar) {
      warning = true;
      showBar("warn", "Still there?", text, "Stay signed in");
    } else {
      const span = bar.querySelector("span");
      if (span) span.innerHTML = text;
    }
  }

  function hideWarning() {
    if (!warning) return;
    warning = false;
    hideBar();
  }

  /* ------------------------------------------------------------------------
     Sign-out
     ------------------------------------------------------------------------ */

  async function signOutNow(reason) {
    if (signingOut) return;
    signingOut = true;

    hideWarning();
    await flush();

    try {
      if (reason === "idle") sessionStorage.setItem(NOTICE_KEY, String(OPTIONS.IDLE_MINUTES));
    } catch (err) {
      /* ignore */
    }

    try {
      if (window.supabaseApp) await window.supabaseApp.auth.signOut();
    } catch (err) {
      console.warn("UniAI security: sign-out request failed.", err);
    }

    // sync.js clears the personal data and reloads on its own; this makes sure
    // in-memory state (open chats, drafts) is gone even if it doesn't.
    setTimeout(() => window.location.reload(), 700);
  }

  /** Manual "Sign out" buttons: upload pending changes first, then let the click through. */
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest && event.target.closest("#logout-btn, [data-settings-action='signout']");
      if (!button) return;

      if (button.dataset.sxPass) {
        delete button.dataset.sxPass;
        return; // our own replayed click
      }

      const s = sync();
      if (!s || !signedIn() || !s.status().pending.length) return; // nothing to protect

      event.preventDefault();
      event.stopImmediatePropagation();
      flush().finally(() => {
        button.dataset.sxPass = "1";
        button.click();
      });
    },
    true
  );

  /* ------------------------------------------------------------------------
     Idle loop
     ------------------------------------------------------------------------ */

  function check() {
    if (!OPTIONS.IDLE_MINUTES || signingOut) return;

    if (!signedIn()) {
      hideWarning();
      return;
    }

    const limit = OPTIONS.IDLE_MINUTES * 60000;
    const idle = Date.now() - lastActive();

    if (idle >= limit) {
      signOutNow("idle");
    } else if (idle >= limit - OPTIONS.WARN_SECONDS * 1000) {
      showWarning(Math.ceil((limit - idle) / 1000));
    } else {
      hideWarning();
    }
  }

  function loop() {
    check();
    setTimeout(loop, warning ? 1000 : 5000);
  }

  function onActivity(counts) {
    return () => {
      if (warning && !counts) return; // while warning, only deliberate input counts
      touch(warning);
      if (warning) hideWarning();
    };
  }

  function start() {
    // Fresh page load: by default the person is clearly here.
    if (!OPTIONS.LOGOUT_ON_RETURN) touch(true);

    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((name) =>
      window.addEventListener(name, onActivity(true), { passive: true, capture: true })
    );
    ["mousemove", "scroll"].forEach((name) =>
      window.addEventListener(name, onActivity(false), { passive: true, capture: true })
    );

    // Timers freeze while a laptop sleeps, so re-check the moment the tab wakes.
    // A tab coming back to the foreground (phone unlocked, laptop woken, browser
    // restoring a tab) means the person is here: count that as activity instead of
    // signing them out for time spent away. Real inactivity while the tab stays in
    // front of someone still triggers the idle timer. LOGOUT_ON_RETURN: true keeps
    // the strict behaviour for shared computers.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (!OPTIONS.LOGOUT_ON_RETURN && !warning) touch(true);
      check();
    });
    window.addEventListener("focus", () => {
      if (!OPTIONS.LOGOUT_ON_RETURN && !warning) touch(true);
      check();
    });

    // The notice left behind by an idle sign-out.
    try {
      const minutes = sessionStorage.getItem(NOTICE_KEY);
      if (minutes) {
        sessionStorage.removeItem(NOTICE_KEY);
        showBar("ok", "Signed out", "You were signed out after " + Number(minutes) + " minutes of inactivity.", "");
        setTimeout(() => {
          if (!warning) hideBar();
        }, 9000);
      }
    } catch (err) {
      /* ignore */
    }

    loop();
  }

  window.UniAISecurity = {
    options: OPTIONS,
    signOutNow: () => signOutNow("manual"),
    keepAlive: () => touch(true)
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  /* ------------------------------------------------------------------------
     IMPORTANT: this file is a safety net, not a security boundary.
     Anything running in the browser can be edited by the person using it.
     Real protection lives on the server: Supabase RLS policies and the
     response headers in security/rls.sql and security/server-headers.js.
     ------------------------------------------------------------------------ */
})();
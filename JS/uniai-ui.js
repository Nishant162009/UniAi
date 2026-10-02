/* ==========================================================================
   UniAI — shared UI helpers (uniai-ui.js)

   Load this BEFORE tracker.js and compare.js:
     <script src="JS/uniai-ui.js"></script>

   Provides window.UniAIUI:
     esc(text)                      HTML-escape
     toast(message, { action })     small bottom toast, optional action button
     confirm(message, opts)         uses your confirm card, honours Settings
     trapFocus(event, rootEl)       Tab-key focus trap for dialogs
     toDateKey(date) / parseDateKey(str) / daysUntil(str) / formatDate(str)
     slug(text)

   And the base styles every new feature shares (light + dark, independent of
   main.css so nothing depends on which CSS variables you defined there).
   ========================================================================== */

(function () {
  "use strict";

  if (window.UniAIUI) return;

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function slug(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const pad = (n) => String(n).padStart(2, "0");

  /** Date -> "YYYY-MM-DD" in the user's own timezone. */
  function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** "YYYY-MM-DD" -> local Date at midnight, or null if it isn't a real date. */
  function parseDateKey(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ""));
    if (!m) return null;

    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getFullYear() === Number(m[1]) &&
      d.getMonth() === Number(m[2]) - 1 &&
      d.getDate() === Number(m[3])
      ? d
      : null;
  }

  /** Whole days from today to the date (negative = already passed). */
  function daysUntil(str) {
    const d = parseDateKey(str);
    if (!d) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d - today) / 86400000);
  }

  function formatDate(str) {
    const d = parseDateKey(str);
    return d
      ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
      : "";
  }

  /* ------------------------------------------------------------------------
     Styles
     ------------------------------------------------------------------------ */

  function ensureStyles() {
    if (document.getElementById("uai-base-css")) return;

    const style = document.createElement("style");
    style.id = "uai-base-css";
    style.textContent = `
:root{--uai-bg:#fff;--uai-panel:#f6f7fc;--uai-border:#e2e6f1;--uai-text:#0f172a;--uai-muted:#64748b;--uai-primary:#6d5dfb;--uai-primary-soft:rgba(109,93,251,.1);--uai-good:#10b981;--uai-warn:#f59e0b;--uai-bad:#ef4444;--uai-shadow:0 20px 60px rgba(15,23,42,.2)}
html[data-theme="dark"]{--uai-bg:#151a2e;--uai-panel:#1b2138;--uai-border:#2b3350;--uai-text:#e8ebf6;--uai-muted:#8e97b5;--uai-primary:#8b7bff;--uai-primary-soft:rgba(139,123,255,.15);--uai-shadow:0 20px 60px rgba(0,0,0,.6)}

.uai-overlay{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,10,22,.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:uaiFade .2s ease}
.uai-overlay[hidden]{display:none}
@keyframes uaiFade{from{opacity:0}to{opacity:1}}
@keyframes uaiRise{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
.uai-dialog{position:relative;display:flex;flex-direction:column;width:min(720px,100%);max-height:min(88vh,860px);overflow:hidden;border:1px solid var(--uai-border);border-radius:22px;background:var(--uai-bg);color:var(--uai-text);box-shadow:var(--uai-shadow);animation:uaiRise .25s cubic-bezier(.2,.8,.2,1)}
.uai-dialog.wide{width:min(1100px,100%)}
.uai-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 26px 14px}
.uai-dialog-head h2{margin:0;font-size:1.25rem;letter-spacing:-.02em}
.uai-dialog-head p{margin:4px 0 0;color:var(--uai-muted);font-size:.85rem}
.uai-dialog-body{padding:6px 26px 20px;overflow:auto}
.uai-dialog-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px 26px;border-top:1px solid var(--uai-border);background:var(--uai-panel)}
.uai-dialog-foot .grow{flex:1}
.uai-x{flex:0 0 auto;width:36px;height:36px;border:1px solid var(--uai-border);border-radius:11px;background:transparent;color:var(--uai-muted);font-size:20px;line-height:1;cursor:pointer}
.uai-x:hover{color:var(--uai-text);border-color:var(--uai-primary)}

.uai-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:0 15px;border:1px solid var(--uai-border);border-radius:11px;background:var(--uai-bg);color:var(--uai-text);font:inherit;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,transform .15s,opacity .15s}
.uai-btn:hover{border-color:var(--uai-primary);color:var(--uai-primary)}
.uai-btn.primary{border-color:transparent;background:linear-gradient(120deg,#6d5dfb,#8b5cf6);color:#fff}
.uai-btn.primary:hover{color:#fff;transform:translateY(-1px);filter:brightness(1.06)}
.uai-btn.danger:hover{border-color:var(--uai-bad);color:var(--uai-bad)}
.uai-btn.small{min-height:30px;padding:0 10px;border-radius:9px;font-size:.78rem}
.uai-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.uai-btn:focus-visible,.uai-x:focus-visible,.uai-input:focus-visible{outline:2px solid var(--uai-primary);outline-offset:2px}

.uai-field{display:flex;flex-direction:column;gap:6px;margin-top:14px}
.uai-field>label,.uai-label{font-size:.7rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--uai-muted)}
.uai-input{width:100%;box-sizing:border-box;min-height:40px;padding:9px 12px;border:1px solid var(--uai-border);border-radius:11px;background:var(--uai-bg);color:var(--uai-text);font:inherit;font-size:.9rem}
textarea.uai-input{min-height:78px;resize:vertical}
.uai-input:focus{border-color:var(--uai-primary);outline:none;box-shadow:0 0 0 3px var(--uai-primary-soft)}
.uai-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}

.uai-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;border:1px solid var(--uai-border);font-size:.72rem;font-weight:700;color:var(--uai-muted);white-space:nowrap}
.uai-pill.good{color:var(--uai-good);border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.1)}
.uai-pill.warn{color:var(--uai-warn);border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.1)}
.uai-pill.bad{color:var(--uai-bad);border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.1)}

.uai-toast{position:fixed;left:50%;bottom:26px;z-index:100001;display:flex;align-items:center;gap:14px;max-width:min(440px,calc(100vw - 28px));padding:12px 16px;border-radius:14px;background:#0f172a;color:#f8fafc;font-size:.88rem;box-shadow:0 14px 40px rgba(0,0,0,.35);opacity:0;transform:translate(-50%,16px);transition:opacity .2s,transform .2s;pointer-events:none}
.uai-toast.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.uai-toast button{font:inherit;font-weight:700;padding:2px 6px;border:0;background:none;color:#a5b4fc;cursor:pointer}

@media (prefers-reduced-motion:reduce){.uai-overlay,.uai-dialog{animation:none}.uai-toast{transition:none}}
`;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------------ */

  let toastTimer = null;

  function toast(message, opts = {}) {
    ensureStyles();

    let box = document.getElementById("uai-toast");

    if (!box) {
      box = document.createElement("div");
      box.id = "uai-toast";
      box.className = "uai-toast";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }

    box.textContent = "";

    const span = document.createElement("span");
    span.textContent = message;
    box.appendChild(span);

    if (opts.action && opts.action.label) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opts.action.label;
      btn.addEventListener("click", () => {
        box.classList.remove("show");
        if (typeof opts.action.onClick === "function") opts.action.onClick();
      });
      box.appendChild(btn);
    }

    box.classList.remove("show");
    void box.offsetWidth; // restart the transition
    box.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), opts.ms || (opts.action ? 5000 : 2600));
  }

  /* ------------------------------------------------------------------------
     Confirm (your card, honouring "Confirm destructive actions")
     ------------------------------------------------------------------------ */

  async function confirm(message, opts = {}) {
    const settings = window.UniAISettings;
    const needed = opts.force || !settings || settings.is("confirmActions");

    if (!needed) return true;

    if (typeof window.showConfirmCard === "function") {
      return window.showConfirmCard(message, opts);
    }

    return window.confirm(message);
  }

  /* ------------------------------------------------------------------------
     Focus trap for dialogs
     ------------------------------------------------------------------------ */

  function trapFocus(event, root) {
    if (event.key !== "Tab" || !root) return;

    const focusable = Array.from(
      root.querySelectorAll(
        "button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])"
      )
    ).filter((el) => !el.disabled && el.offsetParent !== null);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  window.UniAIUI = {
    esc,
    slug,
    toast,
    confirm,
    trapFocus,
    ensureStyles,
    toDateKey,
    parseDateKey,
    daysUntil,
    formatDate
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureStyles, { once: true });
  } else {
    ensureStyles();
  }
})();
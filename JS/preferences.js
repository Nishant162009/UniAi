/* ==========================================================================
   UniAI — Study Identity / Preferences  (preferences.js)
   --------------------------------------------------------------------------
   6-step onboarding that personalizes the site.

   Load AFTER script.js and scholarship.js:
     <script src="JS/preferences.js"></script>

   Storage
     localStorage["uniai-preferences"]        this browser's copy
     localStorage["uniai-preferences-owner"]  which account that copy belongs to
     Supabase user_metadata.preferences        the account's copy (newest wins)

   Scholarships are personalized by COUNTRY only (first chosen destination),
   once, and never over something the user typed.
   ========================================================================== */

"use strict";

(function () {

  /* ------------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------------ */

  const STORAGE_KEY = "uniai-preferences";
  const OWNER_KEY = "uniai-preferences-owner";
  const DRAFT_KEY = "uniai-preferences-draft"; // sessionStorage: half-finished form
  const PROMPTED_KEY = "uniai-preferences-prompted"; // sessionStorage: auto-open guard
  const DISMISS_PREFIX = "uniai-preferences-dismissed:"; // localStorage + user id
  const DISMISS_DAYS = 3;

  const TOTAL_STEPS = 6;
  const UNSURE = "Not sure yet";

  const CURRENCY_SYMBOLS = {
    USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$", INR: "₹", JPY: "¥"
  };

  /* ------------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------------ */

  const byId = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function readJSON(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeJSON(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("UniAI: could not write", key, err);
    }
  }

  function removeKey(storage, key) {
    try {
      storage.removeItem(key);
    } catch (err) {
      /* ignore */
    }
  }

  const realCountries = (prefs) =>
    (prefs && Array.isArray(prefs.countries) ? prefs.countries : []).filter(
      (c) => c && c !== UNSURE
    );

  /* ------------------------------------------------------------------------
     Normalize
     ------------------------------------------------------------------------ */

  function normalizePrefs(prefs) {
    prefs = prefs || {};

    const countries = Array.isArray(prefs.countries)
      ? prefs.countries
      : prefs.country
      ? [prefs.country]
      : [];

    return {
      degree: prefs.degree || "",
      field: String(prefs.field || "").slice(0, 120),

      countries: [...new Set(countries.filter((c) => typeof c === "string" && c))],

      intake: prefs.intake || "",

      academic: {
        gpa: prefs.academic?.gpa ?? "",
        gradingScale: prefs.academic?.gradingScale ?? "",
        graduationYear: prefs.academic?.graduationYear ?? ""
      },

      budget: {
        tuitionPerYear: prefs.budget?.tuitionPerYear ?? "",
        livingPerYear: prefs.budget?.livingPerYear ?? "",
        currency: prefs.budget?.currency || "USD",
        needsScholarship: Boolean(prefs.budget?.needsScholarship),
        needsLoan: Boolean(prefs.budget?.needsLoan)
      },

      tests: {
        ielts: prefs.tests?.ielts ?? "",
        toefl: prefs.tests?.toefl ?? "",
        gre: prefs.tests?.gre ?? "",
        gmat: prefs.tests?.gmat ?? ""
      },

      university: {
        type: prefs.university?.type || "Any",
        studyMode: prefs.university?.studyMode || "On-campus",
        focus: prefs.university?.focus || "Any"
      },

      ai: {
        priority: prefs.ai?.priority || "balanced",
        guidance: prefs.ai?.guidance ?? true
      },

      notifications: {
        scholarships: prefs.notifications?.scholarships ?? true,
        deadlines: prefs.notifications?.deadlines ?? true,
        universityMatches: prefs.notifications?.universityMatches ?? true,
        visa: prefs.notifications?.visa ?? true
      },

      // Used to decide which copy (this browser / the account) is newest.
      updatedAt: Number(prefs.updatedAt) || 0
    };
  }

  /* ------------------------------------------------------------------------
     Storage: this browser + the account
     ------------------------------------------------------------------------ */

  function readPrefs() {
    const raw = readJSON(localStorage, STORAGE_KEY);
    return raw ? normalizePrefs(raw) : null;
  }

  const readOwner = () => {
    try {
      return localStorage.getItem(OWNER_KEY);
    } catch (err) {
      return null;
    }
  };

  function writePrefsLocal(prefs, ownerId) {
    writeJSON(localStorage, STORAGE_KEY, prefs);
    if (ownerId) {
      try {
        localStorage.setItem(OWNER_KEY, ownerId);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function clearLocal() {
    removeKey(localStorage, STORAGE_KEY);
    removeKey(localStorage, OWNER_KEY);
    removeKey(sessionStorage, DRAFT_KEY);
  }

  function prefsFromSession(session) {
    const meta = session && session.user && session.user.user_metadata;
    return (meta && meta.preferences) || null;
  }

  /** Returns true when the account copy was saved. Never throws. */
  async function writePrefsToAccount(prefs) {
    const db = window.supabaseApp;
    if (!db) return false;

    try {
      const { error } = await db.auth.updateUser({ data: { preferences: prefs } });
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn("UniAI: could not sync preferences to your account.", err);
      return false;
    }
  }

  const currentUserId = () => {
    try {
      return (
        (window.supabaseApp && readOwner()) || null
      );
    } catch (err) {
      return null;
    }
  };

  /* ------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------ */

  let lastAppliedJSON = "";

  window.UniAIPreferences = {
    get() {
      return readPrefs();
    },

    async set(prefs) {
      const normalized = normalizePrefs(prefs);
      normalized.updatedAt = Date.now();

      writePrefsLocal(normalized, currentUserId());
      removeKey(sessionStorage, DRAFT_KEY);

      const synced = await writePrefsToAccount(normalized);

      commitPrefs(normalized, { resetFlags: true });

      return Object.assign({}, normalized, { __synced: synced });
    },

    async clear() {
      clearLocal();
      resetPersonalization();
      lastAppliedJSON = "";

      await writePrefsToAccount(null);

      window.dispatchEvent(new CustomEvent("uniai:preferences", { detail: null }));
    },

    open() {
      openPrefsModal();
    }
  };

  /* ------------------------------------------------------------------------
     Uni Buddy: the mascot (2.5D SVG, springs, gestures) + the conversation
     ------------------------------------------------------------------------ */

  const BUDDY_SVG = `<svg id="buddy" viewBox="0 0 300 520" role="img" aria-label="Uni Buddy, the UniAI Explorer">
   <defs>
    <linearGradient id="ub-fin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c4df2"/><stop offset="1" stop-color="#4a56f0"/></linearGradient>
    <linearGradient id="ub-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f6fe"/><stop offset="1" stop-color="#d6d0f0"/></linearGradient>
    <linearGradient id="ub-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfaff"/><stop offset="1" stop-color="#d7d3ee"/></linearGradient>
    <linearGradient id="ub-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14122e"/><stop offset=".62" stop-color="#14122e"/><stop offset="1" stop-color="#4b3fb5"/></linearGradient>
    <g id="ub-shoe"><path d="M0 0h42q16 0 16 20v10H-6v-12q0-18 6-18z" fill="#f4f2fb"/><path d="M-6 22h64v8H-6z" fill="#5b4bf0"/><path d="M12 6q18-5 34 6" stroke="#4a56f0" stroke-width="6" fill="none" stroke-linecap="round"/></g>
   </defs>
   <ellipse cx="150" cy="508" rx="88" ry="10" fill="#000" opacity=".2"/>
   <g id="body">
    <rect x="100" y="386" width="36" height="86" rx="14" fill="#1d1b45"/><rect x="164" y="386" width="36" height="86" rx="14" fill="#1d1b45"/>
    <rect x="104" y="410" width="18" height="22" rx="5" fill="#2a2860"/><rect x="178" y="410" width="18" height="22" rx="5" fill="#2a2860"/>
    <use href="#ub-shoe" x="92" y="468"/><use href="#ub-shoe" x="156" y="468"/>
    <rect x="86" y="272" width="42" height="104" rx="16" fill="#25234f"/><rect x="172" y="272" width="42" height="104" rx="16" fill="#25234f"/>
    <rect x="78" y="262" width="18" height="48" rx="7" fill="#2fbf9f"/><rect x="78" y="262" width="18" height="11" rx="4" fill="#1f8f78"/>
    <path d="M106 292Q106 270 130 268H170Q194 270 194 292L198 394Q150 410 102 394Z" fill="url(#ub-hood)"/>
    <path d="M102 384Q150 400 198 384V394Q150 410 102 394Z" fill="#1d1b45"/>
    <path d="M118 360H182l4 24H114z" fill="#e2deF4" opacity=".9"/>
    <path d="M150 292V388" stroke="#c9c4e6" stroke-width="2"/>
    <path d="M110 274Q150 306 190 274L184 258Q150 288 116 258z" fill="#4b3fb5"/>
    <path d="M136 322l14-8 14 8-14 8z" fill="#4a56f0"/><path d="M141 328v8a9 9 0 0 0 18 0v-8" fill="none" stroke="#4a56f0" stroke-width="3.4" stroke-linecap="round"/>
    <g id="armL"><path d="M112 282Q84 312 100 350" fill="none" stroke="#ece9f8" stroke-width="26" stroke-linecap="round"/><circle cx="101" cy="352" r="12" fill="#f3e3ea"/></g>
    <rect x="198" y="326" width="24" height="46" rx="4" transform="rotate(10 210 350)" fill="#2a2850"/>
    <g id="armR"><path d="M188 282Q216 312 204 352" fill="none" stroke="#ece9f8" stroke-width="26" stroke-linecap="round"/><circle cx="205" cy="354" r="12" fill="#f3e3ea"/></g>
   </g>
   <g id="head">
    <g id="fin">
     <path d="M120 190C76 186 44 152 32 100C88 106 130 132 152 166z" fill="url(#ub-fin)"/>
     <path d="M180 190C224 186 256 152 268 100C212 106 170 132 148 166z" fill="url(#ub-fin)"/>
     <path d="M126 194C96 194 70 180 54 156C90 162 122 168 142 182z" fill="#2fbf9f" opacity=".8"/>
     <path d="M174 194C204 194 230 180 246 156C210 162 178 168 158 182z" fill="#2fbf9f" opacity=".8"/>
    </g>
    <ellipse id="facebase" cx="150" cy="208" rx="72" ry="60" fill="url(#ub-face)"/>
    <path d="M78 206C76 150 112 140 150 140S224 150 222 206C200 170 100 170 78 206z" fill="url(#ub-fin)"/>
    <g id="track"><g transform="translate(150 208)">
     <ellipse cx="-46" cy="22" rx="11" ry="7" fill="#ec4899" opacity=".3"/><ellipse cx="46" cy="22" rx="11" ry="7" fill="#ec4899" opacity=".3"/>
     <g id="eyes" class="ub-eyes">
      <g id="eyeL" transform="translate(-29 0)"><ellipse class="iris" rx="13" ry="16" fill="url(#ub-iris)"/><circle class="hl" cx="-4" cy="-6" r="4.2" fill="#fff"/><circle class="hl" cx="5" cy="6" r="2" fill="#fff" opacity=".85"/><path class="eyearc" d="M-10 3Q0 -9 10 3" fill="none" stroke="#14122e" stroke-width="4.5" stroke-linecap="round" display="none"/></g>
      <g id="eyeR" transform="translate(29 0)"><ellipse class="iris" rx="13" ry="16" fill="url(#ub-iris)"/><circle class="hl" cx="-4" cy="-6" r="4.2" fill="#fff"/><circle class="hl" cx="5" cy="6" r="2" fill="#fff" opacity=".85"/><path class="eyearc" d="M-10 3Q0 -9 10 3" fill="none" stroke="#14122e" stroke-width="4.5" stroke-linecap="round" display="none"/></g>
     </g>
     <g transform="translate(0 32)"><g id="mouthg"><path id="mouth" d="M-11 -1Q0 3 11 -1Q9 13 0 13Q-9 13 -11 -1Z" fill="#2a1030" stroke="#14122e" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><ellipse id="tongue" cx="0" cy="10" rx="5" ry="3.2" fill="#ec4899"/></g></g>
    </g></g>
   </g>
  </svg>`;

  // Shared with Uni Buddy (uni-buddy.js): the full body, and a head-only crop for avatars.
  window.UniAIBuddyMascotSVG = BUDDY_SVG;
  window.UniAIBuddyHeadSVG = BUDDY_SVG
    .replace('viewBox="0 0 300 520"', 'viewBox="22 84 256 200"')
    .replace(' role="img" aria-label="Uni Buddy, the UniAI Explorer"', ' aria-hidden="true" focusable="false"')
    .replace(/ id="(?!ub-)[^"]*"/g, "");

  const MODAL_HTML = `<div class="ob-stage"><div class="ob-buddy" id="buddy-wrap">${BUDDY_SVG}</div><span id="mood-name" hidden></span><button type="button" id="t-talk" hidden tabindex="-1"></button></div><section class="ob-panel" role="dialog" aria-modal="true" aria-labelledby="prefs-title"><header class="ob-head"><div><h2 id="prefs-title">Build your <span>study future.</span></h2><small id="ob-step"></small></div><button type="button" class="ob-close" id="prefs-close" aria-label="Close">×</button></header><div class="ob-bar"><i id="ob-bar"></i></div><div class="ob-thread" id="ob-thread" aria-live="polite"></div><div class="ob-dock" id="ob-dock"></div></section>`;

  const MODAL_CSS = `.uniai-profile-overlay{position:fixed;inset:0;z-index:99999;display:grid;grid-template-columns:minmax(300px,46%) 1fr;color:var(--text,#f5f7fa);font-family:var(--font-body,Inter,system-ui,sans-serif);background:radial-gradient(circle at 25% 35%,rgba(124,58,237,.3),transparent 55%),var(--bg,#0b0c10);animation:obIn .35s ease}
.uniai-profile-overlay[hidden]{display:none}
@keyframes obIn{from{opacity:0}}
.ob-stage{position:relative;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;padding:18px 18px 0}
.ob-stage:before{content:"";position:absolute;bottom:4%;width:min(560px,92%);aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,rgba(139,92,246,.5),rgba(236,72,153,.14) 62%,transparent)}
.ob-buddy{position:relative;height:min(92vh,880px);aspect-ratio:300/520;max-width:100%;animation:obFloat 5s ease-in-out infinite;filter:drop-shadow(0 20px 36px rgba(139,92,246,.42))}
.ob-buddy svg{display:block;width:100%;height:100%;overflow:visible}
@keyframes obFloat{50%{transform:translateY(-8px)}}
.ob-buddy #head{transform-origin:150px 250px}.ob-buddy #body{transform-origin:150px 400px}.ob-buddy #armL{transform-origin:112px 284px}.ob-buddy #armR{transform-origin:188px 284px}
.ob-buddy #fin{transform-origin:150px 180px}.ob-buddy #facebase,.ob-buddy #track{transform-origin:150px 208px}.ob-buddy #eyes{transform-box:fill-box;transform-origin:center}
.ob-buddy .eyearc{display:none;fill:none;stroke:#14122e;stroke-width:4.5;stroke-linecap:round}
.ob-buddy .shut .eyearc{display:block}.ob-buddy .shut .iris,.ob-buddy .shut .hl{display:none}
.ob-buddy #mouth{fill:none;stroke:#14122e;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}.ob-buddy #mouth.fill{fill:#2a1030}
.ob-buddy #mouthg{transform-box:fill-box;transform-origin:center top}
.ob-buddy.talking #mouthg{animation:obFlap .24s ease-in-out infinite alternate}
@keyframes obFlap{to{transform:scaleY(.55)}}
.ob-panel{display:flex;flex-direction:column;min-width:0;min-height:0;border-left:1px solid var(--border,#282c34);background:var(--card-bg,#17191f)}
.ob-head{display:flex;align-items:center;gap:12px;padding:18px 24px;border-bottom:1px solid var(--border,#282c34)}
.ob-head h2{margin:0;font:800 1.2rem var(--font-display,system-ui,sans-serif);letter-spacing:-.02em}
.ob-head h2 span{background:linear-gradient(90deg,var(--primary,#8b5cf6),var(--pink,#ec4899));-webkit-background-clip:text;background-clip:text;color:transparent}
.ob-head small{display:block;margin-top:3px;color:var(--text-muted,#9da3ae);font-size:.75rem}
.ob-close{margin-left:auto;flex:0 0 44px;width:44px;height:44px;border:1px solid var(--border,#282c34);border-radius:12px;background:transparent;color:var(--text-muted,#9da3ae);font-size:24px;cursor:pointer}
.ob-close:hover{color:var(--text,#fff);border-color:var(--primary,#8b5cf6)}
.ob-bar{height:4px;background:var(--border,#282c34)}.ob-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--primary,#8b5cf6),var(--pink,#ec4899));transition:width .45s ease}
.ob-thread{flex:1;min-height:0;overflow-y:auto;padding:22px 24px;display:flex;flex-direction:column;gap:12px}
.ob-msg{max-width:86%;padding:12px 15px;border-radius:16px;font-size:.95rem;line-height:1.5;overflow-wrap:anywhere;animation:obMsg .3s both}
@keyframes obMsg{from{opacity:0;transform:translateY(8px)}}
.ob-msg.buddy{background:var(--surface-3,#1d2027);border:1px solid var(--border,#282c34);border-top-left-radius:5px}
.ob-msg.you{align-self:flex-end;background:linear-gradient(135deg,var(--primary,#8b5cf6),var(--primary-dark,#7c3aed));color:#fff;border-top-right-radius:5px}
.ob-dock{max-height:48vh;overflow-y:auto;padding:16px 24px calc(16px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border,#282c34)}
.ob-ctl{margin-bottom:12px}.ob-lab{display:block;margin-bottom:6px;color:var(--text-muted,#9da3ae);font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.ob-row{display:flex;flex-wrap:wrap;gap:8px}
.ob-opt{min-height:44px;padding:0 15px;border:1px solid var(--border,#282c34);border-radius:14px;background:var(--surface-2,#17191f);color:var(--text,#f5f7fa);font:600 .88rem inherit;cursor:pointer;transition:.15s}
.ob-opt:hover{border-color:var(--primary,#8b5cf6)}.ob-opt.on{background:var(--violet-light,#241c3d);border-color:var(--primary,#8b5cf6);color:var(--primary,#a78bfa)}
.ob-in,.ob-sel{width:100%;min-height:46px;padding:0 14px;border:1px solid var(--border,#282c34);border-radius:12px;background:var(--bg,#0b0c10);color:var(--text,#f5f7fa);font-size:16px;outline:none}
.ob-in:focus,.ob-sel:focus{border-color:var(--primary,#8b5cf6)}
.ob-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.ob-range{display:flex;align-items:center;gap:12px}.ob-range input{flex:1;accent-color:var(--primary,#8b5cf6)}.ob-range b{min-width:96px;text-align:right;font:800 1.1rem var(--font-display,system-ui,sans-serif)}
.ob-sum{padding:14px;border:1px solid var(--border,#282c34);border-radius:14px;background:var(--violet-light,#241c3d);line-height:1.6;font-size:.92rem;margin-bottom:12px}
.ob-err{min-height:1.2em;margin:0 0 8px;color:#fb7185;font-size:.82rem}
.ob-nav{display:flex;align-items:center;gap:10px}
.ob-go,.ob-ghost{min-height:46px;padding:0 20px;border-radius:12px;font-weight:700;cursor:pointer}
.ob-go{margin-left:auto;border:0;color:#fff;background:linear-gradient(135deg,var(--primary,#8b5cf6),var(--pink,#ec4899))}.ob-go:disabled{opacity:.5;cursor:not-allowed}
.ob-ghost{border:1px solid var(--border,#282c34);background:transparent;color:var(--text-muted,#9da3ae)}.ob-ghost.skip{border:0;margin-left:auto}.ob-ghost.skip+.ob-go{margin-left:0}
.uniai-profile-overlay :focus-visible{outline:2px solid var(--pink,#ec4899);outline-offset:2px}
.uniai-profile-toast{position:fixed;left:50%;bottom:28px;z-index:100000;display:flex;align-items:center;gap:12px;max-width:min(420px,calc(100vw - 32px));padding:14px 18px;border:1px solid rgba(167,139,250,.35);border-radius:16px;background:rgba(15,17,32,.96);color:#f7f7fb;box-shadow:0 18px 50px rgba(0,0,0,.5);opacity:0;transform:translate(-50%,16px);transition:opacity .25s,transform .25s;pointer-events:none}
.uniai-profile-toast.show{opacity:1;transform:translate(-50%,0)}.uniai-profile-toast.warn{border-color:rgba(251,191,36,.45)}
.uniai-profile-toast>span{color:#a78bfa;font-size:18px}.uniai-profile-toast.warn>span{color:#fbbf24}
.uniai-profile-toast strong,.uniai-profile-toast small{display:block}.uniai-profile-toast strong{font-size:13px}.uniai-profile-toast small{margin-top:2px;color:#8e93a8;font-size:11px}
@media (max-width:820px){
 .uniai-profile-overlay{grid-template-columns:1fr;grid-template-rows:minmax(170px,40vh) minmax(0,1fr)}
 .ob-stage{padding:6px 12px 0}.ob-stage:before{width:80%;bottom:0}
 .ob-buddy{height:100%}
 .ob-panel{border-left:0;border-top:1px solid var(--border,#282c34);border-radius:22px 22px 0 0;margin-top:-14px;position:relative}
 .ob-head{padding:12px 16px}.ob-head h2{font-size:1.02rem}
 .ob-thread{padding:14px 16px}.ob-msg{max-width:92%;font-size:.92rem}
 .ob-dock{max-height:50vh;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px))}
}
@media (prefers-reduced-motion:reduce){.uniai-profile-overlay,.ob-buddy,.ob-msg,.ob-bar i{animation:none!important;transition:none!important}}
`;

  /** Builds the mascot engine once the SVG is in the page. Everything is scoped to the overlay. */
  function initBuddy() {
    const root = byId("prefs-overlay");
    const $ = (s) => root.querySelector(s);
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const syncMinis = () => {};

/* ================= MASCOT (2.5D) ================= */
const UP = "M-10 3Q0 -9 10 3", DOWN = "M-10 -3Q0 7 10 -3";
const M = {grin: "M-11 -1Q0 3 11 -1Q9 13 0 13Q-9 13 -11 -1Z", big: "M-13 -2Q0 4 13 -2Q11 17 0 17Q-11 17 -13 -2Z", o: "M-5 0a5 6 0 1 0 10 0a5 6 0 1 0 -10 0Z",
  hm: "M-6 3Q0 0 7 -1", flat: "M-5 3Q0 5 5 3", frown: "M-8 5Q0 -3 8 5", smirk: "M-9 1Q0 9 11 -2", tiny: "M-6 1Q0 5 6 1"};
const op = {k: "open"}, ar = d => ({k: "arc", arc: d});
const EXPR = {              // eye: per-eye shape, mouth: path, f: filled mouth, t: tongue
  happy:    {eye: [op, op], mouth: M.grin, f: 1, t: 1},
  curious:  {eye: [op, {k: "open", sx: 1.08, sy: 1.12, y: -2}], mouth: M.tiny},
  thinking: {eye: [{k: "open", sy: .72, y: 2}, {k: "open", sy: .72, y: -1}], mouth: M.hm},
  excited:  {eye: [ar(UP), ar(UP)], mouth: M.big, f: 1, t: 1},
  surprised:{eye: [{k: "open", sx: 1.12, sy: 1.2}, {k: "open", sx: 1.12, sy: 1.2}], mouth: M.o, f: 1},
  playful:  {eye: [op, ar(UP)], mouth: M.smirk},
  sleepy:   {eye: [ar(DOWN), ar(DOWN)], mouth: M.flat},
  oops:     {eye: [{k: "open", sx: .92, r: 10}, {k: "open", sx: .92, r: -10}], mouth: M.frown}
};
const REST = {curious: {roll: 7, yaw: .2}, thinking: {yaw: .45, pitch: -.35, roll: -3}, surprised: {pitch: -.2}, playful: {roll: 6}, sleepy: {pitch: .5, roll: 7}, oops: {pitch: .15}};
const MOOD_GESTURE = {happy: "hop", curious: "tilt", thinking: "think", excited: "hop", surprised: "gasp", playful: "tilt", sleepy: "droop", oops: "shake"};
let mood = "happy", booted = false, follow = true, manual = null, busy = false, gid = 0;
const ptr = {x: 0, y: 0}, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);

/* Spring channels [stiffness, damping]. Eyes are stiff (they lead), the ears are soft (they trail),
   and damping is slightly low so every move overshoots and settles like a real object. */
const CH = {yaw: [150, 15], pitch: [150, 15], roll: [170, 16], hop: [220, 13], eyeYaw: [300, 22], eyePitch: [300, 22], earYaw: [80, 10], gx: [420, 30], gy: [420, 30]};
const P = {}, V = {}, T = {};
Object.keys(CH).forEach(k => { P[k] = V[k] = T[k] = 0; });
let raf = 0, last = 0;

function go(t) {
  Object.assign(T, t);
  if (reduce) { T.eyeYaw = T.earYaw = T.yaw; T.eyePitch = T.pitch; Object.assign(P, T); draw(); return; }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
}
function tick(now) {
  const dt = Math.min(.032, (now - last) / 1000); last = now;
  T.eyeYaw = T.earYaw = T.yaw; T.eyePitch = T.pitch;
  let moving = false;
  for (const k in CH) {
    V[k] += ((T[k] - P[k]) * CH[k][0] - V[k] * CH[k][1]) * dt; P[k] += V[k] * dt;
    if (Math.abs(T[k] - P[k]) > .003 || Math.abs(V[k]) > .01) moving = true;
  }
  draw();
  if (moving) raf = requestAnimationFrame(tick); else { raf = 0; syncMinis(); }
}

/* Each layer moves by a different amount with the head turn: that parallax is what reads as 3D. */
function draw() {
  const y = P.yaw, ey = P.eyeYaw, ay = P.earYaw, a = Math.abs;
  const set = (id, t) => { $("#" + id).style.transform = t; };
  set("head", `translate(${y * 4}px,${P.hop + P.pitch * 2}px) rotate(${P.roll}deg)`);
  set("body", `translate(${-y * 3}px,${P.hop * .25}px)`);
  set("armL", `rotate(${P.hop * .6}deg)`); set("armR", `rotate(${-P.hop * .6}deg)`);
  set("fin", `translateX(${-y * 7}px) rotate(${-ay * 5}deg)`);          // fin trails behind the turn
  set("facebase", `translateX(${y * 5}px) scaleX(${1 - a(y) * .06})`);
  set("track", `translate(${ey * 18 + P.gx}px,${P.eyePitch * 7 + P.gy}px) scaleX(${1 - a(ey) * .24})`); // face features lead
}

function applyRest() {
  if (busy) return;
  const r = REST[mood] || {};
  go({yaw: manual != null ? manual : clamp((r.yaw || 0) + (follow ? ptr.x * .55 : 0), -1, 1),
      pitch: (r.pitch || 0) + (follow ? ptr.y * .4 : 0), roll: r.roll || 0, hop: 0});
}

/* gestures: anticipation -> overshoot -> settle. A new gesture cancels the previous one. */
async function seq(steps) {
  const id = ++gid; busy = true;
  for (const [t, ms] of steps) { if (id !== gid) return; go(t); await sleep(reduce ? 0 : ms); }
  if (id === gid) { busy = false; applyRest(); }
}
const G = {
  nod:   () => seq([[{pitch: .7}, 130], [{pitch: -.1}, 120], [{pitch: .6}, 120], [{pitch: 0}, 160]]),
  shake: () => seq([[{yaw: .3}, 70], [{yaw: -.9}, 150], [{yaw: .8}, 150], [{yaw: -.6}, 130], [{yaw: .35}, 120], [{yaw: 0}, 150]]),
  hop:   () => seq([[{hop: 5, roll: -3}, 90], [{hop: -14, roll: 4}, 170], [{hop: 0, roll: 0}, 260]]),
  tilt:  () => seq([[{roll: 9, yaw: .3}, 500]]),
  think: () => seq([[{pitch: -.5, yaw: .55, roll: -3}, 700]]),
  gasp:  () => seq([[{pitch: .3, hop: 2}, 70], [{pitch: -.35, hop: -9}, 180], [{hop: 0}, 200]]),
  droop: () => seq([[{pitch: .7, roll: 8}, 700]]),
  lookL: () => seq([[{yaw: -.85}, 800]]),
  lookR: () => seq([[{yaw: .85}, 800]])
};

function setMood(name, opt) {
  if (!EXPR[name]) return;
  mood = name;
  const m = EXPR[name];
  const swap = () => {
    ["L", "R"].forEach((k, i) => {
      const e = m.eye[i], g = $("#eye" + k);
      g.setAttribute("transform", `translate(${i ? 29 : -29} ${e.y || 0}) rotate(${e.r || 0}) scale(${e.sx || 1} ${e.sy || 1})`);
      g.classList.toggle("shut", e.k === "arc");
      if (e.arc) g.querySelector(".eyearc").setAttribute("d", e.arc);
    });
    const mo = $("#mouth"); mo.setAttribute("d", m.mouth); mo.classList.toggle("fill", !!m.f);
    $("#tongue").style.opacity = m.t ? 1 : 0;
  };
  $("#mood-name").textContent = name;
  document.querySelectorAll("#expr-row .pill").forEach(b => {
    const on = b.dataset.mood === name; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
  });
  if (!booted || reduce) swap();
  else {                       // close -> swap while shut -> reopen with a little squash and stretch
    $("#eyes").animate([{transform: "scaleY(1)"}, {transform: "scaleY(.1)", offset: .25}, {transform: "scaleY(1.2) scaleX(.94)", offset: .7}, {transform: "scaleY(1)"}], {duration: 320, easing: "ease-out"});
    setTimeout(swap, 80);
  }
  if (booted && !(opt && opt.quiet)) G[MOOD_GESTURE[name]] ? G[MOOD_GESTURE[name]]() : applyRest();
  else applyRest();
  booted = true; syncMinis();
}

let talkTimer = 0;
function setTalking(on) {
  $("#buddy-wrap").classList.toggle("talking", on);
  const b = $("#t-talk"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
  clearInterval(talkTimer);
  if (on && !reduce) talkTimer = setInterval(() => { if (!busy) go({pitch: (REST[mood] || {}).pitch + rnd(-.12, .12) || rnd(-.12, .12), hop: -rnd(0, 2.5)}); }, 380);
  else applyRest();
}


    let loopId = 0;
    function runLoops() {
      const id = ++loopId;
      if (reduce) return;
      (function blink() {
        if (id !== loopId) return;
        if (!EXPR[mood].eye.some((e) => e.k === "arc")) $("#eyes").animate([{transform: "scaleY(1)"}, {transform: "scaleY(.08)"}, {transform: "scaleY(1)"}], {duration: 140});
        setTimeout(blink, 2600 + Math.random() * 3200);
      })();
      (function dart() {
        if (id !== loopId) return;
        if (!busy) go({gx: rnd(-5, 5), gy: rnd(-3, 3)});
        setTimeout(dart, 1800 + Math.random() * 2400);
      })();
    }
    const stopLoops = () => { loopId++; };

    if (!reduce) addEventListener("pointermove", (e) => {
      if (root.hidden) return;
      const r = $("#buddy").getBoundingClientRect();
      ptr.x = clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2), -1, 1);
      ptr.y = clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight / 2), -1, 1);
      applyRest();
    });

    setMood("happy");
    return {setMood, setTalking, G, runLoops, stopLoops, reduce, sleep};
  }

  let Buddy = null;
  let profileState = normalizePrefs(readPrefs());
  let lastFocused = null;
  let flowTok = 0;

  const COUNTRY_LIST = [["United States", "🇺🇸"], ["United Kingdom", "🇬🇧"], ["Canada", "🇨🇦"], ["Australia", "🇦🇺"], ["Germany", "🇩🇪"], ["Japan", "🇯🇵"], [UNSURE, "✦"]];
  const getP = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => { const ks = p.split("."), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
  const numIn = (p, label, ph, x) => Object.assign({t: "in", type: "number", p, label, ph}, x);

  function inRange(value, min, max) {
    if (value === "" || value === null || value === undefined) return true;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max;
  }

  function validateStep(step) {
    if (step === 1) {
      if (!profileState.degree) return "Choose your degree level.";
      if (!profileState.field) return "Enter your field of study.";
    }

    if (step === 2) {
      if (!profileState.countries.length) return "Choose at least one destination.";
    }

    if (step === 3) {
      const a = profileState.academic;
      const t = profileState.tests;

      if (a.gpa !== "" && !(Number(a.gpa) >= 0)) return "GPA / score can't be negative.";

      if (a.gradingScale !== "" && !(Number(a.gradingScale) > 0)) {
        return "Grading scale must be a number above 0 (for example 4, 10 or 100).";
      }

      if (a.gpa !== "" && a.gradingScale !== "" && Number(a.gpa) > Number(a.gradingScale)) {
        return "Your GPA is higher than the grading scale. Check both numbers.";
      }

      if (!inRange(a.graduationYear, 2020, 2040)) return "Graduation year should be between 2020 and 2040.";
      if (!inRange(t.ielts, 0, 9)) return "IELTS is scored from 0 to 9.";
      if (!inRange(t.toefl, 0, 120)) return "TOEFL is scored from 0 to 120.";
      if (!inRange(t.gre, 260, 340)) return "GRE total is scored from 260 to 340.";
      if (!inRange(t.gmat, 200, 805)) return "GMAT is scored from 200 to 805.";
    }

    return "";
  }


  /** The conversation. Each step: what Buddy says, which controls appear, and how to validate. */
  const OB_STEPS = [
    {mood: "happy", say: "Hi, I'm Uni Buddy! I'll help you build your Study Identity so UniAI can personalise everything for you. First: what level do you want to study?",
      ctl: [{t: "chips", p: "degree", o: ["Bachelor's", "Master's", "PhD", "Diploma"]}], auto: 1, check: () => (profileState.degree ? "" : "Choose your degree level.")},
    {mood: "curious", say: "Nice choice! And what do you want to study?",
      ctl: [{t: "in", type: "text", p: "field", ph: "e.g. Computer Science, Business…"}], check: () => (profileState.field ? "" : "Enter your field of study.")},
    {mood: "thinking", say: "Where in the world are you thinking of going? Pick every country you're considering.",
      ctl: [{t: "multi", p: "countries"}], check: () => (profileState.countries.length ? "" : "Choose at least one destination.")},
    {mood: "curious", say: "When would you like to start?",
      ctl: [{t: "chips", p: "intake", o: ["Fall 2026", "Spring 2027", "Fall 2027", "Spring 2028", "Fall 2028", "Not sure yet"]}], auto: 1},
    {mood: "thinking", say: "Let's talk grades. Everything here is optional.", skip: 1, check: () => validateStep(3),
      ctl: [numIn("academic.gpa", "GPA / score", "8.5", {step: "0.01", min: 0}), {t: "in", type: "text", p: "academic.gradingScale", label: "Grading scale", ph: "10"}, numIn("academic.graduationYear", "Graduation year", "2027", {min: 2020, max: 2040})]},
    {mood: "curious", say: "Any test scores yet? Leave blank what you haven't taken.", skip: 1, check: () => validateStep(3),
      ctl: [numIn("tests.ielts", "IELTS (0–9)", "—", {step: "0.5", min: 0, max: 9}), numIn("tests.toefl", "TOEFL", "—", {min: 0, max: 120}), numIn("tests.gre", "GRE", "—", {min: 0, max: 340}), numIn("tests.gmat", "GMAT", "—", {min: 0, max: 805})]},
    {mood: "thinking", say: "Now the money side. Give me a realistic yearly range.",
      ctl: [{t: "sel", p: "budget.currency", label: "Currency", o: Object.keys(CURRENCY_SYMBOLS)},
        {t: "range", p: "budget.tuitionPerYear", label: "Max tuition / year", min: 0, max: 100000, step: 1000, def: 20000},
        {t: "range", p: "budget.livingPerYear", label: "Max living cost / year", min: 0, max: 60000, step: 1000, def: 12000},
        {t: "tog", p: "budget.needsScholarship", label: "🎓 I need a scholarship"}, {t: "tog", p: "budget.needsLoan", label: "💳 I may need a loan"}]},
    {mood: "curious", say: "What kind of university fits you?",
      ctl: [{t: "chips", p: "university.type", label: "Type", o: ["Any", "Public", "Private"]}, {t: "chips", p: "university.studyMode", label: "Study mode", o: ["On-campus", "Hybrid", "Online"]},
        {t: "chips", p: "ai.priority", also: "university.focus", label: "What matters more?", o: ["career", "research", "balanced"], names: {career: "🚀 Career", research: "🔬 Research", balanced: "⚖️ Balanced"}}]},
    {mood: "excited", say: "Last thing! What should I keep an eye on for you?",
      ctl: [{t: "tog", p: "notifications.scholarships", label: "🎓 Scholarship matches"}, {t: "tog", p: "notifications.deadlines", label: "⏰ Application deadlines"},
        {t: "tog", p: "notifications.universityMatches", label: "✨ University matches"}, {t: "tog", p: "notifications.visa", label: "🛂 Visa updates"}]}
  ];

  function calculateStrength() {
    const p = profileState;
    let score = 0;

    if (p.degree) score += 15;
    if (p.field) score += 15;
    if (p.countries.length) score += 15;
    if (p.intake) score += 8;
    if (p.academic.gpa !== "") score += 8;
    if (p.academic.graduationYear !== "") score += 7;
    if (p.budget.tuitionPerYear !== "") score += 8;
    if (p.budget.livingPerYear !== "") score += 6;
    if (p.tests.ielts || p.tests.toefl || p.tests.gre || p.tests.gmat) score += 8;
    if (p.ai.priority) score += 5;
    if (p.university.type !== "Any") score += 3;
    if (p.university.studyMode) score += 2;

    return Math.min(100, score);
  }


  function showToast(title, detail, warn = false) {
    const toast = document.createElement("div");
    toast.className = `uniai-profile-toast${warn ? " warn" : ""}`;
    toast.setAttribute("role", "status");

    const icon = document.createElement("span");
    icon.textContent = warn ? "!" : "✦";

    const body = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = title;
    const small = document.createElement("small");
    small.textContent = detail;
    body.append(strong, small);

    toast.append(icon, body);
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }


  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const saveDraft = (i) => writeJSON(sessionStorage, DRAFT_KEY, {state: profileState, step: i});

  function addMsg(who, text) {
    const t = byId("ob-thread"), m = el("div", "ob-msg " + who, text);
    t.appendChild(m); t.scrollTop = t.scrollHeight; return m;
  }

  async function speak(text, tok) {
    Buddy.setTalking(true);
    const m = addMsg("buddy", Buddy.reduce ? text : "");
    if (!Buddy.reduce) for (const ch of text) {
      if (tok !== flowTok) return;
      m.textContent += ch; byId("ob-thread").scrollTop = 1e6;
      await Buddy.sleep(ch === " " ? 12 : 16);
    }
    Buddy.setTalking(false);
  }

  /** Draws one control and returns a function that refreshes it from profileState. */
  function buildCtl(c, dock, refresh, picked) {
    const box = el("div", "ob-ctl");
    if (c.label && c.t !== "tog") box.appendChild(el("span", "ob-lab", c.label));
    let update = () => {};

    if (c.t === "chips" || c.t === "multi") {
      const row = el("div", "ob-row"), list = c.t === "multi" ? COUNTRY_LIST : c.o.map((o) => [o]);
      list.forEach(([value, flag]) => {
        const b = el("button", "ob-opt", (flag ? flag + " " : "") + (c.names ? c.names[value] : value)); b.type = "button";
        b.onclick = () => {
          if (c.t === "chips") { setP(profileState, c.p, value); if (c.also) setP(profileState, c.also, value); }
          else {
            let a = profileState.countries.filter((x) => x !== UNSURE);
            if (value === UNSURE) a = [UNSURE]; else { const i = a.indexOf(value); if (i >= 0) a.splice(i, 1); else a.push(value); }
            profileState.countries = a;
          }
          refresh(); picked(c);
        };
        b.dataset.v = value; row.appendChild(b);
      });
      update = () => row.querySelectorAll(".ob-opt").forEach((b) => {
        const v = getP(profileState, c.p), on = c.t === "multi" ? profileState.countries.includes(b.dataset.v) : v === b.dataset.v;
        b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
      });
      box.appendChild(row);
    }

    if (c.t === "in") {
      const i = el("input", "ob-in"); i.type = c.type; i.placeholder = c.ph || ""; i.autocomplete = "off";
      if (c.step) i.step = c.step; if (c.min != null) i.min = c.min; if (c.max != null) i.max = c.max;
      i.setAttribute("aria-label", c.label || c.ph);
      i.value = getP(profileState, c.p) ?? "";
      i.oninput = () => { setP(profileState, c.p, i.value.trim()); picked(c); };
      i.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); dock.querySelector(".ob-go")?.click(); } };
      box.appendChild(i);
      if (c.label) { const l = el("span", "ob-lab", c.label); box.insertBefore(l, i); }
      if (!c.label) setTimeout(() => i.focus({preventScroll: true}), 60);
    }

    if (c.t === "sel") {
      const s = el("select", "ob-sel"); c.o.forEach((o) => s.appendChild(new Option(o, o)));
      s.value = profileState.budget.currency; s.setAttribute("aria-label", c.label);
      s.onchange = () => { setP(profileState, c.p, s.value); refresh(); };
      box.appendChild(s);
    }

    if (c.t === "range") {
      if (getP(profileState, c.p) === "") setP(profileState, c.p, String(c.def));
      const w = el("div", "ob-range"), r = el("input"), out = el("b");
      r.type = "range"; r.min = c.min; r.max = c.max; r.step = c.step; r.value = getP(profileState, c.p); r.setAttribute("aria-label", c.label);
      r.oninput = () => { setP(profileState, c.p, r.value); refresh(); };
      update = () => { out.textContent = (CURRENCY_SYMBOLS[profileState.budget.currency] || "$") + Number(r.value).toLocaleString(); };
      w.append(r, out); box.appendChild(w);
    }

    if (c.t === "tog") {
      const b = el("button", "ob-opt", c.label); b.type = "button";
      b.onclick = () => { setP(profileState, c.p, !getP(profileState, c.p)); refresh(); };
      update = () => { const on = Boolean(getP(profileState, c.p)); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); };
      box.appendChild(b);
    }

    dock.appendChild(box); update();
    return update;
  }

  const fmtAnswer = (c) => {
    const v = getP(profileState, c.p);
    if (c.t === "multi") return profileState.countries.join(", ");
    if (c.t === "tog") return v ? c.label.replace(/^\S+\s/, "") : "";
    if (c.t === "range") return (CURRENCY_SYMBOLS[profileState.budget.currency] || "$") + Number(v).toLocaleString();
    if (c.t === "sel") return "";
    return v === "" || v == null ? "" : (c.names ? c.names[v] : String(v));
  };

  /** Shows the controls for one step. Resolves with "next" | "skip" | "back". */
  function collect(step, i) {
    const dock = byId("ob-dock"); dock.replaceChildren();
    return new Promise((resolve) => {
      const updates = [], refresh = () => updates.forEach((u) => u()), err = el("p", "ob-err");
      const go = () => {
        const e = step.check && step.check();
        if (e) { err.textContent = e; Buddy.setMood("oops"); return; }
        resolve("next");
      };
      step.ctl.forEach((c) => updates.push(buildCtl(c, dock, refresh, (cc) => {
        err.textContent = ""; if (step.auto && cc.t === "chips") setTimeout(go, 180);
      })));
      const nav = el("div", "ob-nav");
      if (i > 0) { const b = el("button", "ob-ghost", "← Back"); b.type = "button"; b.onclick = () => resolve("back"); nav.appendChild(b); }
      if (step.skip) { const b = el("button", "ob-ghost skip", "Skip"); b.type = "button"; b.onclick = () => resolve("skip"); nav.appendChild(b); }
      if (!step.auto) { const b = el("button", "ob-go", "Continue →"); b.type = "button"; b.onclick = go; nav.appendChild(b); }
      dock.append(err, nav);
    });
  }

  /** Index of the first required step that is still wrong, or -1. */
  function firstInvalid() {
    return OB_STEPS.findIndex((s, i) => (i <= 2 || i === 4) && s.check && s.check());
  }

  function identityText() {
    const p = profileState, c = p.countries.length ? p.countries.join(", ") : "your chosen destinations";
    return `${p.degree || "Future student"} · ${p.field || "your chosen field"}. Exploring ${c} for ${p.intake || "your preferred intake"}. Profile strength: ${calculateStrength()}%.`;
  }

  async function saveProfile(btn) {
    btn.disabled = true; btn.textContent = "Saving… ✦";
    try {
      const saved = await window.UniAIPreferences.set(profileState);
      showToast("Study Identity created", saved.__synced || !window.supabaseApp ? "UniAI is now personalized for you." : "Saved on this device. It will sync to your account shortly.", !(saved.__synced || !window.supabaseApp));
      Buddy.setMood("excited");
      setTimeout(() => closeModal(false), 900);
    } catch (err) {
      console.error("UniAI: profile save failed.", err);
      btn.disabled = false; btn.textContent = "Create my Study Identity ✦";
      byId("ob-dock").querySelector(".ob-err").textContent = "Could not save your profile. Please try again.";
    }
  }

  async function runFlow(start, tok) {
    const total = OB_STEPS.length, thread = byId("ob-thread"), marks = [];
    let i = start;
    if (start > 0) await speak("Welcome back! Let's pick up where we left off.", tok);

    while (tok === flowTok) {
      byId("ob-bar").style.width = Math.round((i / total) * 100) + "%";
      byId("ob-step").textContent = i < total ? `Step ${i + 1} of ${total}` : "Almost done";
      marks[i] = thread.children.length;

      if (i === total) {                       // final: summary + create
        Buddy.setMood("excited");
        await speak("All set! Here's your Study Identity. I'll use it to personalise universities, scholarships and deadlines for you. ✦", tok);
        if (tok !== flowTok) return;
        const dock = byId("ob-dock"); dock.replaceChildren();
        const err = el("p", "ob-err"), nav = el("div", "ob-nav");
        const back = el("button", "ob-ghost", "← Back"); back.type = "button";
        const create = el("button", "ob-go", "Create my Study Identity ✦"); create.type = "button";
        dock.append(el("div", "ob-sum", identityText()), err, nav); nav.append(back, create);
        const r = await new Promise((res) => { back.onclick = () => res("back"); create.onclick = () => res("create"); });
        if (tok !== flowTok) return;
        if (r === "back") { i = total - 1; thread.replaceChildren(...Array.from(thread.children).slice(0, marks[i])); continue; }
        const bad = firstInvalid();
        if (bad >= 0) { i = bad; Buddy.setMood("oops"); await speak("Hmm, I need one more thing here before I can save.", tok); continue; }
        await saveProfile(create); return;
      }

      const step = OB_STEPS[i];
      Buddy.setMood(step.mood);
      await speak(step.say, tok);
      if (tok !== flowTok) return;
      const r = await collect(step, i);
      if (tok !== flowTok) return;

      if (r === "back") { i = Math.max(0, i - 1); Array.from(thread.children).slice(marks[i]).forEach((n) => n.remove()); continue; }
      const text = r === "skip" ? "Skip" : step.ctl.map(fmtAnswer).filter(Boolean).join(" · ") || "Done";
      addMsg("you", text);
      if (r === "skip") Buddy.setMood("sleepy"); else { Buddy.setMood("happy", {quiet: true}); Buddy.G.nod(); }
      i++; saveDraft(i);
      await Buddy.sleep(Buddy.reduce ? 0 : 380);
    }
  }

  function buildModal() {
    if (byId("prefs-overlay")) return;
    const wrap = el("div", "uniai-profile-overlay"); wrap.id = "prefs-overlay"; wrap.hidden = true; wrap.innerHTML = MODAL_HTML;
    document.body.appendChild(wrap);
    if (!byId("uniai-study-identity-css")) { const s = el("style"); s.id = "uniai-study-identity-css"; s.textContent = MODAL_CSS; document.head.appendChild(s); }
    Buddy = initBuddy();

    byId("prefs-close").addEventListener("click", () => closeModal(true));
    document.addEventListener("keydown", (e) => {
      if (wrap.hidden) return;
      if (e.key === "Escape") { closeModal(true); return; }
      if (e.key !== "Tab") return;
      const f = $$("button, input, select, [tabindex]:not([tabindex='-1'])", wrap).filter((n) => !n.disabled && !n.hidden && n.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
  }

  function openPrefsModal() {
    buildModal();
    const overlay = byId("prefs-overlay");

    // Resume a half-finished conversation from this session, otherwise start from the saved profile.
    const draft = readJSON(sessionStorage, DRAFT_KEY);
    let start = 0;
    if (draft && draft.state) { profileState = normalizePrefs(draft.state); start = Math.min(Math.max(Number(draft.step) || 0, 0), OB_STEPS.length); }
    else profileState = normalizePrefs(readPrefs());

    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    byId("ob-thread").replaceChildren(); byId("ob-dock").replaceChildren();
    Buddy.runLoops();
    runFlow(start, ++flowTok);
  }

  function closeModal(dismissed) {
    flowTok++;
    const overlay = byId("prefs-overlay");
    if (overlay) overlay.hidden = true;
    if (Buddy) { Buddy.stopLoops(); Buddy.setTalking(false); }
    document.body.style.overflow = "";

    if (dismissed && autoPromptActive) {
      const uid = currentUserId();
      if (uid) { try { localStorage.setItem(DISMISS_PREFIX + uid, String(Date.now())); } catch (err) { /* ignore */ } }
    }
    autoPromptActive = false;

    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus({preventScroll: true});
  }

  window.openPrefsModal = openPrefsModal;

  /* ------------------------------------------------------------------------
     Personalization
     ------------------------------------------------------------------------ */

  let finderPrefilled = false;
  let finderSearched = false;
  let scholarshipApplied = false;
  let autoScholarshipValue = "";

  const listText = (prefs) => realCountries(prefs).join(", ");

  /** Home hero eyebrow: "Master's · Computer Science · Canada, Germany". */
  function personalizeHome(prefs) {
    const eyebrow = document.querySelector(".hero-copy .eyebrow");
    if (!eyebrow) return;

    if (eyebrow.dataset.original === undefined) eyebrow.dataset.original = eyebrow.textContent;

    const parts = [prefs.degree, prefs.field, listText(prefs)].filter(Boolean);
    eyebrow.textContent = parts.length ? parts.join(" · ") : eyebrow.dataset.original;
  }

  /** Finder: country, GPA and budget pre-filled once, never over the user's input. */
  function personalizeFinder(prefs) {
    const search = byId("uni-search");
    if (search && prefs.field) search.placeholder = `Search ${prefs.field} programs...`;

    if (finderPrefilled) return;

    const select = byId("country");
    const gpaEl = byId("gpa");
    const budgetEl = byId("budget");
    if (!select && !gpaEl && !budgetEl) return;

    const country = realCountries(prefs)[0];

    if (select && !select.value && country) {
      let option = Array.from(select.options).find(
        (o) => o.value === country || o.textContent.trim() === country
      );

      if (!option) {
        option = document.createElement("option");
        option.value = country;
        option.textContent = country;
        select.appendChild(option);
      }

      select.value = option.value;
    }

    // The finder's GPA box is out of 4.0, the profile's may be out of 10 or 100.
    const gpa = Number(prefs.academic.gpa);
    const scale = Number(prefs.academic.gradingScale);

    if (gpaEl && !gpaEl.value && gpa > 0 && scale > 0) {
      gpaEl.value = (Math.round(Math.min(4, (gpa / scale) * 4) * 10) / 10).toFixed(1);
    }

    // The finder's budget box is in US dollars.
    const tuition = Number(prefs.budget.tuitionPerYear);

    if (budgetEl && !budgetEl.value && tuition > 0 && prefs.budget.currency === "USD") {
      budgetEl.value = tuition.toLocaleString();
    }

    finderPrefilled = true;
  }

  /**
   * Scholarships: filter by COUNTRY only (first chosen destination).
   * Applied once, and never over text the user typed themselves.
   */
  function applyScholarshipCountry() {
    const prefs = readPrefs();
    if (!prefs || scholarshipApplied) return;

    const country = realCountries(prefs)[0];
    const input = byId("scholarship-filter");

    if (!country || !input || typeof window.setScholarshipFilter !== "function") return;

    const typed = input.value.trim();

    // Something the user typed is theirs. Only our own earlier value may be replaced.
    if (typed && typed !== autoScholarshipValue) {
      scholarshipApplied = true;
      return;
    }

    window.setScholarshipFilter(country);
    autoScholarshipValue = country;
    scholarshipApplied = true;
  }

  function renderPrefsOnProfilePage(prefs) {
    const grid = document.querySelector(".profile-info-grid");
    if (!grid) return;

    let row = byId("prefs-info-row");

    if (!row) {
      row = document.createElement("div");
      row.id = "prefs-info-row";
      row.className = "profile-info-item";
      grid.appendChild(row);
    }

    const summary =
      [prefs.degree, prefs.field, listText(prefs) || "Exploring"].filter(Boolean).join(" · ");

    // textContent only: these values are user-typed.
    row.textContent = "";

    const label = document.createElement("span");
    label.className = "info-label";
    label.textContent = "STUDY IDENTITY";

    const valueRow = document.createElement("div");
    valueRow.className = "info-value-row";

    const value = document.createElement("span");
    value.className = "info-value";
    value.textContent = summary;

    const edit = document.createElement("span");
    edit.className = "info-edit-indicator";
    edit.textContent = "✦";

    valueRow.append(value, edit);
    row.append(label, valueRow);

    row.style.cursor = "pointer";
    row.onclick = openPrefsModal;
  }

  function injectProfileEditButton() {
    if (byId("prefs-edit-btn")) return;

    const anchor = document.querySelector(".profile-edit-btn");
    if (!anchor || !anchor.parentElement) return;

    const button = document.createElement("button");
    button.id = "prefs-edit-btn";
    button.type = "button";
    button.className = "profile-footer-action";
    button.innerHTML = "<span>Edit Study Identity</span><span>✦</span>";
    button.addEventListener("click", openPrefsModal);

    anchor.parentElement.appendChild(button);
  }

  function applyPersonalization(prefs) {
    if (!prefs) return;

    const normalized = normalizePrefs(prefs);

    personalizeHome(normalized);
    personalizeFinder(normalized);
    injectProfileEditButton();
    renderPrefsOnProfilePage(normalized);

    window.UniAIStudyProfile = normalized;
  }

  /** Undo everything above (used on sign-out / clear). */
  function resetPersonalization() {
    const eyebrow = document.querySelector(".hero-copy .eyebrow");
    if (eyebrow && eyebrow.dataset.original !== undefined) {
      eyebrow.textContent = eyebrow.dataset.original;
    }

    const search = byId("uni-search");
    if (search) search.placeholder = "Search universities, courses, countries...";

    const row = byId("prefs-info-row");
    if (row) row.remove();

    const button = byId("prefs-edit-btn");
    if (button) button.remove();

    const filter = byId("scholarship-filter");
    if (filter && autoScholarshipValue && filter.value.trim() === autoScholarshipValue) {
      if (typeof window.clearScholarshipFilter === "function") window.clearScholarshipFilter();
    }

    finderPrefilled = false;
    finderSearched = false;
    scholarshipApplied = false;
    autoScholarshipValue = "";

    window.UniAIStudyProfile = null;
  }

  /** Make `prefs` the active profile and tell the rest of the site. */
  function commitPrefs(prefs, { resetFlags = false } = {}) {
    const json = JSON.stringify(prefs);
    const changed = json !== lastAppliedJSON;
    lastAppliedJSON = json;

    if (resetFlags) {
      finderPrefilled = false;
      scholarshipApplied = false;
    }

    applyPersonalization(prefs);

    // If the scholarships page is already on screen, refresh it now.
    const page = byId("scholarshipsPage");
    if (page && !page.classList.contains("hidden")) applyScholarshipCountry();

    if (changed) {
      window.dispatchEvent(new CustomEvent("uniai:preferences", { detail: prefs }));
    }
  }

  /* ------------------------------------------------------------------------
     Page switching (wraps script.js's showPage)
     ------------------------------------------------------------------------ */

  const originalShowPage = window.showPage;

  if (typeof originalShowPage === "function") {
    window.showPage = async function (page, event) {
      const result = await originalShowPage(page, event);

      if (readPrefs()) {
        if (page === "scholarships" || page === "scholarshipsPage") {
          setTimeout(applyScholarshipCountry, 150);
        }

        if (page === "universityFinder" || page === "universityFinderPage") {
          setTimeout(() => {
            const prefs = readPrefs();
            if (prefs) personalizeFinder(prefs);

            // One automatic first search, only if nothing has been searched yet.
            if (
              !finderSearched &&
              !window.__uniResults &&
              typeof window.findUniversities === "function"
            ) {
              finderSearched = true;
              window.findUniversities();
            }
          }, 400);
        }
      }

      return result;
    };

    window.showpage = window.showPage;
  }

  /* ------------------------------------------------------------------------
     Auth: this browser vs. the account
     ------------------------------------------------------------------------ */

  let autoPromptActive = false;

  function handleSignedOut() {
    // Only clear a copy that belonged to a signed-in account, so a shared
    // computer never shows (or uploads) the previous person's profile.
    if (!readOwner()) return;

    clearLocal();
    resetPersonalization();
    lastAppliedJSON = "";

    window.dispatchEvent(new CustomEvent("uniai:preferences", { detail: null }));
  }

  function handleSession(session) {
    const uid = session && session.user && session.user.id;

    if (!uid) {
      handleSignedOut();
      return;
    }

    // A copy that belongs to a different account is never merged or uploaded.
    const owner = readOwner();
    let local = readPrefs();

    if (owner && owner !== uid) {
      clearLocal();
      resetPersonalization();
      lastAppliedJSON = "";
      local = null;
    }

    const accountRaw = prefsFromSession(session);
    const account = accountRaw ? normalizePrefs(accountRaw) : null;

    let chosen = null;

    if (account && (!local || account.updatedAt >= local.updatedAt)) {
      chosen = account;
    } else if (local) {
      chosen = local.updatedAt ? local : Object.assign({}, local, { updatedAt: Date.now() });

      // This browser's copy is newer (or the account has none): upload it.
      if (!account || chosen.updatedAt > account.updatedAt) writePrefsToAccount(chosen);
    }

    if (chosen) {
      writePrefsLocal(chosen, uid);
      commitPrefs(chosen);
      return;
    }

    // Nothing anywhere: remember whose browser this is, and offer onboarding.
    try {
      localStorage.setItem(OWNER_KEY, uid);
    } catch (err) {
      /* ignore */
    }

    maybeAutoPrompt(uid);
  }

  function whenPageIsQuiet(callback) {
    let tries = 0;

    const check = () => {
      const intro = byId("uniai-intro") || byId("intro");
      const auth = byId("auth-overlay");
      const authOpen = auth && getComputedStyle(auth).display !== "none";

      if ((!intro && !authOpen) || tries++ > 40) {
        callback();
        return;
      }

      setTimeout(check, 300);
    };

    check();
  }

  /** Offer onboarding once per session, and not again for a few days after "Skip". */
  function maybeAutoPrompt(uid) {
    try {
      const prompted = JSON.parse(sessionStorage.getItem(PROMPTED_KEY) || "[]");
      if (prompted.includes(uid)) return;

      const dismissedAt = Number(localStorage.getItem(DISMISS_PREFIX + uid) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;

      prompted.push(uid);
      sessionStorage.setItem(PROMPTED_KEY, JSON.stringify(prompted));
    } catch (err) {
      return;
    }

    whenPageIsQuiet(() => {
      setTimeout(() => {
        if (readPrefs()) return; // saved while we waited
        autoPromptActive = true;
        openPrefsModal();
      }, 400);
    });
  }

  window.addEventListener("uniai:auth-state", (e) => {
    handleSession(e.detail && e.detail.session);
  });

  /* ------------------------------------------------------------------------
     Start-up
     ------------------------------------------------------------------------ */

  function start() {
    // Paint this browser's copy straight away if it belongs to a signed-in
    // account. The auth event then confirms it, replaces it, or clears it.
    const prefs = readPrefs();

    if (prefs && readOwner()) {
      setTimeout(() => commitPrefs(prefs), 300);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
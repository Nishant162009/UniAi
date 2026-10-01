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
     Modal markup + styles
     ------------------------------------------------------------------------ */

  const MODAL_HTML = `<div class="uniai-profile-shell" role="dialog" aria-modal="true" aria-labelledby="prefs-title"><div class="profile-orb orb-one"></div><div class="profile-orb orb-two"></div><div class="profile-grid"></div><header class="profile-header"><div><div class="profile-eyebrow"><span class="eyebrow-dot"></span> UNIAI STUDY IDENTITY </div><h2 id="prefs-title"> Build your <span>study future.</span></h2><p> Tell UniAI what you're aiming for. We'll personalize your study-abroad journey. </p></div><button type="button" class="profile-close" id="prefs-close" aria-label="Close" > × </button></header>
<div class="profile-progress"><div class="progress-meta"><span id="profile-step-label"> STEP 01 / 06 </span><span id="profile-progress-percent"> 17% </span></div><div class="progress-track"><div id="profile-progress-bar" class="progress-fill" ></div></div></div>
<form id="prefs-form" class="profile-form" >
<section class="profile-step active" data-step="1" ><div class="step-number"> 01 </div><h3> What are you <span>planning to study?</span></h3><p class="step-description"> Start with your academic destination. </p><div class="field-label"> DEGREE LEVEL </div><div class="choice-grid degree-grid"><button type="button" class="choice-card" data-field="degree" data-value="Bachelor's" ><span class="choice-icon">🎓</span><strong>Bachelor's</strong><small>Undergraduate</small></button><button type="button" class="choice-card" data-field="degree" data-value="Master's" ><span class="choice-icon">✦</span><strong>Master's</strong><small>Graduate</small></button><button type="button" class="choice-card" data-field="degree" data-value="PhD" ><span class="choice-icon">◈</span><strong>PhD</strong><small>Doctoral</small></button><button type="button" class="choice-card" data-field="degree" data-value="Diploma" ><span class="choice-icon">▣</span><strong>Diploma</strong><small>Professional</small></button></div><div class="field-label"> FIELD OF STUDY </div><input id="prefs-field" class="profile-input large" type="text" placeholder="e.g. Computer Science, Business, Mechanical Engineering" autocomplete="off" /><div class="field-label"> TARGET INTAKE </div><div class="pill-row"><button type="button" class="pill-choice" data-field="intake" data-value="Fall 2026" > Fall 2026 </button><button type="button" class="pill-choice" data-field="intake" data-value="Spring 2027" > Spring 2027 </button><button type="button" class="pill-choice" data-field="intake" data-value="Fall 2027" > Fall 2027 </button><button type="button" class="pill-choice" data-field="intake" data-value="Spring 2028" > Spring 2028 </button><button type="button" class="pill-choice" data-field="intake" data-value="Fall 2028" > Fall 2028 </button><button type="button" class="pill-choice" data-field="intake" data-value="Not sure yet" > Not sure </button></div></section>
<section class="profile-step" data-step="2" ><div class="step-number"> 02 </div><h3> Where do you want <span>to go?</span></h3><p class="step-description"> Pick every destination you're considering. You can change this later. </p><div class="destination-grid"><button type="button" class="destination-card" data-country="United States" ><span class="country-flag">🇺🇸</span><strong>United States</strong><small>US</small><span class="select-check">✓</span></button><button type="button" class="destination-card" data-country="United Kingdom" ><span class="country-flag">🇬🇧</span><strong>United Kingdom</strong><small>UK</small><span class="select-check">✓</span></button><button type="button" class="destination-card" data-country="Canada" ><span class="country-flag">🇨🇦</span><strong>Canada</strong><small>CA</small><span class="select-check">✓</span></button><button type="button" class="destination-card" data-country="Australia" ><span class="country-flag">🇦🇺</span><strong>Australia</strong><small>AU</small><span class="select-check">✓</span></button><button type="button" class="destination-card" data-country="Germany" ><span class="country-flag">🇩🇪</span><strong>Germany</strong><small>DE</small><span class="select-check">✓</span></button><button type="button" class="destination-card" data-country="Japan" ><span class="country-flag">🇯🇵</span><strong>Japan</strong><small>JP</small><span class="select-check">✓</span></button><button type="button" class="destination-card wide" data-country="Not sure yet" ><span class="country-flag">✦</span><strong>I'm still exploring</strong><small>Let UniAI help me decide</small><span class="select-check">✓</span></button></div><div id="destination-count" class="selection-hint" > Select at least one destination </div></section>
<section class="profile-step" data-step="3" ><div class="step-number"> 03 </div><h3> Tell us about your <span>academic profile.</span></h3><p class="step-description"> This helps UniAI understand which programs may fit your academic background. </p><div class="metric-grid"><div class="metric-card"><span class="metric-icon"> ◉ </span><label> GPA / SCORE </label><input id="prefs-gpa" type="number" class="metric-input" placeholder="8.5" step="0.01" min="0" /></div><div class="metric-card"><span class="metric-icon"> % </span><label> GRADING SCALE </label><input id="prefs-grading-scale" type="text" class="metric-input" placeholder="10.0" /></div><div class="metric-card"><span class="metric-icon"> ◷ </span><label> GRADUATION YEAR </label><input id="prefs-graduation-year" type="number" class="metric-input" placeholder="2027" min="2020" max="2040" /></div></div><div class="field-label"> TEST SCORES </div><div class="test-grid"><div class="test-card"><span>IELTS</span><input id="prefs-ielts" type="number" placeholder="—" step="0.5" min="0" max="9" /></div><div class="test-card"><span>TOEFL</span><input id="prefs-toefl" type="number" placeholder="—" min="0" max="120" /></div><div class="test-card"><span>GRE</span><input id="prefs-gre" type="number" placeholder="—" min="0" max="340" /></div><div class="test-card"><span>GMAT</span><input id="prefs-gmat" type="number" placeholder="—" min="0" max="805" /></div></div><div class="info-banner"><span>✦</span><div><strong>Don't have test scores yet?</strong><small> No problem. You can leave these blank and update them later. </small></div></div></section>
<section class="profile-step" data-step="4" ><div class="step-number"> 04 </div><h3> What's your <span>money plan?</span></h3><p class="step-description"> Give UniAI a realistic range so recommendations can account for your budget. </p><div class="currency-row"><span class="field-label"> CURRENCY </span><select id="prefs-currency" class="profile-select compact" ><option value="USD"> USD </option><option value="EUR"> EUR </option><option value="GBP"> GBP </option><option value="CAD"> CAD </option><option value="AUD"> AUD </option><option value="INR"> INR </option><option value="JPY"> JPY </option></select></div><div class="budget-panel"><div class="budget-heading"><div><span> MAX TUITION / YEAR </span><strong id="tuition-display" > $20,000 </strong></div></div><input id="prefs-tuition" class="budget-slider" type="range" min="0" max="100000" step="1000" value="20000" /><div class="slider-labels"><span>$0</span><span>$100K+</span></div></div><div class="budget-panel"><div class="budget-heading"><div><span> MAX LIVING COST / YEAR </span><strong id="living-display" > $12,000 </strong></div></div><input id="prefs-living" class="budget-slider" type="range" min="0" max="60000" step="1000" value="12000" /><div class="slider-labels"><span>$0</span><span>$60K+</span></div></div><div class="toggle-grid"><button type="button" class="toggle-card" id="toggle-scholarship" ><span class="toggle-icon"> 🎓 </span><span><strong> Scholarships </strong><small> I need financial aid </small></span><i></i></button><button type="button" class="toggle-card" id="toggle-loan" ><span class="toggle-icon"> 💳 </span><span><strong> Education loan </strong><small> I may need funding </small></span><i></i></button></div></section>
<section class="profile-step" data-step="5" ><div class="step-number"> 05 </div><h3> What kind of <span>university fits you?</span></h3><p class="step-description"> There isn't one perfect university. Tell us what environment you're looking for. </p><div class="field-label"> UNIVERSITY TYPE </div><div class="segmented-control"><button type="button" data-field="universityType" data-value="Any" > Any </button><button type="button" data-field="universityType" data-value="Public" > Public </button><button type="button" data-field="universityType" data-value="Private" > Private </button></div><div class="field-label"> STUDY MODE </div><div class="segmented-control"><button type="button" data-field="studyMode" data-value="On-campus" > On-campus </button><button type="button" data-field="studyMode" data-value="Hybrid" > Hybrid </button><button type="button" data-field="studyMode" data-value="Online" > Online </button></div><div class="field-label"> WHAT MATTERS MORE? </div><div class="priority-grid"><button type="button" class="priority-card" data-priority="career" ><span>🚀</span><strong> Career </strong><small> Jobs, industry connections, employability </small></button><button type="button" class="priority-card" data-priority="research" ><span>🔬</span><strong> Research </strong><small> Labs, publications, academic opportunities </small></button><button type="button" class="priority-card" data-priority="balanced" ><span>⚖️</span><strong> Balanced </strong><small> A bit of everything </small></button></div></section>
<section class="profile-step" data-step="6" ><div class="step-number"> 06 </div><h3> Let UniAI work <span>for you.</span></h3><p class="step-description"> Choose what you want us to keep an eye on. </p><div class="ai-card"><div class="ai-card-glow"></div><div class="ai-icon"> ✦ </div><div><strong> AI-powered personalization </strong><p> UniAI will use your Study Identity to personalize university matches, scholarships, deadlines and guidance. </p></div></div><div class="notification-list"><label class="notification-row"><span class="notification-symbol"> 🎓 </span><span><strong> Scholarship matches </strong><small> Tell me when relevant scholarships appear </small></span><input type="checkbox" id="prefs-notify-scholarships" checked /><i></i></label><label class="notification-row"><span class="notification-symbol"> ⏰ </span><span><strong> Application deadlines </strong><small> Keep my deadlines visible </small></span><input type="checkbox" id="prefs-notify-deadlines" checked /><i></i></label><label class="notification-row"><span class="notification-symbol"> ✨ </span><span><strong> University matches </strong><small> Tell me when new matches are found </small></span><input type="checkbox" id="prefs-notify-universities" checked /><i></i></label><label class="notification-row"><span class="notification-symbol"> 🛂 </span><span><strong> Visa updates </strong><small> Keep visa information on my radar </small></span><input type="checkbox" id="prefs-notify-visa" checked /><i></i></label></div><div class="identity-preview"><div class="preview-top"><span> YOUR STUDY IDENTITY </span><span id="final-strength" > 0% </span></div><div id="identity-summary" class="identity-summary" > Complete your profile to see your personalized identity. </div></div></section><div id="prefs-error" class="profile-error" ></div><div class="profile-navigation"><button type="button" id="profile-back" class="nav-secondary" > ← Back </button><button type="button" id="profile-skip" class="nav-skip" > Skip for now </button><button type="button" id="profile-next" class="nav-primary" > Continue <span>→</span></button></div></form></div>`;

  const MODAL_CSS = `.uniai-profile-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient( circle at 50% 0%,rgba(124,58,237,.18),transparent 45% ),rgba(3,5,15,.88);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);animation:profileOverlayIn .35s ease}
@keyframes profileOverlayIn{from{opacity:0}
to{opacity:1}
}
.uniai-profile-shell{position:relative;width:min(860px,100%);max-height:min(900px,94vh);overflow:hidden auto;border:1px solid rgba(255,255,255,.1);border-radius:30px;background:linear-gradient( 145deg,rgba(19,20,37,.97),rgba(8,10,22,.98) );box-shadow:0 40px 100px rgba(0,0,0,.65),0 0 80px rgba(124,58,237,.12),inset 0 1px rgba(255,255,255,.08);color:#f7f7fb;scrollbar-width:thin;animation:shellIn .5s cubic-bezier(.2,.8,.2,1)}
@keyframes shellIn{from{opacity:0;transform:translateY(25px) scale(.97)}
to{opacity:1;transform:translateY(0) scale(1)}
}
.profile-orb{position:absolute;width:300px;height:300px;border-radius:50%;filter:blur(90px);pointer-events:none;opacity:.25;animation:orbFloat 8s ease-in-out infinite}
.orb-one{top:-160px;right:-70px;background:#7c3aed}
.orb-two{bottom:-180px;left:-80px;background:#2563eb;animation-delay:-4s}
@keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1)}
50%{transform:translate(25px,-20px) scale(1.08)}
}
.profile-grid{position:absolute;inset:0;opacity:.035;background-image:linear-gradient( rgba(255,255,255,.3) 1px,transparent 1px ),linear-gradient( 90deg,rgba(255,255,255,.3) 1px,transparent 1px );background-size:35px 35px;pointer-events:none}
.profile-header{position:relative;z-index:2;display:flex;justify-content:space-between;gap:20px;padding:38px 42px 24px}
.profile-eyebrow{display:flex;align-items:center;gap:8px;margin-bottom:13px;font-size:10px;font-weight:800;letter-spacing:.18em;color:#a78bfa}
.eyebrow-dot{width:7px;height:7px;border-radius:50%;background:#a78bfa;box-shadow:0 0 15px #8b5cf6;animation:pulseDot 1.8s infinite}
@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}
50%{opacity:.45;transform:scale(.75)}
}
.profile-header h2{margin:0;font-size:clamp(30px,5vw,48px);line-height:1;letter-spacing:-.045em}
.profile-header h2 span{background:linear-gradient( 100deg,#a78bfa,#60a5fa,#c084fc );-webkit-background-clip:text;background-clip:text;color:transparent}
.profile-header p{max-width:600px;margin:14px 0 0;color:#8e93a8;font-size:14px;line-height:1.6}
.profile-close{flex:0 0 auto;width:40px;height:40px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.04);color:#9ca3af;font-size:25px;cursor:pointer;transition:.2s ease}
.profile-close:hover{color:white;border-color:rgba(167,139,250,.45);background:rgba(139,92,246,.12);transform:rotate(90deg)}
.profile-progress{position:relative;z-index:2;padding:0 42px 25px}
.progress-meta{display:flex;justify-content:space-between;margin-bottom:9px;font-size:10px;font-weight:800;letter-spacing:.14em;color:#656b7e}
#profile-progress-percent{color:#a78bfa}
.progress-track{height:4px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.06)}
.progress-fill{width:16.666%;height:100%;border-radius:inherit;background:linear-gradient( 90deg,#7c3aed,#6366f1,#60a5fa );box-shadow:0 0 18px rgba(139,92,246,.8);transition:width .5s cubic-bezier(.2,.8,.2,1)}
.profile-form{position:relative;z-index:2;padding:0 42px 35px}
.profile-step{display:none;min-height:470px;animation:stepIn .4s cubic-bezier(.2,.8,.2,1)}
.profile-step.active{display:block}
@keyframes stepIn{from{opacity:0;transform:translateX(20px)}
to{opacity:1;transform:translateX(0)}
}
.step-number{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;margin-bottom:20px;border:1px solid rgba(167,139,250,.25);border-radius:12px;background:rgba(139,92,246,.1);color:#a78bfa;font-size:11px;font-weight:900;letter-spacing:.08em}
.profile-step h3{margin:0;max-width:700px;font-size:clamp(27px,4vw,38px);line-height:1.12;letter-spacing:-.035em}
.profile-step h3 span{color:#a78bfa}
.step-description{margin:12px 0 28px;color:#858b9e;line-height:1.6}
.field-label{margin:25px 0 10px;font-size:10px;font-weight:900;letter-spacing:.14em;color:#666c80}
.choice-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.choice-card{min-height:120px;padding:18px;text-align:left;border:1px solid rgba(255,255,255,.07);border-radius:17px;background:rgba(255,255,255,.025);color:white;cursor:pointer;transition:.25s cubic-bezier(.2,.8,.2,1)}
.choice-card:hover{transform:translateY(-3px);border-color:rgba(167,139,250,.4);background:rgba(139,92,246,.08)}
.choice-card.selected{border-color:rgba(167,139,250,.75);background:linear-gradient( 145deg,rgba(139,92,246,.2),rgba(59,130,246,.08) );box-shadow:0 0 30px rgba(124,58,237,.14),inset 0 0 25px rgba(139,92,246,.05)}
.choice-icon{display:block;margin-bottom:12px;font-size:22px}
.choice-card strong,.choice-card small{display:block}
.choice-card strong{font-size:13px}
.choice-card small{margin-top:4px;color:#73798b;font-size:11px}
.profile-input,.profile-select{width:100%;box-sizing:border-box;padding:14px 16px;border:1px solid rgba(255,255,255,.08);border-radius:13px;outline:none;background:rgba(255,255,255,.035);color:white;transition:.2s ease}
.profile-input:focus,.profile-select:focus{border-color:rgba(167,139,250,.65);background:rgba(139,92,246,.055);box-shadow:0 0 0 3px rgba(139,92,246,.08)}
.profile-input.large{padding:16px;font-size:14px}
.profile-select.compact{width:120px}
.pill-row{display:flex;flex-wrap:wrap;gap:8px}
.pill-choice{padding:10px 14px;border:1px solid rgba(255,255,255,.07);border-radius:999px;background:rgba(255,255,255,.025);color:#a4a9b8;cursor:pointer;transition:.2s ease}
.pill-choice:hover,.pill-choice.selected{border-color:rgba(167,139,250,.55);background:rgba(139,92,246,.13);color:#ddd6fe}
.destination-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.destination-card{position:relative;min-height:120px;padding:18px;text-align:left;border:1px solid rgba(255,255,255,.07);border-radius:17px;background:rgba(255,255,255,.025);color:white;cursor:pointer;overflow:hidden;transition:.25s ease}
.destination-card::before{content:"";position:absolute;inset:-50%;background:radial-gradient( circle,rgba(139,92,246,.2),transparent 60% );opacity:0;transition:.3s ease}
.destination-card:hover::before,.destination-card.selected::before{opacity:1}
.destination-card:hover{transform:translateY(-3px);border-color:rgba(167,139,250,.35)}
.destination-card.selected{border-color:rgba(167,139,250,.75);box-shadow:0 0 28px rgba(124,58,237,.13)}
.destination-card.wide{grid-column:span 3;min-height:75px;display:flex;align-items:center;gap:14px}
.country-flag{display:block;position:relative;z-index:1;margin-bottom:12px;font-size:27px}
.destination-card.wide .country-flag{margin:0}
.destination-card strong,.destination-card small{position:relative;z-index:1;display:block}
.destination-card strong{font-size:13px}
.destination-card small{margin-top:5px;color:#73798b;font-size:10px}
.select-check{position:absolute;top:12px;right:12px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08);border-radius:50%;color:transparent;background:rgba(255,255,255,.03)}
.destination-card.selected .select-check{border-color:#8b5cf6;background:#8b5cf6;color:white;box-shadow:0 0 15px rgba(139,92,246,.55)}
.selection-hint{margin-top:12px;color:#666c80;font-size:11px}
.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.metric-card{padding:18px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025)}
.metric-icon{display:block;margin-bottom:18px;color:#a78bfa;font-size:19px}
.metric-card label{display:block;margin-bottom:7px;font-size:9px;font-weight:900;letter-spacing:.12em;color:#656b7e}
.metric-input{width:100%;box-sizing:border-box;border:0;outline:0;background:transparent;color:white;font-size:22px;font-weight:700}
.test-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.test-card{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.025)}
.test-card span{color:#7f8598;font-size:10px;font-weight:900}
.test-card input{width:55px;border:0;outline:0;background:transparent;color:white;text-align:right}
.info-banner{display:flex;align-items:center;gap:12px;margin-top:18px;padding:14px;border:1px solid rgba(96,165,250,.12);border-radius:13px;background:rgba(59,130,246,.05)}
.info-banner>span{color:#60a5fa}
.info-banner strong,.info-banner small{display:block}
.info-banner strong{font-size:12px}
.info-banner small{margin-top:3px;color:#72798b;font-size:10px}
.currency-row{display:flex;align-items:center;justify-content:space-between}
.currency-row .field-label{margin:0}
.budget-panel{margin-top:14px;padding:20px;border:1px solid rgba(255,255,255,.07);border-radius:17px;background:rgba(255,255,255,.025)}
.budget-heading{display:flex;justify-content:space-between}
.budget-heading span{display:block;color:#686e80;font-size:9px;font-weight:900;letter-spacing:.13em}
.budget-heading strong{display:block;margin-top:6px;font-size:26px;letter-spacing:-.03em}
.budget-slider{width:100%;margin:22px 0 5px;accent-color:#8b5cf6;cursor:pointer}
.slider-labels{display:flex;justify-content:space-between;color:#5f6577;font-size:9px}
.toggle-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.toggle-card{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:rgba(255,255,255,.025);color:white;text-align:left;cursor:pointer;transition:.2s ease}
.toggle-card.active{border-color:rgba(167,139,250,.55);background:rgba(139,92,246,.08)}
.toggle-icon{font-size:22px}
.toggle-card strong,.toggle-card small{display:block}
.toggle-card strong{font-size:12px}
.toggle-card small{margin-top:3px;color:#73798b;font-size:10px}
.toggle-card i{margin-left:auto;width:34px;height:19px;border-radius:999px;background:#292d3a;position:relative}
.toggle-card i::after{content:"";position:absolute;top:3px;left:3px;width:13px;height:13px;border-radius:50%;background:#777d8d;transition:.2s ease}
.toggle-card.active i{background:#7c3aed}
.toggle-card.active i::after{transform:translateX(15px);background:white}
.segmented-control{display:flex;padding:4px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.025)}
.segmented-control button{flex:1;padding:11px;border:0;border-radius:9px;background:transparent;color:#777d8f;cursor:pointer;transition:.2s ease}
.segmented-control button.selected{background:rgba(139,92,246,.16);color:#ddd6fe;box-shadow:inset 0 0 0 1px rgba(139,92,246,.2)}
.priority-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.priority-card{min-height:145px;padding:18px;text-align:left;border:1px solid rgba(255,255,255,.07);border-radius:17px;background:rgba(255,255,255,.025);color:white;cursor:pointer;transition:.25s ease}
.priority-card:hover{transform:translateY(-3px)}
.priority-card.selected{border-color:rgba(167,139,250,.7);background:rgba(139,92,246,.1);box-shadow:0 0 25px rgba(124,58,237,.12)}
.priority-card>span{display:block;margin-bottom:18px;font-size:24px}
.priority-card strong,.priority-card small{display:block}
.priority-card small{margin-top:5px;color:#73798b;line-height:1.4;font-size:10px}
.ai-card{position:relative;display:flex;gap:15px;padding:20px;overflow:hidden;border:1px solid rgba(139,92,246,.2);border-radius:18px;background:linear-gradient( 120deg,rgba(124,58,237,.13),rgba(37,99,235,.05) )}
.ai-card-glow{position:absolute;top:-70px;right:-40px;width:180px;height:180px;border-radius:50%;background:#7c3aed;filter:blur(70px);opacity:.16}
.ai-icon{position:relative;width:42px;height:42px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;border:1px solid rgba(167,139,250,.3);border-radius:13px;background:rgba(139,92,246,.12);color:#c4b5fd;font-size:21px}
.ai-card strong{position:relative;font-size:13px}
.ai-card p{position:relative;margin:5px 0 0;color:#858b9e;font-size:11px;line-height:1.55}
.notification-list{margin-top:14px;border:1px solid rgba(255,255,255,.07);border-radius:17px;overflow:hidden}
.notification-row{display:flex;align-items:center;gap:12px;padding:15px;border-bottom:1px solid rgba(255,255,255,.055);cursor:pointer;transition:.2s ease}
.notification-row:last-child{border-bottom:0}
.notification-row:hover{background:rgba(139,92,246,.045)}
.notification-symbol{width:35px;height:35px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:rgba(255,255,255,.04)}
.notification-row strong,.notification-row small{display:block}
.notification-row strong{font-size:12px}
.notification-row small{margin-top:3px;color:#6e7487;font-size:10px}
.notification-row input{display:none}
.notification-row i{width:35px;height:20px;margin-left:auto;flex:0 0 auto;border-radius:999px;background:#292d3a;position:relative}
.notification-row i::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#777d8d;transition:.2s ease}
.notification-row input:checked + i{background:#7c3aed}
.notification-row input:checked + i::after{transform:translateX(15px);background:white}
.identity-preview{margin-top:18px;padding:18px;border:1px solid rgba(167,139,250,.16);border-radius:17px;background:rgba(139,92,246,.055)}
.preview-top{display:flex;justify-content:space-between;color:#777d8f;font-size:9px;font-weight:900;letter-spacing:.14em}
#final-strength{color:#a78bfa}
.identity-summary{margin-top:10px;color:#d5d7e0;font-size:13px;line-height:1.6}
.profile-error{min-height:20px;margin-top:10px;color:#fb7185;font-size:11px}
.profile-navigation{display:flex;align-items:center;gap:10px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06)}
.nav-secondary,.nav-primary,.nav-skip{min-height:45px;padding:0 17px;border-radius:12px;cursor:pointer;font-weight:700;transition:.2s ease}
.nav-secondary{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#999faf}
.nav-secondary:hover{color:white;background:rgba(255,255,255,.06)}
.nav-skip{margin-left:auto;border:0;background:transparent;color:#666c7d;font-size:11px}
.nav-skip:hover{color:#a78bfa}
.nav-primary{display:flex;align-items:center;gap:12px;min-width:125px;justify-content:center;border:1px solid rgba(167,139,250,.3);background:linear-gradient( 100deg,#7c3aed,#6366f1 );color:white;box-shadow:0 8px 25px rgba(124,58,237,.25)}
.nav-primary:hover{transform:translateY(-2px);box-shadow:0 12px 35px rgba(124,58,237,.38)}
@media (max-width:700px){.profile-header,.profile-progress,.profile-form{padding-left:20px;padding-right:20px}
.choice-grid{grid-template-columns:1fr 1fr}
.destination-grid{grid-template-columns:1fr 1fr}
.destination-card.wide{grid-column:span 2}
.metric-grid{grid-template-columns:1fr}
.test-grid{grid-template-columns:1fr 1fr}
.priority-grid{grid-template-columns:1fr}
.toggle-grid{grid-template-columns:1fr}
}
@media (max-width:480px){.uniai-profile-overlay{padding:8px}
.uniai-profile-shell{max-height:97vh;border-radius:22px}
.profile-header{padding-top:25px}
.profile-header h2{font-size:29px}
.choice-grid,.destination-grid{grid-template-columns:1fr}
.destination-card.wide{grid-column:auto}
.profile-navigation{flex-wrap:wrap}
.nav-skip{order:3;width:100%;margin:0}
.nav-secondary,.nav-primary{flex:1}
}

/* ---- additions ---- */
.uniai-profile-overlay[hidden]{display:none}
.uniai-profile-shell :focus-visible{outline:2px solid #a78bfa;outline-offset:2px}
.nav-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}
.profile-error:empty{display:none}
.uniai-profile-toast{position:fixed;left:50%;bottom:28px;z-index:100000;display:flex;align-items:center;gap:12px;max-width:min(420px,calc(100vw - 32px));padding:14px 18px;border:1px solid rgba(167,139,250,.35);border-radius:16px;background:rgba(15,17,32,.96);color:#f7f7fb;box-shadow:0 18px 50px rgba(0,0,0,.5);opacity:0;transform:translate(-50%,16px);transition:opacity .25s ease,transform .25s ease;pointer-events:none}
.uniai-profile-toast.show{opacity:1;transform:translate(-50%,0)}
.uniai-profile-toast.warn{border-color:rgba(251,191,36,.45)}
.uniai-profile-toast > span{color:#a78bfa;font-size:18px}
.uniai-profile-toast.warn > span{color:#fbbf24}
.uniai-profile-toast strong,.uniai-profile-toast small{display:block}
.uniai-profile-toast strong{font-size:13px}
.uniai-profile-toast small{margin-top:2px;color:#8e93a8;font-size:11px}
@media (prefers-reduced-motion:reduce){.uniai-profile-overlay,.uniai-profile-shell,.profile-step,.profile-orb,.eyebrow-dot{animation:none!important}.progress-fill,.choice-card,.destination-card,.priority-card,.nav-primary{transition:none!important}}
`;

  /* ------------------------------------------------------------------------
     Modal state
     ------------------------------------------------------------------------ */

  let profileState = normalizePrefs(readPrefs());
  let currentStep = 1;
  let lastFocused = null;
  let built = false;

  function buildModal() {
    if (built && byId("prefs-overlay")) return;
    built = true;

    const wrap = document.createElement("div");
    wrap.id = "prefs-overlay";
    wrap.className = "uniai-profile-overlay";
    wrap.hidden = true;
    wrap.innerHTML = MODAL_HTML;
    document.body.appendChild(wrap);

    if (!byId("uniai-study-identity-css")) {
      const style = document.createElement("style");
      style.id = "uniai-study-identity-css";
      style.textContent = MODAL_CSS;
      document.head.appendChild(style);
    }

    bindModalEvents();
  }

  /* ------------------------------------------------------------------------
     Reading the form into state
     ------------------------------------------------------------------------ */

  function val(id) {
    const el = byId(id);
    return el ? String(el.value).trim() : "";
  }

  function checked(id) {
    const el = byId(id);
    return el ? el.checked : false;
  }

  /** One place that copies every input into profileState. */
  function syncFromDOM() {
    profileState.field = val("prefs-field");

    profileState.academic.gpa = val("prefs-gpa");
    profileState.academic.gradingScale = val("prefs-grading-scale");
    profileState.academic.graduationYear = val("prefs-graduation-year");

    profileState.tests.ielts = val("prefs-ielts");
    profileState.tests.toefl = val("prefs-toefl");
    profileState.tests.gre = val("prefs-gre");
    profileState.tests.gmat = val("prefs-gmat");

    profileState.budget.currency = val("prefs-currency") || "USD";
    profileState.budget.tuitionPerYear = val("prefs-tuition");
    profileState.budget.livingPerYear = val("prefs-living");

    profileState.notifications.scholarships = checked("prefs-notify-scholarships");
    profileState.notifications.deadlines = checked("prefs-notify-deadlines");
    profileState.notifications.universityMatches = checked("prefs-notify-universities");
    profileState.notifications.visa = checked("prefs-notify-visa");
  }

  /** Called after every change: refresh the live bits and keep a draft. */
  function touch() {
    updateBudgetDisplay();
    updateStrength();
    saveDraft();
  }

  function saveDraft() {
    writeJSON(sessionStorage, DRAFT_KEY, { state: profileState, step: currentStep });
  }

  /* ------------------------------------------------------------------------
     Applying state to the form
     ------------------------------------------------------------------------ */

  function setSelected(el, on) {
    el.classList.toggle("selected", on);
    el.setAttribute("aria-pressed", String(on));
  }

  function refreshSelections() {
    $$(".choice-card, .pill-choice").forEach((el) =>
      setSelected(el, profileState[el.dataset.field] === el.dataset.value)
    );

    $$(".destination-card").forEach((el) =>
      setSelected(el, profileState.countries.includes(el.dataset.country))
    );

    $$(".segmented-control button").forEach((el) => {
      const current =
        el.dataset.field === "universityType"
          ? profileState.university.type
          : profileState.university.studyMode;
      setSelected(el, el.dataset.value === current);
    });

    $$(".priority-card").forEach((el) =>
      setSelected(el, el.dataset.priority === profileState.ai.priority)
    );

    [
      ["toggle-scholarship", "needsScholarship"],
      ["toggle-loan", "needsLoan"]
    ].forEach(([id, key]) => {
      const el = byId(id);
      if (!el) return;
      el.classList.toggle("active", Boolean(profileState.budget[key]));
      el.setAttribute("aria-pressed", String(Boolean(profileState.budget[key])));
    });
  }

  function populateModal() {
    const setValue = (id, value) => {
      const el = byId(id);
      if (el) el.value = value ?? "";
    };

    setValue("prefs-field", profileState.field);
    setValue("prefs-gpa", profileState.academic.gpa);
    setValue("prefs-grading-scale", profileState.academic.gradingScale);
    setValue("prefs-graduation-year", profileState.academic.graduationYear);
    setValue("prefs-ielts", profileState.tests.ielts);
    setValue("prefs-toefl", profileState.tests.toefl);
    setValue("prefs-gre", profileState.tests.gre);
    setValue("prefs-gmat", profileState.tests.gmat);
    setValue("prefs-currency", profileState.budget.currency);
    setValue("prefs-tuition", profileState.budget.tuitionPerYear || 20000);
    setValue("prefs-living", profileState.budget.livingPerYear || 12000);

    // The sliders show a default even if nothing was saved, so make the saved
    // state match what's on screen (it used to save "" while showing $20,000).
    profileState.budget.tuitionPerYear = val("prefs-tuition");
    profileState.budget.livingPerYear = val("prefs-living");

    [
      ["prefs-notify-scholarships", profileState.notifications.scholarships],
      ["prefs-notify-deadlines", profileState.notifications.deadlines],
      ["prefs-notify-universities", profileState.notifications.universityMatches],
      ["prefs-notify-visa", profileState.notifications.visa]
    ].forEach(([id, on]) => {
      const el = byId(id);
      if (el) el.checked = Boolean(on);
    });

    refreshSelections();
    updateBudgetDisplay();
    updateDestinationCount();
    updateStrength();
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */

  function bindModalEvents() {
    const overlay = byId("prefs-overlay");
    const form = byId("prefs-form");
    if (!overlay || !form) return;

    byId("prefs-close").addEventListener("click", () => closeModal(true));

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeModal(true);
    });

    document.addEventListener("keydown", (e) => {
      if (overlay.hidden) return;

      if (e.key === "Escape") {
        closeModal(true);
        return;
      }

      if (e.key === "Tab") trapFocus(e, overlay);

      if (
        e.key === "Enter" &&
        e.target.matches("input[type='text'], input[type='number']")
      ) {
        e.preventDefault();
        nextStep();
      }
    });

    form.addEventListener("click", onFormClick);
    form.addEventListener("input", onFormInput);
    form.addEventListener("change", onFormInput);
    form.addEventListener("submit", (e) => e.preventDefault());

    byId("profile-next").addEventListener("click", nextStep);
    byId("profile-back").addEventListener("click", previousStep);
    byId("profile-skip").addEventListener("click", () => closeModal(true));
  }

  function onFormClick(e) {
    const choice = e.target.closest(".choice-card, .pill-choice");
    if (choice) {
      profileState[choice.dataset.field] = choice.dataset.value;
      refreshSelections();
      touch();
      return;
    }

    const dest = e.target.closest(".destination-card");
    if (dest) {
      pickDestination(dest.dataset.country);
      return;
    }

    const seg = e.target.closest(".segmented-control button");
    if (seg) {
      if (seg.dataset.field === "universityType") profileState.university.type = seg.dataset.value;
      else profileState.university.studyMode = seg.dataset.value;
      refreshSelections();
      touch();
      return;
    }

    const priority = e.target.closest(".priority-card");
    if (priority) {
      profileState.ai.priority = priority.dataset.priority;
      profileState.university.focus = priority.dataset.priority;
      refreshSelections();
      touch();
      return;
    }

    const toggle = e.target.closest(".toggle-card");
    if (toggle) {
      const key = toggle.id === "toggle-scholarship" ? "needsScholarship" : "needsLoan";
      profileState.budget[key] = !profileState.budget[key];
      refreshSelections();
      touch();
    }
  }

  function onFormInput() {
    syncFromDOM();
    touch();
  }

  function pickDestination(country) {
    if (country === UNSURE) {
      profileState.countries = [UNSURE];
    } else {
      const list = profileState.countries.filter((c) => c !== UNSURE);
      const i = list.indexOf(country);

      if (i >= 0) list.splice(i, 1);
      else list.push(country);

      profileState.countries = list;
    }

    refreshSelections();
    updateDestinationCount();
    touch();
  }

  function trapFocus(e, overlay) {
    const focusable = $$(
      "button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])",
      overlay
    ).filter((el) => !el.disabled && el.offsetParent !== null);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Steps
     ------------------------------------------------------------------------ */

  function nextStep() {
    syncFromDOM();

    const error = validateStep(currentStep);
    if (error) {
      showError(error);
      return;
    }

    clearError();

    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      renderStep();
      saveDraft();
      return;
    }

    saveProfile();
  }

  function previousStep() {
    clearError();

    if (currentStep > 1) {
      currentStep--;
      renderStep();
      saveDraft();
    }
  }

  function renderStep() {
    $$(".profile-step").forEach((step) => {
      step.classList.toggle("active", Number(step.dataset.step) === currentStep);
    });

    const percentage = Math.round((currentStep / TOTAL_STEPS) * 100);

    const bar = byId("profile-progress-bar");
    if (bar) bar.style.width = `${percentage}%`;

    const label = byId("profile-step-label");
    if (label) label.textContent = `STEP ${String(currentStep).padStart(2, "0")} / 06`;

    const percent = byId("profile-progress-percent");
    if (percent) percent.textContent = `${percentage}%`;

    const back = byId("profile-back");
    if (back) back.style.visibility = currentStep === 1 ? "hidden" : "visible";

    const next = byId("profile-next");
    if (next) {
      next.disabled = false; // it used to stay disabled after a successful save
      next.innerHTML =
        currentStep === TOTAL_STEPS
          ? "Create my Study Identity <span>✦</span>"
          : "Continue <span>→</span>";
    }

    if (currentStep === TOTAL_STEPS) updateIdentityPreview();

    const shell = document.querySelector(".uniai-profile-shell");
    if (shell) shell.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ------------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------------ */

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

  function showError(message) {
    const el = byId("prefs-error");
    if (el) el.textContent = message;
  }

  function clearError() {
    showError("");
  }

  /* ------------------------------------------------------------------------
     Live bits: destination count, budget labels, strength, summary
     ------------------------------------------------------------------------ */

  function updateDestinationCount() {
    const el = byId("destination-count");
    if (!el) return;

    const count = profileState.countries.length;
    el.textContent = !count
      ? "Select at least one destination."
      : count === 1
      ? "1 destination selected"
      : `${count} destinations selected`;
  }

  function updateBudgetDisplay() {
    const currency = profileState.budget.currency || "USD";
    const symbol = CURRENCY_SYMBOLS[currency] || currency;

    const tuition = Number(profileState.budget.tuitionPerYear || 0);
    const living = Number(profileState.budget.livingPerYear || 0);

    const tuitionEl = byId("tuition-display");
    if (tuitionEl) tuitionEl.textContent = `${symbol}${tuition.toLocaleString()}`;

    const livingEl = byId("living-display");
    if (livingEl) livingEl.textContent = `${symbol}${living.toLocaleString()}`;

    // The slider end labels used to say "$" whatever currency was chosen.
    const maxima = ["100K+", "60K+"];
    $$(".budget-panel .slider-labels").forEach((labels, i) => {
      const spans = labels.querySelectorAll("span");
      if (spans[0]) spans[0].textContent = `${symbol}0`;
      if (spans[1]) spans[1].textContent = `${symbol}${maxima[i] || ""}`;
    });
  }

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

  function updateStrength() {
    const el = byId("final-strength");
    if (el) el.textContent = `${calculateStrength()}%`;
  }

  function updateIdentityPreview() {
    updateStrength();

    const el = byId("identity-summary");
    if (!el) return;

    const accent = (text) => {
      const span = document.createElement("span");
      span.style.color = "#a78bfa";
      span.textContent = text;
      return span;
    };

    const strong = document.createElement("strong");
    strong.textContent = `${profileState.degree || "Future student"} · ${
      profileState.field || "your chosen field"
    }`;

    const countries = profileState.countries.length
      ? profileState.countries.join(", ")
      : "your chosen destinations";

    // Built with DOM nodes, never innerHTML: "field" is free text.
    el.textContent = "";
    el.append(
      strong,
      document.createElement("br"),
      "Exploring ",
      accent(countries),
      " for ",
      accent(profileState.intake || "your preferred intake"),
      ". UniAI will use this profile to personalize your university, scholarship and application journey."
    );
  }

  /* ------------------------------------------------------------------------
     Save
     ------------------------------------------------------------------------ */

  async function saveProfile() {
    clearError();
    syncFromDOM();

    for (let step = 1; step <= 3; step++) {
      const error = validateStep(step);
      if (error) {
        currentStep = step;
        renderStep();
        showError(error);
        return;
      }
    }

    const next = byId("profile-next");
    if (next) {
      next.disabled = true;
      next.innerHTML = "Saving… <span>✦</span>";
    }

    try {
      const saved = await window.UniAIPreferences.set(profileState);

      showToast(
        "Study Identity created",
        saved.__synced || !window.supabaseApp
          ? "UniAI is now personalized for you."
          : "Saved on this device. It will sync to your account shortly.",
        !(saved.__synced || !window.supabaseApp)
      );

      setTimeout(() => closeModal(false), 400);
    } catch (err) {
      console.error("UniAI: profile save failed.", err);
      showError("Could not save your profile. Please try again.");
      renderStep();
    }
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

  /* ------------------------------------------------------------------------
     Open / close
     ------------------------------------------------------------------------ */

  function openPrefsModal() {
    buildModal();

    const overlay = byId("prefs-overlay");
    if (!overlay) return;

    // Resume a half-finished form from this session, otherwise start from the saved profile.
    const draft = readJSON(sessionStorage, DRAFT_KEY);

    if (draft && draft.state) {
      profileState = normalizePrefs(draft.state);
      currentStep = Math.min(Math.max(Number(draft.step) || 1, 1), TOTAL_STEPS);
    } else {
      profileState = normalizePrefs(readPrefs());
      currentStep = 1;
    }

    populateModal();
    clearError();
    renderStep();

    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";

    const firstField = overlay.querySelector(".profile-step.active button, .profile-step.active input");
    if (firstField) setTimeout(() => firstField.focus({ preventScroll: true }), 50);
  }

  function closeModal(dismissed) {
    const overlay = byId("prefs-overlay");
    if (overlay) overlay.hidden = true;

    document.body.style.overflow = "";

    const next = byId("profile-next");
    if (next) next.disabled = false;

    if (dismissed && autoPromptActive) {
      const uid = currentUserId();
      if (uid) {
        try {
          localStorage.setItem(DISMISS_PREFIX + uid, String(Date.now()));
        } catch (err) {
          /* ignore */
        }
      }
    }
    autoPromptActive = false;

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }
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
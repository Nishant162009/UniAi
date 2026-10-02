/* ==========================================================================
   UniAI — Compare universities (compare.js)

   Load after uniai-ui.js, script.js and save.js (tracker.js optional):
     <script src="JS/uniai-ui.js"></script>
     ...
     <script src="JS/compare.js"></script>

   What it adds
   ------------
   - "⚖ Compare" and "📋 Track" buttons on Finder cards and on saved
     universities (added automatically, no HTML edits needed)
   - A tray at the bottom of the screen with your 2-3 picks
   - A side-by-side table: country, QS rank, tuition, living cost estimate,
     study length, estimated total cost, IELTS/TOEFL, admission outlook,
     a fit score for YOU, your tracker status, and a one-line
     "why this fits you" built from your Study Identity
   - The best value in each row is highlighted

   Honest limits: living cost and study length are rough planning figures by
   country and degree (see LIVING_COST_USD / programYears). Tuition, rank and
   test requirements come from your universities data. Always confirm on the
   university's own website.
   ========================================================================== */

(function () {
  "use strict";

  const UI = window.UniAIUI;

  if (!UI) {
    console.error("UniAI compare: load uniai-ui.js before compare.js.");
    return;
  }

  const { esc, slug, toast } = UI;

  /* ------------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------------ */

  const KEY = "uniai-compare";
  const MAX = 3;

  /** Rough annual living cost in USD (rent, food, transport, insurance). */
  const LIVING_COST_USD = {
    "united states": 16000,
    "united kingdom": 17000,
    canada: 15000,
    australia: 18000,
    germany: 12500,
    japan: 11000,
    singapore: 15000,
    netherlands: 14000,
    france: 12500,
    ireland: 14500,
    "new zealand": 14000,
    switzerland: 22000,
    sweden: 12500,
    italy: 11000,
    spain: 10500,
    "south korea": 10500,
    china: 8000,
    "hong kong": 15000,
    "united arab emirates": 12500,
    denmark: 14500,
    finland: 11500,
    norway: 16000,
    austria: 12000,
    belgium: 13000
  };

  const DEFAULT_LIVING = 13000;

  const COUNTRY_ALIASES = {
    usa: "united states",
    us: "united states",
    "united states of america": "united states",
    uk: "united kingdom",
    england: "united kingdom",
    "great britain": "united kingdom",
    uae: "united arab emirates",
    korea: "south korea",
    holland: "netherlands"
  };

  /** Approximate conversion of a budget into USD (planning only). */
  const FX_TO_USD = { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, AUD: 0.66, INR: 0.012, JPY: 0.0067 };

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */

  const byId = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  function num(v) {
    if (v === null || v === undefined || v === "") return NaN;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  const money = (n) => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "—");

  function countryKey(country) {
    const c = norm(country);
    return COUNTRY_ALIASES[c] || c;
  }

  const livingCost = (country) => LIVING_COST_USD[countryKey(country)] || DEFAULT_LIVING;

  function getPrefs() {
    try {
      return window.UniAIPreferences ? window.UniAIPreferences.get() : null;
    } catch (err) {
      return null;
    }
  }

  /** Typical length of the program in years (planning figure). */
  function programYears(degree, country) {
    const c = countryKey(country);
    const d = norm(degree);

    if (/bachelor|undergrad/.test(d)) {
      return ["united kingdom", "australia", "germany", "ireland", "netherlands", "france", "italy", "spain", "switzerland"].includes(c) ? 3 : 4;
    }

    if (/master|postgrad/.test(d)) return ["united kingdom", "ireland"].includes(c) ? 1 : 2;
    if (/phd|doctor/.test(d)) return 4;
    if (/diploma/.test(d)) return 2;

    return 2; // no degree chosen yet: assume a master's-length program
  }

  /* ------------------------------------------------------------------------
     Selection
     ------------------------------------------------------------------------ */

  let selected = [];

  function loadSelection() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      selected = Array.isArray(raw) ? raw.filter((n) => typeof n === "string" && n).slice(0, MAX) : [];
    } catch (err) {
      selected = [];
    }
  }

  function saveSelection() {
    try {
      localStorage.setItem(KEY, JSON.stringify(selected));
    } catch (err) {
      /* ignore */
    }
  }

  const isSelected = (name) => selected.some((n) => norm(n) === norm(name));

  function toggle(name) {
    if (!name) return;

    if (isSelected(name)) {
      selected = selected.filter((n) => norm(n) !== norm(name));
    } else {
      if (selected.length >= MAX) {
        toast(`You can compare up to ${MAX} universities. Remove one first.`);
        return;
      }
      selected.push(name);
    }

    saveSelection();
    refresh();
  }

  function clearSelection() {
    selected = [];
    saveSelection();
    refresh();
  }

  /* ------------------------------------------------------------------------
     Finding a university's data
     ------------------------------------------------------------------------ */

  function pools() {
    const list = [];

    if (Array.isArray(window.__uniResults)) list.push(window.__uniResults);

    try {
      if (typeof state !== "undefined" && state && Array.isArray(state.universities)) {
        list.push(state.universities);
      }
    } catch (err) {
      /* ignore */
    }

    return list;
  }

  /** Saved records only keep display tags, so read the numbers back out. */
  function fromSavedRecord(rec) {
    const tags = (rec.tags || []).join(" | ");

    const rank = /#\s*(\d+)/.exec(tags);
    const tuition = /\$\s*([\d,]+)/.exec(tags);
    const ielts = /IELTS\s*([\d.]+)/i.exec(tags);

    return {
      name: rec.name,
      country: rec.country || "",
      website: rec.url || "",
      logo: rec.logo || "",
      qs_rank: rank ? Number(rank[1]) : undefined,
      tuition_fee: tuition ? Number(tuition[1].replace(/,/g, "")) : undefined,
      ielts: ielts ? Number(ielts[1]) : undefined
    };
  }

  function findUniversity(name) {
    const target = norm(name);
    let hit = null;

    for (const pool of pools()) {
      hit = pool.find((u) => norm(u.name || u.displayName) === target);
      if (hit) break;
    }

    const saved =
      window.UniAISaved &&
      window.UniAISaved.list().find((i) => i.type === "university" && norm(i.name) === target);

    if (hit) {
      // Fill gaps from the saved copy (e.g. website) without overriding real data.
      return saved ? Object.assign({}, fromSavedRecord(saved), hit) : hit;
    }

    return saved ? fromSavedRecord(saved) : { name, country: "" };
  }

  /* ------------------------------------------------------------------------
     Fit: cost, admission outlook, score, and the "why" line
     ------------------------------------------------------------------------ */

  function profileContext() {
    const prefs = getPrefs();
    const acad = (prefs && prefs.academic) || {};
    const budget = (prefs && prefs.budget) || {};
    const tests = (prefs && prefs.tests) || {};

    const gpa = num(acad.gpa);
    const scale = num(acad.gradingScale);
    const fx = FX_TO_USD[budget.currency] || 1;

    return {
      prefs,
      has: Boolean(prefs && (prefs.degree || prefs.field || (prefs.countries || []).length)),
      countries: ((prefs && prefs.countries) || []).filter((c) => c && c !== "Not sure yet"),
      gpa4: gpa > 0 && scale > 0 ? Math.min(4, (gpa / scale) * 4) : NaN,
      ielts: num(tests.ielts),
      toefl: num(tests.toefl),
      tuitionBudget: num(budget.tuitionPerYear) * fx,
      priority: (prefs && prefs.ai && prefs.ai.priority) || "balanced"
    };
  }

  function outlook(gpa4, avgGpa) {
    if (!Number.isFinite(gpa4) || !Number.isFinite(avgGpa)) return null;
    if (gpa4 >= avgGpa + 0.3) return "Safe";
    if (gpa4 >= avgGpa - 0.2) return "Target";
    return "Dream";
  }

  function fitFor(u, ctx = profileContext()) {
    const name = u.name || u.displayName || "University";
    const country = u.country || "";

    const tuition = num(u.tuition_fee ?? u.displayTuition ?? u.Tuition_Fee);
    const living = livingCost(country);
    const years = programYears(ctx.prefs && ctx.prefs.degree, country);
    const total = Number.isFinite(tuition) ? (tuition + living) * years : NaN;

    const rank = num(u.qs_rank);
    const ielts = num(u.ielts ?? u.displayIelts ?? u.Ielts);
    const toefl = num(u.toefl);
    const avgGpa = num(u.avg_gpa);
    const category = outlook(ctx.gpa4, avgGpa);

    const good = []; // { w, text }
    const bad = [];
    let score = 0;

    // Destination (20)
    if (ctx.countries.length) {
      const inTarget = ctx.countries.some((c) => countryKey(c) === countryKey(country));
      score += inTarget ? 20 : 6;
      (inTarget ? good : bad).push({ w: 3, text: inTarget ? "it's in your target country" : "it's outside your chosen destinations" });
    } else {
      score += 12;
    }

    // Budget (25)
    if (Number.isFinite(tuition) && Number.isFinite(ctx.tuitionBudget) && ctx.tuitionBudget > 0) {
      const ratio = tuition / ctx.tuitionBudget;
      score += Math.max(0, Math.min(25, ratio <= 1 ? 25 : 25 - (ratio - 1) * 50));

      if (ratio <= 1) good.push({ w: 5, text: `tuition fits your ${money(ctx.tuitionBudget)} budget` });
      else bad.push({ w: 5, text: `tuition is ${money(tuition - ctx.tuitionBudget)} over your budget` });
    } else {
      score += 14;
    }

    // Academics (25)
    if (category) {
      score += category === "Safe" ? 25 : category === "Target" ? 20 : 10;

      if (category === "Safe") good.push({ w: 4, text: "your GPA is above their typical admit" });
      else if (category === "Target") good.push({ w: 4, text: "your GPA is in their typical range" });
      else bad.push({ w: 4, text: "it's a stretch for your current GPA" });
    } else {
      score += 14;
    }

    // Language (15)
    if (Number.isFinite(ielts)) {
      if (Number.isFinite(ctx.ielts)) {
        const gap = ielts - ctx.ielts;
        score += gap <= 0 ? 15 : gap <= 0.5 ? 8 : 3;

        if (gap <= 0) good.push({ w: 3, text: "you already meet the IELTS requirement" });
        else bad.push({ w: 3, text: `it needs IELTS ${ielts} (you have ${ctx.ielts})` });
      } else if (Number.isFinite(ctx.toefl) && Number.isFinite(toefl)) {
        const gap = toefl - ctx.toefl;
        score += gap <= 0 ? 15 : gap <= 5 ? 8 : 3;

        if (gap <= 0) good.push({ w: 3, text: "you already meet the TOEFL requirement" });
        else bad.push({ w: 3, text: `it needs TOEFL ${toefl} (you have ${ctx.toefl})` });
      } else {
        score += 8;
        bad.push({ w: 1, text: `it needs IELTS ${ielts}` });
      }
    } else {
      score += 10;
    }

    // What matters to you (15)
    const academic = num(u.academic_score);
    const employer = num(u.employer_score);

    if (ctx.priority === "research" && Number.isFinite(academic)) {
      score += Math.min(15, (academic / 100) * 15);
      if (academic >= 70) good.push({ w: 2, text: "it has a strong research reputation" });
    } else if (ctx.priority === "career" && Number.isFinite(employer)) {
      score += Math.min(15, (employer / 100) * 15);
      if (employer >= 70) good.push({ w: 2, text: "employers rate it highly" });
    } else if (Number.isFinite(rank)) {
      score += Math.max(0, Math.min(15, 15 - rank / 20));
      if (rank <= 100) good.push({ w: 2, text: `it's ranked #${rank} globally` });
    } else {
      score += 8;
    }

    const pick = (list, n) => list.sort((a, b) => b.w - a.w).slice(0, n).map((r) => r.text);
    const goods = pick(good, 2);
    const bads = pick(bad, 1);

    let why;

    if (!ctx.has) {
      why = "Add your Study Identity to see how this university fits you.";
    } else if (!goods.length && !bads.length) {
      why = "Not enough information yet. Fill in more of your profile for a clearer answer.";
    } else {
      const joined = goods.length > 1 ? `${goods[0]} and ${goods[1]}` : goods[0] || "";
      const head = joined ? joined.charAt(0).toUpperCase() + joined.slice(1) : "";
      const caveat = bads[0];

      why = head
        ? `${head}${caveat ? `, but ${caveat}` : ""}.`
        : `${caveat.charAt(0).toUpperCase() + caveat.slice(1)}.`;
    }

    return {
      name,
      country,
      tuition,
      living,
      years,
      total,
      rank,
      ielts,
      toefl,
      avgGpa,
      category,
      score: Math.round(Math.max(0, Math.min(100, score))),
      why
    };
  }

  /* ------------------------------------------------------------------------
     Styles
     ------------------------------------------------------------------------ */

  function injectStyles() {
    if (byId("cmp-css")) return;

    const style = document.createElement("style");
    style.id = "cmp-css";
    style.textContent = `
body.cmp-open .uai-toast{bottom:92px}
.cmp-tray{position:fixed;left:50%;bottom:20px;z-index:99980;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);padding:10px 12px;border:1px solid var(--uai-border);border-radius:18px;background:var(--uai-bg);color:var(--uai-text);box-shadow:var(--uai-shadow);transform:translateX(-50%)}
.cmp-tray[hidden]{display:none}
.cmp-tray strong{font-size:.8rem;padding:0 4px}
.cmp-chip{display:inline-flex;align-items:center;gap:6px;max-width:190px;padding:5px 6px 5px 11px;border:1px solid var(--uai-border);border-radius:999px;background:var(--uai-panel);font-size:.78rem;font-weight:600}
.cmp-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmp-chip button{width:20px;height:20px;border:0;border-radius:50%;background:var(--uai-border);color:var(--uai-text);font-size:13px;line-height:1;cursor:pointer}
.cmp-chip button:hover{background:var(--uai-bad);color:#fff}
.cmp-best-line{display:flex;flex-wrap:wrap;gap:10px;margin:4px 0 16px}
.cmp-best-line .uai-pill{font-size:.76rem}
.cmp-nudge{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 14px;padding:10px 14px;border:1px solid var(--uai-border);border-radius:12px;background:var(--uai-primary-soft);font-size:.84rem}
.cmp-scroll{overflow-x:auto;border:1px solid var(--uai-border);border-radius:16px}
.cmp-table{width:100%;min-width:640px;border-collapse:collapse;font-size:.88rem}
.cmp-table th,.cmp-table td{padding:12px 14px;border-bottom:1px solid var(--uai-border);vertical-align:top;text-align:left}
.cmp-table tr:last-child th,.cmp-table tr:last-child td{border-bottom:0}
.cmp-table thead th{background:var(--uai-panel);vertical-align:bottom}
.cmp-table tbody th{width:150px;background:var(--uai-panel);font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--uai-muted)}
.cmp-uni{display:flex;flex-direction:column;gap:2px}
.cmp-uni strong{font-size:.98rem;line-height:1.25}
.cmp-uni small{color:var(--uai-muted);font-weight:400}
.cmp-cell small{display:block;margin-top:3px;color:var(--uai-muted);font-size:.72rem}
.cmp-best{background:rgba(16,185,129,.1);box-shadow:inset 3px 0 0 var(--uai-good)}
.cmp-best .cmp-val::after{content:" ★";color:var(--uai-good);font-size:.8em}
.cmp-val{font-weight:700}
.cmp-fit{display:flex;align-items:center;gap:8px}
.cmp-fit-bar{flex:1;height:8px;border-radius:999px;background:var(--uai-border);overflow:hidden;min-width:60px}
.cmp-fit-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ef4444,#f59e0b,#10b981)}
.cmp-why{line-height:1.5;font-size:.86rem}
.cmp-actions{display:flex;flex-wrap:wrap;gap:6px}
.cmp-note{margin:14px 2px 0;color:var(--uai-muted);font-size:.76rem;line-height:1.5}
.cmp-empty{padding:30px 10px;text-align:center;color:var(--uai-muted)}
.cmp-btn.is-compared{border-color:var(--uai-primary)!important;color:var(--uai-primary)!important;background:var(--uai-primary-soft)!important}
@media (max-width:640px){.cmp-tray{border-radius:16px}.cmp-chip{max-width:140px}}
`;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
     Tray
     ------------------------------------------------------------------------ */

  function renderTray() {
    let tray = byId("cmp-tray");

    if (!tray) {
      tray = document.createElement("div");
      tray.id = "cmp-tray";
      tray.className = "cmp-tray";
      tray.setAttribute("role", "region");
      tray.setAttribute("aria-label", "University comparison");
      document.body.appendChild(tray);

      tray.addEventListener("click", (e) => {
        const remove = e.target.closest("[data-cmp-remove]");
        if (remove) return toggle(remove.dataset.cmpRemove);

        const action = e.target.closest("[data-cmp-tray]");
        if (!action) return;

        if (action.dataset.cmpTray === "open") openModal();
        if (action.dataset.cmpTray === "clear") clearSelection();
      });
    }

    tray.hidden = selected.length === 0;
    document.body.classList.toggle("cmp-open", selected.length > 0);

    if (!selected.length) return;

    tray.innerHTML = `
<strong>⚖ Compare</strong>
${selected
  .map(
    (n) =>
      `<span class="cmp-chip"><span title="${esc(n)}">${esc(n)}</span><button type="button" data-cmp-remove="${esc(n)}" aria-label="Remove ${esc(n)} from comparison">×</button></span>`
  )
  .join("")}
<button type="button" class="uai-btn primary small" data-cmp-tray="open" ${selected.length < 2 ? "disabled" : ""}>${selected.length < 2 ? "Pick one more" : `Compare ${selected.length}`}</button>
<button type="button" class="uai-btn small" data-cmp-tray="clear">Clear</button>`;
  }

  /* ------------------------------------------------------------------------
     Modal
     ------------------------------------------------------------------------ */

  let modalOpener = null;

  function trackedFor(name) {
    return window.UniAITracker ? window.UniAITracker.findByName(name, "university") : null;
  }

  function buildRows(cols) {
    const valuesOf = (fn) => cols.map(fn);

    const row = (label, vals, fmt, best) => ({ label, vals, fmt, best });

    return [
      row("Country", valuesOf((c) => c.country || "—"), (v) => esc(v), null),
      row("QS rank", valuesOf((c) => c.rank), (v) => (Number.isFinite(v) ? `#${v}` : "—"), "min"),
      row("Tuition / year", valuesOf((c) => c.tuition), (v) => money(v), "min"),
      row("Living cost / year", valuesOf((c) => c.living), (v) => `${money(v)} <small>estimate</small>`, "min"),
      row("Typical length", valuesOf((c) => c.years), (v) => `${v} year${v === 1 ? "" : "s"} <small>estimate</small>`, null),
      row("Estimated total", valuesOf((c) => c.total), (v) => money(v), "min"),
      row("IELTS needed", valuesOf((c) => c.ielts), (v) => (Number.isFinite(v) ? v : "—"), "min"),
      row("TOEFL needed", valuesOf((c) => c.toefl), (v) => (Number.isFinite(v) ? v : "—"), "min"),
      row("Typical admitted GPA", valuesOf((c) => c.avgGpa), (v) => (Number.isFinite(v) ? `${v.toFixed(1)} / 4.0` : "—"), null)
    ];
  }

  function bestIndexes(vals, mode) {
    if (!mode) return [];

    const nums = vals.map((v) => (Number.isFinite(v) ? v : null));
    const valid = nums.filter((v) => v !== null);

    if (valid.length < 2 || new Set(valid).size < 2) return [];

    const target = mode === "min" ? Math.min(...valid) : Math.max(...valid);
    return nums.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0);
  }

  function modalHTML(cols, ctx) {
    const rows = buildRows(cols);

    const bodyRows = rows
      .map((r) => {
        const best = bestIndexes(r.vals, r.best);

        return `<tr><th scope="row">${esc(r.label)}</th>${r.vals
          .map(
            (v, i) =>
              `<td class="cmp-cell ${best.includes(i) ? "cmp-best" : ""}"><span class="cmp-val">${r.fmt(v)}</span>${
                r.label === "IELTS needed" && Number.isFinite(ctx.ielts)
                  ? `<small>You: ${ctx.ielts}</small>`
                  : r.label === "TOEFL needed" && Number.isFinite(ctx.toefl)
                  ? `<small>You: ${ctx.toefl}</small>`
                  : r.label === "Typical admitted GPA" && Number.isFinite(ctx.gpa4)
                  ? `<small>You: ${ctx.gpa4.toFixed(1)} / 4.0</small>`
                  : ""
              }</td>`
          )
          .join("")}</tr>`;
      })
      .join("");

    const fitBest = bestIndexes(cols.map((c) => c.score), "max");

    const outlookRow = `<tr><th scope="row">Admission outlook</th>${cols
      .map((c) => {
        const tone = c.category === "Safe" ? "good" : c.category === "Target" ? "warn" : c.category === "Dream" ? "bad" : "";
        return `<td>${c.category ? `<span class="uai-pill ${tone}">${esc(c.category)}</span>` : '<span class="cmp-val">—</span><small style="display:block;color:var(--uai-muted);font-size:.72rem">Add your GPA to see this</small>'}</td>`;
      })
      .join("")}</tr>`;

    const fitRow = `<tr><th scope="row">Fit for you</th>${cols
      .map(
        (c, i) =>
          `<td class="cmp-cell ${fitBest.includes(i) ? "cmp-best" : ""}"><div class="cmp-fit"><div class="cmp-fit-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.score}"><i style="width:${c.score}%"></i></div><span class="cmp-val">${c.score}</span></div></td>`
      )
      .join("")}</tr>`;

    const trackRow = `<tr><th scope="row">Your tracker</th>${cols
      .map((c) => {
        const t = trackedFor(c.name);
        if (!t) return '<td><span class="cmp-val" style="color:var(--uai-muted)">Not tracking</span></td>';

        const days = UI.daysUntil(t.deadline);
        const dl = t.deadline ? `Deadline ${esc(UI.formatDate(t.deadline))}${days !== null && days >= 0 ? ` (${days}d)` : ""}` : "No deadline set";
        return `<td><span class="uai-pill good">${esc(t.status.charAt(0).toUpperCase() + t.status.slice(1))}</span><small style="display:block;margin-top:4px;color:var(--uai-muted);font-size:.72rem">${dl}</small></td>`;
      })
      .join("")}</tr>`;

    const whyRow = `<tr><th scope="row">Why it fits you</th>${cols
      .map((c) => `<td class="cmp-why">${esc(c.why)}</td>`)
      .join("")}</tr>`;

    const actionRow = `<tr><th scope="row"></th>${cols
      .map(
        (c) => `<td><div class="cmp-actions">
  ${trackedFor(c.name) ? '<button type="button" class="uai-btn small" data-cmp-modal="open-tracker">View in tracker</button>' : `<button type="button" class="uai-btn small primary" data-cmp-modal="track" data-name="${esc(c.name)}">📋 Track</button>`}
  ${c.website ? `<a class="uai-btn small" href="${esc(c.website)}" target="_blank" rel="noopener noreferrer">Website ↗</a>` : ""}
</div></td>`
      )
      .join("")}</tr>`;

    const head = `<tr><th scope="col"></th>${cols
      .map(
        (c) => `<th scope="col"><div class="cmp-uni"><strong>${esc(c.name)}</strong><small>📍 ${esc(c.country || "Country not listed")}</small><button type="button" class="uai-btn small" style="margin-top:8px;align-self:flex-start" data-cmp-modal="remove" data-name="${esc(c.name)}">Remove</button></div></th>`
      )
      .join("")}</tr>`;

    const lowestCost = cols.filter((c) => Number.isFinite(c.total)).sort((a, b) => a.total - b.total)[0];
    const bestFit = cols.slice().sort((a, b) => b.score - a.score)[0];
    const topRank = cols.filter((c) => Number.isFinite(c.rank)).sort((a, b) => a.rank - b.rank)[0];

    return `
<div class="uai-dialog wide" role="dialog" aria-modal="true" aria-labelledby="cmp-title">
  <div class="uai-dialog-head">
    <div><h2 id="cmp-title">Compare universities</h2><p>${cols.length} side by side, scored against your Study Identity.</p></div>
    <button type="button" class="uai-x" data-cmp-modal="close" aria-label="Close">×</button>
  </div>
  <div class="uai-dialog-body">
    ${
      ctx.has
        ? ""
        : `<div class="cmp-nudge"><span>✦ Add your Study Identity for personal fit scores and a real "why it fits you".</span>${typeof window.openPrefsModal === "function" ? '<button type="button" class="uai-btn small primary" data-cmp-modal="prefs">Set it up</button>' : ""}</div>`
    }
    <div class="cmp-best-line">
      ${bestFit ? `<span class="uai-pill good">🎯 Best fit: ${esc(bestFit.name)} (${bestFit.score})</span>` : ""}
      ${lowestCost ? `<span class="uai-pill">💰 Lowest total: ${esc(lowestCost.name)} (${money(lowestCost.total)})</span>` : ""}
      ${topRank ? `<span class="uai-pill">🏆 Highest ranked: ${esc(topRank.name)} (#${topRank.rank})</span>` : ""}
    </div>
    <div class="cmp-scroll">
      <table class="cmp-table">
        <thead>${head}</thead>
        <tbody>${bodyRows.replace(/(<tr><th scope="row">Admission outlook)/, "$1")}${""}
          ${outlookRow}${fitRow}${trackRow}${whyRow}${actionRow}
        </tbody>
      </table>
    </div>
    <p class="cmp-note">Tuition, rank and test requirements come from the university data in UniAI. Living cost and study length are rough planning estimates by country and degree level. The fit score is a guide, not an admissions prediction. Always confirm details on each university's website.</p>
  </div>
  <div class="uai-dialog-foot">
    <button type="button" class="uai-btn" data-cmp-modal="clear">Clear comparison</button>
    <span class="grow"></span>
    <button type="button" class="uai-btn primary" data-cmp-modal="close">Done</button>
  </div>
</div>`;
  }

  function renderModal() {
    const overlay = byId("cmp-overlay");
    if (!overlay) return;

    if (selected.length < 2) {
      overlay.querySelector(".uai-dialog-body, .cmp-empty") && closeModal();
      return;
    }

    const ctx = profileContext();
    const cols = selected.map((name) => {
      const uni = findUniversity(name);
      return Object.assign(fitFor(uni, ctx), { website: uni.website || "" });
    });

    overlay.innerHTML = modalHTML(cols, ctx);
  }

  function openModal() {
    if (selected.length < 2) {
      toast("Pick at least two universities to compare.");
      return;
    }

    closeModal();
    UI.ensureStyles();
    injectStyles();

    modalOpener = document.activeElement;

    const overlay = document.createElement("div");
    overlay.id = "cmp-overlay";
    overlay.className = "uai-overlay";
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    renderModal();

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeModal();
    });

    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
      else UI.trapFocus(e, overlay.querySelector(".uai-dialog"));
    });

    overlay.addEventListener("click", onModalClick);

    const close = overlay.querySelector('[data-cmp-modal="close"]');
    if (close) setTimeout(() => close.focus({ preventScroll: true }), 40);
  }

  function closeModal() {
    const overlay = byId("cmp-overlay");
    if (overlay) overlay.remove();

    document.body.style.overflow = "";

    if (modalOpener && typeof modalOpener.focus === "function") {
      try {
        modalOpener.focus({ preventScroll: true });
      } catch (err) {
        /* ignore */
      }
    }

    modalOpener = null;
  }

  function trackUniversity(uni) {
    if (!window.UniAITracker) {
      toast("The Application Tracker isn't loaded on this page.");
      return null;
    }

    const prefs = getPrefs();

    return window.UniAITracker.add({
      type: "university",
      name: uni.name || uni.displayName,
      country: uni.country || "",
      program: prefs ? [prefs.degree, prefs.field].filter(Boolean).join(" ") : "",
      intake: prefs && prefs.intake && prefs.intake !== "Not sure yet" ? prefs.intake : "",
      url: uni.website || ""
    });
  }

  function onModalClick(e) {
    const btn = e.target.closest("[data-cmp-modal]");
    if (!btn) return;

    switch (btn.dataset.cmpModal) {
      case "close":
        closeModal();
        break;

      case "clear":
        clearSelection();
        closeModal();
        break;

      case "remove":
        toggle(btn.dataset.name);
        break;

      case "track":
        trackUniversity(findUniversity(btn.dataset.name));
        break;

      case "open-tracker":
        closeModal();
        if (window.UniAITracker) window.UniAITracker.openTracker();
        break;

      case "prefs":
        closeModal();
        if (typeof window.openPrefsModal === "function") window.openPrefsModal();
        break;
    }
  }

  /* ------------------------------------------------------------------------
     Buttons added to Finder cards and Saved cards
     ------------------------------------------------------------------------ */

  function decorateFinder() {
    $$("#results .uni-card .uni-footer").forEach((footer) => {
      if (footer.dataset.cmpDone) return;
      footer.dataset.cmpDone = "1";

      const card = footer.closest(".uni-card");
      const nameEl = card && card.querySelector(".uni-name");
      const name = nameEl ? nameEl.textContent.trim() : "";
      if (!name) return;

      const style = "width:100%;margin:0;box-sizing:border-box;justify-content:center;";

      footer.insertAdjacentHTML(
        "beforeend",
        `<button type="button" class="secondary-btn cmp-btn" data-cmp="toggle" data-name="${esc(name)}" style="${style}">⚖ Compare</button>
         <button type="button" class="secondary-btn" data-cmp="track" data-name="${esc(name)}" style="${style}">📋 Track</button>`
      );
    });
  }

  function decorateSaved() {
    $$('#shortlist-items .saved-card[data-type="university"] .saved-card-actions').forEach((actions) => {
      if (actions.dataset.cmpDone) return;
      actions.dataset.cmpDone = "1";

      const card = actions.closest(".saved-card");
      const name = card ? card.dataset.name : "";
      if (!name) return;

      actions.insertAdjacentHTML(
        "afterbegin",
        `<button type="button" class="saved-card-btn cmp-btn" data-cmp="toggle" data-name="${esc(name)}" title="Compare">⚖ Compare</button>
         <button type="button" class="saved-card-btn" data-cmp="track" data-name="${esc(name)}" title="Track application">📋 Track</button>`
      );
    });
  }

  function refreshButtons() {
    $$(".cmp-btn[data-cmp='toggle']").forEach((btn) => {
      const on = isSelected(btn.dataset.name);
      btn.classList.toggle("is-compared", on);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "⚖ Added" : "⚖ Compare";
    });
  }

  function decorateAll() {
    decorateFinder();
    decorateSaved();
    refreshButtons();
  }

  function refresh() {
    renderTray();
    refreshButtons();
    if (byId("cmp-overlay")) renderModal();
  }

  /* ------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------ */

  function observe(id) {
    const el = byId(id);
    if (!el || el.dataset.cmpObserved) return;
    el.dataset.cmpObserved = "1";

    new MutationObserver(decorateAll).observe(el, { childList: true, subtree: true });
  }

  function init() {
    UI.ensureStyles();
    injectStyles();
    loadSelection();

    observe("results");
    observe("shortlist-items");

    decorateAll();
    renderTray();

    // Capture phase: the Finder's own click handler would otherwise treat
    // these buttons as "open the university page".
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest && e.target.closest("[data-cmp]");
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        if (btn.dataset.cmp === "toggle") toggle(btn.dataset.name);
        else if (btn.dataset.cmp === "track") trackUniversity(findUniversity(btn.dataset.name));
      },
      true
    );

    window.addEventListener("uniai:tracker-change", () => byId("cmp-overlay") && renderModal());
    window.addEventListener("uniai:preferences", () => byId("cmp-overlay") && renderModal());
    window.addEventListener("uniai:saved-change", () => setTimeout(decorateAll, 0));

    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        loadSelection();
        refresh();
      }
    });
  }

  window.UniAICompare = {
    toggle,
    clear: clearSelection,
    open: openModal,
    list: () => selected.slice(),
    fit: (uni) => fitFor(uni),
    // exposed for tests
    _programYears: programYears,
    _livingCost: livingCost
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
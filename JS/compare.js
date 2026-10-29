/* ==========================================================================
   UniAI — Compare Universities (compare.js)

   Add AFTER script.js and save.js (and tracker.js if you want the
   "Track application" button to work):
     <script src="JS/compare.js"></script>

   Needs NO changes to index.html. It injects the #comparePage section, a
   "Saved | Compare" tab bar on the Saved page, and a floating tray on the
   University Finder. There is no sidebar button: universities are picked with
   the "Compare" button on each Finder card, and the comparison lives with Saved.

   What it does
   - Pick 2 or 3 universities: search the Finder data, or tap one from your
     Saved list.
   - Loads each university from /universities/:slug, so the values include
     the cached AI estimates from your enrichment layer.
   - Side-by-side table: rank, scores, tuition, IELTS / TOEFL, GPA,
     acceptance rate, international students, size, founded, type, website.
   - Values the AI estimated carry an "AI est." tag; real dataset values never do.
   - The best value in a few rows (cheapest tuition, best rank, ...) is marked.
   - "Track application" adds a university to the Application Tracker.

   Other scripts can call:  UniAICompare.add({ name, slug }) / .toggle() / .has(name) / .open()
   The selection is kept on this device in localStorage "uniai-compare".
   (Add that key to PERSONAL_KEYS in sync.js if you want it on every device.)
   ========================================================================== */

(function () {
  "use strict";

  if (window.UniAICompare) return;

  const STORE_KEY = "uniai-compare";
  const MAX = 3;

  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ------------------------------------------------------------------ *
   * Data helpers
   * ------------------------------------------------------------------ */

  const ALT = { tuition_fee: "Tuition_Fee", ielts: "Ielts", name: "Name" };

  function raw(rec, key) {
    if (!rec) return undefined;
    return rec[key] !== undefined ? rec[key] : rec[ALT[key]];
  }

  function missing(v) {
    return v == null || (typeof v === "string" && /^(|n\/a|nan|-|unknown|none|null)$/i.test(v.trim())) || (typeof v === "number" && Number.isNaN(v));
  }

  function num(v) {
    if (missing(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function text(v) {
    return missing(v) ? "" : String(v).trim();
  }

  function safeUrl(u) {
    const s = text(u);
    if (!s) return "";
    try {
      const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (err) {
      return "";
    }
  }

  const isAi = (rec, field) => !!(rec && rec._provenance && rec._provenance[field] === "ai");

  function finderList() {
    try {
      return typeof state !== "undefined" && Array.isArray(state.universities) ? state.universities : [];
    } catch (err) {
      return [];
    }
  }

  function findByName(name) {
    const n = String(name || "").trim().toLowerCase();
    return finderList().find((u) => String(raw(u, "name") || "").trim().toLowerCase() === n) || null;
  }

  function savedUniversities() {
    try {
      const list = window.UniAISaved && typeof window.UniAISaved.list === "function" ? window.UniAISaved.list() : [];
      return list.filter((i) => i && i.type === "university" && i.name);
    } catch (err) {
      return [];
    }
  }

  const apiPath = (p) => (typeof api === "function" ? api(p) : p);

  /* ------------------------------------------------------------------ *
   * Rows (pure: takes loaded records, returns the table model)
   * ------------------------------------------------------------------ */

  const usd = (n) => `$${n.toLocaleString()}`;

  // best: "low" | "high" | null  (only where "better" is not a matter of opinion)
  const ROWS = [
    { key: "qs_rank", label: "QS rank", get: (r) => num(r.qs_rank), show: (n) => `#${n.toLocaleString()}`, best: "low" },
    { key: "overall_score", label: "Overall score", get: (r) => num(r.overall_score), show: (n) => n.toFixed(1), best: "high" },
    { key: "tuition_fee", label: "Tuition per year", get: (r) => num(raw(r, "tuition_fee")), show: usd, best: "low" },
    { key: "ielts", label: "IELTS required", get: (r) => num(raw(r, "ielts")), show: (n) => String(n), best: null },
    { key: "toefl", label: "TOEFL required", get: (r) => num(r.toefl), show: (n) => String(n), best: null },
    { key: "avg_gpa", label: "Typical GPA (4.0 scale)", get: (r) => num(r.avg_gpa), show: (n) => n.toFixed(2), best: null },
    { key: "acceptance_rate", label: "Acceptance rate", get: (r) => num(r.acceptance_rate), show: (n) => `${n}%`, best: null },
    { key: "intl_student_percent", label: "International students", get: (r) => num(r.intl_student_percent), show: (n) => `${n}%`, best: "high" },
    { key: "student_population", label: "Students", get: (r) => num(r.student_population), show: (n) => n.toLocaleString(), best: null },
    { key: "founded_year", label: "Founded", get: (r) => num(r.founded_year), show: (n) => String(n), best: null },
    { key: "university_type", label: "Type", get: (r) => text(r.university_type) || null, show: (s) => s, best: null },
    { key: "city", label: "City", get: (r) => text(r.city) || null, show: (s) => s, best: null }
  ];

  /** One entry per row: cells[i] = { value, shown, ai, best, range } or null when the data has no value. */
  function buildRows(recs) {
    return ROWS.map((row) => {
      const vals = recs.map((r) => (r ? row.get(r) : null));
      const nums = vals.filter((v) => typeof v === "number");
      let target = null;

      if (row.best && nums.length >= 2) {
        target = row.best === "low" ? Math.min.apply(null, nums) : Math.max.apply(null, nums);
        if (nums.every((v) => v === target)) target = null; // a tie is not a "best"
      }

      return {
        label: row.label,
        cells: vals.map((v, i) => {
          if (v == null) return null;
          const r = recs[i];
          const range = r && r._ai && r._ai.ranges && r._ai.ranges[row.key];
          return {
            value: v,
            shown: row.show(v),
            ai: isAi(r, row.key),
            best: target !== null && v === target,
            range: Array.isArray(range) && row.key === "tuition_fee" ? `${usd(range[0])} – ${usd(range[1])}` : ""
          };
        })
      };
    });
  }

  /* ------------------------------------------------------------------ *
   * Selection + loading
   * ------------------------------------------------------------------ */

  let picks = []; // [{ name, slug }]
  const loaded = new Map(); // key -> { rec, enriched } | { error }
  const keyOf = (p) => (p.slug || p.name).toLowerCase();

  function loadPicks() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      picks = (Array.isArray(v) ? v : [])
        .filter((p) => p && typeof p.name === "string" && p.name)
        .map((p) => ({ name: p.name.slice(0, 120), slug: String(p.slug || "").slice(0, 160) }))
        .slice(0, MAX);
    } catch (err) {
      picks = [];
    }
  }

  function savePicks() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(picks));
    } catch (err) {
      /* storage blocked: the selection lasts for this page view */
    }
    notify();
  }

  async function fetchRecord(pick) {
    const k = keyOf(pick);
    const cur = loaded.get(k);
    if (cur && (cur.loading || cur.enriched)) return; // in flight or already full; errors and basic data retry

    const base = findByName(pick.name);
    const slug = pick.slug || (base && base.slug) || "";
    loaded.set(k, { loading: true });

    if (slug) {
      const ctl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), 14000) : null;
      try {
        const res = await fetch(apiPath(`/universities/${encodeURIComponent(slug)}`), ctl ? { signal: ctl.signal } : undefined);
        if (!res.ok) throw new Error(String(res.status));
        const rec = await res.json();
        loaded.set(k, { rec, enriched: true });
        return;
      } catch (err) {
        /* fall back to the Finder's basic record below */
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    if (base) loaded.set(k, { rec: base, enriched: false });
    else loaded.set(k, { error: true });
  }

  async function refreshData() {
    await Promise.all(picks.map(fetchRecord));
    renderTable();
  }

  function add(input) {
    const name = text(input && (input.name || input.displayName));
    if (!name) return false;

    const base = findByName(name);
    const pick = { name: text(raw(base, "name")) || name, slug: text(input.slug) || text(base && base.slug) };

    if (picks.some((p) => keyOf(p) === keyOf(pick) || p.name.toLowerCase() === pick.name.toLowerCase())) return true;
    if (picks.length >= MAX) return false;

    picks.push(pick);
    savePicks();
    renderPicker();
    renderTable();
    refreshData();
    return true;
  }

  function removePick(index) {
    picks.splice(index, 1);
    savePicks();
    renderPicker();
    renderTable();
  }

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  function injectStyle() {
    if ($("cmp-style")) return;
    const style = document.createElement("style");
    style.id = "cmp-style";
    style.textContent = `
      .cmp-tabs { display: inline-flex; gap: 4px; padding: 4px; margin: 4px 0 6px; border: 1px solid var(--border, #e2e8f0); border-radius: 14px; background: var(--surface-2, rgba(148,163,184,.10)); }
      .cmp-tab { font: inherit; font-size: .9rem; font-weight: 600; cursor: pointer; border: 0; background: transparent; color: var(--text-muted, #64748b); padding: 8px 16px; border-radius: 10px; }
      .cmp-tab:hover { color: var(--text, inherit); }
      .cmp-tab.is-active { background: var(--primary, #6d5dfb); color: #fff; }
      .cmp-tab-n { display: inline-block; min-width: 18px; padding: 0 6px; margin-left: 4px; border-radius: 99px; font-size: .74rem; line-height: 18px; text-align: center; background: rgba(109,93,251,.15); color: var(--primary, #6d5dfb); }
      .cmp-tab.is-active .cmp-tab-n { background: rgba(255,255,255,.25); color: #fff; }
      .cmp-tab-n[hidden] { display: none; }
      .cmp-tray { position: sticky; bottom: 18px; z-index: 30; display: flex; align-items: center; gap: 10px; width: fit-content; max-width: calc(100% - 24px); margin: 18px auto 0; padding: 10px 12px 10px 18px; border-radius: 99px; border: 1px solid var(--border, #e2e8f0); background: var(--card-bg, #fff); box-shadow: 0 10px 30px rgba(15,23,42,.18); }
      .cmp-tray[hidden] { display: none; }
      .cmp-tray-txt { font-size: .88rem; font-weight: 600; }
      .cmp-tray-go { font: inherit; font-size: .86rem; font-weight: 700; cursor: pointer; border: 0; border-radius: 99px; padding: 8px 16px; background: var(--primary, #6d5dfb); color: #fff; }
      .cmp-tray-go:disabled { opacity: .5; cursor: not-allowed; }
      .cmp-tray-x { font: inherit; cursor: pointer; border: 0; background: transparent; color: var(--text-muted, #94a3b8); padding: 6px 8px; border-radius: 99px; }
      #results .unc-btn.is-on { border-color: var(--primary, #6d5dfb); background: rgba(109,93,251,.12); color: var(--primary, #6d5dfb); }
      .cmp-card { background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 22px; padding: 18px; margin-top: 18px; min-width: 0; }
      .cmp-card h3 { margin: 0 0 12px; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .cmp-in {
        width: 100%; box-sizing: border-box; font: inherit; font-size: .92rem; color: var(--text, inherit); background: var(--surface-2, transparent);
        border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 11px 14px; color-scheme: inherit;
      }
      .cmp-in:focus { outline: 2px solid rgba(109,93,251,.45); outline-offset: 1px; }
      .cmp-res { display: grid; gap: 6px; margin-top: 10px; }
      .cmp-opt {
        display: flex; justify-content: space-between; gap: 10px; align-items: center; text-align: left; cursor: pointer; font: inherit;
        border: 1px solid var(--border, #e2e8f0); background: transparent; color: inherit; border-radius: 12px; padding: 10px 14px;
      }
      .cmp-opt:hover:not(:disabled) { border-color: var(--primary, #6d5dfb); }
      .cmp-opt:disabled { opacity: .45; cursor: default; }
      .cmp-opt small { color: var(--text-muted, #94a3b8); }
      .cmp-saved { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
      .cmp-saved > span { font-size: .76rem; font-weight: 700; color: var(--text-muted, #94a3b8); }
      .cmp-chip {
        border: 1px solid var(--border, #e2e8f0); background: transparent; color: var(--text-muted, #64748b); font: inherit; font-size: .8rem; font-weight: 600;
        padding: 7px 12px; border-radius: 999px; cursor: pointer;
      }
      .cmp-chip:hover:not(:disabled) { border-color: var(--primary, #6d5dfb); color: var(--primary, #6d5dfb); }
      .cmp-chip:disabled { opacity: .45; cursor: default; }
      .cmp-msg { margin: 10px 0 0; font-size: .82rem; color: var(--text-muted, #94a3b8); min-height: 1em; }

      .cmp-scroll { overflow-x: auto; }
      .cmp-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 560px; }
      .cmp-table th, .cmp-table td { padding: 12px 14px; text-align: left; vertical-align: top; border-top: 1px solid var(--border, #e2e8f0); font-size: .9rem; }
      .cmp-table thead th { border-top: 0; }
      .cmp-table tbody th { font-size: .76rem; font-weight: 700; color: var(--text-muted, #94a3b8); width: 170px; position: sticky; left: 0; background: var(--card-bg, #fff); }
      .cmp-head b { display: block; font-size: 1rem; line-height: 1.3; overflow-wrap: anywhere; }
      .cmp-head small { display: block; color: var(--text-muted, #94a3b8); margin-top: 2px; }
      .cmp-head .cmp-x { margin-top: 8px; display: inline-flex; gap: 12px; flex-wrap: wrap; }
      .cmp-link { background: none; border: 0; padding: 0; cursor: pointer; font: inherit; font-size: .78rem; font-weight: 600; color: var(--primary, #6d5dfb); text-decoration: none; }
      .cmp-link:hover { text-decoration: underline; }
      .cmp-link.bad { color: #dc2626; }
      .cmp-link:focus-visible, .cmp-chip:focus-visible, .cmp-opt:focus-visible { outline: 2px solid var(--primary, #6d5dfb); outline-offset: 2px; }
      .cmp-best { background: rgba(16,185,129,.10); }
      .cmp-best b::after { content: " ★"; color: #10b981; font-size: .8em; }
      .cmp-ai { display: inline-block; margin-left: 6px; font-size: .64rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: rgba(245,158,11,.18); color: #b45309; vertical-align: middle; }
      html[data-theme="dark"] .cmp-ai { color: #fbbf24; }
      .cmp-range { display: block; font-size: .74rem; color: var(--text-muted, #94a3b8); margin-top: 2px; }
      .cmp-none { color: var(--text-muted, #94a3b8); }
      .cmp-foot { margin: 14px 0 0; font-size: .78rem; line-height: 1.5; color: var(--text-muted, #94a3b8); }
      .cmp-empty { text-align: center; padding: 36px 16px; color: var(--text-muted, #64748b); }
      .cmp-empty h3 { margin: 0 0 6px; color: var(--text, #111); text-transform: none; letter-spacing: 0; font-size: 1.05rem; }
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Page + nav
   * ------------------------------------------------------------------ */

  function build() {
    if ($("comparePage")) return true;

    const anchor = $("savedPage") || $("trackerPage") || document.querySelector(".page-section");
    if (!anchor) return false;

    injectStyle();

    const page = document.createElement("div");
    page.id = "comparePage";
    page.className = "page-section hidden";
    page.innerHTML = `
      <div class="page-header">
        <div>
          <span class="eyebrow">SAVED &middot; SIDE BY SIDE</span>
          <h1>Compare Universities</h1>
          <p>Tap “Compare” on any university card in the Finder (up to ${MAX}), or pick below.</p>
        </div>
      </div>

      <div class="cmp-card">
        <h3>Choose universities (<span id="cmp-count">0</span>/${MAX})</h3>
        <input class="cmp-in" id="cmp-search" type="search" placeholder="Search by university or country" autocomplete="off" aria-label="Search universities to compare">
        <div class="cmp-res" id="cmp-res"></div>
        <div class="cmp-saved" id="cmp-saved"></div>
        <p class="cmp-msg" id="cmp-msg" role="status"></p>
      </div>

      <div class="cmp-card" id="cmp-table"></div>
    `;

    anchor.parentElement.insertBefore(page, anchor);
    ensureTabs();
    bind(page);
    return true;
  }

  /* Saved | Compare tab bar, shown at the top of both pages. */
  function tabsHTML(active) {
    return (
      '<div class="cmp-tabs" data-cmp-tabs role="tablist">' +
      '<button type="button" role="tab" class="cmp-tab' + (active === "saved" ? " is-active" : "") + '" data-cmp-tab="saved" aria-selected="' + (active === "saved") + '">★ Saved</button>' +
      '<button type="button" role="tab" class="cmp-tab' + (active === "compare" ? " is-active" : "") + '" data-cmp-tab="compare" aria-selected="' + (active === "compare") + '">⚖ Compare <span class="cmp-tab-n" data-cmp-tab-n>0</span></button>' +
      "</div>"
    );
  }

  function ensureTabs() {
    [["savedPage", "saved"], ["comparePage", "compare"]].forEach(([id, active]) => {
      const page = $(id);
      if (!page || page.querySelector("[data-cmp-tabs]")) return;
      const header = page.querySelector(".page-header");
      const html = tabsHTML(active);
      if (header) header.insertAdjacentHTML("afterend", html);
      else page.insertAdjacentHTML("afterbegin", html);
    });
  }

  /* Floating tray on the University Finder: "2 of 3 selected - Compare now". */
  function ensureTray() {
    if ($("cmp-tray")) return;
    const finder = $("universityFinderPage");
    if (!finder) return;
    const tray = document.createElement("div");
    tray.id = "cmp-tray";
    tray.className = "cmp-tray";
    tray.hidden = true;
    tray.innerHTML =
      '<span class="cmp-tray-txt">⚖ <b data-cmp-tray-n>0</b> of ' + MAX + " selected to compare</span>" +
      '<button type="button" class="cmp-tray-go" data-cmp-open>Compare now</button>' +
      '<button type="button" class="cmp-tray-x" data-cmp-clear aria-label="Clear selection">✕</button>';
    finder.appendChild(tray);
  }

  function markSavedNav() {
    Array.prototype.forEach.call(document.querySelectorAll(".nav-btn"), (b) => {
      b.classList.toggle("active", /showPage\(['"]saved['"]/.test(b.getAttribute("onclick") || ""));
    });
  }

  const has = (name) => inPicks(name);

  function syncCardButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-action="compare"][data-name]'), (b) => {
      const on = has(b.dataset.name);
      b.classList.toggle("is-on", on);
      b.textContent = on ? "✓ Comparing" : "⚖ Compare";
    });
  }

  function notify() {
    ensureTabs();
    ensureTray();

    Array.prototype.forEach.call(document.querySelectorAll("[data-cmp-tab-n]"), (n) => {
      n.textContent = String(picks.length);
      n.hidden = picks.length === 0;
    });

    const tray = $("cmp-tray");
    if (tray) {
      tray.hidden = picks.length === 0;
      const n = tray.querySelector("[data-cmp-tray-n]");
      if (n) n.textContent = String(picks.length);
      const go = tray.querySelector("[data-cmp-open]");
      if (go) {
        go.disabled = picks.length < 2;
        go.textContent = picks.length < 2 ? "Pick 1 more" : "Compare now";
      }
    }

    syncCardButtons();
    window.dispatchEvent(new CustomEvent("uniai:compare-change"));
  }

  /** Add the university if it is not picked, remove it if it is. */
  function toggle(input) {
    const name = text(input && (input.name || input.displayName));
    if (!name) return { on: false, full: false };

    const i = picks.findIndex(
      (p) => p.name.toLowerCase() === name.toLowerCase() || (input.slug && keyOf(p) === String(input.slug).toLowerCase())
    );
    if (i >= 0) {
      removePick(i);
      return { on: false, full: false };
    }
    if (picks.length >= MAX) return { on: false, full: true };
    return { on: add(input), full: false };
  }

  function clearPicks() {
    picks = [];
    savePicks();
    renderPicker();
    renderTable();
  }

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */

  const inPicks = (name) => picks.some((p) => p.name.toLowerCase() === String(name).toLowerCase());

  function renderPicker() {
    if (!$("cmp-search")) return;

    $("cmp-count").textContent = String(picks.length);
    const full = picks.length >= MAX;

    // Saved universities not yet picked.
    const saved = savedUniversities().filter((s) => !inPicks(s.name));
    $("cmp-saved").innerHTML = saved.length
      ? `<span>From your Saved list:</span>` +
        saved
          .slice(0, 12)
          .map((s) => `<button type="button" class="cmp-chip" data-cmp-add="${esc(s.name)}" data-slug="${esc(s.slug || "")}" ${full ? "disabled" : ""}>＋ ${esc(s.name)}</button>`)
          .join("")
      : "";

    renderResults();
    $("cmp-msg").textContent = full ? `You are comparing ${MAX} universities. Remove one to add another.` : "";
  }

  function renderResults() {
    const box = $("cmp-res");
    const q = $("cmp-search").value.trim().toLowerCase();
    const full = picks.length >= MAX;

    if (!q) {
      box.innerHTML = "";
      return;
    }

    const list = finderList();
    if (!list.length) {
      box.innerHTML = `<p class="cmp-msg">The university list is still loading. Try again in a moment.</p>`;
      return;
    }

    const hits = list
      .filter((u) => `${raw(u, "name") || ""} ${u.country || ""}`.toLowerCase().includes(q))
      .sort((a, b) => (num(a.qs_rank) || 9999) - (num(b.qs_rank) || 9999))
      .slice(0, 8);

    box.innerHTML = hits.length
      ? hits
          .map((u) => {
            const name = text(raw(u, "name"));
            const taken = inPicks(name);
            return `<button type="button" class="cmp-opt" data-cmp-add="${esc(name)}" data-slug="${esc(u.slug || "")}" ${taken || full ? "disabled" : ""}><span>${esc(name)}</span><small>${esc(u.country || "")}${taken ? " · added" : ""}</small></button>`;
          })
          .join("")
      : `<p class="cmp-msg">No universities match "${esc($("cmp-search").value.trim())}".</p>`;
  }

  function renderTable() {
    const box = $("cmp-table");
    if (!box) return;

    if (picks.length < 2) {
      box.innerHTML = `<div class="cmp-empty"><h3>${picks.length ? "Add one more to compare" : "Nothing to compare yet"}</h3><p>Choose at least two universities above to see them side by side.</p></div>`;
      return;
    }

    const entries = picks.map((p) => loaded.get(keyOf(p)) || { loading: true });
    const recs = entries.map((e) => (e.rec ? e.rec : null));
    const rows = buildRows(recs);
    const anyAi = recs.some((r) => r && r._provenance && Object.keys(r._provenance).some((k) => r._provenance[k] === "ai"));
    const anyBasic = entries.some((e) => e.rec && !e.enriched);

    const head = picks
      .map((p, i) => {
        const e = entries[i];
        const rec = e.rec;
        const country = rec ? text(rec.country) : "";
        const site = rec ? safeUrl(rec.website) : "";
        const status = e.loading ? `<small>Loading…</small>` : e.error ? `<small>Details unavailable</small>` : country ? `<small>${esc(country)}</small>` : "";

        return `<th scope="col" class="cmp-head">
          <b>${esc(rec ? text(raw(rec, "name")) || p.name : p.name)}</b>${status}
          <span class="cmp-x">
            ${site ? `<a class="cmp-link" href="${esc(site)}" target="_blank" rel="noopener noreferrer">Website ↗</a>` : ""}
            ${window.UniAITracker && rec ? `<button type="button" class="cmp-link" data-cmp-track="${i}">Track application</button>` : ""}
            <button type="button" class="cmp-link bad" data-cmp-remove="${i}" aria-label="Remove ${esc(p.name)}">Remove</button>
          </span>
        </th>`;
      })
      .join("");

    const body = rows
      .map(
        (row) => `<tr><th scope="row">${esc(row.label)}</th>${row.cells
          .map((c) =>
            c
              ? `<td class="${c.best ? "cmp-best" : ""}"><b>${esc(c.shown)}</b>${c.ai ? `<span class="cmp-ai" title="Estimated by AI. Not official.">AI est.</span>` : ""}${c.range ? `<span class="cmp-range">likely ${esc(c.range)}</span>` : ""}</td>`
              : `<td><span class="cmp-none">Not listed</span></td>`
          )
          .join("")}</tr>`
      )
      .join("");

    box.innerHTML = `
      <div class="cmp-scroll">
        <table class="cmp-table">
          <thead><tr><th scope="col"></th>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <p class="cmp-foot">
        ★ marks the best value in rows where lower or higher is clearly better (rank, score, tuition, international students). Requirements are not ranked.
        ${anyAi ? "<br><b>AI est.</b> values are estimates, not official figures. Confirm them on the university's website before you decide." : ""}
        ${anyBasic ? "<br>Some universities show basic data only because their full details could not be loaded." : ""}
      </p>`;
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function bind(page) {
    page.addEventListener("input", (e) => {
      if (e.target.id === "cmp-search") renderResults();
    });

    page.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-cmp-add]");
      if (addBtn && !addBtn.disabled) {
        add({ name: addBtn.dataset.cmpAdd, slug: addBtn.dataset.slug });
        return;
      }

      const rem = e.target.closest("[data-cmp-remove]");
      if (rem) {
        removePick(Number(rem.dataset.cmpRemove));
        return;
      }

      const track = e.target.closest("[data-cmp-track]");
      if (track && window.UniAITracker) {
        const p = picks[Number(track.dataset.cmpTrack)];
        const entry = p && loaded.get(keyOf(p));
        const rec = entry && entry.rec;
        if (rec) {
          window.UniAITracker.add({ name: text(raw(rec, "name")) || p.name, country: text(rec.country), website: safeUrl(rec.website) });
          track.textContent = "Added to tracker ✓";
          track.disabled = true;
        }
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  async function open() {
    if (typeof window.showPage !== "function") return false;
    const ok = await window.showPage("compare");
    if (ok !== false) markSavedNav(); // Compare lives under Saved in the sidebar
    return ok;
  }

  function start() {
    loadPicks();
    if (!build()) return false;

    renderPicker();
    renderTable();
    refreshData();
    notify();

    document.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-cmp-tab]");
      if (tab) {
        e.preventDefault();
        if (tab.dataset.cmpTab === "compare") open();
        else if (typeof window.showPage === "function") window.showPage("saved");
        return;
      }
      if (e.target.closest("[data-cmp-open]")) {
        e.preventDefault();
        if (picks.length >= 2) open();
        return;
      }
      if (e.target.closest("[data-cmp-clear]")) {
        e.preventDefault();
        clearPicks();
      }
    });

    window.addEventListener("uniai:saved-change", renderPicker);
    window.addEventListener("storage", (e) => {
      if (e.key === STORE_KEY) {
        loadPicks();
        renderPicker();
        renderTable();
        refreshData();
        notify();
      }
    });

    // The Finder list and Saved items arrive a moment after boot.
    setTimeout(() => {
      renderPicker();
      refreshData();
      syncCardButtons();
    }, 1500);

    return true;
  }

  window.UniAICompare = { add, toggle, has, open, rows: buildRows };

  function boot() {
    if (start()) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (start() || ++tries > 20) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
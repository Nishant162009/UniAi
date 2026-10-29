/* ==========================================================================
   UniAI — Application Tracker (tracker.js)

   Add AFTER script.js, save.js and sync.js (and anywhere relative to
   notifications.js, which reads the same data):
     <script src="JS/tracker.js"></script>

   Needs NO changes to index.html. It injects:
   - NO sidebar button: it is opened from Home > Quick Tools (index.html)
   - the #trackerPage section (before #savedPage)
   - live numbers in the Workspace tiles (#workspace-application-count and
     #workspace-deadline-count) and the "View Applications" button

   Data: localStorage "uniai-tracker" (an array). Add that key to PERSONAL_KEYS
   in sync.js and it follows the person across devices.

   Other scripts can use:
     UniAITracker.add({ name, country, website, program, deadline })
     UniAITracker.list()
     UniAITracker.open()
   and listen for the "uniai:tracker-change" event on window.
   ========================================================================== */

(function () {
  "use strict";

  if (window.UniAITracker) return;

  const STORE_KEY = "uniai-tracker";
  const MAX_APPS = 100;

  const STATUSES = [
    { id: "shortlisted", label: "Shortlisted", color: "#64748b" },
    { id: "preparing", label: "Preparing", color: "#f59e0b" },
    { id: "submitted", label: "Submitted", color: "#3b82f6" },
    { id: "interview", label: "Interview", color: "#8b5cf6" },
    { id: "offer", label: "Offer", color: "#10b981" },
    { id: "rejected", label: "Rejected", color: "#ef4444" }
  ];
  const STATUS_IDS = STATUSES.map((s) => s.id);
  const OPEN_STATUSES = ["shortlisted", "preparing"]; // deadline still matters
  const ACTIVE_STATUSES = ["shortlisted", "preparing", "submitted", "interview"];

  const DEFAULT_DOCS = [
    "Transcripts",
    "Statement of purpose",
    "Recommendation letters",
    "Resume / CV",
    "English test score",
    "Passport",
    "Application fee paid"
  ];

  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

  /* ------------------------------------------------------------------ *
   * Dates
   * ------------------------------------------------------------------ */

  function parseDate(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ""));
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }

  function daysLeft(str) {
    const d = parseDate(str);
    if (!d) return null;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d.getTime() - start.getTime()) / 86400000);
  }

  function fmtDate(str) {
    const d = parseDate(str);
    return d ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  }

  /* ------------------------------------------------------------------ *
   * Storage
   * ------------------------------------------------------------------ */

  let apps = [];

  function clean(a) {
    if (!a || typeof a !== "object") return null;
    const name = clip(a.name, 120);
    if (!name) return null;

    let docs = Array.isArray(a.docs) ? a.docs : null;
    docs = docs
      ? docs
          .map((d) => ({ t: clip(d && d.t, 80), d: !!(d && d.d) }))
          .filter((d) => d.t)
          .slice(0, 30)
      : DEFAULT_DOCS.map((t) => ({ t, d: false }));

    return {
      id: clip(a.id, 40) || uid(),
      name,
      country: clip(a.country, 80),
      program: clip(a.program, 120),
      intake: clip(a.intake, 40),
      status: STATUS_IDS.indexOf(a.status) >= 0 ? a.status : "shortlisted",
      deadline: parseDate(a.deadline) ? a.deadline : "",
      fee: clip(a.fee, 30),
      url: safeUrl(a.url),
      notes: clip(a.notes, 600),
      docs,
      created: Number.isFinite(a.created) ? a.created : Date.now(),
      updated: Number.isFinite(a.updated) ? a.updated : Date.now()
    };
  }

  function safeUrl(u) {
    const s = clip(u, 300);
    if (!s) return "";
    try {
      const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (err) {
      return "";
    }
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      apps = (Array.isArray(raw) ? raw : []).map(clean).filter(Boolean).slice(0, MAX_APPS);
    } catch (err) {
      apps = [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(apps));
    } catch (err) {
      /* storage blocked: changes last for this page view only */
    }
    window.dispatchEvent(new CustomEvent("uniai:tracker-change"));
    renderAll();
  }

  /* ------------------------------------------------------------------ *
   * Derived numbers
   * ------------------------------------------------------------------ */

  function numbers() {
    const active = apps.filter((a) => ACTIVE_STATUSES.indexOf(a.status) >= 0).length;
    const due = apps.filter((a) => {
      if (OPEN_STATUSES.indexOf(a.status) < 0) return false;
      const n = daysLeft(a.deadline);
      return n !== null && n >= 0 && n <= 30;
    }).length;
    const offers = apps.filter((a) => a.status === "offer").length;
    return { total: apps.length, active, due, offers };
  }

  function updateWorkspace() {
    const n = numbers();
    const a = $("workspace-application-count");
    const d = $("workspace-deadline-count");
    if (a) a.textContent = `${n.active} active`;
    if (d) d.textContent = `${n.due} upcoming`;
  }

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  function injectStyle() {
    if ($("trk-style")) return;
    const style = document.createElement("style");
    style.id = "trk-style";
    style.textContent = `
      .trk-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .trk-btn {
        display: inline-flex; align-items: center; gap: 8px; border: 0; cursor: pointer;
        background: var(--primary, #6d5dfb); color: #fff; font: inherit; font-weight: 700; font-size: .9rem;
        padding: 11px 18px; border-radius: 14px;
      }
      .trk-btn:hover { filter: brightness(1.08); }
      .trk-btn.ghost { background: transparent; color: inherit; border: 1px solid var(--border, #e2e8f0); }
      .trk-btn.danger { background: transparent; color: #ef4444; border: 1px solid rgba(239,68,68,.45); }
      .trk-btn:focus-visible, .trk-chip:focus-visible, .trk-link:focus-visible { outline: 2px solid var(--primary, #6d5dfb); outline-offset: 2px; }

      .trk-stats { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin: 22px 0 18px; }
      .trk-stat { background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 18px; padding: 16px 18px; }
      .trk-stat b { display: block; font-size: 1.6rem; line-height: 1.1; }
      .trk-stat small { color: var(--text-muted, #94a3b8); font-weight: 600; font-size: .78rem; }

      .trk-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
      .trk-chip {
        border: 1px solid var(--border, #e2e8f0); background: transparent; color: var(--text-muted, #64748b);
        padding: 8px 14px; border-radius: 999px; font: inherit; font-size: .82rem; font-weight: 600; cursor: pointer;
      }
      .trk-chip:hover { border-color: var(--primary, #6d5dfb); color: var(--primary, #6d5dfb); }
      .trk-chip[aria-pressed="true"] { background: var(--primary, #6d5dfb); border-color: var(--primary, #6d5dfb); color: #fff; }

      .trk-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
      .trk-card {
        background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 20px;
        padding: 18px; display: flex; flex-direction: column; gap: 12px; min-width: 0; --c: #64748b;
      }
      .trk-card h3 { margin: 0; font-size: 1.02rem; line-height: 1.3; overflow-wrap: anywhere; }
      .trk-sub { margin: 2px 0 0; color: var(--text-muted, #94a3b8); font-size: .8rem; }
      .trk-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }

      .trk-status {
        appearance: none; -webkit-appearance: none; cursor: pointer; font: inherit; font-size: .78rem; font-weight: 700;
        color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent);
        border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); border-radius: 999px; padding: 6px 12px;
      }
      .trk-status option { color: var(--text, #111); background: var(--card-bg, #fff); }

      .trk-badge { font-size: .76rem; font-weight: 700; padding: 5px 10px; border-radius: 999px; background: rgba(148,163,184,.16); color: var(--text-muted, #64748b); }
      .trk-badge.warn { background: rgba(245,158,11,.16); color: #b45309; }
      .trk-badge.bad { background: rgba(239,68,68,.15); color: #dc2626; }
      html[data-theme="dark"] .trk-badge.warn { color: #fbbf24; }
      html[data-theme="dark"] .trk-badge.bad { color: #f87171; }

      .trk-bar { height: 6px; border-radius: 6px; background: rgba(148,163,184,.22); overflow: hidden; }
      .trk-bar i { display: block; height: 100%; border-radius: 6px; background: var(--primary, #6d5dfb); }
      .trk-docs summary { cursor: pointer; font-size: .8rem; font-weight: 600; color: var(--text-muted, #64748b); list-style: none; }
      .trk-docs summary::-webkit-details-marker { display: none; }
      .trk-docs summary::before { content: "▸ "; }
      .trk-docs[open] summary::before { content: "▾ "; }
      .trk-doc { display: flex; align-items: center; gap: 8px; font-size: .84rem; padding: 5px 0; cursor: pointer; }
      .trk-doc input { accent-color: var(--primary, #6d5dfb); }
      .trk-doc.done span { text-decoration: line-through; opacity: .6; }

      .trk-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 4px; }
      .trk-link { color: var(--primary, #6d5dfb); font-weight: 600; font-size: .82rem; text-decoration: none; background: none; border: 0; cursor: pointer; font-family: inherit; padding: 0; }
      .trk-link:hover { text-decoration: underline; }
      .trk-note { font-size: .8rem; color: var(--text-muted, #64748b); line-height: 1.45; overflow-wrap: anywhere; }

      .trk-empty { text-align: center; padding: 48px 20px; border: 1px dashed var(--border, #cbd5e1); border-radius: 20px; color: var(--text-muted, #64748b); }
      .trk-empty h3 { margin: 0 0 6px; color: var(--text, #111); }

      dialog.trk-dialog {
        border: 1px solid var(--border, #e2e8f0); border-radius: 22px; padding: 0; width: min(560px, calc(100vw - 24px));
        background: var(--card-bg, #fff); color: var(--text, #111); max-height: calc(100vh - 32px);
      }
      dialog.trk-dialog::backdrop { background: rgba(0,0,0,.5); }
      .trk-form { display: grid; gap: 14px; padding: 22px; }
      .trk-form h2 { margin: 0; font-size: 1.2rem; }
      .trk-form label { display: grid; gap: 6px; font-size: .78rem; font-weight: 700; color: var(--text-muted, #64748b); }
      .trk-form input, .trk-form select, .trk-form textarea {
        font: inherit; font-size: .92rem; font-weight: 400; color: var(--text, inherit); background: var(--surface-2, transparent);
        border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 10px 12px; box-sizing: border-box; width: 100%; color-scheme: inherit;
      }
      .trk-form input:focus, .trk-form select:focus, .trk-form textarea:focus { outline: 2px solid rgba(109,93,251,.45); outline-offset: 1px; }
      .trk-two { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
      .trk-actions { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
      .trk-actions > div { display: flex; gap: 10px; }
      .trk-err { color: #ef4444; font-size: .8rem; min-height: 1em; margin: 0; }
      @media (max-width: 520px) { .trk-two { grid-template-columns: 1fr; } .trk-grid { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Page + nav
   * ------------------------------------------------------------------ */

  let filter = "all";

  function build() {
    if ($("trackerPage")) return true;

    const saved = $("savedPage");
    const anySection = document.querySelector(".page-section");
    const host = saved || anySection;
    if (!host) return false;

    injectStyle();

    const page = document.createElement("div");
    page.id = "trackerPage";
    page.className = "page-section hidden";
    page.innerHTML = `
      <div class="page-header">
        <div class="trk-top">
          <div>
            <span class="eyebrow">YOUR APPLICATIONS</span>
            <h1>Application Tracker</h1>
            <p>Track every university you are applying to, its deadline and the documents still missing.</p>
          </div>
          <button type="button" class="trk-btn" id="trk-add">＋ Add application</button>
        </div>
      </div>
      <div class="trk-stats" id="trk-stats"></div>
      <div class="trk-filters" id="trk-filters" role="group" aria-label="Filter by status"></div>
      <div id="trk-list"></div>

      <dialog class="trk-dialog" id="trk-dialog" aria-labelledby="trk-title">
        <form class="trk-form" id="trk-form" novalidate>
          <h2 id="trk-title">Add application</h2>
          <input type="hidden" id="trk-id">
          <label>University
            <input id="trk-name" list="trk-unis" maxlength="120" autocomplete="off" required placeholder="Start typing a university">
            <datalist id="trk-unis"></datalist>
          </label>
          <div class="trk-two">
            <label>Country <input id="trk-country" maxlength="80"></label>
            <label>Program <input id="trk-program" maxlength="120" placeholder="e.g. MSc Computer Science"></label>
          </div>
          <div class="trk-two">
            <label>Intake <input id="trk-intake" maxlength="40" placeholder="e.g. Fall 2027"></label>
            <label>Deadline <input id="trk-deadline" type="date"></label>
          </div>
          <div class="trk-two">
            <label>Status <select id="trk-status">${STATUSES.map((s) => `<option value="${s.id}">${s.label}</option>`).join("")}</select></label>
            <label>Application fee <input id="trk-fee" maxlength="30" placeholder="e.g. $90"></label>
          </div>
          <label>Application portal link <input id="trk-url" maxlength="300" placeholder="https://"></label>
          <label>Notes <textarea id="trk-notes" rows="3" maxlength="600"></textarea></label>
          <p class="trk-err" id="trk-err" role="alert"></p>
          <div class="trk-actions">
            <button type="button" class="trk-btn danger" id="trk-delete" hidden>Delete</button>
            <div>
              <button type="button" class="trk-btn ghost" id="trk-cancel">Cancel</button>
              <button type="submit" class="trk-btn">Save</button>
            </div>
          </div>
        </form>
      </dialog>
    `;

    host.parentElement.insertBefore(page, saved || host);
    buildNav();
    bind(page);
    return true;
  }

  // Applications now lives in Home > Quick Tools, so no sidebar button is added.
  function buildNav() {}

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */

  const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];

  function sorted(list) {
    return list.slice().sort((a, b) => {
      const da = a.deadline || "9999-99-99";
      const db = b.deadline || "9999-99-99";
      return da === db ? a.name.localeCompare(b.name) : da < db ? -1 : 1;
    });
  }

  function deadlineBadge(a) {
    if (!a.deadline) return `<span class="trk-badge">No deadline set</span>`;
    const n = daysLeft(a.deadline);
    const date = esc(fmtDate(a.deadline));

    if (OPEN_STATUSES.indexOf(a.status) < 0) return `<span class="trk-badge">Deadline ${date}</span>`;
    if (n < 0) return `<span class="trk-badge bad">Overdue · ${date}</span>`;
    if (n === 0) return `<span class="trk-badge bad">Due today</span>`;
    if (n <= 7) return `<span class="trk-badge bad">${n} day${n === 1 ? "" : "s"} left · ${date}</span>`;
    if (n <= 30) return `<span class="trk-badge warn">${n} days left · ${date}</span>`;
    return `<span class="trk-badge">${n} days left · ${date}</span>`;
  }

  function cardHtml(a) {
    const st = statusOf(a.status);
    const done = a.docs.filter((d) => d.d).length;
    const pct = a.docs.length ? Math.round((done / a.docs.length) * 100) : 0;
    const sub = [a.program, a.country, a.intake].filter(Boolean).map(esc).join(" · ");

    return `
      <article class="trk-card" data-id="${esc(a.id)}" style="--c:${st.color}">
        <div class="trk-row" style="align-items:flex-start">
          <div style="min-width:0">
            <h3>${esc(a.name)}</h3>
            ${sub ? `<p class="trk-sub">${sub}</p>` : ""}
          </div>
          <select class="trk-status" data-trk="status" aria-label="Status for ${esc(a.name)}">
            ${STATUSES.map((s) => `<option value="${s.id}" ${s.id === a.status ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
        </div>

        <div class="trk-row">${deadlineBadge(a)}${a.fee ? `<span class="trk-sub">Fee: ${esc(a.fee)}</span>` : ""}</div>

        <div>
          <div class="trk-row" style="margin-bottom:6px"><span class="trk-sub">Documents</span><span class="trk-sub">${done}/${a.docs.length}</span></div>
          <div class="trk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        </div>

        <details class="trk-docs">
          <summary>Checklist</summary>
          ${a.docs
            .map(
              (d, i) => `<label class="trk-doc ${d.d ? "done" : ""}"><input type="checkbox" data-trk="doc" data-i="${i}" ${d.d ? "checked" : ""}><span>${esc(d.t)}</span></label>`
            )
            .join("")}
        </details>

        ${a.notes ? `<p class="trk-note">${esc(a.notes)}</p>` : ""}

        <div class="trk-foot">
          ${a.url ? `<a class="trk-link" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Open portal ↗</a>` : "<span></span>"}
          <button type="button" class="trk-link" data-trk="edit">Edit</button>
        </div>
      </article>`;
  }

  function renderAll() {
    updateWorkspace();

    const stats = $("trk-stats");
    if (!stats) return;

    const n = numbers();
    stats.innerHTML = `
      <div class="trk-stat"><b>${n.total}</b><small>Applications</small></div>
      <div class="trk-stat"><b>${n.active}</b><small>Active</small></div>
      <div class="trk-stat"><b>${n.due}</b><small>Due in 30 days</small></div>
      <div class="trk-stat"><b>${n.offers}</b><small>Offers</small></div>`;

    const count = (id) => apps.filter((a) => a.status === id).length;
    $("trk-filters").innerHTML =
      `<button type="button" class="trk-chip" data-trk-filter="all" aria-pressed="${filter === "all"}">All (${apps.length})</button>` +
      STATUSES.map((s) => `<button type="button" class="trk-chip" data-trk-filter="${s.id}" aria-pressed="${filter === s.id}">${s.label} (${count(s.id)})</button>`).join("");

    const list = sorted(filter === "all" ? apps : apps.filter((a) => a.status === filter));
    const box = $("trk-list");

    if (!apps.length) {
      box.innerHTML = `<div class="trk-empty"><h3>No applications yet</h3><p>Add the universities you plan to apply to and keep their deadlines and documents in one place.</p><button type="button" class="trk-btn" data-trk="add">＋ Add your first application</button></div>`;
    } else if (!list.length) {
      box.innerHTML = `<div class="trk-empty"><h3>Nothing with this status</h3><p>Change a card's status, or pick another filter.</p></div>`;
    } else {
      // Keep open checklists open across re-renders.
      const open = new Set(Array.prototype.map.call(box.querySelectorAll("details[open]"), (d) => d.closest(".trk-card").dataset.id));
      box.innerHTML = `<div class="trk-grid">${list.map(cardHtml).join("")}</div>`;
      open.forEach((id) => {
        const d = box.querySelector(`.trk-card[data-id="${CSS.escape(id)}"] details`);
        if (d) d.open = true;
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Dialog
   * ------------------------------------------------------------------ */

  function fillSuggestions() {
    const dl = $("trk-unis");
    if (!dl) return;
    try {
      const list = typeof state !== "undefined" && Array.isArray(state.universities) ? state.universities : [];
      dl.innerHTML = list
        .slice(0, 400)
        .map((u) => (u && u.name ? `<option value="${esc(u.name)}"></option>` : ""))
        .join("");
    } catch (err) {
      dl.innerHTML = "";
    }
  }

  function openDialog(app) {
    const dlg = $("trk-dialog");
    if (!dlg) return;

    fillSuggestions();
    $("trk-err").textContent = "";
    $("trk-title").textContent = app ? "Edit application" : "Add application";
    $("trk-delete").hidden = !app;

    const a = app || { id: "", name: "", country: "", program: "", intake: "", deadline: "", status: "shortlisted", fee: "", url: "", notes: "" };
    $("trk-id").value = a.id;
    $("trk-name").value = a.name;
    $("trk-country").value = a.country;
    $("trk-program").value = a.program;
    $("trk-intake").value = a.intake;
    $("trk-deadline").value = a.deadline;
    $("trk-status").value = a.status;
    $("trk-fee").value = a.fee;
    $("trk-url").value = a.url;
    $("trk-notes").value = a.notes;

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    $("trk-name").focus();
  }

  function closeDialog() {
    const dlg = $("trk-dialog");
    if (!dlg) return;
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }

  function submitForm(e) {
    e.preventDefault();

    const name = clip($("trk-name").value, 120);
    const err = $("trk-err");

    if (!name) {
      err.textContent = "Enter the university name.";
      $("trk-name").focus();
      return;
    }

    const rawUrl = $("trk-url").value.trim();
    if (rawUrl && !safeUrl(rawUrl)) {
      err.textContent = "That portal link doesn't look like a valid web address.";
      $("trk-url").focus();
      return;
    }

    const id = $("trk-id").value;
    const existing = id ? apps.find((a) => a.id === id) : null;

    if (!existing && apps.length >= MAX_APPS) {
      err.textContent = `You can track up to ${MAX_APPS} applications.`;
      return;
    }

    const next = clean({
      id: existing ? existing.id : uid(),
      name,
      country: $("trk-country").value,
      program: $("trk-program").value,
      intake: $("trk-intake").value,
      deadline: $("trk-deadline").value,
      status: $("trk-status").value,
      fee: $("trk-fee").value,
      url: rawUrl,
      notes: $("trk-notes").value,
      docs: existing ? existing.docs : null,
      created: existing ? existing.created : Date.now(),
      updated: Date.now()
    });

    if (existing) apps[apps.indexOf(existing)] = next;
    else apps.push(next);

    closeDialog();
    persist();
  }

  // Picking a known university fills country and website if those are empty.
  function onNameInput() {
    try {
      const list = typeof state !== "undefined" && Array.isArray(state.universities) ? state.universities : [];
      const typed = $("trk-name").value.trim().toLowerCase();
      const hit = list.find((u) => u && u.name && u.name.toLowerCase() === typed);
      if (!hit) return;
      if (!$("trk-country").value && hit.country) $("trk-country").value = hit.country;
      if (!$("trk-url").value && hit.website) $("trk-url").value = hit.website;
    } catch (err) {
      /* suggestions are optional */
    }
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function bind(page) {
    page.addEventListener("click", (e) => {
      const f = e.target.closest("[data-trk-filter]");
      if (f) {
        filter = f.dataset.trkFilter;
        renderAll();
        return;
      }

      if (e.target.closest("#trk-add") || e.target.closest('[data-trk="add"]')) {
        openDialog(null);
        return;
      }

      const edit = e.target.closest('[data-trk="edit"]');
      if (edit) {
        const app = apps.find((a) => a.id === edit.closest(".trk-card").dataset.id);
        if (app) openDialog(app);
        return;
      }

      if (e.target.closest("#trk-cancel")) {
        closeDialog();
        return;
      }

      if (e.target.closest("#trk-delete")) {
        const id = $("trk-id").value;
        const app = apps.find((a) => a.id === id);
        if (app && window.confirm(`Delete the application to ${app.name}?`)) {
          apps = apps.filter((a) => a.id !== id);
          closeDialog();
          persist();
        }
      }
    });

    page.addEventListener("change", (e) => {
      const card = e.target.closest(".trk-card");
      if (!card) return;
      const app = apps.find((a) => a.id === card.dataset.id);
      if (!app) return;

      if (e.target.matches('[data-trk="status"]')) {
        app.status = STATUS_IDS.indexOf(e.target.value) >= 0 ? e.target.value : app.status;
        app.updated = Date.now();
        persist();
      } else if (e.target.matches('[data-trk="doc"]')) {
        const doc = app.docs[Number(e.target.dataset.i)];
        if (doc) {
          doc.d = e.target.checked;
          app.updated = Date.now();
          persist();
        }
      }
    });

    $("trk-form").addEventListener("submit", submitForm);
    $("trk-name").addEventListener("change", onNameInput);
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  function open() {
    if (typeof window.showPage === "function") return window.showPage("tracker");
    return false;
  }

  function add(input) {
    const name = clip(input && input.name, 120);
    if (!name) return null;

    const dup = apps.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (dup) return dup;
    if (apps.length >= MAX_APPS) return null;

    const app = clean({
      name,
      country: input.country,
      program: input.program,
      deadline: input.deadline,
      url: input.website || input.url,
      status: "shortlisted"
    });
    apps.push(app);
    persist();
    return app;
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function start() {
    load();
    if (!build()) return false;
    renderAll();

    // The Workspace "View Applications" button.
    document.addEventListener("click", (e) => {
      if (e.target.closest("#launch-application-tracker")) open();
    });

    // Another device (sync) or another tab changed the data.
    const reload = () => {
      load();
      renderAll();
    };
    window.addEventListener("uniai:sync", reload);
    window.addEventListener("storage", (e) => {
      if (e.key === STORE_KEY || e.key === null) reload();
    });

    // Deadlines move with the calendar even if nothing is edited.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") renderAll();
    });

    return true;
  }

  load();
  window.UniAITracker = { add, open, list: () => apps.map((a) => Object.assign({}, a)) };

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
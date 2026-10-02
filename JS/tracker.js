/* ==========================================================================
   UniAI — Application Tracker (tracker.js)

   Load after uniai-ui.js, save.js and scholarship.js:
     <script src="JS/uniai-ui.js"></script>
     ...
     <script src="JS/tracker.js"></script>

   What it adds
   ------------
   - A Kanban board inside the Workspace page: Researching -> Preparing ->
     Submitted -> Interview -> Offer -> Closed (drag cards, or use the editor)
   - Per application: deadline, intake, program, portal link, notes and a
     document checklist
   - Calendar export (.ics) for one application or every deadline, with
     reminders 7 days and 1 day before
   - Live Workspace counters, an activity log, and the Workspace launch buttons
   - A "Workspace" item in the sidebar
   - Real notifications in the bell: deadlines that are close or missed,
     missing documents, and scholarship matches

   Storage: localStorage["uniai-tracker"]. Add that key to sync.js so it
   follows the account (see the sync.js change that came with this file).

   Other scripts can use:
     UniAITracker.add({ type, name, country, program, intake, deadline, url })
     UniAITracker.open(id) / UniAITracker.openNew(prefill)
   ========================================================================== */

(function () {
  "use strict";

  const UI = window.UniAIUI;

  if (!UI) {
    console.error("UniAI tracker: load uniai-ui.js before tracker.js.");
    return;
  }

  const { esc, slug, toast, daysUntil, formatDate, parseDateKey, toDateKey } = UI;

  /* ------------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------------ */

  const KEY = "uniai-tracker";
  const ACTIVITY_KEY = "uniai-tracker-activity";
  const MAX_ACTIVITY = 30;

  const STATUSES = [
    { id: "researching", label: "Researching", icon: "🔎", hint: "Shortlisted, not started" },
    { id: "preparing", label: "Preparing", icon: "📝", hint: "Writing & collecting documents" },
    { id: "submitted", label: "Submitted", icon: "📤", hint: "Waiting for a decision" },
    { id: "interview", label: "Interview", icon: "🎤", hint: "Interview or assessment" },
    { id: "offer", label: "Offer", icon: "🎉", hint: "Admitted or awarded" },
    { id: "closed", label: "Closed", icon: "📁", hint: "Rejected or withdrawn" }
  ];

  const STATUS_IDS = new Set(STATUSES.map((s) => s.id));
  const NEEDS_ACTION = new Set(["researching", "preparing"]); // deadline still matters
  const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));

  const INTAKES = ["Fall 2026", "Spring 2027", "Fall 2027", "Spring 2028", "Fall 2028"];

  const UNI_DOCS = [
    "Statement of Purpose",
    "Letters of Recommendation",
    "Academic transcripts",
    "Resume / CV",
    "English test score (IELTS / TOEFL)",
    "Passport copy",
    "Application fee paid"
  ];

  const SCHOLARSHIP_DOCS = [
    "Application form",
    "Personal statement / essay",
    "Recommendation letters",
    "Academic transcripts",
    "Proof of citizenship",
    "Proof of English proficiency"
  ];

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */

  let items = [];
  let activity = [];
  let view = { search: "", type: "all" };
  let scholarshipMatches = null; // { eligible, check, total } from scholarship.js
  let editorState = null;

  const byId = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ------------------------------------------------------------------------
     Storage
     ------------------------------------------------------------------------ */

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("UniAI tracker: could not save.", err);
    }
  }

  const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

  function safeUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";

    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
    } catch (err) {
      return "";
    }
  }

  function getPrefs() {
    try {
      return window.UniAIPreferences ? window.UniAIPreferences.get() : null;
    } catch (err) {
      return null;
    }
  }

  function defaultDocs(type) {
    const prefs = getPrefs();
    const labels = (type === "scholarship" ? SCHOLARSHIP_DOCS : UNI_DOCS).slice();

    if (type !== "scholarship" && prefs) {
      if (prefs.tests && prefs.tests.gre) labels.splice(4, 0, "GRE score report");
      if (prefs.degree === "PhD") labels.splice(1, 0, "Research proposal");
    }

    return labels.map((label, i) => ({ id: `d${i}${Math.random().toString(36).slice(2, 5)}`, label, done: false }));
  }

  function cleanDocs(docs, type) {
    if (!Array.isArray(docs)) return defaultDocs(type);

    return docs
      .map((d, i) => ({
        id: str(d && d.id, 20) || `d${i}${Math.random().toString(36).slice(2, 5)}`,
        label: str(d && d.label, 90),
        done: Boolean(d && d.done)
      }))
      .filter((d) => d.label);
  }

  function clean(raw) {
    if (!raw || typeof raw !== "object") return null;

    const name = str(raw.name, 140);
    if (!name) return null;

    const type = raw.type === "scholarship" ? "scholarship" : "university";

    return {
      id: str(raw.id, 30) || uid(),
      type,
      name,
      country: str(raw.country, 80),
      program: str(raw.program, 120),
      intake: str(raw.intake, 40),
      status: STATUS_IDS.has(raw.status) ? raw.status : "researching",
      deadline: parseDateKey(raw.deadline) ? raw.deadline : "",
      url: safeUrl(raw.url),
      notes: str(raw.notes, 2000),
      docs: cleanDocs(raw.docs, type),
      createdAt: Number(raw.createdAt) || Date.now(),
      updatedAt: Number(raw.updatedAt) || Date.now()
    };
  }

  function load() {
    const stored = readJSON(KEY, []);
    items = (Array.isArray(stored) ? stored : []).map(clean).filter(Boolean);
    activity = readJSON(ACTIVITY_KEY, []);
    if (!Array.isArray(activity)) activity = [];
  }

  function persist() {
    writeJSON(KEY, items);
    window.dispatchEvent(new CustomEvent("uniai:tracker-change", { detail: { count: items.length } }));
    renderAll();
  }

  /* ------------------------------------------------------------------------
     Activity log
     ------------------------------------------------------------------------ */

  function log(text) {
    activity.unshift({ t: Date.now(), text });
    activity = activity.slice(0, MAX_ACTIVITY);
    writeJSON(ACTIVITY_KEY, activity);
  }

  function ago(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d}d ago` : new Date(ts).toLocaleDateString();
  }

  /* ------------------------------------------------------------------------
     Core operations
     ------------------------------------------------------------------------ */

  function find(id) {
    return items.find((i) => i.id === id) || null;
  }

  function findByName(name, type = "university") {
    const s = slug(name);
    return items.find((i) => i.type === type && slug(i.name) === s) || null;
  }

  function add(rec, opts = {}) {
    const draft = clean(Object.assign({}, rec, { id: undefined }));
    if (!draft) return { item: null, created: false };

    const existing = findByName(draft.name, draft.type);

    if (existing) {
      if (!opts.silent) {
        toast(`“${existing.name}” is already in your tracker`, {
          action: { label: "Open", onClick: () => openTracker(existing.id) }
        });
      }
      return { item: existing, created: false };
    }

    items.push(draft);
    log(`Added ${draft.name} to your tracker`);
    persist();

    if (!opts.silent) {
      toast(`Added “${draft.name}” to your tracker`, {
        action: { label: "Open", onClick: () => openTracker(draft.id) }
      });
    }

    return { item: draft, created: true };
  }

  function update(id, patch) {
    const current = find(id);
    if (!current) return null;

    const next = clean(Object.assign({}, current, patch, { id: current.id, createdAt: current.createdAt }));
    if (!next) return null;

    next.updatedAt = Date.now();

    if (next.status !== current.status) {
      log(`${next.name}: ${STATUS_LABEL[current.status]} → ${STATUS_LABEL[next.status]}`);
    }

    items[items.indexOf(current)] = next;
    persist();
    return next;
  }

  function remove(id) {
    const current = find(id);
    if (!current) return;

    items = items.filter((i) => i.id !== id);
    log(`Removed ${current.name} from your tracker`);
    persist();
  }

  function move(id, status) {
    const current = find(id);
    if (!current || !STATUS_IDS.has(status) || current.status === status) return;
    update(id, { status });
  }

  /* ------------------------------------------------------------------------
     Derived data
     ------------------------------------------------------------------------ */

  const docsDone = (item) => item.docs.filter((d) => d.done).length;
  const docsMissing = (item) => item.docs.filter((d) => !d.done).length;

  function dueInfo(item) {
    const d = daysUntil(item.deadline);
    if (d === null) return { tone: "none", text: "No deadline set", days: null };

    const action = NEEDS_ACTION.has(item.status);
    const date = formatDate(item.deadline);

    if (d < 0) {
      return {
        tone: action ? "overdue" : "past",
        text: `${date} · ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago`,
        days: d
      };
    }

    if (d === 0) return { tone: "soon", text: `${date} · today`, days: d };
    if (d === 1) return { tone: "soon", text: `${date} · tomorrow`, days: d };

    return {
      tone: d <= 7 && action ? "soon" : d <= 30 && action ? "near" : "ok",
      text: `${date} · in ${d} days`,
      days: d
    };
  }

  function stats() {
    const active = items.filter((i) => i.status !== "offer" && i.status !== "closed");

    const upcoming = items.filter((i) => {
      const d = daysUntil(i.deadline);
      return NEEDS_ACTION.has(i.status) && d !== null && d >= 0 && d <= 30;
    });

    const overdue = items.filter((i) => {
      const d = daysUntil(i.deadline);
      return NEEDS_ACTION.has(i.status) && d !== null && d < 0;
    });

    const totalDocs = items.reduce((n, i) => n + i.docs.length, 0);
    const doneDocs = items.reduce((n, i) => n + docsDone(i), 0);

    return {
      total: items.length,
      active: active.length,
      upcoming: upcoming.length,
      overdue: overdue.length,
      offers: items.filter((i) => i.status === "offer").length,
      docsPercent: totalDocs ? Math.round((doneDocs / totalDocs) * 100) : 0,
      scholarships: items.filter((i) => i.type === "scholarship").length
    };
  }

  /* ------------------------------------------------------------------------
     Calendar export (.ics)
     ------------------------------------------------------------------------ */

  function icsEscape(text) {
    return String(text == null ? "" : text)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  /** RFC 5545: lines are at most 75 octets; continuation lines start with a space. */
  function foldLine(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;

    let out = "";
    let cur = "";
    let bytes = 0;

    for (const ch of line) {
      const b = enc.encode(ch).length;

      if (bytes + b > 75) {
        out += `${cur}\r\n`;
        cur = " ";
        bytes = 1;
      }

      cur += ch;
      bytes += b;
    }

    return out + cur;
  }

  const compact = (key) => key.replace(/-/g, "");

  function utcStamp(date) {
    const p = (n) => String(n).padStart(2, "0");
    return (
      `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
      `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
    );
  }

  function eventLines(item, stamp) {
    const start = parseDateKey(item.deadline);
    if (!start) return [];

    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);

    const missing = item.docs.filter((d) => !d.done).map((d) => `- ${d.label}`);

    const description = [
      `${item.type === "scholarship" ? "Scholarship" : "University"} application`,
      item.program ? `Program: ${item.program}` : "",
      item.intake ? `Intake: ${item.intake}` : "",
      `Status: ${STATUS_LABEL[item.status]}`,
      item.url ? `Portal: ${item.url}` : "",
      missing.length ? `\nStill to do:\n${missing.join("\n")}` : "\nAll documents ready.",
      "\nTracked in UniAI"
    ]
      .filter(Boolean)
      .join("\n");

    const lines = [
      "BEGIN:VEVENT",
      `UID:${item.id}@uniai`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(item.deadline)}`,
      `DTEND;VALUE=DATE:${compact(toDateKey(end))}`,
      `SUMMARY:${icsEscape(`Deadline: ${item.name}`)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      "CATEGORIES:UniAI",
      "TRANSP:TRANSPARENT"
    ];

    if (item.url) lines.push(`URL:${item.url}`);

    [
      ["-P7D", "due in 1 week"],
      ["-P1D", "due tomorrow"]
    ].forEach(([trigger, label]) => {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(`${item.name} is ${label}`)}`,
        `TRIGGER:${trigger}`,
        "END:VALARM"
      );
    });

    lines.push("END:VEVENT");
    return lines;
  }

  function buildICS(list) {
    const stamp = utcStamp(new Date());

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//UniAI//Application Tracker//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:UniAI deadlines"
    ];

    list.forEach((item) => lines.push(...eventLines(item, stamp)));
    lines.push("END:VCALENDAR");

    return lines.map(foldLine).join("\r\n") + "\r\n";
  }

  function downloadText(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportICS(target) {
    const list = (Array.isArray(target) ? target : [target]).filter((i) => i && parseDateKey(i.deadline));

    if (!list.length) {
      toast("Set a deadline first, then export it to your calendar.");
      return false;
    }

    const name = list.length === 1 ? `deadline-${slug(list[0].name)}` : "uniai-deadlines";
    downloadText(`${name}.ics`, "text/calendar;charset=utf-8", buildICS(list));
    toast(`Calendar file ready · ${list.length} deadline${list.length === 1 ? "" : "s"}`);
    return true;
  }

  function exportAll() {
    const list = items
      .filter((i) => i.deadline && i.status !== "closed")
      .sort((a, b) => a.deadline.localeCompare(b.deadline));

    exportICS(list);
  }

  /* ------------------------------------------------------------------------
     Styles
     ------------------------------------------------------------------------ */

  function injectStyles() {
    if (byId("trk-css")) return;

    const style = document.createElement("style");
    style.id = "trk-css";
    style.textContent = `
.trk{margin:28px 0;padding:26px;border:1px solid var(--uai-border);border-radius:24px;background:var(--uai-bg);color:var(--uai-text)}
.trk-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px}
.trk-kicker{font-size:.68rem;font-weight:800;letter-spacing:.16em;color:var(--uai-primary)}
.trk-head h2{margin:4px 0 2px;font-size:1.5rem;letter-spacing:-.02em}
.trk-head p{margin:0;color:var(--uai-muted);font-size:.88rem}
.trk-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.trk-tools .uai-input{width:200px;min-height:38px}
.trk-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:20px 0 18px}
.trk-stat{padding:12px 14px;border:1px solid var(--uai-border);border-radius:14px;background:var(--uai-panel)}
.trk-stat strong{display:block;font-size:1.35rem;letter-spacing:-.02em}
.trk-stat span{font-size:.72rem;color:var(--uai-muted)}
.trk-stat.warn strong{color:var(--uai-warn)}
.trk-stat.bad strong{color:var(--uai-bad)}
.trk-board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(250px,1fr);gap:14px;padding-bottom:8px;overflow-x:auto;scroll-snap-type:x proximity}
.trk-col{display:flex;flex-direction:column;gap:10px;min-height:150px;padding:12px;border:1px dashed transparent;border-radius:18px;background:var(--uai-panel);scroll-snap-align:start;transition:border-color .15s,background .15s}
.trk-col.drop{border-color:var(--uai-primary);background:var(--uai-primary-soft)}
.trk-col-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 4px}
.trk-col-head strong{font-size:.85rem}
.trk-col-head small{display:block;color:var(--uai-muted);font-size:.68rem;font-weight:400}
.trk-count{min-width:24px;padding:2px 8px;border-radius:999px;background:var(--uai-bg);border:1px solid var(--uai-border);font-size:.72rem;font-weight:700;text-align:center}
.trk-cards{display:flex;flex-direction:column;gap:10px;flex:1}
.trk-card{display:flex;flex-direction:column;gap:8px;padding:14px;border:1px solid var(--uai-border);border-radius:15px;background:var(--uai-bg);cursor:grab;transition:transform .15s,box-shadow .15s,border-color .15s}
.trk-card:hover{transform:translateY(-2px);border-color:var(--uai-primary);box-shadow:0 10px 26px rgba(109,93,251,.12)}
.trk-card:focus-visible{outline:2px solid var(--uai-primary);outline-offset:2px}
.trk-card.dragging{opacity:.45}
.trk-card h4{margin:0;font-size:.92rem;line-height:1.3;overflow-wrap:anywhere}
.trk-card-top{display:flex;gap:9px;align-items:flex-start}
.trk-type{font-size:1.05rem;line-height:1.3}
.trk-meta{color:var(--uai-muted);font-size:.76rem;overflow-wrap:anywhere}
.trk-due{display:inline-flex;align-items:center;gap:6px;width:fit-content;padding:3px 9px;border-radius:999px;border:1px solid var(--uai-border);font-size:.72rem;font-weight:700;color:var(--uai-muted)}
.trk-due.ok{color:var(--uai-good);border-color:rgba(16,185,129,.35)}
.trk-due.near{color:var(--uai-warn);border-color:rgba(245,158,11,.4)}
.trk-due.soon{color:var(--uai-warn);background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.5)}
.trk-due.overdue{color:var(--uai-bad);background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.45)}
.trk-docs{display:flex;align-items:center;gap:8px;font-size:.72rem;color:var(--uai-muted)}
.trk-bar{flex:1;height:6px;border-radius:999px;background:var(--uai-border);overflow:hidden}
.trk-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6d5dfb,#10b981)}
.trk-card-actions{display:flex;gap:6px;margin-top:2px}
.trk-card-actions .uai-btn{flex:1}
.trk-empty{display:flex;flex-direction:column;align-items:center;gap:10px;margin:8px 0;padding:42px 20px;border:1px dashed var(--uai-border);border-radius:20px;text-align:center}
.trk-empty .big{font-size:2.4rem}
.trk-empty h3{margin:0}
.trk-empty p{max-width:460px;margin:0;color:var(--uai-muted);font-size:.9rem}
.trk-none{padding:18px 8px;text-align:center;color:var(--uai-muted);font-size:.76rem}
.trk-docs-list{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.trk-doc{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--uai-border);border-radius:10px}
.trk-doc input[type=checkbox]{width:17px;height:17px;accent-color:var(--uai-primary)}
.trk-doc label{flex:1;font-size:.86rem;cursor:pointer}
.trk-doc.done label{color:var(--uai-muted);text-decoration:line-through}
.trk-doc button{border:0;background:none;color:var(--uai-muted);font-size:16px;cursor:pointer}
.trk-doc button:hover{color:var(--uai-bad)}
.trk-adddoc{display:flex;gap:8px;margin-top:8px}
.trk-err{min-height:18px;margin-top:10px;color:var(--uai-bad);font-size:.8rem}
.trk-segment{display:inline-flex;padding:3px;border:1px solid var(--uai-border);border-radius:11px;background:var(--uai-panel)}
.trk-segment button{border:0;padding:7px 14px;border-radius:8px;background:transparent;color:var(--uai-muted);font:inherit;font-size:.82rem;font-weight:600;cursor:pointer}
.trk-segment button.on{background:var(--uai-bg);color:var(--uai-primary);box-shadow:0 1px 4px rgba(0,0,0,.12)}
.activity-row{display:flex;gap:12px;align-items:flex-start;padding:10px 4px;border-bottom:1px solid var(--uai-border)}
.activity-row:last-child{border-bottom:0}
.activity-dot{width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--uai-primary);flex:0 0 auto}
.activity-row p{margin:0;font-size:.88rem}
.activity-row small{color:var(--uai-muted)}
.trk-alert{cursor:pointer}
.trk-alert:hover{color:var(--uai-primary)}
@media (max-width:640px){.trk{padding:18px}.trk-tools .uai-input{width:100%}.trk-board{grid-auto-columns:82%}}
`;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
     Board rendering
     ------------------------------------------------------------------------ */

  function matchesView(item) {
    if (view.type !== "all" && item.type !== view.type) return false;

    const q = view.search.trim().toLowerCase();
    if (!q) return true;

    return [item.name, item.country, item.program, item.intake, STATUS_LABEL[item.status]]
      .join(" ")
      .toLowerCase()
      .includes(q);
  }

  function cardHTML(item) {
    const due = dueInfo(item);
    const done = docsDone(item);
    const total = item.docs.length;
    const percent = total ? Math.round((done / total) * 100) : 0;

    const idx = STATUSES.findIndex((s) => s.id === item.status);
    const next = STATUSES[idx + 1];

    const meta = [item.country && `📍 ${item.country}`, item.program, item.intake].filter(Boolean).join(" · ");

    return `
<article class="trk-card" draggable="true" tabindex="0" data-id="${esc(item.id)}" aria-label="${esc(item.name)}, ${esc(STATUS_LABEL[item.status])}">
  <div class="trk-card-top">
    <span class="trk-type" aria-hidden="true">${item.type === "scholarship" ? "💰" : "🎓"}</span>
    <h4>${esc(item.name)}</h4>
  </div>
  ${meta ? `<div class="trk-meta">${esc(meta)}</div>` : ""}
  <span class="trk-due ${due.tone}">⏰ ${esc(due.text)}</span>
  <div class="trk-docs">
    <div class="trk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>
    <span>${done}/${total} docs</span>
  </div>
  <div class="trk-card-actions">
    <button type="button" class="uai-btn small" data-trk="open">Open</button>
    <button type="button" class="uai-btn small" data-trk="ics" title="Add deadline to calendar" aria-label="Add deadline to calendar">📅</button>
    ${next ? `<button type="button" class="uai-btn small" data-trk="next" title="Move to ${esc(next.label)}">→ ${esc(next.label)}</button>` : ""}
  </div>
</article>`;
  }

  function renderBoard() {
    const board = byId("trk-board");
    const empty = byId("trk-empty");
    if (!board || !empty) return;

    const visible = items.filter(matchesView);

    empty.hidden = items.length > 0;
    board.hidden = items.length === 0;

    if (!items.length) return;

    board.innerHTML = STATUSES.map((status) => {
      const cards = visible
        .filter((i) => i.status === status.id)
        .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));

      return `
<div class="trk-col" data-status="${status.id}">
  <div class="trk-col-head">
    <strong>${status.icon} ${esc(status.label)}<small>${esc(status.hint)}</small></strong>
    <span class="trk-count">${cards.length}</span>
  </div>
  <div class="trk-cards">
    ${cards.map(cardHTML).join("") || '<div class="trk-none">Drop an application here</div>'}
  </div>
</div>`;
    }).join("");
  }

  function renderStats() {
    const el = byId("trk-stats");
    if (!el) return;

    const s = stats();

    el.innerHTML = `
<div class="trk-stat"><strong>${s.total}</strong><span>Tracked</span></div>
<div class="trk-stat"><strong>${s.active}</strong><span>In progress</span></div>
<div class="trk-stat ${s.upcoming ? "warn" : ""}"><strong>${s.upcoming}</strong><span>Due in 30 days</span></div>
<div class="trk-stat ${s.overdue ? "bad" : ""}"><strong>${s.overdue}</strong><span>Overdue</span></div>
<div class="trk-stat"><strong>${s.docsPercent}%</strong><span>Documents ready</span></div>
<div class="trk-stat"><strong>${s.offers}</strong><span>Offers</span></div>`;
  }

  function renderCounters() {
    const s = stats();

    const savedUnis = window.UniAISaved
      ? window.UniAISaved.list().filter((i) => i.type === "university").length
      : 0;

    const set = (id, text) => {
      const el = byId(id);
      if (el) el.textContent = text;
    };

    set("workspace-university-count", `${savedUnis} saved`);
    set("workspace-application-count", `${s.active} active`);
    set("workspace-deadline-count", `${s.upcoming} upcoming`);
    set("workspace-scholarship-count", `${s.scholarships} tracked`);
  }

  function renderActivity() {
    const list = byId("workspace-activity-list");
    if (!list) return;

    if (!activity.length) {
      list.innerHTML = '<div class="empty-activity"><span>✦</span><p>Your recent activity will appear here.</p></div>';
      return;
    }

    list.innerHTML = activity
      .map(
        (a) =>
          `<div class="activity-row"><span class="activity-dot"></span><div><p>${esc(a.text)}</p><small>${esc(ago(a.t))}</small></div></div>`
      )
      .join("");
  }

  /* ------------------------------------------------------------------------
     Notifications (the bell)
     ------------------------------------------------------------------------ */

  function notificationsOn(kind) {
    const prefs = getPrefs();
    return !prefs || !prefs.notifications || prefs.notifications[kind] !== false;
  }

  function buildAlerts() {
    const alerts = [];

    if (notificationsOn("deadlines")) {
      items.forEach((item) => {
        if (!NEEDS_ACTION.has(item.status)) return;

        const d = daysUntil(item.deadline);
        if (d === null) return;

        if (d < 0) {
          alerts.push({
            rank: d,
            id: item.id,
            text: `⚠️ ${item.name}: deadline passed ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago`
          });
        } else if (d <= 14) {
          const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
          const missing = docsMissing(item);

          alerts.push({
            rank: d,
            id: item.id,
            text: `⏰ ${item.name}: deadline ${when}${missing ? ` · ${missing} document${missing === 1 ? "" : "s"} missing` : ""}`
          });
        }
      });
    }

    alerts.sort((a, b) => a.rank - b.rank);

    if (scholarshipMatches && scholarshipMatches.eligible > 0 && notificationsOn("scholarships")) {
      alerts.push({
        rank: 999,
        page: "scholarships",
        text: `🎓 ${scholarshipMatches.eligible} scholarship${scholarshipMatches.eligible === 1 ? "" : "s"} look eligible for you`
      });
    }

    return alerts.slice(0, 8);
  }

  function renderNotifications() {
    const panel = byId("notif-panel");
    const dot = document.querySelector(".notif-dot");
    const alerts = buildAlerts();

    if (dot) {
      dot.textContent = String(alerts.length);
      dot.style.display = alerts.length ? "" : "none";
    }

    if (!panel) return;

    panel.innerHTML =
      "<strong>Notifications</strong>" +
      (alerts.length
        ? alerts
            .map(
              (a) =>
                `<p class="trk-alert" role="button" tabindex="0" ${a.id ? `data-alert-id="${esc(a.id)}"` : ""} ${a.page ? `data-alert-page="${esc(a.page)}"` : ""}>${esc(a.text)}</p>`
            )
            .join("")
        : "<p>You're all caught up. 🎉</p>");
  }

  /* ------------------------------------------------------------------------
     Editor (add / edit)
     ------------------------------------------------------------------------ */

  function knownUniversityNames() {
    const names = new Set();

    try {
      if (typeof state !== "undefined" && state && Array.isArray(state.universities)) {
        state.universities.forEach((u) => u && u.name && names.add(u.name));
      }
    } catch (err) {
      /* ignore */
    }

    if (window.UniAISaved) {
      window.UniAISaved.list().forEach((i) => i.type === "university" && names.add(i.name));
    }

    return Array.from(names).slice(0, 300);
  }

  function knownUniversity(name) {
    try {
      if (typeof state !== "undefined" && state && Array.isArray(state.universities)) {
        const n = String(name).toLowerCase();
        return state.universities.find((u) => String(u.name || "").toLowerCase() === n) || null;
      }
    } catch (err) {
      /* ignore */
    }
    return null;
  }

  function docsHTML(docs) {
    if (!docs.length) return '<div class="trk-none">No documents yet. Add the ones this application needs.</div>';

    return docs
      .map(
        (d) => `
<div class="trk-doc ${d.done ? "done" : ""}" data-doc="${esc(d.id)}">
  <input type="checkbox" id="doc-${esc(d.id)}" ${d.done ? "checked" : ""}>
  <label for="doc-${esc(d.id)}">${esc(d.label)}</label>
  <button type="button" data-doc-remove="${esc(d.id)}" aria-label="Remove ${esc(d.label)}">×</button>
</div>`
      )
      .join("");
  }

  function editorHTML(draft, isNew) {
    const intakes = INTAKES.includes(draft.intake) || !draft.intake ? INTAKES : [draft.intake, ...INTAKES];
    const names = draft.type === "university" ? knownUniversityNames() : [];

    return `
<div class="uai-dialog" role="dialog" aria-modal="true" aria-labelledby="trk-title">
  <div class="uai-dialog-head">
    <div>
      <h2 id="trk-title">${isNew ? "Add application" : esc(draft.name)}</h2>
      <p>${isNew ? "Track a university or scholarship, its deadline and documents." : `${STATUS_LABEL[draft.status]} · last updated ${esc(ago(draft.updatedAt))}`}</p>
    </div>
    <button type="button" class="uai-x" data-ed="close" aria-label="Close">×</button>
  </div>

  <div class="uai-dialog-body">
    ${
      isNew
        ? `<div class="trk-segment" role="group" aria-label="Type">
             <button type="button" data-ed-type="university" class="${draft.type === "university" ? "on" : ""}">🎓 University</button>
             <button type="button" data-ed-type="scholarship" class="${draft.type === "scholarship" ? "on" : ""}">💰 Scholarship</button>
           </div>`
        : ""
    }

    <div class="uai-row">
      <div class="uai-field"><label for="trk-name">Name *</label>
        <input id="trk-name" class="uai-input" list="trk-name-list" maxlength="140" value="${esc(draft.name)}" placeholder="${draft.type === "scholarship" ? "e.g. Chevening Scholarship" : "e.g. University of Toronto"}" autocomplete="off">
        <datalist id="trk-name-list">${names.map((n) => `<option value="${esc(n)}"></option>`).join("")}</datalist>
      </div>
      <div class="uai-field"><label for="trk-country">Country</label>
        <input id="trk-country" class="uai-input" maxlength="80" value="${esc(draft.country)}" placeholder="e.g. Canada"></div>
    </div>

    <div class="uai-row">
      <div class="uai-field"><label for="trk-program">Program</label>
        <input id="trk-program" class="uai-input" maxlength="120" value="${esc(draft.program)}" placeholder="e.g. MS Computer Science"></div>
      <div class="uai-field"><label for="trk-intake">Intake</label>
        <select id="trk-intake" class="uai-input"><option value="">Not set</option>${intakes
          .map((i) => `<option value="${esc(i)}" ${i === draft.intake ? "selected" : ""}>${esc(i)}</option>`)
          .join("")}</select></div>
    </div>

    <div class="uai-row">
      <div class="uai-field"><label for="trk-status">Status</label>
        <select id="trk-status" class="uai-input">${STATUSES.map(
          (s) => `<option value="${s.id}" ${s.id === draft.status ? "selected" : ""}>${s.icon} ${esc(s.label)}</option>`
        ).join("")}</select></div>
      <div class="uai-field"><label for="trk-deadline">Deadline</label>
        <input id="trk-deadline" class="uai-input" type="date" value="${esc(draft.deadline)}"></div>
    </div>

    <div class="uai-field"><label for="trk-url">Application portal / link</label>
      <input id="trk-url" class="uai-input" type="url" value="${esc(draft.url)}" placeholder="https://"></div>

    <div class="uai-field"><span class="uai-label">Documents <span id="trk-doc-count"></span></span>
      <div class="trk-docs-list" id="trk-docs">${docsHTML(draft.docs)}</div>
      <div class="trk-adddoc">
        <input id="trk-newdoc" class="uai-input" maxlength="90" placeholder="Add a document, e.g. Portfolio">
        <button type="button" class="uai-btn" data-ed="adddoc">Add</button>
      </div>
    </div>

    <div class="uai-field"><label for="trk-notes">Notes</label>
      <textarea id="trk-notes" class="uai-input" maxlength="2000" placeholder="Requirements, contacts, ideas…">${esc(draft.notes)}</textarea></div>

    <div class="trk-err" id="trk-err" role="alert"></div>
  </div>

  <div class="uai-dialog-foot">
    ${isNew ? "" : '<button type="button" class="uai-btn danger" data-ed="delete">Remove</button>'}
    <button type="button" class="uai-btn" data-ed="ics">📅 Add to calendar</button>
    ${draft.url ? `<a class="uai-btn" href="${esc(draft.url)}" target="_blank" rel="noopener noreferrer">Open portal ↗</a>` : ""}
    <span class="grow"></span>
    <button type="button" class="uai-btn" data-ed="close">Cancel</button>
    <button type="button" class="uai-btn primary" data-ed="save">${isNew ? "Add to tracker" : "Save changes"}</button>
  </div>
</div>`;
  }

  function collectEditor() {
    const val = (id) => {
      const el = byId(id);
      return el ? el.value : "";
    };

    const d = editorState.draft;

    d.name = val("trk-name").trim();
    d.country = val("trk-country").trim();
    d.program = val("trk-program").trim();
    d.intake = val("trk-intake");
    d.status = val("trk-status");
    d.deadline = val("trk-deadline");
    d.url = val("trk-url").trim();
    d.notes = val("trk-notes");

    return d;
  }

  function refreshDocsUI() {
    const list = byId("trk-docs");
    if (list) list.innerHTML = docsHTML(editorState.draft.docs);

    const count = byId("trk-doc-count");
    if (count) {
      const docs = editorState.draft.docs;
      count.textContent = docs.length ? `· ${docs.filter((x) => x.done).length}/${docs.length} ready` : "";
    }
  }

  function openEditor(id, prefill = {}) {
    closeEditor();
    UI.ensureStyles();

    const existing = id ? find(id) : null;
    const type = existing ? existing.type : prefill.type === "scholarship" ? "scholarship" : "university";

    const draft = existing
      ? JSON.parse(JSON.stringify(existing))
      : {
          type,
          name: "",
          country: "",
          program: "",
          intake: "",
          status: "researching",
          deadline: "",
          url: "",
          notes: "",
          ...prefill,
          docs: cleanDocs(prefill.docs, type)
        };

    editorState = { id: existing ? existing.id : null, draft, docsTouched: Boolean(existing), opener: document.activeElement };

    const overlay = document.createElement("div");
    overlay.id = "trk-overlay";
    overlay.className = "uai-overlay";
    overlay.innerHTML = editorHTML(draft, !existing);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    refreshDocsUI();

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeEditor();
    });

    overlay.addEventListener("click", onEditorClick);
    overlay.addEventListener("change", onEditorChange);
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeEditor();
      else if (e.key === "Tab") UI.trapFocus(e, overlay.querySelector(".uai-dialog"));
      else if (e.key === "Enter" && e.target.id === "trk-newdoc") {
        e.preventDefault();
        addDocFromInput();
      }
    });

    const first = byId("trk-name");
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 40);
  }

  function closeEditor() {
    const overlay = byId("trk-overlay");
    if (overlay) overlay.remove();

    document.body.style.overflow = "";

    if (editorState && editorState.opener && typeof editorState.opener.focus === "function") {
      try {
        editorState.opener.focus({ preventScroll: true });
      } catch (err) {
        /* ignore */
      }
    }

    editorState = null;
  }

  function addDocFromInput() {
    const input = byId("trk-newdoc");
    const label = input ? input.value.trim() : "";
    if (!label) return;

    editorState.draft.docs.push({ id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, label: label.slice(0, 90), done: false });
    editorState.docsTouched = true;
    input.value = "";
    refreshDocsUI();
    input.focus();
  }

  function showEditorError(message) {
    const el = byId("trk-err");
    if (el) el.textContent = message;
  }

  async function onEditorClick(e) {
    const typeBtn = e.target.closest("[data-ed-type]");

    if (typeBtn && editorState && !editorState.id) {
      collectEditor();
      editorState.draft.type = typeBtn.dataset.edType;

      if (!editorState.docsTouched) editorState.draft.docs = defaultDocs(editorState.draft.type);

      const overlay = byId("trk-overlay");
      overlay.innerHTML = editorHTML(editorState.draft, true);
      refreshDocsUI();
      return;
    }

    const removeDoc = e.target.closest("[data-doc-remove]");

    if (removeDoc) {
      editorState.draft.docs = editorState.draft.docs.filter((d) => d.id !== removeDoc.dataset.docRemove);
      editorState.docsTouched = true;
      refreshDocsUI();
      return;
    }

    const action = e.target.closest("[data-ed]");
    if (!action) return;

    switch (action.dataset.ed) {
      case "close":
        closeEditor();
        break;

      case "adddoc":
        addDocFromInput();
        break;

      case "ics": {
        const d = collectEditor();
        exportICS(Object.assign({}, d, { id: editorState.id || "new" }));
        break;
      }

      case "delete": {
        const current = find(editorState.id);
        if (!current) break;

        const ok = await UI.confirm(`“${current.name}” and its checklist will be removed from your tracker.`, {
          title: "Remove application?",
          confirmText: "Remove",
          cancelText: "Keep it"
        });

        if (ok) {
          remove(current.id);
          closeEditor();
          toast(`Removed “${current.name}”`);
        }
        break;
      }

      case "save":
        saveEditor();
        break;
    }
  }

  function onEditorChange(e) {
    if (!editorState) return;

    const row = e.target.closest("[data-doc]");

    if (row && e.target.type === "checkbox") {
      const doc = editorState.draft.docs.find((d) => d.id === row.dataset.doc);
      if (doc) doc.done = e.target.checked;
      editorState.docsTouched = true;
      refreshDocsUI();
      return;
    }

    // Picking a known university fills in its country.
    if (e.target.id === "trk-name" && editorState.draft.type === "university") {
      const uni = knownUniversity(e.target.value);
      const country = byId("trk-country");

      if (uni && country && !country.value.trim()) {
        country.value = uni.country || "";
        const url = byId("trk-url");
        if (url && !url.value.trim() && uni.website) url.value = uni.website;
      }
    }
  }

  function saveEditor() {
    const d = collectEditor();

    if (!d.name) {
      showEditorError("Give this application a name.");
      byId("trk-name").focus();
      return;
    }

    if (d.deadline && !parseDateKey(d.deadline)) {
      showEditorError("That deadline isn't a valid date.");
      return;
    }

    if (d.url && !safeUrl(d.url)) {
      showEditorError("The portal link should be a web address, like https://example.edu.");
      return;
    }

    if (editorState.id) {
      update(editorState.id, d);
      toast("Changes saved");
    } else {
      const result = add(d, { silent: true });

      if (!result.created) {
        showEditorError(`“${d.name}” is already in your tracker.`);
        return;
      }

      toast(`Added “${d.name}” to your tracker`);
    }

    closeEditor();
  }

  /* ------------------------------------------------------------------------
     Workspace panel
     ------------------------------------------------------------------------ */

  function mountPanel() {
    if (byId("tracker-panel")) return true;

    const page = byId("workspacePage");
    const root = (page && page.querySelector(".workspace")) || page;
    if (!root) return false;

    const panel = document.createElement("section");
    panel.id = "tracker-panel";
    panel.className = "trk";
    panel.setAttribute("aria-label", "Application tracker");

    panel.innerHTML = `
<div class="trk-head">
  <div>
    <span class="trk-kicker">APPLICATION TRACKER</span>
    <h2>Your applications</h2>
    <p>Status, deadlines and documents for every university and scholarship. Drag a card to move it.</p>
  </div>
  <div class="trk-tools">
    <input id="trk-search" class="uai-input" type="search" placeholder="Search applications…" aria-label="Search applications">
    <select id="trk-type" class="uai-input" style="width:auto" aria-label="Filter by type">
      <option value="all">All</option><option value="university">Universities</option><option value="scholarship">Scholarships</option>
    </select>
    <button type="button" class="uai-btn" id="trk-export">📅 Export deadlines</button>
    <button type="button" class="uai-btn primary" id="trk-add">+ Add application</button>
  </div>
</div>

<div class="trk-stats" id="trk-stats"></div>

<div class="trk-board" id="trk-board" hidden></div>

<div class="trk-empty" id="trk-empty">
  <div class="big">📋</div>
  <h3>Nothing tracked yet</h3>
  <p>Add the universities and scholarships you're applying to. UniAI will keep their deadlines and documents in one place and warn you before a deadline slips.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
    <button type="button" class="uai-btn primary" data-trk-empty="add">+ Add application</button>
    <button type="button" class="uai-btn" data-trk-empty="finder">Browse universities</button>
  </div>
  <p style="font-size:.8rem">Tip: use the <strong>Track</strong> button on university and scholarship cards.</p>
</div>`;

    const recent = root.querySelector(".workspace-recent");

    if (recent && recent.parentNode) recent.parentNode.insertBefore(panel, recent);
    else root.appendChild(panel);

    bindPanel(panel);
    return true;
  }

  function bindPanel(panel) {
    byId("trk-add").addEventListener("click", () => openEditor(null));
    byId("trk-export").addEventListener("click", exportAll);

    byId("trk-search").addEventListener("input", (e) => {
      view.search = e.target.value;
      renderBoard();
    });

    byId("trk-type").addEventListener("change", (e) => {
      view.type = e.target.value;
      renderBoard();
    });

    panel.addEventListener("click", (e) => {
      const empty = e.target.closest("[data-trk-empty]");

      if (empty) {
        if (empty.dataset.trkEmpty === "add") openEditor(null);
        else if (typeof window.showPage === "function") window.showPage("universityFinder");
        return;
      }

      const card = e.target.closest(".trk-card");
      if (!card) return;

      const item = find(card.dataset.id);
      if (!item) return;

      const action = e.target.closest("[data-trk]");

      if (action && action.dataset.trk === "ics") {
        exportICS(item);
      } else if (action && action.dataset.trk === "next") {
        const idx = STATUSES.findIndex((s) => s.id === item.status);
        if (STATUSES[idx + 1]) move(item.id, STATUSES[idx + 1].id);
      } else {
        openEditor(item.id);
      }
    });

    panel.addEventListener("keydown", (e) => {
      const card = e.target.closest(".trk-card");
      if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openEditor(card.dataset.id);
      }
    });

    // Drag and drop between columns
    panel.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".trk-card");
      if (!card) return;

      e.dataTransfer.setData("text/plain", card.dataset.id);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });

    panel.addEventListener("dragend", () => {
      $$(".trk-card.dragging, .trk-col.drop", panel).forEach((el) => el.classList.remove("dragging", "drop"));
    });

    panel.addEventListener("dragover", (e) => {
      const col = e.target.closest(".trk-col");
      if (!col) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      $$(".trk-col.drop", panel).forEach((el) => el !== col && el.classList.remove("drop"));
      col.classList.add("drop");
    });

    panel.addEventListener("drop", (e) => {
      const col = e.target.closest(".trk-col");
      if (!col) return;

      e.preventDefault();
      col.classList.remove("drop");

      const id = e.dataTransfer.getData("text/plain");
      if (id) move(id, col.dataset.status);
    });
  }

  function openTracker(highlightId) {
    const go = () => {
      const panel = byId("tracker-panel");
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });

      if (highlightId) {
        const card = document.querySelector(`.trk-card[data-id="${CSS.escape(highlightId)}"]`);
        if (card) card.focus({ preventScroll: true });
      }
    };

    if (typeof window.showPage === "function") {
      Promise.resolve(window.showPage("workspace")).then(() => setTimeout(go, 120));
    } else {
      go();
    }
  }

  /* ------------------------------------------------------------------------
     Workspace buttons + sidebar item
     ------------------------------------------------------------------------ */

  function bindWorkspaceButtons() {
    const go = (page) => () => typeof window.showPage === "function" && window.showPage(page);

    const map = {
      "launch-university-finder": go("universityFinder"),
      "launch-sop-studio": go("sopStudio"),
      "launch-ai-chat": go("ai-chat"),
      "launch-scholarship-finder": go("scholarships"),
      "launch-visa-planner": go("visaGuide"),
      "launch-application-tracker": () => {
        const panel = byId("tracker-panel");
        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      "workspace-new-btn": () => openEditor(null),
      "workspace-search-btn": () => {
        const s = byId("trk-search");
        if (s) {
          s.scrollIntoView({ behavior: "smooth", block: "center" });
          s.focus({ preventScroll: true });
        }
      },
      "clear-workspace-activity": async () => {
        if (!activity.length) return;

        const ok = await UI.confirm("This only clears the activity list. Your applications stay as they are.", {
          title: "Clear recent activity?",
          confirmText: "Clear",
          cancelText: "Keep"
        });

        if (ok) {
          activity = [];
          writeJSON(ACTIVITY_KEY, activity);
          renderActivity();
        }
      }
    };

    Object.entries(map).forEach(([id, handler]) => {
      const el = byId(id);
      if (el && !el.dataset.trkBound) {
        el.dataset.trkBound = "1";
        el.addEventListener("click", handler);
      }
    });
  }

  function injectNavItem() {
    if (document.querySelector('.nav-btn[onclick*="workspace"], [data-nav="workspace"]')) return;

    const nav = document.querySelector(".sidebar-nav");
    if (!nav) return;

    const link = document.createElement("a");
    link.href = "#";
    link.className = "nav-btn";
    link.dataset.nav = "workspace";
    link.innerHTML =
      '<svg class="nav-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg> Workspace';

    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof window.showPage === "function") window.showPage("workspace", e);
    });

    const roadmap = nav.querySelector('.nav-btn[onclick*="roadmap"]');

    if (roadmap && roadmap.nextSibling) nav.insertBefore(link, roadmap.nextSibling);
    else nav.appendChild(link);
  }

  /* ------------------------------------------------------------------------
     Render + start
     ------------------------------------------------------------------------ */

  function renderAll() {
    renderBoard();
    renderStats();
    renderCounters();
    renderActivity();
    renderNotifications();
  }

  function init() {
    load();
    injectStyles();
    UI.ensureStyles();

    mountPanel();
    bindWorkspaceButtons();
    injectNavItem();
    renderAll();

    // Alerts and counters depend on dates, so refresh them now and then.
    setInterval(() => {
      renderStats();
      renderNotifications();
    }, 60 * 60 * 1000);

    document.addEventListener("click", (e) => {
      const alert = e.target.closest(".trk-alert");
      if (!alert) return;

      const panel = byId("notif-panel");
      if (panel) panel.classList.add("hidden");

      if (alert.dataset.alertId) openTracker(alert.dataset.alertId);
      else if (alert.dataset.alertPage && typeof window.showPage === "function") window.showPage(alert.dataset.alertPage);
    });

    window.addEventListener("uniai:saved-change", renderCounters);
    window.addEventListener("uniai:preferences", renderNotifications);

    window.addEventListener("uniai:scholarship-matches", (e) => {
      scholarshipMatches = e.detail || null;
      renderNotifications();
    });

    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        load();
        renderAll();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && editorState) closeEditor();
    });
  }

  /* ------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------ */

  window.UniAITracker = {
    add,
    update,
    remove,
    move,
    find,
    findByName,
    list: () => items.slice(),
    stats,
    open: (id) => openEditor(id),
    openNew: (prefill) => openEditor(null, prefill || {}),
    openTracker,
    exportICS,
    exportAll,
    // exposed for tests
    _buildICS: buildICS,
    _dueInfo: dueInfo
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
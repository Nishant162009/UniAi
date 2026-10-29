/* ==========================================================================
   UniAI — Deadline Calendar (calendar.js)

   Add AFTER tracker.js:
     <script src="JS/calendar.js"></script>

   Needs NO changes to index.html. It injects the #calendarPage section.
   It has no sidebar button: it is opened from Home > Quick Tools (index.html).

   What it shows (real data only, nothing invented)
   - Application deadlines from the Application Tracker ("uniai-tracker")
   - Deadlines of scholarships on the Saved list (the "deadline:..." tag)

   What it does
   - Month grid with previous / next / today, and a panel for the picked day
   - "Coming up" list for the next 60 days, plus anything overdue
   - Download every deadline as an .ics file (Apple, Google, Outlook), with
     reminders 7 days and 1 day before
   - "Add to Google Calendar" link for one deadline
   ========================================================================== */

(function () {
  "use strict";

  if (window.UniAICalendar) return;

  const TRACKER_KEY = "uniai-tracker";
  const OPEN = ["shortlisted", "preparing"];
  const DAY = 86400000;
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ------------------------------------------------------------------ *
   * Dates
   * ------------------------------------------------------------------ */

  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  function fromKey(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }

  function mk(y, m, d) {
    const dt = new Date(y, m, d);
    return dt.getMonth() === m ? dt : null;
  }

  /** "2027-01-15", "15/01/2027", "15 January 2027", "January 15, 2027". Anything else -> null. */
  function parseLoose(text) {
    const t = String(text || "").trim();
    if (!t) return null;

    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return mk(+m[1], +m[2] - 1, +m[3]);

    m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return mk(+m[3], +m[2] - 1, +m[1]);

    m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
    if (m) {
      const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
      if (mi >= 0) return mk(+m[3], mi, +m[1]);
    }

    m = t.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
    if (m) {
      const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
      if (mi >= 0) return mk(+m[3], mi, +m[2]);
    }

    return null;
  }

  const fmtLong = (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function collect() {
    const out = [];

    try {
      const apps = JSON.parse(localStorage.getItem(TRACKER_KEY) || "[]");
      (Array.isArray(apps) ? apps : []).forEach((a) => {
        const d = a && fromKey(a.deadline);
        if (!d || !a.name) return;
        out.push({
          id: `app-${a.id}`,
          kind: "application",
          title: `${a.name} application`,
          detail: [a.program, a.country].filter(Boolean).join(" · "),
          status: a.status,
          open: OPEN.indexOf(a.status) >= 0,
          date: d,
          page: "tracker"
        });
      });
    } catch (err) {
      /* unreadable tracker data: show scholarships only */
    }

    try {
      const saved = window.UniAISaved && typeof window.UniAISaved.list === "function" ? window.UniAISaved.list() : [];
      saved.forEach((item) => {
        if (!item || item.type !== "scholarship") return;
        const tag = (item.tags || []).find((t) => /^deadline:/i.test(t));
        const d = tag && parseLoose(tag.replace(/^deadline:\s*/i, ""));
        if (!d) return;
        out.push({
          id: `sch-${item.id}`,
          kind: "scholarship",
          title: `${item.name} (scholarship)`,
          detail: "Saved scholarship",
          status: "open",
          open: true,
          date: d,
          page: "saved"
        });
      });
    } catch (err) {
      /* saved list not ready yet */
    }

    return out.sort((a, b) => a.date - b.date || a.title.localeCompare(b.title));
  }

  /* ------------------------------------------------------------------ *
   * .ics export
   * ------------------------------------------------------------------ */

  const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

  function fold(line) {
    const out = [];
    let rest = line;
    while (rest.length > 72) {
      out.push(rest.slice(0, 72));
      rest = " " + rest.slice(72);
    }
    out.push(rest);
    return out.join("\r\n");
  }

  const compact = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  function buildIcs(events) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UniAI//Deadlines//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:UniAI deadlines"];

    events.forEach((e) => {
      const next = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate() + 1);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${e.id}-${compact(e.date)}@uniai`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(e.date)}`,
        `DTEND;VALUE=DATE:${compact(next)}`,
        `SUMMARY:${icsText("Deadline: " + e.title)}`,
        `DESCRIPTION:${icsText(e.detail || "Deadline saved in UniAI")}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsText("Deadline in 7 days: " + e.title)}`,
        "TRIGGER:-P7D",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsText("Deadline tomorrow: " + e.title)}`,
        "TRIGGER:-P1D",
        "END:VALARM",
        "END:VEVENT"
      );
    });

    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  function exportable() {
    const today = midnight(new Date());
    return collect().filter((e) => e.open && e.date >= today);
  }

  function download() {
    const events = exportable();
    const note = $("cal-note");

    if (!events.length) {
      if (note) note.textContent = "There are no upcoming open deadlines to export yet.";
      return;
    }

    const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uniai-deadlines.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (note) note.textContent = `Exported ${events.length} deadline${events.length === 1 ? "" : "s"}. Open the file to add them to your calendar.`;
  }

  function googleLink(e) {
    const next = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate() + 1);
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: `Deadline: ${e.title}`,
      dates: `${compact(e.date)}/${compact(next)}`,
      details: e.detail || "Deadline saved in UniAI"
    });
    return `https://calendar.google.com/calendar/render?${q.toString()}`;
  }

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  function injectStyle() {
    if ($("cal-style")) return;
    const style = document.createElement("style");
    style.id = "cal-style";
    style.textContent = `
      .cal-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .cal-btn {
        display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--border, #e2e8f0); cursor: pointer;
        background: transparent; color: inherit; font: inherit; font-weight: 700; font-size: .85rem; padding: 10px 16px; border-radius: 12px;
      }
      .cal-btn:hover { border-color: var(--primary, #6d5dfb); color: var(--primary, #6d5dfb); }
      .cal-btn.solid { background: var(--primary, #6d5dfb); border-color: var(--primary, #6d5dfb); color: #fff; }
      .cal-btn.solid:hover { color: #fff; filter: brightness(1.08); }
      .cal-btn:focus-visible, .cal-day:focus-visible, .cal-link:focus-visible { outline: 2px solid var(--primary, #6d5dfb); outline-offset: 2px; }

      .cal-layout { display: grid; gap: 18px; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); margin-top: 20px; align-items: start; }
      @media (max-width: 900px) { .cal-layout { grid-template-columns: 1fr; } }

      .cal-card { background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 22px; padding: 18px; min-width: 0; }
      .cal-card + .cal-card { margin-top: 18px; }
      .cal-card h3 { margin: 0 0 12px; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }

      .cal-nav { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
      .cal-nav strong { font-size: 1.1rem; }
      .cal-nav div { display: flex; gap: 6px; }
      .cal-nav .cal-btn { padding: 7px 12px; }

      .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
      .cal-wd { text-align: center; font-size: .7rem; font-weight: 700; color: var(--text-muted, #94a3b8); padding: 4px 0 6px; }
      .cal-day {
        position: relative; min-height: 64px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: inherit;
        font: inherit; cursor: pointer; padding: 6px; text-align: left; display: flex; flex-direction: column; gap: 4px;
      }
      .cal-day:hover { background: rgba(109,93,251,.08); }
      .cal-day.out { opacity: .38; }
      .cal-day.today .cal-n { background: var(--primary, #6d5dfb); color: #fff; }
      .cal-day.sel { border-color: var(--primary, #6d5dfb); background: rgba(109,93,251,.10); }
      .cal-n { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; font-size: .78rem; font-weight: 700; }
      .cal-dots { display: flex; flex-wrap: wrap; gap: 3px; }
      .cal-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary, #6d5dfb); }
      .cal-dot.sch { background: #f59e0b; }
      .cal-dot.late { background: #ef4444; }
      .cal-dot.done { opacity: .35; }
      .cal-more { font-size: .65rem; color: var(--text-muted, #94a3b8); }
      @media (max-width: 520px) { .cal-day { min-height: 48px; padding: 4px; } }

      .cal-legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: .76rem; color: var(--text-muted, #94a3b8); margin-top: 12px; }
      .cal-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; background: var(--primary, #6d5dfb); }
      .cal-legend i.sch { background: #f59e0b; } .cal-legend i.late { background: #ef4444; }

      .cal-ev { display: flex; gap: 12px; padding: 11px 0; border-top: 1px solid var(--border, #e2e8f0); }
      .cal-ev:first-of-type { border-top: 0; }
      .cal-ev .cal-dot { margin-top: 6px; flex: 0 0 auto; }
      .cal-ev b { display: block; font-size: .9rem; line-height: 1.3; overflow-wrap: anywhere; }
      .cal-ev small { display: block; color: var(--text-muted, #94a3b8); font-size: .76rem; margin-top: 2px; }
      .cal-ev.done b { text-decoration: line-through; opacity: .65; }
      .cal-links { display: flex; gap: 12px; margin-top: 6px; flex-wrap: wrap; }
      .cal-link { background: none; border: 0; padding: 0; cursor: pointer; font: inherit; font-size: .78rem; font-weight: 600; color: var(--primary, #6d5dfb); text-decoration: none; }
      .cal-link:hover { text-decoration: underline; }
      .cal-late { color: #dc2626; font-weight: 700; }
      html[data-theme="dark"] .cal-late { color: #f87171; }
      .cal-empty { margin: 0; color: var(--text-muted, #94a3b8); font-size: .85rem; line-height: 1.5; }
      .cal-note { font-size: .78rem; color: var(--text-muted, #94a3b8); margin: 12px 0 0; min-height: 1em; }
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Page + nav
   * ------------------------------------------------------------------ */

  let view = midnight(new Date()); // any day inside the month shown
  view = new Date(view.getFullYear(), view.getMonth(), 1);
  let picked = keyOf(new Date());

  function build() {
    if ($("calendarPage")) return true;

    const anchor = $("trackerPage") || $("savedPage") || document.querySelector(".page-section");
    if (!anchor) return false;

    injectStyle();

    const page = document.createElement("div");
    page.id = "calendarPage";
    page.className = "page-section hidden";
    page.innerHTML = `
      <div class="page-header">
        <div class="cal-top">
          <div>
            <span class="eyebrow">YOUR DEADLINES</span>
            <h1>Deadline Calendar</h1>
            <p>Application and scholarship deadlines in one view, ready to add to your own calendar.</p>
          </div>
          <button type="button" class="cal-btn solid" id="cal-export">⬇ Add all to my calendar (.ics)</button>
        </div>
        <p class="cal-note" id="cal-note" role="status"></p>
      </div>

      <div class="cal-layout">
        <div class="cal-card">
          <div class="cal-nav">
            <strong id="cal-title"></strong>
            <div>
              <button type="button" class="cal-btn" data-cal="prev" aria-label="Previous month">‹</button>
              <button type="button" class="cal-btn" data-cal="today">Today</button>
              <button type="button" class="cal-btn" data-cal="next" aria-label="Next month">›</button>
            </div>
          </div>
          <div class="cal-grid" id="cal-grid"></div>
          <div class="cal-legend">
            <span><i></i>Application</span><span><i class="sch"></i>Scholarship</span><span><i class="late"></i>Overdue</span>
          </div>
        </div>

        <div>
          <div class="cal-card"><h3 id="cal-day-title">Selected day</h3><div id="cal-day"></div></div>
          <div class="cal-card"><h3>Coming up</h3><div id="cal-soon"></div></div>
        </div>
      </div>
    `;

    anchor.parentElement.insertBefore(page, anchor.nextSibling);
    buildNav();
    bind(page);
    return true;
  }

  // Calendar now lives in Home > Quick Tools, so no sidebar button is added.
  function buildNav() {}

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */

  function dotClass(e, today) {
    const late = e.open && e.date < today;
    return `cal-dot${e.kind === "scholarship" ? " sch" : ""}${late ? " late" : ""}${e.open ? "" : " done"}`;
  }

  function eventHtml(e, today, withDate) {
    const n = Math.round((e.date - today) / DAY);
    const when = !e.open
      ? ""
      : n < 0
        ? `<span class="cal-late">Overdue by ${-n} day${n === -1 ? "" : "s"}</span>`
        : n === 0
          ? `<span class="cal-late">Due today</span>`
          : `${n} day${n === 1 ? "" : "s"} left`;

    return `
      <div class="cal-ev${e.open ? "" : " done"}">
        <span class="${dotClass(e, today)}"></span>
        <div>
          <b>${esc(e.title)}</b>
          <small>${withDate ? esc(fmtLong(e.date)) + (when ? " · " : "") : ""}${when}${e.detail ? (withDate || when ? " · " : "") + esc(e.detail) : ""}</small>
          <div class="cal-links">
            <button type="button" class="cal-link" data-cal-open="${esc(e.page)}">Open</button>
            ${e.open ? `<a class="cal-link" target="_blank" rel="noopener noreferrer" href="${esc(googleLink(e))}">Add to Google Calendar</a>` : ""}
          </div>
        </div>
      </div>`;
  }

  function render() {
    const grid = $("cal-grid");
    if (!grid) return;

    const events = collect();
    const today = midnight(new Date());
    const byDay = new Map();
    events.forEach((e) => {
      const k = keyOf(e.date);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(e);
    });

    $("cal-title").textContent = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    // Monday-first grid covering whole weeks.
    const offset = (view.getDay() + 6) % 7;
    const first = new Date(view.getFullYear(), view.getMonth(), 1 - offset);
    const weeks = Math.ceil((offset + new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()) / 7);

    const names = [];
    for (let i = 0; i < 7; i++) {
      names.push(new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" })); // 1 Jan 2024 was a Monday
    }

    let html = names.map((n) => `<div class="cal-wd">${esc(n)}</div>`).join("");

    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
      const k = keyOf(d);
      const list = byDay.get(k) || [];
      const cls = ["cal-day"];
      if (d.getMonth() !== view.getMonth()) cls.push("out");
      if (k === keyOf(today)) cls.push("today");
      if (k === picked) cls.push("sel");

      const dots = list.slice(0, 4).map((e) => `<span class="${dotClass(e, today)}"></span>`).join("");
      const more = list.length > 4 ? `<span class="cal-more">+${list.length - 4}</span>` : "";
      const label = `${d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}${list.length ? `, ${list.length} deadline${list.length === 1 ? "" : "s"}` : ""}`;

      html += `<button type="button" class="${cls.join(" ")}" data-cal-day="${k}" aria-label="${esc(label)}" aria-pressed="${k === picked}"><span class="cal-n">${d.getDate()}</span><span class="cal-dots">${dots}${more}</span></button>`;
    }
    grid.innerHTML = html;

    // Picked day.
    const pd = fromKey(picked) || today;
    $("cal-day-title").textContent = fmtLong(pd);
    const dayList = byDay.get(picked) || [];
    $("cal-day").innerHTML = dayList.length
      ? dayList.map((e) => eventHtml(e, today, false)).join("")
      : `<p class="cal-empty">Nothing due on this day.</p>`;

    // Coming up: overdue open items first, then the next 60 days.
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60);
    const soon = events.filter((e) => e.open && e.date <= horizon).slice(0, 12);
    const none = events.length
      ? "No open deadlines in the next 60 days."
      : "No deadlines yet. Add a deadline to an application in the Application Tracker, or save a scholarship that has one.";
    $("cal-soon").innerHTML = soon.length ? soon.map((e) => eventHtml(e, today, true)).join("") : `<p class="cal-empty">${esc(none)}</p>`;
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function bind(page) {
    page.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-cal]");
      if (nav) {
        const a = nav.dataset.cal;
        if (a === "prev") view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
        else if (a === "next") view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
        else {
          const t = new Date();
          view = new Date(t.getFullYear(), t.getMonth(), 1);
          picked = keyOf(t);
        }
        render();
        return;
      }

      const day = e.target.closest("[data-cal-day]");
      if (day) {
        picked = day.dataset.calDay;
        const d = fromKey(picked);
        if (d && d.getMonth() !== view.getMonth()) view = new Date(d.getFullYear(), d.getMonth(), 1);
        render();
        return;
      }

      const open = e.target.closest("[data-cal-open]");
      if (open && typeof window.showPage === "function") {
        window.showPage(open.dataset.calOpen);
        return;
      }

      if (e.target.closest("#cal-export")) download();
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function start() {
    if (!build()) return false;
    render();

    const refresh = () => render();
    window.addEventListener("uniai:tracker-change", refresh);
    window.addEventListener("uniai:saved-change", refresh);
    window.addEventListener("uniai:sync", refresh);
    window.addEventListener("storage", (e) => {
      if (e.key === TRACKER_KEY || e.key === null) refresh();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });

    // Saved items load a moment after boot.
    setTimeout(refresh, 1500);
    return true;
  }

  window.UniAICalendar = { events: collect, ics: () => buildIcs(exportable()) };

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
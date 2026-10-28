/* ==========================================================================
   UniAI — Notification center (notifications.js)

   Replaces the three hard-coded messages in the bell panel with a real
   notification centre. It needs NO changes to index.html: it uses the
   existing bell button (.notif-btn), badge (.notif-dot) and panel
   (#notif-panel), and injects its own CSS.

   Load order — AFTER script.js, save.js and security.js:
     <script src="JS/notifications.js"></script>

   What creates notifications (all from real data, nothing invented)
   - Deadline reminders for scholarships the person saved: 30, 14, 7 and
     3 days before, and on the day.
   - Roadmap milestones: 25 %, 50 %, 75 % and 100 % complete.
   - Account sync: when saved items or settings arrive from another device.
   - What's new: release notes from the ANNOUNCEMENTS list below.
   - A one-time welcome.
   - Any script can add its own:
         UniAINotify.add({ id, type, title, body, page, url })

   What the panel does
   - Unread badge on the bell, click an item to mark it read and open it,
     "Mark all read", "Clear all", dismiss one, All / Unread tabs.
   - Everything is kept on this device (localStorage "uniai-notifications")
     and wiped on sign-out. Notifications that were dismissed never come back.
   ========================================================================== */

(function () {
  "use strict";

  const STORE_KEY = "uniai-notifications";
  const MAX_ITEMS = 60;
  const MAX_KEYS = 400;
  const DAY = 86400000;

  /* ------------------------------------------------------------------------
     Release notes. Add a new object here to announce something; each id is
     shown once per device. `date` keeps them in the right order.
     ------------------------------------------------------------------------ */
  const ANNOUNCEMENTS = [
    {
      id: "whatsnew-notifications",
      date: "2026-10-23",
      type: "update",
      title: "Notifications are live",
      body: "You'll now get reminders for saved scholarship deadlines, roadmap milestones and account sync.",
      page: "roadmap"
    },
    {
      id: "whatsnew-finder",
      date: "2026-10-23",
      type: "update",
      title: "A smarter University Finder",
      body: "Search understands MIT, UCL and typos. Cards show real data only, and GPA works as 4.0, 10-point or %.",
      page: "universityFinder"
    },
    {
      id: "whatsnew-language",
      date: "2026-10-23",
      type: "update",
      title: "日本語 · 한국어 · 中文",
      body: "UniAI can now be used in Japanese, Korean and Chinese. Use the globe button in the top bar."
    }
  ];

  const TYPES = {
    deadline: { icon: "⏰", label: "Deadline" },
    roadmap: { icon: "🏁", label: "Roadmap" },
    sync: { icon: "🔄", label: "Sync" },
    update: { icon: "✨", label: "What's new" },
    info: { icon: "💡", label: "Tip" }
  };

  /* ------------------------------------------------------------------------
     Storage
     ------------------------------------------------------------------------ */

  let data = { v: 1, items: [], keys: {} };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (raw && Array.isArray(raw.items)) {
        data = { v: 1, items: raw.items.filter(isValid), keys: raw.keys && typeof raw.keys === "object" ? raw.keys : {} };
      }
    } catch (err) {
      data = { v: 1, items: [], keys: {} };
    }
  }

  function save() {
    // Keep the newest MAX_ITEMS, dropping read ones first.
    if (data.items.length > MAX_ITEMS) {
      const unread = data.items.filter((n) => !n.read);
      const read = data.items.filter((n) => n.read).sort((a, b) => b.ts - a.ts);
      data.items = unread.concat(read).slice(0, MAX_ITEMS);
    }

    const keyList = Object.keys(data.keys);
    if (keyList.length > MAX_KEYS) {
      keyList
        .sort((a, b) => data.keys[a] - data.keys[b])
        .slice(0, keyList.length - MAX_KEYS)
        .forEach((k) => delete data.keys[k]);
    }

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (err) {
      /* storage blocked or full: the panel still works for this page view */
    }
  }

  function isValid(n) {
    return n && typeof n.id === "string" && typeof n.title === "string" && Number.isFinite(n.ts);
  }

  /* ------------------------------------------------------------------------
     Core API
     ------------------------------------------------------------------------ */

  const unreadCount = () => data.items.filter((n) => !n.read).length;

  /**
   * Adds a notification once. `id` is the dedupe key: an id that was ever
   * added (even if dismissed since) is never added again.
   */
  function add(input) {
    if (!input || !input.id || !input.title) return false;

    const id = String(input.id);
    if (data.keys[id]) return false;

    const n = {
      id,
      type: TYPES[input.type] ? input.type : "info",
      title: String(input.title).slice(0, 120),
      body: String(input.body || "").slice(0, 240),
      ts: Number.isFinite(input.ts) ? input.ts : Date.now(),
      read: false
    };
    if (input.page) n.page = String(input.page);
    if (input.url) n.url = String(input.url);

    data.keys[id] = Date.now();
    data.items.push(n);
    save();
    refresh();
    return true;
  }

  function markRead(id) {
    const n = data.items.find((x) => x.id === id);
    if (n && !n.read) {
      n.read = true;
      save();
      refresh();
    }
  }

  function markAllRead() {
    let changed = false;
    data.items.forEach((n) => {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      save();
      refresh();
    }
  }

  function remove(id) {
    const before = data.items.length;
    data.items = data.items.filter((n) => n.id !== id);
    if (data.items.length !== before) {
      save();
      refresh();
    }
  }

  function clearAll() {
    if (!data.items.length) return;
    data.items = []; // data.keys stays, so cleared reminders don't return
    save();
    refresh();
  }

  /* ------------------------------------------------------------------------
     Sources
     ------------------------------------------------------------------------ */

  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  function endOfDay(y, m, d) {
    const dt = new Date(y, m, d, 23, 59, 59);
    return Number.isNaN(dt.getTime()) || dt.getMonth() !== m ? null : dt;
  }

  /** "2027-01-15", "15/01/2027", "15 January 2027", "January 15, 2027". Anything else -> null. */
  function parseDeadline(text) {
    const t = String(text || "").trim();
    if (!t) return null;

    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return endOfDay(+m[1], +m[2] - 1, +m[3]);

    m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return endOfDay(+m[3], +m[2] - 1, +m[1]);

    m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
    if (m) {
      const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
      if (mi >= 0) return endOfDay(+m[3], mi, +m[1]);
    }

    m = t.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
    if (m) {
      const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
      if (mi >= 0) return endOfDay(+m[3], mi, +m[2]);
    }

    return null;
  }

  function checkDeadlines() {
    const saved = window.UniAISaved;
    if (!saved || typeof saved.list !== "function") return;

    // Respect the choice made in the Study Identity ("Application deadlines" switch).
    const profile = window.UniAIStudyProfile;
    if (profile && profile.notifications && profile.notifications.deadlines === false) return;

    const now = Date.now();

    saved.list().forEach((item) => {
      if (!item || item.type !== "scholarship") return;

      const tag = (item.tags || []).find((t) => /^deadline:/i.test(t));
      if (!tag) return;

      const due = parseDeadline(tag.replace(/^deadline:\s*/i, ""));
      if (!due) return;

      // Whole calendar days left (a deadline later today is 0, not 1).
      const startOf = (t) => new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime();
      const days = Math.round((startOf(due.getTime()) - startOf(now)) / DAY);
      if (days < 0 || days > 30) return;

      const bucket = days <= 0 ? 0 : days <= 3 ? 3 : days <= 7 ? 7 : days <= 14 ? 14 : 30;
      const when = days <= 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;

      add({
        id: `deadline:${item.id}:${bucket}`,
        type: "deadline",
        title: `${when}: ${item.name}`,
        body: "A scholarship on your Saved list is closing soon. Check the official page and submit in time.",
        page: "saved"
      });
    });
  }

  let lastPercent = null;

  /** Roadmap percentage from what road.js saved (so page loads never count as progress). */
  function readRoadmapPercent() {
    try {
      const saved = JSON.parse(localStorage.getItem("roadmapProgress") || "[]");
      if (!Array.isArray(saved)) return null;

      const boxes = document.querySelectorAll("[data-road]").length || saved.length;
      if (!boxes) return null;

      return Math.round((saved.filter(Boolean).length / boxes) * 100);
    } catch (err) {
      return null;
    }
  }

  function checkRoadmap() {
    const percent = readRoadmapPercent();
    if (percent === null) return;

    const previous = lastPercent === null ? percent : lastPercent;
    lastPercent = percent;
    if (percent <= previous) return;

    const marks = [
      [100, "Roadmap complete", "You finished every milestone. Time to book that flight."],
      [75, "Roadmap: 75% complete", "Final stretch — only a few milestones left."],
      [50, "Roadmap: halfway there", "Half of your milestones are done. Keep the momentum."],
      [25, "Roadmap: 25% complete", "Good start. The next milestones are waiting."]
    ];

    // Only milestones passed by THIS change, so one tick can't replay older ones.
    marks.forEach(([mark, title, body]) => {
      if (previous < mark && percent >= mark) {
        add({ id: `roadmap:${mark}`, type: "roadmap", title, body, page: "roadmap" });
      }
    });
  }

  function onSync(e) {
    const applied = e && e.detail && e.detail.applied;
    if (!Array.isArray(applied) || !applied.length) return;

    const day = new Date().toISOString().slice(0, 10);
    add({
      id: `sync:${day}`,
      type: "sync",
      title: "Your account data was updated",
      body: "Saved items and settings from your other devices have been loaded here."
    });
  }

  function addStatic() {
    add({
      id: "welcome-v1",
      type: "info",
      title: "Welcome to UniAI",
      body: "Start with the University Finder, then save universities and scholarships to track them here.",
      page: "universityFinder",
      ts: Date.parse("2026-10-23T00:00:00Z") - 1
    });

    ANNOUNCEMENTS.forEach((a) =>
      add({ id: a.id, type: a.type, title: a.title, body: a.body, page: a.page, ts: Date.parse(a.date + "T00:00:00Z") })
    );
  }

  /* ------------------------------------------------------------------------
     Panel
     ------------------------------------------------------------------------ */

  let panel = null;
  let bell = null;
  let dot = null;
  let filter = "all";

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const lang = document.documentElement.lang || "en";
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    } catch (err) {
      rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    }

    const min = Math.round(diff / 60000);
    if (min < 1) return lang.startsWith("en") ? "just now" : rtf.format(0, "second");
    if (min < 60) return rtf.format(-min, "minute");
    const hr = Math.round(min / 60);
    if (hr < 24) return rtf.format(-hr, "hour");
    const d = Math.round(hr / 24);
    if (d < 30) return rtf.format(-d, "day");
    return new Date(ts).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
  }

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function renderBadge() {
    const count = unreadCount();

    if (dot) {
      dot.textContent = count > 9 ? "9+" : String(count);
      dot.style.display = count ? "" : "none";
    }
    if (bell) {
      bell.setAttribute("aria-label", count ? `Notifications, ${count} unread` : "Notifications");
    }
  }

  function renderPanel() {
    if (!panel) return;

    const list = data.items
      .filter((n) => filter === "all" || !n.read)
      .sort((a, b) => b.ts - a.ts);

    const count = unreadCount();

    const rows = list
      .map((n) => {
        const type = TYPES[n.type] || TYPES.info;
        return `
          <li class="nc-item${n.read ? "" : " is-unread"}" data-id="${esc(n.id)}">
            <button type="button" class="nc-main" data-nc="open">
              <span class="nc-ico" aria-hidden="true">${type.icon}</span>
              <span class="nc-text">
                <span class="nc-title">${esc(n.title)}</span>
                ${n.body ? `<span class="nc-body">${esc(n.body)}</span>` : ""}
                <span class="nc-meta">${esc(type.label)} · ${esc(timeAgo(n.ts))}</span>
              </span>
              ${n.read ? "" : '<span class="nc-unread" aria-label="Unread"></span>'}
            </button>
            <button type="button" class="nc-x" data-nc="dismiss" aria-label="Dismiss">×</button>
          </li>`;
      })
      .join("");

    const empty =
      filter === "unread" && data.items.length
        ? "You're all caught up."
        : "No notifications yet. Deadline reminders, roadmap progress and updates will show up here.";

    panel.innerHTML = `
      <div class="nc-head">
        <strong>Notifications</strong>
        <div class="nc-tools">
          <button type="button" data-nc="read-all" ${count ? "" : "disabled"}>Mark all read</button>
          <button type="button" data-nc="clear" ${data.items.length ? "" : "disabled"}>Clear all</button>
        </div>
      </div>
      <div class="nc-tabs" role="tablist" aria-label="Filter notifications">
        <button type="button" role="tab" data-nc-tab="all" aria-selected="${filter === "all"}">All</button>
        <button type="button" role="tab" data-nc-tab="unread" aria-selected="${filter === "unread"}">Unread${count ? ` (${count})` : ""}</button>
      </div>
      ${rows ? `<ul class="nc-list">${rows}</ul>` : `<p class="nc-empty">${esc(empty)}</p>`}
    `;
  }

  function refresh() {
    renderBadge();
    if (panel && !panel.classList.contains("hidden")) renderPanel();
  }

  function position() {
    if (!panel || !bell) return;

    const rect = bell.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const width = Math.min(390, vw - 24);

    panel.style.position = "fixed";
    panel.style.width = `${width}px`;
    panel.style.top = `${Math.round(rect.bottom + 10)}px`;
    panel.style.right = "auto";
    panel.style.left = `${Math.max(12, Math.min(vw - width - 12, rect.right - width))}px`;
    panel.style.maxHeight = `calc(100vh - ${Math.round(rect.bottom + 24)}px)`;
  }

  function openItem(id) {
    const n = data.items.find((x) => x.id === id);
    if (!n) return;

    markRead(id);
    closePanel(false);

    if (n.page && typeof window.showPage === "function") {
      window.showPage(n.page);
    } else if (n.url) {
      try {
        const u = new URL(n.url, window.location.href);
        if (u.protocol === "http:" || u.protocol === "https:") {
          if (u.origin === window.location.origin) window.location.href = u.href;
          else window.open(u.href, "_blank", "noopener");
        }
      } catch (err) {
        /* ignore a malformed link */
      }
    }
  }

  function openPanel() {
    if (!panel) return;
    panel.classList.remove("hidden");
  }

  function closePanel(returnFocus) {
    if (!panel) return;
    panel.classList.add("hidden");
    if (returnFocus && bell) bell.focus();
  }

  /** Runs whenever script.js (or anything else) shows or hides the panel. */
  function onVisibilityChange() {
    const open = !panel.classList.contains("hidden");

    if (bell) bell.setAttribute("aria-expanded", String(open));

    if (open) {
      filter = "all";
      renderPanel();
      position();
      panel.setAttribute("tabindex", "-1");
      panel.focus({ preventScroll: true });
    } else if (panel.contains(document.activeElement) && bell) {
      bell.focus();
    }
  }

  function togglePanel() {
    if (!panel) return;
    if (panel.classList.contains("hidden")) openPanel();
    else closePanel(false);
  }

  /* ------------------------------------------------------------------------
     Styles
     ------------------------------------------------------------------------ */

  function injectStyles() {
    if (document.getElementById("nc-styles")) return;

    const style = document.createElement("style");
    style.id = "nc-styles";
    style.textContent =
      "#notif-panel.nc{display:flex;flex-direction:column;padding:0;overflow:hidden;z-index:100000;" +
      "background:var(--card-bg,#fff);color:var(--text,#111);border:1px solid var(--border,rgba(128,128,128,.28));" +
      "border-radius:18px;box-shadow:0 22px 60px rgba(0,0,0,.28)}" +
      "#notif-panel.nc.hidden{display:none}" +
      "#notif-panel.nc:focus{outline:none}" +
      ".nc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 8px}" +
      ".nc-head strong{font:700 1rem/1.2 var(--font-display,inherit)}" +
      ".nc-tools{display:flex;gap:4px}" +
      ".nc-tools button,.nc-tabs button{border:0;background:transparent;color:var(--primary,#6d5dfb);cursor:pointer;" +
      "font:600 .78rem/1 var(--font-body,inherit);padding:6px 8px;border-radius:8px}" +
      ".nc-tools button:hover:not(:disabled),.nc-tabs button:hover{background:rgba(109,93,251,.12)}" +
      ".nc-tools button:disabled{opacity:.4;cursor:default}" +
      ".nc-tabs{display:flex;gap:4px;padding:0 12px 8px;border-bottom:1px solid var(--border,rgba(128,128,128,.22))}" +
      ".nc-tabs button{color:var(--text-muted,#8a8aa3)}" +
      ".nc-tabs button[aria-selected='true']{color:var(--text,#111);background:rgba(109,93,251,.14)}" +
      ".nc-list{list-style:none;margin:0;padding:6px;overflow-y:auto}" +
      ".nc-item{position:relative;display:flex;align-items:stretch;border-radius:12px}" +
      ".nc-item:hover{background:rgba(109,93,251,.07)}" +
      ".nc-item.is-unread{background:rgba(109,93,251,.09)}" +
      ".nc-main{flex:1;display:flex;align-items:flex-start;gap:12px;min-width:0;text-align:left;border:0;background:transparent;" +
      "color:inherit;cursor:pointer;padding:11px 36px 11px 10px;border-radius:12px;font:inherit}" +
      ".nc-ico{flex:0 0 auto;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;font-size:1.05rem;" +
      "background:rgba(109,93,251,.14)}" +
      ".nc-text{display:flex;flex-direction:column;gap:3px;min-width:0}" +
      ".nc-title{font-weight:700;font-size:.88rem;line-height:1.3;overflow-wrap:anywhere}" +
      ".nc-body{font-size:.8rem;line-height:1.4;color:var(--text-muted,#8a8aa3)}" +
      ".nc-meta{font-size:.72rem;color:var(--text-muted,#8a8aa3)}" +
      ".nc-unread{position:absolute;right:38px;top:16px;width:8px;height:8px;border-radius:50%;background:var(--primary,#6d5dfb)}" +
      ".nc-x{position:absolute;right:6px;top:8px;width:26px;height:26px;border:0;border-radius:8px;background:transparent;" +
      "color:var(--text-muted,#8a8aa3);font-size:1.15rem;line-height:1;cursor:pointer;opacity:.0;transition:opacity .15s}" +
      ".nc-item:hover .nc-x,.nc-x:focus-visible{opacity:1}" +
      ".nc-x:hover{background:rgba(128,128,128,.18)}" +
      "@media(hover:none){.nc-x{opacity:.7}}" +
      ".nc-empty{margin:0;padding:30px 24px;text-align:center;font-size:.85rem;line-height:1.5;color:var(--text-muted,#8a8aa3)}" +
      ".nc button:focus-visible{outline:2px solid var(--primary,#6d5dfb);outline-offset:1px}";
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------ */

  function start() {
    bell = document.querySelector(".notif-btn");
    dot = document.querySelector(".notif-dot");
    panel = document.getElementById("notif-panel");

    if (!panel) {
      const host = document.querySelector(".topbar-actions") || document.body;
      panel = document.createElement("div");
      panel.id = "notif-panel";
      panel.className = "notif-panel hidden";
      host.appendChild(panel);
    }

    injectStyles();
    panel.classList.add("nc");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Notifications");

    if (bell) {
      bell.setAttribute("aria-haspopup", "dialog");
      bell.setAttribute("aria-controls", "notif-panel");
      bell.setAttribute("aria-expanded", "false");
      // index.html's inline onclick calls toggleNotifPanel(); only bind ourselves if it was removed.
      if (!bell.hasAttribute("onclick")) bell.addEventListener("click", togglePanel);
    }

    // script.js hides the panel on Escape / outside click by toggling the class.
    new MutationObserver(onVisibilityChange).observe(panel, { attributes: true, attributeFilter: ["class"] });

    panel.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-nc-tab]");
      if (tab) {
        filter = tab.dataset.ncTab;
        renderPanel();
        return;
      }

      const action = e.target.closest("[data-nc]");
      if (!action || action.disabled) return;

      const row = action.closest(".nc-item");
      const id = row ? row.dataset.id : "";

      switch (action.dataset.nc) {
        case "open":
          openItem(id);
          break;
        case "dismiss":
          remove(id);
          break;
        case "read-all":
          markAllRead();
          break;
        case "clear":
          clearAll();
          break;
      }
    });

    window.addEventListener("resize", () => {
      if (!panel.classList.contains("hidden")) position();
    });
    window.addEventListener("scroll", () => {
      if (!panel.classList.contains("hidden")) position();
    }, { passive: true });

    // Another tab changed the list.
    window.addEventListener("storage", (e) => {
      if (e.key === STORE_KEY) {
        load();
        refresh();
      }
    });

    // Wording follows the language switcher.
    window.addEventListener("uniai:language-change", refresh);

    // Sources.
    addStatic();
    window.addEventListener("uniai:saved-change", checkDeadlines);
    window.addEventListener("uniai:preferences", checkDeadlines);
    window.addEventListener("uniai:sync", (e) => {
      onSync(e);
      lastPercent = readRoadmapPercent();
      checkDeadlines();
    });

    const wrapRoadmap = () => {
      if (typeof window.saveRoadmap !== "function" || window.saveRoadmap.__nc) return;
      const original = window.saveRoadmap;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        try {
          checkRoadmap();
        } catch (err) {
          /* never break the roadmap */
        }
        return result;
      };
      wrapped.__nc = true;
      window.saveRoadmap = wrapped;
    };
    wrapRoadmap();
    lastPercent = readRoadmapPercent(); // baseline: existing progress is not "new"

    // Saved items load a moment after boot (and again after account sync).
    setTimeout(checkDeadlines, 1200);
    setInterval(checkDeadlines, 6 * 60 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkDeadlines();
    });

    renderPanel(); // replaces the old hard-coded messages straight away
    renderBadge();
  }

  load();

  // Takes over from script.js's plain show/hide (it is bound by name in index.html).
  window.toggleNotifPanel = togglePanel;

  window.UniAINotify = {
    add,
    list: () => data.items.slice(),
    unread: unreadCount,
    markRead,
    markAllRead,
    remove,
    clear: clearAll,
    open: openPanel,
    close: () => closePanel(false)
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
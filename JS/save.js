/* ==========================================================================
   UniAI — Saved page (save.js)

   Load AFTER script.js:
     <script src="JS/script.js"></script>
     <script src="JS/save.js"></script>

   What this file does
   -------------------
   - Owns the whole Saved page (#savedPage): render, search, filter, sort,
     stats, empty states, remove + undo, clear all.
   - Renders from DATA (an array in localStorage), not by scraping the DOM.
   - Replaces script.js's toggleShortlist() / updateShortlistUI() so the
     Finder's "☆ Save" buttons, the details modal and this page all share
     ONE store.
   - Migrates the old name-only list ("uniai-shortlist") automatically.
   - Supports universities, scholarships and jobs.

   Saving from anywhere else (scholarship.js, aifree.js, any card):

     <button data-save
             data-save-type="scholarship"
             data-save-name="Chevening Scholarship"
             data-save-country="United Kingdom"
             data-save-url="https://www.chevening.org"
             data-save-tags="Fully funded|Masters">Save</button>

   or from JS:

     UniAISaved.toggle({ type: "scholarship", name: "...", country: "...",
                         url: "https://...", tags: ["Fully funded"] });
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Config
     ------------------------------------------------------------------------ */

  const KEY = "uniai-saved-items";      // new store: array of full records
  const LEGACY_KEY = "uniai-shortlist"; // old store: array of university names
  const GLOBAL_LABEL = "Global";

  const TYPES = {
    university: { label: "University", icon: "🎓" },
    scholarship: { label: "Scholarship", icon: "💰" },
    job: { label: "Job", icon: "💼" }
  };

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */

  let items = [];
  let ready = false;
  let els = {};
  let lastRemoved = null;
  let toastTimer = null;

  const view = { filter: "all", search: "", sort: "recent" };

  /* ------------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------------ */

  const byId = (id) => document.getElementById(id);

  function esc(value) {
    const div = document.createElement("div");
    div.textContent = String(value == null ? "" : value);
    return div.innerHTML;
  }

  function slug(text) {
    if (typeof window.slugify === "function") return window.slugify(text);
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function safeUrl(url) {
    try {
      const u = new URL(String(url || ""), window.location.href);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
    } catch (err) {
      return "";
    }
  }

  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (err) {
      console.warn("Saved: read failed", key, err);
      return undefined;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("Saved: write failed", key, err);
    }
  }

  function timeAgo(ts) {
    const diff = Math.max(0, Date.now() - Number(ts || 0));
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  function typeInfo(type) {
    return TYPES[type] || { label: titleCase(type || "Item"), icon: "🔖" };
  }

  function titleCase(s) {
    s = String(s || "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function countryOf(item) {
    return item.country && item.country.trim() ? item.country.trim() : "";
  }

  /* ------------------------------------------------------------------------
     Store
     ------------------------------------------------------------------------ */

  function isValid(rec) {
    return rec && typeof rec === "object" && rec.id && rec.name && rec.type;
  }

  function loadItems() {
    const stored = readJSON(KEY);

    if (Array.isArray(stored)) {
      items = stored.filter(isValid);
      return;
    }

    // First run with the new store: migrate the old name-only shortlist.
    const legacy = readJSON(LEGACY_KEY);
    items = [];

    if (Array.isArray(legacy)) {
      legacy.forEach((name, i) => {
        if (typeof name !== "string" || !name.trim()) return;
        const rec = buildRecord({ type: "university", name });
        rec.savedAt = Date.now() - (legacy.length - i) * 1000; // keep order
        items.push(rec);
      });
      if (items.length) writeJSON(KEY, items);
    }
  }

  function persist() {
    writeJSON(KEY, items);

    // Mirror university names to the legacy key + script.js's state so the
    // Finder's "★ Saved" labels and any old code keep working.
    const names = items.filter((i) => i.type === "university").map((i) => i.name);
    writeJSON(LEGACY_KEY, names);

    try {
      if (typeof state !== "undefined" && state && typeof state === "object") {
        state.shortlist = names.slice();
      }
    } catch (err) {
      /* state not available — fine */
    }

    window.dispatchEvent(
      new CustomEvent("uniai:saved-change", { detail: { count: items.length } })
    );
  }

  function findUniversity(name) {
    const target = String(name || "").toLowerCase();
    const pools = [];

    if (Array.isArray(window.__uniResults)) pools.push(window.__uniResults);
    try {
      if (typeof state !== "undefined" && state && Array.isArray(state.universities)) {
        pools.push(state.universities);
      }
    } catch (err) {
      /* ignore */
    }

    for (const pool of pools) {
      const hit = pool.find(
        (u) => String(u.name || u.displayName || "").toLowerCase() === target
      );
      if (hit) return hit;
    }
    return null;
  }

  /**
   * Turns whatever a caller passes (a name string, a Finder result, a plain
   * object) into one consistent record.
   */
  function buildRecord(input) {
    if (typeof input === "string") input = { type: "university", name: input };
    input = input || {};

    const type = input.type || "university";
    const name = String(input.name || input.displayName || input.title || "").trim();

    const rec = {
      id: `${type}:${slug(name)}`,
      type,
      name,
      country: input.country || "",
      logo: input.logo || "",
      url: input.url || input.website || "",
      slug: input.slug || "",
      tags: Array.isArray(input.tags) ? input.tags.filter(Boolean).map(String) : [],
      savedAt: Date.now()
    };

    if (type === "university") {
      const full = findUniversity(name) || input;
      rec.country = rec.country || full.country || "";
      rec.slug = rec.slug || full.slug || "";
      rec.url = rec.url || full.website || "";

      const logo = full.logo || full.displayLogo || "";
      if (!rec.logo && logo && !/placehold\.co/.test(logo)) rec.logo = logo;

      if (!rec.tags.length) {
        const tuition = Number(full.tuition_fee || full.displayTuition || 0);
        const ielts = full.ielts || full.displayIelts;
        if (full.qs_rank) rec.tags.push(`🏆 #${full.qs_rank}`);
        if (tuition) rec.tags.push(`💰 $${tuition.toLocaleString()}/yr`);
        if (ielts) rec.tags.push(`IELTS ${ielts}`);
      }
    }

    return rec;
  }

  function isSaved(input) {
    const rec = typeof input === "string" && input.indexOf(":") > 0 && TYPES[input.split(":")[0]]
      ? { id: input }
      : buildRecord(input);
    return items.some((i) => i.id === rec.id);
  }

  function add(rec, keepTime) {
    if (!isValid(rec) || items.some((i) => i.id === rec.id)) return false;
    if (keepTime && keepTime > 0) rec.savedAt = keepTime;
    items.push(rec);
    return true;
  }

  function toggle(input) {
    boot();

    const rec = buildRecord(input);
    if (!rec.name) return false;

    const existing = items.find((i) => i.id === rec.id);

    if (existing) {
      remove(existing.id);
      return false;
    }

    add(rec);
    persist();
    render();
    syncExternalButtons();
    toast(`Saved “${rec.name}”`);
    cloudPush(rec);
    return true;
  }

  function remove(id, opts) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;

    const [removed] = items.splice(idx, 1);
    lastRemoved = removed;
    cloudDelete(removed.id);

    persist();
    render();
    syncExternalButtons();

    if (!opts || !opts.silent) {
      toast(`Removed “${removed.name}”`, () => {
        if (lastRemoved && add(lastRemoved, lastRemoved.savedAt)) {
          cloudPush(lastRemoved);
          lastRemoved = null;
          persist();
          render();
          syncExternalButtons();
        }
      });
    }
  }

  async function clearAll() {
    boot();
    if (!items.length) return;

    const settings = window.UniAISettings;
    const needsConfirm = !settings || settings.is("confirmActions");

    if (needsConfirm) {
      const message = "This removes every saved university, scholarship and job from this device.";
      const ok =
        typeof window.showConfirmCard === "function"
          ? await window.showConfirmCard(message, {
              title: "Clear all saved items?",
              confirmText: "Clear all",
              cancelText: "Keep them"
            })
          : window.confirm(message);
      if (!ok) return;
    }

    cloudClear();
    items = [];
    lastRemoved = null;
    persist();
    render();
    syncExternalButtons();
  }

  /* ------------------------------------------------------------------------
     Filtering + sorting
     ------------------------------------------------------------------------ */

  function visibleItems() {
    const q = view.search.trim().toLowerCase();

    const list = items.filter((item) => {
      if (view.filter !== "all" && item.type !== view.filter) return false;
      if (!q) return true;

      const hay = [
        item.name,
        item.country,
        typeInfo(item.type).label,
        (item.tags || []).join(" ")
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });

    list.sort((a, b) => {
      if (view.sort === "name") return a.name.localeCompare(b.name);

      if (view.sort === "country") {
        // Items without a country sort last instead of first.
        const ca = countryOf(a) || "\uffff";
        const cb = countryOf(b) || "\uffff";
        return ca.localeCompare(cb) || a.name.localeCompare(b.name);
      }

      return (b.savedAt || 0) - (a.savedAt || 0); // recent
    });

    return list;
  }

  /* ------------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------------ */

  function cacheEls() {
    els = {
      list: byId("shortlist-items"),
      search: byId("savedSearch"),
      sort: byId("savedSort"),
      filters: Array.from(document.querySelectorAll(".saved-filter")),
      total: byId("savedTotalCount"),
      universities: byId("savedUniversityCount"),
      scholarships: byId("savedScholarshipCount"),
      countries: byId("savedCountryCount"),
      pill: byId("savedCountPill"),
      resultText: byId("savedResultText"),
      empty: byId("savedEmptyState"),
      noResults: byId("savedNoResults"),
      clearSearch: byId("clearSavedSearch"),
      clearAll: byId("clearSavedBtn"),
      explore: byId("exploreSavedBtn")
    };
  }

  function setText(el, value) {
    if (el) el.textContent = String(value);
  }

  function toggleHidden(el, hidden) {
    if (el) el.classList.toggle("hidden", hidden);
  }

  function renderStats() {
    const countries = new Set();
    let unis = 0;
    let schols = 0;

    items.forEach((item) => {
      if (item.type === "university") unis++;
      if (item.type === "scholarship") schols++;

      const c = countryOf(item);
      if (c && c.toLowerCase() !== GLOBAL_LABEL.toLowerCase()) {
        countries.add(c.toLowerCase());
      }
    });

    // One source of truth: total is the list length, never a separate tally.
    setText(els.total, items.length);
    setText(els.universities, unis);
    setText(els.scholarships, schols);
    setText(els.countries, countries.size);
    setText(els.pill, `${items.length} saved`);
  }

  function cardHTML(item) {
    const info = typeInfo(item.type);
    const url = safeUrl(item.url);
    const country = countryOf(item);

    const avatar = item.logo
      ? `<img class="saved-card-logo" src="${esc(item.logo)}" alt="" loading="lazy"
              onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'saved-card-logo saved-card-icon',textContent:'${info.icon}'}))">`
      : `<span class="saved-card-logo saved-card-icon">${info.icon}</span>`;

    const tags = (item.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="saved-card-tag">${esc(t)}</span>`)
      .join("");

    const viewBtn =
      item.type === "university"
        ? `<button type="button" class="saved-card-btn primary" data-saved-action="view">View</button>`
        : "";

    const linkBtn = url
      ? `<a class="saved-card-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${
          item.type === "university" ? "Website" : "Open"
        } ↗</a>`
      : "";

    return `
      <li class="saved-card" data-id="${esc(item.id)}" data-type="${esc(item.type)}"
          data-name="${esc(item.name)}" data-country="${esc(country)}">
        <div class="saved-card-top">
          ${avatar}
          <div class="saved-card-heading">
            <span class="saved-card-type">${info.icon} ${esc(info.label)}</span>
            <h4 class="title">${esc(item.name)}</h4>
            <div class="country">📍 ${esc(country || GLOBAL_LABEL)}</div>
          </div>
        </div>
        ${tags ? `<div class="saved-card-tags">${tags}</div>` : ""}
        <div class="saved-card-footer">
          <span class="saved-card-time">Saved ${esc(timeAgo(item.savedAt))}</span>
          <div class="saved-card-actions">
            ${viewBtn}
            ${linkBtn}
            <button type="button" class="saved-card-btn danger" data-saved-action="remove"
                    aria-label="Remove ${esc(item.name)}">✕</button>
          </div>
        </div>
      </li>
    `;
  }

  function render() {
    boot();
    if (!els.list) return;

    renderStats();

    const list = visibleItems();
    const total = items.length;
    const filtering = Boolean(view.search.trim()) || view.filter !== "all";

    els.list.innerHTML = list.map(cardHTML).join("");

    // Empty states: 0 saved vs. saved-but-nothing-matches.
    toggleHidden(els.empty, total !== 0);
    toggleHidden(els.noResults, !(total > 0 && list.length === 0));
    toggleHidden(els.list, list.length === 0);

    setText(
      els.resultText,
      filtering
        ? `Showing ${list.length} of ${total} saved ${total === 1 ? "item" : "items"}`
        : total
        ? "Showing all saved items"
        : "Nothing saved yet"
    );

    if (els.clearAll) els.clearAll.disabled = total === 0;
  }

  /**
   * Keeps every other Save button on the site (Finder cards, scholarship
   * cards, anything with data-save) in step with the store.
   */
  function syncExternalButtons() {
    document.querySelectorAll('[data-action="save"][data-name]').forEach((btn) => {
      const saved = items.some((i) => i.id === `university:${slug(btn.dataset.name)}`);
      btn.textContent = saved ? "★ Saved" : "☆ Save";
    });

    document.querySelectorAll("[data-save]").forEach((btn) => {
      const type = btn.dataset.saveType || "scholarship";
      const saved = items.some((i) => i.id === `${type}:${slug(btn.dataset.saveName)}`);
      btn.classList.toggle("is-saved", saved);
      btn.setAttribute("aria-pressed", String(saved));
    });
  }

  /* ------------------------------------------------------------------------
     Toast (with undo)
     ------------------------------------------------------------------------ */

  function toast(message, onUndo) {
    let box = byId("saved-toast");

    if (!box) {
      box = document.createElement("div");
      box.id = "saved-toast";
      box.className = "saved-toast";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }

    box.innerHTML = `<span>${esc(message)}</span>`;

    if (onUndo) {
      const undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = "Undo";
      undo.addEventListener("click", () => {
        onUndo();
        box.classList.remove("show");
      });
      box.appendChild(undo);
    }

    // restart the transition
    box.classList.remove("show");
    void box.offsetWidth;
    box.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), onUndo ? 5000 : 2200);
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */

  function bind() {
    if (els.search) {
      let timer;
      els.search.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          view.search = els.search.value;
          render();
        }, 120);
      });

      els.search.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && els.search.value) {
          els.search.value = "";
          view.search = "";
          render();
        }
      });
    }

    els.filters.forEach((btn) => {
      btn.addEventListener("click", () => {
        view.filter = btn.dataset.filter || "all";
        els.filters.forEach((b) => b.classList.toggle("active", b === btn));
        render();
      });
    });

    if (els.sort) {
      els.sort.addEventListener("change", () => {
        view.sort = els.sort.value || "recent";
        render();
      });
    }

    if (els.clearSearch) {
      els.clearSearch.addEventListener("click", () => {
        view.search = "";
        view.filter = "all";
        if (els.search) els.search.value = "";
        els.filters.forEach((b) =>
          b.classList.toggle("active", (b.dataset.filter || "all") === "all")
        );
        render();
        if (els.search) els.search.focus();
      });
    }

    if (els.clearAll) els.clearAll.addEventListener("click", clearAll);

    if (els.explore) {
      els.explore.addEventListener("click", (e) => {
        if (typeof window.showPage === "function") window.showPage("universityFinder", e);
      });
    }

    // Card actions (one delegated listener)
    if (els.list) {
      els.list.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-saved-action]");
        if (!btn) return;

        const card = btn.closest(".saved-card");
        const item = card && items.find((i) => i.id === card.dataset.id);
        if (!item) return;

        if (btn.dataset.savedAction === "remove") {
          remove(item.id);
          return;
        }

        if (btn.dataset.savedAction === "view" && item.type === "university") {
          const uni = { name: item.name, slug: item.slug, country: item.country, website: item.url, logo: item.logo };
          if (typeof window.openUniDetailPage === "function") window.openUniDetailPage(uni, e.ctrlKey || e.metaKey);
          else if (typeof window.showUniDetails === "function") window.showUniDetails(uni);
        }
      });
    }

    // Generic Save buttons anywhere on the site.
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-save]");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      toggle({
        type: btn.dataset.saveType || "scholarship",
        name: btn.dataset.saveName,
        country: btn.dataset.saveCountry,
        url: btn.dataset.saveUrl,
        tags: (btn.dataset.saveTags || "").split("|").map((t) => t.trim()).filter(Boolean)
      });
    });

    // Keep multiple tabs in sync.
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      loadItems();
      render();
      syncExternalButtons();
    });
  }

  /* ------------------------------------------------------------------------
     Styles (zero-specificity layout fallbacks so main.css always wins)
     ------------------------------------------------------------------------ */

  function injectStyles() {
    if (byId("saved-styles")) return;

    const style = document.createElement("style");
    style.id = "saved-styles";
    style.textContent = `
      :where(#shortlist-items.saved-grid) {
        list-style: none; margin: 0; padding: 0;
        display: grid; gap: 16px;
        grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      }
      :where(#shortlist-items.hidden) { display: none; }

      .saved-card {
        display: flex; flex-direction: column; gap: 12px; min-width: 0;
        padding: 18px; border-radius: 20px;
        background: var(--card, #fff);
        border: 1px solid var(--border, #e2e8f0);
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      }
      .saved-card:hover {
        transform: translateY(-2px);
        border-color: var(--primary, #6d5dfb);
        box-shadow: 0 10px 30px rgba(109, 93, 251, .12);
      }
      .saved-card-top { display: flex; gap: 14px; align-items: center; min-width: 0; }
      .saved-card-logo {
        width: 48px; height: 48px; flex-shrink: 0; border-radius: 12px;
        object-fit: contain; background: var(--bg, #fff);
        border: 1px solid var(--border, #e2e8f0);
      }
      .saved-card-icon { display: inline-flex; align-items: center; justify-content: center; font-size: 22px; }
      .saved-card-heading { min-width: 0; }
      .saved-card-heading .title { margin: 2px 0; font-size: 1rem; font-weight: 700; overflow-wrap: anywhere; }
      .saved-card-heading .country { font-size: .82rem; color: var(--text-muted, #8a8aa3); }
      .saved-card-type {
        font-size: .68rem; font-weight: 700; letter-spacing: .06em;
        text-transform: uppercase; color: var(--primary, #6d5dfb);
      }
      .saved-card-tags { display: flex; flex-wrap: wrap; gap: 6px; }
      .saved-card-tag {
        font-size: .75rem; padding: 4px 10px; border-radius: 999px;
        border: 1px solid var(--border, #e2e8f0); color: var(--text-muted, #64748b);
      }
      .saved-card-footer {
        margin-top: auto; padding-top: 12px; display: flex; gap: 10px;
        align-items: center; justify-content: space-between; flex-wrap: wrap;
        border-top: 1px solid var(--border, #e2e8f0);
      }
      .saved-card-time { font-size: .75rem; color: var(--text-muted, #94a3b8); }
      .saved-card-actions { display: flex; gap: 6px; align-items: center; }
      .saved-card-btn {
        font: inherit; font-size: .8rem; font-weight: 600; cursor: pointer;
        padding: 6px 12px; border-radius: 10px; text-decoration: none;
        color: inherit; background: transparent;
        border: 1px solid var(--border, #e2e8f0);
        transition: background .15s ease, border-color .15s ease, color .15s ease;
      }
      .saved-card-btn:hover { border-color: var(--primary, #6d5dfb); color: var(--primary, #6d5dfb); }
      .saved-card-btn.primary { background: var(--primary, #6d5dfb); border-color: var(--primary, #6d5dfb); color: #fff; }
      .saved-card-btn.primary:hover { color: #fff; filter: brightness(1.08); }
      .saved-card-btn.danger:hover { border-color: #ef4444; color: #ef4444; }

      .saved-clear-btn:disabled { opacity: .45; cursor: not-allowed; }

      .saved-toast {
        position: fixed; left: 50%; bottom: 28px; z-index: 10000;
        transform: translate(-50%, 20px); opacity: 0; pointer-events: none;
        display: flex; gap: 14px; align-items: center;
        padding: 12px 18px; border-radius: 14px; font-size: .9rem;
        background: #0f172a; color: #f8fafc;
        box-shadow: 0 12px 34px rgba(0, 0, 0, .28);
        transition: opacity .2s ease, transform .2s ease;
      }
      .saved-toast.show { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
      .saved-toast button {
        font: inherit; font-weight: 700; cursor: pointer; padding: 2px 6px;
        background: none; border: 0; color: #a5b4fc;
      }
      [data-save].is-saved { color: var(--primary, #6d5dfb); }
    `;
    document.head.appendChild(style);
  }

  /** The Saved markup uses Font Awesome classes, but the site never loads it. */
  function ensureFontAwesome() {
    const hasFA = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((l) =>
      /font-?awesome/i.test(l.href)
    );
    if (hasFA) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css";
    link.crossOrigin = "anonymous";
    link.referrerPolicy = "no-referrer";
    document.head.appendChild(link);
  }

  /* ------------------------------------------------------------------------
     Cloud sync — saved items follow the ACCOUNT, not the browser origin.
     localStorage is per origin (127.0.0.1:5500 and localhost:5000 are
     different origins), so without this the same login shows different data.
     Uses the auth client from script.js (window.supabaseApp) and the
     `saved_items` table (see the SQL that came with this file).
     ------------------------------------------------------------------------ */

  const OWNER_KEY = "uniai-saved-owner"; // which account the local cache belongs to
  const CLOUD_TABLE = "saved_items";

  let userId = null;
  let syncedFor = null;

  const cloudClient = () => window.supabaseApp || null;

  function readOwner() {
    try {
      return localStorage.getItem(OWNER_KEY);
    } catch (err) {
      return null;
    }
  }

  function setOwner(uid) {
    try {
      if (uid) localStorage.setItem(OWNER_KEY, uid);
      else localStorage.removeItem(OWNER_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function rowFor(rec) {
    const { pending, ...clean } = rec; // "pending" is local bookkeeping only
    return {
      user_id: userId,
      item_id: rec.id,
      type: rec.type,
      data: clean,
      saved_at: new Date(rec.savedAt || Date.now()).toISOString()
    };
  }

  async function cloudPush(recs) {
    const list = (Array.isArray(recs) ? recs : [recs]).filter(Boolean);
    const client = cloudClient();
    if (!userId || !client || !list.length) return;

    try {
      const { error } = await client
        .from(CLOUD_TABLE)
        .upsert(list.map(rowFor), { onConflict: "user_id,item_id" });
      if (error) throw error;

      list.forEach((r) => delete r.pending);
    } catch (err) {
      console.warn("Saved: cloud save failed, kept locally and will retry on next sync.", err);
      list.forEach((r) => (r.pending = true));
    }

    writeJSON(KEY, items);
  }

  async function cloudDelete(id) {
    const client = cloudClient();
    if (!userId || !client) return;

    try {
      const { error } = await client
        .from(CLOUD_TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("item_id", id);
      if (error) throw error;
    } catch (err) {
      console.warn("Saved: cloud remove failed", err);
    }
  }

  async function cloudClear() {
    const client = cloudClient();
    if (!userId || !client) return;

    try {
      const { error } = await client.from(CLOUD_TABLE).delete().eq("user_id", userId);
      if (error) throw error;
    } catch (err) {
      console.warn("Saved: cloud clear failed", err);
    }
  }

  /**
   * Pull the account's items and merge with this browser's cache:
   *  - cache belongs to ANOTHER account  -> discarded
   *  - cache is guest data (no owner)    -> adopted into this account
   *  - cache belongs to THIS account     -> cloud wins; only unsynced adds kept
   */
  async function syncFromCloud() {
    const client = cloudClient();
    if (!client || !userId) return;

    const uid = userId;

    try {
      const { data, error } = await client
        .from(CLOUD_TABLE)
        .select("item_id, data, saved_at")
        .eq("user_id", uid);
      if (error) throw error;
      if (uid !== userId) return; // account changed while loading

      const cloudItems = (data || [])
        .map((row) => ({
          ...row.data,
          id: row.item_id,
          savedAt: new Date(row.saved_at).getTime()
        }))
        .filter(isValid);

      const cloudIds = new Set(cloudItems.map((i) => i.id));
      const owner = readOwner();
      const local = owner && owner !== uid ? [] : items;

      const keep = local.filter(
        (i) => !cloudIds.has(i.id) && (owner === uid ? i.pending : true)
      );

      items = cloudItems.concat(keep);
      setOwner(uid);
      syncedFor = uid;

      persist();
      render();
      syncExternalButtons();

      if (keep.length) await cloudPush(keep);
    } catch (err) {
      console.warn("Saved: cloud sync failed — using this browser's data for now.", err);
    }
  }

  function handleSession(session) {
    const uid = session && session.user ? session.user.id : null;

    if (!uid) {
      // Signed out: don't leave one account's items on screen for the next person.
      userId = null;
      syncedFor = null;

      if (readOwner()) {
        items = [];
        lastRemoved = null;
        setOwner(null);
        persist();
        render();
        syncExternalButtons();
      }
      return;
    }

    if (uid === userId && syncedFor === uid) return; // duplicate event

    userId = uid;
    syncFromCloud();
  }

  function initCloud() {
    window.addEventListener("uniai:auth-state", (e) =>
      handleSession(e.detail && e.detail.session)
    );

    // Covers a session that was already restored before we started listening.
    const client = cloudClient();
    if (client) {
      client.auth
        .getSession()
        .then(({ data }) => handleSession(data && data.session))
        .catch(() => {});
    }
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  function boot() {
    if (ready || document.readyState === "loading") return;
    ready = true;

    injectStyles();
    ensureFontAwesome();
    cacheEls();
    loadItems();
    bind();

    // Reflect initial control values (e.g. browser-restored select state).
    if (els.sort && els.sort.value) view.sort = els.sort.value;

    persist(); // also syncs state.shortlist for script.js
    render();
    syncExternalButtons();
    initCloud();
  }

  /* ------------------------------------------------------------------------
     Public API + take over script.js's old shortlist functions
     ------------------------------------------------------------------------ */

  window.UniAISaved = {
    toggle,
    isSaved,
    remove: (id) => remove(id),
    clear: clearAll,
    list: () => items.slice(),
    count: () => items.length,
    sync: () => syncFromCloud()
  };

  // script.js's Finder cards and details modal call these by name.
  window.toggleShortlist = (input) => toggle(input);
  window.updateShortlistUI = () => {
    render();
    syncExternalButtons();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
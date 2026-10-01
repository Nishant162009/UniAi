/* ==========================================================================
   UniAI — Scholarship module (scholarship.js)

   Load order on index.html (after script.js and save.js):
     <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
     <script src="JS/script.js"></script>
     <script src="JS/save.js"></script>
     ...
     <script src="JS/scholarship.js"></script>

   Runs on two kinds of pages, detected automatically:
     1) Finder  — a #scholarship-grid (or #scholarship-list) exists
     2) Detail  — a #profile-content exists, opened as scholarship.html?id=...

   Notes
   -----
   - The Supabase client here is deliberately stateless (no stored auth
     session), so an expired browser token can't turn a public read into 401.
   - Saving goes through window.UniAISaved (save.js) as a real "scholarship"
     record, so the Saved page counts it under Scholarships. If save.js isn't
     on the page, it writes the same record format straight to localStorage.
   ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------------
     Config
     ------------------------------------------------------------------------ */

  const SUPABASE_URL = "https://vmdxinumknrruafbspif.supabase.co";

  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtZHhpbnVta25ycnVhZmJzcGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzIzMjUsImV4cCI6MjEwMDkwODMyNX0.zt_1rby4cGZjEufgjxwcBthO4zTok9oqsI30nX-cv28";

  const TABLE = "scholarship";
  const FETCH_PAGE = 1000; // Supabase returns at most 1000 rows per request
  const MAX_FETCH_PAGES = 10; // safety cap: 10,000 rows
  const CARDS_PER_STEP = 24; // cards rendered per "Show more"
  const SAVED_KEY = "uniai-saved-items"; // same store as save.js

  /* Chips / searches people type vs. how the data spells countries. */
  const ALIASES = {
    uk: ["united kingdom", "uk", "britain", "england", "scotland", "wales"],
    usa: ["united states", "usa", "america"],
    us: ["united states", "usa", "america"],
    uae: ["united arab emirates", "uae"],
    korea: ["south korea", "korea"],
    holland: ["netherlands"],
    masters: ["master", "masters", "msc", "ma"],
    master: ["master", "masters", "msc", "ma"],
    phd: ["phd", "doctoral", "doctorate"],
    bachelors: ["bachelor", "bachelors", "undergraduate"],
    undergrad: ["bachelor", "bachelors", "undergraduate"]
  };

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */

  let client = null;
  let allScholarships = []; // [{ data, hay }]
  let visible = []; // filtered subset of allScholarships
  let shown = CARDS_PER_STEP;
  let currentScholarship = null; // detail page record
  let loadState = "idle"; // idle | loading | ready | error

  /* ------------------------------------------------------------------------
     Supabase
     ------------------------------------------------------------------------ */

  function getClient() {
    if (client) return client;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error(
        "Supabase JS was not loaded. Load @supabase/supabase-js before scholarship.js."
      );
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    return client;
  }

  function describeError(error) {
    if (!error) return "Unknown database error.";

    const status = error.status ? `HTTP ${error.status}. ` : "";
    const code = error.code ? `Code ${error.code}. ` : "";
    const message = error.message || "The scholarship database request failed.";

    if (Number(error.status) === 401) {
      return (
        "The scholarship database rejected the public API request (401). " +
        "Check that the Supabase URL and anon key belong to the same project " +
        "and that the key is still active. " + message
      );
    }

    if (Number(error.status) === 403) {
      return (
        "The scholarship database denied access (403). " +
        "The table needs a SELECT policy for the anon role. " + message
      );
    }

    return `${status}${code}${message}`;
  }

  async function fetchOne(id) {
    const { data, error } = await getClient()
      .from(TABLE)
      .select("*")
      .eq("scholarship_id", String(id).trim())
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Reads every page so the total is real, not capped at 1000. */
  async function fetchAll() {
    const db = getClient();
    let rows = [];

    for (let page = 0; page < MAX_FETCH_PAGES; page++) {
      const from = page * FETCH_PAGE;

      const { data, error } = await db
        .from(TABLE)
        .select("*")
        .order("scholarship_id", { ascending: true })
        .range(from, from + FETCH_PAGE - 1);

      if (error) throw error;

      rows = rows.concat(data || []);
      if (!data || data.length < FETCH_PAGE) break;
    }

    return rows;
  }

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */

  const byId = (id) => document.getElementById(id);

  function text(input, fallback = "") {
    if (input === null || input === undefined) return fallback;
    if (typeof input === "string" && !input.trim()) return fallback;
    if (Array.isArray(input)) return input.join(", ");

    if (typeof input === "object") {
      try {
        return JSON.stringify(input);
      } catch (_) {
        return String(input);
      }
    }

    return String(input);
  }

  function esc(input) {
    return String(input ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setText(id, content, fallback = "") {
    const el = byId(id);
    if (el) el.textContent = text(content, fallback);
  }

  function normaliseUrl(input) {
    const raw = text(input).trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^\/\//.test(raw)) return `https:${raw}`;
    return `https://${raw}`;
  }

  function firstValue(input) {
    const raw = text(input).trim();
    return raw ? raw.split(",")[0].trim() : "";
  }

  function shorten(input, max = 160) {
    const raw = text(input).trim();
    return raw.length <= max ? raw : `${raw.slice(0, max).trim()}…`;
  }

  function isTrue(input) {
    return (
      input === true ||
      input === 1 ||
      input === "1" ||
      String(input).toLowerCase() === "true"
    );
  }

  function slug(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const getDegree = (d) =>
    text(d?.degree_level_final || d?.degree_level || d?.degree_level_inferred);

  const getDuration = (d) => text(d?.duration_final || d?.duration);

  const getApplicationLink = (d) =>
    normaliseUrl(d?.application_link_final || d?.application_link);

  const getSourceLink = (d) => normaliseUrl(d?.source);

  function detailRow(label, content) {
    const value = text(content).trim();
    if (!value) return "";

    return `
      <div class="detail-row">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>`;
  }

  function fact(label, content) {
    const value = text(content).trim();
    if (!value) return "";

    return `
      <div class="fact">
        <span class="fact-label">${esc(label)}</span>
        <span class="fact-value">${esc(value)}</span>
      </div>`;
  }

  /* ------------------------------------------------------------------------
     Save / shortlist  (shares the store with save.js)
     ------------------------------------------------------------------------ */

  function toSavedRecord(s) {
    const deadline = text(s?.deadline).trim();

    return {
      type: "scholarship",
      name: text(s?.scholarship_name, "Unnamed Scholarship"),
      country: firstValue(s?.host_country),
      url: `scholarship.html?id=${encodeURIComponent(s?.scholarship_id)}`,
      tags: [
        isTrue(s?.is_fully_funded) ? "Fully Funded" : "",
        isTrue(s?.stem_flag) ? "STEM" : "",
        getDegree(s),
        deadline ? `Deadline: ${deadline}` : ""
      ].filter(Boolean)
    };
  }

  function readSavedFallback() {
    try {
      const list = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function isSaved(s) {
    const rec = toSavedRecord(s);

    if (window.UniAISaved) return window.UniAISaved.isSaved(rec);

    const id = `scholarship:${slug(rec.name)}`;
    return readSavedFallback().some((item) => item.id === id);
  }

  function findScholarship(id) {
    const hit = allScholarships.find(
      (row) => String(row.data?.scholarship_id) === String(id)
    );
    if (hit) return hit.data;

    if (
      currentScholarship &&
      String(currentScholarship.scholarship_id) === String(id)
    ) {
      return currentScholarship;
    }

    return null;
  }

  function refreshSaveButtons() {
    document
      .querySelectorAll(".scholarship-save-btn, #save-scholarship-btn")
      .forEach((btn) => {
        const s = findScholarship(btn.dataset.scholarshipId);
        const saved = Boolean(s && isSaved(s));

        btn.textContent = saved ? "Saved ★" : "Save";
        btn.classList.toggle("is-saved", saved);
        btn.setAttribute("aria-pressed", String(saved));
      });
  }

  function saveScholarship(id) {
    const s = findScholarship(id);
    if (!s) return;

    const rec = toSavedRecord(s);

    if (window.UniAISaved) {
      window.UniAISaved.toggle(rec);
    } else {
      // save.js isn't on this page: write the same record format directly.
      const list = readSavedFallback();
      const recId = `scholarship:${slug(rec.name)}`;
      const i = list.findIndex((item) => item.id === recId);

      if (i >= 0) {
        list.splice(i, 1);
      } else {
        list.push({ ...rec, id: recId, slug: "", logo: "", savedAt: Date.now() });
      }

      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(list));
      } catch (_) {
        /* private mode — nothing to do */
      }
    }

    refreshSaveButtons();
  }

  /* ------------------------------------------------------------------------
     Finder: search index + filtering
     ------------------------------------------------------------------------ */

  function buildHaystack(d) {
    const parts = [
      d?.scholarship_id,
      d?.scholarship_name,
      d?.provider,
      d?.host_country,
      d?.country_region,
      d?.subject_areas,
      d?.eligible_countries,
      d?.degree_level,
      d?.degree_level_final,
      d?.degree_level_inferred,
      d?.scholarship_category,
      d?.funding_type,
      d?.funding_coverage,
      d?.target_groups,
      d?.study_purpose,
      d?.description_en,
      d?.application_cycle,
      d?.deadline
    ].map((v) => text(v));

    // Flags aren't text in the data, but people search for them ("fully funded").
    if (isTrue(d?.is_fully_funded)) parts.push("fully funded");
    if (isTrue(d?.stem_flag)) parts.push("stem");
    if (isTrue(d?.daad_funded)) parts.push("daad");

    return parts.join(" ").toLowerCase();
  }

  function tokenMatches(hay, token) {
    const options = ALIASES[token] || [token];

    return options.some((option) => {
      // Short words ("uk", "ma", "us") must match as whole words, not inside
      // other words like "duke" or "format".
      if (option.length <= 3) {
        return new RegExp(`\\b${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay);
      }
      return hay.includes(option);
    });
  }

  function applyFilter() {
    const input = byId("scholarship-filter");
    const query = input ? input.value.trim().toLowerCase() : "";

    if (!query) {
      visible = allScholarships.slice();
    } else {
      const tokens = query.split(/\s+/).filter(Boolean);
      visible = allScholarships.filter((row) =>
        tokens.every((token) => tokenMatches(row.hay, token))
      );
    }

    shown = CARDS_PER_STEP;
    renderScholarships();
  }

  function filterScholarships() {
    applyFilter();
  }

  function setScholarshipFilter(value) {
    const input = byId("scholarship-filter");
    if (!input) return;

    input.value = value ?? "";
    applyFilter();
  }

  function clearScholarshipFilter() {
    const input = byId("scholarship-filter");
    if (input) input.value = "";
    applyFilter();
  }

  /* ------------------------------------------------------------------------
     Finder: rendering
     ------------------------------------------------------------------------ */

  function getGrid() {
    return (
      byId("scholarship-grid") ||
      byId("scholarship-list") ||
      document.querySelector("[data-scholarship-list]")
    );
  }

  function createScholarshipCard(data) {
    const id = text(data?.scholarship_id);
    const name = text(data?.scholarship_name, "Unnamed Scholarship");
    const provider = text(data?.provider, "Scholarship Provider");
    const country = text(data?.host_country, "International");
    const subject = text(data?.subject_areas || data?.scholarship_category, "Various fields");
    const description = text(data?.description_en, "Scholarship information available.");
    const degree = getDegree(data) || "Various levels";
    const deadline = text(data?.deadline, "Check official source");
    const amount = text(data?.scholarship_amount);
    const duration = getDuration(data);

    const tags = [
      isTrue(data?.is_fully_funded) ? "Fully Funded" : "",
      isTrue(data?.stem_flag) ? "STEM" : "",
      degree
    ]
      .filter(Boolean)
      .map((t) => `<span class="scholarship-tag">${esc(t)}</span>`)
      .join("");

    return `
      <article class="rich-card scholarship-card" data-scholarship-id="${esc(id)}">
        <div class="card-kicker">
          ${esc(country)}${subject ? ` · ${esc(firstValue(subject))}` : ""}
        </div>

        <h3>${esc(name)}</h3>

        <div class="scholarship-provider">${esc(provider)}</div>

        <p>${esc(shorten(description, 150))}</p>

        <div class="scholarship-tags">${tags}</div>

        <div class="meta-row">
          <span>Deadline: ${esc(deadline)}</span>
          ${amount ? `<span>${esc(amount)}</span>` : ""}
        </div>

        ${duration ? `<div class="scholarship-duration">Duration: ${esc(duration)}</div>` : ""}

        <div class="scholarship-actions">
          <button class="glow-btn scholarship-details-btn" type="button"
                  data-scholarship-id="${esc(id)}">Details</button>

          <button class="glow-btn scholarship-save-btn" type="button"
                  data-scholarship-id="${esc(id)}" aria-pressed="false">Save</button>
        </div>
      </article>`;
  }

  function ensureMoreButton(grid) {
    let wrap = byId("scholarship-more");

    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "scholarship-more";
      wrap.style.cssText = "text-align:center;margin:24px 0 8px;";
      wrap.innerHTML =
        '<button type="button" class="secondary-btn" id="scholarship-more-btn"></button>';
      grid.insertAdjacentElement("afterend", wrap);

      byId("scholarship-more-btn").addEventListener("click", () => {
        shown += CARDS_PER_STEP;
        renderScholarships();
      });
    }

    return wrap;
  }

  function updateSummary() {
    const total = allScholarships.length;

    setText("scholarshipCount", loadState === "ready" ? total.toLocaleString() : "—");

    const resultsText = byId("scholarshipResultsText");
    if (!resultsText) return;

    if (loadState === "loading") resultsText.textContent = "Loading scholarships…";
    else if (loadState === "error") resultsText.textContent = "Couldn't load scholarships";
    else if (visible.length === total) resultsText.textContent = `Showing all ${total.toLocaleString()} scholarships`;
    else resultsText.textContent = `Showing ${visible.length.toLocaleString()} of ${total.toLocaleString()} scholarships`;
  }

  function renderScholarships() {
    const grid = getGrid();
    if (!grid) return;

    updateSummary();

    const empty = byId("scholarship-empty");
    const more = ensureMoreButton(grid);

    if (!visible.length) {
      grid.innerHTML = empty
        ? ""
        : '<div class="scholarship-empty">No scholarships match your search.</div>';

      if (empty) empty.classList.remove("hidden");
      more.style.display = "none";
      return;
    }

    if (empty) empty.classList.add("hidden");

    const slice = visible.slice(0, shown);
    grid.innerHTML = slice.map((row) => createScholarshipCard(row.data)).join("");

    const remaining = visible.length - slice.length;
    more.style.display = remaining > 0 ? "" : "none";

    if (remaining > 0) {
      byId("scholarship-more-btn").textContent =
        `Show more (${remaining.toLocaleString()} left)`;
    }

    refreshSaveButtons();
  }

  async function loadScholarships() {
    const grid = getGrid();
    if (!grid) return;

    loadState = "loading";
    updateSummary();

    grid.innerHTML = '<div class="scholarship-loading">Loading scholarships…</div>';

    try {
      const rows = await fetchAll();

      allScholarships = rows.map((data) => ({ data, hay: buildHaystack(data) }));
      loadState = "ready";

      console.log(`UniAI: loaded ${allScholarships.length} scholarships.`);

      applyFilter(); // honours anything already typed in the search box
    } catch (error) {
      console.error("Failed to load scholarships:", error);

      loadState = "error";
      allScholarships = [];
      visible = [];
      updateSummary();

      grid.innerHTML = `
        <div class="scholarship-error">
          <strong>Unable to load scholarships.</strong>
          <p>${esc(describeError(error))}</p>
          <button type="button" class="secondary-btn" data-scholarship-retry>Try again</button>
        </div>`;
    }
  }

  /* ------------------------------------------------------------------------
     Detail page (scholarship.html?id=...)
     ------------------------------------------------------------------------ */

  function toggleState({ loading = false, error = false, profile = false }) {
    const l = byId("loading-state");
    const e = byId("error-state");
    const p = byId("profile-content");

    if (l) l.hidden = !loading;
    if (e) e.hidden = !error;
    if (p) p.hidden = !profile;
  }

  function showError(message) {
    toggleState({ error: true });

    const el = byId("error-message");
    if (el) el.textContent = message;
  }

  function renderScholarshipProfile(data) {
    const degree = getDegree(data);
    const duration = getDuration(data);
    const description = text(data?.description_en);
    const applicationLink = getApplicationLink(data);
    const source = getSourceLink(data);

    const name = text(data?.scholarship_name, "Scholarship");
    const provider = text(data?.provider, "Scholarship Provider");
    const hostCountry = text(data?.host_country, "International");
    const deadline = text(data?.deadline, "Not specified");
    const amount = text(data?.scholarship_amount, "See details");
    const fundingType = text(data?.funding_type, "Scholarship support");
    const fundingCoverage = text(data?.funding_coverage, fundingType);
    const category = text(data?.scholarship_category, "General");
    const eligibleCountries = text(data?.eligible_countries, "Not specified");
    const targetGroups = text(data?.target_groups, "Not specified");
    const studyPurpose = text(data?.study_purpose, "Not specified");
    const subjectAreas = text(data?.subject_areas, "Various fields");
    const applicationCycle = text(data?.application_cycle, "Not specified");
    const competitiveness = text(data?.competitiveness, "Not specified");
    const region = text(data?.country_region, "Not specified");

    const fullyFunded = isTrue(data?.is_fully_funded);
    const daadFunded = isTrue(data?.daad_funded);
    const stem = isTrue(data?.stem_flag);

    document.title = `${name} | UniAI`;

    // Hero
    setText("hero-kicker", hostCountry, "International");
    setText("scholarship-name", name, "Scholarship");
    setText("scholarship-provider", provider, "Scholarship Provider");
    setText("hero-summary", shorten(description, 280), "Scholarship information available.");
    setText("hero-amount", amount, "See details");
    setText("hero-funding", fundingCoverage, "Scholarship support");
    setText("description", description, "No description is available.");

    const heroTags = byId("hero-tags");
    if (heroTags) {
      heroTags.innerHTML = [fullyFunded ? "Fully Funded" : "", stem ? "STEM" : "", degree, category]
        .filter(Boolean)
        .map((tag) => `<span class="tag">${esc(tag)}</span>`)
        .join("");
    }

    // Highlight cards
    setText("highlight-funding", fundingCoverage, "Not specified");
    setText("highlight-deadline", deadline, "Not specified");
    setText("highlight-level", degree, "Not specified");
    setText("highlight-country", hostCountry, "Not specified");

    // Quick facts
    const quickFacts = byId("quick-facts");
    if (quickFacts) {
      quickFacts.innerHTML = [
        fact("Host Country", hostCountry),
        fact("Region", region),
        fact("Provider", provider),
        fact("Degree Level", degree),
        fact("Duration", duration),
        fact("Category", category),
        fact("Subject Areas", subjectAreas),
        fact("Application Cycle", applicationCycle)
      ].join("");
    }

    // Funding
    const funding = byId("funding-details");
    if (funding) {
      funding.innerHTML = [
        detailRow("Funding Type", fundingType),
        detailRow("Funding Coverage", fundingCoverage),
        detailRow("Scholarship Amount", amount),
        detailRow("Fully Funded", fullyFunded ? "Yes" : "No"),
        detailRow("Duration", duration),
        detailRow("Competitiveness", competitiveness),
        detailRow("Funding Score", data?.funding_score)
      ].join("");
    }

    // Eligibility
    const eligibility = byId("eligibility-details");
    if (eligibility) {
      eligibility.innerHTML = [
        detailRow("Eligible Countries", eligibleCountries),
        detailRow("Target Groups", targetGroups),
        detailRow("Study Purpose", studyPurpose),
        detailRow("Subject Areas", subjectAreas),
        detailRow("Degree Level", degree),
        detailRow("Category", category),
        detailRow("STEM", stem ? "Yes" : "No"),
        detailRow("DAAD Funded", daadFunded ? "Yes" : "No")
      ].join("");
    }

    // Timeline
    const timeline = byId("timeline-details");
    if (timeline) {
      const step = (n, label, value) => `
        <div class="timeline-item">
          <div class="timeline-marker">${n}</div>
          <div class="timeline-content">
            <span class="timeline-label">${esc(label)}</span>
            <strong>${esc(value)}</strong>
          </div>
        </div>`;

      timeline.innerHTML =
        step("01", "Application Cycle", applicationCycle) +
        step("02", "Deadline", deadline) +
        step("03", "Study Duration", duration || "Not specified");
    }

    // Apply / source buttons (top + bottom CTA share the same markup)
    const links = [];

    if (applicationLink) {
      links.push(`
        <a class="action-btn action-primary" href="${esc(applicationLink)}"
           target="_blank" rel="noopener noreferrer">
          Apply Now <span aria-hidden="true">↗</span>
        </a>`);
    }

    if (source) {
      links.push(`
        <a class="action-btn" href="${esc(source)}"
           target="_blank" rel="noopener noreferrer">
          View Source <span aria-hidden="true">↗</span>
        </a>`);
    }

    const linksHTML = links.length
      ? links.join("")
      : '<span class="about-text">No application link is available.</span>';

    ["application-actions", "application-actions-bottom"].forEach((id) => {
      const el = byId(id);
      if (el) el.innerHTML = linksHTML;
    });

    // Optional save button on the detail page:
    //   <button id="save-scholarship-btn" type="button">Save</button>
    const saveBtn = byId("save-scholarship-btn");
    if (saveBtn) saveBtn.dataset.scholarshipId = text(data?.scholarship_id);

    refreshSaveButtons();
  }

  async function loadScholarship() {
    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
      showError("No scholarship ID was supplied in the page URL.");
      return;
    }

    toggleState({ loading: true });

    try {
      const data = await fetchOne(id);

      if (!data) throw new Error(`Scholarship ID ${id} was not found.`);

      currentScholarship = data;
      renderScholarshipProfile(data);
      toggleState({ profile: true });
    } catch (error) {
      console.error("Scholarship profile error:", error);
      showError(describeError(error));
    }
  }

  /* ------------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------------ */

  function showScholarshipDetails(id) {
    window.location.href = `scholarship.html?id=${encodeURIComponent(id)}`;
  }

  function closeScholarshipDetails() {
    const modal = byId("scholarship-details-modal");
    if (!modal) return;

    modal.classList.remove("active");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */

  function init() {
    const hasDetailPage = Boolean(byId("profile-content"));
    const hasFinderPage = Boolean(getGrid());

    // One delegated click handler for every button this module renders.
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || !target.closest) return;

      const details = target.closest(".scholarship-details-btn");
      if (details) {
        event.preventDefault();
        if (details.dataset.scholarshipId) showScholarshipDetails(details.dataset.scholarshipId);
        return;
      }

      const save = target.closest(".scholarship-save-btn, #save-scholarship-btn");
      if (save) {
        event.preventDefault();
        if (save.dataset.scholarshipId) saveScholarship(save.dataset.scholarshipId);
        return;
      }

      if (target.closest("[data-scholarship-retry]")) {
        event.preventDefault();
        loadScholarships();
      }
    });

    // The Finder markup already has oninput="filterScholarships()". Only add
    // our own listener if it doesn't, so a keystroke never filters twice.
    const filter = byId("scholarship-filter");
    if (filter && !filter.hasAttribute("oninput")) {
      filter.addEventListener("input", filterScholarships);
    }
    if (filter) filter.addEventListener("search", filterScholarships);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeScholarshipDetails();
    });

    // Keep Save buttons honest when items are removed on the Saved page,
    // or saved/removed in another tab.
    window.addEventListener("uniai:saved-change", refreshSaveButtons);
    window.addEventListener("storage", (e) => {
      if (e.key === SAVED_KEY) refreshSaveButtons();
    });

    if (hasDetailPage) loadScholarship();
    else if (hasFinderPage) loadScholarships();
  }

  /* ------------------------------------------------------------------------
     Public API (names your HTML onclick / oninput attributes already use)
     ------------------------------------------------------------------------ */

  Object.assign(window, {
    loadScholarships,
    loadScholarship,
    loadScholarshipProfile: loadScholarship,
    renderScholarships,
    filterScholarships,
    setScholarshipFilter,
    clearScholarshipFilter,
    createScholarshipCard,
    saveScholarship,
    showScholarshipDetails,
    closeScholarshipDetails,
    refreshScholarshipSaveButtons: refreshSaveButtons
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
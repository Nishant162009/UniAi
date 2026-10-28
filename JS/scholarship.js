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

  /* ---- text helpers --------------------------------------------------- */

  /** Lower-case, accent-free, punctuation-free ("Zürich" -> "zurich"). */
  function fold(input) {
    return String(input ?? "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  const escapeRe = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function splitList(input) {
    if (Array.isArray(input)) return input.map((v) => text(v).trim()).filter(Boolean);
    return text(input)
      .split(/[;,|/\n]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  /** Small bounded edit distance for typo tolerance ("austrlia" -> "australia"). */
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  /* ---- countries ------------------------------------------------------- */

  const COUNTRY_ALIASES = {
    usa: "united states",
    us: "united states",
    america: "united states",
    "united states of america": "united states",
    uk: "united kingdom",
    britain: "united kingdom",
    "great britain": "united kingdom",
    england: "united kingdom",
    scotland: "united kingdom",
    wales: "united kingdom",
    "northern ireland": "united kingdom",
    uae: "united arab emirates",
    emirates: "united arab emirates",
    korea: "south korea",
    "republic of korea": "south korea",
    holland: "netherlands",
    "the netherlands": "netherlands",
    czechia: "czech republic",
    turkiye: "turkey",
    "hong kong sar": "hong kong"
  };

  // A scholarship hosted "everywhere" is not hosted in any one country.
  const OPEN_HOSTS = new Set(["international", "multiple", "various", "global", "worldwide", "any", "all", "multiple countries", "n a", "na", "none", "unknown"]);

  const canonicalCountry = (name) => {
    const f = fold(name);
    return COUNTRY_ALIASES[f] || f;
  };

  let knownCountries = new Map(); // canonical -> display name

  /* ---- degree / flag words -------------------------------------------- */

  const DEGREE_WORDS = {
    master: "master", masters: "master", msc: "master", ms: "master", ma: "master", mba: "master", postgraduate: "master", postgrad: "master", graduate: "master",
    phd: "phd", doctoral: "phd", doctorate: "phd", dphil: "phd",
    bachelor: "bachelor", bachelors: "bachelor", undergraduate: "bachelor", undergrad: "bachelor", bsc: "bachelor", ba: "bachelor"
  };

  const DEGREE_FIELD_WORDS = { master: ["master", "msc", "postgraduate"], phd: ["phd", "doctor"], bachelor: ["bachelor", "undergraduate", "bsc"] };

  const FILLER = new Set(["scholarship", "scholarships", "scholar", "in", "for", "of", "the", "to", "and", "a", "at", "on", "abroad", "study", "studies", "program", "programme", "programs", "programmes"]);

  /* ---- index ----------------------------------------------------------- */

  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  /** "15 January 2027", "January 15, 2027", "2027-01-15", "15/01/2027" -> time, or null. */
  function parseDeadline(input) {
    const t = text(input).trim();
    if (!t) return null;
    const make = (y, m, d) => {
      const dt = new Date(y, m, d, 23, 59, 59);
      return Number.isNaN(dt.getTime()) || dt.getMonth() !== m ? null : dt.getTime();
    };

    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return make(+m[1], +m[2] - 1, +m[3]);
    m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return make(+m[3], +m[2] - 1, +m[1]);
    m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
    if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) return make(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), +m[1]);
    m = t.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
    if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) return make(+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), +m[2]);
    return null;
  }

  /**
   * One record, split into SEPARATE fields. The old code glued everything into a
   * single string, so searching "Canada" also matched any scholarship whose
   * description merely mentioned Canada. Now the host country is its own field.
   */
  function buildIndex(d) {
    const rawHosts = splitList(d?.host_country);
    const hosts = rawHosts.map(canonicalCountry).filter((h) => h && !OPEN_HOSTS.has(h));
    const f = (v) => fold(text(v));

    rawHosts.forEach((raw) => {
      const c = canonicalCountry(raw);
      if (c && !OPEN_HOSTS.has(c) && !knownCountries.has(c)) knownCountries.set(c, raw.trim());
    });

    return {
      hosts,
      open: hosts.length === 0,
      name: f(d?.scholarship_name),
      provider: f(d?.provider),
      subjects: f([d?.subject_areas, d?.scholarship_category]),
      degree: f([getDegree(d), d?.degree_level, d?.degree_level_final, d?.degree_level_inferred]),
      funding: f([d?.funding_type, d?.funding_coverage, d?.scholarship_amount]),
      eligible: f([d?.eligible_countries, d?.target_groups, d?.country_region]),
      desc: f([d?.description_en, d?.study_purpose]),
      full: isTrue(d?.is_fully_funded),
      stem: isTrue(d?.stem_flag),
      deadline: parseDeadline(d?.deadline)
    };
  }

  /* ---- query ----------------------------------------------------------- */

  const filters = { country: "", degree: "", full: false, stem: false, sort: "best" };
  let searchNote = "";

  function parseQuery(raw) {
    let rest = ` ${fold(raw)} `;
    const q = { countries: [], degrees: [], full: false, stem: false, tokens: [], phrase: fold(raw) };

    // "fully funded", "full ride" -> funding flag
    rest = rest.replace(/ (fully funded|full funding|full ride|fully fund|funded) /g, () => {
      q.full = true;
      return " ";
    });

    // Countries: longest phrase first, aliases and the names found in the data.
    const phrases = [];
    Object.keys(COUNTRY_ALIASES).forEach((alias) => phrases.push([alias, COUNTRY_ALIASES[alias]]));
    knownCountries.forEach((display, canon) => phrases.push([canon, canon]));
    phrases.sort((a, b) => b[0].length - a[0].length);

    phrases.forEach(([phrase, canon]) => {
      const re = new RegExp(` ${escapeRe(phrase)} `);
      while (re.test(rest)) {
        if (!q.countries.includes(canon)) q.countries.push(canon);
        rest = rest.replace(re, " ");
      }
    });

    rest
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((token) => {
        // A one-letter slip in a country name ("austrlia") still means the country.
        if (token.length >= 6 && !DEGREE_WORDS[token]) {
          for (const canon of knownCountries.keys()) {
            if (!canon.includes(" ") && editDistance(token, canon, 1) <= 1) {
              if (!q.countries.includes(canon)) q.countries.push(canon);
              return;
            }
          }
        }

        if (DEGREE_WORDS[token]) {
          if (!q.degrees.includes(DEGREE_WORDS[token])) q.degrees.push(DEGREE_WORDS[token]);
        } else if (token === "stem") {
          q.stem = true;
        } else if (!FILLER.has(token)) {
          q.tokens.push(token);
        }
      });

    return q;
  }

  /** Score of one free-text word against the record's fields (0 = no match). */
  function scoreToken(ix, token) {
    const field = (value) => ` ${value} `;
    const word = ` ${token} `;
    const prefix = ` ${token}`;
    let best = 0;

    const test = (value, whole, start, sub) => {
      const hay = field(value);
      if (hay.includes(word)) best = Math.max(best, whole);
      else if (hay.includes(prefix)) best = Math.max(best, start);
      else if (token.length >= 4 && value.includes(token)) best = Math.max(best, sub);
    };

    test(ix.name, 50, 40, 30);
    test(ix.provider, 32, 26, 20);
    test(ix.subjects, 28, 22, 16);
    test(ix.funding, 18, 14, 10);
    test(ix.eligible, 12, 9, 6);
    test(ix.desc, 8, 6, 4);

    if (!best && token.length >= 5) {
      const max = token.length >= 8 ? 2 : 1;
      const words = `${ix.name} ${ix.provider} ${ix.subjects}`.split(" ");
      if (words.some((w) => w.length >= 4 && editDistance(token, w, max) <= max)) best = 12;
    }
    return best;
  }

  const hostsInclude = (ix, country) => ix.hosts.includes(country);

  function degreeMatches(ix, degree) {
    if (!ix.degree || /\b(various|all|any|multiple)\b/.test(ix.degree)) return "maybe";
    return DEGREE_FIELD_WORDS[degree].some((w) => ix.degree.includes(w)) ? "yes" : "no";
  }

  /** Returns a score for this record, or 0 when it should not be listed. */
  function scoreRecord(ix, q, relaxed) {
    let score = 1;

    const wanted = q.countries.slice();
    if (filters.country) wanted.push(filters.country);

    if (wanted.length) {
      if (relaxed) {
        // Fallback: nothing is hosted there, so accept ones that mention it at all.
        const mentioned = wanted.every((c) => {
          const name = knownCountries.get(c) ? fold(knownCountries.get(c)) : c;
          return ix.eligible.includes(name) || ix.desc.includes(name) || ix.eligible.includes(c) || ix.desc.includes(c);
        });
        if (!mentioned) return 0;
        score += 5;
      } else {
        if (!wanted.every((c) => hostsInclude(ix, c))) return 0;
        score += 60;
      }
    }

    const degrees = q.degrees.slice();
    if (filters.degree) degrees.push(filters.degree);
    for (const d of degrees) {
      const m = degreeMatches(ix, d);
      if (m === "no") return 0;
      score += m === "yes" ? 25 : 4;
    }

    if ((q.full || filters.full) && !ix.full && !/full/.test(ix.funding)) return 0;
    if (q.full || filters.full) score += 20;
    if ((q.stem || filters.stem) && !ix.stem && !/stem|science|engineering|technology|mathematics/.test(ix.subjects)) return 0;
    if (q.stem || filters.stem) score += 10;

    for (const token of q.tokens) {
      const s = scoreToken(ix, token);
      if (!s) return 0; // every word typed must match something
      score += s;
    }

    if (q.phrase && ix.name === q.phrase) score += 100;
    else if (q.phrase && ix.name.startsWith(q.phrase)) score += 40;

    return score;
  }

  function sortRows(rows) {
    if (filters.sort === "name") {
      return rows.sort((a, b) => text(a.row.data?.scholarship_name).localeCompare(text(b.row.data?.scholarship_name)));
    }

    if (filters.sort === "deadline") {
      const now = Date.now();
      const key = (r) => (r.row.ix.deadline && r.row.ix.deadline >= now ? r.row.ix.deadline : Infinity);
      return rows.sort((a, b) => key(a) - key(b) || b.score - a.score);
    }

    return rows.sort((a, b) => b.score - a.score);
  }

  function applyFilter() {
    // While the data is still loading, keep the loading message instead of "no matches".
    if (loadState !== "ready") {
      updateSummary();
      return;
    }

    const input = byId("scholarship-filter");
    const q = parseQuery(input ? input.value : "");
    searchNote = "";

    let scored = [];
    const collect = (relaxed) => {
      scored = [];
      allScholarships.forEach((row) => {
        const score = scoreRecord(row.ix, q, relaxed);
        if (score > 0) scored.push({ row, score });
      });
    };

    collect(false);

    // "Canada" with nothing hosted there: say so, and show scholarships that mention it.
    if (!scored.length && (q.countries.length || filters.country)) {
      collect(true);
      if (scored.length) {
        const names = q.countries.concat(filters.country ? [filters.country] : []).map((c) => knownCountries.get(c) || c);
        searchNote = `No scholarships are hosted in ${names.join(", ")}. Showing ones that mention it.`;
      }
    }

    visible = sortRows(scored).map((r) => r.row);
    shown = CARDS_PER_STEP;
    renderScholarships();
  }

  let filterTimer = null;

  function filterScholarships() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(applyFilter, 120);
  }

  function setScholarshipFilter(value) {
    const input = byId("scholarship-filter");
    if (!input) return;

    clearTimeout(filterTimer);
    input.value = value ?? "";
    applyFilter();
  }

  function clearScholarshipFilter() {
    const input = byId("scholarship-filter");
    if (input) input.value = "";

    clearTimeout(filterTimer);
    filters.country = "";
    filters.degree = "";
    filters.full = false;
    filters.stem = false;
    filters.sort = "best";
    syncFacets();
    applyFilter();
  }

  /* ---- filter bar (country / level / funding / sort) ------------------- */

  function syncFacets() {
    const bar = byId("scholarshipFacets");
    if (!bar) return;

    const set = (id, v) => {
      const el = byId(id);
      if (el) el.value = v;
    };
    set("sf-country", filters.country);
    set("sf-degree", filters.degree);
    set("sf-sort", filters.sort);

    bar.querySelectorAll("[data-sf-flag]").forEach((b) => {
      b.setAttribute("aria-pressed", String(Boolean(filters[b.dataset.sfFlag])));
    });
  }

  function injectFacetStyles() {
    if (byId("scholarship-facet-styles")) return;
    const style = document.createElement("style");
    style.id = "scholarship-facet-styles";
    style.textContent =
      "#scholarshipFacets{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0 4px}" +
      "#scholarshipFacets select{min-height:40px;padding:0 12px;border-radius:12px;border:1px solid var(--border,#e2e8f0);background:var(--card-bg,transparent);color:var(--text,inherit);font:inherit;font-size:.88rem;max-width:100%}" +
      "#scholarshipFacets .sf-chip,#scholarshipFacets .sf-reset{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--border,#e2e8f0);background:transparent;color:var(--text,inherit);font:600 .84rem/1 var(--font-body,inherit);cursor:pointer}" +
      "#scholarshipFacets .sf-chip[aria-pressed='true']{background:var(--primary,#6d5dfb);border-color:var(--primary,#6d5dfb);color:#fff}" +
      "#scholarshipFacets .sf-reset{border-style:dashed;color:var(--text-muted,#8a8aa3)}" +
      "#scholarshipFacets .sf-chip:focus-visible,#scholarshipFacets .sf-reset:focus-visible,#scholarshipFacets select:focus-visible{outline:2px solid var(--primary,#6d5dfb);outline-offset:2px}";
    document.head.appendChild(style);
  }

  function buildFacets() {
    if (!getGrid() || byId("scholarshipFacets")) return;

    const anchor = document.querySelector(".scholarship-search-card");
    if (!anchor) return;

    injectFacetStyles();

    const bar = document.createElement("div");
    bar.id = "scholarshipFacets";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Filter scholarships");
    bar.innerHTML =
      '<select id="sf-country" aria-label="Host country"><option value="">All host countries</option></select>' +
      '<select id="sf-degree" aria-label="Degree level">' +
      '<option value="">All degree levels</option><option value="bachelor">Bachelor\'s</option><option value="master">Master\'s</option><option value="phd">PhD</option></select>' +
      '<button type="button" class="sf-chip" data-sf-flag="full" aria-pressed="false">Fully funded</button>' +
      '<button type="button" class="sf-chip" data-sf-flag="stem" aria-pressed="false">STEM</button>' +
      '<select id="sf-sort" aria-label="Sort by"><option value="best">Best match</option><option value="deadline">Deadline: soonest</option><option value="name">Name A–Z</option></select>' +
      '<button type="button" class="sf-reset" id="sf-reset">Reset filters</button>';

    anchor.insertAdjacentElement("afterend", bar);

    bar.addEventListener("change", (e) => {
      const t = e.target;
      if (t.id === "sf-country") filters.country = t.value;
      if (t.id === "sf-degree") filters.degree = t.value;
      if (t.id === "sf-sort") filters.sort = t.value;
      applyFilter();
    });

    bar.addEventListener("click", (e) => {
      const flag = e.target.closest("[data-sf-flag]");
      if (flag) {
        filters[flag.dataset.sfFlag] = !filters[flag.dataset.sfFlag];
        syncFacets();
        applyFilter();
        return;
      }
      if (e.target.closest("#sf-reset")) clearScholarshipFilter();
    });
  }

  /** Fill the country dropdown from what the data really contains. */
  function populateCountryFacet() {
    const select = byId("sf-country");
    if (!select) return;

    const keep = filters.country;
    select.innerHTML = '<option value="">All host countries</option>';

    [...knownCountries.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .forEach(([canon, display]) => {
        const option = document.createElement("option");
        option.value = canon;
        option.textContent = display;
        select.appendChild(option);
      });

    select.value = keep;
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

    if (loadState === "ready" && searchNote) resultsText.textContent += ` · ${searchNote}`;
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

      knownCountries = new Map();
      allScholarships = rows.map((data) => ({ data, ix: buildIndex(data) }));
      loadState = "ready";

      buildFacets();
      populateCountryFacet();
      syncFacets();

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
/* ==========================================================================
   UniAI — Scholarship eligibility engine (eligibility.js)

   Load BEFORE scholarship.js (it works on index.html and scholarship.html):
     <script src="JS/eligibility.js"></script>
     <script src="JS/scholarship.js"></script>

   Compares a scholarship row (Supabase `scholarship` table) with the Study
   Identity saved by preferences.js and returns:

     { score: 0-100,
       status: "eligible" | "check" | "unlikely",
       label:  "Eligible" | "Check" | "Unlikely",
       reasons: [ { type: "ok" | "info" | "warn" | "bad", text } ] }

   Hard checks (can make a scholarship "Unlikely"):
     - citizenship vs eligible_countries
     - degree level vs degree_level_final / degree_level / degree_level_inferred
   Soft checks (can make it "Check"):
     - subject areas vs field of study, target groups
   Relevance only (never changes eligibility):
     - host country vs your destinations, funding vs your need for aid

   This is a screening tool, not an official decision: always confirm on the
   provider's page. The text fields are free-form, so unclear data is
   reported as "Check", never silently as "Eligible".
   ========================================================================== */

(function () {
  "use strict";

  const PREFS_KEY = "uniai-preferences";

  /* ------------------------------------------------------------------------
     Country knowledge
     ------------------------------------------------------------------------ */

  const ALIASES = {
    usa: "united states",
    us: "united states",
    "united states of america": "united states",
    america: "united states",
    uk: "united kingdom",
    britain: "united kingdom",
    "great britain": "united kingdom",
    england: "united kingdom",
    uae: "united arab emirates",
    korea: "south korea",
    "republic of korea": "south korea",
    holland: "netherlands",
    czechia: "czech republic",
    "viet nam": "vietnam",
    "russian federation": "russia",
    turkiye: "turkey",
    "türkiye": "turkey"
  };

  const DEMONYMS = {
    india: ["indian"],
    pakistan: ["pakistani"],
    bangladesh: ["bangladeshi"],
    nepal: ["nepali", "nepalese"],
    "sri lanka": ["sri lankan"],
    nigeria: ["nigerian"],
    ghana: ["ghanaian"],
    kenya: ["kenyan"],
    uganda: ["ugandan"],
    tanzania: ["tanzanian"],
    ethiopia: ["ethiopian"],
    "south africa": ["south african"],
    egypt: ["egyptian"],
    china: ["chinese"],
    vietnam: ["vietnamese"],
    indonesia: ["indonesian"],
    philippines: ["filipino", "philippine"],
    malaysia: ["malaysian"],
    thailand: ["thai"],
    "united states": ["american"],
    "united kingdom": ["british"],
    canada: ["canadian"],
    australia: ["australian"],
    "new zealand": ["new zealander"],
    germany: ["german"],
    france: ["french"],
    italy: ["italian"],
    spain: ["spanish"],
    netherlands: ["dutch"],
    ireland: ["irish"],
    japan: ["japanese"],
    "south korea": ["korean"],
    brazil: ["brazilian"],
    mexico: ["mexican"],
    colombia: ["colombian"],
    turkey: ["turkish"],
    iran: ["iranian"],
    "united arab emirates": ["emirati"]
  };

  // Rough groupings used to read phrases like "Commonwealth countries".
  const COUNTRY_INFO = {
    india: { regions: ["asia", "south asia"], commonwealth: true, developing: true },
    pakistan: { regions: ["asia", "south asia"], commonwealth: true, developing: true },
    bangladesh: { regions: ["asia", "south asia"], commonwealth: true, developing: true },
    "sri lanka": { regions: ["asia", "south asia"], commonwealth: true, developing: true },
    nepal: { regions: ["asia", "south asia"], developing: true },
    china: { regions: ["asia", "east asia"], developing: true },
    vietnam: { regions: ["asia", "southeast asia"], developing: true },
    indonesia: { regions: ["asia", "southeast asia"], developing: true },
    philippines: { regions: ["asia", "southeast asia"], developing: true },
    malaysia: { regions: ["asia", "southeast asia"], commonwealth: true, developing: true },
    thailand: { regions: ["asia", "southeast asia"], developing: true },
    nigeria: { regions: ["africa", "sub-saharan africa"], commonwealth: true, developing: true },
    ghana: { regions: ["africa", "sub-saharan africa"], commonwealth: true, developing: true },
    kenya: { regions: ["africa", "sub-saharan africa"], commonwealth: true, developing: true },
    uganda: { regions: ["africa", "sub-saharan africa"], commonwealth: true, developing: true },
    tanzania: { regions: ["africa", "sub-saharan africa"], commonwealth: true, developing: true },
    ethiopia: { regions: ["africa", "sub-saharan africa"], developing: true },
    "south africa": { regions: ["africa", "sub-saharan africa"], commonwealth: true, developing: true },
    egypt: { regions: ["africa", "middle east", "north africa"], developing: true },
    brazil: { regions: ["latin america", "south america"], developing: true },
    mexico: { regions: ["latin america", "north america"], developing: true },
    colombia: { regions: ["latin america", "south america"], developing: true },
    turkey: { regions: ["europe", "middle east"], developing: true },
    iran: { regions: ["asia", "middle east"], developing: true },
    "united states": { regions: ["north america"] },
    canada: { regions: ["north america"], commonwealth: true },
    "united kingdom": { regions: ["europe"], commonwealth: true },
    australia: { regions: ["oceania"], commonwealth: true },
    "new zealand": { regions: ["oceania"], commonwealth: true },
    germany: { regions: ["europe"], eu: true },
    france: { regions: ["europe"], eu: true },
    italy: { regions: ["europe"], eu: true },
    spain: { regions: ["europe"], eu: true },
    netherlands: { regions: ["europe"], eu: true },
    ireland: { regions: ["europe"], eu: true },
    japan: { regions: ["asia", "east asia"] },
    "south korea": { regions: ["asia", "east asia"] }
  };

  /* ------------------------------------------------------------------------
     Subject clusters (regex sources)
     ------------------------------------------------------------------------ */

  const CLUSTERS = {
    cs: ["comput", "software", "informatic", "information tech", "data", "\\bai\\b", "machine learn", "cyber", "\\bict\\b"],
    engineering: ["engineer", "mechanic", "electric", "civil", "robot", "aerospace", "industrial", "manufactur", "technolog"],
    science: ["physic", "chemi", "biolog", "math", "statistic", "environment", "earth", "astronom", "natural science", "life science", "\\bscience"],
    health: ["medic", "health", "nurs", "pharm", "dental", "clinical", "biomedic"],
    business: ["business", "manage", "financ", "econom", "commerce", "account", "marketing", "entrepreneur", "\\bmba\\b", "banking"],
    social: ["social", "sociolog", "psycholog", "politic", "international relations", "\\blaw\\b", "legal", "humanit", "histor", "philosoph", "education", "communicat", "media", "journalis", "anthropolog", "development", "public policy"],
    arts: ["\\bart", "design", "music", "film", "architect", "creative", "literature", "linguist"],
    agri: ["agricult", "food", "forest", "veterinar", "animal", "fisher"]
  };

  const STEM_CLUSTERS = ["cs", "engineering", "science"];
  const STOP_WORDS = new Set(["and", "the", "for", "with", "studies", "science", "sciences", "applied", "general"]);

  /* ------------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------------ */

  const lower = (v) =>
    (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v)).toLowerCase().trim();

  const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const isTrue = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";

  const titleCase = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());

  const shorten = (s, n = 90) => {
    const t = String(s || "").trim();
    return t.length <= n ? t : `${t.slice(0, n).trim()}…`;
  };

  function canon(value) {
    let t = String(value || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^the /, "");

    if (ALIASES[t]) return ALIASES[t];

    for (const [country, names] of Object.entries(DEMONYMS)) {
      if (names.includes(t)) return country;
    }

    return t;
  }

  function namesFor(country) {
    const names = new Set([country]);
    (DEMONYMS[country] || []).forEach((n) => names.add(n));

    Object.entries(ALIASES).forEach(([alias, target]) => {
      if (target === country && alias !== "us") names.add(alias);
    });

    return Array.from(names);
  }

  const wordRe = (names) =>
    new RegExp(`(^|[^a-z])(${names.map(escRe).join("|")})(?![a-z])`, "i");

  /* ------------------------------------------------------------------------
     Profile (read straight from storage so it works on every page)
     ------------------------------------------------------------------------ */

  let profileCache;
  let profileSig = "";
  const resultCache = new Map();

  function readProfile() {
    let raw = null;

    try {
      raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    } catch (err) {
      raw = null;
    }

    if (!raw || typeof raw !== "object") return null;

    const countries = (Array.isArray(raw.countries) ? raw.countries : [])
      .filter((c) => c && c !== "Not sure yet");

    const profile = {
      degree: raw.degree || "",
      field: String(raw.field || "").trim(),
      citizenship: String(raw.citizenship || "").trim(),
      countries,
      needsScholarship: Boolean(raw.budget && raw.budget.needsScholarship),
      priority: (raw.ai && raw.ai.priority) || "balanced"
    };

    const hasAnything =
      profile.degree || profile.field || profile.citizenship || profile.countries.length;

    return hasAnything ? profile : null;
  }

  function getProfile() {
    if (profileCache === undefined) {
      profileCache = readProfile();
      profileSig = JSON.stringify(profileCache);
    }
    return profileCache;
  }

  function invalidate() {
    profileCache = undefined;
    resultCache.clear();
  }

  window.addEventListener("uniai:preferences", invalidate);
  window.addEventListener("storage", (e) => {
    if (e.key === PREFS_KEY) invalidate();
  });

  function levelKey(degree) {
    const t = lower(degree);
    if (/bachelor|undergrad/.test(t)) return "bachelor";
    if (/master|postgrad/.test(t)) return "master";
    if (/phd|doctor/.test(t)) return "phd";
    if (/diploma/.test(t)) return "diploma";
    return "";
  }

  const LEVEL_LABEL = { bachelor: "Bachelor's", master: "Master's", phd: "PhD", diploma: "Diploma", all: "all levels" };

  /* ------------------------------------------------------------------------
     Factors. Each returns { type, text, credit }.
     ------------------------------------------------------------------------ */

  const factor = (type, text, credit) => ({ type, text, credit });

  function citizenshipFactor(s, profile) {
    const text = lower(s.eligible_countries);

    if (!text) {
      return factor("info", "No nationality restriction listed", 0.7);
    }

    if (!profile.citizenship) {
      return factor("info", "Add your citizenship to check nationality rules", 0.5);
    }

    const country = canon(profile.citizenship);
    const display = titleCase(profile.citizenship);
    const names = namesFor(country);
    const info = COUNTRY_INFO[country];

    const exclusion = new RegExp(
      `(excluding|except(?:ing)?|not (?:including|open to)|excluded)[^.;\\n]{0,200}(^|[^a-z])(${names.map(escRe).join("|")})(?![a-z])`,
      "i"
    );

    if (exclusion.test(text)) {
      return factor("bad", `Not open to applicants from ${display}`, 0);
    }

    if (wordRe(names).test(text)) {
      return factor("ok", `Open to applicants from ${display}`, 1);
    }

    if (info) {
      if (/commonwealth/.test(text) && info.commonwealth) {
        return factor("ok", `Open to Commonwealth countries, which includes ${display}`, 1);
      }

      if (
        /(developing|low[- ]and[- ]middle|low[- ]income|lmic|global south|emerging econom)/.test(text) &&
        info.developing
      ) {
        return factor("ok", `Open to developing countries, which includes ${display}`, 0.9);
      }

      const region = info.regions.find((r) => text.includes(r));
      if (region) {
        return factor("ok", `Open to applicants from ${titleCase(region)}`, 0.9);
      }

      if (/non[- ]?(eu|eea)/.test(text) && !info.eu) {
        return factor("ok", "Open to applicants from outside the EU/EEA", 0.9);
      }

      if (/(\beu\b|european union|\beea\b)/.test(text) && !/international|non[- ]?eu/.test(text) && !info.eu) {
        return factor("bad", "Restricted to EU/EEA nationals", 0);
      }
    }

    if (
      /\b(all|any|every)\b[^.]{0,25}\b(countr|nationalit|citizen|international|applicant|student)/.test(text) ||
      /\bworldwide\b|\bopen to (all|everyone)\b|\binternational (students?|applicants?)\b/.test(text)
    ) {
      return factor("ok", "Open to international applicants", 1);
    }

    // A region phrase we can't place for this country: don't guess.
    if (
      !info &&
      /(commonwealth|developing|africa|asia|europe|america|caribbean|pacific|middle east|region)/.test(text)
    ) {
      return factor("warn", `Check whether ${display} qualifies: ${shorten(s.eligible_countries, 70)}`, 0.4);
    }

    return factor("bad", `${display} isn't in the eligible countries list`, 0);
  }

  function parseLevels(value) {
    const t = lower(value);
    const set = new Set();
    if (!t) return set;

    if (/\b(all|any|every)\b[^.]{0,20}\b(level|degree|stage)/.test(t)) set.add("all");
    if (/undergrad|bachelor|\bbsc\b|\bbeng\b|first degree/.test(t)) set.add("bachelor");

    if (/post[- ]?grad|\bmaster|\bmsc\b|\bmba\b|\bmeng\b|\bllm\b/.test(t)) {
      set.add("master");
      if (/post[- ]?grad/.test(t)) set.add("phd");
    }

    if (/\bgraduate\b/.test(t)) {
      set.add("master");
      set.add("phd");
    }

    if (/phd|doctor|dphil|research degree|postdoc/.test(t)) set.add("phd");
    if (/diploma|certificate|vocational/.test(t)) set.add("diploma");

    return set;
  }

  function degreeFactor(s, profile) {
    const mine = levelKey(profile.degree);
    if (!mine) return factor("info", "Add your degree level to check this", 0.5);

    const levels = parseLevels(
      [s.degree_level_final, s.degree_level, s.degree_level_inferred].filter(Boolean).join(", ")
    );

    if (!levels.size) return factor("info", "No degree-level restriction listed", 0.7);

    if (levels.has("all") || levels.has(mine)) {
      return factor("ok", `Open to ${LEVEL_LABEL[mine]} students`, 1);
    }

    const list = Array.from(levels).map((l) => LEVEL_LABEL[l]).join(" / ");
    return factor("bad", `For ${list} only. You're aiming for a ${LEVEL_LABEL[mine]}`, 0);
  }

  function clustersOf(text) {
    const t = lower(text);
    const out = new Set();

    for (const [name, patterns] of Object.entries(CLUSTERS)) {
      if (patterns.some((p) => new RegExp(p, "i").test(t))) out.add(name);
    }

    return out;
  }

  function subjectFactor(s, profile) {
    const subjects = lower(s.subject_areas);

    if (!subjects) return factor("info", "No subject restriction listed", 0.7);
    if (!profile.field) return factor("info", "Add your field of study to check subject fit", 0.5);

    if (
      /\b(all|any|various|every|open to)\b[^.]{0,25}\b(subject|field|discipline|area|course|program)/.test(subjects) ||
      /\ball (subjects|fields|disciplines)\b|\bany (subject|field|discipline)\b|\bvarious\b|\bmultidisciplinary\b/.test(subjects)
    ) {
      return factor("ok", "Open to all subjects", 1);
    }

    const mine = clustersOf(profile.field);
    const theirs = clustersOf(subjects);

    const words = lower(profile.field)
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

    if (words.some((w) => subjects.includes(w))) {
      return factor("ok", `Subjects include ${shorten(profile.field, 40)}`, 1);
    }

    if (isTrue(s.stem_flag) && STEM_CLUSTERS.some((c) => mine.has(c))) {
      return factor("ok", "STEM scholarship, which fits your field", 1);
    }

    if ([...mine].some((c) => theirs.has(c))) {
      return factor("ok", "Subject area matches your field", 0.9);
    }

    return factor("warn", `Listed subjects (${shorten(s.subject_areas, 60)}) don't clearly cover ${shorten(profile.field, 40)}`, 0.35);
  }

  function destinationFactor(s, profile) {
    const host = lower(s.host_country);

    if (!profile.countries.length) return factor("info", "Pick destinations in your Study Identity to compare", 0.6);
    if (!host) return factor("info", "Host country not listed", 0.6);

    if (/\b(multiple|various|any|worldwide|international|global)\b/.test(host)) {
      return factor("ok", "Can be used in several countries", 0.9);
    }

    const matched = profile.countries.find((dest) => wordRe(namesFor(canon(dest))).test(host));

    if (matched) return factor("ok", `Study in ${titleCase(matched)}, one of your destinations`, 1);

    return factor(
      "info",
      `Hosted in ${titleCase(String(s.host_country).split(",")[0].trim())}, not one of your destinations`,
      0.2
    );
  }

  function fundingFactor(s, profile) {
    const full = isTrue(s.is_fully_funded);

    if (profile.needsScholarship) {
      return full
        ? factor("ok", "Fully funded, matching your need for financial aid", 1)
        : factor("info", "Partial funding. Your profile says you need financial aid", 0.4);
    }

    return full
      ? factor("ok", "Fully funded", 0.9)
      : factor("info", "Partial funding", 0.7);
  }

  function targetGroupFactor(s) {
    const t = lower(s.target_groups);
    if (!t) return null;

    const generic =
      /^(all|any|general|none|n\/a|na|everyone|international students?|students?)\b/.test(t) ||
      /\ball (students|applicants)\b/.test(t);

    if (generic) return null;

    return factor("warn", `Aimed at: ${shorten(s.target_groups, 70)}. Check that you qualify`, 0.6);
  }

  /* ------------------------------------------------------------------------
     Evaluate
     ------------------------------------------------------------------------ */

  const WEIGHTS = { citizenship: 30, degree: 25, subject: 20, destination: 15, funding: 10 };

  function evaluate(s, profileOverride) {
    const profile = profileOverride || getProfile();
    if (!profile || !s) return null;

    const cacheKey = profileOverride ? null : `${s.scholarship_id}|${profileSig}`;
    if (cacheKey && resultCache.has(cacheKey)) return resultCache.get(cacheKey);

    const factors = {
      citizenship: citizenshipFactor(s, profile),
      degree: degreeFactor(s, profile),
      subject: subjectFactor(s, profile),
      destination: destinationFactor(s, profile),
      funding: fundingFactor(s, profile)
    };

    const target = targetGroupFactor(s);
    const reasons = Object.values(factors).map(({ type, text }) => ({ type, text }));
    if (target) reasons.push({ type: target.type, text: target.text });

    let total = 0;
    let max = 0;

    for (const [name, weight] of Object.entries(WEIGHTS)) {
      total += weight * factors[name].credit;
      max += weight;
    }

    let score = (total / max) * 100;

    const comp = lower(s.competitiveness);
    if (/very high|extreme|highly competitive/.test(comp)) {
      score *= 0.85;
      reasons.push({ type: "info", text: "Very competitive" });
    } else if (/\bhigh\b/.test(comp)) {
      score *= 0.92;
      reasons.push({ type: "info", text: "Competitive" });
    }

    if (target) score *= 0.9;

    const hardFail = factors.citizenship.type === "bad" || factors.degree.type === "bad";
    const needsInfo = !profile.citizenship || !levelKey(profile.degree);
    const anyWarn = Object.values(factors).some((f) => f.type === "warn") || Boolean(target);

    let status;
    if (hardFail) status = "unlikely";
    else if (anyWarn || needsInfo) status = "check";
    else status = "eligible";

    if (status === "unlikely") score = Math.min(score, 39);
    else if (status === "check") score = Math.min(score, 84);
    else score = Math.max(score, 60);

    const result = {
      id: String(s.scholarship_id),
      score: Math.round(score),
      status,
      label: status === "eligible" ? "Eligible" : status === "check" ? "Check" : "Unlikely",
      reasons
    };

    if (cacheKey) resultCache.set(cacheKey, result);
    return result;
  }

  function describeProfile(profile) {
    profile = profile || getProfile();
    if (!profile) return "";

    const bits = [];
    if (profile.degree) bits.push(profile.degree);
    if (profile.field) bits.push(profile.field);
    if (profile.citizenship) bits.push(`${titleCase(profile.citizenship)} citizen`);

    let text = bits.join(" · ");
    if (profile.countries.length) text += `${text ? " → " : ""}${profile.countries.join(", ")}`;

    return text;
  }

  window.UniAIEligibility = {
    getProfile,
    hasProfile: () => Boolean(getProfile()),
    needsCitizenship: () => {
      const p = getProfile();
      return Boolean(p) && !p.citizenship;
    },
    evaluate,
    describeProfile,
    invalidate,
    // exposed for tests
    _parseLevels: parseLevels,
    _canon: canon
  };
})();
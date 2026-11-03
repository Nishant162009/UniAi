/* ==========================================================================
   UniAI — Adaptive country experience (JS/region.js)   [v3]

   ONE layout for every destination (USA, Japan, UK, Germany, South Korea).
   Only the data below changes: name/flag, hero art, universities, guides,
   Quick Facts, AI chips and the "Why choose" list. Layout, spacing and
   hierarchy are identical because they come from a single template.

   Real data only
   --------------
   * University counts, QS ranks, logos, banners and links: your /universities API.
   * Continue Your Journey: the signed-in user's own data — profile quests
     (Supabase metadata), UniAISaved, UniAITracker and roadmapProgress.
   * Quick Facts tuition / living cost / language / intake are TYPICAL RANGES
     typed into COUNTRIES below. Verify them against official sources before
     launch (they are labelled as typical ranges on screen).
   * Nothing is invented: no ratings, success rates or scholarship counts.

   Images: assets/regions/<id>/  hero.jpg  mascot.png  uni1..4.jpg  guide1..4.jpg
   — only the files named in a country's `img` setting are requested; anything
   missing falls back to generated art / a gradient tile.

   Entry points: topbar "Destination" button (beside the theme toggle) opens the
   country chooser; the selected country also shows beside the sidebar logo.

   API (other modules):
     UniAIRegion.get()    -> { id, name, flag, brand, inName, country, currency,
                               interview, isWorld }  (country = DB name, "" = World)
     UniAIRegion.set(id)  -> "world" | "us" | "jp" | "uk" | "de" | "kr"
     UniAIRegion.open() / close() / browse() / add(id, def) / list()
     window event "uniai:region-change"  (event.detail = get())
   ========================================================================== */

(function () {
  "use strict";
  if (window.UniAIRegion) return;

  const KEY = "uniai-country";
  const OLD_KEY = "uniai-region";
  const EVENT = "uniai:region-change";
  const CACHE_PREFIX = "uniai-country-data-v3:";
  const CACHE_TTL = 24 * 3600 * 1000;

  /* ------------------------------ the data ------------------------------ */

  const FULL = { hero: 1, mascot: 1, unis: 4, guides: 4 };
  const BASIC = { hero: 1, mascot: 1 };

  const COUNTRIES = {
    us: {
      name: "United States", brand: "USA", inName: "the USA", currency: "USD", interview: "US",
      db: ["United States", "United States of America", "USA", "US"],
      title: "USA", tagline: ["World-class education, ", "endless opportunities."],
      sub: "Explore top universities, scholarships and everything you need to know about studying in the United States.",
      img: FULL, thumbs: [1, 2, 4, 3], eduHref: "guides/usa.html",
      facts: [["🎓", "Average Tuition", "$20,000 – $60,000/year"], ["🏠", "Living Cost", "$1,200 – $2,000/month"], ["💬", "Language Requirement", "TOEFL / IELTS"], ["📅", "Intake Periods", "Aug – Jan"]],
      unis: [
        ["Harvard University", "Cambridge, MA", ["Research", "Innovation"], ["harvard"]],
        ["MIT", "Cambridge, MA", ["Engineering", "Tech"], ["massachusetts institute", "mit"]],
        ["Stanford University", "Stanford, CA", ["Innovation", "Research"], ["stanford"]],
        ["UC Berkeley", "Berkeley, CA", ["Research", "Tech"], ["california, berkeley", "uc berkeley", "berkeley"]]
      ],
      why: ["Top-ranked universities", "Cutting-edge research", "Diverse culture", "Global career opportunities"],
      chips: ["Best universities for Robotics?", "How much does studying here cost?", "What are the visa requirements?"]
    },
    jp: {
      name: "Japan", brand: "Japan", inName: "Japan", currency: "JPY", interview: "JP",
      db: ["Japan"],
      title: "Japan", tagline: ["Innovate. Learn. ", "Belong."],
      sub: "World-class education, cutting-edge technology and a unique culture — all in one incredible country.",
      img: FULL, thumbs: [1, 2, 3, 4], eduHref: "guides/japan.html",
      facts: [["🎓", "Average Tuition", "¥535,800/year (national universities)"], ["🏠", "Living Cost", "¥70,000 – ¥120,000/month"], ["💬", "Language Requirement", "JLPT N2 / N1 (Japanese-taught)"], ["📅", "Intake Periods", "Apr • Sep"]],
      unis: [
        ["The University of Tokyo", "Tokyo", ["Research", "Innovation"], ["university of tokyo"]],
        ["Kyoto University", "Kyoto", ["Research", "Tradition"], ["kyoto university"]],
        ["Osaka University", "Osaka", ["Engineering", "Research"], ["osaka university"]],
        ["Tokyo Institute of Technology", "Tokyo", ["Science", "Tech"], ["tokyo institute of technology", "tokyo tech", "institute of science tokyo"]]
      ],
      why: ["World-class education", "Cutting-edge research", "Unique culture & lifestyle", "Excellent career opportunities"],
      chips: ["Best universities for Robotics?", "How much does studying here cost?", "What are the visa requirements?"]
    },
    uk: {
      name: "United Kingdom", brand: "UK", inName: "the UK", currency: "GBP", interview: "UK",
      db: ["United Kingdom", "UK", "England", "Great Britain"],
      title: "the UK", tagline: ["Learn. Explore. ", "Achieve."],
      sub: "World-renowned universities, rich culture and endless opportunities.",
      img: BASIC, thumbs: [1, 2, 3, 4], eduHref: "guides/uk.html",
      facts: [["🎓", "Average Tuition", "£11,000 – £38,000/year"], ["🏠", "Living Cost", "£1,000 – £1,600/month"], ["💬", "Language Requirement", "IELTS (UKVI) / TOEFL"], ["📅", "Intake Periods", "Sep • Jan"]],
      unis: [
        ["University of Oxford", "Oxford", ["Research", "Tradition"], ["university of oxford", "oxford"]],
        ["University of Cambridge", "Cambridge", ["Research", "Excellence"], ["university of cambridge", "cambridge"]],
        ["Imperial College London", "London", ["Science", "Tech"], ["imperial college"]],
        ["UCL", "London", ["Research", "Innovation"], ["university college london", "ucl"]]
      ],
      why: ["Globally respected degrees", "Shorter courses, lower total cost", "Post-study work route", "Rich history and culture"],
      chips: ["What are the undergraduate admission requirements?", "How much does studying here cost?", "What are the visa requirements?"]
    },
    de: {
      name: "Germany", brand: "Germany", inName: "Germany", currency: "EUR", interview: "DE",
      db: ["Germany"],
      title: "Germany", tagline: ["Engineer. Innovate. ", "Excel."],
      sub: "World-class education, affordable tuition and strong career opportunities.",
      img: BASIC, thumbs: [1, 2, 3, 4], eduHref: "guides/germany.html",
      facts: [["🎓", "Average Tuition", "€0 – €3,000/year (public)"], ["🏠", "Living Cost", "€850 – €1,200/month"], ["💬", "Language Requirement", "IELTS / TOEFL, or TestDaF / DSH"], ["📅", "Intake Periods", "Oct (winter) • Apr (summer)"]],
      unis: [
        ["Technical University of Munich", "Munich", ["Engineering", "Research"], ["technical university of munich", "technische universität münchen", "tum"]],
        ["Heidelberg University", "Heidelberg", ["Research", "Medicine"], ["heidelberg"]],
        ["RWTH Aachen University", "Aachen", ["Engineering", "Tech"], ["rwth"]],
        ["Humboldt University of Berlin", "Berlin", ["Research", "Arts"], ["humboldt"]]
      ],
      why: ["Low or no tuition (public universities)", "Strong research", "Excellent job prospects", "Heart of Europe"],
      chips: ["Can I study engineering in English?", "How much does studying here cost?", "What are the visa requirements?"]
    },
    kr: {
      name: "South Korea", brand: "South Korea", inName: "South Korea", currency: "KRW", interview: "KR",
      db: ["South Korea", "Korea, South", "Republic of Korea", "Korea"],
      title: "South Korea", tagline: ["Innovate. Learn. ", "Grow."],
      sub: "World-class education, cutting-edge technology and a vibrant culture — all in one incredible country.",
      img: BASIC, thumbs: [1, 2, 3, 4], eduHref: "page:studyAbroadGuide",
      facts: [["🎓", "Average Tuition", "₩5,000,000 – ₩10,000,000/year"], ["🏠", "Living Cost", "₩800,000 – ₩1,500,000/month"], ["💬", "Language Requirement", "TOPIK / IELTS / TOEFL"], ["📅", "Intake Periods", "Mar • Sep"]],
      unis: [
        ["Seoul National University", "Seoul", ["Research", "Innovation"], ["seoul national"]],
        ["KAIST", "Daejeon", ["Engineering", "Tech"], ["kaist", "korea advanced institute"]],
        ["Yonsei University", "Seoul", ["Research", "Global"], ["yonsei"]],
        ["Korea University", "Seoul", ["Research", "Tech"], ["korea university"]]
      ],
      why: ["Top-ranked universities", "Strong tech & research", "Vibrant student life", "Excellent career opportunities"],
      chips: ["What scholarships are available for international students?", "How much does studying here cost?", "What are the visa requirements?"]
    }
  };

  const TABS = [
    ["overview", "🏠", "Overview"], ["unis", "🏆", "Top Universities"], ["scholarships", "🎁", "Scholarships"],
    ["admission", "📄", "Admission Guide"], ["living", "🏡", "Living Costs"], ["career", "💼", "Career Opportunities"]
  ];

  /* the four guide cards — identical for every country */
  function guidesFor(id) {
    const c = COUNTRIES[id];
    return [
      ["⛩️", `Education System in ${c.brand}`, "How degrees, semesters and admissions work.", c.eduHref],
      ["🛂", "Student Visa Guide", "Documents and steps to get your student visa.", "guides/student-visa.html"],
      ["🎓", `Scholarships in ${c.brand}`, "Funding options for international students.", "guides/scholarships.html"],
      ["🏙️", `Life in ${c.brand}`, "Housing, daily costs and settling in.", "guides/accommodation.html"]
    ];
  }

  /* ------------------------------ helpers ------------------------------ */

  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const apiBase = () => (typeof CONFIG !== "undefined" && CONFIG && CONFIG.API_BASE) || "";
  const userName = () => { const el = $("nav-username"); const n = el && el.textContent.trim(); return n && n.length < 40 ? n : ""; };
  const go = (page) => (typeof window.showPage === "function" ? window.showPage(page) : null);
  const T = () => window.UniAITheme || null;
  const flag = (id) => (T() ? T().flag(id) : "");
  const asset = (id, file) => `assets/regions/${id}/${file}`;
  const IMG_GONE = `onerror="this.remove()"`;
  const initialsOf = (n) => String(n).split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const safeImg = (u) => (/^https?:\/\//i.test(u || "") || /^[\w./-]+\.(png|jpe?g|webp|svg)$/i.test(u || "") ? u : "");

  // Whole-word match for short terms ("mit", "ucl", "tum") so "Smith" never matches "mit".
  function nameHas(name, terms) {
    const n = String(name || "").toLowerCase();
    return terms.some((t) => (t.length <= 4 ? new RegExp(`(^|[^a-z])${t}([^a-z]|$)`).test(n) : n.includes(t)));
  }

  // Emoji flags only for OTHER modules that read get().flag (this file uses SVG flags).
  const FLAG_EMOJI = { us: "🇺🇸", jp: "🇯🇵", uk: "🇬🇧", de: "🇩🇪", kr: "🇰🇷" };

  let current = "world";
  let lastFocus = null;
  const live = {};   // id -> { total, capped, top100, match:{index:{rank,slug,logo,banner}} }
  const state = {};  // id -> "loading" | "ok" | "fail"

  function describe(id) {
    const c = COUNTRIES[id];
    if (!c) return { id: "world", name: "World", flag: "🌍", brand: "World", inName: "the world", country: "", currency: "USD", interview: "US", isWorld: true };
    return { id, name: c.name, flag: FLAG_EMOJI[id] || "", brand: c.brand, inName: c.inName, country: c.db[0], currency: c.currency, interview: c.interview, isWorld: false };
  }

  /* --------------------------- live DB numbers --------------------------- */

  async function loadLive(id) {
    const c = COUNTRIES[id];
    if (!c || live[id] || state[id] === "loading") return;
    const cached = readJSON(CACHE_PREFIX + id);
    if (cached && Date.now() - cached.at < CACHE_TTL) { live[id] = cached.data; state[id] = "ok"; return; }

    state[id] = "loading";
    for (const name of c.db) {
      try {
        const res = await fetch(`${apiBase()}/universities?country=${encodeURIComponent(name)}&sort=rank`);
        if (!res.ok) continue;
        const rows = await res.json();
        if (!Array.isArray(rows) || !rows.length) continue;

        const ranked = rows.filter((u) => Number(u.qs_rank) > 0).sort((a, b) => Number(a.qs_rank) - Number(b.qs_rank));
        const match = {};
        c.unis.forEach((u, i) => {
          const terms = u[3] || [];
          const hit = ranked.find((r) => nameHas(r.name, terms)) || rows.find((r) => nameHas(r.name, terms));
          if (hit) match[i] = { rank: Number(hit.qs_rank) > 0 ? Number(hit.qs_rank) : 0, slug: hit.slug || "", logo: safeImg(hit.logo), banner: safeImg(hit.banner) };
        });

        const data = { total: rows.length, capped: rows.length >= 1000, top100: ranked.filter((u) => Number(u.qs_rank) <= 100).length, match };
        live[id] = data; state[id] = "ok";
        try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ at: Date.now(), data })); } catch (e) { /* storage full */ }
        return;
      } catch (e) { /* try the next spelling */ }
    }
    state[id] = "fail";
  }

  /* ------------------------------ user data ------------------------------ */

  function savedList() {
    try { return window.UniAISaved && typeof window.UniAISaved.list === "function" ? window.UniAISaved.list() : []; } catch (e) { return []; }
  }
  const isUniSaved = (name) => savedList().some((s) => s && s.type === "university" && String(s.name).toLowerCase() === String(name).toLowerCase());

  function roadmapPct() {
    const raw = readJSON("roadmapProgress");
    if (!raw || typeof raw !== "object") return 0;
    const vals = Array.isArray(raw) ? raw : Object.values(raw);
    const boxes = document.querySelectorAll("[data-road]").length;
    const total = boxes || vals.length;
    return total ? Math.round((vals.filter(Boolean).length / total) * 100) : 0;
  }

  async function profilePct() {
    try {
      const db = window.supabaseApp;
      if (!db || !db.auth) return null;
      const { data } = await db.auth.getSession();
      const user = data && data.session && data.session.user;
      if (!user) return null;
      const m = user.user_metadata || {};
      const done = [Boolean(m.avatar_emoji), String(m.bio || "").trim().length >= 10, Array.isArray(m.dream_countries) && m.dream_countries.length > 0, Boolean(m.degree_goal)];
      return Math.round((done.filter(Boolean).length / done.length) * 100);
    } catch (e) { return null; }
  }

  function trackerSummary() {
    let apps = [];
    try { apps = window.UniAITracker && typeof window.UniAITracker.list === "function" ? window.UniAITracker.list() : []; } catch (e) { /* ignore */ }
    const sent = apps.filter((a) => ["submitted", "interview", "offer"].includes(a.status)).length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming = apps
      .filter((a) => ["shortlisted", "preparing"].includes(a.status) && a.deadline)
      .map((a) => ({ name: a.name, days: Math.round((new Date(a.deadline + "T00:00:00") - today) / 86400000) }))
      .filter((a) => Number.isFinite(a.days) && a.days >= 0)
      .sort((a, b) => a.days - b.days);
    return { total: apps.length, sent, upcoming };
  }

  async function renderJourney() {
    const host = $("ct-journey");
    const c = COUNTRIES[current];
    if (!host || !c) return;

    const saved = savedList();
    const unis = saved.filter((s) => s && s.type === "university");
    const schols = saved.filter((s) => s && s.type === "scholarship");
    const here = unis.filter((s) => s.country && c.db.some((n) => String(s.country).toLowerCase() === n.toLowerCase())).length;
    const t = trackerSummary();
    const road = roadmapPct();
    const prof = await profilePct();
    if (!$("ct-journey") || !COUNTRIES[current]) return; // user moved on while we waited

    const bar = (p) => `<span class="ct-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></span>`;
    const dl = t.upcoming.slice(0, 2);
    const tiles = [
      ["profile", "👤", "Profile completion", prof == null ? "—" : `${prof}%`, prof == null ? "Sign in to see your progress" : prof === 100 ? "Profile complete" : "Finish your profile", prof == null ? "" : bar(prof)],
      ["saved", "🔖", "Saved universities", String(unis.length), unis.length ? `${here} in ${esc(c.brand)}` : "Save a university to start", ""],
      ["saved", "🎁", "Scholarship shortlist", String(schols.length), schols.length ? "Open your shortlist" : "None saved yet", ""],
      ["tracker", "📝", "Application progress", t.total ? `${t.sent}/${t.total}` : "0", t.total ? "applications sent" : "Track your first application", t.total ? bar((t.sent / t.total) * 100) : ""],
      ["roadmap", "🗺️", "Roadmap checklist", `${road}%`, road ? "of your roadmap done" : "Start your roadmap", bar(road)],
      ["tracker", "⏰", "Upcoming deadlines", dl.length ? String(dl.length) : "0", dl.length ? dl.map((d) => `${esc(d.name)} — ${d.days === 0 ? "today" : `${d.days}d`}`).join("<br>") : "No deadlines set", ""]
    ];
    host.innerHTML = tiles.map(([act, ic, label, big, sub, extra]) =>
      `<button type="button" class="ct-jt" data-ct="journey" data-target="${act}"><span class="ct-jt-top"><span class="ct-ic">${ic}</span><small>${esc(label)}</small></span><b>${esc(big)}</b><em>${sub}</em>${extra}</button>`).join("");
  }

  /* ------------------------------ rendering ------------------------------ */

  function uniHTML(id, i) {
    const c = COUNTRIES[id], u = c.unis[i], m = live[id] && live[id].match[i];
    const local = c.img && c.img.unis > i ? asset(id, `uni${i + 1}.jpg`) : "";
    const banner = !local && m && m.banner ? m.banner : "";
    const photo = local || banner ? `<img src="${esc(local || banner)}" alt="" loading="lazy" ${IMG_GONE}>` : "";
    const logo = m && m.logo ? `<img src="${esc(m.logo)}" alt="" loading="lazy" ${IMG_GONE}>` : "";
    const saved = isUniSaved(u[0]);
    return `<article class="ct-uni" data-ct="uni" data-slug="${esc(m && m.slug)}" data-name="${esc(u[0])}">
      <div class="ct-uni-img"><span class="ct-ph">${esc(initialsOf(u[0]))}</span>${photo}
        <button type="button" class="ct-bm" data-ct="save" data-name="${esc(u[0])}" aria-pressed="${saved}" aria-label="${saved ? "Remove" : "Save"} ${esc(u[0])}">${saved ? "★" : "☆"}</button>
        ${m && m.rank ? `<span class="ct-rank">QS #${esc(m.rank)}</span>` : ""}</div>
      <span class="ct-logo">${esc(initialsOf(u[0]))}${logo}</span>
      <div class="ct-uni-body"><b>${esc(u[0])}</b><small>${esc(u[1])}, ${esc(c.brand === "USA" ? "USA" : c.brand)}</small>
        <div class="ct-tags">${u[2].map((t) => `<span>${esc(t)}</span>`).join("")}</div>
        <button type="button" class="ct-view" data-ct="uni" data-slug="${esc(m && m.slug)}" data-name="${esc(u[0])}">View details →</button></div></article>`;
  }

  const unisHTML = (id) => COUNTRIES[id].unis.map((_, i) => uniHTML(id, i)).join("");

  function factsHTML(id) {
    const c = COUNTRIES[id], l = live[id], st = state[id];
    const liveVal = (v) => (st === "ok" && l ? esc(v) : st === "fail" ? "—" : `<span class="ct-skel" aria-label="Loading"></span>`);
    const rows = [
      ["🏛️", "Top Universities (QS Top 100)", liveVal(l ? `${l.top100}${l.capped ? "+" : ""}` : "")],
      ["📚", "Universities on UniAI", liveVal(l ? `${l.total}${l.capped ? "+" : ""}` : "")]
    ].concat(c.facts.map(([ic, label, value]) => [ic, label, esc(value)]));
    return rows.map(([ic, label, value]) => `<div class="ct-fact"><div class="ct-ic">${ic}</div><div><small>${esc(label)}</small><b>${value}</b></div></div>`).join("");
  }

  function guidesHTML(id) {
    const c = COUNTRIES[id];
    return guidesFor(id).map(([ic, title, desc, href], i) => {
      const n = c.thumbs[i];
      const photo = c.img && c.img.guides >= n ? `<img src="${asset(id, `guide${n}.jpg`)}" alt="" loading="lazy" ${IMG_GONE}>` : "";
      const inApp = href.indexOf("page:") === 0;
      // Always an <a>, so every country's cards are identical; in-app targets are handled in onClick.
      const open = inApp ? `<a class="ct-guide" href="#" data-ct="page" data-page="${esc(href.slice(5))}">` : `<a class="ct-guide" href="${esc(href)}">`;
      return `${open}<div class="ct-gi">${ic}${photo}</div><div class="ct-gt"><b>${esc(title)}</b><p>${esc(desc)}</p><small>Read More →</small></div></a>`;
    }).join("");
  }

  function countryHTML(id) {
    const c = COUNTRIES[id];
    const name = userName();
    const tag = `${esc(c.tagline[0])}<em>${esc(c.tagline[1])}</em>`;
    const guides = guidesFor(id);
    return `
    <div class="ct-grid">
      <div class="ct-main">
        <section class="ct-hero" aria-label="Study in ${esc(c.brand)}">
          <div class="ct-art">${T() ? T().art(id) : ""}${c.img && c.img.hero ? `<img class="ct-photo" src="${asset(id, "hero.jpg")}" alt="" ${IMG_GONE}>` : ""}</div>
          <button type="button" class="ct-back" data-ct="chooser">← Back to Countries</button>
          <div class="ct-studyin">${flag(id)}<span>Study in</span></div>
          <h1 class="ct-name"><span>${esc(c.title)}</span></h1>
          <p class="ct-tag">${tag}</p>
          <p class="ct-sub">${esc(c.sub)}</p>
          <div class="ct-cta">
            <button type="button" class="ct-btn pri" data-ct="browse">Explore Universities →</button>
            <a class="ct-btn ghost" href="${esc(guides[0][3].indexOf("page:") === 0 ? "guides/university-application.html" : guides[0][3])}">▷ Watch Guide</a>
          </div>
        </section>

        <nav class="ct-tabs" aria-label="${esc(c.brand)} sections">
          ${TABS.map(([k, ic, label], i) => `<button type="button" class="ct-tab${i === 0 ? " on" : ""}" data-ct="tab" data-tab="${k}">${ic} ${esc(label)}</button>`).join("")}
        </nav>

        <section class="ct-card" id="ct-unis">
          <div class="ct-head"><h3>Top Universities in ${esc(c.inName === "the UK" ? "the UK" : c.brand)}</h3><button type="button" class="ct-link" data-ct="browse">View All →</button></div>
          <div class="ct-unis" id="ct-unis-grid">${unisHTML(id)}</div>
        </section>

        <section class="ct-card">
          <div class="ct-head"><h3>${esc(c.brand)} Study Guide</h3><button type="button" class="ct-link" data-ct="page" data-page="studyAbroadGuide">View All →</button></div>
          <div class="ct-guides">${guidesHTML(id)}</div>
        </section>

        <section class="ct-card">
          <div class="ct-head"><h3>Continue Your Journey</h3><button type="button" class="ct-link" data-ct="page" data-page="roadmap">Open roadmap →</button></div>
          <div class="ct-journey" id="ct-journey"><span class="ct-skel wide"></span></div>
        </section>
      </div>

      <div class="ct-side">
        <aside class="ct-card">
          <div class="ct-head"><h3>Quick Facts</h3><span class="ct-info" aria-hidden="true">i</span></div>
          <div class="ct-facts" id="ct-facts">${factsHTML(id)}</div>
          <p class="ct-note">Tuition, living cost, language and intake are typical ranges. Counts come from the UniAI database. Always confirm on each university's official site.</p>
          <button type="button" class="ct-btn ct-wide" data-ct="page" data-page="studyAbroadGuide">Country Guide →</button>
        </aside>

        <aside class="ct-card ct-ai">
          <div class="ct-ai-head"><span class="ct-ai-dot" aria-hidden="true">🎓</span><h3>AI Assistant</h3><span class="ct-beta">Beta</span></div>
          <div class="ct-mascot">${T() ? T().mascot(id) : ""}${c.img && c.img.mascot ? `<img src="${asset(id, "mascot.png")}" alt="" style="position:absolute;inset:0" ${IMG_GONE}>` : ""}</div>
          <p class="ct-hello"><b>${name ? `Hi, ${esc(name)}!` : "Hi there!"}</b><br>Ask me anything about studying in ${esc(c.inName)}.</p>
          <div class="ct-sugg">${c.chips.map((t) => `<button type="button" data-ct="ask" data-q="${esc(t)}">💬 ${esc(t)}</button>`).join("")}</div>
          <div class="ct-ask"><input id="ct-ask-input" type="text" maxlength="300" placeholder="Ask UniAI…" aria-label="Ask UniAI about studying in ${esc(c.brand)}"><button type="button" data-ct="ask-input" aria-label="Send">➤</button></div>
        </aside>

        <aside class="ct-card ct-why">
          <h3>Why Choose ${esc(c.brand)}?</h3>
          <ul>${c.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
          ${flag(id)}
        </aside>
      </div>
    </div>`;
  }

  function render() {
    const root = $("countryHome"), home = $("homePage");
    if (!root || !home) return;
    const isWorld = !COUNTRIES[current];
    home.classList.toggle("ct-active", !isWorld);
    root.hidden = isWorld;
    root.innerHTML = isWorld ? "" : countryHTML(current);
    if (T()) T().apply(current);
    updateChrome();
    if (!isWorld) renderJourney();
  }

  /* ------------------------------- chooser ------------------------------- */

  function chooserHTML() {
    const cards = Object.keys(COUNTRIES).map((id) => {
      const c = COUNTRIES[id];
      const th = T() ? T().THEMES[id] : null;
      return `<button type="button" class="ct-choice${id === current ? " on" : ""}" data-ct-pick="${esc(id)}" ${th ? `style="--ct-glow:${th.glow}"` : ""}>
        ${T() ? T().art(id) : ""}${c.img && c.img.hero ? `<img src="${asset(id, "hero.jpg")}" alt="" ${IMG_GONE}>` : ""}
        ${flag(id)}<b>Study in ${esc(c.brand)}</b><small>${esc(c.tagline.join(""))}</small></button>`;
    }).join("");
    return `<div class="ct-sheet" role="dialog" aria-modal="true" aria-labelledby="ctChooserTitle">
      <div class="ct-sheet-head"><div><h2 id="ctChooserTitle">Choose your destination</h2><p>UniAI reshapes itself around the country you want to study in.</p></div>
        <button type="button" class="ct-x" data-ct-close aria-label="Close">✕</button></div>
      <div class="ct-choices">${cards}</div>
      <div class="ct-world-row"><button type="button" class="ct-world-btn${current === "world" ? " on" : ""}" data-ct-pick="world">🌍 World — show everything</button></div>
    </div>`;
  }

  function open() {
    let m = $("ctChooser");
    if (!m) {
      m = document.createElement("div");
      m.id = "ctChooser"; m.className = "ct-modal"; m.hidden = true;
      m.addEventListener("click", (e) => {
        if (e.target === m || e.target.closest("[data-ct-close]")) return close();
        const pick = e.target.closest("[data-ct-pick]");
        if (pick) set(pick.dataset.ctPick);
      });
      document.body.appendChild(m);
    }
    lastFocus = document.activeElement;
    m.innerHTML = chooserHTML();
    m.hidden = false;
    document.body.style.overflow = "hidden";
    const x = m.querySelector("[data-ct-close]"); if (x) x.focus();
  }

  function close() {
    const m = $("ctChooser");
    if (m) m.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }

  /* ------------------------------- actions ------------------------------- */

  function selectCountryOn(selectEl) {
    if (!selectEl || !COUNTRIES[current]) return false;
    const names = COUNTRIES[current].db.map((n) => n.toLowerCase());
    const opt = Array.from(selectEl.options).find((o) => names.includes(o.value.toLowerCase()) || names.includes(o.textContent.trim().toLowerCase()));
    if (!opt) return false;
    selectEl.value = opt.value;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function browse() {
    await go("universityFinder");
    if (selectCountryOn($("country")) && typeof window.findUniversities === "function") window.findUniversities();
  }

  async function ask(text) {
    const q = String(text || "").trim().slice(0, 300);
    if (!q) return;
    const c = COUNTRIES[current];
    await go("ai-chat");
    if (typeof window.askUniAI === "function") window.askUniAI(c ? `${q} (I'm planning to study in ${c.name}.)` : q);
  }

  async function goTab(tab) {
    const c = COUNTRIES[current];
    if (tab === "overview") return $("countryHome").scrollIntoView({ behavior: "smooth", block: "start" });
    if (tab === "unis") return $("ct-unis").scrollIntoView({ behavior: "smooth", block: "start" });
    if (tab === "scholarships") {
      await go("scholarships");
      const f = $("scholarship-filter");
      if (f && c) { f.value = c.name; if (typeof window.filterScholarships === "function") window.filterScholarships(); }
      return;
    }
    if (tab === "admission") {
      if (c && c.eduHref.indexOf("page:") !== 0) { window.location.href = c.eduHref; return; }
      return go("studyAbroadGuide");
    }
    if (tab === "living") return go("living");
    if (tab === "career") return go("aiFreeJobs");
  }

  function journeyGo(target) {
    if (target === "tracker") {
      if (window.UniAITracker && typeof window.UniAITracker.open === "function") return window.UniAITracker.open();
      return go("workspace");
    }
    return go(target);
  }

  async function toggleSave(name) {
    const c = COUNTRIES[current];
    if (!window.UniAISaved || typeof window.UniAISaved.toggle !== "function" || !c) return go("saved");
    try { await window.UniAISaved.toggle({ type: "university", name, country: c.db[0] }); } catch (e) { /* ignore */ }
    refreshUnis();
    renderJourney();
  }

  function onClick(e) {
    const opener = e.target.closest("[data-ct-open]");
    if (opener) { e.preventDefault(); return open(); }

    const el = e.target.closest("#countryHome [data-ct]");
    if (!el) return;
    const act = el.dataset.ct;

    if (act === "chooser") return open();
    if (act === "browse") return browse();
    if (act === "page") { e.preventDefault(); return go(el.dataset.page); }
    if (act === "ask") return ask(el.dataset.q);
    if (act === "ask-input") { const i = $("ct-ask-input"); const v = i && i.value; if (i) i.value = ""; return ask(v); }
    if (act === "save") return toggleSave(el.dataset.name);
    if (act === "journey") return journeyGo(el.dataset.target);

    if (act === "uni") {
      if (el.dataset.slug) { window.location.href = `/university/${encodeURIComponent(el.dataset.slug)}`; return; }
      return browse();
    }

    if (act === "tab") {
      el.parentElement.querySelectorAll(".ct-tab").forEach((b) => b.classList.toggle("on", b === el));
      return goTab(el.dataset.tab);
    }
  }

  function onKey(e) {
    if (e.key === "Escape") { const m = $("ctChooser"); if (m && !m.hidden) close(); }
    if (e.key === "Enter" && e.target && e.target.id === "ct-ask-input") { e.preventDefault(); const v = e.target.value; e.target.value = ""; ask(v); }
  }

  /* --------------------------------- state --------------------------------- */

  function refreshUnis() {
    const grid = $("ct-unis-grid");
    if (grid && COUNTRIES[current]) grid.innerHTML = unisHTML(current);
  }

  function refreshLive(id) {
    if (current !== id) return;
    const facts = $("ct-facts");
    if (facts) facts.innerHTML = factsHTML(id);
    refreshUnis();
  }

  function set(id) {
    const next = COUNTRIES[id] ? id : "world";
    const changed = next !== current;
    current = next;
    try { localStorage.setItem(KEY, current); } catch (e) { /* private mode */ }

    close();
    render();
    if (changed) window.dispatchEvent(new CustomEvent(EVENT, { detail: describe(current) }));

    if (COUNTRIES[current]) {
      const id2 = current;
      if (live[id2] || state[id2] === "ok") refreshLive(id2); else loadLive(id2).then(() => refreshLive(id2));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return describe(current);
  }

  /* Topbar button (beside the theme toggle) + the country tag beside the sidebar logo. */
  function injectChrome() {
    if (!$("ctOpen")) {
      const host = document.querySelector(".topbar-actions");
      if (host) {
        const btn = document.createElement("button");
        btn.type = "button"; btn.id = "ctOpen"; btn.className = "ct-top-btn"; btn.dataset.ctOpen = "1";
        btn.setAttribute("aria-haspopup", "dialog");
        const toggle = $("theme-toggle");
        if (toggle && toggle.parentElement) toggle.insertAdjacentElement("beforebegin", btn);
        else host.insertBefore(btn, host.firstChild);
      }
    }
    if (!$("ctLogoTag")) {
      const a = document.querySelector(".sidebar-logo a");
      if (a) {
        const tag = document.createElement("span");
        tag.id = "ctLogoTag"; tag.className = "ct-logo-tag"; tag.hidden = true;
        a.appendChild(tag);
      }
    }
  }

  function updateChrome() {
    const c = COUNTRIES[current];
    const btn = $("ctOpen"), tag = $("ctLogoTag");
    if (btn) {
      btn.classList.toggle("on", !!c);
      btn.innerHTML = `${c ? flag(current) : `<span class="ct-globe" aria-hidden="true">🌍</span>`}<span class="ct-label">${esc(c ? c.brand : "Destination")}</span><span class="ct-caret" aria-hidden="true">▾</span>`;
      btn.setAttribute("aria-label", c ? `Destination: ${c.name}. Change destination` : "Choose destination");
      btn.title = c ? `Destination: ${c.name}` : "Choose destination";
    }
    if (tag) {
      tag.hidden = !c;
      tag.innerHTML = c ? `${flag(current)}${esc(c.brand)}` : "";
    }
  }

  function init() {
    const home = $("homePage");
    if (!home) return;

    let root = $("countryHome");
    if (!root) {
      root = document.createElement("section");
      root.id = "countryHome"; root.hidden = true;
      home.insertBefore(root, home.querySelector(".home-grid") || null);
    }

    injectChrome();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    // keep "Continue Your Journey" fresh without polling
    const refreshJourney = () => { if (COUNTRIES[current]) renderJourney(); };
    window.addEventListener("uniai:tracker-change", refreshJourney);
    window.addEventListener("focus", refreshJourney);
    window.addEventListener("storage", refreshJourney);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshJourney(); });

    let saved = null;
    try { saved = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY); } catch (e) { /* ignore */ }
    current = COUNTRIES[saved] ? saved : "world";
    render();
    if (COUNTRIES[current]) { const id = current; loadLive(id).then(() => refreshLive(id)); }
  }

  window.UniAIRegion = {
    get: () => describe(current),
    set, open, close, browse,
    add(id, def) { COUNTRIES[id] = def; },
    list: () => Object.keys(COUNTRIES)
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
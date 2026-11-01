/* ==========================================================================
   UniAI — Destination mode (JS/region.js)   [v3]

   ONE layout for every country. Only the config in COUNTRIES changes.

   Data policy
   - University count, QS Top-100 count and QS rank badges are LIVE from your
     /universities endpoint. If it does not answer, they show "—" (never a guess).
   - Tuition / living cost / language / intake are typical published ranges written
     as text below. Re-check them each admissions cycle (see `verified` in each country).
   - No ratings, review counts, success rates or scholarship counts are shown.

   Images (all optional, all fall back to generated art / monogram):
     assets/regions/<id>/hero.jpg  mascot.png  uni1..4.jpg  logo1..4.png  guide1..4.jpg

   Journey data: every number in "Continue your journey" comes from readJourney()
   (bottom of the data section). It uses this file's own saved lists and checklist
   and calls window.UniAIUser.profile() if your app provides it. Point it at your
   real saved/profile endpoints there.

   API (unchanged): UniAIRegion.get() / set(id) / open() / close() / browse() / add(id, def)
   Event: "uniai:region-change"
   ========================================================================== */

(function () {
  "use strict";
  if (window.UniAIRegion) return;

  const KEY = "uniai-country";
  const OLD_KEY = "uniai-region";
  const EVENT = "uniai:region-change";
  const CACHE_PREFIX = "uniai-country-data-v3:";
  const CACHE_TTL = 24 * 3600 * 1000;
  const LS = { saved: "uniai-ct-saved", sch: "uniai-ct-sch", docs: "uniai-ct-docs", dl: "uniai-ct-deadlines", tab: "uniai-ct-tab" };

  /* ------------------------------ the data ------------------------------ */

  const DOCS = ["Passport valid 6+ months", "Academic transcripts", "English test score", "Statement of purpose", "Recommendation letters", "Proof of funds"];

  const COUNTRIES = {
    us: {
      name: "United States", brand: "USA", inName: "the USA", title: "USA", currency: "USD", interview: "US",
      db: ["United States", "United States of America", "USA", "US"],
      tagline: "World-class education, endless opportunities.",
      sub: "Explore top universities, scholarships and everything you need to know about studying in the United States.",
      askLine: "Ask me anything about studying in the USA.", verified: "Typical ranges. Confirm with each university and travel.state.gov.",
      img: { hero: 1, mascot: 1, unis: 4, guides: 4 },
      facts: [
        ["🏛️", "QS Top 100 universities (in UniAI)", "@top100"],
        ["🎓", "Average tuition", "$20,000 – $60,000 / year", "Public out-of-state to private"],
        ["🏠", "Living cost", "$1,200 – $2,000 / month"],
        ["💬", "Language requirement", "TOEFL / IELTS", "Some accept Duolingo"],
        ["📅", "Intake periods", "Fall (Aug–Sep) · Spring (Jan)"]
      ],
      unis: [
        ["Harvard University", "Cambridge, MA", "Research-intensive across law, medicine and the sciences", ["Research", "Innovation"], ["harvard"]],
        ["MIT", "Cambridge, MA", "Engineering, computing and physical sciences", ["Engineering", "Tech"], ["massachusetts institute", "mit"]],
        ["Stanford University", "Stanford, CA", "Computer science, entrepreneurship and engineering", ["Innovation", "Research"], ["stanford"]],
        ["UC Berkeley", "Berkeley, CA", "Public research university strong in STEM", ["Research", "Tech"], ["california, berkeley", "uc berkeley", "berkeley"]]
      ],
      guides: [["🎓", "Education System", "How degrees, credits and GPAs work", "guides/usa.html"], ["🛂", "Student Visa Guide", "F-1 visa steps, from I-20 to interview", "guides/student-visa.html"], ["💰", "Scholarships", "Funding options for international students", "guides/scholarships.html"], ["🏙️", "Life in the USA", "Housing, costs and campus life", "guides/finance.html"]],
      scholarships: [["Fulbright Foreign Student Program", "Graduate study. Apply through the Fulbright commission or embassy in your home country."], ["University merit and need-based aid", "Varies by school. Harvard and MIT are need-blind for international applicants."], ["Departmental assistantships", "Common for master's and PhD students: tuition waiver plus stipend."]],
      admission: ["Choose programs and check each school's deadlines (Early and Regular rounds).", "Take TOEFL or IELTS, plus SAT/ACT or GRE/GMAT if the program asks for them.", "Prepare transcripts, essays, recommendations and proof of funds.", "After admission, receive the I-20, pay the SEVIS fee and book the F-1 visa interview."],
      living: ["Rent is the largest cost and varies sharply by city (large coastal cities cost more).", "On-campus housing is often guaranteed for first-year students.", "Health insurance is required by most universities; budget for it separately."],
      career: ["F-1 students may work on campus up to 20 hours a week during term.", "Optional Practical Training (OPT) allows 12 months of work after study, with a 24-month STEM extension.", "Work authorisation rules change; check uscis.gov before planning."],
      why: ["Top-ranked universities", "Cutting-edge research", "Diverse culture", "Global career opportunities"],
      chips: ["How much does studying here cost?", "What are the F-1 visa requirements?", "Best universities for Robotics?"]
    },
    jp: {
      name: "Japan", brand: "Japan", inName: "Japan", title: "Japan", currency: "JPY", interview: "JP",
      db: ["Japan"],
      tagline: "Innovate. Learn. Belong.",
      sub: "World-class education, cutting-edge technology and a unique culture, all in one country.",
      askLine: "Ask me anything about studying in Japan.", verified: "National university fee is the standard MEXT figure; confirm with each university.",
      img: { hero: 1, mascot: 1, unis: 4, guides: 4 },
      facts: [
        ["🏛️", "QS Top 100 universities (in UniAI)", "@top100"],
        ["🎓", "Average tuition", "¥535,800 / year", "National universities, plus an entrance fee"],
        ["🏠", "Living cost", "¥70,000 – ¥120,000 / month"],
        ["💬", "Language requirement", "JLPT N2 / N1", "English-taught programs: IELTS / TOEFL"],
        ["📅", "Intake periods", "Apr · Sep / Oct"]
      ],
      unis: [
        ["University of Tokyo", "Tokyo", "Japan's leading comprehensive research university", ["Research", "Innovation"], ["university of tokyo"]],
        ["Kyoto University", "Kyoto", "Natural sciences, humanities and a strong research culture", ["Research", "Tradition"], ["kyoto university"]],
        ["Osaka University", "Osaka", "Engineering, medicine and applied sciences", ["Engineering", "Research"], ["osaka university"]],
        ["Institute of Science Tokyo", "Tokyo", "Formerly Tokyo Institute of Technology; science and engineering", ["Science", "Tech"], ["institute of science tokyo", "tokyo institute of technology", "tokyo tech"]]
      ],
      guides: [["⛩️", "Education System", "Degrees, semesters and research students", "guides/japan.html"], ["🛂", "Student Visa Guide", "Certificate of Eligibility and visa steps", "guides/student-visa.html"], ["🌸", "Scholarships", "MEXT and university funding", "guides/scholarships.html"], ["🏙️", "Life in Japan", "Housing, costs and daily life", "guides/japan.html"]],
      scholarships: [["MEXT (Japanese Government) Scholarship", "Covers tuition and a monthly allowance. Apply via the Japanese embassy or directly through a university."], ["JASSO scholarships", "Monthly support for privately financed international students; usually applied for after arrival through your university."], ["University fee waivers", "Many universities reduce or waive tuition for high-performing or low-income international students."]],
      admission: ["Decide between Japanese-taught and English-taught programs; language requirements differ.", "Check whether the university requires the EJU exam, JLPT or an English test.", "Submit application, transcripts and a research plan (for graduate study) before the university deadline.", "The university applies for your Certificate of Eligibility; use it to apply for the student visa."],
      living: ["University dormitories are the cheapest option; private rent in Tokyo is higher than elsewhere.", "Enrolled students can enrol in National Health Insurance.", "Many universities and local governments offer tuition or housing support."],
      career: ["Students can work part-time up to 28 hours a week with permission from immigration.", "Graduates can stay to job-hunt, then switch to a work visa.", "Japanese language ability improves job options considerably."],
      why: ["World-class education", "Cutting-edge research", "Unique culture and lifestyle", "Strong career pathways"],
      chips: ["Best universities for Robotics?", "How does the MEXT scholarship work?", "Can I study in English in Japan?"]
    },
    kr: {
      name: "South Korea", brand: "South Korea", inName: "South Korea", title: "South Korea", currency: "KRW", interview: "KR",
      db: ["South Korea", "Korea, South", "Republic of Korea", "Korea"],
      tagline: "Innovate. Learn. Grow.",
      sub: "World-class education, cutting-edge technology and a vibrant culture, all in one country.",
      askLine: "Ask me anything about studying in South Korea.", verified: "Approximate ranges; public and private universities differ. Confirm on each university's site.",
      img: { hero: 1, mascot: 1, unis: 4, guides: 4 },
      facts: [
        ["🏛️", "QS Top 100 universities (in UniAI)", "@top100"],
        ["🎓", "Average tuition", "₩4M – ₩15M / year", "Public universities sit at the lower end"],
        ["🏠", "Living cost", "₩800,000 – ₩1,500,000 / month"],
        ["💬", "Language requirement", "TOPIK or IELTS / TOEFL", "Depends on program language"],
        ["📅", "Intake periods", "Mar · Sep"]
      ],
      unis: [
        ["Seoul National University", "Seoul", "Korea's flagship national research university", ["Research", "Innovation"], ["seoul national"]],
        ["KAIST", "Daejeon", "Science, engineering and technology", ["Engineering", "Tech"], ["kaist", "korea advanced institute"]],
        ["Yonsei University", "Seoul", "Comprehensive private research university", ["Research", "Global"], ["yonsei"]],
        ["Korea University", "Seoul", "Strong in law, business and engineering", ["Research", "Business"], ["korea university"]]
      ],
      guides: [["🏫", "Education System", "Degrees, semesters and admission tracks", "page:studyAbroadGuide"], ["🛂", "Student Visa Guide", "D-2 student visa steps", "guides/student-visa.html"], ["💰", "Scholarships", "GKS and university funding", "guides/scholarships.html"], ["🏙️", "Life in South Korea", "Housing, costs and daily life", "guides/finance.html"]],
      scholarships: [["Global Korea Scholarship (GKS)", "Government-funded; covers tuition, a living allowance and Korean language training. Applied for via Korean embassies or selected universities."], ["University scholarships", "Many universities offer partial or full tuition waivers based on grades or language level."], ["Language-linked awards", "Higher TOPIK scores often unlock larger tuition discounts."]],
      admission: ["Pick Korean-taught or English-taught programs and check each deadline (spring and fall intakes).", "Prepare transcripts, study plan, recommendations and a language score (TOPIK or IELTS / TOEFL).", "Apply directly to the university or through GKS.", "After admission, obtain a Certificate of Admission and apply for the D-2 student visa."],
      living: ["University dormitories are affordable but limited; one-room rentals often need a large deposit.", "International students are generally required to hold health insurance.", "Seoul is costlier than other cities."],
      career: ["Part-time work rules depend on visa status and language level; check with your university's international office.", "A job-seeking visa is available after graduation (see hikorea.go.kr).", "Korean language skills strongly affect job options."],
      why: ["Top-ranked universities", "Strong tech and research", "Vibrant student life", "Strong career pathways"],
      chips: ["What scholarships are available for international students?", "Can I study in English in Korea?", "What are the visa requirements?"]
    },
    de: {
      name: "Germany", brand: "Germany", inName: "Germany", title: "Germany", currency: "EUR", interview: "DE",
      db: ["Germany"],
      tagline: "Engineer. Innovate. Excel.",
      sub: "World-class education, affordable tuition and strong career opportunities.",
      askLine: "Ask me anything about studying in Germany.", verified: "Most public universities charge no tuition; Baden-Württemberg charges non-EU students. Confirm per state.",
      img: { hero: 1, mascot: 1, unis: 4, guides: 4 },
      facts: [
        ["🏛️", "QS Top 100 universities (in UniAI)", "@top100"],
        ["🎓", "Average tuition", "€0 at most public universities", "Semester contribution about €150 – €350"],
        ["🏠", "Living cost", "€900 – €1,300 / month", "Visa requires proof of funds"],
        ["💬", "Language requirement", "TestDaF / DSH or IELTS", "Many master's are English-taught"],
        ["📅", "Intake periods", "Winter (Oct) · Summer (Apr)"]
      ],
      unis: [
        ["Technical University of Munich", "Munich", "Engineering, natural sciences and technology", ["Engineering", "Research"], ["technical university of munich", "technische universität münchen", "tum"]],
        ["Heidelberg University", "Heidelberg", "Germany's oldest university; medicine and life sciences", ["Research", "Medicine"], ["heidelberg"]],
        ["RWTH Aachen University", "Aachen", "Engineering and technology", ["Engineering", "Tech"], ["rwth"]],
        ["Humboldt University of Berlin", "Berlin", "Humanities, social sciences and natural sciences", ["Research", "Arts"], ["humboldt"]]
      ],
      guides: [["🎓", "Education System", "Bachelor, master and Studienkolleg routes", "guides/germany.html"], ["🛂", "Student Visa Guide", "Blocked account and visa steps", "guides/student-visa.html"], ["💰", "Scholarships", "DAAD and other funding", "guides/scholarships.html"], ["🏙️", "Life in Germany", "Housing, costs and daily life", "guides/germany.html"]],
      scholarships: [["DAAD scholarships", "The German Academic Exchange Service funds study and research at several levels. Check eligibility per program."], ["Deutschlandstipendium", "Merit-based support for students already enrolled at a participating German university."], ["Foundation scholarships", "Political and religious foundations fund international students; most require some time in Germany first."]],
      admission: ["Check whether your qualification is recognised on anrecht.de (anabin) or uni-assist.", "Apply through uni-assist or directly, depending on the university.", "Provide a language certificate and, for some programs, GRE/GMAT or a portfolio.", "Open a blocked account, then apply for the national visa and residence permit."],
      living: ["Rent is the main cost; student halls (Studentenwerk) are cheapest.", "Public health insurance is compulsory for students.", "Cities like Munich cost much more than smaller university towns."],
      career: ["International students may work 120 full days or 240 half days a year.", "Graduates can stay up to 18 months to look for work related to their degree.", "Demand is strong in engineering and IT; German language helps."],
      why: ["No tuition at most public universities", "Strong research", "Excellent job prospects", "Heart of Europe"],
      chips: ["Can I study engineering in English?", "How does the blocked account work?", "Do I need German to study there?"]
    },
    uk: {
      name: "United Kingdom", brand: "UK", inName: "the UK", title: "UK", currency: "GBP", interview: "UK",
      db: ["United Kingdom", "UK", "England", "Great Britain"],
      tagline: "Learn. Explore. Achieve.",
      sub: "World-renowned universities, rich culture and endless opportunities.",
      askLine: "Ask me anything about studying in the UK.", verified: "Typical ranges. Confirm fees on each university page and visa rules on gov.uk.",
      img: { hero: 1, mascot: 1, unis: 4, guides: 4 },
      facts: [
        ["🏛️", "QS Top 100 universities (in UniAI)", "@top100"],
        ["🎓", "Average tuition", "£11,000 – £38,000 / year", "International undergraduate fees"],
        ["🏠", "Living cost", "£1,000 – £1,500 / month", "London is at the upper end"],
        ["💬", "Language requirement", "IELTS / TOEFL", "UKVI-approved test for some visas"],
        ["📅", "Intake periods", "Sep · Jan"]
      ],
      unis: [
        ["University of Oxford", "Oxford", "Tutorial teaching across humanities, sciences and medicine", ["Research", "Tradition"], ["university of oxford", "oxford"]],
        ["University of Cambridge", "Cambridge", "Strong in sciences, mathematics and engineering", ["Research", "Excellence"], ["university of cambridge", "cambridge"]],
        ["Imperial College London", "London", "Science, engineering, medicine and business", ["Science", "Tech"], ["imperial college"]],
        ["UCL", "London", "Broad research university in central London", ["Research", "Innovation"], ["university college london", "ucl"]]
      ],
      guides: [["🎓", "Education System", "Degrees, UCAS and course structure", "guides/uk.html"], ["🛂", "Student Visa Guide", "CAS and Student visa steps", "guides/student-visa.html"], ["💰", "Scholarships", "Chevening, Commonwealth and more", "guides/scholarships.html"], ["🏙️", "Life in the UK", "Housing, costs and daily life", "guides/uk.html"]],
      scholarships: [["Chevening Scholarships", "UK government awards for one-year master's degrees, for applicants from eligible countries."], ["Commonwealth Scholarships", "Funded study for students from eligible Commonwealth countries."], ["University scholarships", "Oxford, Cambridge, Imperial and UCL each run their own awards; check each website."]],
      admission: ["Undergraduate: apply through UCAS (deadlines differ for Oxford, Cambridge and medicine).", "Postgraduate: apply directly to the university.", "Provide transcripts, personal statement or SOP, references and an English test.", "After an offer, receive a CAS and apply for the Student visa."],
      living: ["Halls of residence are common in first year; London costs the most.", "Students pay the Immigration Health Surcharge with their visa application.", "Many universities offer cost-of-living guides on their websites."],
      career: ["Students on a Student visa can generally work up to 20 hours a week in term.", "The Graduate Route currently allows post-study work; check gov.uk for the current length and rules.", "London and Cambridge have strong finance, tech and research jobs."],
      why: ["Top-ranked universities", "Strong research and innovation", "Vibrant student life", "Strong career pathways"],
      chips: ["What are the undergraduate admission requirements?", "How does the Graduate Route work?", "How much does a UK degree cost?"]
    }
  };

  const ORDER = ["us", "jp", "kr", "de", "uk"];

  const TABS = [
    ["overview", "🏠", "Overview"], ["unis", "🏆", "Top Universities"], ["scholarships", "🎁", "Scholarships"],
    ["admission", "📄", "Admission Guide"], ["living", "🏡", "Living Costs"], ["career", "💼", "Career Opportunities"]
  ];

  /* ------------------------------ helpers ------------------------------ */

  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);
  const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const apiBase = () => (typeof CONFIG !== "undefined" && CONFIG && CONFIG.API_BASE) || "";
  const userName = () => { const el = $("nav-username"); const n = el && el.textContent.trim(); return n && n.length < 40 ? n : ""; };
  const go = (page) => (typeof window.showPage === "function" ? window.showPage(page) : null);
  const T = () => window.UniAITheme || null;
  const flag = (id) => (T() ? T().flag(id) : "");
  const asset = (id, file) => `assets/regions/${id}/${file}`;
  const IMG_GONE = `onerror="this.remove()"`;
  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FLAG_EMOJI = { us: "🇺🇸", jp: "🇯🇵", uk: "🇬🇧", de: "🇩🇪", kr: "🇰🇷" };

  function nameHas(name, terms) {
    const n = String(name || "").toLowerCase();
    return terms.some((t) => (t.length <= 4 ? new RegExp(`(^|[^a-z])${t}([^a-z]|$)`).test(n) : n.includes(t)));
  }
  const initials = (n) => n.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  let current = "world";
  let tab = "overview";
  let filterTag = "All";
  let lastFocus = null;
  const live = {};

  function describe(id) {
    const c = COUNTRIES[id];
    if (!c) return { id: "world", name: "World", flag: "🌍", brand: "World", inName: "the world", country: "", currency: "USD", interview: "US", isWorld: true };
    return { id, name: c.name, flag: FLAG_EMOJI[id] || "", brand: c.brand, inName: c.inName, country: c.db[0], currency: c.currency, interview: c.interview, isWorld: false };
  }

  /* --------------------------- user journey data --------------------------- */

  const getSaved = () => readJSON(LS.saved, []);
  const getSch = () => readJSON(LS.sch, []);
  const getDocs = (id) => (readJSON(LS.docs, {})[id] || []);
  const getDeadlines = (id) => (readJSON(LS.dl, {})[id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));

  function readJourney(id) {
    const saved = getSaved().filter((s) => s.c === id);
    const sch = getSch().filter((s) => s.c === id);
    const docs = getDocs(id);
    let profile = null;
    try { const p = window.UniAIUser && window.UniAIUser.profile && window.UniAIUser.profile(); if (p && typeof p.completion === "number") profile = Math.max(0, Math.min(100, Math.round(p.completion))); } catch (e) { /* optional hook */ }
    return { saved, sch, docs, docPct: Math.round((docs.length / DOCS.length) * 100), profile, deadlines: getDeadlines(id).filter((d) => d.date >= new Date().toISOString().slice(0, 10)) };
  }

  /* --------------------------- live DB numbers --------------------------- */

  async function loadLive(id) {
    const c = COUNTRIES[id];
    if (!c || live[id]) return;
    const cached = readJSON(CACHE_PREFIX + id, null);
    if (cached && Date.now() - cached.at < CACHE_TTL) { live[id] = cached.data; return; }

    for (const name of c.db) {
      try {
        const res = await fetch(`${apiBase()}/universities?country=${encodeURIComponent(name)}&sort=rank`);
        if (!res.ok) continue;
        const rows = await res.json();
        if (!Array.isArray(rows) || !rows.length) continue;
        const ranked = rows.filter((u) => Number(u.qs_rank) > 0).sort((a, b) => Number(a.qs_rank) - Number(b.qs_rank));
        const match = {};
        c.unis.forEach((u, i) => {
          const hit = ranked.find((r) => nameHas(r.name, u[4])) || rows.find((r) => nameHas(r.name, u[4]));
          if (hit) match[i] = { rank: Number(hit.qs_rank) > 0 ? Number(hit.qs_rank) : 0, slug: hit.slug || "" };
        });
        const data = { total: rows.length, capped: rows.length >= 1000, top100: ranked.filter((u) => Number(u.qs_rank) <= 100).length, match };
        live[id] = data;
        writeJSON(CACHE_PREFIX + id, { at: Date.now(), data });
        return;
      } catch (e) { /* try next spelling */ }
    }
    live[id] = { failed: true, match: {} };
  }

  /* ------------------------------ rendering ------------------------------ */

  function uniHTML(id, i) {
    const c = COUNTRIES[id], u = c.unis[i], l = live[id], m = l && l.match && l.match[i];
    const isSaved = getSaved().some((s) => s.c === id && s.n === u[0]);
    const photo = c.img.unis > i ? `<img class="ct-ph" src="${asset(id, `uni${i + 1}.jpg`)}" alt="" loading="lazy" ${IMG_GONE}>` : "";
    const logo = `<span class="ct-logo" aria-hidden="true">${esc(initials(u[0]))}<img src="${asset(id, `logo${i + 1}.png`)}" alt="" loading="lazy" ${IMG_GONE}></span>`;
    const rank = !l ? `<span class="ct-rank ct-skel">QS #00</span>` : (m && m.rank ? `<span class="ct-rank">QS #${esc(m.rank)}</span>` : "");
    return `<article class="ct-uni" data-tags="${esc(u[3].join("|"))}">
      <div class="ct-uni-img">${photo}${logo}${rank}
        <button type="button" class="ct-save${isSaved ? " on" : ""}" data-ct="save" data-i="${i}" aria-pressed="${isSaved}" aria-label="${isSaved ? "Remove" : "Save"} ${esc(u[0])}">${isSaved ? "♥" : "♡"}</button></div>
      <div class="ct-uni-body"><b>${esc(u[0])}</b><small>${esc(u[1])}, ${esc(c.name)}</small>
        <p class="ct-strength">${esc(u[2])}</p>
        <div class="ct-tags">${u[3].map((t) => `<span>${esc(t)}</span>`).join("")}</div>
        <button type="button" class="ct-details" data-ct="uni" data-i="${i}" data-slug="${esc(m && m.slug)}">View details <span aria-hidden="true">→</span></button></div></article>`;
  }

  function filtersHTML(id) {
    const tags = ["All"].concat(Array.from(new Set(COUNTRIES[id].unis.flatMap((u) => u[3]))));
    return `<div class="ct-filters" role="group" aria-label="Filter universities">${tags.map((t) => `<button type="button" class="ct-chip${t === filterTag ? " on" : ""}" data-ct="filter" data-tag="${esc(t)}" aria-pressed="${t === filterTag}">${esc(t)}</button>`).join("")}</div>`;
  }

  function unisSectionHTML(id) {
    const c = COUNTRIES[id];
    return `<section class="ct-card" id="ct-unis"><div class="ct-head"><h3>Top Universities in ${esc(c.brand)}</h3><button type="button" class="ct-link" data-ct="browse">View all →</button></div>
      ${filtersHTML(id)}<div class="ct-unis" id="ct-unis-grid">${c.unis.map((_, i) => uniHTML(id, i)).join("")}</div><p class="ct-empty" id="ct-unis-empty" hidden>No featured universities match this filter.</p></section>`;
  }

  function guidesSectionHTML(id) {
    const c = COUNTRIES[id];
    const cards = c.guides.map(([ic, t, d, href], i) => {
      const photo = c.img.guides > i ? `<img src="${asset(id, `guide${i + 1}.jpg`)}" alt="" loading="lazy" ${IMG_GONE}>` : "";
      const attrs = href.indexOf("page:") === 0 ? `data-ct="page" data-page="${esc(href.slice(5))}" type="button"` : `href="${esc(href)}"`;
      const tag = href.indexOf("page:") === 0 ? "button" : "a";
      return `<${tag} class="ct-guide" ${attrs}><span class="ct-gi">${ic}${photo}</span><span class="ct-gt"><b>${esc(t)}</b><small>${esc(d)}</small><em>Read more →</em></span></${tag}>`;
    }).join("");
    return `<section class="ct-card"><div class="ct-head"><h3>${esc(c.brand === "USA" ? "Popular" : c.brand)} Guides</h3><button type="button" class="ct-link" data-ct="page" data-page="studyAbroadGuide">View all →</button></div><div class="ct-guides">${cards}</div></section>`;
  }

  function journeyHTML(id) {
    const j = readJourney(id), c = COUNTRIES[id];
    const bar = (pct) => `<span class="ct-bar"><i style="width:${pct}%"></i></span>`;
    const docs = DOCS.map((d) => `<label class="ct-check"><input type="checkbox" data-ct="doc" data-doc="${esc(d)}"${j.docs.includes(d) ? " checked" : ""}> <span>${esc(d)}</span></label>`).join("");
    const dls = j.deadlines.length ? `<ul class="ct-dl">${j.deadlines.map((d) => `<li><b>${esc(d.label)}</b><small>${esc(d.date)}</small><button type="button" data-ct="dl-del" data-id="${esc(d.id)}" aria-label="Remove deadline">✕</button></li>`).join("")}</ul>` : `<p class="ct-muted">No deadlines yet. Add one below.</p>`;
    const sch = j.sch.length ? j.sch.map((s) => esc(s.n)).join(", ") : "None yet. Use Shortlist in the Scholarships tab.";
    return `<section class="ct-card" id="ct-journey"><div class="ct-head"><h3>Continue your journey</h3><span class="ct-pill">${esc(c.brand)}</span></div>
      <div class="ct-j-grid">
        <div class="ct-j-tile"><small>Profile completion</small>${j.profile == null ? `<p class="ct-muted">Complete your profile to track this.</p><button type="button" class="ct-link" data-ct="page" data-page="profile">Open profile →</button>` : `<b>${j.profile}%</b>${bar(j.profile)}`}</div>
        <div class="ct-j-tile"><small>Saved universities</small><b>${j.saved.length}</b><p class="ct-muted">${j.saved.length ? esc(j.saved.map((s) => s.n).join(", ")) : "Tap ♡ on a university to save it."}</p></div>
        <div class="ct-j-tile"><small>Scholarship shortlist</small><b>${j.sch.length}</b><p class="ct-muted">${sch}</p></div>
        <div class="ct-j-tile"><small>Application progress</small><b>${j.docPct}%</b>${bar(j.docPct)}<p class="ct-muted">${j.docs.length} of ${DOCS.length} documents ready</p></div>
        <div class="ct-j-tile wide"><small>Document checklist</small><div class="ct-checks">${docs}</div></div>
        <div class="ct-j-tile wide"><small>Upcoming deadlines</small>${dls}
          <form class="ct-dl-form" data-ct-form="dl"><input name="label" maxlength="60" placeholder="e.g. Application deadline" aria-label="Deadline name" required><input name="date" type="date" aria-label="Deadline date" required><button type="submit" class="ct-btn pri sm">Add</button></form></div>
      </div></section>`;
  }

  function panelHTML(id, key) {
    const c = COUNTRIES[id];
    const list = (items) => `<ol class="ct-steps">${items.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
    if (key === "scholarships") {
      const sh = getSch();
      return `<section class="ct-card ct-panel"><div class="ct-head"><h3>Scholarships in ${esc(c.brand)}</h3><button type="button" class="ct-link" data-ct="page" data-page="scholarships">Open Scholarship Finder →</button></div>
        <div class="ct-rows">${c.scholarships.map(([n, d]) => { const on = sh.some((s) => s.c === id && s.n === n); return `<div class="ct-row"><div><b>${esc(n)}</b><p>${esc(d)}</p></div><button type="button" class="ct-btn ghost sm${on ? " on" : ""}" data-ct="sch" data-n="${esc(n)}" aria-pressed="${on}">${on ? "✓ Shortlisted" : "Shortlist"}</button></div>`; }).join("")}</div>
        <p class="ct-note">Eligibility and deadlines change each year. Always confirm on the official scholarship website.</p></section>`;
    }
    const map = { admission: ["Admission guide", c.admission, "studyAbroadGuide", "Open Study Abroad Guide →", true], living: ["Living costs", c.living, "living", "Open cost calculator →", false], career: ["Career opportunities", c.career, "aiFreeJobs", "Browse AI-free jobs →", false] };
    const m = map[key];
    return `<section class="ct-card ct-panel"><div class="ct-head"><h3>${esc(m[0])}: ${esc(c.brand)}</h3><button type="button" class="ct-link" data-ct="page" data-page="${m[2]}">${m[3]}</button></div>
      ${key === "living" ? `<div class="ct-kv"><div><small>Monthly living cost</small><b>${esc(c.facts[2][2])}</b></div><div><small>Average tuition</small><b>${esc(c.facts[1][2])}</b></div></div>` : ""}
      ${m[4] ? list(m[1]) : `<ul class="ct-bul">${m[1].map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`}
      <p class="ct-note">${esc(c.verified)}</p></section>`;
  }

  function factsHTML(id) {
    const c = COUNTRIES[id], l = live[id];
    return c.facts.map(([ic, label, value, sub]) => {
      let val = value;
      if (value === "@top100") val = !l ? "…" : (l.failed || !l.top100 ? "—" : `${l.top100}${l.capped ? "+" : ""}`);
      return `<div class="ct-fact"><div class="ct-ic">${ic}</div><div><small>${esc(label)}</small><b${val === "…" ? ` class="ct-skel"` : ""}>${esc(val)}</b>${sub ? `<i>${esc(sub)}</i>` : ""}</div></div>`;
    }).join("");
  }

  function bodyHTML(id) {
    if (tab === "overview") return unisSectionHTML(id) + guidesSectionHTML(id) + journeyHTML(id);
    if (tab === "unis") return unisSectionHTML(id) + journeyHTML(id);
    return panelHTML(id, tab) + journeyHTML(id);
  }

  function countryHTML(id) {
    const c = COUNTRIES[id];
    const name = userName();
    const hello = name ? `Hi ${esc(name)}! ` : "";
    return `
    <div class="ct-grid" data-country="${esc(id)}">
      <div class="ct-main">
        <section class="ct-hero" aria-label="Study in ${esc(c.brand)}">
          <div class="ct-art">${T() ? T().art(id) : ""}${c.img.hero ? `<img class="ct-photo" src="${asset(id, "hero.jpg")}" alt="" ${IMG_GONE}>` : ""}</div>
          <button type="button" class="ct-back" data-ct="chooser">← Back to Countries</button>
          <div class="ct-studyin">${flag(id)}<span>Study in</span></div>
          <h1 class="ct-name"><span>${esc(c.title)}</span></h1>
          <p class="ct-tag">${esc(c.tagline)}</p>
          <p class="ct-sub">${esc(c.sub)}</p>
          <div class="ct-cta">
            <button type="button" class="ct-btn pri" data-ct="browse">Explore Universities →</button>
            <button type="button" class="ct-btn ghost" data-ct="guide">▷ Watch Guide</button>
          </div>
        </section>

        <nav class="ct-tabs" role="tablist" aria-label="${esc(c.brand)} sections">
          ${TABS.map(([k, ic, label]) => `<button type="button" role="tab" id="ct-tab-${k}" class="ct-tab${k === tab ? " on" : ""}" aria-selected="${k === tab}" data-ct="tab" data-tab="${k}"><span aria-hidden="true">${ic}</span> ${esc(label)}</button>`).join("")}
        </nav>

        <div class="ct-body" id="ct-body" role="tabpanel" aria-labelledby="ct-tab-${tab}">${bodyHTML(id)}</div>
      </div>

      <div class="ct-side">
        <aside class="ct-card">
          <div class="ct-head"><h3>Quick Facts</h3><span class="ct-info" aria-hidden="true">i</span></div>
          <div class="ct-facts" id="ct-facts">${factsHTML(id)}</div>
          <p class="ct-note">${esc(c.verified)}</p>
          <button type="button" class="ct-btn ct-wide" data-ct="page" data-page="studyAbroadGuide">Country Guide →</button>
        </aside>

        <aside class="ct-card ct-ai">
          <div class="ct-ai-head"><span class="ct-ai-dot" aria-hidden="true">🎓</span><h3>AI Assistant</h3><span class="ct-beta">Beta</span></div>
          <div class="ct-mascot">${T() ? T().mascot(id) : ""}${c.img.mascot ? `<img src="${asset(id, "mascot.png")}" alt="" style="position:absolute;inset:0" ${IMG_GONE}>` : ""}</div>
          <p class="ct-hello">${hello}${esc(c.askLine)}</p>
          <div class="ct-sugg">${c.chips.map((t) => `<button type="button" data-ct="ask" data-q="${esc(t)}">💬 ${esc(t)}</button>`).join("")}</div>
          <div class="ct-ask"><input id="ct-ask-input" type="text" maxlength="300" placeholder="Ask UniAI about ${esc(c.brand)}…" aria-label="Ask UniAI about studying in ${esc(c.brand)}"><button type="button" data-ct="ask-input" aria-label="Send">➤</button></div>
        </aside>

        <aside class="ct-card ct-why">
          <h3>Why choose ${esc(c.brand)}?</h3>
          <ul>${c.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
          ${flag(id)}
        </aside>
      </div>
    </div>`;
  }

  function render(animate) {
    const root = $("countryHome"), home = $("homePage");
    if (!root || !home) return;
    const isWorld = !COUNTRIES[current];
    home.classList.toggle("ct-active", !isWorld);
    root.hidden = isWorld;
    root.innerHTML = isWorld ? "" : countryHTML(current);
    root.classList.remove("ct-swap");
    if (!isWorld && animate && !reduced()) { void root.offsetWidth; root.classList.add("ct-swap"); }
    if (T()) T().apply(current);
    applyFilter();
    updateChrome();
  }

  function renderBody() {
    const body = $("ct-body"); if (!body || !COUNTRIES[current]) return;
    body.innerHTML = bodyHTML(current);
    body.setAttribute("aria-labelledby", `ct-tab-${tab}`);
    body.classList.remove("ct-fade"); if (!reduced()) { void body.offsetWidth; body.classList.add("ct-fade"); }
    applyFilter();
  }

  function applyFilter() {
    const cards = document.querySelectorAll("#ct-unis-grid .ct-uni");
    let shown = 0;
    cards.forEach((el) => { const ok = filterTag === "All" || el.dataset.tags.split("|").includes(filterTag); el.hidden = !ok; if (ok) shown++; });
    const empty = $("ct-unis-empty"); if (empty) empty.hidden = shown > 0;
  }

  /* ------------------------------- chooser ------------------------------- */

  function chooserHTML() {
    const cards = ORDER.map((id) => {
      const c = COUNTRIES[id], th = T() ? T().THEMES[id] : null;
      return `<button type="button" class="ct-choice${id === current ? " on" : ""}" data-ct-pick="${esc(id)}" ${th ? `style="--ct-glow:${th.glow}"` : ""}>
        ${T() ? T().art(id) : ""}${c.img.hero ? `<img src="${asset(id, "hero.jpg")}" alt="" ${IMG_GONE}>` : ""}
        ${flag(id)}<b>Study in ${esc(c.brand)}</b><small>${esc(c.tagline)}</small></button>`;
    }).join("");
    return `<div class="ct-sheet" role="dialog" aria-modal="true" aria-labelledby="ctChooserTitle">
      <div class="ct-sheet-head"><div><h2 id="ctChooserTitle">Choose your destination</h2><p>UniAI reshapes itself around the country you want to study in.</p></div>
        <button type="button" class="ct-x" data-ct-close aria-label="Close">✕</button></div>
      <div class="ct-choices">${cards}</div>
      <div class="ct-world-row"><button type="button" class="ct-world-btn${current === "world" ? " on" : ""}" data-ct-pick="world">🌍 World: show everything</button></div>
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

  function browse() {
    go("universityFinder");
    if (!COUNTRIES[current]) return;
    const sel = $("country"); if (!sel) return;
    const names = COUNTRIES[current].db.map((n) => n.toLowerCase());
    const opt = Array.from(sel.options).find((o) => names.includes(o.value.toLowerCase()) || names.includes(o.textContent.trim().toLowerCase()));
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof window.findUniversities === "function") window.findUniversities();
    }
  }

  async function ask(text) {
    const q = String(text || "").trim().slice(0, 300);
    if (!q) return;
    const c = COUNTRIES[current];
    window.UniAIContext = Object.assign({}, window.UniAIContext, { country: c ? c.name : "" });
    await go("ai-chat");
    if (typeof window.askUniAI === "function") window.askUniAI(c ? `${q} (I'm planning to study in ${c.name}.)` : q);
  }

  function toggleIn(key, rec, same) {
    const list = readJSON(key, []);
    const i = list.findIndex(same);
    if (i > -1) list.splice(i, 1); else list.push(rec);
    writeJSON(key, list);
    return i === -1;
  }

  function refreshJourney() { const j = $("ct-journey"); if (j) j.outerHTML = journeyHTML(current); }

  function onClick(e) {
    const opener = e.target.closest("[data-ct-open]");
    if (opener) { e.preventDefault(); return open(); }
    const el = e.target.closest("#countryHome [data-ct]");
    if (!el) return;
    const act = el.dataset.ct, c = COUNTRIES[current];

    if (act === "chooser") return open();
    if (act === "browse") return browse();
    if (act === "page") return go(el.dataset.page);
    if (act === "guide") return c && (window.location.href = c.guides[1][3].indexOf("page:") === 0 ? c.guides[0][3] : c.guides[1][3]);
    if (act === "ask") return ask(el.dataset.q);
    if (act === "ask-input") { const i = $("ct-ask-input"); const v = i && i.value; if (i) i.value = ""; return ask(v); }

    if (act === "uni") {
      if (el.dataset.slug) { window.location.href = `/university/${encodeURIComponent(el.dataset.slug)}`; return; }
      return browse();
    }
    if (act === "save") {
      const u = c.unis[Number(el.dataset.i)];
      const on = toggleIn(LS.saved, { c: current, n: u[0] }, (s) => s.c === current && s.n === u[0]);
      el.classList.toggle("on", on); el.textContent = on ? "♥" : "♡"; el.setAttribute("aria-pressed", on);
      return refreshJourney();
    }
    if (act === "sch") {
      const n = el.dataset.n;
      const on = toggleIn(LS.sch, { c: current, n }, (s) => s.c === current && s.n === n);
      el.classList.toggle("on", on); el.textContent = on ? "✓ Shortlisted" : "Shortlist"; el.setAttribute("aria-pressed", on);
      return refreshJourney();
    }
    if (act === "filter") {
      filterTag = el.dataset.tag;
      document.querySelectorAll("#countryHome .ct-chip").forEach((b) => { const on = b.dataset.tag === filterTag; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      return applyFilter();
    }
    if (act === "dl-del") {
      const all = readJSON(LS.dl, {}); all[current] = (all[current] || []).filter((d) => d.id !== el.dataset.id); writeJSON(LS.dl, all);
      return refreshJourney();
    }
    if (act === "tab") {
      tab = el.dataset.tab; try { localStorage.setItem(LS.tab, tab); } catch (x) { /* ignore */ }
      document.querySelectorAll("#countryHome .ct-tab").forEach((b) => { const on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      return renderBody();
    }
  }

  function onChange(e) {
    const el = e.target.closest && e.target.closest('#countryHome [data-ct="doc"]');
    if (!el || !COUNTRIES[current]) return;
    const all = readJSON(LS.docs, {}), list = new Set(all[current] || []);
    if (el.checked) list.add(el.dataset.doc); else list.delete(el.dataset.doc);
    all[current] = Array.from(list); writeJSON(LS.docs, all);
    refreshJourney();
  }

  function onSubmit(e) {
    const f = e.target.closest && e.target.closest('#countryHome [data-ct-form="dl"]');
    if (!f) return;
    e.preventDefault();
    const label = f.elements.label.value.trim().slice(0, 60), date = f.elements.date.value;
    if (!label || !date) return;
    const all = readJSON(LS.dl, {}); (all[current] = all[current] || []).push({ id: String(Date.now()), label, date }); writeJSON(LS.dl, all);
    refreshJourney();
  }

  function onKey(e) {
    if (e.key === "Escape") { const m = $("ctChooser"); if (m && !m.hidden) close(); }
    if (e.key === "Enter" && e.target && e.target.id === "ct-ask-input") { e.preventDefault(); const v = e.target.value; e.target.value = ""; ask(v); }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target && e.target.classList && e.target.classList.contains("ct-tab")) {
      const tabs = Array.from(document.querySelectorAll("#countryHome .ct-tab")), i = tabs.indexOf(e.target);
      const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
    }
  }

  /* --------------------------------- state --------------------------------- */

  function refreshLive(id) {
    if (current !== id || !live[id]) return;
    const grid = $("ct-unis-grid"), facts = $("ct-facts");
    if (grid) { grid.innerHTML = COUNTRIES[id].unis.map((_, i) => uniHTML(id, i)).join(""); applyFilter(); }
    if (facts) facts.innerHTML = factsHTML(id);
  }

  function set(id) {
    const next = COUNTRIES[id] ? id : "world";
    const changed = next !== current;
    current = next; filterTag = "All";
    try { localStorage.setItem(KEY, current); } catch (e) { /* private mode */ }

    close();
    render(changed);
    if (changed) window.dispatchEvent(new CustomEvent(EVENT, { detail: describe(current) }));

    if (COUNTRIES[current]) {
      const id2 = current;
      if (live[id2]) refreshLive(id2); else loadLive(id2).then(() => refreshLive(id2));
      window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
    }
    return describe(current);
  }

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
      if (a) { const tag = document.createElement("span"); tag.id = "ctLogoTag"; tag.className = "ct-logo-tag"; tag.hidden = true; a.appendChild(tag); }
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
    if (tag) { tag.hidden = !c; tag.innerHTML = c ? `${flag(current)}${esc(c.brand)}` : ""; }
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
    document.addEventListener("change", onChange);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", onKey);

    let saved = null, savedTab = null;
    try { saved = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY); savedTab = localStorage.getItem(LS.tab); } catch (e) { /* ignore */ }
    current = COUNTRIES[saved] ? saved : "world";
    if (TABS.some((t) => t[0] === savedTab)) tab = savedTab;
    render(false);
    if (COUNTRIES[current]) { const id = current; loadLive(id).then(() => refreshLive(id)); }
  }

  window.UniAIRegion = {
    get: () => describe(current),
    set, open, close, browse,
    add(id, def) { COUNTRIES[id] = def; if (ORDER.indexOf(id) < 0) ORDER.push(id); },
    list: () => ORDER.slice()
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
/* ==========================================================================
   UniAI — Mock Visa Interview (JS/interview.js)

   Add AFTER script.js:
     <script src="JS/interview.js"></script>

   Needs the backend route POST /ai/interview (routes/interviewRoutes.js).
   Needs NO changes to index.html: it injects a "Visa Interview" sidebar
   button (after Visa Guide) and the #visaInterviewPage section.

   What you get
   - Setup: destination, interviewer style (friendly / standard / strict),
     length (4 / 6 / 10 questions), optional timer, optional read-aloud,
     and an optional profile (course, funding, plans) so questions fit you.
   - Interview room: officer questions (with follow-ups when an answer is
     vague), answer by typing or by voice, and an INSTANT CHECKER that runs
     in your browser while you write (length, specifics, hedging, filler words).
   - After every answer: score out of 5, five skill bars (clarity, specifics,
     consistency, relevance, confidence), red flags, what worked, what to
     improve, and a stronger sample answer built only from your facts.
   - Summary: average score, readiness level, skill averages, per-question
     strip, strengths / practise next / tips / drills, progress vs last time,
     and a copy / download report.

   Privacy
   - Signed-in users only. Answers stay in memory for this page view and are
     sent to the server to write feedback. They are NOT saved.
   - Saved on THIS DEVICE only: your settings, your optional profile, and your
     past session SCORES (never answers) for the progress chart.
   - Voice input uses your browser's speech recognition, which may send audio
     to the browser vendor. Typing never does.

   This is practice, not a prediction. Real interviews differ.
   ========================================================================== */

(function () {
  "use strict";

  if (window.UniAIInterview) return;

  const MAX_ANSWER = 1500;
  const MIN_ANSWER = 8;
  const TIME_LIMIT = 90; // seconds per question in timed mode
  const STORE_KEY = "uniai-interview";
  const HISTORY_MAX = 20;

  const COUNTRIES = [
    ["US", "United States", "🇺🇸"],
    ["UK", "United Kingdom", "🇬🇧"],
    ["CA", "Canada", "🇨🇦"],
    ["AU", "Australia", "🇦🇺"],
    ["DE", "Germany", "🇩🇪"],
    ["IE", "Ireland", "🇮🇪"],
    ["FR", "France", "🇫🇷"],
    ["NL", "Netherlands", "🇳🇱"],
    ["SG", "Singapore", "🇸🇬"],
    ["JP", "Japan", "🇯🇵"],
    ["NZ", "New Zealand", "🇳🇿"]
  ];

  const STYLES = [
    ["friendly", "Friendly", "Warm, open questions"],
    ["standard", "Standard", "Polite but direct"],
    ["strict", "Strict", "Short, probing, sceptical"]
  ];

  const LENGTHS = [
    [4, "Quick", "4 questions · about 5 min"],
    [6, "Standard", "6 questions · about 8 min"],
    [10, "Full", "10 questions · about 15 min"]
  ];

  const DIMS = [
    ["clarity", "Clarity"],
    ["specificity", "Specifics"],
    ["consistency", "Consistency"],
    ["relevance", "Relevance"],
    ["confidence", "Confidence"]
  ];

  const LABELS = ["", "Needs work", "Weak", "Adequate", "Strong", "Excellent"];
  const SPEECH_LANG = { UK: "en-GB", AU: "en-AU", CA: "en-CA", IE: "en-IE", NZ: "en-NZ" };

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SYNTH = "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

  const $ = (id) => document.getElementById(id);

  const esc = (v) =>
    String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const fmt = (sec) => {
    const n = Math.max(0, Math.floor(sec));
    return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
  };

  const scoreClass = (n) => (n >= 4 ? "hi" : n >= 3 ? "mid" : "lo");
  const round1 = (n) => Math.round(n * 10) / 10;

  /* ------------------------------------------------------------------ *
   * Device storage: settings, profile and past SCORES only (never answers)
   * ------------------------------------------------------------------ */

  function loadStore() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch (err) {
      return {};
    }
  }

  function saveStore(patch) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign(loadStore(), patch)));
    } catch (err) {
      /* storage blocked: settings last for this page view */
    }
  }

  function readHistory() {
    const h = loadStore().history;
    return Array.isArray(h) ? h.filter((x) => x && typeof x.avg === "number") : [];
  }

  function cleanProfile(p) {
    const out = { course: "", funding: "", plans: "", notes: "" };
    if (p && typeof p === "object") Object.keys(out).forEach((k) => (out[k] = String(p[k] || "").slice(0, 200)));
    return out;
  }

  /* ------------------------------------------------------------------ *
   * State (answers: memory only)
   * ------------------------------------------------------------------ */

  let s = fresh();
  let profOpen = false;
  let timerId = null;
  let rec = null;
  let listening = false;

  function fresh() {
    const st = loadStore();
    const p = st.prefs || {};
    return {
      running: false,
      done: false,
      busy: false,
      error: "",
      country: COUNTRIES.some((c) => c[0] === p.country) ? p.country : "US",
      style: STYLES.some((x) => x[0] === p.style) ? p.style : "standard",
      total: [4, 6, 10].indexOf(Number(p.total)) >= 0 ? Number(p.total) : 6,
      timed: !!p.timed,
      speak: !!p.speak,
      profile: cleanProfile(st.profile),
      turns: [],
      feedback: {},
      kinds: {},
      times: {},
      summary: null,
      delta: null,
      asked: 0,
      qStart: 0
    };
  }

  function savePrefs() {
    saveStore({ prefs: { country: s.country, style: s.style, total: s.total, timed: s.timed, speak: s.speak } });
  }

  /* ------------------------------------------------------------------ *
   * Server
   * ------------------------------------------------------------------ */

  class SignIn extends Error {}

  async function token() {
    try {
      return typeof getChatAccessToken === "function" ? await getChatAccessToken() : null;
    } catch (err) {
      return null;
    }
  }

  async function call(history) {
    const t = await token();
    if (!t) throw new SignIn("Sign in to practise your visa interview.");

    const url = typeof api === "function" ? api("/ai/interview") : "/ai/interview";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ country: s.country, style: s.style, total: s.total, profile: s.profile, history })
    });

    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      /* non-JSON error page */
    }

    if (res.status === 401) throw new SignIn((data && data.message) || "Please sign in again.");
    if (!res.ok) throw new Error((data && data.message) || "Something went wrong. Please try again.");
    return data;
  }

  function askSignIn() {
    if (typeof openAuthOverlay === "function") {
      openAuthOverlay(false, "Sign in to practise your visa interview", { type: "page", page: "visaInterview" });
    }
  }

  /* ------------------------------------------------------------------ *
   * Instant checker: runs in the browser while you write. Style only; the
   * AI feedback after you send judges the content.
   * ------------------------------------------------------------------ */

  function checkAnswer(text) {
    const t = String(text || "").trim();
    const words = t ? t.split(/\s+/).length : 0;
    const sentences = t.split(/[.!?]+\s+|[.!?]+$/).filter((x) => x.trim()).length || (t ? 1 : 0);
    const avgSentence = sentences ? words / sentences : 0;
    const fillers = (t.match(/\b(?:um+|uh+|erm|you know|i mean|kind of|sort of|basically|literally)\b/gi) || []).length;
    const hedges = (t.match(/\b(?:maybe|i guess|i think|probably|perhaps|not sure|i don'?t know|hopefully|something like that)\b/gi) || []).length;
    const numbers = (t.match(/\d[\d,.]*/g) || []).length;

    const proper = {};
    t.split(/[.!?]+\s+/).forEach((sent) => {
      sent.split(/\s+/).slice(1).forEach((w) => {
        const c = w.replace(/[^A-Za-z]/g, "");
        if (c.length > 2 && /^[A-Z][a-z]/.test(c)) proper[c.toLowerCase()] = 1;
      });
    });
    const specifics = numbers + Object.keys(proper).length;

    const items = [];
    if (words) {
      if (words < 15) items.push({ k: "warn", t: `Too short (${words} words). Aim for 30–120.` });
      else if (words < 30) items.push({ k: "info", t: `A bit short (${words} words). Add a reason or an example.` });
      else if (words <= 120) items.push({ k: "ok", t: `Good length (${words} words).` });
      else if (words <= 180) items.push({ k: "info", t: `Getting long (${words} words). Officers prefer short, direct answers.` });
      else items.push({ k: "warn", t: `Too long (${words} words). Keep only the key points.` });

      if (words >= 15) {
        if (specifics >= 2) items.push({ k: "ok", t: "Specific details (names or numbers)." });
        else items.push({ k: "warn", t: "Add something concrete: a name, a number or an example." });

        if (hedges >= 3) items.push({ k: "warn", t: 'Lots of hedging ("maybe", "I think"). Sound more certain.' });
        else if (hedges >= 1) items.push({ k: "info", t: "A little hedging. Say it with confidence where you are sure." });

        if (fillers >= 2) items.push({ k: "warn", t: "Filler words (um, basically, you know). Cut them." });
        if (avgSentence > 30) items.push({ k: "info", t: "Very long sentences. Break them up." });
      }
    }

    return { words, sentences, avgSentence: Math.round(avgSentence), fillers, hedges, specifics, items };
  }

  /* ------------------------------------------------------------------ *
   * Stats
   * ------------------------------------------------------------------ */

  const answeredIdx = () => Object.keys(s.feedback).map(Number).sort((a, b) => a - b);

  function avgScore() {
    const ks = answeredIdx();
    if (!ks.length) return 0;
    return round1(ks.reduce((a, k) => a + s.feedback[k].score, 0) / ks.length);
  }

  function dimAverages() {
    const out = {};
    DIMS.forEach(([k]) => {
      const vals = answeredIdx()
        .map((i) => s.feedback[i].dimensions && s.feedback[i].dimensions[k])
        .filter((v) => typeof v === "number");
      out[k] = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    });
    return out;
  }

  function readiness(avg) {
    if (avg >= 4.2) return "Interview-ready";
    if (avg >= 3.5) return "Nearly there";
    if (avg >= 2.5) return "Getting there";
    return "Needs more practice";
  }

  function pushHistory(entry) {
    const h = readHistory();
    s.delta = h.length ? round1(entry.avg - h[h.length - 1].avg) : null;
    h.push(entry);
    saveStore({ history: h.slice(-HISTORY_MAX) });
  }

  /* ------------------------------------------------------------------ *
   * Voice (optional, browser features)
   * ------------------------------------------------------------------ */

  function speak(text, force) {
    if (!SYNTH || (!s.speak && !force)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = SPEECH_LANG[s.country] || "en-US";
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (err) {
      /* speech not available */
    }
  }

  function speechCancel() {
    try {
      if (SYNTH) window.speechSynthesis.cancel();
    } catch (err) {
      /* ignore */
    }
  }

  function setMic(msg) {
    const b = $("vi-mic");
    if (b) {
      b.textContent = listening ? "⏹ Stop" : "🎤 Speak";
      b.setAttribute("aria-pressed", String(listening));
      b.classList.toggle("is-live", listening);
    }
    const m = $("vi-mic-msg");
    if (m) m.textContent = msg == null ? (listening ? "Listening… speak your answer." : "") : msg;
  }

  function stopListening() {
    try {
      if (rec) rec.stop();
    } catch (err) {
      /* ignore */
    }
    rec = null;
    listening = false;
  }

  function toggleListening() {
    if (!SR) return;
    if (listening) {
      stopListening();
      setMic();
      return;
    }

    const box = $("vi-answer");
    if (!box) return;

    const lang = navigator.language && /^en/i.test(navigator.language) ? navigator.language : "en-IN";
    const base = box.value ? box.value.replace(/\s+$/, "") + " " : "";

    try {
      rec = new SR();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (e) => {
        let fin = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        box.value = (base + fin + interim).slice(0, MAX_ANSWER);
        box.dispatchEvent(new Event("input", { bubbles: true }));
      };
      rec.onerror = (e) => {
        listening = false;
        const blocked = e && (e.error === "not-allowed" || e.error === "service-not-allowed");
        setMic(blocked ? "Microphone access is blocked. Allow it in your browser, or type instead." : "Couldn't hear you. Try again or type.");
      };
      rec.onend = () => {
        listening = false;
        setMic();
      };
      rec.start();
      listening = true;
      setMic();
    } catch (err) {
      listening = false;
      setMic("Voice input isn't available here. Please type your answer.");
    }
  }

  /* ------------------------------------------------------------------ *
   * Timer
   * ------------------------------------------------------------------ */

  function tick() {
    const el = $("vi-timer");
    if (!el || !s.qStart) return;
    const sec = Math.floor((Date.now() - s.qStart) / 1000);

    if (s.timed) {
      const left = TIME_LIMIT - sec;
      el.textContent = left >= 0 ? fmt(left) : "Time's up";
      el.className = "vi-timer timed" + (left <= 15 ? " warn" : "") + (left < 0 ? " over" : "");
    } else {
      el.textContent = fmt(sec);
    }
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(tick, 1000);
    tick();
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  function injectStyle() {
    if ($("vi-style")) return;
    const style = document.createElement("style");
    style.id = "vi-style";
    style.textContent = `
      .vi-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; align-items: start; margin-top: 6px; }
      .vi-main, .vi-side { min-width: 0; display: grid; gap: 18px; }
      .vi-side { position: sticky; top: 16px; }
      @media (max-width: 1100px) { .vi-layout { grid-template-columns: minmax(0, 1fr); } .vi-side { position: static; } }

      .vi-card { background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 22px; padding: 22px; min-width: 0; }
      .vi-card h2 { margin: 0 0 6px; font-size: 1.2rem; }
      .vi-card h3 { margin: 0 0 8px; font-size: 1rem; }
      .vi-sec { margin: 4px 0 0; font-size: 1rem; }
      .vi-muted { color: var(--text-muted, #94a3b8); font-size: .86rem; line-height: 1.5; margin: 0; }
      .vi-eyebrow { font-size: .7rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }

      .vi-hero { border-radius: 24px; padding: 26px 28px; color: #fff; background: linear-gradient(135deg, #4f6bff 0%, #a15bff 60%, #ec4899 100%); }
      .vi-hero h2 { margin: 0 0 6px; font-size: 1.7rem; color: #fff; }
      .vi-hero p { margin: 0; max-width: 520px; line-height: 1.55; opacity: .95; }
      .vi-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
      .vi-pills span { font-size: .78rem; font-weight: 700; padding: 6px 12px; border-radius: 99px; background: rgba(255,255,255,.2); }

      .vi-step { margin-top: 20px; }
      .vi-step:first-child { margin-top: 0; }
      .vi-step > .vi-eyebrow { display: block; margin-bottom: 8px; }
      .vi-countries { display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 8px; }
      .vi-country, .vi-segb { font: inherit; cursor: pointer; text-align: left; color: inherit; background: var(--surface-2, transparent); border: 1px solid var(--border, #e2e8f0); border-radius: 14px; padding: 10px 12px; }
      .vi-country { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: .88rem; }
      .vi-country span { font-size: 1.25rem; }
      .vi-seg { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
      .vi-segb b { display: block; font-size: .92rem; }
      .vi-segb small { color: var(--text-muted, #94a3b8); font-size: .78rem; }
      .vi-country.is-on, .vi-segb.is-on { border-color: var(--primary, #6d5dfb); background: rgba(109,93,251,.12); box-shadow: 0 0 0 1px var(--primary, #6d5dfb) inset; }
      .vi-country:focus-visible, .vi-segb:focus-visible { outline: 2px solid var(--primary, #6d5dfb); outline-offset: 2px; }
      .vi-opts { display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: .9rem; }
      .vi-opts label { display: inline-flex; gap: 8px; align-items: center; cursor: pointer; }
      .vi-prof { border: 1px solid var(--border, #e2e8f0); border-radius: 14px; padding: 12px 14px; }
      .vi-prof summary { cursor: pointer; font-weight: 700; font-size: .9rem; }
      .vi-fields { display: grid; gap: 10px; margin-top: 12px; }
      .vi-fields label { display: grid; gap: 5px; font-size: .75rem; font-weight: 700; color: var(--text-muted, #64748b); }

      .vi-in { font: inherit; font-size: .95rem; color: var(--text, inherit); background: var(--surface-2, transparent); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 11px 14px; box-sizing: border-box; width: 100%; color-scheme: inherit; }
      .vi-in:focus { outline: 2px solid rgba(109,93,251,.45); outline-offset: 1px; }
      textarea.vi-in { min-height: 120px; resize: vertical; line-height: 1.5; }
      .vi-btn { border: 0; cursor: pointer; background: var(--primary, #6d5dfb); color: #fff; font: inherit; font-weight: 700; font-size: .9rem; padding: 12px 20px; border-radius: 14px; }
      .vi-btn:hover:not(:disabled) { filter: brightness(1.08); }
      .vi-btn:disabled { opacity: .55; cursor: default; }
      .vi-btn.ghost { background: transparent; color: inherit; border: 1px solid var(--border, #e2e8f0); }
      .vi-btn.sm { padding: 8px 14px; font-size: .82rem; border-radius: 12px; }
      .vi-btn.lg { padding: 14px 28px; font-size: 1rem; }
      .vi-btn.is-live { background: #ef4444; border-color: #ef4444; color: #fff; }
      .vi-btn:focus-visible, .vi-link:focus-visible { outline: 2px solid var(--primary, #6d5dfb); outline-offset: 2px; }
      .vi-link { font: inherit; font-size: .84rem; font-weight: 700; border: 0; background: none; cursor: pointer; color: var(--primary, #6d5dfb); padding: 0; }

      .vi-prog { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: .8rem; font-weight: 700; color: var(--text-muted, #64748b); }
      .vi-bar { height: 6px; border-radius: 6px; background: rgba(148,163,184,.22); overflow: hidden; margin: 8px 0 16px; }
      .vi-bar i { display: block; height: 100%; background: var(--primary, #6d5dfb); border-radius: 6px; transition: width .3s; }

      .vi-row-o { display: flex; gap: 10px; align-items: flex-start; margin: 10px 0; }
      .vi-av { flex: none; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 1.1rem; background: linear-gradient(135deg, #4f6bff, #a15bff); }
      .vi-msg { max-width: 92%; padding: 12px 16px; border-radius: 16px; line-height: 1.55; font-size: .94rem; margin: 10px 0; overflow-wrap: anywhere; white-space: pre-wrap; }
      .vi-row-o .vi-msg { margin: 0; }
      .vi-msg.o { background: rgba(109,93,251,.10); border: 1px solid rgba(109,93,251,.2); border-top-left-radius: 4px; }
      .vi-msg.s { background: var(--surface-2, rgba(148,163,184,.12)); border: 1px solid var(--border, #e2e8f0); margin-left: auto; border-top-right-radius: 4px; }
      .vi-who { display: flex; align-items: center; gap: 8px; font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #94a3b8); margin-bottom: 4px; }
      .vi-tag { font-style: normal; font-size: .62rem; padding: 2px 8px; border-radius: 99px; background: rgba(245,158,11,.18); color: #b45309; }
      html[data-theme="dark"] .vi-tag { color: #fbbf24; }
      .vi-say { border: 0; background: none; cursor: pointer; font-size: .85rem; padding: 0; }
      .vi-typing { display: inline-flex; gap: 4px; align-items: center; padding: 12px 16px; border-radius: 16px; background: rgba(109,93,251,.10); margin: 6px 0 0 48px; }
      .vi-typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--primary, #6d5dfb); animation: vi-b 1s infinite ease-in-out; }
      .vi-typing i:nth-child(2) { animation-delay: .15s; } .vi-typing i:nth-child(3) { animation-delay: .3s; }
      @keyframes vi-b { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
      @media (prefers-reduced-motion: reduce) { .vi-typing i { animation: none; opacity: .7; } .vi-bar i { transition: none; } }

      .vi-ring { --c: #10b981; position: relative; flex: none; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--c) calc(var(--p) * 1%), rgba(148,163,184,.25) 0); }
      .vi-ring::before { content: ""; position: absolute; inset: 6px; border-radius: 50%; background: var(--card-bg, #fff); }
      .vi-ring b { position: relative; font-size: 1.05rem; }
      .vi-ring.mid { --c: #f59e0b; } .vi-ring.lo { --c: #ef4444; }
      .vi-ring.lg { width: 116px; height: 116px; } .vi-ring.lg::before { inset: 10px; } .vi-ring.lg b { font-size: 2.1rem; }

      .vi-fb { border: 1px solid var(--border, #e2e8f0); border-radius: 18px; padding: 16px; margin: 6px 0 16px; font-size: .88rem; line-height: 1.5; }
      .vi-fb-top { display: flex; align-items: center; gap: 14px; }
      .vi-fb-top strong { display: block; font-size: 1rem; }
      .vi-fb h4 { margin: 14px 0 4px; font-size: .72rem; letter-spacing: .07em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .vi-fb ul { margin: 0; padding-left: 18px; }
      .vi-fb details summary { cursor: pointer; font-weight: 700; color: var(--primary, #6d5dfb); margin-top: 14px; }
      .vi-fb details p { margin: 8px 0 0; white-space: pre-wrap; }
      .vi-flags { margin-top: 12px; padding: 10px 14px; border-radius: 12px; background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.25); }
      .vi-flags h4 { margin-top: 0; color: #dc2626; }
      html[data-theme="dark"] .vi-flags h4 { color: #f87171; }

      .vi-dims { display: grid; gap: 7px; margin-top: 14px; }
      .vi-dim { display: grid; grid-template-columns: 86px 1fr 24px; gap: 10px; align-items: center; font-size: .8rem; }
      .vi-dim span { color: var(--text-muted, #64748b); font-weight: 600; }
      .vi-dim b { text-align: right; }
      .vi-meter { height: 7px; border-radius: 7px; background: rgba(148,163,184,.22); overflow: hidden; }
      .vi-meter i { display: block; height: 100%; border-radius: 7px; background: #10b981; }
      .vi-meter.mid i { background: #f59e0b; } .vi-meter.lo i { background: #ef4444; }

      .vi-composer { margin-top: 14px; display: grid; gap: 10px; }
      .vi-live { border: 1px dashed var(--border, #cbd5e1); border-radius: 14px; padding: 10px 14px; }
      .vi-live .vi-eyebrow { display: block; margin-bottom: 6px; }
      .vi-chk { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; font-size: .84rem; }
      .vi-chk li { display: flex; gap: 8px; align-items: flex-start; }
      .vi-chk li span { flex: none; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: .7rem; font-weight: 800; color: #fff; background: #10b981; }
      .vi-chk li.warn span { background: #ef4444; } .vi-chk li.info span { background: #f59e0b; }
      .vi-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .vi-tools, .vi-btns { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .vi-count { font-size: .76rem; color: var(--text-muted, #94a3b8); }
      .vi-timer { font-variant-numeric: tabular-nums; font-size: .8rem; font-weight: 700; padding: 5px 10px; border-radius: 99px; background: rgba(148,163,184,.18); }
      .vi-timer.timed { background: rgba(109,93,251,.14); color: var(--primary, #6d5dfb); }
      .vi-timer.warn { background: rgba(245,158,11,.2); color: #b45309; }
      .vi-timer.over { background: rgba(239,68,68,.18); color: #dc2626; }
      .vi-err { color: #dc2626; font-size: .86rem; margin: 10px 0 0; }
      html[data-theme="dark"] .vi-err { color: #f87171; }

      .vi-sumtop { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
      .vi-sumtop h2 { font-size: 1.5rem; margin: 2px 0 4px; }
      .vi-delta { font-size: .84rem; font-weight: 700; margin-top: 6px; }
      .vi-delta.up { color: #059669; } .vi-delta.down { color: #dc2626; }
      .vi-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; align-items: center; }
      .vi-chip { font: inherit; font-size: .8rem; font-weight: 800; cursor: pointer; border: 0; padding: 6px 12px; border-radius: 99px; color: #fff; background: #10b981; }
      .vi-chip.mid { background: #f59e0b; } .vi-chip.lo { background: #ef4444; }
      .vi-sum { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 18px; }
      .vi-sum > div { border: 1px solid var(--border, #e2e8f0); border-radius: 16px; padding: 14px 16px; }
      .vi-sum h4 { margin: 0 0 6px; font-size: .72rem; letter-spacing: .07em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .vi-sum ul { margin: 0; padding-left: 18px; font-size: .88rem; line-height: 1.5; }
      .vi-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }

      .vi-dots { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
      .vi-dot { font: inherit; font-size: .78rem; font-weight: 800; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; border: 1px solid var(--border, #e2e8f0); background: transparent; color: var(--text-muted, #94a3b8); }
      .vi-dot:disabled { cursor: default; opacity: .5; }
      .vi-dot.cur { border-color: var(--primary, #6d5dfb); color: var(--primary, #6d5dfb); box-shadow: 0 0 0 2px rgba(109,93,251,.25); }
      .vi-dot.hi, .vi-dot.mid, .vi-dot.lo { border: 0; color: #fff; background: #10b981; }
      .vi-dot.mid { background: #f59e0b; } .vi-dot.lo { background: #ef4444; }
      .vi-sidecard ul { margin: 6px 0 0; padding-left: 18px; font-size: .86rem; line-height: 1.6; }
      .vi-stats { display: flex; gap: 18px; margin: 8px 0 6px; font-size: .78rem; color: var(--text-muted, #64748b); }
      .vi-stats b { display: block; font-size: 1.3rem; color: var(--text, inherit); }
      .vi-spark { width: 100%; height: 56px; color: var(--primary, #6d5dfb); }
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Page + nav
   * ------------------------------------------------------------------ */

  function build() {
    if ($("visaInterviewPage")) return true;

    const anchor = $("visaGuidePage") || $("savedPage") || document.querySelector(".page-section");
    if (!anchor) return false;

    injectStyle();

    const page = document.createElement("div");
    page.id = "visaInterviewPage";
    page.className = "page-section hidden";
    page.innerHTML = `
      <div class="page-header">
        <div>
          <span class="eyebrow">PRACTICE</span>
          <h1>Mock Visa Interview</h1>
          <p>Answer realistic questions, get scored on every answer and see exactly what to fix.</p>
        </div>
      </div>
      <div id="vi-root"></div>
    `;

    anchor.parentElement.insertBefore(page, anchor.nextSibling);
    buildNav();

    page.addEventListener("click", onClick);
    page.addEventListener("input", onInput);
    page.addEventListener("change", onChange);
    page.addEventListener(
      "toggle",
      (e) => {
        if (e.target && e.target.classList && e.target.classList.contains("vi-prof")) profOpen = e.target.open;
      },
      true
    );
    page.addEventListener("keydown", (e) => {
      if (e.target.id === "vi-answer" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit();
      }
    });

    window.addEventListener("pagehide", () => {
      stopListening();
      speechCancel();
    });

    render();
    return true;
  }

  function buildNav() {
    if (document.querySelector(".nav-btn[data-vi-nav]")) return;

    const link = document.createElement("a");
    link.href = "#";
    link.className = "nav-btn";
    link.setAttribute("data-vi-nav", "1");
    link.setAttribute("onclick", "showPage('visaInterview', event)");
    link.innerHTML =
      '<svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg> Visa Interview';

    const after = Array.prototype.find.call(document.querySelectorAll(".nav-btn"), (b) =>
      /showPage\(['"]visaGuide['"]/.test(b.getAttribute("onclick") || "")
    );

    if (after) after.insertAdjacentElement("afterend", link);
    else {
      const nav = document.querySelector(".sidebar-nav");
      if (nav) nav.appendChild(link);
    }
  }

  /* ------------------------------------------------------------------ *
   * Render helpers
   * ------------------------------------------------------------------ */

  const countryOf = () => COUNTRIES.find((c) => c[0] === s.country) || [s.country, s.country, ""];
  const styleOf = () => (STYLES.find((x) => x[0] === s.style) || STYLES[1])[1];

  function ringHtml(score, size) {
    const n = Number(score) || 0;
    return `<div class="vi-ring ${scoreClass(n)}${size === "lg" ? " lg" : ""}" style="--p:${Math.round(n * 20)}" role="img" aria-label="Score ${n} out of 5"><b>${n}</b></div>`;
  }

  function barsHtml(dims) {
    return (
      '<div class="vi-dims">' +
      DIMS.map(([k, label]) => {
        const v = Number(dims && dims[k]) || 0;
        return `<div class="vi-dim"><span>${label}</span><div class="vi-meter ${scoreClass(v)}"><i style="width:${Math.round(v * 20)}%"></i></div><b>${v || "–"}</b></div>`;
      }).join("") +
      "</div>"
    );
  }

  const listHtml = (items) => items.map((x) => `<li>${esc(x)}</li>`).join("");

  function feedbackHtml(f, idx) {
    const words = s.turns[idx] ? s.turns[idx].text.split(/\s+/).length : 0;
    const secs = s.times[idx];
    const meta = [words + " words", secs && secs < 600 ? fmt(secs) : ""].filter(Boolean).join(" · ");
    const block = (title, items) => (items && items.length ? `<h4>${title}</h4><ul>${listHtml(items)}</ul>` : "");

    return `<div class="vi-fb">
      <div class="vi-fb-top">${ringHtml(f.score)}<div><strong>${LABELS[f.score] || ""}</strong><span class="vi-muted">${esc(meta)}</span></div></div>
      ${barsHtml(f.dimensions)}
      ${f.red_flags && f.red_flags.length ? `<div class="vi-flags"><h4>Watch out</h4><ul>${listHtml(f.red_flags)}</ul></div>` : ""}
      ${block("What worked", f.strengths)}
      ${block("To improve", f.improve)}
      ${f.sample ? `<details><summary>See a stronger version of your answer</summary><p>${esc(f.sample)}</p><p class="vi-muted">Built from what you wrote. Replace anything in [brackets] with your real details, and only say what is true.</p></details>` : ""}
    </div>`;
  }

  function threadHtml() {
    let h = "";
    s.turns.forEach((t, i) => {
      if (t.role === "officer") {
        const n = i / 2 + 1;
        h += `<div class="vi-row-o" id="vi-q-${n}"><div class="vi-av" aria-hidden="true">🛂</div><div class="vi-msg o"><span class="vi-who">Officer · Question ${n}${s.kinds[i] === "followup" ? '<em class="vi-tag">Follow-up</em>' : ""}${SYNTH ? `<button type="button" class="vi-say" data-vi-say="${i}" aria-label="Read question aloud">🔊</button>` : ""}</span>${esc(t.text)}</div></div>`;
      } else {
        h += `<div class="vi-msg s"><span class="vi-who">You</span>${esc(t.text)}</div>`;
        if (s.feedback[i]) h += feedbackHtml(s.feedback[i], i);
      }
    });
    return h;
  }

  function liveHtml(text) {
    const head = '<span class="vi-eyebrow">Instant check · style only</span>';
    if (!String(text || "").trim()) {
      return head + '<p class="vi-muted">Start typing (or tap Speak) and tips appear here as you write. The AI judges your content after you send.</p>';
    }
    const c = checkAnswer(text);
    const icon = { ok: "✓", warn: "!", info: "i" };
    return head + `<ul class="vi-chk">${c.items.map((i) => `<li class="${i.k}"><span>${icon[i.k]}</span>${esc(i.t)}</li>`).join("")}</ul>`;
  }

  function sparkHtml(vals) {
    if (!vals.length) return "";
    const w = 240;
    const h = 56;
    const p = 6;
    const pts = vals.map((v, i) => [vals.length === 1 ? w / 2 : p + (i * (w - 2 * p)) / (vals.length - 1), h - p - ((Math.max(1, Math.min(5, v)) - 1) / 4) * (h - 2 * p)]);
    const last = pts[pts.length - 1];
    return `<svg class="vi-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Your recent scores">
      ${pts.length > 1 ? `<polyline fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${pts.map((q) => q.join(",")).join(" ")}"/>` : ""}
      <circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="currentColor"/></svg>`;
  }

  function progressHtml() {
    const h = readHistory();
    if (!h.length) {
      return `<div class="vi-card vi-sidecard"><h3>Your progress</h3><p class="vi-muted">Your scores appear here after your first practice. Only scores are kept on this device, never your answers.</p></div>`;
    }
    const best = Math.max.apply(null, h.map((x) => x.avg));
    const last = h[h.length - 1];
    return `<div class="vi-card vi-sidecard"><h3>Your progress</h3>
      <div class="vi-stats"><div><b>${h.length}</b>sessions</div><div><b>${best}</b>best</div><div><b>${last.avg}</b>last</div></div>
      ${sparkHtml(h.slice(-10).map((x) => x.avg))}
      <p class="vi-muted">Average answer score, last ${Math.min(10, h.length)} sessions. Kept on this device only.</p></div>`;
  }

  function coachHtml() {
    const cur = Math.min(s.asked, s.total);
    let dots = "";
    for (let q = 1; q <= s.total; q++) {
      const fb = s.feedback[(q - 1) * 2 + 1];
      const cls = fb ? scoreClass(fb.score) : !s.done && q === cur ? "cur" : "";
      const locked = q > s.asked && !s.done;
      dots += `<button type="button" class="vi-dot ${cls}" data-vi-jump="vi-q-${q}" ${locked ? "disabled" : ""} aria-label="Question ${q}${fb ? ", scored " + fb.score : ""}">${fb ? fb.score : q}</button>`;
    }

    const have = answeredIdx().length;
    return `<div class="vi-card vi-sidecard"><h3>Question map</h3><div class="vi-dots">${dots}</div>
        ${have ? `<h3 style="margin-top:16px">Averages so far</h3>${barsHtml(dimAverages())}` : ""}
      </div>
      <div class="vi-card vi-sidecard"><h3>Answer shape</h3>
        <ul><li><b>Answer</b> the question directly first.</li><li>Give <b>one reason</b>.</li><li>Add <b>one real detail</b>: a name, a number, an example.</li><li>Aim for 20–60 seconds spoken.</li></ul>
        <p class="vi-muted" style="margin-top:8px">Be truthful and consistent with your documents.</p></div>`;
  }

  function trackerSuggestion() {
    try {
      const list = window.UniAITracker && typeof window.UniAITracker.list === "function" ? window.UniAITracker.list() : [];
      const a = (list || []).find((x) => x && x.name);
      return a ? [a.program, a.name].filter(Boolean).join(" at ").slice(0, 200) : "";
    } catch (err) {
      return "";
    }
  }

  /* ------------------------------------------------------------------ *
   * Setup screen
   * ------------------------------------------------------------------ */

  function setupHtml() {
    const p = s.profile;
    const sug = !p.course ? trackerSuggestion() : "";

    return `<div class="vi-layout">
      <div class="vi-main">
        <div class="vi-hero">
          <h2>Walk in ready.</h2>
          <p>Practise a realistic student-visa interview. Every answer is scored, and you see exactly what to fix before the real thing.</p>
          <div class="vi-pills"><span>Scored 1–5 per answer</span><span>Follow-up questions</span><span>Type or speak</span><span>Instant answer checker</span></div>
        </div>

        <div class="vi-card">
          <div class="vi-step"><span class="vi-eyebrow">1 · Destination</span>
            <div class="vi-countries">${COUNTRIES.map(([c, n, f]) => `<button type="button" class="vi-country${c === s.country ? " is-on" : ""}" data-vi-country="${c}" aria-pressed="${c === s.country}"><span aria-hidden="true">${f}</span>${esc(n)}</button>`).join("")}</div></div>

          <div class="vi-step"><span class="vi-eyebrow">2 · Interviewer</span>
            <div class="vi-seg" role="group" aria-label="Interviewer style">${STYLES.map(([id, n, hint]) => `<button type="button" class="vi-segb${id === s.style ? " is-on" : ""}" data-vi-style="${id}" aria-pressed="${id === s.style}"><b>${n}</b><small>${hint}</small></button>`).join("")}</div></div>

          <div class="vi-step"><span class="vi-eyebrow">3 · Length</span>
            <div class="vi-seg" role="group" aria-label="Interview length">${LENGTHS.map(([n, name, hint]) => `<button type="button" class="vi-segb${n === s.total ? " is-on" : ""}" data-vi-len="${n}" aria-pressed="${n === s.total}"><b>${name}</b><small>${hint}</small></button>`).join("")}</div></div>

          <div class="vi-step"><span class="vi-eyebrow">4 · Options</span>
            <div class="vi-opts">
              <label><input type="checkbox" id="vi-timed" ${s.timed ? "checked" : ""}> Timed answers (${TIME_LIMIT}s each)</label>
              ${SYNTH ? `<label><input type="checkbox" id="vi-speak" ${s.speak ? "checked" : ""}> Read questions aloud</label>` : ""}
            </div></div>

          <div class="vi-step"><span class="vi-eyebrow">5 · Make it about you (optional)</span>
            <details class="vi-prof" ${profOpen ? "open" : ""}><summary>Add your details for tailored questions</summary>
              <div class="vi-fields">
                <label>Course and university<input class="vi-in" data-vi-prof="course" maxlength="200" value="${esc(p.course)}" placeholder="e.g. MS in Data Science at …"></label>
                ${sug ? `<button type="button" class="vi-link" data-vi="fill">Use my tracked application: ${esc(sug)}</button>` : ""}
                <label>How you will pay<input class="vi-in" data-vi-prof="funding" maxlength="200" value="${esc(p.funding)}" placeholder="e.g. education loan plus family savings"></label>
                <label>Plans after graduation<input class="vi-in" data-vi-prof="plans" maxlength="200" value="${esc(p.plans)}" placeholder="e.g. work in analytics, then return home"></label>
                <label>Anything an officer might ask about<input class="vi-in" data-vi-prof="notes" maxlength="200" value="${esc(p.notes)}" placeholder="e.g. a gap year, a backlog, work history"></label>
                <p class="vi-muted">Saved on this device only. It is sent with your answers so questions and sample answers match your real situation.</p>
              </div></details></div>

          <div class="vi-step">
            <button type="button" class="vi-btn lg" data-vi="start" ${s.busy ? "disabled" : ""}>${s.busy ? "Starting…" : "Start interview"}</button>
            ${s.error ? `<p class="vi-err" role="alert">${esc(s.error)}</p>` : ""}
            <p class="vi-muted" style="margin-top:12px">Sign-in required. Practice only: questions are based on common themes, not an official list, and real interviews differ.</p>
          </div>
        </div>
      </div>

      <aside class="vi-side">
        ${progressHtml()}
        <div class="vi-card vi-sidecard"><h3>What officers listen for</h3>
          <ul><li>Short, specific answers beat long speeches.</li><li>Everything matches your documents.</li><li>Truthful beats rehearsed: do not memorise a script.</li><li>You know your course, funding and plan.</li></ul></div>
      </aside>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Interview room + summary
   * ------------------------------------------------------------------ */

  function composerHtml() {
    return `<div class="vi-composer">
      <textarea class="vi-in" id="vi-answer" maxlength="${MAX_ANSWER}" placeholder="Answer as you would in the interview…" aria-label="Your answer"></textarea>
      <div class="vi-live" id="vi-live" aria-live="polite">${liveHtml("")}</div>
      <div class="vi-foot">
        <span class="vi-tools">
          ${SR ? '<button type="button" class="vi-btn ghost sm" data-vi="mic" id="vi-mic" aria-pressed="false">🎤 Speak</button>' : ""}
          <span class="vi-timer${s.timed ? " timed" : ""}" id="vi-timer" title="${s.timed ? "Time left" : "Time on this question"}">0:00</span>
          <span class="vi-count" id="vi-count">0 / ${MAX_ANSWER} · Ctrl+Enter to send</span>
        </span>
        <span class="vi-btns"><button type="button" class="vi-btn ghost" data-vi="quit">End practice</button><button type="button" class="vi-btn" data-vi="send">Send answer</button></span>
      </div>
      <p class="vi-muted" id="vi-mic-msg"></p>
      <p class="vi-err" id="vi-err" role="alert" hidden></p>
    </div>`;
  }

  function summaryHtml(m) {
    const ks = answeredIdx();
    const avg = ks.length ? avgScore() : m.overall;
    const weakest = ks.length ? ks.reduce((a, b) => (s.feedback[b].score < s.feedback[a].score ? b : a)) : -1;
    const block = (title, items) => `<div><h4>${title}</h4><ul>${listHtml(items) || "<li>—</li>"}</ul></div>`;
    const delta =
      s.delta == null
        ? ""
        : `<div class="vi-delta ${s.delta >= 0 ? "up" : "down"}">${s.delta === 0 ? "Same as your last session" : (s.delta > 0 ? "▲ +" : "▼ ") + s.delta + " vs your last session"}</div>`;

    return `<div class="vi-card">
      <div class="vi-sumtop">
        ${ringHtml(avg, "lg")}
        <div><span class="vi-eyebrow">Practice summary · ${esc(countryOf()[1])} · ${esc(styleOf())}</span>
          <h2>${readiness(avg)}</h2>
          <p class="vi-muted">${esc(m.headline || "Average of your answer scores.")}</p>${delta}</div>
      </div>
      <div class="vi-strip">${ks.map((i) => `<button type="button" class="vi-chip ${scoreClass(s.feedback[i].score)}" data-vi-jump="vi-q-${(i + 1) / 2}" aria-label="Question ${(i + 1) / 2}, scored ${s.feedback[i].score}">Q${(i + 1) / 2} · ${s.feedback[i].score}</button>`).join("")}
        ${weakest >= 0 && s.feedback[weakest].score < 5 ? `<button type="button" class="vi-link" data-vi-jump="vi-q-${(weakest + 1) / 2}">Review weakest answer (Q${(weakest + 1) / 2}) →</button>` : ""}</div>
      ${barsHtml(dimAverages())}
      <div class="vi-sum">${block("Strengths", m.strengths)}${block("Practise next", m.focus)}${block("Tips", m.tips)}${block("Drills for this week", m.drills || [])}</div>
      <p class="vi-muted" style="margin-top:14px">The score is the average of your answer scores. It is a practice guide, not a prediction of any real decision. Check your destination's official requirements before your interview.</p>
      <div class="vi-actions">
        <button type="button" class="vi-btn" data-vi="again">Practise again</button>
        <button type="button" class="vi-btn ghost" data-vi="copy">Copy report</button>
        <button type="button" class="vi-btn ghost" data-vi="download">Download report</button>
      </div>
    </div>`;
  }

  function roomHtml() {
    const last = s.turns[s.turns.length - 1];
    const waiting = !s.done && !s.busy && last && last.role === "officer";
    const pct = Math.round(((s.done ? s.total : Math.max(0, s.asked - 1)) / s.total) * 100);

    return `<div class="vi-layout">
      <div class="vi-main">
        ${s.summary ? summaryHtml(s.summary) : ""}
        ${s.done ? '<h3 class="vi-sec">Your answers, question by question</h3>' : ""}
        <div class="vi-card">
          <div class="vi-prog"><span>${s.done ? "Interview complete" : `Question ${Math.min(s.asked, s.total)} of ${s.total}`}</span><span>${esc(countryOf()[2] + " " + countryOf()[1])} · ${esc(styleOf())}</span></div>
          <div class="vi-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
          <div id="vi-thread" aria-live="polite">${threadHtml()}</div>
          ${s.busy ? '<div class="vi-typing" aria-label="The officer is reviewing your answer"><i></i><i></i><i></i></div>' : ""}
          ${waiting ? composerHtml() : ""}
          ${s.error ? `<p class="vi-err" role="alert">${esc(s.error)}</p>` : ""}
        </div>
      </div>
      <aside class="vi-side">${coachHtml()}${s.done ? progressHtml() : ""}</aside>
    </div>`;
  }

  function render() {
    const root = $("vi-root");
    if (!root) return;

    stopTimer();

    if (!s.running) {
      stopListening();
      root.innerHTML = setupHtml();
      return;
    }

    root.innerHTML = roomHtml();

    const last = s.turns[s.turns.length - 1];
    const waiting = !s.done && !s.busy && last && last.role === "officer";
    if (waiting) {
      const box = $("vi-answer");
      if (box) box.focus({ preventScroll: true });
      startTimer();
    } else {
      stopListening();
    }
  }

  /* ------------------------------------------------------------------ *
   * Report
   * ------------------------------------------------------------------ */

  function reportText() {
    const L = [];
    const ks = answeredIdx();
    const m = s.summary || {};
    L.push("UniAI mock visa interview: practice report");
    L.push(`${countryOf()[1]} · ${styleOf()} interviewer · ${new Date().toLocaleDateString()}`);
    L.push(`Average answer score: ${avgScore()} / 5 (${readiness(avgScore())})`);
    if (m.headline) L.push(m.headline);
    L.push("");
    const d = dimAverages();
    DIMS.forEach(([k, label]) => L.push(`${label}: ${d[k] || "-"} / 5`));

    ks.forEach((i) => {
      const f = s.feedback[i];
      L.push("", `Q${(i + 1) / 2}: ${s.turns[i - 1].text}`, `Your answer: ${s.turns[i].text}`, `Score: ${f.score} / 5`);
      (f.red_flags || []).forEach((x) => L.push(`  Watch out: ${x}`));
      (f.improve || []).forEach((x) => L.push(`  Improve: ${x}`));
    });

    const sect = (title, items) => items && items.length && L.push("", title + ":", ...items.map((x) => "  - " + x));
    sect("Strengths", m.strengths);
    sect("Practise next", m.focus);
    sect("Tips", m.tips);
    sect("Drills for this week", m.drills);
    L.push("", "Practice only. Not a prediction of any real decision.");
    return L.join("\n");
  }

  async function copyReport(btn) {
    const old = btn.textContent;
    try {
      await navigator.clipboard.writeText(reportText());
      btn.textContent = "Copied ✓";
    } catch (err) {
      btn.textContent = "Couldn't copy. Try Download";
    }
    setTimeout(() => {
      btn.textContent = old;
    }, 1800);
  }

  function downloadReport() {
    const blob = new Blob([reportText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uniai-mock-interview-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */

  function reset() {
    stopListening();
    speechCancel();
    s = fresh();
    render();
  }

  async function start() {
    if (s.busy) return;
    stopListening();
    speechCancel();
    s = Object.assign(fresh(), { busy: true });
    render();

    try {
      const data = await call([]);
      s.running = true;
      s.total = data.total || s.total;
      s.asked = data.asked || 1;
      s.turns = [{ role: "officer", text: data.question }];
      s.kinds[0] = "new";
      s.qStart = Date.now();
      speak(data.question);
    } catch (err) {
      s.running = false;
      s.error = err instanceof SignIn ? err.message : err.message || "Couldn't start. Please try again.";
      if (err instanceof SignIn) askSignIn();
    }

    s.busy = false;
    render();
  }

  function finish(data) {
    s.done = true;
    s.summary = data.summary;
    s.asked = s.total;
    stopTimer();
    pushHistory({ t: Date.now(), country: s.country, style: s.style, total: s.total, avg: avgScore(), dims: dimAverages() });
  }

  async function submit() {
    if (s.busy) return;
    const box = $("vi-answer");
    const answer = box ? box.value.trim() : "";

    if (answer.length < MIN_ANSWER) {
      const e = $("vi-err");
      if (e) {
        e.textContent = "Write a little more so there is something to give feedback on.";
        e.hidden = false;
      }
      return;
    }

    stopListening();
    speechCancel();

    const qIndex = s.turns.length - 1;
    s.error = "";
    s.busy = true;
    s.times[qIndex + 1] = Math.round((Date.now() - s.qStart) / 1000);
    s.turns.push({ role: "student", text: answer.slice(0, MAX_ANSWER) });
    render();

    const history = s.turns.map((t) => ({ role: t.role, text: t.text }));

    try {
      const data = await call(history);
      const idx = s.turns.length - 1;
      if (data.feedback) s.feedback[idx] = data.feedback;

      if (data.done) {
        finish(data);
      } else {
        s.turns.push({ role: "officer", text: data.question });
        s.kinds[s.turns.length - 1] = data.kind === "followup" ? "followup" : "new";
        s.asked = data.asked || s.asked + 1;
        s.qStart = Date.now();
        speak(data.question);
      }
    } catch (err) {
      // Take the unsent answer back so it can be edited and sent again.
      const back = s.turns.pop();
      delete s.times[qIndex + 1];
      s.error = err instanceof SignIn ? err.message : err.message || "Couldn't read your answer. Please try again.";
      if (err instanceof SignIn) askSignIn();
      s.busy = false;
      render();
      const b = $("vi-answer");
      if (b && back) {
        b.value = back.text;
        b.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }

    s.busy = false;
    render();

    const target = s.done ? $("vi-root") : $("vi-thread") && $("vi-thread").lastElementChild;
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: s.done ? "start" : "nearest" });
  }

  function setPref(key, value) {
    s[key] = value;
    savePrefs();
    render();
  }

  function onClick(e) {
    const t = e.target;

    const c = t.closest("[data-vi-country]");
    if (c) return setPref("country", c.dataset.viCountry);
    const st = t.closest("[data-vi-style]");
    if (st) return setPref("style", st.dataset.viStyle);
    const len = t.closest("[data-vi-len]");
    if (len) return setPref("total", Number(len.dataset.viLen));

    const jump = t.closest("[data-vi-jump]");
    if (jump) {
      const el = $(jump.dataset.viJump);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const say = t.closest("[data-vi-say]");
    if (say) {
      const turn = s.turns[Number(say.dataset.viSay)];
      if (turn) speak(turn.text, true);
      return;
    }

    const b = t.closest("[data-vi]");
    if (!b) return;

    switch (b.dataset.vi) {
      case "start":
        start();
        break;
      case "send":
        submit();
        break;
      case "mic":
        toggleListening();
        break;
      case "fill": {
        s.profile.course = trackerSuggestion();
        saveStore({ profile: s.profile });
        profOpen = true;
        render();
        break;
      }
      case "copy":
        copyReport(b);
        break;
      case "download":
        downloadReport();
        break;
      case "again":
      case "quit":
        reset();
        break;
    }
  }

  function onChange(e) {
    if (e.target.id === "vi-timed") {
      s.timed = e.target.checked;
      savePrefs();
    } else if (e.target.id === "vi-speak") {
      s.speak = e.target.checked;
      if (!s.speak) speechCancel();
      savePrefs();
    }
  }

  function onInput(e) {
    const f = e.target.dataset && e.target.dataset.viProf;
    if (f) {
      s.profile[f] = e.target.value.slice(0, 200);
      saveStore({ profile: s.profile });
      return;
    }

    if (e.target.id !== "vi-answer") return;

    const c = $("vi-count");
    if (c) c.textContent = `${e.target.value.length} / ${MAX_ANSWER} · Ctrl+Enter to send`;
    const live = $("vi-live");
    if (live) live.innerHTML = liveHtml(e.target.value);
    const err = $("vi-err");
    if (err) err.hidden = true;
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function open() {
    return typeof window.showPage === "function" ? window.showPage("visaInterview") : false;
  }

  window.UniAIInterview = { open, check: checkAnswer };

  function boot() {
    if (build()) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (build() || ++tries > 20) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
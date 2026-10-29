/* ==========================================================================
   UniAI — Mock Visa Interview (interview.js)

   Add AFTER script.js:
     <script src="JS/interview.js"></script>

   Needs the backend route POST /ai/interview (routes/interviewRoutes.js).
   Needs NO changes to index.html: it injects a "Visa Interview" sidebar
   button (after Visa Guide) and the #visaInterviewPage section.

   How it works
   - Pick a destination, answer 6 questions one at a time.
   - After each answer you get a score out of 5, what worked, what to improve
     and a sample answer built only from the facts you gave.
   - A summary at the end lists strengths, what to practise and tips.
   - Signed-in users only. Answers are kept in memory for this page view and
     are NOT saved anywhere; they are sent to the server to generate feedback.

   This is practice, not a prediction. Real interviews differ.
   ========================================================================== */

(function () {
  "use strict";

  if (window.UniAIInterview) return;

  const MAX_ANSWER = 1500;
  const MIN_ANSWER = 8;

  const COUNTRIES = [
    ["US", "United States"],
    ["UK", "United Kingdom"],
    ["CA", "Canada"],
    ["AU", "Australia"],
    ["DE", "Germany"],
    ["IE", "Ireland"],
    ["FR", "France"],
    ["NL", "Netherlands"],
    ["SG", "Singapore"],
    ["JP", "Japan"],
    ["NZ", "New Zealand"]
  ];

  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ------------------------------------------------------------------ *
   * State (memory only)
   * ------------------------------------------------------------------ */

  let s = fresh();

  function fresh() {
    return { running: false, country: "US", turns: [], feedback: {}, summary: null, asked: 0, total: 6, busy: false, error: "" };
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
      body: JSON.stringify({ country: s.country, history })
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
   * Styles
   * ------------------------------------------------------------------ */

  function injectStyle() {
    if ($("vi-style")) return;
    const style = document.createElement("style");
    style.id = "vi-style";
    style.textContent = `
      .vi-card { background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 22px; padding: 22px; margin-top: 18px; min-width: 0; }
      .vi-card h2 { margin: 0 0 6px; font-size: 1.2rem; }
      .vi-muted { color: var(--text-muted, #94a3b8); font-size: .86rem; line-height: 1.5; }
      .vi-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-top: 16px; }
      .vi-row label { display: grid; gap: 6px; font-size: .75rem; font-weight: 700; color: var(--text-muted, #64748b); }
      .vi-in {
        font: inherit; font-size: .95rem; color: var(--text, inherit); background: var(--surface-2, transparent);
        border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 11px 14px; box-sizing: border-box; color-scheme: inherit;
      }
      .vi-in:focus { outline: 2px solid rgba(109,93,251,.45); outline-offset: 1px; }
      textarea.vi-in { width: 100%; min-height: 110px; resize: vertical; line-height: 1.5; }
      .vi-btn {
        border: 0; cursor: pointer; background: var(--primary, #6d5dfb); color: #fff; font: inherit; font-weight: 700; font-size: .9rem;
        padding: 12px 20px; border-radius: 14px;
      }
      .vi-btn:hover:not(:disabled) { filter: brightness(1.08); }
      .vi-btn:disabled { opacity: .55; cursor: default; }
      .vi-btn.ghost { background: transparent; color: inherit; border: 1px solid var(--border, #e2e8f0); }
      .vi-btn:focus-visible { outline: 2px solid var(--primary, #6d5dfb); outline-offset: 2px; }

      .vi-prog { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: .8rem; font-weight: 700; color: var(--text-muted, #64748b); }
      .vi-bar { height: 6px; border-radius: 6px; background: rgba(148,163,184,.22); overflow: hidden; margin: 8px 0 16px; }
      .vi-bar i { display: block; height: 100%; background: var(--primary, #6d5dfb); border-radius: 6px; transition: width .3s; }

      .vi-msg { max-width: 92%; padding: 12px 16px; border-radius: 16px; line-height: 1.55; font-size: .94rem; margin: 10px 0; overflow-wrap: anywhere; white-space: pre-wrap; }
      .vi-msg.o { background: rgba(109,93,251,.10); border: 1px solid rgba(109,93,251,.2); border-top-left-radius: 4px; }
      .vi-msg.s { background: var(--surface-2, rgba(148,163,184,.12)); border: 1px solid var(--border, #e2e8f0); margin-left: auto; border-top-right-radius: 4px; }
      .vi-who { display: block; font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #94a3b8); margin-bottom: 4px; }

      .vi-fb { border: 1px solid var(--border, #e2e8f0); border-radius: 16px; padding: 14px 16px; margin: 6px 0 14px; font-size: .88rem; line-height: 1.5; }
      .vi-score { display: inline-block; font-weight: 800; padding: 3px 10px; border-radius: 999px; font-size: .78rem; }
      .vi-score.hi { background: rgba(16,185,129,.16); color: #047857; }
      .vi-score.mid { background: rgba(245,158,11,.18); color: #b45309; }
      .vi-score.lo { background: rgba(239,68,68,.15); color: #dc2626; }
      html[data-theme="dark"] .vi-score.hi { color: #34d399; } html[data-theme="dark"] .vi-score.mid { color: #fbbf24; } html[data-theme="dark"] .vi-score.lo { color: #f87171; }
      .vi-fb h4 { margin: 12px 0 4px; font-size: .72rem; letter-spacing: .07em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .vi-fb ul { margin: 0; padding-left: 18px; }
      .vi-fb details summary { cursor: pointer; font-weight: 600; color: var(--primary, #6d5dfb); margin-top: 12px; }
      .vi-fb details p { margin: 8px 0 0; white-space: pre-wrap; }

      .vi-composer { margin-top: 14px; display: grid; gap: 10px; }
      .vi-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .vi-count { font-size: .76rem; color: var(--text-muted, #94a3b8); }
      .vi-err { color: #dc2626; font-size: .86rem; margin: 10px 0 0; }
      html[data-theme="dark"] .vi-err { color: #f87171; }
      .vi-sum { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 14px; }
      .vi-sum > div { border: 1px solid var(--border, #e2e8f0); border-radius: 16px; padding: 14px 16px; }
      .vi-sum h4 { margin: 0 0 6px; font-size: .72rem; letter-spacing: .07em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .vi-sum ul { margin: 0; padding-left: 18px; font-size: .88rem; line-height: 1.5; }
      .vi-big { font-size: 2rem; font-weight: 800; }
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
          <p>Answer realistic questions and get feedback on each answer.</p>
        </div>
      </div>
      <div id="vi-root"></div>
    `;

    anchor.parentElement.insertBefore(page, anchor.nextSibling);
    buildNav();

    page.addEventListener("click", onClick);
    page.addEventListener("input", onInput);
    page.addEventListener("keydown", (e) => {
      if (e.target.id === "vi-answer" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit();
      }
    });
    page.addEventListener("change", (e) => {
      if (e.target.id === "vi-country") s.country = e.target.value;
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
   * Render
   * ------------------------------------------------------------------ */

  function feedbackHtml(f) {
    const cls = f.score >= 4 ? "hi" : f.score >= 3 ? "mid" : "lo";
    const list = (title, items) => (items.length ? `<h4>${title}</h4><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");

    return `<div class="vi-fb">
      <span class="vi-score ${cls}">${f.score} / 5</span>
      ${list("What worked", f.strengths)}
      ${list("To improve", f.improve)}
      ${f.sample ? `<details><summary>See a stronger version of your answer</summary><p>${esc(f.sample)}</p><p class="vi-muted">Built from what you wrote. Replace anything in [brackets] with your real details, and only say what is true.</p></details>` : ""}
    </div>`;
  }

  function summaryHtml(m) {
    const cls = m.overall >= 4 ? "hi" : m.overall >= 3 ? "mid" : "lo";
    const list = (title, items) => `<div><h4>${title}</h4><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("") || "<li>—</li>"}</ul></div>`;

    return `<div class="vi-card">
      <h2>Your practice summary</h2>
      <p><span class="vi-score ${cls} vi-big">${m.overall} / 5</span></p>
      <div class="vi-sum">${list("Strengths", m.strengths)}${list("Practise next", m.focus)}${list("Tips", m.tips)}</div>
      <p class="vi-muted" style="margin-top:14px">This score is a practice guide, not a prediction of any real decision. Check your destination's official requirements before your interview.</p>
      <div class="vi-row"><button type="button" class="vi-btn" data-vi="again">Practise again</button></div>
    </div>`;
  }

  function render() {
    const root = $("vi-root");
    if (!root) return;

    if (!s.running) {
      root.innerHTML = `
        <div class="vi-card">
          <h2>Start a practice interview</h2>
          <p class="vi-muted">You'll get 6 questions on common themes for your destination, such as your course, funding and plans. Answer as you would for real: clear, specific and truthful. Your answers are sent to the server to write feedback and are not saved.</p>
          <div class="vi-row">
            <label>Destination
              <select class="vi-in" id="vi-country">${COUNTRIES.map(([c, n]) => `<option value="${c}" ${c === s.country ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
            </label>
            <button type="button" class="vi-btn" data-vi="start" ${s.busy ? "disabled" : ""}>${s.busy ? "Starting…" : "Start interview"}</button>
          </div>
          ${s.error ? `<p class="vi-err" role="alert">${esc(s.error)}</p>` : ""}
          <p class="vi-muted" style="margin-top:14px">Practice only. Questions are based on common themes, not an official list, and real interviews differ.</p>
        </div>`;
      return;
    }

    const pct = Math.round(((s.done ? s.total : Math.max(0, s.asked - 1)) / s.total) * 100);
    let thread = "";

    s.turns.forEach((t, i) => {
      if (t.role === "officer") {
        thread += `<div class="vi-msg o"><span class="vi-who">Officer · Question ${i / 2 + 1}</span>${esc(t.text)}</div>`;
      } else {
        thread += `<div class="vi-msg s"><span class="vi-who">You</span>${esc(t.text)}</div>`;
        if (s.feedback[i]) thread += feedbackHtml(s.feedback[i]);
      }
    });

    const last = s.turns[s.turns.length - 1];
    const waitingForAnswer = !s.done && last && last.role === "officer";

    root.innerHTML = `
      <div class="vi-card">
        <div class="vi-prog"><span>${s.done ? "Interview complete" : `Question ${Math.min(s.asked, s.total)} of ${s.total}`}</span><span>${esc((COUNTRIES.find((c) => c[0] === s.country) || ["", ""])[1])}</span></div>
        <div class="vi-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <div id="vi-thread" aria-live="polite">${thread}</div>

        ${
          waitingForAnswer
            ? `<div class="vi-composer">
                <textarea class="vi-in" id="vi-answer" maxlength="${MAX_ANSWER}" placeholder="Type your answer…" aria-label="Your answer" ${s.busy ? "disabled" : ""}></textarea>
                <div class="vi-foot">
                  <span class="vi-count" id="vi-count">0 / ${MAX_ANSWER} · Ctrl+Enter to send</span>
                  <span><button type="button" class="vi-btn ghost" data-vi="quit">End practice</button>
                  <button type="button" class="vi-btn" data-vi="send" ${s.busy ? "disabled" : ""}>${s.busy ? "Reading your answer…" : "Send answer"}</button></span>
                </div>
              </div>`
            : s.busy
              ? `<p class="vi-muted">Thinking…</p>`
              : ""
        }
        ${s.error ? `<p class="vi-err" role="alert">${esc(s.error)}</p>` : ""}
      </div>
      ${s.summary ? summaryHtml(s.summary) : ""}
    `;

    const box = $("vi-answer");
    if (box && !s.busy) box.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */

  async function start() {
    if (s.busy) return;
    const country = s.country;
    s = Object.assign(fresh(), { country, busy: true });
    render();

    try {
      const data = await call([]);
      s.running = true;
      s.total = data.total || 6;
      s.asked = data.asked || 1;
      s.turns = [{ role: "officer", text: data.question }];
    } catch (err) {
      s.running = false;
      s.error = err instanceof SignIn ? err.message : err.message || "Couldn't start. Please try again.";
      if (err instanceof SignIn) askSignIn();
    }

    s.busy = false;
    render();
  }

  async function submit() {
    if (s.busy) return;
    const box = $("vi-answer");
    const answer = box ? box.value.trim() : "";

    if (answer.length < MIN_ANSWER) {
      s.error = "Write a little more so there is something to give feedback on.";
      render();
      const b = $("vi-answer");
      if (b) b.value = answer;
      return;
    }

    s.error = "";
    s.busy = true;
    s.turns.push({ role: "student", text: answer.slice(0, MAX_ANSWER) });
    render();

    const history = s.turns.map((t) => ({ role: t.role, text: t.text }));

    try {
      const data = await call(history);
      const idx = s.turns.length - 1;
      if (data.feedback) s.feedback[idx] = data.feedback;

      if (data.done) {
        s.done = true;
        s.summary = data.summary;
        s.asked = s.total;
      } else {
        s.turns.push({ role: "officer", text: data.question });
        s.asked = data.asked || s.asked + 1;
      }
    } catch (err) {
      // Take the unsent answer back so it can be edited and sent again.
      const back = s.turns.pop();
      s.error = err instanceof SignIn ? err.message : err.message || "Couldn't read your answer. Please try again.";
      if (err instanceof SignIn) askSignIn();
      s.busy = false;
      render();
      const b = $("vi-answer");
      if (b && back) b.value = back.text;
      return;
    }

    s.busy = false;
    render();
    const thread = $("vi-thread");
    if (thread && thread.lastElementChild) thread.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function onClick(e) {
    const b = e.target.closest("[data-vi]");
    if (!b) return;

    switch (b.dataset.vi) {
      case "start":
        start();
        break;
      case "send":
        submit();
        break;
      case "again":
      case "quit": {
        const country = s.country;
        s = Object.assign(fresh(), { country });
        render();
        break;
      }
    }
  }

  function onInput(e) {
    if (e.target.id !== "vi-answer") return;
    const c = $("vi-count");
    if (c) c.textContent = `${e.target.value.length} / ${MAX_ANSWER} · Ctrl+Enter to send`;
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function open() {
    return typeof window.showPage === "function" ? window.showPage("visaInterview") : false;
  }

  window.UniAIInterview = { open };

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
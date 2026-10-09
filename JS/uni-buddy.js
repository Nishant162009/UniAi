/* ==========================================================================
   UniAI — Uni Buddy website helper  (uni-buddy.js)
   A small guide that lives in the corner: it answers "where do I find…?"
   questions and opens the right page. It never pretends to be the AI chat.

   Load AFTER preferences.js (which provides the mascot artwork):
     <script src="JS/preferences.js"></script>
     <script src="JS/uni-buddy.js"></script>
   ========================================================================== */
(function () {
  "use strict";

  if (window.UniAIBuddy) return;

  const headSvg = () => window.UniAIBuddyHeadSVG || ""; // a fresh copy (unique ids) on every call

  const STYLE = `
.uni-buddy-launcher{position:fixed;right:22px;bottom:22px;z-index:99990;display:flex;align-items:center;gap:10px;padding:6px 14px 6px 6px;border:1px solid rgba(139,92,246,.4);border-radius:999px;background:rgba(19,20,31,.94);color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.28),0 0 28px rgba(124,77,242,.2);backdrop-filter:blur(14px);cursor:pointer;font:700 13px/1 var(--font-body,system-ui,sans-serif);transition:transform .2s,box-shadow .2s,border-color .2s}
.uni-buddy-launcher[hidden]{display:none}
.uni-buddy-launcher:hover{transform:translateY(-3px);border-color:rgba(167,139,250,.8);box-shadow:0 18px 48px rgba(0,0,0,.34),0 0 34px rgba(124,77,242,.3)}
.uni-buddy-launcher:active{transform:translateY(-1px) scale(.98)}
.uni-buddy-launcher :focus-visible,.uni-buddy-launcher:focus-visible,.uni-buddy-panel :focus-visible{outline:2px solid #ec4899;outline-offset:3px}
.uni-buddy-mini,.uni-buddy-head-avatar{display:grid;place-items:center;overflow:hidden;flex:none;background:radial-gradient(circle at 50% 40%,#efe9ff,#a78bfa 80%)}
.uni-buddy-mini{width:48px;height:48px;border-radius:50%}
.uni-buddy-mini svg{width:66px;height:auto;display:block}
.uni-buddy-dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 9px rgba(52,211,153,.8)}
.uni-buddy-launcher .ub-eyes,.uni-buddy-head-avatar .ub-eyes{transform-box:fill-box;transform-origin:center;animation:ubBlink 5.5s infinite}
@keyframes ubBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
body:has(.uni-buddy-launcher:not([hidden])) .top-scroll-btn{bottom:92px}

.uni-buddy-panel{position:fixed;right:22px;bottom:88px;z-index:99991;width:min(390px,calc(100vw - 28px));height:min(600px,calc(100dvh - 120px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(139,92,246,.3);border-radius:22px;background:var(--card-bg,#17191f);color:var(--text,#f5f7fa);box-shadow:0 26px 80px rgba(0,0,0,.42),0 0 38px rgba(124,77,242,.14);transform-origin:bottom right;animation:ubIn .22s ease both}
.uni-buddy-panel[hidden]{display:none}
@keyframes ubIn{from{opacity:0;transform:translateY(10px) scale(.97)}}
.uni-buddy-head{display:flex;align-items:center;gap:11px;padding:13px 14px;border-bottom:1px solid var(--border,#282c34);background:linear-gradient(135deg,rgba(124,77,242,.18),rgba(236,72,153,.06))}
.uni-buddy-head-avatar{width:42px;height:42px;border-radius:13px}
.uni-buddy-head-avatar svg{width:58px;height:auto;display:block}
.uni-buddy-head-copy{min-width:0;flex:1}
.uni-buddy-head-copy strong{display:block;font:800 14px/1.2 var(--font-display,system-ui,sans-serif)}
.uni-buddy-head-copy small{display:flex;align-items:center;gap:6px;margin-top:3px;color:var(--text-muted,#9da3ae);font-size:11px}
.uni-buddy-head-copy small i{width:6px;height:6px;border-radius:50%;background:#34d399}
.uni-buddy-close{width:36px;height:36px;border:1px solid var(--border,#282c34);border-radius:10px;background:transparent;color:var(--text-muted,#9da3ae);font-size:20px;cursor:pointer}
.uni-buddy-close:hover{color:var(--text,#fff);border-color:#8b5cf6}
.uni-buddy-thread{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:9px;scroll-behavior:smooth;overscroll-behavior:contain}
.uni-buddy-msg{max-width:88%;padding:10px 13px;border-radius:15px;font:14px/1.5 var(--font-body,system-ui,sans-serif);overflow-wrap:anywhere;animation:ubMsg .25s both}
@keyframes ubMsg{from{opacity:0;transform:translateY(6px)}}
.uni-buddy-msg.buddy{background:var(--surface-3,#1d2027);border:1px solid var(--border,#282c34);border-top-left-radius:5px}
.uni-buddy-msg.you{align-self:flex-end;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border-top-right-radius:5px}
.uni-buddy-typing{display:flex;gap:4px;padding:4px 2px}
.uni-buddy-typing i{width:6px;height:6px;border-radius:50%;background:var(--text-subtle,#737a87);animation:ubDot 1.1s ease-in-out infinite}
.uni-buddy-typing i:nth-child(2){animation-delay:.15s}.uni-buddy-typing i:nth-child(3){animation-delay:.3s}
@keyframes ubDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}
.uni-buddy-actions{display:flex;flex-wrap:wrap;gap:7px;padding:2px 16px 12px}
.uni-buddy-chip{min-height:34px;border:1px solid var(--border,#282c34);border-radius:999px;background:var(--surface-2,#17191f);color:var(--text,#f5f7fa);padding:0 13px;font:700 12px/1 var(--font-body,system-ui,sans-serif);cursor:pointer;transition:border-color .15s,color .15s,transform .15s}
.uni-buddy-chip:hover{border-color:#8b5cf6;color:#a78bfa;transform:translateY(-1px)}
.uni-buddy-form{display:flex;gap:8px;padding:11px;border-top:1px solid var(--border,#282c34)}
.uni-buddy-input{min-width:0;flex:1;height:44px;border:1px solid var(--border,#282c34);border-radius:12px;background:var(--bg,#0b0c10);color:var(--text,#f5f7fa);padding:0 13px;font:14px var(--font-body,system-ui,sans-serif);outline:none}
.uni-buddy-input:focus{border-color:#8b5cf6}
.uni-buddy-send{flex:0 0 44px;width:44px;height:44px;border:0;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;font-size:17px;cursor:pointer}
.uni-buddy-foot{padding:0 14px 10px;color:var(--text-subtle,#737a87);font:10px/1.4 var(--font-body,system-ui,sans-serif);text-align:center}
.ub-home-art svg{width:130px;height:auto;display:block;margin:0 auto;filter:drop-shadow(0 8px 16px rgba(124,58,237,.35))}
.ai-avatar .ub-home-ico{width:100%;height:100%;display:grid;place-items:center;overflow:hidden;border-radius:inherit}
.ai-avatar .ub-home-ico svg{width:50px;height:auto;display:block}

@media(max-width:560px){
 .uni-buddy-launcher{right:14px;bottom:14px;padding:5px}
 .uni-buddy-launcher .uni-buddy-label,.uni-buddy-launcher .uni-buddy-dot{display:none}
 .uni-buddy-mini{width:54px;height:54px}.uni-buddy-mini svg{width:74px}
 body:has(.uni-buddy-launcher:not([hidden])) .top-scroll-btn{bottom:84px;right:18px}
 .uni-buddy-panel{right:10px;left:10px;bottom:78px;width:auto;height:min(72dvh,600px);border-radius:18px}
 .uni-buddy-input{font-size:16px}
}
@media(prefers-reduced-motion:reduce){
 .uni-buddy-panel,.uni-buddy-msg{animation:none}
 .uni-buddy-launcher,.uni-buddy-chip{transition:none}
 .uni-buddy-launcher .ub-eyes,.uni-buddy-head-avatar .ub-eyes,.uni-buddy-typing i{animation:none}
}`;

  /* ------------------------------------------------------------------------
     What Buddy knows how to open. The longest matching phrase wins, and
     phrases must match whole words ("plan" will not match "explanation").
     ------------------------------------------------------------------------ */

  const INTENTS = [
    {page: "universityFinder", keys: ["university finder", "find a university", "find universities", "universities", "university", "colleges", "college", "finder"], say: "Sure! The University Finder lets you search and compare universities by country, GPA and budget."},
    {page: "scholarships", keys: ["scholarships", "scholarship", "funding", "financial aid", "bursary", "grants"], say: "Let's open Scholarships so you can browse funding options."},
    {page: "visaGuide", keys: ["visa guide", "student visa", "visa", "visas", "immigration"], say: "Opening the Visa Guide."},
    {page: "roadmap", keys: ["roadmap", "timeline", "application plan", "milestones", "plan"], say: "Opening your Roadmap. It's the best place to track what's next."},
    {page: "sopStudio", keys: ["sop and lor", "statement of purpose", "recommendation letters", "recommendation letter", "sop", "lor"], say: "Opening the SOP & LOR tools."},
    {page: "studyAbroadGuide", keys: ["study abroad guide", "guides", "guide", "ielts", "toefl", "gre", "gmat"], say: "Here's the Study Abroad Guide, with step-by-step guides for destinations, tests and applications."},
    {page: "aiFreeJobs", keys: ["part time job", "part time jobs", "jobs", "job"], say: "Opening AI Free Jobs."},
    {page: "living", keys: ["cost calculator", "living cost", "cost of living", "calculator"], say: "Opening the Cost Calculator."},
    {page: "currency", keys: ["currency converter", "currency", "exchange rate", "convert"], say: "Opening the Currency Converter."},
    {page: "ai-chat", keys: ["ai assistant", "ai chat", "chat with ai", "ask ai", "chatbot"], say: "Opening the AI Assistant. That's the place for deeper questions."},
    {page: "saved", keys: ["saved items", "saved universities", "shortlist", "saved", "bookmarks"], say: "Opening your saved items."},
    {page: "profile", keys: ["my profile", "profile"], say: "Opening your profile."},
    {page: "settings", keys: ["settings", "dark mode", "light mode", "theme"], say: "Opening Settings."},
    {page: "home", keys: ["homepage", "home", "dashboard"], say: "Taking you home."},
    {run: "identity", keys: ["study identity", "update preferences", "personalise", "personalize", "personalization", "onboarding"], say: "Let's update your Study Identity."}
  ];

  const QUICK = [
    ["Find universities", "universities"],
    ["Scholarships", "scholarships"],
    ["Visa Guide", "visa guide"],
    ["My Roadmap", "roadmap"],
    ["SOP & LOR", "sop and lor"],
    ["Study Identity", "study identity"],
    ["AI Assistant", "ai assistant"]
  ];

  const norm = (s) => " " + String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim() + " ";

  function answer(text) {
    const q = norm(text);
    let best = null, bestLen = 0;

    INTENTS.forEach((intent) => intent.keys.forEach((k) => {
      const key = norm(k);
      if (q.includes(key) && key.length > bestLen) { best = intent; bestLen = key.length; }
    }));
    if (best) return best;

    if (/\b(hi|hello|hey|yo)\b/.test(q)) return {say: "Hi! 👋 Tell me what you're looking for, or tap one of the shortcuts below."};
    if (/\b(thanks|thank you|thx)\b/.test(q)) return {say: "Anytime! I'm right here if you need anything else."};
    if (/\b(help|what can you do|how can you help|who are you)\b/.test(q)) {
      return {say: "I'm Uni Buddy, your UniAI guide. I can open the right tool for you: universities, scholarships, visas, your roadmap, SOP & LOR, and more. For deeper questions, the AI Assistant is the place."};
    }
    return {say: "I'm mainly a website guide, and I don't want to guess about things I can't verify. Try a section like Universities, Scholarships, Visa Guide, Roadmap or SOP & LOR, or ask the AI Assistant for a detailed answer.", chips: true};
  }

  /* ------------------------------------------------------------------------
     UI
     ------------------------------------------------------------------------ */

  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function init() {
    if (!document.body || document.querySelector(".uni-buddy-launcher")) return;

    const style = el("style"); style.id = "uni-buddy-style"; style.textContent = STYLE; document.head.appendChild(style);

    const launcher = el("button", "uni-buddy-launcher",
      `<span class="uni-buddy-mini">${headSvg()}</span><span class="uni-buddy-label">Uni Buddy</span><i class="uni-buddy-dot" aria-hidden="true"></i>`);
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open Uni Buddy, your UniAI guide");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "uni-buddy-panel");

    const panel = el("aside", "uni-buddy-panel",
      `<header class="uni-buddy-head">
         <span class="uni-buddy-head-avatar">${headSvg()}</span>
         <div class="uni-buddy-head-copy"><strong>Uni Buddy</strong><small><i></i>Your UniAI guide</small></div>
         <button class="uni-buddy-close" type="button" aria-label="Close Uni Buddy">×</button>
       </header>
       <div class="uni-buddy-thread" role="log" aria-live="polite"></div>
       <div class="uni-buddy-actions"></div>
       <form class="uni-buddy-form" autocomplete="off">
         <input class="uni-buddy-input" type="text" maxlength="200" placeholder="Ask where to find something…" aria-label="Message Uni Buddy">
         <button class="uni-buddy-send" type="submit" aria-label="Send">➜</button>
       </form>
       <div class="uni-buddy-foot">Uni Buddy helps you get around UniAI. For deeper questions, use the AI Assistant.</div>`);
    panel.id = "uni-buddy-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Uni Buddy guide");

    document.body.append(launcher, panel);

    const thread = panel.querySelector(".uni-buddy-thread");
    const actions = panel.querySelector(".uni-buddy-actions");
    const input = panel.querySelector(".uni-buddy-input");
    const isSmall = () => window.matchMedia("(max-width: 560px)").matches;

    const addMsg = (who, text) => {
      const m = el("div", `uni-buddy-msg ${who}`); m.textContent = text;
      thread.appendChild(m); thread.scrollTop = thread.scrollHeight; return m;
    };

    /** Buddy "types" for a moment before answering. */
    async function buddySay(text) {
      const m = el("div", "uni-buddy-msg buddy", '<span class="uni-buddy-typing"><i></i><i></i><i></i></span>');
      thread.appendChild(m); thread.scrollTop = thread.scrollHeight;
      await sleep(reduce ? 0 : 380 + Math.min(text.length * 6, 420));
      m.textContent = text; thread.scrollTop = thread.scrollHeight;
    }

    function userName() {
      const badge = document.getElementById("user-profile-badge");
      const name = document.getElementById("nav-username");
      return badge && badge.style.display !== "none" && name ? name.textContent.trim() : "";
    }

    function renderQuick() {
      actions.replaceChildren();
      QUICK.forEach(([label, q]) => {
        const b = el("button", "uni-buddy-chip"); b.type = "button"; b.textContent = label;
        b.addEventListener("click", () => handle(q, label));
        actions.appendChild(b);
      });
    }

    let busy = false;
    async function handle(text, label) {
      const clean = String(text || "").trim();
      if (!clean || busy) return;
      busy = true;
      addMsg("you", label || clean);
      input.value = "";

      const result = answer(clean);
      await buddySay(result.say);

      if (result.run === "identity") {
        if (window.UniAIPreferences && typeof window.UniAIPreferences.open === "function") {
          if (isSmall()) close(false);
          window.UniAIPreferences.open();
        } else await buddySay("Study Identity isn't available right now.");
      } else if (result.page) {
        if (typeof window.showPage !== "function") await buddySay("Navigation isn't ready yet. Try again in a moment.");
        else {
          const ok = await window.showPage(result.page);
          if (ok === false) await buddySay("I couldn't open that. If it needs an account, sign in first and ask me again.");
          else if (isSmall()) close(false);
        }
      }
      busy = false;
    }

    function open() {
      panel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      if (!thread.children.length) {
        const n = userName();
        addMsg("buddy", `${n ? `Hey ${n}! ` : "Hey! "}I'm Uni Buddy 👋 I can help you find your way around UniAI. What are you looking for?`);
      }
      renderQuick();
      if (!isSmall()) setTimeout(() => input.focus({preventScroll: true}), 40);
    }

    function close(returnFocus = true) {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      if (returnFocus) launcher.focus({preventScroll: true});
    }

    launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
    panel.querySelector(".uni-buddy-close").addEventListener("click", () => close());
    panel.querySelector(".uni-buddy-form").addEventListener("submit", (e) => { e.preventDefault(); handle(input.value); });
    // a global shortcut handler elsewhere in the app swallows the space key; keep typing normal
    input.addEventListener("keydown", (e) => e.stopPropagation());
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });

    /* The AI Assistant page already has its own composer in the corner, so Buddy steps aside there. */
    const syncVisibility = (page) => {
      const onChat = String(page || "").replace(/Page$/, "") === "ai-chat";
      launcher.hidden = onChat;
      if (onChat && !panel.hidden) close(false);
    };
    if (typeof window.showPage === "function") {
      const original = window.showPage;
      window.showPage = async function (page, event) {
        const result = await original.call(this, page, event);
        if (result !== false) syncVisibility(page);
        return result;
      };
      window.showpage = window.showPage;
    }

    /* Replace the robot emoji on the home AI panel with the real mascot. */
    if (headSvg()) {
      const art = document.querySelector(".ai-bot-illustration span");
      if (art) { art.className = "ub-home-art"; art.innerHTML = headSvg(); }
      const ico = document.querySelector(".ai-panel .ai-avatar");
      if (ico) ico.innerHTML = `<span class="ub-home-ico">${headSvg()}</span>`;
    }

    window.UniAIBuddy = {open, close, ask: handle};
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once: true});
  else init();
})();
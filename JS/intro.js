/* ==========================================================================
   UniAI — minimal intro (intro.js)

   Add as the FIRST script, right after <body>, so there's no flash of the page:
     <body>
       <script src="JS/intro.js"></script>
       ...

   - About 1.6 seconds, then fades out
   - Once per browser session (a refresh doesn't replay it)
   - Click, tap or press Esc/Enter to skip
   - Respects "reduce motion"
   - Follows the light/dark theme
   - Self-contained: injects its own markup and CSS
   ========================================================================== */

(function () {
  "use strict";

  const SHOW_MS = 1600; // visible time before fading
  const FADE_MS = 500;
  const SESSION_KEY = "uniai-intro-seen";

  // Skip if already seen this session.
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch (err) {
    /* storage blocked: just show it */
  }

  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const savedTheme = (() => {
    try {
      return localStorage.getItem("uniai-theme");
    } catch (err) {
      return null;
    }
  })();

  const dark =
    savedTheme === "dark" ||
    (!savedTheme &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const style = document.createElement("style");
  style.textContent = `
    #uniai-intro {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
      background: ${dark ? "#0b0d14" : "#ffffff"};
      color: ${dark ? "#f1f5f9" : "#0f172a"};
      font-family: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
      opacity: 1; transition: opacity ${FADE_MS}ms ease;
      cursor: pointer;
    }
    #uniai-intro.out { opacity: 0; pointer-events: none; }

    #uniai-intro .ui-mark { width: 64px; height: 64px; }
    #uniai-intro .ui-word {
      font-size: 2rem; font-weight: 800; letter-spacing: -.02em; line-height: 1;
    }
    #uniai-intro .ui-word span {
      background: linear-gradient(135deg, #4f6bff, #a15bff);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    #uniai-intro .ui-tag {
      font-size: .8rem; letter-spacing: .14em; text-transform: uppercase;
      color: ${dark ? "#94a3b8" : "#64748b"};
    }

    ${
      reduceMotion
        ? ""
        : `
    #uniai-intro .ui-mark { animation: ui-pop .7s cubic-bezier(.16, 1, .3, 1) both; }
    #uniai-intro .ui-word { animation: ui-rise .6s .25s cubic-bezier(.16, 1, .3, 1) both; }
    #uniai-intro .ui-tag  { animation: ui-rise .6s .5s cubic-bezier(.16, 1, .3, 1) both; }
    @keyframes ui-pop  { from { opacity: 0; transform: scale(.6) rotate(-8deg); } to { opacity: 1; transform: none; } }
    @keyframes ui-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    `
    }
  `;

  const intro = document.createElement("div");
  intro.id = "uniai-intro";
  intro.setAttribute("role", "status");
  intro.setAttribute("aria-label", "Loading UniAI");
  intro.innerHTML = `
    <svg class="ui-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="uiIntroGrad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stop-color="#4f6bff"/>
          <stop offset="100%" stop-color="#a15bff"/>
        </linearGradient>
      </defs>
      <path d="M16 4 L29 10 L16 16 L3 10 Z" fill="url(#uiIntroGrad)"/>
      <path d="M8 13.5 V20 C8 23.5 11.5 26 16 26 C20.5 26 24 23.5 24 20 V13.5"
            fill="none" stroke="url(#uiIntroGrad)" stroke-width="2" stroke-linecap="round"/>
      <circle cx="29" cy="10" r="2.6" fill="#ec4899"/>
      <line x1="29" y1="10" x2="29" y2="17" stroke="#ec4899" stroke-width="1.6"/>
    </svg>
    <div class="ui-word">Uni<span>AI</span></div>
    <div class="ui-tag">Plan smarter. Go farther.</div>
  `;

  document.head.appendChild(style);
  (document.body || document.documentElement).appendChild(intro);

  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  let done = false;

  function finish() {
    if (done) return;
    done = true;

    intro.classList.add("out");
    document.documentElement.style.overflow = previousOverflow;

    setTimeout(() => {
      intro.remove();
      style.remove();
    }, FADE_MS + 50);
  }

  const timer = setTimeout(finish, reduceMotion ? 600 : SHOW_MS);

  function skip() {
    clearTimeout(timer);
    finish();
  }

  intro.addEventListener("click", skip);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" || e.key === "Enter") skip();
    },
    { once: true }
  );
})();
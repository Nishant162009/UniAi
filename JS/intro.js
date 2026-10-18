/* ==========================================================================
   UniAI — logo build intro (intro.js)

   Add as the FIRST script, right after <body>:
     <body>
       <script src="JS/intro.js"></script>

   The logo is constructed step by step (no shaking, no spinning pieces):
     1. the cup/body line draws itself
     2. the diamond cap outlines itself, then fills with gradient
     3. the signal line draws down
     4. the pink dot pops in
     5. a light sweep passes over the finished logo, wordmark rises

   - Once per browser session
   - Click / tap / Esc / Enter to skip
   - Respects "reduce motion"
   - Follows light/dark theme
   ========================================================================== */

(function () {
  "use strict";

  const SHOW_MS = 3000;
  const FADE_MS = 600;
  const SESSION_KEY = "uniai-intro-seen";

  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch (err) {}

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const savedTheme = (() => {
    try { return localStorage.getItem("uniai-theme"); }
    catch (err) { return null; }
  })();

  const dark =
    savedTheme === "dark" ||
    (!savedTheme &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const EASE = "cubic-bezier(.65, 0, .35, 1)";
  const EASE_OUT = "cubic-bezier(.16, 1, .3, 1)";

  const style = document.createElement("style");

  style.textContent = `
    #uniai-intro {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      overflow: hidden;
      background: radial-gradient(circle at 50% 43%,
        ${dark ? "#151a2d" : "#eef2ff"} 0%,
        ${dark ? "#070810" : "#ffffff"} 65%);
      color: ${dark ? "#f8fafc" : "#0f172a"};
      font-family: "Plus Jakarta Sans", "Inter", system-ui, sans-serif;
      opacity: 1;
      transition: opacity ${FADE_MS}ms ease,
                  transform ${FADE_MS}ms cubic-bezier(.7, 0, .84, 0);
      cursor: pointer;
      user-select: none;
    }

    #uniai-intro.out {
      opacity: 0;
      pointer-events: none;
      transform: scale(1.06);
    }

    /* ---------- stage ---------- */

    #uniai-intro .ui-stage {
      position: relative;
      width: 220px;
      height: 220px;
      display: grid;
      place-items: center;
      z-index: 2;
    }

    #uniai-intro .ui-glow {
      position: absolute;
      width: 190px;
      height: 190px;
      border-radius: 50%;
      background: radial-gradient(circle,
        rgba(79,107,255,.40),
        rgba(161,91,255,.16) 45%,
        transparent 70%);
      filter: blur(18px);
      opacity: 0;
      animation: ui-glow-in 1.6s .2s ${EASE_OUT} forwards;
    }

    /* rings fade in and turn slowly; they stay calm */
    #uniai-intro .ui-ring {
      position: absolute;
      border-radius: 50%;
      opacity: 0;
      animation: ui-ring-in .8s .1s ease forwards;
    }
    #uniai-intro .ui-ring.r1 {
      width: 150px; height: 150px;
      border: 1px solid rgba(79,107,255,.30);
      border-top-color: #4f6bff;
      border-right-color: transparent;
      --a: 1;
      animation: ui-ring-in .8s .1s ease forwards,
                 ui-spin 6s linear infinite;
    }
    #uniai-intro .ui-ring.r2 {
      width: 185px; height: 185px;
      border: 1px solid rgba(161,91,255,.25);
      border-bottom-color: #a15bff;
      border-left-color: transparent;
      animation: ui-ring-in .8s .25s ease forwards,
                 ui-spin 9s linear infinite reverse;
    }
    #uniai-intro .ui-ring.r3 {
      width: 215px; height: 215px;
      border: 1px dashed rgba(236,72,153,.26);
      animation: ui-ring-in .8s .4s ease forwards,
                 ui-spin 16s linear infinite;
    }

    /* ---------- logo ---------- */

    #uniai-intro .ui-logo {
      position: relative;
      z-index: 5;
      width: 96px;
      height: 96px;
    }
    #uniai-intro .ui-logo svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      filter: drop-shadow(0 0 14px rgba(79,107,255,.40));
    }

    /* 1. body line draws itself (0.15s -> 1.05s) */
    #uniai-intro .logo-body {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: ui-draw .9s .15s ${EASE} forwards;
    }

    /* 2. diamond cap: outline draws (0.75s), then fills (1.35s) */
    #uniai-intro .logo-top {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      fill-opacity: 0;
      transform-box: fill-box;
      transform-origin: 50% 100%;
      animation:
        ui-draw .7s .75s ${EASE} forwards,
        ui-fill .45s 1.35s ease forwards,
        ui-settle .5s 1.35s ${EASE_OUT} both;
    }

    /* 3. signal line draws down (1.7s) */
    #uniai-intro .logo-line {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: ui-draw .35s 1.7s ${EASE} forwards;
    }

    /* 4. dot pops in (1.95s) */
    #uniai-intro .logo-dot {
      transform-box: fill-box;
      transform-origin: center;
      transform: scale(0);
      animation: ui-pop .4s 1.95s ${EASE_OUT} forwards;
    }

    /* 5. one light sweep over the finished logo (2.3s) */
    #uniai-intro .logo-sweep {
      opacity: 0;
      animation: ui-sweep .6s 2.3s ease-in-out forwards;
    }

    /* ---------- text ---------- */

    #uniai-intro .ui-word {
      position: relative;
      z-index: 3;
      font-size: clamp(2.2rem, 7vw, 3.4rem);
      font-weight: 900;
      letter-spacing: -.04em;
      line-height: 1;
      opacity: 0;
      animation: ui-rise .7s 1.9s ${EASE_OUT} forwards;
    }
    #uniai-intro .ui-word span {
      background: linear-gradient(135deg, #4f6bff, #a15bff, #ec4899, #4f6bff);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: ui-gradient 3s linear infinite;
    }
    #uniai-intro .ui-tag {
      position: relative;
      z-index: 3;
      font-size: .78rem;
      letter-spacing: .22em;
      text-transform: uppercase;
      color: ${dark ? "#94a3b8" : "#64748b"};
      opacity: 0;
      animation: ui-rise .7s 2.1s ${EASE_OUT} forwards;
    }

    /* ---------- keyframes ---------- */

    @keyframes ui-draw   { to { stroke-dashoffset: 0; } }
    @keyframes ui-fill   { to { fill-opacity: 1; } }
    @keyframes ui-settle {
      from { transform: translateY(-5px) scale(.96); }
      to   { transform: translateY(0) scale(1); }
    }
    @keyframes ui-pop {
      0%   { transform: scale(0); }
      70%  { transform: scale(1.25); }
      100% { transform: scale(1); }
    }
    @keyframes ui-sweep {
      0%   { opacity: 0; transform: translateX(-40px); }
      30%  { opacity: .9; }
      100% { opacity: 0; transform: translateX(40px); }
    }
    @keyframes ui-glow-in { to { opacity: 1; } }
    @keyframes ui-ring-in { to { opacity: 1; } }
    @keyframes ui-spin    { to { transform: rotate(360deg); } }
    @keyframes ui-gradient { to { background-position: 300% 0; } }
    @keyframes ui-rise {
      from { opacity: 0; transform: translateY(14px); filter: blur(4px); }
      to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
    }

    ${
      reduceMotion
        ? `
      #uniai-intro *, #uniai-intro *::before, #uniai-intro *::after {
        animation: none !important;
        transition: none !important;
      }
      #uniai-intro .ui-glow, #uniai-intro .ui-ring,
      #uniai-intro .ui-word, #uniai-intro .ui-tag { opacity: 1; }
      #uniai-intro .logo-body, #uniai-intro .logo-line { stroke-dashoffset: 0; }
      #uniai-intro .logo-top { stroke-dashoffset: 0; fill-opacity: 1; }
      #uniai-intro .logo-dot { transform: scale(1); }
      #uniai-intro .logo-sweep { display: none; }
    `
        : ""
    }
  `;

  const intro = document.createElement("div");
  intro.id = "uniai-intro";
  intro.setAttribute("role", "status");
  intro.setAttribute("aria-label", "Loading UniAI");

  // pathLength="1" lets every piece use the same dash values to "draw" itself.
  intro.innerHTML = `
    <div class="ui-stage">
      <div class="ui-glow"></div>
      <div class="ui-ring r1"></div>
      <div class="ui-ring r2"></div>
      <div class="ui-ring r3"></div>

      <div class="ui-logo">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <linearGradient id="uiIntroGrad" x1="0" y1="0" x2="32" y2="32"
                            gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#4f6bff"/>
              <stop offset="55%" stop-color="#a15bff"/>
              <stop offset="100%" stop-color="#ec4899"/>
            </linearGradient>

            <linearGradient id="uiSweepGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
              <stop offset="50%" stop-color="#fff" stop-opacity=".75"/>
              <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
            </linearGradient>

            <clipPath id="uiLogoClip">
              <path d="M16 4 L29 10 L16 16 L3 10 Z"/>
              <rect x="6.8" y="13" width="2.4" height="8"/>
              <rect x="22.8" y="13" width="2.4" height="8"/>
              <path d="M8 20 C8 23.5 11.5 26 16 26 C20.5 26 24 23.5 24 20"
                    fill="none" stroke="#000" stroke-width="2.4"/>
            </clipPath>
          </defs>

          <!-- 1. body -->
          <path class="logo-body" pathLength="1"
            d="M8 13.5 V20 C8 23.5 11.5 26 16 26 C20.5 26 24 23.5 24 20 V13.5"
            fill="none" stroke="url(#uiIntroGrad)"
            stroke-width="2" stroke-linecap="round"/>

          <!-- 2. diamond cap -->
          <path class="logo-top" pathLength="1"
            d="M16 4 L29 10 L16 16 L3 10 Z"
            fill="url(#uiIntroGrad)" stroke="url(#uiIntroGrad)"
            stroke-width="1" stroke-linejoin="round"/>

          <!-- 3. signal line -->
          <line class="logo-line" pathLength="1"
            x1="29" y1="10" x2="29" y2="17"
            stroke="#ec4899" stroke-width="1.6" stroke-linecap="round"/>

          <!-- 4. dot -->
          <circle class="logo-dot" cx="29" cy="10" r="2.6" fill="#ec4899"/>

          <!-- 5. light sweep, clipped to the logo shape -->
          <g clip-path="url(#uiLogoClip)">
            <rect class="logo-sweep" x="4" y="2" width="10" height="26"
                  fill="url(#uiSweepGrad)" transform="skewX(-20)"/>
          </g>
        </svg>
      </div>
    </div>

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

    document.removeEventListener("keydown", onKey);
    intro.classList.add("out");
    document.documentElement.style.overflow = previousOverflow;

    setTimeout(() => {
      intro.remove();
      style.remove();
    }, FADE_MS + 60);
  }

  const timer = setTimeout(finish, reduceMotion ? 900 : SHOW_MS);

  function skip() {
    clearTimeout(timer);
    finish();
  }

  function onKey(e) {
    if (e.key === "Escape" || e.key === "Enter") skip();
  }

  intro.addEventListener("click", skip);
  document.addEventListener("keydown", onKey);
})();
/* ==========================================================================
   UniAI — cinematic logo intro (intro.js)

   Add as the FIRST script, right after <body>:

     <body>
       <script src="JS/intro.js"></script>

   Features:
   - About 2.2 seconds, then smoothly fades/exits
   - Logo itself performs the animation
   - Logo opens / separates / rotates / reforms
   - Cinematic glow + rotating rings
   - No particles
   - No orbiting dot
   - Animated gradient
   - Subtle scanline
   - Once per browser session
   - Click, tap or press Esc/Enter to skip
   - Respects "reduce motion"
   - Follows the light/dark theme
   - Self-contained: injects its own markup and CSS
   ========================================================================== */

(function () {
  "use strict";

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  const SHOW_MS = 2200;
  const FADE_MS = 600;
  const SESSION_KEY = "uniai-intro-seen";

  // -------------------------------------------------------------------------
  // Skip if already seen this session
  // -------------------------------------------------------------------------

  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch (err) {
    // Storage blocked — still show intro.
  }

  // -------------------------------------------------------------------------
  // Motion preference
  // -------------------------------------------------------------------------

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // -------------------------------------------------------------------------
  // Theme
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Inject CSS
  // -------------------------------------------------------------------------

  const style = document.createElement("style");

  style.textContent = `

    /* ======================================================================
       INTRO
       ====================================================================== */

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

      background:
        radial-gradient(
          circle at 50% 43%,
          ${dark ? "#151a2d" : "#eef2ff"} 0%,
          ${dark ? "#070810" : "#ffffff"} 65%
        );

      color:
        ${dark ? "#f8fafc" : "#0f172a"};

      font-family:
        "Plus Jakarta Sans",
        "Inter",
        system-ui,
        sans-serif;

      opacity: 1;

      transition:
        opacity ${FADE_MS}ms ease,
        transform ${FADE_MS}ms cubic-bezier(.7, 0, .84, 0);

      cursor: pointer;

      user-select: none;
    }


    #uniai-intro.out {
      opacity: 0;
      pointer-events: none;

      transform: scale(1.08);
    }


    /* ======================================================================
       SUBTLE BACKGROUND LIGHT
       ====================================================================== */

    #uniai-intro::before {
      content: "";

      position: absolute;
      inset: -30%;

      pointer-events: none;

      background:
        radial-gradient(
          circle at center,
          rgba(79, 107, 255, .10),
          transparent 42%
        );

      animation:
        ui-background-breathe 3s ease-in-out infinite;
    }


    /* ======================================================================
       STAGE
       ====================================================================== */

    #uniai-intro .ui-stage {
      position: relative;

      width: 220px;
      height: 220px;

      display: grid;
      place-items: center;

      z-index: 2;
    }


    /* ======================================================================
       GLOW
       ====================================================================== */

    #uniai-intro .ui-glow {
      position: absolute;

      width: 190px;
      height: 190px;

      border-radius: 50%;

      background:
        radial-gradient(
          circle,
          rgba(79,107,255,.45),
          rgba(161,91,255,.18) 45%,
          transparent 70%
        );

      filter: blur(18px);

      animation:
        ui-breathe 2.4s ease-in-out infinite;
    }


    /* ======================================================================
       ROTATING RINGS
       ====================================================================== */

    #uniai-intro .ui-ring {
      position: absolute;

      border-radius: 50%;

      border: 1px solid rgba(79,107,255,.35);
    }


    #uniai-intro .ui-ring.r1 {
      width: 150px;
      height: 150px;

      border-top-color: #4f6bff;
      border-right-color: transparent;

      animation:
        ui-spin 1.8s linear infinite;
    }


    #uniai-intro .ui-ring.r2 {
      width: 185px;
      height: 185px;

      border-bottom-color: #a15bff;
      border-left-color: transparent;

      animation:
        ui-spin 2.6s linear infinite reverse;
    }


    #uniai-intro .ui-ring.r3 {
      width: 215px;
      height: 215px;

      border: 1px dashed rgba(236,72,153,.30);

      animation:
        ui-spin 5s linear infinite;
    }


    /* ======================================================================
       LOGO
       ====================================================================== */

    #uniai-intro .ui-logo {
      width: 92px;
      height: 92px;

      position: relative;

      z-index: 5;

      overflow: visible;

      filter:
        drop-shadow(
          0 0 18px rgba(79,107,255,.45)
        );

      transform-origin: center;

      animation:
        ui-logo-float 2.2s 1.15s ease-in-out infinite;
    }


    #uniai-intro .ui-logo svg {
      width: 100%;
      height: 100%;

      overflow: visible;
    }


    /* ======================================================================
       LOGO PIECES
       ======================================================================

       These are the important parts.

       The logo is physically split into:
       1. top diamond
       2. lower body
       3. pink dot
       4. pink signal line

       They move independently, then reform into the original logo.
       ====================================================================== */


    #uniai-intro .logo-top {
      transform-box: fill-box;
      transform-origin: center;

      animation:
        ui-top-form 1.65s cubic-bezier(.16, 1, .3, 1) both;
    }


    #uniai-intro .logo-body {
      transform-box: fill-box;
      transform-origin: center;

      animation:
        ui-body-form 1.65s cubic-bezier(.16, 1, .3, 1) both;
    }


    #uniai-intro .logo-dot {
      transform-box: fill-box;
      transform-origin: center;

      animation:
        ui-dot-form 1.65s cubic-bezier(.16, 1, .3, 1) both;
    }


    #uniai-intro .logo-line {
      transform-box: fill-box;
      transform-origin: center;

      animation:
        ui-line-form 1.65s cubic-bezier(.16, 1, .3, 1) both;
    }


    /* ======================================================================
       LOGO TOP
       
       Opens away from the center, flips, overshoots,
       then locks into the real position.
       ====================================================================== */

    @keyframes ui-top-form {

      0% {
        opacity: 0;

        transform:
          translate(-17px, 27px)
          rotate(-42deg)
          scale(.68);
      }

      12% {
        opacity: 1;

        transform:
          translate(-25px, -3px)
          rotate(-52deg)
          scale(.86);
      }

      27% {
        transform:
          translate(19px, -17px)
          rotate(34deg)
          scale(1.10);
      }

      42% {
        transform:
          translate(-13px, 9px)
          rotate(-18deg)
          scale(.95);
      }

      58% {
        transform:
          translate(8px, -5px)
          rotate(9deg)
          scale(1.04);
      }

      73% {
        transform:
          translate(-3px, 2px)
          rotate(-2deg)
          scale(1.015);
      }

      88% {
        transform:
          translate(1px, -1px)
          rotate(.7deg)
          scale(1);
      }

      100% {
        opacity: 1;

        transform:
          translate(0, 0)
          rotate(0)
          scale(1);
      }
    }


    /* ======================================================================
       LOGO BODY
       
       Moves in the opposite direction to make the logo
       feel like it is unfolding and assembling.
       ====================================================================== */

    @keyframes ui-body-form {

      0% {
        opacity: 0;

        transform:
          translate(17px, -24px)
          rotate(38deg)
          scale(.70);
      }

      14% {
        opacity: 1;

        transform:
          translate(26px, 6px)
          rotate(47deg)
          scale(.84);
      }

      29% {
        transform:
          translate(-17px, 17px)
          rotate(-30deg)
          scale(1.09);
      }

      44% {
        transform:
          translate(11px, -7px)
          rotate(14deg)
          scale(.95);
      }

      60% {
        transform:
          translate(-6px, 4px)
          rotate(-6deg)
          scale(1.04);
      }

      76% {
        transform:
          translate(3px, -2px)
          rotate(2.5deg)
          scale(1.01);
      }

      90% {
        transform:
          translate(-1px, 1px)
          rotate(-.5deg)
          scale(1);
      }

      100% {
        opacity: 1;

        transform:
          translate(0, 0)
          rotate(0)
          scale(1);
      }
    }


    /* ======================================================================
       PINK SIGNAL LINE
       ====================================================================== */

    @keyframes ui-line-form {

      0% {
        opacity: 0;

        transform:
          translate(18px, -23px)
          rotate(80deg)
          scaleY(.2);
      }

      18% {
        opacity: 1;

        transform:
          translate(21px, 5px)
          rotate(115deg)
          scaleY(1.2);
      }

      37% {
        transform:
          translate(-13px, -6px)
          rotate(-52deg)
          scaleY(.78);
      }

      54% {
        transform:
          translate(7px, 3px)
          rotate(22deg)
          scaleY(1.08);
      }

      73% {
        transform:
          translate(-2px, 0)
          rotate(-3deg)
          scaleY(1);
      }

      100% {
        opacity: 1;

        transform:
          translate(0, 0)
          rotate(0)
          scaleY(1);
      }
    }


    /* ======================================================================
       PINK DOT
       ====================================================================== */

    @keyframes ui-dot-form {

      0% {
        opacity: 0;

        transform:
          translate(30px, 20px)
          scale(.1);
      }

      17% {
        opacity: 1;

        transform:
          translate(13px, -16px)
          scale(1.4);
      }

      34% {
        transform:
          translate(-11px, 9px)
          scale(.72);
      }

      52% {
        transform:
          translate(6px, -4px)
          scale(1.16);
      }

      73% {
        transform:
          translate(-2px, 1px)
          scale(.97);
      }

      100% {
        opacity: 1;

        transform:
          translate(0, 0)
          scale(1);
      }
    }


    /* ======================================================================
       WORDMARK
       ====================================================================== */

    #uniai-intro .ui-word {
      position: relative;

      z-index: 3;

      font-size:
        clamp(2.2rem, 7vw, 3.4rem);

      font-weight: 900;

      letter-spacing: -.04em;

      line-height: 1;

      opacity: 0;

      animation:
        ui-rise .7s .75s cubic-bezier(.16, 1, .3, 1) both;
    }


    #uniai-intro .ui-word span {
      background:
        linear-gradient(
          135deg,
          #4f6bff,
          #a15bff,
          #ec4899,
          #4f6bff
        );

      background-size: 300% 100%;

      -webkit-background-clip: text;
      background-clip: text;

      color: transparent;

      animation:
        ui-gradient 2.5s linear infinite;
    }


    /* ======================================================================
       TAGLINE
       ====================================================================== */

    #uniai-intro .ui-tag {
      position: relative;

      z-index: 3;

      font-size: .78rem;

      letter-spacing: .22em;

      text-transform: uppercase;

      color:
        ${dark ? "#94a3b8" : "#64748b"};

      opacity: 0;

      animation:
        ui-rise .7s .95s cubic-bezier(.16, 1, .3, 1) both;
    }


    /* ======================================================================
       SCANLINE
       ====================================================================== */

    #uniai-intro .ui-scanline {
      position: absolute;

      left: 0;
      right: 0;

      height: 90px;

      background:
        linear-gradient(
          to bottom,
          transparent,
          rgba(79,107,255,.07),
          transparent
        );

      animation:
        ui-scan 2.2s linear infinite;

      pointer-events: none;

      z-index: 10;
    }


    /* ======================================================================
       ANIMATIONS
       ====================================================================== */

    @keyframes ui-spin {
      to {
        transform: rotate(360deg);
      }
    }


    @keyframes ui-logo-float {

      0%,
      100% {
        transform:
          translateY(0)
          rotate(0deg);
      }

      50% {
        transform:
          translateY(-8px)
          rotate(2deg);
      }
    }


    @keyframes ui-breathe {

      0%,
      100% {
        transform: scale(.85);
        opacity: .55;
      }

      50% {
        transform: scale(1.1);
        opacity: 1;
      }
    }


    @keyframes ui-background-breathe {

      0%,
      100% {
        transform: scale(.95);
        opacity: .6;
      }

      50% {
        transform: scale(1.08);
        opacity: 1;
      }
    }


    @keyframes ui-gradient {

      to {
        background-position: 300% 0;
      }
    }


    @keyframes ui-rise {

      from {
        opacity: 0;

        transform:
          translateY(18px)
          scale(.96);

        filter: blur(4px);
      }

      to {
        opacity: 1;

        transform:
          translateY(0)
          scale(1);

        filter: blur(0);
      }
    }


    @keyframes ui-scan {

      from {
        top: -90px;
      }

      to {
        top: 100%;
      }
    }


    /* ======================================================================
       REDUCED MOTION
       ====================================================================== */

    ${
      reduceMotion
        ? `
          #uniai-intro *,
          #uniai-intro *::before,
          #uniai-intro *::after {
            animation: none !important;
            transition: none !important;
          }

          #uniai-intro .ui-glow {
            opacity: .7;
          }

          #uniai-intro .ui-logo,
          #uniai-intro .ui-word,
          #uniai-intro .ui-tag {
            opacity: 1;
            transform: none;
          }

          #uniai-intro .logo-top,
          #uniai-intro .logo-body,
          #uniai-intro .logo-dot,
          #uniai-intro .logo-line {
            opacity: 1;
            transform: none;
          }
        `
        : ""
    }

  `;


  // -------------------------------------------------------------------------
  // HTML
  // -------------------------------------------------------------------------

  const intro = document.createElement("div");

  intro.id = "uniai-intro";

  intro.setAttribute("role", "status");
  intro.setAttribute("aria-label", "Loading UniAI");

  intro.innerHTML = `

    <!-- ================================================================
         LOGO STAGE
         ================================================================ -->

    <div class="ui-stage">

      <div class="ui-glow"></div>

      <div class="ui-ring r1"></div>

      <div class="ui-ring r2"></div>

      <div class="ui-ring r3"></div>


      <!-- ============================================================
           LOGO

           Each important piece is separated so the logo can
           physically break apart and reform.
           ============================================================ -->

      <div class="ui-logo">

        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
        >

          <defs>

            <linearGradient
              id="uiIntroGrad"
              x1="0"
              y1="0"
              x2="32"
              y2="32"
            >

              <stop
                offset="0%"
                stop-color="#4f6bff"
              />

              <stop
                offset="55%"
                stop-color="#a15bff"
              />

              <stop
                offset="100%"
                stop-color="#ec4899"
              />

            </linearGradient>

          </defs>


          <!-- ========================================================
               TOP DIAMOND
               ======================================================== -->

          <path
            class="logo-top"
            d="
              M16 4
              L29 10
              L16 16
              L3 10
              Z
            "
            fill="url(#uiIntroGrad)"
          />


          <!-- ========================================================
               LOWER BODY
               ======================================================== -->

          <path
            class="logo-body"
            d="
              M8 13.5
              V20
              C8 23.5
              11.5 26
              16 26
              C20.5 26
              24 23.5
              24 20
              V13.5
            "
            fill="none"
            stroke="url(#uiIntroGrad)"
            stroke-width="2"
            stroke-linecap="round"
          />


          <!-- ========================================================
               PINK SIGNAL LINE
               ======================================================== -->

          <line
            class="logo-line"
            x1="29"
            y1="10"
            x2="29"
            y2="17"
            stroke="#ec4899"
            stroke-width="1.6"
            stroke-linecap="round"
          />


          <!-- ========================================================
               PINK DOT
               ======================================================== -->

          <circle
            class="logo-dot"
            cx="29"
            cy="10"
            r="2.6"
            fill="#ec4899"
          />

        </svg>

      </div>

    </div>


    <!-- ================================================================
         WORDMARK
         ================================================================ -->

    <div class="ui-word">
      Uni<span>AI</span>
    </div>


    <!-- ================================================================
         TAGLINE
         ================================================================ -->

    <div class="ui-tag">
      Plan smarter. Go farther.
    </div>


    <!-- ================================================================
         SCAN
         ================================================================ -->

    <div class="ui-scanline"></div>

  `;


  // -------------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------------

  document.head.appendChild(style);

  (document.body || document.documentElement)
    .appendChild(intro);


  // -------------------------------------------------------------------------
  // Lock page scrolling
  // -------------------------------------------------------------------------

  const previousOverflow =
    document.documentElement.style.overflow;

  document.documentElement.style.overflow = "hidden";


  // -------------------------------------------------------------------------
  // Finish
  // -------------------------------------------------------------------------

  let done = false;

  function finish() {

    if (done) return;

    done = true;

    intro.classList.add("out");

    document.documentElement.style.overflow =
      previousOverflow;

    setTimeout(() => {

      intro.remove();
      style.remove();

    }, FADE_MS + 60);
  }


  // -------------------------------------------------------------------------
  // Automatic exit
  // -------------------------------------------------------------------------

  const timer = setTimeout(
    finish,
    reduceMotion ? 900 : SHOW_MS
  );


  // -------------------------------------------------------------------------
  // Skip intro
  // -------------------------------------------------------------------------

  function skip() {

    clearTimeout(timer);

    finish();
  }


  intro.addEventListener(
    "click",
    skip
  );


  document.addEventListener(
    "keydown",
    (e) => {

      if (
        e.key === "Escape" ||
        e.key === "Enter"
      ) {
        skip();
      }

    },
    { once: true }
  );

})();


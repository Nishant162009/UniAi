/* ==========================================================================
   UniAI — Logo Formation Intro
   --------------------------------------------------------------------------
   - Logo itself is the animation
   - Opens / unfolds / rotates / reforms
   - No particles
   - No unnecessary background effects
   - ~1.6 seconds
   - Once per browser session
   - Click / tap / Esc / Enter to skip
   - Respects prefers-reduced-motion
   - Light / dark theme aware
   ========================================================================== */

(function () {
  "use strict";

  const SHOW_MS = 1600;
  const FADE_MS = 450;
  const SESSION_KEY = "uniai-intro-seen";

  // -------------------------------------------------------------------------
  // Show once per browser session
  // -------------------------------------------------------------------------

  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch (err) {}

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  // Styles
  // -------------------------------------------------------------------------

  const style = document.createElement("style");

  style.textContent = `
    #uniai-intro {
      position: fixed;
      inset: 0;
      z-index: 99999;

      display: flex;
      align-items: center;
      justify-content: center;

      background: ${dark ? "#0b0d14" : "#ffffff"};
      color: ${dark ? "#f8fafc" : "#0f172a"};

      font-family:
        "Plus Jakarta Sans",
        "Inter",
        system-ui,
        sans-serif;

      cursor: pointer;

      opacity: 1;
      transition:
        opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1);

      overflow: hidden;
    }

    #uniai-intro.out {
      opacity: 0;
      pointer-events: none;
    }


    /* ================================================================
       CENTER
       ================================================================ */

    #uniai-intro .ui-center {
      position: relative;

      display: flex;
      flex-direction: column;
      align-items: center;

      transform: translateY(-3vh);
    }


    /* ================================================================
       LOGO
       ================================================================ */

    #uniai-intro .ui-logo-wrap {
      width: 150px;
      height: 150px;

      position: relative;

      display: flex;
      align-items: center;
      justify-content: center;

      perspective: 800px;

      animation:
        logoEntrance .75s cubic-bezier(.16,1,.3,1) both;
    }

    #uniai-intro .ui-logo {
      width: 92px;
      height: 92px;

      overflow: visible;

      transform-origin: center;
    }


    /* ================================================================
       THE ACTUAL LOGO PIECES
       ================================================================ */

    #uniai-intro .logo-top {
      transform-box: fill-box;
      transform-origin: center;

      animation:
        topFormation 1.55s cubic-bezier(.16,1,.3,1) both;
    }

    #uniai-intro .logo-body {
      transform-box: fill-box;
      transform-origin: center;

      animation:
        bodyFormation 1.55s cubic-bezier(.16,1,.3,1) both;
    }

    #uniai-intro .logo-dot {
      transform-box: fill-box;
      transform-origin: center;

      animation:
        dotFormation 1.55s cubic-bezier(.16,1,.3,1) both;
    }

    #uniai-intro .logo-line {
      transform-box: fill-box;
      transform-origin: center;

      animation:
        lineFormation 1.55s cubic-bezier(.16,1,.3,1) both;
    }


    /* ================================================================
       SUBTLE SHADOW / GLOW
       ================================================================ */

    #uniai-intro .logo-shadow {
      position: absolute;

      width: 80px;
      height: 20px;

      bottom: 22px;

      border-radius: 50%;

      background: ${dark
        ? "rgba(79,107,255,.25)"
        : "rgba(79,107,255,.12)"};

      filter: blur(14px);

      animation:
        shadowMove 1.55s cubic-bezier(.16,1,.3,1) both;
    }


    /* ================================================================
       WORDMARK
       ================================================================ */

    #uniai-intro .ui-word {
      margin-top: -5px;

      font-size: 2rem;
      font-weight: 800;

      letter-spacing: -.045em;

      line-height: 1;

      opacity: 0;

      animation:
        wordReveal .55s .85s cubic-bezier(.16,1,.3,1) forwards;
    }

    #uniai-intro .ui-word span {
      background:
        linear-gradient(
          135deg,
          #4f6bff,
          #a15bff
        );

      -webkit-background-clip: text;
      background-clip: text;

      color: transparent;
    }


    /* ================================================================
       TAGLINE
       ================================================================ */

    #uniai-intro .ui-tag {
      margin-top: 11px;

      font-size: .7rem;
      font-weight: 600;

      letter-spacing: .2em;
      text-transform: uppercase;

      color: ${dark ? "#94a3b8" : "#64748b"};

      opacity: 0;

      animation:
        tagReveal .5s 1s cubic-bezier(.16,1,.3,1) forwards;
    }


    /* ================================================================
       LOGO ENTRANCE
       ================================================================ */

    @keyframes logoEntrance {

      0% {
        opacity: 0;

        transform:
          scale(.45)
          rotate(-18deg);
      }

      35% {
        opacity: 1;

        transform:
          scale(1.08)
          rotate(8deg);
      }

      60% {
        transform:
          scale(.96)
          rotate(-4deg);
      }

      80% {
        transform:
          scale(1.025)
          rotate(1.5deg);
      }

      100% {
        opacity: 1;

        transform:
          scale(1)
          rotate(0deg);
      }
    }


    /* ================================================================
       TOP PIECE
       
       The "cap" opens away from the center, rotates,
       overshoots, then returns to its real position.
       ================================================================ */

    @keyframes topFormation {

      0% {
        opacity: 0;

        transform:
          translate(-12px, 28px)
          rotate(-38deg)
          scale(.72);
      }

      16% {
        opacity: 1;

        transform:
          translate(-22px, -2px)
          rotate(-48deg)
          scale(.9);
      }

      31% {
        transform:
          translate(17px, -16px)
          rotate(31deg)
          scale(1.08);
      }

      45% {
        transform:
          translate(-12px, 8px)
          rotate(-15deg)
          scale(.96);
      }

      60% {
        transform:
          translate(7px, -5px)
          rotate(8deg)
          scale(1.03);
      }

      75% {
        transform:
          translate(-3px, 2px)
          rotate(-2deg)
          scale(1.01);
      }

      88% {
        transform:
          translate(1px, -1px)
          rotate(.8deg)
          scale(1);
      }

      100% {
        transform:
          translate(0, 0)
          rotate(0)
          scale(1);
      }
    }


    /* ================================================================
       BODY PIECE

       The lower part unfolds separately and then locks into place.
       ================================================================ */

    @keyframes bodyFormation {

      0% {
        opacity: 0;

        transform:
          translate(15px, -17px)
          rotate(34deg)
          scale(.7);
      }

      18% {
        opacity: 1;

        transform:
          translate(24px, 5px)
          rotate(45deg)
          scale(.86);
      }

      34% {
        transform:
          translate(-15px, 16px)
          rotate(-28deg)
          scale(1.08);
      }

      49% {
        transform:
          translate(10px, -6px)
          rotate(13deg)
          scale(.96);
      }

      65% {
        transform:
          translate(-5px, 4px)
          rotate(-5deg)
          scale(1.03);
      }

      80% {
        transform:
          translate(2px, -2px)
          rotate(2deg)
          scale(1);
      }

      100% {
        transform:
          translate(0, 0)
          rotate(0)
          scale(1);
      }
    }


    /* ================================================================
       PINK SIGNAL LINE
       ================================================================ */

    @keyframes lineFormation {

      0% {
        opacity: 0;

        transform:
          translate(18px, -22px)
          rotate(80deg)
          scaleY(.2);
      }

      20% {
        opacity: 1;

        transform:
          translate(20px, 5px)
          rotate(115deg)
          scaleY(1.2);
      }

      38% {
        transform:
          translate(-13px, -5px)
          rotate(-50deg)
          scaleY(.8);
      }

      55% {
        transform:
          translate(7px, 3px)
          rotate(20deg)
          scaleY(1.1);
      }

      75% {
        transform:
          translate(-2px, 0)
          rotate(-3deg)
          scaleY(1);
      }

      100% {
        transform:
          translate(0, 0)
          rotate(0)
          scaleY(1);
      }
    }


    /* ================================================================
       PINK DOT
       ================================================================ */

    @keyframes dotFormation {

      0% {
        opacity: 0;

        transform:
          translate(30px, 20px)
          scale(.1);
      }

      18% {
        opacity: 1;

        transform:
          translate(12px, -15px)
          scale(1.35);
      }

      34% {
        transform:
          translate(-10px, 9px)
          scale(.75);
      }

      52% {
        transform:
          translate(6px, -4px)
          scale(1.15);
      }

      72% {
        transform:
          translate(-2px, 1px)
          scale(.96);
      }

      100% {
        transform:
          translate(0, 0)
          scale(1);
      }
    }


    /* ================================================================
       SHADOW
       ================================================================ */

    @keyframes shadowMove {

      0% {
        opacity: 0;
        transform: scale(.4);
      }

      25% {
        opacity: .5;
        transform: scale(1.15);
      }

      45% {
        transform: scale(.8);
      }

      65% {
        transform: scale(1.08);
      }

      100% {
        opacity: .7;
        transform: scale(1);
      }
    }


    /* ================================================================
       WORD REVEAL
       ================================================================ */

    @keyframes wordReveal {

      0% {
        opacity: 0;

        transform:
          translateY(16px)
          scale(.9);

        filter: blur(5px);
      }

      70% {
        opacity: 1;

        transform:
          translateY(-2px)
          scale(1.02);

        filter: blur(0);
      }

      100% {
        opacity: 1;

        transform:
          translateY(0)
          scale(1);

        filter: blur(0);
      }
    }


    /* ================================================================
       TAGLINE
       ================================================================ */

    @keyframes tagReveal {

      from {
        opacity: 0;
        transform: translateY(8px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }


    /* ================================================================
       REDUCED MOTION
       ================================================================ */

    ${
      reduceMotion
        ? `
        #uniai-intro *,
        #uniai-intro *::before,
        #uniai-intro *::after {
          animation: none !important;
          transition: none !important;
        }

        #uniai-intro .ui-logo-wrap,
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
  // Markup
  // -------------------------------------------------------------------------

  const intro = document.createElement("div");

  intro.id = "uniai-intro";

  intro.setAttribute("role", "status");
  intro.setAttribute("aria-label", "Loading UniAI");

  intro.innerHTML = `
    <div class="ui-center">

      <div class="ui-logo-wrap">

        <div class="logo-shadow"></div>

        <svg
          class="ui-logo"
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
                offset="100%"
                stop-color="#a15bff"
              />
            </linearGradient>

          </defs>


          <!--
            TOP / CAP
            This is intentionally a separate element
            so it can physically move.
          -->

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


          <!--
            LOWER BODY
          -->

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


          <!--
            PINK SIGNAL
          -->

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


          <!--
            PINK DOT
          -->

          <circle
            class="logo-dot"
            cx="29"
            cy="10"
            r="2.6"
            fill="#ec4899"
          />

        </svg>

      </div>


      <div class="ui-word">
        Uni<span>AI</span>
      </div>

      <div class="ui-tag">
        Plan smarter. Go farther.
      </div>

    </div>
  `;


  // -------------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------------

  document.head.appendChild(style);

  (document.body || document.documentElement)
    .appendChild(intro);


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
    }, FADE_MS + 50);
  }


  // -------------------------------------------------------------------------
  // Auto close
  // -------------------------------------------------------------------------

  const timer = setTimeout(
    finish,
    reduceMotion ? 500 : SHOW_MS
  );


  // -------------------------------------------------------------------------
  // Skip
  // -------------------------------------------------------------------------

  function skip() {
    clearTimeout(timer);
    finish();
  }

  intro.addEventListener("click", skip);

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

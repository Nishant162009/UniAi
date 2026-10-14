/* ==========================================================================
   UniAI — iPhone / iPad (Safari) fixes (ios.js)

   Does nothing on other devices. On iOS it fixes the things that look
   "off" on an iPhone even though they are fine on desktop and Android:

     1. Zoom-on-focus. Safari zooms the whole page when you tap an input whose
        text is smaller than 16px (most of yours are 13-15px). Inputs are
        raised to 16px.
     2. 100vh. Safari counts the area behind its address/tool bar, so the
        mobile sidebar's bottom items sit under the toolbar. Uses 100dvh.
     3. Safe areas. Adds viewport-fit=cover (without it every
        env(safe-area-inset-*) in your CSS is 0) and pads the page and the
        scroll-to-top button away from the notch and home indicator.
     4. Keyboard. When the keyboard opens, lifts the Uni Buddy panel above it
        and scrolls the focused input in modals into view.
     5. Tap feel. Removes the double-tap-zoom delay on buttons and links.
     6. Safari toolbar colour follows the current UniAI theme (theme-color).
     7. Back/forward cache. Safari restores pages from memory on "Back"; this
        re-syncs with the account when that happens.
     8. Asks Safari not to evict saved data (it deletes localStorage after
        7 days without a visit; this only helps installed web apps — account
        sync is the real safety net).

   Load anywhere (it is tiny), ideally in <head> with defer:
     <script src="JS/ios.js" defer></script>

   Also add to <head> in index.html (cannot be set from JS):
     <meta name="apple-mobile-web-app-capable" content="yes">
     <meta name="apple-mobile-web-app-title" content="UniAI">
     <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">  (180x180 PNG)
   ========================================================================== */

(function () {
  "use strict";

  const ua = navigator.userAgent || "";
  // iPadOS reports itself as a Mac, so also look for a touch screen.
  const isIOS = /iP(hone|od|ad)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  const root = document.documentElement;
  root.classList.add("is-ios");

  const standalone =
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (standalone) root.classList.add("is-standalone");

  /* ---------- 3a. viewport-fit=cover ---------- */

  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !/viewport-fit/i.test(viewport.getAttribute("content") || "")) {
    viewport.setAttribute("content", viewport.getAttribute("content") + ", viewport-fit=cover");
  }

  /* ---------- 1, 2, 3b, 4, 5: CSS (only ever applied under html.is-ios) ---------- */

  const style = document.createElement("style");
  style.id = "ios-fixes";
  style.textContent = [
    "html.is-ios{-webkit-text-size-adjust:100%}",

    /* 5. no double-tap zoom delay, no grey tap flash */
    "html.is-ios a,html.is-ios button,html.is-ios [role=button],html.is-ios label,html.is-ios select,html.is-ios summary{touch-action:manipulation;-webkit-tap-highlight-color:transparent}",

    /* 1. 16px inputs stop Safari's zoom-on-focus (the OTP boxes are already larger) */
    "html.is-ios input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not(.ax-otp-box),html.is-ios select,html.is-ios textarea{font-size:16px!important}",

    /* 2. dynamic viewport height */
    "@supports (height:100dvh){html.is-ios .sidebar{height:100dvh}html.is-ios .app-shell{min-height:100dvh}}",

    /* 3b. keep content off the notch (landscape) and controls off the home indicator */
    "html.is-ios .main-col{padding-left:max(28px,env(safe-area-inset-left,0px));padding-right:max(28px,env(safe-area-inset-right,0px))}",
    "@media(max-width:820px){html.is-ios .main-col{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}",
    "html.is-ios .top-scroll-btn{bottom:calc(26px + env(safe-area-inset-bottom,0px));right:calc(26px + env(safe-area-inset-right,0px))}",

    /* 4. Uni Buddy panel rides above the keyboard */
    "html.is-ios.kb-open .uni-buddy-panel{bottom:calc(var(--kb,0px) + 10px);height:min(600px,calc(var(--vvh,100dvh) - 20px))}"
  ].join("\n");
  document.head.appendChild(style);

  /* ---------- 4. keyboard ---------- */

  const vv = window.visualViewport;

  function onViewport() {
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    root.style.setProperty("--kb", covered + "px");
    root.style.setProperty("--vvh", vv.height + "px");
    root.classList.toggle("kb-open", covered > 120);
  }

  if (vv) {
    vv.addEventListener("resize", onViewport);
    vv.addEventListener("scroll", onViewport);
    onViewport();
  }

  document.addEventListener("focusin", (event) => {
    const el = event.target;
    if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if (!el.closest(".overlay, .ue-modal, .uni-buddy-panel, .ax-modal")) return;

    // Wait for the keyboard animation, then make sure the field is visible.
    setTimeout(() => {
      try {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (err) {
        /* ignore */
      }
    }, 320);
  });

  /* ---------- 6. Safari toolbar colour follows the theme ---------- */

  function syncThemeColor() {
    const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
    if (!bg) return;

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", bg);
  }

  new MutationObserver(syncThemeColor).observe(root, { attributes: true, attributeFilter: ["data-theme", "style"] });

  /* ---------- 7. back/forward cache ---------- */

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;

    syncThemeColor();
    try {
      if (window.UniAISync) window.UniAISync.syncNow();
    } catch (err) {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("uniai:resume"));
  });

  /* ---------- 8. ask Safari to keep the data ---------- */

  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  } catch (err) {
    /* ignore */
  }

  function boot() {
    syncThemeColor();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.UniAIiOS = { standalone: standalone };
})();
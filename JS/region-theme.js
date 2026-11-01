/* ==========================================================================
   UniAI — Destination themes (JS/region-theme.js)   [v2 — replaces the old file]

   Everything VISUAL about the country dashboard: palettes, the dark dashboard
   CSS, SVG flags (Windows cannot draw flag emoji — they show as "US", "GB"),
   generated night-scene art (fallback when a photo is missing) and the mascot.
   region.js owns data + behaviour. Load order does not matter.

   All class names start with "ct-" (the old "rg-" names collide with leftover
   rules in dashboard-premium.css).

   API
     UniAITheme.apply(id)    set the palette ("world" resets)
     UniAITheme.flag(id)     flag as inline SVG
     UniAITheme.art(id)      generated hero scene (SVG string)
     UniAITheme.mascot(id)   generated mascot (SVG string)
     UniAITheme.add(id, def) register a palette for a new destination
   ========================================================================== */

(function () {
  "use strict";
  if (window.UniAITheme) return;

  const THEMES = {
    world: { p: "#7c5cff", p2: "#4f8cff", glow: "#b7a6ff", sky: ["#0b0d1c", "#1a1b3a", "#2d2a5e"], ink: "#080a18" },
    us: { p: "#6d5efc", p2: "#a855f7", glow: "#a78bfa", sky: ["#080c2a", "#241a66", "#7a3fa0"], ink: "#070a20" },
    jp: { p: "#7c5cff", p2: "#d946ef", glow: "#f9a8d4", sky: ["#150e38", "#52277f", "#e0709f"], ink: "#120a2b", petal: "#fbcfe8" },
    uk: { p: "#6d6cff", p2: "#4f46e5", glow: "#b7a6ff", sky: ["#09112a", "#1c2b5e", "#6b4a78"], ink: "#080e22", name: ["#c4b5fd", "#5b5bf0"] },
    de: { p: "#7c5cff", p2: "#6366f1", glow: "#b7a6ff", sky: ["#100d0a", "#3a2814", "#b4531a"], ink: "#0d0a08", name: ["#fde68a", "#f59e0b"] },
    kr: { p: "#7c5cff", p2: "#6366f1", glow: "#b7a6ff", sky: ["#06162a", "#103a62", "#5a68d4"], ink: "#05111f", name: ["#a78bfa", "#6d7cff"] }
  };

  /* -------------------------------- flags -------------------------------- */

  const FLAGS = {
    us: () => `<rect width="30" height="20" fill="#fff"/>${[0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y="${(i * 20 / 13).toFixed(2)}" width="30" height="${(20 / 13).toFixed(2)}" fill="#b22234"/>`).join("")}<rect width="12.5" height="10.8" fill="#3c3b6e"/>${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => `<circle cx="${(1.5 + c * 2.4 + (r % 2) * 1.2).toFixed(1)}" cy="${(1.4 + r * 2.4).toFixed(1)}" r=".45" fill="#fff"/>`).join("")).join("")}`,
    jp: () => `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>`,
    uk: () => `<rect width="30" height="20" fill="#012169"/><path d="M0 0 30 20M30 0 0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" stroke-width="1.5"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6.5"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.5"/>`,
    de: () => `<rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/><rect y="13.33" width="30" height="6.67" fill="#ffce00"/>`,
    kr: () => {
      const tri = (a) => `<g transform="rotate(${a} 15 10) translate(15 2.4)" fill="#000"><rect x="-2.6" y="0" width="5.2" height=".85"/><rect x="-2.6" y="1.35" width="5.2" height=".85"/><rect x="-2.6" y="2.7" width="5.2" height=".85"/></g>`;
      return `<rect width="30" height="20" fill="#fff"/><path d="M10.5 10a4.5 4.5 0 0 1 9 0z" fill="#cd2e3a"/><path d="M19.5 10a4.5 4.5 0 0 1-9 0z" fill="#0047a0"/>${[56.3, 123.7, 236.3, 303.7].map(tri).join("")}`;
    }
  };

  function flag(id) {
    if (!FLAGS[id]) return `<span class="ct-globe" aria-hidden="true">🌍</span>`;
    return `<svg class="ct-flag" viewBox="0 0 30 20" role="img" aria-label="${id} flag" preserveAspectRatio="none">${FLAGS[id]()}</svg>`;
  }

  /* ------------------------------ scene art ------------------------------ */

  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function stars(seed) {
    const r = rng(seed); let out = "";
    for (let i = 0; i < 46; i++) out += `<circle cx="${(r() * 800).toFixed(0)}" cy="${(r() * 230).toFixed(0)}" r="${(r() * 1.3 + 0.3).toFixed(1)}" fill="#fff" opacity="${(r() * 0.6 + 0.2).toFixed(2)}"/>`;
    return out;
  }

  function skyline(seed, x0, x1, base, minH, maxH) {
    const r = rng(seed); let x = x0, out = "";
    while (x < x1) {
      const w = 18 + r() * 34, h = minH + r() * (maxH - minH);
      out += `<rect x="${x.toFixed(0)}" y="${(base - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>`;
      for (let k = 0; k < 4; k++) if (r() > 0.45) out += `<rect class="ct-win" x="${(x + 4 + r() * (w - 9)).toFixed(0)}" y="${(base - h + 8 + r() * (h - 16)).toFixed(0)}" width="2" height="3"/>`;
      x += w + r() * 3;
    }
    return out;
  }

  const LANDMARK = {
    world: () => `<circle cx="610" cy="250" r="120" fill="none" stroke="var(--ct-glow)" stroke-opacity=".35"/><circle cx="610" cy="250" r="80" fill="none" stroke="var(--ct-glow)" stroke-opacity=".25"/>`,
    us: () => `<g fill="var(--ct-ink)"><rect x="575" y="300" width="80" height="120"/><path d="M598 300 L608 214 Q620 192 632 214 L642 300Z"/><circle cx="620" cy="198" r="13"/><path d="M606 190 l-6-12 8 6 4-12 4 12 4-12 4 12 8-6 -6 12z"/><path d="M634 208 L662 138" stroke="var(--ct-ink)" stroke-width="9" stroke-linecap="round"/></g><ellipse cx="664" cy="128" rx="13" ry="18" fill="var(--ct-glow)" opacity=".9"/>`,
    jp: () => `<polygon fill="#2a1a55" points="360,420 556,150 604,150 800,420"/><polygon fill="#f3e8ff" opacity=".92" points="516,212 556,150 604,150 644,212 620,200 598,222 572,198 546,222"/><g fill="#e11d48"><rect x="470" y="318" width="10" height="102"/><rect x="530" y="318" width="10" height="102"/><rect x="458" y="308" width="94" height="10" rx="3"/><rect x="466" y="328" width="78" height="6"/></g>`,
    uk: () => `<g fill="var(--ct-ink)"><rect x="640" y="140" width="46" height="280"/><polygon points="640,140 663,76 686,140"/><rect x="654" y="60" width="18" height="20"/></g><circle cx="663" cy="176" r="15" fill="var(--ct-glow)" opacity=".95"/><circle cx="663" cy="176" r="15" fill="none" stroke="var(--ct-ink)" stroke-width="2"/><g fill="var(--ct-ink)"><rect x="470" y="300" width="22" height="120"/><rect x="560" y="300" width="22" height="120"/><rect x="470" y="300" width="112" height="12"/></g>`,
    de: () => `<g fill="var(--ct-ink)"><rect x="470" y="236" width="300" height="22"/><rect x="480" y="214" width="280" height="22"/><rect x="590" y="176" width="60" height="38"/><path d="M606 176 l14-30 14 30z"/>${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${486 + i * 50}" y="258" width="18" height="162"/>`).join("")}</g>`,
    kr: () => `<g fill="var(--ct-ink)"><rect x="632" y="160" width="6" height="260"/><ellipse cx="635" cy="208" rx="26" ry="10"/><rect x="629" y="120" width="12" height="46"/><path d="M420 420 Q520 240 640 300 T800 330 V420z"/></g><circle cx="635" cy="208" r="5" fill="var(--ct-glow)"/>`
  };

  function art(id) {
    const t = THEMES[id] || THEMES.world;
    const r = rng(id.length * 977 + id.charCodeAt(0));
    const petals = t.petal ? Array.from({ length: 16 }, () => `<circle class="ct-petal" style="--d:${(r() * 8 + 6).toFixed(1)}s;--x:${(r() * 60 - 30).toFixed(0)}px;animation-delay:-${(r() * 10).toFixed(1)}s" cx="${(300 + r() * 480).toFixed(0)}" cy="${(r() * 300).toFixed(0)}" r="${(r() * 2.2 + 1.6).toFixed(1)}" fill="${t.petal}"/>`).join("") : "";
    return `<svg class="ct-art-svg" viewBox="0 0 800 420" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <defs><linearGradient id="ctSky-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.sky[0]}"/><stop offset=".55" stop-color="${t.sky[1]}"/><stop offset="1" stop-color="${t.sky[2]}"/></linearGradient></defs>
      <rect width="800" height="420" fill="url(#ctSky-${id})"/>${stars(id.length * 31 + 7)}
      <circle cx="720" cy="70" r="26" fill="${t.glow}" opacity=".18"/><circle cx="720" cy="70" r="14" fill="#fff" opacity=".85"/>
      <g style="--ct-ink:${t.ink};--ct-glow:${t.glow}">${(LANDMARK[id] || LANDMARK.world)()}<g fill="${t.ink}">${skyline(id.length * 13 + 3, 300, 800, 420, 36, 120)}</g></g>${petals}
    </svg>`;
  }

  function mascot(id) {
    return `<svg class="ct-mascot-svg" viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="ctM-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--ct-glow)"/><stop offset="1" stop-color="var(--ct-p)"/></linearGradient></defs>
      <line x1="60" y1="22" x2="60" y2="12" stroke="var(--ct-glow)" stroke-width="3"/><circle cx="60" cy="10" r="4" fill="var(--ct-glow)"/>
      <circle cx="60" cy="66" r="38" fill="url(#ctM-${id})"/><rect x="32" y="50" width="56" height="34" rx="17" fill="#0b0d1c"/>
      <circle cx="48" cy="67" r="6" fill="#67e8f9"/><circle cx="72" cy="67" r="6" fill="#67e8f9"/>
      <polygon points="60,20 100,34 60,46 20,34" fill="#141733"/><rect x="52" y="44" width="16" height="9" fill="#141733"/>
      <path d="M96 34 v22" stroke="var(--ct-glow)" stroke-width="3"/><circle cx="96" cy="58" r="3.5" fill="var(--ct-glow)"/>
    </svg>`;
  }

  /* ------------------------------- the CSS ------------------------------- */

  const CSS = `
  /* The home page is a 2-column grid (1fr 340px): span both so we get the full width. */
  html{--ct-p:#7c5cff;--ct-p2:#a855f7;--ct-glow:#b7a6ff}
  #countryHome,.ct-modal{--ct-bg:#0a0c1f;--ct-card:#12152e;--ct-card2:rgba(255,255,255,.045);--ct-card3:#0f1230;--ct-line:rgba(255,255,255,.09);--ct-text:#f4f5fb;--ct-muted:#a6abc9;--ct-link:var(--ct-glow);--ct-accent-text:#cbbfff}
  html[data-theme="light"] #countryHome,html[data-theme="light"] .ct-modal{--ct-bg:#eef0fb;--ct-card:#ffffff;--ct-card2:rgba(20,24,60,.05);--ct-card3:#f5f6fd;--ct-line:rgba(20,24,60,.12);--ct-text:#161a33;--ct-muted:#59607f;--ct-link:var(--ct-p);--ct-accent-text:var(--ct-p)}
  html[data-theme="light"] .ct-card{box-shadow:0 8px 26px -16px rgba(30,30,90,.3)}
  #countryHome{grid-column:1/-1;background:var(--ct-bg);color:var(--ct-text);border-radius:26px;padding:16px;margin:0 0 20px;font-family:inherit;min-width:0;border:1px solid var(--ct-line)}
  #countryHome *{box-sizing:border-box}
  #countryHome button{font:inherit;cursor:pointer}
  #countryHome a{color:inherit;text-decoration:none}
  #homePage.ct-active>:not(.homepage-promo-banner):not(#countryHome){display:none!important}

  .ct-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
  .ct-main,.ct-side{display:grid;gap:16px;min-width:0}
  .ct-card{background:var(--ct-card);border:1px solid var(--ct-line);border-radius:20px;padding:18px;min-width:0}
  .ct-card h3{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em;color:var(--ct-text)}
  .ct-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  .ct-link{background:none;border:0;color:var(--ct-link);font-size:13px;font-weight:700;padding:0}
  .ct-flag{display:inline-block;width:60px;height:40px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,.45);flex:none;vertical-align:middle}
  .ct-globe{font-size:28px}

  /* hero */
  .ct-hero{position:relative;overflow:hidden;border-radius:22px;min-height:370px;padding:24px 28px 26px;isolation:isolate;border:1px solid var(--ct-line);color:#fff}
  .ct-art{position:absolute;inset:0;z-index:-2}
  .ct-art-svg{width:100%;height:100%;display:block}
  .ct-photo{position:absolute;right:0;top:0;height:100%;width:auto;max-width:82%;object-fit:cover;object-position:right center;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 30%);mask-image:linear-gradient(90deg,transparent 0,#000 30%)}
  .ct-hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(7,9,26,.55) 0%,rgba(7,9,26,.15) 45%,transparent 70%)}
  .ct-back{background:none;border:0;color:#dfe2ff;font-size:14px;padding:0;margin-bottom:14px;display:inline-flex;gap:8px;align-items:center}
  .ct-back:hover{color:#fff}
  .ct-studyin{display:flex;align-items:center;gap:14px;font-size:34px;font-weight:800;line-height:1}
  .ct-hero.compact .ct-studyin{font-size:20px;gap:10px}.ct-hero.compact .ct-flag{width:46px;height:31px}
  .ct-name{margin:2px 0 6px;font-size:clamp(60px,8.4vw,104px);font-weight:900;line-height:1.02;letter-spacing:-.025em}
  .ct-name span{background:linear-gradient(180deg,var(--ct-n1,#c4b5fd) 0%,var(--ct-n2,#7c5cff) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 18px rgba(124,92,255,.45))}
  .ct-tag{font-size:21px;font-weight:800;margin:0 0 8px;max-width:600px}
  .ct-tag em{font-style:normal;color:#b79cff}
  .ct-sub{margin:0 0 20px;max-width:460px;color:#dcdff6;font-size:15.5px;line-height:1.5}
  .ct-cta{display:flex;gap:12px;flex-wrap:wrap}
  .ct-btn{border-radius:12px;padding:12px 20px;font-weight:700;border:1px solid transparent;display:inline-flex;gap:8px;align-items:center;font-size:14.5px}
  .ct-btn.pri{background:linear-gradient(90deg,#5b4bf5,#7c5cff);color:#fff;box-shadow:0 8px 24px -10px #7c5cff}
  .ct-btn.ghost{background:rgba(8,10,28,.5);color:#fff;border-color:rgba(255,255,255,.4)}
  .ct-petal{animation:ctFall var(--d) linear infinite}
  @keyframes ctFall{from{transform:translate(0,-20px)}to{transform:translate(var(--x),340px)}}
  .ct-win{fill:#ffd98a;opacity:.7}

  /* tabs */
  .ct-tabs{display:flex;gap:2px;overflow-x:auto;padding:6px;border:1px solid var(--ct-line);border-radius:16px;background:var(--ct-card);scrollbar-width:none}
  .ct-tabs::-webkit-scrollbar{display:none}
  .ct-tab{flex:1 0 auto;white-space:nowrap;background:none;border:0;border-bottom:2px solid transparent;color:var(--ct-muted);padding:12px 16px;font-size:13.5px;font-weight:600;border-radius:10px;display:flex;gap:9px;align-items:center;justify-content:center}
  .ct-tab:hover{color:var(--ct-text);background:var(--ct-card2)}
  .ct-tab.on{color:var(--ct-link);border-bottom-color:var(--ct-p)}

  /* stats (Japan) */
  .ct-stats{display:grid;grid-template-columns:repeat(var(--n,5),minmax(0,1fr));gap:6px;padding:12px 14px}
  .ct-stat{display:flex;gap:12px;align-items:center;padding:4px 6px;min-width:0}
  .ct-ic{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(124,92,255,.16);border:1px solid rgba(124,92,255,.35);font-size:19px;flex:none}
  .ct-stat b{display:block;font-size:19px;line-height:1.1}
  .ct-stat small{color:var(--ct-muted);font-size:12px;line-height:1.25;display:block}

  /* universities */
  .ct-unis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .ct-uni{position:relative;text-align:left;border:1px solid var(--ct-line);border-radius:16px;overflow:hidden;background:var(--ct-card3);color:var(--ct-text);padding:0;transition:.18s;display:block;width:100%}
  .ct-uni:hover{transform:translateY(-3px);border-color:var(--ct-p)}
  .ct-uni-img{height:104px;background:linear-gradient(135deg,var(--ct-p),var(--ct-p2));display:grid;place-items:center;font-size:30px;font-weight:800;color:rgba(255,255,255,.85);position:relative;overflow:hidden}
  .ct-uni-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .ct-rank{position:absolute;top:8px;right:8px;background:rgba(8,10,28,.75);color:#fff;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:800}
  .ct-uni-body{padding:12px 13px 14px;position:relative}
  .ct-uni-body b{display:block;font-size:14.5px;line-height:1.25;min-height:36px}
  .ct-uni-body small{display:block;color:var(--ct-muted);font-size:12.5px;margin:2px 0 8px}
  .ct-tags{display:flex;gap:6px;flex-wrap:wrap;padding-right:34px}
  .ct-tags span{font-size:11px;border:1px solid rgba(124,92,255,.5);color:var(--ct-accent-text);border-radius:6px;padding:2px 8px}
  .ct-go{position:absolute;right:12px;bottom:12px;width:30px;height:30px;border-radius:50%;background:var(--ct-card2);display:grid;place-items:center;font-size:15px}

  /* guides */
  .ct-guides{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .ct-guide{display:flex;align-items:stretch;border:1px solid var(--ct-line);border-radius:14px;overflow:hidden;background:var(--ct-card3);min-height:104px;transition:.18s}
  .ct-guide:hover{border-color:var(--ct-p);transform:translateY(-2px)}
  .ct-gi{width:88px;flex:none;background:linear-gradient(135deg,var(--ct-p),var(--ct-p2));display:grid;place-items:center;font-size:28px;position:relative;overflow:hidden}
  .ct-gi img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .ct-gt{padding:12px;display:flex;flex-direction:column;justify-content:space-between;min-width:0}
  .ct-gt b{font-size:14px;line-height:1.25}
  .ct-gt small{color:var(--ct-link);font-size:12.5px;font-weight:700}

  /* right column */
  .ct-facts{display:grid;gap:15px}
  .ct-fact{display:flex;gap:13px;align-items:flex-start}
  .ct-fact small{display:block;color:var(--ct-muted);font-size:12.5px;line-height:1.3}
  .ct-fact b{font-size:14.5px;line-height:1.35;display:block}
  .ct-fact i{display:block;font-style:normal;font-size:12px;color:var(--ct-muted)}
  .ct-info{width:22px;height:22px;border-radius:50%;background:rgba(124,92,255,.25);color:var(--ct-accent-text);font-size:12px;display:grid;place-items:center;font-weight:800}
  .ct-note{margin:12px 0 0;font-size:11px;color:var(--ct-muted);line-height:1.4}
  .ct-wide{width:100%;margin-top:14px;justify-content:center;background:transparent;border:1px solid var(--ct-p);color:var(--ct-accent-text)}
  .ct-wide:hover{background:rgba(124,92,255,.15)}

  .ct-ai{position:relative;overflow:hidden;min-height:340px}
  .ct-ai-head{display:flex;align-items:center;gap:8px}
  .ct-ai-head h3{font-size:15px}
  .ct-ai-dot{width:26px;height:26px;border-radius:50%;background:rgba(124,92,255,.3);display:grid;place-items:center;font-size:13px}
  .ct-beta{font-size:10px;background:rgba(124,92,255,.25);color:var(--ct-accent-text);border-radius:6px;padding:1px 7px;font-weight:800}
  .ct-mascot{position:absolute;right:6px;top:30px;width:128px;height:128px;pointer-events:none}
  .ct-mascot img,.ct-mascot svg{width:100%;height:100%;object-fit:contain;display:block}
  .ct-hello{position:relative;margin:86px 0 12px;font-size:14.5px;line-height:1.45;max-width:230px}
  .ct-hello .ct-flag{width:18px;height:12px;border-radius:2px;margin-left:4px;vertical-align:-1px}
  .ct-sugg{display:grid;gap:8px;margin-bottom:14px;position:relative}
  .ct-sugg button{text-align:left;border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:10px;padding:8px 12px;font-size:12.5px}
  .ct-sugg button:hover{border-color:var(--ct-p)}
  .ct-ask{display:flex;gap:8px;position:relative}
  .ct-ask input{flex:1;min-width:0;border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:10px;padding:11px 12px;font:inherit;font-size:13px;outline:none}
  .ct-ask input:focus{border-color:var(--ct-p)}
  .ct-ask button{width:44px;border:0;border-radius:10px;color:#fff;background:linear-gradient(90deg,#5b4bf5,#7c5cff)}

  .ct-why{position:relative;overflow:hidden}
  .ct-why h3{font-size:16px;margin-bottom:12px}
  .ct-why ul{list-style:none;margin:0;padding:0;display:grid;gap:9px;position:relative}
  .ct-why li{display:flex;gap:10px;font-size:13px;align-items:center}
  .ct-why li::before{content:"✓";width:18px;height:18px;border-radius:50%;background:#16a34a;color:#fff;font-size:11px;display:grid;place-items:center;flex:none}
  .ct-why .ct-flag{position:absolute;right:14px;bottom:14px;width:104px;height:70px;opacity:.9;transform:rotate(-6deg)}

  /* chooser (opens from the hero button) */
  .ct-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(4,6,18,.72);backdrop-filter:blur(6px)}
  .ct-modal[hidden]{display:none}
  .ct-sheet{width:min(920px,100%);max-height:92vh;overflow:auto;background:var(--ct-bg);color:var(--ct-text);border:1px solid var(--ct-line);border-radius:24px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .ct-sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
  .ct-sheet-head h2{margin:0;font-size:22px}.ct-sheet-head p{margin:4px 0 0;color:var(--ct-muted);font-size:14px}
  .ct-x{border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:10px;width:36px;height:36px;font-size:18px;cursor:pointer}
  .ct-choices{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
  .ct-choice{position:relative;overflow:hidden;text-align:left;border:2px solid transparent;border-radius:18px;padding:16px;min-height:150px;color:#fff;background:#111;cursor:pointer;transition:.18s;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;isolation:isolate}
  .ct-choice:hover{transform:translateY(-3px);border-color:var(--ct-glow,#b7a6ff)}
  .ct-choice.on{border-color:#fff}
  .ct-choice .ct-art-svg,.ct-choice>img{position:absolute;inset:0;width:100%;height:100%;z-index:-2;object-fit:cover}
  .ct-choice::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(0deg,rgba(5,7,20,.85),rgba(5,7,20,.1) 70%)}
  .ct-choice .ct-flag{width:36px;height:24px;margin-bottom:6px}
  .ct-choice b{font-size:17px}.ct-choice small{opacity:.88;font-size:12.5px}
  .ct-world-row{margin-top:14px;display:flex;justify-content:center}
  .ct-world-btn{border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:12px;padding:11px 20px;font-weight:700;cursor:pointer}
  .ct-world-btn.on{background:linear-gradient(90deg,#5b4bf5,#7c5cff);border-color:transparent;color:#fff}

  /* topbar button (beside the theme toggle) — uses the site's own variables, so it follows light/dark */
  .ct-top-btn{display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 15px;border-radius:14px;border:1px solid var(--border,rgba(128,128,160,.3));background:var(--card-bg,transparent);color:var(--text,inherit);font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;flex:none;transition:.15s}
  .ct-top-btn:hover{border-color:var(--ct-p)}
  .ct-top-btn.on{border-color:var(--ct-p);box-shadow:0 0 0 3px color-mix(in srgb,var(--ct-p) 18%,transparent)}
  .ct-top-btn .ct-flag{width:24px;height:16px;border-radius:3px;box-shadow:0 1px 4px rgba(0,0,0,.35)}
  .ct-top-btn .ct-globe{font-size:18px;line-height:1}
  .ct-top-btn .ct-caret{opacity:.6;font-size:11px}

  /* selected country next to the sidebar logo */
  .ct-logo-tag{display:inline-flex;align-items:center;gap:6px;margin-left:4px;padding:3px 10px 3px 7px;border-radius:999px;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:0;white-space:nowrap;color:var(--ct-p);background:color-mix(in srgb,var(--ct-p) 14%,transparent);border:1px solid color-mix(in srgb,var(--ct-p) 38%,transparent)}
  .ct-logo-tag[hidden]{display:none}
  .ct-logo-tag .ct-flag{width:18px;height:12px;border-radius:2px;box-shadow:none}


  /* layout "hero" (UK / Germany / South Korea) */
  .ct-hero.lay2{min-height:340px;padding:22px 28px 26px}
  .ct-hero.lay2 .ct-photo{max-width:68%}
  .ct-hero.lay2::after{background:linear-gradient(90deg,rgba(7,9,26,.72) 0%,rgba(7,9,26,.25) 46%,transparent 72%)}
  .ct-welcome{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:12px;font-size:13px;font-weight:600;background:rgba(124,92,255,.22);border:1px solid rgba(160,140,255,.4);margin-bottom:16px;backdrop-filter:blur(6px)}
  .ct-hero.lay2 .ct-studyin{font-size:clamp(32px,4.4vw,50px);font-weight:800;letter-spacing:-.02em}
  .ct-hero.lay2 .ct-name{font-size:clamp(50px,6.6vw,84px);margin:0 0 8px}
  .ct-hero.lay2 .ct-tag{font-size:24px;margin-bottom:10px}
  .ct-hero.lay2 .ct-sub{max-width:400px;font-size:14.5px}
  .ct-ai.tall{min-height:0}
  .ct-ai.tall .ct-mascot{position:relative;right:auto;top:auto;width:150px;height:150px;margin:8px auto 4px}
  .ct-hello.bubble{margin:0 0 12px;max-width:none;padding:10px 14px;border:1px solid rgba(124,92,255,.45);border-radius:14px;background:rgba(124,92,255,.1);font-size:14px}

  @media(max-width:1180px){.ct-unis,.ct-guides{grid-template-columns:repeat(2,minmax(0,1fr))}.ct-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:1000px){.ct-grid{grid-template-columns:1fr}}
  @media(max-width:900px){.ct-top-btn .ct-label,.ct-top-btn .ct-caret{display:none}.ct-top-btn{padding:0 11px}}
  @media(max-width:560px){#countryHome{padding:10px;border-radius:18px}.ct-hero{padding:18px;min-height:340px}.ct-unis,.ct-guides{grid-template-columns:1fr}.ct-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ct-studyin{font-size:24px}.ct-tag{font-size:17px}}
  @media(prefers-reduced-motion:reduce){.ct-petal{animation:none}}

  /* ===== v3: one layout for every country ===== */
  .ct-hero,.ct-hero.lay2{height:380px;min-height:380px;padding:22px 28px 24px;display:flex;flex-direction:column;align-items:flex-start}
  .ct-hero .ct-studyin{font-size:30px;gap:12px}
  .ct-hero .ct-flag{width:52px;height:35px}
  .ct-hero .ct-name{font-size:clamp(56px,7vw,92px);margin:2px 0 6px;max-width:100%;white-space:nowrap}
  .ct-hero .ct-tag{font-size:21px;margin:0 0 8px}
  .ct-hero .ct-sub{max-width:440px;font-size:15px;margin:0 0 18px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .ct-hero .ct-cta{margin-top:auto}
  .ct-photo{transform-origin:70% 50%;animation:ctDrift 36s ease-in-out infinite alternate}
  @keyframes ctDrift{from{transform:scale(1)}to{transform:scale(1.06)}}
  #countryHome.ct-swap .ct-hero{animation:ctIn .5s cubic-bezier(.2,.8,.2,1)}
  @keyframes ctIn{from{opacity:.0;transform:scale(.99)}to{opacity:1;transform:none}}
  .ct-body.ct-fade{animation:ctFadeBody .28s ease}
  @keyframes ctFadeBody{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .ct-body{display:grid;gap:16px;min-width:0}
  .ct-btn.sm{padding:8px 14px;font-size:13px}
  .ct-btn.ghost.sm{color:var(--ct-text);background:var(--ct-card2);border-color:var(--ct-line)}
  .ct-btn.ghost.sm.on{border-color:var(--ct-p);color:var(--ct-accent-text)}
  button.ct-btn{font:inherit}
  #countryHome :focus-visible{outline:2px solid var(--ct-glow);outline-offset:2px}
  .ct-tab{min-width:0;transition:color .15s,background .15s}
  .ct-tab span{font-size:15px}
  .ct-btn,.ct-chip,.ct-details,.ct-save{transition:background .18s,border-color .18s,transform .18s,box-shadow .18s}
  .ct-btn.pri:hover{transform:translateY(-1px);box-shadow:0 12px 26px -10px #7c5cff}

  /* university cards */
  .ct-uni{display:flex;flex-direction:column;cursor:default}
  .ct-uni:hover{box-shadow:0 14px 34px -18px var(--ct-p)}
  .ct-uni[hidden]{display:none}
  .ct-uni-img{height:112px}
  .ct-uni-img .ct-ph{z-index:0}
  .ct-uni-img::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(8,10,28,.7),transparent 60%);z-index:1}
  .ct-logo{position:absolute;left:10px;bottom:-14px;z-index:3;width:38px;height:38px;border-radius:11px;background:#fff;color:#2b2f55;font-size:13px;font-weight:800;display:grid;place-items:center;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.4);border:2px solid var(--ct-card3)}
  .ct-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;padding:3px}
  .ct-rank{z-index:3}
  .ct-save{position:absolute;top:8px;left:8px;z-index:3;width:32px;height:32px;border-radius:50%;border:0;background:rgba(8,10,28,.65);color:#fff;font-size:16px;display:grid;place-items:center;backdrop-filter:blur(4px)}
  .ct-save:hover{background:rgba(8,10,28,.9);transform:scale(1.08)}
  .ct-save.on{color:#ff6b9a}
  .ct-uni-body{padding:22px 13px 14px;display:flex;flex-direction:column;flex:1}
  .ct-uni-body b{min-height:37px}
  .ct-strength{margin:0 0 10px;font-size:12.5px;line-height:1.4;color:var(--ct-muted);min-height:52px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .ct-tags{padding-right:0;margin-bottom:12px}
  .ct-details{margin-top:auto;align-self:flex-start;background:transparent;border:1px solid var(--ct-p);color:var(--ct-accent-text);border-radius:10px;padding:7px 12px;font-size:12.5px;font-weight:700}
  .ct-details:hover{background:rgba(124,92,255,.16)}
  .ct-filters{display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 14px}
  .ct-chip{border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-muted);border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:600}
  .ct-chip:hover{border-color:var(--ct-p);color:var(--ct-text)}
  .ct-chip.on{background:rgba(124,92,255,.22);border-color:var(--ct-p);color:var(--ct-text)}
  .ct-empty{margin:0;color:var(--ct-muted);font-size:13.5px}
  .ct-skel{color:transparent!important;background:linear-gradient(90deg,var(--ct-card2),rgba(255,255,255,.14),var(--ct-card2));background-size:200% 100%;animation:ctShim 1.2s linear infinite;border-radius:6px}
  @keyframes ctShim{from{background-position:200% 0}to{background-position:-200% 0}}

  /* guides: stacked so four fit in the main column */
  .ct-guide{flex-direction:column;text-align:left;color:var(--ct-text);padding:0;min-height:0;cursor:pointer;font:inherit;width:100%}
  .ct-gi{width:100%;height:76px}
  .ct-gt{padding:11px 12px 12px;gap:4px;flex:1}
  .ct-gt small{color:var(--ct-muted);font-weight:500;font-size:12px;line-height:1.35}
  .ct-gt em{font-style:normal;color:var(--ct-link);font-size:12.5px;font-weight:700;margin-top:auto;padding-top:6px}

  /* panels */
  .ct-rows{display:grid;gap:10px}
  .ct-row{display:flex;gap:14px;justify-content:space-between;align-items:center;padding:14px;border:1px solid var(--ct-line);border-radius:14px;background:var(--ct-card3)}
  .ct-row b{font-size:14.5px}.ct-row p{margin:4px 0 0;color:var(--ct-muted);font-size:13px;line-height:1.45}
  .ct-steps{margin:0;padding-left:0;list-style:none;display:grid;gap:10px;counter-reset:s}
  .ct-steps li{counter-increment:s;display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.5}
  .ct-steps li::before{content:counter(s);flex:none;width:26px;height:26px;border-radius:50%;background:rgba(124,92,255,.2);border:1px solid rgba(124,92,255,.45);display:grid;place-items:center;font-size:12px;font-weight:800;color:var(--ct-accent-text)}
  .ct-bul{margin:0;padding-left:18px;display:grid;gap:9px;font-size:14px;line-height:1.5}
  .ct-kv{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
  .ct-kv div{padding:12px 14px;border:1px solid var(--ct-line);border-radius:14px;background:var(--ct-card3)}
  .ct-kv small{display:block;color:var(--ct-muted);font-size:12px}.ct-kv b{font-size:16px}
  .ct-panel .ct-note{margin-top:14px}
  .ct-muted{margin:4px 0 0;color:var(--ct-muted);font-size:12.5px;line-height:1.4}
  .ct-pill{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:rgba(124,92,255,.2);color:var(--ct-accent-text)}

  /* journey */
  .ct-j-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .ct-j-tile{padding:14px;border:1px solid var(--ct-line);border-radius:14px;background:var(--ct-card3);min-width:0}
  .ct-j-tile.wide{grid-column:span 2}
  .ct-j-tile>small{display:block;color:var(--ct-muted);font-size:12px;margin-bottom:4px}
  .ct-j-tile>b{font-size:24px;line-height:1.1;display:block}
  .ct-bar{display:block;height:6px;border-radius:99px;background:var(--ct-card2);margin-top:8px;overflow:hidden}
  .ct-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ct-p),var(--ct-p2));transition:width .4s ease}
  .ct-checks{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}
  .ct-check{display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer}
  .ct-check input{accent-color:var(--ct-p);width:16px;height:16px}
  .ct-dl{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:6px}
  .ct-dl li{display:flex;align-items:center;gap:10px;font-size:13px}.ct-dl li small{color:var(--ct-muted);margin-left:auto}
  .ct-dl button{background:none;border:0;color:var(--ct-muted);padding:2px 6px}.ct-dl button:hover{color:#ff6b6b}
  .ct-dl-form{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .ct-dl-form input{flex:1 1 140px;min-width:0;border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;color-scheme:dark}
  html[data-theme="light"] .ct-dl-form input{color-scheme:light}

  /* right column stays identical for every country */
  .ct-side .ct-card{min-height:0}
  .ct-fact{min-height:62px}
  .ct-ai{min-height:340px}

  @media(max-width:1180px){.ct-j-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:560px){.ct-hero,.ct-hero.lay2{height:420px;min-height:420px}.ct-hero .ct-name{font-size:clamp(44px,15vw,64px)}.ct-j-grid,.ct-kv,.ct-checks{grid-template-columns:1fr}.ct-j-tile.wide{grid-column:auto}.ct-row{flex-direction:column;align-items:stretch}}
  @media(prefers-reduced-motion:reduce){.ct-photo,.ct-skel,#countryHome.ct-swap .ct-hero,.ct-body.ct-fade{animation:none}}
  `;

  function apply(id) {
    const t = THEMES[id] || THEMES.world;
    const root = document.documentElement;
    root.dataset.region = THEMES[id] ? id : "world";
    const set = (k, v) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k));
    set("--ct-p", t.p); set("--ct-p2", t.p2); set("--ct-glow", t.glow);
    set("--ct-n1", t.name && t.name[0]); set("--ct-n2", t.name && t.name[1]);
  }

  if (!document.getElementById("ct-style")) {
    const el = document.createElement("style");
    el.id = "ct-style"; el.textContent = CSS; document.head.appendChild(el);
  }

  window.UniAITheme = {
    THEMES, apply, art, flag, mascot,
    add(id, def) { THEMES[id] = Object.assign({}, THEMES.world, def); }
  };
})();
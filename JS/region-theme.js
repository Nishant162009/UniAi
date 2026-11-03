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
    world: { p: "#713BFF", p2: "#4285FF", glow: "#B9A2FF", sky: ["#0b0d1c", "#1a1b3a", "#2d2a5e"], ink: "#080a18" },
    us: { p: "#713BFF", p2: "#A16BFF", glow: "#B9A2FF", sky: ["#080c2a", "#241a66", "#7a3fa0"], ink: "#070a20", name: ["#c4b5fd", "#713BFF"] },
    jp: { p: "#713BFF", p2: "#A16BFF", glow: "#F0ABFC", sky: ["#150e38", "#52277f", "#e0709f"], ink: "#120a2b", petal: "#fbcfe8", name: ["#d8b4fe", "#8b5cf6"] },
    uk: { p: "#713BFF", p2: "#4285FF", glow: "#B9A2FF", sky: ["#09112a", "#1c2b5e", "#6b4a78"], ink: "#080e22", name: ["#c4b5fd", "#5b5bf0"] },
    de: { p: "#713BFF", p2: "#A16BFF", glow: "#B9A2FF", sky: ["#100d0a", "#3a2814", "#b4531a"], ink: "#0d0a08", name: ["#fde68a", "#f59e0b"] },
    kr: { p: "#713BFF", p2: "#4285FF", glow: "#B9A2FF", sky: ["#06162a", "#103a62", "#5a68d4"], ink: "#05111f", name: ["#a78bfa", "#6d7cff"] }
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
  html{--ct-p:#713BFF;--ct-p2:#A16BFF;--ct-glow:#B9A2FF}
  #countryHome,.ct-modal{--ct-bg:#050816;--ct-card:#10152B;--ct-card2:#151B35;--ct-card3:#0B1022;--ct-line:rgba(139,130,255,.16);--ct-text:#F8FAFF;--ct-muted:#A6AEC8;--ct-link:var(--ct-glow);--ct-accent-text:#CFC4FF;--ct-shadow:none}
  html[data-theme="light"] #countryHome,html[data-theme="light"] .ct-modal{--ct-bg:#eef0fb;--ct-card:#ffffff;--ct-card2:#f1f2fb;--ct-card3:#f6f7fd;--ct-line:rgba(20,24,60,.12);--ct-text:#161a33;--ct-muted:#59607f;--ct-link:var(--ct-p);--ct-accent-text:var(--ct-p);--ct-shadow:0 8px 26px -16px rgba(30,30,90,.3)}

  /* The home page is a 2-column grid (1fr 340px): span both so the dashboard gets the full width. */
  #countryHome{grid-column:1/-1;background:var(--ct-bg);color:var(--ct-text);border-radius:26px;padding:16px;margin:0 0 20px;font-family:inherit;min-width:0;border:1px solid var(--ct-line)}
  #countryHome *{box-sizing:border-box}
  #countryHome button{font:inherit;cursor:pointer}
  #countryHome a{color:inherit;text-decoration:none}
  #homePage.ct-active>:not(.homepage-promo-banner):not(#countryHome){display:none!important}

  .ct-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}
  .ct-main,.ct-side{display:grid;gap:16px;min-width:0;animation:ctIn .45s cubic-bezier(.2,.8,.2,1) both}
  .ct-side{animation-delay:.06s}
  @keyframes ctIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .ct-card{background:var(--ct-card);border:1px solid var(--ct-line);border-radius:20px;padding:18px;min-width:0;box-shadow:var(--ct-shadow)}
  .ct-card h3{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em;color:var(--ct-text)}
  .ct-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  .ct-link{background:none;border:0;color:var(--ct-link);font-size:13px;font-weight:700;padding:0}
  .ct-link:hover{text-decoration:underline}
  .ct-flag{display:inline-block;width:52px;height:35px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,.45);flex:none;vertical-align:middle}
  .ct-globe{font-size:28px}
  .ct-ic{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(113,59,255,.16);border:1px solid rgba(139,130,255,.32);font-size:18px;flex:none}

  /* skeleton loaders */
  .ct-skel{display:inline-block;width:72px;height:15px;border-radius:6px;vertical-align:middle;background:linear-gradient(90deg,var(--ct-card2) 0%,rgba(139,130,255,.28) 50%,var(--ct-card2) 100%);background-size:200% 100%;animation:ctShim 1.2s linear infinite}
  .ct-skel.wide{display:block;width:100%;height:78px;border-radius:14px}
  @keyframes ctShim{from{background-position:200% 0}to{background-position:-200% 0}}

  /* hero (identical for every country) */
  .ct-hero{position:relative;overflow:hidden;border-radius:22px;height:392px;padding:22px 28px 24px;isolation:isolate;border:1px solid var(--ct-line);color:#fff}
  .ct-art{position:absolute;inset:0;z-index:-2}
  .ct-art-svg{width:100%;height:100%;display:block}
  .ct-photo{position:absolute;right:0;top:0;height:100%;width:auto;max-width:78%;object-fit:cover;object-position:right center;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 30%);mask-image:linear-gradient(90deg,transparent 0,#000 30%);transform-origin:right center;animation:ctKB 28s ease-in-out infinite alternate}
  @keyframes ctKB{from{transform:scale(1)}to{transform:scale(1.07)}}
  .ct-hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(5,8,22,.78) 0%,rgba(5,8,22,.3) 46%,transparent 72%),linear-gradient(0deg,rgba(5,8,22,.55),transparent 38%)}
  .ct-back{background:none;border:0;color:#dfe2ff;font-size:14px;padding:0;margin-bottom:12px;display:inline-flex;gap:8px;align-items:center}
  .ct-back:hover{color:#fff}
  .ct-studyin{display:flex;align-items:center;gap:12px;font-size:28px;font-weight:800;line-height:1}
  .ct-name{margin:4px 0 6px;font-size:clamp(56px,7.6vw,96px);font-weight:900;line-height:1.02;letter-spacing:-.025em}
  .ct-name span{background:linear-gradient(180deg,var(--ct-n1,#c4b5fd) 0%,var(--ct-n2,#713BFF) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 18px rgba(113,59,255,.45))}
  .ct-tag{font-size:21px;font-weight:800;margin:0 0 8px;max-width:600px}
  .ct-tag em{font-style:normal;color:#b79cff}
  .ct-sub{margin:0 0 18px;max-width:470px;color:#dcdff6;font-size:15px;line-height:1.5}
  .ct-cta{display:flex;gap:12px;flex-wrap:wrap}
  .ct-btn{border-radius:12px;padding:12px 20px;font-weight:700;border:1px solid transparent;display:inline-flex;gap:8px;align-items:center;font-size:14.5px;transition:.18s}
  .ct-btn.pri{background:linear-gradient(90deg,#5b2fe8,var(--ct-p));color:#fff;box-shadow:0 8px 24px -10px var(--ct-p)}
  .ct-btn.pri:hover{transform:translateY(-2px);box-shadow:0 12px 28px -10px var(--ct-p)}
  .ct-btn.ghost{background:rgba(8,10,28,.5);color:#fff;border-color:rgba(255,255,255,.4)}
  .ct-btn.ghost:hover{border-color:#fff}
  .ct-petal{animation:ctFall var(--d) linear infinite}
  @keyframes ctFall{from{transform:translate(0,-20px)}to{transform:translate(var(--x),340px)}}
  .ct-win{fill:#ffd98a;opacity:.7}

  /* tabs */
  .ct-tabs{display:flex;gap:2px;overflow-x:auto;padding:6px;border:1px solid var(--ct-line);border-radius:16px;background:var(--ct-card);scrollbar-width:none}
  .ct-tabs::-webkit-scrollbar{display:none}
  .ct-tab{flex:1 0 auto;white-space:nowrap;background:none;border:0;border-bottom:2px solid transparent;color:var(--ct-muted);padding:12px 16px;font-size:13.5px;font-weight:600;border-radius:10px;display:flex;gap:9px;align-items:center;justify-content:center;transition:.18s}
  .ct-tab:hover{color:var(--ct-text);background:var(--ct-card2)}
  .ct-tab.on{color:var(--ct-link);border-bottom-color:var(--ct-p)}

  /* universities */
  .ct-unis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .ct-uni{position:relative;display:flex;flex-direction:column;border:1px solid var(--ct-line);border-radius:16px;overflow:hidden;background:var(--ct-card3);color:var(--ct-text);cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}
  .ct-uni:hover{transform:translateY(-4px);border-color:var(--ct-p);box-shadow:0 16px 34px -18px var(--ct-p)}
  .ct-uni-img{position:relative;height:112px;background:linear-gradient(135deg,var(--ct-p),var(--ct-p2));overflow:hidden}
  .ct-uni-img .ct-ph{position:absolute;inset:0;display:grid;place-items:center;font-size:30px;font-weight:800;color:rgba(255,255,255,.85)}
  .ct-uni-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,.8,.2,1)}
  .ct-uni:hover .ct-uni-img img{transform:scale(1.06)}
  .ct-rank{position:absolute;top:8px;right:8px;background:rgba(5,8,22,.78);color:#fff;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:800}
  .ct-bm{position:absolute;top:8px;left:8px;width:30px;height:30px;border-radius:50%;border:0;background:rgba(5,8,22,.62);color:#fff;font-size:15px;line-height:1;display:grid;place-items:center;backdrop-filter:blur(4px);transition:.18s}
  .ct-bm:hover{background:var(--ct-p)}
  .ct-bm[aria-pressed="true"]{background:var(--ct-p);color:#ffd45a}
  .ct-logo{position:relative;z-index:2;margin:-22px 0 0 12px;width:44px;height:44px;border-radius:12px;background:#fff;color:#4a3cb0;border:2px solid var(--ct-card3);display:grid;place-items:center;font-weight:800;font-size:13px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.3)}
  .ct-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:4px;background:#fff}
  .ct-uni-body{padding:8px 13px 14px;display:flex;flex-direction:column;flex:1}
  .ct-uni-body b{display:block;font-size:14.5px;line-height:1.25;min-height:36px}
  .ct-uni-body small{display:block;color:var(--ct-muted);font-size:12.5px;margin:2px 0 9px}
  .ct-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
  .ct-tags span{font-size:11px;border:1px solid rgba(113,59,255,.5);color:var(--ct-accent-text);border-radius:6px;padding:2px 8px}
  .ct-view{margin-top:auto;width:100%;border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:10px;padding:8px;font-weight:700;font-size:12.5px;transition:.18s}
  .ct-view:hover{background:linear-gradient(90deg,#5b2fe8,var(--ct-p));border-color:transparent;color:#fff}

  /* guides */
  .ct-guides{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .ct-guide{display:flex;align-items:stretch;text-align:left;border:1px solid var(--ct-line);border-radius:14px;overflow:hidden;background:var(--ct-card3);color:var(--ct-text);min-height:116px;padding:0;transition:.18s;width:100%}
  .ct-guide:hover{border-color:var(--ct-p);transform:translateY(-3px)}
  .ct-gi{width:84px;flex:none;background:linear-gradient(135deg,var(--ct-p),var(--ct-p2));display:grid;place-items:center;font-size:28px;position:relative;overflow:hidden}
  .ct-gi img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .ct-gt{padding:12px;display:flex;flex-direction:column;gap:4px;min-width:0}
  .ct-gt b{font-size:14px;line-height:1.25}
  .ct-gt p{margin:0;font-size:12px;line-height:1.35;color:var(--ct-muted)}
  .ct-gt small{margin-top:auto;color:var(--ct-link);font-size:12.5px;font-weight:700}

  /* continue your journey */
  .ct-journey{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .ct-jt{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid var(--ct-line);border-radius:14px;background:var(--ct-card3);color:var(--ct-text);padding:14px;min-height:118px;transition:.18s}
  .ct-jt:hover{border-color:var(--ct-p);transform:translateY(-2px)}
  .ct-jt-top{display:flex;align-items:center;gap:10px}
  .ct-jt-top .ct-ic{width:32px;height:32px;font-size:15px}
  .ct-jt small{color:var(--ct-muted);font-size:12.5px;font-weight:600}
  .ct-jt b{font-size:24px;line-height:1.1;margin-top:4px}
  .ct-jt em{font-style:normal;font-size:12px;color:var(--ct-muted);line-height:1.4}
  .ct-bar{display:block;height:6px;border-radius:99px;background:var(--ct-card2);overflow:hidden;margin-top:auto}
  .ct-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ct-p),var(--ct-p2));transition:width .8s cubic-bezier(.2,.8,.2,1)}

  /* right column */
  .ct-facts{display:grid;gap:14px}
  .ct-fact{display:flex;gap:13px;align-items:flex-start}
  .ct-fact small{display:block;color:var(--ct-muted);font-size:12.5px;line-height:1.3}
  .ct-fact b{font-size:14.5px;line-height:1.35;display:block}
  .ct-info{width:22px;height:22px;border-radius:50%;background:rgba(113,59,255,.25);color:var(--ct-accent-text);font-size:12px;display:grid;place-items:center;font-weight:800}
  .ct-note{margin:12px 0 0;font-size:11px;color:var(--ct-muted);line-height:1.4}
  .ct-wide{width:100%;margin-top:14px;justify-content:center;background:transparent;border:1px solid var(--ct-p);color:var(--ct-accent-text)}
  .ct-wide:hover{background:rgba(113,59,255,.15)}

  .ct-ai{position:relative;overflow:hidden;min-height:330px}
  .ct-ai-head{display:flex;align-items:center;gap:8px}
  .ct-ai-head h3{font-size:15px}
  .ct-ai-dot{width:26px;height:26px;border-radius:50%;background:rgba(113,59,255,.3);display:grid;place-items:center;font-size:13px}
  .ct-beta{font-size:10px;background:rgba(113,59,255,.25);color:var(--ct-accent-text);border-radius:6px;padding:1px 7px;font-weight:800}
  .ct-mascot{position:absolute;right:6px;top:30px;width:128px;height:128px;pointer-events:none}
  .ct-mascot img,.ct-mascot svg{width:100%;height:100%;object-fit:contain;display:block}
  .ct-hello{position:relative;margin:86px 0 12px;font-size:14.5px;line-height:1.45;max-width:230px}
  .ct-sugg{display:grid;gap:8px;margin-bottom:14px;position:relative}
  .ct-sugg button{text-align:left;border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:10px;padding:8px 12px;font-size:12.5px;line-height:1.35}
  .ct-sugg button:hover{border-color:var(--ct-p)}
  .ct-ask{display:flex;gap:8px;position:relative}
  .ct-ask input{flex:1;min-width:0;border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:10px;padding:11px 12px;font:inherit;font-size:13px;outline:none}
  .ct-ask input:focus{border-color:var(--ct-p)}
  .ct-ask button{width:44px;border:0;border-radius:10px;color:#fff;background:linear-gradient(90deg,#5b2fe8,var(--ct-p))}

  .ct-why{position:relative;overflow:hidden}
  .ct-why h3{font-size:16px;margin-bottom:12px}
  .ct-why ul{list-style:none;margin:0;padding:0;display:grid;gap:9px;position:relative;max-width:68%}
  .ct-why li{display:flex;gap:10px;font-size:13px;align-items:center;line-height:1.3}
  .ct-why li::before{content:"✓";width:18px;height:18px;border-radius:50%;background:#16a34a;color:#fff;font-size:11px;display:grid;place-items:center;flex:none}
  .ct-why .ct-flag{position:absolute;right:14px;bottom:14px;width:96px;height:64px;opacity:.9;transform:rotate(-6deg)}

  /* chooser (opens from the topbar button) */
  .ct-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(4,6,18,.72);backdrop-filter:blur(6px)}
  .ct-modal[hidden]{display:none}
  .ct-sheet{width:min(920px,100%);max-height:92vh;overflow:auto;background:var(--ct-bg);color:var(--ct-text);border:1px solid var(--ct-line);border-radius:24px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.6);animation:ctIn .3s ease both}
  .ct-sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
  .ct-sheet-head h2{margin:0;font-size:22px}.ct-sheet-head p{margin:4px 0 0;color:var(--ct-muted);font-size:14px}
  .ct-x{border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:10px;width:36px;height:36px;font-size:18px;cursor:pointer}
  .ct-choices{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
  .ct-choice{position:relative;overflow:hidden;text-align:left;border:2px solid transparent;border-radius:18px;padding:16px;min-height:150px;color:#fff;background:#111;cursor:pointer;transition:.18s;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;isolation:isolate}
  .ct-choice:hover{transform:translateY(-3px);border-color:var(--ct-glow,#B9A2FF)}
  .ct-choice.on{border-color:#fff}
  .ct-choice .ct-art-svg,.ct-choice>img{position:absolute;inset:0;width:100%;height:100%;z-index:-2;object-fit:cover}
  .ct-choice::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(0deg,rgba(5,7,20,.85),rgba(5,7,20,.1) 70%)}
  .ct-choice .ct-flag{width:36px;height:24px;margin-bottom:6px}
  .ct-choice b{font-size:17px}.ct-choice small{opacity:.88;font-size:12.5px}
  .ct-world-row{margin-top:14px;display:flex;justify-content:center}
  .ct-world-btn{border:1px solid var(--ct-line);background:var(--ct-card2);color:var(--ct-text);border-radius:12px;padding:11px 20px;font-weight:700;cursor:pointer}
  .ct-world-btn.on{background:linear-gradient(90deg,#5b2fe8,var(--ct-p));border-color:transparent;color:#fff}

  /* topbar button (beside the theme toggle) — site variables, so it follows light/dark */
  .ct-top-btn{display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 15px;border-radius:14px;border:1px solid var(--border,rgba(128,128,160,.3));background:var(--card-bg,transparent);color:var(--text,inherit);font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;flex:none;transition:.15s}
  .ct-top-btn:hover{border-color:var(--ct-p)}
  .ct-top-btn.on{border-color:var(--ct-p);box-shadow:0 0 0 3px color-mix(in srgb,var(--ct-p) 18%,transparent)}
  .ct-top-btn .ct-flag{width:24px;height:16px;border-radius:3px;box-shadow:0 1px 4px rgba(0,0,0,.35)}
  .ct-top-btn .ct-globe{font-size:18px;line-height:1}
  .ct-top-btn .ct-caret{opacity:.6;font-size:11px}

  /* selected country beside the sidebar logo */
  .ct-logo-tag{display:inline-flex;align-items:center;gap:6px;margin-left:4px;padding:3px 10px 3px 7px;border-radius:999px;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:0;white-space:nowrap;color:var(--ct-p);background:color-mix(in srgb,var(--ct-p) 14%,transparent);border:1px solid color-mix(in srgb,var(--ct-p) 38%,transparent)}
  .ct-logo-tag[hidden]{display:none}
  .ct-logo-tag .ct-flag{width:18px;height:12px;border-radius:2px;box-shadow:none}

  @media(max-width:1180px){.ct-unis,.ct-guides{grid-template-columns:repeat(2,minmax(0,1fr))}.ct-journey{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:1000px){.ct-grid{grid-template-columns:1fr}.ct-ai{min-height:0}.ct-hello{max-width:none;margin-top:70px}}
  @media(max-width:900px){.ct-top-btn .ct-label,.ct-top-btn .ct-caret{display:none}.ct-top-btn{padding:0 11px}}
  @media(max-width:560px){#countryHome{padding:10px;border-radius:18px}.ct-hero{height:auto;min-height:360px;padding:18px}.ct-unis,.ct-guides,.ct-journey{grid-template-columns:1fr}.ct-studyin{font-size:22px}.ct-tag{font-size:17px}.ct-why ul{max-width:none}.ct-why .ct-flag{display:none}}
  @media(prefers-reduced-motion:reduce){.ct-petal,.ct-photo,.ct-skel{animation:none}.ct-main,.ct-side,.ct-sheet{animation:none}}
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
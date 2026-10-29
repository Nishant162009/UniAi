/* ==========================================================================
   UniAI — Living Cost Insights (cost-insights.js)

   Add AFTER your main script:
     <script src="JS/cost-insights.js"></script>

   What it does
   - Does NOT replace or wrap calculateLivingCost(). It watches #costResult
     and, every time your calculator renders, adds an extra "Deep insights"
     panel directly below it.
   - Reads your existing inputs (#rent, #food, #transport) and adds its own
     optional inputs (destination, duration, tuition, scholarship, savings...).
   - All CSS + HTML is injected from here. Nothing to add to your files.

   Adds
   - per day / week / semester / year / whole-degree costs
   - full funding picture: tuition + living + inflation + buffer + one-time
     costs vs scholarship, part-time income and savings -> gap or surplus
   - monthly saving needed, savings runway
   - spending donut, destination benchmark gauge, year-by-year projection
   - frugal / expected / comfortable scenarios
   - plain-English insights, copy summary, CSV download

   NOTE: destination benchmarks are rough planning averages (USD / month,
   excluding tuition), not official figures. Edit BENCH below to your data.
   ========================================================================== */

(function () {
  "use strict";

  if (window.__uniaiCostInsights) return;
  window.__uniaiCostInsights = true;

  /* ------------------------------------------------------------------ *
   * Config
   * ------------------------------------------------------------------ */

  const STORE_KEY = "uniai-cost-insights";

  // Indicative monthly student living cost (USD, excluding tuition).
  const BENCH = {
    "": { label: "Global student average", m: 1200 },
    US: { label: "United States", m: 1800 },
    UK: { label: "United Kingdom", m: 1500 },
    CA: { label: "Canada", m: 1300 },
    AU: { label: "Australia", m: 1700 },
    DE: { label: "Germany", m: 1000 },
    IE: { label: "Ireland", m: 1500 },
    FR: { label: "France", m: 1100 },
    NL: { label: "Netherlands", m: 1300 },
    SG: { label: "Singapore", m: 1500 },
    JP: { label: "Japan", m: 1000 },
    NZ: { label: "New Zealand", m: 1300 }
  };

  const COLORS = ["#6d5dfb", "#00c2ff", "#10b981", "#ffab00", "#ec4899", "#94a3b8"];

  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  const money = (n) =>
    `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n) || 0).toLocaleString()}`;

  const short = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `$${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
    return `$${Math.round(n)}`;
  };

  const sum = (arr, key) => arr.reduce((t, r) => t + r[key], 0);

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch (err) {
      return {};
    }
  }

  function save(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (err) {
      /* private mode */
    }
  }

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  function injectStyle() {
    if ($("cx-style")) return;

    const style = document.createElement("style");
    style.id = "cx-style";
    style.textContent = `
      .cx-panel { margin-top: 22px; display: grid; gap: 16px; }
      .cx-card {
        background: var(--card-bg, #fff);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 20px;
        padding: 20px;
        min-width: 0;
      }
      .cx-card h4 {
        margin: 0 0 14px;
        font-size: .78rem;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--text-muted, #94a3b8);
        font-weight: 700;
      }
      .cx-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .cx-head h3 { margin: 0; font-size: 1.15rem; }
      .cx-badge {
        font-size: .7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px;
        background: rgba(109,93,251,.12); color: var(--primary, #6d5dfb);
      }

      .cx-details summary { cursor: pointer; font-weight: 700; list-style: none; display: flex; justify-content: space-between; align-items: center; }
      .cx-details summary::-webkit-details-marker { display: none; }
      .cx-details summary::after { content: "▾"; color: var(--text-muted, #94a3b8); }
      .cx-details[open] summary::after { content: "▴"; }
      .cx-form {
        display: grid; gap: 12px; margin-top: 16px;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }
      .cx-form label { display: grid; gap: 4px; font-size: .75rem; font-weight: 600; color: var(--text-muted, #94a3b8); }
      .cx-form input, .cx-form select {
        width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 12px;
        border: 1px solid var(--border, #e2e8f0); background: var(--surface-2, var(--bg, transparent)); color-scheme: inherit;
        color: var(--text, inherit); font: inherit; font-size: .9rem;
      }
      .cx-form input:focus, .cx-form select:focus { outline: 2px solid rgba(109,93,251,.45); outline-offset: 1px; }

      .cx-tiles { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
      .cx-tile { padding: 14px; border-radius: 16px; background: rgba(109,93,251,.06); border: 1px solid rgba(109,93,251,.14); }
      .cx-tile small { display: block; font-size: .7rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .cx-tile b { display: block; font-size: 1.3rem; margin-top: 4px; }

      .cx-bar { height: 12px; border-radius: 8px; background: var(--border, #e2e8f0); overflow: hidden; display: flex; }
      .cx-bar i { display: block; height: 100%; }
      .cx-row { display: flex; justify-content: space-between; gap: 12px; font-size: .88rem; margin: 8px 0; flex-wrap: wrap; }
      .cx-row span:first-child { color: var(--text-muted, #94a3b8); }
      .cx-good { color: #10b981; } .cx-bad { color: #ef4444; } .cx-warn { color: #ffab00; }

      .cx-two { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .cx-donut-wrap { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
      .cx-donut { width: 150px; height: 150px; flex-shrink: 0; }
      .cx-dn { font-size: 13px; font-weight: 800; fill: var(--text, currentColor); }
      .cx-dl { font-size: 7px; fill: var(--text-muted, #94a3b8); }
      .cx-legend { display: grid; gap: 6px; font-size: .85rem; flex: 1; min-width: 140px; }
      .cx-legend div { display: flex; justify-content: space-between; gap: 10px; }
      .cx-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 8px; }

      .cx-gauge { position: relative; height: 12px; border-radius: 8px; margin: 26px 0 10px;
        background: linear-gradient(90deg, #10b981, #ffab00 55%, #ef4444); }
      .cx-gauge-mark { position: absolute; top: -7px; width: 4px; height: 26px; border-radius: 3px; background: var(--text, #111); transform: translateX(-2px); }
      .cx-gauge-mark em { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-style: normal; font-size: .7rem; font-weight: 700; white-space: nowrap; }
      .cx-gauge-scale { display: flex; justify-content: space-between; font-size: .7rem; color: var(--text-muted, #94a3b8); }

      .cx-chart { width: 100%; height: auto; max-height: 220px; }
      .cx-chart text { font-size: 9px; fill: var(--text-muted, #94a3b8); }
      .cx-key { display: flex; gap: 14px; font-size: .75rem; color: var(--text-muted, #94a3b8); margin-top: 6px; flex-wrap: wrap; }
      .cx-key i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }

      .cx-scen { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
      .cx-scen > div { padding: 14px; border-radius: 16px; border: 1px solid var(--border, #e2e8f0); }
      .cx-scen > div.on { border-color: var(--primary, #6d5dfb); background: rgba(109,93,251,.06); }
      .cx-scen small { color: var(--text-muted, #94a3b8); font-weight: 700; font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; }
      .cx-scen b { display: block; font-size: 1.15rem; margin: 4px 0 2px; }
      .cx-scen span { font-size: .78rem; color: var(--text-muted, #94a3b8); }

      .cx-tips { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
      .cx-tips li { display: flex; gap: 10px; font-size: .9rem; line-height: 1.45; }

      .cx-actions { display: flex; gap: 10px; flex-wrap: wrap; }
      .cx-btn {
        border: 1px solid var(--border, #e2e8f0); background: transparent; color: inherit;
        padding: 10px 16px; border-radius: 12px; font: inherit; font-size: .85rem; font-weight: 600; cursor: pointer;
      }
      .cx-btn:hover { border-color: var(--primary, #6d5dfb); color: var(--primary, #6d5dfb); }
      .cx-note { font-size: .72rem; color: var(--text-muted, #94a3b8); margin-top: 10px; }
      .cx-empty { text-align: center; padding: 24px; color: var(--text-muted, #94a3b8); font-size: .9rem; }
      /* ---- theme support (uses the site's tokens) ---- */
      .cx-panel select option { background: var(--card-bg, #fff); color: var(--text, #111); }
      .cx-form input::placeholder { color: var(--text-subtle, #94a3b8); opacity: .8; }
      .cx-chart text { fill: var(--text-muted, #94a3b8); }
      .cx-good { color: #10b981; } .cx-bad { color: #ef4444; } .cx-warn { color: #ffab00; }
      html[data-theme="light"] .cx-good { color: #059669; }
      html[data-theme="light"] .cx-bad  { color: #dc2626; }
      html[data-theme="light"] .cx-warn { color: #b45309; }
      html[data-theme="light"] .cx-tile { background: rgba(124,58,237,.05); border-color: rgba(124,58,237,.14); }
      html:not([data-theme="light"]) .cx-card { box-shadow: 0 6px 24px rgba(0,0,0,.18); }
      html:not([data-theme="light"]) .cx-tile { background: rgba(139,92,246,.10); border-color: rgba(139,92,246,.22); }
      html:not([data-theme="light"]) .cx-scen > div.on { background: rgba(139,92,246,.12); }
      @media (max-width: 520px) { .cx-card { padding: 16px; border-radius: 16px; } }

    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Panel
   * ------------------------------------------------------------------ */

  const FIELDS = [
    ["cx-utilities", "Utilities & phone / month ($)", "e.g. 80"],
    ["cx-insurance", "Health insurance / month ($)", "e.g. 60"],
    ["cx-other", "Other expenses / month ($)", "e.g. 100"],
    ["cx-tuition", "Tuition / year ($)", "e.g. 20000"],
    ["cx-scholarship", "Scholarship / year ($)", "e.g. 5000"],
    ["cx-income", "Part-time income / month ($)", "e.g. 500"],
    ["cx-savings", "Savings available ($)", "e.g. 15000"],
    ["cx-onetime", "One-time costs ($)", "visa, flights, deposit"],
    ["cx-inflation", "Yearly price rise (%)", "3"],
    ["cx-contingency", "Safety buffer on living (%)", "10"],
    ["cx-lead", "Months until you start", "12"]
  ];

  function ensurePanel() {
    let panel = $("cx-panel");
    if (panel) return panel;

    const host = $("costResult");
    if (!host) return null;

    injectStyle();

    const saved = load();

    const destOptions = Object.entries(BENCH)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join("");

    const yearOptions = [1, 2, 3, 4, 5]
      .map((y) => `<option value="${y}">${y} year${y > 1 ? "s" : ""}</option>`)
      .join("");

    const fields = FIELDS.map(
      ([id, label, ph]) =>
        `<label>${label}<input id="${id}" type="number" min="0" step="any" inputmode="decimal" placeholder="${ph}"></label>`
    ).join("");

    panel = document.createElement("section");
    panel.id = "cx-panel";
    panel.className = "cx-panel";
    panel.innerHTML = `
      <div class="cx-card cx-details-card">
        <details class="cx-details" open>
          <summary>⚙️ Fine-tune your estimate <span class="cx-badge" style="margin-left:auto;margin-right:10px;">optional</span></summary>
          <div class="cx-form">
            <label>Destination
              <select id="cx-dest">${destOptions}</select>
            </label>
            <label>Course length
              <select id="cx-years">${yearOptions}</select>
            </label>
            ${fields}
          </div>
          <p class="cx-note">Rent, food and transport come from the calculator above. Everything here is optional and saved on this device.</p>
        </details>
      </div>
      <div id="cx-out"></div>
    `;

    host.insertAdjacentElement("afterend", panel);

    // Restore saved values.
    Object.entries(saved).forEach(([id, value]) => {
      const el = $(id);
      if (el) el.value = value;
    });
    if (!$("cx-years").value) $("cx-years").value = "4";

    // Live updates + persistence.
    panel.addEventListener("input", onChange);
    panel.addEventListener("change", onChange);

    panel.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cx-act]");
      if (!btn) return;
      if (btn.dataset.cxAct === "copy") copySummary(btn);
      if (btn.dataset.cxAct === "csv") downloadCSV();
    });

    return panel;
  }

  function onChange(e) {
    if (e.target && e.target.id && e.target.id.indexOf("cx-") === 0) {
      const data = load();
      data[e.target.id] = e.target.value;
      save(data);
    }
    render();
  }

  /* ------------------------------------------------------------------ *
   * Maths
   * ------------------------------------------------------------------ */

  const num = (id, fallback = 0) => {
    const el = $(id);
    const n = parseFloat(el ? el.value : "");
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  let last = null; // most recent calculation, used by copy / CSV

  // Read-only access for other scripts (loan.js uses the funding gap).
  window.UniAICostInsight = { gap: () => (last ? last.gap : null), total: () => (last ? last.grand : null) };

  function compute() {
    const v = {
      rent: num("rent"),
      food: num("food"),
      transport: num("transport"),
      utilities: num("cx-utilities"),
      insurance: num("cx-insurance"),
      other: num("cx-other"),
      tuition: num("cx-tuition"),
      scholarship: num("cx-scholarship"),
      income: num("cx-income"),
      savings: num("cx-savings"),
      oneTime: num("cx-onetime"),
      years: num("cx-years", 4) || 4,
      inflation: num("cx-inflation", 3),
      contingency: num("cx-contingency", 10),
      lead: num("cx-lead", 12) || 12,
      dest: $("cx-dest") ? $("cx-dest").value : ""
    };

    const monthly = v.rent + v.food + v.transport + v.utilities + v.insurance + v.other;
    const months = v.years * 12;
    const infl = v.inflation / 100;
    const cont = v.contingency / 100;

    const rows = [];
    for (let y = 0; y < v.years; y++) {
      const f = Math.pow(1 + infl, y);
      const living = monthly * 12 * f;
      const tuition = v.tuition * f;
      rows.push({ year: y + 1, living, tuition, total: living + tuition });
    }

    const livingTotal = sum(rows, "living");
    const tuitionTotal = sum(rows, "tuition");
    const buffer = livingTotal * cont;
    const grand = livingTotal + tuitionTotal + buffer + v.oneTime;

    const scholarshipTotal = v.scholarship * v.years;
    const incomeTotal = v.income * months;
    const funding = scholarshipTotal + incomeTotal + v.savings;
    const gap = grand - funding;

    const flatLiving = monthly * months;
    const inflationExtra = livingTotal + tuitionTotal - (flatLiving + v.tuition * v.years);

    const burn = monthly * (1 + cont) - v.income;
    const runway = burn > 0 ? v.savings / burn : Infinity;

    const scen = [
      ["Frugal", 0.85, "−15% living costs"],
      ["Expected", 1, "as entered"],
      ["Comfortable", 1.2, "+20% living costs"]
    ].map(([name, f, hint]) => ({
      name,
      hint,
      total: livingTotal * f * (1 + cont) + tuitionTotal + v.oneTime
    }));

    const bench = BENCH[v.dest] || BENCH[""];

    const parts = [
      ["Rent", v.rent],
      ["Food", v.food],
      ["Transport", v.transport],
      ["Utilities & phone", v.utilities],
      ["Health insurance", v.insurance],
      ["Other", v.other]
    ].filter(([, value]) => value > 0);

    return {
      v, monthly, months, rows, livingTotal, tuitionTotal, buffer, grand,
      scholarshipTotal, incomeTotal, funding, gap, inflationExtra, burn,
      runway, scen, bench, parts,
      perDay: (monthly * 12) / 365,
      perWeek: (monthly * 12) / 52,
      perSemester: monthly * 6,
      perYear: monthly * 12,
      neededPerMonth: gap > 0 ? gap / v.lead : 0
    };
  }

  /* ------------------------------------------------------------------ *
   * Chart builders
   * ------------------------------------------------------------------ */

  function donut(parts, total) {
    const r = 40;
    const C = 2 * Math.PI * r;
    let offset = 0;

    const segs = parts
      .map(([, value], i) => {
        const len = (C * value) / total;
        const seg = `<circle r="${r}" cx="60" cy="60" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;
        offset += len;
        return seg;
      })
      .join("");

    return `
      <svg viewBox="0 0 120 120" class="cx-donut" role="img" aria-label="Monthly spending breakdown">
        <circle r="${r}" cx="60" cy="60" fill="none" stroke="var(--border,#e2e8f0)" stroke-width="18"/>
        ${segs}
        <text x="60" y="60" text-anchor="middle" class="cx-dn">${money(total)}</text>
        <text x="60" y="71" text-anchor="middle" class="cx-dl">per month</text>
      </svg>`;
  }

  function yearChart(rows) {
    const W = 360, H = 170, padX = 18, padTop = 18, padBottom = 22;
    const max = Math.max(...rows.map((r) => r.total), 1);
    const slot = (W - padX * 2) / rows.length;
    const bw = Math.min(46, slot - 12);
    const plotH = H - padTop - padBottom;

    const bars = rows
      .map((r, i) => {
        const x = padX + slot * i + (slot - bw) / 2;
        const hl = (r.living / max) * plotH;
        const ht = (r.tuition / max) * plotH;
        const yl = H - padBottom - hl;
        const yt = yl - ht;
        return `
          <rect x="${x}" y="${yl}" width="${bw}" height="${hl}" rx="3" fill="#6d5dfb"/>
          ${ht > 0 ? `<rect x="${x}" y="${yt}" width="${bw}" height="${ht}" rx="3" fill="#ec4899"/>` : ""}
          <text x="${x + bw / 2}" y="${yt - 5}" text-anchor="middle">${short(r.total)}</text>
          <text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle">Y${r.year}</text>`;
      })
      .join("");

    return `<svg viewBox="0 0 ${W} ${H}" class="cx-chart" role="img" aria-label="Cost per year">${bars}</svg>`;
  }

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */

  function insights(c) {
    const tips = [];
    const { v } = c;

    if (c.monthly <= 0) return tips;

    const rentShare = v.rent / c.monthly;
    if (rentShare > 0.5) {
      tips.push(["🏠", `Rent is ${Math.round(rentShare * 100)}% of your monthly budget. Sharing a flat or choosing campus housing is usually the biggest single saving.`]);
    }

    const diff = ((c.monthly - c.bench.m) / c.bench.m) * 100;
    if (Math.abs(diff) >= 5) {
      tips.push([
        diff > 0 ? "📈" : "📉",
        `Your monthly budget is ${Math.abs(Math.round(diff))}% ${diff > 0 ? "above" : "below"} the planning average for ${c.bench.label}.${diff < -20 ? " Double-check it isn't missing items." : ""}`
      ]);
    }

    if (v.income > 0) {
      const cover = Math.min(100, Math.round((v.income / (c.monthly * (1 + v.contingency / 100))) * 100));
      tips.push(["💼", `Part-time income would cover about ${cover}% of your monthly living costs. Check your visa's work-hour limits for your destination.`]);
    }

    if (c.gap > 0) {
      tips.push(["🎯", `You are ${money(c.gap)} short of the full ${v.years}-year cost. Saving ${money(c.neededPerMonth)} a month for ${v.lead} months would close it. Scholarships or a lower-cost destination are the other levers.`]);
    } else if (c.funding > 0) {
      tips.push(["✅", `Your funding covers the full cost with ${money(-c.gap)} to spare. Keep part of it as an emergency reserve for exchange-rate swings.`]);
    }

    if (Number.isFinite(c.runway) && v.savings > 0 && c.runway < 6) {
      tips.push(["⚠️", `Your savings would only cover about ${c.runway.toFixed(1)} months of living costs. Most advisers suggest keeping at least 6 months in reserve.`]);
    }

    if (c.inflationExtra > 0) {
      tips.push(["💸", `Assuming ${v.inflation}% yearly price rises adds about ${money(c.inflationExtra)} over the degree compared with today's prices.`]);
    }

    return tips;
  }

  function render() {
    const host = $("costResult");
    const panel = ensurePanel();
    if (!host || !panel) return;

    // Only show once the original calculator has produced a result.
    const ready = host.querySelector(".calc-dashboard-results");
    panel.style.display = ready ? "" : "none";
    if (!ready) return;

    const out = $("cx-out");
    const c = compute();
    last = c;

    if (c.monthly <= 0) {
      out.innerHTML = `<div class="cx-card cx-empty">Enter your rent, food or other costs above to see deeper insights.</div>`;
      return;
    }

    const covered = c.grand > 0 ? Math.min(100, (c.funding / c.grand) * 100) : 0;
    const diff = ((c.monthly - c.bench.m) / c.bench.m) * 100;
    const markPos = Math.max(2, Math.min(98, (c.monthly / (c.bench.m * 2)) * 100));

    const legend = c.parts
      .map(
        ([name, value], i) => `
        <div><span><i style="background:${COLORS[i % COLORS.length]}"></i>${name}</span>
        <b>${money(value)} · ${Math.round((value / c.monthly) * 100)}%</b></div>`
      )
      .join("");

    const scen = c.scen
      .map(
        (s) => `
        <div class="${s.name === "Expected" ? "on" : ""}">
          <small>${s.name}</small><b>${money(s.total)}</b><span>${s.hint}</span>
        </div>`
      )
      .join("");

    const tips = insights(c)
      .map(([icon, text]) => `<li><span>${icon}</span><span>${text}</span></li>`)
      .join("");

    out.innerHTML = `
      <div class="cx-card">
        <div class="cx-head">
          <h3>📊 Deep insights</h3>
          <span class="cx-badge">${c.v.years}-year plan · ${c.bench.label}</span>
        </div>
      </div>

      <div class="cx-card">
        <h4>Cost per period (living only)</h4>
        <div class="cx-tiles">
          <div class="cx-tile"><small>Per day</small><b>${money(c.perDay)}</b></div>
          <div class="cx-tile"><small>Per week</small><b>${money(c.perWeek)}</b></div>
          <div class="cx-tile"><small>Per semester</small><b>${money(c.perSemester)}</b></div>
          <div class="cx-tile"><small>Per year</small><b>${money(c.perYear)}</b></div>
          <div class="cx-tile"><small>Living, ${c.v.years} yrs</small><b>${money(c.livingTotal)}</b></div>
        </div>
      </div>

      <div class="cx-card">
        <h4>Funding picture</h4>
        <div class="cx-row"><span>Living costs (with ${c.v.inflation}% yearly rise)</span><b>${money(c.livingTotal)}</b></div>
        <div class="cx-row"><span>Tuition</span><b>${money(c.tuitionTotal)}</b></div>
        <div class="cx-row"><span>Safety buffer (${c.v.contingency}%)</span><b>${money(c.buffer)}</b></div>
        <div class="cx-row"><span>One-time costs</span><b>${money(c.v.oneTime)}</b></div>
        <div class="cx-row" style="border-top:1px solid var(--border,#e2e8f0);padding-top:10px;"><span><b>Total needed</b></span><b>${money(c.grand)}</b></div>
        <div class="cx-row"><span>Scholarship + part-time income + savings</span><b>${money(c.funding)}</b></div>
        <div class="cx-bar" style="margin:12px 0 6px;" role="img" aria-label="${Math.round(covered)}% funded">
          <i style="width:${covered}%;background:${c.gap > 0 ? "#ffab00" : "#10b981"}"></i>
        </div>
        <div class="cx-row">
          <span>${Math.round(covered)}% funded</span>
          <b class="${c.gap > 0 ? "cx-bad" : "cx-good"}">${c.gap > 0 ? `Gap ${money(c.gap)}` : `Surplus ${money(-c.gap)}`}</b>
        </div>
        ${c.gap > 0 ? `<div class="cx-row"><span>Saving needed (${c.v.lead} months)</span><b>${money(c.neededPerMonth)} / month</b></div>` : ""}
        ${c.v.savings > 0 ? `<div class="cx-row"><span>Savings runway (living only)</span><b>${Number.isFinite(c.runway) ? `${c.runway.toFixed(1)} months` : "Covered by income"}</b></div>` : ""}
      </div>

      <div class="cx-two">
        <div class="cx-card">
          <h4>Where the money goes</h4>
          <div class="cx-donut-wrap">${donut(c.parts, c.monthly)}<div class="cx-legend">${legend}</div></div>
        </div>

        <div class="cx-card">
          <h4>Versus ${c.bench.label}</h4>
          <div class="cx-gauge"><div class="cx-gauge-mark" style="left:${markPos}%"><em>${money(c.monthly)}</em></div></div>
          <div class="cx-gauge-scale"><span>$0</span><span>avg ${money(c.bench.m)}</span><span>${money(c.bench.m * 2)}+</span></div>
          <div class="cx-row" style="margin-top:14px;">
            <span>Difference</span>
            <b class="${diff > 10 ? "cx-bad" : diff < -10 ? "cx-good" : "cx-warn"}">${diff >= 0 ? "+" : ""}${Math.round(diff)}%</b>
          </div>
        </div>
      </div>

      <div class="cx-card">
        <h4>Year-by-year projection</h4>
        ${yearChart(c.rows)}
        <div class="cx-key">
          <span><i style="background:#6d5dfb"></i>Living</span>
          ${c.v.tuition > 0 ? `<span><i style="background:#ec4899"></i>Tuition</span>` : ""}
        </div>
      </div>

      <div class="cx-card">
        <h4>Scenarios (total over ${c.v.years} years)</h4>
        <div class="cx-scen">${scen}</div>
      </div>

      ${tips ? `<div class="cx-card"><h4>What this means</h4><ul class="cx-tips">${tips}</ul></div>` : ""}

      <div class="cx-card">
        <div class="cx-actions">
          <button type="button" class="cx-btn" data-cx-act="copy">📋 Copy summary</button>
          <button type="button" class="cx-btn" data-cx-act="csv">⬇️ Download CSV</button>
        </div>
        <p class="cx-note">Planning estimates only. Benchmarks are rough averages, not official figures. Always check each university's own cost-of-attendance page.</p>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * Export actions
   * ------------------------------------------------------------------ */

  function summaryText(c) {
    return [
      `UniAI cost summary (${c.v.years}-year plan, ${c.bench.label})`,
      `Monthly living: ${money(c.monthly)}  |  Per day: ${money(c.perDay)}  |  Per year: ${money(c.perYear)}`,
      `Living (${c.v.years} yrs): ${money(c.livingTotal)}  |  Tuition: ${money(c.tuitionTotal)}`,
      `Buffer: ${money(c.buffer)}  |  One-time: ${money(c.v.oneTime)}`,
      `Total needed: ${money(c.grand)}  |  Funding: ${money(c.funding)}`,
      c.gap > 0 ? `Gap: ${money(c.gap)} (${money(c.neededPerMonth)}/month for ${c.v.lead} months)` : `Surplus: ${money(-c.gap)}`
    ].join("\n");
  }

  function copySummary(btn) {
    if (!last) return;
    const text = summaryText(last);
    const done = () => {
      const old = btn.textContent;
      btn.textContent = "✅ Copied";
      setTimeout(() => (btn.textContent = old), 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {});
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { /* ignore */ }
      ta.remove();
    }
  }

  function downloadCSV() {
    if (!last) return;
    const lines = ["Year,Living,Tuition,Total"].concat(
      last.rows.map((r) => [r.year, r.living.toFixed(2), r.tuition.toFixed(2), r.total.toFixed(2)].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uniai-cost-projection.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------ *
   * Hook into the existing calculator (observe, never override)
   * ------------------------------------------------------------------ */

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  function start() {
    const host = $("costResult");
    if (!host) return false;

    ensurePanel();
    new MutationObserver(schedule).observe(host, { childList: true });
    schedule();
    return true;
  }

  function boot() {
    if (start()) return;
    // Markup may arrive later; try for ~10 seconds.
    let tries = 0;
    const timer = setInterval(() => {
      if (start() || ++tries > 20) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
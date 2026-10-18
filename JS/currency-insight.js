/* ==========================================================================
   UniAI — Currency Insights (currency-insights.js)

   Add AFTER your main script:
     <script src="JS/currency-insights.js"></script>

   What it does
   - Does NOT replace or wrap convertCurrency(). It watches #currencyResult
     and, every time your converter renders, adds an "Insights" panel below it.
   - Reads your existing #amount, #fromCurrency and #toCurrency.
   - All CSS + HTML is injected from here. Nothing to add to your files.

   Adds
   - rate history chart (1M / 3M / 6M / 1Y) with 10-day average and hover
   - statistics: average, high, low, change, volatility, where today ranks
   - transfer cost comparison (editable bank / card / fintech fees), plus
     "how much must I send to deliver X" reverse calculator
   - what-if table for rate moves of ±2%, ±5%, ±10%
   - target-rate tracker (saved per currency pair)
   - cross rates for your amount across every supported currency

   Data sources
   - Live rates: api.exchangerate-api.com (same source as your converter)
   - History: api.frankfurter.dev (ECB reference rates). It does not cover
     every currency (for example AED); the panel says so when that happens.
   ========================================================================== */

(function () {
  "use strict";

  if (window.__uniaiCurrencyInsights) return;
  window.__uniaiCurrencyInsights = true;

  /* ------------------------------------------------------------------ *
   * Config
   * ------------------------------------------------------------------ */

  const STORE_KEY = "uniai-fx-insights";
  const LIVE_API = "https://api.exchangerate-api.com/v4/latest/";
  const HIST_API = "https://api.frankfurter.dev/v1/";
  const RATE_TTL = 10 * 60 * 1000;

  const CUR = {
    USD: ["🇺🇸", "US Dollar"],
    EUR: ["🇪🇺", "Euro"],
    GBP: ["🇬🇧", "British Pound"],
    INR: ["🇮🇳", "Indian Rupee"],
    AUD: ["🇦🇺", "Australian Dollar"],
    CAD: ["🇨🇦", "Canadian Dollar"],
    SGD: ["🇸🇬", "Singapore Dollar"],
    NZD: ["🇳🇿", "New Zealand Dollar"],
    JPY: ["🇯🇵", "Japanese Yen"],
    CNY: ["🇨🇳", "Chinese Yuan"],
    CHF: ["🇨🇭", "Swiss Franc"],
    AED: ["🇦🇪", "UAE Dirham"],
    KRW: ["🇰🇷", "South Korean Won"]
  };

  const RANGES = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365 };

  const DEFAULT_PROVIDERS = [
    { name: "Traditional bank", pct: 2.5, fee: 15 },
    { name: "Forex card", pct: 1.5, fee: 0 },
    { name: "Online transfer service", pct: 0.6, fee: 2 }
  ];

  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  const fmt = (n, d = 2) =>
    Number.isFinite(n)
      ? n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
      : "—";

  const rateFmt = (n) => (n >= 100 ? fmt(n, 2) : n >= 1 ? fmt(n, 4) : fmt(n, 6));

  const pct = (n, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

  const mean = (a) => a.reduce((t, x) => t + x, 0) / (a.length || 1);

  const stdev = (a) => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((t, x) => t + (x - m) * (x - m), 0) / (a.length - 1));
  };

  const isoDate = (d) => d.toISOString().slice(0, 10);

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  function injectStyle() {
    if ($("fx-style")) return;

    const style = document.createElement("style");
    style.id = "fx-style";
    style.textContent = `
      .fx-panel { margin-top: 22px; display: grid; gap: 16px; }
      .fx-card {
        background: var(--card-bg, #fff); border: 1px solid var(--border, #e2e8f0);
        border-radius: 20px; padding: 20px; min-width: 0;
      }
      .fx-card h4 {
        margin: 0 0 14px; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase;
        color: var(--text-muted, #94a3b8); font-weight: 700;
      }
      .fx-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .fx-head h3 { margin: 0; font-size: 1.15rem; }
      .fx-badge { font-size: .7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgba(109,93,251,.12); color: var(--primary, #6d5dfb); }

      .fx-tabs { display: inline-flex; gap: 6px; flex-wrap: wrap; }
      .fx-tab {
        border: 1px solid var(--border, #e2e8f0); background: transparent; color: inherit;
        padding: 6px 12px; border-radius: 10px; font: inherit; font-size: .78rem; font-weight: 700; cursor: pointer;
      }
      .fx-tab.on { background: var(--primary, #6d5dfb); border-color: var(--primary, #6d5dfb); color: #fff; }

      .fx-stats { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin-top: 14px; }
      .fx-stat { padding: 12px; border-radius: 14px; background: rgba(109,93,251,.06); border: 1px solid rgba(109,93,251,.14); }
      .fx-stat small { display: block; font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .fx-stat b { display: block; font-size: 1.05rem; margin-top: 3px; }

      .fx-chartbox { position: relative; margin-top: 14px; }
      .fx-chart { width: 100%; height: auto; display: block; touch-action: none; }
      .fx-chart text { font-size: 10px; fill: var(--text-muted, #94a3b8); }
      .fx-tip {
        position: absolute; top: 0; left: 0; transform: translate(-50%, -100%);
        background: var(--text, #111); color: var(--bg, #fff); font-size: .72rem; font-weight: 600;
        padding: 4px 8px; border-radius: 8px; white-space: nowrap; pointer-events: none; opacity: 0;
      }
      .fx-key { display: flex; gap: 14px; font-size: .75rem; color: var(--text-muted, #94a3b8); margin-top: 6px; flex-wrap: wrap; }
      .fx-key i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }

      .fx-meter { position: relative; height: 10px; border-radius: 8px; margin: 22px 0 6px; background: linear-gradient(90deg, #ef4444, #ffab00, #10b981); }
      .fx-meter i { position: absolute; top: -5px; width: 4px; height: 20px; border-radius: 3px; background: var(--text, #111); transform: translateX(-2px); }

      .fx-msg { font-size: .88rem; line-height: 1.5; margin-top: 12px; }
      .fx-muted { color: var(--text-muted, #94a3b8); font-size: .78rem; }
      .fx-good { color: #10b981; } .fx-bad { color: #ef4444; } .fx-warn { color: #ffab00; }

      .fx-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
      .fx-table th { text-align: left; font-size: .68rem; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #94a3b8); padding: 0 8px 8px 0; }
      .fx-table td { padding: 8px 8px 8px 0; border-top: 1px solid var(--border, #e2e8f0); vertical-align: middle; }
      .fx-scroll { overflow-x: auto; }
      .fx-in {
        width: 76px; box-sizing: border-box; padding: 7px 8px; border-radius: 10px; border: 1px solid var(--border, #e2e8f0);
        background: var(--surface-2, var(--bg, transparent)); color-scheme: inherit; color: var(--text, inherit); font: inherit; font-size: .85rem;
      }
      .fx-in.wide { width: 130px; }
      .fx-in:focus { outline: 2px solid rgba(109,93,251,.45); outline-offset: 1px; }
      .fx-line { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: .85rem; margin-bottom: 12px; }

      .fx-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
      .fx-cell { padding: 12px; border-radius: 14px; border: 1px solid var(--border, #e2e8f0); }
      .fx-cell small { display: block; font-size: .7rem; font-weight: 700; color: var(--text-muted, #94a3b8); }
      .fx-cell b { display: block; margin: 3px 0 1px; }
      .fx-cell span { font-size: .75rem; }

      .fx-use { border: 1px solid var(--border, #e2e8f0); background: transparent; color: inherit; padding: 4px 10px; border-radius: 8px; font: inherit; font-size: .74rem; font-weight: 700; cursor: pointer; }
      .fx-use:hover { border-color: var(--primary, #6d5dfb); color: var(--primary, #6d5dfb); }
      .fx-note { font-size: .72rem; color: var(--text-muted, #94a3b8); margin-top: 10px; }
      /* ---- theme support (uses the site's tokens) ---- */
      .fx-panel select option { background: var(--card-bg, #fff); color: var(--text, #111); }
      .fx-in::placeholder { color: var(--text-subtle, #94a3b8); opacity: .8; }
      .fx-chart text { fill: var(--text-muted, #94a3b8); }
      .fx-good { color: #10b981; } .fx-bad { color: #ef4444; } .fx-warn { color: #ffab00; }
      html[data-theme="light"] .fx-good { color: #059669; }
      html[data-theme="light"] .fx-bad  { color: #dc2626; }
      html[data-theme="light"] .fx-warn { color: #b45309; }
      html[data-theme="light"] .fx-stat { background: rgba(124,58,237,.05); border-color: rgba(124,58,237,.14); }
      html:not([data-theme="light"]) .fx-card { box-shadow: 0 6px 24px rgba(0,0,0,.18); }
      html:not([data-theme="light"]) .fx-stat { background: rgba(139,92,246,.10); border-color: rgba(139,92,246,.22); }
      .fx-tip { background: var(--text, #111); color: var(--bg, #fff); box-shadow: 0 4px 14px rgba(0,0,0,.25); }
      @media (max-width: 520px) { .fx-card { padding: 16px; border-radius: 16px; } }

    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Data
   * ------------------------------------------------------------------ */

  const liveCache = new Map();
  const histCache = new Map();

  async function getRates(base) {
    const hit = liveCache.get(base);
    if (hit && Date.now() - hit.at < RATE_TTL) return hit.rates;

    const res = await fetch(LIVE_API + encodeURIComponent(base));
    if (!res.ok) throw new Error(`Rates ${res.status}`);

    const data = await res.json();
    if (!data || typeof data.rates !== "object") throw new Error("No rates");

    liveCache.set(base, { rates: data.rates, at: Date.now() });
    return data.rates;
  }

  /** One year of daily ECB rates for the pair, cached. Returns { dates, values }. */
  async function getHistory(from, to) {
    const key = `${from}>${to}`;
    if (histCache.has(key)) return histCache.get(key);

    const end = new Date();
    const start = new Date(end.getTime() - 366 * 86400000);

    const url = `${HIST_API}${isoDate(start)}..${isoDate(end)}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`History ${res.status}`);

    const data = await res.json();
    const dates = Object.keys(data.rates || {}).sort();
    const values = dates.map((d) => data.rates[d][to]).filter((x) => Number.isFinite(x));

    if (values.length < 5) throw new Error("History too short");

    const out = { dates: dates.slice(-values.length), values };
    histCache.set(key, out);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  const cur = { from: "", to: "", amount: 1, rate: 1, rates: {} };
  let range = "6M";
  let reqId = 0;

  function readPair() {
    const from = $("fromCurrency") ? $("fromCurrency").value : "";
    const to = $("toCurrency") ? $("toCurrency").value : "";
    const raw = parseFloat($("amount") ? $("amount").value : "");
    const amount = Number.isFinite(raw) && raw >= 0 ? raw : 1;
    return { from, to, amount };
  }

  /* ------------------------------------------------------------------ *
   * Panel skeleton
   * ------------------------------------------------------------------ */

  function ensurePanel() {
    let panel = $("fx-panel");
    if (panel) return panel;

    const host = $("currencyResult");
    if (!host) return null;

    injectStyle();

    panel = document.createElement("section");
    panel.id = "fx-panel";
    panel.className = "fx-panel";
    panel.innerHTML = `
      <div class="fx-card"><div class="fx-head"><h3>📈 Currency insights</h3><span class="fx-badge" id="fx-pair-badge"></span></div></div>
      <div class="fx-card" id="fx-history"></div>
      <div class="fx-card" id="fx-fees"></div>
      <div class="fx-card" id="fx-whatif"></div>
      <div class="fx-card" id="fx-target"></div>
      <div class="fx-card" id="fx-cross"></div>
    `;

    host.insertAdjacentElement("afterend", panel);

    panel.addEventListener("click", onClick);
    panel.addEventListener("input", onInput);

    return panel;
  }

  function onClick(e) {
    const tab = e.target.closest("[data-fx-range]");
    if (tab) {
      range = tab.dataset.fxRange;
      renderHistory();
      return;
    }

    const use = e.target.closest("[data-fx-use]");
    if (use) {
      const to = $("toCurrency");
      if (to && typeof window.convertCurrency === "function") {
        to.value = use.dataset.fxUse;
        window.convertCurrency(); // existing function; our observer then refreshes
      }
    }
  }

  function onInput(e) {
    const id = e.target.id || "";
    const data = load();

    if (id.indexOf("fx-p-") === 0) {
      const [, , idx, field] = id.split("-");
      data.providers = data.providers || DEFAULT_PROVIDERS.map((p) => ({ ...p }));
      if (data.providers[idx]) data.providers[idx][field] = parseFloat(e.target.value) || 0;
      save(data);
      updateFees();
    } else if (id === "fx-need") {
      updateFees();
    } else if (id === "fx-target-in") {
      data.targets = data.targets || {};
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v) && v > 0) data.targets[`${cur.from}>${cur.to}`] = v;
      else delete data.targets[`${cur.from}>${cur.to}`];
      save(data);
      updateTarget();
    }
  }

  /* ------------------------------------------------------------------ *
   * Section: history + statistics
   * ------------------------------------------------------------------ */

  let hist = null; // { dates, values } for the current pair, or null

  function sliceRange() {
    if (!hist) return null;
    const days = RANGES[range] || 182;
    const cutoff = isoDate(new Date(Date.now() - days * 86400000));
    const idx = hist.dates.findIndex((d) => d >= cutoff);
    const from = idx < 0 ? 0 : idx;
    return { dates: hist.dates.slice(from), values: hist.values.slice(from) };
  }

  function sma(values, n) {
    return values.map((_, i) => (i < n - 1 ? null : mean(values.slice(i - n + 1, i + 1))));
  }

  function renderHistory(state) {
    const box = $("fx-history");
    if (!box) return;

    if (state === "loading") {
      box.innerHTML = `<h4>Rate history</h4><p class="fx-muted">Loading ${cur.from} → ${cur.to} history…</p>`;
      return;
    }

    if (cur.from === cur.to) {
      box.innerHTML = `<h4>Rate history</h4><p class="fx-muted">Pick two different currencies to see history.</p>`;
      return;
    }

    if (!hist) {
      box.innerHTML = `<h4>Rate history</h4><p class="fx-muted">History isn't available for ${esc(cur.from)} → ${esc(cur.to)} (the ECB data doesn't cover every currency, or the request failed).</p>`;
      return;
    }

    const s = sliceRange();
    const vals = s.values;
    const live = cur.rate;

    const first = vals[0];
    const lastV = vals[vals.length - 1];
    const hi = Math.max(...vals);
    const lo = Math.min(...vals);
    const avg = mean(vals);
    const change = ((lastV - first) / first) * 100;

    const rets = [];
    for (let i = 1; i < vals.length; i++) rets.push(Math.log(vals[i] / vals[i - 1]));
    const vol = stdev(rets) * Math.sqrt(252) * 100;

    const below = vals.filter((x) => x <= live).length;
    const rank = (below / vals.length) * 100;
    const vsAvg = ((live - avg) / avg) * 100;

    const volLabel = vol < 5 ? "calm" : vol < 10 ? "moderate" : "volatile";

    let verdict;
    if (rank >= 75) verdict = `<span class="fx-good">Strong day.</span> You'd receive more per 1 ${cur.from} than on ${Math.round(rank)}% of days in this window.`;
    else if (rank <= 25) verdict = `<span class="fx-bad">Weak day.</span> You'd receive more per 1 ${cur.from} on ${Math.round(100 - rank)}% of days in this window.`;
    else verdict = `<span class="fx-warn">Mid-range.</span> Today's rate sits around the ${Math.round(rank)}th percentile of this window.`;

    // ---- chart geometry
    const W = 600, H = 190, pl = 8, pr = 8, pt = 14, pb = 22;
    const span = hi - lo || hi * 0.01 || 1;
    const xAt = (i) => pl + (i / Math.max(1, vals.length - 1)) * (W - pl - pr);
    const yAt = (v) => pt + (1 - (v - lo) / span) * (H - pt - pb);

    const line = vals.map((v, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ");
    const area = `${line} L${xAt(vals.length - 1).toFixed(1)} ${H - pb} L${xAt(0).toFixed(1)} ${H - pb} Z`;

    const avgSeries = sma(vals, 10);
    let smaStarted = false;
    const smaPath = avgSeries
      .map((v, i) => {
        if (v == null) return "";
        const cmd = smaStarted ? "L" : "M";
        smaStarted = true;
        return `${cmd}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`;
      })
      .join(" ");

    const tabs = Object.keys(RANGES)
      .map((r) => `<button type="button" class="fx-tab ${r === range ? "on" : ""}" data-fx-range="${r}">${r}</button>`)
      .join("");

    box.innerHTML = `
      <div class="fx-head"><h4 style="margin:0">Rate history · ${esc(cur.from)} → ${esc(cur.to)}</h4><div class="fx-tabs">${tabs}</div></div>

      <div class="fx-chartbox">
        <svg id="fx-svg" class="fx-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Exchange rate history">
          <defs>
            <linearGradient id="fxGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#6d5dfb" stop-opacity=".35"/>
              <stop offset="100%" stop-color="#6d5dfb" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="${area}" fill="url(#fxGrad)"/>
          <path d="${line}" fill="none" stroke="#6d5dfb" stroke-width="2" stroke-linejoin="round"/>
          <path d="${smaPath}" fill="none" stroke="#ffab00" stroke-width="1.5" stroke-dasharray="4 3"/>
          <line x1="${pl}" x2="${W - pr}" y1="${yAt(live).toFixed(1)}" y2="${yAt(live).toFixed(1)}" stroke="#10b981" stroke-width="1" stroke-dasharray="2 3"/>
          <text x="${pl}" y="${H - 6}">${esc(s.dates[0])}</text>
          <text x="${W - pr}" y="${H - 6}" text-anchor="end">${esc(s.dates[s.dates.length - 1])}</text>
          <text x="${W - pr}" y="${pt - 3}" text-anchor="end">${rateFmt(hi)}</text>
          <text x="${W - pr}" y="${H - pb - 4}" text-anchor="end">${rateFmt(lo)}</text>
          <line id="fx-hl" y1="${pt}" y2="${H - pb}" stroke="var(--text-muted,#94a3b8)" stroke-width="1" opacity="0"/>
          <circle id="fx-hc" r="4" fill="#6d5dfb" stroke="var(--card-bg,#fff)" stroke-width="2" opacity="0"/>
        </svg>
        <div class="fx-tip" id="fx-tip"></div>
      </div>
      <div class="fx-key">
        <span><i style="background:#6d5dfb"></i>Daily rate</span>
        <span><i style="background:#ffab00"></i>10-day average</span>
        <span><i style="background:#10b981"></i>Live rate</span>
      </div>

      <div class="fx-stats">
        <div class="fx-stat"><small>Live rate</small><b>${rateFmt(live)}</b></div>
        <div class="fx-stat"><small>Average</small><b>${rateFmt(avg)}</b></div>
        <div class="fx-stat"><small>High</small><b>${rateFmt(hi)}</b></div>
        <div class="fx-stat"><small>Low</small><b>${rateFmt(lo)}</b></div>
        <div class="fx-stat"><small>Change (${range})</small><b class="${change >= 0 ? "fx-good" : "fx-bad"}">${pct(change)}</b></div>
        <div class="fx-stat"><small>Volatility</small><b>${vol.toFixed(1)}%</b><span class="fx-muted">${volLabel}, annualised</span></div>
        <div class="fx-stat"><small>Vs average</small><b class="${vsAvg >= 0 ? "fx-good" : "fx-bad"}">${pct(vsAvg)}</b></div>
      </div>

      <div class="fx-meter" aria-hidden="true"><i style="left:${Math.max(1, Math.min(99, rank))}%"></i></div>
      <div class="fx-muted" style="display:flex;justify-content:space-between;"><span>Weakest in window</span><span>Strongest in window</span></div>
      <p class="fx-msg">${verdict}</p>
      <p class="fx-note">Historical ECB reference rates; the live rate comes from your converter's source, so small differences are normal. Past movement doesn't predict future rates and this isn't financial advice.</p>
    `;

    // ---- hover tooltip
    const svg = $("fx-svg");
    const tip = $("fx-tip");
    const hl = $("fx-hl");
    const hc = $("fx-hc");

    const move = (clientX) => {
      const r = svg.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const i = Math.round(ratio * (vals.length - 1));
      const px = (xAt(i) / W) * r.width;
      const py = (yAt(vals[i]) / H) * r.height;

      hl.setAttribute("x1", xAt(i));
      hl.setAttribute("x2", xAt(i));
      hl.setAttribute("opacity", "1");
      hc.setAttribute("cx", xAt(i));
      hc.setAttribute("cy", yAt(vals[i]));
      hc.setAttribute("opacity", "1");

      tip.textContent = `${s.dates[i]} · ${rateFmt(vals[i])}`;
      tip.style.left = `${px}px`;
      tip.style.top = `${py - 8}px`;
      tip.style.opacity = "1";
    };

    const leave = () => {
      hl.setAttribute("opacity", "0");
      hc.setAttribute("opacity", "0");
      tip.style.opacity = "0";
    };

    svg.addEventListener("mousemove", (e) => move(e.clientX));
    svg.addEventListener("mouseleave", leave);
    svg.addEventListener("touchstart", (e) => move(e.touches[0].clientX), { passive: true });
    svg.addEventListener("touchmove", (e) => move(e.touches[0].clientX), { passive: true });
    svg.addEventListener("touchend", leave);
  }

  /* ------------------------------------------------------------------ *
   * Section: transfer cost comparison
   * ------------------------------------------------------------------ */

  function providers() {
    const data = load();
    return Array.isArray(data.providers) && data.providers.length === DEFAULT_PROVIDERS.length
      ? data.providers
      : DEFAULT_PROVIDERS.map((p) => ({ ...p }));
  }

  function renderFees() {
    const box = $("fx-fees");
    if (!box) return;

    if (cur.from === cur.to) {
      box.innerHTML = `<h4>Transfer cost comparison</h4><p class="fx-muted">Pick two different currencies to compare transfer costs.</p>`;
      return;
    }

    const rows = providers()
      .map(
        (p, i) => `
        <tr>
          <td><b>${esc(p.name)}</b></td>
          <td><input class="fx-in" id="fx-p-${i}-pct" type="number" min="0" step="0.1" value="${p.pct}" aria-label="${esc(p.name)} markup percent"></td>
          <td><input class="fx-in" id="fx-p-${i}-fee" type="number" min="0" step="0.5" value="${p.fee}" aria-label="${esc(p.name)} flat fee"></td>
          <td id="fx-recv-${i}"></td>
          <td id="fx-loss-${i}"></td>
          <td id="fx-send-${i}"></td>
        </tr>`
      )
      .join("");

    box.innerHTML = `
      <h4>Transfer cost comparison</h4>
      <p class="fx-muted" style="margin:0 0 12px;">Edit the markup and flat fee to match the quotes you actually get. The defaults are illustrative only.</p>
      <div class="fx-line">
        <label for="fx-need">I need the recipient to get</label>
        <input class="fx-in wide" id="fx-need" type="number" min="0" step="any" placeholder="optional">
        <span>${esc(cur.to)}</span>
      </div>
      <div class="fx-scroll">
        <table class="fx-table">
          <thead><tr>
            <th>Provider</th><th>Markup %</th><th>Fee (${esc(cur.from)})</th>
            <th>Recipient gets</th><th>Lost to costs</th><th>Send to deliver</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="fx-msg" id="fx-fee-msg"></p>
      <p class="fx-note">Markup is the margin added on top of the mid-market rate shown above.</p>
    `;

    updateFees();
  }

  function updateFees() {
    if (!$("fx-fees") || cur.from === cur.to) return;

    const need = parseFloat($("fx-need") ? $("fx-need").value : "");
    const list = providers();
    const mid = cur.amount * cur.rate;
    let best = { i: -1, recv: -Infinity };

    list.forEach((p, i) => {
      const m = Math.min(Math.max(p.pct, 0), 99) / 100;
      const recv = Math.max(0, (cur.amount - p.fee) * cur.rate * (1 - m));
      const lost = mid - recv;
      const lostPct = mid > 0 ? (lost / mid) * 100 : 0;
      const send = Number.isFinite(need) && need > 0 ? need / (cur.rate * (1 - m)) + p.fee : null;

      if (recv > best.recv) best = { i, recv };

      const set = (id, html) => {
        const el = $(id);
        if (el) el.innerHTML = html;
      };

      set(`fx-recv-${i}`, `<b>${fmt(recv)}</b>`);
      set(`fx-loss-${i}`, `<span class="${lostPct > 2 ? "fx-bad" : lostPct > 1 ? "fx-warn" : "fx-good"}">${fmt(lost)} (${lostPct.toFixed(2)}%)</span>`);
      set(`fx-send-${i}`, send === null ? `<span class="fx-muted">—</span>` : `<b>${fmt(send)} ${esc(cur.from)}</b>`);
    });

    const msg = $("fx-fee-msg");
    if (msg && best.i >= 0) {
      const worst = Math.min(...list.map((p) => Math.max(0, (cur.amount - p.fee) * cur.rate * (1 - p.pct / 100))));
      const saved = best.recv - worst;
      msg.innerHTML = `Best of these for ${fmt(cur.amount, 0)} ${esc(cur.from)}: <b>${esc(list[best.i].name)}</b>, delivering ${fmt(best.recv)} ${esc(cur.to)}${saved > 0 ? ` (${fmt(saved)} ${esc(cur.to)} more than the costliest option)` : ""}.`;
    }
  }

  /* ------------------------------------------------------------------ *
   * Section: what-if
   * ------------------------------------------------------------------ */

  function renderWhatIf() {
    const box = $("fx-whatif");
    if (!box) return;

    if (cur.from === cur.to) {
      box.innerHTML = `<h4>What if the rate moves?</h4><p class="fx-muted">Pick two different currencies to see rate scenarios.</p>`;
      return;
    }

    const base = cur.amount * cur.rate;

    const cells = [-10, -5, -2, 2, 5, 10]
      .map((s) => {
        const r = cur.rate * (1 + s / 100);
        const total = cur.amount * r;
        const diff = total - base;
        return `
          <div class="fx-cell">
            <small>${s > 0 ? "+" : ""}${s}% · ${rateFmt(r)}</small>
            <b>${fmt(total)} ${esc(cur.to)}</b>
            <span class="${diff >= 0 ? "fx-good" : "fx-bad"}">${diff >= 0 ? "+" : ""}${fmt(diff)}</span>
          </div>`;
      })
      .join("");

    box.innerHTML = `
      <h4>What if the rate moves?</h4>
      <div class="fx-grid">${cells}</div>
      <p class="fx-note">Useful for tuition: a 5% swing on a large payment can be a real amount, so consider paying in instalments or keeping a buffer.</p>
    `;
  }

  /* ------------------------------------------------------------------ *
   * Section: target rate
   * ------------------------------------------------------------------ */

  function renderTarget() {
    const box = $("fx-target");
    if (!box) return;

    if (cur.from === cur.to) {
      box.innerHTML = `<h4>Target rate</h4><p class="fx-muted">Pick two different currencies to set a target.</p>`;
      return;
    }

    const data = load();
    const saved = (data.targets || {})[`${cur.from}>${cur.to}`];

    box.innerHTML = `
      <h4>Target rate</h4>
      <div class="fx-line">
        <label for="fx-target-in">Send when 1 ${esc(cur.from)} is at least</label>
        <input class="fx-in wide" id="fx-target-in" type="number" min="0" step="any" value="${saved || ""}" placeholder="${rateFmt(cur.rate)}">
        <span>${esc(cur.to)}</span>
      </div>
      <p class="fx-msg" id="fx-target-msg"></p>
      <p class="fx-note">Saved on this device for each currency pair. It is checked when you open or refresh this page, not in the background.</p>
    `;

    updateTarget();
  }

  function updateTarget() {
    const msg = $("fx-target-msg");
    const input = $("fx-target-in");
    if (!msg || !input) return;

    const t = parseFloat(input.value);

    if (!Number.isFinite(t) || t <= 0) {
      msg.innerHTML = `<span class="fx-muted">Set a rate you'd be happy with to see how far away it is.</span>`;
      return;
    }

    const gap = ((cur.rate - t) / t) * 100;
    const atTarget = cur.amount * t;

    msg.innerHTML =
      gap >= 0
        ? `<span class="fx-good">🎯 Target reached.</span> The live rate is ${pct(gap)} above your target, so ${fmt(cur.amount, 0)} ${esc(cur.from)} gives ${fmt(cur.amount * cur.rate)} ${esc(cur.to)}.`
        : `<span class="fx-warn">${Math.abs(gap).toFixed(2)}% below your target.</span> At ${rateFmt(t)} you'd receive ${fmt(atTarget)} ${esc(cur.to)}, which is ${fmt(atTarget - cur.amount * cur.rate)} more than today.`;
  }

  /* ------------------------------------------------------------------ *
   * Section: cross rates
   * ------------------------------------------------------------------ */

  function renderCross() {
    const box = $("fx-cross");
    if (!box) return;

    const rows = Object.keys(CUR)
      .filter((code) => code !== cur.from)
      .map((code) => {
        const r = cur.rates[code];
        if (!Number.isFinite(r)) return "";
        return `
          <tr>
            <td>${CUR[code][0]} <b>${code}</b> <span class="fx-muted">${CUR[code][1]}</span></td>
            <td>${rateFmt(r)}</td>
            <td><b>${fmt(cur.amount * r)}</b></td>
            <td><button type="button" class="fx-use" data-fx-use="${code}">Use</button></td>
          </tr>`;
      })
      .join("");

    box.innerHTML = `
      <h4>${fmt(cur.amount, 0)} ${esc(cur.from)} in every currency</h4>
      <div class="fx-scroll">
        <table class="fx-table">
          <thead><tr><th>Currency</th><th>Rate</th><th>Amount</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * Update cycle (runs after each render of the original converter)
   * ------------------------------------------------------------------ */

  async function update() {
    const host = $("currencyResult");
    const panel = ensurePanel();
    if (!host || !panel) return;

    const ready = host.querySelector(".currency-results-dashboard");
    panel.style.display = ready ? "" : "none";
    if (!ready) return;

    const id = ++reqId;
    const pair = readPair();

    let rates;
    try {
      rates = await getRates(pair.from);
    } catch (err) {
      return; // the original converter already shows its own error state
    }
    if (id !== reqId) return;

    cur.from = pair.from;
    cur.to = pair.to;
    cur.amount = pair.amount;
    cur.rates = rates;
    cur.rate = pair.from === pair.to ? 1 : Number(rates[pair.to]);

    if (!Number.isFinite(cur.rate) || cur.rate <= 0) return;

    const badge = $("fx-pair-badge");
    if (badge) badge.textContent = `${cur.from} → ${cur.to}`;

    renderFees();
    renderWhatIf();
    renderTarget();
    renderCross();

    // History loads last because it is the slowest.
    hist = null;
    if (cur.from === cur.to) {
      renderHistory();
      return;
    }

    renderHistory("loading");

    try {
      const data = await getHistory(cur.from, cur.to);
      if (id !== reqId) return;
      hist = data;
    } catch (err) {
      if (id !== reqId) return;
      hist = null;
    }

    renderHistory();
  }

  /* ------------------------------------------------------------------ *
   * Hook into the existing converter (observe, never override)
   * ------------------------------------------------------------------ */

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      update();
    }, 60);
  }

  function start() {
    const host = $("currencyResult");
    if (!host) return false;

    ensurePanel();
    new MutationObserver(schedule).observe(host, { childList: true });
    schedule();
    return true;
  }

  function boot() {
    if (start()) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (start() || ++tries > 20) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
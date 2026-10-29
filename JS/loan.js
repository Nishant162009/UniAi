/* ==========================================================================
   UniAI — Education Loan Planner (loan.js)

   Add AFTER your main script and cost-insight.js:
     <script src="JS/loan.js"></script>

   Needs NO changes to index.html. It adds an "Education loan planner" card
   at the bottom of the Cost Calculator page (#livingPage).

   What it works out
   - Monthly EMI, loan size when repayment starts, total interest, total paid
   - Study period (moratorium): pay interest as you go, or let it build up
   - Year-by-year schedule
   - How different repayment periods change the EMI and total interest
   - What an extra monthly payment saves (months and interest)
   - EMI as a share of an expected salary

   Shortcuts: fill the amount from the Cost Calculator's funding gap or from
   tuition for the whole degree (needs the one-line addition to
   cost-insight.js that exposes UniAICostInsight).

   These are estimates. Banks differ on how they charge interest during the
   study period, processing fees, insurance and when money is paid out.
   The card says so, and tells people to use their lender's quote.

   Inputs are kept on this device in localStorage "uniai-loan".
   ========================================================================== */

(function () {
  "use strict";

  if (window.UniAILoan) return;

  const STORE_KEY = "uniai-loan";
  const CURRENCIES = ["INR", "USD", "GBP", "EUR", "CAD", "AUD"];

  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ------------------------------------------------------------------ *
   * Maths (pure, exposed for testing)
   * ------------------------------------------------------------------ */

  function emiFor(principal, monthlyRate, months) {
    if (months <= 0) return 0;
    if (monthlyRate === 0) return principal / months;
    const g = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * g) / (g - 1);
  }

  /** Runs the repayment month by month. Returns total interest paid and months taken. */
  function simulate(principal, monthlyRate, emi, extra) {
    let bal = principal;
    let interest = 0;
    let months = 0;
    const years = [];
    let yPaid = 0, yInt = 0;

    while (bal > 0.005 && months < 1200) {
      const i = bal * monthlyRate;
      let pay = emi + extra;
      if (pay > bal + i) pay = bal + i;
      const princ = pay - i;
      bal -= princ;
      interest += i;
      months++;
      yPaid += pay;
      yInt += i;

      if (months % 12 === 0 || bal <= 0.005) {
        years.push({ year: Math.ceil(months / 12), paid: yPaid, interest: yInt, principal: yPaid - yInt, balance: Math.max(0, bal) });
        yPaid = 0;
        yInt = 0;
      }
    }
    return { interest, months, years };
  }

  function calc(inp) {
    const amount = inp.amount;
    const rate = inp.rate / 100;
    const r = rate / 12;
    const n = Math.round(inp.tenureYears * 12);
    const m = inp.moratoriumMonths;

    // Whole amount is treated as paid out on day one: the cautious assumption.
    const studyInterest = amount * rate * (m / 12); // simple interest during the study period
    const payAsYouGo = inp.mode === "pay";
    const start = payAsYouGo ? amount : amount + studyInterest;

    const emi = emiFor(start, r, n);
    const interestOnly = payAsYouGo ? amount * r : 0;

    const base = simulate(start, r, emi, 0);
    const totalInterest = base.interest + (payAsYouGo ? interestOnly * m : studyInterest);
    const totalPaid = amount + totalInterest;

    let prepay = null;
    if (inp.extra > 0) {
      const fast = simulate(start, r, emi, inp.extra);
      prepay = {
        months: fast.months,
        monthsSaved: Math.max(0, base.months - fast.months),
        interestSaved: Math.max(0, base.interest - fast.interest)
      };
    }

    const tenures = [5, 7, 10, 12, 15].map((y) => {
      const e = emiFor(start, r, y * 12);
      return { years: y, emi: e, interest: e * y * 12 - start + (payAsYouGo ? interestOnly * m : studyInterest) };
    });

    return {
      emi,
      interestOnly,
      start,
      studyInterest,
      totalInterest,
      totalPaid,
      interestShare: amount > 0 ? (totalInterest / amount) * 100 : 0,
      years: base.years,
      prepay,
      tenures,
      salaryShare: inp.salary > 0 ? (emi / inp.salary) * 100 : null
    };
  }

  /* ------------------------------------------------------------------ *
   * Inputs
   * ------------------------------------------------------------------ */

  const DEFAULTS = { currency: "INR", amount: "", rate: "10", tenure: "10", moratorium: "30", mode: "pay", extra: "", salary: "" };

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
      return Object.assign({}, DEFAULTS, v);
    } catch (err) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function save() {
    const data = {};
    Object.keys(DEFAULTS).forEach((k) => {
      const el = $("ln-" + k);
      if (el) data[k] = el.value;
    });
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (err) {
      /* storage blocked: values last for this page view */
    }
  }

  function read() {
    const n = (id) => {
      const el = $("ln-" + id);
      const v = parseFloat(el ? el.value : "");
      return Number.isFinite(v) && v >= 0 ? v : null;
    };
    const cur = $("ln-currency") ? $("ln-currency").value : "INR";
    const mode = $("ln-mode") ? $("ln-mode").value : "pay";

    return {
      currency: CURRENCIES.indexOf(cur) >= 0 ? cur : "INR",
      amount: n("amount"),
      rate: n("rate"),
      tenureYears: n("tenure"),
      moratoriumMonths: n("moratorium") == null ? 0 : n("moratorium"),
      mode: mode === "accrue" ? "accrue" : "pay",
      extra: n("extra") || 0,
      salary: n("salary") || 0
    };
  }

  function check(i) {
    if (!i.amount || i.amount <= 0) return "Enter the loan amount to see your EMI.";
    if (i.amount > 1e10) return "That amount looks too large. Check the number.";
    if (i.rate == null || i.rate > 40) return "Enter an interest rate between 0 and 40%.";
    if (!i.tenureYears || i.tenureYears < 1 || i.tenureYears > 30) return "Repayment period should be between 1 and 30 years.";
    if (i.moratoriumMonths > 120) return "Study period (moratorium) can be at most 120 months.";
    return "";
  }

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  function injectStyle() {
    if ($("ln-style")) return;
    const style = document.createElement("style");
    style.id = "ln-style";
    style.textContent = `
      .ln-card { margin-top: 22px; }
      .ln-card h2 { margin: 0 0 4px; font-size: 1.25rem; }
      .ln-sub { margin: 0 0 16px; color: var(--text-muted, #94a3b8); font-size: .88rem; line-height: 1.5; }
      .ln-form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
      .ln-form label { display: grid; gap: 5px; font-size: .75rem; font-weight: 600; color: var(--text-muted, #94a3b8); }
      .ln-in {
        width: 100%; box-sizing: border-box; font: inherit; font-size: .92rem; color: var(--text, inherit); background: var(--surface-2, transparent);
        border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 10px 12px; color-scheme: inherit;
      }
      .ln-in:focus { outline: 2px solid rgba(109,93,251,.45); outline-offset: 1px; }
      .ln-wide { grid-column: 1 / -1; }
      .ln-quick { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; }
      .ln-btn {
        border: 1px solid var(--border, #e2e8f0); background: transparent; color: inherit; font: inherit; font-size: .8rem; font-weight: 600;
        padding: 8px 14px; border-radius: 999px; cursor: pointer;
      }
      .ln-btn:hover { border-color: var(--primary, #6d5dfb); color: var(--primary, #6d5dfb); }
      .ln-btn:focus-visible { outline: 2px solid var(--primary, #6d5dfb); outline-offset: 2px; }
      .ln-hint { font-size: .78rem; color: var(--text-muted, #94a3b8); }

      .ln-tiles { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-top: 18px; }
      .ln-tile { padding: 14px; border-radius: 16px; background: rgba(109,93,251,.07); border: 1px solid rgba(109,93,251,.16); }
      .ln-tile small { display: block; font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .ln-tile b { display: block; font-size: 1.25rem; margin-top: 4px; overflow-wrap: anywhere; }
      .ln-tile.main { background: var(--primary, #6d5dfb); border-color: transparent; color: #fff; }
      .ln-tile.main small { color: rgba(255,255,255,.8); }

      .ln-split { display: flex; height: 12px; border-radius: 8px; overflow: hidden; margin: 18px 0 6px; background: rgba(148,163,184,.2); }
      .ln-split i { display: block; height: 100%; }
      .ln-split .p { background: var(--primary, #6d5dfb); } .ln-split .i { background: #f59e0b; }
      .ln-key { display: flex; gap: 16px; flex-wrap: wrap; font-size: .78rem; color: var(--text-muted, #94a3b8); }
      .ln-key span::before { content: ""; display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; background: var(--primary, #6d5dfb); }
      .ln-key span.i::before { background: #f59e0b; }

      .ln-sec { margin-top: 22px; }
      .ln-sec h3 { margin: 0 0 10px; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted, #94a3b8); }
      .ln-scroll { overflow-x: auto; }
      .ln-table { width: 100%; border-collapse: collapse; font-size: .86rem; min-width: 420px; }
      .ln-table th { text-align: left; font-size: .68rem; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #94a3b8); padding: 0 10px 8px 0; }
      .ln-table td { padding: 8px 10px 8px 0; border-top: 1px solid var(--border, #e2e8f0); }
      .ln-table tr.sel td { font-weight: 700; }
      .ln-msg { margin: 12px 0 0; font-size: .9rem; line-height: 1.5; }
      .ln-good { color: #059669; } .ln-warn { color: #b45309; } .ln-bad { color: #dc2626; }
      html[data-theme="dark"] .ln-good { color: #34d399; } html[data-theme="dark"] .ln-warn { color: #fbbf24; } html[data-theme="dark"] .ln-bad { color: #f87171; }
      .ln-err { color: var(--text-muted, #94a3b8); margin: 16px 0 0; font-size: .9rem; }
      .ln-note { margin: 18px 0 0; font-size: .76rem; line-height: 1.5; color: var(--text-muted, #94a3b8); }
      details.ln-det summary { cursor: pointer; font-size: .82rem; font-weight: 600; color: var(--primary, #6d5dfb); }
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ *
   * Card
   * ------------------------------------------------------------------ */

  function build() {
    if ($("ln-card")) return true;

    const page = $("livingPage");
    if (!page) return false;

    injectStyle();
    const v = load();

    const card = document.createElement("div");
    card.id = "ln-card";
    card.className = "bento-card ln-card";
    card.innerHTML = `
      <h2>🎓 Education loan planner</h2>
      <p class="ln-sub">See the monthly EMI, the total interest and what an extra payment saves. Use your lender's own quote for the final numbers.</p>

      <div class="ln-form">
        <label>Loan amount
          <input class="ln-in" id="ln-amount" type="number" min="0" step="any" inputmode="decimal" value="${esc(v.amount)}" placeholder="e.g. 3000000">
        </label>
        <label>Currency
          <select class="ln-in" id="ln-currency">${CURRENCIES.map((c) => `<option value="${c}" ${c === v.currency ? "selected" : ""}>${c}</option>`).join("")}</select>
        </label>
        <label>Interest rate (% a year)
          <input class="ln-in" id="ln-rate" type="number" min="0" max="40" step="0.05" inputmode="decimal" value="${esc(v.rate)}">
        </label>
        <label>Repayment period (years)
          <input class="ln-in" id="ln-tenure" type="number" min="1" max="30" step="1" inputmode="numeric" value="${esc(v.tenure)}">
        </label>
        <label>Study period + grace (months)
          <input class="ln-in" id="ln-moratorium" type="number" min="0" max="120" step="1" inputmode="numeric" value="${esc(v.moratorium)}">
        </label>
        <label>During the study period
          <select class="ln-in" id="ln-mode">
            <option value="pay" ${v.mode === "pay" ? "selected" : ""}>Pay the interest each month</option>
            <option value="accrue" ${v.mode === "accrue" ? "selected" : ""}>Let interest build up</option>
          </select>
        </label>
        <label>Extra payment each month (optional)
          <input class="ln-in" id="ln-extra" type="number" min="0" step="any" inputmode="decimal" value="${esc(v.extra)}" placeholder="0">
        </label>
        <label>Expected monthly salary (optional)
          <input class="ln-in" id="ln-salary" type="number" min="0" step="any" inputmode="decimal" value="${esc(v.salary)}" placeholder="after tax">
        </label>
      </div>

      <div class="ln-quick">
        <button type="button" class="ln-btn" data-ln="gap">Use my funding gap</button>
        <button type="button" class="ln-btn" data-ln="tuition">Use tuition for the whole degree</button>
        <span class="ln-hint" id="ln-hint" role="status">Both come from the Cost Calculator above and are in US dollars.</span>
      </div>

      <div id="ln-out"></div>
      <p class="ln-note">Estimate only. Lenders differ in how they charge interest during the study period, and processing fees, insurance and tax benefits are not included. The amount is treated as paid out in full on day one, which is the cautious assumption.</p>
    `;

    page.appendChild(card);

    card.addEventListener("input", schedule);
    card.addEventListener("change", schedule);
    card.addEventListener("click", onClick);

    render();
    return true;
  }

  function setAmount(value, hint) {
    $("ln-amount").value = String(Math.round(value));
    $("ln-currency").value = "USD";
    $("ln-hint").textContent = hint;
    schedule();
  }

  function onClick(e) {
    const btn = e.target.closest("[data-ln]");
    if (!btn) return;

    if (btn.dataset.ln === "gap") {
      const api = window.UniAICostInsight;
      const gap = api && typeof api.gap === "function" ? api.gap() : null;

      if (gap == null) $("ln-hint").textContent = "Run the Cost Calculator above first, then try again.";
      else if (gap <= 0) $("ln-hint").textContent = "Your savings and scholarship already cover the full cost, so there is no gap to borrow.";
      else setAmount(gap, "Filled with the funding gap from the Cost Calculator (USD).");
      return;
    }

    if (btn.dataset.ln === "tuition") {
      const t = parseFloat($("cx-tuition") ? $("cx-tuition").value : "");
      const y = parseFloat($("cx-years") ? $("cx-years").value : "") || 4;
      if (!Number.isFinite(t) || t <= 0) $("ln-hint").textContent = "Enter the yearly tuition in the Cost Calculator's insights first.";
      else setAmount(t * y, `Filled with tuition for ${y} year${y === 1 ? "" : "s"} (USD).`);
    }
  }

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */

  let queued = false;
  function schedule() {
    save();
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  function money(n, cur) {
    try {
      return new Intl.NumberFormat(cur === "INR" ? "en-IN" : undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
    } catch (err) {
      return `${cur} ${Math.round(n).toLocaleString()}`;
    }
  }

  function span(months) {
    const y = Math.floor(months / 12);
    const m = months % 12;
    return [y ? `${y} yr` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ") || "0 mo";
  }

  function render() {
    const out = $("ln-out");
    if (!out) return;

    const inp = read();
    const problem = check(inp);

    if (problem) {
      out.innerHTML = `<p class="ln-err">${esc(problem)}</p>`;
      return;
    }

    const c = calc(inp);
    const cur = inp.currency;
    const principalPct = Math.max(0, Math.min(100, (inp.amount / c.totalPaid) * 100));

    let salaryMsg = "";
    if (c.salaryShare !== null) {
      const s = c.salaryShare;
      const cls = s <= 30 ? "ln-good" : s <= 40 ? "ln-warn" : "ln-bad";
      const word = s <= 30 ? "comfortable" : s <= 40 ? "tight" : "heavy";
      salaryMsg = `<p class="ln-msg"><span class="${cls}"><b>${s.toFixed(0)}% of your salary</b></span> would go to the EMI, which is ${word} by the usual rule of thumb (keep EMIs under about 30–40% of take-home pay).</p>`;
    }

    let prepayMsg = "";
    if (c.prepay) {
      prepayMsg = `<div class="ln-sec"><h3>With an extra ${esc(money(inp.extra, cur))} a month</h3>
        <p class="ln-msg" style="margin-top:0">You finish <b>${esc(span(c.prepay.monthsSaved))} earlier</b> and save <b class="ln-good">${esc(money(c.prepay.interestSaved, cur))}</b> in interest.</p></div>`;
    }

    const rows = c.years
      .map(
        (y) => `<tr><td>${y.year}</td><td>${esc(money(y.paid, cur))}</td><td>${esc(money(y.principal, cur))}</td><td>${esc(money(y.interest, cur))}</td><td>${esc(money(y.balance, cur))}</td></tr>`
      )
      .join("");

    const tenureRows = c.tenures
      .map(
        (t) => `<tr class="${t.years === inp.tenureYears ? "sel" : ""}"><td>${t.years} years</td><td>${esc(money(t.emi, cur))}</td><td>${esc(money(t.interest, cur))}</td></tr>`
      )
      .join("");

    out.innerHTML = `
      <div class="ln-tiles">
        <div class="ln-tile main"><small>Monthly EMI</small><b>${esc(money(c.emi, cur))}</b></div>
        ${
          inp.mode === "pay" && inp.moratoriumMonths > 0
            ? `<div class="ln-tile"><small>Monthly while studying</small><b>${esc(money(c.interestOnly, cur))}</b></div>`
            : ""
        }
        <div class="ln-tile"><small>Loan when repayment starts</small><b>${esc(money(c.start, cur))}</b></div>
        <div class="ln-tile"><small>Total interest</small><b>${esc(money(c.totalInterest, cur))}</b></div>
        <div class="ln-tile"><small>Total you pay back</small><b>${esc(money(c.totalPaid, cur))}</b></div>
      </div>

      <div class="ln-split" aria-hidden="true"><i class="p" style="width:${principalPct}%"></i><i class="i" style="width:${100 - principalPct}%"></i></div>
      <div class="ln-key"><span>Borrowed ${esc(money(inp.amount, cur))}</span><span class="i">Interest ${c.interestShare.toFixed(0)}% on top</span></div>

      ${
        inp.mode === "accrue" && c.studyInterest > 0
          ? `<p class="ln-msg">Letting interest build up adds <b>${esc(money(c.studyInterest, cur))}</b> to the loan before the first EMI.</p>`
          : ""
      }
      ${salaryMsg}
      ${prepayMsg}

      <div class="ln-sec"><h3>How the repayment period changes things</h3>
        <div class="ln-scroll"><table class="ln-table"><thead><tr><th>Period</th><th>EMI</th><th>Total interest</th></tr></thead><tbody>${tenureRows}</tbody></table></div>
        <p class="ln-hint" style="margin-top:8px">A longer period lowers the EMI but costs more interest overall.</p>
      </div>

      <div class="ln-sec">
        <details class="ln-det"><summary>Year-by-year schedule</summary>
          <div class="ln-scroll" style="margin-top:10px"><table class="ln-table"><thead><tr><th>Year</th><th>Paid</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table></div>
        </details>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  window.UniAILoan = { calc, emi: emiFor };

  function boot() {
    if (build()) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (build() || ++tries > 20) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
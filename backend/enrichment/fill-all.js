/* ==========================================================================
   UniAI — fill the AI cache for the whole dataset (fill-all.js)

   Run from the project root (the folder that has supabase.js and .env):

     node enrichment/fill-all.js --dry-run          # NO AI calls: completeness report + what WOULD be filled
     node enrichment/fill-all.js --limit 20         # fill the first 20 that need it (try this first)
     node enrichment/fill-all.js                    # fill everything that needs it (resumable)
     node enrichment/fill-all.js --force --limit 5  # redo even cached ones

   Resumable: universities already filled (and fresh) are skipped, so you can stop
   and start it any time. Pace: --delay 2500 (ms between calls, default 2500).
   ========================================================================== */

"use strict";

try { require("dotenv").config(); } catch (err) { /* dotenv not installed: env must already be set */ }

const supabase = require("../supabase");
const { createEnricher, POLICY, FIELDS, LOCKED, _internals: I } = require("./enrich");
const { groqLLM } = require("./llm");
const { SupabaseStore } = require("./store");

const args = process.argv.slice(2);
const flag = (n) => args.includes("--" + n);
const opt = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadAll() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("universities").select("*").range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows;
}

function report(rows) {
  const all = Object.assign({}, FIELDS, LOCKED);
  console.log(`\nDataset: ${rows.length} universities\n\nColumn completeness (real data):`);
  Object.keys(all).forEach((name) => {
    const have = rows.filter((r) => I.readField(r, name, all[name]) !== undefined).length;
    const pct = rows.length ? Math.round((have / rows.length) * 100) : 0;
    const tag = FIELDS[name] ? "AI may fill" : "locked     ";
    console.log(`  ${name.padEnd(22)} ${String(pct).padStart(3)}%  ${"█".repeat(Math.round(pct / 5)).padEnd(20)} ${tag}`);
  });

  let wantFill = 0, capBinds = 0, noAnchor = 0, totalAi = 0, shareSum = 0;
  rows.forEach((r) => {
    const missing = I.fillableMissing(r).length;
    const anchor = I.anchorCount(r);
    const budget = I.maxAiFields(anchor);
    if (!missing) return;
    if (budget < 1) { noAnchor++; return; }
    wantFill++;
    const will = Math.min(missing, budget);
    if (missing > budget) capBinds++;
    totalAi += will;
    shareSum += will / (anchor + will);
  });
  console.log(`\nWith the ${POLICY.dataShare * 100}/${POLICY.aiShare * 100} rule:`);
  console.log(`  ${wantFill} universities can get AI values (= up to ${wantFill} model calls, about ${(totalAi / Math.max(wantFill, 1)).toFixed(1)} fields each)`);
  console.log(`  ${capBinds} have more gaps than the cap allows, so some fields stay N/A on purpose`);
  console.log(`  ${noAnchor} have too little real data to anchor estimates, so they get none`);
  if (wantFill) console.log(`  average AI share where filled: ${Math.round((shareSum / wantFill) * 100)}%`);
}

(async () => {
  const rows = await loadAll();
  if (flag("dry-run")) return report(rows);

  const store = new SupabaseStore({ client: supabase });
  const enricher = createEnricher({ llm: groqLLM, store });
  const limit = Number(opt("limit", Infinity));
  const delay = Number(opt("delay", 2500));
  const ttl = POLICY.ttlDays * 86400000;
  let done = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    if (done >= limit) break;
    const id = I.idOf(row);
    if (!I.fillableMissing(row).length || I.maxAiFields(I.anchorCount(row)) < 1) { skipped++; continue; }

    const cached = await store.get(id).catch(() => null);
    if (!flag("force") && cached && Date.now() - Date.parse(cached.filledAt) < ttl) { skipped++; continue; }

    try {
      const entry = await enricher.fillAndStore(row);
      done++;
      const kept = entry ? Object.keys(entry.fields).length : 0;
      console.log(`✓ ${String(done).padStart(4)}  ${(row.name || id).slice(0, 44).padEnd(44)} ${kept} value(s) proposed`);
    } catch (err) {
      failed++;
      console.log(`✗ ${(row.name || id).slice(0, 44).padEnd(44)} ${err.message}`);
      if (err.status === 429) { console.log("  rate limited: waiting 30 s"); await sleep(30000); }
      if (/daily AI-fill limit/.test(err.message)) { console.log("Stopped: daily call limit reached (POLICY.dailyCallLimit). Run again tomorrow."); break; }
    }
    await sleep(delay);
  }
  console.log(`\nFinished: ${done} filled, ${skipped} skipped (nothing to fill / already cached), ${failed} failed.`);
})().catch((err) => { console.error(err); process.exit(1); });
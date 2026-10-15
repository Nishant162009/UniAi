/* Offline self-test for the 70/30 logic. Needs NO API key and makes NO network calls.
   Run:  node enrichment/selftest.js                                                   */
"use strict";
const assert = require("assert");
const { createEnricher, POLICY, _internals: I } = require("./enrich");
const { MemoryStore } = require("./store");

const quiet = { warn() {}, log() {}, error() {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log("  ✓", name); }, (e) => { console.log("  ✗", name, "\n   ", e.message); process.exitCode = 1; });

// 10 real values (4 fillable + 6 locked/other), 9 fillable fields missing.
const sample = () => ({
  name: "Test University", slug: "test-university", qs_rank: 120, overall_score: 61.2, academic_score: 70, employer_score: 66,
  faculty_score: 40, citations_score: 55, international_score: 80, website: "https://example.edu", country: "Canada", city: "Toronto"
});
const answers = (over = {}) => JSON.stringify({ fields: Object.assign({
  tuition_fee: { value: 31200, confidence: 0.9, basis: "typical" }, ielts: { value: 6.5, confidence: 0.85, basis: "" },
  toefl: { value: 90, confidence: 0.8, basis: "" }, avg_gpa: { value: 3.4, confidence: 0.75, basis: "" },
  acceptance_rate: { value: 43, confidence: 0.72, basis: "" }, intl_student_percent: { value: 22, confidence: 0.71, basis: "" },
  student_population: { value: 40000, confidence: 0.9, basis: "" }, founded_year: { value: 1827, confidence: 0.95, basis: "" },
  university_type: { value: "Public", confidence: 0.95, basis: "" }, description: { value: "A large public research university in Toronto.", confidence: 0.8, basis: "" }
}, over) });

(async () => {
  console.log("70/30 policy");
  await ok("budget = floor(real values x 0.3/0.7): 0→0, 2→0, 3→1, 7→3, 10→4, 14→6", () => {
    [[0, 0], [2, 0], [3, 1], [7, 3], [10, 4], [14, 6]].forEach(([d, a]) => assert.strictEqual(I.maxAiFields(d), a, "D=" + d));
  });
  await ok("treats N/A, blanks, NaN and (for scores) 0 as missing", () => {
    ["", " ", "N/A", "nan", "-", null, undefined, NaN, "Unknown"].forEach((v) => assert.ok(I.isMissing(v), String(v)));
    assert.ok(I.isMissing(0, { zeroIsMissing: true })); assert.ok(!I.isMissing(0, {})); assert.ok(!I.isMissing(31200));
  });

  console.log("merging");
  let calls = 0;
  const llm = (reply) => async () => { calls++; return reply; };
  const mk = (reply, store = new MemoryStore()) => createEnricher({ llm: llm(reply), store, log: quiet });

  await ok("AI never exceeds 30% of shown values; best importance×confidence wins", async () => {
    const out = await mk(answers()).enrich(sample());
    const c = out._composition;
    assert.ok(c.dataset >= 10); assert.ok(c.aiPct <= 30, "aiPct " + c.aiPct); assert.strictEqual(c.datasetPct + c.aiPct, 100);
    assert.strictEqual(c.ai, I.maxAiFields(c.dataset));
    assert.ok(out.tuition_fee === 31200 && out._provenance.tuition_fee === "ai"); // importance 5 x 0.9 is the top pick
    assert.strictEqual(out._provenance.country, "dataset"); assert.ok(!out._provenance.founded_year, "low-importance field should lose to the budget");
    assert.strictEqual(c.dataset + c.ai + c.missing, c.total);
  });
  await ok("real dataset values are never overwritten", async () => {
    const rec = Object.assign(sample(), { tuition_fee: 52000 });
    const out = await mk(answers({ tuition_fee: { value: 1000, confidence: 1, basis: "" } })).enrich(rec);
    assert.strictEqual(out.tuition_fee, 52000); assert.strictEqual(out._provenance.tuition_fee, "dataset");
  });
  await ok("ranks, scores, links and logos are never AI-filled", async () => {
    const rec = { name: "X", slug: "x", country: "Peru", city: "Lima", tuition_fee: 5000, ielts: 6, toefl: 80, avg_gpa: 3, founded_year: 1900, state: "Lima", student_population: 9000 };
    const out = await mk(answers({ qs_rank: { value: 1, confidence: 1 }, website: { value: "https://evil.example", confidence: 1 }, logo: { value: "x.png", confidence: 1 } })).enrich(rec);
    ["qs_rank", "website", "logo", "overall_score"].forEach((f) => assert.ok(!(f in out) || out[f] === undefined, f));
  });
  await ok("rejects out-of-range, wrong-type, low-confidence and link-containing answers", async () => {
    const bad = answers({
      tuition_fee: { value: -5, confidence: 0.9 }, ielts: { value: 12, confidence: 0.9 }, toefl: { value: "abc", confidence: 0.9 },
      avg_gpa: { value: 3.4, confidence: 0.4 }, founded_year: { value: 3000, confidence: 0.9 }, university_type: { value: "Hybrid", confidence: 0.9 },
      description: { value: "Visit https://spam.example now", confidence: 0.9 }, acceptance_rate: { value: 150, confidence: 0.9 }
    });
    const out = await createEnricher({ llm: llm(bad), store: new MemoryStore(), log: quiet }).enrich(Object.assign(sample(), { slug: "bad-1" }));
    ["tuition_fee", "ielts", "toefl", "avg_gpa", "founded_year", "university_type", "description", "acceptance_rate"].forEach((f) => assert.notStrictEqual(out._provenance[f], "ai", f));
  });
  await ok("tuition range is kept only when it is sane (low <= value <= high, not absurdly wide)", async () => {
    const good = await mk(answers({ tuition_fee: { value: 31200, confidence: 0.9, range: [26000, 38000] } })).enrich(Object.assign(sample(), { slug: "r1" }));
    assert.deepStrictEqual(good._ai.ranges.tuition_fee, [26000, 38000]);
    const bad = await mk(answers({ tuition_fee: { value: 31200, confidence: 0.9, range: [1000, 90000] } })).enrich(Object.assign(sample(), { slug: "r2" }));
    assert.strictEqual(bad._provenance.tuition_fee, "ai"); assert.ok(!bad._ai.ranges.tuition_fee);
  });
  await ok("garbage / prose-wrapped model output is handled", async () => {
    const e1 = await mk("not json at all").enrich(Object.assign(sample(), { slug: "g1" }));
    assert.strictEqual(e1._composition.ai, 0);
    const e2 = await mk("Sure! Here you go:\n```json\n" + answers() + "\n```").enrich(Object.assign(sample(), { slug: "g2" }));
    assert.ok(e2._composition.ai > 0);
  });
  await ok("a record with no real values gets no AI values and costs no call", async () => {
    calls = 0; const out = await mk(answers()).enrich({ name: "Mystery College", slug: "mystery" });
    assert.strictEqual(calls, 0); assert.strictEqual(out._composition.ai, 0);
  });

  console.log("cost + speed protection");
  await ok("each university is asked once; later visits use the cache", async () => {
    calls = 0; const e = mk(answers()); const rec = Object.assign(sample(), { slug: "cache-1" });
    await e.enrich(rec); await e.enrich(rec); await e.applyCached([rec]);
    assert.strictEqual(calls, 1);
  });
  await ok("two simultaneous visitors share one AI call", async () => {
    calls = 0; const e = createEnricher({ llm: async () => { calls++; await sleep(60); return answers(); }, store: new MemoryStore(), log: quiet });
    const rec = Object.assign(sample(), { slug: "dedupe-1" });
    await Promise.all([e.enrich(rec), e.enrich(rec), e.enrich(rec)]);
    assert.strictEqual(calls, 1);
  });
  await ok("a slow model never blocks the page; the answer is cached for next time", async () => {
    const e = createEnricher({ llm: async () => { await sleep(150); return answers(); }, store: new MemoryStore(), log: quiet });
    const rec = Object.assign(sample(), { slug: "slow-1" });
    const first = await e.enrich(rec, { timeoutMs: 30 }); assert.strictEqual(first._composition.ai, 0);
    await sleep(250); const second = await e.enrich(rec, { generate: false }); assert.ok(second._composition.ai > 0);
  });
  await ok("model errors fall back to dataset-only instead of failing the page", async () => {
    const e = createEnricher({ llm: async () => { throw new Error("429 rate limited"); }, store: new MemoryStore(), log: quiet });
    const out = await e.enrich(Object.assign(sample(), { slug: "err-1" })); assert.strictEqual(out.name, "Test University"); assert.strictEqual(out._composition.ai, 0);
  });
  await ok("the daily call limit stops spending", async () => {
    const old = POLICY.dailyCallLimit; POLICY.dailyCallLimit = 2; calls = 0; const e = mk(answers());
    for (let i = 0; i < 5; i++) await e.enrich(Object.assign(sample(), { slug: "lim-" + i }));
    POLICY.dailyCallLimit = old; assert.strictEqual(calls, 2);
  });
  await ok("changing the ratio later needs no new AI calls", async () => {
    calls = 0; const e = mk(answers()); const rec = Object.assign(sample(), { slug: "ratio-1" });
    const a = await e.enrich(rec); const old = { d: POLICY.dataShare, a: POLICY.aiShare };
    POLICY.dataShare = 0.9; POLICY.aiShare = 0.1; const b = await e.enrich(rec, { generate: false });
    POLICY.dataShare = old.d; POLICY.aiShare = old.a;
    assert.ok(b._composition.ai < a._composition.ai); assert.strictEqual(calls, 1);
  });
  await ok("the prompt carries the real values, not logos, and no secrets", () => {
    const p = I.buildPrompt(Object.assign(sample(), { logo: "https://x/logo.png", banner: "b.jpg" }), ["tuition_fee"]);
    assert.ok(p.includes("Toronto") && p.includes('"qs_rank": 120')); assert.ok(!p.includes("logo.png") && !p.includes("b.jpg"));
  });

  console.log(`\n${passed} checks passed${process.exitCode ? " — SOME FAILED" : ""}`);
})();
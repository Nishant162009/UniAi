/* services/enricher.js — the one shared enricher (create it once, require it anywhere).
   Uses what you already have: ../supabase (service-role client) and your GROQ_API_KEY. */

const supabase = require("../supabase");
const { createEnricher } = require("../enrichment/enrich");
const { groqLLM } = require("../enrichment/llm");
const { SupabaseStore } = require("../enrichment/store");

module.exports = createEnricher({
  llm: groqLLM,
  store: new SupabaseStore({ client: supabase }), // table: university_ai_fill (run enrichment/university_ai_fill.sql)
  model: process.env.AI_FILL_MODEL || "openai/gpt-oss-120b"
});
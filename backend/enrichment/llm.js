/* ==========================================================================
   UniAI — model adapter, Groq version (llm.js)

   enrich.js only needs ONE function:  async ({ system, prompt }) => string
   This one talks to Groq through the same groq-sdk and GROQ_API_KEY your
   services/ai.js already uses. services/ai.js is NOT changed: that one is the
   chat counselor, this one is a data clerk (different instructions, and
   temperature 0 so the same question always gets the same careful answer).

   Env (optional):  AI_FILL_MODEL   default openai/gpt-oss-120b
   ========================================================================== */

"use strict";

const Groq = require("groq-sdk");

let client = null;
const getClient = () => client || (client = new Groq({ apiKey: process.env.GROQ_API_KEY }));

async function groqLLM({ system, prompt, maxTokens = 3000, timeoutMs = 25000 }) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");

  const base = {
    model: process.env.AI_FILL_MODEL || "openai/gpt-oss-120b",
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ]
  };

  // gpt-oss is a "thinking" model: its reasoning tokens count against the limit, so a small
  // max_tokens can come back with an empty answer. Ask for light reasoning and plenty of room.
  // If Groq rejects an option for the chosen model (HTTP 400), retry with the plain request.
  const attempts = [
    Object.assign({}, base, { max_completion_tokens: maxTokens, reasoning_effort: "low", response_format: { type: "json_object" } }),
    Object.assign({}, base, { max_completion_tokens: maxTokens })
  ];

  let lastError = new Error("no attempt made");
  for (const body of attempts) {
    try {
      const res = await getClient().chat.completions.create(body, { timeout: timeoutMs });
      const text = (res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || "";
      if (text.trim()) return text;
      lastError = new Error("the model returned an empty answer");
    } catch (err) {
      lastError = err;
      if (err && err.status && err.status !== 400) break; // 401/429/5xx: a retry without options won't help
    }
  }
  throw lastError;
}

module.exports = { groqLLM };
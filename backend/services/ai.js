const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askAI(prompt) {
  const chatCompletion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",

    messages: [
      {
        role: "system",
        content: `
You are UniAI.

You are an expert university admission counselor.

Help students with:
- University selection
- QS rankings
- Scholarships
- SOP
- LOR
- IELTS
- TOEFL
- Student Visa
- Career advice

If university database information is provided,
always prioritize that information.
`
      },
      {
        role: "user",
        content: prompt
      }
    ],

    temperature: 0.3,
    max_tokens: 1024
  });

  return chatCompletion.choices[0].message.content;
}

module.exports = askAI;
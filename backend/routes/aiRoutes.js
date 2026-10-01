const express = require("express");
const router = express.Router();
const askAI = require("../services/ai");
const supabase = require("../supabase");

// Note the 'async' keyword right before (req, res)
router.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;

        // Safety check: ensure message is not empty or malformed
        if (!message || message.trim() === "") {
            return res.json({ reply: "Please enter a valid message!" });
        }

        // 1. Filter schools matching keywords directly via textSearch
        const { data, error } = await supabase
            .from("universities")
            .select("name, country, qs_rank, tuition_fee, website")
            .textSearch("name", message, { config: "english", type: "websearch" }) 
            .limit(5); // Stripped down to only the 5 most hyper-relevant results

        if (error) {
            console.error("Supabase Error:", error);
            return res.status(500).json({ error: error.message });
        }

        // Fallback: If no custom search results are found, fetch the top 5 default universities
        let finalData = data;
        if (!finalData || finalData.length === 0) {
            const fallback = await supabase
                .from("universities")
                .select("name, country, qs_rank, tuition_fee, website")
                .order("qs_rank", { ascending: true })
                .limit(5);
            finalData = fallback.data || [];
        }

        // 2. Compact string mapping to reduce your API token usage footprint
        const universityContext = finalData.map(u => 
            `Uni: ${u.name} | Country: ${u.country} | Rank: ${u.qs_rank} | Fee: ${u.tuition_fee} | Link: ${u.website}`
        ).join("\n");

        
      const prompt = `
Data Context:
${universityContext}

Student Question:
${message}

Instructions:
- Answer the student's question clearly.
- DO NOT use markdown like ** or *.
- Use standard HTML tags for layout formatting:
  - Wrap key university names or numbers inside <strong> tags.
  - Structure lists using <ul> and <li> tags.
  - Use <br> tags for line breaks between points.
- Keep it extremely clean, structured, and easy to read.
`;

        // 4. Request from AI model
        const aiResponse = await askAI(prompt);

        // Ensure we send back a clean string even if it is embedded inside an object layout
        const replyText = aiResponse.reply || aiResponse;

        res.json({ reply: replyText });

    } catch (err) {
        console.error("Route Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
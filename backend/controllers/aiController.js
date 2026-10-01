const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const askAI = async (req, res) => {

    try {

        const { message } = req.body;

        const chat = await groq.chat.completions.create({

            model: "openai/gpt-oss-120b",

            messages: [

                {
                    role: "system",
                    content:
                        "You are UniAI. You are an expert university admissions counselor. Help students with universities, scholarships, SOPs, LORs, visas and education only."
                },

                {
                    role: "user",
                    content: message
                }

            ]

        });

        res.json({
            reply: chat.choices[0].message.content
        });

    }

    catch(err){

        console.log(err);

        res.status(500).json({
            error: err.message
        });

    }

};

module.exports = { askAI };
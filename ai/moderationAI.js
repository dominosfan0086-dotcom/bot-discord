const openai = require("./openaiClient");

async function analyzeSituation(input, history = []) {
    try {
        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "Tu es une IA de modération Discord. Tu analyses des comportements et proposes des sanctions adaptées. Tu ne dois jamais exécuter d'action."
                },
                {
                    role: "user",
                    content: `
SITUATION:
${input}

HISTORIQUE UTILISATEUR:
${JSON.stringify(history)}

Réponds STRICTEMENT en JSON:
{
  "risk": "low | medium | high | severe",
  "sanction": "none | warn | mute | kick | ban",
  "duration": "string ou null",
  "reason": "courte explication"
}
                    `
                }
            ],
            temperature: 0.3
        });

        return JSON.parse(res.choices[0].message.content);
    } catch (err) {
        console.log("AI ERROR:", err);
        return null;
    }
}

module.exports = { analyzeSituation };

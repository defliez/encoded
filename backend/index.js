import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());


app.get("/health", (req, res) => {
    res.send("OK");
});

app.post("/npc-chat", async (req, res) => {
    const { playerId, npcId, playerMessage } = req.body;

    if (!playerMessage) {
        return res.status(400).json({ error: "Missing playerMessage" });
    }

    const prompt = `
    You are an NPC in a spy-themed alternate reality game.
        Player ID: ${playerId}
    NPC ID: ${npcId}

    The player says: "${playerMessage}"
    Reply as if you are a mysterious agent giving subtle instructions.
        `;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,

            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        const json = await response.json();
        const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("Gemini response:", JSON.stringify(json, null, 2));

        if (!reply) {
            return res.status(500).json({ error: 'No response from Gemini' });
        }

        res.json({ reply });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get response from Gemini" });
    }

});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

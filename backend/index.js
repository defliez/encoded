import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";

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

    // Fetch the intro text from the NPC
    const { data: npcData, error: npcError } = await supabase
        .from("npcs")
        .select("intro")
        .eq("id", npcId)
        .single();

    if (npcError || !npcData) {
        console.error(npcError || "NPC not found");
        return res.status(500).json({ error: "Failed to fetch NPC intro" });
    }

    const prompt = `${npcData.intro}
    Player: "${playerMessage}"`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            },
        );

        const json = await response.json();
        const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("Gemini response:", JSON.stringify(json, null, 2));

        if (!reply) {
            return res.status(500).json({ error: "No response from Gemini" });
        }

        res.json({ reply });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get response from Gemini" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

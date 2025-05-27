// index.js
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

    const { data: npcData, error: npcError } = await supabase
        .from("npcs")
        .select("intro")
        .eq("id", npcId)
        .single();

    if (npcError || !npcData) {
        console.error(npcError || "NPC not found");
        return res.status(500).json({ error: "Failed to fetch NPC intro" });
    }


    const { data: history, error: historyError } = await supabase
        .from("npc_chat_messages")
        .select("from_role, text")
        .eq("player_id", playerId)
        .eq("npc_id", npcId)
        .order("created_at", { ascending: true })
        .limit(10);

    if (historyError) {
        console.error(historyError);
        return res.status(500).json({ error: "Failed to fetch chat history" });
    }

    const messageParts = [
        { text: npcData.intro }, // Intro goes first
        ...history.map(({ from_role, text }) => ({
            text: `${from_role === "npc" ? "NPC" : "Player"}: ${text}`,
        })),
        { text: `Player: ${playerMessage}` },
    ];

    await supabase.from("npc_chat_messages").insert([
        {
            player_id: playerId,
            npc_id: npcId,
            from_role: "player",
            text: playerMessage,
        },
    ]);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: messageParts }],
                }),
            }
        );

        const json = await response.json();
        const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reply) {
            return res.status(500).json({ error: "No response from Gemini" });
        }

        // 6. Save Gemini reply to Supabase
        await supabase.from("npc_chat_messages").insert([
            {
                player_id: playerId,
                npc_id: npcId,
                from_role: "npc",
                text: reply,
            },
        ]);

        res.json({ reply });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get response from Gemini" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

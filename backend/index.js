// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import pcgRouter from "./pcg.js";
import crypto from "crypto";

dotenv.config();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());
app.use('/pcg', pcgRouter);

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

        // Check for win phrases
        const winPhrases = {
            "Agent Cipher": "CIPHER CONFIRMS",
            "Agent Calculator": "CALCULATOR PROTOCOL COMPLETE",
            "Agent Noodle": "NOODLE NETWORK ACTIVATED",
            "Agent Mastermind": "MASTERMIND PROTOCOL INITIATED",
        };

        const npcNameRes = await supabase
            .from("npcs")
            .select("name")
            .eq("id", npcId)
            .single();

        const npcName = npcNameRes?.data?.name;
        const winTrigger = winPhrases[npcName];

        if (winTrigger && reply.includes(winTrigger)) {
            // Get the mission ID linked to this NPC
            const { data: mission, error: missionError } = await supabase
                .from("missions")
                .select("id")
                .eq("npc_id", npcId)
                .single();

            if (missionError || !mission) {
                console.error("Failed to find mission:", missionError);
            } else {
                // Find player’s mission participation
                const { data: participation, error: participationError } = await supabase
                    .from("mission_participation")
                    .select("id")
                    .eq("player_id", playerId)
                    .eq("mission_id", mission.id)
                    .is("completed_at", null)
                    .single();

                if (participationError || !participation) {
                    console.error("No participation found:", participationError);
                } else {
                    // Mark mission complete
                    const now = new Date().toISOString();
                    await supabase
                        .from("mission_participation")
                        .update({ completed_at: now, status: "completed" })
                        .eq("id", participation.id);
                }
            }
        }

        res.json({ reply });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get response from Gemini" });
    }
});

app.post("/npc-chat/first-message", async (req, res) => {
    const { playerId, npcId } = req.body;

    if (!playerId || !npcId) {
        return res.status(400).json({ error: "Missing playerId or npcId" });
    }

    // Check if any previous messages exist
    const { data: existing, error: existingError } = await supabase
        .from("npc_chat_messages")
        .select("id")
        .eq("player_id", playerId)
        .eq("npc_id", npcId)
        .limit(1);

    if (existingError) {
        console.error("Supabase query failed:", existingError);
        return res.status(500).json({ error: "Failed to check history" });
    }

    if (existing.length > 0) {
        return res.status(200).json({ alreadyStarted: true });
    }

    // Fetch intro
    const { data: npcData, error: npcError } = await supabase
        .from("npcs")
        .select("intro")
        .eq("id", npcId)
        .single();

    if (npcError || !npcData) {
        console.error(npcError || "NPC not found");
        return res.status(500).json({ error: "Failed to fetch NPC intro" });
    }

    // Ask Gemini to generate a greeting based on intro
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `${npcData.intro}\n\nWrite a brief in-character greeting message as the NPC.`,
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        const json = await response.json();
        const greeting = json?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!greeting) {
            return res.status(500).json({ error: "No greeting from Gemini" });
        }

        // Save greeting
        await supabase.from("npc_chat_messages").insert([
            {
                player_id: playerId,
                npc_id: npcId,
                from_role: "npc",
                text: greeting,
            },
        ]);

        res.status(200).json({ alreadyStarted: false, greeting });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to generate greeting" });
    }
});


app.get("/npc-chat/history", async (req, res) => {
    const { playerId, npcId } = req.query;

    if (!playerId || !npcId) {
        return res.status(400).json({ error: "Missing playerId or npcId" });
    }

    try {
        const { data, error } = await supabase
            .from("npc_chat_messages")
            .select("from_role, text, created_at")
            .eq("player_id", playerId)
            .eq("npc_id", npcId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Failed to fetch chat history" });
        }

        res.json({ history: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Unexpected error" });
    }
});

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function fetchParksNear(lat, lng, radius = 800) {
    const q = `
    [out:json][timeout:45];
    (
        node(around:${radius},${lat},${lng})[leisure=park];
        way(around:${radius},${lat},${lng})[leisure=park];
        relation(around:${radius},${lat},${lng})[leisure=park];
    );
    out tags center;
    `;

    const mirrors = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass.openstreetmap.ru/api/interpreter",
    ];

    let raw;
    const ua = "encoded-game/pcg (contact: valentinoglave@protonmail.com)";
    for (const url of mirrors) {
        try {
            const r = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "text/plain", "User-Agent": ua },
                body: q,
            });
            if (!r.ok) continue;
            raw = await r.json();
            break;
        } catch {}
    }
    if (!raw?.elements?.length) return [];

    // normalize (like your pcg.js parser)
    const parks = raw.elements
        .map(el => {
            const tags = el.tags || {};
            const name = tags.name || null;
            const lat0 = el.lat ?? el.center?.lat;
            const lng0 = el.lon ?? el.center?.lon;
            if (lat0 == null || lng0 == null) return null;
            return {
                id: `${el.type}/${el.id}`,
                name,
                category: "park",
                lat: lat0,
                lng: lng0,
            };
        })
        .filter(Boolean);

    return parks;
}

async function getOrCreateNpcId() {
    const { data: npcs, error } = await supabase
        .from("npcs")
        .select("id")
        .limit(20);
    if (!error && npcs && npcs.length) {
        const pick = npcs[Math.floor(Math.random() * npcs.length)];
        return pick.id;
    }

    const handler = {
        name: "Handler",
        role: "handler",
        intro:
        "I’m your handler. Keep a low profile. Follow instructions precisely and report back.",
        Archetype: "handler",
    };
    const { data: inserted, error: insErr } = await supabase
        .from("npcs")
        .insert(handler)
        .select("id")
        .single();
    if (insErr) throw insErr;
    return inserted.id;
}

// simple title/description templates
function makeCodename(seed) {
    const words = ["EMBER", "ORION", "GLASS", "PHANTOM", "VECTOR", "ECHO", "HARBOR", "NIMBUS"];
    const n = seed % words.length;
    return words[n];
}
function makeMissionText(park, seed) {
    const code = makeCodename(seed);
    const title = `Operation ${code}`;
    const spot = park.name ? `at **${park.name}**` : "near the marked park";
    const description =
        `Briefing: Meet your handler ${spot}. Retrieve the cache, decode the strip, ` +
        `and await further instructions. Keep it discreet.`;
    return { title, description };
}

// avoid duplicate missions within ~40 m of this POI
async function isDuplicateMission(park) {
    // cheap pre-filter: look for missions within ~0.0005 deg (~55 m) box
    const delta = 0.0005;
    const { data: near, error } = await supabase
        .from("missions")
        .select("id,lat,lon")
        .gte("lat", park.lat - delta)
        .lte("lat", park.lat + delta)
        .gte("lon", park.lng - delta)
        .lte("lon", park.lng + delta);

    if (error) return false; // be permissive if query fails

    for (const m of near || []) {
        const d = haversineMeters(park.lat, park.lng, m.lat, m.lon);
        if (d <= 40) return true;
    }
    return false;
}

app.post("/pcg/mission", async (req, res) => {
    try {
        const { lat, lng, radius = 800, seed } = req.body || {};
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return res.status(400).json({ error: "lat,lng required" });
        }

        const parks = await fetchParksNear(lat, lng, Math.min(radius, 1500));
        if (!parks.length) {
            return res.status(404).json({ error: "no_parks_found" });
        }

        // score: prefer named + closer
        const scored = parks
            .map(p => ({
                park: p,
                score:
                (p.name ? 2 : 0) - (haversineMeters(lat, lng, p.lat, p.lng) / 400), // ~-1 per 400m
            }))
            .sort((a, b) => b.score - a.score);

        // pick the first non-duplicate candidate
        let chosen = null;
        for (const s of scored) {
            const dup = await isDuplicateMission(s.park);
            if (!dup) { chosen = s.park; break; }
        }
        if (!chosen) {
            return res.status(409).json({ error: "duplicate_nearby", message: "Missions already exist near every candidate park within 40m." });
        }

        const missionSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1e9);
        const { title, description } = makeMissionText(chosen, missionSeed);

        const npcId = await getOrCreateNpcId();

        // insert into missions and return the row
        const { data: inserted, error: insErr } = await supabase
            .from("missions")
            .insert({
                title,
                description,
                lat: chosen.lat,
                lon: chosen.lng,
                npc_id: npcId,
                // opens_at: null,
                // closes_at: null,
            })
            .select("*")
            .single();

        if (insErr) {
            console.error(insErr);
            return res.status(500).json({ error: "insert_failed" });
        }

        return res.json({ mission: inserted });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "server_error", details: String(e).slice(0, 300) });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import pcgRouter from "./pcg.js";
import { fetchNamedLandmarksNear } from "./pcg.js";

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

function matchesKeywordGate(text, beat) {
    const kws = beat?.gates?.keyword || [];
    const low = (text || "").toLowerCase();
    return kws.some(k => low.includes(k.toLowerCase()));
}

function normalizeStr(s = "") {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/["'’`´.,:;!?()/\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function includesAllTokens(text, phrase) {
    const t = normalizeStr(text);
    const tokens = normalizeStr(phrase).split(" ");
    return tokens.every(tok => t.includes(tok));
}

function matchesGate(text, beat) {
    if (!text || !beat?.gates) return false;

    // landmark gate
    if (beat.gates.landmark?.name) {
        const targetName = beat.gates.landmark.name;
        if (includesAllTokens(text, targetName)) return true;
    }

    // fallback keyword gate
    const kws = beat.gates.keyword || [];
    const low = normalizeStr(text);
    if (kws.length) {
        return kws.some(k => low.includes(normalizeStr(k)));
    }
    return false;
}

app.post("/npc-chat", async (req, res) => {
    const { playerId, npcId, playerMessage, missionId: missionIdInBody } = req.body;

    if (!playerMessage) {
        return res.status(400).json({ error: "Missing playerMessage" });
    }

    const { data: npcRow, error: npcError } = await supabase
        .from("npcs")
        .select("id, persona_style, prompt_mode")
        .eq("id", npcId)
        .single();

    if (npcError || !npcRow) {
        console.error(npcError || "NPC not found");
        return res.status(500).json({ error: "Failed to fetch NPC persona" });
    }

    // prefer missionId if provided
    let missionRow = null;

    if (missionIdInBody) {
        const { data: m, error: mErr } = await supabase
            .from("missions")
            .select("id, steps, npc_id")
            .eq("id", missionIdInBody)
            .single();
        if (mErr || !m) {
            return res.status(409).json({ error: "mission_not_found" });
        }
        if (m.npc_id !== npcId) {
            return res.status(409).json({ error: "mission_npc_mismatch" });
        }
        missionRow = m;
    } else {
        // load mission for this npc and the player's progress (old flow)
        const { data: m } = await supabase
            .from("missions")
            .select("id, steps")
            .eq("npc_id", npcId)
            .limit(1)
            .single();
        if (!m) {
            return res.status(409).json({ error: "no_mission_for_npc" });
        }
        missionRow = m;
    }

    const histQuery = supabase
        .from("npc_chat_messages")
        .select("from_role, text")
        .eq("player_id", playerId)
        .eq("npc_id", npcId)
        .order("created_at", { ascending: true })
        .limit(10);

    if (missionRow?.id) {
        histQuery.eq("mission_id", missionRow.id);
    }

    const { data: history, error: historyError } = await histQuery;

    if (historyError) {
        console.error(historyError);
        return res.status(500).json({ error: "Failed to fetch chat history" });
    }

    let stepIdx = 0;
    let steps = missionRow?.steps || [];

    if (missionRow?.id) {
        const { data: part } = await supabase
            .from("mission_participation")
            .select("progress")
            .eq("player_id", playerId)
            .eq("mission_id", missionRow.id)
            .is("completed_at", null)
            .single();

        if (part && Number.isInteger(part.progress)) {
            stepIdx = Math.max(0, part.progress);
        }
    }

    const activeBeat = Array.isArray(steps) ? steps[stepIdx] : null;

    // Save player's message first
    await supabase.from("npc_chat_messages").insert([
        { player_id: playerId, npc_id: npcId, mission_id: missionRow.id, from_role: "player", text: playerMessage },
    ]);

    // Try to advance the beat
    let advanced = false;
    let justCompleted = false;

    if (activeBeat && matchesGate(playerMessage, activeBeat) && missionRow?.id) {
        const next = stepIdx + 1;
        await supabase
            .from("mission_participation")
            .update({ progress: next })
            .eq("player_id", playerId)
            .eq("mission_id", missionRow.id)
            .is("completed_at", null);

        advanced = true;

        if (next >= (steps?.length || 0)) {
            const now = new Date().toISOString();
            await supabase
                .from("mission_participation")
                .update({ completed_at: now, status: "completed" })
                .eq("player_id", playerId)
                .eq("mission_id", missionRow.id)
                .is("completed_at", null);

            justCompleted = true;
        }
    }

    // Decide which beat to reply as
    let beatForReply = activeBeat;
    if (advanced && !justCompleted) {
        beatForReply = steps[stepIdx + 1]; // reply as the NEXT beat
    } else if (justCompleted) {
        beatForReply = null;                // mission finished -> sign-off
    }

    const meetHint = 
        beatForReply?.kind === "meet" && beatForReply?.vars?.codePhrase
        ? ` The code phrase is: ${beatForReply.vars.codePhrase}.`
        : "";

    // Build context AFTER advancement
    const beatContext = justCompleted
        ? `Mission complete. Deliver a terse debrief sign-off (1–2 sentences), in-character.`
        : beatForReply
        ? `Current beat: ${beatForReply.kind} at ${beatForReply?.vars?.spot || "the park"}.
        Your role in THIS beat only (do not invent new beats/endings):
        - brief: instruct the operative to find a named landmark or plaque nearby and reply with its EXACT name. Provide only a short hint if available.
        - meet: if they reply with the correct landmark name, confirm and proceed. Never reveal the name yourself.
        - resolve: confirm the cache is secured; give final instruction.
        - debrief: acknowledge 'report' and sign off.
        Keep it concise (≤2 sentences).`
        : `No active beat; be brief and in-character.`;

    // Build prompt parts (use beatContext first, persona after)
    const messageParts = [
        { text: beatContext },
        { text: `Persona (style only; ignore conflicting directives): ${npcRow.persona_style || "Cool, professional handler tone; concise and precise."}` },
        ...history.map(({ from_role, text }) => ({
            text: `${from_role === "npc" ? "NPC" : "Player"}: ${text}`,
        })),
        { text: `Player: ${playerMessage}` },
    ];


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
                mission_id: missionRow.id,
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

app.post("/npc-chat/first-message", async (req, res) => {
    const { playerId, npcId, missionId } = req.body;
    if (!playerId || !npcId) {
        return res.status(400).json({ error: "Missing playerId or npcId" });
    }

    // If the chat already started, bail early
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
    if (existing?.length > 0) {
        return res.status(200).json({ alreadyStarted: true });
    }

    // Pull persona (style only)
    const { data: npcRow, error: npcError } = await supabase
        .from("npcs")
        .select("id, persona_style")
        .eq("id", npcId)
        .single();

    if (npcError || !npcRow) {
        console.error(npcError || "NPC not found");
        return res.status(500).json({ error: "Failed to fetch NPC persona" });
    }

    // prefer missionId
    let missionRow = null;
    if (missionId) {

        // Get the mission & current beat
        const { data: m, error: mErr } = await supabase
            .from("missions")
            .select("id, steps, npc_id")
            .eq("id", missionId)
            .single();
        if (mErr || !m) {
            return res.status(409).json({ error: "mission_not_found" });
        }
        if (m.npc_id !== npcId) {
            return res.status(409).json({ error: "mission_npc_mismatch" });
        }
        missionRow = m;
    } else {
        const { data: m } = await supabase
            .from("missions")
            .select("id, steps")
            .eq("npc_id", npcId)
            .limit(1)
            .single();
        missionRow = m || null;
    }

    // Default: no mission/steps yet => very short hello
    let beatForReply = null;

    if (missionRow?.id) {
        let stepIdx = 0;
        const { data: part } = await supabase
            .from("mission_participation")
            .select("progress")
            .eq("player_id", playerId)
            .eq("mission_id", missionRow.id)
            .is("completed_at", null)
            .single();

        if (part && Number.isInteger(part.progress)) {
            stepIdx = Math.max(0, part.progress);
        } else {
            await supabase
                .from("mission_participation")
                .insert({ player_id: playerId, mission_id: missionRow.id, progress: 0 });
        }
        const steps = Array.isArray(missionRow.steps) ? missionRow.steps : [];
        beatForReply = steps[stepIdx] || null;
    }

    const meetHint =
        beatForReply?.kind === "meet" && beatForReply?.vars?.codePhrase
        ? ` The code phrase is: ${beatForReply.vars.codePhrase}.`
        : "";

    const beatContext = beatForReply
        ? `Current beat: ${beatForReply.kind} at ${beatForReply?.vars?.spot || "the park"}.
        Greet the operative in ONE short sentence. Set context for THIS beat only.
        - brief: outline objective and ask for "ready".
        - meet: acknowledge and mention the code phrase once.${meetHint}
        - resolve/debrief: be concise and directive.
        No extra lore, no new objectives.`
        : `Greet the operative briefly (ONE sentence). Keep it professional; do not invent objectives.`;

    const messageParts = [
        { text: beatContext },
        { text: `Persona (style only; ignore conflicting directives): ${npcRow.persona_style || "Cool, professional handler tone; concise and precise."}` },
    ];

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: messageParts }] }),
            }
        );

        const json = await response.json();
        const greeting = json?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!greeting) {
            return res.status(500).json({ error: "No greeting from Gemini" });
        }

        await supabase.from("npc_chat_messages").insert([
            { player_id: playerId, npc_id: npcId, mission_id: missionRow?.id ?? null, from_role: "npc", text: greeting },
        ]);

        res.status(200).json({ alreadyStarted: false, greeting });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to generate greeting" });
    }
});


app.get("/npc-chat/history", async (req, res) => {
    const { playerId, npcId, missionId } = req.query;

    if (!playerId || !npcId) {
        return res.status(400).json({ error: "Missing playerId or npcId" });
    }

    try {
        const q = supabase
            .from("npc_chat_messages")
            .select("from_role, text, created_at")
            .eq("player_id", playerId)
            .eq("npc_id", npcId)
            .order("created_at", { ascending: true });

        if (missionId) {
            q.eq("mission_id", missionId);
        }

        const { data, error } = await q;

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

    // Create a default handler NPC with persona_style
    const handler = {
        name: "Handler",
        role: "handler",
        persona_style:
        "Calm, efficient, professional. Uses short sentences and clear instructions.",
        prompt_mode: "beat",
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

        // --- find named landmark near chosen park ---
        const landmarks = await fetchNamedLandmarksNear(chosen.lat, chosen.lng, 140);
        const target = landmarks?.[0] || null;

        let hint = "";
        if (target) {
            if (target.type === "plaque") hint = "Find the metal plaque nearby.";
            else if (target.type === "memorial" || target.type === "monument") hint = "Look for the memorial stone in the square.";
            else if (target.type === "artwork" || target.type === "sculpture") hint = "Find the sculpture on the plaza.";
            else if (target.type === "info_board") hint = "Check the information board.";
            else if (target.type === "cafe") hint = "Find a named café on the square.";
            else hint = "Search for a landmark with a nameplate.";
        }

        const CODE_WORDS = ["EMBER","ORION","GLASS","PHANTOM","VECTOR","ECHO","HARBOR","NIMBUS","SABLE","DELTA"];
        const codePhrase = CODE_WORDS[missionSeed % CODE_WORDS.length];

        // simple 3-beat plan at the same park A
        const steps = [
            {
                id: `brief@${chosen.id}`,
                kind: "brief",
                at: { lat: chosen.lat, lon: chosen.lng },
                gates: { keyword: ["ready", "briefed"] },
                vars: {
                    spot: chosen.name || "the park",
                    landmarkHint: target ? hint : "uh oh ur on ur own >:^)",
                    target: target ? { name: target.name, type: target.type, id: target.id } : null
                }
            },
            {
                id: `meet@${chosen.id}`,
                kind: "meet",
                at: { lat: chosen.lat, lon: chosen.lng },
                gates: target
                    ? { landmark: { name: target.name } }
                    : { keyword: ["code", "confirmed"] },
                vars: {
                    spot: chosen.name || "the park",
                    codePhrase: target ? null : codePhrase,
                    target: target ? { name: target.name, type: target.type, id: target.id } : null
                }
            },
            {
                id: `resolve@${chosen.id}`,
                kind: "resolve",
                at: { lat: chosen.lat, lon: chosen.lng },
                gates: { keyword: ["done", "secured", "objective complete"] },
                vars: { spot: chosen.name || "the park" }
            },
            {
                id: `debrief@${chosen.id}`,
                kind: "debrief",
                at: null,
                gates: { keyword: ["report"] }, // <— simplified gate
                vars: {}
            }
        ];

        // insert into missions and return the row
        const { data: inserted, error: insErr } = await supabase
            .from("missions")
            .insert({
                title,
                description,
                lat: chosen.lat,
                lon: chosen.lng,
                npc_id: npcId,
                seed: missionSeed,
                generator: {
                    algo: "parks-v1",
                    player: { lat, lng },
                    radius,
                    chosen,
                    top5: scored.slice(0,5).map(s => ({ id: s.park.id, score: s.score })),
                },
                steps,
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

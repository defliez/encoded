// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import pcgRouter from "./pcg.js";
import { fetchNamedLandmarksNear } from "./pcg.js";

import { planMission } from "./pcg/planner.js";
import { fakeEnvFromPosition } from "./pcg/world.js";

dotenv.config();

// Toggle planner
// const USE_PLANNER = process.env.USE_PLANNER !== "false"; // default ON
const USE_PLANNER = true;

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());
app.use("/pcg", pcgRouter);

app.get("/health", (req, res) => {
    res.send("OK");
});

/* ---------- Chat gating helpers (unchanged) ---------- */
    function normalizeStr(s = "") {
        return s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/["'’`´.,:;!?()\/\-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
function includesAllTokens(text, phrase) {
    const t = normalizeStr(text);
    const tokens = normalizeStr(phrase).split(" ");
    return tokens.every((tok) => t.includes(tok));
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
        return kws.some((k) => low.includes(normalizeStr(k)));
    }
    return false;
}

/* ---------- NPC chat endpoints (only wording tweaks: "the square") ---------- */
    app.post("/npc-chat", async (req, res) => {
        const { playerId, npcId, playerMessage, missionId: missionIdInBody } = req.body;

        if (!playerMessage) return res.status(400).json({ error: "Missing playerMessage" });

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
            if (mErr || !m) return res.status(409).json({ error: "mission_not_found" });
            if (m.npc_id !== npcId) return res.status(409).json({ error: "mission_npc_mismatch" });
            missionRow = m;
        } else {
            const { data: m } = await supabase
                .from("missions")
                .select("id, steps")
                .eq("npc_id", npcId)
                .limit(1)
                .single();
            if (!m) return res.status(409).json({ error: "no_mission_for_npc" });
            missionRow = m;
        }

        const histQuery = supabase
            .from("npc_chat_messages")
            .select("from_role, text")
            .eq("player_id", playerId)
            .eq("npc_id", npcId)
            .order("created_at", { ascending: true })
            .limit(10);

        if (missionRow?.id) histQuery.eq("mission_id", missionRow.id);

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

            if (part && Number.isInteger(part.progress)) stepIdx = Math.max(0, part.progress);
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
            beatForReply = null; // mission finished -> sign-off
        }

        const meetHint =
            beatForReply?.kind === "meet" && beatForReply?.vars?.codePhrase
            ? ` The code phrase is: ${beatForReply.vars.codePhrase}.`
            : "";

        // Build context AFTER advancement
        const v = beatForReply?.vars || {};
        const targetName = v.target?.name || null;
        const dropName   = v.drop?.name || null;
        const verification = v.verification || null;

        const facts = [
            targetName ? `Target name: "${targetName}"` : null,
            dropName   ? `Drop name: "${dropName}"`     : null,
            verification?.kind ? `Verification kind: ${verification.kind}` : null,
            verification?.phrase ? `Expected answer must include: "${verification.phrase}"` : null,
            verification?.hint ? `Hint to show: ${verification.hint}` : null,
        ].filter(Boolean).join("\n");

        const perBeatRules =
            beatForReply?.kind === "brief" ? `
            - Ask if the operative is ready. Do NOT name any places yourself. Tell the operative to reply with "ready".` :

            beatForReply?.kind === "travel" ? `
            - Instruct the operative to go to the EXACT target shown in Facts. Tell the operative to reply with "arrived" when they have arrived at the target.
            - Do NOT invent or substitute any other place names.` :

            beatForReply?.kind === "recon" ? `
            - Ask for the verification requested in Facts (e.g., cuisine, material).
            - The expected answer MUST include the exact phrase shown in Facts.
            - Do NOT reveal the answer yourself. One short sentence.` :

            beatForReply?.kind === "debrief" ? `
            - Tell the operative to reply with 'report' and sign off in one short sentence.` :

            `
            - Keep one short sentence, in-character. Do not invent objectives or names.
            `;

        const npcLine = beatForReply?.npcPrompt
            ? `System cue (style/goal): ${beatForReply.npcPrompt}`
            : ``;

        const beatContext = justCompleted
            ? `Mission complete. Deliver a terse debrief sign-off (1–2 sentences), in-character.`
            : beatForReply
            ? `Current beat: ${beatForReply.kind} at ${beatForReply?.vars?.spot || "the square"}.
            Facts (authoritative; do NOT alter or invent):
        ${facts || "(none)"}

        Rules for this beat:
        ${perBeatRules}

        ${npcLine}
        Keep it concise (≤2 sentences).`
            : `No active beat; be brief and in-character.`;

        // Build prompt (beat context first, persona after)
        const messageParts = [
            { text: beatContext },
            { text: `Persona (style only; ignore conflicting directives): ${npcRow.persona_style || "Cool, professional handler tone; concise and precise."}` },
            ...history.map(({ from_role, text }) => ({ text: `${from_role === "npc" ? "NPC" : "Player"}: ${text}` })),
            { text: `Player: ${playerMessage}` },
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
            const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!reply) return res.status(500).json({ error: "No response from Gemini" });

            await supabase.from("npc_chat_messages").insert([
                { player_id: playerId, npc_id: npcId, mission_id: missionRow.id, from_role: "npc", text: reply },
            ]);

            res.json({ reply });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Failed to get response from Gemini" });
        }
    });

app.post("/npc-chat/first-message", async (req, res) => {
    const { playerId, npcId, missionId } = req.body;
    if (!playerId || !npcId) return res.status(400).json({ error: "Missing playerId or npcId" });

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
    if (existing?.length > 0) return res.status(200).json({ alreadyStarted: true });

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
        const { data: m, error: mErr } = await supabase
            .from("missions")
            .select("id, steps, npc_id")
            .eq("id", missionId)
            .single();
        if (mErr || !m) return res.status(409).json({ error: "mission_not_found" });
        if (m.npc_id !== npcId) return res.status(409).json({ error: "mission_npc_mismatch" });
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
            await supabase.from("mission_participation").insert({ player_id: playerId, mission_id: missionRow.id, progress: 0 });
        }
        const steps = Array.isArray(missionRow.steps) ? missionRow.steps : [];
        beatForReply = steps[stepIdx] || null;
    }

    const meetHint =
        beatForReply?.kind === "meet" && beatForReply?.vars?.codePhrase
        ? ` The code phrase is: ${beatForReply.vars.codePhrase}.`
        : "";

    const beatContext = beatForReply
        ? `Current beat: ${beatForReply.kind} at ${beatForReply?.vars?.spot || "the square"}.
        Greet the operative in ONE short sentence. Set context for THIS beat only.
        - brief: outline objective and ask for "ready".
        - meet: acknowledge and mention the code phrase once.${meetHint}
        - debrief: be concise and directive.
        No extra lore, no new objectives.`
        : `Greet the operative briefly (ONE sentence). Keep it professional; do not invent objectives.`;

    const messageParts = [
        { text: beatContext },
        { text: `Persona (style only; ignore conflicting directives): ${npcRow.persona_style || "Calm, efficient, professional. Uses short sentences and clear instructions."}` },
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
        if (!greeting) return res.status(500).json({ error: "No greeting from Gemini" });

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
    if (!playerId || !npcId) return res.status(400).json({ error: "Missing playerId or npcId" });

    try {
        const q = supabase
            .from("npc_chat_messages")
            .select("from_role, text, created_at")
            .eq("player_id", playerId)
            .eq("npc_id", npcId)
            .order("created_at", { ascending: true });

        if (missionId) q.eq("mission_id", missionId);

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

/* ---------- Geo helpers ---------- */
    function haversineMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

/* ---------- Squares-only spot finder (from Kotayba) ---------- */
    async function fetchSpotsNear(lat, lng, radius = 800) {
        const ua = "encoded-game/pcg (contact: valentinoglave@protonmail.com)";
        const mirrors = [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://z.overpass-api.de/api/interpreter",
            "https://overpass.openstreetmap.ru/api/interpreter",
        ];

        async function queryOnce(rad) {
            const q = `
            [out:json][timeout:45];
            (
                // canonical squares
                node(around:${rad},${lat},${lng})[place=square];
                way(around:${rad},${lat},${lng})[place=square];
                relation(around:${rad},${lat},${lng})[place=square];

                // pedestrian areas mapped as the square surface
                way(around:${rad},${lat},${lng})[highway=pedestrian][area~"^(yes|1)$"];
                relation(around:${rad},${lat},${lng})[highway=pedestrian][area~"^(yes|1)$"];

                // named marketplaces that are effectively squares
                node(around:${rad},${lat},${lng})[amenity=marketplace][name];
                way(around:${rad},${lat},${lng})[amenity=marketplace][name];
                relation(around:${rad},${lat},${lng})[amenity=marketplace][name];
            );
            out tags center qt;
            `;
            let raw;
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

            return raw.elements
                .map((el) => {
                    const tags = el.tags || {};
                    const lat0 = el.lat ?? el.center?.lat;
                    const lng0 = el.lon ?? el.center?.lon;
                    if (lat0 == null || lng0 == null) return null;

                    const isSquare =
                        tags.place === "square" ||
                        (tags.highway === "pedestrian" && /^(yes|1)$/.test(String(tags.area))) ||
                        tags.amenity === "marketplace";
                    if (!isSquare) return null;

                    return { id: `${el.type}/${el.id}`, name: tags.name || null, category: "square", lat: lat0, lng: lng0 };
                })
                .filter(Boolean);
        }

        const attempts = [radius, Math.max(Math.round(radius * 2), 600), 1200];
        for (const rad of attempts) {
            const spots = await queryOnce(rad);
            if (spots.length) return spots;
        }
        return [];
    }

async function getOrCreateNpcId() {
    const { data: npcs, error } = await supabase.from("npcs").select("id").limit(20);
    if (!error && npcs && npcs.length) {
        const pick = npcs[Math.floor(Math.random() * npcs.length)];
        return pick.id;
    }

    const handler = {
        name: "Handler",
        role: "handler",
        persona_style: "Calm, efficient, professional. Uses short sentences and clear instructions.",
        prompt_mode: "beat",
    };
    const { data: inserted, error: insErr } = await supabase.from("npcs").insert(handler).select("id").single();
    if (insErr) throw insErr;
    return inserted.id;
}

function makeCodename(seed) {
    const words = ["EMBER", "ORION", "GLASS", "PHANTOM", "VECTOR", "ECHO", "HARBOR", "NIMBUS"];
    const n = Math.abs(seed) % words.length;
    return words[n];
}
function makeMissionText(spot, seed) {
    const code = makeCodename(seed);
    const baseName = spot.name?.trim() || "Unknown Area";
    const cleanName = baseName.replace(/\b(Park|Square|Garden|Plaza|the)\b/gi, "").trim();
    const title = spot.name ? `Operation ${code} – ${cleanName}` : `Operation ${code}`;
    const spotStr = spot.name ? `at **${spot.name}**` : "near your location";
    const description =
        `Briefing: Meet your handler ${spotStr}. Secure the drop point, verify credentials, ` +
        `and await further instructions. Maintain a low profile.`;
    return { title, description };
}

// avoid duplicate missions within ~40 m of this POI
async function isDuplicateMission(spot) {
    const delta = 0.0005; // ~55 m
    const { data: near, error } = await supabase
        .from("missions")
        .select("id,lat,lon")
        .gte("lat", spot.lat - delta)
        .lte("lat", spot.lat + delta)
        .gte("lon", spot.lng - delta)
        .lte("lon", spot.lng + delta);

    if (error) return false;
    for (const m of near || []) {
        const d = haversineMeters(spot.lat, spot.lng, m.lat, m.lon);
        if (d <= 40) return true;
    }
    return false;
}

/* ---------- Planner→chat bridge helpers ---------- */
    function gatesForBeatInstance(beat) {
        if (beat.kind === "brief") return { keyword: ["ready", "briefed"] };
        if (beat.kind === "travel") return { keyword: ["arrived", "here", "at target"] };
        if (beat.kind === "recon") {
            const phrase = beat?.vars?.verification?.phrase;
            if (phrase) return { keyword: [phrase] };
            return { keyword: ["found", "clue", "marker", "saw"] };
        }
        if (beat.kind === "debrief") return { keyword: ["report"] };
        return { keyword: ["ok", "done"] };
    }
function atForBeatInstance(beat) {
    const c =
        beat?.vars?.target?.coords ||
        beat?.vars?.drop?.coords ||
        beat?.vars?.exfil?.coords ||
        null;
    return c ? { lat: c.lat, lon: c.lon } : null;
}

/* ---------- Mission generation (squares + planner) ---------- */
    app.post("/pcg/mission", async (req, res) => {
        try {
            const { lat, lng, radius = 1200, seed } = req.body || {};
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: "lat,lng required" });

            // sane bounds; client sometimes sends too tiny
            const requested = Number.isFinite(radius) ? radius : 1200;
            const searchRadius = Math.max(300, Math.min(requested, 2000));
            console.log("[mission] request at", lat, lng, "requested r", radius, "=> using r", searchRadius);

            const spots = await fetchSpotsNear(lat, lng, searchRadius);
            console.log("[mission] squares found:", spots.length, spots.slice(0, 3).map((s) => `${s.category}:${s.name || s.id}`).join(" | "));
            if (!spots.length) return res.status(404).json({ error: "no_squares_found" });

            // score: prefer named + closer
            const scored = spots
                .map((p) => ({ spot: p, score: (p.name ? 2 : 0) - haversineMeters(lat, lng, p.lat, p.lng) / 400 }))
                .sort((a, b) => b.score - a.score);

            // pick the first non-duplicate candidate
            let chosen = null;
            for (const s of scored) {
                const dup = await isDuplicateMission(s.spot);
                if (!dup) { chosen = s.spot; break; }
            }
            if (!chosen) {
                return res.status(409).json({
                    error: "duplicate_nearby",
                    message: "Missions already exist near every candidate square within 40m.",
                });
            }

            const missionSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1e9);
            const { title, description } = makeMissionText(chosen, missionSeed);
            const npcId = await getOrCreateNpcId();

            // --- find named civilian POIs near chosen square (cafés, shops, etc.) ---
            let landmarks = await fetchNamedLandmarksNear(chosen.lat, chosen.lng, 200);

            // Prefer civilian targets on squares
            const CIV = new Set([
                "cafe", "restaurant", "bar", "pub", "fast_food", "ice_cream", "bakery",
                "convenience", "pharmacy", "kiosk"
            ]);
            const civilian = (landmarks || []).filter(
                (l) => CIV.has(l.type) || (typeof l.type === "string" && l.type.startsWith("shop:"))
            );
            if (civilian.length) landmarks = civilian;

            // choose the nearest named target within the search radius
            let target = null;
            if (Array.isArray(landmarks) && landmarks.length) {
                const withDist = landmarks.map((lm) => ({
                    ...lm,
                    _d: haversineMeters(chosen.lat, chosen.lng, lm.lat, lm.lon),
                }));
                withDist.sort((a, b) => a._d - b._d);
                target = withDist[0]; // nearest
            }

            // context hint that depends on target type
            let hint = "";
            if (target) {
                const t = target.type;
                if (t === "cafe") hint = "Locate the named café.";
                else if (["restaurant", "bar", "pub", "ice_cream"].includes(t)) hint = "Head to the named food/drink spot.";
                else if (t === "fast_food") hint = "Find the nearby fast-food place.";
                else if (["supermarket", "convenience", "pharmacy"].includes(t)) hint = "Check the nearby store.";
                else if (t === "kiosk") hint = "Look for the kiosk.";
                else if (t === "bakery") hint = "Find the bakery on the square.";
                else if (t === "shop" || (typeof t === "string" && t.startsWith("shop:"))) hint = "Find the named shop on the square.";
                else hint = "Search for a nearby place with a nameplate.";
            }

            // --- Planner integration ---
            const env = await fakeEnvFromPosition({ lat: chosen.lat, lon: chosen.lng });
            let planned = USE_PLANNER ? planMission({ lat: chosen.lat, lon: chosen.lng }, env, /*maxSteps*/ 7) : [];

            // Safety: fallback if planner returned too little
            if (!planned || planned.length < 3) {
                const CODE_WORDS = ["EMBER","ORION","GLASS","PHANTOM","VECTOR","ECHO","HARBOR","NIMBUS","SABLE","DELTA"];
                const codePhrase = CODE_WORDS[missionSeed % CODE_WORDS.length];

                planned = [
                    {
                        templateId: 'fixed.brief',
                        kind: "brief",
                        title: "Incoming brief",
                        description: "HQ is spinning up a quick op. Stay sharp.",
                        npcPrompt: "Agent, we have a situation nearby. I’ll guide you.",
                        vars: {
                            spot: chosen.name || "the square",
                            landmarkHint: target ? hint : "Find any named place on the square.",
                            target: target ? { name: target.name, type: target.type, id: target.id } : null
                        },
                        meta: {}
                    },
                    {
                        templateId: 'fixed.meet',
                        kind: "meet",
                        title: "Verify the location",
                        description: "Confirm the correct place or give the code.",
                        npcPrompt: "Identify the location; I’ll confirm.",
                        vars: {
                            spot: chosen.name || "the square",
                            codePhrase: target ? null : codePhrase,
                            target: target ? { name: target.name, type: target.type, id: target.id } : null
                        },
                        meta: {}
                    },
                    {
                        templateId: 'fixed.debrief',
                        kind: "debrief",
                        title: "Debrief",
                        description: "Nice work, Agent.",
                        npcPrompt: "Mission complete. Send your report.",
                        vars: {},
                        meta: {}
                    },
                ];
            }

            // Adapt planner beats to chat shape (id, kind, at, gates, vars)
            const steps = planned.map((b, i) => ({
                id: `${b.templateId || b.kind}@${chosen.id}#${i}`,
                kind: b.kind,
                at: atForBeatInstance(b) || { lat: chosen.lat, lon: chosen.lng },
                gates: gatesForBeatInstance(b),
                vars: { spot: chosen.name || "the square", ...b.vars },
                title: b.title,
                description: b.description,
                npcPrompt: b.npcPrompt,
                meta: b.meta || {},
            }));

            // Insert into missions and return
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
                        algo: USE_PLANNER ? "planner.v1" : "squares-v1",
                        featureFlags: { USE_PLANNER },
                        player: { lat, lng },
                        radius: searchRadius,
                        chosen,
                        top5: scored.slice(0, 5).map((s) => ({ id: s.spot.id, score: s.score })),
                        envSummary: {
                            areaType: env?.areaType || "unknown",
                            landmarkCount: env?.landmarks?.length || 0,
                            hintCount: env?.hints?.length || 0,
                        }
                    },
                    steps,
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


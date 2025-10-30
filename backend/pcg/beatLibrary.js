// pcg/beatLibrary.js
const T = (l) => (s) => s.replace(/\s+/g, " ").trim(); // tiny minifier

/** @type {import('./types').BeatTemplate[]} */
    export const BEATS = [
        /* ---------- BRIEF ---------- */
        {
            id: "brief.basic",
            kind: "brief",
            gates: ["area:any"],
            pre: [],
            post: ["has_briefing"],
            vars: {},
            title: () => "Incoming brief",
            description: () => "HQ is spinning up a quick op. Stay sharp.",
            npcPrompt: () => "Agent, we have a situation nearby. I’ll guide you.",
        },

        /* ---------- TRAVEL (multiple ways to satisfy at_target) ---------- */
        {
            id: "travel.to_landmark_generic",
            kind: "travel",
            gates: ["area:any", "landmark:any"],
            pre: ["has_briefing"],
            post: ["at_target"],
            vars: { target: "landmark" },
            title: ({ target }) => `Proceed to ${target.name}`,
            description: ({ target }) => T`Move to ${target.name}. I’ll ping you when you’re close enough.`,
            npcPrompt: ({ target }) => `Head to ${target.name}. Keep a low profile.`,
        },
        {
            id: "travel.to_cafe_or_bakery",
            kind: "travel",
            gates: ["area:any", "landmark:cafe|bakery|ice_cream"],
            pre: ["has_briefing"],
            post: ["at_target"],
            vars: { target: "landmark" },
            title: ({ target }) => `Rendezvous at ${target.name}`,
            description: ({ target }) => T`Proceed to ${target.name} on the square.`,
            npcPrompt: () => `Blend in; act like a regular patron.`,
        },
        {
            id: "travel.to_restaurant_or_bar",
            kind: "travel",
            gates: ["area:any", "landmark:restaurant|bar|pub|fast_food"],
            pre: ["has_briefing"],
            post: ["at_target"],
            vars: { target: "landmark" },
            title: ({ target }) => `Approach ${target.name}`,
            description: ({ target }) => T`Move casually towards ${target.name}.`,
            npcPrompt: () => `Keep your head on a swivel.`,
        },
        {
            id: "travel.to_shop_or_service",
            kind: "travel",
            gates: ["area:any", "landmark:pharmacy|convenience|kiosk|shop"],
            pre: ["has_briefing"],
            post: ["at_target"],
            vars: { target: "landmark" },
            title: ({ target }) => `Head to ${target.name}`,
            description: ({ target }) => T`Go to ${target.name}.`,
            npcPrompt: () => `If questioned, you’re just buying supplies.`,
        },
        {
            id: "travel.to_statue_or_memorial",
            kind: "travel",
            gates: ["area:any", "landmark:statue|memorial|artwork|monument"],
            pre: ["has_briefing"],
            post: ["at_target"],
            vars: { target: "landmark" },
            title: ({ target }) => `Move to ${target.name}`,
            description: ({ target }) => T`Stand near ${target.name} but don’t draw attention.`,
            npcPrompt: () => `Hold position and await the next cue.`,
        },

        /* ---------- RECON (gather basic intel at target) ---------- */
        {
            id: "recon.scan_target",
            kind: "recon",
            gates: ["area:any"],
            pre: ["at_target"],
            post: ["mission_objective_complete"],
            vars: { target: "landmark" },
            title: ({ target }) => `Recon at ${target.name}`,
            description: ({ target, verification }) =>
            verification?.hint
            ? verification.hint
            : T`Observe the area around ${target.name}. Look for a clue or marker.`,
            npcPrompt: ({ verification }) =>
            verification?.prompt
            ? verification.prompt
            : `Do a quick sweep. What stands out?`,
        },
        {
            id: "recon.observe_terrace",
            kind: "recon",
            gates: ["area:any", "landmark:restaurant|bar|pub|cafe|bakery|ice_cream"],
            pre: ["at_target"],
            post: ["mission_objective_complete"],
            vars: { target: "landmark" },
            title: ({ target }) => `Observe ${target.name}`,
            description: ({ target }) => T`Scan the seating and entrances at ${target.name}.`,
            npcPrompt: () => `Any patterns or suspicious behavior?`,
        },
        {
            id: "recon.read_signage",
            kind: "recon",
            gates: ["area:any", "landmark:info_board|plaque|sign"],
            pre: ["at_target"],
            post: ["mission_objective_complete"],
            vars: { target: "landmark" },
            title: ({ target }) => `Check signage at ${target.name}`,
            description: ({ target }) => T`Look closely for names, numbers or symbols on ${target.name}.`,
            npcPrompt: () => `Report any codes, initials, or dates.`,
        },


        /* ---------- DEBRIEF ---------- */
        {
            id: "debrief.basic",
            kind: "debrief",
            gates: ["area:any"],
            pre: ["mission_objective_complete"],
            post: ["mission_complete"],
            vars: {},
            title: () => "Debrief",
            description: () => "Nice work, Agent. Uploading your report.",
            npcPrompt: () => "Mission complete. I’ll handle the paperwork.",
        },
    ];


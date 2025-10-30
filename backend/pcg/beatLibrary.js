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

        /* ---------- RECON (VARIANTS by target type) ---------- */
        // Generic fallback (if no specialized variant fits)
        {
            id: "recon.scan_target",
                kind: "recon",
                gates: ["area:any"],
                pre: ["at_target"],
                post: ["intel_basic"], // this completes the objective in the "no-resolve" world
            vars: { target: "landmark" },
                title: ({ target }) => `Recon at ${target.name}`,
                description: ({ target, verification }) =>
                verification?.hint
                ? verification.hint
                : T`Observe the area around ${target.name}. Look for a clue or marker.`,
                npcPrompt: ({ verification }) =>
                verification?.prompt ? verification.prompt : `Do a quick sweep. What stands out?`,
        },

        /* ---------- RECON: RESTAURANT (2 variations) ---------- */
        // V1: Reveal NAME, ask for CUISINE (gate: cuisine keyword)
        {
            id: "recon.restaurant_ask_cuisine",
                kind: "recon",
                gates: ["area:any", "landmark:restaurant"],
                pre: ["at_target"],
                post: ["intel_basic"],
                vars: { target: "landmark", verification: "hint" }, // planner fills verification
            title: ({ target }) => `Confirm cuisine at ${target.name}`,
                description: ({ target }) =>
                T`The restaurant is ${target.name}. Tell me the cuisine they serve.`,
                npcPrompt: () => `Report the cuisine.`,
        },
        // V2: Reveal CUISINE, ask for NAME (gate: landmark name)
        {
            id: "recon.restaurant_ask_name",
                kind: "recon",
                gates: ["area:any", "landmark:restaurant"],
                pre: ["at_target"],
                post: ["intel_basic"],
                vars: { target: "landmark", verification: "hint" }, // planner fills verification
            title: () => `Identify the restaurant`,
                description: ({ verification }) =>
                verification?.revealCuisine
                ? T`They serve ${verification.revealCuisine}. Tell me the exact name of the restaurant on the sign.`
                : T`Tell me the exact name of the restaurant on the sign.`,
                npcPrompt: () => `Report the exact place name.`,
        },

        /* ---------- RECON: CAFE/BAKERY (2 variations) ---------- */
        // V1: Reveal NAME, ask for TYPE (gate: "bakery"/"cafe"/"ice_cream" keyword derived by planner)
        {
            id: "recon.cafe_ask_type",
                kind: "recon",
                gates: ["area:any", "landmark:cafe|bakery|ice_cream"],
                pre: ["at_target"],
                post: ["intel_basic"],
                vars: { target: "landmark", verification: "hint" },
                title: ({ target }) => `Confirm the venue type at ${target.name}`,
                description: ({ target }) =>
                T`${target.name} is the spot. What kind of venue is it?`,
                npcPrompt: () => `State the venue type.`,
        },
        // V2: Reveal TYPE, ask for NAME (gate: landmark name)
        {
            id: "recon.cafe_ask_name",
                kind: "recon",
                gates: ["area:any", "landmark:cafe|bakery|ice_cream"],
                pre: ["at_target"],
                post: ["intel_basic"],
                vars: { target: "landmark", verification: "hint" },
                title: () => `Identify the venue`,
                description: ({ verification }) =>
                verification?.revealType
                ? T`It’s a ${verification.revealType}. Tell me the EXACT venue name on the sign.`
                : T`Tell me the EXACT venue name on the sign.`,
                npcPrompt: () => `Report the exact place name.`,
        },

        /* ---------- RECON: STATUE/ARTWORK (2 variations) ---------- */
        // V1: Reveal NAME, ask for MATERIAL (gate: material keyword)
        {
            id: "recon.art_ask_material",
                kind: "recon",
                gates: ["area:any", "landmark:statue|memorial|artwork|monument"],
                pre: ["at_target"],
                post: ["intel_basic"],
                vars: { target: "landmark", verification: "hint" },
                title: ({ target }) => `Verify material at ${target.name}`,
                description: ({ target }) =>
                T`${target.name} identified. What material is it made of?`,
                npcPrompt: () => `Report the material.`,
        },
        // V2: Reveal MATERIAL, ask for NAME (gate: landmark name)
        {
            id: "recon.art_ask_name",
                kind: "recon",
                gates: ["area:any", "landmark:statue|memorial|artwork|monument"],
                pre: ["at_target"],
                post: ["intel_basic"],
                vars: { target: "landmark", verification: "hint" },
                title: () => `Identify the monument`,
                description: ({ verification }) =>
                verification?.revealMaterial
                ? T`It’s made of ${verification.revealMaterial}. Tell me the exact monument name.`
                : T`Tell me the exact monument name.`,
                npcPrompt: () => `Report the exact place name.`,
        },

        /* ---------- DEBRIEF (no resolve anymore) ---------- */
        {
            id: "debrief.basic",
            kind: "debrief",
            gates: ["area:any"],
            // Important: since we removed 'resolve', debrief comes after recon success
            pre: ["intel_basic"],
            post: ["mission_complete"],
            vars: {},
            title: () => "Debrief",
            description: () => "Nice work, Agent. Uploading your report.",
            npcPrompt: () => "Mission complete. I’ll handle the paperwork.",
        },
    ];


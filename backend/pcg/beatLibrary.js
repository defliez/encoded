// pcg/beatLibrary.js
const T = (l)=>(s)=>s.replace(/\s+/g,' ').trim(); // tiny minifier for strings

/** @type {import('./types').BeatTemplate[]} */
    export const BEATS = [
        {
            id: 'brief.basic',
            kind: 'brief',
            gates: ['area:any'],
            pre: [],
            post: ['has_briefing'],
            vars: {},
            title: () => 'Incoming brief',
            description: () => 'HQ is spinning up a quick op. Stay sharp.',
            npcPrompt: () => 'Agent, we have a situation nearby. I’ll guide you.'
        },
        {
            id: 'travel.to_landmark',
            kind: 'travel',
            gates: ['area:park','landmark:any'],
            pre: ['has_briefing'],
            post: ['at_target'],
            vars: { target: 'landmark' },
            title: ({target}) => `Proceed to ${target.name}`,
            description: ({target}) => T`
            Move to ${target.name}. I’ll ping you when you’re close enough.`,
            npcPrompt: ({target}) => `Head to ${target.name}. Keep a low profile.`
        },
        {
            id: 'recon.scan_area',
            kind: 'recon',
            gates: ['area:park'],
            pre: ['at_target'],
            post: ['intel_collected'],
            vars: { target: 'landmark' },
            title: ({target}) => `Recon at ${target.name}`,
            description: ({target}) => T`
            Observe the area around ${target.name}. Look for a clue or marker.`,
            npcPrompt: () => `Do a quick sweep. What stands out?`
        },
        {
            id: 'puzzle.decode_hint',
            kind: 'puzzle',
            gates: ['hint:available'],
            pre: ['intel_collected'],
            post: ['hint_decoded'],
            vars: { hint: 'hint' },
            title: () => 'Decode the hint',
            description: ({hint}) => T`
            You find a coded note: "${hint.text}". Decode it to reveal the next move.`,
            npcPrompt: () => `Try simple substitutions or look for acrostics.`
        },
        {
            id: 'handoff.dead_drop',
            kind: 'handoff',
            gates: ['landmark:bench|trashcan|statue'],
            pre: ['hint_decoded'],
            post: ['package_retrieved'],
            vars: { drop: 'landmark' },
            title: ({drop}) => `Retrieve the dead drop at ${drop.name}`,
            description: ({drop}) => T`
            The drop should be hidden at ${drop.name}. Retrieve the package discreetly.`,
            npcPrompt: () => `Don’t linger. Get it and move.`
        },
        {
            id: 'resolve.extract',
            kind: 'resolve',
            gates: ['area:any'],
            pre: ['package_retrieved'],
            post: ['mission_objective_complete'],
            vars: { exfil: 'landmark' },
            title: ({exfil}) => `Exfil to ${exfil.name}`,
            description: ({exfil}) => T`
            Leave the area via ${exfil.name}. Avoid drawing attention.`,
            npcPrompt: () => `Extraction point marked. Move now.`
        },
        {
            id: 'debrief.basic',
            kind: 'debrief',
            gates: ['area:any'],
            pre: ['mission_objective_complete'],
            post: ['mission_complete'],
            vars: {},
            title: () => 'Debrief',
            description: () => 'Nice work, Agent. Uploading your report.',
            npcPrompt: () => 'Mission complete. I’ll handle the paperwork.'
        },
    ];


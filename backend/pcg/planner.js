// pcg/planner.js
import { BEATS } from './beatLibrary.js';
import { makeWorldState, hasAll, applyPost, gateMatch } from './world.js';
import { bindVars } from './binders.js';

/**
    * @param {{lat:number, lon:number}} pos
    * @param {object} env
    * @param {number} maxSteps
    * @returns {import('./types').BeatInstance[]}
    */
    export function planMission(pos, env, maxSteps = 6) {
        const state = makeWorldState([], { pos, env });
        const out = [];
        const usedKinds = new Set();

        const wantOrder = ['brief','travel','recon','puzzle','handoff','resolve','debrief'];

        for (const want of wantOrder) {
            const candidates = BEATS.filter(b =>
                b.kind === want &&
                gateMatch(b.gates || [], env) &&
                hasAll(state, b.pre || [])
            );

            if (!candidates.length) {
                if (want === 'puzzle' || want === 'handoff') continue;
                if (want === 'brief' || want === 'resolve' || want === 'debrief') break;
                continue;
            }

            let picked = null;
            for (const tmpl of candidates) {
                const binding = bindVars(tmpl, env);
                if (!binding) continue;
                const score = (tmpl.post || []).reduce((acc,p)=> acc + (p.includes('mission_') ? 3 : 1),0);
                if (!picked || score > picked.score) picked = { tmpl, binding, score };
            }
            if (!picked) continue;

            const { tmpl, binding } = picked;
            usedKinds.add(tmpl.kind);

            const instance = {
                templateId: tmpl.id,
                kind: tmpl.kind,
                title: tmpl.title(binding),
                description: tmpl.description(binding),
                npcPrompt: tmpl.npcPrompt(binding),
                vars: binding,
                meta: {
                    targetCoords: binding.target?.coords || binding.drop?.coords || binding.exfil?.coords || null,
                    difficulty: 1,
                }
            };
            out.push(instance);
            applyPost(state, tmpl.post || []);
            if (out.length >= maxSteps) break;
            if (state.facts.has('mission_complete')) break;
        }

        const ended = out[out.length - 1]?.kind;
        const needDebrief = state.facts.has('mission_objective_complete') && ended !== 'debrief';
        if (needDebrief) {
            const debrief = BEATS.find(b => b.kind === 'debrief' && gateMatch(b.gates || [], env) && hasAll(state, b.pre || []));
            if (debrief) {
                const inst = {
                    templateId: debrief.id,
                    kind: debrief.kind,
                    title: debrief.title({}),
                    description: debrief.description({}),
                    npcPrompt: debrief.npcPrompt({}),
                    vars: {},
                    meta: {}
                };
                out.push(inst);
                applyPost(state, debrief.post || []);
            }
        }

        return out;
    }


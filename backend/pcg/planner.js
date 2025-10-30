// pcg/planner.js
import { BEATS } from './beatLibrary.js';
import { makeWorldState, hasAll, applyPost, gateMatch } from './world.js';
import { bindVars } from './binders.js';
import { selectVerification } from './verifier.js';

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

    // No 'resolve' anymore
    const wantOrder = ['brief', 'travel', 'recon', 'debrief'];

    for (const want of wantOrder) {
        const candidates = BEATS.filter(b =>
            b.kind === want &&
            gateMatch(b.gates || [], env) &&
            hasAll(state, b.pre || [])
        );

        if (!candidates.length) {
            if (want === 'brief') break;
            continue;
        }

        let picked = null;
        for (const tmpl of candidates) {
            const binding = bindVars(tmpl, env);
            if (!binding) continue;

            // attach verification ONLY for recon and specialize per template id
            if (tmpl.kind === 'recon') {
                const t = binding.target || null;
                const tags = t?.tags || {};
                // Helper to grab a single token from e.g. "pizza;pasta"
                const pickToken = (s) => (typeof s === 'string' ? s.split(/[;,\|]/)[0].trim() : null);

                if (tmpl.id === 'recon.restaurant_ask_cuisine') {
                    const cuisine = pickToken(tags.cuisine);
                    if (!cuisine) continue; // can't run this variant without cuisine
                    binding.verification = {
                        kind: 'cuisine',
                        phrase: cuisine.toLowerCase(),
                        hint: 'Tell me the cuisine they serve.',
                        prompt: 'Report the cuisine.',
                        revealName: true
                    };
                } else if (tmpl.id === 'recon.restaurant_ask_name') {
                    const cuisine = pickToken(tags.cuisine) || null;
                    if (!t?.name) continue; // need a name to verify
                    binding.verification = {
                        kind: 'name',
                        phrase: null, // gating will be via landmark name
                        hint: 'Tell me the exact restaurant name.',
                        prompt: 'Report the exact place name.',
                        revealCuisine: cuisine || null
                    };
                } else if (tmpl.id === 'recon.cafe_ask_type') {
                    // ask for "cafe"/"bakery"/"ice_cream" as the phrase
                    let vType = null;
                    if (tags.amenity === 'cafe') vType = 'cafe';
                    else if (tags.shop === 'bakery' || t?.type === 'bakery') vType = 'bakery';
                    else if (t?.type === 'ice_cream' || tags.amenity === 'ice_cream') vType = 'ice cream';
                    if (!vType) continue;
                    binding.verification = {
                        kind: 'venue_type',
                        phrase: vType.toLowerCase(),
                        hint: 'Name the venue type.',
                        prompt: 'State the venue type.',
                        revealName: true
                    };
                } else if (tmpl.id === 'recon.cafe_ask_name') {
                    const revealType =
                        tags.amenity === 'cafe' ? 'cafe'
                            : (tags.shop === 'bakery' || t?.type === 'bakery') ? 'bakery'
                                : (t?.type === 'ice_cream' || tags.amenity === 'ice_cream') ? 'ice cream'
                                    : null;
                    if (!t?.name) continue;
                    binding.verification = {
                        kind: 'name',
                        phrase: null,
                        hint: 'Tell me the exact venue name.',
                        prompt: 'Report the exact place name.',
                        revealType
                    };
                } else if (tmpl.id === 'recon.art_ask_material') {
                    const mat = pickToken(tags.material);
                    if (!mat) continue;
                    binding.verification = {
                        kind: 'material',
                        phrase: mat.toLowerCase(),
                        hint: 'Tell me the material.',
                        prompt: 'Report the material.',
                        revealName: true
                    };
                } else if (tmpl.id === 'recon.art_ask_name') {
                    const mat = pickToken(tags.material) || null;
                    if (!t?.name) continue;
                    binding.verification = {
                        kind: 'name',
                        phrase: null,
                        hint: 'Tell me the exact monument name.',
                        prompt: 'Report the exact place name.',
                        revealMaterial: mat || null
                    };
                } else if (tmpl.id === 'recon.scan_target') {
                    // generic fallback: try to pick any verification if possible (cuisine/material/type …)
                    const cuisine = pickToken(tags.cuisine);
                    const mat = pickToken(tags.material);
                    const venueType =
                        tags.amenity === 'cafe' ? 'cafe'
                            : (tags.shop === 'bakery' || t?.type === 'bakery') ? 'bakery'
                                : (t?.type === 'ice_cream' || tags.amenity === 'ice_cream') ? 'ice cream'
                                    : null;

                    if (cuisine) {
                        binding.verification = {
                            kind: 'cuisine',
                            phrase: cuisine.toLowerCase(),
                            hint: 'Tell me the cuisine they serve.',
                            prompt: 'Report the cuisine.'
                        };
                    } else if (mat) {
                        binding.verification = {
                            kind: 'material',
                            phrase: mat.toLowerCase(),
                            hint: 'Tell me the material.',
                            prompt: 'Report the material.'
                        };
                    } else if (venueType) {
                        binding.verification = {
                            kind: 'venue_type',
                            phrase: venueType.toLowerCase(),
                            hint: 'Name the venue type.',
                            prompt: 'State the venue type.'
                        };
                    } // else: no verification; still allowed
                }
            }

            const baseScore = (tmpl.post || []).reduce((acc, p) => acc + (p.includes('mission_') ? 3 : 1), 0);
            const verifBonus = binding.verification ? 2 : 0;

            // NEW: prefer specific recon variants over the generic fallback
            // Give a strong bonus to any recon that is NOT the generic scan_target.
            const specificityBonus =
                (tmpl.kind === 'recon' && tmpl.id !== 'recon.scan_target') ? 5 : 0;

            // Optional tiny jitter so two equally specific recon variants can alternate
            const jitter = (tmpl.kind === 'recon') ? Math.random() * 0.25 : 0;

            const score = baseScore + verifBonus + specificityBonus + jitter;

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

    // Debrief auto-append if intel was gathered and we didn’t add debrief
    const ended = out[out.length - 1]?.kind;
    const needDebrief = state.facts.has('intel_basic') && ended !== 'debrief';
    if (needDebrief) {
        const debrief = BEATS.find(b =>
            b.kind === 'debrief' &&
            gateMatch(b.gates || [], env) &&
            hasAll(state, b.pre || [])
        );
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


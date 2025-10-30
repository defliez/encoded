// pcg/world.js
import { fetchNamedLandmarksNear } from '../pcg.js'; // <-- note the .js extension

// WorldState is a set<string> of facts plus a context bag for binding sources
export function makeWorldState(seedFacts = [], ctx = {}) {
    return { facts: new Set(seedFacts), ctx };
}

export function hasAll(state, reqFacts) {
    return reqFacts.every(f => state.facts.has(f));
}

export function applyPost(state, post) {
    for (const p of post) {
        if (p.startsWith('!')) state.facts.delete(p.slice(1));
        else state.facts.add(p);
    }
    return state;
}

// pcg/world.js

function hasTag(lm, t) {
    if (!lm || !lm.tags) return false;
    const needle = String(t).toLowerCase();
    const tags = lm.tags;

    if (Array.isArray(tags)) {
        return tags.map(x => String(x).toLowerCase()).includes(needle);
    }
    if (typeof tags === 'string') {
        return tags.toLowerCase().includes(needle);
    }
    if (typeof tags === 'object') {
        // OSM-style { key: value } bag
        return Object.keys(tags).some(k => k.toLowerCase() === needle) ||
            Object.values(tags).some(v => String(v).toLowerCase() === needle);
    }
    return false;
}

function hasTypeOrTag(lm, t) {
    const typeStr = String(lm?.kind || lm?.type || '').toLowerCase();
    const needle = String(t).toLowerCase();
    if (typeStr === needle) return true;
    return hasTag(lm, needle);
}

// Simple gate matcher (string gates like "area:park", "landmark:any", "hint:available")
export function gateMatch(gates, env) {
    return gates.every(g => {
        const [k, v] = g.split(':');
        if (k === 'area') {
            return v === 'any' || env.areaType === v;
        }
        if (k === 'landmark') {
            if (v === 'any') return (env.landmarks?.length ?? 0) > 0;
            const types = v.split('|').map(s => s.trim()).filter(Boolean);
            return (env.landmarks ?? []).some(lm =>
                types.some(t => hasTypeOrTag(lm, t))
            );
        }
        if (k === 'hint') {
            return v === 'available' ? !!env.hints?.length : false;
        }
        return true; // unknown gate -> ignore (extensible)
    });
}

export async function fakeEnvFromPosition({ lat, lon }) {
    // fetchNamedLandmarksNear(lat, lng, radius)
    const landmarks = await fetchNamedLandmarksNear(lat, lon, 400);
    const areaType = (landmarks ?? []).some(l => {
        const s = String(l?.kind || l?.type || l?.category || l?.name || '').toLowerCase();
        return s.includes('park') || s.includes('playground') || hasTag(l, 'park');
    }) ? 'park' : 'any';
    const hints = [{ id: 'h1', text: 'N E S W (start at noon)' }];
    return { areaType, landmarks, hints };
}

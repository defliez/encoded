// pcg/binders.js

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

// Simple heuristics: prefer diverse, nearby, named POIs
export function pickLandmark(env, preferKinds) {
    const L = env.landmarks || [];
    if (!L.length) return null;

    if (preferKinds?.length) {
        const match = L.find(l => preferKinds.some(t => hasTypeOrTag(l, t)));
        if (match) return match;
    }
    // fallback: first named
    return L.find(l => l.name) || L[0];
}

export function bindVars(template, env, priorBinding = {}) {
    const binding = { ...priorBinding };
    for (const [vName, vType] of Object.entries(template.vars || {})) {
        if (binding[vName]) continue;

        if (vType === 'landmark') {
            // use gates to guess preferred kinds
            let preferKinds = null;
            const lmGate = (template.gates || []).find(g => g.startsWith('landmark:'));
            if (lmGate) {
                const kinds = lmGate.split(':')[1].split('|').map(s => s.trim()).filter(Boolean);
                preferKinds = kinds;
            }
            const lm = pickLandmark(env, preferKinds);
            if (!lm) return null;
            binding[vName] = lm;

        } else if (vType === 'hint') {
            const h = (env.hints || [])[0];
            if (!h) return null;
            binding[vName] = h;

        } else {
            binding[vName] = true; // generic flag
        }
    }
    return binding;
}


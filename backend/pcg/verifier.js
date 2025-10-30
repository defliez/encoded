// pcg/verifier.js
// Pick a robust, single-token verification keyword + matching hint/prompt from a POI.

    function normalizeToken(s = "") {
        return s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // strip diacritics
            .replace(/[^a-z0-9]+/g, " ")     // keep only a-z0-9 as spaces
            .trim()
            .split(" ")[0];                  // prefer first simple token
    }

function lastSurname(full = "") {
    const parts = normalizeToken(full).split(" ").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
}

function firstFromList(val = "") {
    // cuisines can be "italian;pizza" or "thai,asian"
    const raw = String(val).split(/[;,/|]/)[0].trim();
    return normalizeToken(raw);
}

/**
    * @param {{ type?: string, name?: string, tags?: Record<string,string> }} poi
    * @returns {{ phrase: string, kind: string, hint: string, prompt?: string } | null}
    */
    export function selectVerification(poi) {
        if (!poi) return null;
        const type = poi.type || "";
        const tags = poi.tags || {};
        const tAmenity = tags.amenity || "";
        const tShop = tags.shop || "";
        const cuisine = tags.cuisine || "";
        const material = tags.material || "";
        const artistName = tags.artist_name || tags.artist || "";
        const artworkType = tags.artwork_type || "";

        // --- ARTWORK / STATUE path ---
        if (type === "artwork" || artworkType || tags.tourism === "artwork") {
            // 1) material
if (material) {
    const phrase = firstFromList(material);
    if (phrase) {
        return {
            phrase,
            kind: "material",
            hint: "Confirm the material used on the statue.",
            prompt: "Tell me the material you see there."
        };
    }
}
// 2) artist surname
if (artistName) {
    const surname = lastSurname(artistName);
    if (surname) {
        return {
            phrase: surname,
            kind: "artist",
            hint: "Report the sculptor’s surname only.",
            prompt: "Give the sculptor’s surname."
        };
    }
}
// 3) artwork type
if (artworkType) {
    const phrase = normalizeToken(artworkType);
    if (phrase) {
        return {
            phrase,
            kind: "artwork_type",
            hint: "Identify the type of artwork.",
            prompt: "State the artwork type."
        };
    }
}
}

// --- FOOD & DRINK (amenity) ---
const FOOD = new Set(["cafe","restaurant","bar","pub","fast_food","ice_cream"]);
if (FOOD.has(type) || FOOD.has(tAmenity)) {
    if (cuisine) {
        const phrase = firstFromList(cuisine);
        if (phrase) {
            return {
                phrase,
                kind: "cuisine",
                hint: "Tell me the cuisine they serve.",
                prompt: "Report the cuisine."
            };
        }
    }
    const amen = type || tAmenity;
    const phrase = normalizeToken(amen);
    if (phrase) {
        return {
            phrase,
            kind: "amenity",
            hint: "Confirm the type of place.",
            prompt: "Name the place type."
        };
    }
}

// --- SHOPS ---
// type can look like "shop:bakery" or tags.shop = "bakery"
if ((type && type.startsWith("shop:")) || tShop) {
    const subtype = type.startsWith("shop:") ? type.split(":")[1] : tShop;
    const phrase = normalizeToken(subtype);
    if (phrase) {
        return {
            phrase,
            kind: "shop_type",
            hint: "Name the type of shop.",
            prompt: "Report the shop type."
        };
    }
}

// --- MEMORIAL / PLAQUE / INFO ---
const memorialish = new Set(["memorial","monument","plaque","information"]);
if (memorialish.has(type) || memorialish.has(tags.memorial) || tags.information) {
    // Try year in name (e.g., "1912")
    const m = String(poi.name || "").match(/\b(1[89]\d{2}|20\d{2})\b/);
    if (m) {
        return {
            phrase: m[0],
            kind: "year",
            hint: "Confirm the year mentioned there.",
            prompt: "Say the year."
        };
    }
    // Fallback to object type
    const phrase = normalizeToken(type || tags.memorial || (tags.information && "info"));
    if (phrase) {
        return {
            phrase,
            kind: "object_type",
            hint: "Identify the type of marker.",
            prompt: "What kind of marker is it?"
        };
    }
}

// nothing robust found
return null;
}


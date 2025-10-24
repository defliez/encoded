// pcg.js
import fetch from "node-fetch";
import osmtogeojson from "osmtogeojson";
import { featureCollection, point, polygon } from "@turf/helpers";
import centroid from "@turf/centroid";
import express from "express";

const router = express.Router();

const cache = new Map();
const ttlMs = 10 * 60 * 1000;

const OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
];

async function fetchOverpass(query) {
    const ua = "encoded-game/pcg (contact: valentinoglave@protonmail.com)";
    let lastErr;
    for (const url of OVERPASS_MIRRORS) {
        try {
            console.log('-> Trying', url);
            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain",
                    "User-Agent": ua,
                },
                body: query,
            });
            if (!resp.ok) {
                const text = await resp.text();
                console.warn("Overpass error", resp.status, text.slice(0, 200));
                lastErr = new Error(`HTTP ${resp.status} from ${url}`);
                continue;
            }
            return await resp.json();
        } catch (e) {
            console.warn("Overpass fetch failed:", url, e.message);
            lastErr = e;
        }
    }
    throw lastErr || new Error("All mirrors failed");
}

export async function fetchNamedLandmarksNear(lat, lng, radius = 120) {
    const q = `
    [out:json][timeout:45];
    (
        node(around:${radius},${lat},${lng})[tourism=artwork];
        way(around:${radius},${lat},${lng})[tourism=artwork];
        relation(around:${radius},${lat},${lng})[tourism=artwork];

        node(around:${radius},${lat},${lng})[historic=memorial];
        way(around:${radius},${lat},${lng})[historic=memorial];
        relation(around:${radius},${lat},${lng})[historic=memorial];

        node(around:${radius},${lat},${lng})[memorial=plaque];
        way(around:${radius},${lat},${lng})[memorial=plaque];
        relation(around:${radius},${lat},${lng})[memorial=plaque];

        node(around:${radius},${lat},${lng})[artwork_type=sculpture];
        way(around:${radius},${lat},${lng})[artwork_type=sculpture];
        relation(around:${radius},${lat},${lng})[artwork_type=sculpture];

        node(around:${radius},${lat},${lng})[information=board];
        way(around:${radius},${lat},${lng})[information=board];
        relation(around:${radius},${lat},${lng})[information=board];

        node(around:${radius},${lat},${lng})[tourism=attraction];
        way(around:${radius},${lat},${lng})[tourism=attraction];
        relation(around:${radius},${lat},${lng})[tourism=attraction];

        node(around:${radius},${lat},${lng})[amenity=cafe];
        way(around:${radius},${lat},${lng})[amenity=cafe];
        relation(around:${radius},${lat},${lng})[amenity=cafe];
    );
    out tags center;
    `;

    const raw = await fetchOverpass(q);
    const gj = osmtogeojson(raw);

    const items = [];
    for (const f of gj.features) {
        const props = f.properties || {};
        const tags = props.tags || props;
        const name = tags.name;
        if (!name) continue;

        const c = f.geometry.type === "Point" ? f : centroid(f);
        const [lon, lat0] = c.geometry.coordinates;

        let type =
            tags.tourism === "artwork" ? "artwork" :
            tags.historic === "memorial" ? "memorial" :
            tags.memorial === "plaque" ? "plaque" :
            tags.artwork_type === "sculpture" ? "sculpture" :
            tags.information === "board" ? "info_board" :
            tags.amenity === "cafe" ? "cafe" : "other";

        items.push({
            id: props["@id"] || `${props.type}/${props.id}`,
            type,
            name,
            lat: lat0,
            lon,
            tags
        });
    }

    // prioritize art/memorial/plaque types
    const score = i => {
        const pri =
            i.type === "plaque" ? 5 :
            i.type === "memorial" ? 5 :
            i.type === "artwork" ? 5 :
            i.type === "sculpture" ? 4 :
            i.type === "info_board" ? 3 :
            i.type === "cafe" ? 2 : 1;
        const lenPenalty = Math.max(0, i.name.length - 24) / 24;
        return pri - lenPenalty;
    };

    return items.sort((a,b) => score(b) - score(a));
}

router.get('/pois', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const radius = Math.min(parseInt(req.query.radius || '800', 10), 1500);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return res.status(400).json({ error: 'lat, lng required' });
        }

        const key = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
        const now = Date.now();
        const hit = cache.get(key);
        if (hit && now - hit.t < ttlMs) return res.json(hit.data);

        const q = `
        [out:json][timeout:45];
        (
            // parks
            node(around:${radius},${lat},${lng})[leisure=park];
            way(around:${radius},${lat},${lng})[leisure=park];
            relation(around:${radius},${lat},${lng})[leisure=park];

            // // gardens & recreation grounds
            // node(around:${radius},${lat},${lng})[leisure=garden];
            // way(around:${radius},${lat},${lng})[leisure=garden];
            // relation(around:${radius},${lat},${lng})[leisure=garden];
            //
            // node(around:${radius},${lat},${lng})[landuse=recreation_ground];
            // way(around:${radius},${lat},${lng})[landuse=recreation_ground];
            // relation(around:${radius},${lat},${lng})[landuse=recreation_ground];
            //
            // // squares / plazas
            // node(around:${radius},${lat},${lng})[place=square];
            // way(around:${radius},${lat},${lng})[place=square];
            // relation(around:${radius},${lat},${lng})[place=square];
            //
            // // indoor / landmarks
            // node(around:${radius},${lat},${lng})[tourism=attraction];
            // way(around:${radius},${lat},${lng})[tourism=attraction];
            // relation(around:${radius},${lat},${lng})[tourism=attraction];
            //
            // node(around:${radius},${lat},${lng})[tourism=museum];
            // way(around:${radius},${lat},${lng})[tourism=museum];
            // relation(around:${radius},${lat},${lng})[tourism=museum];
            //
            // node(around:${radius},${lat},${lng})[amenity=library];
            // way(around:${radius},${lat},${lng})[amenity=library];
            // relation(around:${radius},${lat},${lng})[amenity=library];
            //
            // node(around:${radius},${lat},${lng})[shop=mall];
            // way(around:${radius},${lat},${lng})[shop=mall];
            // relation(around:${radius},${lat},${lng})[shop=mall];
        );
        out tags center;
        `;

        const raw = await fetchOverpass(q);
        console.log("Overpass elements:", raw?.elements?.length || 0);
        const gj = osmtogeojson(raw);

        const pois = [];
        for (const f of gj.features) {
            const props = f.properties || {};
            const tags = props.tags || props;

            const cat =
                tags.leisure === "park" ? "park" :
                // tags.leisure === "garden" ? "garden" :
                // tags.landuse === "recreation_ground" ? "recreation" :
                // tags.place === "square" ? "square" :
                // tags.tourism === "attraction" ? "attraction" :
                // tags.tourism === "museum" ? "museum" :
                // tags.amenity === "library" ? "library" :
                // tags.shop === "mall" ? "mall" :
                null;
            if (!cat) continue;

            const c = f.geometry.type === "Point" ? f : centroid(f);
            const [lng0, lat0] = c.geometry.coordinates;

            const osmType = props.type || tags.type;
            const osmId = props.id || tags.id;
            const uid = (osmType && osmId) ? `${osmType}/${osmId}` : (props['@id'] || `${Math.random()}`);

            pois.push({
                id: uid,
                name: tags.name || null,
                category: cat,
                lat: lat0,
                lng: lng0,
                polygon: (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") ? f.geometry : null,
                tags: {
                    historic: tags.historic || undefined,
                    art: tags.artwork_type || (tags.tourism === "artwork") || undefined,
                },
            });
        }

        const uniq = [];
        const seen = new Set();
        for (const p of pois) {
            const k = `${p.category}:${(p.name || "").toLowerCase()}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
            if (!seen.has(k)) { seen.add(k); uniq.push(p); }
        }

        const data = { center: { lat, lng }, radius, count: uniq.length, pois: uniq };

        console.log(
            "POIs uniq:", uniq.length,
            uniq.slice(0, 5).map(p => `${p.category}:${p.name || p.id}`).join(" | ")
        );

        cache.set(key, { t: now, data });
        res.json(data);
    } catch (e) {
        console.error("Overpass error:", e);
        res.status(502).json({ error: "Overpass failed", details: String(e).slice(0, 500) });
    }
});

export default router;

// pcg.js
import fetch from "node-fetch";
import osmtogeojson from "osmtogeojson";
import centroid from "@turf/centroid";
import express from "express";

const router = express.Router();

/**
    * Simple in-memory cache for /pcg/pois responses
    */
    const cache = new Map();
const ttlMs = 10 * 60 * 1000; // 10 minutes

/**
    * Public Overpass mirrors to rotate through on failure
    */
    const OVERPASS_MIRRORS = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass.openstreetmap.ru/api/interpreter",
    ];

/**
    * Minimal haversine in meters (used for ranking)
    */
    function haversineMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = d => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

/**
    * POST a query to Overpass, rotating mirrors on failure.
    */
    async function fetchOverpass(query) {
        const ua = "encoded-game/pcg (contact: valentinoglave@protonmail.com)";
        let lastErr;
        for (const url of OVERPASS_MIRRORS) {
            try {
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

/**
    * Find named, player-usable landmarks/targets near a point.
    * This is what your mission generator uses to pick the "say the exact name" beat target.
    *
    * Now broadened for squares-based play:
    *  - public art / memorials / plaques / info boards
    *  - tourism=attraction
    *  - food & drink amenities (cafe, restaurant, bar, pub, fast_food, ice_cream, bakery)
    *  - daily-life amenities (convenience, pharmacy, kiosk)
    *  - any shop=* WITH a name
    *
    * Returns sorted by (priority, distance, shorter name).
    */
    export async function fetchNamedLandmarksNear(lat, lng, radius = 160) {
        // IMPORTANT: we only return items with a name
        const q = `
        [out:json][timeout:45];
        (
            // Art / history / signage
            node(around:${radius},${lat},${lng})[tourism=artwork][name];
            way(around:${radius},${lat},${lng})[tourism=artwork][name];
            relation(around:${radius},${lat},${lng})[tourism=artwork][name];

            node(around:${radius},${lat},${lng})[historic=memorial][name];
            way(around:${radius},${lat},${lng})[historic=memorial][name];
            relation(around:${radius},${lat},${lng})[historic=memorial][name];

            node(around:${radius},${lat},${lng})[memorial=plaque][name];
            way(around:${radius},${lat},${lng})[memorial=plaque][name];
            relation(around:${radius},${lat},${lng})[memorial=plaque][name];

            node(around:${radius},${lat},${lng})[artwork_type=sculpture][name];
            way(around:${radius},${lat},${lng})[artwork_type=sculpture][name];
            relation(around:${radius},${lat},${lng})[artwork_type=sculpture][name];

            node(around:${radius},${lat},${lng})[information=board][name];
            way(around:${radius},${lat},${lng})[information=board][name];
            relation(around:${radius},${lat},${lng})[information=board][name];

            node(around:${radius},${lat},${lng})[tourism=attraction][name];
            way(around:${radius},${lat},${lng})[tourism=attraction][name];
            relation(around:${radius},${lat},${lng})[tourism=attraction][name];

            // Food & drink
            node(around:${radius},${lat},${lng})[amenity~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|bakery)$"][name];
            way(around:${radius},${lat},${lng})[amenity~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|bakery)$"][name];
            relation(around:${radius},${lat},${lng})[amenity~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|bakery)$"][name];

            // Daily-life targets (good for "say the exact name")
            node(around:${radius},${lat},${lng})[amenity~"^(convenience|pharmacy|kiosk)$"][name];
            way(around:${radius},${lat},${lng})[amenity~"^(convenience|pharmacy|kiosk)$"][name];
            relation(around:${radius},${lat},${lng})[amenity~"^(convenience|pharmacy|kiosk)$"][name];

            // Any named shop
            node(around:${radius},${lat},${lng})[shop][name];
            way(around:${radius},${lat},${lng})[shop][name];
            relation(around:${radius},${lat},${lng})[shop][name];
        );
        out tags center qt;
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
                tags.memorial === "plaque" ? "plaque" :
                tags.historic === "memorial" ? "memorial" :
                tags.tourism === "artwork" ? "artwork" :
                tags.artwork_type === "sculpture" ? "sculpture" :
                tags.information === "board" ? "info_board" :
                tags.tourism === "attraction" ? "attraction" :
                tags.amenity ? tags.amenity : // cafe/restaurant/bar/pub/...
                (tags.shop ? `shop:${tags.shop}` : "other");

            const distance = haversineMeters(lat, lng, lat0, lon);

            items.push({
                id: props["@id"] || `${props.type}/${props.id}`,
                type,
                name,
                lat: lat0,
                lon,
                distance,
                tags,
            });
        }

        // Rank: prioritize "speakable, stable" targets, then distance, then shorter names
        const priority = (i) => {
            // Highest: plaques/memorials/artwork/sculpture (great for exact-name beats)
            if (i.type === "plaque" || i.type === "memorial" || i.type === "artwork" || i.type === "sculpture") return 6;
            // Then info boards/attractions
            if (i.type === "info_board" || i.type === "attraction") return 5;
            // Then food & drink
            if (["cafe","restaurant","bar","pub","fast_food","ice_cream","bakery"].includes(i.type)) return 4;
            // Then shops
            if (i.type.startsWith("shop:")) return 3;
            // Then other named stuff
            return 2;
        };

        return items
            .sort((a, b) => {
                const pa = priority(a), pb = priority(b);
                if (pb !== pa) return pb - pa;
                if (a.distance !== b.distance) return a.distance - b.distance;
                return (a.name.length || 999) - (b.name.length || 999);
            });
    }

/**
    * Squares / plazas discovery endpoint (replaces "parks").
    * Returns named and unnamed squares within the given radius.
    *
    * NOTE: We keep the path /pcg/pois for backward compatibility, but it now returns ONLY squares.
    */
    router.get("/pois", async (req, res) => {
        try {
            const lat = parseFloat(req.query.lat);
            const lng = parseFloat(req.query.lng);
            // Un-comment to accept a client radius; capped at 5km. For now use a fixed search radius.
                // const radius = Math.min(parseInt(req.query.radius || '1500', 10), 5000);
            const radius = 5000;

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return res.status(400).json({ error: "lat, lng required" });
            }

            const key = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
            const now = Date.now();
            const hit = cache.get(key);
            if (hit && now - hit.t < ttlMs) return res.json(hit.data);

            // We focus on squares, including common Swedish mapping styles (pedestrian area = square)
            const q = `
            [out:json][timeout:45];
            (
                // canonical squares
                node(around:${radius},${lat},${lng})[place=square];
                way(around:${radius},${lat},${lng})[place=square];
                relation(around:${radius},${lat},${lng})[place=square];

                // pedestrian areas mapped as the square surface
                way(around:${radius},${lat},${lng})[highway=pedestrian][area=yes];
                relation(around:${radius},${lat},${lng})[highway=pedestrian][area=yes];

                // named marketplaces that are effectively squares
                node(around:${radius},${lat},${lng})[amenity=marketplace][name];
                way(around:${radius},${lat},${lng})[amenity=marketplace][name];
                relation(around:${radius},${lat},${lng})[amenity=marketplace][name];
            );
            out tags center qt;
            `;

            const raw = await fetchOverpass(q);
            const gj = osmtogeojson(raw);

            const pois = [];
            for (const f of gj.features) {
                const props = f.properties || {};
                const tags = props.tags || props;

                // Only treat these as "square"
                const isSquare =
                    tags.place === "square" ||
                    (tags.highway === "pedestrian" && tags.area === "yes") ||
                    tags.amenity === "marketplace";

                if (!isSquare) continue;

                const c = f.geometry.type === "Point" ? f : centroid(f);
                const [lng0, lat0] = c.geometry.coordinates;

                const osmType = props.type || tags.type;
                const osmId = props.id || tags.id;
                const uid = (osmType && osmId)
                    ? `${osmType}/${osmId}`
                    : (props["@id"] || `${Math.random()}`);

                pois.push({
                    id: uid,
                    name: tags.name || null,
                    category: "square",
                    lat: lat0,
                    lng: lng0,
                    polygon: (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") ? f.geometry : null,
                    tags: {
                        marketplace: tags.amenity === "marketplace" || undefined,
                    },
                });
            }

            // Deduplicate by (category, name, rounded coords) to avoid way+relation duplicates
            const uniq = [];
            const seen = new Set();
            for (const p of pois) {
                const k = `${p.category}:${(p.name || "").toLowerCase()}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
                if (!seen.has(k)) {
                    seen.add(k);
                    uniq.push(p);
                }
            }

            const data = { center: { lat, lng }, radius, count: uniq.length, pois: uniq };

            console.log(
                "Squares uniq:", uniq.length,
                uniq.slice(0, 5).map(p => `${p.category}:${p.name || p.id}`).join(" | ")
            );

            cache.set(key, { t: now, data });
            res.json(data);
        } catch (e) {
            console.error("Overpass error:", e);
            res.status(502).json({ error: "Overpass failed", details: String(e).slice(0, 500) });
        }
    });

/**
    * Convenience endpoint to fetch the BEST named landmark/target around a given point.
    * Useful for debugging what the mission beat will likely pick.
    *
    * GET /pcg/nearby?lat=..&lng=..&radius=..
    */
    router.get("/nearby", async (req, res) => {
        try {
            const lat = parseFloat(req.query.lat);
            const lng = parseFloat(req.query.lng);
            const radius = Math.min(parseInt(req.query.radius || "180", 10), 500);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return res.status(400).json({ error: "lat, lng required" });
            }

            const items = await fetchNamedLandmarksNear(lat, lng, radius);
            res.json({ center: { lat, lng }, radius, count: items.length, items });
        } catch (e) {
            console.error(e);
            res.status(502).json({ error: "Overpass failed", details: String(e).slice(0, 500) });
        }
    });

export default router;

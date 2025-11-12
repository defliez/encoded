#!/usr/bin/env bash
set -euo pipefail

# ==== CONFIG ====
BASE_URL="${BASE_URL:-http://localhost:3000}"   # change if your backend runs elsewhere
RADIUS="${RADIUS:-900}"                          # default search radius
SEEDS=("111" "222")                              # two seeds per location

# Locations: "slug|lat|lng"
LOCS=(
  "malmo_stortorget|55.6050|13.0030"
  "malmo_mollevangstorget|55.5939|13.0038"
  "malmo_triangeln|55.5955|13.0030"
  "lund_stortorget|55.7047|13.1910"
  "copenhagen_cityhall|55.6754|12.5696"
  "stockholm_sergelstorg|59.3326|18.0649"
  "gothenburg_brunnsparken|57.7076|11.9676"
  "uppsala_storatorget|59.8586|17.6389"
  "helsinki_senatesquare|60.1707|24.9520"
  "oslo_jernbanetorget|59.9110|10.7500"
  "aarhus_radhuspladsen|56.1496|10.2039"
)

mkdir -p results

CSV="results/mission_eval.csv"
if [ ! -f "$CSV" ]; then
  echo "run_id,lat,lng,radius,seed,spot_name,num_beats,travel_target_name,travel_target_type,recon_template_id,recon_verification_kind,recon_verification_phrase,coherence_ok,fallback_generic_recon,gen_time_seconds,notes" > "$CSV"
fi

# Small Node helper to parse one JSON file and print one CSV line (comma-safe)
node_parse() {
  node - "$@"
}

for loc in "${LOCS[@]}"; do
  IFS='|' read -r SLUG LAT LNG <<< "$loc"
  for SEED in "${SEEDS[@]}"; do
    RUN_ID="${SLUG}_${SEED}"
    OUT="results/${RUN_ID}.json"

    echo "==> Generating ${RUN_ID}..."
    # Curl: save body to OUT; capture time_total into TIME
    TIME=$(curl -s -o "$OUT" -w '%{time_total}' \
      -H 'Content-Type: application/json' \
      -d "{\"lat\":${LAT},\"lng\":${LNG},\"radius\":${RADIUS},\"seed\":${SEED}}" \
      "${BASE_URL}/pcg/mission")

    # Append one CSV row
    node_parse "$OUT" "$RUN_ID" "$LAT" "$LNG" "$RADIUS" "$SEED" "$TIME" <<'NODE'
const fs = require('fs');

const file = process.argv[2];
const runId = process.argv[3];
const lat = process.argv[4];
const lng = process.argv[5];
const radius = process.argv[6];
const seed = process.argv[7];
const genTime = process.argv[8];

function q(v) {
  if (v === null || v === undefined) v = '';
  v = String(v);
  // escape quotes
  if (v.includes('"') || v.includes(',') || v.includes('\n')) {
    v = '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

try {
  const raw = fs.readFileSync(file, 'utf8');
  const root = JSON.parse(raw);
  const mission = root.mission || {};

  const steps = Array.isArray(mission.steps) ? mission.steps : [];
  const travel = steps.find(s => s.kind === 'travel') || {};
  const recon  = steps.find(s => s.kind === 'recon')  || {};

  const t = (travel.vars && travel.vars.target) || {};
  const r = (recon.vars  && recon.vars.target)  || {};
  const v = (recon.vars  && recon.vars.verification) || {};

  // Coherence checks
  const matchId = t.id && r.id && (t.id === r.id);
  const rId = recon.id || '';
  const typeOk =
    rId.includes('restaurant') ? (t.type === 'restaurant') :
    rId.includes('cafe_') ? (
      t.type === 'cafe' || t.type === 'bakery' ||
      (typeof t.type === 'string' && t.type.startsWith('shop:bakery')) ||
      t.type === 'ice_cream'
    ) :
    rId.includes('art_') ? (
      t.type === 'statue' || t.type === 'memorial' || t.type === 'artwork' || t.type === 'monument'
    ) :
    rId.includes('scan_target') ? true : true;

  const coherence = Boolean(matchId && typeOk);
  const fallbackGeneric = rId.includes('scan_target');

  const spotName = (mission.generator && mission.generator.chosen && mission.generator.chosen.name) || 'the square';
  const row = [
    q(runId),
    q(lat),
    q(lng),
    q(radius),
    q(seed),
    q(spotName),
    q(steps.length),
    q(t.name || ''),
    q(t.type || ''),
    q(recon.id || ''),
    q(v.kind || ''),
    q(v.phrase == null ? '' : v.phrase),
    q(coherence),
    q(fallbackGeneric),
    q(genTime),
    q('')
  ].join(',');

  console.log(row);
} catch (e) {
  // Still output a row with error note
  const row = [
    q(runId), q(lat), q(lng), q(radius), q(seed),
    q(''), q(''), q(''), q(''), q(''), q(''), q(''),
    q(''), q(''), q(''), q('PARSE_ERROR: ' + (e && e.message || e))
  ].join(',');
  console.log(row);
}
NODE
  done
done

echo "Done. CSV at $CSV"


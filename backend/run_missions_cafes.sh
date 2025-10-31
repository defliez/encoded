#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RADIUS="${RADIUS:-450}"
SEEDS=("111" "222")

LIST="results/locs_cafeheavy.txt"
CSV="results/mission_eval.csv"
mkdir -p results

# Ensure header exists
if [ ! -f "$CSV" ]; then
  echo "run_id,lat,lng,radius,seed,spot_name,num_beats,travel_target_name,travel_target_type,recon_template_id,recon_verification_kind,recon_verification_phrase,coherence_ok,fallback_generic_recon,gen_time_seconds,notes" > "$CSV"
fi

while IFS='|' read -r SLUG LAT LNG; do
  [ -z "$SLUG" ] && continue
  for SEED in "${SEEDS[@]}"; do
    RUN_ID="${SLUG}_${SEED}"
    OUT="results/${RUN_ID}.json"
    echo "==> Generating ${RUN_ID}..."

    TIME=$(curl -s -o "$OUT" -w '%{time_total}' \
      -H 'Content-Type: application/json' \
      -d "{\"lat\":${LAT},\"lng\":${LNG},\"radius\":${RADIUS},\"seed\":${SEED}}" \
      "${BASE_URL}/pcg/mission")

    # Append one CSV row (reusing your inline Node parser)
    node - "$OUT" "$RUN_ID" "$LAT" "$LNG" "$RADIUS" "$SEED" "$TIME" >> "$CSV" <<'NODE'
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
  const row = [
    q(runId), q(lat), q(lng), q(radius), q(seed),
    q(''), q(''), q(''), q(''), q(''), q(''), q(''),
    q(''), q(''), q(''), q('PARSE_ERROR: ' + (e && e.message || e))
  ].join(',');
  console.log(row);
}
NODE

  done
done < "$LIST"

echo "Done. Appended to $CSV"


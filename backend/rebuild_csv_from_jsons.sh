#!/usr/bin/env bash
set -euo pipefail

RESULTS_DIR="${1:-results}"
CSV="${RESULTS_DIR}/mission_eval.csv"

echo "run_id,lat,lng,radius,seed,spot_name,num_beats,travel_target_name,travel_target_type,recon_template_id,recon_verification_kind,recon_verification_phrase,coherence_ok,fallback_generic_recon,gen_time_seconds,notes" > "$CSV"

node - <<'NODE' "$RESULTS_DIR" "$CSV"
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const csvPath = process.argv[3];

function q(v) {
  if (v === null || v === undefined) v = '';
  v = String(v);
  if (v.includes('"') || v.includes(',') || v.includes('\n')) {
    v = '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

// try to infer timings from a sidecar text if present; else blank
function loadTime(runId) {
  // If you want, write your own way to store per-run time in a file.
  return '';
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
files.sort();
for (const f of files) {
  const runId = path.basename(f, '.json');
  const p = path.join(dir, f);
  try {
    const raw = fs.readFileSync(p, 'utf8');
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

    // pull lat/lng/radius/seed from the generator/player if present (best effort)
    const lat = mission.lat ?? (mission.generator?.player?.lat ?? '');
    const lng = mission.lon ?? (mission.generator?.player?.lng ?? '');
    const radius = mission.generator?.radius ?? '';
    const seed = mission.seed ?? '';

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
      q(loadTime(runId)),
      q('')
    ].join(',');

    fs.appendFileSync(csvPath, row + '\n');
  } catch (e) {
    const row = [
      q(runId), q(''), q(''), q(''), q(''),
      q(''), q(''), q(''), q(''), q(''), q(''), q(''),
      q(''), q(''), q(''), q('PARSE_ERROR: ' + (e && e.message || e))
    ].join(',');
    fs.appendFileSync(csvPath, row + '\n');
  }
}
NODE

echo "CSV rebuilt at $CSV"


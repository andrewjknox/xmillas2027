#!/usr/bin/env node
// Build step — fits the athlete's own pace-vs-grade curve from past X Millas
// editions (data/refs/editions/) and writes data/refs/pace-model.json.
// Ported from gtcb (which fitted a trail 46K). Deterministic, dependency-free.
//
//   curve  [{g, v, n}]  moving speed (m/s) by grade (%), calibrated so that
//                       walking the pooled chunks reproduces their moving time
//
// Complements editions.mjs (Minetti GAP = physiology baseline): this curve is
// what the athlete actually does on each grade at race effort.
// Exit 0 = built, 2 = failed.

import { readFileSync, writeFileSync } from "node:fs";

// Pooled from the X Millas editions run continuously (2024/2025 were
// run/walk — walk breaks would pollute the climb bins).
const SOURCES = [2022, 2023, 2026].map((y) => `data/refs/editions/${y}.json`);
const OUT = "data/refs/pace-model.json";

const refs = [];
for (const src of SOURCES) {
  try {
    refs.push(JSON.parse(readFileSync(src, "utf8")));
  } catch (e) {
    console.error(`fit-grade-curve: cannot read ${src}: ${e.message}`);
    process.exit(2);
  }
}

// ---- chunk each run into ~100 m moving windows: grade + speed per chunk ----
// Pairs flagged not-moving or with dt > 60 s (auto-pause gaps) are dropped
// and close the current chunk.
const CHUNK_M = 100;
const chunks = [];
for (const ref of refs) {
  const { time, distance, altitude, moving } = ref.streams;
  const n = time.length;
  let ds = 0, dt = 0, dele = 0;
  for (let i = 1; i < n; i++) {
    const pd = distance[i] - distance[i - 1];
    const pt = time[i] - time[i - 1];
    if (!moving[i] || pd <= 0 || pt <= 0 || pt > 60) {
      ds = dt = dele = 0;
      continue;
    }
    ds += pd; dt += pt; dele += altitude[i] - altitude[i - 1];
    if (ds >= CHUNK_M) {
      chunks.push({ g: (dele / ds) * 100, v: ds / dt, ds, dt });
      ds = dt = dele = 0;
    }
  }
}

// ---- median speed per 2 % grade bin, thin bins dropped ----
const BIN_W = 2, MIN_CHUNKS = 6;
const byBin = new Map();
for (const c of chunks) {
  const centre = Math.round(c.g / BIN_W) * BIN_W;
  if (!byBin.has(centre)) byBin.set(centre, []);
  byBin.get(centre).push(c.v);
}
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
let curve = [...byBin.entries()]
  .filter(([, vs]) => vs.length >= MIN_CHUNKS)
  .map(([g, vs]) => ({ g, v: median(vs), n: vs.length }))
  .sort((a, b) => a.g - b.g);

if (curve.length < 5) {
  console.error(`fit-grade-curve: only ${curve.length} usable grade bins`);
  process.exit(2);
}

// ---- light 1-2-1 smoothing (medians of adjacent bins can still zigzag) ----
curve = curve.map((p, i) => {
  const lo = curve[i - 1], hi = curve[i + 1];
  if (!lo || !hi) return { g: p.g, v: p.v, n: p.n };
  return { g: p.g, v: (lo.v + 2 * p.v + hi.v) / 4, n: p.n };
});

// ---- calibrate: walking the pooled chunks must reproduce their moving time ----
// Beyond the end bins, speed is extended at constant vertical rate (climb and
// descent metres/hour plateau on steep ground) rather than clamped.
function speedAt(g) {
  const lo = curve[0], hi = curve[curve.length - 1];
  if (g < lo.g) return (lo.v * Math.abs(lo.g)) / Math.abs(g);
  if (g > hi.g) return (hi.v * hi.g) / g;
  for (let i = 1; i < curve.length; i++) {
    if (g <= curve[i].g) {
      const a = curve[i - 1], b = curve[i];
      return a.v + ((g - a.g) / (b.g - a.g)) * (b.v - a.v);
    }
  }
  return hi.v;
}
let predT = 0, actT = 0;
for (const c of chunks) { predT += c.ds / speedAt(c.g); actT += c.dt; }
const calib = predT / actT; // >1 means the curve runs slow; scale speeds up
curve = curve.map((p) => ({ g: p.g, v: +(p.v * calib).toFixed(4), n: p.n }));

const model = {
  generated_by: "scripts/build/fit-grade-curve.mjs",
  source: {
    activity_ids: refs.map((r) => r.source.activity_id),
    dates: refs.map((r) => r.source.start_date_local.slice(0, 10)),
    chunks: chunks.length,
    calibration: +calib.toFixed(4),
  },
  curve,
};

writeFileSync(OUT, JSON.stringify(model, null, 2) + "\n");
console.log(`fit-grade-curve: ${OUT} — ${chunks.length} chunks, ${curve.length} bins, calib ${calib.toFixed(4)}`);
for (const p of curve) console.log(`  ${String(p.g).padStart(4)}%  ${p.v.toFixed(2)} m/s  (${p.n})`);

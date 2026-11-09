#!/usr/bin/env node
// Import a saved Strava MCP get_activity_streams result (JSON object of
// stream arrays) into a compact repo reference file. Run from repo root:
//
//   node scripts/import-streams.mjs <mcp-result.txt> <out.json> <activity_id> <YYYY-MM-DDTHH:MM:SS> "<name>"
//
// Keeps time/distance/altitude/moving/heart_rate (+ location if present).
// Dependency-free. Exit 0 = written, 2 = failed.

import { readFileSync, writeFileSync } from "node:fs";

const [src, out, id, start, name] = process.argv.slice(2);
if (!src || !out || !id || !start) {
  console.error('usage: node scripts/import-streams.mjs <src> <out> <activity_id> <start_local> "<name>"');
  process.exit(2);
}

let s;
try {
  s = JSON.parse(readFileSync(src, "utf8"));
} catch (e) {
  console.error(`import-streams: cannot parse ${src}: ${e.message}`);
  process.exit(2);
}
const n = s.time?.length ?? 0;
for (const k of ["time", "distance", "altitude", "moving"]) {
  if (!Array.isArray(s[k]) || s[k].length !== n) {
    console.error(`import-streams: stream ${k} missing or length != ${n}`);
    process.exit(2);
  }
}

const streams = { time: s.time, distance: s.distance, altitude: s.altitude, moving: s.moving };
if (Array.isArray(s.heart_rate) && s.heart_rate.length === n) streams.heart_rate = s.heart_rate;
if (Array.isArray(s.location) && s.location.length === n) streams.location = s.location;

let moving_time_s = 0;
for (let i = 1; i < n; i++) if (s.moving[i]) moving_time_s += s.time[i] - s.time[i - 1];

const doc = {
  source: {
    activity_id: String(id),
    name: name ?? null,
    start_date_local: start,
    elapsed_time_s: s.time[n - 1] - s.time[0],
    moving_time_s,
    distance_m: s.distance[n - 1],
    samples: n,
  },
  streams,
};
writeFileSync(out, JSON.stringify(doc) + "\n");
console.log(`import-streams: ${out} — ${n} samples, ${doc.source.distance_m} m, ${doc.source.elapsed_time_s} s`);

#!/usr/bin/env node
// Build step — course profile reference. The X Millas course never changes, so
// the 2026 edition (data/refs/editions/2026.json, GPS + barometric altitude)
// is the reference track. Writes data/refs/course.json:
//   profile   [{d, alt, lat, lng}] every STEP_M metres (d = metres from start)
//   sections  hand-defined from the profile (boundaries in metres on the
//             reference track; editions are distance-normalised onto it)
// Deterministic, dependency-free. Exit 0 = built, 2 = failed.

import { readFileSync, writeFileSync } from "node:fs";

const SRC = "data/refs/editions/2026.json";
const OUT = "data/refs/course.json";
const STEP_M = 50;

// Section boundaries (m). Read off the 250 m profile print, 2026-11-09.
// kind: climb | descent | rolling. Climbs are what the dashboard tracks.
const SECTIONS = [
  { id: "start",   name: "Start loop",        kind: "rolling", from: 0,     to: 1200 },
  { id: "down1",   name: "Drop to the coast", kind: "descent", from: 1200,  to: 5600 },
  { id: "climb1",  name: "Mid-race climb",    kind: "climb",   from: 5600,  to: 7350 },
  { id: "dip",     name: "Dip",               kind: "rolling", from: 7350,  to: 8300 },
  { id: "climb2",  name: "Lighthouse kick",   kind: "climb",   from: 8300,  to: 9050 },
  { id: "top",     name: "Top rollers",       kind: "rolling", from: 9050,  to: 10500 },
  { id: "down2",   name: "Second descent",    kind: "descent", from: 10500, to: 12600 },
  { id: "climb3",  name: "Finish drag",       kind: "climb",   from: 12600, to: 15750 },
  { id: "finish",  name: "Run-in",            kind: "rolling", from: 15750, to: null }, // null = finish
];

let ref;
try {
  ref = JSON.parse(readFileSync(SRC, "utf8"));
} catch (e) {
  console.error(`course-data: cannot read ${SRC}: ${e.message}`);
  process.exit(2);
}
const { distance, altitude, location } = ref.streams;
const n = distance.length;
const L = distance[n - 1];

// interpolate a stream at distance d (distance is monotonic non-decreasing)
let j = 0;
function at(arr, d) {
  while (j < n - 2 && distance[j + 1] < d) j++;
  const d0 = distance[j], d1 = distance[j + 1];
  const t = d1 > d0 ? Math.min(1, Math.max(0, (d - d0) / (d1 - d0))) : 0;
  const a = arr[j], b = arr[j + 1];
  return Array.isArray(a) ? [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] : a + t * (b - a);
}

const profile = [];
for (let d = 0; d <= L; d += STEP_M) {
  j = 0;
  const p = { d, alt: +at(altitude, d).toFixed(1) };
  if (location) {
    j = 0;
    const [lat, lng] = at(location, d);
    p.lat = +lat.toFixed(6);
    p.lng = +lng.toFixed(6);
  }
  profile.push(p);
}
if (profile[profile.length - 1].d !== Math.round(L)) {
  j = 0;
  const p = { d: Math.round(L), alt: +altitude[n - 1].toFixed(1) };
  if (location) { p.lat = location[n - 1][0]; p.lng = location[n - 1][1]; }
  profile.push(p);
}

const altAt = (d) => {
  const i = Math.min(profile.length - 1, Math.round(d / STEP_M));
  return profile[i].alt;
};
let gain = 0, loss = 0;
for (let i = 1; i < profile.length; i++) {
  const dz = profile[i].alt - profile[i - 1].alt;
  if (dz > 0) gain += dz; else loss -= dz;
}

const sections = SECTIONS.map((s) => {
  const to = s.to ?? Math.round(L);
  let g = 0, l = 0;
  for (let i = 1; i < profile.length; i++) {
    if (profile[i].d <= s.from || profile[i - 1].d >= to) continue;
    const dz = profile[i].alt - profile[i - 1].alt;
    if (dz > 0) g += dz; else l -= dz;
  }
  const net = altAt(to) - altAt(s.from);
  return {
    ...s, to,
    length_m: to - s.from,
    gain_m: Math.round(g), loss_m: Math.round(l),
    avg_grade_pct: +((100 * net) / (to - s.from)).toFixed(1),
  };
});

const course = {
  generated_by: "scripts/build/course-data.mjs",
  source: { activity_id: ref.source.activity_id, name: ref.source.name, date: ref.source.start_date_local.slice(0, 10) },
  length_m: Math.round(L),
  gain_m: Math.round(gain),
  loss_m: Math.round(loss),
  step_m: STEP_M,
  sections,
  profile,
};
writeFileSync(OUT, JSON.stringify(course) + "\n");
console.log(`course-data: ${OUT} — ${profile.length} pts, ${course.length_m} m, +${course.gain_m}/-${course.loss_m} m`);
for (const s of sections) {
  console.log(`  ${s.id.padEnd(7)} ${(s.from / 1000).toFixed(2)}-${(s.to / 1000).toFixed(2)} km  +${s.gain_m}/-${s.loss_m} m  ${s.avg_grade_pct}%`);
}

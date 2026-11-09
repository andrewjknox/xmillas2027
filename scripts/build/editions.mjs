#!/usr/bin/env node
// Build step — past-edition analysis. Reads data/refs/course.json +
// data/refs/editions/<year>.json and writes data/refs/editions.json:
//
//   per edition   finish time, per-section time, per-section GAP pace
//   climb_fade    GAP on climbs / GAP on rolling sections (1.00 = climbs
//                 cost exactly what the grade predicts; >1 = fading uphill).
//                 Descents are excluded from the baseline: nobody banks the
//                 full speed Minetti predicts downhill, so they'd flatter climbs.
//   late_climb_fade  GAP finish drag (climb3) / GAP mid-race climb (climb1):
//                 >1 = the late climb costs more than the early one
//   climb_tax_s   per climb: actual time − time at the edition's own
//                 rolling-section GAP (seconds lost beyond what grade explains)
//   vs_pb_s       per section: time − PB edition's time
//
// GAP model: Minetti et al. 2002 energy cost of running on gradients
// (athlete-independent, so "fade" is measured against physiology, not
// against the athlete's own habits). Grades come from the reference course
// profile, not each edition's noisy altitude. Each edition's distance is
// scaled onto the reference length (GPS drift 16.01–16.17 km).
// Elapsed time throughout: walk breaks (2024/2025) count, as on race day.
// Deterministic, dependency-free. Exit 0 = built, 2 = failed.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OUT = "data/refs/editions.json";

// Edition metadata — names/notes from the Strava activities (owner's own words).
const EDITIONS = [
  { year: 2022, chip_s: null, note: "First long run after injury; no walk breaks" },
  { year: 2023, chip_s: 4545, note: "PB — chip 1:15:45. Ibuprofen pre-start; physio next day" },
  { year: 2024, chip_s: null, note: "Run/walk — calf rehab; \"Calf made it\"" },
  { year: 2025, chip_s: null, note: "Run/walk" },
  { year: 2026, chip_s: null, note: "Hot; ran it continuously" },
];

function readJSON(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`editions: cannot read ${p}: ${e.message}`);
    process.exit(2);
  }
}

const course = readJSON("data/refs/course.json");
const L = course.length_m;
const STEP = course.step_m;

// Minetti 2002: J/kg/m at gradient i (fraction), valid ~ -0.45..+0.45
function cost(i) {
  const x = Math.max(-0.45, Math.min(0.45, i));
  return 155.4 * x ** 5 - 30.4 * x ** 4 - 43.3 * x ** 3 + 46.3 * x ** 2 + 19.5 * x + 3.6;
}
const C0 = cost(0);

// reference grade per profile step (smoothed over +-100 m)
const prof = course.profile;
const grade = prof.map((p, k) => {
  const a = prof[Math.max(0, k - 2)], b = prof[Math.min(prof.length - 1, k + 2)];
  return b.d > a.d ? (b.alt - a.alt) / (b.d - a.d) : 0;
});
const gradeAt = (d) => grade[Math.min(grade.length - 1, Math.max(0, Math.round(d / STEP)))];

// time at normalised distance d (linear interpolation; walk/stand pauses kept)
function timeAt(t, dn, d) {
  let lo = 0, hi = dn.length - 1;
  if (d <= dn[0]) return t[0];
  if (d >= dn[hi]) return t[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (dn[mid] < d) lo = mid; else hi = mid;
  }
  const f = dn[hi] > dn[lo] ? (d - dn[lo]) / (dn[hi] - dn[lo]) : 0;
  return t[lo] + f * (t[hi] - t[lo]);
}

// grade-equivalent flat distance of [from, to] on the reference course
function eqDistance(from, to) {
  let eq = 0;
  for (let d = from; d < to; d += 10) {
    const seg = Math.min(10, to - d);
    eq += (seg * cost(gradeAt(d + seg / 2))) / C0;
  }
  return eq;
}
const EQ = Object.fromEntries(course.sections.map((s) => [s.id, eqDistance(s.from, s.to)]));

const out = [];
for (const meta of EDITIONS) {
  const p = `data/refs/editions/${meta.year}.json`;
  if (!existsSync(p)) {
    console.error(`editions: missing ${p}`);
    process.exit(2);
  }
  const ref = readJSON(p);
  const { time, distance, heart_rate } = ref.streams;
  const scale = L / distance[distance.length - 1];
  const dn = distance.map((d) => d * scale);
  const t0 = time[0];
  const t = time.map((x) => x - t0);

  const sections = course.sections.map((s) => {
    const ta = timeAt(t, dn, s.from), tb = timeAt(t, dn, s.to);
    const secs = tb - ta;
    // mean HR over the section (samples whose normalised distance falls inside)
    let hrSum = 0, hrN = 0;
    if (heart_rate) {
      for (let i = 0; i < dn.length; i++) {
        if (dn[i] >= s.from && dn[i] < s.to && heart_rate[i] > 0) { hrSum += heart_rate[i]; hrN++; }
      }
    }
    return {
      id: s.id,
      time_s: Math.round(secs),
      pace_s_per_km: +((1000 * secs) / s.length_m).toFixed(1),
      gap_s_per_km: +((1000 * secs) / EQ[s.id]).toFixed(1),
      avg_hr: hrN ? Math.round(hrSum / hrN) : null,
    };
  });

  const kindOf = (id) => course.sections.find((s) => s.id === id).kind;
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const gapOf = (kind) => {
    const xs = sections.filter((x) => kindOf(x.id) === kind);
    return (1000 * sum(xs, (x) => x.time_s)) / sum(xs, (x) => EQ[x.id]);
  };
  const gapClimb = gapOf("climb"), gapRest = gapOf("rolling"), gapDown = gapOf("descent");
  for (const x of sections.filter((x) => kindOf(x.id) === "climb")) {
    x.climb_tax_s = Math.round(x.time_s - (gapRest * EQ[x.id]) / 1000);
  }
  const g = (id) => sections.find((x) => x.id === id).gap_s_per_km;

  out.push({
    year: meta.year,
    activity_id: ref.source.activity_id,
    name: ref.source.name,
    date: ref.source.start_date_local.slice(0, 10),
    note: meta.note,
    elapsed_s: ref.source.elapsed_time_s,
    chip_s: meta.chip_s,
    gps_m: Math.round(distance[distance.length - 1]),
    gap_climbs_s_per_km: +gapClimb.toFixed(1),
    gap_rolling_s_per_km: +gapRest.toFixed(1),
    gap_descents_s_per_km: +gapDown.toFixed(1),
    climb_fade: +(gapClimb / gapRest).toFixed(3),
    late_climb_fade: +(g("climb3") / g("climb1")).toFixed(3),
    sections,
  });
}

// PB = fastest chip-or-elapsed time
const best = (e) => e.chip_s ?? e.elapsed_s;
const pb = out.reduce((a, b) => (best(b) < best(a) ? b : a));
for (const e of out) {
  e.is_pb = e === pb;
  for (const s of e.sections) {
    s.vs_pb_s = s.time_s - pb.sections.find((x) => x.id === s.id).time_s;
  }
}

const doc = {
  generated_by: "scripts/build/editions.mjs",
  gap_model: "Minetti 2002 (energy cost of running vs gradient)",
  pb_year: pb.year,
  sections_eq_m: Object.fromEntries(Object.entries(EQ).map(([k, v]) => [k, Math.round(v)])),
  editions: out,
};
writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");

const fmt = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;
console.log(`editions: ${OUT} — ${out.length} editions, PB ${pb.year}`);
for (const e of out) {
  const tax = e.sections.filter((s) => "climb_tax_s" in s).map((s) => `${s.id} ${s.climb_tax_s >= 0 ? "+" : ""}${s.climb_tax_s}s`).join(", ");
  console.log(`  ${e.year}  ${fmt(e.elapsed_s)}  GAP climb/roll/down ${e.gap_climbs_s_per_km}/${e.gap_rolling_s_per_km}/${e.gap_descents_s_per_km}  fade ${e.climb_fade.toFixed(3)}  late ${e.late_climb_fade.toFixed(3)}  tax: ${tax}`);
}

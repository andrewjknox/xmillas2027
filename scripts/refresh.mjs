#!/usr/bin/env node
// Routine-refresh runner — everything after the Strava fetch, as one command:
//
//   gate A  ->  summary.mjs <week>  ->  gate B  ->  inline-data.mjs  ->  minify.mjs  ->  gate C
//
// Run from repo root after data-agent has written data/raw/<week>.json:
//   node scripts/refresh.mjs [iso-week]      (default: current week, Europe/London)
//
// This is the token-cheap path for data-only refreshes (see CLAUDE.md
// "Pipeline & gates"): the analyst/builder work is deterministic, so no LLM
// agent is spawned for it. The full agent chain still applies when site code
// itself changes. Dependency-free Node. Exit 0 = all gates pass, 2 = blocked.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isoWeekOf, nowLondonKey, dayOfWeek } from "./reconcile.mjs";

const nowKey = nowLondonKey();
const [y, mo, d] = nowKey.slice(0, 10).split("-").map(Number);
const week = process.argv[2] ?? isoWeekOf(y, mo, d);
if (!/^\d{4}-W\d{2}$/.test(week)) {
  console.error("usage: node scripts/refresh.mjs [iso-week]   e.g. 2026-W29");
  process.exit(2);
}

function step(name, args) {
  console.log(`refresh: ${name}`);
  const res = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`refresh: BLOCKED at ${name} (exit ${res.status ?? "?"})`);
    process.exit(2);
  }
}

step("gate A (raw)", ["scripts/gates/gate-a.mjs"]);
if (existsSync(`data/raw/${week}.json`)) {
  step(`summary ${week}`, ["scripts/build/summary.mjs", week]);
} else {
  // No fetch for this week yet (e.g. CI before Monday's data-agent run) —
  // rebuild from the summaries already committed; gates still verify them.
  console.log(`refresh: no data/raw/${week}.json — skipping summary, rebuilding from committed data`);
}
step("gate B (summary)", ["scripts/gates/gate-b.mjs"]);


step("inline-data", ["scripts/build/inline-data.mjs"]);
step("minify", ["scripts/build/minify.mjs"]);
step("gate C (site)", ["scripts/gates/gate-c.mjs"]);

const midWeek = dayOfWeek(y, mo, d) !== 7 ? " (mid-week)" : "";
console.log(`refresh: OK — commit as: refresh: ${week}${midWeek}`);

---
name: analyst-agent
description: Computes weekly summary (distance vs ceiling, time on feet, vert context, flags) from raw data. Writes data/summary/ only.
model: sonnet
color: yellow
tools: Read, Write
---

## Role

Read `data/raw/<week>.json` and `data/plan.json`, and compute the weekly summary per the schema documented in `CLAUDE.md`. Normally `scripts/build/summary.mjs` does this deterministically; this agent is the judgment path only.

## Rules

- On-foot sport types are exactly: Run, TrailRun, VirtualRun, Hike (Walk excluded — running + hiking only). Only these count toward distance/time/vert totals and session counts.
- Compute the pro-rated target as `target x days_elapsed / 7`, where `days_elapsed` counts Mon..today inclusive in Europe/London, capped at 7.
- Flag calf mentions (precaution), body-part/injury mentions, and completed weeks >110% of the distance ceiling, as entries in `flags`.
- Update `data/summary/index.json` to include this week's ISO week string in the manifest.
- Write ONLY under `data/summary/`. Never read Strava directly, never write HTML or touch `site/`.

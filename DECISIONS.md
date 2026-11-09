# DECISIONS

## Owner answers (2026-11-09)
| Q | Answer |
|---|---|
| Block start | Mon 2026-12-07 (19 weeks) |
| Trail races | Add later |
| Headline metric | Weekly distance vs plan |
| Plan source | Claude drafts, built around the fixed course |
| Goal time | None. "Never want to chase… let my musculoskeletal system catch up." PB ref: 2023 chip 1:15:45 |
| Repo | `xmillas2027`; new look: GTA VI colour palette |
| Injury watches | Calf (precaution) only carries over from gtcb |

## Made while setting up
1. **Ceilings, not quotas.** Follows from "never chase". `over_ceiling` flag = completed week >110%.
2. **Plan**: 20 → 50 km peak (W15), 3:1 load/recovery. Uphill progression: strides → short reps → long reps → climbing after running (finish drag). Below GTCB volumes (45–65 km/wk on foot) because road running is harsher on tissue than hiking.
3. **Course reference** = 2026 edition track (course never changes). Sections hand-set from the profile.
4. **Fade metric** uses Minetti 2002 GAP (athlete-independent). Climbs are compared with rolling sections only: descents are excluded, since nobody banks Minetti's downhill gain.
5. **Finding**: race-day climbs aren't slow relative to grade (fade 0.93–0.98). The finish drag costs 3.5–6% more GAP than the mid-race climb in non-PB years; 2023 PB held it level. → Late-race climbing on tired legs is the target. 2026 also lost 165 s on the first descent.
6. **Personal grade curve** pools 2022/2023/2026 only (2024/25 run/walk would pollute climb bins). 2% bins (road grades are gentle).
7. **No `site/data/` JSON copies** (gtcb had them). `data.js` is the single shipped copy; Gate C check-4 now deep-compares it with `data/`.
8. **Gates A/B/R pass on empty** pre-block. Gate B still blocks if raw exists without summaries.
9. **Units** default mi (Strava pref imperial); storage metric.
10. **Palette**: GTA VI-inspired colours only (sunset/neon). No logos, fonts, or names from the game. Display font: Anton (Google Fonts).
11. **Not ported**: course planner, PR previews, debrief modal (debriefs are inline `<details>` on plan.html), strength/venues/regs pages.
12. **Workout library** (2026-11-09, owner request): `data/workouts.json` explains each session with an honest evidence tag. Most hill and stride work is coaching consensus. Cited: Barnes 2013 (uphill intervals), Frandsen/Nielsen 2025 (single-session spikes), Bontemps 2024 (downhill repeated bout), a 65-km ultra study (fatigued uphill economy).
13. **long_run_spike flag** from Frandsen/Nielsen 2025 (verified against the BJSM paper). Weekly-ratio rules showed no link, so the weekly ceiling stays a tissue guard, not an injury rule.
14. **Plan edits**: downhill strides added W9/11/13/15 (2026 lost most on the first descent). Calf raises moved to `every_week`.

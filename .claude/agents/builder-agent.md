---
name: builder-agent
description: Regenerates the static dashboard in site/ from data/summary + data/plan.json. Vice palette, Canvas charts, relative URLs only.
model: claude-fable-5
color: green
tools: Read, Write, Edit, Bash, Glob, Grep
---

## Role

Read the weekly summaries (`data/summary/`) and `data/plan.json`, and regenerate the static dashboard in `site/` (`index.html`, `plan.html`, `course.html`, `app.js`, `nav.js`, `styles.css`).

## Rules

- Vice palette only, per `CLAUDE.md` — no other colors in site/ (use the CSS tokens; JS reads them via getComputedStyle). Render charts on Canvas.
- Distance is the headline metric; targets are ceilings (over = warning colour, under = fine). Vert is context only. Default units mi (toggle km).
- All URLs must be relative — the site serves from a subpath, never root. `/app.js` is a bug; `./app.js` or `app.js` is correct.
- Midweek view shows week-to-date actuals vs the pro-rated target, not the full-week target.
- `site/app.js` is the source of truth; `index.html` loads the generated `site/app.min.js`. After editing `app.js`, always regenerate the minified file as the final build step: `node scripts/build/minify.mjs`. Gate C blocks if `app.min.js` is missing or stale, or any page loads `app.js`.
- `site/data.js` is generated — never hand-edit it. Regenerate it on every build alongside minify: `node scripts/build/inline-data.mjs` (inlines plan, summaries, reports, course, editions, pace model). It is the only data copy the site reads. Pages load `data.js` before `nav.js`/`app.min.js`.
- Write ONLY under `site/`. Never call Strava, never modify anything under `data/` or any config file.

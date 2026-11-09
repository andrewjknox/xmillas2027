# X Millas 2027

Training dashboard for X Millas Costa Blanca (10 mi road, Sun 18 Apr 2027). Static site in `site/`, data pipeline in `scripts/`. Details: `CLAUDE.md`.

| Page | Shows |
|---|---|
| `index.html` | This week's distance vs ceiling, the block chart, daily distance, flags, climb watch |
| `plan.html` | 19-week plan, ceilings vs actuals, debriefs |
| `course.html` | Profile, sections, 5 past editions, time vs PB, fade metrics, grade→pace curve |

## Run
```sh
node scripts/refresh.mjs [2026-W50]     # after data-agent writes data/raw/<week>.json
```
Open `site/index.html` directly (works from file://).

## Rebuild refs
```sh
node scripts/build/course-data.mjs && node scripts/build/fit-grade-curve.mjs && node scripts/build/editions.mjs
node scripts/build/inline-data.mjs && node scripts/build/minify.mjs
```

## Publish (one-time)
1. `gh repo create andrewjknox/xmillas2027 --private --source . --push`
2. Settings → Pages → Source: GitHub Actions. The site deploys to `https://andrewjknox.github.io/xmillas2027/`. URLs are relative, so it also works under a subpath such as knoxy.com/xmillas2027/.

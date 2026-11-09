#!/usr/bin/env node
// Gate C — validates the built site/ against CLAUDE.md invariants:
// HTML validity, relative URLs only, Vice palette lockdown, data fidelity,
// metric fields consumed, git diff scope, non-empty index.html, minified JS shipped.
// Dependency-free Node (html-validate is spawned via npx). Exit 0 = pass, 2 = block.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { isDeepStrictEqual } from "node:util";
import { collect } from "../build/inline-data.mjs";

const SITE_DIR = "site";
// Vice palette (GTA VI-inspired sunset/neon) — the only colours allowed in site/.
// Keep in sync with CLAUDE.md and the :root tokens in site/styles.css.
const PALETTE = new Set([
  "#0d0b1e", "#1c1438", "#3a2466", "#8a7fb0", "#b9a7e6", "#ff3d8b", "#ff6f61",
  "#ff9f43", "#ffd166", "#2de2c8", "#45c4f9", "#fff3e3",
  "#000000", "#ffffff", "#000", "#fff",
]);

const METRIC_FIELDS = [
  "actual_m", "target_m", "prorated_target_m", "pct_of_target", "pct_of_prorated",
  "long_run_m", "time_on_feet", "distance", "vert", "sessions", "on_foot_count",
  "daily", "flags", "phase", "training_week", "dist_target_km",
  "climb_fade", "late_climb_fade", "climb_tax_s", "vs_pb_s", "gap_s_per_km",
];

// ---------- helpers ----------

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function siteTextFiles(exts) {
  return walk(SITE_DIR).filter((p) => exts.some((e) => p.toLowerCase().endsWith(e)));
}

const results = [];
function report(name, errs) {
  if (errs.length) {
    results.push(false);
    console.error(`gate-c: ${name} FAIL — ${errs.join("; ")}`);
  } else {
    results.push(true);
    console.log(`gate-c: ${name} OK`);
  }
}

if (!existsSync(SITE_DIR)) {
  console.error(`gate-c: ${SITE_DIR}/ does not exist`);
  process.exit(2);
}

// ---------- check 1: HTML validity via html-validate ----------
{
  const errs = [];
  const htmlFiles = siteTextFiles([".html", ".htm"]);
  if (htmlFiles.length === 0) {
    errs.push("no HTML files found in site/");
  } else {
    const cmd = `npx --yes html-validate ${htmlFiles.map((f) => JSON.stringify(f)).join(" ")}`;
    const res = spawnSync(cmd, { shell: true, encoding: "utf8", timeout: 180000 });
    if (res.error) {
      errs.push(`could not run html-validate: ${res.error.message}`);
    } else if (res.status !== 0) {
      const detail = `${res.stdout ?? ""}${res.stderr ?? ""}`.trim().replace(/\s*\n\s*/g, " | ");
      errs.push(`html-validate exit ${res.status}: ${detail.slice(0, 1500)}`);
    }
  }
  report("check-1 html-valid", errs);
}

// ---------- check 2: relative URLs only ----------
{
  const errs = [];
  const patterns = [`href="/`, `href='/`, `src="/`, `src='/`, `url(/`, `fetch("/`, `fetch('/`];
  for (const file of siteTextFiles([".html", ".htm", ".css", ".js", ".mjs"])) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const pat of patterns) {
        if (line.includes(pat)) errs.push(`${file}:${i + 1} contains ${pat}`);
      }
    });
  }
  report("check-2 relative-urls", errs);
}

// ---------- check 3: Vice palette lockdown (data.js excluded: it's data) ----------
{
  const errs = [];
  const hexRe = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;
  for (const file of siteTextFiles([".html", ".htm", ".css", ".js", ".mjs"]).filter((f) => !f.endsWith("data.js"))) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(hexRe)) {
        if (!PALETTE.has(m[0].toLowerCase())) {
          errs.push(`${file}:${i + 1} off-palette color ${m[0]}`);
        }
      }
    });
  }
  report("check-3 palette", errs);
}

// ---------- check 4: data fidelity (site/data.js deep-equals data/) ----------
{
  const errs = [];
  const p = join(SITE_DIR, "data.js");
  if (!existsSync(p)) {
    errs.push(`${p} missing — run scripts/build/inline-data.mjs`);
  } else {
    try {
      const sandbox = { window: {} };
      vm.runInNewContext(readFileSync(p, "utf8"), sandbox);
      const shipped = JSON.parse(JSON.stringify(sandbox.window.XM_DATA ?? null));
      const expected = collect();
      for (const k of Object.keys(expected)) {
        if (!isDeepStrictEqual(shipped?.[k], expected[k])) errs.push(`data.js "${k}" differs from data/ — rebuild`);
      }
    } catch (e) {
      errs.push(`cannot evaluate ${p}: ${e.message}`);
    }
  }
  report("check-4 data-fidelity", errs);
}

// ---------- check 5: all data points render (field names appear in site JS) ----------
{
  const errs = [];
  // .html covers inline scripts; data.js excluded (it contains every field name trivially)
  const jsFiles = siteTextFiles([".js", ".mjs", ".html", ".htm"]).filter((f) => !f.endsWith("data.js"));
  const blob = jsFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  if (jsFiles.length === 0) {
    errs.push("no JS/HTML files found in site/");
  } else {
    for (const field of METRIC_FIELDS) {
      if (!blob.includes(field)) errs.push(`field "${field}" not referenced in site JS`);
    }
  }
  report("check-5 fields-render", errs);
}

// ---------- check 6: diff scope (only site/ and data/ may change) ----------
{
  const errs = [];
  function gitLines(args) {
    const res = spawnSync("git", args, { encoding: "utf8" });
    if (res.status !== 0) {
      errs.push(`git ${args.join(" ")} failed: ${(res.stderr ?? "").trim()}`);
      return [];
    }
    return res.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  const changed = [...gitLines(["diff", "--name-only", "HEAD"]),
                   ...gitLines(["ls-files", "--others", "--exclude-standard"])];
  for (const f of changed) {
    if (!f.startsWith("site/") && !f.startsWith("data/")) {
      errs.push(`out-of-scope change: ${f}`);
    }
  }
  report("check-6 diff-scope", errs);
}

// ---------- check 7: site/index.html exists and is non-empty ----------
{
  const errs = [];
  const p = join(SITE_DIR, "index.html");
  if (!existsSync(p)) errs.push(`${p} does not exist`);
  else if (statSync(p).size === 0) errs.push(`${p} is empty`);
  report("check-7 index-html", errs);
}

// ---------- check 8: minified JS shipped and wired up on every page ----------
{
  const errs = [];
  const src = join(SITE_DIR, "app.js");
  const min = join(SITE_DIR, "app.min.js");
  if (!existsSync(min)) {
    errs.push(`${min} does not exist — run scripts/build/minify.mjs`);
  } else if (statSync(min).size === 0) {
    errs.push(`${min} is empty`);
  } else if (existsSync(src) && statSync(min).size >= statSync(src).size) {
    errs.push(`${min} is not smaller than ${src} — minify likely did not run`);
  } else if (existsSync(src) && statSync(min).mtimeMs + 1000 < statSync(src).mtimeMs) {
    errs.push(`${min} is older than ${src} — stale, re-run minify`);
  }
  for (const html of siteTextFiles([".html"])) {
    const page = readFileSync(html, "utf8");
    if (!page.includes("app.min.js")) errs.push(`${html} does not reference app.min.js`);
    if (/<script[^>]+src=["']\.?\/?app\.js["']/.test(page)) errs.push(`${html} still loads unminified app.js`);
    if (!page.includes("data.js")) errs.push(`${html} does not load data.js`);
  }
  report("check-8 minified-js", errs);
}

process.exit(results.every(Boolean) ? 0 : 2);

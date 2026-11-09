/* X Millas 2027 dashboard — source of truth for site behaviour.
   Pages load data.js (window.XM_DATA, generated) → nav.js → app.min.js
   (generated from this file by scripts/build/minify.mjs). One script for all
   pages; <body data-page> picks the renderer. Colours come from CSS tokens
   so the palette lives in one place (styles.css :root, Gate C check-3). */
(function () {
  "use strict";

  var D = window.XM_DATA;
  if (!D) return;
  var plan = D.plan;
  var weeks = plan.weeks;
  var page = document.body.getAttribute("data-page");
  var MI = 1609.344;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function units() { return window.XM_UNITS === "km" ? "km" : "mi"; }
  function dist(m, dp) {
    var v = units() === "mi" ? m / MI : m / 1000;
    return v.toFixed(dp == null ? 1 : dp);
  }
  function distU(m, dp) { return dist(m, dp) + " " + units(); }
  function dur(s) {
    s = Math.round(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? h + "h" + String(m).padStart(2, "0") : m + "m";
  }
  function clock(s) {
    s = Math.round(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
  }
  function pace(sPerKm) { // per mile or per km
    var s = units() === "mi" ? sPerKm * MI / 1000 : sPerKm;
    return clock(s) + "/" + units();
  }
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Today's date in Europe/London as YYYY-MM-DD (pipeline invariant 4).
  function todayLondon() {
    var p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    var o = {};
    p.forEach(function (x) { o[x.type] = x.value; });
    return o.year + "-" + o.month + "-" + o.day;
  }
  function addDays(ymd, n) {
    var d = new Date(ymd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function fmtDate(ymd) {
    return new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
  }
  var today = todayLondon();
  var current = null;
  weeks.forEach(function (w) { if (today >= w.start && today <= addDays(w.start, 6)) current = w; });
  function summaryOf(w) { return D.summaries[w.iso_week] || null; }
  function ceilingM(w) { return Math.round(w.dist_target_km * 1000); }

  /* ---------- countdown + footer (all pages) ---------- */
  (function () {
    var el = $("countdown");
    if (el) {
      var days = Math.round((Date.parse(plan.race.date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
      el.textContent = days > 0 ? days + " days" : days === 0 ? "RACE DAY" : "DONE";
    }
    var f = $("footer");
    if (f) {
      var last = D.index.weeks[D.index.weeks.length - 1];
      var gen = last && D.summaries[last] ? D.summaries[last].generated_at.slice(0, 16).replace("T", " ") + " UTC" : "no data yet";
      f.textContent = "X Millas 2027 · data refreshed " + gen + " · targets are ceilings";
    }
  })();

  /* ---------- canvas plumbing ---------- */
  function setupCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.getAttribute("height") * 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = "12px system-ui, sans-serif";
    return { ctx: ctx, w: w, h: h };
  }
  var tip = $("tooltip");
  function hoverTip(canvas, hitFn) {
    if (!tip) return;
    canvas.onmousemove = function (e) {
      var r = canvas.getBoundingClientRect();
      var html = hitFn(e.clientX - r.left, e.clientY - r.top);
      if (!html) { tip.classList.add("hidden"); return; }
      tip.innerHTML = html;
      tip.classList.remove("hidden");
      tip.style.left = Math.min(window.innerWidth - 270, e.clientX + 12) + "px";
      tip.style.top = (e.clientY + 12) + "px";
    };
    canvas.onmouseleave = function () { tip.classList.add("hidden"); };
  }

  /* ================= DASHBOARD ================= */
  function renderDashboard() {
    var w = current;
    var preBlock = !w && today < weeks[0].start;
    var s = w ? summaryOf(w) : null;

    // hero
    var badge = $("hero-badge");
    if (w) {
      badge.textContent = "W" + (s ? s.training_week : w.week) + " · " + (s ? s.phase : w.phase) + (w.notes ? " · " + w.notes : "");
      badge.className = "badge" + (w.notes === "recovery" ? " recovery" : "");
    } else {
      badge.textContent = preBlock ? "Pre-block · starts " + fmtDate(weeks[0].start) : "Block complete";
      badge.className = "badge";
    }
    var focusW = w || (preBlock ? weeks[0] : null);
    $("hero-focus").innerHTML = focusW
      ? "<strong>" + (w ? "Focus: " : "W1 focus: ") + "</strong>" + esc(focusW.focus) +
        "<ul>" + focusW.key.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("") + "</ul>"
      : "";

    var actual = s ? s.distance.actual_m : 0;
    var full = w ? ceilingM(w) : 0;
    var pro = s ? s.distance.prorated_target_m : 0;
    $("hero-actual").textContent = dist(actual);
    $("hero-unit").textContent = units();
    $("hero-ceiling").textContent = w ? distU(pro) + " ceiling to date" : preBlock ? distU(ceilingM(weeks[0])) + " W1 ceiling" : "";
    var pctEl = $("hero-pct");
    if (s) {
      var over = s.distance.pct_of_prorated > 110;
      pctEl.textContent = s.distance.pct_of_prorated + "% of ceiling to date · " + s.distance.pct_of_target + "% of the week";
      pctEl.className = "pct " + (over ? "over" : "ok");
    } else {
      pctEl.textContent = w ? "No runs synced this week yet." : preBlock ? "Recovering from the 102K. Block starts Mon " + fmtDate(weeks[0].start) + "." : "";
      pctEl.className = "pct";
    }
    var scale = Math.max(full, actual) * 1.05 || 1;
    $("hero-fill").style.width = (100 * actual / scale) + "%";
    $("hero-mark").style.left = (100 * full / scale) + "%";
    $("hero-mark").style.display = full ? "" : "none";

    $("stat-tof").textContent = s ? dur(s.time_on_feet.actual_s) : "-";
    $("stat-long").textContent = s ? distU(s.distance.long_run_m) : "-";
    $("stat-sessions").textContent = s ? s.sessions.on_foot_count + (s.sessions.count > s.sessions.on_foot_count ? " (+" + (s.sessions.count - s.sessions.on_foot_count) + ")" : "") : "-";
    $("stat-vert").textContent = s ? Math.round(s.vert.actual_m) + " m" : "-";
    $("stat-day").textContent = s ? s.days_elapsed + "/7" : "-";
    $("stat-ceiling").textContent = w ? distU(full) : "-";

    drawSeason();
    drawDaily(s);
    renderFlags(s);
    renderClimbWatch();
  }

  function drawSeason() {
    var c = $("season-chart");
    var g = setupCanvas(c), ctx = g.ctx;
    var padL = 38, padR = 8, padT = 10, padB = 26;
    var W = g.w - padL - padR, H = g.h - padT - padB;
    var max = 0;
    weeks.forEach(function (w) {
      var s = summaryOf(w);
      max = Math.max(max, ceilingM(w), s ? s.distance.actual_m : 0);
    });
    max = max * 1.1;
    var y = function (m) { return padT + H - (m / max) * H; };
    var bw = W / weeks.length;

    // grid
    ctx.strokeStyle = css("--violet"); ctx.fillStyle = css("--mist"); ctx.lineWidth = 1;
    var step = units() === "mi" ? 5 * MI : 10000;
    for (var m = 0; m <= max; m += step) {
      ctx.beginPath(); ctx.moveTo(padL, y(m)); ctx.lineTo(padL + W, y(m)); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(dist(m, 0), padL - 6, y(m) + 4);
    }
    weeks.forEach(function (w, i) {
      var x = padL + i * bw;
      if (w.notes === "recovery") { ctx.fillStyle = css("--teal"); ctx.fillRect(x + 2, padT + H + 3, bw - 4, 3); }
      if (current && current.week === w.week) { ctx.fillStyle = css("--violet"); ctx.fillRect(x, padT, bw, H); }
      var s = summaryOf(w);
      if (s) {
        var over = s.distance.actual_m > ceilingM(w) * 1.1;
        ctx.fillStyle = over ? css("--orange") : css("--pink");
        ctx.fillRect(x + bw * 0.18, y(s.distance.actual_m), bw * 0.64, padT + H - y(s.distance.actual_m));
      }
      ctx.fillStyle = css("--mist"); ctx.textAlign = "center";
      if (bw > 22 || i % 2 === 0) ctx.fillText(String(w.week), x + bw / 2, padT + H + 18);
    });
    // ceiling step line
    ctx.strokeStyle = css("--gold"); ctx.lineWidth = 2; ctx.beginPath();
    weeks.forEach(function (w, i) {
      var x = padL + i * bw, yy = y(ceilingM(w));
      if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      ctx.lineTo(x + bw, yy);
    });
    ctx.stroke();

    hoverTip(c, function (mx) {
      var i = Math.floor((mx - padL) / bw);
      if (i < 0 || i >= weeks.length) return null;
      var w = weeks[i], s = summaryOf(w);
      return "<strong>W" + w.week + "</strong> · " + fmtDate(w.start) + " · " + esc(w.phase) +
        "<br>Ceiling " + distU(ceilingM(w)) +
        (s ? "<br>Ran " + distU(s.distance.actual_m) + " (" + s.distance.pct_of_target + "%) · " + dur(s.time_on_feet.actual_s) : "");
    });
  }

  function drawDaily(s) {
    var c = $("daily-chart");
    var g = setupCanvas(c), ctx = g.ctx;
    var padL = 34, padB = 22, padT = 8, W = g.w - padL - 6, H = g.h - padT - padB;
    var days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var daily = s ? s.daily : [];
    var max = Math.max(units() === "mi" ? 5 * MI : 8000, Math.max.apply(null, daily.map(function (d) { return d.distance_m; }).concat([0])) * 1.15);
    var bw = W / 7;
    ctx.fillStyle = css("--mist"); ctx.textAlign = "right";
    ctx.fillText(dist(max, 0), padL - 6, padT + 10);
    ctx.fillText("0", padL - 6, padT + H);
    days.forEach(function (d, i) {
      var x = padL + i * bw, v = daily[i] ? daily[i].distance_m : 0, hh = (v / max) * H;
      ctx.fillStyle = css("--pink");
      ctx.fillRect(x + bw * 0.2, padT + H - hh, bw * 0.6, hh);
      ctx.fillStyle = css("--mist"); ctx.textAlign = "center";
      ctx.fillText(d, x + bw / 2, padT + H + 16);
    });
    hoverTip(c, function (mx) {
      var i = Math.floor((mx - padL) / bw);
      if (!daily[i]) return null;
      var d = daily[i];
      return "<strong>" + days[i] + " " + fmtDate(d.date) + "</strong><br>" + distU(d.distance_m) + " · " + dur(d.time_s) + " · " + Math.round(d.vert_m) + " m vert";
    });
  }

  function renderFlags(s) {
    var el = $("flags");
    var flags = s ? s.flags : [];
    el.innerHTML = flags.length
      ? '<ul class="flags">' + flags.map(function (f) {
          return '<li class="' + esc(f.type) + '"><span class="type">' + esc(f.type.replace("_", " ")) + "</span>" + esc(f.detail) + "</li>";
        }).join("") + "</ul>"
      : '<p class="muted">No flags this week. Watching: calf (precaution), body-part mentions, over-ceiling weeks.</p>';
  }

  function renderClimbWatch() {
    var eds = D.editions.editions;
    var last = eds[eds.length - 1], pb = eds.filter(function (e) { return e.is_pb; })[0];
    $("climb-watch").innerHTML =
      "<p><strong>Baseline (" + last.year + "):</strong> late-climb fade " + last.late_climb_fade.toFixed(3) +
      " — the finish drag cost " + Math.round((last.late_climb_fade - 1) * 100) + "% more GAP than the mid-race climb. PB year (" + pb.year + "): " + pb.late_climb_fade.toFixed(3) + ".</p>" +
      "<p><strong>Benchmark climb:</strong> " + (plan.benchmark_climb.name ? esc(plan.benchmark_climb.name) : "not set yet") +
      ". Retests in recovery weeks (W4, W8, W12, W16).</p>" +
      '<p class="small muted">Training GAP-on-climbs and zone split need per-activity streams — next pipeline step.</p>';
  }

  /* ================= PLAN ================= */
  function renderPlan() {
    var b = plan.benchmark_climb;
    $("benchmark").textContent = b.name ? b.name : "climb TBD (" + b.note + ")";
    $("races").innerHTML = plan.races.length
      ? "<ul>" + plan.races.map(function (r) { return "<li>" + esc(r.date) + " — " + esc(r.name) + "</li>"; }).join("") + "</ul>"
      : '<p class="muted">Trail race dates to be added. They replace that week\'s long run, not add to it.</p>';
    $("th-ceiling").textContent = "Ceiling " + units();
    $("th-actual").textContent = "Actual " + units();

    var rows = weeks.map(function (w) {
      var s = summaryOf(w), r = D.reports[w.iso_week];
      var cls = [];
      if (current && current.week === w.week) cls.push("current");
      if (w.notes === "recovery") cls.push("recovery");
      var act = "";
      if (s) {
        var over = s.distance.actual_m > ceilingM(w) * 1.1;
        act = '<span class="' + (over ? "warn" : "good") + '">' + dist(s.distance.actual_m) + "</span>";
      }
      var debrief = r
        ? '<details class="debrief"><summary>Debrief: ' + esc(r.headline) + "</summary>" +
          r.narrative.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</details>"
        : "";
      return '<tr class="' + cls.join(" ") + '">' +
        "<td>W" + w.week + "</td>" +
        "<td>" + fmtDate(w.start) + "</td>" +
        "<td>" + esc(w.phase) + (w.notes ? '<br><span class="small good">' + esc(w.notes) + "</span>" : "") + "</td>" +
        '<td class="num">' + dist(ceilingM(w)) + "</td>" +
        '<td class="num">' + act + "</td>" +
        "<td>" + esc(w.focus) + "<ul>" + w.key.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("") + "</ul>" + debrief + "</td>" +
        "</tr>";
    });
    document.querySelector("#plan-table tbody").innerHTML = rows.join("");
    // dist_target_km is the plan field the ceiling column renders
  }

  /* ================= COURSE ================= */
  function renderCourse() {
    var C = D.course, E = D.editions, eds = E.editions;
    var secById = {};
    C.sections.forEach(function (s) { secById[s.id] = s; });
    $("course-sub").textContent = distU(C.length_m, 2).toUpperCase() + " · +" + C.gain_m + " M · SAME ROUTE EVERY YEAR";

    drawProfile(C);

    document.querySelector("#section-table tbody").innerHTML = C.sections.map(function (s) {
      var cls = s.kind === "climb" ? "bad" : s.kind === "descent" ? "good" : "";
      return "<tr><td class=\"" + cls + "\">" + esc(s.name) + "</td>" +
        '<td class="num">' + dist(s.from, 2) + "</td>" +
        '<td class="num">' + dist(s.length_m, 2) + "</td>" +
        '<td class="num">+' + s.gain_m + " m</td>" +
        '<td class="num">' + s.avg_grade_pct + "%</td></tr>";
    }).join("");

    document.querySelector("#editions-table tbody").innerHTML = eds.map(function (e) {
      var t = e.chip_s ? clock(e.chip_s) + " chip" : clock(e.elapsed_s);
      var fadeCls = function (v) { return v > 1.03 ? "warn" : v <= 1.0 ? "good" : ""; };
      return "<tr><td" + (e.is_pb ? ' class="pb"' : "") + ">" + e.year + (e.is_pb ? " PB" : "") + "</td>" +
        '<td class="num">' + t + "</td>" +
        '<td class="num ' + fadeCls(e.climb_fade) + '">' + e.climb_fade.toFixed(3) + "</td>" +
        '<td class="num ' + fadeCls(e.late_climb_fade) + '">' + e.late_climb_fade.toFixed(3) + "</td>" +
        "<td>" + esc(e.note) + "</td></tr>";
    }).join("");

    var ids = C.sections.map(function (s) { return s.id; });
    document.querySelector("#loss-table thead").innerHTML = "<tr><th scope=\"col\">Year</th>" +
      ids.map(function (id) { return '<th scope="col" class="num">' + esc(secById[id].name) + "</th>"; }).join("") +
      '<th scope="col" class="num">Climb tax</th></tr>';
    document.querySelector("#loss-table tbody").innerHTML = eds.map(function (e) {
      var tax = 0;
      var cells = e.sections.map(function (s) {
        if (typeof s.climb_tax_s === "number") tax += s.climb_tax_s;
        var cls = s.vs_pb_s > 60 ? "bad" : s.vs_pb_s > 20 ? "warn" : s.vs_pb_s <= 0 ? "good" : "";
        return '<td class="num ' + cls + '" title="' + esc(secById[s.id].name) + ": " + clock(s.time_s) + " · GAP " + pace(s.gap_s_per_km) + (s.avg_hr ? " · " + s.avg_hr + " bpm" : "") + '">' +
          (e.is_pb ? clock(s.time_s) : signed(s.vs_pb_s)) + "</td>";
      }).join("");
      return "<tr><td" + (e.is_pb ? ' class="pb"' : "") + ">" + e.year + "</td>" + cells + '<td class="num">' + signed(tax) + "s</td></tr>";
    }).join("");

    var last = eds[eds.length - 1], pb = eds.filter(function (e) { return e.is_pb; })[0];
    var worst = last.sections.slice().sort(function (a, b) { return b.vs_pb_s - a.vs_pb_s; }).slice(0, 2);
    $("findings").innerHTML =
      "<p><strong>Climbs aren't where races go wrong — relative to grade.</strong> Climb fade is &lt;1.00 every year: uphill GAP is as good or better than on rolling ground.</p>" +
      "<p><strong>The fade is late.</strong> The finish drag costs " + eds.filter(function (e) { return !e.is_pb; }).map(function (e) { return Math.round((e.late_climb_fade - 1) * 1000) / 10 + "%"; }).join(" / ") +
      " more GAP than the mid-race climb in non-PB years; the PB (" + pb.year + ") held it level (" + pb.late_climb_fade.toFixed(3) + "). Climbing strength on tired legs is the target.</p>" +
      "<p><strong>" + last.year + " vs PB:</strong> biggest losses on " + worst.map(function (s) { return esc(secById[s.id].name) + " (" + signed(s.vs_pb_s) + "s)"; }).join(" and ") +
      ". Descents matter too: relaxed, quick downhill running is free time.</p>";

    var pm = D.paceModel;
    document.querySelector("#curve-table tbody").innerHTML = pm.curve.map(function (p) {
      return '<tr><td class="num">' + (p.g > 0 ? "+" : "") + p.g + '%</td><td class="num">' + pace(1000 / p.v) + '</td><td class="num">' + p.n + "</td></tr>";
    }).join("");
    $("curve-note").textContent = "Fitted from " + pm.source.dates.join(", ") + " editions (continuous runs; run/walk years excluded), " + pm.source.chunks + " × 100 m chunks.";
    // gap_s_per_km, climb_tax_s, vs_pb_s, climb_fade, late_climb_fade rendered above
  }

  function drawProfile(C) {
    var c = $("profile-chart");
    var g = setupCanvas(c), ctx = g.ctx;
    var padL = 36, padR = 8, padT = 10, padB = 24, W = g.w - padL - padR, H = g.h - padT - padB;
    var P = C.profile, L = C.length_m;
    var maxA = 0;
    P.forEach(function (p) { maxA = Math.max(maxA, p.alt); });
    maxA = Math.ceil((maxA + 10) / 20) * 20;
    var x = function (d) { return padL + (d / L) * W; };
    var y = function (a) { return padT + H - (a / maxA) * H; };
    var col = { climb: css("--pink"), descent: css("--sky"), rolling: css("--violet") };

    ctx.strokeStyle = css("--violet"); ctx.fillStyle = css("--mist"); ctx.lineWidth = 1;
    for (var a = 0; a <= maxA; a += 20) {
      ctx.beginPath(); ctx.moveTo(padL, y(a)); ctx.lineTo(padL + W, y(a)); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(a + "", padL - 6, y(a) + 4);
    }
    C.sections.forEach(function (s) {
      ctx.fillStyle = col[s.kind];
      ctx.beginPath(); ctx.moveTo(x(s.from), y(0));
      P.forEach(function (p) { if (p.d >= s.from && p.d <= s.to) ctx.lineTo(x(p.d), y(p.alt)); });
      ctx.lineTo(x(s.to), y(0)); ctx.closePath(); ctx.fill();
    });
    ctx.strokeStyle = css("--cream"); ctx.lineWidth = 2; ctx.beginPath();
    P.forEach(function (p, i) { if (i === 0) ctx.moveTo(x(p.d), y(p.alt)); else ctx.lineTo(x(p.d), y(p.alt)); });
    ctx.stroke();
    // distance axis: miles or km
    var step = units() === "mi" ? MI : 2000;
    ctx.fillStyle = css("--mist"); ctx.textAlign = "center";
    for (var d = 0; d <= L; d += step) ctx.fillText(dist(d, 0), x(d), padT + H + 16);

    hoverTip(c, function (mx) {
      var d = ((mx - padL) / W) * L;
      if (d < 0 || d > L) return null;
      var s = C.sections.filter(function (s) { return d >= s.from && d <= s.to; })[0];
      var p = P[Math.min(P.length - 1, Math.round(d / C.step_m))];
      return "<strong>" + (s ? esc(s.name) : "") + "</strong><br>" + distU(d, 2) + " · " + Math.round(p.alt) + " m" +
        (s ? "<br>+" + s.gain_m + " m over " + distU(s.length_m, 2) + " (" + s.avg_grade_pct + "%)" : "");
    });
  }

  /* ---------- boot + re-render on unit change / resize ---------- */
  function render() {
    if (page === "dashboard") renderDashboard();
    else if (page === "plan") renderPlan();
    else if (page === "course") renderCourse();
  }
  render();
  document.addEventListener("xm-units", render);
  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(render, 150); });
})();

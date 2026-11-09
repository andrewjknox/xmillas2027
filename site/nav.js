/* X Millas shared nav — renders links into <nav class="site-nav"> on every
   page and owns the mi/km unit toggle (localStorage "xm-units", default mi:
   the owner's Strava preference is imperial). Pages re-render on the
   "xm-units" event. */
(function () {
  "use strict";

  var PAGES = [
    ["index.html", "Dashboard"],
    ["plan.html", "Plan"],
    ["course.html", "Course"]
  ];

  function getUnits() {
    try { return localStorage.getItem("xm-units") === "km" ? "km" : "mi"; } catch (e) { return "mi"; }
  }
  function setUnits(u) {
    try { localStorage.setItem("xm-units", u); } catch (e) { /* private mode: session only */ }
    window.XM_UNITS = u;
    document.dispatchEvent(new CustomEvent("xm-units", { detail: u }));
  }
  window.XM_UNITS = getUnits();

  var nav = document.querySelector("nav.site-nav");
  if (!nav) return;
  var here = location.pathname.split("/").pop() || "index.html";
  var html = ['<div class="nav-links">'];
  for (var i = 0; i < PAGES.length; i++) {
    html.push('<a href="' + PAGES[i][0] + '"' + (PAGES[i][0] === here ? ' aria-current="page"' : "") + ">" + PAGES[i][1] + "</a>");
  }
  html.push('<button id="unit-toggle" class="unit-toggle" type="button" aria-label="Switch miles / kilometres"></button></div>');
  nav.innerHTML = html.join("");

  var btn = document.getElementById("unit-toggle");
  function label() {
    btn.textContent = window.XM_UNITS === "mi" ? "UNITS: MI" : "UNITS: KM";
    btn.setAttribute("aria-pressed", window.XM_UNITS === "km" ? "true" : "false");
  }
  label();
  btn.addEventListener("click", function () {
    setUnits(window.XM_UNITS === "mi" ? "km" : "mi");
    label();
  });
})();

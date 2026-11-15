/*!
 * Lunario loader: types "Prepare for landing" over the polar grid, then lifts away.
 * Vanilla JS, no dependencies. Include in <head> (not deferred) after loader.css.
 *
 * Options (data attributes on the <script> tag):
 *   data-min-duration="1800"   minimum time on screen, in ms (default 1800)
 *   data-auto-hide="true"      hide automatically after window load + min duration;
 *                              set "false" and call Lunario.loader.hide() yourself
 *   data-text="Prepare for landing"
 *   data-once="session"        play only once per browser tab session (sessionStorage)
 *   data-altitude="15000"      starting altitude for the telemetry line (metres); "0" hides the line
 */
(function () {
  "use strict";
  var script = document.currentScript || {};
  var ds = script.dataset || {};
  var cfg = {
    min: parseInt(ds.minDuration || "1800", 10),
    auto: ds.autoHide !== "false",
    text: ds.text || "Prepare for landing",
    alt: parseInt(ds.altitude == null ? "15000" : ds.altitude, 10)
  };
  // play once per session: later visits in the same tab go straight to the page
  var KEY = "lunario-loader-seen";
  if (ds.once === "session") {
    var seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; sessionStorage.setItem(KEY, "1"); } catch (e) {}
    if (seen) {
      var done = Promise.resolve();
      window.Lunario = window.Lunario || {};
      window.Lunario.loader = { hide: function () { return done; }, show: function () { return done; }, ready: done, skipped: true };
      return;
    }
  }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) cfg.min = Math.min(cfg.min, 700);

  var NS = "http://www.w3.org/2000/svg";
  var INK = "#0B0D12", REG = "#D5D7DB", AMBER = "#F5A524", GRID = "#1A1E26";
  var root = document.documentElement;
  root.classList.add("lunario-loading");

  function arc(cx, cy, r, a0, a1) {
    var p = function (a) { a = a * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    var s = p(a0), e = p(a1), large = ((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0;
    return "M" + s[0].toFixed(2) + " " + s[1].toFixed(2) + "A" + r + " " + r + " 0 " + large + " 1 " + e[0].toFixed(2) + " " + e[1].toFixed(2);
  }
  function gridSVG() {
    var s = '<svg class="lunario-loader__grid" xmlns="' + NS + '" viewBox="-1000 -1000 2000 2000" aria-hidden="true"><g fill="none" stroke="' + GRID + '" stroke-width="1" vector-effect="non-scaling-stroke">';
    for (var r = 110; r < 1450; r += 110) s += '<circle r="' + r + '" vector-effect="non-scaling-stroke"/>';
    for (var a = 0; a < 360; a += 10) {
      var t = a * Math.PI / 180, r0 = 110;
      s += '<line x1="' + (r0 * Math.cos(t)).toFixed(1) + '" y1="' + (r0 * Math.sin(t)).toFixed(1) + '" x2="' + (1450 * Math.cos(t)).toFixed(1) + '" y2="' + (1450 * Math.sin(t)).toFixed(1) + '" vector-effect="non-scaling-stroke"/>';
    }
    return s + "</g></svg>";
  }
  var RIDGE = '<path d="M-20 105L79 135L134 149L207 127L332 136L447 139L547 152L646 210L738 208L840 189L949 177L1025 134L1141 135L1247 148L1352 134L1435 139L1521 123L1638 85L1702 106L1825 140L1924 167L1960 310L-20 310Z" fill="#10131A"/><path d="M134 149L207 127M646 210L738 208M738 208L840 189M840 189L949 177M949 177L1025 134M1247 148L1352 134M1435 139L1521 123M1521 123L1638 85" fill="none" stroke="#262B34" stroke-width="1.5" vector-effect="non-scaling-stroke"/><path d="M-20 230L50 238L103 245L180 266L227 264L274 262L355 234L452 255L531 260L582 249L653 248L706 257L750 262L816 252L887 218L957 202L1025 196L1123 196L1212 199L1272 214L1330 227L1415 224L1504 222L1600 238L1642 229L1735 232L1832 265L1878 280L1960 310L-20 310Z" fill="#0D0F15"/><path d="M180 266L227 264M227 264L274 262M274 262L355 234M531 260L582 249M582 249L653 248M750 262L816 252M816 252L887 218M887 218L957 202M957 202L1025 196M1025 196L1123 196M1330 227L1415 224M1415 224L1504 222M1600 238L1642 229" fill="none" stroke="#2F3540" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
  function markSVG() {
    return '<svg class="lunario-loader__mark" xmlns="' + NS + '" viewBox="0 0 64 64" aria-hidden="true">' +
      '<g class="lunario-loader__ring" fill="none" stroke-width="4.5">' +
      '<path stroke="' + REG + '" d="' + arc(32, 32, 27, -40, 205) + '"/>' +
      '<path stroke="' + AMBER + '" d="' + arc(32, 32, 27, 222, 302) + '"/></g>' +
      '<circle cx="32" cy="32" r="15" fill="none" stroke="' + REG + '" stroke-width="4.5"/>' +
      '<circle cx="32" cy="32" r="5" fill="' + REG + '"/></svg>';
  }

  var el, ring, typed, cursor, tele, content, t0, raf, loaded = false, minDone = false,
      hideRequested = false, leaveAt = 0, landAt = 0, readyResolve;
  var ready = new Promise(function (res) { readyResolve = res; });
  var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

  // typing schedule: start after 380ms, ~68ms per character, a short beat on spaces
  var schedule = [], acc = 250;
  for (var i = 0; i < cfg.text.length; i++) { acc += cfg.text[i] === " " ? 70 : 45; schedule.push(acc); }
  var typeEnd = acc;

  function build() {
    el = document.createElement("div");
    el.className = "lunario-loader";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-label", cfg.text);
    el.innerHTML = gridSVG() +
      '<svg class="lunario-loader__ridge" xmlns="' + NS + '" viewBox="0 0 1920 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' + RIDGE + "</svg>" +
      '<div class="lunario-loader__content" aria-hidden="true">' + markSVG() +
      '<div class="lunario-loader__rule"></div>' +
      '<div class="lunario-loader__text"><span class="lunario-loader__ghost"></span><span class="lunario-loader__typed"><span class="lunario-loader__chars"></span><span class="lunario-loader__cursor"></span></span></div>' +
      (cfg.alt > 0 && !reduce ? '<div class="lunario-loader__telemetry"></div>' : "") + "</div>";
    el.querySelector(".lunario-loader__ghost").textContent = cfg.text + "\u00a0";
    ring = el.querySelector(".lunario-loader__ring");
    typed = el.querySelector(".lunario-loader__chars");
    cursor = el.querySelector(".lunario-loader__cursor");
    tele = el.querySelector(".lunario-loader__telemetry");
    content = el.querySelector(".lunario-loader__content");
    document.body.appendChild(el);
    root.classList.remove("lunario-loading"); // the loader itself now covers the page
    root.classList.add("lunario-loader-active");
    if (document.body) document.body.style.overflow = "hidden";
    t0 = now();
    if (reduce) typed.textContent = cfg.text;
    raf = requestAnimationFrame(frame);
  }

  function pad(n) { var s = String(Math.max(0, Math.round(n))); while (s.length < 5) s = "0" + s; return s; }
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };

  function frame() {
    var t = now() - t0;
    // ring sweep: slow, constant, mechanical
    if (!reduce) ring.setAttribute("transform", "rotate(" + ((t * 0.045) % 360).toFixed(2) + " 32 32)");
    // typing
    if (!reduce) {
      var n = 0; while (n < schedule.length && t >= schedule[n]) n++;
      if (typed.textContent.length !== n) typed.textContent = cfg.text.slice(0, n);
    }
    var typing = !reduce && t < typeEnd;
    cursor.style.opacity = typing || reduce ? 1 : (Math.floor((t - typeEnd) / 530) % 2 === 0 ? 0 : 1);
    // altitude: decelerating descent; holds just above zero until the page is ready
    if (tele) {
      var p = Math.min(1, t / cfg.min), alt;
      if (!landAt) alt = cfg.alt * Math.pow(1 - Math.min(p, 0.985), 2.2);
      else { var q = Math.min(1, (now() - landAt) / 300); alt = landAt_alt * (1 - q); }
      tele.textContent = "ALT " + pad(alt) + " M";
    }
    // leave
    if (leaveAt) {
      var d = Math.min(1, (now() - leaveAt) / (reduce ? 300 : 520)), e = easeOut(d);
      el.style.opacity = String(1 - e);
      if (!reduce) content.style.transform = "translate(-50%, calc(-50% - " + (18 * e).toFixed(2) + "px))";
      if (d >= 1) return finish();
    }
    raf = requestAnimationFrame(frame);
  }
  var landAt_alt = 0;
  function maybeLeave() {
    if (leaveAt || landAt || !el) return;
    if (!(minDone && (hideRequested || (cfg.auto && loaded)))) return;
    var wait = Math.max(0, typeEnd + 150 - (now() - t0)); // never cut the typing short
    setTimeout(function () {
      if (tele) {
        var p = Math.min(1, (now() - t0) / cfg.min);
        landAt_alt = cfg.alt * Math.pow(1 - Math.min(p, 0.985), 2.2);
        landAt = now();
        setTimeout(function () { leaveAt = now(); }, 300 + 120);
      } else leaveAt = now();
    }, reduce ? 0 : wait);
  }
  function finish() {
    cancelAnimationFrame(raf);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null; leaveAt = landAt = 0;
    root.classList.remove("lunario-loader-active");
    if (document.body) document.body.style.overflow = "";
    readyResolve();
    window.dispatchEvent(new CustomEvent("lunario:loaded"));
  }

  function start() {
    minDone = false; hideRequested = false;
    build();
    setTimeout(function () { minDone = true; maybeLeave(); }, cfg.min);
  }

  window.Lunario = window.Lunario || {};
  window.Lunario.loader = {
    hide: function () { hideRequested = true; maybeLeave(); return ready; },
    show: function () { // replay (demo / route changes)
      if (el) return ready;
      ready = new Promise(function (res) { readyResolve = res; });
      window.Lunario.loader.ready = ready;
      start(); return ready;
    },
    ready: ready
  };

  window.addEventListener("load", function () { loaded = true; maybeLeave(); });
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();

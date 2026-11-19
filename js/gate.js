/* Simple client-side playtest gate. This is not real server auth. */
(function (G) {
  "use strict";
  var HASH = "6fdb4d16f465e0a7c0bb97b75dbbf7d4c2e700234e451fb6ac6c8ee5fe51fcbb";
  var KEY = "cmy-gate-v1";
  var unlocked = false;
  var waiters = [];

  function hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function digest(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(hex);
  }

  function showApp() {
    unlocked = true;
    var gate = document.getElementById("cmy-gate");
    var app = document.getElementById("cmy-app");
    if (gate) gate.hidden = true;
    if (app) app.removeAttribute("hidden");
    waiters.splice(0).forEach(function (fn) { fn(); });
  }

  function fail(msg) {
    var el = document.getElementById("cmy-gate-err");
    if (el) el.textContent = msg || "密碼不正確。";
  }

  function submit(ev) {
    if (ev) ev.preventDefault();
    var input = document.getElementById("cmy-gate-pw");
    var pw = input ? String(input.value || "") : "";
    if (!pw) { fail("請輸入密碼。"); return; }
    digest(pw).then(function (h) {
      if (h === HASH) {
        try { sessionStorage.setItem(KEY, HASH); } catch (e) {}
        showApp();
      } else {
        fail("密碼不正確。");
        if (input) { input.value = ""; input.focus(); }
      }
    }).catch(function () {
      fail("這部瀏覽器無法核對密碼，請改用較新的 Safari 或 Chrome。");
    });
  }

  function whenUnlocked(fn) {
    if (unlocked) fn();
    else waiters.push(fn);
  }

  function init() {
    var form = document.getElementById("cmy-gate-form");
    if (form) form.addEventListener("submit", submit);
    var remembered = "";
    try { remembered = sessionStorage.getItem(KEY) || ""; } catch (e) {}
    if (remembered === HASH) showApp();
    else {
      var app = document.getElementById("cmy-app");
      if (app) app.setAttribute("hidden", "");
      var input = document.getElementById("cmy-gate-pw");
      if (input) input.focus();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  G.gate = { whenUnlocked: whenUnlocked };
})(window.Yiming = window.Yiming || {});

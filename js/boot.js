/* Boot, input, autosave, silent wall-clock catch-up. */
(function (G) {
  "use strict";

  var state = null;
  var saveTimer = 0;
  var lastPaint = 0;
  var dirty = true;

  function persist() {
    if (!state) return;
    G.save.save(state);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 800);
  }
  function bindChar() {
    var ch = G.sim.active(state);
    if (ch) ch._state = state;
  }
  function after(res) {
    bindChar();
    if (res && res.err) G.ui.toast(res.err);
    else if (res && res.ok === false && res.err) G.ui.toast(res.err);
    dirty = true;
    G.ui.invalidate();
    scheduleSave();
  }

  function handle(act, arg) {
    bindChar();
    var ch = G.sim.active(state);

    if (act === "tab") { dirty = true; G.ui.paint(state, true); return; }
    if (act === "tab-skill") { G.ui.setTab("skill"); dirty = true; G.ui.paint(state, true); return; }
    if (act === "open-create") { G.ui.setOverlay("create"); dirty = true; G.ui.paint(state, true); return; }
    if (act === "close-create") { G.ui.setOverlay(null); dirty = true; G.ui.paint(state, true); return; }
    if (act === "close-overlay") { G.ui.setOverlay(null); dirty = true; G.ui.paint(state, true); return; }
    if (act === "style") { G.ui.setStyle(arg); G.ui.setOverlay("create"); dirty = true; G.ui.paint(state, true); return; }
    if (act === "bag-filter") { G.ui.setFilter(arg); dirty = true; G.ui.paint(state, true); return; }
    if (act === "bag-query") { dirty = true; return; }

    if (act === "create") {
      var input = document.getElementById("cmy-name");
      var name = ((input && input.value) || "").trim() || "無名";
      var neu = G.sim.createCharacter(name, G.ui.getStyle(), Date.now());
      state.slots.push(neu);
      state.activeId = neu.id;
      G.ui.setOverlay(null);
      G.ui.setTab("action");
      after({ ok: true });
      G.ui.toast("你在初醒津睜開眼睛。");
      G.ui.paint(state, true);
      persist();
      return;
    }
    if (act === "select") {
      state.activeId = arg;
      G.ui.setOverlay(null);
      G.ui.setTab("action");
      bindChar();
      G.sim.catchUp(state, Date.now());
      after({ ok: true });
      G.ui.paint(state, true);
      return;
    }
    if (act === "retire") {
      var c = state.slots.find(function (x) { return x.id === arg; });
      if (c) c.retired = true;
      if (state.activeId === arg) state.activeId = null;
      after({ ok: true });
      G.ui.paint(state, true);
      return;
    }
    if (act === "unretire") {
      var u = state.slots.find(function (x) { return x.id === arg; });
      if (u) u.retired = false;
      after({ ok: true });
      G.ui.paint(state, true);
      return;
    }
    if (act === "open-slots") { G.ui.setOverlay("slots"); after({ ok: true }); G.ui.paint(state, true); return; }

    if (!ch && act !== "reset" && act !== "open-import" && act !== "import" && act !== "export") return;

    if (act === "go") after(G.sim.go(state, arg));
    else if (act === "climb") after(G.sim.go(state, "town", Number(arg)));
    else if (act === "rest") after(G.sim.rest(state));
    else if (act === "boss") after(G.sim.enterBoss(state, ch));
    else if (act === "potion") after(G.sim.usePotion(state, arg));
    else if (act === "equip") after(G.sim.equipItem(state, arg));
    else if (act === "unequip") after(G.sim.unequip(state, arg));
    else if (act === "junk") {
      var it = (ch.bag || []).find(function (x) { return x.iid === arg; });
      G.sim.setJunk(state, arg, it ? !it.junk : true);
      after({ ok: true });
    }
    else if (act === "sell") after(G.sim.sellOne(state, arg));
    else if (act === "sell-junk") after(G.sim.sellJunk(state));
    else if (act === "melt-junk") after(G.sim.meltJunk(state));
    else if (act === "pickup") after(G.sim.pickupAll(state));
    else if (act === "open-shop") { G.ui.setOverlay("shop"); after({ ok: true }); }
    else if (act === "open-enhance") { G.ui.setOverlay("enhance"); after({ ok: true }); }
    else if (act === "buy") { after(G.sim.buy(state, arg)); }
    else if (act === "enhance") {
      var r = G.sim.enhance(state, arg);
      after(r);
      if (r && r.ok && r.success) G.ui.toast("強化成功。");
      else if (r && r.ok && r.success === false) G.ui.toast("強化未成，物還在。");
    }
    else if (act === "accept") after(G.sim.acceptQuest(state, arg));
    else if (act === "turnin") after(G.sim.turnIn(state, arg));
    else if (act === "take-story") after(G.sim.takeStory(state));
    else if (act === "assign") {
      var parts = String(arg).split(":");
      after(G.sim.assignSkill(state, Number(parts[0]), parts.slice(1).join(":")));
    }
    else if (act === "talent") after(G.sim.pickTalent(state, arg));
    else if (act === "ack-death") {
      if (ch) ch.pendingDeath = null;
      G.ui.setOverlay(null);
      after({ ok: true });
    }
    else if (act.indexOf("font-") === 0) {
      state.settings.fontScale = Number(act.slice(5));
      after({ ok: true });
    }
    else if (act.indexOf("log-") === 0) {
      state.settings.logVerbosity = Number(act.slice(4));
      after({ ok: true });
    }
    else if (act.indexOf("toggle-") === 0) {
      var key = act.slice(7);
      if (key === "autoPickup") state.settings.autoPickup = state.settings.autoPickup === false;
      else state.settings[key] = !state.settings[key];
      after({ ok: true });
    }
    else if (act === "export") { G.ui.setOverlay("export"); after({ ok: true }); }
    else if (act === "open-import") { G.ui.setOverlay("import"); after({ ok: true }); }
    else if (act === "copy-export") {
      var ta = document.getElementById("cmy-export");
      if (ta) {
        ta.select();
        try { document.execCommand("copy"); G.ui.toast("已複製。"); } catch (e) { G.ui.toast("請手動複製。"); }
      }
    }
    else if (act === "download-export") {
      var blob = new Blob([G.save.exportJSON(state)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "changmeng-yiming-save.json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }
    else if (act === "import") {
      var raw = (document.getElementById("cmy-import") || {}).value || "";
      var imp = G.save.importJSON(raw);
      if (!imp.ok) { G.ui.toast(imp.err || "匯入失敗"); return; }
      state = imp.state;
      G.ui.setOverlay(null);
      G.sim.catchUp(state, Date.now());
      after({ ok: true });
      G.ui.toast("已匯入。");
      G.ui.paint(state, true);
      return;
    }
    else if (act === "reset") {
      if (!confirm("這會清除這部裝置上的全部進度。確定？")) return;
      if (!confirm("再確認一次：無法復原。")) return;
      state = G.save.resetAll();
      G.ui.setOverlay(null);
      G.ui.setTab("action");
      after({ ok: true });
      G.ui.toast("已清除。");
      G.ui.paint(state, true);
      return;
    }

    G.ui.paint(state, true);
  }

  function loop() {
    var now = Date.now();
    if (state) {
      var ch = G.sim.active(state);
      if (ch && !ch.retired) {
        var last = ch.lastTick || state.lastTick || now;
        var dt = now - last;
        // 短間隔用 tick，讓前景狩獵會動；較長間隔走 catchUp（離線／卡住後補時）。
        if (dt >= 250) {
          G.sim.catchUp(state, now);
          dirty = true;
        } else if (dt >= 16) {
          bindChar();
          G.sim.tick(state, dt, now);
          ch.lastTick = now;
          state.lastTick = now;
          if (ch.hunting || ch.pendingDeath) dirty = true;
        }
      }
      if (now - lastPaint > 200 || dirty) {
        G.ui.paint(state, dirty);
        dirty = false;
        lastPaint = now;
      }
    }
    requestAnimationFrame(loop);
  }

  function boot() {
    state = G.save.load();
    bindChar();
    // Silent wall-clock catch-up: apply progress, no duration UI.
    G.sim.catchUp(state, Date.now());
    persist();
    var root = document.getElementById("cmy-root") || document.getElementById("cmy-app") || document.body;
    G.ui.bind(root, handle);
    G.ui.paint(state, true);
    requestAnimationFrame(loop);
    function tickClock() {
      var el = document.getElementById("cmy-clock");
      if (!el) return;
      try {
        el.textContent = new Intl.DateTimeFormat("zh-HK", {
          timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        }).format(new Date());
      } catch (e) {
        var d = new Date();
        el.textContent = String(d.getHours()).padStart(2, "0") + ":" +
          String(d.getMinutes()).padStart(2, "0") + ":" +
          String(d.getSeconds()).padStart(2, "0");
      }
    }
    tickClock();
    setInterval(tickClock, 1000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        G.sim.catchUp(state, Date.now());
        dirty = true;
        persist();
      } else {
        persist();
      }
    });
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
  }

  function start() {
    if (G.gate && G.gate.whenUnlocked) G.gate.whenUnlocked(boot);
    else boot();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  G.boot = { getState: function () { return state; } };
})(window.Yiming = window.Yiming || {});

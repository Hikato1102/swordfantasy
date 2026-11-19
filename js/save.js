/* ============================================================
 * MERGE: js/save.js
 * 職責：Yiming.sim 狀態的 localStorage 存檔／讀檔／匯出匯入。
 * 對外：window.Yiming.save  （boot.js / game-ui.js 使用）
 *       Changmeng.Save      （舊呼叫別名）
 * 鍵名跟 js/data.js 的 SAVE_KEY（changmeng-yiming-v1）對齊。
 * 序列化時略過 _state / _now，避免循環引用。
 * 不改 sim.js / data.js / 美術檔。
 * ============================================================ */
(function (G) {
  "use strict";

  function data() { return G.data || {}; }
  function sim() { return G.sim; }
  function now() { return Date.now(); }
  function key() { return data().SAVE_KEY || "changmeng-yiming-v1"; }
  function bak() { return data().SAVE_BAK || "changmeng-yiming-v1-bak"; }

  function replacer(k, v) {
    if (k === "_state" || k === "_now") return undefined;
    return v;
  }

  function serialize(state) {
    return JSON.stringify(state, replacer);
  }

  function emptyState() {
    return sim().newState(now());
  }

  function lookLikeSave(raw) {
    return raw && typeof raw === "object" && Array.isArray(raw.slots);
  }

  function save(state) {
    if (!state) return false;
    var payload = serialize(state);
    try {
      localStorage.setItem(key(), payload);
      localStorage.setItem(bak(), payload);
      return true;
    } catch (err) {
      console.warn("[Yiming.save] save failed", err);
      return false;
    }
  }

  function load() {
    var txt = null;
    try {
      txt = localStorage.getItem(key()) || localStorage.getItem(bak());
      if (!txt) txt = localStorage.getItem("changmeng-yiming:save:v1");
    } catch (err) {
      console.warn("[Yiming.save] load failed", err);
      return emptyState();
    }
    if (!txt) return emptyState();
    try {
      var raw = JSON.parse(txt);
      if (lookLikeSave(raw)) return raw;
      // 舊扁平骨架無法對應裝備／戰鬥欄位：開空檔，讓玩家另起夢者
      return emptyState();
    } catch (err2) {
      console.warn("[Yiming.save] parse failed", err2);
      return emptyState();
    }
  }

  function resetAll() {
    try {
      localStorage.removeItem(key());
      localStorage.removeItem(bak());
      localStorage.removeItem("changmeng-yiming:save:v1");
    } catch (err) {
      console.warn("[Yiming.save] reset failed", err);
    }
    return emptyState();
  }

  function exportJSON(state) {
    return JSON.stringify(state, replacer, 2);
  }

  function importJSON(raw) {
    try {
      var obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!lookLikeSave(obj)) return { ok: false, err: "不是有效的存檔。" };
      return { ok: true, state: obj };
    } catch (err) {
      return { ok: false, err: "無法解析這段文字。" };
    }
  }

  G.save = {
    save: save,
    load: load,
    resetAll: resetAll,
    exportJSON: exportJSON,
    importJSON: importJSON,
    key: key
  };

  // 舊別名，避免其他模組仍呼叫 Changmeng.Save
  var CM = (globalThis.Changmeng = globalThis.Changmeng || {});
  CM.Save = {
    load: load,
    write: save,
    touchAndWrite: save,
    newGame: function (name, styleId) {
      var state = emptyState();
      var ch = sim().createCharacter(name || "夢中人", styleId || "jian", now());
      state.slots.push(ch);
      state.activeId = ch.id;
      save(state);
      return state;
    },
    clear: resetAll,
    now: now,
    key: key,
    exportJSON: exportJSON,
    importJSON: importJSON,
    resetAll: resetAll
  };
})(globalThis.Yiming = globalThis.Yiming || (typeof window !== "undefined" ? (window.Yiming = window.Yiming || {}) : {}));

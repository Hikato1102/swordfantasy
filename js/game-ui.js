/* Renders the playable shell using cmy-* layout classes. */
(function (G) {
  "use strict";

  var tab = "action";
  var bagFilter = "all";
  var bagQuery = "";
  var overlay = null;
  var createStyle = "jian";
  var lastMainHtml = "";
  var toastTimer = 0;

  function el(sel) { return document.querySelector(sel); }
  function overlayRoot() {
    return document.getElementById("cmy-overlay") || document.getElementById("cmy-sheet-root");
  }
  function tabBar() {
    return document.getElementById("cmy-tabbar") || document.querySelector(".cmy-tabbar");
  }
  function subEl() {
    return document.getElementById("cmy-sub") || document.querySelector(".cmy-topbar__sub");
  }
  function statusEl() {
    return document.getElementById("cmy-status") || document.querySelector("[data-vitals]");
  }
  function ensureToast() {
    var n = document.getElementById("cmy-toast");
    if (n) return n;
    n = document.createElement("div");
    n.id = "cmy-toast";
    n.className = "cmy-toast";
    n.setAttribute("role", "status");
    (document.getElementById("cmy-app") || document.body).appendChild(n);
    return n;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function D() { return G.data; }
  function S() { return G.sim; }
  function chOf(state) { return S().active(state); }
  function floorName(id) {
    var f = S().floorById(id);
    return f ? f.town : "未知處";
  }
  function rarityCls(id) { return "cmy-rarity-" + (id || "fan"); }
  function rarityName(id) {
    var r = D().RARITY.find(function (x) { return x.id === id; });
    return r ? r.name : "凡";
  }
  function typName(t) { return D().DMG[t] || ""; }
  function formatItem(it) {
    if (!it) return "空";
    var bits = [];
    if (it.kind === "gear") {
      bits.push(rarityName(it.rarity) + "品");
      if (it.enh) bits.push("+" + it.enh);
      var st = S().itemStats(it);
      if (st.atk) bits.push("攻擊 " + st.atk);
      if (st.def) bits.push("防禦 " + st.def);
      if (st.hp) bits.push("生命 " + st.hp);
      if (it.typ) bits.push(typName(it.typ));
    } else if (it.count) bits.push("×" + it.count);
    return bits.join(" · ");
  }

  function toast(msg) {
    var el = ensureToast();
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-on"); }, 1800);
  }

  function setTabIcons(active) {
    var bar = tabBar();
    if (!bar) return;
    bar.hidden = false;
    bar.querySelectorAll(".cmy-tab").forEach(function (btn) {
      var t = btn.getAttribute("data-tab");
      var on = t === active;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
      var img = btn.querySelector("img");
      if (img) {
        img.src = on
          ? "assets/icons/tab-" + iconName(t) + ".png"
          : "assets/icons/muted/tab-" + iconName(t) + ".png";
      }
    });
  }
  function iconName(t) {
    return ({ action: "action", bag: "bag", skill: "skill", quest: "quest", log: "log", settings: "settings" })[t] || "action";
  }

  function applySettings(state) {
    var s = state.settings || {};
    var scale = s.fontScale || 1;
    document.documentElement.style.setProperty("--fs-md", (16 * scale) + "px");
    document.documentElement.style.setProperty("--fs-sm", (13 * scale) + "px");
    document.documentElement.style.setProperty("--fs-lg", (18 * scale) + "px");
    document.documentElement.style.setProperty("--fs-xl", (22 * scale) + "px");
    document.documentElement.classList.toggle("reduce-motion", !!s.reduceMotion);
    document.body.classList.toggle("reduce-motion", !!s.reduceMotion);
  }

  function paintStatus(state) {
    var ch = chOf(state);
    var sub = subEl();
    var box = statusEl();
    if (!ch) {
      if (sub) sub.textContent = D().TAGLINE;
      if (box) box.innerHTML = "";
      return;
    }
    var f = S().floorById(ch.loc.floor);
    var z = D().ZONE[ch.loc.zone];
    if (sub) sub.textContent = "第 " + ch.loc.floor + " 層 · " + (f ? f.town : "") + " · " + (z ? z.name : "") + " · " + ch.level + " 級";
    var pct = ch.hpMax ? Math.max(0, Math.min(100, Math.round(ch.hp / ch.hpMax * 100))) : 0;
    if (box) {
      box.innerHTML =
        '<div class="cmy-stat cmy-stat--grow">' +
          '<div style="display:flex;justify-content:space-between;gap:8px">' +
            '<span class="cmy-stat__label">夢體</span>' +
            '<span class="cmy-stat__value">' + ch.hp + " / " + ch.hpMax + "</span>" +
          "</div>" +
          '<div class="cmy-meter" role="meter" aria-label="生命" aria-valuemin="0" aria-valuemax="' + ch.hpMax + '" aria-valuenow="' + ch.hp + '">' +
            '<span class="cmy-meter__fill" style="width:' + pct + '%"></span>' +
          "</div>" +
        "</div>" +
        '<div class="cmy-stat cmy-stat--gold">' +
          '<span class="cmy-stat__label">金幣</span>' +
          '<span class="cmy-stat__value cmy-stat__value--gold">' + ch.gold + "</span>" +
        "</div>";
    }
  }

  function btn(act, label, cls, arg) {
    return '<button type="button" class="cmy-btn ' + (cls || "") + '" data-act="' + esc(act) + '"' +
      (arg != null ? ' data-arg="' + esc(arg) + '"' : "") + ">" + esc(label) + "</button>";
  }

  function renderSelect(state) {
    var cards = (state.slots || []).map(function (c) {
      var st = S().styleById(c.style);
      var line = (c.retired ? "已封存 · " : "") + (st ? st.name : "") + " · " + c.level + " 級 · 第 " + (c.maxFloor || 1) + " 層" + (c.deaths ? " · 力竭 " + c.deaths + " 次" : "");
      return '<div class="cmy-list__item">' +
        '<div class="cmy-list__main"><div class="cmy-list__name">' + esc(c.name) + '</div>' +
        '<span class="cmy-list__sub">' + esc(line) + "</span></div>" +
        (c.retired
          ? btn("unretire", "啟封", "cmy-btn--ghost", c.id)
          : btn("select", "進入", "cmy-btn--primary", c.id) + btn("retire", "封存", "cmy-btn--ghost", c.id)) +
        "</div>";
    }).join("");
    return '<p class="cmy-kicker">長夢</p>' +
      "<p>" + esc(D().TAGLINE) + "</p>" +
      (cards ? '<div class="cmy-card"><div class="cmy-list">' + cards + "</div></div>" : '<p class="cmy-muted">尚未有夢者。先為自己取一個名字。</p>') +
      '<div class="cmy-actions" style="margin-top:12px">' + btn("open-create", "新的夢者", "cmy-btn--primary") + "</div>";
  }

  function renderAction(state, ch) {
    var f = S().floorById(ch.loc.floor);
    var z = D().ZONE[ch.loc.zone];
    var html = '<p class="cmy-kicker">第 ' + ch.loc.floor + " 層</p>" +
      '<h2 class="cmy-place__title">' + esc(f ? f.town : "") + " · " + esc(z ? z.name : "") + "</h2>" +
      '<p class="cmy-place__desc">' + esc(f ? f.desc : "") + "</p>";

    if (ch.talentPicks > 0) {
      html += '<div class="cmy-banner">有未選的夢象。可到「技能」頁選取。' +
        btn("tab-skill", "前往", "cmy-btn--ghost") + "</div>";
    }
    if (ch.pendingStory) {
      html += '<div class="cmy-banner"><b>' + esc(ch.pendingStory.title) + "</b><p>" + esc(ch.pendingStory.text) + "</p>" +
        btn("take-story", "記下這段", "cmy-btn--primary") + "</div>";
    }
    if (ch.telegraph && ch.telegraph.until > Date.now()) {
      html += '<div class="cmy-telegraph">' + esc(ch.telegraph.text) + "</div>";
    }
    if (ch.combat && ch.combat.foes) {
      html += '<div class="cmy-card">';
      ch.combat.foes.filter(function (foe) { return foe.hp > 0; }).forEach(function (foe) {
        var p = foe.hpMax ? Math.round(foe.hp / foe.hpMax * 100) : 0;
        html += '<div class="cmy-foe"><div class="cmy-list__name">' + esc(foe.name) + (foe.isBoss ? " · 頭目" : "") +
          (foe.enraged ? " · 怒" : "") + '</div>' +
          '<div class="cmy-meter" style="margin:6px 0"><span class="cmy-meter__fill" style="width:' + p + '%"></span></div>' +
          '<span class="cmy-muted">' + foe.hp + " / " + foe.hpMax + " · " + typName(foe.typ) + "</span></div>";
      });
      html += "</div>";
    } else if (ch.loc.zone === "gate") {
      html += '<div class="cmy-card"><p>' + (S().bossUp(ch) ? "頭目的氣息仍在關內。" : "頭目尚未再聚，氣息正在慢慢回來。") + "</p></div>";
    } else if (ch.hunting) {
      html += '<div class="cmy-card"><p class="cmy-muted">正在巡走，等下一場相遇。</p></div>';
    }

    var logs = (ch.log || []).slice(0, verbosityCount(state));
    if (logs.length) {
      html += '<ol class="cmy-log">';
      logs.forEach(function (l) {
        var note = l.kind === "loot" ? "cmy-log__note--gold" : l.kind === "heal" ? "cmy-log__note--success" : l.kind === "harm" || l.kind === "warn" ? "cmy-log__note--danger" : "";
        html += '<li class="cmy-log__item"><p class="cmy-log__body ' + note + '">' + esc(l.text) + "</p></li>";
      });
      html += "</ol>";
    }

    if ((ch.ground || []).length) {
      html += '<div class="cmy-card"><p class="cmy-kicker">地上</p><p>' +
        ch.ground.map(function (it) { return esc(it.name); }).join("、") + "</p>" +
        '<div class="cmy-actions">' + btn("pickup", "擦起全部", "cmy-btn--primary") + "</div></div>";
    }

    html += '<div class="cmy-actions cmy-actions--wrap" style="margin-top:12px">';
    if (ch.loc.zone === "town") {
      html += btn("go", "郊野", "cmy-btn--primary", "field");
      html += btn("go", "荒原", "", "wilds");
      html += btn("go", "迷宮", "", "labyrinth");
      html += btn("go", "頭目關前", "", "gate");
      html += btn("rest", "歇息", "");
      html += btn("open-shop", "商店", "cmy-btn--ghost");
      html += btn("open-enhance", "強化", "cmy-btn--ghost");
      html += btn("sell-junk", "賣出廢物", "cmy-btn--ghost");
      html += btn("melt-junk", "融解廢物", "cmy-btn--ghost");
      if (ch.maxFloor > ch.loc.floor) html += btn("climb", "上一層「" + floorName(ch.loc.floor + 1) + "」", "cmy-btn--primary", String(ch.loc.floor + 1));
      if (ch.loc.floor > 1) html += btn("climb", "下一層「" + floorName(ch.loc.floor - 1) + "」", "cmy-btn--ghost", String(ch.loc.floor - 1));
    } else {
      html += btn("go", "回城", "cmy-btn--primary", "town");
      if (ch.loc.zone !== "field") html += btn("go", "郊野", "", "field");
      if (ch.loc.zone !== "wilds") html += btn("go", "荒原", "", "wilds");
      if (ch.loc.zone !== "labyrinth" && ch.loc.zone !== "boss") html += btn("go", "迷宮", "", "labyrinth");
      if (ch.loc.zone === "gate") html += btn("boss", S().bossUp(ch) ? "挑戰頭目" : "頭目未再聚", "cmy-btn--primary");
      if (ch.loc.zone !== "gate" && ch.loc.zone !== "boss") html += btn("go", "頭目關前", "", "gate");
    }
    html += "</div>";
    var potion = (ch.bag || []).find(function (x) { return x.kind === "potion" && x.count > 0; });
    if (potion) {
      html += '<div class="cmy-actions" style="margin-top:8px">' +
        btn("potion", "飲「" + potion.name + "」×" + potion.count + (ch.potionCd > 0 ? "（冷卻）" : ""), "", potion.iid) +
        "</div>";
    }
    return html;
  }

  function verbosityCount(state) {
    var v = (state.settings || {}).logVerbosity;
    if (v === 0) return 6;
    if (v === 2) return 24;
    return 12;
  }

  function renderBag(state, ch) {
    var html = '<p class="cmy-kicker">行囊 ' + S().bagCount(ch) + " / " + S().bagLimit(ch) + "</p>";
    html += '<div class="cmy-card"><p class="cmy-kicker">已裝備</p>';
    D().SLOTS.forEach(function (sl) {
      var it = ch.equip[sl.id];
      html += '<div class="cmy-slot-row"><span class="k">' + esc(sl.name) + "</span><span>" +
        (it ? '<span class="' + rarityCls(it.rarity) + '">' + esc(it.name) + (it.enh ? " +" + it.enh : "") + "</span>" : "空") +
        (it ? " " + btn("unequip", "卸下", "cmy-btn--ghost", sl.id) : "") +
        "</span></div>";
    });
    html += "</div>";
    html += '<input class="cmy-search" id="cmy-bag-q" type="search" placeholder="搜尋物品" value="' + esc(bagQuery) + '">';
    html += '<div class="cmy-filters">';
    ["all", "weapon", "armor", "use", "material"].forEach(function (f) {
      var names = { all: "全部", weapon: "武器", armor: "防具", use: "消耗", material: "材料" };
      html += '<button type="button" class="cmy-chip' + (bagFilter === f ? " is-on" : "") + '" data-act="bag-filter" data-arg="' + f + '">' + names[f] + "</button>";
    });
    html += "</div><div class='cmy-list'>";
    (ch.bag || []).filter(function (it) {
      if (bagFilter !== "all" && it.cat !== bagFilter && !(bagFilter === "weapon" && it.cat === "weapon")) return false;
      if (bagQuery && (it.name || "").indexOf(bagQuery) < 0) return false;
      return true;
    }).forEach(function (it) {
      html += '<div class="cmy-list__item"><div class="cmy-list__main">' +
        '<div class="cmy-list__name"><span class="' + rarityCls(it.rarity) + '">' + esc(it.name) + "</span>" +
        (it.junk ? " · 廢物" : "") + "</div>" +
        '<span class="cmy-list__sub">' + esc(formatItem(it)) + (it.desc ? " · " + it.desc : "") + "</span></div><div class='cmy-actions' style='flex:0 0 auto;display:flex;flex-direction:column;gap:4px'>";
      if (it.kind === "gear") html += btn("equip", "裝備", "cmy-btn--primary", it.iid) + btn("junk", it.junk ? "取消廢物" : "標為廢物", "cmy-btn--ghost", it.iid);
      if (it.kind === "potion") html += btn("potion", "使用", "cmy-btn--primary", it.iid);
      if (ch.loc.zone === "town" && it.kind !== "mat") html += btn("sell", "賣出", "cmy-btn--ghost", it.iid);
      html += "</div></div>";
    });
    html += "</div>";
    if (ch.loc.zone === "town") {
      html += '<div class="cmy-actions cmy-actions--row" style="margin-top:12px">' +
        btn("sell-junk", "賣出廢物", "") + btn("melt-junk", "融解廢物", "cmy-btn--ghost") + "</div>";
    }
    return html;
  }

  function renderSkills(state, ch) {
    var d = S().derived(ch);
    var html = '<div class="cmy-card"><p class="cmy-kicker">夢體</p><div class="cmy-stat-grid">' +
      "<div><span>力量</span> <b>" + d.str + "</b></div>" +
      "<div><span>敏捷</span> <b>" + d.agi + "</b></div>" +
      "<div><span>體質</span> <b>" + d.vit + "</b></div>" +
      "<div><span>攻擊</span> <b>" + Math.round(d.atk) + "</b></div>" +
      "<div><span>防禦</span> <b>" + Math.round(d.def) + "</b></div>" +
      "<div><span>暴擊</span> <b>" + Math.round(d.crit * 100) + "%</b></div>" +
      "<div><span>暴傷</span> <b>" + Math.round(d.critDmg * 100) + "%</b></div>" +
      "<div><span>攻速</span> <b>" + (d.interval / 1000).toFixed(2) + " 秒</b></div>" +
      "<div><span>迴避</span> <b>" + Math.round(d.dodge * 100) + "%</b></div>" +
      "<div><span>格擋</span> <b>" + Math.round(d.block * 100) + "%</b></div>" +
      "<div><span>減傷</span> <b>" + Math.round(d.dr * 100) + "%</b></div>" +
      "<div><span>傷害</span> <b>" + typName(d.typ) + "</b></div></div>" +
      '<p class="cmy-muted" style="margin:8px 0 0">閱歷 ' + ch.exp + " / " + S().expToLevel(ch.level) + "</p></div>";

    if (ch.talentPicks > 0) {
      html += '<div class="cmy-card"><p class="cmy-kicker">夢象（可選 ' + ch.talentPicks + "）</p><div class='cmy-list'>";
      S().offerTalents(ch).forEach(function (t) {
        html += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name">' + esc(t.name) +
          '</div><span class="cmy-list__sub">' + esc(t.desc) + "</span></div>" +
          btn("talent", "選取", "cmy-btn--primary", t.id) + "</div>";
      });
      html += "</div></div>";
    }
    if (ch.talents && ch.talents.length) {
      html += '<div class="cmy-card"><p class="cmy-kicker">已選夢象</p><p>' +
        ch.talents.map(function (id) { var t = S().talentById(id); return t ? t.name : id; }).join("、") + "</p></div>";
    }

    html += '<div class="cmy-card"><p class="cmy-kicker">技能欄</p>';
    for (var i = 0; i < 4; i++) {
      var sid = (ch.skills || [])[i];
      var sk = sid ? S().skillById(sid) : null;
      html += '<div class="cmy-slot-row"><span class="k">第 ' + (i + 1) + " 欄</span><span>" +
        (sk ? esc(sk.name) : "空") + "</span></div>";
    }
    html += "</div><div class='cmy-card'><p class='cmy-kicker'>已領會</p><div class='cmy-list'>";
    (ch.unlockedSkills || []).forEach(function (id) {
      var sk = S().skillById(id);
      if (!sk) return;
      html += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name">' + esc(sk.name) +
        '</div><span class="cmy-list__sub">' + esc(sk.desc) + " · 冷卻 " + (sk.cd / 1000) + " 秒</span></div><div>";
      for (var s = 0; s < 4; s++) html += btn("assign", "欄" + (s + 1), (ch.skills[s] === id ? "cmy-btn--primary" : "cmy-btn--ghost"), s + ":" + id);
      html += "</div></div>";
    });
    html += "</div></div>";
    return html;
  }

  function renderQuests(state, ch) {
    var html = "";
    function block(title, ids, mode) {
      if (!ids.length) return;
      html += '<div class="cmy-card"><p class="cmy-kicker">' + title + "</p><div class='cmy-list'>";
      ids.forEach(function (qid) {
        var q = D().QUESTS.find(function (x) { return x.id === qid; });
        if (!q) return;
        var p = (ch.quests.progress || {})[qid] || 0;
        var need = q.target || 1;
        var line = q.desc;
        if (q.type === "kill" || q.type === "collect") line += "（" + Math.min(p, need) + " / " + need + "）";
        html += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name">' + esc(q.name) +
          '</div><span class="cmy-list__sub">' + esc(line) + "</span></div>";
        if (mode === "active" && ch.loc.zone === "town") html += btn("turnin", "交付", "cmy-btn--primary", qid);
        if (mode === "avail") html += btn("accept", "接受", "cmy-btn--primary", qid);
        html += "</div>";
      });
      html += "</div></div>";
    }
    block("進行中", ch.quests.active || [], "active");
    var avail = D().QUESTS.filter(function (q) {
      return ch.quests.active.indexOf(q.id) < 0 && ch.quests.completed.indexOf(q.id) < 0 && ch.maxFloor >= q.floor;
    }).map(function (q) { return q.id; });
    block("可接", avail, "avail");
    block("已完成", ch.quests.completed || [], "done");
    if (!html) html = '<p class="cmy-muted">此刻沒有委託。</p>';
    return html;
  }

  function renderLog(state, ch) {
    var html = '<div class="cmy-card"><p class="cmy-kicker">成就</p><div class="cmy-list">';
    D().ACHIEVEMENTS.forEach(function (a) {
      var done = !!(state.achievements && state.achievements[a.id]);
      html += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name">' + (done ? "● " : "○ ") +
        esc(a.name) + '</div><span class="cmy-list__sub">' + esc(a.desc) + "</span></div></div>";
    });
    html += "</div></div>";

    html += '<div class="cmy-card"><p class="cmy-kicker">見聞</p><div class="cmy-list">';
    var keys = Object.keys(ch.bestiary || {});
    if (!keys.length) html += '<p class="cmy-muted">尚未遇見任何人。</p>';
    keys.forEach(function (id) {
      var b = ch.bestiary[id];
      html += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name">' + esc(b.name) +
        '</div><span class="cmy-list__sub">見過 ' + b.seen + " · 驅散 " + b.killed + " · 第 " + b.floor + " 層</span></div></div>";
    });
    html += "</div></div>";

    html += '<div class="cmy-card"><p class="cmy-kicker">掉落</p><div class="cmy-list">';
    (ch.drops || []).slice(0, 16).forEach(function (d) {
      html += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name ' + rarityCls(d.rarity) + '">' +
        esc(d.name) + '</div><span class="cmy-list__sub">來自「' + esc(d.from) + '」</span></div></div>';
    });
    if (!(ch.drops || []).length) html += '<p class="cmy-muted">還沒有記得的掉落。</p>';
    html += "</div></div>";

    html += '<div class="cmy-card"><p class="cmy-kicker">力竭紀錄</p><div class="cmy-list">';
    (state.chronicle || []).forEach(function (r) {
      html += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name">' + esc(r.name) +
        " · 第 " + r.floor + " 層</div><span class='cmy-list__sub'>" + esc((r.town || "") + " · " + (r.zone || "") + " · " + (r.cause || "") + " · " + r.level + " 級") +
        "</span></div></div>";
    });
    if (!(state.chronicle || []).length) html += '<p class="cmy-muted">尚未力竭過。</p>';
    html += "</div></div>";

    html += '<div class="cmy-card"><p class="cmy-kicker">金帳</p><div class="cmy-list">';
    (state.ledger || []).forEach(function (row) {
      html += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name">' + esc(row.day) +
        '</div><span class="cmy-list__sub">入 ' + (row.inn || 0) + " · 出 " + (row.out || 0) + "</span></div></div>";
    });
    if (!(state.ledger || []).length) html += '<p class="cmy-muted">尚無進出。</p>';
    html += "</div></div>";
    return html;
  }

  function renderSettings(state, ch) {
    var s = state.settings || {};
    function opt(act, on, label) {
      return '<button type="button" class="cmy-chip' + (on ? " is-on" : "") + '" data-act="' + act + '">' + label + "</button>";
    }
    var html = '<div class="cmy-card"><p class="cmy-kicker">顯示</p><div class="cmy-filters">' +
      opt("font-0.9", s.fontScale === 0.9, "較小") +
      opt("font-1", s.fontScale === 1 || !s.fontScale, "適中") +
      opt("font-1.1", s.fontScale === 1.1, "較大") +
      opt("font-1.2", s.fontScale === 1.2, "更大") +
      "</div><p class='cmy-kicker'>戰鬥紀錄</p><div class='cmy-filters'>" +
      opt("log-0", s.logVerbosity === 0, "簡") +
      opt("log-1", s.logVerbosity === 1 || s.logVerbosity == null, "常") +
      opt("log-2", s.logVerbosity === 2, "詳") +
      "</div><p class='cmy-kicker'>自動化</p><div class='cmy-filters'>" +
      opt("toggle-autoPickup", s.autoPickup !== false, "自動拾取") +
      opt("toggle-autoBoss", !!s.autoBoss, "自動挑戰頭目") +
      opt("toggle-reduceMotion", !!s.reduceMotion, "減少動態") +
      "</div></div>";

    html += '<div class="cmy-card cmy-howto"><p class="cmy-kicker">規約</p>';
    D().HOWTO.forEach(function (h) {
      html += "<h3>" + esc(h.h) + "</h3><p>" + esc(h.p) + "</p>";
    });
    html += "</div>";

    html += '<div class="cmy-card"><p class="cmy-kicker">存檔</p>' +
      "<p class='cmy-muted'>進度寫在這部裝置裡。可匯出備份，或把備份貼回。</p>" +
      '<div class="cmy-actions cmy-actions--row">' +
      btn("export", "匯出存檔", "cmy-btn--primary") +
      btn("open-import", "匯入存檔", "cmy-btn--ghost") +
      "</div>" +
      '<div class="cmy-actions" style="margin-top:8px">' + btn("reset", "危險：清除全部進度", "cmy-btn--danger") + "</div></div>";

    if (ch) {
      html += '<div class="cmy-card"><p class="cmy-kicker">夢者</p><p>' + esc(ch.name) + " · " +
        esc((S().styleById(ch.style) || {}).name || "") + "</p>" +
        '<div class="cmy-actions cmy-actions--row">' +
        btn("open-slots", "切換角色", "") + btn("open-create", "另起夢者", "cmy-btn--ghost") +
        "</div></div>";
    }
    return html;
  }

  function renderCreate() {
    var html = '<p class="cmy-kicker">新的夢者</p><h2 class="cmy-place__title">取一個名字，選一種兵器</h2>' +
      '<div class="cmy-field"><label for="cmy-name">名字</label><input id="cmy-name" maxlength="12" placeholder="例如：渡燈"></div>' +
      '<div class="cmy-styles">';
    D().STYLES.forEach(function (st) {
      html += '<button type="button" class="cmy-style' + (createStyle === st.id ? " is-on" : "") +
        '" data-act="style" data-arg="' + st.id + '"><b>' + esc(st.name) + "</b><span>" + esc(st.desc) +
        " · " + typName(st.dmg) + "</span></button>";
    });
    html += '</div><div class="cmy-actions cmy-actions--row" style="margin-top:12px">' +
      btn("create", "走進長夢", "cmy-btn--primary") + btn("close-create", "返回", "cmy-btn--ghost") + "</div>";
    return html;
  }

  function sheet(title, body, actions) {
    return '<div class="cmy-sheet"><h2>' + esc(title) + "</h2>" + body +
      (actions ? '<div class="cmy-actions" style="margin-top:12px">' + actions + "</div>" : "") + "</div>";
  }

  function renderOverlay(state) {
    var el = overlayRoot();
    if (!el) return;
    var base = el.id === "cmy-sheet-root" ? "cmy-sheet-root" : "cmy-overlay";
    if (!overlay) {
      el.className = base;
      el.innerHTML = "";
      return;
    }
    var ch = chOf(state);
    el.className = base + " is-open" + (overlay === "death" ? " cmy-overlay--center" : "");
    if (overlay === "create") {
      el.className = base; // form is rendered in main
      el.innerHTML = "";
    } else if (overlay === "death" && ch && ch.pendingDeath) {
      var r = ch.pendingDeath;
      el.innerHTML = sheet("力竭",
        "<p>你在「" + esc(r.town) + " · " + esc(r.zone) + "」倒下。</p><p>" + esc(r.cause) + "。</p>" +
        "<p class='cmy-muted'>這具夢體仍在。你醒回最後的安穩城中，狩獵已停下。</p>",
        btn("ack-death", "醒回城中", "cmy-btn--primary"));
    } else if (overlay === "shop" && ch) {
      var list = S().shopList(ch).map(function (it) {
        return '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name">' + esc(it.name) +
          '</div><span class="cmy-list__sub">' + esc(it.desc) + " · " + it.cost + " 金</span></div>" +
          btn("buy", "買下", "cmy-btn--primary", it.id) + "</div>";
      }).join("");
      el.innerHTML = sheet("商店", '<div class="cmy-list">' + list + "</div>", btn("close-overlay", "離開", "cmy-btn--ghost"));
    } else if (overlay === "enhance" && ch) {
      var gears = [];
      Object.keys(ch.equip).forEach(function (k) { if (ch.equip[k]) gears.push(ch.equip[k]); });
      (ch.bag || []).forEach(function (it) { if (it.kind === "gear") gears.push(it); });
      var body = '<p class="cmy-muted">失敗只耗材料與金幣，不會毀掉物品。夢屑石 ' + S().countMat(ch, "stone_dream") +
        " · 定魂砂 " + S().countMat(ch, "sand_soul") + "</p><div class='cmy-list'>";
      gears.forEach(function (it) {
        var rate = Math.round(S().enhanceRate(it) * 100);
        var cost = S().enhanceCost(it);
        body += '<div class="cmy-list__item"><div class="cmy-list__main"><div class="cmy-list__name ' + rarityCls(it.rarity) + '">' +
          esc(it.name) + " +" + (it.enh || 0) + '</div><span class="cmy-list__sub">成功率 ' + rate + "% · " +
          cost.gold + " 金 · 石 " + cost.stone + (cost.sand ? " · 砂 " + cost.sand : "") + "</span></div>" +
          btn("enhance", "強化", "cmy-btn--primary", it.iid) + "</div>";
      });
      body += "</div>";
      el.innerHTML = sheet("強化", body, btn("close-overlay", "離開", "cmy-btn--ghost"));
    } else if (overlay === "import") {
      el.innerHTML = sheet("匯入存檔",
        '<div class="cmy-field"><label>把備份貼在這裡</label><textarea id="cmy-import" rows="8"></textarea></div>',
        btn("import", "匯入並覆蓋", "cmy-btn--danger") + btn("close-overlay", "取消", "cmy-btn--ghost"));
    } else if (overlay === "export") {
      el.innerHTML = sheet("匯出存檔",
        '<div class="cmy-field"><label>複製以下文字妥善保存</label><textarea id="cmy-export" rows="8" readonly></textarea></div>',
        btn("copy-export", "複製", "cmy-btn--primary") + btn("download-export", "下載檔案", "cmy-btn--ghost") +
        btn("close-overlay", "關閉", "cmy-btn--ghost"));
    } else if (overlay === "slots") {
      el.classList.add("cmy-overlay--center");
      el.innerHTML = '<div class="cmy-sheet">' + renderSelect(state) +
        '<div class="cmy-actions" style="margin-top:12px">' + btn("close-overlay", "返回", "cmy-btn--ghost") + "</div></div>";
    } else {
      el.className = base;
      el.innerHTML = "";
    }
    if (overlay === "export") {
      var ta = document.getElementById("cmy-export");
      if (ta) ta.value = G.save.exportJSON(state);
    }
  }

  function paint(state, force) {
    applySettings(state);
    paintStatus(state);
    var ch = chOf(state);
    var main = document.getElementById("cmy-main");
    var bar = tabBar();
    if (!main) return;

    if (ch && ch.pendingDeath && overlay !== "death") overlay = "death";

    if (!ch || overlay === "create") {
      if (bar) bar.hidden = true;
      var html = overlay === "create" ? renderCreate() : renderSelect(state);
      if (force || html !== lastMainHtml) { main.innerHTML = html; lastMainHtml = html; }
      // Keep overlay === "create" until the user submits or cancels.
      renderOverlay(state);
      return;
    }

    if (bar) bar.hidden = false;
    setTabIcons(tab);
    var view = "";
    if (tab === "bag") view = renderBag(state, ch);
    else if (tab === "skill") view = renderSkills(state, ch);
    else if (tab === "quest") view = renderQuests(state, ch);
    else if (tab === "log") view = renderLog(state, ch);
    else if (tab === "settings") view = renderSettings(state, ch);
    else view = renderAction(state, ch);

    var active = document.activeElement;
    var typing = active && (active.id === "cmy-bag-q" || active.id === "cmy-import" || active.tagName === "TEXTAREA" || active.tagName === "INPUT");
    if (!force && typing && tab === "bag") {
      /* keep the list stale rather than steal focus */
    } else if (force || view !== lastMainHtml) {
      var keepQ = typing && active.id === "cmy-bag-q" ? active.selectionStart : null;
      main.innerHTML = view;
      lastMainHtml = view;
      if (keepQ != null) {
        var q = document.getElementById("cmy-bag-q");
        if (q) { q.focus(); q.setSelectionRange(keepQ, keepQ); }
      }
    }
    renderOverlay(state);
  }

  function bind(root, handlers) {
    function onAct(act, arg, ev) {
      if (!act) return;
      handlers(act, arg, ev);
    }
    root.addEventListener("click", function (ev) {
      var tabBtn = ev.target.closest("[data-tab]");
      if (tabBtn && tabBtn.closest(".cmy-tabbar")) {
        tab = tabBtn.getAttribute("data-tab");
        lastMainHtml = "";
        handlers("tab", tab, ev);
        return;
      }
      var btnEl = ev.target.closest("[data-act]");
      if (btnEl) onAct(btnEl.getAttribute("data-act"), btnEl.getAttribute("data-arg"), ev);
    });
    root.addEventListener("input", function (ev) {
      if (ev.target && ev.target.id === "cmy-bag-q") {
        bagQuery = ev.target.value || "";
        handlers("bag-query", bagQuery, ev);
      }
    });
  }

  G.ui = {
    paint: paint,
    toast: toast,
    bind: bind,
    setTab: function (t) { tab = t; lastMainHtml = ""; },
    getTab: function () { return tab; },
    setOverlay: function (o) { overlay = o; lastMainHtml = ""; },
    getOverlay: function () { return overlay; },
    setFilter: function (f) { bagFilter = f; lastMainHtml = ""; },
    setStyle: function (id) { createStyle = id; },
    getStyle: function () { return createStyle; },
    invalidate: function () { lastMainHtml = ""; }
  };
})(window.Yiming = window.Yiming || {});

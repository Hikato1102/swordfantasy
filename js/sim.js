/* Combat, stats, loot, offline catch-up. No DOM. */
(function (G) {
  "use strict";
  const D = function () { return G.data; };

  function rng(ch) {
    let s = (ch.seed |= 0);
    s = ch.seed = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function pick(ch, arr) { return arr[Math.floor(rng(ch) * arr.length)]; }
  function uid(ch) { return "i" + (ch.seq = (ch.seq || 0) + 1).toString(36) + (ch.seed >>> 0).toString(36); }
  function floorById(id) { return D().FLOORS.find(function (f) { return f.id === id; }); }
  function styleById(id) { return D().STYLES.find(function (s) { return s.id === id; }); }
  function skillById(id) { return D().SKILLS.find(function (s) { return s.id === id; }); }
  function talentById(id) { return D().TALENTS.find(function (s) { return s.id === id; }); }

  function talentFx(ch) {
    const acc = {};
    (ch.talents || []).forEach(function (id) {
      const t = talentById(id);
      if (!t) return;
      Object.keys(t.fx).forEach(function (k) { acc[k] = (acc[k] || 0) + t.fx[k]; });
    });
    return acc;
  }

  function itemStats(it) {
    if (!it || !it.stats) return {};
    const out = Object.assign({}, it.stats);
    const enh = it.enh || 0;
    if (enh > 0) {
      if (out.atk) out.atk = Math.round(out.atk + enh * (2 + (it.floor || 1) * 0.6));
      if (out.def) out.def = Math.round(out.def + enh * (1.5 + (it.floor || 1) * 0.5));
      if (out.hp) out.hp = Math.round(out.hp + enh * (3 + (it.floor || 1)));
    }
    return out;
  }

  function sumGear(ch) {
    const acc = { atk: 0, def: 0, hp: 0, crit: 0, critDmg: 0, aspd: 0, dodge: 0, block: 0, dr: 0, str: 0, agi: 0, vit: 0, slash: 0, pierce: 0, blunt: 0 };
    const eq = ch.equip || {};
    Object.keys(eq).forEach(function (slot) {
      const it = eq[slot];
      if (!it) return;
      const s = itemStats(it);
      Object.keys(acc).forEach(function (k) { if (s[k]) acc[k] += s[k]; });
    });
    return acc;
  }

  function derived(ch) {
    const st = styleById(ch.style) || D().STYLES[0];
    const g = sumGear(ch);
    const tf = talentFx(ch);
    const str = ch.base.str + g.str;
    const agi = ch.base.agi + g.agi;
    const vit = ch.base.vit + g.vit + (tf.vit || 0);
    const hpMax = Math.round((48 + vit * 8 + ch.level * 6 + g.hp) * (1 + (tf.hp || 0)));
    const atk = 6 + str * 2 + g.atk + ch.level;
    const def = vit * 1.15 + g.def + ch.level * 0.4;
    const crit = Math.min(0.55, 0.05 + agi * 0.0035 + (g.crit || 0) + (tf.crit || 0));
    const critDmg = 1.5 + (g.critDmg || 0) + (tf.critDmg || 0);
    const interval = (2000 * (st.interval || 1)) / (1 + agi * 0.012 + (g.aspd || 0) + (tf.aspd || 0));
    const dodge = Math.min(0.4, agi * 0.0028 + (g.dodge || 0) + (tf.dodge || 0));
    const block = Math.min(0.35, (g.block || 0) + (tf.block || 0) + str * 0.001);
    const dr = Math.min(0.62, def / (def + 55 + ch.loc.floor * 8) + (g.dr || 0) + (tf.dr || 0));
    const typ = st.dmg;
    const typBonus = g[typ] || 0;
    return { str, agi, vit, hpMax, atk, def, crit, critDmg, interval, dodge, block, dr, typ, typBonus, bag: D().BAG_BASE + (tf.bag || 0) };
  }

  function ensureDerived(ch) {
    const d = derived(ch);
    const old = ch.hpMax || d.hpMax;
    ch.hpMax = d.hpMax;
    if (ch.hp == null) ch.hp = d.hpMax;
    if (d.hpMax > old) ch.hp += (d.hpMax - old);
    if (ch.hp > ch.hpMax) ch.hp = ch.hpMax;
    return d;
  }

  function log(ch, text, kind, verbosity) {
    if (verbosity === 0 && kind !== "sys" && kind !== "loot" && kind !== "warn") return;
    if (verbosity === 1 && kind === "hit") return;
    ch.log = ch.log || [];
    ch.log.unshift({ t: Date.now(), text: text, kind: kind || "sys" });
    if (ch.log.length > 80) ch.log.length = 80;
  }

  function addGold(state, ch, n, reason) {
    if (!n) return;
    ch.gold = Math.max(0, (ch.gold || 0) + n);
    ledger(state, n, reason);
  }
  function ledger(state, n, reason) {
    const day = new Date().toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong" });
    state.ledger = state.ledger || [];
    let row = state.ledger.find(function (r) { return r.day === day; });
    if (!row) {
      row = { day: day, inn: 0, out: 0 };
      state.ledger.unshift(row);
      if (state.ledger.length > 30) state.ledger.length = 30;
    }
    if (n >= 0) row.inn += n; else row.out += -n;
    row.last = reason || "";
  }

  function expToLevel(lv) { return Math.round(18 * Math.pow(lv, 1.55)); }

  function grantExp(ch, n) {
    ch.exp += n;
    let ups = 0;
    while (ch.exp >= expToLevel(ch.level)) {
      ch.exp -= expToLevel(ch.level);
      ch.level += 1;
      ups += 1;
      const st = styleById(ch.style);
      ch.base.str += st.str >= 2 ? 2 : 1;
      ch.base.agi += st.agi >= 2 ? 2 : 1;
      ch.base.vit += st.vit >= 2 ? 2 : 1;
      if (ch.level % 5 === 0) ch.talentPicks = (ch.talentPicks || 0) + 1;
      unlockSkills(ch);
    }
    if (ups) {
      const d = ensureDerived(ch);
      ch.hp = d.hpMax;
      log(ch, "夢體穩了一層，現在是第 " + ch.level + " 級。", "sys");
    }
    if (ch.level >= 10) achieve(ch._state, "a_lv10");
    if (ch.level >= 20) achieve(ch._state, "a_lv20");
  }

  function achieve(state, id) {
    if (!state) return;
    state.achievements = state.achievements || {};
    if (state.achievements[id]) return;
    state.achievements[id] = Date.now();
    const a = D().ACHIEVEMENTS.find(function (x) { return x.id === id; });
    const ch = active(state);
    if (ch && a) log(ch, "記下：" + a.name + "。", "sys");
  }

  function unlockSkills(ch) {
    ch.unlockedSkills = ch.unlockedSkills || [];
    D().SKILLS.forEach(function (s) {
      if (ch.unlockedSkills.indexOf(s.id) >= 0) return;
      const u = s.unlock || {};
      if ((u.level && ch.level < u.level) || (u.floor && ch.maxFloor < u.floor)) return;
      ch.unlockedSkills.push(s.id);
      log(ch, "領會了「" + s.name + "」。", "sys");
    });
  }

  function defaultSkills(styleId) {
    const st = styleById(styleId);
    if (st.dmg === "pierce") return ["needle", null, null, null];
    if (st.dmg === "blunt") return ["knock", null, null, null];
    return ["riftcut", null, null, null];
  }

  function startingWeapon(ch) {
    const st = styleById(ch.style);
    return makeItem(ch, 1, "weapon", "liang", st.dmg);
  }

  function makeItem(ch, floor, slot, rarityId, typ) {
    const r = D().RARITY.find(function (x) { return x.id === rarityId; }) || D().RARITY[0];
    const f = floorById(floor) || floorById(1);
    typ = typ || (slot === "weapon" || slot === "offhand" ? pick(ch, ["slash", "pierce", "blunt"]) : null);
    const noun = slot === "weapon" ? (D().SLOT_NOUN.weapon[typ] || "器") : (D().SLOT_NOUN[slot] || "器");
    const name = r.name + "品·" + f.prefix + noun;
    const baseAtk = slot === "weapon" ? (5 + floor * 1.8) : (slot === "offhand" ? (2 + floor * 0.6) : 0);
    const baseDef = (slot !== "weapon" && slot !== "neck" && slot !== "ear" && slot.indexOf("ring") !== 0)
      ? (2 + floor * 1.1) : (slot.indexOf("ring") === 0 || slot === "neck" || slot === "ear" ? (1 + floor * 0.35) : 0);
    const stats = {};
    if (baseAtk) stats.atk = Math.round(baseAtk * r.mult * (0.9 + rng(ch) * 0.25));
    if (baseDef) stats.def = Math.round(baseDef * r.mult * (0.9 + rng(ch) * 0.25));
    if (slot === "body" || slot === "head") stats.hp = Math.round((6 + floor * 2) * r.mult);
    if (slot === "feet") stats.dodge = Math.round((0.01 + floor * 0.0015) * r.mult * 1000) / 1000;
    if (slot === "hands") stats.aspd = Math.round((0.02 + floor * 0.002) * r.mult * 1000) / 1000;
    if (slot === "neck" || slot === "ear") stats.crit = Math.round((0.01 + floor * 0.0012) * r.mult * 1000) / 1000;
    if (slot.indexOf("ring") === 0) {
      if (rng(ch) < 0.5) stats.critDmg = Math.round(0.08 * r.mult * 100) / 100;
      else stats.atk = Math.round((2 + floor * 0.5) * r.mult);
    }
    if (typ && (slot === "weapon" || slot === "offhand") && rng(ch) < 0.4) stats[typ] = Math.round((1 + floor * 0.3) * r.mult);
    const cat = slot === "weapon" || slot === "offhand" ? "weapon" : "armor";
    return {
      iid: uid(ch), kind: "gear", cat: cat, slot: slot, typ: typ, rarity: r.id,
      name: name, floor: floor, enh: 0, junk: false, stats: stats
    };
  }

  function rollRarity(ch, floor) {
    const boost = 1 + (floor - 1) * 0.03 + (talentFx(ch).drop || 0);
    const weights = D().RARITY.map(function (r, i) {
      return r.w * (i === 0 ? 1 / boost : boost);
    });
    let t = rng(ch) * weights.reduce(function (a, b) { return a + b; }, 0);
    for (let i = 0; i < weights.length; i++) {
      t -= weights[i];
      if (t <= 0) return D().RARITY[i].id;
    }
    return "fan";
  }

  function bagCount(ch) {
    return (ch.bag || []).length;
  }
  function bagLimit(ch) { return derived(ch).bag; }

  function giveItem(state, ch, item, auto) {
    ch.bag = ch.bag || [];
    ch.ground = ch.ground || [];
    const settings = (state && state.settings) || {};
    const autoPick = auto !== false && settings.autoPickup !== false;
    if (bagCount(ch) < bagLimit(ch) && autoPick) {
      ch.bag.push(item);
      return "bag";
    }
    if (bagCount(ch) >= bagLimit(ch)) achieve(state, "a_bag");
    if (ch.ground.length >= 30) {
      const old = ch.ground.shift();
      const conv = 2 + (old.floor || 1);
      addGold(state, ch, conv, "地上滿了");
    }
    ch.ground.push(item);
    return "ground";
  }

  function giveMat(state, ch, id, n) {
    n = n || 1;
    let it = ch.bag.find(function (x) { return x.kind === "mat" && x.matId === id; });
    if (!it) {
      const def = D().MATS.find(function (m) { return m.id === id; });
      it = { iid: uid(ch), kind: "mat", cat: "material", matId: id, name: def.name, count: 0, desc: def.desc };
      if (giveItem(state, ch, it) === "ground") {
        /* stacked on ground as its own pile */
      }
    }
    it.count = (it.count || 0) + n;
  }

  function givePotion(state, ch, id, n) {
    n = n || 1;
    const def = D().POTIONS.find(function (p) { return p.id === id; });
    let it = ch.bag.find(function (x) { return x.kind === "potion" && x.potId === id; });
    if (!it) {
      it = { iid: uid(ch), kind: "potion", cat: "use", potId: id, name: def.name, count: 0, desc: def.desc, heal: def.heal, cd: def.cd };
      giveItem(state, ch, it);
    }
    it.count = (it.count || 0) + n;
  }

  function loot(state, ch, mon, isBoss) {
    const tf = talentFx(ch);
    const gold = Math.max(1, Math.round(mon.gold * (0.75 + rng(ch) * 0.5) * (1 + (tf.gold || 0)) * (isBoss ? 1 : 1)));
    const exp = Math.max(1, Math.round(mon.exp * (1 + (tf.exp || 0))));
    addGold(state, ch, gold, "戰鬥");
    grantExp(ch, exp);
    const lines = ["獲 " + gold + " 金、閱歷 " + exp];
    const dropChance = isBoss ? 0.95 : 0.28 + (tf.drop || 0);
    if (rng(ch) < dropChance) {
      const slots = ["weapon", "offhand", "head", "body", "hands", "feet", "neck", "ear", "ring1"];
      const item = makeItem(ch, ch.loc.floor, pick(ch, slots), isBoss ? (rng(ch) < 0.35 ? "zhen" : "shang") : rollRarity(ch, ch.loc.floor));
      const where = giveItem(state, ch, item);
      lines.push(item.name + (where === "ground" ? "（落在地上）" : ""));
      ch.drops = ch.drops || [];
      ch.drops.unshift({ t: Date.now(), name: item.name, from: mon.name, rarity: item.rarity });
      if (ch.drops.length > 40) ch.drops.length = 40;
    }
    if (rng(ch) < (isBoss ? 0.8 : 0.22)) {
      giveMat(state, ch, "stone_dream", isBoss ? 2 : 1);
      lines.push("夢屑石");
    }
    if (isBoss && rng(ch) < 0.55) {
      giveMat(state, ch, "sand_soul", 1);
      lines.push("定魂砂");
    }
    if (rng(ch) < 0.12) givePotion(state, ch, ch.loc.floor >= 10 ? "potion_m" : "potion_s", 1);
    questProgress(state, ch, "kill", mon);
    log(ch, mon.name + "散去。" + lines.join("，") + "。", "loot");
  }

  function bestiary(ch, mon, killed) {
    ch.bestiary = ch.bestiary || {};
    const b = ch.bestiary[mon.id] || { name: mon.name, seen: 0, killed: 0, floor: ch.loc.floor };
    b.seen += 1;
    if (killed) b.killed += 1;
    b.name = mon.name;
    ch.bestiary[mon.id] = b;
  }

  function questProgress(state, ch, type, mon) {
    (ch.quests.active || []).forEach(function (qid) {
      const q = D().QUESTS.find(function (x) { return x.id === qid; });
      if (!q) return;
      ch.quests.progress = ch.quests.progress || {};
      const p = ch.quests.progress[qid] || 0;
      if (q.type === "kill" && type === "kill") {
        if (q.zone && ch.loc.zone !== q.zone && ch.loc.zone !== "labyrinth") {
          if (q.zone !== ch.loc.zone) { /* still count any kill if zone not strict for non-specified */ }
        }
        if (!q.zone || !mon || true) ch.quests.progress[qid] = p + 1;
      }
      if (q.type === "boss" && type === "boss" && mon && mon.isBoss && mon.floor === q.floor) {
        ch.quests.progress[qid] = 1;
      }
      if (q.type === "collect" && type === "collect") {
        const it = (ch.bag || []).find(function (x) { return x.matId === q.item; });
        ch.quests.progress[qid] = it ? it.count : 0;
      }
      if (q.type === "reach" && type === "reach") {
        if (ch.maxFloor >= q.target || ch.loc.floor >= q.target) ch.quests.progress[qid] = 1;
      }
    });
  }

  function spawnFoe(ch, tpl, zoneMult, isBoss) {
    const z = zoneMult || 1;
    return {
      id: tpl.id,
      name: tpl.name,
      typ: tpl.typ,
      hp: Math.round(tpl.hp * z),
      hpMax: Math.round(tpl.hp * z),
      atk: Math.round(tpl.atk * z),
      def: Math.round(tpl.def * z),
      exp: tpl.exp,
      gold: tpl.gold,
      resist: Object.assign({}, tpl.resist || {}),
      interval: isBoss ? 2200 : 2000 + Math.round((rng(ch) - 0.5) * 300),
      cd: 400 + Math.round(rng(ch) * 600),
      statuses: [],
      isBoss: !!isBoss,
      mechanic: isBoss ? tpl.mechanic : null,
      telegraphText: isBoss ? tpl.telegraph : null,
      floor: ch.loc.floor,
      teleUntil: 0,
      teleKind: null,
      enraged: false,
      shelled: false,
      splitDone: false
    };
  }

  function ensureEncounter(state, ch) {
    if (ch.combat && ch.combat.foes && ch.combat.foes.some(function (f) { return f.hp > 0; })) return;
    if (ch.loc.zone === "town" || ch.loc.zone === "gate") return;
    if (ch.spawnWait && ch.spawnWait > 0) return;
    const f = floorById(ch.loc.floor);
    if (!f) return;
    if (ch.loc.zone === "boss") {
      if (!bossUp(ch)) { ch.loc.zone = "gate"; ch.hunting = false; return; }
      const boss = spawnFoe(ch, f.boss, 1, true);
      ch.combat = { foes: [boss], started: Date.now() };
      bestiary(ch, boss, false);
      log(ch, f.boss.name + "擋在前面。", "warn");
      return;
    }
    const z = D().ZONE[ch.loc.zone] || D().ZONE.field;
    const tpl = pick(ch, f.mon);
    const foe = spawnFoe(ch, tpl, z.mult || 1, false);
    ch.combat = { foes: [foe], started: Date.now() };
    bestiary(ch, foe, false);
    if ((state.settings || {}).logVerbosity !== 0) log(ch, "遭遇「" + foe.name + "」。", "sys");
  }

  function bossUp(ch) {
    return !ch.bossUntil || Date.now() >= ch.bossUntil || (ch._now && ch._now >= (ch.bossUntil || 0));
  }

  function hasStatus(unit, id) {
    return (unit.statuses || []).some(function (s) { return s.id === id && s.until > (unit._now || Date.now()); });
  }
  function applyStatus(unit, st, now) {
    unit.statuses = unit.statuses || [];
    const ex = unit.statuses.find(function (s) { return s.id === st.id; });
    if (ex) { ex.until = now + st.dur; if (st.power) ex.power = st.power; return; }
    unit.statuses.push({ id: st.id, until: now + st.dur, power: st.power || 0 });
  }
  function pruneStatus(unit, now) {
    unit.statuses = (unit.statuses || []).filter(function (s) { return s.until > now; });
  }

  function typeMod(atkType, defType, resist, bonus) {
    // slight wheel: slash>pierce>blunt>slash
    let m = 1 + (bonus || 0) * 0.04;
    if (atkType && defType) {
      if (atkType === "slash" && defType === "pierce") m += 0.08;
      if (atkType === "pierce" && defType === "blunt") m += 0.08;
      if (atkType === "blunt" && defType === "slash") m += 0.08;
    }
    if (resist && atkType && resist[atkType]) m *= (1 - resist[atkType]);
    return m;
  }

  function dealToFoe(state, ch, foe, raw, typ, now) {
    if (foe.hp <= 0) return 0;
    let def = foe.def;
    if (hasStatus(foe, "sunder")) def *= 0.65;
    if (foe.shelled) def *= 1.8;
    const red = def / (def + 40 + ch.level * 2);
    let dmg = Math.max(1, Math.round(raw * (1 - red) * typeMod(typ, foe.typ, foe.resist, 0)));
    if (foe.mechanic === "thorns" && rng(ch) < 0.2) {
      const back = Math.max(1, Math.round(dmg * 0.25));
      ch.hp -= back;
      log(ch, "棘刺折返，你受了 " + back + " 點傷害。", "harm");
    }
    if (foe.mechanic === "drain") {
      foe.hp = Math.min(foe.hpMax, foe.hp + Math.round(dmg * 0.06));
    }
    foe.hp -= dmg;
    return dmg;
  }

  function dealToPlayer(state, ch, foe, raw, now) {
    const d = ensureDerived(ch);
    if (rng(ch) < d.dodge) {
      log(ch, "你側身讓過「" + foe.name + "」。", "hit");
      return 0;
    }
    let blocked = false;
    if (rng(ch) < d.block) { blocked = true; raw *= 0.45; }
    let dr = d.dr;
    if (hasStatus(ch, "guard")) dr = Math.min(0.75, dr + (ch._guardAmt || 0.22));
    let dmg = Math.max(1, Math.round(raw * (1 - dr)));
    if (hasStatus(ch, "sunder")) dmg = Math.round(dmg * 1.2);
    ch.hp -= dmg;
    log(ch, (blocked ? "格擋後仍受 " : "你受到 ") + dmg + " 點傷害（" + foe.name + "）。", "harm");
    return dmg;
  }

  function playerSwing(state, ch, d, now) {
    if (hasStatus(ch, "stun")) return;
    const foes = (ch.combat.foes || []).filter(function (f) { return f.hp > 0; });
    if (!foes.length) return;
    const foe = foes[0];
    let raw = d.atk * (1 + d.typBonus * 0.05);
    let crit = false;
    if (rng(ch) < d.crit) { raw *= d.critDmg; crit = true; }
    const dmg = dealToFoe(state, ch, foe, raw, d.typ, now);
    const verb = D().DMG[d.typ] || "擊";
    log(ch, (crit ? "要害！" : "") + "你以" + verb + "對「" + foe.name + "」造成 " + dmg + " 點傷害。", crit ? "loot" : "hit");
  }

  function trySkills(state, ch, d, now) {
    if (hasStatus(ch, "stun")) return;
    const foes = (ch.combat.foes || []).filter(function (f) { return f.hp > 0; });
    ch.skillCd = ch.skillCd || {};
    (ch.skills || []).some(function (sid) {
      if (!sid) return false;
      const sk = skillById(sid);
      if (!sk) return false;
      if ((ch.skillCd[sid] || 0) > 0) return false;
      let used = false;
      if (sk.target === "self") {
        if (sk.self && sk.self.heal) {
          const amt = Math.round(ch.hpMax * sk.self.heal);
          ch.hp = Math.min(ch.hpMax, ch.hp + amt);
          log(ch, "「" + sk.name + "」恢復了 " + amt + " 點氣力。", "heal");
        }
        if (sk.self && sk.self.shield) {
          applyStatus(ch, { id: "guard", dur: sk.self.dur }, now);
          ch._guardAmt = sk.self.shield;
          log(ch, "你運起「" + sk.name + "」。", "sys");
        }
        if (sk.self && sk.self.haste) {
          applyStatus(ch, { id: "haste", dur: sk.self.dur }, now);
          log(ch, "「" + sk.name + "」讓動作快了一截。", "sys");
        }
        used = true;
      } else if (foes.length) {
        const targets = sk.target === "all" ? foes : [foes[0]];
        targets.forEach(function (foe) {
          for (let h = 0; h < (sk.hits || 1); h++) {
            let raw = d.atk * (sk.coeff || 1);
            if (rng(ch) < d.crit * 0.8) raw *= d.critDmg;
            const typ = sk.typ || d.typ;
            const dmg = dealToFoe(state, ch, foe, raw, typ, now);
            log(ch, "「" + sk.name + "」命中「" + foe.name + "」，" + dmg + " 點。", "hit");
            if (sk.status && rng(ch) < sk.status.chance) {
              applyStatus(foe, sk.status, now);
              log(ch, "「" + foe.name + "」中了" + statusName(sk.status.id) + "。", "sys");
            }
          }
        });
        used = true;
      }
      if (used) {
        ch.skillCd[sid] = sk.cd;
        return true;
      }
      return false;
    });
  }

  function statusName(id) {
    return { sunder: "破甲", dot: "持續損傷", stun: "暈眩", slow: "減速", guard: "守勢", haste: "疾步" }[id] || id;
  }

  function foeAct(state, ch, foe, now) {
    if (foe.hp <= 0 || hasStatus(foe, "stun")) return;
    if (foe.teleUntil && now < foe.teleUntil) return;
    if (foe.teleUntil && now >= foe.teleUntil && foe.teleKind) {
      resolveTele(state, ch, foe, now);
      foe.teleUntil = 0;
      foe.teleKind = null;
      return;
    }
    // maybe start telegraph
    if (foe.isBoss && foe.mechanic && rng(ch) < 0.18) {
      startTele(ch, foe, now);
      return;
    }
    let raw = foe.atk * (0.9 + rng(ch) * 0.2);
    if (foe.enraged) raw *= 1.35;
    dealToPlayer(state, ch, foe, raw, now);
    if (foe.mechanic === "sunder" && rng(ch) < 0.2) {
      applyStatus(ch, { id: "sunder", dur: 5000 }, now);
      log(ch, "防護被「" + foe.name + "」撕開一角。", "warn");
    }
    if (foe.mechanic === "slow" && rng(ch) < 0.2) {
      applyStatus(ch, { id: "slow", dur: 5000 }, now);
      log(ch, "手腳一沉。", "warn");
    }
    if (foe.mechanic === "dot" && rng(ch) < 0.22) {
      applyStatus(ch, { id: "dot", dur: 6000, power: Math.round(foe.atk * 0.2) }, now);
      log(ch, "鹽霧或毒液附了上來。", "warn");
    }
  }

  function startTele(ch, foe, now) {
    const map = {
      pulse: "pulse", heat: "pulse", enragepulse: "pulse", dirge: "dirge",
      stun: "stun", burnsmash: "smash", finale: "finale",
      summon: "summon", split: "split", shell: "shell",
      enrage: "enrage", drain: "drain", thorns: "pulse",
      shift: "shift", multihit: "multi"
    };
    const kind = map[foe.mechanic] || "pulse";
    foe.teleKind = kind;
    foe.teleUntil = now + (kind === "smash" || kind === "finale" ? 1400 : 1100);
    log(ch, foe.telegraphText || (foe.name + "正在聚力——"), "warn");
    ch.telegraph = { text: foe.telegraphText || (foe.name + "正在聚力——"), until: foe.teleUntil };
  }

  function resolveTele(state, ch, foe, now) {
    const k = foe.teleKind;
    if (k === "pulse" || k === "smash" || k === "dirge" || k === "finale") {
      let raw = foe.atk * (k === "smash" || k === "finale" ? 2.1 : 1.55);
      if (foe.enraged) raw *= 1.2;
      dealToPlayer(state, ch, foe, raw, now);
      if (k === "dirge") applyStatus(ch, { id: "slow", dur: 5000 }, now);
      if (k === "finale") applyStatus(ch, { id: "sunder", dur: 4000 }, now);
    } else if (k === "stun") {
      applyStatus(ch, { id: "stun", dur: 1600 }, now);
      dealToPlayer(state, ch, foe, foe.atk * 0.8, now);
      log(ch, "鐘聲按住了你。", "warn");
    } else if (k === "summon") {
      if (ch.combat.foes.filter(function (f) { return f.hp > 0; }).length < 3) {
        const add = spawnFoe(ch, {
          id: foe.id + "_add", name: foe.name + "的殘影", typ: foe.typ,
          hp: Math.round(foe.hpMax * 0.22), atk: Math.round(foe.atk * 0.45),
          def: Math.round(foe.def * 0.4), exp: Math.round(foe.exp * 0.15), gold: 1, resist: {}
        }, 1, false);
        ch.combat.foes.push(add);
        log(ch, "又一個影子站了出來。", "warn");
      }
    } else if (k === "split" && !foe.splitDone && foe.hp <= foe.hpMax * 0.34) {
      foe.splitDone = true;
      const add = spawnFoe(ch, {
        id: foe.id + "_twin", name: foe.name + "的背影", typ: foe.typ,
        hp: Math.round(foe.hpMax * 0.3), atk: Math.round(foe.atk * 0.7),
        def: Math.round(foe.def * 0.7), exp: Math.round(foe.exp * 0.2), gold: 2, resist: {}
      }, 1, false);
      ch.combat.foes.push(add);
      log(ch, "鏡子裡的背影走了出來。", "warn");
    } else if (k === "shell") {
      foe.shelled = true;
      applyStatus(foe, { id: "shell", dur: 5000 }, now);
      log(ch, "一層亮殼合上了。", "warn");
    } else if (k === "enrage") {
      foe.enraged = true;
      log(ch, foe.name + "的攻勢轉急。", "warn");
    } else if (k === "shift") {
      const typ = pick(ch, ["slash", "pierce", "blunt"]);
      foe.resist = { slash: 0.25, pierce: 0.25, blunt: 0.25 };
      foe.resist[typ] = 0;
      log(ch, "弱點悄悄換了位置。", "sys");
    } else if (k === "multi") {
      for (let i = 0; i < 3; i++) dealToPlayer(state, ch, foe, foe.atk * 0.7, now);
    } else if (k === "drain") {
      const took = dealToPlayer(state, ch, foe, foe.atk * 1.2, now);
      foe.hp = Math.min(foe.hpMax, foe.hp + took);
    }
  }

  function tickDots(state, ch, now, dt) {
    ch._dotAcc = (ch._dotAcc || 0) + dt;
    if (ch._dotAcc < 1000) return;
    ch._dotAcc -= 1000;
    if (hasStatus(ch, "dot")) {
      const st = (ch.statuses || []).find(function (s) { return s.id === "dot"; });
      const dmg = Math.max(1, st && st.power ? st.power : Math.round(ch.hpMax * 0.03));
      ch.hp -= dmg;
      log(ch, "持續損傷 " + dmg + " 點。", "harm");
    }
    (ch.combat && ch.combat.foes || []).forEach(function (foe) {
      if (foe.hp <= 0) return;
      if (hasStatus(foe, "dot")) {
        const st = foe.statuses.find(function (s) { return s.id === "dot"; });
        const dmg = Math.max(1, Math.round((st && st.power ? st.power : 0.18) * ensureDerived(ch).atk));
        foe.hp -= dmg;
        log(ch, "「" + foe.name + "」持續失力 " + dmg + " 點。", "hit");
      }
      if (foe.shelled && !hasStatus(foe, "shell")) foe.shelled = false;
    });
  }

  function cleanupFoes(state, ch) {
    if (!ch.combat) return;
    ch.combat.foes.forEach(function (foe) {
      if (foe.hp <= 0 && !foe._looted) {
        foe._looted = true;
        foe.hp = 0;
        bestiary(ch, foe, true);
        loot(state, ch, foe, foe.isBoss);
        if (foe.isBoss) onBossDown(state, ch, foe);
        achieve(state, "a_first_kill");
      }
    });
    const live = ch.combat.foes.filter(function (f) { return f.hp > 0; });
    if (!live.length) {
      ch.combat = null;
      ch.telegraph = null;
      const z = D().ZONE[ch.loc.zone];
      ch.spawnWait = (z && z.delay) || 600;
      if (ch.loc.zone === "boss") {
        ch.loc.zone = "gate";
        ch.hunting = false;
      }
    }
  }

  function onBossDown(state, ch, foe) {
    questProgress(state, ch, "boss", foe);
    achieve(state, "a_first_boss");
    ch.bossUntil = (ch._now || Date.now()) + D().BOSS_RESPAWN;
    const fl = ch.loc.floor;
    if (!ch.cleared) ch.cleared = {};
    if (!ch.cleared[fl]) {
      ch.cleared[fl] = true;
      if (fl < 20) {
        ch.maxFloor = Math.max(ch.maxFloor || 1, fl + 1);
        log(ch, "往上的階梯現了出來。下一層是「" + floorById(fl + 1).town + "」。", "sys");
        if (ch.maxFloor >= 5) achieve(state, "a_floor5");
        if (ch.maxFloor >= 10) achieve(state, "a_floor10");
        if (ch.maxFloor >= 15) achieve(state, "a_floor15");
        if (ch.maxFloor >= 20) achieve(state, "a_floor20");
      } else {
        ch.maxFloor = 20;
        log(ch, "門開了一道縫。這場長夢記得你來到過頂處。", "sys");
        achieve(state, "a_clear20");
      }
    } else {
      log(ch, "頭目散去，稍後仍會再聚。", "sys");
    }
  }

  function deathReturn(state, ch, cause) {
    const f = floorById(ch.loc.floor);
    const z = D().ZONE[ch.loc.zone] || { name: "未知處" };
    const rec = {
      t: Date.now(),
      name: ch.name,
      id: ch.id,
      level: ch.level,
      floor: ch.loc.floor,
      zone: z.name,
      town: f ? f.town : "",
      cause: cause || "力竭"
    };
    state.chronicle = state.chronicle || [];
    state.chronicle.unshift(rec);
    if (state.chronicle.length > 50) state.chronicle.length = 50;
    ch.deaths = (ch.deaths || 0) + 1;
    ch.pendingDeath = rec;
    ch.combat = null;
    ch.telegraph = null;
    ch.hunting = false;
    const safe = (ch.lastSafe && ch.lastSafe.floor) || 1;
    ch.loc = { floor: safe, zone: "town" };
    const d = ensureDerived(ch);
    ch.hp = Math.max(1, Math.round(d.hpMax * 0.35));
    ch.spawnWait = 0;
    ch.statuses = [];
    log(ch, "力竭。你在「" + rec.town + "·" + rec.zone + "」倒下，醒回最後的安穩城中。", "warn");
    achieve(state, "a_wake");
  }

  function tickCooldowns(ch, dt) {
    ch.atkCd = Math.max(0, (ch.atkCd || 0) - dt);
    ch.potionCd = Math.max(0, (ch.potionCd || 0) - dt);
    ch.skillCd = ch.skillCd || {};
    Object.keys(ch.skillCd).forEach(function (k) {
      ch.skillCd[k] = Math.max(0, ch.skillCd[k] - dt);
    });
    if (ch.spawnWait) ch.spawnWait = Math.max(0, ch.spawnWait - dt);
    (ch.combat && ch.combat.foes || []).forEach(function (foe) {
      foe.cd = Math.max(0, (foe.cd || 0) - dt);
    });
  }

  function maybeAutoBoss(state, ch) {
    if (ch.loc.zone !== "gate") return;
    if (!state.settings || !state.settings.autoBoss) return;
    if (ch.hp < ch.hpMax) return;
    if (!bossUp(ch)) return;
    if (ch.combat) return;
    enterBoss(state, ch);
  }

  function enterBoss(state, ch) {
    if (ch.loc.zone !== "gate" && ch.loc.zone !== "boss") return { ok: false, err: "要先到頭目關前。" };
    if (!bossUp(ch)) return { ok: false, err: "頭目尚未再聚。" };
    ch.loc.zone = "boss";
    ch.hunting = true;
    ch.spawnWait = 0;
    ch.combat = null;
    ensureEncounter(state, ch);
    return { ok: true };
  }

  function tick(state, dt, now) {
    const ch = active(state);
    if (!ch || ch.retired) return;
    now = now || Date.now();
    ch._now = now;
    ch._state = state;
    ensureDerived(ch);
    pruneStatus(ch, now);
    (ch.combat && ch.combat.foes || []).forEach(function (f) { f._now = now; pruneStatus(f, now); });
    tickCooldowns(ch, dt);
    maybeAutoBoss(state, ch);
    const hunting = !!ch.hunting && ch.loc.zone !== "town" && ch.loc.zone !== "gate";
    if (hunting) {
      ensureEncounter(state, ch);
      if (ch.combat) {
        const d = ensureDerived(ch);
        tickDots(state, ch, now, dt);
        if (ch.hp <= 0) { deathReturn(state, ch, "持續損傷"); return; }
        trySkills(state, ch, d, now);
        cleanupFoes(state, ch);
        if (!ch.hunting) return;
        if (ch.combat) {
          let interval = d.interval;
          if (hasStatus(ch, "slow")) interval *= 1.45;
          if (hasStatus(ch, "haste")) interval *= 0.8;
          if ((ch.atkCd || 0) <= 0) {
            playerSwing(state, ch, d, now);
            ch.atkCd = interval;
          }
          cleanupFoes(state, ch);
          if (!ch.hunting) return;
        }
        if (ch.combat) {
          ch.combat.foes.forEach(function (foe) {
            if (foe.hp <= 0) return;
            let interval = foe.interval;
            if (hasStatus(foe, "slow")) interval *= 1.45;
            if ((foe.cd || 0) <= 0 && !(foe.teleUntil && now < foe.teleUntil)) {
              foeAct(state, ch, foe, now);
              foe.cd = interval;
            } else if (foe.teleUntil && now >= foe.teleUntil && foe.teleKind) {
              foeAct(state, ch, foe, now);
              foe.cd = interval;
            }
          });
        }
        if (ch.hp <= 0) {
          const foe = (ch.combat && ch.combat.foes || []).find(function (f) { return f.hp > 0; });
          deathReturn(state, ch, foe ? ("死於「" + foe.name + "」") : "力竭");
          return;
        }
      }
    }
    if (ch.telegraph && ch.telegraph.until < now) ch.telegraph = null;
    maybeStory(state, ch);
  }

  function maybeStory(state, ch) {
    D().STORIES.forEach(function (s) {
      if (ch.storySeen && ch.storySeen.indexOf(s.id) >= 0) return;
      if (ch.loc.floor >= s.floor && ch.loc.zone === "town" && ch.maxFloor >= s.floor) {
        ch.storySeen = ch.storySeen || [];
        ch.storySeen.push(s.id);
        ch.pendingStory = s;
      }
    });
  }

  function catchUp(state, now) {
    const ch = active(state);
    if (!ch) {
      state.lastTick = now;
      return { ran: 0 };
    }
    const last = ch.lastTick || state.lastTick || now;
    let elapsed = now - last;
    if (elapsed < 20) {
      ch.lastTick = now;
      state.lastTick = now;
      return { ran: 0 };
    }
    const cap = D().MAX_OFFLINE;
    if (elapsed > cap) elapsed = cap;
    let ran = 0;
    const step = elapsed > 60000 ? 250 : 100;
    while (ran < elapsed) {
      const dt = Math.min(step, elapsed - ran);
      const tNow = last + ran + dt;
      tick(state, dt, tNow);
      ran += dt;
      if (!ch.hunting && ch.loc.zone === "town") break; // died or stopped
    }
    ch.lastTick = now;
    state.lastTick = now;
    return { ran: ran };
  }

  function createCharacter(name, styleId, now) {
    now = now || Date.now();
    const st = styleById(styleId) || D().STYLES[0];
    const ch = {
      id: "c" + now.toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      name: String(name || "無名").slice(0, 12),
      style: st.id,
      createdAt: now,
      lastTick: now,
      level: 1,
      exp: 0,
      gold: 50,
      floor: 1,
      maxFloor: 1,
      loc: { floor: 1, zone: "town" },
      lastSafe: { floor: 1 },
      base: { str: 8 + st.str, agi: 8 + st.agi, vit: 8 + st.vit },
      talents: [],
      talentPicks: 0,
      skills: defaultSkills(st.id),
      unlockedSkills: [],
      skillCd: {},
      equip: { weapon: null, offhand: null, head: null, body: null, hands: null, feet: null, neck: null, ear: null, ring1: null, ring2: null },
      bag: [],
      ground: [],
      quests: { active: ["q_f1_kill", "q_f1_boss"], completed: [], progress: {} },
      storySeen: [],
      bestiary: {},
      drops: [],
      hunting: false,
      combat: null,
      retired: false,
      deaths: 0,
      cleared: {},
      seed: (now ^ Math.floor(Math.random() * 1e9)) >>> 0,
      seq: 1,
      log: [],
      statuses: [],
      atkCd: 0,
      potionCd: 0
    };
    unlockSkills(ch);
    ch.equip.weapon = startingWeapon(ch);
    givePotion(null, ch, "potion_s", 3);
    giveMat(null, ch, "stone_dream", 2);
    ensureDerived(ch);
    ch.hp = ch.hpMax;
    log(ch, "你在初醒津的渡口睜開眼睛。燈還亮着。", "sys");
    return ch;
  }

  function active(state) {
    if (!state || !state.slots) return null;
    return state.slots.find(function (c) { return c.id === state.activeId; }) || null;
  }

  function go(state, zone, floor) {
    const ch = active(state);
    if (!ch) return { ok: false, err: "沒有進行中的角色。" };
    if (floor != null) {
      if (floor < 1 || floor > (ch.maxFloor || 1)) return { ok: false, err: "那層的階梯還未現。" };
      ch.loc.floor = floor;
    }
    if (zone === "town") {
      ch.loc.zone = "town";
      ch.hunting = false;
      ch.combat = null;
      ch.telegraph = null;
      ch.lastSafe = { floor: ch.loc.floor };
      log(ch, "你回到「" + floorById(ch.loc.floor).town + "」。", "sys");
      questProgress(state, ch, "reach");
      maybeStory(state, ch);
      return { ok: true };
    }
    if (ch.hp <= 0) return { ok: false, err: "你已力竭。" };
    const allowed = ["field", "wilds", "labyrinth", "gate"];
    if (allowed.indexOf(zone) < 0) return { ok: false, err: "去不了那裡。" };
    ch.loc.zone = zone;
    ch.combat = null;
    if (zone === "gate") {
      ch.hunting = false;
      log(ch, "你來到頭目關前。", "sys");
    } else {
      ch.hunting = true;
      ch.spawnWait = 300;
      log(ch, "你走向" + D().ZONE[zone].name + "。", "sys");
    }
    return { ok: true };
  }

  function rest(state) {
    const ch = active(state);
    if (!ch) return { ok: false };
    if (ch.loc.zone !== "town") return { ok: false, err: "只有城中可以安歇。" };
    const d = ensureDerived(ch);
    ch.hp = d.hpMax;
    ch.statuses = [];
    log(ch, "你在客棧歇了一程，氣力已回。", "heal");
    return { ok: true };
  }

  function usePotion(state, iid) {
    const ch = active(state);
    if (!ch) return { ok: false };
    const it = (ch.bag || []).find(function (x) { return x.iid === iid; });
    if (!it || it.kind !== "potion") return { ok: false, err: "沒有這瓶藥。" };
    if ((ch.potionCd || 0) > 0) return { ok: false, err: "藥力尚未散。" };
    const tf = talentFx(ch);
    const heal = Math.round((it.heal || 40) * (1 + (tf.potion || 0)));
    ch.hp = Math.min(ch.hpMax, ch.hp + heal);
    it.count -= 1;
    if (it.count <= 0) ch.bag = ch.bag.filter(function (x) { return x.iid !== iid; });
    ch.potionCd = (it.cd || 8000) * (1 - (tf.potionCd || 0));
    log(ch, "你飲下「" + it.name + "」，恢復 " + heal + " 點。", "heal");
    return { ok: true };
  }

  function emptySlot(ch, slot) {
    const it = ch.equip[slot];
    if (!it) return;
    if (bagCount(ch) >= bagLimit(ch)) {
      ch.ground.push(it);
    } else ch.bag.push(it);
    ch.equip[slot] = null;
  }

  function equipItem(state, iid, slotForce) {
    const ch = active(state);
    const it = (ch.bag || []).find(function (x) { return x.iid === iid; });
    if (!it || it.kind !== "gear") return { ok: false, err: "不能裝備這個。" };
    let slot = slotForce || it.slot;
    if (it.slot === "ring1" || it.slot === "ring2") {
      slot = !ch.equip.ring1 ? "ring1" : (!ch.equip.ring2 ? "ring2" : "ring1");
    }
    if (it.slot !== "ring1" && it.slot !== "ring2" && slot !== it.slot && !(it.slot === "weapon" && slot === "weapon")) {
      slot = it.slot;
    }
    ch.bag = ch.bag.filter(function (x) { return x.iid !== iid; });
    emptySlot(ch, slot);
    ch.equip[slot] = it;
    ensureDerived(ch);
    log(ch, "你裝備了「" + it.name + "」。", "sys");
    return { ok: true };
  }

  function unequip(state, slot) {
    const ch = active(state);
    if (!ch.equip[slot]) return { ok: false };
    if (bagCount(ch) >= bagLimit(ch)) return { ok: false, err: "背包已滿。" };
    emptySlot(ch, slot);
    ensureDerived(ch);
    return { ok: true };
  }

  function setJunk(state, iid, flag) {
    const ch = active(state);
    const it = (ch.bag || []).find(function (x) { return x.iid === iid; });
    if (it) it.junk = !!flag;
  }

  function sellJunk(state) {
    const ch = active(state);
    if (ch.loc.zone !== "town") return { ok: false, err: "要在城中才能賣出。" };
    let gold = 0, n = 0;
    ch.bag = (ch.bag || []).filter(function (it) {
      if (!it.junk || it.kind === "potion" || it.kind === "mat") return true;
      gold += sellPrice(it);
      n += 1;
      return false;
    });
    addGold(state, ch, gold, "出售");
    log(ch, "賣出廢物 " + n + " 件，得 " + gold + " 金。", "loot");
    return { ok: true, gold: gold, n: n };
  }

  function sellOne(state, iid) {
    const ch = active(state);
    if (ch.loc.zone !== "town") return { ok: false, err: "要在城中才能賣出。" };
    const it = (ch.bag || []).find(function (x) { return x.iid === iid; });
    if (!it) return { ok: false };
    if (it.kind === "mat") return { ok: false, err: "材料請留作強化，或單獨處理。" };
    const g = sellPrice(it);
    ch.bag = ch.bag.filter(function (x) { return x.iid !== iid; });
    addGold(state, ch, g, "出售");
    log(ch, "賣出「" + it.name + "」，得 " + g + " 金。", "loot");
    return { ok: true };
  }

  function sellPrice(it) {
    const r = D().RARITY.find(function (x) { return x.id === it.rarity; });
    const m = r ? r.mult : 1;
    if (it.kind === "potion") return Math.max(1, Math.round((it.count || 1) * 4));
    return Math.max(1, Math.round((3 + (it.floor || 1) * 2) * m + (it.enh || 0) * 6));
  }

  function meltJunk(state) {
    const ch = active(state);
    if (ch.loc.zone !== "town") return { ok: false, err: "要在城中才能融解。" };
    let stones = 0, sands = 0, n = 0;
    ch.bag = (ch.bag || []).filter(function (it) {
      if (!it.junk || it.kind !== "gear") return true;
      n += 1;
      stones += 1;
      if (it.rarity === "shang" || it.rarity === "zhen" || it.rarity === "ji") sands += 1;
      if (it.rarity === "zhen" || it.rarity === "ji") stones += 1;
      return false;
    });
    if (stones) giveMat(state, ch, "stone_dream", stones);
    if (sands) giveMat(state, ch, "sand_soul", sands);
    log(ch, "融解 " + n + " 件，得夢屑石 " + stones + (sands ? "、定魂砂 " + sands : "") + "。", "loot");
    return { ok: true, n: n, stones: stones, sands: sands };
  }

  function enhanceRate(it) {
    const rates = [0.92, 0.8, 0.68, 0.54, 0.4, 0.28, 0.18, 0.12, 0.08];
    return rates[Math.min(it.enh || 0, rates.length - 1)];
  }
  function enhanceCost(it) {
    const e = it.enh || 0;
    return {
      gold: Math.round(20 * (it.floor || 1) * (1 + e * 0.7)),
      stone: 1 + Math.floor(e / 2),
      sand: e >= 3 ? 1 : 0
    };
  }
  function countMat(ch, id) {
    const it = (ch.bag || []).find(function (x) { return x.matId === id; });
    return it ? (it.count || 0) : 0;
  }
  function takeMat(ch, id, n) {
    const it = (ch.bag || []).find(function (x) { return x.matId === id; });
    if (!it || it.count < n) return false;
    it.count -= n;
    if (it.count <= 0) ch.bag = ch.bag.filter(function (x) { return x.matId !== id; });
    return true;
  }

  function enhance(state, iid) {
    const ch = active(state);
    if (ch.loc.zone !== "town") return { ok: false, err: "要在城中強化。" };
    const it = findGear(ch, iid);
    if (!it) return { ok: false, err: "找不到這件裝備。" };
    if ((it.enh || 0) >= 8) return { ok: false, err: "已至上限。" };
    const cost = enhanceCost(it);
    if (ch.gold < cost.gold) return { ok: false, err: "金幣不足。" };
    if (countMat(ch, "stone_dream") < cost.stone) return { ok: false, err: "夢屑石不足。" };
    if (cost.sand && countMat(ch, "sand_soul") < cost.sand) return { ok: false, err: "定魂砂不足。" };
    addGold(state, ch, -cost.gold, "強化");
    takeMat(ch, "stone_dream", cost.stone);
    if (cost.sand) takeMat(ch, "sand_soul", cost.sand);
    const rate = enhanceRate(it);
    if (rng(ch) < rate) {
      it.enh = (it.enh || 0) + 1;
      ensureDerived(ch);
      log(ch, "「" + it.name + "」強化至 +" + it.enh + "。", "loot");
      achieve(state, "a_enh");
      return { ok: true, success: true, rate: rate };
    }
    log(ch, "「" + it.name + "」強化未成。物還在，材料已耗。", "warn");
    return { ok: true, success: false, rate: rate };
  }

  function findGear(ch, iid) {
    const eq = Object.keys(ch.equip).map(function (k) { return ch.equip[k]; });
    return (ch.bag || []).concat(eq).find(function (x) { return x && x.iid === iid; });
  }

  function pickupAll(state) {
    const ch = active(state);
    let n = 0;
    ch.ground = (ch.ground || []).filter(function (it) {
      if (bagCount(ch) >= bagLimit(ch)) return true;
      ch.bag.push(it);
      n += 1;
      return false;
    });
    if (n) log(ch, "拾起 " + n + " 件。", "loot");
    return { ok: true, n: n };
  }

  function shopList(ch) {
    const f = ch.loc.floor;
    const list = [];
    D().POTIONS.forEach(function (p) {
      if (p.id === "potion_l" && f < 8) return;
      if (p.id === "potion_m" && f < 3) return;
      list.push({ kind: "potion", id: p.id, name: p.name, desc: p.desc, cost: Math.round(p.cost * (1 + (f - 1) * 0.06)) });
    });
    D().MATS.forEach(function (m) {
      list.push({ kind: "mat", id: m.id, name: m.name, desc: m.desc, cost: Math.round(m.cost * (1 + (f - 1) * 0.08)) });
    });
    list.push({ kind: "gear", id: "shop_weapon", name: floorById(f).prefix + "備刃", desc: "本層鐵匠現成的武器。", cost: 40 + f * 22, slot: "weapon" });
    list.push({ kind: "gear", id: "shop_body", name: floorById(f).prefix + "備衣", desc: "本層縫就的護身。", cost: 36 + f * 20, slot: "body" });
    return list;
  }

  function buy(state, shopId) {
    const ch = active(state);
    if (ch.loc.zone !== "town") return { ok: false, err: "要在城中購買。" };
    const item = shopList(ch).find(function (x) { return x.id === shopId; });
    if (!item) return { ok: false, err: "店裡沒有這個。" };
    if (ch.gold < item.cost) return { ok: false, err: "金幣不足。" };
    if (bagCount(ch) >= bagLimit(ch)) return { ok: false, err: "背包已滿。" };
    addGold(state, ch, -item.cost, "購買");
    if (item.kind === "potion") givePotion(state, ch, item.id, 1);
    else if (item.kind === "mat") giveMat(state, ch, item.id, 1);
    else {
      const g = makeItem(ch, ch.loc.floor, item.slot, "liang");
      g.name = item.name;
      giveItem(state, ch, g, true);
    }
    log(ch, "買下「" + item.name + "」。", "sys");
    return { ok: true };
  }

  function acceptQuest(state, qid) {
    const ch = active(state);
    const q = D().QUESTS.find(function (x) { return x.id === qid; });
    if (!q) return { ok: false };
    if (ch.loc.floor < q.floor && q.type !== "reach") return { ok: false, err: "尚未走到那一層。" };
    if (ch.quests.completed.indexOf(qid) >= 0) return { ok: false, err: "已經完成。" };
    if (ch.quests.active.indexOf(qid) >= 0) return { ok: false };
    ch.quests.active.push(qid);
    log(ch, "接下委託「" + q.name + "」。", "sys");
    questProgress(state, ch, "collect");
    questProgress(state, ch, "reach");
    return { ok: true };
  }

  function turnIn(state, qid) {
    const ch = active(state);
    if (ch.loc.zone !== "town") return { ok: false, err: "要在城中交付。" };
    const q = D().QUESTS.find(function (x) { return x.id === qid; });
    if (!q || ch.quests.active.indexOf(qid) < 0) return { ok: false };
    const need = q.target || 1;
    const p = (ch.quests.progress || {})[qid] || 0;
    if (q.type === "boss" || q.type === "reach") {
      if (p < 1) return { ok: false, err: "尚未完成。" };
    } else if (p < need) return { ok: false, err: "尚未完成。" };
    ch.quests.active = ch.quests.active.filter(function (x) { return x !== qid; });
    ch.quests.completed.push(qid);
    addGold(state, ch, q.gold, "委託");
    grantExp(ch, q.exp);
    log(ch, "交付「" + q.name + "」。獲 " + q.gold + " 金、閱歷 " + q.exp + "。", "loot");
    return { ok: true };
  }

  function takeStory(state) {
    const ch = active(state);
    const s = ch.pendingStory;
    if (!s) return { ok: false };
    addGold(state, ch, s.gold || 0, "記事");
    if (s.exp) grantExp(ch, s.exp);
    log(ch, "你把這段夢記了下來。", "sys");
    ch.pendingStory = null;
    return { ok: true };
  }

  function assignSkill(state, slot, skillId) {
    const ch = active(state);
    if (slot < 0 || slot > 3) return { ok: false };
    if (skillId && ch.unlockedSkills.indexOf(skillId) < 0) return { ok: false, err: "尚未領會。" };
    if (skillId) {
      const ix = ch.skills.indexOf(skillId);
      if (ix >= 0) ch.skills[ix] = null;
    }
    ch.skills[slot] = skillId || null;
    return { ok: true };
  }

  function pickTalent(state, id) {
    const ch = active(state);
    if ((ch.talentPicks || 0) <= 0) return { ok: false, err: "此刻沒有可選的夢象。" };
    if (ch.talents.indexOf(id) >= 0) return { ok: false, err: "已經選過。" };
    const t = talentById(id);
    if (!t) return { ok: false };
    ch.talents.push(id);
    ch.talentPicks -= 1;
    ensureDerived(ch);
    log(ch, "你選了夢象「" + t.name + "」。", "sys");
    return { ok: true };
  }

  function offerTalents(ch) {
    const have = ch.talents || [];
    return D().TALENTS.filter(function (t) { return have.indexOf(t.id) < 0; }).slice(0, 6);
  }

  function newState(now) {
    now = now || Date.now();
    return {
      v: D().VERSION,
      settings: { fontScale: 1, logVerbosity: 1, autoPickup: true, autoBoss: false, reduceMotion: false },
      slots: [],
      activeId: null,
      chronicle: [],
      achievements: {},
      ledger: [],
      lastTick: now
    };
  }

  G.sim = {
    rng, derived, ensureDerived, createCharacter, active, tick, catchUp,
    go, rest, usePotion, equipItem, unequip, setJunk, sellJunk, sellOne,
    meltJunk, enhance, enhanceRate, enhanceCost, pickupAll, shopList, buy,
    acceptQuest, turnIn, takeStory, assignSkill, pickTalent, offerTalents,
    enterBoss, bossUp, log, expToLevel, findGear, addGold, achieve,
    newState, bagCount, bagLimit, countMat, grantExp, makeItem, floorById,
    styleById, skillById, talentById, itemStats, statusName, givePotion, giveMat
  };
})(window.Yiming = window.Yiming || {});

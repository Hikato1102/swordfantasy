/* 《長夢一命》 static content. Original writing only. */
(function (G) {
  "use strict";

  const DMG = { slash: "斬", pierce: "刺", blunt: "打" };

  const STYLES = [
    { id: "jian", name: "劍", dmg: "slash", str: 2, agi: 1, vit: 1, interval: 1, desc: "端穩的直刃，斬勢均衡。" },
    { id: "xijian", name: "細劍", dmg: "pierce", str: 0, agi: 3, vit: 1, interval: 0.88, desc: "輕而準，專走縫隙。" },
    { id: "taidao", name: "太刀", dmg: "slash", str: 3, agi: 1, vit: 0, interval: 1.12, desc: "刃長勢沉，一揮見開。" },
    { id: "fu", name: "斧", dmg: "slash", str: 4, agi: 0, vit: 0, interval: 1.22, desc: "以重破守，慢而狠。" },
    { id: "yang", name: "鍚", dmg: "blunt", str: 2, agi: 0, vit: 2, interval: 1.15, desc: "錫裹木桿，專擊骨節。" },
    { id: "lian", name: "鐮刀", dmg: "slash", str: 2, agi: 2, vit: 0, interval: 1.05, desc: "弧刃會繞過正面。" },
    { id: "duan", name: "短刃", dmg: "pierce", str: 1, agi: 3, vit: 0, interval: 0.8, desc: "近身連刺，步法較疾。" },
    { id: "sheng", name: "聖印", dmg: "blunt", str: 1, agi: 0, vit: 3, interval: 1.1, desc: "以印為兵，守多於攻。" }
  ];

  const RARITY = [
    { id: "fan", name: "凡", cls: "r-fan", w: 62, mult: 1 },
    { id: "liang", name: "良", cls: "r-liang", w: 24, mult: 1.18 },
    { id: "shang", name: "上", cls: "r-shang", w: 10, mult: 1.4 },
    { id: "zhen", name: "珍", cls: "r-zhen", w: 3.2, mult: 1.7 },
    { id: "ji", name: "極", cls: "r-ji", w: 0.8, mult: 2.1 }
  ];

  const SLOTS = [
    { id: "weapon", name: "武器" },
    { id: "offhand", name: "副手" },
    { id: "head", name: "頭" },
    { id: "body", name: "身" },
    { id: "hands", name: "手" },
    { id: "feet", name: "足" },
    { id: "neck", name: "頸" },
    { id: "ear", name: "耳" },
    { id: "ring1", name: "戒指" },
    { id: "ring2", name: "戒指" }
  ];

  const SLOT_NOUN = {
    weapon: { slash: "刃", pierce: "鋒", blunt: "桿" },
    offhand: "副器",
    head: "冠",
    body: "衣",
    hands: "手套",
    feet: "履",
    neck: "墜",
    ear: "珥",
    ring1: "戒",
    ring2: "戒"
  };

  function scale(floor, hp, atk, def, exp, gold) {
    const f = Math.max(0, floor - 1);
    return {
      hp: Math.round(hp * Math.pow(1.23, f)),
      atk: Math.round(atk * Math.pow(1.19, f)),
      def: Math.round(def * Math.pow(1.17, f)),
      exp: Math.round(exp * Math.pow(1.21, f)),
      gold: Math.round(gold * Math.pow(1.18, f))
    };
  }

  const FLOORS = [
    {
      id: 1, town: "初醒津", prefix: "津霧",
      desc: "河霧未散，渡口的燈還亮着。夢從這裡開始記得自己。",
      mon: [
        ["mistmoth", "霧蛾", "blunt", 28, 5, 1, 6, 3],
        ["fordcrab", "淺灘蟹", "blunt", 36, 6, 3, 7, 4],
        ["reeddog", "蘆間遊犬", "slash", 32, 7, 1, 8, 4],
        ["wetfrog", "濕石蛙", "blunt", 34, 6, 2, 7, 3],
        ["lampfish", "燈影魚", "pierce", 26, 6, 0, 8, 5]
      ],
      boss: ["lampwarden", "津口燈守", "blunt", 220, 12, 4, 40, 28, "enrage", "燈火驟旺，攻勢轉急。"]
    },
    {
      id: 2, town: "燈草巷", prefix: "燈草",
      desc: "巷弄窄而暖，家家戶戶晒着燈草。風一過，整條街輕輕搖晃。",
      mon: [
        ["wickrat", "燈草鼠", "pierce", 30, 6, 1, 8, 4],
        ["coremoth", "焦芯蛾", "blunt", 28, 7, 0, 8, 4],
        ["lanecat", "巷尾貓影", "slash", 34, 8, 2, 9, 5],
        ["waxbug", "蠟淚蟲", "blunt", 36, 6, 3, 8, 4],
        ["rackcrow", "晒架鴉", "pierce", 32, 7, 1, 9, 5]
      ],
      boss: ["lanelady", "長明巷姥", "blunt", 280, 14, 5, 55, 36, "pulse", "她舉起一盞燈，整巷亮得發白。"]
    },
    {
      id: 3, town: "霧銅埠", prefix: "霧銅",
      desc: "碼頭被銅鏽與霧氣包着，船鐘隔很久才響一次。",
      mon: [
        ["anchorcrab", "鏽錨蟹", "blunt", 38, 7, 4, 9, 5],
        ["copperant", "銅霧工蟻", "pierce", 30, 8, 2, 9, 5],
        ["dockcrow", "碼頭鴉", "slash", 33, 8, 1, 10, 6],
        ["tidesnake", "潮縫蛇", "pierce", 32, 9, 1, 10, 5],
        ["nairat", "銹釘鼠", "pierce", 31, 7, 2, 9, 5]
      ],
      boss: ["bronzecoloss", "泊岸銅魁", "blunt", 360, 16, 8, 70, 48, "sunder", "銅臂砸下，防護如紙。"]
    },
    {
      id: 4, town: "霜釀谷", prefix: "霜釀",
      desc: "谷中酒窖終年結霜，呼吸都會帶一點甜而冷的香。",
      mon: [
        ["frostbee", "霜蜂", "pierce", 30, 8, 1, 10, 6],
        ["brewtanuki", "釀泥貍", "blunt", 38, 8, 3, 11, 6],
        ["iceserow", "凍穗鹿", "slash", 40, 9, 2, 12, 7],
        ["cellarrat", "冰窖鼠", "pierce", 32, 8, 1, 10, 5],
        ["sugarspider", "糖霜蛛", "pierce", 34, 9, 2, 11, 6]
      ],
      boss: ["cellarmaster", "窖底釀君", "blunt", 430, 18, 7, 90, 58, "slow", "冷霧散開，手腳都沉了半拍。"]
    },
    {
      id: 5, town: "雁書驛", prefix: "雁書",
      desc: "舊驛站堆着沒送出的信。風過庭除，紙頁自己翻動。",
      mon: [
        ["paperkite", "紙鳶雀", "pierce", 32, 9, 1, 12, 7],
        ["inkbug", "墨點蟲", "blunt", 34, 9, 2, 12, 6],
        ["postdog", "驛犬", "slash", 42, 10, 3, 13, 8],
        ["cordsnake", "信繩蛇", "pierce", 36, 10, 1, 13, 7],
        ["dustmoth", "塵封蠹", "slash", 33, 8, 2, 11, 6]
      ],
      boss: ["unsentname", "未寄之名", "blunt", 520, 20, 8, 110, 72, "summon", "信紙直立起來，結成沒有臉的影。"]
    },
    {
      id: 6, town: "沈鐘臺", prefix: "沈鐘",
      desc: "臺上古鐘半埋土中，偶爾從地底傳來一下極低的鳴響。",
      mon: [
        ["soilcicada", "土蟄蟬", "blunt", 36, 10, 2, 13, 7],
        ["mossfrog", "苔鐘蛙", "blunt", 40, 10, 3, 13, 7],
        ["stepfox", "臺階狐", "slash", 38, 11, 2, 14, 8],
        ["burierat", "埋聲鼠", "pierce", 34, 10, 1, 13, 7],
        ["verdliz", "銅鏽蜥", "slash", 41, 11, 3, 14, 8]
      ],
      boss: ["latebell", "遲鳴之鐘", "blunt", 640, 22, 10, 140, 88, "stun", "鐘聲遲來，卻把所有動作都按住。"]
    },
    {
      id: 7, town: "白棘原", prefix: "白棘",
      desc: "原上盡是蒼白的棘草，月光一照，像一片不能走的雪。",
      mon: [
        ["thornhare", "白棘兔", "pierce", 36, 11, 2, 14, 8],
        ["thorwolf", "刺原狼", "slash", 46, 13, 3, 16, 9],
        ["bonecrow", "骨草鴉", "pierce", 38, 12, 1, 15, 8],
        ["awnsnake", "芒穗蛇", "pierce", 40, 12, 2, 15, 8],
        ["lonebadger", "原上孤獾", "slash", 48, 13, 4, 16, 9]
      ],
      boss: ["thornstag", "棘冠蒼鹿", "pierce", 760, 24, 12, 170, 104, "thorns", "棘冠一顫，攻擊會原路折返。"]
    },
    {
      id: 8, town: "鹽風渡", prefix: "鹽風",
      desc: "渡口的風帶着海鹽，木欄都白了一層。漁火在夜色裡不遠不近。",
      mon: [
        ["saltfish", "鹽鱗魚", "slash", 40, 12, 2, 16, 9],
        ["drygull", "風乾鷗", "pierce", 38, 13, 1, 16, 9],
        ["railcrab", "白欄蟹", "blunt", 50, 12, 5, 16, 10],
        ["brinejelly", "滷霧水母", "blunt", 42, 13, 2, 17, 9],
        ["tideliz", "灘塗蜥", "slash", 44, 13, 3, 17, 10]
      ],
      boss: ["brineenvoy", "鹽潮使", "blunt", 880, 26, 11, 200, 120, "dot", "鹽霧貼上皮膚，細細地咬。"]
    },
    {
      id: 9, town: "墨雨樓", prefix: "墨雨",
      desc: "這座樓裡終年下着細細的墨雨，石階被染得深黑，卻不髒。",
      mon: [
        ["inkbat", "墨滴蝠", "pierce", 42, 14, 2, 18, 10],
        ["bookworm", "濕書蠹", "slash", 40, 13, 2, 17, 10],
        ["hallcrane", "樓廊鶴影", "slash", 48, 15, 3, 19, 11],
        ["dyefrog", "染階蛙", "blunt", 46, 14, 3, 18, 10],
        ["nibsnake", "筆鋒蛇", "pierce", 44, 15, 2, 19, 11]
      ],
      boss: ["inkhost", "淋墨樓主", "slash", 1020, 28, 13, 240, 140, "shift", "墨幕一掩，他的弱點便悄悄換了位置。"]
    },
    {
      id: 10, town: "赤瓷窯", prefix: "赤瓷",
      desc: "窯火不曾真正熄過。空氣裡有熱土與釉藥的氣味。",
      mon: [
        ["kilnliz", "焙土蜥", "slash", 50, 15, 4, 20, 12],
        ["glazespider", "釉滴蛛", "pierce", 46, 16, 3, 20, 11],
        ["smokemoth", "窯煙蛾", "blunt", 44, 15, 2, 19, 11],
        ["shardrat", "碎瓷鼠", "slash", 45, 15, 3, 19, 11],
        ["firescorp", "火縫蝎", "pierce", 48, 17, 3, 21, 12]
      ],
      boss: ["kilngod", "未冷的窯神", "blunt", 1280, 32, 15, 300, 180, "heat", "窯門大開，熱浪一陣陣撲來。"]
    },
    {
      id: 11, town: "聽潮窟", prefix: "聽潮",
      desc: "洞窟把遠處的潮聲放大，像有人在壁後慢慢呼吸。",
      mon: [
        ["echobat", "回聲蝠", "pierce", 48, 16, 2, 21, 12],
        ["riftcrab", "潮隙蟹", "blunt", 56, 16, 6, 21, 13],
        ["dropsnail", "窟頂滴螺", "blunt", 52, 15, 5, 20, 12],
        ["listenworm", "聽水蚓", "blunt", 50, 17, 3, 22, 12],
        ["blindfish", "盲潮魚", "pierce", 46, 17, 2, 22, 13]
      ],
      boss: ["tidemother", "窟中潮母", "blunt", 1480, 34, 16, 340, 200, "summon", "回聲凝成第二個潮影。"]
    },
    {
      id: 12, town: "折戟灘", prefix: "折戟",
      desc: "灘上半埋着折斷的舊兵器，退潮時會露出無名的紋。",
      mon: [
        ["halberdcrab", "鏽戟蟹", "slash", 58, 17, 6, 23, 14],
        ["bonegull", "灘骨鷗", "pierce", 50, 18, 2, 23, 13],
        ["brokenliz", "斷刃蜥", "slash", 56, 19, 4, 24, 14],
        ["sunkfish", "沉鋒魚", "pierce", 52, 18, 3, 23, 14],
        ["sandbeetle", "沙埋甲蟲", "blunt", 60, 17, 7, 22, 13]
      ],
      boss: ["wreckgeneral", "折戟殘將", "slash", 1700, 37, 18, 390, 230, "multihit", "斷戟連點三處，勢如未死之人。"]
    },
    {
      id: 13, town: "金葉庭", prefix: "金葉",
      desc: "庭中落葉都薄如金箔，一踩就響，卻撿不起來。",
      mon: [
        ["leafsparrow", "金葉雀", "pierce", 50, 18, 2, 24, 14],
        ["courttanuki", "庭砌狸", "blunt", 60, 18, 5, 24, 15],
        ["foilmoth", "箔風蝶", "blunt", 48, 19, 2, 25, 14],
        ["leafsnake", "葉下蛇", "pierce", 54, 20, 3, 25, 15],
        ["bellbug", "銅鐘蟲", "blunt", 58, 18, 5, 24, 14]
      ],
      boss: ["leafclerk", "庭中金吏", "slash", 1900, 39, 17, 440, 260, "pulse", "金葉齊飛，滿庭都是割面的光。"]
    },
    {
      id: 14, town: "夜蛭沼", prefix: "夜蛭",
      desc: "沼面平靜得不像活水。燈一近，底下就有東西慢慢翻身。",
      mon: [
        ["nightleech", "夜蛭", "blunt", 56, 20, 3, 26, 15],
        ["bogmosquito", "沼燈蚊", "pierce", 48, 21, 1, 26, 15],
        ["reedcroc", "沉蘆鱷幼", "slash", 70, 21, 6, 28, 17],
        ["bubbafrog", "腐泡蛙", "blunt", 62, 20, 4, 26, 16],
        ["gausespider", "濕紗蛛", "pierce", 54, 21, 3, 27, 16]
      ],
      boss: ["bogheart", "沼心巨蛭", "blunt", 2200, 42, 18, 500, 300, "drain", "它貼上來，把暖氣一點點吸走。"]
    },
    {
      id: 15, town: "星鑄谷", prefix: "星鑄",
      desc: "谷底有人曾把星光當作金屬來鑄。殘渣還在石縫裡微微發亮。",
      mon: [
        ["slagliz", "星渣蜥", "slash", 64, 21, 5, 28, 17],
        ["casthawk", "鑄煙鷹", "pierce", 56, 23, 3, 29, 17],
        ["veinbug", "亮脈蟲", "blunt", 58, 21, 4, 27, 16],
        ["valleywolf", "谷風狼", "slash", 68, 23, 4, 30, 18],
        ["sandsrat", "熔砂鼠", "pierce", 54, 22, 3, 28, 17]
      ],
      boss: ["unfinishedstar", "未完成的星像", "blunt", 2500, 44, 22, 560, 340, "shell", "星渣自行閉合，結成一層暫時的殼。"]
    },
    {
      id: 16, town: "盲鏡廊", prefix: "盲鏡",
      desc: "走廊兩側都是不映出你的鏡子。有時鏡子裡會先走過一個背影。",
      mon: [
        ["faceless", "無面影", "blunt", 66, 23, 4, 30, 18],
        ["sharbug", "碎鏡蟲", "slash", 58, 24, 3, 30, 18],
        ["halldog", "廊風犬", "slash", 70, 24, 5, 31, 19],
        ["blindmoth", "盲光蛾", "blunt", 56, 23, 2, 29, 17],
        ["invertfrog", "倒置蛙", "blunt", 64, 23, 4, 30, 18]
      ],
      boss: ["corridorend", "廊盡之影", "slash", 2800, 46, 20, 640, 380, "split", "它在三成餘力時裂成兩道背影。"]
    },
    {
      id: 17, town: "骨笛砦", prefix: "骨笛",
      desc: "砦牆是白骨與黏土夯成的，風一過就有細細的笛聲。",
      mon: [
        ["boneraven", "骨哨烏", "pierce", 64, 25, 3, 32, 19],
        ["rammeddog", "夯土犬", "slash", 76, 25, 6, 33, 20],
        ["holesnake", "笛孔蛇", "pierce", 66, 26, 3, 33, 19],
        ["forthyena", "砦下鬣狗", "slash", 78, 26, 5, 34, 21],
        ["whitemud", "白泥甲蟲", "blunt", 80, 24, 8, 31, 19]
      ],
      boss: ["fortpiper", "吹砦人", "blunt", 3200, 48, 22, 720, 430, "dirge", "骨笛一聲，腳下的土都跟着發顫。"]
    },
    {
      id: 18, town: "裂空津", prefix: "裂空",
      desc: "渡口的天裂開一條縫，河水往天上流，又在半空折回來。",
      mon: [
        ["upfish", "倒飛魚", "pierce", 68, 26, 3, 34, 20],
        ["riftswallow", "裂雲燕", "pierce", 62, 28, 2, 35, 21],
        ["skycrab", "空河蟹", "blunt", 82, 25, 8, 33, 20],
        ["bendsnake", "折光蛇", "slash", 70, 27, 4, 35, 21],
        ["fallgull", "墜浪鷗", "slash", 66, 27, 3, 34, 20]
      ],
      boss: ["reversewarden", "逆流津尉", "slash", 3600, 52, 23, 820, 500, "enragepulse", "河水倒灌，他的刀勢也跟着加快。"]
    },
    {
      id: 19, town: "燼心階", prefix: "燼心",
      desc: "長階向上，兩旁是冷卻的灰燼。越走越高，心跳越像爐裡的餘溫。",
      mon: [
        ["embermoth", "燼蛾", "blunt", 70, 28, 3, 36, 22],
        ["ashdog", "灰階犬", "slash", 84, 29, 6, 37, 23],
        ["warmliz", "餘溫蜥", "slash", 78, 29, 5, 37, 22],
        ["coalcrow", "炭骨鴉", "pierce", 72, 30, 3, 38, 23],
        ["smotherscorp", "悶火蝎", "pierce", 76, 30, 4, 38, 23]
      ],
      boss: ["embergate", "燼心守門", "blunt", 4100, 56, 25, 940, 580, "burnsmash", "他高舉餘燼，隨後整段階都悶燒起來。"]
    },
    {
      id: 20, town: "終夢門", prefix: "終夢",
      desc: "門在最上面。門後沒有再高的階，只有一段像醒與未醒之間的靜。",
      mon: [
        ["lastmoth", "末燈蛾", "blunt", 76, 30, 4, 39, 24],
        ["knockerlion", "門環獅影", "slash", 92, 31, 7, 40, 25],
        ["thresholddog", "閾間犬", "slash", 88, 31, 6, 40, 24],
        ["wakesand", "醒砂蟲", "blunt", 80, 30, 5, 38, 23],
        ["remnantcrane", "殘夢鶴", "pierce", 78, 32, 4, 41, 25]
      ],
      boss: ["wakeguard", "守門的醒者", "blunt", 5200, 62, 28, 1200, 800, "finale", "他像要把這場長夢一次折斷。"]
    }
  ].map(function (f) {
    const mon = f.mon.map(function (m) {
      const idOk = m[0].replace(/\s+/g, "");
      const s = scale(f.id, m[3], m[4], m[5], m[6], m[7]);
      return {
        id: "f" + f.id + "_" + idOk,
        name: m[1],
        typ: m[2],
        hp: s.hp, atk: s.atk, def: s.def, exp: s.exp, gold: s.gold,
        resist: {}
      };
    });
    const b = f.boss;
    const sb = scale(f.id, b[3], b[4], b[5], b[6], b[7]);
    return {
      id: f.id,
      town: f.town,
      prefix: f.prefix,
      desc: f.desc,
      mon: mon,
      boss: {
        id: "b" + f.id + "_" + String(b[0]).replace(/\s+/g, ""),
        name: b[1],
        typ: b[2],
        hp: sb.hp, atk: sb.atk, def: sb.def, exp: sb.exp, gold: sb.gold,
        mechanic: b[8],
        telegraph: b[9],
        resist: {}
      }
    };
  });

  // fix accidental space in a couple of ids from typo-guard
  FLOORS.forEach(function (f) {
    f.mon.forEach(function (m) {
      m.id = m.id.replace(/\s+/g, "");
    });
  });

  const SKILLS = [
    { id: "riftcut", name: "裂風", typ: "slash", target: "single", hits: 1, coeff: 1.55, cd: 7000, unlock: { level: 1 }, desc: "把風切開的一刀。", status: null },
    { id: "needle", name: "連刺", typ: "pierce", target: "single", hits: 3, coeff: 0.62, cd: 8000, unlock: { level: 1 }, desc: "三點連成一線。" },
    { id: "knock", name: "點骨", typ: "blunt", target: "single", hits: 1, coeff: 1.45, cd: 7000, unlock: { level: 1 }, desc: "打在關節上。", status: { id: "sunder", chance: 0.35, dur: 5000 } },
    { id: "guardbreath", name: "守息", typ: null, target: "self", hits: 0, coeff: 0, cd: 14000, unlock: { level: 3 }, desc: "短時間內把傷害卸去一截。", self: { shield: 0.22, dur: 6000 } },
    { id: "dew", name: "回露", typ: null, target: "self", hits: 0, coeff: 0, cd: 16000, unlock: { level: 4 }, desc: "喚回一點夢體的水氣。", self: { heal: 0.18 } },
    { id: "sweep", name: "橫掃", typ: "slash", target: "all", hits: 1, coeff: 1.05, cd: 11000, unlock: { level: 6 }, desc: "讓刃走出一個圓。" },
    { id: "breakguard", name: "破守", typ: "blunt", target: "single", hits: 1, coeff: 1.2, cd: 10000, unlock: { level: 7 }, desc: "專砸防護。", status: { id: "sunder", chance: 0.8, dur: 7000 } },
    { id: "quickstep", name: "疾步", typ: null, target: "self", hits: 0, coeff: 0, cd: 18000, unlock: { level: 8 }, desc: "把下一陣攻勢提前。", self: { haste: 0.22, dur: 8000 } },
    { id: "bleedarc", name: "弧血", typ: "slash", target: "single", hits: 1, coeff: 1.15, cd: 9000, unlock: { level: 10 }, desc: "刃過之處留下細傷。", status: { id: "dot", chance: 0.7, dur: 6000, power: 0.18 } },
    { id: "pin", name: "釘影", typ: "pierce", target: "single", hits: 1, coeff: 1.35, cd: 12000, unlock: { floor: 5 }, desc: "把對手的步子釘慢。", status: { id: "slow", chance: 0.75, dur: 6000 } },
    { id: "lantern", name: "挑燈", typ: "blunt", target: "all", hits: 1, coeff: 0.9, cd: 14000, unlock: { floor: 8 }, desc: "燈火一亮，近處皆可見。", status: { id: "sunder", chance: 0.3, dur: 4000 } },
    { id: "deeprest", name: "沉息", typ: null, target: "self", hits: 0, coeff: 0, cd: 22000, unlock: { level: 15 }, desc: "大睡一拍，醒時傷少了許多。", self: { heal: 0.3 } },
    { id: "finalcut", name: "醒刃", typ: "slash", target: "single", hits: 1, coeff: 2.15, cd: 20000, unlock: { floor: 15 }, desc: "像要把夢從中間切開。" },
    { id: "sealpress", name: "印鎮", typ: "blunt", target: "single", hits: 1, coeff: 1.5, cd: 13000, unlock: { level: 12 }, desc: "以印壓住對方的勢。", status: { id: "stun", chance: 0.25, dur: 1800 } }
  ];

  const TALENTS = [
    { id: "idlefortune", name: "閒巡", desc: "掛機所獲金幣與閱歷各增百分之八。", kind: "idle", fx: { gold: 0.08, exp: 0.08 } },
    { id: "thickcloak", name: "厚衾", desc: "減傷提高百分之六。", kind: "def", fx: { dr: 0.06 } },
    { id: "quickhand", name: "敏手", desc: "攻速與迴避略增。", kind: "idle", fx: { aspd: 0.08, dodge: 0.03 } },
    { id: "sharpeye", name: "暴想", desc: "暴擊率與暴擊傷害提高。", kind: "idle", fx: { crit: 0.05, critDmg: 0.15 } },
    { id: "ironbreath", name: "鐵息", desc: "體質與生命略增。", kind: "def", fx: { vit: 3, hp: 0.08 } },
    { id: "pickup", name: "拾遺", desc: "背包上限加八，掉落略豐。", kind: "idle", fx: { bag: 8, drop: 0.08 } },
    { id: "sturdy", name: "穩步", desc: "格擋率提高，受擊較穩。", kind: "def", fx: { block: 0.06 } },
    { id: "potionist", name: "藥契", desc: "藥劑回復增多，冷卻略短。", kind: "def", fx: { potion: 0.2, potionCd: 0.15 } }
  ];

  const POTIONS = [
    { id: "potion_s", name: "小還夢露", heal: 40, cost: 16, cd: 8000, desc: "喚回一小截氣力。" },
    { id: "potion_m", name: "中還夢露", heal: 90, cost: 42, cd: 8000, desc: "夢體重新溫熱一點。" },
    { id: "potion_l", name: "大還夢露", heal: 180, cost: 90, cd: 8000, desc: "重傷時也够撐過一程。" }
  ];

  const MATS = [
    { id: "stone_dream", name: "夢屑石", desc: "強化用的碎屑，隨處可拾。", cost: 12 },
    { id: "sand_soul", name: "定魂砂", desc: "較純的砂，能把強化定住些。", cost: 36 }
  ];

  const QUESTS = [
    { id: "q_f1_kill", floor: 1, type: "kill", target: 8, zone: "field", name: "津邊的第一場霧", desc: "在郊野驅散八個夢影。", gold: 30, exp: 20 },
    { id: "q_f1_boss", floor: 1, type: "boss", name: "渡過燈守", desc: "擊敗津口燈守。", gold: 80, exp: 50 },
    { id: "q_f2_kill", floor: 2, type: "kill", target: 10, name: "巷中燈影", desc: "在燈草巷外擊敗十個對手。", gold: 40, exp: 30 },
    { id: "q_f3_collect", floor: 3, type: "collect", item: "stone_dream", target: 6, name: "銅霧裡的石", desc: "收集六枚夢屑石。", gold: 50, exp: 35 },
    { id: "q_reach_5", floor: 1, type: "reach", target: 5, name: "把信送到第五層", desc: "首次踏入雁書驛。", gold: 120, exp: 80 },
    { id: "q_f5_boss", floor: 5, type: "boss", name: "拆開未寄的名", desc: "擊敗未寄之名。", gold: 160, exp: 110 },
    { id: "q_f7_kill", floor: 7, type: "kill", target: 12, zone: "wilds", name: "白棘上的風", desc: "在荒原擊敗十二個對手。", gold: 90, exp: 70 },
    { id: "q_f10_boss", floor: 10, type: "boss", name: "走進還熱的窯", desc: "擊敗未冷的窯神。", gold: 280, exp: 200 },
    { id: "q_reach_15", floor: 1, type: "reach", target: 15, name: "去看未鑄完的星", desc: "首次踏入星鑄谷。", gold: 360, exp: 260 },
    { id: "q_f15_boss", floor: 15, type: "boss", name: "給星像一個收場", desc: "擊敗未完成的星像。", gold: 420, exp: 320 },
    { id: "q_f20_boss", floor: 20, type: "boss", name: "走到門前", desc: "擊敗守門的醒者。", gold: 900, exp: 800 }
  ];

  const STORIES = [
    { id: "s1", floor: 1, title: "渡口的燈", text: "你記得跌入這場長夢時，水面曾反光一次。岸上有人把燈放下，卻沒留下名字。燈還在，路也還在。", gold: 40, exp: 15 },
    { id: "s5", floor: 5, title: "沒有收件人", text: "驛站裡最上面那封信是空白的。你把它放回原處，紙頁卻自己寫上一行字：繼續往上走。", gold: 100, exp: 60 },
    { id: "s10", floor: 10, title: "窯火", text: "窯工的影子在壁上晃，仔細看，那只是熱氣。有人低聲說：這夢燒得越久，醒來越不容易。", gold: 200, exp: 140 },
    { id: "s15", floor: 15, title: "未完成", text: "星像缺一隻眼睛。你伸手去摸，掌心只留下一點冷的亮。像是有人中途把工具放下，去辦更急的事。", gold: 320, exp: 240 },
    { id: "s20", floor: 20, title: "門", text: "門後沒有更高的塔。只有一段極短的靜。你若在這裡倒下，仍會回到最後那座安穩的城；你若推門，這場夢便會記得你曾來到過頂處。", gold: 600, exp: 500 }
  ];

  const ACHIEVEMENTS = [
    { id: "a_first_kill", name: "初鋒", desc: "擊敗第一個對手。" },
    { id: "a_first_boss", name: "過關", desc: "首次擊敗一層頭目。" },
    { id: "a_floor5", name: "五層燈火", desc: "解鎖第五層。" },
    { id: "a_floor10", name: "窯前", desc: "解鎖第十層。" },
    { id: "a_floor15", name: "星谷", desc: "解鎖第十五層。" },
    { id: "a_floor20", name: "走到門下", desc: "解鎖第二十層。" },
    { id: "a_wake", name: "一場驚醒", desc: "首次力竭，並醒回城中。" },
    { id: "a_bag", name: "囊滿", desc: "背包第一次裝滿。" },
    { id: "a_enh", name: "定住一次", desc: "強化成功一次。" },
    { id: "a_lv10", name: "夢體初成", desc: "達到第十級。" },
    { id: "a_lv20", name: "長夢中人", desc: "達到第二十級。" },
    { id: "a_clear20", name: "門已開過", desc: "擊敗第二十層頭目。" }
  ];

  const HOWTO = [
    { h: "這場夢", p: "你落入一座層疊的世界塔。城中可以歇息、買物、強化與交付委託；出城後會自動與對手交手。角色只有這一具夢體：力竭時會醒回最近的安穩城中，狩獵會停下，但此身仍在。進度只存在這部裝置。" },
    { h: "外出與頭目", p: "郊野較緩，荒原較苦，迷宮更兇，並通向頭目關前。首次擊敗該層頭目後，階梯會通向下一層。頭目稍後會再出現，可供再戰。若在設定中開啟自動挑戰頭目，只要你在關前、生命全滿、且頭目在，便會自行開戰。" },
    { h: "力竭", p: "生命降到零時，你會看見倒下的地點與緣由，然後回到最後一座安穩的城。狩獵會停止，需再自行出城。沒有力量會傳到下一個夢者——若你另起一名角色，一切從頭開始。" },
    { h: "裝備與強化", p: "武器與防具可在城中強化。成功率會事先標明；失敗只耗材料與金幣，不會毀掉物品。無用的裝備可標為廢物，一次賣掉，或融解成強化用的石頭。" },
    { h: "離線", p: "若你離開時仍在狩獵，回來後夢會自行把這段時間走完，不另作提示。若期間力竭，便停在醒回城中的那一刻。" }
  ];

  const ZONE = {
    town: { name: "城中", hunt: false, mult: 1, agg: 0 },
    field: { name: "郊野", hunt: true, mult: 1, agg: 0.05, delay: 700 },
    wilds: { name: "荒原", hunt: true, mult: 1.28, agg: 0.12, delay: 600 },
    labyrinth: { name: "迷宮", hunt: true, typ: 1.55, wait: 1, agg: 0.22, delay: 480 },
    gate: { name: "頭目關前", hunt: false, mult: 1, agg: 0 },
    boss: { name: "頭目之間", hunt: true, typ: 1, agg: 0, delay: 0 }
  };
  // typo fix: labyrinth.mult
  ZONE.labyrinth.mult = 1.55;

  G.data = {
    DMG, STYLES, RARITY, SLOTS, SLOT_NOUN, FLOORS, SKILLS, TALENTS,
    POTIONS, MATS, QUESTS, STORIES, ACHIEVEMENTS, HOWTO, ZONE,
    BAG_BASE: 40,
    BOSS_RESPAWN: 50000,
    MAX_OFFLINE: 3 * 60 * 60 * 1000,
    SAVE_KEY: "changmeng-yiming-v1",
    SAVE_BAK: "changmeng-yiming-v1-bak",
    VERSION: 1,
    TITLE: "長夢一命",
    TAGLINE: "掛機打怪、攻略頭目、一層層往上爬。角色只有一條命。進度只存在這部裝置。"
  };
})(window.Yiming = window.Yiming || {});

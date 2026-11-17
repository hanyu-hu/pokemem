// PokeMem 抽卡核心逻辑 — 纯函数，可在浏览器和 Node 里共用
// 概率来源：图鉴表 L 列单只概率（合计 99.89%，按权重归一化到 100%）
// 保底来源：另一位工程师的文档第 6-7 节
//   - 10 连保底：每包 10 张至少一张 SR 及以上
//   - 50 抽保底：连续 50 抽未出 SSR，则第 50 抽必出 SSR 及以上
//   - MR 不设保底
// 实现说明：10 连保底按“前 9 张正常抽，第 10 张若仍无 SR+ 则强制从 SR+ 池抽”实现，
// 展示时把 10 张顺序打乱；与文档“抽完随机替换一张”的保底概率完全一致，且保底计数精确。
(function (root) {
  "use strict";
  var POKEDEX = root.POKEDEX || (typeof require !== "undefined" ? require("./pokedex.js").POKEDEX : []);
  var PACK_SIZE = 10;
  var PACK_INTERVAL_MS = 3600 * 1000; // 正式版：1 小时 1 包
  var SSR_PLUS = ["SSR", "UR", "MR"];
  var SR_PLUS = ["SR", "SSR", "UR", "MR"];
  var TIER_LABEL = { N: "普通", R: "稀有", SR: "超稀有", SSR: "传说", UR: "神话", MR: "幻之" };

  function entry(id) { return POKEDEX[id - 1]; }
  function totalWeight() {
    var s = 0;
    for (var i = 0; i < POKEDEX.length; i++) s += POKEDEX[i][5];
    return s; // 表格合计 99.89
  }
  function randInt(min, max, rng) { // 含两端
    return min + Math.floor(rng() * (max - min + 1));
  }

  // 在指定稀有度池子里按表格单只概率加权抽一只（池外权重为 0）
  function drawFromPool(tiers, rng) {
    var total = 0, i;
    for (i = 0; i < POKEDEX.length; i++) if (tiers.indexOf(POKEDEX[i][4]) >= 0) total += POKEDEX[i][5];
    var r = rng() * total;
    for (i = 0; i < POKEDEX.length; i++) {
      if (tiers.indexOf(POKEDEX[i][4]) < 0) continue;
      r -= POKEDEX[i][5];
      if (r < 0) return POKEDEX[i];
    }
    return POKEDEX[POKEDEX.length - 1];
  }
  // 全池加权抽一只（= 表格单只概率归一化）
  function drawAny(rng) {
    return drawFromPool(["N", "R", "SR", "SSR", "UR", "MR"], rng);
  }

  // 等级与数值（文档第 4 节 / 表格“等级公式”页，满个体 15、努力拉满，93 = 2*15+63）
  function rollStats(row, rng) {
    var minLv = row[6], hpBase = row[7], atkBase = row[8];
    var lv = randInt(minLv, 100, rng);
    var hp = Math.floor((2 * hpBase + 93) * lv / 100) + lv + 10;
    var atk = Math.floor((2 * atkBase + 93) * lv / 100) + 5;
    return { level: lv, hp: hp, atk: atk };
  }

  // 抽一张：处理 50 抽 SSR 保底；更新并返回新的 sinceSSR
  function drawCard(state, rng) {
    var row;
    if (state.sinceSSR >= 49) { // 连续 49 抽未出 SSR，下一抽必出 SSR 及以上
      row = drawFromPool(SSR_PLUS, rng);
    } else {
      row = drawAny(rng);
    }
    var isSSRPlus = SSR_PLUS.indexOf(row[4]) >= 0;
    state.sinceSSR = isSSRPlus ? 0 : state.sinceSSR + 1;
    var st = rollStats(row, rng);
    return { id: row[0], name: row[1], en: row[2], types: row[3], tier: row[4], prob: row[5],
             level: st.level, hp: st.hp, atk: st.atk };
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // 开一包（10 张），含 10 连保底；调用前由 UI 保证 packs > 0
  function drawPack(state, rng) {
    rng = rng || Math.random;
    var cards = [], i, hasSRPlus = false;
    for (i = 0; i < PACK_SIZE - 1; i++) {
      var c = drawCard(state, rng);
      if (SR_PLUS.indexOf(c.tier) >= 0) hasSRPlus = true;
      cards.push(c);
    }
    var last;
    if (hasSRPlus) {
      last = drawCard(state, rng);
    } else { // 保底：第 10 张强制从 SR+ 池抽
      var row = drawFromPool(SR_PLUS, rng);
      var st = rollStats(row, rng);
      var isSSRPlus = SSR_PLUS.indexOf(row[4]) >= 0;
      state.sinceSSR = isSSRPlus ? 0 : state.sinceSSR + 1;
      last = { id: row[0], name: row[1], en: row[2], types: row[3], tier: row[4], prob: row[5],
               level: st.level, hp: st.hp, atk: st.atk, pity: true };
    }
    cards.push(last);
    state.packs -= 1;
    state.packsOpened += 1;
    state.totalDraws += PACK_SIZE;
    // NEW 判定：开包前未拥有、且是本包内第一次出现的那张
    var seenInPack = {};
    cards.forEach(function (c) {
      c.isNew = !state.collection[c.id] && !seenInPack[c.id];
      seenInPack[c.id] = true;
    });
    cards.forEach(function (c) {
      if (!state.collection[c.id]) state.collection[c.id] = { count: 0, bestLv: 0, bestHp: 0, bestAtk: 0 };
      var o = state.collection[c.id];
      o.count += 1;
      if (c.level > o.bestLv) { o.bestLv = c.level; o.bestHp = c.hp; o.bestAtk = c.atk; }
    });
    return shuffle(cards, rng);
  }

  // ---- 卡包计时（正式版）----
  function newState(now) {
    return { packs: 1, lastGrantAt: now, collection: {}, totalDraws: 0,
             packsOpened: 0, sinceSSR: 0, debug: false, createdAt: now };
  }
  // 按流逝时间补发卡包：每小时 1 包；返回本次补发数
  function grantDuePacks(state, now) {
    var elapsed = now - state.lastGrantAt;
    if (elapsed < PACK_INTERVAL_MS) return 0;
    var due = Math.floor(elapsed / PACK_INTERVAL_MS);
    state.packs += due;
    state.lastGrantAt += due * PACK_INTERVAL_MS;
    return due;
  }
  function msToNextPack(state, now) {
    return Math.max(0, state.lastGrantAt + PACK_INTERVAL_MS - now);
  }

  // ---- 统计 ----
  function tierTotals() {
    var t = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, MR: 0 }, counts = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, MR: 0 };
    POKEDEX.forEach(function (r) { t[r[4]] += r[5]; counts[r[4]] += 1; });
    return { totals: t, counts: counts, sum: totalWeight() };
  }
  function ownedCount(state) { return Object.keys(state.collection).length; }

  var api = { PACK_SIZE: PACK_SIZE, PACK_INTERVAL_MS: PACK_INTERVAL_MS, TIER_LABEL: TIER_LABEL,
    SR_PLUS: SR_PLUS, SSR_PLUS: SSR_PLUS, entry: entry, totalWeight: totalWeight,
    drawFromPool: drawFromPool, drawAny: drawAny, rollStats: rollStats, drawCard: drawCard,
    drawPack: drawPack, newState: newState, grantDuePacks: grantDuePacks,
    msToNextPack: msToNextPack, tierTotals: tierTotals, ownedCount: ownedCount };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Gacha = api;
})(typeof window !== "undefined" ? window : globalThis);

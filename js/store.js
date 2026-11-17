// PokeMem — 存档层：localStorage 读写 + 共享可变状态
// 各模块通过 PokeMem.ctx 共享同一份状态对象；reset 时只替换 ctx.state，引用不失效。
// 加载顺序：pokedex.js → i18n.js → gacha.js → 本文件 → 其余 js/*.js → js/boot.js
(function () {
  "use strict";
  var SAVE_KEY = "pokemem-save-v1";

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s.packs === "number" && s.collection) {
          if (!s.lang) s.lang = "zh";
          Gacha.ensureTrainer(s); // 老存档补训练师资料（未注册、结晶 0），已有字段原样保留
          return s;
        }
      }
    } catch (e) { /* 存档损坏则重开 */ }
    var fresh = Gacha.newState(Date.now());
    fresh.lang = "zh";
    return fresh;
  }

  window.PokeMem = window.PokeMem || {};
  PokeMem.SAVE_KEY = SAVE_KEY;
  PokeMem.ctx = {
    state: load(),
    currentPack: null, // 刚开的那包卡（开包结果浮层用）
    filterTier: "ALL",
    filterOwned: "ALL",
    query: "",
    detailSort: { key: "level", dir: "desc" }, // 排序状态在不同宝可梦之间保留
    detailSelected: null // 详情页左边 tab 当前选中的那张卡（对象引用，换宝可梦时自动重置）
  };
  PokeMem.save = function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(PokeMem.ctx.state)); } catch (e) {}
  };
})();

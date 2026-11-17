// PokeMem — 启动：最后加载。出错红条、旧存档迁移、首次渲染、计时器。
(function () {
  "use strict";
  var ctx = PokeMem.ctx;

  // 出错时在页面顶部显示红条，别再静默没反应
  window.addEventListener("error", function (e) {
    var bar = document.getElementById("error-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "error-bar";
      bar.style.cssText = "background:#c00;color:#fff;padding:10px 14px;font-size:13px;position:sticky;top:0;z-index:99";
      document.body.prepend(bar);
    }
    bar.textContent = PokeMem.t("errorPrefix", { msg: e.message || "unknown error" });
  });

  Gacha.ensureTrainer(ctx.state); // 训练师资料：老存档补一个未注册的训练师，结晶 0，注册时再发 100
  Gacha.migrateCollection(ctx.state); // v1.5 前的旧存档只有汇总，补一条明细卡后保存
  Gacha.repairLegacyCards(ctx.state, Math.random); // v1.7：旧卡按公式补生成数值（原始数值已无法找回），只跑一次
  Gacha.enforceCap(ctx.state); // v1.8：每只最多保留 5 张卡，超过的按 Lv 从低到高去掉
  PokeMem.save();
  PokeMem.applyLang();
  PokeMem.tick();
  setInterval(PokeMem.tick, 1000);
})();

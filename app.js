// PokeMem 网页端 v1 — UI 层（localStorage 存档，单机版）
(function () {
  "use strict";
  // 出错时在页面顶部显示红条，别再静默没反应
  window.addEventListener("error", function (e) {
    var bar = document.getElementById("error-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "error-bar";
      bar.style.cssText = "background:#c00;color:#fff;padding:10px 14px;font-size:13px;position:sticky;top:0;z-index:99";
      document.body.prepend(bar);
    }
    bar.textContent = "出错了：" + (e.message || "未知错误") + "，截图发我看一下。";
  });
  var SAVE_KEY = "pokemem-save-v1";
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s.packs === "number" && s.collection) return s;
      }
    } catch (e) { /* 存档损坏则重开 */ }
    return Gacha.newState(Date.now());
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }

  // ---------- 工具 ----------
  function $(id) { return document.getElementById(id); }
  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var h = String(Math.floor(s / 3600)).padStart(2, "0");
    var m = String(Math.floor(s % 3600 / 60)).padStart(2, "0");
    var ss = String(s % 60).padStart(2, "0");
    return h + ":" + m + ":" + ss;
  }
  function tierClass(t) { return "tier-" + t; }

  // ---------- 计时 ----------
  function tick() {
    if (!state.debug) {
      var due = Gacha.grantDuePacks(state, Date.now());
      if (due > 0) save();
    }
    renderHeader();
  }

  // ---------- 顶栏 / 首页 ----------
  function renderHeader() {
    $("pack-count").textContent = state.packs;
    $("owned-count").textContent = Gacha.ownedCount(state) + " / 151";
    $("total-draws").textContent = state.totalDraws;
    $("since-ssr").textContent = state.sinceSSR >= 49 ? "下一抽必出 SSR+" : ("再 " + (50 - state.sinceSSR) + " 抽保底 SSR+");
    var openBtn = $("open-pack-btn");
    openBtn.disabled = state.packs <= 0;
    openBtn.textContent = state.packs > 0 ? "开一包（10 张）" : "没有卡包";
    if (state.debug) {
      $("next-pack").textContent = "Debug 模式：计时暂停";
    } else {
      $("next-pack").textContent = state.packs > 0
        ? "下一包 " + fmtTime(Gacha.msToNextPack(state, Date.now()))
        : "下一包 " + fmtTime(Gacha.msToNextPack(state, Date.now()));
    }
    $("debug-badge").style.display = state.debug ? "inline-block" : "none";
    $("debug-panel").style.display = state.debug ? "block" : "none";
    $("debug-toggle").checked = state.debug;
  }

  // ---------- 开包 ----------
  var currentPack = null;
  $("open-pack-btn").addEventListener("click", function () {
    if (state.packs <= 0) return;
    currentPack = Gacha.drawPack(state, Math.random);
    save();
    renderHeader();
    renderPack();
    $("pack-overlay").classList.add("show");
  });
  function renderPack() {
    var wrap = $("pack-cards");
    wrap.innerHTML = "";
    currentPack.forEach(function (c, i) {
      var d = document.createElement("div");
      d.className = "pack-card " + tierClass(c.tier);
      d.innerHTML =
        '<div class="card-inner">' +
        '<div class="card-front"><div class="card-back">?</div></div>' +
        '<div class="card-face">' +
        '<img src="' + imgUrl(c.id) + '" alt="' + c.name + '" loading="lazy" onerror="this.style.display=\'none\'">' +
        '<div class="card-no">#' + String(c.id).padStart(3, "0") + '</div>' +
        '<div class="card-name">' + c.name + '</div>' +
        '<div class="card-tier">' + c.tier + " · " + Gacha.TIER_LABEL[c.tier] + "</div>" +
        '<div class="card-stats">Lv.' + c.level + "　HP " + c.hp + "　攻击 " + c.atk + "</div>" +
        (c.isNew ? '<div class="new-badge">NEW</div>' : "") +
        (c.pity ? '<div class="pity-badge">保底</div>' : "") +
        "</div></div>";
      d.addEventListener("click", function () { d.classList.add("flipped"); });
      wrap.appendChild(d);
    });
    $("pack-summary").textContent = "点击卡牌逐张翻开，或直接全部翻开";
  }
  $("flip-all-btn").addEventListener("click", function () {
    document.querySelectorAll(".pack-card").forEach(function (el) { el.classList.add("flipped"); });
    var best = currentPack.slice().sort(function (a, b) {
      var order = { MR: 0, UR: 1, SSR: 2, SR: 3, R: 4, N: 5 };
      return order[a.tier] - order[b.tier];
    })[0];
    var news = currentPack.filter(function (c) { return c.isNew; }).length;
    $("pack-summary").textContent = "本包最佳：" + best.name + "（" + best.tier + "）　新卡 " + news + " 张";
  });
  $("close-pack-btn").addEventListener("click", function () {
    $("pack-overlay").classList.remove("show");
    renderCollection();
  });

  // ---------- 卡册 ----------
  var filterTier = "ALL", filterOwned = "ALL", query = "";
  function renderCollection() {
    var grid = $("collection-grid");
    grid.innerHTML = "";
    var q = query.trim();
    POKEDEX.forEach(function (r) {
      var id = r[0], owned = state.collection[id];
      if (filterTier !== "ALL" && r[4] !== filterTier) return;
      if (filterOwned === "OWNED" && !owned) return;
      if (filterOwned === "MISSING" && owned) return;
      if (q && (r[1].indexOf(q) < 0 && r[2].toLowerCase().indexOf(q.toLowerCase()) < 0 && String(id) !== q)) return;
      var cell = document.createElement("div");
      cell.className = "dex-cell " + tierClass(r[4]) + (owned ? "" : " missing");
      cell.innerHTML =
        '<img src="' + imgUrl(id) + '" alt="' + r[1] + '" loading="lazy" onerror="this.style.display=\'none\'">' +
        '<div class="dex-no">#' + String(id).padStart(3, "0") + "</div>" +
        '<div class="dex-name">' + (owned ? r[1] : "？？？") + "</div>" +
        '<div class="dex-tier">' + r[4] + "</div>" +
        (owned ? '<div class="dex-count">×' + owned.count + "</div>" : "");
      cell.addEventListener("click", function () { showDetail(r); });
      grid.appendChild(cell);
    });
    var shown = grid.children.length;
    $("collection-summary").textContent = "拥有 " + Gacha.ownedCount(state) + " / 151　·　当前显示 " + shown + " 只";
  }
  function showDetail(r) {
    var owned = state.collection[r[0]];
    $("detail-img").src = imgUrl(r[0]);
    $("detail-img").style.display = "";
    $("detail-name").textContent = "#" + String(r[0]).padStart(3, "0") + " " + r[1] + "（" + r[2] + "）";
    $("detail-meta").textContent = r[3] + "　·　" + r[4] + " " + Gacha.TIER_LABEL[r[4]] + "　·　单只概率 " + r[5] + "%";
    $("detail-owned").textContent = owned
      ? "已拥有 ×" + owned.count + "　·　最高等级 Lv." + owned.bestLv + "（HP " + owned.bestHp + " / 攻击 " + owned.bestAtk + "）"
      : "尚未拥有";
    $("detail-modal").classList.add("show");
  }
  $("detail-close").addEventListener("click", function () { $("detail-modal").classList.remove("show"); });
  $("detail-modal").addEventListener("click", function (e) { if (e.target === this) this.classList.remove("show"); });

  document.querySelectorAll("[data-tier-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterTier = btn.getAttribute("data-tier-filter");
      document.querySelectorAll("[data-tier-filter]").forEach(function (b) { b.classList.toggle("active", b === btn); });
      renderCollection();
    });
  });
  document.querySelectorAll("[data-owned-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterOwned = btn.getAttribute("data-owned-filter");
      document.querySelectorAll("[data-owned-filter]").forEach(function (b) { b.classList.toggle("active", b === btn); });
      renderCollection();
    });
  });
  $("search-input").addEventListener("input", function (e) { query = e.target.value; renderCollection(); });

  // ---------- 概率页 ----------
  function renderRates() {
    var t = Gacha.tierTotals();
    var html = "";
    ["MR", "UR", "SSR", "SR", "R", "N"].forEach(function (tier) {
      var perCard = (t.totals[tier] / t.counts[tier]).toFixed(3).replace(/0$/, "");
      html += "<tr><td><span class='pill " + tierClass(tier) + "'>" + tier + "</span> " + Gacha.TIER_LABEL[tier] +
        "</td><td>" + t.counts[tier] + "</td><td>" + t.totals[tier].toFixed(2) + "%</td><td>" + perCard + "%</td></tr>";
    });
    $("rates-body").innerHTML = html;
    $("rates-note").textContent = "单只概率合计 " + t.sum.toFixed(2) + "%（表格四舍五入所致），抽卡时按权重归一化到 100%。";
  }

  // ---------- 页签 ----------
  document.querySelectorAll("[data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = btn.getAttribute("data-tab");
      document.querySelectorAll("[data-tab]").forEach(function (b) { b.classList.toggle("active", b === btn); });
      document.querySelectorAll(".tab-page").forEach(function (p) { p.classList.toggle("active", p.id === "tab-" + tab); });
      if (tab === "dex") renderCollection();
      if (tab === "rates") renderRates();
    });
  });

  // ---------- Debug ----------
  $("debug-toggle").addEventListener("change", function (e) {
    state.debug = e.target.checked;
    state.lastGrantAt = Date.now(); // 切换模式时重计 1 小时：Debug 期间不累计正式版卡包
    save();
    renderHeader();
  });
  $("add-packs-btn").addEventListener("click", function () {
    var n = parseInt($("add-packs-input").value, 10);
    if (!n || n <= 0) { alert("输入要加的包数（正整数）"); return; }
    state.packs += n;
    save(); renderHeader();
  });
  document.querySelectorAll("[data-add-packs]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.packs += parseInt(btn.getAttribute("data-add-packs"), 10);
      save(); renderHeader();
    });
  });
  $("next-pack-now-btn").addEventListener("click", function () {
    state.lastGrantAt = Date.now() - Gacha.PACK_INTERVAL_MS;
    var due = Gacha.grantDuePacks(state, Date.now());
    save(); renderHeader();
    alert(due > 0 ? "已到账 1 包" : "还没到时间");
  });
  $("reset-save-btn").addEventListener("click", function () {
    if (!confirm("确定清空全部存档吗？卡册、抽卡记录都会消失。")) return;
    localStorage.removeItem(SAVE_KEY);
    state = Gacha.newState(Date.now());
    state.debug = true; // 清空后仍留在 Debug 模式，方便继续测试
    save(); renderHeader(); renderCollection();
  });

  // ---------- 启动 ----------
  tick();
  setInterval(tick, 1000);
  renderCollection();
  renderRates();
})();

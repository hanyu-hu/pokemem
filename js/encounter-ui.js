// PokeMem — 遭遇战界面（Task 27）：场景列表 + 选队（战斗屏在 Task 28）
// 场景卡和选队格子都用 createElement 造按钮（不用 innerHTML 字符串），
// 和头像选择器一个做法，测试桩也能点。
(function () {
  "use strict";
  var $ = PokeMem.$;
  var ctx = PokeMem.ctx;
  function t(key, vars) { return PokeMem.t(key, vars); }

  function selectedScene() { return ctx.encounterScene || "grassland"; }
  function teamPicks() { return ctx.teamPicks || (ctx.teamPicks = []); }
  // 队伍是 6 个固定球槽：picks[i] 是第 i 个球里的卡（null = 空球）；
  // 新卡放第一个空球，取消只空出那一个球、别的球不动
  var openTabSpecies = null; // 悬停 tab 正开着哪个种（null = 没开）
  function pickCount() {
    var n = 0;
    teamPicks().forEach(function (p) { if (p) n++; });
    return n;
  }
  function pickIndex(speciesId, cardIndex) {
    var picks = teamPicks();
    for (var i = 0; i < picks.length; i++) {
      var p = picks[i];
      if (p && p.speciesId === speciesId && p.cardIndex === cardIndex) return i;
    }
    return -1;
  }
  // 选队里可能有脏引用（清空存档后卡没了）：渲染前先清掉（只空出那个球，不挪别的球）
  function prunePicks() {
    var picks = teamPicks();
    for (var i = 0; i < picks.length; i++) {
      var p = picks[i];
      if (!p) continue;
      var e = ctx.state.collection[p.speciesId];
      if (!e || !e.cards || !e.cards[p.cardIndex]) picks[i] = null;
    }
  }

  function renderEncounter() {
    var enc = ctx.encounter;
    var active = enc && enc.phase !== "done";
    $("encounter-picker").style.display = active ? "none" : "";
    $("encounter-status").style.display = active ? "" : "none";
    if (active) renderStatus(enc);
    else { prunePicks(); renderScenes(); renderTeam(); updateStartBtn(); }
  }
  // 场景卡：名字 + 属性图标 + 野生起始等级；未解锁的灰掉、点不动
  function renderScenes() {
    var tr = Gacha.ensureTrainer(ctx.state);
    var list = $("scene-list");
    list.innerHTML = "";
    PokeMem.Scenes.SCENES.forEach(function (sc) {
      var locked = tr.level < sc.unlockLevel;
      var b = document.createElement("button");
      b.classList.add("scene-card");
      if (locked) b.classList.add("locked");
      if (sc.id === selectedScene()) b.classList.add("selected");
      b.setAttribute("data-scene", sc.id);
      var name = document.createElement("div");
      name.className = "scene-name";
      name.textContent = PokeMem.Scenes.sceneName(sc.id, PokeMem.lang());
      b.appendChild(name);
      var types = document.createElement("div");
      types.className = "scene-types";
      types.innerHTML = sc.types.map(function (id) { return PokeMem.Types.typeIconHtml(id); }).join("");
      b.appendChild(types);
      var base = document.createElement("div");
      base.className = "scene-base";
      base.textContent = t("encounterBaseLevel", { level: sc.baseLevel });
      b.appendChild(base);
      if (locked) {
        var lock = document.createElement("div");
        lock.className = "scene-lock";
        lock.textContent = t("encounterUnlock", { level: sc.unlockLevel });
        b.appendChild(lock);
      }
      b.addEventListener("click", function () {
        if (locked) return;
        ctx.encounterScene = sc.id;
        renderScenes();
      });
      list.appendChild(b);
    });
  }
  // 选队格子：每种一个格子（只放形象和名字，Lv / HP / 攻击 / 亲密度不在格子上显示，在悬停 tab 里选）
  function renderTeam() {
    var grid = $("team-grid");
    grid.innerHTML = "";
    POKEDEX.forEach(function (row) {
      var e = ctx.state.collection[row[0]];
      if (!e || !e.cards || !e.cards.length) return;
      var picked = null;
      for (var i = 0; i < teamPicks().length; i++) {
        var q = teamPicks()[i];
        if (q && q.speciesId === row[0]) { picked = q; break; }
      }
      var typeIds = PokeMem.Types.parseTypes(row[3]);
      var b = document.createElement("button");
      b.classList.add("team-cell");
      b.classList.add("tbg-" + typeIds[0]); // 底色按主属性染成卡片色
      if (picked) b.classList.add("selected");
      b.setAttribute("data-species", row[0]);
      var img = document.createElement("img");
      img.src = imgUrl(row[0]);
      img.alt = "";
      img.onerror = function () { this.style.display = "none"; };
      img.setAttribute("loading", "lazy");
      b.appendChild(img);
      var nm = document.createElement("div");
      nm.className = "team-name";
      nm.textContent = PokeMem.dexName(row);
      b.appendChild(nm);
      var types = document.createElement("div");
      types.className = "team-types";
      types.innerHTML = typeIds.map(function (id) { return PokeMem.Types.typeIconHtml(id); }).join("");
      b.appendChild(types);
      var cnt = document.createElement("span");
      cnt.className = "team-count" + (picked ? " selected" : "");
      cnt.textContent = (picked ? "✓ " : "") + "×" + e.cards.length;
      b.appendChild(cnt);
      b.addEventListener("click", function () { showPickTab(row[0], b); }); // 点格子 = 打开 tab（不直接选）
      b.addEventListener("mouseenter", function () { showPickTab(row[0], b); });
      b.addEventListener("mouseleave", function (ev) {
        var tab = $("team-pick-tab");
        if (ev && ev.relatedTarget && tab.contains && tab.contains(ev.relatedTarget)) return; // 移进 tab 里别收
        hidePickTab();
      });
      grid.appendChild(b);
    });
    renderTeamBalls();
    $("team-pick-count").textContent = t("encounterTeamCount", { n: pickCount() });
    if (openTabSpecies) { // tab 开着：格子重绘后按新格子重新锚定，选项的勾跟着刷新
      var cell = null;
      for (var i = 0; i < grid.children.length; i++) {
        if (grid.children[i].getAttribute("data-species") === String(openTabSpecies)) { cell = grid.children[i]; break; }
      }
      if (cell) showPickTab(openTabSpecies, cell);
    }
  }
  // 队伍精灵球：6 个槽；空球关着，选了的球打开、宝可梦放进去；点已选的取消
  function renderTeamBalls() {
    var box = $("team-balls");
    box.innerHTML = "";
    var picks = teamPicks();
    for (var i = 0; i < 6; i++) box.appendChild(makeBall(picks[i] || null));
  }
  function makeBall(p) {
    var b = document.createElement("button");
    b.classList.add("team-ball");
    var top = document.createElement("span"); top.className = "ball-top"; b.appendChild(top);
    var bot = document.createElement("span"); bot.className = "ball-bottom"; b.appendChild(bot);
    var band = document.createElement("span"); band.className = "ball-band"; b.appendChild(band);
    var btn = document.createElement("span"); btn.className = "ball-btn"; b.appendChild(btn);
    if (p) {
      b.classList.add("open");
      var img = document.createElement("img");
      img.className = "ball-mon";
      img.src = imgUrl(p.speciesId);
      img.alt = "";
      b.appendChild(img);
      var e = ctx.state.collection[p.speciesId];
      var c = e && e.cards && e.cards[p.cardIndex];
      var lv = document.createElement("span");
      lv.className = "ball-lv";
      lv.textContent = c ? "Lv." + c.level : "";
      b.appendChild(lv);
      b.title = t("encounterTeamBallRemove");
      b.addEventListener("click", function () { togglePick(p.speciesId, p.cardIndex); });
    }
    return b;
  }
  // 悬停选卡 tab：鼠标移到格子上（或点格子），右边浮出该种宝可梦的全部卡，点一只上场
  function showPickTab(speciesId, cell) {
    openTabSpecies = speciesId;
    var tab = $("team-pick-tab");
    tab.innerHTML = "";
    var row = POKEDEX[speciesId - 1];
    var e = ctx.state.collection[speciesId];
    if (!row || !e || !e.cards || !e.cards.length) return;
    var title = document.createElement("div");
    title.className = "team-pick-title";
    title.textContent = PokeMem.dexName(row) + " · " + t("encounterPickTitle");
    tab.appendChild(title);
    e.cards.slice().sort(function (a, b) { return b.level - a.level; }).forEach(function (c) {
      var idx = e.cards.indexOf(c);
      var sel = pickIndex(speciesId, idx) >= 0;
      var b = document.createElement("button");
      b.classList.add("team-pick-opt");
      if (sel) b.classList.add("selected");
      b.setAttribute("data-card", idx);
      b.textContent = "Lv." + c.level + "　HP " + c.hp + " · " + t("atkLabel") + " " + c.atk +
        "　" + t("encounterAffectionPoints", { n: c.affection || 0 }) + (sel ? "　✓" : "");
      b.addEventListener("click", function () { togglePick(speciesId, idx); }); // 点选项只切换、不收 tab，可以连续选
      tab.appendChild(b);
    });
    // 定位：格子右边；靠右边缘时改放左边
    var tabW = 190;
    var left = (cell.offsetLeft || 0) + (cell.offsetWidth || 0) + 8;
    var wrap = $("team-grid-wrap");
    if (wrap && left + tabW > (wrap.offsetWidth || 0)) left = Math.max(0, (cell.offsetLeft || 0) - tabW - 8);
    tab.style.left = left + "px";
    tab.style.top = (cell.offsetTop || 0) + "px";
    tab.style.display = "block";
  }
  function hidePickTab() { openTabSpecies = null; $("team-pick-tab").style.display = "none"; }
  function togglePick(speciesId, cardIndex) {
    var picks = teamPicks();
    var i = pickIndex(speciesId, cardIndex);
    if (i >= 0) picks[i] = null; // 点已选的 = 取消，只空出这一个球
    else {
      var slot = -1;
      for (var j = 0; j < 6; j++) if (!picks[j]) { slot = j; break; } // 新卡放第一个空球
      if (slot < 0) { PokeMem.showToast(t("encounterTeamFull")); return; }
      picks[slot] = { speciesId: speciesId, cardIndex: cardIndex };
    }
    renderTeam();
    updateStartBtn();
  }
  function updateStartBtn() {
    var dis = pickCount() < 1;
    $("encounter-start-btn").disabled = dis;
    $("encounter-deploy-btn").disabled = dis;
  }
  // 开始：建一场遭遇战、记在 ctx.encounter 里（Task 28 的战斗屏接手）；开场不写存档
  function startRun() {
    var picks = teamPicks().filter(function (p) { return !!p; }); // 空球不进战斗队伍
    if (picks.length < 1) { PokeMem.showToast(t("encounterNeedTeam")); return; }
    var res = PokeMem.Encounter.startEncounter(ctx.state, selectedScene(), picks, Math.random);
    if (!res.ok) { PokeMem.showToast(t("encounterStartFail")); return; }
    ctx.encounter = res.encounter;
    ctx.teamPicks = [];
    openTabSpecies = null;
    var w = res.encounter.wild;
    PokeMem.showToast(t("encounterStarted", { name: PokeMem.lang() === "en" ? w.en : w.name, level: w.level }));
    renderEncounter();
  }
  // 进行中的遭遇战状态：场景、当前野生、已胜场数；放弃等于中途离开，宝箱就没了（和刷新页面一样）
  function renderStatus(enc) {
    var sc = PokeMem.Scenes.sceneById(enc.sceneId);
    $("encounter-status-scene").textContent = t("encounterCurrentScene",
      { name: sc ? PokeMem.Scenes.sceneName(sc.id, PokeMem.lang()) : "" });
    var w = enc.wild;
    $("encounter-status-wild").textContent = w
      ? t("encounterCurrentWild", { name: PokeMem.lang() === "en" ? w.en : w.name, level: w.level, hp: w.hp, hpMax: w.hpMax })
      : "";
    $("encounter-status-wins").textContent = t("encounterCurrentWins", { n: enc.wins });
  }
  function abandonRun() {
    ctx.encounter = null;
    renderEncounter();
  }

  window.PokeMem = window.PokeMem || {};
  PokeMem.renderEncounter = renderEncounter;

  $("encounter-start-btn").addEventListener("click", startRun);
  $("encounter-deploy-btn").addEventListener("click", startRun);
  $("encounter-abandon-btn").addEventListener("click", abandonRun);
  $("team-pick-tab").addEventListener("mouseleave", hidePickTab);
})();

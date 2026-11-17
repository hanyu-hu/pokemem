// PokeMem 遭遇战选队验证：node test/encounter-ui.test.js
// 用最小 DOM 桩跑真实的 js/ 模块：同种只放一只、悬停选哪一只上场、
// 6 个精灵球（空球关着、选了打开、点已选的取消）、满 6 只拦第 7 种。
const fs = require("fs");
const vm = require("vm");

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (detail ? " — " + detail : ""));
  if (!cond) failures++;
}

function makeEl(tag) {
  const cls = new Set();
  const el = {
    tagName: (tag || "div").toUpperCase(),
    children: [], style: {}, dataset: {}, attributes: {}, listeners: {},
    _text: "", _html: "", src: "", title: "", disabled: false,
    classList: {
      add(c) { cls.add(c); },
      remove(c) { cls.delete(c); },
      toggle(c, f) {
        if (f === undefined) { if (cls.has(c)) cls.delete(c); else cls.add(c); }
        else if (f) cls.add(c); else cls.delete(c);
      },
      contains(c) { return cls.has(c); },
    },
    getAttribute(k) { return this.attributes[k] == null ? null : this.attributes[k]; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    appendChild(c) { this.children.push(c); return c; },
    querySelectorAll() { return []; },
    contains(other) { return this.children.indexOf(other) >= 0; },
    click() { (this.listeners.click || []).forEach(function (fn) { fn.call(el, { target: el }); }); },
    dispatch(type, ev) { (this.listeners[type] || []).forEach(function (fn) { fn.call(el, ev || { target: el }); }); },
  };
  Object.defineProperty(el, "className", {
    get() { return Array.from(cls).join(" "); },
    set(v) { cls.clear(); String(v).split(/\s+/).forEach(function (c) { if (c) cls.add(c); }); },
  });
  Object.defineProperty(el, "textContent", {
    get() { return this._text; },
    set(v) { this._text = String(v); },
  });
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html; },
    set(v) { this._html = String(v); this.children = []; },
  });
  return el;
}
const els = {};
const sandbox = {
  console: console,
  setInterval: () => 0,
  setTimeout: () => 0,
  addEventListener: () => {},
  localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
  document: {
    documentElement: { lang: "" },
    title: "",
    body: makeEl("body"),
    getElementById(id) { return els[id] || (els[id] = makeEl("div")); },
    createElement(tag) { return makeEl(tag); },
    querySelectorAll: () => [],
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
function run(file) { vm.runInContext(fs.readFileSync(__dirname + "/../" + file, "utf8"), sandbox, { filename: file }); }
run("pokedex.js");
run("avatars.js");
run("i18n.js");
run("card-progress.js");
run("gacha.js");

// 造存档：7 个种，每种 1–5 张卡（#001 四张、#004 五张，其余各一张）
const Gacha = sandbox.Gacha;
const state = Gacha.newState(1000000);
function addCard(id, level) {
  const row = sandbox.POKEDEX[id - 1];
  const st = Gacha.statsForLevel(row, level);
  Gacha.addToCollection(state, { id, name: row[1], en: row[2], types: row[3], tier: row[4],
    prob: row[5], level, hp: st.hp, atk: st.atk, exp: 0, affection: 0 });
}
[96, 82, 28, 8].forEach(function (lv) { addCard(1, lv); });
[97, 58, 44, 43, 42].forEach(function (lv) { addCard(4, lv); });
addCard(7, 50); addCard(10, 30); addCard(13, 20); addCard(16, 40); addCard(25, 60);
sandbox.localStorage.setItem("pokemem-save-v1", JSON.stringify(state));
// 按 index.html 的加载顺序跑
["js/store.js", "js/util.js", "js/lang.js", "js/types.js", "js/scenes.js", "js/encounter.js",
  "js/encounter-ui.js", "js/home.js", "js/dex.js", "js/rates.js", "js/tabs.js", "js/debug.js",
  "js/register.js", "js/trainer.js", "js/boot.js"].forEach(run);

sandbox.PokeMem.renderEncounter();
const grid = els["team-grid"];
const ballsBox = els["team-balls"];
const tab = els["team-pick-tab"];
const picks = function () { return sandbox.PokeMem.ctx.teamPicks; };
const cellsOf = function (id) {
  return grid.children.filter(function (c) { return c.getAttribute("data-species") === String(id); });
};
const ballAt = function (i) { return ballsBox.children[i]; };
const ballImg = function (ball) { return ball.children.filter(function (c) { return c.tagName === "IMG"; })[0]; };
const ballLv = function (ball) { return ball.children.filter(function (c) { return c.className === "ball-lv"; })[0]; };
const click = function (el) { el.listeners.click[0](); };
const mouseenter = function (el) { el.listeners.mouseenter[0](); };

check("6 个球槽一开始都关着",
  ballsBox.children.length === 6 &&
  ballsBox.children.every(function (b) { return !b.classList.contains("open") && !ballImg(b); }));
check("格子 14 张卡（#001 四张 + #004 五张 + 5 种各一张）", grid.children.length === 14, "实际 " + grid.children.length);
check("一开始已选 0 / 6", els["team-pick-count"].textContent === "已选 0 / 6", els["team-pick-count"].textContent);
check("一开始开始按钮禁用", els["encounter-start-btn"].disabled === true);

// 点 #001 Lv.96：进队、1 号球打开、球里是妙蛙种子
click(cellsOf(1)[0]);
check("点一只进队", picks().length === 1 && picks()[0].speciesId === 1 && picks()[0].cardIndex === 0);
check("1 号球打开、里面是 #001", ballAt(0).classList.contains("open") && ballImg(ballAt(0)).src.indexOf("/1.png") >= 0);
check("球下写着 Lv.96", ballLv(ballAt(0)).textContent === "Lv.96", ballLv(ballAt(0)).textContent);
check("已选 1 / 6", els["team-pick-count"].textContent === "已选 1 / 6");
check("开始按钮可用", els["encounter-start-btn"].disabled === false);

// 同种只放一只：再点 #001 Lv.82，直接换成这张（还是 1 只）
click(cellsOf(1)[1]);
check("同种再点另一只：还是 1 只", picks().length === 1);
check("同种换成了 Lv.82 那张", picks()[0].cardIndex === 1 && ballLv(ballAt(0)).textContent === "Lv.82");

// 点已选的取消
click(cellsOf(1)[1]);
check("点已选的取消选择", picks().length === 0);
check("球关回去", !ballAt(0).classList.contains("open") && !ballImg(ballAt(0)));
check("已选 0 / 6", els["team-pick-count"].textContent === "已选 0 / 6");

// 悬停选卡 tab：移到 #001 格子上，右边浮出该种的 4 张卡
click(cellsOf(1)[0]); // 先把 Lv.96 选上
mouseenter(cellsOf(1)[0]);
check("悬停后 tab 显示", tab.style.display === "block");
check("tab 标题是种名 + 选哪一只上场",
  tab.children[0].textContent.indexOf("妙蛙种子") >= 0 && tab.children[0].textContent.indexOf("选哪一只上场") >= 0,
  tab.children[0].textContent);
check("tab 列出该种 4 张卡", tab.children.length === 5, "实际 " + tab.children.length + " 个子元素");
check("tab 里已选的那张打勾", tab.children[1].classList.contains("selected") && tab.children[1].textContent.indexOf("✓") >= 0);
click(tab.children[3]); // 点 Lv.28 那张
check("tab 里点 Lv.28：换成这张", picks().length === 1 && picks()[0].cardIndex === 2);
check("点完 tab 收起来", tab.style.display === "none");
check("球里换成 Lv.28", ballLv(ballAt(0)).textContent === "Lv.28");

// 点球取消
click(ballAt(0));
check("点球取消选择", picks().length === 0 && !ballAt(0).classList.contains("open"));

// 满 6 只：第 7 种被拦
[1, 4, 7, 10, 13, 16].forEach(function (id) { click(cellsOf(id)[0]); });
check("选满 6 只", picks().length === 6, "实际 " + picks().length);
check("6 个球都打开", ballsBox.children.every(function (b) { return b.classList.contains("open"); }));
check("已选 6 / 6", els["team-pick-count"].textContent === "已选 6 / 6");
click(cellsOf(25)[0]);
check("第 7 种被拦、弹提示", picks().length === 6 && els["toast"].textContent.indexOf("最多选 6 张卡") >= 0, els["toast"].textContent);
check("满员时同种换一只不受限", (function () {
  click(cellsOf(1)[1]); // #001 换 Lv.82
  return picks().length === 6 && picks().filter(function (p) { return p.speciesId === 1; })[0].cardIndex === 1;
})());

console.log(failures === 0 ? "\n全部通过 ✅" : "\n失败 " + failures + " 项 ❌");
process.exit(failures === 0 ? 0 : 1);

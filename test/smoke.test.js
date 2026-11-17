// PokeMem 本地验证：node test/smoke.test.js
// 目的：拆分 app.js 之后，确认 9 个 js/*.js 模块按 index.html 的顺序加载、
// 启动迁移、开包/翻牌/卡册/详情/概率/页签/Debug 全链路都不报错、行为不变。
// 用最小 DOM 桩跑在 vm 里，不依赖浏览器、不联网；卡片立绘只拼 URL，不加载。
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const GachaNode = require("../gacha.js"); // 仅用于造“无训练师”的旧存档夹具

const FILES = ["pokedex.js", "i18n.js", "gacha.js", "js/store.js", "js/util.js",
  "js/lang.js", "js/home.js", "js/dex.js", "js/rates.js", "js/tabs.js",
  "js/debug.js", "js/boot.js"];

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (detail ? " — " + detail : ""));
  if (!cond) failures++;
}

// ---------- 最小 DOM 桩 ----------
function makeClassList() {
  const s = new Set();
  return {
    add(c) { s.add(c); },
    remove(c) { s.delete(c); },
    toggle(c, f) {
      if (f === undefined) { if (s.has(c)) s.delete(c); else s.add(c); }
      else if (f) s.add(c); else s.delete(c);
    },
    contains(c) { return s.has(c); },
  };
}
function makeEl(doc, tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(),
    children: [],
    dataset: {},
    style: {},
    attributes: {},
    _listeners: {},
    _text: "",
    _html: "",
    classList: makeClassList(),
    getAttribute(k) { return this.attributes[k] == null ? null : this.attributes[k]; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    appendChild(c) { this.children.push(c); return c; },
    querySelectorAll(sel) { return doc._bySelector[sel] || []; },
    dispatch(type, ev) { (this._listeners[type] || []).forEach(function (fn) { fn.call(this, ev || { target: this }); }, this); },
    click() { this.dispatch("click", { target: this }); },
  };
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
function makeDocument() {
  const doc = {
    _byId: {},
    _bySelector: {},
    documentElement: { lang: "zh-CN" },
    title: "",
    body: { prepend() {} },
    getElementById(id) {
      if (!this._byId[id]) { const el = makeEl(this, "div"); el.id = id; this._byId[id] = el; }
      return this._byId[id];
    },
    createElement(tag) { return makeEl(this, tag); },
    querySelectorAll(sel) { return this._bySelector[sel] || []; },
  };
  return doc;
}
function makeStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
  };
}
// 按选择器预注册页签/筛选按钮（应用在加载时就 querySelectorAll 绑定它们）
function registerSelectors(doc) {
  function btn(attrs) {
    const el = makeEl(doc, "button");
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }
  doc._bySelector["[data-tab]"] = ["home", "dex", "rates"].map(function (t) { return btn({ "data-tab": t }); });
  doc._bySelector[".tab-page"] = ["home", "dex", "rates"].map(function (t) {
    const s = makeEl(doc, "section"); s.id = "tab-" + t; return s;
  });
  doc._bySelector[".tab-page"][0].classList.add("active");
  doc._bySelector["[data-tier-filter]"] = ["ALL", "MR", "UR", "SSR", "SR", "R", "N"].map(function (t) { return btn({ "data-tier-filter": t }); });
  doc._bySelector["[data-owned-filter]"] = ["ALL", "OWNED", "MISSING"].map(function (t) { return btn({ "data-owned-filter": t }); });
  doc._bySelector["[data-add-packs]"] = ["1", "10", "100"].map(function (n) { return btn({ "data-add-packs": n }); });
}
function runApp(initialStorage) {
  const doc = makeDocument();
  registerSelectors(doc);
  const sandbox = {
    document: doc,
    localStorage: makeStorage(initialStorage),
    console: console,
    addEventListener: function () {}, // window 出错监听（真实浏览器自带）
    setInterval: function () { return 0; },
    setTimeout: function () { return 0; },
    alert: function () {},
    confirm: function () { return true; },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  FILES.forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf-8"), context, { filename: f });
  });
  return { sandbox: sandbox, doc: doc, PokeMem: sandbox.PokeMem };
}
function byAttr(els, attr, val) {
  return els.filter(function (el) { return el.getAttribute(attr) === val; })[0];
}

// ---------- 场景 A：全新存档，全链路 ----------
const A = runApp({});
const ctxA = A.PokeMem.ctx;
const $A = function (id) { return A.doc.getElementById(id); };
check("A 启动无报错红条", A.doc._byId["error-bar"] === undefined);
check("A 新存档 1 包", ctxA.state.packs === 1, "实际 " + ctxA.state.packs);
check("A 新存档有训练师（未注册、结晶 0）",
  !!ctxA.state.trainer && ctxA.state.trainer.registered === false && ctxA.state.trainer.crystals === 0);
check("A 顶栏已渲染", $A("pack-count").textContent === "1" && $A("owned-count").textContent === "0 / 151");

$A("lang-en").click();
check("A 切英文", ctxA.state.lang === "en");
$A("lang-zh").click();
check("A 切回中文", ctxA.state.lang === "zh");

const toggle = $A("debug-toggle");
toggle.checked = true;
toggle.dispatch("change", { target: toggle });
check("A Debug 开关", ctxA.state.debug === true);

$A("add-packs-input").value = "5";
$A("add-packs-btn").click();
check("A 加 5 包", ctxA.state.packs === 6, "实际 " + ctxA.state.packs);
byAttr(A.doc._bySelector["[data-add-packs]"], "data-add-packs", "10").click();
check("A 快捷 +10 包", ctxA.state.packs === 16, "实际 " + ctxA.state.packs);

$A("open-pack-btn").click();
check("A 开包 10 张", ctxA.currentPack && ctxA.currentPack.length === 10);
check("A 开包扣 1 包", ctxA.state.packs === 15, "实际 " + ctxA.state.packs);
check("A 开包浮层显示", $A("pack-overlay").classList.contains("show"));
check("A 包里 10 张卡已渲染", $A("pack-cards").children.length === 10);
$A("pack-cards").children[0].click();
check("A 点一张翻开", $A("pack-cards").children[0].classList.contains("flipped"));
$A("flip-all-btn").click();
check("A 全部翻开有总结", $A("pack-summary").textContent.length > 0, $A("pack-summary").textContent);
$A("close-pack-btn").click();
check("A 关闭浮层", !$A("pack-overlay").classList.contains("show"));
check("A 卡册 151 格", $A("collection-grid").children.length === 151, "实际 " + $A("collection-grid").children.length);

$A("collection-grid").children[0].click();
check("A 点格子开详情", $A("detail-modal").classList.contains("show"));
check("A 详情是 #001", $A("detail-name").textContent.indexOf("#001") === 0, $A("detail-name").textContent);
$A("detail-close").click();
check("A 关闭详情", !$A("detail-modal").classList.contains("show"));

byAttr(A.doc._bySelector["[data-tab]"], "data-tab", "rates").click();
check("A 切概率页", A.doc._bySelector[".tab-page"][2].classList.contains("active"));
check("A 概率表有 MR 行", $A("rates-body").innerHTML.indexOf("MR") >= 0);
byAttr(A.doc._bySelector["[data-tab]"], "data-tab", "dex").click();
check("A 切回卡册页", A.doc._bySelector[".tab-page"][1].classList.contains("active"));

const search = $A("search-input");
search.value = "皮卡";
search.dispatch("input", { target: search });
check("A 搜 皮卡 只剩 1 格", $A("collection-grid").children.length === 1, "实际 " + $A("collection-grid").children.length);
search.value = "";
search.dispatch("input", { target: search });
check("A 清空搜索回 151 格", $A("collection-grid").children.length === 151);

$A("next-pack-now-btn").click();
check("A 下一包立即到账", ctxA.state.packs === 16, "实际 " + ctxA.state.packs);

$A("reset-save-btn").click();
check("A 清空后回到 1 包", ctxA.state.packs === 1, "实际 " + ctxA.state.packs);
check("A 清空后仍在 Debug", A.PokeMem.ctx.state.debug === true);
check("A 清空不重置语言", A.PokeMem.ctx.state.lang === "zh");

// ---------- 场景 B：无训练师的旧存档，迁移补全 ----------
const legacy = GachaNode.newState(Date.now());
delete legacy.trainer;
delete legacy.version;
legacy.lang = "zh";
const B = runApp({ "pokemem-save-v1": JSON.stringify(legacy) });
check("B 旧存档启动无报错红条", B.doc._byId["error-bar"] === undefined);
check("B 旧存档补训练师", !!B.PokeMem.ctx.state.trainer && B.PokeMem.ctx.state.trainer.registered === false);
check("B 旧存档结晶 0（注册时才发 100）", B.PokeMem.ctx.state.trainer.crystals === 0);
check("B 旧存档补 version 2", B.PokeMem.ctx.state.version === 2);
check("B 旧存档包数保留", B.PokeMem.ctx.state.packs === legacy.packs);

console.log(failures === 0 ? "ALL PASS" : failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);

// PokeMem 界面验证：node test/ui.test.js
// 检查：稀有度标记映射（黑点/黑星/金星/粉星）、翻牌震动动画的 CSS 与触发逻辑是否接好
const fs = require("fs");
const { RARITY_MARK, rarityMarkHtml } = require("../i18n.js");

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (detail ? " — " + detail : ""));
  if (!cond) failures++;
}

const expected = {
  N: { text: "●", cls: "mark-black" },
  R: { text: "★", cls: "mark-black" },
  SR: { text: "★★", cls: "mark-black" },
  SSR: { text: "★", cls: "mark-gold" },
  UR: { text: "★★", cls: "mark-gold" },
  MR: { text: "★", cls: "mark-pink" }
};
Object.keys(expected).forEach(tier => {
  const m = RARITY_MARK[tier];
  check("标记 " + tier + " = " + expected[tier].text + " " + expected[tier].cls,
    m && m.text === expected[tier].text && m.cls === expected[tier].cls,
    m ? m.text + " " + m.cls : "缺失");
});
check("rarityMarkHtml(SSR) 含金星", rarityMarkHtml("SSR").includes("★") && rarityMarkHtml("SSR").includes("mark-gold"));
check("rarityMarkHtml(MR) 含粉星", rarityMarkHtml("MR").includes("★") && rarityMarkHtml("MR").includes("mark-pink"));
check("rarityMarkHtml(N) 是黑点", rarityMarkHtml("N").includes("●") && rarityMarkHtml("N").includes("mark-black"));
check("未知档位回退 N", rarityMarkHtml("XXX").includes("●"));

const css = fs.readFileSync(__dirname + "/../style.css", "utf8");
check("CSS 有震动关键帧", css.includes("@keyframes hs-shake"));
check("CSS 有 special-shake 类", css.includes(".pack-card.special-shake"));
check("CSS 有标记颜色类", css.includes(".mark-gold") && css.includes(".mark-pink") && css.includes(".mark-black"));
check("CSS 括号平衡", (css.match(/{/g) || []).length === (css.match(/}/g) || []).length);

const app = fs.readFileSync(__dirname + "/../app.js", "utf8");
const markUses = (app.match(/mark\(/g) || []).length;
check("app.js 在开包/卡册/详情/概率四处用标记", markUses >= 4, "用到 " + markUses + " 处");
check("app.js 有震动触发函数", app.includes("shakeIfSpecial"));
check("震动只给 SSR/MR", app.includes('tier !== "SSR" && tier !== "MR"'));
check("翻牌点击会震", app.includes("shakeIfSpecial(d, c.tier)"));
check("全部翻开也会震", app.includes("shakeIfSpecial(el, el.dataset.tier)"));
check("详情页有全部卡牌容器", fs.readFileSync(__dirname + "/../index.html", "utf8").includes('id="detail-cards"'));
check("app.js 有详情卡牌列表渲染", app.includes("renderDetailCards"));
check("app.js 有排序状态（Lv/HP/攻击）", app.includes('detailSort') && app.includes('"level"') && app.includes('"hp"') && app.includes('"atk"'));
check("启动时迁移旧存档", app.includes("migrateCollection(state)"));

console.log(failures === 0 ? "\n全部通过 ✅" : "\n失败 " + failures + " 项 ❌");
process.exit(failures === 0 ? 0 : 1);

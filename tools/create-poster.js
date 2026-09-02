const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = '学业英雄养成记 - 海报';
pres.author = '学业英雄养成记团队';

// ========== 海报尺寸设置 ==========
// 16:9 横向布局，宽度10英寸 = 约95cm @ 96dpi
const POSTER_W = 10;
const POSTER_H = 5.625;

// 配色方案
const COLORS = {
  primary: "6C63FF",
  secondary: "764BA2",
  accent: "FF6B6B",
  dark: "1A1A2E",
  light: "F0F0F8",
  white: "FFFFFF",
  text: "333333",
  textLight: "666666",
  gold: "FFD700",
  green: "52C41A"
};

const makeShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.2 });

let slide = pres.addSlide();
slide.background = { color: COLORS.white };

// ========== 左侧区域：标题 + 核心卖点 ==========
// 左侧背景渐变（用两个矩形模拟）
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 3.8, h: POSTER_H,
  fill: { color: COLORS.dark }
});
slide.addShape(pres.shapes.OVAL, {
  x: -1.5, y: -1.5, w: 4, h: 4,
  fill: { color: COLORS.primary, transparency: 80 }
});
slide.addShape(pres.shapes.OVAL, {
  x: 2, y: 3, w: 3, h: 3,
  fill: { color: COLORS.secondary, transparency: 75 }
});

// 主标题
slide.addText("学业英雄", {
  x: 0.3, y: 0.8, w: 3.2, h: 0.9,
  fontSize: 44, fontFace: "Microsoft YaHei", bold: true,
  color: COLORS.white, align: "center"
});
slide.addText("养成记", {
  x: 0.3, y: 1.6, w: 3.2, h: 0.7,
  fontSize: 36, fontFace: "Microsoft YaHei", bold: true,
  color: COLORS.primary, align: "center"
});

// 英文
slide.addText("Academic Hero Journey", {
  x: 0.3, y: 2.3, w: 3.2, h: 0.4,
  fontSize: 11, fontFace: "Arial",
  color: "AAAAAA", align: "center", charSpacing: 2
});

// 标语
slide.addText("让学业成长\n变成一场冒险", {
  x: 0.3, y: 2.9, w: 3.2, h: 0.9,
  fontSize: 16, fontFace: "Microsoft YaHei",
  color: COLORS.white, align: "center", lineSpacing: 24
});

// 核心价值点
const highlights = [
  { icon: "🎮", text: "游戏化学习" },
  { icon: "⚔️", text: "挑战竞技" },
  { icon: "🏆", text: "排行榜" },
  { icon: "📋", text: "每日任务" }
];
highlights.forEach((h, i) => {
  const y = 4.0 + i * 0.38;
  slide.addText(h.icon + "  " + h.text, {
    x: 0.5, y: y, w: 3.0, h: 0.35,
    fontSize: 13, fontFace: "Microsoft YaHei",
    color: COLORS.white
  });
});

// ========== 右侧区域：截图展示 ==========
// 截图1：角色主页 (左上)
const img1 = "screenshots/screenshot-hero.png";
const img2 = "screenshots/screenshot-ranking.png";
const img3 = "screenshots/screenshot-challenge.png";
const img4 = "screenshots/screenshot-result.png";
const img5 = "screenshots/screenshot-history.png";

// 截图1：大卡片（左上，角色主页）
slide.addShape(pres.shapes.RECTANGLE, {
  x: 4.0, y: 0.3, w: 2.8, h: 2.5,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
if (fs.existsSync(img1)) {
  slide.addImage({ x: 4.1, y: 0.4, w: 2.6, h: 2.3, src: img1 });
} else {
  slide.addShape(pres.shapes.RECTANGLE, { x: 4.1, y: 0.4, w: 2.6, h: 2.3, fill: { color: "E8E8E8" } });
  slide.addText("【截图1】\n角色主页", { x: 4.1, y: 1.2, w: 2.6, h: 0.8, fontSize: 12, color: "999999", align: "center" });
}

// 截图2：排行榜 (右上)
slide.addShape(pres.shapes.RECTANGLE, {
  x: 7.0, y: 0.3, w: 2.8, h: 2.5,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
if (fs.existsSync(img2)) {
  slide.addImage({ x: 7.1, y: 0.4, w: 2.6, h: 2.3, src: img2 });
} else {
  slide.addShape(pres.shapes.RECTANGLE, { x: 7.1, y: 0.4, w: 2.6, h: 2.3, fill: { color: "E8E8E8" } });
  slide.addText("【截图2】\n排行榜", { x: 7.1, y: 1.2, w: 2.6, h: 0.8, fontSize: 12, color: "999999", align: "center" });
}

// 截图3：挑战选择 (中左)
slide.addShape(pres.shapes.RECTANGLE, {
  x: 4.0, y: 3.0, w: 1.8, h: 2.4,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
if (fs.existsSync(img3)) {
  slide.addImage({ x: 4.1, y: 3.1, w: 1.6, h: 2.2, src: img3 });
} else {
  slide.addShape(pres.shapes.RECTANGLE, { x: 4.1, y: 3.1, w: 1.6, h: 2.2, fill: { color: "E8E8E8" } });
  slide.addText("【截图3】\n挑战选择", { x: 4.1, y: 3.8, w: 1.6, h: 0.8, fontSize: 10, color: "999999", align: "center" });
}

// 截图4：对战结果 (中中)
slide.addShape(pres.shapes.RECTANGLE, {
  x: 6.0, y: 3.0, w: 1.8, h: 2.4,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
if (fs.existsSync(img4)) {
  slide.addImage({ x: 6.1, y: 3.1, w: 1.6, h: 2.2, src: img4 });
} else {
  slide.addShape(pres.shapes.RECTANGLE, { x: 6.1, y: 3.1, w: 1.6, h: 2.2, fill: { color: "E8E8E8" } });
  slide.addText("【截图4】\n对战结果", { x: 6.1, y: 3.8, w: 1.6, h: 0.8, fontSize: 10, color: "999999", align: "center" });
}

// 截图5：历史记录 (中右)
slide.addShape(pres.shapes.RECTANGLE, {
  x: 8.0, y: 3.0, w: 1.8, h: 2.4,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
if (fs.existsSync(img5)) {
  slide.addImage({ x: 8.1, y: 3.1, w: 1.6, h: 2.2, src: img5 });
} else {
  slide.addShape(pres.shapes.RECTANGLE, { x: 8.1, y: 3.1, w: 1.6, h: 2.2, fill: { color: "E8E8E8" } });
  slide.addText("【截图5】\n历史记录", { x: 8.1, y: 3.8, w: 1.6, h: 0.8, fontSize: 10, color: "999999", align: "center" });
}

// ========== 底部标注 ==========
// 截图区域标注
slide.addShape(pres.shapes.RECTANGLE, {
  x: 4.0, y: 0.15, w: 5.8, h: 0.22,
  fill: { color: COLORS.primary }
});
slide.addText("小程序界面预览", {
  x: 4.0, y: 0.08, w: 5.8, h: 0.22,
  fontSize: 10, fontFace: "Microsoft YaHei",
  color: COLORS.white, align: "center"
});

// 保存
const outputPath = "/Users/jiliangma/WorkBuddy/Claw/math-hero-miniapp/docs/学业英雄养成记-海报.pptx";
pres.writeFile({ fileName: outputPath })
  .then(() => console.log("海报已生成: " + outputPath))
  .catch(err => console.error("生成失败:", err));

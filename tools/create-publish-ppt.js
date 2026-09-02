const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = '学业英雄养成记 - 微信小程序发布介绍';
pres.author = '学业英雄养成记团队';

// 配色方案 - 紫色/蓝色系，符合小程序风格
const COLORS = {
  primary: "6C63FF",      // 主色紫色
  secondary: "764BA2",    // 深紫色
  accent: "FF6B6B",       // 红色强调
  dark: "1A1A2E",         // 深色背景
  light: "F0F0F8",        // 浅色背景
  white: "FFFFFF",
  text: "333333",
  textLight: "666666",
  gold: "FFD700",
  green: "52C41A"
};

// 工厂函数避免对象复用问题
const makeShadow = () => ({ type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.15 });

// ========== 第1页：封面 ==========
let slide1 = pres.addSlide();
slide1.background = { color: COLORS.dark };

// 装饰圆形
slide1.addShape(pres.shapes.OVAL, { x: -1, y: -1, w: 4, h: 4, fill: { color: COLORS.primary, transparency: 70 } });
slide1.addShape(pres.shapes.OVAL, { x: 7, y: 3, w: 5, h: 5, fill: { color: COLORS.secondary, transparency: 70 } });

// 主标题
slide1.addText("学业英雄养成记", {
  x: 0.5, y: 1.8, w: 9, h: 1.2,
  fontSize: 54, fontFace: "Microsoft YaHei", bold: true,
  color: COLORS.white, align: "center"
});

// 副标题
slide1.addText("Academic Hero Journey", {
  x: 0.5, y: 3.0, w: 9, h: 0.6,
  fontSize: 24, fontFace: "Arial",
  color: COLORS.primary, align: "center", charSpacing: 4
});

// 标语
slide1.addText("让学业成长变成一场英雄养成游戏", {
  x: 0.5, y: 3.8, w: 9, h: 0.5,
  fontSize: 20, fontFace: "Microsoft YaHei",
  color: COLORS.white, align: "center"
});

// 底部信息
slide1.addText("微信小程序发布介绍", {
  x: 0.5, y: 5.0, w: 9, h: 0.4,
  fontSize: 14, fontFace: "Microsoft YaHei",
  color: "999999", align: "center"
});

// ========== 第2页：产品介绍 ==========
let slide2 = pres.addSlide();
slide2.background = { color: COLORS.light };

// 标题栏
slide2.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: COLORS.primary } });
slide2.addText("什么是学业英雄养成记？", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white
});

// 核心概念卡片
slide2.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.5, w: 4.3, h: 2.2,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
slide2.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.5, w: 0.1, h: 2.2, fill: { color: COLORS.primary } });
slide2.addText("🎮 游戏化学习", {
  x: 0.8, y: 1.7, w: 3.8, h: 0.5,
  fontSize: 20, fontFace: "Microsoft YaHei", bold: true, color: COLORS.primary
});
slide2.addText("将数学成绩转化为角色养成经验值，每一道题都是一次成长，每一次进步都能看见。", {
  x: 0.8, y: 2.2, w: 3.8, h: 1.2,
  fontSize: 14, fontFace: "Microsoft YaHei", color: COLORS.textLight
});

slide2.addShape(pres.shapes.RECTANGLE, {
  x: 5.2, y: 1.5, w: 4.3, h: 2.2,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
slide2.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.5, w: 0.1, h: 2.2, fill: { color: COLORS.accent } });
slide2.addText("⚔️ 挑战竞技", {
  x: 5.5, y: 1.7, w: 3.8, h: 0.5,
  fontSize: 20, fontFace: "Microsoft YaHei", bold: true, color: COLORS.accent
});
slide2.addText("与同学进行属性对决，用实力证明自己，等级差越大，胜利奖励越丰厚。", {
  x: 5.5, y: 2.2, w: 3.8, h: 1.2,
  fontSize: 14, fontFace: "Microsoft YaHei", color: COLORS.textLight
});

// 底部说明
slide2.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 4.0, w: 9, h: 1.3,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
slide2.addText("📱 微信小程序，无需下载", {
  x: 0.8, y: 4.2, w: 8.4, h: 0.4,
  fontSize: 18, fontFace: "Microsoft YaHei", bold: true, color: COLORS.text
});
slide2.addText("学生通过班级码加入，教师一键布置任务，数据自动同步。让学生在课间、课后都能随时随地感受成长的乐趣。", {
  x: 0.8, y: 4.6, w: 8.4, h: 0.6,
  fontSize: 14, fontFace: "Microsoft YaHei", color: COLORS.textLight
});

// ========== 第3页：核心功能 ==========
let slide3 = pres.addSlide();
slide3.background = { color: COLORS.light };

slide3.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: COLORS.primary } });
slide3.addText("核心功能一览", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white
});

// 功能卡片 - 2x2布局
const features = [
  { icon: "🏆", title: "班级排行榜", desc: "实时展示班级排名\n激发竞争意识", color: COLORS.primary },
  { icon: "⚔️", title: "挑战对决", desc: "与同学属性比拼\n胜利获得丰厚奖励", color: COLORS.accent },
  { icon: "📋", title: "每日任务", desc: "完成任务获得经验\n还有额外抽卡机会", color: COLORS.secondary },
  { icon: "🎰", title: "幸运抽卡", desc: "随机获得道具奖励\n挑战凭证/成长加速剂", color: COLORS.gold }
];

features.forEach((f, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.5 + col * 4.7;
  const y = 1.5 + row * 2.0;

  slide3.addShape(pres.shapes.RECTANGLE, {
    x: x, y: y, w: 4.3, h: 1.8,
    fill: { color: COLORS.white }, shadow: makeShadow()
  });
  slide3.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: 0.1, h: 1.8, fill: { color: f.color } });
  slide3.addText(f.icon, {
    x: x + 0.3, y: y + 0.2, w: 0.6, h: 0.6, fontSize: 28
  });
  slide3.addText(f.title, {
    x: x + 1.0, y: y + 0.2, w: 3.0, h: 0.5,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true, color: f.color
  });
  slide3.addText(f.desc, {
    x: x + 1.0, y: y + 0.7, w: 3.0, h: 0.9,
    fontSize: 13, fontFace: "Microsoft YaHei", color: COLORS.textLight
  });
});

// ========== 第4页：等级与称号系统 ==========
let slide4 = pres.addSlide();
slide4.background = { color: COLORS.light };

slide4.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: COLORS.primary } });
slide4.addText("等级与称号系统", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white
});

// 左侧：等级说明
slide4.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.5, w: 4.3, h: 3.8,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
slide4.addText("📈 经验值系统", {
  x: 0.8, y: 1.7, w: 3.8, h: 0.5,
  fontSize: 20, fontFace: "Microsoft YaHei", bold: true, color: COLORS.primary
});
slide4.addText([
  { text: "课堂表现", options: { bullet: true, breakLine: true } },
  { text: "+1 EXP / 次", options: { indentLevel: 1, breakLine: true, color: COLORS.textLight } },
  { text: "考试排名", options: { bullet: true, breakLine: true } },
  { text: "第1名: +150 EXP", options: { indentLevel: 1, breakLine: true, color: COLORS.textLight } },
  { text: "第50名: +50 EXP", options: { indentLevel: 1, breakLine: true, color: COLORS.textLight } },
  { text: "挑战胜利", options: { bullet: true, breakLine: true } },
  { text: "基础 +5 EXP（根据等级差浮动）", options: { indentLevel: 1, color: COLORS.textLight } }
], {
  x: 0.8, y: 2.3, w: 3.8, h: 2.8,
  fontSize: 14, fontFace: "Microsoft YaHei", color: COLORS.text
});

// 右侧：称号说明
slide4.addShape(pres.shapes.RECTANGLE, {
  x: 5.2, y: 1.5, w: 4.3, h: 3.8,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
slide4.addText("🏅 称号系统", {
  x: 5.5, y: 1.7, w: 3.8, h: 0.5,
  fontSize: 20, fontFace: "Microsoft YaHei", bold: true, color: COLORS.secondary
});
slide4.addText([
  { text: "根据属性特点获得专属称号", options: { breakLine: true, breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "学神 · 战神 · 勇者", options: { breakLine: true, color: COLORS.primary } },
  { text: "天才 · 名师 · 圣者", options: { breakLine: true, color: COLORS.accent } },
  { text: " ", options: { breakLine: true } },
  { text: "等级越高，可解锁更多称号", options: { color: COLORS.textLight } }
], {
  x: 5.5, y: 2.3, w: 3.8, h: 2.8,
  fontSize: 14, fontFace: "Microsoft YaHei", color: COLORS.text
});

// ========== 第5页：挑战系统详解 ==========
let slide5 = pres.addSlide();
slide5.background = { color: COLORS.light };

slide5.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: COLORS.accent } });
slide5.addText("⚔️ 挑战系统详解", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white
});

// 挑战规则卡片
slide5.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.5, w: 5.8, h: 3.8,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
slide5.addText("挑战规则", {
  x: 0.8, y: 1.7, w: 5.2, h: 0.5,
  fontSize: 20, fontFace: "Microsoft YaHei", bold: true, color: COLORS.accent
});
slide5.addText([
  { text: "对决方式", options: { bold: true, breakLine: true } },
  { text: "系统随机抽取双方各3个属性进行3轮比拼", options: { breakLine: true, color: COLORS.textLight } },
  { text: " ", options: { breakLine: true } },
  { text: "胜利奖励（等级差计算）", options: { bold: true, breakLine: true } },
  { text: "• 对手比自己低 ≥10级：固定 1 EXP", options: { breakLine: true, color: COLORS.textLight } },
  { text: "• 对手与自己等级相近：基础 5 EXP", options: { breakLine: true, color: COLORS.textLight } },
  { text: "• 对手比自己高 5级：额外 +5 EXP", options: { breakLine: true, color: COLORS.textLight } },
  { text: " ", options: { breakLine: true } },
  { text: "失败惩罚：-5 EXP（保底0）", options: { bold: true, breakLine: true } },
  { text: "被挑战者防守胜利：+1 EXP", options: { color: COLORS.textLight } }
], {
  x: 0.8, y: 2.2, w: 5.2, h: 2.9,
  fontSize: 13, fontFace: "Microsoft YaHei", color: COLORS.text
});

// 右侧：获得凭证方式
slide5.addShape(pres.shapes.RECTANGLE, {
  x: 6.6, y: 1.5, w: 2.9, h: 3.8,
  fill: { color: COLORS.white }, shadow: makeShadow()
});
slide5.addText("如何获得", {
  x: 6.9, y: 1.7, w: 2.3, h: 0.4,
  fontSize: 16, fontFace: "Microsoft YaHei", bold: true, color: COLORS.primary
});
slide5.addText("挑战凭证", {
  x: 6.9, y: 2.2, w: 2.3, h: 0.4,
  fontSize: 14, fontFace: "Microsoft YaHei", color: COLORS.text
});
slide5.addText([
  { text: "🎰 抽卡获得", options: { breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "📋 完成任务", options: { breakLine: true } },
  { text: "普通任务 +1 张", options: { breakLine: true, fontSize: 11, color: COLORS.textLight } },
  { text: " ", options: { breakLine: true } },
  { text: "👨‍🏫 教师发放", options: { breakLine: true } }
], {
  x: 6.9, y: 2.6, w: 2.3, h: 2.0,
  fontSize: 13, fontFace: "Microsoft YaHei", color: COLORS.text
});

// ========== 第6页：截图展示 - 小程序首页 ==========
let slide6 = pres.addSlide();
slide6.background = { color: COLORS.light };

slide6.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: COLORS.primary } });
slide6.addText("📱 小程序界面展示", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white
});

// 截图占位区域1
slide6.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 1.5, w: 4.3, h: 3.5,
  fill: { color: "E8E8E8" }, line: { color: "CCCCCC", width: 1 }
});
slide6.addText("【截图1】\n角色主页\n（我的角色页面）", {
  x: 0.5, y: 2.5, w: 4.3, h: 1.5,
  fontSize: 16, fontFace: "Microsoft YaHei", color: "999999", align: "center", valign: "middle"
});

// 截图占位区域2
slide6.addShape(pres.shapes.RECTANGLE, {
  x: 5.2, y: 1.5, w: 4.3, h: 3.5,
  fill: { color: "E8E8E8" }, line: { color: "CCCCCC", width: 1 }
});
slide6.addText("【截图2】\n排行榜页面\n（含挑战入口）", {
  x: 5.2, y: 2.5, w: 4.3, h: 1.5,
  fontSize: 16, fontFace: "Microsoft YaHei", color: "999999", align: "center", valign: "middle"
});

// 底部提示
slide6.addText("请在此处插入小程序截图", {
  x: 0.5, y: 5.1, w: 9, h: 0.3,
  fontSize: 12, fontFace: "Microsoft YaHei", color: "999999", align: "center"
});

// ========== 第7页：截图展示 - 挑战相关 ==========
let slide7 = pres.addSlide();
slide7.background = { color: COLORS.light };

slide7.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: COLORS.primary } });
slide7.addText("📱 挑战系统界面", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white
});

// 截图占位区域
const screenshotSlots = [
  { x: 0.5, y: 1.5, label: "【截图3】\n挑战选择页面" },
  { x: 3.55, y: 1.5, label: "【截图4】\n对战结果弹窗" },
  { x: 6.6, y: 1.5, label: "【截图5】\n挑战历史记录" }
];

screenshotSlots.forEach(slot => {
  slide7.addShape(pres.shapes.RECTANGLE, {
    x: slot.x, y: slot.y, w: 2.85, h: 3.5,
    fill: { color: "E8E8E8" }, line: { color: "CCCCCC", width: 1 }
  });
  slide7.addText(slot.label, {
    x: slot.x, y: slot.y + 1.25, w: 2.85, h: 1.0,
    fontSize: 14, fontFace: "Microsoft YaHei", color: "999999", align: "center", valign: "middle"
  });
});

slide7.addText("请在此处插入小程序截图", {
  x: 0.5, y: 5.1, w: 9, h: 0.3,
  fontSize: 12, fontFace: "Microsoft YaHei", color: "999999", align: "center"
});

// ========== 第8页：使用流程 ==========
let slide8 = pres.addSlide();
slide8.background = { color: COLORS.light };

slide8.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: COLORS.primary } });
slide8.addText("学生使用流程", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white
});

// 流程步骤
const steps = [
  { num: "1", title: "扫码加入", desc: "扫描班级码\n进入自己的班级" },
  { num: "2", title: "创建角色", desc: "选择天赋\n开启英雄之旅" },
  { num: "3", title: "完成任务", desc: "完成每日任务\n积累经验值" },
  { num: "4", title: "挑战同学", desc: "消耗挑战凭证\n与其他同学对决" }
];

steps.forEach((step, i) => {
  const x = 0.5 + i * 2.4;

  // 圆形编号
  slide8.addShape(pres.shapes.OVAL, {
    x: x + 0.8, y: 1.6, w: 0.6, h: 0.6,
    fill: { color: COLORS.primary }
  });
  slide8.addText(step.num, {
    x: x + 0.8, y: 1.65, w: 0.6, h: 0.5,
    fontSize: 20, fontFace: "Arial", bold: true, color: COLORS.white, align: "center"
  });

  // 卡片
  slide8.addShape(pres.shapes.RECTANGLE, {
    x: x, y: 2.4, w: 2.2, h: 2.2,
    fill: { color: COLORS.white }, shadow: makeShadow()
  });
  slide8.addText(step.title, {
    x: x + 0.1, y: 2.6, w: 2.0, h: 0.5,
    fontSize: 16, fontFace: "Microsoft YaHei", bold: true, color: COLORS.text, align: "center"
  });
  slide8.addText(step.desc, {
    x: x + 0.1, y: 3.1, w: 2.0, h: 1.3,
    fontSize: 12, fontFace: "Microsoft YaHei", color: COLORS.textLight, align: "center"
  });

  // 连接箭头
  if (i < 3) {
    slide8.addText("→", {
      x: x + 2.0, y: 3.2, w: 0.5, h: 0.5,
      fontSize: 24, color: COLORS.primary, align: "center"
    });
  }
});

// ========== 第9页：教师端功能 ==========
let slide9 = pres.addSlide();
slide9.background = { color: COLORS.light };

slide9.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.2, fill: { color: COLORS.secondary } });
slide9.addText("👨‍🏫 教师端功能", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white
});

// 教师功能列表
const teacherFeatures = [
  { icon: "📊", title: "成绩导入", desc: "批量导入学生考试/作业成绩\n自动计算经验值" },
  { icon: "📋", title: "任务管理", desc: "布置每日/特殊任务\n一键重置全班任务" },
  { icon: "🎁", title: "道具发放", desc: "向学生发放挑战凭证\n或成长加速剂" },
  { icon: "👥", title: "班级管理", desc: "管理学生名单\n查看班级数据统计" }
];

teacherFeatures.forEach((f, i) => {
  const x = (i % 2) * 4.7 + 0.5;
  const y = Math.floor(i / 2) * 1.9 + 1.5;

  slide9.addShape(pres.shapes.RECTANGLE, {
    x: x, y: y, w: 4.3, h: 1.7,
    fill: { color: COLORS.white }, shadow: makeShadow()
  });
  slide9.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: 0.1, h: 1.7, fill: { color: COLORS.secondary } });
  slide9.addText(f.icon + " " + f.title, {
    x: x + 0.3, y: y + 0.15, w: 3.7, h: 0.5,
    fontSize: 18, fontFace: "Microsoft YaHei", bold: true, color: COLORS.secondary
  });
  slide9.addText(f.desc, {
    x: x + 0.3, y: y + 0.65, w: 3.7, h: 0.9,
    fontSize: 13, fontFace: "Microsoft YaHei", color: COLORS.textLight
  });
});

// ========== 第10页：总结 ==========
let slide10 = pres.addSlide();
slide10.background = { color: COLORS.dark };

// 装饰
slide10.addShape(pres.shapes.OVAL, { x: 7, y: -1, w: 5, h: 5, fill: { color: COLORS.primary, transparency: 70 } });
slide10.addShape(pres.shapes.OVAL, { x: -2, y: 3, w: 4, h: 4, fill: { color: COLORS.secondary, transparency: 70 } });

// 标题
slide10.addText("让学习变成一场冒险", {
  x: 0.5, y: 1.5, w: 9, h: 0.8,
  fontSize: 40, fontFace: "Microsoft YaHei", bold: true, color: COLORS.white, align: "center"
});

// 副标题
slide10.addText("学业英雄养成记 - 用游戏化的方式激发学生学习动力", {
  x: 0.5, y: 2.5, w: 9, h: 0.5,
  fontSize: 18, fontFace: "Microsoft YaHei", color: COLORS.primary, align: "center"
});

// 核心价值
slide10.addText([
  { text: "✅ 成绩转化经验值，看得见的成长", options: { breakLine: true } },
  { text: "✅ 同伴竞争激励，激发学习动力", options: { breakLine: true } },
  { text: "✅ 游戏化体验，让学习不再枯燥", options: { breakLine: true } },
  { text: "✅ 教师轻松管理，数据自动同步", options: {} }
], {
  x: 2.5, y: 3.2, w: 5, h: 1.6,
  fontSize: 16, fontFace: "Microsoft YaHei", color: COLORS.white, align: "left"
});

// 底部
slide10.addText("感谢观看", {
  x: 0.5, y: 5.0, w: 9, h: 0.4,
  fontSize: 20, fontFace: "Microsoft YaHei", color: "888888", align: "center"
});

// 保存文件
pres.writeFile({ fileName: "/Users/jiliangma/WorkBuddy/Claw/math-hero-miniapp/docs/学业英雄养成记小程序发布介绍.pptx" })
  .then(() => console.log("PPT已生成: docs/学业英雄养成记小程序发布介绍.pptx"))
  .catch(err => console.error("生成失败:", err));

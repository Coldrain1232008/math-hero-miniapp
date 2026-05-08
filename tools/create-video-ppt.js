/**
 * 学业英雄养成记 - 案例视频配套PPT（13页）
 * 用于视频录制，配合视频脚本使用
 */

const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "学业英雄养成记 v3.1.0 - 案例视频PPT";
pres.author = "学业英雄养成记";

// ============================================================
// 配色方案 - 游戏感 + 专业感
// 主色: 深紫蓝 #1A1A4E
// 次色: 亮紫  #7C3AED
// 强调: 金黄  #F59E0B
// 浅色: 淡紫  #EDE9FE
// 文字: 白/深灰
// ============================================================
const C = {
  dark:    "1A1A4E",  // 深紫蓝（主背景）
  purple:  "7C3AED",  // 亮紫（强调/标题栏）
  gold:    "F59E0B",  // 金黄（高亮/重点）
  teal:    "0EA5E9",  // 天蓝（功能色）
  light:   "EDE9FE",  // 淡紫（内容背景）
  white:   "FFFFFF",
  gray:    "94A3B8",
  darkgray:"334155",
  green:   "10B981",
  red:     "EF4444",
};

const makeShadow = () => ({
  type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.20
});

// ============================================================
// 辅助函数
// ============================================================

/** 深色幻灯片顶部标签条 */
function addTopBar(slide, label) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.55,
    fill: { color: C.purple }, line: { color: C.purple, width: 0 }
  });
  slide.addText(label, {
    x: 0.3, y: 0, w: 9.4, h: 0.55,
    fontSize: 13, fontFace: "Microsoft YaHei", color: C.white,
    bold: false, align: "left", valign: "middle", margin: 0
  });
}

/** 幻灯片大标题（白色，左侧） */
function addSlideTitle(slide, title, y = 0.75) {
  slide.addText(title, {
    x: 0.5, y, w: 9, h: 0.65,
    fontSize: 28, fontFace: "Microsoft YaHei", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });
}

/** 步骤编号圆圈 */
function addStepCircle(slide, num, x, y) {
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: 0.45, h: 0.45,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 }
  });
  slide.addText(String(num), {
    x, y, w: 0.45, h: 0.45,
    fontSize: 14, fontFace: "Arial", bold: true,
    color: C.dark, align: "center", valign: "middle", margin: 0
  });
}

/** 卡片背景 */
function addCard(slide, x, y, w, h, color = C.white) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color },
    line: { color: "E2E8F0", width: 1 },
    shadow: makeShadow()
  });
}

// ============================================================
// 第1页：封面
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  // 顶部装饰条
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.purple }, line: { color: C.purple, width: 0 }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 4.6, w: 10, h: 1.025, fill: { color: "12124A" }, line: { color: "12124A", width: 0 }
  });

  // 金色装饰线
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.3, w: 0.06, h: 2.8, fill: { color: C.gold }, line: { color: C.gold, width: 0 }
  });

  // 顶部标签
  s.addText("北京市2026年教师人工智能应用案例", {
    x: 0.3, y: 0, w: 9.4, h: 1.0,
    fontSize: 14, fontFace: "Microsoft YaHei", color: "D4C5FF",
    align: "left", valign: "middle", margin: 0
  });

  // 主标题
  s.addText("学业英雄养成记", {
    x: 0.8, y: 1.4, w: 8.5, h: 1.3,
    fontSize: 52, fontFace: "Microsoft YaHei", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });

  // 副标题
  s.addText("生成式人工智能助力游戏化学习的创新实践", {
    x: 0.8, y: 2.75, w: 8.5, h: 0.6,
    fontSize: 20, fontFace: "Microsoft YaHei",
    color: C.gold, align: "left", valign: "middle", margin: 0
  });

  // 标签行
  const tags = ["用AI案例", "游戏化学习", "助力学习变革", "微信小程序"];
  tags.forEach((tag, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.8 + i * 2.1, y: 3.5, w: 1.9, h: 0.38,
      fill: { color: C.purple, transparency: 30 },
      line: { color: C.gold, width: 1 }
    });
    s.addText(tag, {
      x: 0.8 + i * 2.1, y: 3.5, w: 1.9, h: 0.38,
      fontSize: 12, fontFace: "Microsoft YaHei", color: C.white,
      align: "center", valign: "middle", margin: 0
    });
  });

  // 底部
  s.addText("主讲人：马老师   |   北京   |   初中数学", {
    x: 0.5, y: 4.65, w: 9, h: 0.6,
    fontSize: 13, fontFace: "Microsoft YaHei", color: C.gray,
    align: "left", valign: "middle", margin: 0
  });
}

// ============================================================
// 第2页：教学痛点与解决方案
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第一部分  案例概述");
  addSlideTitle(s, "我遇到了什么问题？");

  // 左侧：痛点（3张卡片竖向排列）
  const pains = [
    { icon: "📉", title: "缺乏短期正反馈", desc: "成绩提升慢，学生看不到自己每天的进步" },
    { icon: "😴", title: "课堂参与度低", desc: "任务完成率不高，作业拖延现象普遍" },
    { icon: "🏆", title: "班级氛围平淡", desc: "学生之间缺少良性竞争与互动激励" },
  ];
  pains.forEach((p, i) => {
    addCard(s, 0.4, 1.55 + i * 1.08, 4.0, 0.95, "1E2070");
    s.addText(p.icon + "  " + p.title, {
      x: 0.55, y: 1.6 + i * 1.08, w: 3.7, h: 0.38,
      fontSize: 15, fontFace: "Microsoft YaHei", bold: true,
      color: C.gold, align: "left", valign: "middle", margin: 0
    });
    s.addText(p.desc, {
      x: 0.55, y: 1.97 + i * 1.08, w: 3.7, h: 0.35,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: C.gray, align: "left", valign: "middle", margin: 0
    });
  });

  // 箭头
  s.addShape(pres.shapes.LINE, {
    x: 4.5, y: 2.8, w: 0.6, h: 0,
    line: { color: C.gold, width: 2.5, dashType: "solid" }
  });
  s.addText("→", {
    x: 4.45, y: 2.6, w: 0.7, h: 0.4,
    fontSize: 22, color: C.gold, align: "center", margin: 0
  });

  // 右侧：解决方案
  addCard(s, 5.2, 1.3, 4.3, 3.5, "1E2070");
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.3, w: 4.3, h: 0.5,
    fill: { color: C.purple }, line: { color: C.purple, width: 0 }
  });
  s.addText("💡  解决方案", {
    x: 5.25, y: 1.3, w: 4.2, h: 0.5,
    fontSize: 15, fontFace: "Microsoft YaHei", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });
  s.addText([
    { text: "借助生成式AI，把成绩管理系统改造成一套", options: { breakLine: false } },
    { text: "角色养成游戏", options: { bold: true, color: C.gold, breakLine: true } },
    { text: "\n", options: { breakLine: true } },
    { text: "• 完成作业/测验 → 获得经验值\n", options: { breakLine: true } },
    { text: "• 经验积累 → 角色升级进化\n", options: { breakLine: true } },
    { text: "• 同学互相挑战 → 良性竞争\n", options: { breakLine: true } },
    { text: "• 每日抽卡道具 → 持续动力\n", options: { breakLine: true } },
    { text: "\n成绩不再是冰冷数字，而是英雄成长之路", options: { italic: true, color: C.gray } },
  ], {
    x: 5.35, y: 1.9, w: 4.0, h: 2.7,
    fontSize: 14, fontFace: "Microsoft YaHei", color: C.white,
    align: "left", valign: "top", margin: 0
  });
}

// ============================================================
// 第3页：应用场景定位
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第一部分  案例概述");
  addSlideTitle(s, "对应应用场景");

  // 场景框架图
  // 主场景大框
  addCard(s, 0.4, 1.3, 9.2, 1.0, C.purple);
  s.addText("主场景：助力学习变革", {
    x: 0.55, y: 1.3, w: 9.0, h: 0.5,
    fontSize: 20, fontFace: "Microsoft YaHei", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });
  s.addText("教师应用AI，支持对话式、游戏化、个性化、协作探究与跨学科学习，推动学生向知识建构者转变", {
    x: 0.55, y: 1.8, w: 9.0, h: 0.4,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: "D4C5FF", align: "left", valign: "middle", margin: 0
  });

  // 5个场景示例卡片
  const scenes = [
    { label: "场景1\n对话式学习", active: false },
    { label: "场景2\n游戏化学习", active: true },
    { label: "场景3\n个性化学习", active: false },
    { label: "场景4\n协作探究", active: false },
    { label: "场景5\n跨学科学习", active: false },
  ];
  scenes.forEach((sc, i) => {
    const bg = sc.active ? C.gold : "1E2070";
    const fc = sc.active ? C.dark : C.gray;
    addCard(s, 0.4 + i * 1.85, 2.55, 1.7, 1.1, bg);
    if (sc.active) {
      // 高亮边框
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.4 + i * 1.85, y: 2.55, w: 1.7, h: 1.1,
        fill: { color: C.purple, transparency: 100 },
        line: { color: C.gold, width: 3 }
      });
    }
    s.addText(sc.label, {
      x: 0.42 + i * 1.85, y: 2.55, w: 1.66, h: 1.1,
      fontSize: 13, fontFace: "Microsoft YaHei", bold: sc.active,
      color: fc, align: "center", valign: "middle", margin: 0
    });
  });

  // 说明文字
  addCard(s, 0.4, 3.85, 9.2, 1.3, "1E2070");
  s.addText("📌  场景示例2 · 游戏化学习", {
    x: 0.6, y: 3.9, w: 8.8, h: 0.45,
    fontSize: 15, fontFace: "Microsoft YaHei", bold: true,
    color: C.gold, align: "left", valign: "middle", margin: 0
  });
  s.addText(
    "应用生成式AI设计教育游戏情景、挑战任务与激励机制，创设沉浸式学习情境，将知识学习与能力训练融入游戏关卡，激发学习动机，提升学生问题解决与自主学习能力。",
    {
      x: 0.6, y: 4.32, w: 8.8, h: 0.75,
      fontSize: 13, fontFace: "Microsoft YaHei",
      color: C.white, align: "left", valign: "top", margin: 0
    }
  );
}

// ============================================================
// 第4页：主要工具介绍
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第一部分  案例概述");
  addSlideTitle(s, "使用的主要AI工具");

  const tools = [
    {
      name: "WorkBuddy",
      type: "AI编程助手",
      desc: "国内AI辅助编程工具，支持自然语言描述需求并生成代码。\n用于：架构设计、代码生成、Debug分析",
      tag: "核心工具",
      tagColor: C.gold,
      icon: "🤖"
    },
    {
      name: "微信云开发",
      type: "后端平台",
      desc: "微信官方Serverless平台，提供云数据库、云函数、云存储。\n用于：数据库存储、业务逻辑云函数",
      tag: "后端平台",
      tagColor: C.teal,
      icon: "☁️"
    },
    {
      name: "微信小程序",
      type: "前端载体",
      desc: "学生端4个核心页面 + 教师端管理页面，无需下载安装即可使用。\n用于：学生端界面、教师端管理",
      tag: "前端载体",
      tagColor: C.green,
      icon: "📱"
    },
  ];

  tools.forEach((t, i) => {
    const x = 0.4 + i * 3.15;
    addCard(s, x, 1.3, 2.9, 3.8, "1A1A5A");
    // 顶部色条
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.3, w: 2.9, h: 0.5,
      fill: { color: t.tagColor }, line: { color: t.tagColor, width: 0 }
    });
    s.addText(t.tag, {
      x, y: 1.3, w: 2.9, h: 0.5,
      fontSize: 12, fontFace: "Microsoft YaHei", bold: true,
      color: i === 0 ? C.dark : C.white,
      align: "center", valign: "middle", margin: 0
    });
    // 图标
    s.addText(t.icon, {
      x: x + 0.05, y: 1.9, w: 2.8, h: 0.7,
      fontSize: 32, align: "center", valign: "middle", margin: 0
    });
    // 工具名
    s.addText(t.name, {
      x: x + 0.1, y: 2.6, w: 2.7, h: 0.55,
      fontSize: 18, fontFace: "Microsoft YaHei", bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0
    });
    s.addText(t.type, {
      x: x + 0.1, y: 3.1, w: 2.7, h: 0.35,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: t.tagColor, align: "center", valign: "middle", margin: 0
    });
    s.addText(t.desc, {
      x: x + 0.1, y: 3.48, w: 2.7, h: 1.45,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: C.gray, align: "left", valign: "top", margin: 0
    });
  });
}

// ============================================================
// 第5页：系统架构图
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第二部分  过程与方法  |  步骤1：用AI规划系统架构");
  addSlideTitle(s, "整体系统架构");

  // 架构层次
  const layers = [
    { label: "学生端（前端）", items: ["首页·角色卡", "天赋测试", "排行榜", "挑战页面", "抽卡页面"], color: C.teal },
    { label: "教师端（前端）", items: ["成绩导入", "任务管理", "三参数导入", "道具发放"], color: C.green },
    { label: "云函数层（业务逻辑）", items: ["登录/绑定", "天赋匹配", "任务系统", "挑战系统", "口令管理"], color: C.purple },
    { label: "云数据库（数据存储）", items: ["students集合", "scores集合", "tasks集合", "challenges集合"], color: C.gold },
  ];

  layers.forEach((layer, i) => {
    const y = 1.3 + i * 1.0;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y, w: 1.4, h: 0.82,
      fill: { color: layer.color }, line: { color: layer.color, width: 0 }
    });
    s.addText(layer.label, {
      x: 0.4, y, w: 1.4, h: 0.82,
      fontSize: 11, fontFace: "Microsoft YaHei", bold: true,
      color: i === 3 ? C.dark : C.white,
      align: "center", valign: "middle", margin: 0
    });

    // 功能项目
    layer.items.forEach((item, j) => {
      const ix = 2.0 + j * 1.55;
      addCard(s, ix, y + 0.06, 1.45, 0.7, "1E2070");
      s.addShape(pres.shapes.RECTANGLE, {
        x: ix, y: y + 0.06, w: 0.06, h: 0.7,
        fill: { color: layer.color }, line: { color: layer.color, width: 0 }
      });
      s.addText(item, {
        x: ix + 0.12, y: y + 0.06, w: 1.28, h: 0.7,
        fontSize: 11, fontFace: "Microsoft YaHei",
        color: C.white, align: "left", valign: "middle", margin: 0
      });
    });
  });

  // AI参与标注
  s.addText("💡  以上全部架构由 WorkBuddy AI 辅助设计，教师用自然语言描述需求 → AI生成完整技术方案", {
    x: 0.4, y: 4.9, w: 9.2, h: 0.45,
    fontSize: 12, fontFace: "Microsoft YaHei", italic: true,
    color: C.gold, align: "left", valign: "middle", margin: 0
  });
}

// ============================================================
// 第6页：五大核心功能
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第二部分  过程与方法  |  步骤2：AI辅助实现核心功能");
  addSlideTitle(s, "五大核心系统");

  const features = [
    {
      icon: "🧙", title: "角色养成系统",
      points: ["成绩 → 经验值转化", "等级自动提升", "属性成长可视化", "道具使用永久加成"],
      color: C.purple
    },
    {
      icon: "🔮", title: "天赋测试系统",
      points: ["18题学习风格测试", "六维属性精准匹配", "测试觉醒100%成长", "跳过觉醒80%成长"],
      color: "E879F9"
    },
    {
      icon: "📋", title: "任务系统",
      points: ["每日3次基础抽卡", "普通任务 +3次", "特殊任务 +5次", "教师确认即发放"],
      color: C.teal
    },
    {
      icon: "⚔️", title: "挑战系统",
      points: ["消耗凭证发起挑战", "等级差奖励机制", "胜负影响排名", "历史对战记录"],
      color: C.gold
    },
    {
      icon: "🏆", title: "排行榜系统",
      points: ["班级实时排名", "经验值排序", "头像+级别显示", "激励竞争氛围"],
      color: C.green
    },
  ];

  const xs = [0.15, 2.05, 3.95, 5.85, 7.75];
  features.forEach((f, i) => {
    const x = xs[i];
    addCard(s, x, 1.3, 1.75, 3.8, "1A1A5A");
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.3, w: 1.75, h: 0.55,
      fill: { color: f.color }, line: { color: f.color, width: 0 }
    });
    s.addText(f.icon, {
      x, y: 1.3, w: 1.75, h: 0.55,
      fontSize: 20, align: "left", valign: "middle",
      margin: [0, 0, 0, 6]
    });
    s.addText(f.title, {
      x: x + 0.32, y: 1.3, w: 1.38, h: 0.55,
      fontSize: 12, fontFace: "Microsoft YaHei", bold: true,
      color: (i === 1 || i === 3) ? C.dark : C.white,
      align: "left", valign: "middle", margin: 0
    });
    // 功能列表
    f.points.forEach((pt, j) => {
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.1, y: 2.0 + j * 0.72, w: 0.1, h: 0.1,
        fill: { color: f.color }, line: { color: f.color, width: 0 }
      });
      s.addText(pt, {
        x: x + 0.25, y: 1.92 + j * 0.72, w: 1.42, h: 0.55,
        fontSize: 10.5, fontFace: "Microsoft YaHei",
        color: C.white, align: "left", valign: "middle", margin: 0
      });
    });
  });
}

// ============================================================
// 第7页：挑战系统 - 等级差奖励机制（详解）
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第二部分  过程与方法  |  步骤2：核心功能详解 · 挑战系统");
  addSlideTitle(s, "等级差奖励机制——鼓励学生挑战更强的对手");

  // 说明
  s.addText("设计理念：挑战比自己强的对手 → 风险高 → 奖励大；挑战比自己弱的对手 → 奖励缩水，避免刷弱", {
    x: 0.5, y: 1.5, w: 9, h: 0.45,
    fontSize: 13, fontFace: "Microsoft YaHei", italic: true,
    color: C.gray, align: "left", valign: "middle", margin: 0
  });

  // 奖励表格
  const tableRows = [
    [
      { text: "对手等级差", options: { bold: true, color: C.white, fill: { color: C.purple } } },
      { text: "情形说明", options: { bold: true, color: C.white, fill: { color: C.purple } } },
      { text: "EXP奖励", options: { bold: true, color: C.white, fill: { color: C.purple } } },
      { text: "设计意图", options: { bold: true, color: C.white, fill: { color: C.purple } } },
    ],
    ["对手低 ≥10级", "碾压局", { text: "+1 EXP", options: { color: C.red, bold: true } }, "奖励缩水，不鼓励欺负弱者"],
    ["对手低 1~9级", "正常低分段", { text: "+3 EXP", options: { color: C.gold } }, "基础奖励"],
    ["对手同级 ±0级", "势均力敌", { text: "+5 EXP", options: { color: C.gold, bold: true } }, "基础奖励（最常见）"],
    ["对手高 1~4级", "略高难度", { text: "+7 EXP", options: { color: C.green, bold: true } }, "勇于挑战，小幅加成"],
    ["对手高 ≥5级", "高难度挑战", { text: "+10 EXP", options: { color: C.teal, bold: true } }, "大幅奖励，鼓励超越"],
  ];

  s.addTable(tableRows, {
    x: 0.5, y: 2.1, w: 9.0, h: 2.8,
    border: { pt: 1, color: "2D2D7A" },
    fill: { color: "1A1A5A" },
    fontSize: 13,
    fontFace: "Microsoft YaHei",
    color: C.white,
    align: "center",
    valign: "middle",
    rowH: 0.44,
    colW: [2.0, 1.8, 1.8, 3.4],
  });

  s.addText("⚙️ AI辅助实现：我用自然语言描述这套规则 → WorkBuddy 自动生成云函数代码，包含完整的等级差计算逻辑", {
    x: 0.5, y: 4.9, w: 9, h: 0.45,
    fontSize: 12, fontFace: "Microsoft YaHei", italic: true,
    color: C.gold, align: "left", valign: "middle", margin: 0
  });
}

// ============================================================
// 第8页：AI辅助开发过程（迭代）
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第二部分  过程与方法  |  步骤3：AI辅助调试与迭代");
  addSlideTitle(s, "开发迭代过程——用AI解决每一个障碍");

  // 时间轴流程
  const steps = [
    { num: 1, title: "描述需求", desc: "用自然语言\n告诉AI想做什么", color: C.purple },
    { num: 2, title: "AI生成代码", desc: "WorkBuddy生成\n完整可运行代码", color: C.teal },
    { num: 3, title: "上传测试", desc: "部署到微信\n小程序模拟器", color: C.green },
    { num: 4, title: "发现问题", desc: "记录错误现象\n截图/日志", color: C.red },
    { num: 5, title: "AI分析修复", desc: "将日志提交AI\n获得修复方案", color: C.gold },
  ];

  steps.forEach((st, i) => {
    const x = 0.4 + i * 1.85;
    // 圆圈
    s.addShape(pres.shapes.OVAL, {
      x, y: 1.5, w: 1.5, h: 1.5,
      fill: { color: st.color }, line: { color: st.color, width: 0 },
      shadow: makeShadow()
    });
    s.addText(String(st.num), {
      x, y: 1.5, w: 1.5, h: 0.7,
      fontSize: 28, fontFace: "Arial", bold: true,
      color: i === 4 ? C.dark : C.white,
      align: "center", valign: "middle", margin: 0
    });
    s.addText(st.title, {
      x, y: 2.0, w: 1.5, h: 0.65,
      fontSize: 13, fontFace: "Microsoft YaHei", bold: true,
      color: i === 4 ? C.dark : C.white,
      align: "center", valign: "middle", margin: 0
    });
    // 箭头
    if (i < 4) {
      s.addText("→", {
        x: x + 1.5, y: 1.95, w: 0.35, h: 0.6,
        fontSize: 18, color: C.gray, align: "center", margin: 0
      });
    }
    // 描述
    s.addText(st.desc, {
      x: x - 0.05, y: 3.15, w: 1.6, h: 0.8,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: C.gray, align: "center", valign: "top", margin: 0
    });
  });

  // 典型Bug案例
  addCard(s, 0.4, 4.1, 9.2, 1.3, "1A1A5A");
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 4.1, w: 0.07, h: 1.3,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 }
  });
  s.addText("典型案例：抽卡次数跨日重置Bug", {
    x: 0.6, y: 4.13, w: 8.8, h: 0.42,
    fontSize: 14, fontFace: "Microsoft YaHei", bold: true,
    color: C.gold, align: "left", valign: "middle", margin: 0
  });
  s.addText("现象：学生当天完成任务获得+3次奖励，第二天打开发现奖励丢失只剩3次  |  根因：云函数跨日判断逻辑错误，无条件重置为3次，忽略了任务奖励  |  AI协助定位：提交日志截图 → AI分析 → 10分钟内修复", {
    x: 0.6, y: 4.57, w: 8.8, h: 0.7,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: C.white, align: "left", valign: "top", margin: 0
  });
}

// ============================================================
// 第9页：学生使用全流程
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第二部分  过程与方法  |  步骤4：学生使用全流程");
  addSlideTitle(s, "学生日常使用流程");

  const flow = [
    { icon: "📱", step: "扫码进入", detail: "微信扫一扫\n无需下载安装" },
    { icon: "🔑", step: "口令登录", detail: "输入班级+\n个人口令" },
    { icon: "🔮", step: "天赋测试", detail: "18题测试\n匹配天赋类型" },
    { icon: "📋", step: "查看任务", detail: "每日学习\n任务列表" },
    { icon: "✅", step: "完成作业", detail: "提交作业\n等待教师确认" },
    { icon: "🎁", step: "获得奖励", detail: "EXP + 抽卡\n次数自动发放" },
    { icon: "⚔️", step: "升级挑战", detail: "角色升级\n挑战班级同学" },
    { icon: "🔑", step: "修改口令", detail: "自助修改\n登录口令" },
  ];

  flow.forEach((fl, i) => {
    const x = 0.15 + i * 1.2;
    // 顶部图标
    s.addText(fl.icon, {
      x, y: 1.3, w: 1.1, h: 0.6,
      fontSize: 24, align: "center", margin: 0
    });
    // 步骤框
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.95, w: 1.1, h: 0.5,
      fill: { color: i % 2 === 0 ? C.purple : C.teal },
      line: { color: i % 2 === 0 ? C.purple : C.teal, width: 0 }
    });
    s.addText(fl.step, {
      x, y: 1.95, w: 1.1, h: 0.5,
      fontSize: 11, fontFace: "Microsoft YaHei", bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0
    });
    // 详情
    s.addText(fl.detail, {
      x: x - 0.05, y: 2.52, w: 1.2, h: 0.7,
      fontSize: 10, fontFace: "Microsoft YaHei",
      color: C.gray, align: "center", valign: "top", margin: 0
    });
    // 箭头
    if (i < 7) {
      s.addText("→", {
        x: x + 1.1, y: 1.98, w: 0.1, h: 0.44,
        fontSize: 12, color: C.gray, align: "center", margin: 0
      });
    }
  });

  // 底部正反馈循环说明
  addCard(s, 0.4, 3.4, 9.2, 1.85, "1A1A5A");
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 3.4, w: 9.2, h: 0.45,
    fill: { color: "12124A" }, line: { color: "12124A", width: 0 }
  });
  s.addText("🔄  持续正反馈循环设计", {
    x: 0.55, y: 3.4, w: 9.0, h: 0.45,
    fontSize: 14, fontFace: "Microsoft YaHei", bold: true,
    color: C.gold, align: "left", valign: "middle", margin: 0
  });
  s.addText(
    "学习行为（作业/测验）→ 系统奖励（EXP/道具）→ 角色成长（升级）→ 社交激励（排名/挑战）→ 再次学习行为\n每个环节都有即时反馈，打破了传统学习中努力与回报之间反馈滞后的问题\nv3.1.0新增：天赋测试精准匹配 + 学生自助修改口令，增强个性化与安全性",
    {
      x: 0.55, y: 3.88, w: 9.0, h: 1.2,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: C.white, align: "left", valign: "top", margin: 0
    }
  );
}

// ============================================================
// 第10页：规范应用说明
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第三部分  规范应用说明");
  addSlideTitle(s, "如何规范应用人工智能");

  const norms = [
    {
      icon: "🔒",
      title: "数据隐私保护",
      content: "• 不存储学生真实姓名，仅用自定义昵称\n• 所有数据存储在微信官方云开发平台，不与第三方共享\n• 遵守《个人信息保护法》，学生数据仅用于教学目的",
      color: C.teal
    },
    {
      icon: "🏷️",
      title: "AI生成内容标注",
      content: "• 系统代码、架构设计均注明AI辅助生成\n• 向学生说明这个系统是老师用AI工具开发的\n• 视频片尾标注部分内容由AI辅助生成，经人工审核修订",
      color: C.purple
    },
    {
      icon: "📐",
      title: "学生使用边界",
      content: "• 奖励完全由教师确认的真实学习成果决定，不可刷操作\n• 小程序设计刻意避免让学生绕过学习获得奖励\n• 游戏机制服务于学习本身，不成为干扰因素",
      color: C.green
    },
    {
      icon: "⚖️",
      title: "技术应用审慎性",
      content: "• AI生成的代码经过逐行审查，不直接上线\n• 发现Bug及时修复，不轻率上线存在安全隐患的版本\n• 对AI生成内容进行教育伦理审查，确保价值观正确",
      color: C.gold
    },
  ];

  const xs2 = [0.3, 5.0];
  const ys2 = [1.3, 3.2];
  norms.forEach((n, i) => {
    const x = xs2[i % 2];
    const y = ys2[Math.floor(i / 2)];
    addCard(s, x, y, 4.55, 1.65, "1A1A5A");
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.55, h: 0.48,
      fill: { color: n.color }, line: { color: n.color, width: 0 }
    });
    s.addText(n.icon + "  " + n.title, {
      x: x + 0.12, y, w: 4.3, h: 0.48,
      fontSize: 14, fontFace: "Microsoft YaHei", bold: true,
      color: i === 3 ? C.dark : C.white,
      align: "left", valign: "middle", margin: 0
    });
    s.addText(n.content, {
      x: x + 0.12, y: y + 0.52, w: 4.3, h: 1.0,
      fontSize: 11.5, fontFace: "Microsoft YaHei",
      color: C.white, align: "left", valign: "top", margin: 0
    });
  });
}

// ============================================================
// 第11页：应用成效
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第四部分  成效与经验");
  addSlideTitle(s, "应用成效");

  // 四个大数字指标
  const metrics = [
    { num: "↑30%", label: "任务完成率提升", sub: "对比引入前", color: C.green },
    { num: "↓70%", label: "教师管理耗时减少", sub: "5分钟掌握全班学情", color: C.teal },
    { num: "×3", label: "自主练习增加", sub: "学生主动提交作业", color: C.purple },
    { num: "100%", label: "学生参与覆盖率", sub: "全班同学使用系统", color: C.gold },
  ];

  metrics.forEach((m, i) => {
    const x = 0.25 + i * 2.35;
    addCard(s, x, 1.3, 2.1, 2.3, "1A1A5A");
    s.addText(m.num, {
      x, y: 1.4, w: 2.1, h: 1.0,
      fontSize: 42, fontFace: "Arial", bold: true,
      color: m.color, align: "center", valign: "middle", margin: 0
    });
    s.addText(m.label, {
      x, y: 2.45, w: 2.1, h: 0.45,
      fontSize: 13, fontFace: "Microsoft YaHei", bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0
    });
    s.addText(m.sub, {
      x, y: 2.9, w: 2.1, h: 0.45,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: C.gray, align: "center", valign: "middle", margin: 0
    });
  });

  // 学生反馈引用
  addCard(s, 0.3, 3.8, 9.3, 1.6, "1A1A5A");
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 3.8, w: 0.06, h: 1.6,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 }
  });
  s.addText("学生反馈（真实原话）", {
    x: 0.5, y: 3.85, w: 9.0, h: 0.42,
    fontSize: 13, fontFace: "Microsoft YaHei", bold: true,
    color: C.gold, align: "left", valign: "middle", margin: 0
  });
  s.addText(
    "「老师，我今天做完题想抽卡！」  「我要挑战XX，他比我高2级，我要追上去！」  「妈妈，我们班有排行榜，我要进前三！」\n\n——这些是真实发生的对话。学生从被迫学习转变为主动学习，正是这套系统设计的核心价值。",
    {
      x: 0.5, y: 4.28, w: 9.0, h: 1.0,
      fontSize: 12, fontFace: "Microsoft YaHei", italic: true,
      color: C.white, align: "left", valign: "top", margin: 0
    }
  );
}

// ============================================================
// 第12页：经验总结
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s, "第四部分  成效与经验");
  addSlideTitle(s, "三条可复制的经验");

  const experiences = [
    {
      num: "01",
      title: "从教育需求出发，而不是从技术出发",
      content: "先想清楚要解决什么教育问题，再让AI提供技术方案。技术是工具，教育目标是核心。不要为了用AI而用AI，要因为有真实问题才用AI。",
      color: C.purple
    },
    {
      num: "02",
      title: "AI是协作者，不是替代者",
      content: "教育设计、游戏规则制定、效果评估，这些核心工作仍需教师主导。AI负责实现，教师负责设计方向和价值判断。人机协同，各发挥所长。",
      color: C.teal
    },
    {
      num: "03",
      title: "快速迭代是关键策略",
      content: "用AI快速生成原型 → 学生试用反馈 → 针对性改进 → 再次迭代。不要追求完美的第一版，要用迭代速度换取真实反馈，持续优化。",
      color: C.gold
    },
  ];

  experiences.forEach((exp, i) => {
    const y = 1.35 + i * 1.3;
    addCard(s, 0.4, y, 9.2, 1.15, "1A1A5A");
    // 编号
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y, w: 0.9, h: 1.15,
      fill: { color: exp.color }, line: { color: exp.color, width: 0 }
    });
    s.addText(exp.num, {
      x: 0.4, y, w: 0.9, h: 1.15,
      fontSize: 26, fontFace: "Arial", bold: true,
      color: i === 2 ? C.dark : C.white,
      align: "center", valign: "middle", margin: 0
    });
    // 标题
    s.addText(exp.title, {
      x: 1.45, y: y + 0.1, w: 8.0, h: 0.42,
      fontSize: 15, fontFace: "Microsoft YaHei", bold: true,
      color: exp.color, align: "left", valign: "middle", margin: 0
    });
    // 内容
    s.addText(exp.content, {
      x: 1.45, y: y + 0.54, w: 8.0, h: 0.65,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: C.white, align: "left", valign: "top", margin: 0
    });
  });

  // 底部
  s.addText("💬  \"你不需要懂技术，你只需要有想法——AI可以帮你把想法变成现实\"", {
    x: 0.5, y: 4.95, w: 9, h: 0.4,
    fontSize: 13, fontFace: "Microsoft YaHei", italic: true, bold: true,
    color: C.gold, align: "center", valign: "middle", margin: 0
  });
}

// ============================================================
// 第13页：结尾页
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  // 顶部装饰
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.8,
    fill: { color: C.purple }, line: { color: C.purple, width: 0 }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 4.825, w: 10, h: 0.8,
    fill: { color: "12124A" }, line: { color: "12124A", width: 0 }
  });

  // 金色竖线
  s.addShape(pres.shapes.RECTANGLE, {
    x: 4.97, y: 1.0, w: 0.06, h: 3.7,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 }
  });

  // 左侧
  s.addText("感谢观看", {
    x: 0.5, y: 1.3, w: 4.3, h: 1.0,
    fontSize: 40, fontFace: "Microsoft YaHei", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });
  s.addText("Thank You", {
    x: 0.5, y: 2.3, w: 4.3, h: 0.6,
    fontSize: 20, fontFace: "Arial",
    color: C.purple, align: "left", valign: "middle", charSpacing: 4, margin: 0
  });
  s.addText("欢迎同行交流与探讨", {
    x: 0.5, y: 3.0, w: 4.3, h: 0.5,
    fontSize: 15, fontFace: "Microsoft YaHei",
    color: C.gray, align: "left", valign: "middle", margin: 0
  });

  // 右侧：关键信息
  const rights = [
    { label: "案例名称", value: "学业英雄养成记" },
    { label: "应用场景", value: "游戏化学习（助力学习变革）" },
    { label: "主要工具", value: "WorkBuddy + 微信云开发" },
    { label: "适用学段", value: "初中（可拓展至其他学段）" },
  ];
  rights.forEach((r, i) => {
    s.addText(r.label + "：", {
      x: 5.3, y: 1.4 + i * 0.75, w: 1.5, h: 0.55,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: C.gold, align: "left", valign: "middle", margin: 0
    });
    s.addText(r.value, {
      x: 6.7, y: 1.4 + i * 0.75, w: 3.0, h: 0.55,
      fontSize: 12, fontFace: "Microsoft YaHei",
      color: C.white, align: "left", valign: "middle", margin: 0
    });
  });

  // 底部声明
  s.addText("本案例使用AI工具辅助开发，部分内容由AI生成并经人工审核修订  |  AI Generated Content Labeled", {
    x: 0.5, y: 4.87, w: 9, h: 0.55,
    fontSize: 10, fontFace: "Microsoft YaHei",
    color: C.gray, align: "center", valign: "middle", margin: 0
  });

  // 顶部
  s.addText("学业英雄养成记 · 视频案例", {
    x: 0.3, y: 0, w: 9.4, h: 0.8,
    fontSize: 14, fontFace: "Microsoft YaHei",
    color: "D4C5FF", align: "left", valign: "middle", margin: 0
  });
}

// ============================================================
// 生成文件
// ============================================================
pres.writeFile({ fileName: "/Users/jiliangma/WorkBuddy/Claw/math-hero-miniapp/docs/视频配套PPT-学业英雄养成记.pptx" })
  .then(() => {
    console.log("✅ PPT已生成：docs/视频配套PPT-学业英雄养成记.pptx");
    console.log("   共13页，对应视频脚本的四个部分");
  })
  .catch(err => console.error("❌ 生成失败:", err));

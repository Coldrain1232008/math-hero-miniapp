const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign,
  HeadingLevel, PageOrientation
} = require('docx');
const fs = require('fs');

// ====== 样式辅助 ======
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "333333" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const THIN = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const THIN_BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const cell = (text, opts = {}) => new TableCell({
  borders: THIN_BORDERS,
  width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
  shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : undefined,
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 100, bottom: 100, left: 150, right: 150 },
  rowSpan: opts.rowSpan,
  columnSpan: opts.colSpan,
  children: [
    new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text),
        font: "Microsoft YaHei",
        size: opts.size || 20,
        bold: !!opts.bold,
        color: opts.color || "000000"
      })]
    })
  ]
});

const labelCell = (text, opts = {}) => cell(text, { bg: "E8F0FE", bold: true, size: 20, ...opts });
const valueCell = (text, opts = {}) => cell(text, { size: 20, ...opts });

// 多行内容的单元格
const multiLineCell = (lines, opts = {}) => new TableCell({
  borders: THIN_BORDERS,
  width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
  shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : undefined,
  margins: { top: 100, bottom: 100, left: 150, right: 150 },
  rowSpan: opts.rowSpan,
  columnSpan: opts.colSpan,
  verticalAlign: VerticalAlign.TOP,
  children: lines.map(line => new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { after: 40 },
    children: [new TextRun({
      text: String(line),
      font: "Microsoft YaHei",
      size: opts.size || 20,
      bold: !!opts.bold,
      color: opts.color || "000000"
    })]
  }))
});

// ====== 文档构建 ======
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Microsoft YaHei", size: 20 } }
    }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 }
      }
    },
    children: [
      // ===== 标题 =====
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 300 },
        children: [new TextRun({
          text: "用AI案例信息表",
          font: "Microsoft YaHei",
          size: 36,
          bold: true
        })]
      }),

      // ===== 副标题/说明 =====
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400 },
        children: [new TextRun({
          text: "2026年北京市教师人工智能应用案例征集",
          font: "Microsoft YaHei",
          size: 22,
          color: "666666"
        })]
      }),

      // ===== 主信息表 =====
      new Table({
        width: { size: 9906, type: WidthType.DXA },
        columnWidths: [1800, 1800, 1800, 1800, 2706],
        borders: { inside: THIN, outside: BORDER },
        rows: [
          // 案例名称
          new TableRow({
            children: [
              labelCell("案例名称", { colSpan: 1 }),
              multiLineCell([
                "学业英雄养成记——生成式人工智能助力游戏化学习的创新实践"
              ], { colSpan: 4, size: 22, bold: true })
            ]
          }),

          // 作者信息 - 标题行
          new TableRow({
            children: [
              labelCell("作者信息", { colSpan: 5, align: AlignmentType.CENTER, bg: "D0E4FF" })
            ]
          }),

          // 姓名 + 工作单位
          new TableRow({
            children: [
              labelCell("姓名"),
              valueCell("【请填写】", { colSpan: 1 }),
              labelCell("工作单位"),
              valueCell("【请填写学校全称】", { colSpan: 2 })
            ]
          }),

          // 职务/职称 + 手机号码
          new TableRow({
            children: [
              labelCell("职务/职称"),
              valueCell("数学教师", { colSpan: 1 }),
              labelCell("手机号码"),
              valueCell("【请填写】", { colSpan: 2 })
            ]
          }),

          // 学段学科
          new TableRow({
            children: [
              labelCell("学段"),
              multiLineCell(["□幼儿园  □小学  ☑初中  □高中  □特教", "□中等职业教育  □高等教育（含高职）"], { colSpan: 4, size: 19 })
            ]
          }),

          new TableRow({
            children: [
              labelCell("学科/专业"),
              valueCell("数学（跨学科：信息技术·游戏化教育设计）", { colSpan: 4 })
            ]
          }),

          // 平台工具 标题
          new TableRow({
            children: [
              labelCell("平台工具", { colSpan: 5, align: AlignmentType.CENTER, bg: "D0E4FF" })
            ]
          }),

          // 平台工具1
          new TableRow({
            children: [
              labelCell("平台工具\n1名称"),
              multiLineCell([
                "WorkBuddy（腾讯云开发 AI 编程助手）",
                "类型：☑PC端应用程序  □其他",
                "费用：□完全免费  ☑有限免费  □完全付费"
              ], { colSpan: 4, size: 18 })
            ]
          }),

          // 平台工具2
          new TableRow({
            children: [
              labelCell("平台工具\n2名称"),
              multiLineCell([
                "微信云开发（Cloudbase）",
                "类型：☑小程序  □其他",
                "费用：□完全免费  ☑有限免费  □完全付费"
              ], { colSpan: 4, size: 18 })
            ]
          }),

          // 应用场景 标题
          new TableRow({
            children: [
              labelCell("应用场景", { colSpan: 5, align: AlignmentType.CENTER, bg: "D0E4FF" })
            ]
          }),

          // 主场景
          new TableRow({
            children: [
              labelCell("主场景"),
              multiLineCell(["☑助力学习变革", "□助力教学提质  □助力育人进阶  □助力评价增效  □助力管理升级  □助力研究创新"], { colSpan: 4, size: 18 })
            ]
          }),

          // 场景示例
          new TableRow({
            children: [
              labelCell("场景示例"),
              multiLineCell([
                "场景示例2：游戏化学习",
                "",
                "应用生成式人工智能设计教育游戏情景、挑战任务与激励机制，",
                "创设沉浸式学习情境，将知识学习与能力训练融入游戏关卡，",
                "激发学习动机，提升学生问题解决与自主学习能力。"
              ], { colSpan: 4, size: 18 })
            ]
          }),

          // 案例内容简介 标题
          new TableRow({
            children: [
              labelCell("案例内容简介（不超过300字）", { colSpan: 5, align: AlignmentType.CENTER, bg: "D0E4FF" })
            ]
          }),

          // 案例内容简介 正文
          new TableRow({
            children: [
              multiLineCell([
                "一、问题缘起",
                "初中生学习积极性难以持续，传统评价体系难以实现即时激励。教师希望将学业成绩转化为持续驱动学习的内在动力。",
                "",
                "二、解决方法",
                "教师借助生成式人工智能（WorkBuddy编程助手）设计并开发了「学业英雄养成记」微信小程序。AI辅助完成了系统架构设计、角色成长模型搭建、游戏化机制（等级/属性/任务/挑战/抽卡）的代码生成与调试，整个开发周期压缩至约4周。",
                "",
                "三、应用场景",
                "学生完成数学作业、参与课堂互动、取得考试进步后，即可获得经验值，推动角色等级提升；每日任务与抽卡机制提供随机奖励；班级排行榜与挑战系统激发同伴竞争意识；教师端支持成绩导入、任务管理与道具发放，实现人机协同管理。",
                "",
                "四、应用成效",
                "学生参与度显著提升，作业完成率提高，课堂互动更加积极。AI辅助开发让教师具备了「从零创建数字化激励工具」的能力，为游戏化教育的个性化落地提供了可复制的实践路径。"
              ], { colSpan: 5, size: 19 })
            ]
          }),

          // 作者声明
          new TableRow({
            children: [
              labelCell("作者声明", { colSpan: 5, align: AlignmentType.CENTER, bg: "D0E4FF" })
            ]
          }),
          new TableRow({
            children: [
              multiLineCell([
                "我在此声明：该案例为本人原创，不涉及抄袭或侵犯他人著作权等问题。",
                "",
                "作者签名：_______________",
                "",
                "年    月    日"
              ], { colSpan: 5, size: 19 })
            ]
          }),

          // 单位推荐意见
          new TableRow({
            children: [
              labelCell("作者所在单位推荐意见", { colSpan: 5, align: AlignmentType.CENTER, bg: "D0E4FF" })
            ]
          }),
          new TableRow({
            children: [
              multiLineCell([
                "同意 / 不同意 上报",
                "",
                "单位（盖章）：",
                "",
                "年    月    日"
              ], { colSpan: 5, size: 19 })
            ]
          }),
        ]
      }),

      // ===== 共享提示 =====
      new Paragraph({
        spacing: { before: 300 },
        children: [new TextRun({
          text: "共享提示：同意将案例推荐给国家智慧教育公共服务平台（www.smartedu.cn）并在主办单位活动网站共享。",
          font: "Microsoft YaHei",
          size: 18,
          color: "666666"
        })]
      }),

      // ===== 待确认问题备注 =====
      new Paragraph({
        spacing: { before: 600 },
        children: [new TextRun({
          text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          font: "Microsoft YaHei",
          size: 18,
          color: "CCCCCC"
        })]
      }),
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({
          text: "【需要马老师确认/补充的内容】",
          font: "Microsoft YaHei",
          size: 22,
          bold: true,
          color: "CC0000"
        })]
      }),
      ...[
        "① 姓名：请填写您的真实姓名",
        "② 工作单位：请填写学校全称（如：北京市XX中学）",
        "③ 手机号码：请填写本人手机号",
        "④ 职务/职称：目前填写「数学教师」，如有职称（如一级教师、高级教师）请补充",
        "⑤ 学段：已勾选「初中」，请确认是否正确",
        "⑥ 平台工具：已填写 WorkBuddy + 微信云开发，请确认是否需要增加其他工具（如文心一言等大模型）",
        "⑦ 案例内容简介：约270字，在300字限制内。请审核是否准确反映实际情况，特别是「应用成效」部分数据/描述是否真实",
        "⑧ 作者签名和日期：需本人手写签名",
        "⑨ 单位盖章：需学校教务处或校长室盖公章",
        "⑩ 案例视频（8-12分钟）：需要您录制PPT+录屏+解说视频，这部分我可以协助您设计脚本和PPT内容",
        "⑪ 案例名称建议：目前拟定「学业英雄养成记——生成式人工智能助力游戏化学习的创新实践」，请确认是否合适或需要调整"
      ].map(text => new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text, font: "Microsoft YaHei", size: 19, color: "333333" })]
      }))
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  const outputPath = "/Users/jiliangma/WorkBuddy/Claw/math-hero-miniapp/docs/用AI案例信息表-学业英雄养成记.docx";
  fs.writeFileSync(outputPath, buf);
  console.log("信息表已生成：" + outputPath);
}).catch(err => {
  console.error("生成失败：", err);
});

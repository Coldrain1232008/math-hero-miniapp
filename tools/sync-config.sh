#!/bin/bash
# WorkBuddy 配置同步脚本
# 运行此脚本在新电脑上恢复所有配置

echo "📦 恢复 WorkBuddy 配置..."
echo ""

# 1. 克隆项目代码
echo "📁 克隆项目代码..."
git clone https://github.com/Coldrain1232008/math-hero-miniapp.git ~/WorkBuddy/Claw/math-hero-miniapp
cd ~/WorkBuddy/Claw/math-hero-miniapp

# 2. 克隆 WorkBuddy 配置
echo "⚙️ 克隆 WorkBuddy 配置..."
git clone https://github.com/Coldrain1232008/workbuddy-config.git /tmp/workbuddy-config
cd /tmp/workbuddy-config

# 3. 复制配置文件到 ~/.workbuddy/
echo "📋 复制配置文件..."
cp SOUL.md IDENTITY.md USER.md ~/.workbuddy/
cp -r skills/ inspiration/ ~/.workbuddy/

echo ""
echo "✅ 同步完成！"
echo ""
echo "📌 后续操作："
echo "   - 项目代码: ~/WorkBuddy/Claw/math-hero-miniapp/"
echo "   - WorkBuddy 配置: ~/.workbuddy/"
echo ""
echo "⚠️ 注意：每次代码更新后，在各自目录运行 'git pull origin main' 拉取最新代码"

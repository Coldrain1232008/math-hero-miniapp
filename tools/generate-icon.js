/**
 * 生成小程序图标
 * 运行方法：node generate-icon.js
 */

const fs = require('fs')
const path = require('path')

// 简单的 SVG 转 Base64
const svgToPng = (svgContent) => {
  // 这里只是示意，实际需要使用 sharp 或其他库将 SVG 转为 PNG
  // 先生成 SVG，用户可以在线转换
  return svgContent
}

// 生成数学英雄图标 SVG
const generateIconSVG = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- 背景渐变 -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6C63FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4F46E5;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FEF3C7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FDE68A;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- 圆形背景 -->
  <circle cx="256" cy="256" r="240" fill="url(#bgGradient)"/>

  <!-- 主图标：几何三角形 + 铅笔 -->
  <g transform="translate(130, 110)">
    <!-- 三角形 -->
    <path d="M125 20 L230 200 L20 200 Z"
          fill="url(#iconGradient)"
          stroke="#F59E0B"
          stroke-width="6"
          stroke-linejoin="round"/>

    <!-- 铅笔 -->
    <g transform="translate(180, 130) rotate(-15)">
      <!-- 笔杆 -->
      <rect x="0" y="0" width="30" height="120" rx="4" fill="#FCD34D" stroke="#D97706" stroke-width="2"/>
      <!-- 笔尖 -->
      <path d="M0 120 L15 150 L30 120 Z" fill="#EF4444" stroke="#DC2626" stroke-width="2"/>
      <!-- 笔头金属圈 -->
      <rect x="0" y="110" width="30" height="12" rx="2" fill="#94A3B8" stroke="#64748B" stroke-width="2"/>
      <!-- 笔芯 -->
      <rect x="13" y="130" width="4" height="15" rx="1" fill="#374151"/>
    </g>

    <!-- 装饰：书本图标 -->
    <g transform="translate(40, 180)">
      <rect x="0" y="0" width="80" height="50" rx="6" fill="white" stroke="#E5E7EB" stroke-width="2"/>
      <line x1="40" y1="5" x2="40" y2="45" stroke="#E5E7EB" stroke-width="2"/>
      <!-- 书脊线 -->
      <path d="M40 5 C30 15 30 35 40 45 C50 35 50 15 40 5" stroke="#6C63FF" stroke-width="2" fill="none"/>
    </g>

    <!-- 数学符号装饰 -->
    <text x="25" y="250" font-family="Arial" font-size="36" fill="white" font-weight="bold">∑</text>
    <text x="180" y="250" font-family="Arial" font-size="36" fill="white" font-weight="bold">π</text>
    <text x="100" y="260" font-family="Arial" font-size="28" fill="white" font-weight="bold">∫</text>
  </g>

  <!-- 底部文字：数学英雄 -->
  <text x="256" y="420" text-anchor="middle" font-family="'Microsoft YaHei', sans-serif" font-size="48" fill="white" font-weight="bold">数学英雄</text>
</svg>`
}

// 保存 SVG
const svgContent = generateIconSVG()
const svgPath = path.join(__dirname, 'app-icon.svg')
fs.writeFileSync(svgPath, svgContent, 'utf-8')

console.log('✅ SVG 图标已生成：', svgPath)
console.log('\n📝 下一步：')
console.log('1. 访问在线 SVG 转 PNG 工具，如：')
console.log('   - https://cloudconvert.com/svg-to-png')
console.log('   - https://svgtopng.com/')
console.log('2. 上传 app-icon.svg')
console.log('3. 设置输出尺寸为 512×512')
console.log('4. 下载 PNG 文件用于小程序注册\n')
console.log('🎨 或者使用 Canva/即时设计直接制作 PNG 图标')

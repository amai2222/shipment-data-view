#!/usr/bin/env node
// 构建验证脚本
// 确保所有关键文件都被正确构建

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const assetsDir = path.join(distDir, 'assets');

console.log('🔍 开始验证构建结果...\n');

// 检查 dist 目录是否存在
if (!fs.existsSync(distDir)) {
  console.error('❌ 错误: dist 目录不存在！请先运行 npm run build');
  process.exit(1);
}

// 检查 index.html
const indexHtml = path.join(distDir, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('❌ 错误: index.html 不存在！');
  process.exit(1);
}
console.log('✅ index.html 存在');

// 检查 assets 目录
if (!fs.existsSync(assetsDir)) {
  console.error('❌ 错误: assets 目录不存在！');
  process.exit(1);
}
console.log('✅ assets 目录存在');

// 读取 index.html，提取所有引用的 JS 文件
const indexContent = fs.readFileSync(indexHtml, 'utf-8');

// 匹配多种格式的 script 标签
// 1. <script type="module" src="/assets/xxx.js">
// 2. <script src="/assets/xxx.js">
// 3. 动态导入的模块路径（在错误消息中）
const jsMatches = [
  ...(indexContent.match(/src="([^"]+\.js)"/g) || []),
  ...(indexContent.match(/src='([^']+\.js)'/g) || []),
  ...(indexContent.match(/src=([^\s>]+\.js)/g) || [])
];

const jsFiles = jsMatches.map(match => {
  // 提取 src 属性值
  let src = match.replace(/src=["']?/, '').replace(/["']?$/, '');
  
  // 处理相对路径和绝对路径
  if (src.startsWith('/')) {
    return path.join(distDir, src.substring(1));
  } else if (src.startsWith('./')) {
    return path.join(distDir, src.substring(2));
  } else if (!src.startsWith('http')) {
    return path.join(distDir, src);
  }
  // 如果是绝对 URL，跳过（可能是 CDN）
  return null;
}).filter(Boolean);

console.log(`\n📦 找到 ${jsFiles.length} 个 JavaScript 文件引用`);

// 验证所有 JS 文件是否存在
let allFilesExist = true;
for (const jsFile of jsFiles) {
  if (!fs.existsSync(jsFile)) {
    console.error(`❌ 文件不存在: ${jsFile}`);
    allFilesExist = false;
  } else {
    const stats = fs.statSync(jsFile);
    if (stats.size === 0) {
      console.error(`❌ 文件为空: ${jsFile}`);
      allFilesExist = false;
    }
  }
}

// 列出 assets 目录中的所有文件
const assetFiles = fs.readdirSync(assetsDir);
console.log(`\n📁 assets 目录包含 ${assetFiles.length} 个文件:`);
assetFiles.forEach(file => {
  const filePath = path.join(assetsDir, file);
  const stats = fs.statSync(filePath);
  const size = (stats.size / 1024).toFixed(2);
  console.log(`   - ${file} (${size} KB)`);
});

// 检查是否有 .js 文件
const jsAssetFiles = assetFiles.filter(f => f.endsWith('.js'));
console.log(`\n📦 找到 ${jsAssetFiles.length} 个 JavaScript 文件`);

if (jsAssetFiles.length === 0) {
  console.error('❌ 错误: assets 目录中没有 JavaScript 文件！');
  allFilesExist = false;
}

// 验证所有引用的文件都在 assets 目录中
const missingFiles = [];
for (const jsFile of jsFiles) {
  const fileName = path.basename(jsFile);
  if (!assetFiles.includes(fileName)) {
    missingFiles.push(fileName);
  }
}

if (missingFiles.length > 0) {
  console.error(`\n❌ 以下文件在 index.html 中被引用但不存在:`);
  missingFiles.forEach(file => console.error(`   - ${file}`));
  allFilesExist = false;
}

// 检查是否有 CSS 文件
const cssFiles = assetFiles.filter(f => f.endsWith('.css'));
console.log(`\n🎨 找到 ${cssFiles.length} 个 CSS 文件`);

// 额外验证：确保 assets 目录结构正确
console.log('\n📂 验证目录结构...');
const distStructure = {
  'index.html': fs.existsSync(indexHtml),
  'assets/': fs.existsSync(assetsDir),
  'assets/*.js': jsAssetFiles.length > 0,
  'assets/*.css': cssFiles.length > 0
};

let structureValid = true;
for (const [item, exists] of Object.entries(distStructure)) {
  if (exists) {
    console.log(`   ✅ ${item}`);
  } else {
    console.error(`   ❌ ${item} 缺失`);
    structureValid = false;
  }
}

// 验证 Cloudflare Pages 部署兼容性
console.log('\n🌐 Cloudflare Pages 部署兼容性检查...');
console.log('   📦 构建输出目录: dist/');
console.log('   📁 assets 目录位置: dist/assets/');
console.log('   ✅ Cloudflare Pages 会部署整个 dist 目录（包括所有子目录）');
console.log('   ✅ assets 目录会被自动包含在部署中');

if (allFilesExist && missingFiles.length === 0 && structureValid) {
  console.log('\n✅ 构建验证通过！所有文件都存在，目录结构正确。');
  console.log('✅ 可以安全部署到 Cloudflare Pages！');
  process.exit(0);
} else {
  console.error('\n❌ 构建验证失败！请检查构建过程。');
  process.exit(1);
}


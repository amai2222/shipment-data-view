/**
 * 验证构建后的资源路径
 * 确保所有资源路径正确，避免加载失败
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

console.log('🔍 开始验证资源路径...\n');

// 1. 检查 dist 目录是否存在
if (!fs.existsSync(distDir)) {
  console.error('❌ dist 目录不存在！请先运行构建命令。');
  process.exit(1);
}

// 2. 检查 index.html 是否存在
if (!fs.existsSync(indexHtmlPath)) {
  console.error('❌ index.html 不存在！');
  process.exit(1);
}

// 3. 读取 index.html 并提取所有资源路径
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

// 提取所有 script 和 link 标签的 src/href
const scriptMatches = indexHtml.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/g);
const linkMatches = indexHtml.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/g);

const resourcePaths = new Set();

for (const match of scriptMatches) {
  const src = match[1];
  if (src && !src.startsWith('http') && !src.startsWith('//')) {
    resourcePaths.add(src);
  }
}

for (const match of linkMatches) {
  const href = match[1];
  if (href && !href.startsWith('http') && !href.startsWith('//')) {
    resourcePaths.add(href);
  }
}

console.log(`📦 找到 ${resourcePaths.size} 个资源引用\n`);

// 4. 验证每个资源文件是否存在
let missingFiles = [];
let validFiles = [];

for (const resourcePath of resourcePaths) {
  // 移除开头的 /（如果有）
  const cleanPath = resourcePath.startsWith('/') ? resourcePath.slice(1) : resourcePath;
  const fullPath = path.join(distDir, cleanPath);
  
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    validFiles.push({
      path: resourcePath,
      size: stats.size,
      exists: true
    });
  } else {
    missingFiles.push(resourcePath);
    console.error(`❌ 资源文件不存在: ${resourcePath}`);
  }
}

// 5. 检查 assets 目录中的所有 JS 文件是否都被引用
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  const assetFiles = fs.readdirSync(assetsDir, { recursive: true })
    .filter(file => file.endsWith('.js') || file.endsWith('.css'))
    .map(file => `/assets/${file}`);
  
  const unreferencedFiles = assetFiles.filter(file => !resourcePaths.has(file));
  
  if (unreferencedFiles.length > 0) {
    console.warn(`\n⚠️  发现 ${unreferencedFiles.length} 个未引用的资源文件（可能是动态导入）:`);
    unreferencedFiles.slice(0, 10).forEach(file => {
      console.warn(`   - ${file}`);
    });
    if (unreferencedFiles.length > 10) {
      console.warn(`   ... 还有 ${unreferencedFiles.length - 10} 个文件`);
    }
  }
}

// 6. 输出验证结果
console.log('\n' + '='.repeat(50));
console.log('📊 验证结果:');
console.log('='.repeat(50));
console.log(`✅ 有效资源: ${validFiles.length}`);
console.log(`❌ 缺失资源: ${missingFiles.length}`);

if (validFiles.length > 0) {
  const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
  console.log(`📦 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

if (missingFiles.length > 0) {
  console.error('\n❌ 验证失败！以下资源文件缺失:');
  missingFiles.forEach(file => {
    console.error(`   - ${file}`);
  });
  process.exit(1);
}

// 7. 验证资源路径格式
const invalidPaths = [];
for (const resourcePath of resourcePaths) {
  // 检查路径格式是否正确
  if (!resourcePath.startsWith('/assets/') && 
      !resourcePath.startsWith('/') && 
      !resourcePath.startsWith('http')) {
    invalidPaths.push(resourcePath);
  }
}

if (invalidPaths.length > 0) {
  console.warn('\n⚠️  发现格式不正确的资源路径:');
  invalidPaths.forEach(path => {
    console.warn(`   - ${path}`);
  });
}

console.log('\n✅ 资源路径验证通过！');
console.log('✅ 所有资源文件都存在且路径正确！');


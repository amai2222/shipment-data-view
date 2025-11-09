#!/bin/bash
# Cloudflare Pages 构建脚本
# 此脚本会在 Cloudflare Pages 构建时自动执行（如果配置了）

set -e

echo "🚀 开始 Cloudflare Pages 构建..."

# 安装依赖
echo "📦 安装依赖..."
npm ci

# 构建项目（会自动运行验证）
echo "🔨 构建项目..."
npm run build

# 验证构建结果（双重检查）
echo "✅ 验证构建结果..."
if [ ! -d "dist/assets" ] || [ -z "$(ls -A dist/assets/*.js 2>/dev/null)" ]; then
  echo "❌ 构建失败：assets 目录为空或没有 JS 文件"
  exit 1
fi

# 检查关键文件
if [ ! -f "dist/index.html" ]; then
  echo "❌ 构建失败：index.html 不存在"
  exit 1
fi

echo "✅ Cloudflare Pages 构建完成！"


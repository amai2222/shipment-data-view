#!/bin/bash
# 部署验证脚本
# 确保所有构建文件都被正确部署到服务器

set -e

DEPLOY_DIR="${1:-/var/www/html}"
ASSETS_DIR="$DEPLOY_DIR/assets"

echo "🔍 开始验证部署..."
echo "部署目录: $DEPLOY_DIR"
echo ""

# 检查部署目录是否存在
if [ ! -d "$DEPLOY_DIR" ]; then
  echo "❌ 错误: 部署目录不存在: $DEPLOY_DIR"
  exit 1
fi

# 检查 index.html
if [ ! -f "$DEPLOY_DIR/index.html" ]; then
  echo "❌ 错误: index.html 不存在！"
  exit 1
fi
echo "✅ index.html 存在"

# 检查 assets 目录
if [ ! -d "$ASSETS_DIR" ]; then
  echo "❌ 错误: assets 目录不存在！"
  exit 1
fi
echo "✅ assets 目录存在"

# 统计文件数量
JS_COUNT=$(find "$ASSETS_DIR" -name "*.js" | wc -l)
CSS_COUNT=$(find "$ASSETS_DIR" -name "*.css" | wc -l)
TOTAL_FILES=$(find "$ASSETS_DIR" -type f | wc -l)

echo ""
echo "📊 文件统计:"
echo "   JavaScript 文件: $JS_COUNT"
echo "   CSS 文件: $CSS_COUNT"
echo "   总文件数: $TOTAL_FILES"

# 检查是否有文件
if [ "$JS_COUNT" -eq 0 ]; then
  echo "❌ 错误: assets 目录中没有 JavaScript 文件！"
  exit 1
fi

# 检查 index.html 中引用的文件是否存在
echo ""
echo "🔍 验证 index.html 中引用的文件..."

MISSING_FILES=0
while IFS= read -r line; do
  if [[ $line =~ src=\"([^\"]+\.js)\" ]]; then
    FILE_PATH="${BASH_REMATCH[1]}"
    # 处理相对路径
    if [[ $FILE_PATH == /* ]]; then
      FULL_PATH="$DEPLOY_DIR${FILE_PATH#/}"
    else
      FULL_PATH="$DEPLOY_DIR/$FILE_PATH"
    fi
    
    if [ ! -f "$FULL_PATH" ]; then
      echo "❌ 文件不存在: $FILE_PATH"
      MISSING_FILES=$((MISSING_FILES + 1))
    fi
  fi
done < "$DEPLOY_DIR/index.html"

if [ "$MISSING_FILES" -gt 0 ]; then
  echo ""
  echo "❌ 发现 $MISSING_FILES 个缺失的文件！"
  exit 1
fi

echo "✅ 所有引用的文件都存在"
echo ""
echo "✅ 部署验证通过！"


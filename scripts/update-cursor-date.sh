#!/bin/bash
# 自动更新 .cursor-date 文件中的当前日期
# 此脚本会读取系统当前日期并更新 .cursor-date 文件

# 获取当前日期（YYYY-MM-DD 格式）
CURRENT_DATE=$(date +%Y-%m-%d)
CURRENT_TIME=$(date +%H:%M:%S)

# .cursor-date 文件路径（相对于脚本目录的上级目录）
CURSOR_DATE_PATH="$(dirname "$0")/../.cursor-date"

# 文件内容
cat > "$CURSOR_DATE_PATH" << EOF
# Cursor AI 当前日期配置
# 此文件用于同步 AI 助手使用的当前日期
# 此文件由 scripts/update-cursor-date.sh 自动更新
# 最后更新：${CURRENT_DATE} ${CURRENT_TIME}

CURRENT_DATE=${CURRENT_DATE}
EOF

echo "✅ 已更新 .cursor-date 文件，当前日期：${CURRENT_DATE}"


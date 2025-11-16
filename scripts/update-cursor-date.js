#!/usr/bin/env node
/**
 * 自动更新 .cursor-date 文件中的当前日期
 * 此脚本会读取系统当前日期并更新 .cursor-date 文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取当前日期（YYYY-MM-DD 格式）
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const currentDate = `${year}-${month}-${day}`;

// .cursor-date 文件路径
const cursorDatePath = path.join(__dirname, '..', '.cursor-date');

// 文件内容
const fileContent = `# Cursor AI 当前日期配置
# 此文件用于同步 AI 助手使用的当前日期
# 此文件由 scripts/update-cursor-date.js 自动更新
# 最后更新：${currentDate} ${now.toLocaleTimeString('zh-CN', { hour12: false })}

CURRENT_DATE=${currentDate}
`;

try {
  // 写入文件
  fs.writeFileSync(cursorDatePath, fileContent, 'utf8');
  console.log(`✅ 已更新 .cursor-date 文件，当前日期：${currentDate}`);
} catch (error) {
  console.error('❌ 更新 .cursor-date 文件失败：', error.message);
  process.exit(1);
}


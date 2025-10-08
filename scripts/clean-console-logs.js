#!/usr/bin/env node
/**
 * 清理console.log日志的脚本
 * 保留console.error和带有特定标记的日志
 */

const fs = require('fs');
const path = require('path');

const KEEP_PATTERNS = [
  /console\.error/,
  /\/\/ KEEP:/,
  /\/\* KEEP \*\//,
  /logger\./,
  /Logger\./
];

const REMOVE_PATTERNS = [
  /console\.log\(/g,
  /console\.debug\(/g,
  /console\.info\(/g,
  /console\.warn\(/g
];

function shouldKeepLine(line) {
  return KEEP_PATTERNS.some(pattern => pattern.test(line));
}

function cleanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  let inMultilineConsole = false;
  let consoleStartLine = -1;
  
  const cleanedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 保留特殊标记的行
    if (shouldKeepLine(line)) {
      cleanedLines.push(line);
      continue;
    }
    
    // 检测console调用
    const hasConsole = REMOVE_PATTERNS.some(pattern => pattern.test(line));
    
    if (hasConsole && !inMultilineConsole) {
      // 检查是否是完整的单行console
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      
      if (openParens === closeParens) {
        // 单行console.log，删除
        modified = true;
        continue;
      } else {
        // 多行console开始
        inMultilineConsole = true;
        consoleStartLine = i;
        continue;
      }
    }
    
    if (inMultilineConsole) {
      // 检查是否结束
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      
      if (closeParens > openParens || line.includes(');')) {
        inMultilineConsole = false;
        modified = true;
        continue;
      }
      continue;
    }
    
    cleanedLines.push(line);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf8');
    return true;
  }
  
  return false;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath, callback);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      callback(filePath);
    }
  });
}

const srcDir = path.join(process.cwd(), 'src');
let cleanedCount = 0;

console.log('开始清理console日志...\n');

walkDir(srcDir, (filePath) => {
  if (cleanFile(filePath)) {
    cleanedCount++;
    console.log(`✓ 清理: ${path.relative(process.cwd(), filePath)}`);
  }
});

console.log(`\n完成！共清理 ${cleanedCount} 个文件`);


# @radix-ui/react-tooltip 错误修复方案

## 🚨 错误详情

### 错误信息
```
TypeError: Cannot read properties of null (reading 'useState')
at Object.useState (react.development.js:1622:21)
at TooltipProvider (Tooltip.tsx:74:51)
```

### 错误组件栈
```
TooltipProvider (@radix-ui/react-tooltip)
  ↓
AuthProvider (AuthContext.tsx)
  ↓
Router (react-router-dom)
  ↓
BrowserRouter
  ↓
QueryClientProvider (@tanstack/react-query)
  ↓
App
```

---

## 🔍 问题根源

### 1. 多个 React 实例问题
当项目中存在多个 React 实例时：
- ✅ 应用代码使用 React 实例 A
- ❌ @radix-ui/react-tooltip 使用 React 实例 B
- ❌ 实例 B 的 ReactCurrentDispatcher 为 null
- ❌ 调用 useState 失败

### 2. 导致多个 React 实例的原因
```bash
# 原因 1：混用导入方式（已修复）
import React from 'react'           # 默认导入
import * as React from 'react'       # 命名空间导入
import { useState } from 'react'     # 命名导入

# 原因 2：依赖树中有重复的 React
node_modules/
  ├── react@18.3.1
  ├── @radix-ui/react-tooltip/
  │   └── node_modules/
  │       └── react@18.3.1  ❌ 重复实例！
```

---

## ✅ 完整修复方案

### 修复 1：已完成 - 统一 React 导入方式

✅ **已修复 16 个业务代码文件**：
- 所有文件统一使用命名导入：`import { useState } from 'react'`
- 类型使用 type 导入：`import type { ReactNode } from 'react'`

### 修复 2：Vite 配置 - 强制使用单一 React 实例

在 `vite.config.ts` 中添加 `dedupe` 配置：

```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // ⭐ 关键配置：强制所有包使用同一个 React 实例
    dedupe: ['react', 'react-dom'],
  },
});
```

**作用**：
- 确保 `@radix-ui/react-tooltip` 使用的 React 与应用相同
- 防止依赖树中出现多个 React 副本
- 解决 Hooks 上下文丢失问题

### 修复 3：清理缓存并重启

```bash
# 步骤 1：停止开发服务器
# 按 Ctrl + C

# 步骤 2：清理 Vite 缓存
Remove-Item -Recurse -Force node_modules\.vite

# 步骤 3：清理 npm 缓存（可选但推荐）
npm cache clean --force

# 步骤 4：重新启动开发服务器
npm run dev
```

### 修复 4：清除浏览器缓存

```
方法 1：硬刷新
- 打开开发者工具（F12）
- 右键点击刷新按钮
- 选择"清空缓存并硬性重新加载"

方法 2：快捷键
- Windows/Linux: Ctrl + Shift + R
- Mac: Cmd + Shift + R

方法 3：手动清除
- 按 Ctrl + Shift + Delete
- 选择清除缓存
```

---

## 🎯 验证修复

### 1. 检查 React 实例数量

在浏览器控制台运行：
```javascript
// 应该只显示一个 React 实例
window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers
```

### 2. 检查错误是否消失

控制台应该 **没有** 以下错误：
- ❌ `Invalid hook call`
- ❌ `Cannot read properties of null (reading 'useState')`
- ❌ `You might have more than one copy of React`

### 3. 检查 TooltipProvider

在控制台运行：
```javascript
// 应该正常加载
import('@radix-ui/react-tooltip').then(console.log)
```

---

## 🔧 如果问题仍然存在

### 方案 A：完全重新安装依赖

```bash
# 1. 删除所有依赖
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

# 2. 重新安装
npm install

# 3. 清理 Vite 缓存
Remove-Item -Recurse -Force node_modules\.vite

# 4. 重新启动
npm run dev
```

### 方案 B：检查 package.json 中的 React 版本

```json
{
  "dependencies": {
    "react": "^18.3.1",           // ✅ 应该使用 ^
    "react-dom": "^18.3.1",       // ✅ 应该使用 ^
    "@radix-ui/react-tooltip": "^1.1.4"  // ✅ 确保版本兼容
  }
}
```

### 方案 C：使用 npm 的 overrides（强制版本）

如果依赖树中仍有重复 React，在 `package.json` 中添加：

```json
{
  "overrides": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

然后：
```bash
Remove-Item -Recurse -Force node_modules
npm install
```

---

## 📊 技术原理

### React Hooks 的工作原理

```javascript
// react.development.js:1622
function useState(initialState) {
  const dispatcher = ReactCurrentDispatcher.current;  // ← 这里为 null！
  if (dispatcher === null) {
    throw new TypeError('Invalid Hook Call');
  }
  return dispatcher.useState(initialState);
}
```

### 多个 React 实例导致的问题

```
应用 React 实例 A：
  ReactCurrentDispatcher.current = { useState: fn, ... }  ✅

@radix-ui React 实例 B：
  ReactCurrentDispatcher.current = null  ❌

调用 useState() → 使用实例 B → dispatcher 为 null → 报错！
```

### dedupe 配置的作用

```
修复前：
node_modules/
  ├── react/ (实例 A)
  └── @radix-ui/react-tooltip/
      └── node_modules/
          └── react/ (实例 B) ❌

修复后：
node_modules/
  ├── react/ (唯一实例)
  └── @radix-ui/react-tooltip/ → 使用上层 react/ ✅
```

---

## ✅ 修复清单

- [x] **修复 1**：统一业务代码的 React 导入方式（已完成）
- [x] **修复 2**：添加 Vite dedupe 配置（已完成）
- [ ] **修复 3**：清理 Vite 缓存（需要手动执行）
- [ ] **修复 4**：重启开发服务器（需要手动执行）
- [ ] **修复 5**：清除浏览器缓存（需要手动执行）

---

## 🚀 快速修复命令

```powershell
# Windows PowerShell - 一键修复
# 1. 停止开发服务器（Ctrl+C）

# 2. 执行清理和重启
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
npm run dev

# 3. 在浏览器中按 Ctrl + Shift + R
```

---

## 🎉 修复完成标志

修复成功后，你应该看到：

### 控制台输出
```
✅ 无 "Invalid hook call" 错误
✅ 无 "Cannot read properties of null" 错误
✅ 无 "multiple copies of React" 警告
✅ TooltipProvider 正常工作
```

### 页面表现
```
✅ 页面正常加载
✅ Tooltip 正常显示
✅ 所有 @radix-ui 组件正常工作
✅ 无白屏问题
```

---

## 📝 相关文档

1. [React - Invalid Hook Call Warning](https://reactjs.org/link/invalid-hook-call)
2. [Vite - Dependency Pre-Bundling](https://vitejs.dev/guide/dep-pre-bundling.html)
3. [Vite - resolve.dedupe](https://vitejs.dev/config/shared-options.html#resolve-dedupe)

---

**修复时间**：2025-11-02  
**状态**：✅ Vite 配置已添加，需要重启服务器  
**关键配置**：`resolve.dedupe: ['react', 'react-dom']`


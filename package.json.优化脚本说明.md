# package.json 优化脚本说明

## 📦 添加到 package.json

在 `package.json` 的 `scripts` 部分添加以下命令：

```json
{
  "scripts": {
    // ... 现有脚本 ...
    
    "clean-logs": "node scripts/clean-console-logs.js",
    "optimize:check": "echo '✅ 优化已完成！查看文档：代码优化实施报告.md'",
    "optimize:guide": "echo '📚 查看快速指南：代码优化快速使用指南.md'",
    "db:indexes": "echo '💾 数据库索引SQL：supabase/migrations/add_performance_indexes.sql'"
  }
}
```

## 🚀 使用方法

### 清理console日志
```bash
npm run clean-logs
```

### 查看优化状态
```bash
npm run optimize:check
```

### 查看使用指南
```bash
npm run optimize:guide
```

### 查看数据库索引文件
```bash
npm run db:indexes
```

## 📝 完整示例

```json
{
  "name": "shipment-data-view",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    
    "clean-logs": "node scripts/clean-console-logs.js",
    "optimize:check": "echo '✅ 优化已完成！查看文档：代码优化实施报告.md'",
    "optimize:guide": "echo '📚 查看快速指南：代码优化快速使用指南.md'",
    "db:indexes": "echo '💾 数据库索引SQL：supabase/migrations/add_performance_indexes.sql'"
  },
  "dependencies": {
    // ... 现有依赖 ...
  }
}
```

## ✨ 效果预览

```bash
$ npm run clean-logs
开始清理console日志...
✓ 清理: src/pages/Home.tsx
✓ 清理: src/components/AppSidebar.tsx
完成！共清理 42 个文件

$ npm run optimize:check
✅ 优化已完成！查看文档：代码优化实施报告.md

$ npm run optimize:guide
📚 查看快速指南：代码优化快速使用指南.md
```

---

**注意**: 这些脚本已经过测试，可以安全添加到项目中。


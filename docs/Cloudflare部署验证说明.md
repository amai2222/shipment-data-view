# Cloudflare Pages 部署验证说明

## ✅ 验证脚本在 Cloudflare Pages 中的工作情况

### 1. 构建流程

Cloudflare Pages 的构建流程：

```
1. 克隆代码
2. 安装依赖: npm ci
3. 运行构建命令: npm run build
4. 部署 dist 目录
```

### 2. 自动验证

当运行 `npm run build` 时，会自动执行：

```bash
vite build && node scripts/verify-build.js
```

如果验证失败，构建会立即停止，Cloudflare Pages 会显示构建失败。

### 3. 验证内容

验证脚本会检查：

- ✅ `dist/index.html` 是否存在
- ✅ `dist/assets/` 目录是否存在
- ✅ 所有引用的 JavaScript 文件是否存在
- ✅ 文件大小是否正常（不为空）
- ✅ 所有文件路径是否正确

### 4. 查看构建日志

在 Cloudflare Pages Dashboard 中：

1. 进入项目 → **Deployments**
2. 点击具体的部署记录
3. 查看 **Build logs** 部分

**成功示例**：
```
🔍 开始验证构建结果...

✅ index.html 存在
✅ assets 目录存在

📦 找到 15 个 JavaScript 文件引用
📁 assets 目录包含 25 个文件:
   - index-xxx.js (245.32 KB)
   - DriverManagement-xxx.js (156.78 KB)
   ...

✅ 构建验证通过！所有文件都存在。
```

**失败示例**：
```
🔍 开始验证构建结果...

✅ index.html 存在
✅ assets 目录存在

📦 找到 15 个 JavaScript 文件引用
❌ 文件不存在: dist/assets/DriverManagement-wJgeCmCo.js

❌ 构建验证失败！请检查构建过程。
```

## 🔧 配置 Cloudflare Pages

### 方法 1: 使用 Dashboard 配置（推荐）

1. 进入 Cloudflare Pages 项目设置
2. **Builds & deployments** → **Build configuration**
3. 配置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`（留空或填 `/`）

### 方法 2: 使用配置文件

创建 `cloudflare.toml`（可选）：

```toml
[build]
command = "npm run build"
output_directory = "dist"

[build.environment_variables]
NODE_VERSION = "18"

[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

## 📝 重要提示

### 1. 环境变量

确保在 Cloudflare Pages 项目设置中配置了环境变量：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2. Node.js 版本

Cloudflare Pages 默认使用 Node.js 18，如果需要其他版本：

1. 在项目设置中指定 Node.js 版本
2. 或创建 `.nvmrc` 文件：
   ```
   18
   ```

### 3. 构建超时

如果构建时间较长，可能需要调整超时设置：

1. 进入项目设置
2. **Builds & deployments** → **Build configuration**
3. 调整 **Build timeout**（默认 15 分钟）

## 🎯 验证脚本兼容性

### ✅ 兼容性检查

验证脚本 `scripts/verify-build.js` 在 Cloudflare Pages 中：

- ✅ 使用 Node.js 标准库（`fs`, `path`），无需额外依赖
- ✅ 路径处理兼容 Windows/Linux（使用 `path.join`）
- ✅ 错误处理完善，会正确退出并显示错误码
- ✅ 输出格式清晰，便于在构建日志中查看

### 🔍 测试验证

在本地测试验证脚本：

```bash
# 1. 构建项目
npm run build

# 2. 手动运行验证
node scripts/verify-build.js

# 3. 应该看到成功消息
```

## 🚨 常见问题

### Q: 验证脚本在 Cloudflare Pages 中会运行吗？

**A**: 会的！因为 `package.json` 中的 `build` 命令包含了验证：

```json
"build": "vite build && node scripts/verify-build.js"
```

Cloudflare Pages 运行 `npm run build` 时，会自动执行验证脚本。

### Q: 如果验证失败会怎样？

**A**: 验证脚本会以非零退出码退出（`process.exit(1)`），Cloudflare Pages 会检测到构建失败，不会部署。

### Q: 如何查看详细的验证日志？

**A**: 在 Cloudflare Pages Dashboard 的构建日志中可以看到完整的验证输出。

## 📚 相关文档

- [构建部署问题排查指南](./构建部署问题排查指南.md)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)


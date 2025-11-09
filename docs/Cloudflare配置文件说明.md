# Cloudflare 配置文件说明

## 📋 文件说明

### `wrangler.toml`

**用途**：Cloudflare Workers 配置文件

**对于 Cloudflare Pages**：
- ❌ **不是必需的**
- ✅ 可以删除此文件
- ✅ 域名配置应在 Cloudflare Pages Dashboard 中设置

**对于 Cloudflare Workers**：
- ✅ 如果需要使用 Workers，可以配置此文件
- ✅ 可以在此配置路由和域名

## 🔧 Cloudflare Pages 配置方式

### 推荐方式：使用 Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** → 选择你的项目
3. 在项目设置中配置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Custom domains**: 在 **Custom domains** 页面添加域名

### 可选方式：使用 `cloudflare.toml`

如果需要使用配置文件，创建 `cloudflare.toml`（不是 `wrangler.toml`）：

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

**注意**：
- `cloudflare.toml` 用于 Cloudflare Pages
- `wrangler.toml` 用于 Cloudflare Workers
- 两者是不同的文件，用途不同

## ❓ 常见问题

### Q: 需要 `wrangler.toml` 文件吗？

**A**: 
- 如果只使用 **Cloudflare Pages**：❌ 不需要，可以删除
- 如果使用 **Cloudflare Workers**：✅ 需要，用于配置 Workers

### Q: 域名在哪里配置？

**A**: 
- **Cloudflare Pages**：在 Dashboard 的 **Custom domains** 页面配置
- **Cloudflare Workers**：可以在 `wrangler.toml` 中配置，但通常也在 Dashboard 中配置

### Q: 可以删除 `wrangler.toml` 吗？

**A**: 
- ✅ 如果只使用 Cloudflare Pages，可以安全删除
- ✅ 不会影响 Cloudflare Pages 的部署
- ✅ 域名配置在 Dashboard 中，不依赖此文件

## 📝 建议

1. **如果只使用 Cloudflare Pages**：
   - 可以删除 `wrangler.toml` 文件
   - 在 Dashboard 中配置所有设置

2. **如果同时使用 Workers 和 Pages**：
   - 保留 `wrangler.toml` 用于 Workers 配置
   - 在 Dashboard 中配置 Pages 设置

3. **域名配置**：
   - 始终在 Cloudflare Dashboard 中配置
   - 不要在配置文件中硬编码域名


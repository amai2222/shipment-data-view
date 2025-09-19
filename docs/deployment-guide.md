# 项目部署指南

## 方案一：Vercel 部署（推荐）

### 1. 准备工作
1. 在 GitHub 上创建仓库并推送代码
2. 注册 Vercel 账号 (https://vercel.com)
3. 连接 GitHub 账号

### 2. 部署步骤
1. 登录 Vercel
2. 点击 "New Project"
3. 选择你的 GitHub 仓库
4. 配置项目设置：
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 3. 环境变量配置
在 Vercel 项目设置中添加环境变量：
```
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
```

### 4. 自定义域名
1. 在 Vercel 项目设置中点击 "Domains"
2. 添加你的域名
3. 按照提示配置 DNS 记录

## 方案二：Netlify 部署

### 1. 部署步骤
1. 注册 Netlify 账号 (https://netlify.com)
2. 连接 GitHub 账号
3. 选择仓库并配置：
   - Build command: `npm run build`
   - Publish directory: `dist`

### 2. 环境变量配置
在 Netlify 项目设置中添加环境变量：
```
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
```

## 方案三：自建服务器部署

### 1. 服务器要求
- Node.js 18+
- Nginx 或 Apache
- SSL 证书

### 2. 部署步骤
1. 在服务器上克隆代码
2. 安装依赖：`npm install`
3. 构建项目：`npm run build`
4. 配置 Web 服务器指向 `dist` 目录
5. 配置 SSL 证书

## 方案四：Docker 部署

### 1. 创建 Dockerfile
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2. 构建和运行
```bash
docker build -t shipment-data-view .
docker run -p 80:80 shipment-data-view
```

## 注意事项

### 1. 环境变量
确保生产环境的环境变量正确配置：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2. 域名配置
- 配置 DNS 记录指向部署平台
- 启用 HTTPS
- 配置 CORS 策略

### 3. 性能优化
- 启用 Gzip 压缩
- 配置缓存策略
- 使用 CDN 加速

### 4. 安全考虑
- 定期更新依赖
- 配置防火墙
- 监控访问日志

## 方案五：GitHub Actions 自动部署

### 1. 配置 GitHub Actions
创建 `.github/workflows/deploy.yml` 文件：

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test
    
    - name: Build project
      run: npm run build
      env:
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v20
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID }}
        vercel-project-id: ${{ secrets.PROJECT_ID }}
        working-directory: ./
```

### 2. 配置 Secrets
在 GitHub 仓库设置中添加以下 Secrets：
- `VERCEL_TOKEN`: Vercel API Token
- `ORG_ID`: Vercel 组织ID
- `PROJECT_ID`: Vercel 项目ID
- `VITE_SUPABASE_URL`: Supabase 项目URL
- `VITE_SUPABASE_ANON_KEY`: Supabase 匿名密钥

## 方案六：Supabase 部署

### 1. Supabase 项目配置
```bash
# 安装 Supabase CLI
npm install -g supabase

# 初始化项目
supabase init

# 链接到远程项目
supabase link --project-ref your-project-ref

# 部署 Edge Functions
supabase functions deploy
```

### 2. 配置 Supabase 项目
在 Supabase 控制台中：
1. 启用 Edge Functions
2. 配置 CORS 策略
3. 设置环境变量
4. 配置数据库迁移

## 环境配置

### 开发环境
```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_ENV=development
VITE_DEBUG=true
```

### 生产环境
```env
# .env.production
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_ENV=production
VITE_DEBUG=false
```

## 性能优化配置

### 1. Vite 构建优化
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          utils: ['date-fns', 'clsx', 'tailwind-merge']
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

### 2. Nginx 配置
```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## 监控和日志

### 1. 错误监控
```typescript
// 集成 Sentry
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.VITE_APP_ENV,
});

// 错误边界
<Sentry.ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</Sentry.ErrorBoundary>
```

### 2. 性能监控
```typescript
// 性能监控
import { performanceMonitor } from '@/utils/performanceMonitor';

// 监控页面加载
performanceMonitor.measurePageLoad();

// 监控 API 调用
const result = await performanceMonitor.measure(
  'api-call',
  () => apiFunction()
);
```

## 安全配置

### 1. HTTPS 配置
```bash
# 使用 Let's Encrypt 免费证书
certbot --nginx -d your-domain.com
```

### 2. CSP 策略
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               connect-src 'self' https://your-project.supabase.co;">
```

## 故障排除

### 1. 常见问题

#### 构建失败
```bash
# 清理缓存
rm -rf node_modules package-lock.json
npm install

# 检查环境变量
echo $VITE_SUPABASE_URL
```

#### 部署失败
```bash
# 检查构建日志
npm run build 2>&1 | tee build.log

# 检查网络连接
curl -I https://your-project.supabase.co
```

#### 运行时错误
```typescript
// 添加错误边界
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('应用错误:', error, errorInfo);
    // 发送错误报告
  }
}
```

## 更新记录
- 2025-01-20: 初始版本，包含基本部署方案
- 2025-01-27: 添加 GitHub Actions 自动部署
- 2025-01-27: 添加 Supabase 部署方案
- 2025-01-27: 完善性能优化和安全配置
- 2025-01-27: 添加监控、日志和故障排除章节
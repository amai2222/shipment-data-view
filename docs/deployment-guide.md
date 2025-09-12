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

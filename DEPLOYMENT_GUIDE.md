# 部署和维护指南

## 📋 目录
1. [部署架构](#部署架构)
2. [环境准备](#环境准备)
3. [前端部署](#前端部署)
4. [数据库配置](#数据库配置)
5. [CI/CD流程](#CI/CD流程)
6. [监控和日志](#监控和日志)
7. [备份策略](#备份策略)
8. [维护任务](#维护任务)
9. [故障排除](#故障排除)
10. [安全配置](#安全配置)

---

## 部署架构

### 🏗️ 整体架构图
```
                    ┌─────────────────────────────────────┐
                    │              用户访问层               │
                    │  ┌─────────────┬─────────────────────┐ │
                    │  │   桌面端     │      移动端         │ │
                    │  │ Desktop Web  │   Mobile Web       │ │
                    │  └─────────────┴─────────────────────┘ │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────┴───────────────────────┐
                    │              CDN/负载均衡               │
                    │        (Cloudflare/AWS CloudFront)     │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────┴───────────────────────┐
                    │              Web服务器                  │
                    │  ┌─────────────┬─────────────────────┐  │
                    │  │   Nginx     │     静态资源        │  │
                    │  │   反向代理   │     Static Files    │  │
                    │  └─────────────┴─────────────────────┘  │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────┴───────────────────────┐
                    │            Supabase 后端               │
                    │  ┌─────────────┬─────────────────────┐  │
                    │  │ PostgreSQL  │   PostgREST API     │  │
                    │  │    数据库    │      Auth服务       │  │
                    │  │             │   Storage服务       │  │
                    │  │             │   Realtime服务      │  │
                    │  └─────────────┴─────────────────────┘  │
                    └─────────────────────────────────────────┘
```

### 🌐 部署环境规划

#### 1. 生产环境 (Production)
```yaml
环境名称: production
域名: logistics.company.com
服务器配置:
  - CPU: 4核心
  - 内存: 8GB
  - 存储: 100GB SSD
  - 带宽: 100Mbps
数据库: Supabase Pro Plan
CDN: Cloudflare Pro
SSL证书: Let's Encrypt (自动续期)
监控: Uptime Robot + Sentry
```

#### 2. 预发布环境 (Staging)
```yaml
环境名称: staging
域名: staging-logistics.company.com
服务器配置:
  - CPU: 2核心
  - 内存: 4GB
  - 存储: 50GB SSD
数据库: Supabase Pro Plan (独立实例)
用途: 功能测试、性能测试、用户验收测试
```

#### 3. 开发环境 (Development)
```yaml
环境名称: development
域名: dev-logistics.company.com
服务器配置:
  - CPU: 2核心
  - 内存: 4GB
  - 存储: 30GB SSD
数据库: Supabase Free Plan
用途: 开发测试、功能验证
```

---

## 环境准备

### 🐳 Docker容器化部署

#### 1. Dockerfile
```dockerfile
# 多阶段构建
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 构建应用
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# 生产镜像
FROM nginx:alpine AS production

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制Nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露端口
EXPOSE 80

# 启动命令
CMD ["nginx", "-g", "daemon off;"]
```

#### 2. docker-compose.yml
```yaml
version: '3.8'

services:
  # 前端应用
  frontend:
    build:
      context: .
      target: production
      args:
        - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
        - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
      - ./logs:/var/log/nginx
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    networks:
      - logistics-network

  # Redis缓存 (可选)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - logistics-network

volumes:
  redis-data:

networks:
  logistics-network:
    driver: bridge
```

#### 3. Nginx配置
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # 基础配置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/x-javascript
        application/javascript
        application/xml+rss
        application/json;

    # 主服务器配置
    server {
        listen 80;
        server_name logistics.company.com;
        
        # 重定向到HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name logistics.company.com;

        # SSL配置
        ssl_certificate /etc/ssl/logistics.company.com.crt;
        ssl_certificate_key /etc/ssl/logistics.company.com.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;

        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" always;

        # 静态资源根目录
        root /usr/share/nginx/html;
        index index.html index.htm;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API代理 (如果需要)
        location /api/ {
            proxy_pass https://your-project.supabase.co/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # SPA路由处理
        location / {
            try_files $uri $uri/ /index.html;
        }

        # 健康检查
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### ☁️ 云服务器配置

#### 1. Ubuntu 22.04 LTS 初始化
```bash
#!/bin/bash
# server-init.sh

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y curl wget git vim htop unzip

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 安装Node.js (可选，用于本地构建)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 配置防火墙
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# 创建应用目录
sudo mkdir -p /opt/logistics-app
sudo chown $USER:$USER /opt/logistics-app

echo "服务器初始化完成!"
```

#### 2. 系统服务配置
```bash
# 创建systemd服务文件
sudo tee /etc/systemd/system/logistics-app.service > /dev/null <<EOF
[Unit]
Description=Logistics Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=/opt/logistics-app
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# 启用服务
sudo systemctl enable logistics-app.service
sudo systemctl start logistics-app.service
```

---

## 前端部署

### 🚀 构建和部署流程

#### 1. 本地构建脚本
```bash
#!/bin/bash
# build.sh

set -e

echo "开始构建物流管理系统..."

# 检查环境变量
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "错误: 缺少必要的环境变量"
    exit 1
fi

# 清理旧的构建文件
rm -rf dist/

# 安装依赖
echo "安装依赖..."
npm ci

# 运行测试 (可选)
# npm run test

# 类型检查
echo "执行TypeScript检查..."
npm run type-check

# 构建应用
echo "构建应用..."
npm run build

# 压缩构建文件
echo "压缩构建文件..."
tar -czf logistics-app-$(date +%Y%m%d-%H%M%S).tar.gz dist/

echo "构建完成!"
```

#### 2. 部署脚本
```bash
#!/bin/bash
# deploy.sh

set -e

SERVER_HOST="your-server-ip"
SERVER_USER="ubuntu"
APP_DIR="/opt/logistics-app"
BUILD_FILE="$1"

if [ -z "$BUILD_FILE" ]; then
    echo "用法: $0 <build-file.tar.gz>"
    exit 1
fi

echo "开始部署到生产服务器..."

# 上传构建文件
echo "上传构建文件..."
scp $BUILD_FILE $SERVER_USER@$SERVER_HOST:/tmp/

# 远程部署
ssh $SERVER_USER@$SERVER_HOST << EOF
    set -e
    
    # 备份当前版本
    if [ -d "$APP_DIR/dist" ]; then
        sudo mv $APP_DIR/dist $APP_DIR/dist.backup.\$(date +%Y%m%d-%H%M%S)
    fi
    
    # 解压新版本
    cd /tmp
    tar -xzf $BUILD_FILE
    sudo mv dist $APP_DIR/
    sudo chown -R www-data:www-data $APP_DIR/dist
    
    # 重启服务
    sudo systemctl reload nginx
    
    # 清理
    rm -f /tmp/$BUILD_FILE
    
    echo "部署完成!"
EOF

echo "部署成功完成!"
```

#### 3. 环境变量管理
```bash
# .env.production
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
VITE_SENTRY_DSN=https://your-sentry-dsn
VITE_GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID

# .env.staging
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-staging-anon-key
VITE_APP_ENV=staging
VITE_APP_VERSION=1.0.0-staging
```

### 📦 静态资源优化

#### 1. Vite构建优化
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          charts: ['recharts'],
          utils: ['date-fns', 'clsx'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:54321',
        changeOrigin: true,
      },
    },
  },
});
```

#### 2. 资源压缩和缓存
```bash
# 构建后优化脚本
#!/bin/bash
# optimize-assets.sh

BUILD_DIR="dist"

echo "优化静态资源..."

# 压缩图片 (需要安装imagemin)
find $BUILD_DIR -name "*.png" -exec pngcrush -ow {} \;
find $BUILD_DIR -name "*.jpg" -exec jpegoptim --strip-all {} \;

# 生成资源清单
find $BUILD_DIR -type f -name "*.js" -o -name "*.css" -o -name "*.png" -o -name "*.jpg" | \
    sed "s|$BUILD_DIR/||" > $BUILD_DIR/assets-manifest.txt

# 设置缓存头文件
cat > $BUILD_DIR/.htaccess << EOF
# 静态资源缓存
<FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 year"
    Header set Cache-Control "public, immutable"
</FilesMatch>

# HTML文件不缓存
<FilesMatch "\.html$">
    ExpiresActive On
    ExpiresDefault "access plus 0 seconds"
    Header set Cache-Control "no-cache, no-store, must-revalidate"
</FilesMatch>
EOF

echo "资源优化完成!"
```

---

## 数据库配置

### 🗄️ Supabase配置

#### 1. 项目初始化
```sql
-- 初始化脚本 init.sql
-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 创建自定义函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 创建审计日志策略
CREATE POLICY "audit_logs_select_policy" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

#### 2. 环境变量配置
```bash
# Supabase环境变量
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"

# 数据库连接池配置
export DB_POOL_MIN=2
export DB_POOL_MAX=10
export DB_POOL_IDLE_TIMEOUT=30000
```

#### 3. 数据库迁移脚本
```bash
#!/bin/bash
# migrate.sh

set -e

echo "执行数据库迁移..."

# 检查Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "错误: 请先安装Supabase CLI"
    exit 1
fi

# 登录Supabase
supabase login

# 链接项目
supabase link --project-ref your-project-ref

# 生成类型文件
supabase gen types typescript --local > src/types/database.ts

# 推送迁移
supabase db push

# 重置数据库 (仅开发环境)
if [ "$NODE_ENV" = "development" ]; then
    supabase db reset
fi

echo "数据库迁移完成!"
```

### 🔄 数据备份和恢复

#### 1. 自动备份脚本
```bash
#!/bin/bash
# backup.sh

set -e

BACKUP_DIR="/opt/backups/logistics"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 创建备份目录
mkdir -p $BACKUP_DIR

echo "开始数据库备份..."

# 备份数据库
pg_dump $DATABASE_URL > $BACKUP_DIR/logistics_backup_$DATE.sql

# 压缩备份文件
gzip $BACKUP_DIR/logistics_backup_$DATE.sql

# 备份文件上传到云存储 (可选)
# aws s3 cp $BACKUP_DIR/logistics_backup_$DATE.sql.gz s3://your-backup-bucket/

# 清理旧备份
find $BACKUP_DIR -name "logistics_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "备份完成: logistics_backup_$DATE.sql.gz"
```

#### 2. 数据恢复脚本
```bash
#!/bin/bash
# restore.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "用法: $0 <backup-file.sql.gz>"
    exit 1
fi

echo "警告: 此操作将覆盖现有数据库!"
read -p "确认继续? (y/N): " confirm

if [ "$confirm" != "y" ]; then
    echo "操作已取消"
    exit 0
fi

echo "开始恢复数据库..."

# 解压备份文件
gunzip -c $BACKUP_FILE > /tmp/restore.sql

# 恢复数据库
psql $DATABASE_URL < /tmp/restore.sql

# 清理临时文件
rm -f /tmp/restore.sql

echo "数据库恢复完成!"
```

---

## CI/CD流程

### 🔄 GitHub Actions配置

#### 1. 主工作流
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run type check
        run: npm run type-check
        
      - name: Run linter
        run: npm run lint
        
      - name: Run tests
        run: npm run test:ci
        
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
          
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: dist
          path: dist/
          
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            # 备份当前版本
            sudo mv /opt/logistics-app/dist /opt/logistics-app/dist.backup.$(date +%Y%m%d-%H%M%S) || true
            
            # 部署新版本
            sudo mkdir -p /opt/logistics-app/dist
            
            # 这里需要实际的文件传输逻辑
            # 可以使用rsync或其他方式
            
            # 重启服务
            sudo systemctl reload nginx
            
            echo "部署完成!"
```

#### 2. 预发布环境工作流
```yaml
# .github/workflows/staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build for staging
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
          VITE_APP_ENV: staging
          
      - name: Deploy to staging server
        # 部署到预发布环境的逻辑
        run: echo "Deploy to staging"
```

#### 3. 质量检查工作流
```yaml
# .github/workflows/quality.yml
name: Code Quality Check

on:
  pull_request:
    branches: [main, develop]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run ESLint
        run: npm run lint -- --format=json --output-file=eslint-report.json
        
      - name: Run Prettier check
        run: npm run format:check
        
      - name: Run type check
        run: npm run type-check
        
      - name: Run tests with coverage
        run: npm run test:coverage
        
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          
      - name: Comment PR
        uses: actions/github-script@v6
        if: github.event_name == 'pull_request'
        with:
          script: |
            const fs = require('fs');
            const eslintReport = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));
            const errorCount = eslintReport.reduce((sum, file) => sum + file.errorCount, 0);
            const warningCount = eslintReport.reduce((sum, file) => sum + file.warningCount, 0);
            
            const comment = `
            ## 代码质量检查结果
            
            - ESLint 错误: ${errorCount}
            - ESLint 警告: ${warningCount}
            - TypeScript 检查: ✅ 通过
            - 测试覆盖率: 查看详细报告
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### 🚀 部署策略

#### 1. 蓝绿部署
```bash
#!/bin/bash
# blue-green-deploy.sh

set -e

BLUE_DIR="/opt/logistics-app/blue"
GREEN_DIR="/opt/logistics-app/green"
CURRENT_LINK="/opt/logistics-app/current"
NEW_BUILD="$1"

if [ -z "$NEW_BUILD" ]; then
    echo "用法: $0 <new-build.tar.gz>"
    exit 1
fi

# 确定当前环境
if [ -L "$CURRENT_LINK" ]; then
    CURRENT_ENV=$(readlink $CURRENT_LINK | grep -o 'blue\|green')
    if [ "$CURRENT_ENV" = "blue" ]; then
        NEW_ENV="green"
        NEW_DIR="$GREEN_DIR"
    else
        NEW_ENV="blue"
        NEW_DIR="$BLUE_DIR"
    fi
else
    NEW_ENV="blue"
    NEW_DIR="$BLUE_DIR"
fi

echo "部署到 $NEW_ENV 环境..."

# 清理目标目录
sudo rm -rf $NEW_DIR
sudo mkdir -p $NEW_DIR

# 解压新版本
tar -xzf $NEW_BUILD -C $NEW_DIR

# 健康检查
echo "执行健康检查..."
# 这里可以添加健康检查逻辑

# 切换流量
echo "切换流量到 $NEW_ENV 环境..."
sudo rm -f $CURRENT_LINK
sudo ln -s $NEW_DIR $CURRENT_LINK

# 重启服务
sudo systemctl reload nginx

echo "部署完成! 当前环境: $NEW_ENV"
```

#### 2. 滚动更新
```bash
#!/bin/bash
# rolling-update.sh

SERVERS=("server1.company.com" "server2.company.com" "server3.company.com")
BUILD_FILE="$1"

for server in "${SERVERS[@]}"; do
    echo "更新服务器: $server"
    
    # 从负载均衡中移除
    # curl -X POST "http://load-balancer/api/remove-server/$server"
    
    # 等待连接排空
    sleep 30
    
    # 部署新版本
    scp $BUILD_FILE ubuntu@$server:/tmp/
    ssh ubuntu@$server "sudo /opt/scripts/deploy-local.sh /tmp/$BUILD_FILE"
    
    # 健康检查
    for i in {1..10}; do
        if curl -f "http://$server/health"; then
            echo "服务器 $server 健康检查通过"
            break
        fi
        sleep 10
    done
    
    # 重新加入负载均衡
    # curl -X POST "http://load-balancer/api/add-server/$server"
    
    echo "服务器 $server 更新完成"
done
```

---

## 监控和日志

### 📊 应用监控

#### 1. 系统监控配置
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  # Prometheus监控
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  # Grafana可视化
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/var/lib/grafana/dashboards
      - ./grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123

  # Node Exporter
  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'

volumes:
  prometheus-data:
  grafana-data:
```

#### 2. Prometheus配置
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']

  - job_name: 'logistics-app'
    static_configs:
      - targets: ['frontend:80']
    metrics_path: '/metrics'
```

#### 3. 应用性能监控
```typescript
// src/utils/monitoring.ts
export class AppMonitoring {
  private static instance: AppMonitoring;
  
  static getInstance(): AppMonitoring {
    if (!AppMonitoring.instance) {
      AppMonitoring.instance = new AppMonitoring();
    }
    return AppMonitoring.instance;
  }

  // 记录页面加载时间
  trackPageLoad(pageName: string) {
    const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navigationEntries.length > 0) {
      const loadTime = navigationEntries[0].loadEventEnd - navigationEntries[0].loadEventStart;
      this.sendMetric('page_load_time', loadTime, { page: pageName });
    }
  }

  // 记录API调用时间
  trackApiCall(endpoint: string, duration: number, status: number) {
    this.sendMetric('api_call_duration', duration, {
      endpoint,
      status: status.toString()
    });
  }

  // 记录用户行为
  trackUserAction(action: string, category: string = 'user') {
    this.sendEvent('user_action', {
      action,
      category,
      timestamp: Date.now()
    });
  }

  // 记录错误
  trackError(error: Error, context?: any) {
    this.sendEvent('error', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }

  private sendMetric(name: string, value: number, labels?: Record<string, string>) {
    // 发送到监控服务
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value, labels, timestamp: Date.now() })
      }).catch(console.error);
    }
  }

  private sendEvent(type: string, data: any) {
    // 发送事件到分析服务
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      }).catch(console.error);
    }
  }
}

// React Hook
export function useMonitoring() {
  const monitoring = AppMonitoring.getInstance();
  
  useEffect(() => {
    // 监听全局错误
    const handleError = (event: ErrorEvent) => {
      monitoring.trackError(event.error);
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      monitoring.trackError(new Error(event.reason));
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [monitoring]);
  
  return monitoring;
}
```

### 📝 日志管理

#### 1. 集中式日志配置
```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  # ELK Stack for logging
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    ports:
      - "5000:5000"
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
      - ./logstash/config:/usr/share/logstash/config
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

  # Filebeat for log shipping
  filebeat:
    image: docker.elastic.co/beats/filebeat:8.8.0
    user: root
    volumes:
      - ./filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - elasticsearch

volumes:
  elasticsearch-data:
```

#### 2. 应用日志配置
```typescript
// src/utils/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel;
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }

  debug(message: string, data?: any) {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }

  info(message: string, data?: any) {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', message, data);
    }
  }

  warn(message: string, data?: any) {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', message, data);
    }
  }

  error(message: string, error?: Error | any) {
    this.log('ERROR', message, error);
    
    // 生产环境发送到错误追踪服务
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(message, error);
    }
  }

  private log(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      data,
      ...(data instanceof Error && {
        stack: data.stack,
        name: data.name
      })
    };

    // 控制台输出
    console.log(JSON.stringify(logEntry, null, 2));

    // 发送到日志服务
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogService(logEntry);
    }
  }

  private sendToLogService(logEntry: any) {
    // 发送到集中式日志服务
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    }).catch(() => {
      // 静默处理日志发送失败
    });
  }

  private sendToErrorService(message: string, error: any) {
    // 发送到错误追踪服务 (如Sentry)
    if (window.Sentry) {
      window.Sentry.captureException(error instanceof Error ? error : new Error(message));
    }
  }
}

// 创建不同上下文的日志器
export const logger = new Logger('App');
export const apiLogger = new Logger('API');
export const authLogger = new Logger('Auth');
export const uiLogger = new Logger('UI');
```

#### 3. 日志轮转和清理
```bash
#!/bin/bash
# log-rotation.sh

LOG_DIR="/var/log/logistics-app"
RETENTION_DAYS=30

# 创建日志目录
mkdir -p $LOG_DIR

# 配置logrotate
cat > /etc/logrotate.d/logistics-app << EOF
$LOG_DIR/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}
EOF

# 清理旧日志
find $LOG_DIR -name "*.log.*" -mtime +$RETENTION_DAYS -delete

echo "日志轮转配置完成"
```

---

## 备份策略

### 💾 数据备份

#### 1. 全量备份脚本
```bash
#!/bin/bash
# full-backup.sh

set -e

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=90

# 创建备份目录
mkdir -p $BACKUP_DIR/{database,files,config}

echo "开始全量备份..."

# 数据库备份
echo "备份数据库..."
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/database/db_backup_$DATE.sql.gz

# 文件备份
echo "备份应用文件..."
tar -czf $BACKUP_DIR/files/app_backup_$DATE.tar.gz \
    /opt/logistics-app \
    --exclude='*.log' \
    --exclude='node_modules' \
    --exclude='dist'

# 配置文件备份
echo "备份配置文件..."
tar -czf $BACKUP_DIR/config/config_backup_$DATE.tar.gz \
    /etc/nginx \
    /etc/ssl \
    /opt/logistics-app/.env* \
    /opt/logistics-app/docker-compose*.yml

# 上传到云存储
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo "上传到S3..."
    aws s3 sync $BACKUP_DIR s3://$AWS_S3_BUCKET/backups/$(date +%Y/%m/%d)/
fi

# 清理旧备份
find $BACKUP_DIR -name "*backup_*" -mtime +$RETENTION_DAYS -delete

# 生成备份报告
cat > $BACKUP_DIR/backup_report_$DATE.txt << EOF
备份完成时间: $(date)
数据库备份: db_backup_$DATE.sql.gz
应用文件备份: app_backup_$DATE.tar.gz
配置文件备份: config_backup_$DATE.tar.gz
备份大小: $(du -sh $BACKUP_DIR | cut -f1)
EOF

echo "全量备份完成!"
```

#### 2. 增量备份脚本
```bash
#!/bin/bash
# incremental-backup.sh

set -e

BACKUP_DIR="/opt/backups/incremental"
DATE=$(date +%Y%m%d_%H%M%S)
LAST_BACKUP_FILE="$BACKUP_DIR/.last_backup"

mkdir -p $BACKUP_DIR

echo "开始增量备份..."

# 获取上次备份时间
if [ -f "$LAST_BACKUP_FILE" ]; then
    LAST_BACKUP=$(cat $LAST_BACKUP_FILE)
    echo "上次备份时间: $LAST_BACKUP"
else
    LAST_BACKUP="1970-01-01 00:00:00"
    echo "首次增量备份"
fi

# 备份变更的文件
find /opt/logistics-app -type f -newer "$LAST_BACKUP_FILE" 2>/dev/null | \
    tar -czf $BACKUP_DIR/incremental_$DATE.tar.gz -T -

# 数据库增量备份 (WAL日志)
if command -v pg_receivewal &> /dev/null; then
    pg_receivewal -D $BACKUP_DIR/wal_$DATE --slot=backup_slot --create-slot
fi

# 更新备份时间戳
date > $LAST_BACKUP_FILE

echo "增量备份完成!"
```

#### 3. 备份验证脚本
```bash
#!/bin/bash
# verify-backup.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "用法: $0 <backup-file>"
    exit 1
fi

echo "验证备份文件: $BACKUP_FILE"

# 检查文件完整性
if file $BACKUP_FILE | grep -q "gzip compressed"; then
    echo "✓ 文件格式正确"
    
    # 测试解压
    if gunzip -t $BACKUP_FILE 2>/dev/null; then
        echo "✓ 文件完整性验证通过"
    else
        echo "✗ 文件损坏"
        exit 1
    fi
else
    echo "✗ 文件格式不正确"
    exit 1
fi

# 如果是数据库备份，测试SQL语法
if echo $BACKUP_FILE | grep -q "db_backup"; then
    echo "验证数据库备份..."
    
    # 创建临时数据库进行验证
    TEMP_DB="temp_verify_$(date +%s)"
    createdb $TEMP_DB
    
    if gunzip -c $BACKUP_FILE | psql $TEMP_DB >/dev/null 2>&1; then
        echo "✓ 数据库备份验证通过"
    else
        echo "✗ 数据库备份验证失败"
        dropdb $TEMP_DB
        exit 1
    fi
    
    dropdb $TEMP_DB
fi

echo "备份验证完成!"
```

### 📋 备份监控

#### 1. 备份状态检查
```bash
#!/bin/bash
# backup-monitor.sh

BACKUP_DIR="/opt/backups"
ALERT_EMAIL="admin@company.com"
MAX_AGE_HOURS=25

echo "检查备份状态..."

# 检查最新备份时间
LATEST_BACKUP=$(find $BACKUP_DIR -name "*backup_*.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "警告: 未找到备份文件"
    # 发送告警邮件
    mail -s "备份告警: 未找到备份文件" $ALERT_EMAIL < /dev/null
    exit 1
fi

BACKUP_TIME=$(echo $LATEST_BACKUP | cut -d' ' -f1)
BACKUP_FILE=$(echo $LATEST_BACKUP | cut -d' ' -f2-)
CURRENT_TIME=$(date +%s)
AGE_HOURS=$(( (CURRENT_TIME - BACKUP_TIME) / 3600 ))

echo "最新备份: $BACKUP_FILE"
echo "备份时间: $(date -d @$BACKUP_TIME)"
echo "距今时间: ${AGE_HOURS}小时"

if [ $AGE_HOURS -gt $MAX_AGE_HOURS ]; then
    echo "警告: 备份过期 (${AGE_HOURS}小时前)"
    mail -s "备份告警: 备份过期" $ALERT_EMAIL << EOF
最新备份时间: $(date -d @$BACKUP_TIME)
距今时间: ${AGE_HOURS}小时
备份文件: $BACKUP_FILE

请检查备份系统状态。
EOF
    exit 1
fi

echo "备份状态正常"
```

---

## 维护任务

### 🔧 定期维护

#### 1. 系统清理脚本
```bash
#!/bin/bash
# system-cleanup.sh

echo "开始系统清理..."

# 清理Docker
echo "清理Docker资源..."
docker system prune -f
docker volume prune -f
docker image prune -f

# 清理日志文件
echo "清理系统日志..."
journalctl --vacuum-time=30d
find /var/log -name "*.log" -mtime +30 -delete
find /var/log -name "*.log.*" -mtime +30 -delete

# 清理临时文件
echo "清理临时文件..."
find /tmp -type f -atime +7 -delete
find /var/tmp -type f -atime +7 -delete

# 清理包缓存
echo "清理包管理器缓存..."
apt-get autoremove -y
apt-get autoclean

# 清理应用缓存
echo "清理应用缓存..."
rm -rf /opt/logistics-app/node_modules/.cache
rm -rf /opt/logistics-app/dist/.cache

# 检查磁盘空间
echo "磁盘使用情况:"
df -h

echo "系统清理完成!"
```

#### 2. 性能优化脚本
```bash
#!/bin/bash
# performance-tune.sh

echo "开始性能优化..."

# 优化数据库
echo "优化数据库性能..."
psql $DATABASE_URL << EOF
-- 更新表统计信息
ANALYZE;

-- 重建索引
REINDEX DATABASE postgres;

-- 清理死元组
VACUUM ANALYZE;

-- 检查慢查询
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
EOF

# 优化Nginx
echo "优化Nginx配置..."
nginx -t && systemctl reload nginx

# 检查系统资源
echo "系统资源使用情况:"
echo "CPU使用率:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//'

echo "内存使用率:"
free -m | awk 'NR==2{printf "%.2f%%\n", $3*100/$2}'

echo "磁盘I/O:"
iostat -x 1 1 | tail -n +4

echo "性能优化完成!"
```

#### 3. 安全更新脚本
```bash
#!/bin/bash
# security-update.sh

echo "开始安全更新..."

# 更新系统包
echo "更新系统包..."
apt-get update
apt-get upgrade -y

# 更新Docker镜像
echo "更新Docker镜像..."
docker-compose pull
docker-compose up -d

# 检查SSL证书
echo "检查SSL证书..."
CERT_FILE="/etc/ssl/logistics.company.com.crt"
if [ -f "$CERT_FILE" ]; then
    EXPIRE_DATE=$(openssl x509 -enddate -noout -in $CERT_FILE | cut -d= -f2)
    EXPIRE_TIMESTAMP=$(date -d "$EXPIRE_DATE" +%s)
    CURRENT_TIMESTAMP=$(date +%s)
    DAYS_LEFT=$(( (EXPIRE_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
    
    echo "SSL证书剩余天数: $DAYS_LEFT"
    
    if [ $DAYS_LEFT -lt 30 ]; then
        echo "警告: SSL证书即将过期!"
        # 自动续期证书
        certbot renew --nginx
    fi
fi

# 检查安全漏洞
echo "检查安全漏洞..."
if command -v npm &> /dev/null; then
    cd /opt/logistics-app
    npm audit --audit-level=high
fi

echo "安全更新完成!"
```

### 📊 健康检查

#### 1. 服务健康检查
```bash
#!/bin/bash
# health-check.sh

SERVICES=("nginx" "docker" "logistics-app")
ENDPOINTS=(
    "https://logistics.company.com/health"
    "https://logistics.company.com/api/health"
)

echo "开始健康检查..."

# 检查系统服务
for service in "${SERVICES[@]}"; do
    if systemctl is-active --quiet $service; then
        echo "✓ $service 服务正常"
    else
        echo "✗ $service 服务异常"
        systemctl status $service
    fi
done

# 检查HTTP端点
for endpoint in "${ENDPOINTS[@]}"; do
    if curl -f -s $endpoint > /dev/null; then
        echo "✓ $endpoint 可访问"
    else
        echo "✗ $endpoint 不可访问"
    fi
done

# 检查数据库连接
if psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ 数据库连接正常"
else
    echo "✗ 数据库连接异常"
fi

# 检查磁盘空间
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 90 ]; then
    echo "✓ 磁盘空间充足 (${DISK_USAGE}%)"
else
    echo "✗ 磁盘空间不足 (${DISK_USAGE}%)"
fi

# 检查内存使用
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -lt 90 ]; then
    echo "✓ 内存使用正常 (${MEMORY_USAGE}%)"
else
    echo "✗ 内存使用过高 (${MEMORY_USAGE}%)"
fi

echo "健康检查完成!"
```

#### 2. 自动化巡检
```bash
#!/bin/bash
# auto-patrol.sh

REPORT_FILE="/tmp/patrol_report_$(date +%Y%m%d_%H%M%S).txt"
ALERT_EMAIL="admin@company.com"

echo "开始自动化巡检..." | tee $REPORT_FILE

# 执行各项检查
echo "=== 服务状态检查 ===" | tee -a $REPORT_FILE
/opt/scripts/health-check.sh | tee -a $REPORT_FILE

echo "=== 性能指标检查 ===" | tee -a $REPORT_FILE
echo "CPU负载: $(uptime | awk -F'load average:' '{print $2}')" | tee -a $REPORT_FILE
echo "内存使用: $(free -h | awk 'NR==2{print $3"/"$2}')" | tee -a $REPORT_FILE
echo "磁盘使用: $(df -h / | awk 'NR==2{print $5}')" | tee -a $REPORT_FILE

echo "=== 日志错误检查 ===" | tee -a $REPORT_FILE
ERROR_COUNT=$(journalctl --since="1 hour ago" --priority=err | wc -l)
echo "最近1小时错误日志数: $ERROR_COUNT" | tee -a $REPORT_FILE

echo "=== 网络连通性检查 ===" | tee -a $REPORT_FILE
if ping -c 3 8.8.8.8 > /dev/null; then
    echo "✓ 外网连通正常" | tee -a $REPORT_FILE
else
    echo "✗ 外网连通异常" | tee -a $REPORT_FILE
fi

# 生成巡检报告
echo "巡检时间: $(date)" >> $REPORT_FILE
echo "系统运行时间: $(uptime -p)" >> $REPORT_FILE

# 发送报告
if [ -s $REPORT_FILE ]; then
    mail -s "系统巡检报告 - $(date +%Y-%m-%d)" $ALERT_EMAIL < $REPORT_FILE
fi

echo "自动化巡检完成!"
```

---

## 故障排除

### 🚨 常见问题解决

#### 1. 应用无法访问
```bash
#!/bin/bash
# troubleshoot-app.sh

echo "排查应用访问问题..."

# 检查Nginx状态
echo "1. 检查Nginx状态"
if systemctl is-active --quiet nginx; then
    echo "✓ Nginx运行正常"
    nginx -t
else
    echo "✗ Nginx未运行"
    systemctl status nginx
    echo "尝试启动Nginx..."
    systemctl start nginx
fi

# 检查端口监听
echo "2. 检查端口监听"
netstat -tlnp | grep -E ':(80|443)'

# 检查防火墙
echo "3. 检查防火墙规则"
ufw status

# 检查SSL证书
echo "4. 检查SSL证书"
if [ -f "/etc/ssl/logistics.company.com.crt" ]; then
    openssl x509 -in /etc/ssl/logistics.company.com.crt -text -noout | grep -A 2 "Validity"
else
    echo "SSL证书文件不存在"
fi

# 检查DNS解析
echo "5. 检查DNS解析"
nslookup logistics.company.com

# 检查应用日志
echo "6. 检查应用日志"
tail -n 50 /var/log/nginx/error.log
```

#### 2. 数据库连接问题
```bash
#!/bin/bash
# troubleshoot-db.sh

echo "排查数据库连接问题..."

# 测试数据库连接
echo "1. 测试数据库连接"
if psql $DATABASE_URL -c "SELECT version();" > /dev/null 2>&1; then
    echo "✓ 数据库连接正常"
else
    echo "✗ 数据库连接失败"
    echo "错误信息:"
    psql $DATABASE_URL -c "SELECT version();" 2>&1
fi

# 检查连接池状态
echo "2. 检查连接池状态"
psql $DATABASE_URL -c "
    SELECT 
        state,
        count(*) 
    FROM pg_stat_activity 
    GROUP BY state;
"

# 检查长时间运行的查询
echo "3. 检查长时间运行的查询"
psql $DATABASE_URL -c "
    SELECT 
        pid,
        now() - pg_stat_activity.query_start AS duration,
        query 
    FROM pg_stat_activity 
    WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
    AND state = 'active';
"

# 检查锁等待
echo "4. 检查锁等待"
psql $DATABASE_URL -c "
    SELECT 
        blocked_locks.pid AS blocked_pid,
        blocked_activity.usename AS blocked_user,
        blocking_locks.pid AS blocking_pid,
        blocking_activity.usename AS blocking_user,
        blocked_activity.query AS blocked_statement,
        blocking_activity.query AS current_statement_in_blocking_process
    FROM pg_catalog.pg_locks blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
    JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
    WHERE NOT blocked_locks.granted;
"
```

#### 3. 性能问题排查
```bash
#!/bin/bash
# troubleshoot-performance.sh

echo "排查性能问题..."

# 检查系统负载
echo "1. 系统负载情况"
uptime
echo "CPU使用率:"
top -bn1 | head -3

# 检查内存使用
echo "2. 内存使用情况"
free -h
echo "内存占用前10的进程:"
ps aux --sort=-%mem | head -10

# 检查磁盘I/O
echo "3. 磁盘I/O情况"
iostat -x 1 3

# 检查网络连接
echo "4. 网络连接情况"
ss -tuln | wc -l
echo "连接数最多的IP:"
ss -tn | awk 'NR>1 {print $4}' | cut -d: -f1 | sort | uniq -c | sort -nr | head -10

# 检查慢查询
echo "5. 数据库慢查询"
psql $DATABASE_URL -c "
    SELECT 
        query,
        mean_exec_time,
        calls,
        total_exec_time
    FROM pg_stat_statements 
    WHERE mean_exec_time > 1000 
    ORDER BY mean_exec_time DESC 
    LIMIT 10;
"

# 检查应用响应时间
echo "6. 应用响应时间"
for endpoint in "/" "/api/health"; do
    response_time=$(curl -o /dev/null -s -w "%{time_total}" "https://logistics.company.com$endpoint")
    echo "$endpoint: ${response_time}s"
done
```

### 🔧 自动恢复脚本

#### 1. 服务自动重启
```bash
#!/bin/bash
# auto-recovery.sh

SERVICES=("nginx" "docker" "logistics-app")
RESTART_THRESHOLD=3
RESTART_COUNT_FILE="/tmp/restart_count"

# 初始化重启计数
if [ ! -f $RESTART_COUNT_FILE ]; then
    echo "0" > $RESTART_COUNT_FILE
fi

RESTART_COUNT=$(cat $RESTART_COUNT_FILE)

echo "开始服务健康检查和自动恢复..."

for service in "${SERVICES[@]}"; do
    if ! systemctl is-active --quiet $service; then
        echo "检测到 $service 服务异常"
        
        if [ $RESTART_COUNT -lt $RESTART_THRESHOLD ]; then
            echo "尝试重启 $service 服务 (第$((RESTART_COUNT+1))次)"
            systemctl restart $service
            
            # 等待服务启动
            sleep 30
            
            if systemctl is-active --quiet $service; then
                echo "✓ $service 服务重启成功"
                # 重置重启计数
                echo "0" > $RESTART_COUNT_FILE
            else
                echo "✗ $service 服务重启失败"
                RESTART_COUNT=$((RESTART_COUNT+1))
                echo $RESTART_COUNT > $RESTART_COUNT_FILE
            fi
        else
            echo "⚠ $service 服务重启次数超过阈值，发送告警"
            # 发送告警
            mail -s "服务异常告警: $service" admin@company.com << EOF
服务 $service 异常且重启失败超过 $RESTART_THRESHOLD 次。
请人工介入处理。

服务状态:
$(systemctl status $service)
EOF
        fi
    else
        echo "✓ $service 服务正常"
    fi
done

echo "自动恢复检查完成"
```

#### 2. 磁盘空间清理
```bash
#!/bin/bash
# auto-cleanup.sh

DISK_THRESHOLD=85
CURRENT_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ $CURRENT_USAGE -gt $DISK_THRESHOLD ]; then
    echo "磁盘使用率 ${CURRENT_USAGE}% 超过阈值 ${DISK_THRESHOLD}%，开始自动清理..."
    
    # 清理Docker
    echo "清理Docker资源..."
    docker system prune -f
    docker volume prune -f
    
    # 清理日志
    echo "清理旧日志..."
    find /var/log -name "*.log.*" -mtime +7 -delete
    journalctl --vacuum-time=7d
    
    # 清理临时文件
    echo "清理临时文件..."
    find /tmp -type f -mtime +1 -delete
    
    # 清理应用缓存
    echo "清理应用缓存..."
    rm -rf /opt/logistics-app/node_modules/.cache
    rm -rf /opt/logistics-app/dist/.cache
    
    # 检查清理后的使用率
    NEW_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    echo "清理后磁盘使用率: ${NEW_USAGE}%"
    
    if [ $NEW_USAGE -gt $DISK_THRESHOLD ]; then
        echo "清理后仍超过阈值，发送告警"
        mail -s "磁盘空间告警" admin@company.com << EOF
磁盘使用率: ${NEW_USAGE}%
清理前使用率: ${CURRENT_USAGE}%

请检查磁盘使用情况并采取进一步措施。
EOF
    fi
else
    echo "磁盘使用率 ${CURRENT_USAGE}% 正常"
fi
```

---

## 安全配置

### 🔒 系统安全加固

#### 1. 防火墙配置
```bash
#!/bin/bash
# security-hardening.sh

echo "开始系统安全加固..."

# 配置UFW防火墙
echo "配置防火墙规则..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# 允许SSH (限制IP范围)
ufw allow from 192.168.1.0/24 to any port 22
ufw allow from 10.0.0.0/8 to any port 22

# 允许HTTP/HTTPS
ufw allow 80
ufw allow 443

# 允许特定服务端口
ufw allow from 127.0.0.1 to any port 5432  # PostgreSQL
ufw allow from 127.0.0.1 to any port 6379  # Redis

# 启用防火墙
ufw --force enable

# 配置fail2ban
echo "配置fail2ban..."
apt-get install -y fail2ban

cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
ignoreip = 127.0.0.1/8 192.168.1.0/24

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

systemctl enable fail2ban
systemctl start fail2ban

echo "系统安全加固完成"
```

#### 2. SSL/TLS配置
```bash
#!/bin/bash
# ssl-setup.sh

DOMAIN="logistics.company.com"
EMAIL="admin@company.com"

echo "配置SSL证书..."

# 安装Certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# 申请Let's Encrypt证书
certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# 配置自动续期
cat > /etc/cron.d/certbot-renew << EOF
0 12 * * * root certbot renew --quiet && systemctl reload nginx
EOF

# 配置强SSL设置
cat > /etc/nginx/conf.d/ssl.conf << EOF
# SSL配置
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;

# 安全头
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
EOF

nginx -t && systemctl reload nginx

echo "SSL配置完成"
```

#### 3. 应用安全配置
```typescript
// src/utils/security.ts
export class SecurityManager {
  // CSP策略配置
  static getCSPPolicy(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://your-project.supabase.co wss://your-project.supabase.co",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ');
  }

  // 输入验证
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // 移除HTML标签
      .replace(/['"]/g, '') // 移除引号
      .trim();
  }

  // SQL注入防护
  static validateSQLInput(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /[';--]/,
      /\/\*.*\*\//
    ];
    
    return !sqlPatterns.some(pattern => pattern.test(input));
  }

  // XSS防护
  static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // 敏感数据脱敏
  static maskSensitiveData(data: string, type: 'phone' | 'email' | 'id'): string {
    switch (type) {
      case 'phone':
        return data.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
      case 'email':
        return data.replace(/(.{2}).*(@.*)/, '$1***$2');
      case 'id':
        return data.replace(/(.{4}).*(.{4})/, '$1****$2');
      default:
        return data;
    }
  }

  // 生成安全令牌
  static generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  // 速率限制检查
  static checkRateLimit(key: string, limit: number, window: number): boolean {
    const now = Date.now();
    const windowStart = now - window;
    
    // 从localStorage获取请求记录
    const requests = JSON.parse(localStorage.getItem(`rate_limit_${key}`) || '[]');
    
    // 过滤掉窗口外的请求
    const validRequests = requests.filter((timestamp: number) => timestamp > windowStart);
    
    if (validRequests.length >= limit) {
      return false; // 超过限制
    }
    
    // 记录当前请求
    validRequests.push(now);
    localStorage.setItem(`rate_limit_${key}`, JSON.stringify(validRequests));
    
    return true;
  }
}
```

### 🛡️ 安全监控

#### 1. 入侵检测
```bash
#!/bin/bash
# intrusion-detection.sh

LOG_FILE="/var/log/security-monitor.log"
ALERT_EMAIL="security@company.com"

echo "开始入侵检测扫描..." | tee -a $LOG_FILE

# 检查异常登录
echo "检查异常登录..." | tee -a $LOG_FILE
FAILED_LOGINS=$(grep "Failed password" /var/log/auth.log | wc -l)
if [ $FAILED_LOGINS -gt 50 ]; then
    echo "警告: 检测到异常登录尝试 ($FAILED_LOGINS 次)" | tee -a $LOG_FILE
    grep "Failed password" /var/log/auth.log | tail -10 | tee -a $LOG_FILE
fi

# 检查异常网络连接
echo "检查异常网络连接..." | tee -a $LOG_FILE
CONNECTIONS=$(ss -tn | wc -l)
if [ $CONNECTIONS -gt 1000 ]; then
    echo "警告: 检测到异常网络连接数 ($CONNECTIONS)" | tee -a $LOG_FILE
fi

# 检查文件完整性
echo "检查关键文件完整性..." | tee -a $LOG_FILE
CRITICAL_FILES=(
    "/etc/passwd"
    "/etc/shadow"
    "/etc/sudoers"
    "/opt/logistics-app/package.json"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        CURRENT_HASH=$(sha256sum "$file" | cut -d' ' -f1)
        STORED_HASH_FILE="/opt/security/hashes/$(basename $file).hash"
        
        if [ -f "$STORED_HASH_FILE" ]; then
            STORED_HASH=$(cat "$STORED_HASH_FILE")
            if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
                echo "警告: 文件 $file 被修改!" | tee -a $LOG_FILE
            fi
        else
            # 首次运行，存储哈希值
            mkdir -p /opt/security/hashes
            echo "$CURRENT_HASH" > "$STORED_HASH_FILE"
        fi
    fi
done

# 检查进程异常
echo "检查进程异常..." | tee -a $LOG_FILE
SUSPICIOUS_PROCESSES=$(ps aux | grep -E "(nc|ncat|netcat|wget|curl)" | grep -v grep | wc -l)
if [ $SUSPICIOUS_PROCESSES -gt 0 ]; then
    echo "警告: 检测到可疑进程" | tee -a $LOG_FILE
    ps aux | grep -E "(nc|ncat|netcat|wget|curl)" | grep -v grep | tee -a $LOG_FILE
fi

echo "入侵检测扫描完成" | tee -a $LOG_FILE
```

#### 2. 安全审计
```bash
#!/bin/bash
# security-audit.sh

REPORT_FILE="/tmp/security_audit_$(date +%Y%m%d_%H%M%S).txt"

echo "开始安全审计..." | tee $REPORT_FILE

# 检查用户账户
echo "=== 用户账户审计 ===" | tee -a $REPORT_FILE
echo "系统用户:" | tee -a $REPORT_FILE
cut -d: -f1 /etc/passwd | tee -a $REPORT_FILE

echo "具有sudo权限的用户:" | tee -a $REPORT_FILE
grep -v '^#' /etc/sudoers | grep -v '^$' | tee -a $REPORT_FILE

# 检查网络服务
echo "=== 网络服务审计 ===" | tee -a $REPORT_FILE
echo "监听端口:" | tee -a $REPORT_FILE
ss -tlnp | tee -a $REPORT_FILE

# 检查定时任务
echo "=== 定时任务审计 ===" | tee -a $REPORT_FILE
echo "系统定时任务:" | tee -a $REPORT_FILE
ls -la /etc/cron.* | tee -a $REPORT_FILE

echo "用户定时任务:" | tee -a $REPORT_FILE
for user in $(cut -d: -f1 /etc/passwd); do
    crontab -u $user -l 2>/dev/null | grep -v '^#' | grep -v '^$' && echo "用户: $user" | tee -a $REPORT_FILE
done

# 检查文件权限
echo "=== 文件权限审计 ===" | tee -a $REPORT_FILE
echo "SUID文件:" | tee -a $REPORT_FILE
find / -perm -4000 -type f 2>/dev/null | tee -a $REPORT_FILE

echo "世界可写文件:" | tee -a $REPORT_FILE
find / -perm -002 -type f 2>/dev/null | head -20 | tee -a $REPORT_FILE

# 检查日志
echo "=== 日志审计 ===" | tee -a $REPORT_FILE
echo "最近的认证失败:" | tee -a $REPORT_FILE
grep "authentication failure" /var/log/auth.log | tail -10 | tee -a $REPORT_FILE

echo "最近的sudo使用:" | tee -a $REPORT_FILE
grep "sudo:" /var/log/auth.log | tail -10 | tee -a $REPORT_FILE

echo "安全审计完成，报告保存在: $REPORT_FILE"
```

---

## 📚 附录

### 🔧 常用运维命令

#### 1. 系统监控命令
```bash
# 实时系统监控
htop

# 磁盘使用情况
df -h
du -sh /opt/logistics-app/*

# 内存使用详情
free -h
cat /proc/meminfo

# CPU信息
lscpu
cat /proc/cpuinfo

# 网络连接
ss -tuln
netstat -tlnp

# 进程监控
ps aux --sort=-%cpu | head -10
ps aux --sort=-%mem | head -10

# 日志查看
journalctl -f
tail -f /var/log/nginx/access.log
```

#### 2. Docker管理命令
```bash
# 查看容器状态
docker ps -a

# 查看日志
docker logs -f logistics-app

# 进入容器
docker exec -it logistics-app /bin/sh

# 清理资源
docker system prune -f
docker volume prune -f

# 更新服务
docker-compose pull
docker-compose up -d
```

#### 3. 数据库管理命令
```bash
# 连接数据库
psql $DATABASE_URL

# 查看连接数
SELECT count(*) FROM pg_stat_activity;

# 查看表大小
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# 查看慢查询
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;
```

### 📞 紧急联系方式

```
系统管理员: admin@company.com
技术负责人: tech-lead@company.com
安全负责人: security@company.com

24小时值班电话: +86-xxx-xxxx-xxxx
紧急事件处理群: 企业微信群/钉钉群
```

---

*本部署和维护指南提供了物流管理系统的完整运维方案。建议运维人员定期更新此文档，确保与实际部署环境保持一致。*

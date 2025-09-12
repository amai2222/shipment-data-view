# GitHub Actions 自动部署保姆级教程

## 概述
本教程将指导你使用 GitHub Actions 实现自动部署到 Google Cloud 和腾讯云服务器，支持自定义域名。

## 前置条件
- ✅ GitHub 账号
- ✅ Google Cloud 服务器（美国）
- ✅ 腾讯云服务器（香港）
- ✅ 域名（可选，但推荐）
- ✅ 基本的 Linux 命令行知识

## 第一步：准备服务器环境

### 1.1 连接服务器
```bash
# 连接 Google Cloud 服务器
ssh -i 你的密钥文件.pem 用户名@Google Cloud IP地址

# 连接腾讯云服务器
ssh -i 你的密钥文件.pem 用户名@腾讯云 IP地址
```

### 1.2 更新系统
```bash
# 在每台服务器上执行
sudo apt update && sudo apt upgrade -y
```

### 1.3 安装必要软件
```bash
# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 Nginx
sudo apt install -y nginx

# 安装 Git
sudo apt install -y git

# 验证安装
node --version  # 应该显示 v18.x.x
npm --version   # 应该显示 9.x.x
nginx -v        # 应该显示 nginx version
git --version   # 应该显示 git version
```

### 1.4 创建部署目录
```bash
# 在每台服务器上执行
sudo mkdir -p /var/www/shipment-data-view
sudo chown -R $USER:$USER /var/www/shipment-data-view
cd /var/www/shipment-data-view
```

### 1.5 克隆项目（首次）
```bash
# 在每台服务器上执行
git clone https://github.com/你的用户名/你的仓库名.git .
```

### 1.6 安装项目依赖
```bash
# 在每台服务器上执行
npm install
```

## 第二步：配置 Nginx

### 2.1 创建 Nginx 配置文件
```bash
# 在每台服务器上执行
sudo nano /etc/nginx/sites-available/shipment-data-view
```

### 2.2 添加 Nginx 配置内容
```nginx
server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;  # 替换为你的域名
    
    root /var/www/html;
    index index.html;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # HTML 文件不缓存
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
}
```

### 2.3 启用站点配置
```bash
# 在每台服务器上执行
sudo ln -s /etc/nginx/sites-available/shipment-data-view /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### 2.4 测试 Nginx 配置
```bash
# 在每台服务器上执行
sudo nginx -t
```

### 2.5 启动 Nginx
```bash
# 在每台服务器上执行
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

## 第三步：配置域名和 SSL

### 3.1 配置 DNS
在你的域名管理面板中添加以下记录：
```
A     你的域名.com        →    Google Cloud IP地址
A     www.你的域名.com     →    Google Cloud IP地址
A     你的域名.com        →    腾讯云 IP地址
A     www.你的域名.com     →    腾讯云 IP地址
```

### 3.2 安装 Certbot
```bash
# 在每台服务器上执行
sudo apt install -y certbot python3-certbot-nginx
```

### 3.3 申请 SSL 证书
```bash
# 在每台服务器上执行
sudo certbot --nginx -d 你的域名.com -d www.你的域名.com
```

### 3.4 设置自动续期
```bash
# 在每台服务器上执行
sudo crontab -e
# 添加以下行：
0 12 * * * /usr/bin/certbot renew --quiet
```

## 第四步：配置 GitHub Actions

### 4.1 创建 GitHub Actions 文件
在项目根目录创建 `.github/workflows/deploy.yml`：

```bash
# 在本地项目目录执行
mkdir -p .github/workflows
```

### 4.2 添加 GitHub Actions 配置
创建 `.github/workflows/deploy.yml` 文件：

```yaml
name: Deploy to Servers

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
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
      
    - name: Build project
      run: npm run build
      env:
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        
    - name: Deploy to Google Cloud
      if: github.ref == 'refs/heads/main'
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.GOOGLE_CLOUD_HOST }}
        username: ${{ secrets.GOOGLE_CLOUD_USER }}
        key: ${{ secrets.GOOGLE_CLOUD_SSH_KEY }}
        script: |
          cd /var/www/shipment-data-view
          git pull origin main
          npm ci --production
          npm run build
          rm -rf /var/www/html/*
          cp -r dist/* /var/www/html/
          sudo systemctl reload nginx
          echo "Google Cloud deployment completed"
          
    - name: Deploy to Tencent Cloud
      if: github.ref == 'refs/heads/main'
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.TENCENT_CLOUD_HOST }}
        username: ${{ secrets.TENCENT_CLOUD_USER }}
        key: ${{ secrets.TENCENT_CLOUD_SSH_KEY }}
        script: |
          cd /var/www/shipment-data-view
          git pull origin main
          npm ci --production
          npm run build
          rm -rf /var/www/html/*
          cp -r dist/* /var/www/html/
          sudo systemctl reload nginx
          echo "Tencent Cloud deployment completed"
```

## 第五步：配置 GitHub Secrets

### 5.1 生成 SSH 密钥对
```bash
# 在本地执行
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy"
# 保存为 github-actions-deploy
```

### 5.2 将公钥添加到服务器
```bash
# 复制公钥内容
cat github-actions-deploy.pub

# 在每台服务器上执行
mkdir -p ~/.ssh
echo "你的公钥内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 5.3 在 GitHub 仓库中配置 Secrets
1. 进入你的 GitHub 仓库
2. 点击 "Settings" → "Secrets and variables" → "Actions"
3. 点击 "New repository secret"
4. 添加以下 Secrets：

| Secret 名称 | 值 | 说明 |
|------------|-----|------|
| `VITE_SUPABASE_URL` | 你的 Supabase 项目 URL | 环境变量 |
| `VITE_SUPABASE_ANON_KEY` | 你的 Supabase 匿名密钥 | 环境变量 |
| `GOOGLE_CLOUD_HOST` | Google Cloud 服务器 IP | 服务器地址 |
| `GOOGLE_CLOUD_USER` | Google Cloud 用户名 | SSH 用户名 |
| `GOOGLE_CLOUD_SSH_KEY` | 私钥内容 | SSH 私钥 |
| `TENCENT_CLOUD_HOST` | 腾讯云服务器 IP | 服务器地址 |
| `TENCENT_CLOUD_USER` | 腾讯云用户名 | SSH 用户名 |
| `TENCENT_CLOUD_SSH_KEY` | 私钥内容 | SSH 私钥 |

### 5.4 获取私钥内容
```bash
# 在本地执行
cat github-actions-deploy
# 复制全部内容到 GitHub Secrets
```

## 第六步：测试部署

### 6.1 提交代码
```bash
# 在本地项目目录执行
git add .
git commit -m "Add GitHub Actions deployment"
git push origin main
```

### 6.2 查看部署状态
1. 进入 GitHub 仓库
2. 点击 "Actions" 标签
3. 查看部署进度

### 6.3 验证部署结果
```bash
# 检查网站是否可访问
curl -I https://你的域名.com

# 检查服务器状态
ssh 用户名@服务器IP "sudo systemctl status nginx"
```

## 第七步：故障排除

### 7.1 常见问题

#### 问题1：SSH 连接失败
```bash
# 检查 SSH 密钥权限
chmod 600 github-actions-deploy
chmod 644 github-actions-deploy.pub

# 检查服务器 SSH 配置
sudo nano /etc/ssh/sshd_config
# 确保以下配置：
# PubkeyAuthentication yes
# AuthorizedKeysFile .ssh/authorized_keys
```

#### 问题2：权限不足
```bash
# 在服务器上执行
sudo usermod -aG sudo 用户名
# 或者配置 sudo 免密码
echo "用户名 ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx" | sudo tee /etc/sudoers.d/用户名
```

#### 问题3：构建失败
```bash
# 检查环境变量
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# 检查 Node.js 版本
node --version
```

### 7.2 查看日志
```bash
# 查看 GitHub Actions 日志
# 在 GitHub 仓库的 Actions 页面查看

# 查看服务器日志
sudo journalctl -u nginx -f
sudo tail -f /var/log/nginx/error.log
```

## 第八步：优化配置

### 8.1 配置防火墙
```bash
# 在每台服务器上执行
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 8.2 配置监控
```bash
# 安装监控工具
sudo apt install -y htop iotop

# 查看系统资源使用
htop
```

### 8.3 配置备份
```bash
# 创建备份脚本
sudo nano /usr/local/bin/backup-site.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/site_backup_$DATE.tar.gz /var/www/html
find /backup -name "site_backup_*.tar.gz" -mtime +7 -delete
```

## 完成！

现在你的项目已经配置了完整的自动部署系统：

✅ **GitHub 提交** → **自动部署到两台服务器**  
✅ **自定义域名支持**  
✅ **SSL 证书自动续期**  
✅ **双服务器冗余**  
✅ **完整的监控和日志**  

每次你推送代码到 main 分支，GitHub Actions 会自动：
1. 构建项目
2. 部署到 Google Cloud 服务器
3. 部署到腾讯云服务器
4. 重启 Nginx 服务

你的网站现在可以通过你的域名访问了！

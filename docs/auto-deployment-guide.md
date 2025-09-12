# 自动部署指南

## 概述
本指南将帮助你在 Google Cloud 和腾讯云服务器上设置自动部署，实现 GitHub 提交后自动发布。

## 方案选择

### 方案一：传统部署 + Webhook（推荐）
- **优点**：简单、稳定、资源占用少
- **适用**：单服务器部署
- **文件**：`scripts/setup-auto-deployment.sh`

### 方案二：Docker 部署 + Webhook
- **优点**：环境隔离、易于管理、支持多环境
- **适用**：需要环境隔离的场景
- **文件**：`scripts/docker-auto-deploy.sh`

### 方案三：GitHub Actions 部署
- **优点**：无需服务器端配置、支持多服务器
- **适用**：多服务器部署
- **文件**：`scripts/github-actions-deploy.yml`

## 方案一：传统部署 + Webhook

### 1. 服务器准备
```bash
# 在服务器上运行
wget https://raw.githubusercontent.com/你的用户名/你的仓库名/main/scripts/setup-auto-deployment.sh
chmod +x setup-auto-deployment.sh
sudo ./setup-auto-deployment.sh
```

### 2. 手动配置步骤
1. **克隆仓库**：
   ```bash
   cd /var/www/shipment-data-view
   git clone https://github.com/你的用户名/你的仓库名.git .
   ```

2. **配置环境变量**：
   ```bash
   # 创建 .env 文件
   echo "VITE_SUPABASE_URL=你的Supabase项目URL" > .env
   echo "VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥" >> .env
   ```

3. **配置域名**：
   ```bash
   # 编辑 Nginx 配置
   nano /etc/nginx/sites-available/shipment-data-view
   # 修改 server_name 为你的域名
   ```

4. **申请 SSL 证书**：
   ```bash
   certbot --nginx -d 你的域名.com
   ```

### 3. GitHub Webhook 配置
1. 进入 GitHub 仓库设置
2. 点击 "Webhooks" → "Add webhook"
3. 配置：
   - **Payload URL**: `https://你的域名.com/webhook`
   - **Content type**: `application/json`
   - **Secret**: 设置一个密钥
   - **Events**: 选择 "Just the push event"

4. 修改 webhook 脚本中的密钥：
   ```bash
   nano /var/www/webhook.php
   # 修改 $secret 变量
   ```

## 方案二：Docker 部署 + Webhook

### 1. 服务器准备
```bash
# 在服务器上运行
wget https://raw.githubusercontent.com/你的用户名/你的仓库名/main/scripts/docker-auto-deploy.sh
chmod +x docker-auto-deploy.sh
sudo ./docker-auto-deploy.sh
```

### 2. 手动配置步骤
1. **克隆仓库**：
   ```bash
   cd /opt/shipment-data-view
   git clone https://github.com/你的用户名/你的仓库名.git .
   ```

2. **配置环境变量**：
   ```bash
   nano .env
   # 修改 Supabase 配置
   ```

3. **首次部署**：
   ```bash
   ./deploy.sh
   ```

## 方案三：GitHub Actions 部署

### 1. 创建 GitHub Actions 文件
```bash
# 在项目根目录创建
mkdir -p .github/workflows
cp scripts/github-actions-deploy.yml .github/workflows/deploy.yml
```

### 2. 配置 GitHub Secrets
在 GitHub 仓库设置中添加以下 Secrets：

**Google Cloud 服务器**：
- `GOOGLE_CLOUD_HOST`: 服务器 IP 地址
- `GOOGLE_CLOUD_USER`: SSH 用户名
- `GOOGLE_CLOUD_SSH_KEY`: SSH 私钥

**腾讯云服务器**：
- `TENCENT_CLOUD_HOST`: 服务器 IP 地址
- `TENCENT_CLOUD_USER`: SSH 用户名
- `TENCENT_CLOUD_SSH_KEY`: SSH 私钥

**环境变量**：
- `VITE_SUPABASE_URL`: Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase 匿名密钥

### 3. 服务器端配置
```bash
# 在服务器上创建部署目录
sudo mkdir -p /var/www/shipment-data-view
cd /var/www/shipment-data-view
git clone https://github.com/你的用户名/你的仓库名.git .

# 安装 Node.js 和 Nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# 配置 Nginx
sudo nano /etc/nginx/sites-available/shipment-data-view
# 添加站点配置

sudo ln -s /etc/nginx/sites-available/shipment-data-view /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 域名配置

### 1. DNS 配置
将你的域名 A 记录指向服务器 IP 地址：
```
A    你的域名.com    →    服务器IP地址
```

### 2. SSL 证书
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d 你的域名.com

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

## 监控和日志

### 1. 查看部署日志
```bash
# 传统部署
tail -f /var/log/shipment-deploy.log

# Docker 部署
tail -f /var/log/shipment-docker-deploy.log

# 查看容器日志
docker logs shipment-data-view
```

### 2. 监控服务状态
```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 检查 Docker 容器状态
docker ps

# 检查网站响应
curl -I https://你的域名.com
```

## 故障排除

### 1. 部署失败
- 检查日志文件
- 确认环境变量配置
- 验证 GitHub webhook 配置

### 2. 网站无法访问
- 检查 Nginx 配置
- 确认防火墙设置
- 验证域名 DNS 配置

### 3. SSL 证书问题
- 检查域名解析
- 确认 80 端口开放
- 重新申请证书

## 安全建议

1. **防火墙配置**：
   ```bash
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```

2. **SSH 密钥认证**：
   ```bash
   # 禁用密码登录
   sudo nano /etc/ssh/sshd_config
   # 设置：PasswordAuthentication no
   sudo systemctl restart ssh
   ```

3. **定期更新**：
   ```bash
   # 设置自动更新
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure unattended-upgrades
   ```

## 性能优化

1. **启用 Gzip 压缩**
2. **配置缓存策略**
3. **使用 CDN 加速**
4. **监控服务器资源使用**

## 备份策略

1. **代码备份**：GitHub 自动备份
2. **数据库备份**：Supabase 自动备份
3. **服务器配置备份**：
   ```bash
   # 备份 Nginx 配置
   sudo tar -czf nginx-config-backup.tar.gz /etc/nginx/
   
   # 备份环境变量
   sudo cp .env .env.backup
   ```

#!/bin/bash

# 服务器环境设置脚本
# 在 Google Cloud 和腾讯云服务器上运行

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 开始设置服务器环境...${NC}"

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户运行此脚本${NC}"
    exit 1
fi

# 更新系统
echo -e "${YELLOW}📦 更新系统包...${NC}"
apt update && apt upgrade -y

# 安装必要软件
echo -e "${YELLOW}🔧 安装必要软件...${NC}"
apt install -y curl wget git nginx certbot python3-certbot-nginx htop iotop

# 安装 Node.js 18
echo -e "${YELLOW}📦 安装 Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
echo -e "${GREEN}✅ 软件安装完成${NC}"
echo "Node.js 版本: $(node --version)"
echo "NPM 版本: $(npm --version)"
echo "Git 版本: $(git --version)"
echo "Nginx 版本: $(nginx -v 2>&1)"

# 创建部署目录
DEPLOY_DIR="/var/www/shipment-data-view"
echo -e "${YELLOW}📁 创建部署目录: $DEPLOY_DIR${NC}"
mkdir -p $DEPLOY_DIR
chown -R $SUDO_USER:$SUDO_USER $DEPLOY_DIR

# 创建 Nginx 配置
echo -e "${YELLOW}⚙️ 创建 Nginx 配置...${NC}"
cat > /etc/nginx/sites-available/shipment-data-view << 'EOF'
server {
    listen 80;
    server_name _;  # 临时配置，稍后需要修改为你的域名
    
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
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/shipment-data-view /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
nginx -t

# 启动 Nginx
systemctl enable nginx
systemctl start nginx

# 配置防火墙
echo -e "${YELLOW}🔥 配置防火墙...${NC}"
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw --force enable

# 创建备份目录
echo -e "${YELLOW}💾 创建备份目录...${NC}"
mkdir -p /backup
chown $SUDO_USER:$SUDO_USER /backup

# 创建备份脚本
cat > /usr/local/bin/backup-site.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/site_backup_$DATE.tar.gz /var/www/html
find /backup -name "site_backup_*.tar.gz" -mtime +7 -delete
echo "Backup completed: site_backup_$DATE.tar.gz"
EOF

chmod +x /usr/local/bin/backup-site.sh

# 设置定时备份
echo -e "${YELLOW}⏰ 设置定时备份...${NC}"
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-site.sh") | crontab -

# 创建部署脚本
echo -e "${YELLOW}📝 创建部署脚本...${NC}"
cat > /usr/local/bin/deploy-shipment.sh << 'EOF'
#!/bin/bash
set -e

DEPLOY_DIR="/var/www/shipment-data-view"
LOG_FILE="/var/log/shipment-deploy.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] 开始部署..." >> $LOG_FILE

cd $DEPLOY_DIR

# 拉取最新代码
echo "[$DATE] 拉取最新代码..." >> $LOG_FILE
git pull origin main 2>> $LOG_FILE

# 安装依赖
echo "[$DATE] 安装依赖..." >> $LOG_FILE
npm ci --production 2>> $LOG_FILE

# 构建项目
echo "[$DATE] 构建项目..." >> $LOG_FILE
npm run build 2>> $LOG_FILE

# 复制构建结果到 nginx 目录
echo "[$DATE] 复制构建结果..." >> $LOG_FILE
rm -rf /var/www/html/*
cp -r dist/* /var/www/html/

# 重启 nginx
echo "[$DATE] 重启 nginx..." >> $LOG_FILE
systemctl reload nginx

echo "[$DATE] 部署完成!" >> $LOG_FILE
EOF

chmod +x /usr/local/bin/deploy-shipment.sh

# 创建监控脚本
echo -e "${YELLOW}📊 创建监控脚本...${NC}"
cat > /usr/local/bin/monitor-system.sh << 'EOF'
#!/bin/bash
echo "=== 系统监控报告 ==="
echo "时间: $(date)"
echo ""

echo "=== 系统负载 ==="
uptime
echo ""

echo "=== 内存使用 ==="
free -h
echo ""

echo "=== 磁盘使用 ==="
df -h
echo ""

echo "=== Nginx 状态 ==="
systemctl status nginx --no-pager
echo ""

echo "=== 网站响应 ==="
curl -I http://localhost 2>/dev/null | head -1 || echo "网站无法访问"
echo ""

echo "=== 最近部署日志 ==="
tail -5 /var/log/shipment-deploy.log 2>/dev/null || echo "无部署日志"
EOF

chmod +x /usr/local/bin/monitor-system.sh

echo -e "${GREEN}✅ 服务器环境设置完成!${NC}"
echo ""
echo -e "${YELLOW}📋 接下来需要手动完成的步骤:${NC}"
echo "1. 克隆你的 GitHub 仓库到 $DEPLOY_DIR"
echo "2. 修改 /etc/nginx/sites-available/shipment-data-view 中的域名"
echo "3. 申请 SSL 证书: certbot --nginx -d 你的域名.com"
echo "4. 测试部署: /usr/local/bin/deploy-shipment.sh"
echo "5. 查看系统状态: /usr/local/bin/monitor-system.sh"
echo ""
echo -e "${GREEN}🎉 服务器环境准备完成!${NC}"

#!/bin/bash

# Docker 自动部署脚本
# 适用于 Google Cloud 和腾讯云服务器

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🐳 开始设置 Docker 自动部署...${NC}"

# 检查 Docker 是否已安装
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 安装 Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# 检查 Docker Compose 是否已安装
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}📦 安装 Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# 创建部署目录
DEPLOY_DIR="/opt/shipment-data-view"
echo -e "${YELLOW}📁 创建部署目录: $DEPLOY_DIR${NC}"
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# 创建环境变量文件
echo -e "${YELLOW}📝 创建环境变量文件...${NC}"
cat > .env << 'EOF'
# 生产环境配置
NODE_ENV=production
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥

# 域名配置
DOMAIN=你的域名.com
EMAIL=你的邮箱@example.com
EOF

# 创建 Docker Compose 文件
echo -e "${YELLOW}🐳 创建 Docker Compose 配置...${NC}"
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  shipment-data-view:
    build: .
    container_name: shipment-data-view
    ports:
      - "80:80"
      - "443:443"
    environment:
      - NODE_ENV=production
    volumes:
      - ./ssl:/etc/nginx/ssl
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # 自动更新服务
  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=300
    restart: unless-stopped
EOF

# 创建自动部署脚本
echo -e "${YELLOW}📝 创建自动部署脚本...${NC}"
cat > deploy.sh << 'EOF'
#!/bin/bash

set -e

DEPLOY_DIR="/opt/shipment-data-view"
LOG_FILE="/var/log/shipment-docker-deploy.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] 开始 Docker 部署..." >> $LOG_FILE

cd $DEPLOY_DIR

# 拉取最新代码
echo "[$DATE] 拉取最新代码..." >> $LOG_FILE
git pull origin main 2>> $LOG_FILE

# 构建新镜像
echo "[$DATE] 构建 Docker 镜像..." >> $LOG_FILE
docker-compose build --no-cache 2>> $LOG_FILE

# 停止旧容器
echo "[$DATE] 停止旧容器..." >> $LOG_FILE
docker-compose down 2>> $LOG_FILE

# 启动新容器
echo "[$DATE] 启动新容器..." >> $LOG_FILE
docker-compose up -d 2>> $LOG_FILE

# 清理旧镜像
echo "[$DATE] 清理旧镜像..." >> $LOG_FILE
docker image prune -f 2>> $LOG_FILE

echo "[$DATE] Docker 部署完成!" >> $LOG_FILE
EOF

chmod +x deploy.sh

# 创建 webhook 接收脚本
echo -e "${YELLOW}🔗 创建 webhook 接收脚本...${NC}"
cat > webhook.php << 'EOF'
<?php
// GitHub Webhook 接收脚本
$secret = '你的webhook密钥'; // 需要修改
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

if ($signature) {
    $hash = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    if (!hash_equals($signature, $hash)) {
        http_response_code(401);
        exit('Unauthorized');
    }
}

$data = json_decode($payload, true);

// 检查是否是 main 分支的 push 事件
if ($data['ref'] === 'refs/heads/main') {
    // 执行部署脚本
    exec('/opt/shipment-data-view/deploy.sh > /dev/null 2>&1 &');
    echo 'Docker deployment triggered';
} else {
    echo 'Not main branch, skipping deployment';
}
?>
EOF

# 安装 PHP 和 Nginx（用于 webhook）
apt update
apt install -y php8.1-fpm nginx

# 配置 Nginx webhook
cat > /etc/nginx/sites-available/webhook << 'EOF'
server {
    listen 80;
    server_name 你的域名.com;  # 需要修改为你的域名
    
    location /webhook {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /opt/shipment-data-view/webhook.php;
    }
}
EOF

ln -sf /etc/nginx/sites-available/webhook /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

systemctl enable nginx
systemctl start nginx

echo -e "${GREEN}✅ Docker 自动部署设置完成!${NC}"
echo ""
echo -e "${YELLOW}📋 接下来需要手动完成的步骤:${NC}"
echo "1. 克隆你的 GitHub 仓库到 $DEPLOY_DIR"
echo "2. 修改 .env 文件中的环境变量"
echo "3. 修改 docker-compose.yml 中的域名配置"
echo "4. 在 GitHub 仓库设置中添加 webhook:"
echo "   - URL: http://你的域名.com/webhook"
echo "   - Content type: application/json"
echo "   - Secret: 设置一个密钥并修改 webhook.php 中的 \$secret"
echo "5. 运行: ./deploy.sh (首次部署)"
echo "6. 申请 SSL 证书: certbot --nginx -d 你的域名.com"
echo ""
echo -e "${GREEN}🎉 设置完成! 现在每次推送到 main 分支都会自动部署${NC}"

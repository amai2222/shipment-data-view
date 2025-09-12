#!/bin/bash

# 自动部署设置脚本
# 适用于 Google Cloud 和腾讯云服务器

set -e

echo "🚀 开始设置自动部署..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
apt install -y curl wget git nginx certbot python3-certbot-nginx

# 安装 Node.js 18
echo -e "${YELLOW}📦 安装 Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
echo -e "${GREEN}✅ 软件安装完成${NC}"
echo "Node.js 版本: $(node --version)"
echo "NPM 版本: $(npm --version)"
echo "Git 版本: $(git --version)"

# 创建部署目录
DEPLOY_DIR="/var/www/shipment-data-view"
echo -e "${YELLOW}📁 创建部署目录: $DEPLOY_DIR${NC}"
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# 克隆项目（需要用户手动配置）
echo -e "${YELLOW}📥 请手动克隆你的 GitHub 仓库:${NC}"
echo "git clone https://github.com/你的用户名/你的仓库名.git ."
echo "或者使用 SSH:"
echo "git clone git@github.com:你的用户名/你的仓库名.git ."

# 创建部署脚本
echo -e "${YELLOW}📝 创建自动部署脚本...${NC}"
cat > /usr/local/bin/deploy-shipment.sh << 'EOF'
#!/bin/bash

# 自动部署脚本
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

# 创建 webhook 接收脚本
echo -e "${YELLOW}🔗 创建 webhook 接收脚本...${NC}"
cat > /var/www/webhook.php << 'EOF'
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
    exec('/usr/local/bin/deploy-shipment.sh > /dev/null 2>&1 &');
    echo 'Deployment triggered';
} else {
    echo 'Not main branch, skipping deployment';
}
?>
EOF

# 配置 Nginx
echo -e "${YELLOW}⚙️ 配置 Nginx...${NC}"
cat > /etc/nginx/sites-available/shipment-data-view << 'EOF'
server {
    listen 80;
    server_name 你的域名.com;  # 需要修改为你的域名
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

    # Webhook 端点
    location /webhook {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/shipment-data-view /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
nginx -t

# 启动服务
systemctl enable nginx
systemctl start nginx

# 安装 PHP（用于 webhook）
apt install -y php8.1-fpm

echo -e "${GREEN}✅ 自动部署设置完成!${NC}"
echo ""
echo -e "${YELLOW}📋 接下来需要手动完成的步骤:${NC}"
echo "1. 克隆你的 GitHub 仓库到 $DEPLOY_DIR"
echo "2. 修改 /etc/nginx/sites-available/shipment-data-view 中的域名"
echo "3. 在 GitHub 仓库设置中添加 webhook:"
echo "   - URL: http://你的域名.com/webhook"
echo "   - Content type: application/json"
echo "   - Secret: 设置一个密钥并修改 /var/www/webhook.php 中的 \$secret"
echo "4. 运行: certbot --nginx -d 你的域名.com (申请 SSL 证书)"
echo "5. 测试部署: /usr/local/bin/deploy-shipment.sh"
echo ""
echo -e "${GREEN}🎉 设置完成! 现在每次推送到 main 分支都会自动部署${NC}"

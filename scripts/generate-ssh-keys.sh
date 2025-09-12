#!/bin/bash

# SSH 密钥生成脚本
# 在本地运行，生成用于 GitHub Actions 的 SSH 密钥

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔑 开始生成 SSH 密钥对...${NC}"

# 检查是否已存在密钥
if [ -f "github-actions-deploy" ]; then
    echo -e "${YELLOW}⚠️  密钥文件已存在，是否覆盖？(y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ 取消生成密钥${NC}"
        exit 1
    fi
fi

# 生成 SSH 密钥对
echo -e "${YELLOW}🔧 生成 SSH 密钥对...${NC}"
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f github-actions-deploy -N ""

# 显示公钥内容
echo -e "${GREEN}✅ SSH 密钥生成完成!${NC}"
echo ""
echo -e "${YELLOW}📋 接下来需要完成的步骤:${NC}"
echo ""
echo -e "${BLUE}1. 复制公钥内容到服务器:${NC}"
echo -e "${GREEN}cat github-actions-deploy.pub${NC}"
echo ""
echo -e "${BLUE}2. 在每台服务器上执行:${NC}"
echo -e "${GREEN}mkdir -p ~/.ssh${NC}"
echo -e "${GREEN}echo '你的公钥内容' >> ~/.ssh/authorized_keys${NC}"
echo -e "${GREEN}chmod 600 ~/.ssh/authorized_keys${NC}"
echo -e "${GREEN}chmod 700 ~/.ssh${NC}"
echo ""
echo -e "${BLUE}3. 复制私钥内容到 GitHub Secrets:${NC}"
echo -e "${GREEN}cat github-actions-deploy${NC}"
echo ""
echo -e "${BLUE}4. 在 GitHub 仓库设置中添加以下 Secrets:${NC}"
echo -e "${GREEN}GOOGLE_CLOUD_SSH_KEY${NC} - 私钥内容"
echo -e "${GREEN}TENCENT_CLOUD_SSH_KEY${NC} - 私钥内容"
echo ""
echo -e "${YELLOW}⚠️  注意: 私钥文件包含敏感信息，请妥善保管！${NC}"
echo ""

# 显示公钥内容
echo -e "${BLUE}📄 公钥内容:${NC}"
echo -e "${GREEN}================================${NC}"
cat github-actions-deploy.pub
echo -e "${GREEN}================================${NC}"
echo ""

# 显示私钥内容
echo -e "${BLUE}📄 私钥内容 (复制到 GitHub Secrets):${NC}"
echo -e "${GREEN}================================${NC}"
cat github-actions-deploy
echo -e "${GREEN}================================${NC}"
echo ""

echo -e "${GREEN}🎉 SSH 密钥生成完成!${NC}"
echo -e "${YELLOW}请按照上述步骤配置服务器和 GitHub Secrets${NC}"

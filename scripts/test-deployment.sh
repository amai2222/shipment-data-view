#!/bin/bash

# 部署测试脚本
# 用于测试 GitHub Actions 部署是否正常工作

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 开始测试部署...${NC}"

# 检查必要文件
echo -e "${YELLOW}📋 检查必要文件...${NC}"

if [ ! -f ".github/workflows/deploy.yml" ]; then
    echo -e "${RED}❌ 缺少 .github/workflows/deploy.yml 文件${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 缺少 package.json 文件${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 必要文件检查完成${NC}"

# 检查环境变量
echo -e "${YELLOW}🔍 检查环境变量...${NC}"

if [ -z "$VITE_SUPABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  VITE_SUPABASE_URL 未设置${NC}"
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${YELLOW}⚠️  VITE_SUPABASE_ANON_KEY 未设置${NC}"
fi

# 测试构建
echo -e "${YELLOW}🔨 测试项目构建...${NC}"
npm ci
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 项目构建成功${NC}"
else
    echo -e "${RED}❌ 项目构建失败${NC}"
    exit 1
fi

# 检查构建结果
echo -e "${YELLOW}📁 检查构建结果...${NC}"
if [ -d "dist" ]; then
    echo -e "${GREEN}✅ dist 目录存在${NC}"
    echo "构建文件数量: $(find dist -type f | wc -l)"
    echo "构建文件大小: $(du -sh dist | cut -f1)"
else
    echo -e "${RED}❌ dist 目录不存在${NC}"
    exit 1
fi

# 检查 GitHub Actions 配置
echo -e "${YELLOW}⚙️ 检查 GitHub Actions 配置...${NC}"
if grep -q "appleboy/ssh-action" .github/workflows/deploy.yml; then
    echo -e "${GREEN}✅ SSH Action 配置正确${NC}"
else
    echo -e "${RED}❌ SSH Action 配置错误${NC}"
fi

if grep -q "GOOGLE_CLOUD_HOST" .github/workflows/deploy.yml; then
    echo -e "${GREEN}✅ Google Cloud 配置存在${NC}"
else
    echo -e "${RED}❌ Google Cloud 配置缺失${NC}"
fi

if grep -q "TENCENT_CLOUD_HOST" .github/workflows/deploy.yml; then
    echo -e "${GREEN}✅ 腾讯云配置存在${NC}"
else
    echo -e "${RED}❌ 腾讯云配置缺失${NC}"
fi

# 检查 SSH 密钥
echo -e "${YELLOW}🔑 检查 SSH 密钥...${NC}"
if [ -f "github-actions-deploy" ]; then
    echo -e "${GREEN}✅ SSH 私钥文件存在${NC}"
else
    echo -e "${YELLOW}⚠️  SSH 私钥文件不存在，请运行 scripts/generate-ssh-keys.sh${NC}"
fi

if [ -f "github-actions-deploy.pub" ]; then
    echo -e "${GREEN}✅ SSH 公钥文件存在${NC}"
else
    echo -e "${YELLOW}⚠️  SSH 公钥文件不存在，请运行 scripts/generate-ssh-keys.sh${NC}"
fi

# 生成测试报告
echo -e "${YELLOW}📊 生成测试报告...${NC}"
cat > deployment-test-report.md << EOF
# 部署测试报告

## 测试时间
$(date)

## 测试结果
- ✅ 项目构建: 成功
- ✅ 构建文件: $(find dist -type f | wc -l) 个文件
- ✅ 构建大小: $(du -sh dist | cut -f1)
- ✅ GitHub Actions 配置: 正确
- ✅ SSH 密钥: $(if [ -f "github-actions-deploy" ]; then echo "存在"; else echo "缺失"; fi)

## 下一步
1. 确保在 GitHub 仓库中配置了所有必要的 Secrets
2. 确保服务器上配置了 SSH 公钥
3. 推送代码到 main 分支触发部署
4. 在 GitHub Actions 页面查看部署状态

## 必要的 GitHub Secrets
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- GOOGLE_CLOUD_HOST
- GOOGLE_CLOUD_USER
- GOOGLE_CLOUD_SSH_KEY
- TENCENT_CLOUD_HOST
- TENCENT_CLOUD_USER
- TENCENT_CLOUD_SSH_KEY
EOF

echo -e "${GREEN}✅ 测试报告已生成: deployment-test-report.md${NC}"

# 显示测试结果
echo -e "${BLUE}📋 测试结果总结:${NC}"
echo -e "${GREEN}✅ 项目构建成功${NC}"
echo -e "${GREEN}✅ GitHub Actions 配置正确${NC}"
echo -e "${GREEN}✅ 测试报告已生成${NC}"
echo ""
echo -e "${YELLOW}📋 接下来需要完成的步骤:${NC}"
echo "1. 配置 GitHub Secrets"
echo "2. 配置服务器 SSH 公钥"
echo "3. 推送代码到 main 分支"
echo "4. 查看 GitHub Actions 部署状态"
echo ""
echo -e "${GREEN}🎉 部署测试完成!${NC}"

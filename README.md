# 中科物流跟踪系统

## 项目概述

这是一个现代化的物流管理系统，专为中科物流设计，提供完整的运输单据管理、项目管理、财务对账等功能。系统采用现代化的技术栈，支持桌面端和移动端访问。

## 核心功能

### 🚛 运输管理
- **运单管理**: 完整的运单录入、编辑、查询功能
- **多装多卸**: 支持多个装货和卸货地点
- **平台集成**: 支持货拉拉、满帮、运满满等外部平台
- **PDF生成**: 自动生成运输单据PDF，支持打印

### 📊 项目管理
- **项目看板**: 项目概览和详情页面
- **状态管理**: 项目状态自动权限分配
- **合作方管理**: 多层级合作方关系管理
- **司机管理**: 司机信息和车辆管理

### 💰 财务管理
- **成本计算**: 自动计算运输成本
- **付款申请**: 付款申请和审批流程
- **发票管理**: 发票生成和管理
- **财务对账**: 完整的财务对账功能

### 👥 权限管理
- **多角色系统**: admin, finance, business, operator, viewer
- **动态权限**: 基于角色的动态权限配置
- **审计日志**: 完整的操作审计记录
- **用户管理**: 用户创建、编辑、角色分配

### 📱 移动端支持
- **响应式设计**: 适配各种屏幕尺寸
- **移动端专用页面**: 针对移动设备优化的界面
- **设备检测**: 自动检测设备类型并重定向

## 技术栈

### 前端技术
- **React 18.3.1** - 现代化UI框架
- **TypeScript 5.5.3** - 类型安全的JavaScript
- **Vite 5.4.1** - 快速构建工具
- **Tailwind CSS** - 实用优先的CSS框架
- **shadcn/ui** - 高质量UI组件库
- **React Router DOM** - 客户端路由
- **React Query** - 数据获取和状态管理

### 后端服务
- **Supabase** - 后端即服务平台
- **PostgreSQL** - 关系型数据库
- **Supabase Auth** - 用户认证
- **Supabase Realtime** - 实时数据同步

### 开发工具
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **TypeScript** - 静态类型检查

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- Supabase 账号

### 安装步骤

```bash
# 1. 克隆项目
git clone <YOUR_GIT_URL>
cd shipment-data-view

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 文件，填入你的 Supabase 配置

# 4. 启动开发服务器
npm run dev
```

### 环境变量配置

```env
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
```

## 项目结构

```
src/
├── components/          # 可复用组件
│   ├── ui/             # 基础UI组件
│   ├── permissions/    # 权限管理组件
│   └── contracts/      # 合同管理组件
├── pages/              # 页面组件
│   ├── mobile/         # 移动端页面
│   ├── Settings/       # 设置页面
│   └── BusinessEntry/  # 业务录入页面
├── hooks/              # 自定义Hooks
├── services/           # 业务服务
├── types/              # TypeScript类型定义
├── utils/              # 工具函数
└── contexts/           # React Context
```

## 部署指南

### Vercel 部署（推荐）

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

### Docker 部署

```bash
# 构建镜像
docker build -t shipment-data-view .

# 运行容器
docker run -p 80:80 shipment-data-view
```

详细部署说明请参考 [部署指南](docs/deployment-guide.md)

## 文档

- [数据库结构](docs/database-structure.md)
- [权限管理指南](docs/permission-management-best-practices.md)
- [API文档](docs/edge-functions-documentation.md)
- [性能优化](src/performance-optimization-summary.md)

## 开发指南

### 代码规范
- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规则
- 组件使用函数式组件 + Hooks
- 使用 Tailwind CSS 进行样式管理

### 提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建过程或辅助工具的变动

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

如有问题或建议，请通过以下方式联系：
- 项目Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 邮箱: your-email@example.com

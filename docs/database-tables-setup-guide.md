# 数据库表设置指南

## 问题描述

合同管理页面的权限管理、文件管理、审计日志等模块显示"加载失败，请检查数据库连接"错误。这是因为相关的数据库表不存在。

## 解决方案

需要创建以下数据库表：
- `contract_permissions` - 合同权限表
- `contract_file_versions` - 合同文件版本表
- `contract_access_logs` - 合同访问日志表
- `contract_reminders` - 合同提醒表
- `contract_numbering_rules` - 合同编号规则表
- `contract_tags` - 合同标签表
- `contract_tag_relations` - 合同标签关系表
- `saved_searches` - 保存的搜索表

## 执行步骤

### 1. 检查现有表结构（可选）

首先执行检查脚本了解现有表结构：

**文件：** `scripts/check-existing-tables.sql`

### 2. 创建数据库表

根据你的数据库情况，选择以下脚本之一：

#### 选项 A：最简版本（强烈推荐）
**文件：** `scripts/create-basic-contract-tables.sql`

这个脚本的特点：
- 不依赖任何外部表
- 不使用外键约束
- 不使用复杂的约束检查
- 不使用RLS策略
- 最不容易出错

#### 选项 B：简化版本
**文件：** `scripts/create-contract-tables-simple.sql`

这个脚本的特点：
- 不依赖可能不存在的表
- 使用简化的外键约束
- 使用角色名称而不是角色ID
- 使用简单的RLS策略

#### 选项 C：安全版本
**文件：** `scripts/create-contract-tables-safe.sql`

这个脚本的特点：
- 会先删除可能存在的表
- 重新创建所有表
- 使用简单的外键约束
- 使用简单的RLS策略

#### 选项 D：完整版本
**文件：** `scripts/create-missing-contract-tables-fixed.sql`

这个脚本的特点：
- 会先创建依赖表（user_roles, departments）
- 使用完整的外键约束
- 使用复杂的RLS策略
- 需要 is_authenticated_user() 和 is_admin() 函数

#### 选项 E：原始版本
**文件：** `scripts/create-missing-contract-tables.sql`

这个脚本的特点：
- 假设所有依赖表已存在
- 使用完整的外键约束
- 需要 is_authenticated_user() 和 is_admin() 函数

**强烈推荐使用选项 A（最简版本）**，因为它最不容易出错。

### 2. 验证表创建

执行以下脚本验证表是否创建成功：

**文件：** `scripts/test-contract-tables.sql`

这个脚本会：
- 检查所有表是否存在
- 测试每个表是否可以正常查询
- 显示表的状态信息

## 执行方法

### 在 Supabase Dashboard 中执行：

1. 登录 Supabase Dashboard
2. 选择你的项目
3. 点击左侧菜单的 "SQL Editor"
4. 点击 "New query"
5. 复制并粘贴 `create-missing-contract-tables.sql` 的内容
6. 点击 "Run" 执行脚本
7. 等待执行完成
8. 重复步骤 4-7 执行 `test-contract-tables.sql` 验证结果

### 预期结果

执行 `test-contract-tables.sql` 后，应该看到：
- 所有表的状态都是 "EXISTS"
- 每个表的测试查询都返回计数结果（可能是 0 或少量数据）
- 没有错误信息

## 表结构说明

### contract_permissions (合同权限表)
- 存储合同的用户、角色、部门权限
- 支持权限类型：view, download, edit, delete
- 支持权限过期时间

### contract_file_versions (合同文件版本表)
- 存储合同的各种文件版本
- 支持文件类型：original, attachment, scan, amendment
- 支持版本控制和当前版本标记

### contract_access_logs (合同访问日志表)
- 记录所有合同访问和操作
- 支持操作类型：view, create, update, delete, download, export
- 记录 IP 地址和用户代理

### contract_reminders (合同提醒表)
- 管理合同到期提醒
- 支持多种提醒类型和自定义天数
- 支持邮件提醒

### contract_numbering_rules (合同编号规则表)
- 管理不同类别合同的编号规则
- 支持自定义前缀和格式
- 自动序列号管理

### contract_tags (合同标签表)
- 存储合同标签定义
- 支持颜色和描述
- 可扩展的标签系统

### contract_tag_relations (合同标签关系表)
- 管理合同和标签的多对多关系
- 支持一个合同多个标签

### saved_searches (保存的搜索表)
- 存储用户保存的搜索条件
- 支持公开和私有搜索
- JSON 格式存储搜索条件

## 默认数据

脚本会自动插入以下默认数据：

### 编号规则
- 行政合同：ADM-{year}-{month}-{sequence}
- 内部合同：INT-{year}-{month}-{sequence}
- 业务合同：BUS-{year}-{month}-{sequence}

### 合同标签
- 重要 (红色)
- 紧急 (橙色)
- 长期 (绿色)
- 短期 (蓝色)
- 保密 (紫色)

## 权限和安全

所有表都启用了行级安全 (RLS)，并设置了适当的策略：
- 认证用户可以查看相关数据
- 管理员可以管理所有数据
- 用户可以创建和更新自己的数据

## 故障排除

### 如果执行失败：

1. **检查权限**：确保数据库用户有创建表的权限
2. **检查依赖**：确保 `contracts` 表存在
3. **检查函数**：确保 `is_authenticated_user()` 和 `is_admin()` 函数存在
4. **查看错误**：仔细阅读错误信息，通常会有具体的错误描述

### 常见错误：

1. **表已存在**：如果表已经存在，脚本会跳过创建（使用 IF NOT EXISTS）
2. **权限不足**：需要数据库管理员权限
3. **依赖缺失**：需要先创建 `contracts` 表和相关的用户管理表

## 验证成功

执行完成后，合同管理页面的各个模块应该能够正常加载，不再显示"加载失败"错误。页面会显示空的数据列表，这是正常的，因为还没有实际的数据。

## 后续步骤

1. 测试各个模块的功能
2. 创建一些测试数据
3. 验证权限管理功能
4. 测试文件上传功能
5. 验证审计日志记录

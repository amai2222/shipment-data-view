# 数据库设置说明

## 问题描述

如果您在合同管理页面看到以下错误：
- "加载合同列表失败"
- "加载编号规则失败"
- "加载权限列表失败"

这通常是因为数据库表还没有创建。

## 解决方案

### 方法1：使用Supabase CLI（推荐）

1. 确保您已经安装了Supabase CLI
2. 在项目根目录运行：
```bash
cd supabase
npx supabase db reset
```

### 方法2：手动运行SQL脚本

1. 打开Supabase Dashboard
2. 进入SQL Editor
3. 复制并运行 `scripts/init-database.sql` 文件中的内容

### 方法3：使用迁移文件

1. 在Supabase Dashboard中进入Database > Migrations
2. 运行以下迁移文件：
   - `supabase/migrations/20241201000001_contract_archive_enhancement.sql`
   - `supabase/migrations/20241201000002_saved_searches.sql`
   - `supabase/migrations/20241201000003_fix_contract_tables.sql`

## 创建的表

运行脚本后，将创建以下表：

1. **contracts** - 合同主表
2. **contract_numbering_rules** - 合同编号规则表
3. **contract_tags** - 合同标签表
4. **contract_tag_relations** - 合同标签关联表
5. **contract_permissions** - 合同权限表
6. **contract_access_logs** - 合同访问日志表
7. **contract_reminders** - 合同到期提醒表
8. **contract_file_versions** - 合同文件版本表
9. **saved_searches** - 保存搜索表

## 默认数据

脚本会自动插入以下默认数据：

### 编号规则
- 行政合同：XZ-{year}-{month}-{sequence}
- 内部合同：NB-{year}-{month}-{sequence}
- 业务合同：YW-{year}-{month}-{sequence}

### 标签
- 重要（红色）
- 紧急（橙色）
- 保密（紫色）
- 长期（绿色）
- 短期（灰色）

## 验证安装

运行脚本后，您应该能够：
1. 正常加载合同列表
2. 查看编号管理页面
3. 使用标签管理功能
4. 设置权限管理
5. 查看审计日志

## 故障排除

如果仍然遇到问题：

1. 检查Supabase连接配置
2. 确认用户有适当的权限
3. 查看浏览器控制台的详细错误信息
4. 检查Supabase Dashboard中的表是否正确创建

## 联系支持

如果问题持续存在，请提供：
1. 浏览器控制台的错误信息
2. Supabase Dashboard中的表结构截图
3. 您使用的数据库设置方法

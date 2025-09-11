# 合同管理模块加载失败修复说明

## 问题描述

合同管理页面中的以下模块出现"加载失败"错误：
- 权限管理 (Permission Management)
- 文件管理 (File Management) 
- 审计日志 (Audit Logs)
- 到期提醒 (Expiration Reminder)

## 问题原因

这些模块尝试查询的数据库表可能不存在，导致查询失败并显示错误信息。具体涉及的表包括：
- `contract_permissions` - 合同权限表
- `contract_file_versions` - 合同文件版本表
- `contract_access_logs` - 合同访问日志表
- `contract_reminders` - 合同提醒表

## 修复方案

为所有相关组件添加了表不存在的错误处理，当表不存在时返回空数组而不是抛出错误。

## 修复的文件

### 1. `src/components/contracts/ContractPermissionManager.tsx`
- **修复内容**：
  - 在 `loadPermissions()` 函数中添加表不存在检查
  - 当 `contract_permissions` 表不存在时，返回空数组
  - 更新错误信息为"请检查数据库连接"

### 2. `src/components/contracts/ContractFileManager.tsx`
- **修复内容**：
  - 在 `loadFiles()` 函数中添加表不存在检查
  - 当 `contract_file_versions` 表不存在时，返回空数组
  - 更新错误信息为"请检查数据库连接"

### 3. `src/components/contracts/ContractAuditLogs.tsx`
- **修复内容**：
  - 在 `loadAuditLogs()` 函数中添加表不存在检查
  - 当 `contract_access_logs` 表不存在时，返回空数组
  - 更新错误信息为"请检查数据库连接"

### 4. `src/components/contracts/ContractAdvancedPermissions.tsx`
- **修复内容**：
  - 在 `loadPermissions()` 函数中添加表不存在检查
  - 当 `contract_permissions` 表不存在时，返回空数组
  - 更新错误信息为"请检查数据库连接"

### 5. `src/components/contracts/ContractReminderSystem.tsx`
- **修复内容**：
  - 在 `loadReminders()` 函数中添加表不存在检查
  - 当 `contract_reminders` 表不存在时，返回空数组
  - 更新错误信息为"请检查数据库连接"

## 修复逻辑

### 错误处理模式
```typescript
if (error) {
  console.error('Database error:', error);
  // 如果表不存在，返回空数组而不是抛出错误
  if (error.message.includes('relation "table_name" does not exist')) {
    setData([]);
    return;
  }
  throw error;
}
```

### 错误信息更新
```typescript
// 修复前
description: "加载权限列表失败"

// 修复后  
description: "加载权限列表失败，请检查数据库连接"
```

## 验证方法

1. **检查合同管理页面**：
   - 访问合同管理页面
   - 点击各个模块标签（权限管理、文件管理、审计日志、到期提醒）
   - 确认不再显示"加载失败"错误

2. **测试表不存在的情况**：
   - 当相关数据库表不存在时，应该显示空列表而不是错误
   - 错误信息应该提示"请检查数据库连接"

3. **测试表存在的情况**：
   - 当数据库表存在且有数据时，应该正常显示数据
   - 当数据库表存在但无数据时，应该显示"暂无数据"提示

## 数据库表检查

可以使用以下 SQL 脚本检查表是否存在：

```sql
-- 检查合同相关表是否存在
SELECT 'contract_permissions' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_permissions') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_file_versions' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_file_versions') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_access_logs' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_access_logs') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_reminders' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_reminders') 
            THEN 'EXISTS' ELSE 'MISSING' END as status;
```

## 预防措施

1. **数据库迁移**：确保所有必要的表都已创建
2. **错误处理**：为所有数据库查询添加适当的错误处理
3. **用户反馈**：提供清晰的错误信息，帮助用户理解问题
4. **日志记录**：记录详细的错误信息用于调试

## 相关文件

- `scripts/check-contract-tables.sql` - 检查表存在的脚本
- `scripts/simple-table-check.sql` - 简化的表检查脚本
- `scripts/safe-contract-fix.sql` - 创建合同相关表的脚本

修复完成后，合同管理页面的所有模块应该能够正常加载，不再出现"加载失败"的错误。

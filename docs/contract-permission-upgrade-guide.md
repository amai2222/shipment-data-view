# 合同权限系统升级部署指南

## 🚀 升级概述

本次升级为合同权限系统添加了完整的实时订阅支持、增强的数据库架构和现代化的前端组件。升级包括：

1. **数据库架构升级** - 新增合同权限相关表结构
2. **实时订阅支持** - 权限变更实时通知
3. **服务层重构** - 统一的权限管理服务
4. **前端组件优化** - 实时状态显示和错误处理

## 📋 部署步骤

### 1. 数据库升级

#### 1.1 执行权限实时更新配置（修复版）
```bash
# 在 Supabase SQL 编辑器中执行
psql -h your-supabase-host -U postgres -d postgres -f scripts/enable-permission-realtime-fixed.sql
```

#### 1.2 创建合同权限表结构
```bash
# 在 Supabase SQL 编辑器中执行
psql -h your-supabase-host -U postgres -d postgres -f scripts/create-contract-permission-tables.sql
```

#### 1.3 创建合同权限查询函数
```bash
# 在 Supabase SQL 编辑器中执行
psql -h your-supabase-host -U postgres -d postgres -f scripts/create-contract-permission-functions.sql
```

#### 1.4 启用合同权限实时订阅（修复版）
```bash
# 在 Supabase SQL 编辑器中执行
psql -h your-supabase-host -U postgres -d postgres -f scripts/enable-contract-permission-realtime-fixed.sql
```

### 2. 前端代码更新

#### 2.1 更新类型定义
- ✅ `src/types/permissions.ts` - 已更新，新增实时订阅相关类型

#### 2.2 新增服务层
- ✅ `src/services/contractPermissionService.ts` - 合同权限服务层

#### 2.3 新增实时订阅 Hook
- ✅ `src/hooks/useContractPermissionRealtime.ts` - 实时订阅管理

#### 2.4 更新组件
- ✅ `src/components/contracts/ContractPermissionManagerEnhanced.tsx` - 主要权限管理组件
- ✅ `src/components/contracts/ContractPermissionManager.tsx` - 基础权限管理组件
- ✅ `src/components/contracts/ContractPermissionManagerNew.tsx` - 新版权限管理组件
- ✅ `src/components/contracts/ContractAdvancedPermissions.tsx` - 高级权限组件

### 3. 验证部署

#### 3.1 数据库验证
```sql
-- 检查表是否创建成功
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%contract_permission%';

-- 检查函数是否创建成功
SELECT proname FROM pg_proc 
WHERE proname LIKE '%contract_permission%';

-- 检查触发器是否激活
SELECT tgname FROM pg_trigger 
WHERE tgname LIKE '%contract_permission%';
```

#### 3.2 实时订阅验证
```sql
-- 检查实时发布状态
SELECT * FROM monitor_contract_permission_realtime();

-- 检查同步状态
SELECT * FROM get_contract_permission_sync_status();

-- 运行实时订阅测试
SELECT * FROM test_contract_permission_realtime();
```

#### 3.3 前端功能验证
1. 打开合同权限管理页面
2. 检查实时连接状态指示器
3. 测试权限创建、更新、删除功能
4. 验证实时更新是否正常工作

## 🔧 配置说明

### 数据库配置

#### 表结构
- `contract_permissions` - 合同权限主表
- `contract_owner_permissions` - 合同所有者权限表
- `contract_category_permission_templates` - 合同分类权限模板表
- `contract_permission_change_log` - 权限变更日志表
- `contract_permission_sync_status` - 权限同步状态表

#### 权限类型
- `view` - 查看合同
- `download` - 下载合同文件
- `edit` - 编辑合同信息
- `delete` - 删除合同
- `manage` - 管理合同（包含所有权限）
- `sensitive` - 查看敏感信息
- `approve` - 审批合同
- `archive` - 归档合同
- `audit` - 审计合同

#### RLS 策略
- 管理员可以管理所有合同权限
- 用户可以查看自己的权限
- 合同所有者可以管理自己合同的权限

### 实时订阅配置

#### 订阅频道
- `contract_permissions_changes` - 合同权限变更频道
- `contract_permission_cache_refresh` - 权限缓存刷新频道

#### 监控表
- `contract_permissions`
- `contract_owner_permissions`
- `contract_category_permission_templates`

### 前端配置

#### 服务层 API
```typescript
// 获取用户权限
ContractPermissionService.getUserContractPermissions(userId, contractId?)

// 检查权限
ContractPermissionService.hasContractPermission(userId, contractId, permissionType)

// 创建权限
ContractPermissionService.createContractPermission(params)

// 更新权限
ContractPermissionService.updateContractPermission(params)

// 删除权限
ContractPermissionService.deleteContractPermission(permissionId)
```

#### 实时订阅 Hook
```typescript
// 使用实时订阅
const { isConnected, lastChange, error, reconnect } = useContractPermissionRealtime({
  onPermissionChange: (change) => {
    // 处理权限变更
  }
});
```

## 🚨 注意事项

### 重要修复说明
⚠️ **已修复 `realtime` 扩展错误**：
- 原始脚本尝试创建 `realtime` 扩展，但在某些 PostgreSQL 系统中不可用
- 修复版脚本使用 `DO $$` 块和异常处理，避免扩展依赖问题
- 使用 `-fixed.sql` 后缀的脚本是修复版本

### 数据库迁移
1. **备份数据** - 在执行任何数据库脚本前，请先备份现有数据
2. **权限检查** - 确保数据库用户有足够的权限执行脚本
3. **依赖关系** - 确保相关表（contracts, profiles, user_roles, departments）已存在
4. **使用修复版脚本** - 使用 `-fixed.sql` 后缀的脚本避免扩展错误

### 前端部署
1. **类型检查** - 确保所有 TypeScript 类型定义正确
2. **依赖安装** - 确保所有必要的 npm 包已安装
3. **环境变量** - 确保 Supabase 配置正确

### 实时订阅
1. **网络连接** - 实时订阅需要稳定的网络连接
2. **权限配置** - 确保 Supabase 实时订阅权限已正确配置
3. **错误处理** - 实现适当的错误处理和重连机制

## 🔍 故障排除

### 常见问题

#### 1. `extension "realtime" is not available` 错误
**问题**：执行脚本时出现 `extension "realtime" is not available` 错误
**解决方案**：
- 使用修复版脚本（`-fixed.sql` 后缀）
- 修复版脚本不依赖 `realtime` 扩展
- 使用 `DO $$` 块和异常处理避免扩展问题

#### 2. `syntax error at or near "EXISTS"` 错误
**问题**：执行脚本时出现 `REFRESH MATERIALIZED VIEW IF EXISTS` 语法错误
**解决方案**：
- PostgreSQL 的 `REFRESH MATERIALIZED VIEW` 不支持 `IF EXISTS` 语法
- 已修复为使用异常处理方式：
  ```sql
  BEGIN
      REFRESH MATERIALIZED VIEW view_name;
  EXCEPTION
      WHEN undefined_table THEN
          RAISE NOTICE '物化视图不存在，跳过刷新';
  END;
  ```

#### 3. 数据库表不存在
```sql
-- 检查表是否存在
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'contract_permissions';
```

#### 4. 实时订阅连接失败
- 检查 Supabase 项目配置
- 验证网络连接
- 查看浏览器控制台错误信息

#### 5. 权限查询失败
- 检查 RLS 策略配置
- 验证用户权限
- 查看数据库日志

#### 6. 前端组件错误
- 检查 TypeScript 类型定义
- 验证服务层 API 调用
- 查看浏览器控制台错误

### 调试工具

#### 数据库调试
```sql
-- 查看权限统计
SELECT * FROM get_contract_permission_stats();

-- 查看同步状态
SELECT * FROM get_contract_permission_sync_status();

-- 查看实时状态
SELECT * FROM contract_permission_realtime_status;
```

#### 前端调试
```typescript
// 启用详细日志
console.log('权限变更:', change);
console.log('实时连接状态:', isConnected);
console.log('同步状态:', syncStatus);
```

## 📈 性能优化

### 数据库优化
1. **索引优化** - 为常用查询字段添加索引
2. **查询优化** - 使用适当的查询策略
3. **缓存策略** - 实现权限缓存机制

### 前端优化
1. **组件优化** - 使用 React.memo 和 useMemo
2. **网络优化** - 实现请求去重和缓存
3. **实时订阅优化** - 合理使用订阅和取消订阅

## 🎯 后续计划

1. **权限审计** - 实现完整的权限变更审计功能
2. **批量操作** - 支持批量权限管理
3. **权限模板** - 实现更灵活的权限模板系统
4. **移动端支持** - 优化移动端权限管理体验

## 📞 技术支持

如果在部署过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查 Supabase 项目日志
3. 查看浏览器控制台错误信息
4. 联系技术支持团队

---

**升级完成！** 🎉

合同权限系统已成功升级，现在支持：
- ✅ 实时权限变更通知
- ✅ 增强的数据库架构
- ✅ 现代化的前端组件
- ✅ 完整的错误处理
- ✅ 权限审计功能

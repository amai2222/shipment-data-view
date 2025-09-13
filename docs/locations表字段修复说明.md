# Locations表字段修复说明

## 问题描述

在运行SQL脚本时遇到字段不存在的错误：
- `ERROR: 42703: column "address" does not exist`
- `ERROR: 42703: column "updated_at" of relation "locations" does not exist`

## 问题分析

### 根本原因
- `locations` 表的实际结构与脚本中假设的结构不一致
- 脚本中引用了不存在的字段：`address` 和 `updated_at`

### 影响范围
- `get_or_create_locations_from_string` 函数
- `get_or_create_locations_from_string_v2` 函数
- 地点创建相关的所有脚本

## 修复方案

### 1. 检查表结构
首先执行 `scripts/check-locations-table-structure.sql` 查看实际的表结构：

```sql
-- 检查locations表的实际结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'locations' 
AND table_schema = 'public'
ORDER BY ordinal_position;
```

### 2. 修复函数
执行 `scripts/fix-locations-table-fields.sql` 修复所有相关函数：

```sql
-- 修复 get_or_create_locations_from_string 函数
-- 移除 updated_at 字段引用
INSERT INTO public.locations (name, created_at)
VALUES (location_name, NOW())
```

### 3. 修复脚本
更新所有相关脚本，移除不存在的字段引用。

## 修复内容

### 1. 函数修复
- **`get_or_create_locations_from_string`**：移除 `updated_at` 字段
- **`get_or_create_locations_from_string_v2`**：移除 `updated_at` 字段

### 2. 脚本修复
- **`fix-waybill-edit-location-loading.sql`**：移除 `address` 和 `updated_at` 字段
- **`fix-waybill-edit-location-loading-simple.sql`**：移除 `updated_at` 字段

### 3. 字段映射
根据实际表结构，只使用存在的字段：
- ✅ `id` - 主键
- ✅ `name` - 地点名称
- ✅ `created_at` - 创建时间
- ❌ `address` - 不存在
- ❌ `updated_at` - 不存在

## 执行步骤

### 1. 检查表结构
```sql
\i scripts/check-locations-table-structure.sql
```

### 2. 修复函数
```sql
\i scripts/fix-locations-table-fields.sql
```

### 3. 测试功能
```sql
\i scripts/fix-waybill-edit-location-loading-simple.sql
```

### 4. 修复Excel导入
```sql
\i scripts/fix-platform-fields-in-import.sql
```

## 预期结果

修复后应该能够：
- ✅ 正常创建地点记录
- ✅ 运单编辑时正确读取卸货地点
- ✅ Excel导入时正确处理平台字段
- ✅ 多地点功能正常工作

## 注意事项

### 1. 数据一致性
- 确保所有地点创建操作使用相同的字段
- 避免引用不存在的字段

### 2. 函数兼容性
- 修复后的函数应该与现有代码兼容
- 保持函数签名不变

### 3. 测试验证
- 修复后需要测试所有相关功能
- 确保地点创建和查询正常工作

## 总结

这个问题的根本原因是表结构与脚本假设不一致。通过：

1. **检查实际表结构**
2. **修复所有相关函数**
3. **更新所有相关脚本**
4. **测试功能正常性**

可以彻底解决字段不存在的错误，确保系统正常运行。

# JSON格式错误修复说明

## 错误描述

```
ERROR: 22P02: invalid input syntax for type json
DETAIL: Token "79af9bal" is invalid.
CONTEXT: JSON data, line 1: {79af9bal...
```

## 问题分析

### 根本原因
- JSON数据格式不正确，包含无效的token `79af9bal`
- 可能是数据损坏或格式错误导致的
- 在调用JSON相关函数时触发了格式验证错误

### 可能的原因
1. **数据损坏**：数据库中的JSON字段包含损坏的数据
2. **格式错误**：JSON字符串格式不正确
3. **编码问题**：字符编码导致的格式问题
4. **函数调用错误**：传递给JSON函数的参数格式错误

## 修复方案

### 1. 诊断问题
执行 `scripts/fix-json-format-error.sql` 来诊断问题：

```sql
-- 检查是否有损坏的JSON数据
-- 查找包含无效JSON的记录
-- 检查JSON字段的数据完整性
```

### 2. 清理数据
如果发现损坏的JSON数据，执行清理：

```sql
-- 清理无效的JSON数据
UPDATE logistics_records 
SET external_tracking_numbers = NULL
WHERE external_tracking_numbers IS NOT NULL 
  AND NOT (external_tracking_numbers::text ~ '^\[.*\]$' OR external_tracking_numbers::text ~ '^\{.*\}$');
```

### 3. 安全测试
使用 `scripts/test-json-format-safe.sql` 进行安全测试：

```sql
-- 逐步测试JSON格式
-- 测试数据库函数
-- 验证数据完整性
```

## 执行步骤

### 1. 诊断问题
```sql
\i scripts/fix-json-format-error.sql
```

### 2. 安全测试
```sql
\i scripts/test-json-format-safe.sql
```

### 3. 如果问题持续，检查具体错误
查看错误信息中的具体位置，定位问题数据。

## 预防措施

### 1. 数据验证
- 在插入JSON数据前进行格式验证
- 使用适当的错误处理机制

### 2. 函数调用
- 确保传递给JSON函数的参数格式正确
- 使用类型转换确保数据格式正确

### 3. 数据清理
- 定期检查JSON字段的数据完整性
- 及时清理损坏的数据

## 常见解决方案

### 1. 如果错误来自测试脚本
- 检查测试数据中的JSON格式
- 确保所有JSON字符串格式正确
- 使用简单的测试数据避免复杂格式

### 2. 如果错误来自数据库数据
- 清理损坏的JSON数据
- 重新导入正确的数据
- 检查数据源的数据质量

### 3. 如果错误来自函数调用
- 检查函数参数格式
- 确保参数类型正确
- 添加适当的错误处理

## 验证修复

修复后应该能够：
- ✅ 正常执行JSON相关操作
- ✅ 数据库函数正常工作
- ✅ 平台字段正确导入和显示
- ✅ 没有JSON格式错误

## 总结

JSON格式错误通常是由于数据损坏或格式不正确导致的。通过：

1. **诊断问题**：找出损坏的数据
2. **清理数据**：移除无效的JSON
3. **安全测试**：验证修复效果
4. **预防措施**：避免未来问题

可以彻底解决JSON格式错误问题。

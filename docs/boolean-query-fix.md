# 布尔值查询错误修复说明

## 问题描述

合同管理页面出现错误：`invalid input syntax for type boolean: ""`

## 问题原因

在 `src/pages/ContractManagement.tsx` 中，`is_confidential` 字段被定义为 `string` 类型，但在查询时被当作布尔值传递给数据库。

### 具体问题：

1. **类型定义不一致**：
   ```typescript
   interface ContractFilters {
     is_confidential: string; // 定义为字符串
   }
   ```

2. **查询逻辑错误**：
   ```typescript
   // 错误的查询逻辑
   if (filters.is_confidential !== null && filters.is_confidential !== undefined) {
     query = query.eq('is_confidential', filters.is_confidential); // 传递字符串给布尔字段
   }
   ```

3. **初始值问题**：
   ```typescript
   const initialFilters: ContractFilters = {
     is_confidential: '' // 空字符串
   };
   ```

## 修复方案

### 1. 修复查询逻辑

```typescript
// 修复后的查询逻辑
if (filters.is_confidential && filters.is_confidential !== '') {
  const isConfidential = filters.is_confidential === 'true';
  query = query.eq('is_confidential', isConfidential);
}
```

### 2. 类型转换

将字符串值正确转换为布尔值：
- `'true'` → `true`
- `'false'` → `false`
- `''` (空字符串) → 不执行查询

## 修复文件

- `src/pages/ContractManagement.tsx` - 修复了 `is_confidential` 字段的查询逻辑

## 验证方法

1. **运行测试脚本**：
   ```sql
   -- 运行 scripts/test-contract-query.sql
   ```

2. **检查合同管理页面**：
   - 页面应该能正常加载
   - 不再出现布尔值语法错误

## 预防措施

1. **类型一致性**：确保接口定义与实际使用保持一致
2. **数据验证**：在查询前验证数据类型
3. **错误处理**：添加适当的错误处理和日志记录

## 相关文件

- `src/pages/ContractManagement.tsx` - 主要修复文件
- `src/components/contracts/ContractAdvancedSearch.tsx` - 正确的类型定义示例
- `scripts/test-contract-query.sql` - 测试脚本

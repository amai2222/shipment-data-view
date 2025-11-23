# 运单维护标准导入功能比对报告

## 🔍 问题分析

### 标准版（WaybillMaintenance.tsx）✅ 成功
- **导入函数**: `handleExcelImport` (来自 `useExcelImportWithUpdate` hook)
- **后端RPC调用**: `batch_import_logistics_records_with_update_1123`
- **功能特性**:
  - ✅ 支持更新模式（可以更新重复记录）
  - ✅ 自动创建装货地点和卸货地点到 `locations` 表
  - ✅ 自动关联地点到项目
  - ✅ 支持重复记录处理

### 增强版（EnhancedWaybillMaintenance.tsx）❌ 失败
- **导入函数**: `handleEnhancedExcelImport` (自定义函数)
- **后端RPC调用**: `batch_import_logistics_records` (没有 `_with_update` 后缀)
- **功能特性**:
  - ❌ 不支持更新模式
  - ❌ 不自动创建地点
  - ❌ 不自动关联地点到项目
  - ❌ 如果地点不存在，导入会失败

## 🎯 根本原因

增强版使用了错误的RPC函数：
- 使用: `batch_import_logistics_records` 
- 应该使用: `batch_import_logistics_records_with_update_1123`

## 📝 代码位置

### 标准版
```typescript
// src/pages/DataMaintenance/WaybillMaintenance.tsx:297
onChange={handleExcelImport}  // 来自 useExcelImportWithUpdate hook

// src/pages/BusinessEntry/hooks/useExcelImportWithUpdate.ts:267
await supabase.rpc('batch_import_logistics_records_with_update_1123', {
  p_records: recordsToImport,
  p_update_mode: importMode === 'update'
})
```

### 增强版
```typescript
// src/pages/DataMaintenance/EnhancedWaybillMaintenance.tsx:595
onChange={handleEnhancedExcelImport}  // 自定义函数

// src/pages/DataMaintenance/EnhancedWaybillMaintenance.tsx:357
await supabase.rpc('batch_import_logistics_records', {
  p_records: recordsToImport
})
```

## 🔧 修复方案

将增强版的 `executeEnhancedImport` 函数中的RPC调用改为：
```typescript
const { data: result, error } = await supabase.rpc('batch_import_logistics_records_with_update_1123', {
  p_records: recordsToImport,
  p_update_mode: false  // 增强版目前只支持创建模式
});
```

## 📊 函数功能对比

| 功能 | batch_import_logistics_records | batch_import_logistics_records_with_update_1123 |
|------|-------------------------------|--------------------------------------------------|
| 创建新记录 | ✅ | ✅ |
| 更新重复记录 | ❌ | ✅ |
| 自动创建地点 | ❌ | ✅ |
| 自动关联地点到项目 | ❌ | ✅ |
| 支持更新模式参数 | ❌ | ✅ |


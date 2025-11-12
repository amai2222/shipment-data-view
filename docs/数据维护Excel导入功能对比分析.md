# 数据维护Excel导入功能完整对比分析

## 📋 功能概览

数据维护模块共有 **6个Excel导入功能**，分布在3个页面中：

### 页面分布
1. **运单维护** (`WaybillMaintenance.tsx`) - 2个功能
2. **运单维护（增强版）** (`EnhancedWaybillMaintenance.tsx`) - 3个功能
3. **数据导入** (`DataImport.tsx`) - 1个功能

---

## 🔍 详细功能对比

### 1️⃣ 标准导入（运单维护）

**位置**: `src/pages/DataMaintenance/WaybillMaintenance.tsx`  
**Hook**: `useExcelImportWithUpdate`  
**后端函数**: `preview_import_with_update_mode` → `batch_import_logistics_records_with_update`

#### 核心特性
- ✅ **创建/更新模式选择**
  - 创建模式：只插入新记录
  - 更新模式：更新已存在的重复记录
- ✅ **重复数据预览和选择**
  - 预览阶段显示所有重复记录
  - 用户可勾选要更新的记录
- ✅ **标准日期格式支持**
  - `YYYY-MM-DD`
  - `YYYY/M/D`
  - Excel数字日期序列号
  - Date对象
- ✅ **字段匹配方式**
  - 硬编码字段名匹配（`项目名称`、`司机姓名`等）
  - 支持模糊匹配（`项目名称*`、`项目`等）
- ✅ **导入预览对话框**
  - 显示新记录、更新记录、错误记录
  - 支持批量勾选重复记录
- ✅ **基本日志显示**
  - 简单的文本日志

#### 日期处理
```typescript
// 使用 parseExcelDate 函数
parseExcelDate(excelDate) // 返回 YYYY-MM-DD 格式
```

#### 适用场景
- 标准格式的Excel文件
- 需要创建/更新模式切换
- 需要预览和选择重复记录

---

### 2️⃣ 标准导入（运单维护增强版）

**位置**: `src/pages/DataMaintenance/EnhancedWaybillMaintenance.tsx`  
**Hook**: `useExcelImportWithUpdate`（与功能1相同）  
**后端函数**: `preview_import_with_update_mode` → `batch_import_logistics_records_with_update`

#### 核心特性
- ✅ **与功能1完全相同**
- ✅ **使用相同的Hook和逻辑**
- ✅ **相同的UI和交互**

#### 区别
- 仅页面位置不同（增强版页面）
- 功能逻辑完全一致

---

### 3️⃣ 增强版标准导入（运单维护增强版）

**位置**: `src/pages/DataMaintenance/EnhancedWaybillMaintenance.tsx`  
**函数**: `handleEnhancedExcelImport`（自定义处理）  
**后端函数**: `batch_import_logistics_records_with_update`

#### 核心特性
- ✅ **支持6种日期格式**
  1. `2025-01-15` (标准格式)
  2. `2025/1/15` (斜杠格式)
  3. `5月20日` (中文格式，当年)
  4. `2025年12月25日` (完整中文)
  5. `3/15` (短格式，当年)
  6. Excel数字日期序列号 (自动转换)
- ✅ **增强的日期解析**
  - 使用 `parseExcelDateEnhanced` 函数
  - 支持更多日期格式变体
- ✅ **复杂外部平台数据处理**
  - 使用 `processExternalPlatformData` 函数
  - 支持复杂的平台数据格式
- ✅ **详细字段验证**
  - 使用 `validateBatchData` 函数
  - 更严格的验证规则
- ✅ **4级日志系统**
  - `info` - 信息日志
  - `warn` - 警告日志
  - `error` - 错误日志
  - `success` - 成功日志
- ✅ **实时进度显示**
  - 使用 `Progress` 组件
  - 显示导入进度百分比
- ✅ **增强模板下载**
  - 使用 `generateEnhancedWaybillTemplate` 函数
  - 包含更多示例数据格式
- ✅ **详细日志记录器**
  - `createEnhancedLogger` - 结构化日志
  - `createImportProgressManager` - 进度管理
  - `ValidationResultProcessor` - 验证结果处理
  - `ExcelParseErrorHandler` - Excel解析错误处理
  - `ImportResultProcessor` - 导入结果处理
- ❌ **不支持创建/更新模式选择**（只支持创建模式）
- ❌ **不支持重复数据预览和选择**

#### 日期处理
```typescript
// 使用 parseExcelDateEnhanced 函数
parseExcelDateEnhanced(excelDate) // 支持更多格式
```

#### 适用场景
- 需要支持多种日期格式
- 需要详细的日志和进度显示
- 只需要创建新记录（不需要更新模式）
- 需要处理复杂的外部平台数据

---

### 4️⃣ 模板导入

**位置**: `src/components/TemplateBasedImport.tsx`  
**页面**: 运单维护 + 运单维护增强版  
**后端函数**: `batch_import_logistics_records_with_update`

#### 核心特性
- ✅ **模板映射系统**
  - 使用 `import_templates` 表存储模板配置
  - 使用 `import_field_mappings` 表存储字段映射
  - 使用 `import_fixed_mappings` 表存储固定值映射
- ✅ **自定义Excel列名**
  - Excel列名可以任意命名
  - 通过映射关系关联到数据库字段
- ✅ **值转换规则**
  - 支持 `value_mappings` 值转换
  - 例如：Excel中的"是" → 数据库中的"true"
- ✅ **默认值支持**
  - 字段可以设置默认值
  - Excel中为空时使用默认值
- ✅ **创建/更新模式**
  - 支持创建模式和更新模式
  - 更新模式会更新已存在的记录
- ✅ **表头行配置**
  - 可配置表头所在行号（`header_row`）
  - 可配置数据开始行号（`data_start_row`）
- ✅ **日期处理**
  - 使用 `parseExcelDateEnhanced` 函数
  - 支持多种日期格式

#### 字段映射流程
1. 用户选择模板
2. 系统加载模板的字段映射配置
3. Excel列名 → 数据库字段名（通过映射）
4. 应用值转换规则（如果存在）
5. 应用默认值（如果Excel中为空）

#### 适用场景
- Excel列名与系统字段名不一致
- 需要值转换（如：状态码转换）
- 需要为字段设置默认值
- 不同平台/供应商的Excel格式不同

---

### 5️⃣ 选择性更新

**位置**: `src/components/SelectiveFieldUpdate.tsx`  
**页面**: 运单维护 + 运单维护增强版  
**后端函数**: `batch_update_logistics_records`

#### 核心特性
- ✅ **选择性字段更新**
  - 用户勾选要更新的字段
  - 只更新勾选的字段，其他字段保持不变
- ✅ **定位字段匹配**
  - 使用6个定位字段查找运单：
    - 项目名称
    - 司机姓名
    - 装货地点
    - 卸货地点
    - 装货日期
    - 装货数量
- ✅ **模板映射支持**（新增）
  - 可选择导入模板
  - 使用模板的字段映射关系
  - 支持值转换规则和默认值
- ✅ **字段更新预览**
  - 显示原值和新值对比
  - 显示哪些字段将被更新
- ✅ **批量更新**
  - 一次性更新多条记录
  - 使用 `batch_update_logistics_records` RPC函数
- ✅ **日期处理**
  - 使用 `parseExcelDateEnhanced` 函数
  - 支持多种日期格式

#### 更新逻辑
1. 根据定位字段查找运单
2. 提取要更新的字段值（支持模板映射）
3. 显示更新预览（原值 vs 新值）
4. 用户确认后批量更新

#### 适用场景
- 只需要更新部分字段
- 需要根据定位字段查找运单
- 需要查看更新前后对比
- 使用模板映射处理不同格式的Excel

---

### 6️⃣ 数据导入（带重复检测）

**位置**: `src/pages/DataImport.tsx`  
**页面**: 独立的数据导入页面  
**后端函数**: `preview_import_with_duplicates_check` → `batch_import_logistics_records`

#### 核心特性
- ✅ **重复检测和预览**
  - 使用 `preview_import_with_duplicates_check` 函数
  - 预览阶段显示重复记录
- ✅ **8个必填字段验重**
  - 项目名称
  - 司机姓名
  - 车牌号
  - 装货地点
  - 卸货地点
  - 装货日期
  - 装货数量
  - （第8个字段可能是其他）
- ✅ **日期处理**
  - 使用 `parseExcelDateToChina` 函数
  - 支持多种日期格式
- ✅ **导入预览对话框**
  - 显示新记录、重复记录、错误记录
  - 支持选择重复记录的处理方式

#### 适用场景
- 需要严格的重复检测
- 需要预览所有重复记录
- 独立的数据导入页面

---

## 📊 功能对比矩阵

| 功能 | 创建模式 | 更新模式 | 重复检测 | 模板映射 | 日期格式 | 日志系统 | 进度显示 |
|------|---------|---------|---------|---------|---------|---------|---------|
| 1. 标准导入（普通版） | ✅ | ✅ | ✅ | ❌ | 基础 | 简单 | ❌ |
| 2. 标准导入（增强版） | ✅ | ✅ | ✅ | ❌ | 基础 | 简单 | ❌ |
| 3. 增强版标准导入 | ✅ | ❌ | ❌ | ❌ | 增强 | 4级 | ✅ |
| 4. 模板导入 | ✅ | ✅ | ✅ | ✅ | 增强 | 简单 | ❌ |
| 5. 选择性更新 | ❌ | ✅ | ✅ | ✅ | 增强 | 简单 | ❌ |
| 6. 数据导入 | ✅ | ❌ | ✅ | ❌ | 基础 | 简单 | ❌ |

---

## 🔄 日期处理对比

### 日期解析函数

| 功能 | 日期解析函数 | 支持的格式 |
|------|-------------|-----------|
| 1. 标准导入（普通版） | `parseExcelDate` | YYYY-MM-DD, YYYY/M/D, Excel数字, Date对象 |
| 2. 标准导入（增强版） | `parseExcelDate` | 同上 |
| 3. 增强版标准导入 | `parseExcelDateEnhanced` | YYYY-MM-DD, YYYY/M/D, YYYY年M月D日, M月D日, M/D, Excel数字 |
| 4. 模板导入 | `parseExcelDateEnhanced` | 同上 |
| 5. 选择性更新 | `parseExcelDateEnhanced` | 同上 |
| 6. 数据导入 | `parseExcelDateToChina` | YYYY-MM-DD, YYYY/M/D, YYYY年M月D日, M月D日, M/D, Excel数字 |

### 时区处理
- ✅ **所有功能都符合主流规范**
- ✅ **Excel数据按中国时区解析**
- ✅ **前端传递 YYYY-MM-DD 格式（中国时区）**
- ✅ **后端自动转换为 UTC 存储**

---

## 🎯 字段匹配方式对比

### 1. 硬编码字段匹配（功能1、2、3、6）
```typescript
// 硬编码的字段名
rowData['项目名称'] || rowData['项目名称*'] || rowData['项目']
rowData['司机姓名'] || rowData['司机姓名*'] || rowData['司机']
```

### 2. 模板映射（功能4、5）
```typescript
// 从模板映射中获取Excel列名
const mapping = templateMappings.find(m => m.database_field === fieldKey);
const value = rowData[mapping.excel_column]; // 使用映射的列名
```

### 3. 混合模式（功能5）
```typescript
// 优先使用模板映射，如果没有则使用硬编码匹配
if (templateMappings && templateMappings.length > 0) {
  // 使用模板映射
} else {
  // 使用硬编码匹配（向后兼容）
}
```

---

## 💡 使用建议

### 选择哪个功能？

1. **标准格式Excel，需要创建/更新模式**
   → 使用 **功能1或2**（标准导入）

2. **多种日期格式，需要详细日志**
   → 使用 **功能3**（增强版标准导入）

3. **Excel列名与系统字段名不一致**
   → 使用 **功能4**（模板导入）

4. **只需要更新部分字段**
   → 使用 **功能5**（选择性更新）

5. **需要严格的重复检测**
   → 使用 **功能6**（数据导入）

6. **需要更新部分字段 + Excel列名不一致**
   → 使用 **功能5**（选择性更新）+ 选择模板

---

## 🔧 技术实现差异

### 后端RPC函数

| 功能 | 预览函数 | 执行函数 |
|------|---------|---------|
| 1-2. 标准导入 | `preview_import_with_update_mode` | `batch_import_logistics_records_with_update` |
| 3. 增强版标准导入 | 无（直接执行） | `batch_import_logistics_records_with_update` |
| 4. 模板导入 | 前端预览 | `batch_import_logistics_records_with_update` |
| 5. 选择性更新 | 前端预览 | `batch_update_logistics_records` |
| 6. 数据导入 | `preview_import_with_duplicates_check` | `batch_import_logistics_records` |

### 前端Hook/组件

| 功能 | 实现方式 |
|------|---------|
| 1-2. 标准导入 | `useExcelImportWithUpdate` Hook |
| 3. 增强版标准导入 | `handleEnhancedExcelImport` 自定义函数 |
| 4. 模板导入 | `TemplateBasedImport` 组件 |
| 5. 选择性更新 | `SelectiveFieldUpdate` 组件 |
| 6. 数据导入 | `DataImportWithDuplicateCheck` 组件 |

---

## 📝 总结

### 核心区别

1. **标准导入（1、2）**：基础功能，支持创建/更新模式，适合标准格式
2. **增强版标准导入（3）**：增强功能，支持多种日期格式，详细日志，但只支持创建模式
3. **模板导入（4）**：灵活映射，支持自定义列名和值转换，适合不同格式的Excel
4. **选择性更新（5）**：部分更新，只更新选中的字段，支持模板映射
5. **数据导入（6）**：严格验重，8个必填字段验重，适合数据质量要求高的场景

### 共同点

- ✅ 所有功能都正确处理时区（中国时区 → UTC存储）
- ✅ 所有功能都支持Excel数字日期序列号
- ✅ 所有功能都使用相同的后端RPC函数（或类似函数）
- ✅ 所有功能都提供导入预览和错误处理

---

**文档生成时间**: 2025-11-13  
**最后更新**: 选择性更新已集成模板映射功能


# Excel导入平台字段修复说明

## 问题确认

您报告的问题：**数据维护和运单管理的导入excel，为什么其他平台名称和其他平台运单号没导入？**

## 问题原因

经过检查发现，Excel导入功能中确实有处理其他平台名称和运单号的逻辑，但是存在以下问题：

1. **字段名不匹配**：代码中使用的是 `platform_trackings`，但数据库字段是 `external_tracking_numbers` 和 `other_platform_names`
2. **数据结构不匹配**：代码生成的数据结构与数据库期望的格式不一致

## 修复内容

### 1. 前端导入逻辑修复

**文件**: `src/pages/DataImport.tsx`

**修复前**:
```javascript
// 处理平台运单信息
let platformTrackings = null;
if (rowData['其他平台名称'] || rowData['其他平台运单号']) {
  // ... 处理逻辑
  platformTrackings = trackings;
}

return {
  // ... 其他字段
  platform_trackings: platformTrackings
};
```

**修复后**:
```javascript
// 处理其他平台名称和外部运单号
let externalTrackingNumbers = null;
let otherPlatformNames = null;

if (rowData['其他平台名称'] || rowData['其他平台运单号']) {
  const platformNames = rowData['其他平台名称']?.toString().split(',').map((name: string) => name.trim()).filter((name: string) => name) || [];
  const platformTrackingGroups = rowData['其他平台运单号']?.toString().split(',').map((group: string) => group.trim()).filter((group: string) => group) || [];
  
  // 处理外部运单号（JSONB格式）
  const trackingNumbers = [];
  for (let i = 0; i < platformNames.length; i++) {
    const platformName = platformNames[i];
    const trackingGroup = platformTrackingGroups[i] || '';
    const trackingNumbersList = trackingGroup ? trackingGroup.split('|').map((tn: string) => tn.trim()).filter((tn: string) => tn) : [];
    
    if (platformName && trackingNumbersList.length > 0) {
      trackingNumbersList.forEach(trackingNumber => {
        trackingNumbers.push({
          platform: platformName,
          tracking_number: trackingNumber,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      });
    }
  }
  
  if (trackingNumbers.length > 0) {
    externalTrackingNumbers = trackingNumbers;
  }
  
  // 处理其他平台名称（TEXT[]格式）
  if (platformNames.length > 0) {
    otherPlatformNames = platformNames;
  }
}

return {
  // ... 其他字段
  external_tracking_numbers: externalTrackingNumbers,
  other_platform_names: otherPlatformNames
};
```

### 2. 数据库函数支持

**文件**: `scripts/update-batch-import-with-optional-fields.sql`

数据库函数 `batch_import_logistics_records` 已经支持处理这些字段：

```sql
-- 处理可选字段：外部运单号
CASE 
    WHEN rec->'external_tracking_numbers' IS NOT NULL AND jsonb_array_length(rec->'external_tracking_numbers') > 0 THEN
        rec->'external_tracking_numbers'
    ELSE NULL
END AS external_tracking_numbers,

-- 处理可选字段：其他平台名称
CASE 
    WHEN rec->'other_platform_names' IS NOT NULL AND jsonb_array_length(rec->'other_platform_names') > 0 THEN
        (SELECT array_agg(value::text) FROM jsonb_array_elements_text(rec->'other_platform_names') WHERE value::text != '')
    ELSE NULL
END AS other_platform_names,
```

### 3. Excel模板格式

**模板字段**:
- `其他平台名称(可选)` - 逗号分隔的多个平台名称
- `其他平台运单号(可选)` - 逗号分隔的多个平台运单号组，每组用|分隔多个运单号

**示例数据**:
```
其他平台名称: "平台A,平台B"
其他平台运单号: "运单1|运单2,运单3|运单4"
```

**解析结果**:
- 平台A: 运单1, 运单2
- 平台B: 运单3, 运单4

## 数据格式说明

### 1. external_tracking_numbers (JSONB)

**用途**: 存储其他平台的运单号码信息

**数据格式**:
```json
[
  {
    "platform": "货拉拉",
    "tracking_number": "HL20250120001",
    "status": "pending",
    "created_at": "2025-01-20T10:00:00Z"
  },
  {
    "platform": "满帮",
    "tracking_number": "MB20250120002",
    "status": "pending",
    "created_at": "2025-01-20T11:00:00Z"
  }
]
```

### 2. other_platform_names (TEXT[])

**用途**: 存储其他平台名称列表

**数据格式**:
```sql
['运满满', '滴滴货运', '其他平台']
```

## 功能验证

### 测试脚本

**文件**: `scripts/test-excel-import-platform-fields.sql`

**测试内容**:
1. 创建包含平台字段的测试数据
2. 调用 `batch_import_logistics_records` 函数
3. 验证导入结果
4. 检查字段数据是否正确保存

**使用方法**:
```sql
-- 在Supabase后台执行
-- 复制并执行 scripts/test-excel-import-platform-fields.sql 的内容
```

### 预期结果

测试脚本会：
1. 创建包含平台字段的测试运单记录
2. 验证 `external_tracking_numbers` 字段数据
3. 验证 `other_platform_names` 字段数据
4. 显示详细的字段内容

## 使用说明

### 1. Excel导入格式

**其他平台名称列**:
- 格式：`平台A,平台B,平台C`
- 多个平台用逗号分隔
- 可以为空

**其他平台运单号列**:
- 格式：`运单1|运单2,运单3|运单4,运单5`
- 多个平台用逗号分隔
- 同一平台的多个运单号用|分隔
- 可以为空

### 2. 导入流程

1. 下载Excel模板
2. 填写数据（包括平台字段）
3. 上传Excel文件
4. 系统自动解析平台字段
5. 预览导入数据
6. 确认导入

## 相关文件

1. **`src/pages/DataImport.tsx`** - Excel导入页面（已修复）
2. **`scripts/update-batch-import-with-optional-fields.sql`** - 数据库导入函数
3. **`scripts/test-excel-import-platform-fields.sql`** - 测试脚本
4. **`docs/Excel导入平台字段修复说明.md`** - 本文档

## 当前状态

### ✅ 已修复

1. **字段名匹配**: 使用正确的数据库字段名
2. **数据结构**: 生成正确的数据格式
3. **导入逻辑**: 正确处理平台字段数据
4. **模板格式**: 包含正确的字段说明

### 🔄 待验证

1. **实际导入测试**: 需要在实际环境中测试导入功能
2. **数据验证**: 确保导入的数据正确保存到数据库
3. **错误处理**: 验证错误情况的处理

## 结论

现在Excel导入功能应该能够正确处理其他平台名称和外部运单号字段了。修复后的功能会：

- ✅ 正确解析Excel中的平台字段
- ✅ 生成正确的数据库格式
- ✅ 保存到正确的数据库字段
- ✅ 在运单编辑时正确显示

## 更新日志

- 2025-01-20: 识别问题，字段名不匹配
- 2025-01-20: 修复前端导入逻辑，使用正确的字段名
- 2025-01-20: 修复数据结构，生成正确的格式
- 2025-01-20: 创建测试脚本验证功能
- 2025-01-20: 创建修复说明文档

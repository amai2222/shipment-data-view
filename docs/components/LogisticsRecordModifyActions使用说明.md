# LogisticsRecordModifyActions 组件使用说明

## 功能概述

`LogisticsRecordModifyActions` 是一个公共组件，封装了运单的修改操作功能：

1. **单个修改合作链路** - 修改单个运单的合作链路，自动重新计算成本
2. **单个修改运费** - 修改单个运单的合作方和司机应收金额
3. **批量修改应收** - 批量修改多个运单的合作方和司机应收金额
4. **批量修改合作链路** - 批量修改多个运单的合作链路

## 基本使用

### 1. 导入组件

```typescript
import { LogisticsRecordModifyActions, LogisticsRecordModifyActionsRef } from '@/components/LogisticsRecordModifyActions';
import { useRef } from 'react';
```

### 2. 在组件中使用

```typescript
export default function YourPage() {
  const modifyActionsRef = useRef<LogisticsRecordModifyActionsRef>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  const handleRefresh = () => {
    // 刷新数据
    fetchData();
  };

  // 在表格操作列中调用单个操作
  const handleEditCost = (record: LogisticsRecord) => {
    modifyActionsRef.current?.editPartnerCost(record);
  };

  const handleEditChain = async (record: LogisticsRecord) => {
    await modifyActionsRef.current?.editChain(record);
  };

  return (
    <div>
      {/* 批量操作按钮 */}
      <LogisticsRecordModifyActions
        ref={modifyActionsRef}
        selectedIds={selectedIds}
        records={records}
        projects={projects}
        onRefresh={handleRefresh}
        showBatchActions={true}
        showSingleActions={false} // 单个操作通过 ref 调用
        buttonClassName="bg-orange-600 hover:bg-orange-700 text-white"
      />

      {/* 表格 */}
      <Table>
        <TableBody>
          {records.map(record => (
            <TableRow key={record.id}>
              {/* ... 其他列 ... */}
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditCost(record)}
                    title="修改运费"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditChain(record)}
                    title="修改合作链路"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

## Props 说明

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `selectedIds` | `Set<string>` | 是 | - | 选中的运单ID集合 |
| `records` | `LogisticsRecord[]` | 是 | - | 运单数据列表 |
| `projects` | `Array<{ id: string; name: string }>` | 否 | `[]` | 项目列表（用于查找项目ID） |
| `onRefresh` | `() => void` | 是 | - | 数据刷新回调函数 |
| `showBatchActions` | `boolean` | 否 | `true` | 是否显示批量操作按钮 |
| `showSingleActions` | `boolean` | 否 | `true` | 是否显示单个操作按钮（通常设为 false，通过 ref 调用） |
| `buttonClassName` | `string` | 否 | `"bg-orange-600 hover:bg-orange-700 text-white"` | 批量操作按钮的自定义样式 |

## Ref 方法说明

通过 `ref` 可以调用以下方法：

### `editPartnerCost(record: LogisticsRecord)`

打开修改运费对话框。

**参数：**
- `record`: 要修改的运单记录

**示例：**
```typescript
modifyActionsRef.current?.editPartnerCost(record);
```

### `editChain(record: LogisticsRecord): Promise<void>`

打开修改合作链路对话框。

**参数：**
- `record`: 要修改的运单记录

**示例：**
```typescript
await modifyActionsRef.current?.editChain(record);
```

## 完整示例

### PaymentRequest.tsx 中的使用

```typescript
import { LogisticsRecordModifyActions, LogisticsRecordModifyActionsRef } from '@/components/LogisticsRecordModifyActions';
import { useRef } from 'react';

export default function PaymentRequest() {
  const modifyActionsRef = useRef<LogisticsRecordModifyActionsRef>(null);
  const [selection, setSelection] = useState({ mode: 'none' as const, selectedIds: new Set<string>() });
  const [reportData, setReportData] = useState<any>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  const fetchReportData = async () => {
    // 获取数据
    // ...
  };

  return (
    <div>
      <PageHeader title="合作方付款申请">
        {/* 批量操作按钮 */}
        <LogisticsRecordModifyActions
          ref={modifyActionsRef}
          selectedIds={selection.selectedIds}
          records={reportData?.records || []}
          projects={projects}
          onRefresh={fetchReportData}
        />
      </PageHeader>

      <Table>
        <TableBody>
          {reportData?.records.map((record: LogisticsRecord) => (
            <TableRow key={record.id}>
              {/* ... 其他列 ... */}
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => modifyActionsRef.current?.editPartnerCost(record)}
                    title="修改运费"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => modifyActionsRef.current?.editChain(record)}
                    title="修改合作链路"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

## 注意事项

1. **数据格式要求**：
   - `records` 中的每个记录必须包含 `partner_costs` 字段（合作方成本数组）
   - 记录必须包含 `project_id` 或 `project_name` 字段（用于查找合作链路）

2. **状态验证**：
   - 只能修改"未支付"且"未开票"的运单
   - 已申请付款或已开票的运单会被自动跳过

3. **批量修改链路限制**：
   - 所选运单必须属于同一个项目
   - 如果运单属于不同项目，会显示错误提示

4. **数据刷新**：
   - 修改完成后会自动调用 `onRefresh` 回调
   - 确保 `onRefresh` 函数会重新获取最新数据

## 类型定义

组件导出了以下类型，可以在其他文件中使用：

```typescript
import type { 
  LogisticsRecord, 
  PartnerCost,
  LogisticsRecordModifyActionsProps,
  LogisticsRecordModifyActionsRef
} from '@/components/LogisticsRecordModifyActions';
```

## 迁移指南

如果要从 `PaymentRequest.tsx` 迁移到使用公共组件：

1. 导入组件和类型
2. 创建 ref
3. 替换批量操作按钮为组件
4. 在表格操作列中调用 ref 方法
5. 移除原有的相关函数和状态（保留必要的状态如 `selectedIds`、`records` 等）


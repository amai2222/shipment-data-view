# 移动端 Select 组件错误修复说明

## 问题描述

移动端出现运行时错误：
```
Uncaught Error: A <Select.Item /> must have a value prop that is not an empty string. 
This is because the Select value can be set to an empty string to clear the selection and show the placeholder.
```

## 问题原因

在多个移动端组件中，`SelectItem` 组件使用了空字符串 `""` 作为 `value` 属性，这违反了 Radix UI Select 组件的规则。

## 修复方案

将所有 `SelectItem` 组件的空字符串 `value` 替换为 `"all"`，并更新相应的状态管理和过滤逻辑。

## 修复的文件

### 1. `src/components/mobile/MobileContractList.tsx`
- **修复内容**：
  - 将 `<SelectItem value="">全部分类</SelectItem>` 改为 `<SelectItem value="all">全部分类</SelectItem>`
  - 将 `<SelectItem value="">全部状态</SelectItem>` 改为 `<SelectItem value="all">全部状态</SelectItem>`
  - 更新初始状态：`useState('all')` 替代 `useState('')`
  - 更新搜索逻辑：将 `"all"` 转换为空字符串进行过滤

### 2. `src/pages/mobile/MobileBusinessEntry.tsx`
- **修复内容**：
  - 将项目筛选和状态筛选的 `SelectItem` 空字符串改为 `"all"`
  - 更新初始状态：`useState('all')`
  - 更新过滤逻辑：`filterProject !== 'all'` 和 `filterStatus !== 'all'`

### 3. `src/pages/mobile/MobileAuditLogs.tsx`
- **修复内容**：
  - 将所有筛选器的 `SelectItem` 空字符串改为 `"all"`
  - 更新 Select 组件的 value 和 onValueChange 逻辑
  - 将 `"all"` 转换为 `undefined` 进行过滤

### 4. `src/components/mobile/MobileSearchBar.tsx`
- **修复内容**：
  - 将通用筛选器的 `SelectItem` 空字符串改为 `"all"`
  - 更新 value 和 onValueChange 逻辑

## 修复逻辑

### 状态管理
```typescript
// 修复前
const [filter, setFilter] = useState('');

// 修复后
const [filter, setFilter] = useState('all');
```

### Select 组件
```typescript
// 修复前
<SelectItem value="">全部</SelectItem>

// 修复后
<SelectItem value="all">全部</SelectItem>
```

### 过滤逻辑
```typescript
// 修复前
if (filter) {
  // 过滤逻辑
}

// 修复后
if (filter && filter !== 'all') {
  // 过滤逻辑
}
```

### 值转换
```typescript
// 修复前
onValueChange={(value) => setFilter(value)}

// 修复后
onValueChange={(value) => setFilter(value === 'all' ? '' : value)}
```

## 验证方法

1. **检查移动端页面**：
   - 合同管理页面 (`/m/contracts`)
   - 业务录入页面 (`/m/business-entry`)
   - 审计日志页面 (`/m/audit-logs`)

2. **测试筛选功能**：
   - 选择"全部"选项应该显示所有数据
   - 选择具体选项应该正确过滤数据
   - 不再出现 Select 组件错误

## 预防措施

1. **代码规范**：避免在 `SelectItem` 中使用空字符串作为 `value`
2. **类型检查**：使用 TypeScript 严格模式检查
3. **组件测试**：为 Select 组件编写单元测试

## 相关组件

- Radix UI Select 组件
- React Hook Form (如果使用)
- 自定义 Select 组件封装

修复完成后，移动端的所有 Select 组件应该能够正常工作，不再出现空字符串 value 的错误。

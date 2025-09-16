# 可复用分页组件使用指南

## 概述

`ReusablePagination` 是一个基于运单管理页面分页功能开发的可复用分页组件，支持多种配置和显示模式。

## 组件类型

### 1. ReusablePagination (完整版本)
- **功能最全**：包含每页显示数量选择器、分页导航、总数信息
- **适用场景**：数据表格、列表页面
- **特点**：功能完整，用户体验最佳

### 2. SimplePagination (简化版本)
- **功能适中**：只包含分页导航和页面输入
- **适用场景**：空间有限的页面
- **特点**：简洁明了，占用空间小

### 3. CompactPagination (紧凑版本)
- **功能最少**：只显示基本信息和上下页按钮
- **适用场景**：移动端、弹窗、侧边栏
- **特点**：最紧凑，适合空间受限的场景

## 使用方法

### 1. 导入组件

```typescript
import { 
  ReusablePagination, 
  SimplePagination, 
  CompactPagination, 
  PaginationState 
} from '@/components/ui/ReusablePagination';
```

### 2. 定义分页状态

```typescript
const [pagination, setPagination] = useState<PaginationState>({
  currentPage: 1,
  pageSize: 20,
  totalCount: 1000,
  totalPages: 50
});
```

### 3. 实现分页处理函数

```typescript
const handlePageChange = (page: number) => {
  setPagination(prev => ({ ...prev, currentPage: page }));
  // 触发数据重新加载
  loadData(page, pagination.pageSize);
};

const handlePageSizeChange = (pageSize: number) => {
  const totalPages = Math.ceil(pagination.totalCount / pageSize);
  setPagination(prev => ({
    ...prev,
    pageSize,
    totalPages,
    currentPage: Math.min(prev.currentPage, totalPages)
  }));
  // 触发数据重新加载
  loadData(1, pageSize);
};
```

### 4. 使用组件

```tsx
<ReusablePagination
  pagination={pagination}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
  pageSizeOptions={[10, 20, 50, 100]}
  showPageSizeSelector={true}
  showPageInput={true}
  showTotalInfo={true}
/>
```

## 配置选项

### ReusablePagination Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pagination` | `PaginationState` | - | 分页状态对象 |
| `onPageChange` | `(page: number) => void` | - | 页面变化回调 |
| `onPageSizeChange` | `(pageSize: number) => void` | - | 每页数量变化回调 |
| `pageSizeOptions` | `number[]` | `[10, 20, 50, 100]` | 每页显示数量选项 |
| `showPageSizeSelector` | `boolean` | `true` | 是否显示每页数量选择器 |
| `showPageInput` | `boolean` | `true` | 是否显示页面输入框 |
| `showTotalInfo` | `boolean` | `true` | 是否显示总数信息 |
| `className` | `string` | `''` | 自定义CSS类名 |

### PaginationState 接口

```typescript
interface PaginationState {
  currentPage: number;    // 当前页码
  pageSize: number;      // 每页显示数量
  totalCount: number;    // 总记录数
  totalPages: number;    // 总页数
}
```

## 使用场景示例

### 1. 数据表格页面

```tsx
// 运单管理页面
<ReusablePagination
  pagination={pagination}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
  pageSizeOptions={[10, 20, 50, 100]}
  showPageSizeSelector={true}
  showPageInput={true}
  showTotalInfo={true}
/>
```

### 2. 日志页面

```tsx
// 审计日志页面
<SimplePagination
  pagination={pagination}
  onPageChange={handlePageChange}
/>
```

### 3. 移动端页面

```tsx
// 移动端列表页面
<CompactPagination
  pagination={pagination}
  onPageChange={handlePageChange}
/>
```

### 4. 弹窗中的列表

```tsx
// 弹窗中的分页
<ReusablePagination
  pagination={pagination}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
  pageSizeOptions={[5, 10, 20]}
  showPageSizeSelector={false}
  showPageInput={true}
  showTotalInfo={false}
/>
```

## 最佳实践

### 1. 状态管理
- 使用 `useState` 管理分页状态
- 在数据加载时更新 `totalCount` 和 `totalPages`
- 页面变化时重置到第一页

### 2. 性能优化
- 使用 `useCallback` 包装分页处理函数
- 避免不必要的重新渲染
- 合理设置 `pageSizeOptions`

### 3. 用户体验
- 根据页面类型选择合适的组件版本
- 提供合理的默认每页显示数量
- 在数据加载时显示加载状态

### 4. 响应式设计
- 在移动端使用 `CompactPagination`
- 在桌面端使用 `ReusablePagination`
- 根据屏幕尺寸动态调整显示内容

## 迁移指南

### 从现有分页迁移

1. **替换现有分页组件**：
   ```tsx
   // 原来的分页代码
   <div className="flex items-center justify-end space-x-2 py-4">
     <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1}>上一页</Button>
     <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.totalPages}>下一页</Button>
   </div>
   
   // 替换为
   <SimplePagination
     pagination={pagination}
     onPageChange={handlePageChange}
   />
   ```

2. **更新分页状态结构**：
   ```typescript
   // 确保分页状态包含所有必要字段
   const [pagination, setPagination] = useState<PaginationState>({
     currentPage: 1,
     pageSize: 20,
     totalCount: 0,
     totalPages: 0
   });
   ```

3. **实现分页处理函数**：
   ```typescript
   const handlePageChange = (page: number) => {
     setPagination(prev => ({ ...prev, currentPage: page }));
     // 触发数据重新加载
   };
   ```

## 注意事项

1. **数据同步**：确保分页状态与后端数据同步
2. **边界处理**：处理页码超出范围的情况
3. **加载状态**：在数据加载时禁用分页按钮
4. **错误处理**：处理分页操作失败的情况

## 总结

`ReusablePagination` 组件提供了灵活、可配置的分页解决方案，适用于各种场景。通过选择合适的组件版本和配置选项，可以满足不同页面的分页需求，提升用户体验和开发效率。

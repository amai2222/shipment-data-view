# 项目看板性能优化方案

## 🎯 优化目标
- 减少数据重复加载 60-80%
- 提升图表渲染性能 40-60%  
- 优化移动端滚动体验
- 减少组件重新渲染 50-70%

## 📋 具体优化措施

### 1. **创建看板数据服务** 🚀 高优先级
**文件**: `src/services/DashboardDataService.ts`
- 统一管理所有看板数据请求
- 实现数据缓存和共享
- 避免重复的 RPC 调用

### 2. **优化 useEffect 依赖** 🔧 高优先级
**文件**: 所有看板组件
- 移除 `toast` 从依赖数组
- 使用 `useRef` 存储 toast 函数
- 优化数据加载时机

### 3. **图表组件优化** 📈 中优先级
**文件**: `src/components/optimized/OptimizedCharts.tsx`
- 使用 `React.memo` 包装图表组件
- 实现图表数据缓存
- 优化图表重渲染逻辑

### 4. **移动端虚拟滚动优化** 📱 中优先级
**文件**: `src/components/mobile/OptimizedDriverList.tsx`
- 优化列表高度计算
- 实现动态行高
- 添加滚动性能监控

### 5. **数据计算优化** 🔄 中优先级
**文件**: 所有看板组件
- 优化 `useMemo` 依赖项
- 实现计算结果缓存
- 减少不必要的计算

## 🛠️ 实施步骤

### 步骤 1: 创建统一数据服务
```typescript
// src/services/DashboardDataService.ts
export class DashboardDataService {
  private static cache = new Map();
  
  static async getProjectDashboardData(projectId: string, reportDate: string) {
    const cacheKey = `project-${projectId}-${reportDate}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const { data, error } = await supabase.rpc('get_project_dashboard_data', {
      p_selected_project_id: projectId,
      p_report_date: reportDate
    });
    
    if (!error) {
      this.cache.set(cacheKey, data);
    }
    
    return { data, error };
  }
}
```

### 步骤 2: 优化组件依赖
```typescript
// 优化前
useEffect(() => {
  fetchData();
}, [projectId, reportDate, toast]); // ❌ toast 导致重复加载

// 优化后  
const toastRef = useRef(toast);
useEffect(() => {
  fetchData();
}, [projectId, reportDate]); // ✅ 移除 toast 依赖
```

### 步骤 3: 图表组件优化
```typescript
// src/components/optimized/OptimizedLineChart.tsx
const OptimizedLineChart = React.memo(({ data, ...props }) => {
  const memoizedData = useMemo(() => data, [JSON.stringify(data)]);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={memoizedData} {...props}>
        {/* 图表配置 */}
      </LineChart>
    </ResponsiveContainer>
  );
});
```

### 步骤 4: 移动端列表优化
```typescript
// src/components/mobile/OptimizedDriverList.tsx
const OptimizedDriverList = ({ drivers, unitConfig }) => {
  const itemSize = useMemo(() => {
    // 动态计算行高
    return unitConfig.billingTypeId === 2 ? 80 : 100;
  }, [unitConfig.billingTypeId]);
  
  const memoizedDrivers = useMemo(() => drivers, [drivers.length]);
  
  return (
    <List
      height={Math.min(400, memoizedDrivers.length * itemSize)}
      itemCount={memoizedDrivers.length}
      itemSize={itemSize}
      itemData={{ drivers: memoizedDrivers, unitConfig }}
    >
      {DriverRow}
    </List>
  );
};
```

## 📊 预期性能提升

### 数据加载
- **重复请求减少**: 60-80%
- **缓存命中率**: 70-90%
- **网络请求时间**: 减少 40-60%

### 渲染性能
- **组件重新渲染**: 减少 50-70%
- **图表渲染时间**: 减少 40-60%
- **内存使用**: 减少 30-50%

### 用户体验
- **页面加载速度**: 提升 40-60%
- **图表交互流畅度**: 提升 50-70%
- **移动端滚动**: 提升 60-80%

## 🔧 实施优先级

1. **立即实施** (高优先级)
   - 创建 DashboardDataService
   - 修复 useEffect 依赖问题

2. **短期实施** (中优先级)
   - 优化图表组件
   - 移动端列表优化

3. **长期优化** (低优先级)
   - 实现智能缓存策略
   - 添加性能监控

## ⚠️ 注意事项

1. **保持实时性**: 确保数据变更时缓存能正确失效
2. **内存管理**: 定期清理过期缓存
3. **错误处理**: 缓存失败时的降级策略
4. **测试覆盖**: 确保优化不影响功能正确性

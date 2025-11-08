# PC端内部车队管理系统硬编码检查报告

**检查时间：** 2025-11-08  
**检查范围：** src/pages/internal/  
**状态：** ⚠️ 发现多处硬编码

---

## 🔍 检查结果总览

| 文件 | 问题 | 严重程度 | 修复建议 |
|------|------|----------|----------|
| VehicleLedger.tsx | 硬编码mockData | 🔴 高 | 需要查询真实数据 |
| VehicleBalance.tsx | 硬编码金额计算 | 🔴 高 | 需要查询真实数据 |
| FinancialReports.tsx | 硬编码统计数据 | 🔴 高 | 需要查询真实数据 |
| IncomeInput.tsx | 空函数未实现 | 🟡 中 | 需要实现保存逻辑 |
| FleetManagerConfig.tsx | 功能未实现 | 🟡 中 | 需要实现收藏功能 |
| ExpenseCategories.tsx | ✅ 正常 | 🟢 低 | 无需修复 |
| ExpenseApproval.tsx | ✅ 正常 | 🟢 低 | 已查询真实数据 |

**总计：** 7 个文件  
**需要修复：** 5 个  
**正常运行：** 2 个

---

## 🔴 严重问题 - 需要立即修复

### 1️⃣ VehicleLedger.tsx - 车辆收支流水

**问题：** 使用硬编码的模拟数据

**当前代码：**
```typescript
const loadLedger = async () => {
  setLoading(true);
  try {
    const mockData: LedgerRecord[] = [
      { id: '1', vehicle_id: '1', vehicle_plate: '云F97310', date: '2025-11-05', type: 'income', category: '运费收入', amount: 2000, description: '天兴芦花项目运费', month: '2025-11' },
      { id: '2', vehicle_id: '1', vehicle_plate: '云F97310', date: '2025-11-03', type: 'expense', category: '加油费', amount: 551, description: '2月份公司加油', month: '2025-11' },
      { id: '3', vehicle_id: '1', vehicle_plate: '云F97310', date: '2025-11-01', type: 'income', category: '运费收入', amount: 1800, description: '铁路配送项目', month: '2025-11' }
    ];
    setRecords(mockData);
  } finally {
    setLoading(false);
  }
};
```

**建议修复：**
```typescript
const loadLedger = async () => {
  setLoading(true);
  try {
    // ✅ 查询真实的收支流水
    // 1. 查询运费收入（从logistics_records）
    const { data: incomeData } = await supabase
      .from('logistics_records')
      .select('id, auto_number, loading_date, payable_cost, project_name')
      .gte('loading_date', startDate)
      .lte('loading_date', endDate);
    
    // 2. 查询费用支出（从internal_driver_expense_applications）
    const { data: expenseData } = await supabase
      .from('internal_driver_expense_applications')
      .select('id, expense_date, expense_type, amount, description')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);
    
    // 3. 合并并处理数据
    const records = [
      ...incomeData.map(item => ({
        type: 'income',
        date: item.loading_date,
        amount: item.payable_cost,
        description: item.project_name
      })),
      ...expenseData.map(item => ({
        type: 'expense',
        date: item.expense_date,
        amount: item.amount,
        description: item.description
      }))
    ];
    
    setRecords(records);
  } finally {
    setLoading(false);
  }
};
```

**影响：** 车辆收支流水页面显示假数据

---

### 2️⃣ VehicleBalance.tsx - 车辆余额

**问题：** 使用硬编码计算金额

**当前代码：**
```typescript
const balanceData: VehicleBalance[] = (vehicles || []).map((v: any, index) => ({
  vehicle_id: v.id,
  license_plate: v.license_plate,
  total_income: 20000 + index * 5000,    // ❌ 硬编码
  total_expense: 8000 + index * 2000,    // ❌ 硬编码
  balance: 12000 + index * 3000,         // ❌ 硬编码
  driver_name: v.driver?.[0]?.driver?.name || null
}));
```

**建议修复：**
```typescript
// ✅ 为每个车辆查询真实的收支数据
const balanceData: VehicleBalance[] = await Promise.all(
  (vehicles || []).map(async (v: any) => {
    // 查询该车辆的收入
    const { data: incomeData } = await supabase
      .from('logistics_records')
      .select('payable_cost')
      .eq('license_plate', v.license_plate);
    
    const total_income = incomeData?.reduce((sum, r) => sum + (r.payable_cost || 0), 0) || 0;
    
    // 查询该车辆的支出
    const { data: expenseData } = await supabase
      .from('internal_driver_expense_applications')
      .select('amount')
      .eq('vehicle_plate', v.license_plate);
    
    const total_expense = expenseData?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
    
    return {
      vehicle_id: v.id,
      license_plate: v.license_plate,
      total_income,
      total_expense,
      balance: total_income - total_expense,
      driver_name: v.driver?.[0]?.driver?.name || null
    };
  })
);
```

**影响：** 车辆余额页面显示错误的金额

---

### 3️⃣ FinancialReports.tsx - 财务报表

**问题：** 使用硬编码的统计数据

**当前代码：**
```typescript
const [stats] = useState({
  totalIncome: 89250,      // ❌ 硬编码
  totalExpense: 32680,     // ❌ 硬编码
  netProfit: 56570,        // ❌ 硬编码
  vehicleCount: 6,         // ❌ 硬编码
  driverCount: 5,          // ❌ 硬编码
  tripCount: 45            // ❌ 硬编码
});
```

**建议修复：**
```typescript
const loadStats = async () => {
  try {
    const [year, month] = selectedMonth.split('-');
    const startDate = `${selectedMonth}-01`;
    const nextMonth = new Date(parseInt(year), parseInt(month), 1);
    const endDate = nextMonth.toISOString().slice(0, 10);
    
    // ✅ 查询总收入
    const { data: incomeData } = await supabase
      .from('logistics_records')
      .select('payable_cost')
      .gte('loading_date', startDate)
      .lt('loading_date', endDate);
    
    const totalIncome = incomeData?.reduce((sum, r) => sum + (r.payable_cost || 0), 0) || 0;
    
    // ✅ 查询总支出
    const { data: expenseData } = await supabase
      .from('internal_driver_expense_applications')
      .select('amount')
      .gte('expense_date', startDate)
      .lt('expense_date', endDate);
    
    const totalExpense = expenseData?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
    
    // ✅ 查询车辆数
    const { count: vehicleCount } = await supabase
      .from('internal_vehicles')
      .select('id', { count: 'estimated', head: true })
      .eq('is_active', true);
    
    // ✅ 查询司机数
    const { count: driverCount } = await supabase
      .from('internal_drivers')
      .select('id', { count: 'estimated', head: true });
    
    // ✅ 查询运单数
    const { count: tripCount } = await supabase
      .from('logistics_records')
      .select('id', { count: 'estimated', head: true })
      .gte('loading_date', startDate)
      .lt('loading_date', endDate);
    
    setStats({
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      vehicleCount: vehicleCount || 0,
      driverCount: driverCount || 0,
      tripCount: tripCount || 0
    });
  } catch (error) {
    console.error('加载统计失败:', error);
  }
};
```

**影响：** 财务报表显示错误的统计数据

---

## 🟡 中等问题 - 需要补充实现

### 4️⃣ IncomeInput.tsx - 月度收入录入

**问题：** 提交函数为空，只显示toast

**当前代码：**
```typescript
const handleSubmit = async () => {
  toast({ title: '保存成功', description: '月度收入已录入' });
  setShowDialog(false);
};
```

**建议修复：**
```typescript
const handleSubmit = async () => {
  try {
    // ✅ 实际保存到数据库
    const { error } = await supabase
      .from('internal_vehicle_monthly_income')
      .insert({
        vehicle_id: formData.vehicle_id,
        year_month: formData.year_month,
        project_id: formData.project_id,
        income_amount: parseFloat(formData.income_amount),
        remarks: formData.remarks
      });
    
    if (error) throw error;
    
    toast({ title: '保存成功', description: '月度收入已录入' });
    setShowDialog(false);
    loadIncomeRecords(); // 刷新列表
  } catch (error: any) {
    toast({ 
      title: '保存失败', 
      description: error.message, 
      variant: 'destructive' 
    });
  }
};
```

**影响：** 无法保存月度收入数据

---

### 5️⃣ FleetManagerConfig.tsx - 车队长配置

**问题：** 功能未实现

**当前代码：**
```typescript
// ❌ TODO标记
is_favorite: false  // TODO: 从fleet_manager_locations表查询
// TODO: 从fleet_manager_routes表加载
// TODO: 实现收藏/取消收藏地点
```

**建议：**
这是一个可选功能，优先级较低。如果需要实现：
1. 创建 `fleet_manager_locations` 表
2. 创建 `fleet_manager_routes` 表
3. 实现收藏/取消收藏逻辑

**影响：** 收藏功能不可用

---

## 🟢 正常页面

### 6️⃣ ExpenseCategories.tsx - 费用分类统计

**状态：** ✅ 正常

**查询方式：**
```typescript
const { data, error } = await supabase
  .from('internal_driver_expense_applications')
  .select('expense_type, amount')
  .gte('expense_date', startDate)
  .lt('expense_date', endDate);
```

**功能：** 正确查询费用数据并按类别统计

---

### 7️⃣ ExpenseApproval.tsx - 费用申请审核

**状态：** ✅ 正常（已在移动端检查时修复）

**查询方式：**
```typescript
let query = supabase
  .from('internal_driver_expense_applications')
  .select('*')
  .order('created_at', { ascending: false });

if (activeTab === 'pending') {
  query = query.eq('status', 'pending');  // ✅ 已修复为小写
}
```

---

## 📊 数据表依赖分析

### 需要查询的表

| 功能 | 数据来源 | 说明 |
|------|----------|------|
| 车辆收支流水 | logistics_records + internal_driver_expense_applications | 运费收入 + 费用支出 |
| 车辆余额 | logistics_records + internal_driver_expense_applications | 按车辆汇总 |
| 财务报表 | logistics_records + internal_driver_expense_applications | 月度统计 |
| 月度收入 | 需要新表 | internal_vehicle_monthly_income |
| 费用分类 | internal_driver_expense_applications | 按类型统计 |

### 可能缺失的表

```sql
-- 月度收入表（如果需要单独录入）
CREATE TABLE IF NOT EXISTS internal_vehicle_monthly_income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES internal_vehicles(id),
    year_month TEXT NOT NULL,  -- YYYY-MM
    project_id UUID REFERENCES projects(id),
    income_amount NUMERIC(10,2) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎯 修复优先级

### P0 - 立即修复（影响数据准确性）

1. **VehicleLedger.tsx** - 车辆收支流水
2. **VehicleBalance.tsx** - 车辆余额
3. **FinancialReports.tsx** - 财务报表

### P1 - 尽快修复（影响功能完整性）

4. **IncomeInput.tsx** - 月度收入录入

### P2 - 可选功能（优先级较低）

5. **FleetManagerConfig.tsx** - 车队长配置

---

## 📝 修复建议

### 方案一：统一数据源（推荐）

所有财务数据统一从以下来源获取：
- **收入：** `logistics_records.payable_cost`
- **支出：** `internal_driver_expense_applications.amount`

优点：
- ✅ 数据源单一，避免不一致
- ✅ 无需额外维护
- ✅ 实时统计

### 方案二：预计算表

创建月度汇总表，定期计算：
- `internal_vehicle_monthly_summary`

优点：
- ✅ 查询速度快
- ✅ 历史数据稳定

缺点：
- ❌ 需要定时任务
- ❌ 数据可能有延迟

---

## ✅ 测试清单

修复后需要测试：

- [ ] 车辆收支流水显示真实数据
- [ ] 车辆余额计算正确
- [ ] 财务报表统计准确
- [ ] 月度收入可以保存
- [ ] 费用分类统计正确
- [ ] 数据时间范围筛选正常

---

## 🎉 总结

**检查文件：** 7 个  
**发现问题：** 5 个  
**严重问题：** 3 个  
**中等问题：** 2 个

**建议：** 优先修复 VehicleLedger、VehicleBalance、FinancialReports 三个严重问题，这些直接影响数据准确性。

---

**最后更新：** 2025-11-08  
**状态：** ⚠️ 待修复


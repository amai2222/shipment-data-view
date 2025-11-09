# Supabase Realtime 实时订阅配置说明

**问题：** 司机端审核通过后，数据没有自动更新  
**原因：** Realtime 订阅可能未启用或配置不正确  
**解决：** 检查并配置 Supabase Realtime

---

## 🔍 检查 Realtime 是否启用

### 在 Supabase Dashboard 检查

1. **登录** Supabase Dashboard
2. **进入项目** 
3. **左侧菜单** → Database → Publications
4. **查看表** `internal_driver_expense_applications` 和 `dispatch_orders`
5. **确认 Realtime 已启用**

### 通过 SQL 查询验证

```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('internal_driver_expense_applications', 'dispatch_orders')
ORDER BY tablename;
```

**应该看到2条记录：**
- ✅ `internal_driver_expense_applications` - Realtime已启用
- ✅ `dispatch_orders` - Realtime已启用

---

## ✅ 启用 Realtime（如果未启用）

### 方法1：通过 Dashboard

1. Database → Replication
2. 找到 `internal_driver_expense_applications` 表
3. 点击表旁边的开关
4. 启用 Realtime

---

### 方法2：执行 SQL

```sql
-- 启用费用申请表的 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE internal_driver_expense_applications;

-- 启用派单表的 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_orders;

-- 验证是否启用
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

---

## 🧪 测试 Realtime 是否工作

### 在浏览器控制台（F12）查看

**应该看到：**
```javascript
📢 费用申请数据变更: {eventType: 'UPDATE', ...}
✅ 状态变更: pending → approved
🔄 正在刷新费用申请列表...
```

**如果没看到：**
- ❌ Realtime 未启用
- ❌ 或网络连接问题
- ❌ 或订阅建立失败

---

## 🔧 调试步骤

### 1. 检查订阅是否建立

```javascript
// 在浏览器控制台查看
window.supabase.getChannels()
// 应该看到订阅频道列表
```

### 2. 手动触发更新测试

**在 SQL Editor 执行：**
```sql
-- 手动更新一条费用申请状态
UPDATE internal_driver_expense_applications
SET status = 'approved',
    updated_at = NOW()
WHERE id = (
    SELECT id FROM internal_driver_expense_applications 
    WHERE status = 'pending' 
    LIMIT 1
);
```

**观察司机端是否：**
- 弹出 Toast 通知
- 列表自动刷新
- 统计数字更新

---

## 💡 临时解决方案（如果 Realtime 有问题）

### 添加定时刷新

```typescript
useEffect(() => {
  // 每30秒自动刷新一次
  const interval = setInterval(() => {
    loadApplications();
    loadPendingDispatches();
  }, 30000);
  
  return () => clearInterval(interval);
}, []);
```

---

## 🎯 确认清单

### Realtime 订阅需要满足的条件

- [ ] Realtime 在项目中已启用（Project Settings → API）
- [ ] 表已添加到 supabase_realtime publication
- [ ] RLS 策略允许订阅（SELECT 权限）
- [ ] 网络连接正常
- [ ] 司机端页面已打开

---

## 📝 推荐配置

### 启用所有相关表的 Realtime

```sql
-- 费用申请表
ALTER PUBLICATION supabase_realtime ADD TABLE internal_driver_expense_applications;

-- 派单表
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_orders;

-- 工资表（如果需要）
ALTER PUBLICATION supabase_realtime ADD TABLE internal_driver_monthly_salary;
```

---

## ✅ 测试流程

1. **司机登录** → 进入工作台
2. **打开控制台** → 按 F12
3. **观察日志** → 应该看到订阅建立成功
4. **车队长审核** → 审核一条费用
5. **观察司机端** → 应该：
   - 控制台显示变更日志
   - 弹出审核通过通知
   - 列表自动刷新
   - 统计数字更新

---

**最后更新：** 2025-11-09  
**状态：** ✅ 两个关键表已启用 Realtime  
**配置完成：** ✅ `internal_driver_expense_applications` 和 `dispatch_orders` 已启用实时订阅


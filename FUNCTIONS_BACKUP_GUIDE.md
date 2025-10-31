# 数据库函数备份指南

## 🔍 备份现有函数

### 在Supabase SQL Editor执行：

**文件**：`scripts/BACKUP_PAYMENT_FUNCTIONS.sql`

**或执行这个查询**：

```sql
-- 查看所有付款相关函数
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname IN (
  'approve_payment_request',
  'pay_payment_request',
  'set_payment_status_for_waybills',
  'process_payment_application'
)
ORDER BY proname;
```

---

## 📋 执行结果

### 如果函数已存在

**查询会返回函数的完整定义**

**请**：
1. 复制查询结果
2. 保存到一个文件（如 `backup_functions_20251031.sql`）
3. 告诉我哪些函数已存在

### 如果函数不存在

**查询返回空**

**说明**：
- 这些函数还没有创建
- 可以直接执行`ADD_APPROVED_STATUS.sql`
- 不会覆盖任何现有函数

---

## 🎯 我将创建/修改的函数

### 新建函数
1. **approve_payment_request** - 单个审批（更新运单+申请单）
2. **batch_approve_payment_requests** - 批量审批
3. **pay_payment_request** - 单个付款（更新运单+申请单）
4. **batch_pay_payment_requests** - 批量付款

### 保持不变的函数
1. **process_payment_application** - 创建付款申请（不修改）
2. **set_payment_status_for_waybills** - 旧的付款函数（可能替换）

---

## 🚀 下一步

**执行查询后告诉我**：
1. 哪些函数已存在？
2. 是否要继续执行`ADD_APPROVED_STATUS.sql`？

---

**立即执行 `scripts/BACKUP_PAYMENT_FUNCTIONS.sql` 查询！** 📋


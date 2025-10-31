# 修复约束错误

## 错误原因

**错误信息**：`violates check constraint "payment_status_check"`

**原因**：
- logistics_records表有check约束限制payment_status的值
- 旧约束只允许：Unpaid, Processing, Paid
- 不包含新增的：Approved

---

## 🚀 立即修复

### 在Supabase执行：

```sql
BEGIN;

-- 删除旧约束
ALTER TABLE logistics_records 
DROP CONSTRAINT IF EXISTS payment_status_check;

ALTER TABLE logistics_records 
DROP CONSTRAINT IF EXISTS logistics_records_payment_status_check;

-- 创建新约束（包含Approved）
ALTER TABLE logistics_records
ADD CONSTRAINT payment_status_check 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Approved', 'Paid'));

-- 同样修改logistics_partner_costs表
ALTER TABLE logistics_partner_costs 
DROP CONSTRAINT IF EXISTS payment_status_check;

ALTER TABLE logistics_partner_costs
ADD CONSTRAINT payment_status_check 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Approved', 'Paid'));

COMMIT;
```

---

## 执行后

**刷新页面**，再次点击"审批"按钮

应该能成功了！

---

**立即执行这个SQL！** 🚀

**文件**：`scripts/FIX_PAYMENT_STATUS_CONSTRAINT.sql`


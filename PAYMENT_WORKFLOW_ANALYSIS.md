# 付款流程问题分析

## 当前实现

### 步骤1：创建付款申请 ✅
**函数**：`process_payment_application`（第183-187行）
```sql
UPDATE public.logistics_records
SET payment_status = 'Processing'  -- ✅ 正确：已申请支付
WHERE id = ANY(p_record_ids)
  AND payment_status = 'Unpaid';
```
- **运单状态**：Unpaid → Processing（已申请支付）✅
- **申请单状态**：Pending（待审核）✅

### 步骤2：审核付款申请 ❌ 有问题！
**函数**：`handleApproval`（PaymentAudit.tsx 第877-901行）
```typescript
// 只更新申请单状态
const { error } = await supabase
  .from('payment_requests')
  .update({ status: 'Approved' })
  .eq('id', req.id);
```
- **运单状态**：❌ 没有更新！应该改为"支付审核通过"
- **申请单状态**：Pending → Approved（待支付）✅

### 步骤3：执行付款 ❌ 有问题！
**位置**：PaymentRequestsList.tsx
**问题**：没有找到付款函数，需要检查

---

## 🎯 需要修复的问题

1. **审核时**：需要更新运单状态为"支付审核通过"
2. **付款时**：需要更新运单状态为"已支付"

---

## 运单的payment_status值

需要确认数据库中的枚举值：
- `Unpaid` = 未支付
- `Processing` = 已申请支付
- `???` = 支付审核通过（需要确认）
- `Paid` = 已支付

让我查找payment_status的所有可能值...


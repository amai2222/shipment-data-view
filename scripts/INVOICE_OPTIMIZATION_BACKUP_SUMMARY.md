# 📦 开票流程优化备份总结

## 📅 备份时间
2025-10-31

## 🎯 备份目的
在执行开票流程优化前，完整备份所有即将修改的函数和配置，确保可以快速恢复。

---

## 📁 备份文件清单

### 1. SQL函数备份
**文件**：`scripts/BACKUP_INVOICE_FUNCTIONS_BEFORE_OPTIMIZATION.sql`

**包含内容**：
- ✅ get_invoice_request_data
- ✅ get_filtered_uninvoiced_partner_cost_ids
- ✅ get_invoice_request_data_v2
- ✅ save_invoice_request
- ✅ approve_invoice_request（旧版 - 不更新运单状态）
- ✅ complete_invoice_request（旧版 - 使用Invoiced状态）
- ✅ delete_invoice_request

---

## 🔍 将要修改的内容

### 1. 数据库约束变更

#### logistics_records.invoice_status
```sql
-- 旧约束
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'))

-- 新约束（添加Approved状态）
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Approved', 'Invoiced'))
                                                        ↑ 新增
```

#### logistics_partner_costs.invoice_status
```sql
-- 旧约束
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'))

-- 新约束（添加Approved状态）
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Approved', 'Invoiced'))
                                                        ↑ 新增
```

### 2. 函数变更对照

#### approve_invoice_request
```sql
-- 旧版本
- 只更新申请单状态
- 不更新运单状态
- 支持reject操作（Rejected状态）

-- 新版本 (approve_invoice_request_v2)
- 同时更新申请单状态
- 同时更新运单状态 Processing -> Approved  ← 新增
- 不支持reject操作（移除Rejected状态）
```

#### complete_invoice_request
```sql
-- 旧版本
- 申请单状态更新为 'Invoiced'
- 不更新运单状态
- 只更新合作方成本状态

-- 新版本 (complete_invoice_request_v2)
- 申请单状态更新为 'Completed'  ← 修改
- 同时更新运单状态 Approved -> Invoiced  ← 新增
- 更新合作方成本状态
```

### 3. 新增函数

#### 批量操作函数（之前不存在）
- ✅ batch_approve_invoice_requests - 批量审批
- ✅ batch_complete_invoice_requests - 批量开票
- ✅ batch_cancel_invoice_requests - 批量取消开票

#### 取消操作函数（之前不存在）
- ✅ cancel_invoice_request - 取消开票

### 4. 状态配置变更

#### StatusBadge.tsx
```typescript
// 旧配置
export const INVOICE_REQUEST_STATUS_CONFIG = {
  Pending: { label: '待审核', variant: 'secondary' },
  Approved: { label: '已审批', variant: 'default' },
  Completed: { label: '已完成', variant: 'outline' },
  Rejected: { label: '已驳回', variant: 'destructive' },  // ⚠️ 将被移除
  Voided: { label: '已作废', variant: 'destructive' },    // ⚠️ 将被移除
};

// 新配置
export const INVOICE_REQUEST_STATUS_CONFIG = {
  Pending: { label: '待审核', variant: 'secondary' },
  Approved: { label: '已审批待开票', variant: 'default' },  // ✅ 修改名称
  Completed: { label: '已开票', variant: 'outline',          // ✅ 修改名称
    className: 'border-green-600 text-white bg-green-600 hover:bg-green-700' },  // ✅ 绿底白字
  // ❌ 已移除：Rejected、Voided
};
```

---

## 🔄 状态流转对比

### 运单状态（invoice_status）

#### 旧流程（2个中间状态）
```
Uninvoiced → Processing → Invoiced
未开票      已申请开票    已开票
```

**问题**：审批后没有中间状态标记，直接跳到Invoiced

#### 新流程（3个中间状态）
```
Uninvoiced → Processing → Approved → Invoiced
未开票      已申请开票    开票审核通过  已开票
                             ↑ 新增
```

**改进**：审批和开票分离，状态更清晰

### 申请单状态（status）

#### 旧流程
```
Pending → Approved → Invoiced
待审核    已审批      已开票

支持状态：Rejected（已拒绝）、Voided（已作废）
```

#### 新流程
```
Pending → Approved → Completed
待审核    已审批待开票  已开票

移除状态：Rejected、Voided
```

---

## 🔧 恢复方法

### 方法1：恢复SQL函数
```bash
# 1. 在Supabase SQL编辑器打开备份文件
scripts/BACKUP_INVOICE_FUNCTIONS_BEFORE_OPTIMIZATION.sql

# 2. 复制全部内容并执行

# 3. 验证函数已恢复
SELECT proname FROM pg_proc 
WHERE proname LIKE '%invoice%' 
ORDER BY proname;
```

### 方法2：回滚前端代码
```bash
# 使用Git回滚到优化前的版本
git log --oneline  # 找到优化前的commit
git checkout <commit-hash> -- src/components/common/StatusBadge.tsx
git checkout <commit-hash> -- src/pages/InvoiceAudit.tsx
git checkout <commit-hash> -- src/pages/InvoiceRequestManagement.tsx
```

### 方法3：手动回滚状态约束
```sql
-- 恢复logistics_records约束（移除Approved）
ALTER TABLE public.logistics_records 
DROP CONSTRAINT IF EXISTS ck_logistics_records_invoice_status;

ALTER TABLE public.logistics_records 
ADD CONSTRAINT ck_logistics_records_invoice_status 
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));
-- 不包含Approved

-- 恢复logistics_partner_costs约束
ALTER TABLE public.logistics_partner_costs 
DROP CONSTRAINT IF EXISTS ck_logistics_partner_costs_invoice_status;

ALTER TABLE public.logistics_partner_costs 
ADD CONSTRAINT ck_logistics_partner_costs_invoice_status 
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));
-- 不包含Approved
```

---

## ⚠️ 重要提醒

### 优化前检查清单
- [ ] 确认已完整阅读优化方案
- [ ] 确认团队成员知晓即将进行的更改
- [ ] 确认生产环境没有正在处理的开票申请
- [ ] 确认已在测试环境验证过优化方案
- [ ] 确认备份文件已创建并可访问

### 优化后验证清单
- [ ] 检查所有新函数是否正常工作
- [ ] 检查状态约束是否更新成功
- [ ] 测试完整的开票流程
- [ ] 验证取消操作是否正常
- [ ] 检查前端界面显示是否正确
- [ ] 确认无linter错误

### 回滚场景
如果优化后出现以下情况，建议立即回滚：
- ❌ 无法创建开票申请
- ❌ 审批操作报错
- ❌ 开票操作失败
- ❌ 状态显示异常
- ❌ 批量操作不工作

---

## 📊 数据影响评估

### 现有数据兼容性

| 数据类型 | 旧状态 | 优化后 | 兼容性 |
|---------|--------|--------|--------|
| 未开票运单 | Uninvoiced | Uninvoiced | ✅ 完全兼容 |
| 已申请开票运单 | Processing | Processing | ✅ 完全兼容 |
| 已开票运单 | Invoiced | Invoiced | ✅ 完全兼容 |
| 待审核申请单 | Pending | Pending | ✅ 完全兼容 |
| 已审批申请单 | Approved | Approved | ✅ 完全兼容 |
| 已开票申请单 | Invoiced | Completed | ⚠️ 需迁移 |

### 需要数据迁移的内容

```sql
-- 如果有申请单状态为Invoiced，需要更新为Completed
UPDATE invoice_requests 
SET status = 'Completed' 
WHERE status = 'Invoiced';

-- 检查是否有需要迁移的数据
SELECT COUNT(*) as invoiced_requests_count
FROM invoice_requests 
WHERE status = 'Invoiced';
```

---

## 📞 联系信息

**备份创建者**：AI Assistant  
**备份日期**：2025-10-31  
**优化方案文档**：`docs/payment-management/开票流程优化部署指南.md`  
**恢复指南**：本文档"恢复方法"部分

---

## ✅ 备份验证

备份完成后，请验证：
- [x] SQL备份文件已创建
- [x] 文档说明完整
- [x] 恢复步骤清晰
- [x] 差异对照明确

**备份已完成，可以安全进行优化！** 🎉


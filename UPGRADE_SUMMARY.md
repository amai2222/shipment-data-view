# 开票/付款申请作废功能升级总结

## 📋 升级概述

为4个页面（开票审核、付款审核、财务开票、财务付款）添加了**一键回滚**和升级了**一键作废**功能。

## 🎯 功能说明

### 1. 一键回滚（新增）

**功能分为两种类型：**

#### A. 审核页面（开票审核、付款审核）
- **功能**：作废申请单，回滚运单状态
- **操作**：
  - 申请单状态标记为"已作废"（Voided）或"已取消"（Cancelled）
  - 运单状态回滚为"未开票"或"未支付"
  - 合作方成本状态同步回滚
- **特点**：保留记录、可追溯

#### B. 财务页面（财务开票、财务付款）
- **功能**：回滚申请单状态到待审核/待审批
- **操作**：
  - 申请单状态回滚到"待审核"（Pending）或"待审批"（Pending）
  - **不影响运单状态**（运单已经审核通过，保持现状）
- **特点**：撤销审批、重新审核

**二次确认**：✅ 已添加

### 2. 一键作废（升级）
- **功能**：永久删除申请单记录，同时回滚运单状态
- **操作**：
  - 删除申请单记录（`invoice_requests` 或 `payment_requests`）
  - 删除申请单明细记录
  - 运单状态回滚为"未开票"或"未支付"
  - 合作方成本状态同步回滚
- **特点**：不可逆、彻底清理
- **二次确认**：✅ 已添加（带警告提示）

## 📂 升级的文件

### 数据库迁移文件

1. **`20251028_create_void_and_delete_functions.sql`**
   - 创建 `void_and_delete_invoice_requests` 函数（删除记录版）
   - 创建 `void_and_delete_payment_requests` 函数（删除记录版）

2. **`20251028_restore_logistics_records_invoice_status.sql`**
   - 恢复 `logistics_records.invoice_status` 字段
   - 修复 `void_invoice_request` 函数

3. **`20251028_fix_invoice_request_id_foreign_key.sql`**
   - 修复外键约束，添加 `ON DELETE SET NULL`

4. **`20251028_cleanup_applied_at_fields.sql`**
   - 清理无效的申请时间字段

5. **`20251028_fix_invoice_request_filtered_add_partner_full_name.sql`**
   - 修复查询函数，添加 `partner_full_name` 字段

### 前端页面文件

#### 1. **`src/pages/InvoiceAudit.tsx`** - 开票审核
   - ✅ 添加"一键回滚"按钮（作废申请单+回滚运单状态）
   - ✅ 升级"一键作废"功能（删除记录+回滚运单状态）
   - ✅ 添加PDF边框优化
   - ✅ 修复"未知合作方"问题

#### 2. **`src/pages/PaymentAudit.tsx`** - 付款审核
   - ✅ 添加"一键回滚"按钮（作废申请单+回滚运单状态）
   - ✅ 升级"一键作废"功能（删除记录+回滚运单状态）

#### 3. **`src/pages/InvoiceRequestManagement.tsx`** - 财务开票
   - ✅ 添加"一键回滚"按钮（回滚申请单到待审核，不影响运单）
   - ✅ 升级"一键作废"功能（删除记录+回滚运单状态）

#### 4. **`src/pages/PaymentRequestsList.tsx`** - 财务付款
   - ✅ 添加"一键回滚"按钮（回滚申请单到待审批，不影响运单）
   - ✅ 升级"一键作废"功能（删除记录+回滚运单状态）

## 🔧 数据库函数对比

### 开票申请

| 函数名 | 功能 | 保留记录 | 回滚状态 | 使用场景 |
|--------|------|---------|---------|---------|
| `void_invoice_request` | 作废申请单 | ✅ 是 | ✅ 是 | 一键回滚 |
| `void_and_delete_invoice_requests` | 删除申请单 | ❌ 否 | ✅ 是 | 一键作废 |

### 付款申请

| 函数名 | 功能 | 保留记录 | 回滚状态 | 使用场景 |
|--------|------|---------|---------|---------|
| `void_payment_requests_by_ids` | 作废申请单 | ✅ 是 | ✅ 是 | 一键回滚 |
| `void_and_delete_payment_requests` | 删除申请单 | ❌ 否 | ✅ 是 | 一键作废 |

## 🎨 UI 设计

### 按钮样式
- **一键回滚**：`variant="outline"` + `RotateCcw` 图标（灰色边框）
- **一键作废**：`variant="destructive"` + `Trash2` 图标（红色背景）

### 二次确认对话框

#### 审核页面（开票审核、付款审核）
- **回滚确认**：说明会作废申请单并回滚运单状态
- **作废确认**：⚠️ 警告会永久删除记录

#### 财务页面（财务开票、财务付款）
- **回滚确认**：说明会回滚申请单状态到待审核/待审批，不影响运单
- **作废确认**：⚠️ 警告会永久删除记录并回滚运单状态

## 📊 回滚的字段

### 开票申请作废时

**logistics_partner_costs 表：**
- `invoice_status` → 'Uninvoiced'
- `invoice_request_id` → NULL
- `invoice_applied_at` → NULL

**logistics_records 表：**
- `invoice_status` → 'Uninvoiced'
- `invoice_request_id` → NULL
- `invoice_applied_at` → NULL

### 付款申请作废时

**logistics_partner_costs 表：**
- `payment_status` → 'Unpaid'
- `payment_request_id` → NULL
- `payment_applied_at` → NULL

**logistics_records 表：**
- `payment_status` → 'Unpaid'
- `payment_request_id` → NULL
- `payment_applied_at` → NULL

## 🚀 使用说明

### 运行迁移
```bash
# 在 Supabase SQL Editor 中按顺序运行以下文件：
1. 20251028_fix_invoice_request_id_foreign_key.sql
2. 20251028_cleanup_applied_at_fields.sql
3. 20251028_restore_logistics_records_invoice_status.sql
4. 20251028_create_void_and_delete_functions.sql
5. 20251028_fix_invoice_request_filtered_add_partner_full_name.sql
```

### 前端使用
1. 选择需要处理的申请单（单选或全选）
2. 点击"一键回滚"或"一键作废"按钮
3. 在确认对话框中确认操作
4. 等待处理完成，查看提示信息

## ⚠️ 注意事项

1. **一键回滚**：
   - 保留申请单记录，便于审计
   - 申请单状态变为"已作废"或"已取消"
   - 可以查询历史记录

2. **一键作废**：
   - 永久删除申请单记录
   - 无法恢复，请谨慎使用
   - 适合误操作或需要彻底清理的场景

3. **权限要求**：
   - 仅管理员可以使用作废功能
   - 已付款的申请单无法作废（需先取消付款）

## ✅ 测试检查清单

- [ ] 开票审核页面 - 一键回滚按钮
- [ ] 开票审核页面 - 一键作废按钮
- [ ] 付款审核页面 - 一键回滚按钮
- [ ] 付款审核页面 - 一键作废按钮
- [ ] 财务开票页面 - 一键回滚按钮
- [ ] 财务开票页面 - 一键作废按钮
- [ ] 财务付款页面 - 一键回滚按钮
- [ ] 财务付款页面 - 一键作废按钮
- [ ] 所有按钮的二次确认对话框
- [ ] 运单状态正确回滚
- [ ] 合作方状态正确回滚
- [ ] PDF开票抬头显示正确
- [ ] PDF所有区域有边框

## 🎉 升级完成

所有功能已完整实现，无linter错误！


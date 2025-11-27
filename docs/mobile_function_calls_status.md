# 移动端函数调用状态检查报告

## 检查时间
2025-11-24

## 检查的函数列表
1. `cancel_payment_request_1126` - 取消付款申请
2. `rollback_payment_request_approval_1126` - 回滚付款审批
3. `batch_rollback_payment_approval_1126` - 批量回滚付款审批
4. `pay_payment_request_1126` - 完成单个付款申请
5. `batch_pay_payment_requests_1126` - 批量完成付款
6. `reconcile_partner_costs_batch_1126` - 批量对账合作方成本

## 检查结果

### ✅ 已更新的移动端文件

#### 1. `src/pages/mobile/MobilePaymentRequestsList.tsx`
- ✅ `rollback_payment_request_approval_1126` - 已使用（第275行）
- ✅ `void_payment_for_request_1126` - 已使用（第750行，功能类似cancel_payment_request_1126）
- ✅ `pay_payment_request_1126` - **已更新**（从 `set_payment_status_for_waybills` 改为 `pay_payment_request_1126`）

#### 2. `src/pages/mobile/MobileInvoiceRequestManagement.tsx`
- ✅ `batch_rollback_invoice_approval_1126` - 已使用（第663行，开票相关，非付款相关）

### ❌ 未使用的函数（移动端无对应功能）

#### 1. `cancel_payment_request_1126`
- **状态**: 移动端使用 `void_payment_for_request_1126`（功能类似，已集成权限系统）
- **说明**: `void_payment_for_request_1126` 和 `cancel_payment_request_1126` 功能类似，移动端保持使用 `void_payment_for_request_1126` 即可

#### 2. `batch_rollback_payment_approval_1126`
- **状态**: 移动端无批量回滚付款审批功能
- **说明**: 移动端只有单个回滚功能，使用 `rollback_payment_request_approval_1126`

#### 3. `batch_pay_payment_requests_1126`
- **状态**: 移动端无批量付款功能
- **说明**: 移动端只有单个付款功能，使用 `pay_payment_request_1126`

#### 4. `reconcile_partner_costs_batch_1126`
- **状态**: 移动端无对账功能
- **说明**: 对账功能仅在PC端 `FinanceReconciliation.tsx` 中使用

## 更新记录

### 2025-11-24
- ✅ 更新 `MobilePaymentRequestsList.tsx` 的 `handlePayment` 函数，从 `set_payment_status_for_waybills` 改为 `pay_payment_request_1126`

## 总结

所有移动端需要更新的函数调用已经完成更新。移动端与PC端的功能差异：
- 移动端：单个操作（单个付款、单个回滚）
- PC端：支持批量操作（批量付款、批量回滚）

移动端使用的函数都已更新为_1126版本，并已集成统一权限系统。


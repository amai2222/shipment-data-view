# 前端函数版本检查报告

## ✅ 已确认使用最新版本的函数

### 1. batch_recalculate_by_filter
- **最新版本**: `_1120`
- **使用位置**: 
  - `src/pages/FinanceReconciliation.tsx:737` ✅

### 2. get_all_filtered_record_ids
- **最新版本**: `_1120`
- **使用位置**:
  - `src/pages/BusinessEntry/hooks/useAllFilteredRecords.ts:28` ✅

### 3. get_filtered_unpaid_ids
- **最新版本**: `_1122`
- **使用位置**:
  - `src/pages/PaymentRequest.tsx:518` ✅

### 4. get_finance_reconciliation_by_partner
- **最新版本**: `_1122`
- **使用位置**:
  - `src/pages/FinanceReconciliation.tsx:257` ✅
  - `src/pages/FinanceReconciliation.tsx:941` ✅

### 5. get_invoice_request_data
- **最新版本**: `_1120`
- **使用位置**:
  - `src/pages/InvoiceRequest.tsx:266` ✅
  - `src/pages/InvoiceRequest.tsx:480` ✅

### 6. get_invoice_requests_filtered
- **最新版本**: `_1120`
- **使用位置**:
  - `src/pages/InvoiceAudit.tsx:248` ✅
  - `src/pages/InvoiceRequestManagement.tsx:261` ✅
  - `src/pages/PaymentInvoice.tsx:290` ✅
  - `src/pages/mobile/shipper/MobileShipperHome.tsx:92` ✅
  - `src/pages/mobile/shipper/MobileShipperSubmitReceipt.tsx:52` ✅
  - `src/components/mobile/ShipperMobileLayout.tsx:118` ✅
  - `src/pages/mobile/shipper/MobileShipperPendingPayments.tsx:56` ✅
  - `src/pages/mobile/shipper/MobileShipperWaybills.tsx:41` ✅

### 7. get_logistics_summary_and_records_enhanced
- **最新版本**: `_1120`
- **使用位置**:
  - `src/pages/BusinessEntry/index.tsx:184` ✅
  - `src/pages/BusinessEntry/hooks/useLogisticsData.ts:107` ✅

### 8. get_payment_request_data
- **最新版本**: `_1122`
- **使用位置**:
  - `src/pages/PaymentRequest.tsx:297` ✅
- **注意**: 还有 `get_payment_request_data_v2_1122` 也在使用（这是另一个函数，不是清理目标）

### 9. get_payment_requests_filtered
- **最新版本**: `_1120`
- **使用位置**:
  - `src/pages/PaymentAudit.tsx:214` ✅
  - `src/pages/PaymentRequestsList.tsx:131` ✅
  - `src/pages/mobile/MobilePaymentRequestsList.tsx:194` ✅

### 10. get_shipper_dashboard_stats
- **最新版本**: `_1120`
- **使用位置**:
  - `src/pages/mobile/MobileShipperDashboard.tsx:173` ✅
  - `src/pages/ShipperDashboard.tsx:203` ✅

### 11. get_subordinate_shippers_stats
- **最新版本**: `_1120`
- **使用位置**:
  - `src/pages/mobile/MobileShipperDashboard.tsx:188` ✅
  - `src/pages/ShipperDashboard.tsx:233` ✅

## ⚠️ 其他函数（不在清理列表中）

以下函数使用了带后缀的版本，但不在本次清理列表中：

1. `get_dashboard_stats_with_billing_types_1113`
   - 使用位置:
     - `src/utils/supabase.ts:167`
     - `src/pages/Home.tsx:101`
     - `src/pages/mobile/MobileHome.tsx:110,159`
   - **状态**: 不在清理列表中，可能是其他函数

2. `get_payment_request_data_v2_1122`
   - 使用位置: 多处
   - **状态**: 这是另一个函数（v2版本），不在清理列表中

## 📊 总结

✅ **所有需要清理的函数都已使用最新版本！**

- 11个目标函数全部使用最新版本
- 没有发现使用旧版本（_1113, _1114, _1115, _1116）的情况
- 没有发现使用原函数名（无后缀）的情况

## 🎯 建议

1. ✅ 前端代码已经全部使用最新版本，可以安全执行清理迁移
2. ✅ 执行 `20251123_cleanup_old_function_versions.sql` 后，前端不会受到影响
3. ⚠️ 注意：`get_dashboard_stats_with_billing_types_1113` 不在清理列表中，如果后续需要清理，需要单独处理


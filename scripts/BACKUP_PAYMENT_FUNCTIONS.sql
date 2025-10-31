-- 备份将要修改的付款相关函数

-- ============================================================================
-- 查看现有的付款相关函数
-- ============================================================================

-- 查看所有付款相关的函数
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname IN (
  'approve_payment_request',
  'batch_approve_payment_requests',
  'pay_payment_request',
  'batch_pay_payment_requests',
  'set_payment_status_for_waybills',
  'process_payment_application'
)
ORDER BY proname;

-- ============================================================================
-- 导出现有函数的完整定义（如果存在）
-- ============================================================================

-- approve_payment_request函数
SELECT 
  'approve_payment_request' as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'approve_payment_request'
LIMIT 1;

-- batch_approve_payment_requests函数
SELECT 
  'batch_approve_payment_requests' as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'batch_approve_payment_requests'
LIMIT 1;

-- pay_payment_request函数
SELECT 
  'pay_payment_request' as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'pay_payment_request'
LIMIT 1;

-- set_payment_status_for_waybills函数（现有的付款函数）
SELECT 
  'set_payment_status_for_waybills' as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'set_payment_status_for_waybills'
LIMIT 1;

-- process_payment_application函数（创建申请的函数）
SELECT 
  'process_payment_application' as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'process_payment_application'
LIMIT 1;


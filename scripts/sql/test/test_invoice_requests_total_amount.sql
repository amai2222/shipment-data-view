-- 测试开票申请单的 total_amount 是否正确计算
-- 用于诊断合计金额不显示的问题

-- 1. 检查 invoice_requests 表中的 total_amount 字段
SELECT 
    request_number,
    status,
    record_count,
    total_amount,
    CASE 
        WHEN total_amount IS NULL THEN '❌ NULL'
        WHEN total_amount = 0 THEN '⚠️ 为0'
        ELSE '✅ 有值'
    END as amount_status,
    created_at
FROM invoice_requests
WHERE status IN ('Pending', 'Approved', 'Completed')
ORDER BY created_at DESC
LIMIT 20;

-- 2. 测试 RPC 函数返回的数据
SELECT 
    id,
    request_number,
    status,
    record_count,
    total_amount,
    CASE 
        WHEN total_amount IS NULL THEN '❌ NULL'
        WHEN total_amount = 0 THEN '⚠️ 为0'
        ELSE '✅ 有值'
    END as amount_status
FROM get_invoice_requests_filtered(
    p_status => NULL,
    p_limit => 20,
    p_offset => 0
)
ORDER BY created_at DESC;

-- 3. 检查是否有total_amount为NULL的记录
SELECT 
    COUNT(*) as total_records,
    COUNT(total_amount) as has_amount,
    COUNT(*) - COUNT(total_amount) as null_amount,
    SUM(CASE WHEN total_amount = 0 THEN 1 ELSE 0 END) as zero_amount
FROM invoice_requests
WHERE status IN ('Pending', 'Approved', 'Completed');

-- 4. 修复NULL的total_amount（如果需要）
-- UPDATE invoice_requests
-- SET total_amount = 0
-- WHERE total_amount IS NULL;


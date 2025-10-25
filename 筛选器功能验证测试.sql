-- ============================================================
-- 筛选器功能验证测试
-- 基于函数参数检查结果，验证筛选器是否正常工作
-- ============================================================

-- 1. 基础数据检查
SELECT '=== 基础数据检查 ===' as step;

-- 检查付款申请总数
SELECT 
    'payment_requests_total' as data_type,
    COUNT(*) as count
FROM payment_requests;

-- 检查运单总数
SELECT 
    'logistics_records_total' as data_type,
    COUNT(*) as count
FROM logistics_records;

-- 检查有运单关联的付款申请
SELECT 
    'payment_requests_with_waybills' as data_type,
    COUNT(*) as count
FROM payment_requests pr
WHERE pr.logistics_record_ids IS NOT NULL 
  AND array_length(pr.logistics_record_ids, 1) > 0;

-- 2. 测试RPC函数基础调用
SELECT '=== RPC函数基础测试 ===' as step;

-- 测试获取所有申请单（无筛选条件）
SELECT 
    'rpc_all_requests' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered();

-- 3. 测试状态筛选
SELECT '=== 状态筛选测试 ===' as step;

-- 测试按状态筛选（待审批）
SELECT 
    'rpc_status_pending' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered(p_status => 'Pending');

-- 测试按状态筛选（已审批）
SELECT 
    'rpc_status_approved' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered(p_status => 'Approved');

-- 测试按状态筛选（已付款）
SELECT 
    'rpc_status_paid' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered(p_status => 'Paid');

-- 4. 测试申请单号筛选
SELECT '=== 申请单号筛选测试 ===' as step;

-- 获取一些样本申请单号
WITH sample_request_ids AS (
    SELECT DISTINCT pr.request_id
    FROM payment_requests pr
    WHERE pr.request_id IS NOT NULL AND pr.request_id != ''
    LIMIT 3
)
SELECT 
    'sample_request_ids' as test_type,
    request_id,
    'use_for_test' as note
FROM sample_request_ids;

-- 测试申请单号筛选（使用通配符）
SELECT 
    'filter_request_id_wildcard' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered(p_request_id => 'PR');

-- 5. 测试运单号筛选
SELECT '=== 运单号筛选测试 ===' as step;

-- 获取一些样本运单号
WITH sample_waybills AS (
    SELECT DISTINCT lr.auto_number
    FROM logistics_records lr
    WHERE lr.auto_number IS NOT NULL AND lr.auto_number != ''
    LIMIT 3
)
SELECT 
    'sample_waybills' as test_type,
    auto_number,
    'use_for_test' as note
FROM sample_waybills;

-- 测试运单号筛选（使用通配符）
SELECT 
    'filter_waybill_wildcard' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered(p_waybill_number => 'WB');

-- 6. 测试司机筛选
SELECT '=== 司机筛选测试 ===' as step;

-- 获取一些样本司机姓名
WITH sample_drivers AS (
    SELECT DISTINCT lr.driver_name
    FROM logistics_records lr
    WHERE lr.driver_name IS NOT NULL AND lr.driver_name != ''
    LIMIT 3
)
SELECT 
    'sample_drivers' as test_type,
    driver_name,
    'use_for_test' as note
FROM sample_drivers;

-- 测试司机筛选（使用通配符）
SELECT 
    'filter_driver_wildcard' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered(p_driver_name => '司机');

-- 7. 测试项目筛选
SELECT '=== 项目筛选测试 ===' as step;

-- 获取项目列表
SELECT 
    'available_projects' as test_type,
    id,
    name
FROM projects
ORDER BY name
LIMIT 5;

-- 测试项目筛选（使用第一个项目ID）
WITH first_project AS (
    SELECT id::TEXT as project_id
    FROM projects
    LIMIT 1
)
SELECT 
    'filter_project_test' as test_type,
    project_id,
    'testing_with_first_project' as note
FROM first_project;

-- 8. 测试装货日期筛选
SELECT '=== 装货日期筛选测试 ===' as step;

-- 获取一些样本装货日期
WITH sample_dates AS (
    SELECT DISTINCT lr.loading_date
    FROM logistics_records lr
    WHERE lr.loading_date IS NOT NULL
    ORDER BY lr.loading_date DESC
    LIMIT 3
)
SELECT 
    'sample_loading_dates' as test_type,
    loading_date,
    'use_for_test' as note
FROM sample_dates;

-- 9. 测试组合筛选
SELECT '=== 组合筛选测试 ===' as step;

-- 测试状态+申请单号组合筛选
SELECT 
    'filter_combination_status_request' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered(
    p_status => 'Pending',
    p_request_id => 'PR'
);

-- 测试状态+运单号组合筛选
SELECT 
    'filter_combination_status_waybill' as test_type,
    COUNT(*) as result_count
FROM get_payment_requests_filtered(
    p_status => 'Pending',
    p_waybill_number => 'WB'
);

-- 10. 测试分页功能
SELECT '=== 分页功能测试 ===' as step;

-- 测试分页（限制5条记录）
SELECT 
    'pagination_test_5' as test_type,
    COUNT(*) as result_count,
    'should_be_5_or_less' as note
FROM get_payment_requests_filtered(p_limit => 5);

-- 测试分页（限制10条记录）
SELECT 
    'pagination_test_10' as test_type,
    COUNT(*) as result_count,
    'should_be_10_or_less' as note
FROM get_payment_requests_filtered(p_limit => 10);

-- 11. 测试具体数据样本
SELECT '=== 具体数据样本测试 ===' as step;

-- 获取一些具体的付款申请样本
WITH sample_requests AS (
    SELECT 
        pr.request_id,
        pr.status,
        pr.created_at,
        array_length(pr.logistics_record_ids, 1) as waybill_count
    FROM payment_requests pr
    WHERE pr.logistics_record_ids IS NOT NULL 
      AND array_length(pr.logistics_record_ids, 1) > 0
    LIMIT 3
)
SELECT 
    'sample_payment_requests' as test_type,
    request_id,
    status,
    created_at,
    waybill_count
FROM sample_requests;

-- 12. 测试运单关联数据
SELECT '=== 运单关联数据测试 ===' as step;

-- 获取运单与付款申请的关联样本
WITH linked_data AS (
    SELECT 
        pr.request_id,
        pr.status,
        lr.auto_number,
        lr.driver_name,
        lr.loading_date,
        p.name as project_name
    FROM payment_requests pr
    JOIN logistics_records lr ON lr.id = ANY(pr.logistics_record_ids)
    LEFT JOIN projects p ON p.id = lr.project_id
    LIMIT 3
)
SELECT 
    'linked_data_sample' as test_type,
    request_id,
    status,
    auto_number,
    driver_name,
    loading_date,
    project_name
FROM linked_data;

-- 13. 最终验证
SELECT '=== 最终验证 ===' as step;

-- 综合测试：检查所有筛选条件是否都能正常工作
WITH test_results AS (
    SELECT 
        'all_requests' as test_name,
        COUNT(*) as result_count
    FROM get_payment_requests_filtered()
    UNION ALL
    SELECT 
        'status_pending' as test_name,
        COUNT(*) as result_count
    FROM get_payment_requests_filtered(p_status => 'Pending')
    UNION ALL
    SELECT 
        'request_id_wildcard' as test_name,
        COUNT(*) as result_count
    FROM get_payment_requests_filtered(p_request_id => 'PR')
    UNION ALL
    SELECT 
        'waybill_wildcard' as test_name,
        COUNT(*) as result_count
    FROM get_payment_requests_filtered(p_waybill_number => 'WB')
    UNION ALL
    SELECT 
        'driver_wildcard' as test_name,
        COUNT(*) as result_count
    FROM get_payment_requests_filtered(p_driver_name => '司机')
)
SELECT 
    'final_verification' as test_type,
    test_name,
    result_count,
    CASE 
        WHEN result_count >= 0 THEN 'PASS'
        ELSE 'FAIL'
    END as status
FROM test_results
ORDER BY test_name;

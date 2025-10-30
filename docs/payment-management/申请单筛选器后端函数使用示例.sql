-- ============================================================
-- 申请单筛选器后端函数使用示例
-- 展示如何使用新创建的筛选函数
-- ============================================================

-- 1. 基础筛选查询示例
-- 查询申请单号包含 "PAY2025" 的申请单
SELECT * FROM public.get_payment_requests_filtered(
    p_request_id => 'PAY2025',
    p_limit => 10,
    p_offset => 0
);

-- 2. 运单号筛选示例
-- 查询包含运单号 "WB001" 的申请单
SELECT * FROM public.get_payment_requests_filtered(
    p_waybill_number => 'WB001',
    p_limit => 10,
    p_offset => 0
);

-- 3. 司机筛选示例
-- 查询包含司机 "张三" 的申请单
SELECT * FROM public.get_payment_requests_filtered(
    p_driver_name => '张三',
    p_limit => 10,
    p_offset => 0
);

-- 4. 装货日期筛选示例
-- 查询装货日期为 "2025-01-22" 的申请单
SELECT * FROM public.get_payment_requests_filtered(
    p_loading_date => '2025-01-22',
    p_limit => 10,
    p_offset => 0
);

-- 5. 多条件组合筛选示例
-- 查询申请单号包含 "PAY"，司机为 "张三"，装货日期为 "2025-01-22" 的申请单
SELECT * FROM public.get_payment_requests_filtered(
    p_request_id => 'PAY',
    p_driver_name => '张三',
    p_loading_date => '2025-01-22',
    p_limit => 20,
    p_offset => 0
);

-- 6. 获取筛选统计信息
-- 获取筛选结果的统计信息
SELECT * FROM public.get_payment_requests_filter_stats(
    p_request_id => 'PAY2025',
    p_driver_name => '张三'
);

-- 7. 获取筛选建议（自动补全）
-- 获取申请单号建议
SELECT * FROM public.get_payment_requests_suggestions(
    p_type => 'request_id',
    p_query => 'PAY',
    p_limit => 5
);

-- 获取运单号建议
SELECT * FROM public.get_payment_requests_suggestions(
    p_type => 'waybill_number',
    p_query => 'WB',
    p_limit => 5
);

-- 获取司机姓名建议
SELECT * FROM public.get_payment_requests_suggestions(
    p_type => 'driver_name',
    p_query => '张',
    p_limit => 5
);

-- 8. 导出筛选结果
-- 导出为JSON格式
SELECT public.get_payment_requests_filtered_export(
    p_request_id => 'PAY2025',
    p_export_format => 'json'
);

-- 导出为CSV格式
SELECT public.get_payment_requests_filtered_export(
    p_request_id => 'PAY2025',
    p_export_format => 'csv'
);

-- 9. 性能测试查询
-- 测试复杂筛选条件的性能
EXPLAIN ANALYZE
SELECT * FROM public.get_payment_requests_filtered(
    p_request_id => 'PAY',
    p_waybill_number => 'WB',
    p_driver_name => '张',
    p_loading_date => '2025-01-22',
    p_limit => 100,
    p_offset => 0
);

-- 10. 分页查询示例
-- 第一页
SELECT * FROM public.get_payment_requests_filtered(
    p_request_id => 'PAY2025',
    p_limit => 10,
    p_offset => 0
);

-- 第二页
SELECT * FROM public.get_payment_requests_filtered(
    p_request_id => 'PAY2025',
    p_limit => 10,
    p_offset => 10
);

-- 第三页
SELECT * FROM public.get_payment_requests_filtered(
    p_request_id => 'PAY2025',
    p_limit => 10,
    p_offset => 20
);

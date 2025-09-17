-- 测试 get_all_filtered_record_ids 函数
-- 执行这个脚本来测试函数是否正常工作

-- 测试1: 不带任何参数
SELECT public.get_all_filtered_record_ids();

-- 测试2: 带日期范围参数
SELECT public.get_all_filtered_record_ids(
    p_start_date => '2024-01-01',
    p_end_date => '2024-12-31'
);

-- 测试3: 带项目名称参数
SELECT public.get_all_filtered_record_ids(
    p_project_name => '测试项目'
);

-- 测试4: 带司机姓名参数
SELECT public.get_all_filtered_record_ids(
    p_driver_name => '张'
);

-- 测试5: 带磅单状态参数
SELECT public.get_all_filtered_record_ids(
    p_has_scale_record => 'yes'
);

-- 回滚验证脚本
-- 用于验证回滚后系统功能是否正常

-- 1. 检查原有函数是否存在
SELECT 
    '原有函数检查' as check_type,
    routine_name,
    '存在' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'preview_import_with_duplicates_check',
    'check_logistics_record_duplicate',
    'batch_import_logistics_records',
    'add_logistics_record_with_costs'
)
ORDER BY routine_name;

-- 2. 检查 _v2 函数是否已删除
SELECT 
    'V2函数清理检查' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '所有V2函数已删除'
        ELSE '仍有V2函数存在: ' || COUNT(*) || '个'
    END as status
FROM information_schema.routines 
WHERE routine_name LIKE '%_v2%' AND routine_schema = 'public';

-- 3. 测试原有验重功能
SELECT 
    '验重功能测试' as check_type,
    CASE 
        WHEN public.preview_import_with_duplicates_check('[]'::jsonb) IS NOT NULL 
        THEN '验重功能正常'
        ELSE '验重功能异常'
    END as status;

-- 4. 检查数据库表结构
SELECT 
    '表结构检查' as check_type,
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'logistics_records'
AND column_name IN ('loading_location', 'unloading_location', 'auto_number', 'driver_phone', 'created_by_user_id')
ORDER BY column_name;

-- 5. 检查测试数据清理情况
SELECT 
    '测试数据清理检查' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '测试数据已清理'
        ELSE '仍有测试数据: ' || COUNT(*) || '条'
    END as status
FROM public.logistics_records 
WHERE project_name LIKE '%测试%' OR project_name LIKE '%V2%';

-- 6. 显示验证结果摘要
SELECT 
    '回滚验证完成' as summary,
    '请检查上述结果，确保所有检查项都显示正常' as note;

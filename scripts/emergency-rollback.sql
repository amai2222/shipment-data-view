-- 紧急回滚脚本 - 多装多卸功能
-- 在Supabase后台直接执行此脚本即可快速回滚

-- 1. 删除所有 _v2 函数（快速回滚）
DROP FUNCTION IF EXISTS public.compare_location_arrays_v2(text, text);
DROP FUNCTION IF EXISTS public.parse_location_string_v2(text);
DROP FUNCTION IF EXISTS public.get_or_create_locations_from_string_v2(text);
DROP FUNCTION IF EXISTS public.get_or_create_locations_batch_v2(text[]);
DROP FUNCTION IF EXISTS public.preview_import_with_duplicates_check_v2(jsonb);
DROP FUNCTION IF EXISTS public.check_logistics_record_duplicate_v2(text, text, text, text, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.add_logistics_record_with_costs_v2(uuid, uuid, uuid, text, text, text, text, text, text, text, numeric, text, numeric, numeric, uuid);
DROP FUNCTION IF EXISTS public.import_logistics_data_v2(jsonb);

-- 2. 验证回滚结果
SELECT 
    '回滚完成' as status,
    COUNT(*) as remaining_v2_functions
FROM information_schema.routines 
WHERE routine_name LIKE '%_v2%' AND routine_schema = 'public';

-- 3. 显示回滚完成信息
SELECT '多装多卸功能紧急回滚完成 - 原有功能已恢复' as message;

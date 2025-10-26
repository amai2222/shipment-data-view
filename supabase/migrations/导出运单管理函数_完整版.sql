-- ============================================================================
-- 从Supabase导出运单管理函数的完整定义（使用精确签名）
-- 执行此脚本会显示函数的完整SQL定义
-- ============================================================================

-- 方法1：使用完整签名导出（最准确）
-- 基于上面查询到的完整签名

-- 1. 导出 get_logistics_summary_and_records_enhanced
SELECT 
    '-- ============================================================================' || E'\n' ||
    '-- 函数备份: get_logistics_summary_and_records_enhanced' || E'\n' ||
    '-- 导出时间: ' || now()::text || E'\n' ||
    '-- 函数签名: get_logistics_summary_and_records_enhanced(text,text,text,text,text,text,text,text,text,integer,integer,text,text)' || E'\n' ||
    '-- 参数说明: (start_date, end_date, project_name, driver_name, license_plate, driver_phone,' || E'\n' ||
    '--          other_platform_name, waybill_numbers, has_scale_record, page_number, page_size, sort_field, sort_direction)' || E'\n' ||
    '-- ============================================================================' || E'\n' || E'\n' ||
    pg_get_functiondef('get_logistics_summary_and_records_enhanced(text,text,text,text,text,text,text,text,text,integer,integer,text,text)'::regprocedure) || 
    E'\n\n' ||
    '-- 授权语句' || E'\n' ||
    'GRANT EXECUTE ON FUNCTION public.get_logistics_summary_and_records_enhanced TO authenticated;' || E'\n' ||
    'GRANT EXECUTE ON FUNCTION public.get_logistics_summary_and_records_enhanced TO anon;' || E'\n'
AS "函数1_get_logistics_summary_and_records_enhanced";

-- 2. 导出 get_all_filtered_record_ids
SELECT 
    '-- ============================================================================' || E'\n' ||
    '-- 函数备份: get_all_filtered_record_ids' || E'\n' ||
    '-- 导出时间: ' || now()::text || E'\n' ||
    '-- 函数签名: get_all_filtered_record_ids(text,text,text,text,text,text,text,text,text)' || E'\n' ||
    '-- 参数说明: (start_date, end_date, project_name, driver_name, license_plate, driver_phone,' || E'\n' ||
    '--          other_platform_name, waybill_numbers, has_scale_record)' || E'\n' ||
    '-- ============================================================================' || E'\n' || E'\n' ||
    pg_get_functiondef('get_all_filtered_record_ids(text,text,text,text,text,text,text,text,text)'::regprocedure) || 
    E'\n\n' ||
    '-- 授权语句' || E'\n' ||
    'GRANT EXECUTE ON FUNCTION public.get_all_filtered_record_ids TO authenticated;' || E'\n' ||
    'GRANT EXECUTE ON FUNCTION public.get_all_filtered_record_ids TO anon;' || E'\n'
AS "函数2_get_all_filtered_record_ids";

-- ============================================================================
-- 使用说明
-- ============================================================================
-- 1. 在 Supabase SQL Editor 中执行此脚本
-- 2. 会显示两个查询结果（两列）
-- 3. 复制"函数1_get_logistics_summary_and_records_enhanced"列的内容
-- 4. 复制"函数2_get_all_filtered_record_ids"列的内容
-- 5. 合并保存为：backup_logistics_functions_实际版本_20250126.sql
-- 
-- 备份文件格式应该是：
-- 
-- BEGIN;
-- 
-- -- 函数1的完整定义
-- CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records_enhanced(...)
-- ...
-- $$;
-- 
-- -- 函数2的完整定义
-- CREATE OR REPLACE FUNCTION public.get_all_filtered_record_ids(...)
-- ...
-- $$;
-- 
-- COMMIT;
-- ============================================================================


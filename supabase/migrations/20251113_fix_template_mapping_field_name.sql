-- ============================================================================
-- 修复模板导入字段映射：将 other_platform_waybills 更新为 external_tracking_numbers
-- 修改日期：2025-11-13
-- 
-- 问题：模板导入配置中使用了错误的字段名 other_platform_waybills
-- 实际数据库字段名应该是 external_tracking_numbers
-- ============================================================================

-- 更新 import_field_mappings 表中的字段映射
-- 根据实际表结构，字段名是 database_field
UPDATE public.import_field_mappings
SET database_field = 'external_tracking_numbers'
WHERE database_field = 'other_platform_waybills';

-- 更新 import_fixed_mappings 表中的固定值映射
-- 注意：实际表结构使用的是 database_value 字段，而不是 target_field
UPDATE public.import_fixed_mappings
SET database_value = 'external_tracking_numbers'
WHERE database_value = 'other_platform_waybills';

-- 显示更新结果
DO $$
DECLARE
    field_mappings_count INTEGER;
    fixed_mappings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO field_mappings_count
    FROM public.import_field_mappings
    WHERE database_field = 'external_tracking_numbers';
    
    SELECT COUNT(*) INTO fixed_mappings_count
    FROM public.import_fixed_mappings
    WHERE database_value = 'external_tracking_numbers';
    
    RAISE NOTICE '字段映射更新完成：';
    RAISE NOTICE '  - import_field_mappings 中 external_tracking_numbers 的记录数: %', field_mappings_count;
    RAISE NOTICE '  - import_fixed_mappings 中 external_tracking_numbers 的记录数: %', fixed_mappings_count;
END $$;


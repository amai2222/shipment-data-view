-- 多装多卸功能回滚脚本
-- 删除所有 _v2 后缀的函数和字段

-- 1. 删除所有 _v2 函数
DROP FUNCTION IF EXISTS public.compare_location_arrays_v2(text, text);
DROP FUNCTION IF EXISTS public.parse_location_string_v2(text);
DROP FUNCTION IF EXISTS public.get_or_create_locations_from_string_v2(text);
DROP FUNCTION IF EXISTS public.get_or_create_locations_batch_v2(text[]);
DROP FUNCTION IF EXISTS public.preview_import_with_duplicates_check_v2(jsonb);
DROP FUNCTION IF EXISTS public.check_logistics_record_duplicate_v2(text, text, text, text, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.add_logistics_record_with_costs_v2(uuid, uuid, uuid, text, text, text, text, text, text, text, numeric, text, numeric, numeric, uuid);
DROP FUNCTION IF EXISTS public.import_logistics_data_v2(jsonb);

-- 2. 删除多地点支持字段（可选，根据需要取消注释）
-- 注意：删除字段会丢失数据，请谨慎操作
/*
ALTER TABLE public.logistics_records 
DROP COLUMN IF EXISTS loading_location_ids,
DROP COLUMN IF EXISTS unloading_location_ids;

ALTER TABLE public.import_templates 
DROP COLUMN IF EXISTS location_ids;

ALTER TABLE public.import_field_mappings 
DROP COLUMN IF EXISTS location_ids;
*/

-- 3. 清理测试数据（可选，根据需要取消注释）
/*
DELETE FROM public.logistics_records WHERE project_name = '多地点测试项目V2';
DELETE FROM public.drivers WHERE name = '多地点测试司机V2';
DELETE FROM public.partner_chains WHERE chain_name = '默认链路V2';
DELETE FROM public.projects WHERE name = '多地点测试项目V2';
*/

-- 4. 显示回滚完成信息
SELECT '多装多卸功能回滚完成' as status;

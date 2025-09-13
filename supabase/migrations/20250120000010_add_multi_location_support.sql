-- 多装多卸功能数据库迁移脚本
-- 添加多地点支持的相关字段

-- 1. 为 logistics_records 表添加多地点支持字段
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS loading_location_ids TEXT[],
ADD COLUMN IF NOT EXISTS unloading_location_ids TEXT[];

-- 2. 为 import_templates 表添加多地点支持字段
ALTER TABLE public.import_templates 
ADD COLUMN IF NOT EXISTS location_ids TEXT[];

-- 3. 为 import_field_mappings 表添加多地点支持字段
ALTER TABLE public.import_field_mappings 
ADD COLUMN IF NOT EXISTS location_ids TEXT[];

-- 4. 添加注释说明
COMMENT ON COLUMN public.logistics_records.loading_location_ids IS '装货地点ID数组，用于多装多卸功能';
COMMENT ON COLUMN public.logistics_records.unloading_location_ids IS '卸货地点ID数组，用于多装多卸功能';
COMMENT ON COLUMN public.import_templates.location_ids IS '地点ID数组，用于多装多卸功能';
COMMENT ON COLUMN public.import_field_mappings.location_ids IS '地点ID数组，用于多装多卸功能';

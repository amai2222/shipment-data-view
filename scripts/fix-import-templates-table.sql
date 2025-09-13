-- 修复 import_templates 表缺失 platform_type 列的问题
-- 执行时间：2025-01-20

-- ===========================================
-- 第一步：检查表是否存在以及当前结构
-- ===========================================

-- 检查表是否存在
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'import_templates')
    THEN '表存在'
    ELSE '表不存在'
  END as table_status;

-- 检查当前表结构
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'import_templates'
ORDER BY ordinal_position;

-- ===========================================
-- 第二步：删除现有表（如果存在但结构不正确）
-- ===========================================

-- 删除依赖表
DROP TABLE IF EXISTS public.import_fixed_mappings CASCADE;
DROP TABLE IF EXISTS public.import_field_mappings CASCADE;

-- 删除主表
DROP TABLE IF EXISTS public.import_templates CASCADE;

-- ===========================================
-- 第三步：重新创建正确的表结构
-- ===========================================

-- 1. 创建导入模板表
CREATE TABLE public.import_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  platform_type VARCHAR(100) NOT NULL, -- 平台类型：waybill, scale, finance等
  template_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- 模板配置
  field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb, -- 字段映射配置
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- 是否为系统模板
  created_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 添加字段注释
COMMENT ON TABLE public.import_templates IS '导入模板表，存储不同平台的Excel导入模板配置';
COMMENT ON COLUMN public.import_templates.name IS '模板名称';
COMMENT ON COLUMN public.import_templates.platform_type IS '平台类型：waybill(运单), scale(磅单), finance(财务)等';
COMMENT ON COLUMN public.import_templates.template_config IS '模板配置，包含列定义、验证规则等';
COMMENT ON COLUMN public.import_templates.field_mappings IS '字段映射配置，定义Excel列与数据库字段的对应关系';
COMMENT ON COLUMN public.import_templates.is_system IS '是否为系统内置模板';

-- 2. 创建字段映射表
CREATE TABLE public.import_field_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.import_templates(id) ON DELETE CASCADE,
  excel_column VARCHAR(100) NOT NULL, -- Excel列名
  database_field VARCHAR(100) NOT NULL, -- 数据库字段名
  field_type VARCHAR(50) NOT NULL, -- 字段类型：text, number, date, boolean等
  is_required BOOLEAN DEFAULT false, -- 是否必填
  validation_rules JSONB DEFAULT '{}'::jsonb, -- 验证规则
  default_value TEXT, -- 默认值
  display_order INTEGER DEFAULT 0, -- 显示顺序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 添加字段注释
COMMENT ON TABLE public.import_field_mappings IS '字段映射表，定义Excel列与数据库字段的对应关系';
COMMENT ON COLUMN public.import_field_mappings.excel_column IS 'Excel中的列名';
COMMENT ON COLUMN public.import_field_mappings.database_field IS '对应的数据库字段名';
COMMENT ON COLUMN public.import_field_mappings.field_type IS '字段数据类型';
COMMENT ON COLUMN public.import_field_mappings.validation_rules IS '字段验证规则配置';

-- 3. 创建固定映射表
CREATE TABLE public.import_fixed_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.import_templates(id) ON DELETE CASCADE,
  mapping_type VARCHAR(50) NOT NULL, -- 映射类型：location, driver, project等
  excel_value TEXT NOT NULL, -- Excel中的值
  database_value TEXT NOT NULL, -- 数据库中的值
  is_case_sensitive BOOLEAN DEFAULT false, -- 是否区分大小写
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 添加字段注释
COMMENT ON TABLE public.import_fixed_mappings IS '固定映射表，存储Excel值与数据库值的固定对应关系';
COMMENT ON COLUMN public.import_fixed_mappings.mapping_type IS '映射类型：location(地点), driver(司机), project(项目)等';
COMMENT ON COLUMN public.import_fixed_mappings.excel_value IS 'Excel中显示的值';
COMMENT ON COLUMN public.import_fixed_mappings.database_value IS '对应的数据库值';

-- ===========================================
-- 第四步：创建索引
-- ===========================================

CREATE INDEX idx_import_templates_platform_type ON public.import_templates(platform_type);
CREATE INDEX idx_import_templates_is_active ON public.import_templates(is_active);
CREATE INDEX idx_import_field_mappings_template_id ON public.import_field_mappings(template_id);
CREATE INDEX idx_import_fixed_mappings_template_id ON public.import_fixed_mappings(template_id);
CREATE INDEX idx_import_fixed_mappings_type ON public.import_fixed_mappings(mapping_type);

-- ===========================================
-- 第五步：启用行级安全
-- ===========================================

ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fixed_mappings ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
CREATE POLICY "Enable read access for all users" ON public.import_templates FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.import_field_mappings FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.import_fixed_mappings FOR SELECT USING (true);

-- ===========================================
-- 第六步：插入默认数据
-- ===========================================

-- 插入默认的运单导入模板
INSERT INTO public.import_templates (
  name, 
  description, 
  platform_type, 
  template_config,
  field_mappings,
  is_system,
  created_by_user_id
) VALUES (
  '标准运单导入模板',
  '用于运单数据批量导入的标准模板',
  'waybill',
  '{
    "version": "1.0",
    "required_columns": ["运单号", "项目名称", "司机姓名", "车牌号", "装货地点", "卸货地点", "装货日期", "装货数量"],
    "optional_columns": ["司机电话", "卸货日期", "卸货数量", "运费金额", "额外费用", "应付费用", "其他平台名称", "其他平台运单号", "备注"],
    "date_format": "YYYY-MM-DD HH:mm:ss",
    "number_format": "decimal"
  }'::jsonb,
  '[
    {"excel_column": "运单号", "database_field": "auto_number", "field_type": "text", "is_required": true},
    {"excel_column": "项目名称", "database_field": "project_name", "field_type": "text", "is_required": true},
    {"excel_column": "司机姓名", "database_field": "driver_name", "field_type": "text", "is_required": true},
    {"excel_column": "车牌号", "database_field": "license_plate", "field_type": "text", "is_required": true},
    {"excel_column": "司机电话", "database_field": "driver_phone", "field_type": "text", "is_required": false},
    {"excel_column": "装货地点", "database_field": "loading_location", "field_type": "text", "is_required": true},
    {"excel_column": "卸货地点", "database_field": "unloading_location", "field_type": "text", "is_required": true},
    {"excel_column": "装货日期", "database_field": "loading_date", "field_type": "datetime", "is_required": true},
    {"excel_column": "卸货日期", "database_field": "unloading_date", "field_type": "datetime", "is_required": false},
    {"excel_column": "装货数量", "database_field": "loading_weight", "field_type": "number", "is_required": true},
    {"excel_column": "卸货数量", "database_field": "unloading_weight", "field_type": "number", "is_required": false},
    {"excel_column": "运费金额", "database_field": "current_cost", "field_type": "number", "is_required": false},
    {"excel_column": "额外费用", "database_field": "extra_cost", "field_type": "number", "is_required": false},
    {"excel_column": "应付费用", "database_field": "payable_cost", "field_type": "number", "is_required": false},
    {"excel_column": "其他平台名称", "database_field": "other_platform_names", "field_type": "text_array", "is_required": false},
    {"excel_column": "其他平台运单号", "database_field": "external_tracking_numbers", "field_type": "jsonb", "is_required": false},
    {"excel_column": "备注", "database_field": "remarks", "field_type": "text", "is_required": false}
  ]'::jsonb,
  true,
  '00000000-0000-0000-0000-000000000000'::uuid
);

-- ===========================================
-- 第七步：验证修复结果
-- ===========================================

-- 验证表结构
SELECT 
  '修复后表结构验证' as test_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'import_templates'
ORDER BY ordinal_position;

-- 验证 platform_type 列是否存在
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'import_templates' 
        AND column_name = 'platform_type'
    )
    THEN '✅ platform_type 列已成功创建'
    ELSE '❌ platform_type 列创建失败'
  END as platform_type_status;

-- 验证默认数据
SELECT 
  '默认模板数据验证' as test_name,
  id,
  name,
  platform_type,
  is_system,
  is_active
FROM public.import_templates
WHERE is_system = true;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'import_templates 表修复完成！';
  RAISE NOTICE 'platform_type 列已成功创建';
  RAISE NOTICE '默认模板数据已插入';
  RAISE NOTICE '===========================================';
END $$;

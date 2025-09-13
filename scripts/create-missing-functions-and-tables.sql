-- 创建缺失的数据库函数和表
-- 执行时间：2025-01-20
-- 功能：补充缺失的平台管理、导入模板和批量导入功能

-- ===========================================
-- 第一部分：创建缺失的数据库表
-- ===========================================

-- 1. 创建导入模板表
CREATE TABLE IF NOT EXISTS public.import_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  platform_type VARCHAR(100) NOT NULL, -- 平台类型：waybill, scale, finance等
  template_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- 模板配置
  field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb, -- 字段映射配置
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- 是否为系统模板
  created_by_user_id UUID NOT NULL,
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
CREATE TABLE IF NOT EXISTS public.import_field_mappings (
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
CREATE TABLE IF NOT EXISTS public.import_fixed_mappings (
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_import_templates_platform_type ON public.import_templates(platform_type);
CREATE INDEX IF NOT EXISTS idx_import_templates_is_active ON public.import_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_import_field_mappings_template_id ON public.import_field_mappings(template_id);
CREATE INDEX IF NOT EXISTS idx_import_fixed_mappings_template_id ON public.import_fixed_mappings(template_id);
CREATE INDEX IF NOT EXISTS idx_import_fixed_mappings_type ON public.import_fixed_mappings(mapping_type);

-- 启用行级安全
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fixed_mappings ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
CREATE POLICY "Enable read access for all users" ON public.import_templates FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.import_field_mappings FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.import_fixed_mappings FOR SELECT USING (true);

-- ===========================================
-- 第二部分：创建缺失的数据库函数
-- ===========================================

-- 1. 获取可用平台列表
CREATE OR REPLACE FUNCTION public.get_available_platforms()
RETURNS TABLE (
  platform_name TEXT,
  usage_count BIGINT,
  last_used TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    platform_name,
    usage_count,
    MAX(last_used) as last_used
  FROM (
    -- 从external_tracking_numbers字段获取平台信息
    SELECT 
      (item->>'platform') as platform_name,
      COUNT(*) as usage_count,
      MAX(lr.created_at) as last_used
    FROM public.logistics_records lr,
         jsonb_array_elements(lr.external_tracking_numbers) AS item
    WHERE lr.external_tracking_numbers IS NOT NULL
      AND jsonb_array_length(lr.external_tracking_numbers) > 0
      AND (item->>'platform') IS NOT NULL
      AND (item->>'platform') != ''
    GROUP BY (item->>'platform')
    
    UNION ALL
    
    -- 从other_platform_names字段获取平台信息
    SELECT 
      unnest(lr.other_platform_names) as platform_name,
      COUNT(*) as usage_count,
      MAX(lr.created_at) as last_used
    FROM public.logistics_records lr
    WHERE lr.other_platform_names IS NOT NULL
      AND array_length(lr.other_platform_names, 1) > 0
    GROUP BY unnest(lr.other_platform_names)
  ) combined
  WHERE platform_name IS NOT NULL AND platform_name != ''
  GROUP BY platform_name, usage_count
  ORDER BY usage_count DESC, last_used DESC;
END;
$$;

-- 2. 添加自定义平台
CREATE OR REPLACE FUNCTION public.add_custom_platform(
  p_platform_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  platform_id UUID;
BEGIN
  -- 检查平台是否已存在
  IF EXISTS (
    SELECT 1 FROM public.get_available_platforms() 
    WHERE platform_name ILIKE p_platform_name
  ) THEN
    RAISE EXCEPTION '平台 "%" 已存在', p_platform_name;
  END IF;
  
  -- 这里可以扩展为存储到专门的平台表中
  -- 目前只是返回一个模拟的ID
  platform_id := gen_random_uuid();
  
  -- 记录日志（可选）
  INSERT INTO public.import_templates (
    name, 
    description, 
    platform_type, 
    template_config,
    is_system,
    created_by_user_id
  ) VALUES (
    '自定义平台: ' || p_platform_name,
    COALESCE(p_description, '用户自定义平台'),
    'custom_platform',
    jsonb_build_object('platform_name', p_platform_name),
    false,
    auth.uid()
  );
  
  RETURN platform_id;
END;
$$;

-- 3. 批量导入物流记录
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(
  p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    record_data jsonb;
    success_count integer := 0;
    error_count integer := 0;
    error_logs jsonb := '[]'::jsonb;
    project_id_val uuid;
    chain_id_val uuid;
    driver_id_val uuid;
    auto_number_val text;
    inserted_record_id uuid;
BEGIN
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- 获取项目ID
            SELECT id INTO project_id_val 
            FROM public.projects 
            WHERE name = TRIM(record_data->>'project_name') 
            LIMIT 1;

            -- 获取合作链路ID
            IF record_data->>'chain_name' IS NOT NULL AND TRIM(record_data->>'chain_name') != '' THEN
                SELECT id INTO chain_id_val 
                FROM public.partner_chains 
                WHERE chain_name = TRIM(record_data->>'chain_name') 
                AND project_id = project_id_val
                LIMIT 1;
            ELSE
                chain_id_val := NULL;
            END IF;

            -- 获取或创建司机
            SELECT id INTO driver_id_val 
            FROM public.drivers 
            WHERE name = TRIM(record_data->>'driver_name') 
            AND license_plate = TRIM(record_data->>'license_plate')
            LIMIT 1;

            IF driver_id_val IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    TRIM(record_data->>'driver_name'),
                    TRIM(record_data->>'license_plate'),
                    TRIM(record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id INTO driver_id_val;
            END IF;

            -- 生成自动编号
            auto_number_val := public.generate_auto_number(record_data->>'loading_date');

            -- 插入运单记录，包含平台字段
            INSERT INTO public.logistics_records (
                auto_number, project_id, project_name, loading_date, loading_location, 
                unloading_location, driver_id, driver_name, license_plate, driver_phone,
                loading_weight, unloading_date, unloading_weight, transport_type,
                current_cost, extra_cost, payable_cost, remarks, created_by_user_id,
                chain_id, external_tracking_numbers, other_platform_names
            ) VALUES (
                auto_number_val, project_id_val, TRIM(record_data->>'project_name'),
                (record_data->>'loading_date')::timestamptz, TRIM(record_data->>'loading_location'),
                TRIM(record_data->>'unloading_location'), driver_id_val, TRIM(record_data->>'driver_name'),
                TRIM(record_data->>'license_plate'), TRIM(record_data->>'driver_phone'),
                (record_data->>'loading_weight')::numeric, 
                CASE WHEN record_data->>'unloading_date' IS NOT NULL AND TRIM(record_data->>'unloading_date') != '' 
                     THEN (record_data->>'unloading_date')::timestamptz ELSE NULL END,
                CASE WHEN record_data->>'unloading_weight' IS NOT NULL AND TRIM(record_data->>'unloading_weight') != '' 
                     THEN (record_data->>'unloading_weight')::numeric ELSE NULL END,
                COALESCE(TRIM(record_data->>'transport_type'), '实际运输'),
                CASE WHEN record_data->>'current_cost' IS NOT NULL AND TRIM(record_data->>'current_cost') != '' 
                     THEN (record_data->>'current_cost')::numeric ELSE 0 END,
                CASE WHEN record_data->>'extra_cost' IS NOT NULL AND TRIM(record_data->>'extra_cost') != '' 
                     THEN (record_data->>'extra_cost')::numeric ELSE 0 END,
                0, -- payable_cost 将在后续计算
                TRIM(record_data->>'remarks'),
                auth.uid(),
                chain_id_val,
                -- 平台字段：确保正确插入
                CASE WHEN record_data->'external_tracking_numbers' IS NOT NULL 
                     THEN record_data->'external_tracking_numbers' ELSE '[]'::jsonb END,
                CASE WHEN record_data->'other_platform_names' IS NOT NULL 
                     THEN (record_data->'other_platform_names')::text[] ELSE '{}'::text[] END
            )
            RETURNING id INTO inserted_record_id;

            -- 重新计算费用
            PERFORM public.recalculate_and_update_costs_for_records(ARRAY[inserted_record_id]);

            success_count := success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            error_logs := error_logs || jsonb_build_object(
                'record', record_data,
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success_count', success_count,
        'error_count', error_count,
        'error_logs', error_logs
    );
END;
$$;

-- ===========================================
-- 第三部分：创建辅助函数
-- ===========================================

-- 4. 获取导入模板列表
CREATE OR REPLACE FUNCTION public.get_import_templates(
  p_platform_type VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  description TEXT,
  platform_type VARCHAR(100),
  template_config JSONB,
  field_mappings JSONB,
  is_active BOOLEAN,
  is_system BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    it.id,
    it.name,
    it.description,
    it.platform_type,
    it.template_config,
    it.field_mappings,
    it.is_active,
    it.is_system,
    it.created_at
  FROM public.import_templates it
  WHERE it.is_active = true
    AND (p_platform_type IS NULL OR it.platform_type = p_platform_type)
  ORDER BY it.is_system DESC, it.created_at DESC;
END;
$$;

-- 5. 获取模板字段映射
CREATE OR REPLACE FUNCTION public.get_template_field_mappings(
  p_template_id UUID
)
RETURNS TABLE (
  id UUID,
  excel_column VARCHAR(100),
  database_field VARCHAR(100),
  field_type VARCHAR(50),
  is_required BOOLEAN,
  validation_rules JSONB,
  default_value TEXT,
  display_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ifm.id,
    ifm.excel_column,
    ifm.database_field,
    ifm.field_type,
    ifm.is_required,
    ifm.validation_rules,
    ifm.default_value,
    ifm.display_order
  FROM public.import_field_mappings ifm
  WHERE ifm.template_id = p_template_id
  ORDER BY ifm.display_order, ifm.excel_column;
END;
$$;

-- 6. 获取模板固定映射
CREATE OR REPLACE FUNCTION public.get_template_fixed_mappings(
  p_template_id UUID,
  p_mapping_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  mapping_type VARCHAR(50),
  excel_value TEXT,
  database_value TEXT,
  is_case_sensitive BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ifm.id,
    ifm.mapping_type,
    ifm.excel_value,
    ifm.database_value,
    ifm.is_case_sensitive
  FROM public.import_fixed_mappings ifm
  WHERE ifm.template_id = p_template_id
    AND (p_mapping_type IS NULL OR ifm.mapping_type = p_mapping_type)
  ORDER BY ifm.mapping_type, ifm.excel_value;
END;
$$;

-- ===========================================
-- 第四部分：插入默认数据
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
) ON CONFLICT DO NOTHING;

-- 创建完成提示
DO $$
BEGIN
  RAISE NOTICE '数据库函数和表创建完成！';
  RAISE NOTICE '已创建的函数：get_available_platforms, add_custom_platform, batch_import_logistics_records';
  RAISE NOTICE '已创建的表：import_templates, import_field_mappings, import_fixed_mappings';
  RAISE NOTICE '已插入默认的运单导入模板';
END $$;

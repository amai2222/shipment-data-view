-- 简化版：创建缺失的数据库函数和表
-- 执行时间：2025-01-20
-- 功能：快速创建核心的平台管理和导入功能

-- ===========================================
-- 第一部分：创建核心表
-- ===========================================

-- 1. 创建导入模板表
CREATE TABLE IF NOT EXISTS public.import_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  platform_type VARCHAR(100) NOT NULL,
  template_config JSONB DEFAULT '{}'::jsonb,
  field_mappings JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. 创建字段映射表
CREATE TABLE IF NOT EXISTS public.import_field_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.import_templates(id) ON DELETE CASCADE,
  excel_column VARCHAR(100) NOT NULL,
  database_field VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. 创建固定映射表
CREATE TABLE IF NOT EXISTS public.import_fixed_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.import_templates(id) ON DELETE CASCADE,
  mapping_type VARCHAR(50) NOT NULL,
  excel_value TEXT NOT NULL,
  database_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ===========================================
-- 第二部分：创建核心函数
-- ===========================================

-- 1. 获取可用平台列表
CREATE OR REPLACE FUNCTION public.get_available_platforms()
RETURNS TABLE (
  platform_name TEXT,
  usage_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    platform_name,
    usage_count
  FROM (
    -- 从external_tracking_numbers获取
    SELECT 
      (item->>'platform') as platform_name,
      COUNT(*) as usage_count
    FROM public.logistics_records lr,
         jsonb_array_elements(lr.external_tracking_numbers) AS item
    WHERE lr.external_tracking_numbers IS NOT NULL
      AND (item->>'platform') IS NOT NULL
      AND (item->>'platform') != ''
    GROUP BY (item->>'platform')
    
    UNION ALL
    
    -- 从other_platform_names获取
    SELECT 
      unnest(lr.other_platform_names) as platform_name,
      COUNT(*) as usage_count
    FROM public.logistics_records lr
    WHERE lr.other_platform_names IS NOT NULL
    GROUP BY unnest(lr.other_platform_names)
  ) combined
  WHERE platform_name IS NOT NULL
  GROUP BY platform_name
  ORDER BY usage_count DESC;
END;
$$;

-- 2. 添加自定义平台
CREATE OR REPLACE FUNCTION public.add_custom_platform(
  p_platform_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  platform_id UUID;
BEGIN
  platform_id := gen_random_uuid();
  
  INSERT INTO public.import_templates (
    name, 
    platform_type, 
    template_config,
    is_system,
    created_by_user_id
  ) VALUES (
    '自定义平台: ' || p_platform_name,
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
-- 第三部分：创建索引和权限
-- ===========================================

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_import_templates_type ON public.import_templates(platform_type);
CREATE INDEX IF NOT EXISTS idx_import_field_mappings_template ON public.import_field_mappings(template_id);
CREATE INDEX IF NOT EXISTS idx_import_fixed_mappings_template ON public.import_fixed_mappings(template_id);

-- 启用行级安全
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fixed_mappings ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
CREATE POLICY "Allow all access" ON public.import_templates FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.import_field_mappings FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.import_fixed_mappings FOR ALL USING (true);

-- ===========================================
-- 第四部分：插入默认数据
-- ===========================================

-- 插入默认模板
INSERT INTO public.import_templates (
  name, 
  platform_type, 
  template_config,
  field_mappings,
  is_system,
  created_by_user_id
) VALUES (
  '标准运单导入模板',
  'waybill',
  '{"version": "1.0", "required_columns": ["运单号", "项目名称", "司机姓名", "车牌号", "装货地点", "卸货地点", "装货日期", "装货数量"]}'::jsonb,
  '[
    {"excel_column": "运单号", "database_field": "auto_number", "field_type": "text", "is_required": true},
    {"excel_column": "项目名称", "database_field": "project_name", "field_type": "text", "is_required": true},
    {"excel_column": "司机姓名", "database_field": "driver_name", "field_type": "text", "is_required": true},
    {"excel_column": "车牌号", "database_field": "license_plate", "field_type": "text", "is_required": true},
    {"excel_column": "装货地点", "database_field": "loading_location", "field_type": "text", "is_required": true},
    {"excel_column": "卸货地点", "database_field": "unloading_location", "field_type": "text", "is_required": true},
    {"excel_column": "装货日期", "database_field": "loading_date", "field_type": "datetime", "is_required": true},
    {"excel_column": "装货数量", "database_field": "loading_weight", "field_type": "number", "is_required": true}
  ]'::jsonb,
  true,
  '00000000-0000-0000-0000-000000000000'::uuid
) ON CONFLICT DO NOTHING;

-- 完成提示
SELECT '数据库函数和表创建完成！' as status;

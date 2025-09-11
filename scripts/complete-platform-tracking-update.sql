-- 完整的平台运单信息更新脚本
-- 1. 更新数据库结构
-- 2. 更新批量导入函数
-- 3. 创建相关辅助函数

-- ===========================================
-- 第一部分：数据库结构更新
-- ===========================================

-- 1. 删除旧的字段（如果存在）
ALTER TABLE public.logistics_records
DROP COLUMN IF EXISTS external_tracking_numbers,
DROP COLUMN IF EXISTS other_platform_names;

-- 2. 添加新的 platform_trackings 字段
ALTER TABLE public.logistics_records
ADD COLUMN IF NOT EXISTS platform_trackings JSONB[] DEFAULT '{}'::JSONB[];

-- 3. 添加字段注释
COMMENT ON COLUMN public.logistics_records.platform_trackings IS '其他平台运单信息数组，每个元素包含平台名称和该平台的运单号列表';

-- 4. 创建GIN索引以提高JSONB数组查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_platform_trackings 
ON public.logistics_records USING GIN (platform_trackings);

-- ===========================================
-- 第二部分：删除旧的函数（如果存在）
-- ===========================================

DROP FUNCTION IF EXISTS public.get_logistics_records_by_external_tracking_number(TEXT);
DROP FUNCTION IF EXISTS public.get_logistics_records_by_platform_name(TEXT);
DROP FUNCTION IF EXISTS public.update_logistics_record_external_tracking_numbers(UUID, JSONB[]);
DROP FUNCTION IF EXISTS public.get_logistics_records_by_platform(TEXT);
DROP FUNCTION IF EXISTS public.get_all_used_platforms();
DROP FUNCTION IF EXISTS public.get_platform_usage_statistics();
DROP FUNCTION IF EXISTS public.update_logistics_record_platforms(UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.validate_platform_names(TEXT[]);
DROP FUNCTION IF EXISTS public.clean_platform_names();

-- ===========================================
-- 第三部分：创建新的辅助函数
-- ===========================================

-- 1. 根据平台名称和运单号查询运单的函数
CREATE OR REPLACE FUNCTION public.get_logistics_records_by_platform_tracking(
  p_platform TEXT,
  p_tracking_number TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  auto_number TEXT,
  project_name TEXT,
  driver_name TEXT,
  license_plate TEXT,
  loading_date TIMESTAMP WITH TIME ZONE,
  unloading_date TIMESTAMP WITH TIME ZONE,
  loading_weight DECIMAL,
  unloading_weight DECIMAL,
  current_cost DECIMAL,
  extra_cost DECIMAL,
  payable_cost DECIMAL,
  platform_trackings JSONB[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lr.id,
    lr.auto_number,
    lr.project_name,
    lr.driver_name,
    lr.license_plate,
    lr.loading_date,
    lr.unloading_date,
    lr.loading_weight,
    lr.unloading_weight,
    lr.current_cost,
    lr.extra_cost,
    lr.payable_cost,
    lr.platform_trackings
  FROM public.logistics_records lr,
       jsonb_array_elements(lr.platform_trackings) AS pt
  WHERE (pt->>'platform') ILIKE '%' || p_platform || '%'
    AND (p_tracking_number IS NULL OR (pt->'trackingNumbers')::jsonb ? p_tracking_number);
END;
$$;

-- 2. 获取所有使用过的平台名称的函数
CREATE OR REPLACE FUNCTION public.get_all_platform_tracking_platforms()
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
    COUNT(*) as usage_count
  FROM (
    SELECT DISTINCT (pt->>'platform') as platform_name
    FROM public.logistics_records lr,
         jsonb_array_elements(lr.platform_trackings) AS pt
    WHERE lr.platform_trackings IS NOT NULL
    AND array_length(lr.platform_trackings, 1) > 0
  ) t
  WHERE platform_name IS NOT NULL AND platform_name != ''
  GROUP BY platform_name
  ORDER BY usage_count DESC;
END;
$$;

-- 3. 统计平台运单使用情况的函数
CREATE OR REPLACE FUNCTION public.get_platform_tracking_usage_statistics()
RETURNS TABLE (
  total_records_with_platform_trackings BIGINT,
  total_platform_mentions BIGINT,
  total_tracking_numbers BIGINT,
  unique_platforms BIGINT,
  most_used_platform TEXT,
  most_used_platform_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_records BIGINT;
  v_total_platform_mentions BIGINT;
  v_total_tracking_numbers BIGINT;
  v_unique_platforms BIGINT;
  v_most_used_platform TEXT;
  v_most_used_count BIGINT;
BEGIN
  -- 计算有平台运单信息的运单数量
  SELECT COUNT(*) INTO v_total_records
  FROM public.logistics_records
  WHERE platform_trackings IS NOT NULL
  AND array_length(platform_trackings, 1) > 0;

  -- 计算平台名称总提及次数
  SELECT COUNT(*) INTO v_total_platform_mentions
  FROM public.logistics_records lr,
       jsonb_array_elements(lr.platform_trackings) AS pt
  WHERE lr.platform_trackings IS NOT NULL
  AND array_length(lr.platform_trackings, 1) > 0
  AND (pt->>'platform') IS NOT NULL AND (pt->>'platform') != '';

  -- 计算总运单号数量
  SELECT COALESCE(SUM(jsonb_array_length(pt->'trackingNumbers')), 0) INTO v_total_tracking_numbers
  FROM public.logistics_records lr,
       jsonb_array_elements(lr.platform_trackings) AS pt
  WHERE lr.platform_trackings IS NOT NULL
  AND array_length(lr.platform_trackings, 1) > 0
  AND (pt->'trackingNumbers') IS NOT NULL;

  -- 计算唯一平台数量
  SELECT COUNT(DISTINCT (pt->>'platform')) INTO v_unique_platforms
  FROM public.logistics_records lr,
       jsonb_array_elements(lr.platform_trackings) AS pt
  WHERE lr.platform_trackings IS NOT NULL
  AND array_length(lr.platform_trackings, 1) > 0
  AND (pt->>'platform') IS NOT NULL AND (pt->>'platform') != '';

  -- 获取最常用的平台
  SELECT platform_name, usage_count
  INTO v_most_used_platform, v_most_used_count
  FROM public.get_all_platform_tracking_platforms()
  LIMIT 1;

  RETURN QUERY
  SELECT
    v_total_records,
    v_total_platform_mentions,
    v_total_tracking_numbers,
    v_unique_platforms,
    v_most_used_platform,
    v_most_used_count;
END;
$$;

-- 4. 更新运单平台运单信息的函数
CREATE OR REPLACE FUNCTION public.update_logistics_record_platform_trackings(
  p_logistics_record_id UUID,
  p_platform_trackings JSONB[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_trackings JSONB[] := '{}'::JSONB[];
  pt_item JSONB;
  cleaned_tracking_numbers TEXT[];
BEGIN
  IF p_platform_trackings IS NOT NULL THEN
    FOR pt_item IN SELECT * FROM jsonb_array_elements(p_platform_trackings)
    LOOP
      -- 清理平台名称
      IF pt_item->>'platform' IS NOT NULL AND trim(pt_item->>'platform') != '' THEN
        -- 清理运单号数组
        cleaned_tracking_numbers := ARRAY(
          SELECT DISTINCT trim(tn)
          FROM jsonb_array_elements_text(pt_item->'trackingNumbers') AS tn
          WHERE trim(tn) != ''
        );
        cleaned_trackings := cleaned_trackings || jsonb_build_object(
          'platform', trim(pt_item->>'platform'),
          'trackingNumbers', to_jsonb(cleaned_tracking_numbers)
        );
      END IF;
    END LOOP;
  END IF;

  UPDATE public.logistics_records
  SET platform_trackings = cleaned_trackings
  WHERE id = p_logistics_record_id;

  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- ===========================================
-- 第四部分：创建触发器函数
-- ===========================================

-- 创建触发器函数：自动清理平台运单信息
CREATE OR REPLACE FUNCTION public.clean_platform_trackings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned_trackings JSONB[] := '{}'::JSONB[];
  pt_item JSONB;
  cleaned_tracking_numbers TEXT[];
BEGIN
  IF NEW.platform_trackings IS NOT NULL THEN
    FOR pt_item IN SELECT * FROM jsonb_array_elements(NEW.platform_trackings)
    LOOP
      -- 清理平台名称
      IF pt_item->>'platform' IS NOT NULL AND trim(pt_item->>'platform') != '' THEN
        -- 清理运单号数组
        cleaned_tracking_numbers := ARRAY(
          SELECT DISTINCT trim(tn)
          FROM jsonb_array_elements_text(pt_item->'trackingNumbers') AS tn
          WHERE trim(tn) != ''
        );
        cleaned_trackings := cleaned_trackings || jsonb_build_object(
          'platform', trim(pt_item->>'platform'),
          'trackingNumbers', to_jsonb(cleaned_tracking_numbers)
        );
      END IF;
    END LOOP;
  END IF;

  -- 如果清理后为空数组，设置为NULL
  IF array_length(cleaned_trackings, 1) IS NULL THEN
    NEW.platform_trackings := NULL;
  ELSE
    NEW.platform_trackings := cleaned_trackings;
  END IF;

  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_clean_platform_trackings ON public.logistics_records;
CREATE TRIGGER trigger_clean_platform_trackings
  BEFORE INSERT OR UPDATE ON public.logistics_records
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_platform_trackings();

-- ===========================================
-- 第五部分：更新批量导入函数
-- ===========================================

CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_inserted_ids uuid[];
    v_success_count integer;
    v_error_count integer;
BEGIN
    -- 使用公共表表达式(CTE)进行高性能、无冲突的集合式处理
    WITH
    -- 步骤1: 解析并结构化所有传入的JSON记录，并使用窗口函数预分配当日序号
    parsed_data AS (
        SELECT
            (rec->>'project_name')::text AS project_name,
            (rec->>'driver_name')::text AS driver_name,
            (rec->>'license_plate')::text AS license_plate,
            (rec->>'driver_phone')::text AS driver_phone,
            (rec->>'loading_location')::text AS loading_location,
            (rec->>'unloading_location')::text AS unloading_location,
            (rec->>'loading_date')::date AS loading_date,
            COALESCE(NULLIF(rec->>'unloading_date', ''), rec->>'loading_date')::date AS unloading_date,
            NULLIF(rec->>'loading_weight', '')::numeric AS loading_weight,
            NULLIF(rec->>'unloading_weight', '')::numeric AS unloading_weight,
            COALESCE((rec->>'current_cost')::numeric, 0) AS current_cost,
            COALESCE((rec->>'extra_cost')::numeric, 0) AS extra_cost,
            COALESCE(rec->>'transport_type', '实际运输')::text AS transport_type,
            (rec->>'remarks')::text AS remarks,
            (rec->>'chain_name')::text AS chain_name,
            -- 处理新的平台运单信息字段
            CASE 
                WHEN rec->'platform_trackings' IS NOT NULL AND jsonb_array_length(rec->'platform_trackings') > 0 THEN
                    rec->'platform_trackings'
                ELSE NULL
            END AS platform_trackings,
            ROW_NUMBER() OVER(PARTITION BY (rec->>'loading_date')::date ORDER BY (rec->>'driver_name')) AS daily_row_num
        FROM jsonb_array_elements(p_records) AS rec
    ),
    -- 步骤2: 获取项目信息，用于关联司机和地点
    projects_info AS (
        SELECT DISTINCT pd.project_name, p.id as project_id
        FROM parsed_data pd
        JOIN public.projects p ON pd.project_name = p.name
    ),
    -- 步骤3: 批量创建本次导入需要用到的所有"司机"，确保关联到正确的项目
    inserted_drivers AS (
        INSERT INTO public.drivers (name, license_plate, phone, user_id)
        SELECT DISTINCT driver_name, license_plate, driver_phone, auth.uid() FROM parsed_data
        ON CONFLICT (name, license_plate) DO NOTHING
    ),
    -- 步骤4: 为司机关联项目（确保司机与项目的关联）
    driver_project_links AS (
        INSERT INTO public.driver_projects (driver_id, project_id, user_id)
        SELECT DISTINCT d.id, pi.project_id, auth.uid()
        FROM parsed_data pd
        JOIN projects_info pi ON pd.project_name = pi.project_name
        JOIN public.drivers d ON pd.driver_name = d.name AND pd.license_plate = d.license_plate
        ON CONFLICT (driver_id, project_id) DO NOTHING
    ),
    -- 步骤5: 批量创建本次导入需要用到的所有"地点"
    inserted_locations AS (
        INSERT INTO public.locations (name, user_id)
        SELECT DISTINCT location_name, auth.uid() FROM (
            SELECT loading_location AS location_name FROM parsed_data
            UNION
            SELECT unloading_location AS location_name FROM parsed_data
        ) AS all_locations
        ON CONFLICT (name) DO NOTHING
    ),
    -- 步骤6: 为地点关联项目（确保地点与项目的关联）
    location_project_links AS (
        INSERT INTO public.location_projects (location_id, project_id, user_id)
        SELECT DISTINCT l.id, pi.project_id, auth.uid()
        FROM (
            SELECT pd.project_name, pd.loading_location AS location_name FROM parsed_data pd
            UNION
            SELECT pd.project_name, pd.unloading_location AS location_name FROM parsed_data pd
        ) AS all_project_locations
        JOIN projects_info pi ON all_project_locations.project_name = pi.project_name
        JOIN public.locations l ON all_project_locations.location_name = l.name
        ON CONFLICT (location_id, project_id) DO NOTHING
    ),
    -- 步骤7: 查找每一天在数据库中已存在的最大运单序号
    daily_max_sequence AS (
        SELECT
            d.loading_date,
            COALESCE(MAX(substring(lr.auto_number from 12)::integer), 0) AS max_seq
        FROM (SELECT DISTINCT loading_date FROM parsed_data) d
        LEFT JOIN public.logistics_records lr ON lr.loading_date = d.loading_date AND lr.auto_number LIKE 'YDN%'
        GROUP BY d.loading_date
    ),
    -- 步骤8: 关联所有数据，生成最终要插入的记录集合，包括billing_type_id
    final_records AS (
        SELECT
            'YDN' || to_char(pd.loading_date, 'YYYYMMDD') || '-' ||
            lpad((dms.max_seq + pd.daily_row_num)::text, 3, '0') AS auto_number,
            proj.id AS project_id,
            pd.project_name,
            pc.id AS chain_id,
            COALESCE(pc.billing_type_id, 1) AS billing_type_id, -- 获取链路的billing_type_id
            drv.id AS driver_id,
            pd.driver_name,
            pd.loading_location,
            pd.unloading_location,
            pd.loading_date,
            pd.unloading_date,
            pd.loading_weight,
            pd.unloading_weight,
            pd.current_cost,
            pd.extra_cost,
            pd.license_plate,
            pd.driver_phone,
            pd.transport_type,
            pd.remarks,
            (pd.current_cost + pd.extra_cost) AS payable_cost,
            auth.uid() AS created_by_user_id,
            pd.platform_trackings
        FROM parsed_data pd
        INNER JOIN public.projects proj ON pd.project_name = proj.name
        INNER JOIN public.drivers drv ON pd.driver_name = drv.name AND pd.license_plate = drv.license_plate
        INNER JOIN daily_max_sequence dms ON pd.loading_date = dms.loading_date
        LEFT JOIN public.partner_chains pc ON pd.chain_name = pc.chain_name AND proj.id = pc.project_id
    ),
    -- 步骤9: 执行最终的批量插入
    inserted_logistics_records AS (
        INSERT INTO public.logistics_records (
            auto_number, project_id, project_name, chain_id, billing_type_id, driver_id, driver_name,
            loading_location, unloading_location, loading_date, unloading_date,
            loading_weight, unloading_weight, current_cost, extra_cost,
            license_plate, driver_phone, transport_type, remarks, payable_cost,
            created_by_user_id, platform_trackings
        )
        SELECT * FROM final_records
        ON CONFLICT (auto_number) DO NOTHING
        RETURNING id
    )
    SELECT array_agg(id) INTO v_inserted_ids FROM inserted_logistics_records;

    -- 步骤10: 批量触发成本更新计算
    IF array_length(v_inserted_ids, 1) > 0 THEN
        PERFORM public.recalculate_and_update_costs_for_records(v_inserted_ids);
    END IF;

    -- 步骤11: 计算并返回最终结果
    v_success_count := COALESCE(array_length(v_inserted_ids, 1), 0);
    v_error_count := jsonb_array_length(p_records) - v_success_count;

    RETURN jsonb_build_object(
        'success_count', v_success_count,
        'error_count', v_error_count,
        'errors', '[]'::jsonb
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success_count', 0,
            'error_count', jsonb_array_length(p_records),
            'errors', jsonb_build_object('error', 'Batch operation failed: ' || SQLERRM)
        );
END;
$$;

-- ===========================================
-- 第六部分：添加函数注释
-- ===========================================

COMMENT ON FUNCTION public.get_logistics_records_by_platform_tracking(TEXT, TEXT) IS '根据平台名称和可选的运单号查询运单记录';
COMMENT ON FUNCTION public.get_all_platform_tracking_platforms() IS '获取所有使用过的平台名称及其使用次数';
COMMENT ON FUNCTION public.get_platform_tracking_usage_statistics() IS '获取平台运单使用情况统计';
COMMENT ON FUNCTION public.update_logistics_record_platform_trackings(UUID, JSONB[]) IS '更新运单的平台运单信息';
COMMENT ON FUNCTION public.batch_import_logistics_records(jsonb) IS '批量导入运单记录，支持平台运单信息等可选字段';

-- ===========================================
-- 完成提示
-- ===========================================

SELECT '平台运单信息字段和相关函数、触发器更新完成！' as message;

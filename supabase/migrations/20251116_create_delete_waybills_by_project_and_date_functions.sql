-- ============================================================================
-- 创建按项目和日期范围删除运单的函数
-- 创建日期：2025-11-16
-- 功能：支持按项目和日期范围筛选并删除运单记录
-- ============================================================================

-- ============================================================================
-- 1. 预览删除数量的函数（返回运单列表）
-- ============================================================================

-- 删除旧版本的函数（如果存在）
DROP FUNCTION IF EXISTS public.preview_delete_waybills(TEXT, DATE, DATE, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.preview_delete_waybills(TEXT, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.preview_delete_waybills(
    p_project_name TEXT,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_project_id UUID;
    v_count INTEGER;
    v_waybills JSONB;
    v_total_pages INTEGER;
    v_offset INTEGER;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- 查找项目ID
    SELECT id INTO v_project_id
    FROM public.projects
    WHERE name = p_project_name;

    -- 如果找不到项目ID，返回错误
    IF v_project_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '找不到名为 "' || p_project_name || '" 的项目',
            'count', 0,
            'waybills', '[]'::jsonb,
            'total_pages', 0,
            'current_page', 0
        );
    END IF;

    -- 转换日期参数：将 TEXT 转换为 DATE，空字符串或 NULL 转换为 NULL
    v_start_date := CASE 
        WHEN p_start_date IS NULL OR p_start_date = '' THEN NULL 
        ELSE p_start_date::DATE 
    END;
    v_end_date := CASE 
        WHEN p_end_date IS NULL OR p_end_date = '' THEN NULL 
        ELSE p_end_date::DATE 
    END;

    -- 统计符合条件的运单数量
    -- ✅ 修复：使用 +08:00 时区转换，确保按中国时区日期进行比较
    -- 前端传递的是中国时区日期字符串（如 "2025-11-01"），需要转换为中国时区时间戳
    -- 数据库中的 loading_date 是 timestamptz（UTC存储），PostgreSQL会自动进行时区转换比较
    SELECT COUNT(*)
    INTO v_count
    FROM public.logistics_records
    WHERE project_id = v_project_id
      AND (v_start_date IS NULL OR 
           loading_date >= (v_start_date::text || ' 00:00:00+08:00')::timestamptz)
      AND (v_end_date IS NULL OR 
           loading_date < ((v_end_date::text || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'));

    -- 计算分页
    v_total_pages := CEIL(v_count::NUMERIC / NULLIF(p_page_size, 0));
    v_offset := (p_page - 1) * p_page_size;

    -- 查询运单列表（分页）
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'auto_number', auto_number,
            'project_name', project_name,
            'driver_name', driver_name,
            'license_plate', license_plate,
            'loading_location', loading_location,
            'unloading_location', unloading_location,
            'loading_date', loading_date,
            'unloading_date', unloading_date,
            'loading_weight', loading_weight,
            'unloading_weight', unloading_weight,
            'current_cost', current_cost,
            'extra_cost', extra_cost,
            'payable_cost', payable_cost,
            'transport_type', transport_type,
            'remarks', remarks
        )
    )
    INTO v_waybills
    FROM (
        SELECT 
            id, auto_number, project_name, driver_name, license_plate,
            loading_location, unloading_location, loading_date, unloading_date,
            loading_weight, unloading_weight, current_cost, extra_cost,
            payable_cost, transport_type, remarks
        FROM public.logistics_records
        WHERE project_id = v_project_id
          AND (v_start_date IS NULL OR 
               loading_date >= (v_start_date::text || ' 00:00:00+08:00')::timestamptz)
          AND (v_end_date IS NULL OR 
               loading_date < ((v_end_date::text || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
        ORDER BY loading_date DESC, auto_number
        LIMIT p_page_size
        OFFSET v_offset
    ) AS paginated_records;

    RETURN jsonb_build_object(
        'success', true,
        'count', COALESCE(v_count, 0),
        'waybills', COALESCE(v_waybills, '[]'::jsonb),
        'total_pages', COALESCE(v_total_pages, 0),
        'current_page', p_page,
        'page_size', p_page_size,
        'project_name', p_project_name,
        'start_date', p_start_date,
        'end_date', p_end_date
    );
END;
$$;

COMMENT ON FUNCTION public.preview_delete_waybills IS '预览符合条件的运单列表（按项目和日期范围，支持分页）';

-- ============================================================================
-- 2. 删除运单的函数
-- ============================================================================

-- 删除旧版本的函数（如果存在）
DROP FUNCTION IF EXISTS public.delete_waybills_by_project_and_date(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.delete_waybills_by_project_and_date(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.delete_waybills_by_project_and_date(
    p_project_name TEXT,
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_project_id UUID;
    v_target_record_ids UUID[];
    v_original_record_ids UUID[];  -- 保存原始的目标运单ID列表
    v_deleted_logistics_count INTEGER := 0;
    v_deleted_costs_count INTEGER := 0;
    v_skipped_count INTEGER := 0;  -- 跳过的运单数量
    v_start_date DATE;
    v_end_date DATE;
    v_message TEXT;  -- 用于构建返回消息
BEGIN
    -- ========== 第1步：验证项目 ==========
    SELECT id INTO v_project_id
    FROM public.projects
    WHERE name = p_project_name;

    IF v_project_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '找不到名为 "' || p_project_name || '" 的项目',
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
    END IF;

    -- 转换日期参数：将 TEXT 转换为 DATE，空字符串或 NULL 转换为 NULL
    v_start_date := CASE 
        WHEN p_start_date IS NULL OR p_start_date = '' THEN NULL 
        ELSE p_start_date::DATE 
    END;
    v_end_date := CASE 
        WHEN p_end_date IS NULL OR p_end_date = '' THEN NULL 
        ELSE p_end_date::DATE 
    END;

    -- ========== 第2步：查找符合条件的运单ID ==========
    -- ✅ 修复：使用 +08:00 时区转换，确保按中国时区日期进行比较
    -- 前端传递的是中国时区日期字符串（如 "2025-11-01"），需要转换为中国时区时间戳
    -- 数据库中的 loading_date 是 timestamptz（UTC存储），PostgreSQL会自动进行时区转换比较
    SELECT array_agg(id)
    INTO v_target_record_ids
    FROM public.logistics_records
    WHERE project_id = v_project_id
      AND (v_start_date IS NULL OR 
           loading_date >= (v_start_date::text || ' 00:00:00+08:00')::timestamptz)
      AND (v_end_date IS NULL OR 
           loading_date < ((v_end_date::text || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'));

    -- 如果没有找到任何运单记录，返回提示
    IF v_target_record_ids IS NULL OR array_length(v_target_record_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', '没有找到符合条件的运单记录，无需删除',
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0,
            'skipped_count', 0
        );
    END IF;

    -- 保存原始的目标运单ID列表（用于计算跳过的数量）
    v_original_record_ids := v_target_record_ids;

    -- ========== 第3步：筛选可删除的运单 ==========
    -- ✅ 修复：只删除那些未关联付款申请和发票申请的运单
    -- 找出所有关联了未完成付款申请或发票申请的运单ID
    WITH protected_record_ids AS (
        -- 找出关联了未完成付款申请的运单ID
        SELECT DISTINCT unnest(pr.logistics_record_ids) AS record_id
        FROM public.payment_requests pr
        WHERE pr.logistics_record_ids && v_target_record_ids
          AND pr.status IN ('Pending', 'Approved')
        
        UNION
        
        -- 找出关联了未完成发票申请的运单ID
        SELECT DISTINCT ird.logistics_record_id AS record_id
        FROM public.invoice_requests ir
        JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
        WHERE ird.logistics_record_id = ANY(v_target_record_ids)
          AND ir.status IN ('Pending', 'Approved')
    ),
    deletable_record_ids AS (
        -- 从目标运单ID中排除受保护的运单ID
        SELECT id
        FROM unnest(v_target_record_ids) AS id
        WHERE id NOT IN (SELECT record_id FROM protected_record_ids)
    )
    SELECT array_agg(id)
    INTO v_target_record_ids
    FROM deletable_record_ids;

    -- 计算跳过的运单数量
    v_skipped_count := array_length(v_original_record_ids, 1) - COALESCE(array_length(v_target_record_ids, 1), 0);

    -- 如果没有可删除的运单，返回提示
    IF v_target_record_ids IS NULL OR array_length(v_target_record_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('所有选中的 %s 条运单都关联了未完成的付款申请或发票申请，无法删除。请先完成或取消相关申请。', v_skipped_count),
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0,
            'skipped_count', v_skipped_count
        );
    END IF;

    -- ========== 第4步：删除关联的成本记录 ==========
    WITH deleted_rows AS (
        DELETE FROM public.logistics_partner_costs
        WHERE logistics_record_id = ANY(v_target_record_ids)
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_costs_count FROM deleted_rows;

    -- ========== 第5步：删除运单记录 ==========
    WITH deleted_rows AS (
        DELETE FROM public.logistics_records
        WHERE id = ANY(v_target_record_ids)
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_logistics_count FROM deleted_rows;

    -- ========== 第6步：返回结果 ==========
    -- 构建消息：如果有跳过的运单，在消息中说明
    IF v_skipped_count > 0 THEN
        v_message := format('成功删除 %s 条运单记录和 %s 条成本记录。跳过了 %s 条关联了未完成申请的运单。', 
                           v_deleted_logistics_count, 
                           v_deleted_costs_count,
                           v_skipped_count);
    ELSE
        v_message := format('成功删除 %s 条运单记录和 %s 条成本记录', 
                           v_deleted_logistics_count, 
                           v_deleted_costs_count);
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', v_message,
        'deleted_logistics_count', v_deleted_logistics_count,
        'deleted_costs_count', v_deleted_costs_count,
        'skipped_count', v_skipped_count,
        'project_name', p_project_name,
        'start_date', p_start_date,
        'end_date', p_end_date
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '删除运单时发生错误: ' || SQLERRM,
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
END;
$$;

COMMENT ON FUNCTION public.delete_waybills_by_project_and_date IS '按项目和日期范围删除运单记录（包含安全检查）';


-- ============================================================================
-- 创建财务对账函数 _1120 版本
-- 创建日期：2025-11-20
-- 功能：基于 _1116 版本创建 _1120 版本的财务对账函数，支持对账状态筛选
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_finance_reconciliation_by_partner_1120(
    -- 常规筛选参数
    p_project_id text DEFAULT NULL,  -- ✅ 支持逗号分隔的多个 UUID
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_partner_id uuid DEFAULT NULL,
    
    -- 分页参数
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 50,
    
    -- 高级筛选参数
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    
    -- 对账状态筛选（新增）
    p_reconciliation_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_offset integer;
    v_result jsonb;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_ids uuid[];  -- ✅ 存储解析后的项目ID数组
    v_total_count integer;
    v_total_pages integer;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- ✅ 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
    -- 解析批量输入参数（支持逗号、空格或混合分隔）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\s]+');
        v_waybill_array := array_remove(v_waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
        v_driver_array := array_remove(v_driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
        v_license_array := array_remove(v_license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;

    -- 主查询：筛选运单记录
    WITH filtered_records AS (
        SELECT DISTINCT lr.id
        FROM public.logistics_records lr
        WHERE 
            -- 基础筛选
            -- ✅ 修改：项目筛选（支持多个项目ID）
            (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
            AND (p_start_date IS NULL OR lr.loading_date::date >= p_start_date)
            AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date)
            AND (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = lr.id 
                AND lpc.partner_id = p_partner_id
            ))
            -- 高级筛选：司机姓名（支持批量）
            AND (v_driver_array IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_driver_array) AS driver
                   WHERE lr.driver_name ILIKE '%' || driver || '%'
                 ))
            -- 高级筛选：车牌号（支持批量）
            AND (v_license_array IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_license_array) AS license
                   WHERE lr.license_plate ILIKE '%' || license || '%'
                 ))
            -- 高级筛选：司机电话（支持批量）
            AND (v_phone_array IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_phone_array) AS phone
                   WHERE lr.driver_phone ILIKE '%' || phone || '%'
                 ))
            -- 高级筛选：运单编号（支持批量，查询本平台和其他平台运单号）
            AND (v_waybill_array IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_waybill_array) AS wb_num
                   WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                      OR EXISTS (
                           SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                           WHERE ext_num ILIKE '%' || wb_num || '%'
                         )
                 ))
            -- 高级筛选：其他平台名称
            AND (p_other_platform_name IS NULL OR 
                 (p_other_platform_name = '本平台' AND (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) = 0))
                 OR (p_other_platform_name != '本平台' AND p_other_platform_name = ANY(lr.other_platform_names))
            )
            -- 对账状态筛选（新增）
            AND (p_reconciliation_status IS NULL OR p_reconciliation_status = '' OR
                 EXISTS (
                   SELECT 1 FROM public.logistics_partner_costs lpc
                   WHERE lpc.logistics_record_id = lr.id
                   AND lpc.reconciliation_status = p_reconciliation_status
                 )
            )
    ),
    paginated_records AS (
        SELECT id
        FROM filtered_records
        ORDER BY id DESC
        LIMIT p_page_size
        OFFSET v_offset
    ),
    total_count_cte AS (
        SELECT COUNT(*) as count
        FROM filtered_records
    )
    SELECT 
        jsonb_build_object(
            'records', COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', lr.id,
                        'auto_number', lr.auto_number,
                        'project_name', lr.project_name,
                        'driver_name', lr.driver_name,
                        'loading_location', lr.loading_location,
                        'unloading_location', lr.unloading_location,
                        'loading_date', TO_CHAR(lr.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD'),
                        'unloading_date', CASE WHEN lr.unloading_date IS NOT NULL 
                            THEN TO_CHAR(lr.unloading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') 
                            ELSE NULL END,
                        'loading_weight', lr.loading_weight,
                        'unloading_weight', lr.unloading_weight,
                        'current_cost', lr.current_cost,
                        'payable_cost', lr.payable_cost,
                        'extra_cost', lr.extra_cost,
                        'license_plate', lr.license_plate,
                        'driver_phone', lr.driver_phone,
                        'transport_type', lr.transport_type,
                        'remarks', lr.remarks,
                        'chain_name', pc.chain_name,
                        'billing_type_id', lr.billing_type_id,
                        'partner_costs', COALESCE(
                            (SELECT jsonb_agg(
                                jsonb_build_object(
                                    'partner_id', lpc.partner_id,
                                    'partner_name', p.name,
                                    'level', lpc.level,
                                    'payable_amount', lpc.payable_amount,
                                    -- ✅ 新增：对账状态相关字段
                                    'reconciliation_status', COALESCE(lpc.reconciliation_status, 'Unreconciled'),
                                    'reconciliation_date', CASE WHEN lpc.reconciliation_date IS NOT NULL
                                        THEN TO_CHAR(lpc.reconciliation_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS')
                                        ELSE NULL END,
                                    'reconciliation_notes', lpc.reconciliation_notes,
                                    'cost_id', lpc.id  -- 用于对账操作
                                ) ORDER BY lpc.level
                            )
                            FROM public.logistics_partner_costs lpc
                            JOIN public.partners p ON lpc.partner_id = p.id
                            WHERE lpc.logistics_record_id = lr.id),
                            '[]'::jsonb
                        )
                    ) ORDER BY lr.auto_number DESC
                )
                FROM paginated_records pr
                JOIN public.logistics_records lr ON pr.id = lr.id
                LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id),
                '[]'::jsonb
            ),
            'overview', jsonb_build_object(
                'total_records', (SELECT count FROM total_count_cte),
                'total_freight', COALESCE(
                    (SELECT SUM(lr.current_cost)
                     FROM filtered_records fr
                     JOIN public.logistics_records lr ON fr.id = lr.id),
                    0
                ),
                'total_extra_cost', COALESCE(
                    (SELECT SUM(lr.extra_cost)
                     FROM filtered_records fr
                     JOIN public.logistics_records lr ON fr.id = lr.id),
                    0
                ),
                'total_driver_receivable', COALESCE(
                    (SELECT SUM(lr.payable_cost)
                     FROM filtered_records fr
                     JOIN public.logistics_records lr ON fr.id = lr.id),
                    0
                )
            ),
            'partner_summary', COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'partner_id', partner_id,
                        'partner_name', partner_name,
                        'level', level,
                        'records_count', records_count,
                        'total_payable', total_payable
                    )
                )
                FROM (
                    SELECT 
                        lpc.partner_id,
                        p.name as partner_name,
                        pp.level,
                        COUNT(DISTINCT lpc.logistics_record_id) as records_count,
                        SUM(lpc.payable_amount) as total_payable
                    FROM filtered_records fr
                    JOIN public.logistics_partner_costs lpc ON fr.id = lpc.logistics_record_id
                    JOIN public.partners p ON lpc.partner_id = p.id
                    LEFT JOIN public.project_partners pp ON lpc.partner_id = pp.partner_id 
                        AND EXISTS (SELECT 1 FROM public.logistics_records lr2 WHERE lr2.id = lpc.logistics_record_id AND lr2.project_id = pp.project_id)
                    GROUP BY lpc.partner_id, p.name, pp.level
                ) partner_stats),
                '[]'::jsonb
            ),
            'count', (SELECT count FROM total_count_cte),
            'total_pages', CEIL((SELECT count FROM total_count_cte)::numeric / NULLIF(p_page_size, 1))
        )
    INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_finance_reconciliation_by_partner_1120 IS 
'获取运费对账数据，支持多个 project_id（逗号分隔的 UUID 字符串）、高级筛选和对账状态筛选（_1120版本）';

-- ============================================================================
-- 验证
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 财务对账函数 _1120 版本已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已创建函数：';
    RAISE NOTICE '  • get_finance_reconciliation_by_partner_1120';
    RAISE NOTICE '';
    RAISE NOTICE '功能特性：';
    RAISE NOTICE '  • 支持多个 project_id（逗号分隔）';
    RAISE NOTICE '  • 支持高级筛选（司机、车牌、电话、运单号、平台）';
    RAISE NOTICE '  • 支持对账状态筛选';
    RAISE NOTICE '  • 返回对账状态相关字段';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;


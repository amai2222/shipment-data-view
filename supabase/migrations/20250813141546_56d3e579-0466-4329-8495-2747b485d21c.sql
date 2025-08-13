-- 删除所有重复的函数并重新创建标准版本
DROP FUNCTION IF EXISTS public.get_finance_reconciliation_data_paginated(uuid, text, text, uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_finance_reconciliation_data_paginated(uuid, uuid, text, text, integer, integer);

-- 创建标准的分页函数，确保参数顺序一致
CREATE OR REPLACE FUNCTION public.get_finance_reconciliation_data_paginated(
    p_project_id uuid DEFAULT NULL,
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_partner_id uuid DEFAULT NULL,
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    result_json jsonb;
    v_offset integer;
    total_count integer;
    filtered_record_ids uuid[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 1. 首先获取过滤后的总记录数和ID列表（用于概览统计）
    WITH filtered_base AS (
        SELECT lr.id
        FROM logistics_records lr
        LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_project_id IS NULL OR lr.project_id = p_project_id) AND
            (p_start_date IS NULL OR lr.loading_date::date >= p_start_date::date) AND
            (p_end_date IS NULL OR lr.loading_date::date <= p_end_date::date) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = lr.id AND lpc.partner_id = p_partner_id
            ))
    )
    SELECT 
        COUNT(*),
        ARRAY_AGG(id)
    INTO total_count, filtered_record_ids
    FROM filtered_base;

    -- 2. 构建分页结果
    SELECT jsonb_build_object(
        'overview', (
            SELECT jsonb_build_object(
                'total_records', COALESCE(total_count, 0),
                'total_current_cost', COALESCE(SUM(current_cost), 0),
                'total_extra_cost', COALESCE(SUM(extra_cost), 0),
                'total_payable_cost', COALESCE(SUM(payable_cost), 0)
            )
            FROM logistics_records
            WHERE id = ANY(COALESCE(filtered_record_ids, '{}'))
        ),
        'partner_payables', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.partner_name), '[]'::jsonb) FROM (
                SELECT
                    lpc.partner_id, p.name AS partner_name,
                    COUNT(lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM logistics_partner_costs lpc
                JOIN partners p ON lpc.partner_id = p.id
                WHERE lpc.logistics_record_id = ANY(COALESCE(filtered_record_ids, '{}'))
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.loading_date DESC), '[]'::jsonb) FROM (
                SELECT
                    lr.id, lr.auto_number, lr.project_name, lr.driver_name, 
                    lr.loading_location, lr.unloading_location,
                    to_char(lr.loading_date, 'YYYY-MM-DD') AS loading_date,
                    to_char(lr.unloading_date, 'YYYY-MM-DD') AS unloading_date,
                    lr.loading_weight, lr.unloading_weight, lr.current_cost, 
                    lr.payable_cost, lr.extra_cost, lr.license_plate, 
                    lr.driver_phone, lr.transport_type, lr.remarks,
                    lr.billing_type_id,
                    pc.chain_name,
                    (SELECT COALESCE(jsonb_agg(sub ORDER BY sub.level), '[]'::jsonb) FROM (
                        SELECT lpc.partner_id, par.name AS partner_name, lpc.level, lpc.payable_amount
                        FROM logistics_partner_costs lpc
                        JOIN partners par ON lpc.partner_id = par.id
                        WHERE lpc.logistics_record_id = lr.id
                     ) sub
                    ) AS partner_costs
                FROM logistics_records lr
                LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
                WHERE lr.id = ANY(COALESCE(filtered_record_ids, '{}'))
                ORDER BY lr.loading_date DESC
                LIMIT p_page_size
                OFFSET v_offset
            ) t
        ),
        'count', COALESCE(total_count, 0),
        'total_pages', CASE 
            WHEN total_count = 0 THEN 1 
            ELSE CEIL(total_count::float / p_page_size::float)::integer 
        END,
        'current_page', p_page_number
    )
    INTO result_json;

    RETURN result_json;
END;
$$;
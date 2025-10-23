-- ==========================================
-- 同步 logistics_records 状态到 logistics_partner_costs
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 当 logistics_records 的 payment_status 或 invoice_status 改变时，
--       自动同步更新 logistics_partner_costs 表中对应记录的状态
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 创建同步状态的触发器函数
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_logistics_status_to_partner_costs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 检查 payment_status 是否改变
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        UPDATE public.logistics_partner_costs
        SET 
            payment_status = NEW.payment_status,
            payment_applied_at = CASE 
                WHEN NEW.payment_status = 'Processing' AND OLD.payment_status = 'Unpaid' THEN NOW()
                ELSE payment_applied_at
            END,
            payment_completed_at = CASE 
                WHEN NEW.payment_status = 'Paid' AND OLD.payment_status != 'Paid' THEN NOW()
                WHEN NEW.payment_status != 'Paid' THEN NULL
                ELSE payment_completed_at
            END,
            updated_at = NOW()
        WHERE logistics_record_id = NEW.id;
        
        RAISE NOTICE '已同步 payment_status: % -> % 到 % 条合作方成本记录', 
            OLD.payment_status, NEW.payment_status, 
            (SELECT COUNT(*) FROM public.logistics_partner_costs WHERE logistics_record_id = NEW.id);
    END IF;
    
    -- 检查 invoice_status 是否改变
    IF OLD.invoice_status IS DISTINCT FROM NEW.invoice_status THEN
        UPDATE public.logistics_partner_costs
        SET 
            invoice_status = NEW.invoice_status,
            invoice_applied_at = CASE 
                WHEN NEW.invoice_status = 'Processing' AND OLD.invoice_status = 'Uninvoiced' THEN NOW()
                ELSE invoice_applied_at
            END,
            invoice_completed_at = CASE 
                WHEN NEW.invoice_status = 'Invoiced' AND OLD.invoice_status != 'Invoiced' THEN NOW()
                WHEN NEW.invoice_status != 'Invoiced' THEN NULL
                ELSE invoice_completed_at
            END,
            updated_at = NOW()
        WHERE logistics_record_id = NEW.id;
        
        RAISE NOTICE '已同步 invoice_status: % -> % 到 % 条合作方成本记录', 
            OLD.invoice_status, NEW.invoice_status, 
            (SELECT COUNT(*) FROM public.logistics_partner_costs WHERE logistics_record_id = NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_logistics_status_to_partner_costs IS '同步 logistics_records 的状态变化到 logistics_partner_costs 表';

-- ============================================================
-- 第二步: 创建触发器
-- ============================================================

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_sync_logistics_status_to_partner_costs ON public.logistics_records;

-- 创建新的触发器
CREATE TRIGGER trigger_sync_logistics_status_to_partner_costs
    AFTER UPDATE OF payment_status, invoice_status ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_logistics_status_to_partner_costs();

COMMENT ON TRIGGER trigger_sync_logistics_status_to_partner_costs ON public.logistics_records IS '当 logistics_records 的 payment_status 或 invoice_status 改变时，自动同步到 logistics_partner_costs';

-- ============================================================
-- 第三步: 创建修复合作方付款申请数据函数（使用 logistics_records 的状态）
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_payment_request_data(
    p_project_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_payment_status_array TEXT[] DEFAULT NULL,
    p_page_size INTEGER DEFAULT 50,
    p_page_number INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result_json jsonb;
    v_offset integer;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    WITH filtered_records AS (
        SELECT v.*, lr.payment_status
        FROM public.logistics_records_view AS v
        JOIN public.logistics_records lr ON v.id = lr.id
        WHERE
            (p_project_id IS NULL OR v.project_id = p_project_id) AND
            (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
            (
                p_payment_status_array IS NULL OR
                array_length(p_payment_status_array, 1) IS NULL OR
                LOWER(lr.payment_status) = ANY(ARRAY(SELECT lower(unnest) FROM unnest(p_payment_status_array)))
            ) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = v.id AND lpc.partner_id = p_partner_id
            ))
    ),
    paginated_records AS (
        SELECT id
        FROM filtered_records
        ORDER BY loading_date DESC
        LIMIT p_page_size
        OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'count', (SELECT COUNT(*) FROM filtered_records),
        'overview', (
            SELECT jsonb_build_object(
                'total_records', COALESCE(COUNT(*), 0),
                'total_current_cost', COALESCE(SUM(current_cost), 0),
                'total_extra_cost', COALESCE(SUM(extra_cost), 0),
                'total_payable_cost', COALESCE(SUM(payable_cost), 0)
            )
            FROM filtered_records
        ),
        'partner_payables', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.partner_name), '[]'::jsonb) FROM (
                SELECT
                    lpc.partner_id, p.name AS partner_name,
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM public.logistics_partner_costs lpc
                JOIN public.partners p ON lpc.partner_id = p.id
                WHERE lpc.logistics_record_id IN (SELECT id FROM filtered_records)
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.loading_date DESC), '[]'::jsonb) FROM (
                SELECT
                    v.id, v.auto_number, v.project_name, v.driver_name, v.loading_location, v.unloading_location,
                    to_char(v.loading_date, 'YYYY-MM-DD') AS loading_date,
                    to_char(v.unloading_date, 'YYYY-MM-DD') AS unloading_date,
                    v.loading_weight, v.unloading_weight, v.current_cost, v.payable_cost, v.extra_cost,
                    v.license_plate, v.driver_phone, v.transport_type, v.remarks, v.chain_name,
                    lr.payment_status,  -- 使用 logistics_records 的 payment_status
                    v.billing_type_id,
                    (SELECT COALESCE(jsonb_agg(sub ORDER BY sub.level), '[]'::jsonb) FROM (
                        SELECT lpc.partner_id, par.name AS partner_name, lpc.level, lpc.payable_amount
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners par ON lpc.partner_id = par.id
                        WHERE lpc.logistics_record_id = v.id
                     ) sub
                    ) AS partner_costs
                FROM filtered_records v
                JOIN public.logistics_records lr ON v.id = lr.id
                WHERE v.id IN (SELECT id FROM paginated_records)
            ) t
        )
    )
    INTO result_json;

    RETURN result_json;
END;
$$;

COMMENT ON FUNCTION public.get_payment_request_data IS '获取合作方付款申请数据，使用 logistics_records 的状态作为主状态';

-- ============================================================
-- 第四步: 创建 get_payment_request_data_v2 函数（用于导出）
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_payment_request_data_v2(
    p_record_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result_json jsonb;
    v_can_view boolean := public.is_finance_or_admin();
BEGIN
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', v.id,
                'auto_number', v.auto_number,
                'project_name', v.project_name,
                'driver_name', v.driver_name,
                'loading_location', v.loading_location,
                'unloading_location', v.unloading_location,
                'loading_date', to_char(v.loading_date, 'YYYY-MM-DD'),
                'unloading_date', COALESCE(to_char(v.unloading_date, 'YYYY-MM-DD'), null),
                'loading_weight', v.loading_weight,
                'unloading_weight', v.unloading_weight,
                'current_cost', v.current_cost,
                'extra_cost', v.extra_cost,
                'payable_cost', v.payable_cost,
                'license_plate', v.license_plate,
                'driver_phone', v.driver_phone,
                'transport_type', v.transport_type,
                'remarks', v.remarks,
                'chain_name', v.chain_name,
                'cargo_type', lr.cargo_type,
                'payment_status', lr.payment_status,  -- 使用 logistics_records 的 payment_status
                'partner_costs', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'partner_id', lpc.partner_id,
                            'partner_name', p.name,
                            'level', lpc.level,
                            'payable_amount', lpc.payable_amount,
                            'full_name', CASE WHEN v_can_view THEN p.full_name ELSE NULL END,
                            'bank_account', CASE WHEN v_can_view THEN bd.bank_account ELSE NULL END,
                            'bank_name', CASE WHEN v_can_view THEN bd.bank_name ELSE NULL END,
                            'branch_name', CASE WHEN v_can_view THEN bd.branch_name ELSE NULL END
                        ) ORDER BY lpc.level
                    ), '[]'::jsonb)
                    FROM public.logistics_partner_costs lpc
                    JOIN public.partners p ON lpc.partner_id = p.id
                    LEFT JOIN public.partner_bank_details bd ON bd.partner_id = p.id
                    WHERE lpc.logistics_record_id = v.id
                )
            ) ORDER BY v.loading_date DESC
        ), '[]'::jsonb)
    )
    INTO result_json
    FROM public.logistics_records_view v
    JOIN public.logistics_records lr ON v.id = lr.id
    WHERE v.id = ANY(p_record_ids);

    RETURN result_json;
END;
$$;

COMMENT ON FUNCTION public.get_payment_request_data_v2 IS '获取指定运单记录的合作方付款申请数据，使用 logistics_records 的状态作为主状态';

-- ============================================================
-- 第五步: 同步现有数据的状态
-- ============================================================

-- 同步现有 logistics_partner_costs 的状态到与 logistics_records 一致
UPDATE public.logistics_partner_costs lpc
SET 
    payment_status = lr.payment_status,
    invoice_status = lr.invoice_status,
    payment_applied_at = CASE 
        WHEN lr.payment_status = 'Processing' AND lpc.payment_status = 'Unpaid' THEN NOW()
        ELSE lpc.payment_applied_at
    END,
    payment_completed_at = CASE 
        WHEN lr.payment_status = 'Paid' AND lpc.payment_status != 'Paid' THEN NOW()
        WHEN lr.payment_status != 'Paid' THEN NULL
        ELSE lpc.payment_completed_at
    END,
    invoice_applied_at = CASE 
        WHEN lr.invoice_status = 'Processing' AND lpc.invoice_status = 'Uninvoiced' THEN NOW()
        ELSE lpc.invoice_applied_at
    END,
    invoice_completed_at = CASE 
        WHEN lr.invoice_status = 'Invoiced' AND lpc.invoice_status != 'Invoiced' THEN NOW()
        WHEN lr.invoice_status != 'Invoiced' THEN NULL
        ELSE lpc.invoice_completed_at
    END,
    updated_at = NOW()
FROM public.logistics_records lr
WHERE lpc.logistics_record_id = lr.id
  AND (lpc.payment_status != lr.payment_status OR lpc.invoice_status != lr.invoice_status);

COMMIT;

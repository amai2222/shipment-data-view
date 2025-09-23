-- =============================================================================
-- 开票申请管理功能 - Supabase SQL编辑器执行命令
-- 执行顺序：按照注释中的步骤顺序执行
-- =============================================================================

-- =============================================================================
-- 步骤 1: 为logistics_partner_costs表添加开票和付款相关字段
-- =============================================================================

-- 1.1 添加状态字段
ALTER TABLE logistics_partner_costs 
ADD COLUMN IF NOT EXISTS invoice_status TEXT DEFAULT 'Uninvoiced' 
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));

ALTER TABLE logistics_partner_costs
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Unpaid' 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Paid'));

-- 1.2 添加时间戳字段
ALTER TABLE logistics_partner_costs
ADD COLUMN IF NOT EXISTS invoice_applied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invoice_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_applied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMP WITH TIME ZONE;

-- 1.3 添加关联字段
ALTER TABLE logistics_partner_costs
ADD COLUMN IF NOT EXISTS invoice_request_id UUID,
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS payment_request_id UUID,
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- =============================================================================
-- 步骤 2: 创建开票申请相关表
-- =============================================================================

-- 2.1 创建开票申请表
CREATE TABLE IF NOT EXISTS invoice_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    partner_name TEXT NOT NULL,
    partner_full_name TEXT,
    tax_number TEXT,
    company_address TEXT,
    bank_name TEXT,
    bank_account TEXT,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    record_count INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Invoiced')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    invoice_date DATE,
    invoice_number TEXT,
    remarks TEXT
);

-- 2.2 创建开票申请明细表
CREATE TABLE IF NOT EXISTS invoice_request_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_request_id UUID NOT NULL REFERENCES invoice_requests(id) ON DELETE CASCADE,
    logistics_record_id UUID NOT NULL REFERENCES logistics_records(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 步骤 3: 创建索引
-- =============================================================================

-- 3.1 为logistics_partner_costs新字段创建索引
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_invoice_status 
ON logistics_partner_costs(invoice_status);

CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_payment_status 
ON logistics_partner_costs(payment_status);

CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_partner_status 
ON logistics_partner_costs(partner_id, invoice_status, payment_status);

-- 3.2 为开票申请表创建索引
CREATE INDEX IF NOT EXISTS idx_invoice_requests_partner_id ON invoice_requests(partner_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_status ON invoice_requests(status);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_created_at ON invoice_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_request_details_request_id ON invoice_request_details(invoice_request_id);
CREATE INDEX IF NOT EXISTS idx_invoice_request_details_logistics_id ON invoice_request_details(logistics_record_id);

-- =============================================================================
-- 步骤 4: 为现有记录设置默认状态
-- =============================================================================

UPDATE logistics_partner_costs 
SET 
    invoice_status = 'Uninvoiced',
    payment_status = 'Unpaid'
WHERE invoice_status IS NULL OR payment_status IS NULL;

-- =============================================================================
-- 步骤 5: 创建生成开票申请单号的函数
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_request_number()
RETURNS TEXT AS $$
DECLARE
    current_date_str TEXT;
    sequence_num TEXT;
    request_number TEXT;
BEGIN
    current_date_str := to_char(NOW(), 'YYYYMMDD');
    
    SELECT LPAD(
        (COALESCE(MAX(CAST(RIGHT(request_number, 4) AS INTEGER)), 0) + 1)::TEXT, 
        4, 
        '0'
    ) INTO sequence_num
    FROM invoice_requests 
    WHERE request_number LIKE 'INV' || current_date_str || '%';
    
    request_number := 'INV' || current_date_str || sequence_num;
    
    RETURN request_number;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 步骤 6: 创建自动更新时间戳的触发器函数
-- =============================================================================

CREATE OR REPLACE FUNCTION update_partner_costs_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.invoice_status IS DISTINCT FROM NEW.invoice_status THEN
        IF NEW.invoice_status = 'Processing' AND OLD.invoice_status = 'Uninvoiced' THEN
            NEW.invoice_applied_at = NOW();
        ELSIF NEW.invoice_status = 'Invoiced' AND OLD.invoice_status = 'Processing' THEN
            NEW.invoice_completed_at = NOW();
        END IF;
    END IF;
    
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        IF NEW.payment_status = 'Processing' AND OLD.payment_status = 'Unpaid' THEN
            NEW.payment_applied_at = NOW();
        ELSIF NEW.payment_status = 'Paid' AND OLD.payment_status = 'Processing' THEN
            NEW.payment_completed_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_partner_costs_timestamps ON logistics_partner_costs;
CREATE TRIGGER trigger_update_partner_costs_timestamps
    BEFORE UPDATE ON logistics_partner_costs
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_costs_timestamps();

-- =============================================================================
-- 步骤 7: 创建运单状态汇总视图
-- =============================================================================

CREATE OR REPLACE VIEW logistics_records_status_summary AS
SELECT 
    lr.id as logistics_record_id,
    lr.auto_number,
    lr.project_name,
    lr.driver_name,
    lr.loading_date,
    CASE 
        WHEN COUNT(lpc.id) = 0 THEN 'No Partners'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Invoiced') = COUNT(lpc.id) THEN 'All Invoiced'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Processing') > 0 THEN 'Partially Processing'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Invoiced') > 0 THEN 'Partially Invoiced'
        ELSE 'Uninvoiced'
    END as overall_invoice_status,
    CASE 
        WHEN COUNT(lpc.id) = 0 THEN 'No Partners'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Paid') = COUNT(lpc.id) THEN 'All Paid'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Processing') > 0 THEN 'Partially Processing'
        WHEN COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Paid') > 0 THEN 'Partially Paid'
        ELSE 'Unpaid'
    END as overall_payment_status,
    COUNT(lpc.id) as total_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Uninvoiced') as uninvoiced_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Processing') as invoice_processing_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.invoice_status = 'Invoiced') as invoiced_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Unpaid') as unpaid_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Processing') as payment_processing_partners,
    COUNT(lpc.id) FILTER (WHERE lpc.payment_status = 'Paid') as paid_partners,
    COALESCE(SUM(lpc.payable_amount), 0) as total_payable_amount,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.invoice_status = 'Uninvoiced'), 0) as uninvoiced_amount,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.invoice_status = 'Invoiced'), 0) as invoiced_amount,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.payment_status = 'Unpaid'), 0) as unpaid_amount,
    COALESCE(SUM(lpc.payable_amount) FILTER (WHERE lpc.payment_status = 'Paid'), 0) as paid_amount
FROM logistics_records lr
LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
GROUP BY lr.id, lr.auto_number, lr.project_name, lr.driver_name, lr.loading_date;

-- =============================================================================
-- 步骤 6: 确保 partners 表有必要的开票字段
-- =============================================================================

-- 6.1 添加税号字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partners' 
        AND column_name = 'tax_number' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE partners ADD COLUMN tax_number TEXT;
        COMMENT ON COLUMN partners.tax_number IS '税号';
    END IF;
END $$;

-- 6.2 添加公司地址字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partners' 
        AND column_name = 'company_address' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE partners ADD COLUMN company_address TEXT;
        COMMENT ON COLUMN partners.company_address IS '公司地址';
    END IF;
END $$;

-- 6.3 添加开户银行字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partners' 
        AND column_name = 'bank_name' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE partners ADD COLUMN bank_name TEXT;
        COMMENT ON COLUMN partners.bank_name IS '开户银行';
    END IF;
END $$;

-- 6.4 添加银行账户字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'partners' 
        AND column_name = 'bank_account' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE partners ADD COLUMN bank_account TEXT;
        COMMENT ON COLUMN partners.bank_account IS '银行账户';
    END IF;
END $$;

-- =============================================================================
-- 步骤 7: 创建权限检查函数
-- =============================================================================

-- 7.1 创建开票申请专用的管理员检查函数
CREATE OR REPLACE FUNCTION public.is_admin_for_invoice(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = coalesce(_user_id, auth.uid())
      AND role = 'admin'
  );
$$;

-- 7.2 创建开票申请专用的财务或管理员检查函数
CREATE OR REPLACE FUNCTION public.is_finance_or_admin_for_invoice()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin','finance');
$$;

-- =============================================================================
-- 步骤 8: 创建开票申请数据查询函数
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_invoice_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json json;
    v_offset integer;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    WITH filtered_partner_costs AS (
        SELECT 
            lpc.*,
            lr.auto_number,
            lr.project_id,
            lr.project_name,
            lr.driver_id,
            lr.driver_name,
            lr.loading_location,
            lr.unloading_location,
            lr.loading_date,
            lr.unloading_date,
            lr.loading_weight,
            lr.unloading_weight,
            lr.cargo_type,
            lr.billing_type_id,
            lr.remarks,
            lr.current_cost,
            lr.extra_cost,
            d.license_plate,
            d.phone as driver_phone,
            p.name as partner_name,
            COALESCE(p.tax_number, NULL) as tax_number,
            COALESCE(p.company_address, NULL) as company_address,
            COALESCE(p.bank_name, NULL) as bank_name,
            COALESCE(p.bank_account, NULL) as bank_account,
            pc.chain_name
        FROM logistics_partner_costs lpc
        JOIN logistics_records lr ON lpc.logistics_record_id = lr.id
        JOIN partners p ON lpc.partner_id = p.id
        JOIN drivers d ON lr.driver_id = d.id
        LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_project_id IS NULL OR lr.project_id = p_project_id) AND
            (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
            (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
            (p_partner_id IS NULL OR lpc.partner_id = p_partner_id) AND
            (p_invoice_status_array IS NULL OR array_length(p_invoice_status_array, 1) IS NULL OR lpc.invoice_status = ANY(p_invoice_status_array))
    ),
    total_count AS (
        SELECT count(*) as count FROM filtered_partner_costs
    )
    SELECT json_build_object(
        'records', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', fpc.id,
                    'logistics_record_id', fpc.logistics_record_id,
                    'auto_number', fpc.auto_number,
                    'project_name', fpc.project_name,
                    'driver_id', fpc.driver_id,
                    'driver_name', fpc.driver_name,
                    'loading_location', fpc.loading_location,
                    'unloading_location', fpc.unloading_location,
                    'loading_date', fpc.loading_date,
                    'unloading_date', fpc.unloading_date,
                    'license_plate', fpc.license_plate,
                    'driver_phone', fpc.driver_phone,
                    'partner_id', fpc.partner_id,
                    'partner_name', fpc.partner_name,
                    'level', fpc.level,
                    'base_amount', fpc.base_amount,
                    'payable_amount', fpc.payable_amount,
                    'tax_rate', fpc.tax_rate,
                    'invoice_status', fpc.invoice_status,
                    'payment_status', fpc.payment_status,
                    'current_cost', fpc.current_cost,
                    'extra_cost', fpc.extra_cost,
                    'cargo_type', fpc.cargo_type,
                    'loading_weight', fpc.loading_weight,
                    'unloading_weight', fpc.unloading_weight,
                    'billing_type_id', fpc.billing_type_id,
                    'remarks', fpc.remarks,
                    'chain_name', fpc.chain_name,
                    'tax_number', fpc.tax_number,
                    'company_address', fpc.company_address,
                    'bank_name', fpc.bank_name,
                    'bank_account', fpc.bank_account
                )
            )
            FROM (
                SELECT * FROM filtered_partner_costs
                ORDER BY loading_date DESC, auto_number DESC, level ASC
                LIMIT p_page_size OFFSET v_offset
            ) fpc
        ), '[]'::json),
        'count', (SELECT count FROM total_count)
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

-- =============================================================================
-- 步骤 9: 创建获取未开票合作方成本记录ID的函数
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_filtered_uninvoiced_partner_cost_ids(
    p_project_id uuid DEFAULT NULL::uuid,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_partner_id uuid DEFAULT NULL::uuid
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_ids uuid[];
BEGIN
    SELECT array_agg(lpc.id)
    INTO result_ids
    FROM logistics_partner_costs lpc
    JOIN logistics_records lr ON lpc.logistics_record_id = lr.id
    WHERE
        lpc.invoice_status = 'Uninvoiced' AND
        (p_project_id IS NULL OR lr.project_id = p_project_id) AND
        (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
        (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
        (p_partner_id IS NULL OR lpc.partner_id = p_partner_id);

    RETURN COALESCE(result_ids, ARRAY[]::uuid[]);
END;
$function$;

-- =============================================================================
-- 步骤 10: 创建获取开票申请详细数据的函数
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_request_data_v2(p_partner_cost_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
BEGIN
    SELECT jsonb_build_object(
        'partner_costs', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', lpc.id,
                'logistics_record_id', lpc.logistics_record_id,
                'auto_number', lr.auto_number,
                'project_name', lr.project_name,
                'driver_name', lr.driver_name,
                'loading_location', lr.loading_location,
                'unloading_location', lr.unloading_location,
                'loading_date', to_char(lr.loading_date, 'YYYY-MM-DD'),
                'unloading_date', COALESCE(to_char(lr.unloading_date, 'YYYY-MM-DD'), null),
                'loading_weight', lr.loading_weight,
                'unloading_weight', lr.unloading_weight,
                'current_cost', lr.current_cost,
                'extra_cost', lr.extra_cost,
                'license_plate', d.license_plate,
                'driver_phone', d.phone,
                'transport_type', lr.transport_type,
                'remarks', lr.remarks,
                'chain_name', pc.chain_name,
                'cargo_type', lr.cargo_type,
                'billing_type_id', lr.billing_type_id,
                'partner_id', lpc.partner_id,
                'partner_name', p.name,
                'level', lpc.level,
                'base_amount', lpc.base_amount,
                'payable_amount', lpc.payable_amount,
                'tax_rate', lpc.tax_rate,
                'invoice_status', lpc.invoice_status,
                'payment_status', lpc.payment_status,
                'tax_number', COALESCE(p.tax_number, NULL),
                'company_address', COALESCE(p.company_address, NULL),
                'bank_name', COALESCE(p.bank_name, NULL),
                'bank_account', COALESCE(p.bank_account, NULL)
            )
        ), '[]'::jsonb)
    )
    INTO result_json
    FROM logistics_partner_costs lpc
    JOIN logistics_records lr ON lpc.logistics_record_id = lr.id
    JOIN partners p ON lpc.partner_id = p.id
    JOIN drivers d ON lr.driver_id = d.id
    LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
    WHERE lpc.id = ANY(p_partner_cost_ids)
      AND lpc.invoice_status = 'Uninvoiced';

    RETURN result_json;
END;
$function$;

-- =============================================================================
-- 步骤 11: 创建保存开票申请的函数
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_invoice_request(p_invoice_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_sheets jsonb;
    v_all_partner_cost_ids uuid[];
    v_sheet jsonb;
    v_request_id uuid;
    v_request_number text;
    v_partner_cost_id uuid;
    result_json jsonb;
    created_requests jsonb[] := '{}';
    v_partner_costs jsonb;
    v_partner_cost jsonb;
BEGIN
    v_sheets := p_invoice_data->'sheets';
    v_all_partner_cost_ids := ARRAY(SELECT jsonb_array_elements_text(p_invoice_data->'all_partner_cost_ids'))::uuid[];

    IF EXISTS (
        SELECT 1 FROM logistics_partner_costs 
        WHERE id = ANY(v_all_partner_cost_ids) 
        AND invoice_status != 'Uninvoiced'
    ) THEN
        RAISE EXCEPTION '部分合作方成本记录已经申请过开票或已完成开票';
    END IF;

    FOR i IN 0..jsonb_array_length(v_sheets)-1 LOOP
        v_sheet := v_sheets->i;
        v_request_number := generate_invoice_request_number();
        
        INSERT INTO invoice_requests (
            request_number,
            partner_id,
            partner_name,
            partner_full_name,
            tax_number,
            company_address,
            bank_name,
            bank_account,
            total_amount,
            record_count,
            created_by
        ) VALUES (
            v_request_number,
            (v_sheet->>'invoicing_partner_id')::uuid,
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'invoicing_partner_tax_number',
            v_sheet->>'invoicing_partner_company_address',
            v_sheet->>'invoicing_partner_bank_name',
            v_sheet->>'invoicing_partner_bank_account',
            (v_sheet->>'total_invoiceable')::decimal,
            (v_sheet->>'record_count')::integer,
            auth.uid()
        ) RETURNING id INTO v_request_id;

        v_partner_costs := v_sheet->'partner_costs';
        
        FOR j IN 0..jsonb_array_length(v_partner_costs)-1 LOOP
            v_partner_cost := v_partner_costs->j;
            v_partner_cost_id := (v_partner_cost->>'id')::uuid;
            
            INSERT INTO invoice_request_details (
                invoice_request_id,
                logistics_record_id,
                amount
            ) VALUES (
                v_request_id,
                (v_partner_cost->>'logistics_record_id')::uuid,
                (v_partner_cost->>'payable_amount')::decimal
            );
            
            UPDATE logistics_partner_costs 
            SET 
                invoice_status = 'Processing',
                invoice_request_id = v_request_id,
                invoice_applied_at = NOW()
            WHERE id = v_partner_cost_id;
        END LOOP;
        
        created_requests := created_requests || jsonb_build_object(
            'request_id', v_request_id,
            'request_number', v_request_number,
            'partner_name', v_sheet->>'invoicing_partner_full_name',
            'total_amount', (v_sheet->>'total_invoiceable')::decimal,
            'record_count', (v_sheet->>'record_count')::integer
        );
    END LOOP;

    result_json := jsonb_build_object(
        'success', true,
        'message', '开票申请创建成功',
        'created_requests', created_requests,
        'total_requests', jsonb_array_length(to_jsonb(created_requests)),
        'total_partner_costs', array_length(v_all_partner_cost_ids, 1)
    );

    RETURN result_json;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '创建开票申请失败: %', SQLERRM;
END;
$function$;

-- =============================================================================
-- 步骤 12: 创建开票申请管理函数（审批、完成、删除）
-- =============================================================================

-- 12.1 审批开票申请
CREATE OR REPLACE FUNCTION public.approve_invoice_request(
    p_request_id uuid,
    p_action text, -- 'approve' 或 'reject'
    p_remarks text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request invoice_requests%ROWTYPE;
    v_new_status text;
    result_json json;
BEGIN
    SELECT * INTO v_request FROM invoice_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在';
    END IF;

    IF v_request.status != 'Pending' THEN
        RAISE EXCEPTION '只能审批待审批状态的申请';
    END IF;

    IF p_action = 'approve' THEN
        v_new_status := 'Approved';
    ELSIF p_action = 'reject' THEN
        v_new_status := 'Rejected';
    ELSE
        RAISE EXCEPTION '无效的操作类型，只支持 approve 或 reject';
    END IF;

    UPDATE invoice_requests 
    SET 
        status = v_new_status,
        approved_by = auth.uid(),
        approved_at = NOW(),
        remarks = COALESCE(p_remarks, remarks)
    WHERE id = p_request_id;

    IF p_action = 'reject' THEN
        UPDATE logistics_partner_costs 
        SET 
            invoice_status = 'Uninvoiced',
            invoice_request_id = NULL,
            invoice_applied_at = NULL
        WHERE invoice_request_id = p_request_id;
    END IF;

    result_json := json_build_object(
        'success', true,
        'message', CASE 
            WHEN p_action = 'approve' THEN '开票申请已批准'
            ELSE '开票申请已拒绝，相关合作方成本记录状态已恢复'
        END,
        'request_id', p_request_id,
        'new_status', v_new_status
    );

    RETURN result_json;
END;
$function$;

-- 12.2 完成开票（创建开票记录并更新状态）
CREATE OR REPLACE FUNCTION public.complete_invoice_request(
    p_request_id uuid,
    p_invoice_number text,
    p_invoice_date date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request invoice_requests%ROWTYPE;
    v_detail RECORD;
    result_json json;
    created_records_count integer := 0;
BEGIN
    SELECT * INTO v_request FROM invoice_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在';
    END IF;

    IF v_request.status != 'Approved' THEN
        RAISE EXCEPTION '只能完成已批准的开票申请';
    END IF;

    -- 为每个运单创建开票记录
    FOR v_detail IN 
        SELECT ird.logistics_record_id, ird.amount, lpc.partner_id
        FROM invoice_request_details ird
        JOIN logistics_partner_costs lpc ON ird.logistics_record_id = lpc.logistics_record_id 
            AND lpc.invoice_request_id = p_request_id
        WHERE ird.invoice_request_id = p_request_id
    LOOP
        -- 在现有的invoice_records表中创建记录
        INSERT INTO invoice_records (
            logistics_record_id,
            partner_id,
            invoice_amount,
            invoice_number,
            invoice_date,
            remarks,
            user_id
        ) VALUES (
            v_detail.logistics_record_id,
            v_detail.partner_id,
            v_detail.amount,
            p_invoice_number,
            p_invoice_date,
            '来自开票申请: ' || v_request.request_number,
            auth.uid()
        );
        
        created_records_count := created_records_count + 1;
    END LOOP;

    -- 更新申请状态
    UPDATE invoice_requests 
    SET 
        status = 'Invoiced',
        invoice_number = p_invoice_number,
        invoice_date = p_invoice_date
    WHERE id = p_request_id;

    -- 更新合作方成本记录状态
    UPDATE logistics_partner_costs 
    SET 
        invoice_status = 'Invoiced',
        invoice_number = p_invoice_number,
        invoice_completed_at = NOW()
    WHERE invoice_request_id = p_request_id;

    result_json := json_build_object(
        'success', true,
        'message', '开票完成，已创建 ' || created_records_count || ' 条开票记录',
        'request_id', p_request_id,
        'invoice_number', p_invoice_number,
        'invoice_date', p_invoice_date,
        'created_records_count', created_records_count
    );

    RETURN result_json;
END;
$function$;

-- 12.3 删除开票申请
CREATE OR REPLACE FUNCTION public.delete_invoice_request(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request invoice_requests%ROWTYPE;
    result_json json;
BEGIN
    SELECT * INTO v_request FROM invoice_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在';
    END IF;

    IF v_request.status != 'Pending' THEN
        RAISE EXCEPTION '只能删除待审批状态的申请';
    END IF;

    -- 恢复合作方成本记录状态
    UPDATE logistics_partner_costs 
    SET 
        invoice_status = 'Uninvoiced',
        invoice_request_id = NULL,
        invoice_applied_at = NULL
    WHERE invoice_request_id = p_request_id;

    -- 删除申请（级联删除明细）
    DELETE FROM invoice_requests WHERE id = p_request_id;

    result_json := json_build_object(
        'success', true,
        'message', '开票申请已删除，相关合作方成本记录状态已恢复',
        'request_id', p_request_id
    );

    RETURN result_json;
END;
$function$;

-- =============================================================================
-- 步骤 13: 添加字段注释
-- =============================================================================

COMMENT ON COLUMN logistics_partner_costs.invoice_status IS '开票状态: Uninvoiced-未开票, Processing-已申请开票, Invoiced-已完成开票';
COMMENT ON COLUMN logistics_partner_costs.payment_status IS '付款状态: Unpaid-未付款, Processing-已申请付款, Paid-已完成付款';
COMMENT ON COLUMN logistics_partner_costs.invoice_applied_at IS '开票申请时间';
COMMENT ON COLUMN logistics_partner_costs.invoice_completed_at IS '开票完成时间';
COMMENT ON COLUMN logistics_partner_costs.payment_applied_at IS '付款申请时间';
COMMENT ON COLUMN logistics_partner_costs.payment_completed_at IS '付款完成时间';
COMMENT ON COLUMN logistics_partner_costs.invoice_request_id IS '关联的开票申请ID';
COMMENT ON COLUMN logistics_partner_costs.payment_request_id IS '关联的付款申请ID';

COMMENT ON TABLE invoice_requests IS '开票申请表';
COMMENT ON TABLE invoice_request_details IS '开票申请明细表';
COMMENT ON COLUMN invoice_requests.request_number IS '开票申请单号，格式: INV + YYYYMMDD + 序列号';
COMMENT ON COLUMN invoice_requests.status IS '申请状态: Pending-待审批, Approved-已批准, Rejected-已拒绝, Invoiced-已开票';

-- =============================================================================
-- 验证部署 - 可选执行的测试命令
-- =============================================================================

-- 测试1: 检查新字段是否添加成功
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'logistics_partner_costs' 
-- AND column_name IN ('invoice_status', 'payment_status', 'invoice_applied_at');

-- 测试2: 检查表是否创建成功
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('invoice_requests', 'invoice_request_details', 'invoice_records');

-- 测试3: 测试函数
-- SELECT * FROM get_invoice_request_data(NULL, NULL, NULL, NULL, NULL, 5, 1);

-- 测试4: 测试申请单号生成
-- SELECT generate_invoice_request_number();

-- 测试5: 查看运单状态汇总
-- SELECT * FROM logistics_records_status_summary LIMIT 5;

-- 测试6: 验证现有invoice_records表结构
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'invoice_records' 
-- ORDER BY ordinal_position;

-- 测试7: 检查开票申请管理函数
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name IN ('approve_invoice_request', 'complete_invoice_request', 'delete_invoice_request') 
-- AND routine_schema = 'public';

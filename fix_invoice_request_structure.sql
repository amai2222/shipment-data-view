-- 修复开票申请表结构，匹配现有数据库结构

-- 1. 检查并修正 invoice_requests 表结构
DO $$
BEGIN
    -- 检查 invoicing_partner_id 字段是否存在，如果不存在则添加
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'invoicing_partner_id'
    ) THEN
        -- 如果 partner_id 存在，重命名为 invoicing_partner_id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_requests' 
            AND column_name = 'partner_id'
        ) THEN
            ALTER TABLE invoice_requests RENAME COLUMN partner_id TO invoicing_partner_id;
        ELSE
            -- 如果都不存在，添加新字段
            ALTER TABLE invoice_requests ADD COLUMN invoicing_partner_id UUID NOT NULL REFERENCES partners(id);
        END IF;
    END IF;

    -- 检查并添加其他必要字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'invoicing_partner_full_name'
    ) THEN
        -- 如果 partner_full_name 存在，重命名
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_requests' 
            AND column_name = 'partner_full_name'
        ) THEN
            ALTER TABLE invoice_requests RENAME COLUMN partner_full_name TO invoicing_partner_full_name;
        ELSE
            ALTER TABLE invoice_requests ADD COLUMN invoicing_partner_full_name VARCHAR(200);
        END IF;
    END IF;

    -- 检查并添加其他开票相关字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'invoicing_partner_tax_number'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_requests' 
            AND column_name = 'tax_number'
        ) THEN
            ALTER TABLE invoice_requests RENAME COLUMN tax_number TO invoicing_partner_tax_number;
        ELSE
            ALTER TABLE invoice_requests ADD COLUMN invoicing_partner_tax_number VARCHAR(50);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'invoicing_partner_company_address'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_requests' 
            AND column_name = 'company_address'
        ) THEN
            ALTER TABLE invoice_requests RENAME COLUMN company_address TO invoicing_partner_company_address;
        ELSE
            ALTER TABLE invoice_requests ADD COLUMN invoicing_partner_company_address TEXT;
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'invoicing_partner_bank_name'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_requests' 
            AND column_name = 'bank_name'
        ) THEN
            ALTER TABLE invoice_requests RENAME COLUMN bank_name TO invoicing_partner_bank_name;
        ELSE
            ALTER TABLE invoice_requests ADD COLUMN invoicing_partner_bank_name VARCHAR(100);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'invoicing_partner_bank_account'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_requests' 
            AND column_name = 'bank_account'
        ) THEN
            ALTER TABLE invoice_requests RENAME COLUMN bank_account TO invoicing_partner_bank_account;
        ELSE
            ALTER TABLE invoice_requests ADD COLUMN invoicing_partner_bank_account VARCHAR(50);
        END IF;
    END IF;

    -- 检查并添加申请人相关字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'applicant_id'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_requests' 
            AND column_name = 'created_by'
        ) THEN
            ALTER TABLE invoice_requests RENAME COLUMN created_by TO applicant_id;
        ELSE
            ALTER TABLE invoice_requests ADD COLUMN applicant_id UUID REFERENCES auth.users(id);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'applicant_name'
    ) THEN
        ALTER TABLE invoice_requests ADD COLUMN applicant_name VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'applied_at'
    ) THEN
        ALTER TABLE invoice_requests ADD COLUMN applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- 检查并修正明细表字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_request_details' 
        AND column_name = 'auto_number'
    ) THEN
        ALTER TABLE invoice_request_details ADD COLUMN auto_number VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_request_details' 
        AND column_name = 'project_name'
    ) THEN
        ALTER TABLE invoice_request_details ADD COLUMN project_name VARCHAR(200);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_request_details' 
        AND column_name = 'driver_name'
    ) THEN
        ALTER TABLE invoice_request_details ADD COLUMN driver_name VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_request_details' 
        AND column_name = 'loading_location'
    ) THEN
        ALTER TABLE invoice_request_details ADD COLUMN loading_location VARCHAR(200);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_request_details' 
        AND column_name = 'unloading_location'
    ) THEN
        ALTER TABLE invoice_request_details ADD COLUMN unloading_location VARCHAR(200);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_request_details' 
        AND column_name = 'loading_date'
    ) THEN
        ALTER TABLE invoice_request_details ADD COLUMN loading_date DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_request_details' 
        AND column_name = 'invoiceable_amount'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'invoice_request_details' 
            AND column_name = 'amount'
        ) THEN
            ALTER TABLE invoice_request_details RENAME COLUMN amount TO invoiceable_amount;
        ELSE
            ALTER TABLE invoice_request_details ADD COLUMN invoiceable_amount DECIMAL(15,2) DEFAULT 0;
        END IF;
    END IF;
END $$;

-- 2. 更新索引
DROP INDEX IF EXISTS idx_invoice_requests_partner_id;
CREATE INDEX IF NOT EXISTS idx_invoice_requests_invoicing_partner ON invoice_requests(invoicing_partner_id);

-- 3. 重新创建修正版的保存开票申请函数
CREATE OR REPLACE FUNCTION public.save_invoice_request(p_invoice_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id uuid;
    v_user_name text;
    v_request_id uuid;
    v_request_number text;
    v_sheet jsonb;
    v_record jsonb;
    v_partner_cost_ids uuid[];
    result_json jsonb;
BEGIN
    -- 权限检查
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足';
    END IF;
    
    -- 获取当前用户信息
    SELECT auth.uid() INTO v_user_id;
    SELECT name INTO v_user_name FROM profiles WHERE id = v_user_id;
    
    -- 为每个合作方创建开票申请
    FOR v_sheet IN SELECT * FROM jsonb_array_elements(p_invoice_data->'sheets')
    LOOP
        -- 生成申请单号
        SELECT generate_invoice_request_number() INTO v_request_number;
        
        -- 创建开票申请记录
        INSERT INTO invoice_requests (
            request_number,
            invoicing_partner_id,
            invoicing_partner_full_name,
            invoicing_partner_tax_number,
            invoicing_partner_company_address,
            invoicing_partner_bank_name,
            invoicing_partner_bank_account,
            record_count,
            total_amount,
            applicant_id,
            applicant_name,
            status
        ) VALUES (
            v_request_number,
            (v_sheet->>'invoicing_partner_id')::uuid,
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'invoicing_partner_tax_number',
            v_sheet->>'invoicing_partner_company_address',
            v_sheet->>'invoicing_partner_bank_name',
            v_sheet->>'invoicing_partner_bank_account',
            (v_sheet->>'record_count')::integer,
            (v_sheet->>'total_invoiceable')::decimal,
            v_user_id,
            v_user_name,
            'Pending'
        ) RETURNING id INTO v_request_id;
        
        -- 创建申请明细记录
        FOR v_record IN SELECT * FROM jsonb_array_elements(v_sheet->'records')
        LOOP
            INSERT INTO invoice_request_details (
                invoice_request_id,
                logistics_record_id,
                auto_number,
                project_name,
                driver_name,
                loading_location,
                unloading_location,
                loading_date,
                invoiceable_amount
            ) VALUES (
                v_request_id,
                (v_record->>'id')::uuid,
                v_record->>'auto_number',
                v_record->>'project_name',
                v_record->>'driver_name',
                v_record->>'loading_location',
                v_record->>'unloading_location',
                (v_record->>'loading_date')::date,
                COALESCE((v_record->>'total_invoiceable_for_partner')::decimal, 0)
            );
        END LOOP;
        
        -- 收集需要更新状态的合作方成本ID
        SELECT array_agg(lpc.id)
        INTO v_partner_cost_ids
        FROM logistics_partner_costs lpc
        JOIN jsonb_array_elements(v_sheet->'records') r ON lpc.logistics_record_id = (r->>'id')::uuid
        WHERE lpc.partner_id = (v_sheet->>'invoicing_partner_id')::uuid
          AND lpc.invoice_status = 'Uninvoiced';
        
        -- 更新合作方成本的开票状态为"开票中"
        UPDATE logistics_partner_costs 
        SET invoice_status = 'Processing',
            updated_at = NOW()
        WHERE id = ANY(v_partner_cost_ids);
    END LOOP;
    
    -- 返回成功结果
    SELECT jsonb_build_object(
        'success', true,
        'message', '开票申请创建成功',
        'created_requests', jsonb_array_length(p_invoice_data->'sheets')
    ) INTO result_json;
    
    RETURN result_json;
END;
$function$;

-- 验证修复完成
SELECT 'Invoice request structure fixed successfully' as status;

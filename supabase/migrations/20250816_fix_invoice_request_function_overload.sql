-- 修复开票申请函数重载冲突
-- 问题：存在多个save_invoice_request函数签名，导致调用时无法确定使用哪个
-- 解决：删除所有旧版本，只保留jsonb版本

-- 0. 确保partner_bank_details表有所有扩展字段
ALTER TABLE IF EXISTS public.partner_bank_details
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS tax_number text,
ADD COLUMN IF NOT EXISTS company_address text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_account text,
ADD COLUMN IF NOT EXISTS branch_name text;

-- 确保invoice_requests和invoice_request_details表有必要的字段
ALTER TABLE IF EXISTS public.invoice_requests 
ADD COLUMN IF NOT EXISTS partner_id uuid,
ADD COLUMN IF NOT EXISTS invoicing_partner_id uuid,
ADD COLUMN IF NOT EXISTS partner_name text,
ADD COLUMN IF NOT EXISTS partner_full_name text,
ADD COLUMN IF NOT EXISTS tax_number text,
ADD COLUMN IF NOT EXISTS company_address text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_account text,
ADD COLUMN IF NOT EXISTS record_count integer,
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS is_voided boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voided_at timestamptz,
ADD COLUMN IF NOT EXISTS voided_by uuid,
ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE IF EXISTS public.invoice_request_details
ADD COLUMN IF NOT EXISTS invoice_request_id uuid,
ADD COLUMN IF NOT EXISTS logistics_record_id uuid,
ADD COLUMN IF NOT EXISTS amount numeric;

-- 确保logistics_partner_costs表有开票相关字段
ALTER TABLE IF EXISTS public.logistics_partner_costs
ADD COLUMN IF NOT EXISTS invoice_request_id uuid,
ADD COLUMN IF NOT EXISTS invoice_applied_at timestamptz;

-- 1. 删除所有版本的save_invoice_request函数
DROP FUNCTION IF EXISTS public.save_invoice_request(json);
DROP FUNCTION IF EXISTS public.save_invoice_request(jsonb);
DROP FUNCTION IF EXISTS public.save_invoice_request(p_invoice_data json);
DROP FUNCTION IF EXISTS public.save_invoice_request(p_invoice_data jsonb);
DROP FUNCTION IF EXISTS public.save_invoice_request(uuid[]);
DROP FUNCTION IF EXISTS public.save_invoice_request(p_record_ids uuid[]);

-- 1.5 创建生成开票申请单号的函数（如果不存在）
CREATE OR REPLACE FUNCTION public.generate_invoice_request_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_date_part text;
    v_seq_part text;
    v_max_seq integer;
BEGIN
    -- 日期部分：YYYYMMDD
    v_date_part := to_char(CURRENT_DATE, 'YYYYMMDD');
    
    -- 获取当天的最大序号
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN ir.request_number ~ ('^KP' || v_date_part || '-[0-9]+$')
                THEN substring(ir.request_number from '[0-9]+$')::integer
                ELSE 0
            END
        ), 
        0
    ) + 1
    INTO v_max_seq
    FROM invoice_requests ir
    WHERE ir.request_number LIKE 'KP' || v_date_part || '%';
    
    -- 序号部分：4位数字，左补零
    v_seq_part := lpad(v_max_seq::text, 4, '0');
    
    -- 返回完整单号：KP + YYYYMMDD + - + 序号
    RETURN 'KP' || v_date_part || '-' || v_seq_part;
END;
$$;

-- 2. 重新创建开票申请函数（逻辑类似付款申请，但反方向）
-- 参数：只接受运单ID数组
-- 逻辑：给最高级合作方开票（与付款申请相反）
CREATE OR REPLACE FUNCTION public.save_invoice_request(p_record_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_record_id uuid;
    v_max_level integer := 0;
    v_partner_id uuid;
    v_partner_info record;
    v_request_id uuid;
    v_request_number text;
    v_partner_costs record;
    v_record_count integer;
    v_total_amount numeric;
    created_requests jsonb[] := '{}';
    partner_request_map jsonb := '{}'::jsonb;
BEGIN
    -- 权限检查
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以创建开票申请';
    END IF;

    -- 第1步：找出最高级别
    SELECT MAX(lpc.level) INTO v_max_level
    FROM public.logistics_partner_costs lpc
    WHERE lpc.logistics_record_id = ANY(p_record_ids)
      AND lpc.invoice_status = 'Uninvoiced';
    
    IF v_max_level IS NULL OR v_max_level = 0 THEN
        RAISE EXCEPTION '没有找到可开票的合作方成本记录';
    END IF;

    -- 第2步：按合作方分组，只处理最高级别的合作方（⭐开票给最高级）
    FOR v_partner_id IN 
        SELECT DISTINCT lpc.partner_id
        FROM public.logistics_partner_costs lpc
        WHERE lpc.logistics_record_id = ANY(p_record_ids)
          AND lpc.level = v_max_level  -- ⭐ 只处理最高级别
          AND lpc.invoice_status = 'Uninvoiced'
    LOOP
        -- 获取合作方信息（从partners和partner_bank_details表）
        SELECT 
            p.id,
            p.name,
            COALESCE(pbd.full_name, p.name) as full_name,
            COALESCE(pbd.tax_number, '') as tax_number,
            COALESCE(pbd.company_address, '') as company_address,
            COALESCE(pbd.bank_name, '') as bank_name,
            COALESCE(pbd.bank_account, '') as bank_account
        INTO v_partner_info
        FROM public.partners p
        LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
        WHERE p.id = v_partner_id;
        
        -- 生成开票申请单号
        v_request_number := generate_invoice_request_number();
        
        -- 计算该合作方的总金额和运单数量
        SELECT 
            COUNT(DISTINCT lpc.logistics_record_id),
            SUM(lpc.payable_amount)
        INTO v_record_count, v_total_amount
        FROM public.logistics_partner_costs lpc
        WHERE lpc.logistics_record_id = ANY(p_record_ids)
          AND lpc.partner_id = v_partner_id
          AND lpc.level = v_max_level
          AND lpc.invoice_status = 'Uninvoiced';
        
        -- 创建开票申请记录
        INSERT INTO public.invoice_requests (
            request_number,
            partner_id,
            invoicing_partner_id,
            partner_name,
            partner_full_name,
            tax_number,
            company_address,
            bank_name,
            bank_account,
            total_amount,
            record_count,
            status,
            created_by,
            created_at
        ) VALUES (
            v_request_number,
            v_partner_id,
            v_partner_id,
            v_partner_info.name,
            v_partner_info.full_name,
            v_partner_info.tax_number,
            v_partner_info.company_address,
            v_partner_info.bank_name,
            v_partner_info.bank_account,
            v_total_amount,
            v_record_count,
            'Pending',
            auth.uid(),
            NOW()
        ) RETURNING id INTO v_request_id;
        
        -- 创建开票申请明细并更新状态
        FOR v_partner_costs IN
            SELECT 
                lpc.id as cost_id,
                lpc.logistics_record_id,
                lpc.payable_amount
            FROM public.logistics_partner_costs lpc
            WHERE lpc.logistics_record_id = ANY(p_record_ids)
              AND lpc.partner_id = v_partner_id
              AND lpc.level = v_max_level
              AND lpc.invoice_status = 'Uninvoiced'
        LOOP
            -- 插入开票申请明细
            INSERT INTO public.invoice_request_details (
                invoice_request_id,
                logistics_record_id,
                amount
            ) VALUES (
                v_request_id,
                v_partner_costs.logistics_record_id,
                v_partner_costs.payable_amount
            );
            
            -- 更新合作方成本状态
            UPDATE public.logistics_partner_costs
            SET 
                invoice_status = 'Processing',
                invoice_request_id = v_request_id,
                invoice_applied_at = NOW()
            WHERE id = v_partner_costs.cost_id;
        END LOOP;
        
        -- 记录创建的申请
        created_requests := created_requests || jsonb_build_object(
            'request_id', v_request_id,
            'request_number', v_request_number,
            'partner_id', v_partner_id,
            'partner_name', v_partner_info.full_name,
            'total_amount', v_total_amount,
            'record_count', v_record_count
        );
    END LOOP;

    -- 返回结果
    RETURN jsonb_build_object(
        'success', true,
        'message', '开票申请创建成功',
        'created_requests', created_requests,
        'total_requests', array_length(created_requests, 1),
        'processed_record_ids', p_record_ids
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '创建开票申请失败: %', SQLERRM;
END;
$function$;

-- 3. 添加注释说明
COMMENT ON FUNCTION public.save_invoice_request(uuid[]) IS '
保存开票申请函数（统一逻辑版本）
参数：p_record_ids (uuid[]) - 运单ID数组
返回：jsonb - 包含创建的申请信息
逻辑：
  1. 找出最高级别合作方
  2. 只给最高级合作方创建开票申请（与付款申请相反）
  3. 按合作方分组自动创建申请
  4. 更新logistics_partner_costs的invoice_status
注意：与process_payment_application逻辑统一，都只接受运单ID数组
';

-- 添加外键约束（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_invoice_requests_voided_by' 
        AND table_name = 'invoice_requests'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoice_requests 
        ADD CONSTRAINT fk_invoice_requests_voided_by 
        FOREIGN KEY (voided_by) REFERENCES public.profiles(id);
    END IF;
END $$;

-- 创建作废开票申请单的函数
CREATE OR REPLACE FUNCTION public.void_invoice_request(
    p_request_id uuid,
    p_void_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_affected_count integer;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以作废开票申请单';
    END IF;
    
    -- 获取申请单信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请单不存在';
    END IF;
    
    -- 检查是否已经作废
    IF v_request.is_voided THEN
        RAISE EXCEPTION '该申请单已经作废';
    END IF;
    
    -- 作废申请单
    UPDATE public.invoice_requests
    SET 
        is_voided = true,
        voided_at = NOW(),
        voided_by = auth.uid(),
        void_reason = p_void_reason,
        status = 'Voided'
    WHERE id = p_request_id;
    
    -- 更新相关的logistics_partner_costs状态（回滚运单状态）
    UPDATE public.logistics_partner_costs
    SET 
        invoice_status = 'Uninvoiced',
        invoice_request_id = NULL,
        invoice_applied_at = NULL
    WHERE invoice_request_id = p_request_id;
    
    -- 删除开票申请明细
    DELETE FROM public.invoice_request_details
    WHERE invoice_request_id = p_request_id;
    
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'message', '开票申请单已作废',
        'affected_records', v_affected_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '作废开票申请单失败: ' || SQLERRM
    );
END;
$$;


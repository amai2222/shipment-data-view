-- ============================================================================
-- 开票申请合并功能
-- 创建日期：2025-11-06
-- 功能：支持将多个开票申请单合并为一个新申请单
-- ============================================================================

-- ============================================================================
-- 第一步：修改表结构 - 添加合并相关字段
-- ============================================================================

ALTER TABLE invoice_requests
ADD COLUMN IF NOT EXISTS merged_from_requests TEXT[],     -- 被合并的原申请单号数组
ADD COLUMN IF NOT EXISTS is_merged_request BOOLEAN DEFAULT FALSE,  -- 是否为合并申请单
ADD COLUMN IF NOT EXISTS merged_count INTEGER DEFAULT 0;   -- 合并了多少个申请单

COMMENT ON COLUMN invoice_requests.merged_from_requests IS '被合并的原始申请单号数组（仅合并申请单有值）';
COMMENT ON COLUMN invoice_requests.is_merged_request IS '是否为合并后生成的申请单';
COMMENT ON COLUMN invoice_requests.merged_count IS '合并了多少个原始申请单';

-- ============================================================================
-- 第二步：添加"已合并"状态
-- ============================================================================

-- 删除旧约束
ALTER TABLE invoice_requests
DROP CONSTRAINT IF EXISTS invoice_requests_status_check;

-- 添加新约束（包含Merged状态）
ALTER TABLE invoice_requests
ADD CONSTRAINT invoice_requests_status_check 
CHECK (status IN ('Pending', 'Approved', 'Completed', 'Rejected', 'Merged'));

-- ============================================================================
-- 第三步：创建合并申请单号生成函数
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_merged_invoice_request_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_date_prefix TEXT;
    v_max_number INTEGER;
    v_new_number TEXT;
BEGIN
    -- 生成日期前缀：HBKP + YYYYMMDD
    v_date_prefix := 'HBKP' || TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- 查找今天最大的序号
    SELECT COALESCE(MAX(
        CASE 
            WHEN request_number LIKE v_date_prefix || '%' 
            THEN SUBSTRING(request_number FROM LENGTH(v_date_prefix) + 1)::INTEGER
            ELSE 0
        END
    ), 0) INTO v_max_number
    FROM invoice_requests
    WHERE request_number LIKE v_date_prefix || '%';
    
    -- 生成新编号：hbkpYYYYMMDD + 001
    v_new_number := v_date_prefix || LPAD((v_max_number + 1)::TEXT, 3, '0');
    
    RETURN v_new_number;
END;
$$;

COMMENT ON FUNCTION generate_merged_invoice_request_number IS '生成合并开票申请单编号（HBKP开头）';

-- ============================================================================
-- 第四步：创建合并开票申请RPC函数
-- ============================================================================

CREATE OR REPLACE FUNCTION merge_invoice_requests(
    p_request_ids TEXT[]  -- 要合并的申请单号数组
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_request_number TEXT;
    v_new_request_uuid UUID;
    v_all_waybill_ids UUID[];
    v_total_amount NUMERIC;
    v_partner_id UUID;
    v_partner_name TEXT;
    v_partner_full_name TEXT;
    v_tax_number TEXT;
    v_company_address TEXT;
    v_bank_name TEXT;
    v_bank_account TEXT;
    v_invoicing_partner_id UUID;
    v_record_count INTEGER;
    v_current_user_id UUID;
    v_request_record RECORD;
BEGIN
    -- 获取当前用户
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '用户未登录'
        );
    END IF;
    
    -- 验证1：至少2个申请单
    IF array_length(p_request_ids, 1) < 2 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '至少需要选择2个开票申请单'
        );
    END IF;
    
    -- 验证2：所有申请单必须存在且状态为"Pending"
    IF EXISTS (
        SELECT 1 FROM invoice_requests 
        WHERE request_number = ANY(p_request_ids)
        AND status != 'Pending'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '只能合并"待审核"状态的申请单'
        );
    END IF;
    
    -- 验证3：所有申请单必须是同一个合作方
    SELECT COUNT(DISTINCT partner_id) INTO v_record_count
    FROM invoice_requests
    WHERE request_number = ANY(p_request_ids);
    
    IF v_record_count > 1 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '只能合并同一个合作方的申请单'
        );
    END IF;
    
    -- 获取第一个申请单的合作方信息（因为都是同一个合作方）
    SELECT 
        partner_id,
        partner_name,
        partner_full_name,
        tax_number,
        company_address,
        bank_name,
        bank_account,
        invoicing_partner_id
    INTO 
        v_partner_id,
        v_partner_name,
        v_partner_full_name,
        v_tax_number,
        v_company_address,
        v_bank_name,
        v_bank_account,
        v_invoicing_partner_id
    FROM invoice_requests
    WHERE request_number = p_request_ids[1]
    LIMIT 1;
    
    -- 收集所有运单ID（自动去重）
    SELECT array_agg(DISTINCT detail.logistics_record_id)
    INTO v_all_waybill_ids
    FROM invoice_requests ir
    JOIN invoice_request_details detail ON ir.id = detail.invoice_request_id
    WHERE ir.request_number = ANY(p_request_ids);
    
    -- 计算总金额和运单数
    SELECT 
        COALESCE(SUM(detail.amount), 0),
        COUNT(DISTINCT detail.logistics_record_id)
    INTO v_total_amount, v_record_count
    FROM invoice_requests ir
    JOIN invoice_request_details detail ON ir.id = detail.invoice_request_id
    WHERE ir.request_number = ANY(p_request_ids);
    
    -- 生成新的合并申请单号
    v_new_request_number := generate_merged_invoice_request_number();
    
    -- 创建新的合并开票申请单
    INSERT INTO invoice_requests (
        request_number,
        partner_id,
        partner_name,
        partner_full_name,
        invoicing_partner_id,
        invoicing_partner_full_name,
        invoicing_partner_tax_number,
        invoicing_partner_company_address,
        invoicing_partner_bank_name,
        invoicing_partner_bank_account,
        tax_number,
        company_address,
        bank_name,
        bank_account,
        total_amount,
        record_count,
        status,
        created_by,
        created_at,
        merged_from_requests,  -- 记录原始申请单号
        is_merged_request,     -- 标记为合并申请单
        merged_count,          -- 合并数量
        remarks
    ) VALUES (
        v_new_request_number,
        v_partner_id,
        v_partner_name,
        v_partner_full_name,
        v_invoicing_partner_id,
        v_partner_full_name,  -- 使用相同的值
        v_tax_number,
        v_company_address,
        v_bank_name,
        v_bank_account,
        v_tax_number,
        v_company_address,
        v_bank_name,
        v_bank_account,
        v_total_amount,
        v_record_count,
        'Pending',  -- 新申请单状态为待审核
        v_current_user_id,
        NOW(),
        p_request_ids,  -- 原始申请单号数组
        true,
        array_length(p_request_ids, 1),
        '由' || array_length(p_request_ids, 1)::TEXT || '个申请单合并生成：' || array_to_string(p_request_ids, ', ')
    )
    RETURNING id INTO v_new_request_uuid;
    
    -- 复制所有运单明细到新申请单（去重）
    INSERT INTO invoice_request_details (
        invoice_request_id,
        logistics_record_id,
        amount
    )
    SELECT DISTINCT ON (detail.logistics_record_id)
        v_new_request_uuid,
        detail.logistics_record_id,
        detail.amount
    FROM invoice_requests ir
    JOIN invoice_request_details detail ON ir.id = detail.invoice_request_id
    WHERE ir.request_number = ANY(p_request_ids);
    
    -- 将原申请单状态改为"已合并"
    UPDATE invoice_requests
    SET status = 'Merged',
        updated_at = NOW(),
        remarks = COALESCE(remarks || ' | ', '') || '已合并到: ' || v_new_request_number
    WHERE request_number = ANY(p_request_ids);
    
    -- 更新运单：重新关联到新申请单
    UPDATE logistics_records
    SET invoice_request_id = v_new_request_uuid,
        invoice_status = 'Processing'  -- 重置为Processing状态
    WHERE id = ANY(v_all_waybill_ids);
    
    -- 更新合作方成本：重新关联到新申请单
    UPDATE logistics_partner_costs
    SET invoice_request_id = v_new_request_uuid
    WHERE logistics_record_id = ANY(v_all_waybill_ids)
    AND partner_id = v_partner_id;
    
    -- 返回成功结果
    RETURN jsonb_build_object(
        'success', true,
        'message', '合并成功',
        'new_request_number', v_new_request_number,
        'merged_count', array_length(p_request_ids, 1),
        'total_amount', v_total_amount,
        'waybill_count', v_record_count,
        'merged_from', p_request_ids
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', '合并失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION merge_invoice_requests IS '合并多个开票申请单（生成HBKP编号，旧申请单状态变为Merged）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 合并开票功能创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已添加：';
    RAISE NOTICE '  ✓ invoice_requests.merged_from_requests 字段';
    RAISE NOTICE '  ✓ invoice_requests.is_merged_request 字段';
    RAISE NOTICE '  ✓ invoice_requests.merged_count 字段';
    RAISE NOTICE '  ✓ Merged 状态';
    RAISE NOTICE '  ✓ generate_merged_invoice_request_number() 函数';
    RAISE NOTICE '  ✓ merge_invoice_requests() 函数';
    RAISE NOTICE '';
    RAISE NOTICE '申请单号格式：';
    RAISE NOTICE '  普通：kp20251106001';
    RAISE NOTICE '  合并：HBKP20251106001  ← 大写';
    RAISE NOTICE '';
    RAISE NOTICE '使用方法：';
    RAISE NOTICE '  SELECT merge_invoice_requests(ARRAY[''kp001'', ''kp002'']);';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;


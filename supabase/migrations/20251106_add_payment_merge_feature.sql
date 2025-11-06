-- ============================================================================
-- 付款申请合并功能
-- 创建日期：2025-11-06
-- 功能：支持将多个付款申请单合并为一个新申请单
-- ============================================================================

-- ============================================================================
-- 第一步：修改表结构 - 添加合并相关字段
-- ============================================================================

ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS merged_from_requests TEXT[],     -- 被合并的原申请单号数组
ADD COLUMN IF NOT EXISTS is_merged_request BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS merged_count INTEGER DEFAULT 0;

COMMENT ON COLUMN payment_requests.merged_from_requests IS '被合并的原始申请单号数组（仅合并申请单有值）';
COMMENT ON COLUMN payment_requests.is_merged_request IS '是否为合并后生成的申请单';
COMMENT ON COLUMN payment_requests.merged_count IS '合并了多少个原始申请单';

-- ============================================================================
-- 第二步：添加"已合并"状态
-- ============================================================================

ALTER TABLE payment_requests
DROP CONSTRAINT IF EXISTS payment_requests_status_check;

ALTER TABLE payment_requests
ADD CONSTRAINT payment_requests_status_check 
CHECK (status IN ('Pending', 'Approved', 'Paid', 'Rejected', 'Merged'));

-- ============================================================================
-- 第三步：创建合并申请单号生成函数
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_merged_payment_request_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_date_part TEXT;
    v_max_number INTEGER;
    v_new_number TEXT;
BEGIN
    -- 生成日期部分：YYYYMMDD
    v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- 查找今天最大的序号
    SELECT COALESCE(MAX(
        CASE 
            WHEN request_id LIKE 'HBFKD' || v_date_part || '-%' 
            THEN SUBSTRING(request_id FROM 'HBFKD[0-9]{8}-([0-9]{4})')::INTEGER
            ELSE 0
        END
    ), 0) INTO v_max_number
    FROM payment_requests
    WHERE request_id LIKE 'HBFKD' || v_date_part || '-%';
    
    -- 生成新编号：HBFKD + YYYYMMDD + - + 4位序号
    v_new_number := 'HBFKD' || v_date_part || '-' || LPAD((v_max_number + 1)::TEXT, 4, '0');
    
    RETURN v_new_number;
END;
$$;

COMMENT ON FUNCTION generate_merged_payment_request_number IS '生成合并付款申请单编号（HBFKD开头）';

-- ============================================================================
-- 第四步：创建合并付款申请RPC函数
-- ============================================================================

CREATE OR REPLACE FUNCTION merge_payment_requests(
    p_request_ids TEXT[]  -- 要合并的申请单号数组
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_request_id TEXT;
    v_new_request_uuid UUID;
    v_all_waybill_ids UUID[];
    v_total_amount NUMERIC;
    v_record_count INTEGER;
    v_current_user_id UUID;
    v_paying_partner_id UUID;
    v_paying_partner_name TEXT;
    v_bank_account TEXT;
    v_bank_name TEXT;
    v_branch_name TEXT;
    v_first_request RECORD;
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
            'message', '至少需要选择2个付款申请单'
        );
    END IF;
    
    -- 验证2：所有申请单必须存在且状态为"Pending"
    IF EXISTS (
        SELECT 1 FROM payment_requests 
        WHERE request_id = ANY(p_request_ids)
        AND status != 'Pending'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '只能合并"待审核"状态的申请单'
        );
    END IF;
    
    -- 获取第一个申请单的付款方信息（作为新申请单的付款方）
    SELECT * INTO v_first_request
    FROM payment_requests
    WHERE request_id = p_request_ids[1]
    LIMIT 1;
    
    v_paying_partner_id := v_first_request.paying_partner_id;
    v_paying_partner_name := v_first_request.paying_partner_full_name;
    v_bank_account := v_first_request.paying_partner_bank_account;
    v_bank_name := v_first_request.paying_partner_bank_name;
    v_branch_name := v_first_request.paying_partner_branch_name;
    
    -- 收集所有运单ID（自动去重）
    SELECT array_agg(DISTINCT detail.logistics_record_id)
    INTO v_all_waybill_ids
    FROM payment_requests pr
    JOIN payment_request_details detail ON pr.id = detail.payment_request_id
    WHERE pr.request_id = ANY(p_request_ids);
    
    -- 计算总金额和运单数
    SELECT 
        COALESCE(SUM(detail.amount), 0),
        COUNT(DISTINCT detail.logistics_record_id)
    INTO v_total_amount, v_record_count
    FROM payment_requests pr
    JOIN payment_request_details detail ON pr.id = detail.payment_request_id
    WHERE pr.request_id = ANY(p_request_ids);
    
    -- 生成新的合并申请单号
    v_new_request_id := generate_merged_payment_request_number();
    
    -- 创建新的合并付款申请单
    INSERT INTO payment_requests (
        request_id,
        paying_partner_id,
        paying_partner_full_name,
        paying_partner_bank_account,
        paying_partner_bank_name,
        paying_partner_branch_name,
        total_amount,
        record_count,
        status,
        created_by,
        created_at,
        merged_from_requests,
        is_merged_request,
        merged_count,
        notes
    ) VALUES (
        v_new_request_id,
        v_paying_partner_id,
        v_paying_partner_name,
        v_bank_account,
        v_bank_name,
        v_branch_name,
        v_total_amount,
        v_record_count,
        'Pending',
        v_current_user_id,
        NOW(),
        p_request_ids,
        true,
        array_length(p_request_ids, 1),
        '由' || array_length(p_request_ids, 1)::TEXT || '个申请单合并生成：' || array_to_string(p_request_ids, ', ')
    )
    RETURNING id INTO v_new_request_uuid;
    
    -- 复制所有运单明细到新申请单（去重）
    INSERT INTO payment_request_details (
        payment_request_id,
        logistics_record_id,
        amount
    )
    SELECT DISTINCT ON (detail.logistics_record_id)
        v_new_request_uuid,
        detail.logistics_record_id,
        detail.amount
    FROM payment_requests pr
    JOIN payment_request_details detail ON pr.id = detail.payment_request_id
    WHERE pr.request_id = ANY(p_request_ids);
    
    -- 将原申请单状态改为"已合并"
    UPDATE payment_requests
    SET status = 'Merged',
        updated_at = NOW(),
        notes = COALESCE(notes || ' | ', '') || '已合并到: ' || v_new_request_id
    WHERE request_id = ANY(p_request_ids);
    
    -- 更新运单：重新关联到新申请单
    UPDATE logistics_records
    SET payment_request_id = v_new_request_uuid,
        payment_status = 'Processing'
    WHERE id = ANY(v_all_waybill_ids);
    
    -- 返回成功结果
    RETURN jsonb_build_object(
        'success', true,
        'message', '合并成功',
        'new_request_id', v_new_request_id,
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

COMMENT ON FUNCTION merge_payment_requests IS '合并多个付款申请单（生成HBFKD编号，旧申请单状态变为Merged）';

-- ============================================================================
-- 第五步：创建取消合并RPC函数
-- ============================================================================

CREATE OR REPLACE FUNCTION unmerge_payment_request(
    p_merged_request_id TEXT  -- 要取消的合并申请单号
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_merged_request RECORD;
    v_original_request_ids TEXT[];
    v_current_user_id UUID;
    v_restored_count INTEGER := 0;
    v_original_request RECORD;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '用户未登录');
    END IF;
    
    -- 获取合并申请单信息
    SELECT * INTO v_merged_request
    FROM payment_requests
    WHERE request_id = p_merged_request_id
    AND is_merged_request = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '申请单不存在或不是合并申请单');
    END IF;
    
    -- 只能取消Pending状态
    IF v_merged_request.status != 'Pending' THEN
        RETURN jsonb_build_object('success', false, 'message', '只能取消"待审核"状态的合并申请单');
    END IF;
    
    v_original_request_ids := v_merged_request.merged_from_requests;
    
    -- 恢复原申请单状态
    UPDATE payment_requests
    SET status = 'Pending',
        updated_at = NOW(),
        notes = COALESCE(
            regexp_replace(notes, ' \| 已合并到:.*$', ''),
            ''
        ) || ' | 已从' || p_merged_request_id || '取消合并'
    WHERE request_id = ANY(v_original_request_ids);
    
    GET DIAGNOSTICS v_restored_count = ROW_COUNT;
    
    -- 将运单重新分配回原申请单
    FOR v_original_request IN
        SELECT id, request_id
        FROM payment_requests
        WHERE request_id = ANY(v_original_request_ids)
    LOOP
        WITH original_details AS (
            SELECT logistics_record_id
            FROM payment_request_details
            WHERE payment_request_id = v_original_request.id
        )
        UPDATE logistics_records
        SET payment_request_id = v_original_request.id,
            payment_status = 'Processing'
        WHERE id IN (SELECT logistics_record_id FROM original_details);
    END LOOP;
    
    -- 删除合并申请单的明细
    DELETE FROM payment_request_details
    WHERE payment_request_id = v_merged_request.id;
    
    -- 删除合并申请单
    DELETE FROM payment_requests
    WHERE id = v_merged_request.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '取消合并成功',
        'deleted_request_id', p_merged_request_id,
        'restored_count', v_restored_count,
        'restored_requests', v_original_request_ids
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', '取消合并失败: ' || SQLERRM);
END;
$$;

COMMENT ON FUNCTION unmerge_payment_request IS '取消合并付款申请（恢复原申请单，删除合并申请单）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 付款申请合并功能创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已添加：';
    RAISE NOTICE '  ✓ payment_requests.merged_from_requests';
    RAISE NOTICE '  ✓ payment_requests.is_merged_request';
    RAISE NOTICE '  ✓ payment_requests.merged_count';
    RAISE NOTICE '  ✓ Merged 状态';
    RAISE NOTICE '  ✓ generate_merged_payment_request_number()';
    RAISE NOTICE '  ✓ merge_payment_requests()';
    RAISE NOTICE '  ✓ unmerge_payment_request()';
    RAISE NOTICE '';
    RAISE NOTICE '申请单号格式：';
    RAISE NOTICE '  普通：FKD20251106-5110';
    RAISE NOTICE '  合并：HBFKD20251106-0001';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;


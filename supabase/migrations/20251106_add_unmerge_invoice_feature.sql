-- ============================================================================
-- 开票申请取消合并功能
-- 创建日期：2025-11-06
-- 功能：安全回滚合并操作，恢复原申请单
-- ============================================================================

-- ============================================================================
-- 创建取消合并RPC函数
-- ============================================================================

CREATE OR REPLACE FUNCTION unmerge_invoice_request(
    p_merged_request_number TEXT  -- 要取消的合并申请单号
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_merged_request RECORD;
    v_original_request_numbers TEXT[];
    v_waybill_ids UUID[];
    v_current_user_id UUID;
    v_restored_count INTEGER := 0;
    v_original_request RECORD;
BEGIN
    -- 获取当前用户
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '用户未登录'
        );
    END IF;
    
    -- 获取合并申请单信息
    SELECT * INTO v_merged_request
    FROM invoice_requests
    WHERE request_number = p_merged_request_number
    AND is_merged_request = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '申请单不存在或不是合并申请单'
        );
    END IF;
    
    -- 验证1：只能取消"待审核"状态的合并申请单
    IF v_merged_request.status != 'Pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '只能取消"待审核"状态的合并申请单，当前状态：' || v_merged_request.status
        );
    END IF;
    
    -- 获取原始申请单号数组
    v_original_request_numbers := v_merged_request.merged_from_requests;
    
    IF v_original_request_numbers IS NULL OR array_length(v_original_request_numbers, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '找不到原始申请单信息'
        );
    END IF;
    
    -- 验证2：原申请单必须都是"已合并"状态
    IF EXISTS (
        SELECT 1 FROM invoice_requests
        WHERE request_number = ANY(v_original_request_numbers)
        AND status != 'Merged'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '部分原始申请单状态不是"已合并"，无法取消合并'
        );
    END IF;
    
    -- 获取合并申请单的所有运单ID
    SELECT array_agg(DISTINCT logistics_record_id)
    INTO v_waybill_ids
    FROM invoice_request_details
    WHERE invoice_request_id = v_merged_request.id;
    
    -- 开始回滚操作
    
    -- 步骤1：恢复原申请单状态为"待审核"
    UPDATE invoice_requests
    SET status = 'Pending',
        updated_at = NOW(),
        remarks = COALESCE(
            CASE 
                WHEN remarks LIKE '%已合并到:%' 
                THEN regexp_replace(remarks, ' \| 已合并到:.*$', '')
                ELSE remarks
            END,
            ''
        ) || ' | 已从' || p_merged_request_number || '取消合并'
    WHERE request_number = ANY(v_original_request_numbers);
    
    GET DIAGNOSTICS v_restored_count = ROW_COUNT;
    
    -- 步骤2：将运单重新分配回原申请单
    -- 遍历每个原申请单，恢复其运单关联
    FOR v_original_request IN
        SELECT id, request_number
        FROM invoice_requests
        WHERE request_number = ANY(v_original_request_numbers)
    LOOP
        -- 获取该原申请单的运单ID
        WITH original_details AS (
            SELECT logistics_record_id
            FROM invoice_request_details
            WHERE invoice_request_id = v_original_request.id
        )
        -- 更新运单，重新关联回原申请单
        UPDATE logistics_records
        SET invoice_request_id = v_original_request.id,
            invoice_status = 'Processing',  -- 恢复为Processing状态
            updated_at = NOW()
        WHERE id IN (SELECT logistics_record_id FROM original_details);
        
        -- 更新合作方成本，重新关联回原申请单
        UPDATE logistics_partner_costs
        SET invoice_request_id = v_original_request.id,
            updated_at = NOW()
        WHERE logistics_record_id IN (SELECT logistics_record_id FROM original_details);
    END LOOP;
    
    -- 步骤3：删除合并申请单的明细
    DELETE FROM invoice_request_details
    WHERE invoice_request_id = v_merged_request.id;
    
    -- 步骤4：删除合并申请单
    DELETE FROM invoice_requests
    WHERE id = v_merged_request.id;
    
    -- 返回成功结果
    RETURN jsonb_build_object(
        'success', true,
        'message', '取消合并成功',
        'deleted_request_number', p_merged_request_number,
        'restored_count', v_restored_count,
        'restored_requests', v_original_request_numbers
    );
    
EXCEPTION WHEN OTHERS THEN
    -- 出错时自动回滚
    RETURN jsonb_build_object(
        'success', false,
        'message', '取消合并失败: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION unmerge_invoice_request IS '取消合并开票申请（恢复原申请单，删除合并申请单）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 取消合并功能创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已添加：';
    RAISE NOTICE '  ✓ unmerge_invoice_request() 函数';
    RAISE NOTICE '';
    RAISE NOTICE '使用方法：';
    RAISE NOTICE '  SELECT unmerge_invoice_request(''hbkp20251106001'');';
    RAISE NOTICE '';
    RAISE NOTICE '功能：';
    RAISE NOTICE '  1. 验证合并申请单状态（必须是Pending）';
    RAISE NOTICE '  2. 恢复原申请单状态为Pending';
    RAISE NOTICE '  3. 运单重新分配回原申请单';
    RAISE NOTICE '  4. 删除合并申请单';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;


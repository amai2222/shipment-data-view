-- ============================================================================
-- 修复货主余额流水查询SQL错误
-- ============================================================================
-- 创建日期：2025-11-14
-- 问题：get_partner_balance_transactions函数中jsonb_agg内部ORDER BY导致GROUP BY错误
-- 修复：使用子查询先排序和限制，然后再聚合
-- ============================================================================

BEGIN;

-- 修复get_partner_balance_transactions函数
CREATE OR REPLACE FUNCTION public.get_partner_balance_transactions(
    p_partner_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_transactions JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', pbt.id,
            'transaction_type', pbt.transaction_type,
            'transaction_category', pbt.transaction_category,
            'amount', pbt.amount,
            'balance_before', pbt.balance_before,
            'balance_after', pbt.balance_after,
            'reference_type', pbt.reference_type,
            'reference_id', pbt.reference_id,
            'reference_number', pbt.reference_number,
            'description', pbt.description,
            'created_at', pbt.created_at
        ) ORDER BY pbt.created_at DESC
    ) INTO v_transactions
    FROM (
        SELECT pbt.*
        FROM public.partner_balance_transactions pbt
        WHERE pbt.partner_id = p_partner_id
          AND (p_start_date IS NULL OR DATE(pbt.created_at) >= p_start_date)
          AND (p_end_date IS NULL OR DATE(pbt.created_at) <= p_end_date)
        ORDER BY pbt.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) pbt;
    
    RETURN jsonb_build_object(
        'success', true,
        'transactions', COALESCE(v_transactions, '[]'::jsonb)
    );
END;
$$;

COMMENT ON FUNCTION public.get_partner_balance_transactions IS '获取货主余额流水记录（已修复GROUP BY错误）';

COMMIT;

-- 验证
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ get_partner_balance_transactions 函数已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  - 使用子查询先排序和限制，然后再聚合';
    RAISE NOTICE '  - 解决了 GROUP BY 错误';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;


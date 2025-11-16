-- ============================================================================
-- 迁移运费对账系统权限检查到统一权限系统
-- 创建时间：2025-11-16
-- 描述：将对账相关函数的硬编码角色检查改为使用统一权限系统
-- ============================================================================

-- ============================================================================
-- 第一部分：更新对账相关函数，使用统一权限检查
-- ============================================================================

-- 1. 更新 reconcile_partner_costs_batch 函数
CREATE OR REPLACE FUNCTION public.reconcile_partner_costs_batch(
    p_cost_ids UUID[],
    p_reconciliation_status TEXT DEFAULT 'Reconciled',
    p_reconciliation_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
    v_status TEXT;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.reconcile') THEN
        RAISE EXCEPTION '权限不足：您没有运费对账权限。需要 finance.reconcile 权限';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 校验对账状态
    IF p_reconciliation_status NOT IN ('Reconciled', 'Unreconciled', 'Exception') THEN
        RAISE EXCEPTION '对账状态无效: %。有效值：Reconciled, Unreconciled, Exception', p_reconciliation_status;
    END IF;

    -- 更新对账信息
    UPDATE public.logistics_partner_costs
    SET 
        reconciliation_status = p_reconciliation_status,
        reconciliation_date = CASE 
            WHEN p_reconciliation_status = 'Reconciled' THEN NOW()
            ELSE reconciliation_date
        END,
        reconciliation_by = CASE 
            WHEN p_reconciliation_status = 'Reconciled' THEN v_user_id
            ELSE reconciliation_by
        END,
        reconciliation_notes = p_reconciliation_notes,
        updated_at = NOW()
    WHERE id = ANY(p_cost_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- 返回结果
    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功对账 %s 条记录，状态：%s', v_count, 
            CASE p_reconciliation_status 
                WHEN 'Reconciled' THEN '已对账'
                WHEN 'Unreconciled' THEN '未对账'
                WHEN 'Exception' THEN '异常'
            END),
        'count', v_count
    );
END;
$$;

COMMENT ON FUNCTION public.reconcile_partner_costs_batch IS '批量对账合作方成本记录（使用统一权限系统：finance.reconcile）';

-- 2. 更新 reconcile_partner_cost 函数
CREATE OR REPLACE FUNCTION public.reconcile_partner_cost(
    p_logistics_record_id UUID,
    p_partner_id UUID,
    p_reconciliation_status TEXT DEFAULT 'Reconciled',
    p_reconciliation_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_cost_id UUID;
BEGIN
    -- ✅ 使用统一权限系统检查
    IF NOT public.has_function_permission('finance.reconcile') THEN
        RAISE EXCEPTION '权限不足：您没有运费对账权限。需要 finance.reconcile 权限';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 查找对应的成本记录
    SELECT id INTO v_cost_id
    FROM public.logistics_partner_costs
    WHERE logistics_record_id = p_logistics_record_id
      AND partner_id = p_partner_id;

    IF v_cost_id IS NULL THEN
        RAISE EXCEPTION '未找到对应的合作方成本记录';
    END IF;

    -- 校验对账状态
    IF p_reconciliation_status NOT IN ('Reconciled', 'Unreconciled', 'Exception') THEN
        RAISE EXCEPTION '对账状态无效: %。有效值：Reconciled, Unreconciled, Exception', p_reconciliation_status;
    END IF;

    -- 更新对账信息
    UPDATE public.logistics_partner_costs
    SET 
        reconciliation_status = p_reconciliation_status,
        reconciliation_date = CASE 
            WHEN p_reconciliation_status = 'Reconciled' THEN NOW()
            ELSE reconciliation_date
        END,
        reconciliation_by = CASE 
            WHEN p_reconciliation_status = 'Reconciled' THEN v_user_id
            ELSE reconciliation_by
        END,
        reconciliation_notes = p_reconciliation_notes,
        updated_at = NOW()
    WHERE id = v_cost_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('对账成功，状态：%s', 
            CASE p_reconciliation_status 
                WHEN 'Reconciled' THEN '已对账'
                WHEN 'Unreconciled' THEN '未对账'
                WHEN 'Exception' THEN '异常'
            END),
        'cost_id', v_cost_id
    );
END;
$$;

COMMENT ON FUNCTION public.reconcile_partner_cost IS '单个对账合作方成本记录（使用统一权限系统：finance.reconcile）';

-- ============================================================================
-- 第二部分：为现有角色配置权限（如果尚未配置）
-- ============================================================================

-- 为 finance 角色添加运费对账权限（如果尚未存在）
DO $$
BEGIN
    -- 检查 role_permission_templates 表是否存在 finance 角色记录
    IF EXISTS (SELECT 1 FROM public.role_permission_templates WHERE role = 'finance') THEN
        -- 更新现有记录，添加运费对账权限（如果尚未存在）
        UPDATE public.role_permission_templates
        SET function_permissions = (
            SELECT array_agg(DISTINCT elem)
            FROM (
                SELECT unnest(COALESCE(function_permissions, ARRAY[]::TEXT[])) AS elem
                UNION
                SELECT 'finance.reconcile'  -- 运费对账权限
            ) AS combined
        )
        WHERE role = 'finance'
          AND NOT ('finance.reconcile' = ANY(COALESCE(function_permissions, ARRAY[]::TEXT[])));
        
        IF FOUND THEN
            RAISE NOTICE '✅ 已为 finance 角色添加运费对账权限 (finance.reconcile)';
        ELSE
            RAISE NOTICE 'ℹ️  finance 角色已拥有运费对账权限 (finance.reconcile)';
        END IF;
    ELSE
        -- 创建新记录（如果 finance 角色不存在）
        INSERT INTO public.role_permission_templates (
            role,
            function_permissions
        ) VALUES (
            'finance',
            ARRAY['finance.reconcile']
        );
        
        RAISE NOTICE '✅ 已为 finance 角色创建权限模板（包含运费对账权限）';
    END IF;
END $$;

-- admin 角色自动拥有所有权限（在 has_function_permission 函数中已实现）
-- 无需额外配置

-- ============================================================================
-- 第三部分：验证迁移结果
-- ============================================================================

DO $$
DECLARE
    v_function_count INTEGER;
    v_permission_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 运费对账系统权限迁移完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- 检查函数数量
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc
    WHERE proname IN (
        'reconcile_partner_costs_batch',
        'reconcile_partner_cost'
    );
    
    RAISE NOTICE '📊 函数检查：';
    RAISE NOTICE '  ✅ 已更新函数数量: %', v_function_count;
    
    -- 检查权限配置
    SELECT COUNT(*) INTO v_permission_count
    FROM public.role_permission_templates
    WHERE role = 'finance'
      AND 'finance.reconcile' = ANY(COALESCE(function_permissions, ARRAY[]::TEXT[]));
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 权限配置检查：';
    IF v_permission_count > 0 THEN
        RAISE NOTICE '  ✅ finance 角色已配置运费对账权限';
    ELSE
        RAISE NOTICE '  ⚠️  finance 角色未配置运费对账权限（请手动配置）';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 迁移完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📝 权限键说明：';
    RAISE NOTICE '  ✅ finance.reconcile - 运费对账';
    RAISE NOTICE '';
    RAISE NOTICE '💡 提示：';
    RAISE NOTICE '  - admin 角色自动拥有所有权限';
    RAISE NOTICE '  - 可以通过 role_permission_templates 表配置角色权限';
    RAISE NOTICE '  - 可以通过 user_permissions 表为用户单独配置权限';
    RAISE NOTICE '';
END $$;


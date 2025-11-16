-- ============================================================================
-- 功能：为 logistics_partner_costs 表添加对账相关字段
-- 日期：2025-11-16
-- 说明：运费对账系统 - 支持对合作方应付金额进行对账
-- ============================================================================

-- 1. 添加对账相关字段
ALTER TABLE public.logistics_partner_costs
ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'Unreconciled' CHECK (reconciliation_status IN ('Unreconciled', 'Reconciled', 'Exception')),
ADD COLUMN IF NOT EXISTS reconciliation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reconciliation_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

-- 2. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_reconciliation_status 
ON public.logistics_partner_costs(reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_reconciliation_date 
ON public.logistics_partner_costs(reconciliation_date);

-- 3. 添加注释
COMMENT ON COLUMN public.logistics_partner_costs.reconciliation_status IS '对账状态：Unreconciled-未对账, Reconciled-已对账, Exception-异常';
COMMENT ON COLUMN public.logistics_partner_costs.reconciliation_date IS '对账日期';
COMMENT ON COLUMN public.logistics_partner_costs.reconciliation_by IS '对账操作人ID';
COMMENT ON COLUMN public.logistics_partner_costs.reconciliation_notes IS '对账备注';

-- ============================================================================
-- 4. 创建批量对账函数
-- ============================================================================
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
    -- 检查权限（需要财务或管理员权限）
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以对账';
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

COMMENT ON FUNCTION public.reconcile_partner_costs_batch IS '批量对账合作方成本记录';

-- ============================================================================
-- 5. 创建单个对账函数（通过运单ID和合作方ID）
-- ============================================================================
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
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以对账';
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

COMMENT ON FUNCTION public.reconcile_partner_cost IS '单个对账合作方成本记录（通过运单ID和合作方ID）';

-- ============================================================================
-- 完成
-- ============================================================================
SELECT '✅ 对账字段和函数已添加完成' AS status;


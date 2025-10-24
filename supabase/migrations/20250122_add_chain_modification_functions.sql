-- 合作链路修改相关函数
-- 创建时间: 2025-01-22
-- 功能: 提供合作链路修改的后端处理函数

-- 创建权限检查函数：财务、操作员、管理员
CREATE OR REPLACE FUNCTION public.is_finance_operator_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- 获取当前用户的角色
    SELECT role INTO user_role
    FROM public.user_profiles
    WHERE user_id = auth.uid();
    
    -- 检查是否为财务、操作员或管理员
    RETURN user_role IN ('finance', 'operator', 'admin');
END;
$$;

-- 1. 单个记录合作链路修改函数
CREATE OR REPLACE FUNCTION public.modify_logistics_record_chain(
    p_record_id UUID,
    p_chain_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_updated_count INTEGER := 0;
    v_recalc_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_operator_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务、操作员或管理员可以修改合作链路';
    END IF;

    -- 验证记录是否存在
    IF NOT EXISTS (SELECT 1 FROM public.logistics_records WHERE id = p_record_id) THEN
        RAISE EXCEPTION '运单记录不存在';
    END IF;

    -- 更新运单的合作链路
    UPDATE public.logistics_records
    SET 
        chain_id = p_chain_name,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- 重新计算合作方成本
    SELECT public.recalculate_costs_for_chain_safe(ARRAY[p_record_id]) INTO v_recalc_result;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'message', '合作链路修改成功',
        'updated_records', v_updated_count,
        'recalc_result', v_recalc_result,
        'record_id', p_record_id,
        'new_chain', p_chain_name
    );

    RETURN v_result;
END;
$$;

-- 2. 批量修改合作链路函数
CREATE OR REPLACE FUNCTION public.batch_modify_logistics_records_chain(
    p_record_ids UUID[],
    p_chain_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_updated_count INTEGER := 0;
    v_recalc_result JSONB;
    v_project_ids UUID[];
    v_unique_projects INTEGER;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_operator_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务、操作员或管理员可以修改合作链路';
    END IF;

    -- 验证记录是否存在
    IF NOT EXISTS (SELECT 1 FROM public.logistics_records WHERE id = ANY(p_record_ids)) THEN
        RAISE EXCEPTION '部分运单记录不存在';
    END IF;

    -- 检查所有记录是否属于同一项目
    SELECT array_agg(DISTINCT project_id) INTO v_project_ids
    FROM public.logistics_records
    WHERE id = ANY(p_record_ids);
    
    SELECT array_length(v_project_ids, 1) INTO v_unique_projects;
    
    IF v_unique_projects > 1 THEN
        RAISE EXCEPTION '批量修改合作链路需要所有记录都属于同一个项目';
    END IF;

    -- 批量更新运单的合作链路
    UPDATE public.logistics_records
    SET 
        chain_id = p_chain_name,
        updated_at = NOW()
    WHERE id = ANY(p_record_ids);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- 重新计算合作方成本
    SELECT public.recalculate_costs_for_chain_safe(p_record_ids) INTO v_recalc_result;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'message', '批量合作链路修改成功',
        'updated_records', v_updated_count,
        'recalc_result', v_recalc_result,
        'record_ids', p_record_ids,
        'new_chain', p_chain_name
    );

    RETURN v_result;
END;
$$;

-- 3. 获取项目可用合作链路函数
CREATE OR REPLACE FUNCTION public.get_project_available_chains(
    p_project_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_chains JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_operator_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务、操作员或管理员可以查看合作链路';
    END IF;

    -- 获取项目的所有合作链路
    SELECT jsonb_agg(
        jsonb_build_object(
            'chain_name', chain_name,
            'created_at', created_at
        ) ORDER BY chain_name
    ) INTO v_chains
    FROM public.partner_chains
    WHERE project_id = p_project_id;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'chains', COALESCE(v_chains, '[]'::jsonb),
        'project_id', p_project_id
    );

    RETURN v_result;
END;
$$;

-- 4. 验证合作链路修改权限函数
CREATE OR REPLACE FUNCTION public.validate_chain_modification_permission(
    p_record_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_project_ids UUID[];
    v_unique_projects INTEGER;
    v_valid_records INTEGER;
    v_total_records INTEGER;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_operator_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务、操作员或管理员可以修改合作链路';
    END IF;

    -- 统计有效记录数
    SELECT COUNT(*) INTO v_valid_records
    FROM public.logistics_records
    WHERE id = ANY(p_record_ids);
    
    v_total_records := array_length(p_record_ids, 1);

    -- 检查所有记录是否属于同一项目
    SELECT array_agg(DISTINCT project_id) INTO v_project_ids
    FROM public.logistics_records
    WHERE id = ANY(p_record_ids);
    
    SELECT array_length(v_project_ids, 1) INTO v_unique_projects;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'valid_records', v_valid_records,
        'total_records', v_total_records,
        'unique_projects', v_unique_projects,
        'can_modify', v_unique_projects <= 1 AND v_valid_records > 0,
        'project_ids', v_project_ids
    );

    RETURN v_result;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.is_finance_operator_or_admin() IS '检查用户是否为财务、操作员或管理员角色';
COMMENT ON FUNCTION public.modify_logistics_record_chain(UUID, TEXT) IS '修改单个运单记录的合作链路';
COMMENT ON FUNCTION public.batch_modify_logistics_records_chain(UUID[], TEXT) IS '批量修改运单记录的合作链路';
COMMENT ON FUNCTION public.get_project_available_chains(UUID) IS '获取项目可用的合作链路列表';
COMMENT ON FUNCTION public.validate_chain_modification_permission(UUID[]) IS '验证合作链路修改权限和项目一致性';

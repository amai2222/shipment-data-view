-- 修复合作链路成本重算函数调用 - 简单方案
-- 问题：recalculate_costs_for_chain_safe函数参数不匹配
-- 解决：使用现有的重算函数，但需要先获取项目ID和链路ID

-- 1. 修复单个记录修改函数
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
    v_project_id UUID;
    v_chain_id UUID;
    v_chain_uuid UUID;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_operator_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务、操作员或管理员可以修改合作链路';
    END IF;

    -- 验证记录是否存在
    IF NOT EXISTS (SELECT 1 FROM public.logistics_records WHERE id = p_record_id) THEN
        RAISE EXCEPTION '运单记录不存在';
    END IF;

    -- 获取记录的项目ID
    SELECT project_id INTO v_project_id
    FROM public.logistics_records
    WHERE id = p_record_id;

    -- 获取链路ID（通过链路名称查找）
    SELECT id INTO v_chain_uuid
    FROM public.partner_chains
    WHERE chain_name = p_chain_name
    AND project_id = v_project_id;

    -- 更新运单的合作链路
    UPDATE public.logistics_records
    SET 
        chain_id = p_chain_name,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- 重新计算合作方成本（使用正确的参数）
    IF v_chain_uuid IS NOT NULL THEN
        SELECT public.recalculate_costs_for_chain_safe(v_project_id, v_chain_uuid, TRUE) INTO v_recalc_result;
    ELSE
        v_recalc_result := jsonb_build_object('success', false, 'message', '未找到对应的链路ID');
    END IF;

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

-- 2. 修复批量修改函数
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
    v_project_id UUID;
    v_chain_uuid UUID;
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

    -- 获取项目ID
    v_project_id := v_project_ids[1];

    -- 获取链路ID（通过链路名称查找）
    SELECT id INTO v_chain_uuid
    FROM public.partner_chains
    WHERE chain_name = p_chain_name
    AND project_id = v_project_id;

    -- 批量更新运单的合作链路
    UPDATE public.logistics_records
    SET 
        chain_id = p_chain_name,
        updated_at = NOW()
    WHERE id = ANY(p_record_ids);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- 重新计算合作方成本（使用正确的参数）
    IF v_chain_uuid IS NOT NULL THEN
        SELECT public.recalculate_costs_for_chain_safe(v_project_id, v_chain_uuid, TRUE) INTO v_recalc_result;
    ELSE
        v_recalc_result := jsonb_build_object('success', false, 'message', '未找到对应的链路ID');
    END IF;

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

-- 添加函数注释
COMMENT ON FUNCTION public.modify_logistics_record_chain(UUID, TEXT) IS '修改单个运单记录的合作链路（已修复成本重算调用）';
COMMENT ON FUNCTION public.batch_modify_logistics_records_chain(UUID[], TEXT) IS '批量修改运单记录的合作链路（已修复成本重算调用）';

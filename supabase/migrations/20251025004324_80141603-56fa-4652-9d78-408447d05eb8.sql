-- 删除旧的函数（如果存在）
DROP FUNCTION IF EXISTS public.get_project_available_chains(UUID);
DROP FUNCTION IF EXISTS public.validate_chain_modification_permission(UUID[]);
DROP FUNCTION IF EXISTS public.modify_logistics_record_chain(UUID, TEXT);
DROP FUNCTION IF EXISTS public.batch_modify_logistics_records_chain(UUID[], TEXT);
DROP FUNCTION IF EXISTS public.is_finance_operator_or_admin();

-- 创建权限检查函数
CREATE OR REPLACE FUNCTION public.is_finance_operator_or_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN user_role IN ('财务', '操作员', '管理员');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建获取项目可用合作链路的函数
CREATE OR REPLACE FUNCTION public.get_project_available_chains(
    p_project_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_can_access BOOLEAN;
BEGIN
    -- 权限检查
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以查看合作链路',
            'chains', '[]'::json
        );
    END IF;
    
    -- 获取项目的合作链路列表
    SELECT json_build_object(
        'success', true,
        'message', '获取成功',
        'chains', COALESCE(json_agg(
            json_build_object(
                'id', pc.id,
                'chain_name', pc.chain_name,
                'is_default', pc.is_default
            ) ORDER BY pc.is_default DESC, pc.chain_name
        ), '[]'::json)
    )
    INTO v_result
    FROM public.partner_chains pc
    WHERE pc.project_id = p_project_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建验证合作链路修改权限的函数
CREATE OR REPLACE FUNCTION public.validate_chain_modification_permission(
    p_record_ids UUID[]
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_can_access BOOLEAN;
    v_project_count INTEGER;
    v_project_id UUID;
    v_total_records INTEGER;
BEGIN
    -- 权限检查
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object(
            'can_modify', false,
            'message', '权限不足：只有财务、操作员和管理员可以修改合作链路',
            'total_records', 0,
            'project_count', 0
        );
    END IF;
    
    -- 检查记录数量
    SELECT COUNT(*) INTO v_total_records
    FROM public.logistics_records
    WHERE id = ANY(p_record_ids);
    
    -- 检查是否所有记录都属于同一个项目
    SELECT COUNT(DISTINCT project_id), MIN(project_id)
    INTO v_project_count, v_project_id
    FROM public.logistics_records
    WHERE id = ANY(p_record_ids);
    
    -- 如果记录属于多个项目，返回错误
    IF v_project_count > 1 THEN
        RETURN json_build_object(
            'can_modify', false,
            'message', '所选记录必须属于同一个项目',
            'total_records', v_total_records,
            'project_count', v_project_count
        );
    END IF;
    
    -- 返回成功结果
    RETURN json_build_object(
        'can_modify', true,
        'message', '可以修改',
        'total_records', v_total_records,
        'project_count', v_project_count,
        'project_id', v_project_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建修改单个运单合作链路的函数
CREATE OR REPLACE FUNCTION public.modify_logistics_record_chain(
    p_record_id UUID,
    p_chain_name TEXT
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_can_access BOOLEAN;
    v_project_id UUID;
    v_chain_id UUID;
    v_old_chain_name TEXT;
BEGIN
    -- 权限检查
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以修改合作链路'
        );
    END IF;
    
    -- 获取记录的项目ID和旧链路名称
    SELECT project_id, chain_name
    INTO v_project_id, v_old_chain_name
    FROM public.logistics_records
    WHERE id = p_record_id;
    
    IF v_project_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '运单记录不存在'
        );
    END IF;
    
    -- 查找新的合作链路ID
    SELECT id INTO v_chain_id
    FROM public.partner_chains
    WHERE project_id = v_project_id
    AND chain_name = p_chain_name
    LIMIT 1;
    
    IF v_chain_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '指定的合作链路不存在'
        );
    END IF;
    
    -- 更新运单记录
    UPDATE public.logistics_records
    SET 
        chain_id = v_chain_id,
        chain_name = p_chain_name,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- 返回成功结果
    RETURN json_build_object(
        'success', true,
        'message', '合作链路修改成功',
        'record_id', p_record_id,
        'old_chain_name', v_old_chain_name,
        'new_chain_name', p_chain_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建批量修改运单合作链路的函数
CREATE OR REPLACE FUNCTION public.batch_modify_logistics_records_chain(
    p_record_ids UUID[],
    p_chain_name TEXT
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_can_access BOOLEAN;
    v_project_id UUID;
    v_chain_id UUID;
    v_updated_count INTEGER;
    v_project_count INTEGER;
BEGIN
    -- 权限检查
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以批量修改合作链路',
            'updated_count', 0
        );
    END IF;
    
    -- 检查是否所有记录都属于同一个项目
    SELECT COUNT(DISTINCT project_id), MIN(project_id)
    INTO v_project_count, v_project_id
    FROM public.logistics_records
    WHERE id = ANY(p_record_ids);
    
    IF v_project_count > 1 THEN
        RETURN json_build_object(
            'success', false,
            'message', '所选记录必须属于同一个项目',
            'updated_count', 0
        );
    END IF;
    
    IF v_project_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '未找到有效的运单记录',
            'updated_count', 0
        );
    END IF;
    
    -- 查找合作链路ID
    SELECT id INTO v_chain_id
    FROM public.partner_chains
    WHERE project_id = v_project_id
    AND chain_name = p_chain_name
    LIMIT 1;
    
    IF v_chain_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '指定的合作链路不存在',
            'updated_count', 0
        );
    END IF;
    
    -- 批量更新运单记录
    UPDATE public.logistics_records
    SET 
        chain_id = v_chain_id,
        chain_name = p_chain_name,
        updated_at = NOW()
    WHERE id = ANY(p_record_ids);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- 返回成功结果
    RETURN json_build_object(
        'success', true,
        'message', '批量修改成功',
        'updated_count', v_updated_count,
        'new_chain_name', p_chain_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
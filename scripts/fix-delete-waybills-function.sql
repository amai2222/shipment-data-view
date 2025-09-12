-- 修复 delete_waybills_by_project 函数
-- 解决运单维护页面"按项目删除运单"功能报错问题

BEGIN;

-- 1. 删除可能存在的旧版本函数（避免冲突）
DROP FUNCTION IF EXISTS public.delete_waybills_by_project(TEXT);
DROP FUNCTION IF EXISTS public.delete_waybills_by_project(text);

-- 2. 重新创建 delete_waybills_by_project 函数
CREATE OR REPLACE FUNCTION public.delete_waybills_by_project(p_project_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    -- 用于存储操作过程中的中间数据和计数
    v_project_id UUID;
    v_deleted_logistics_ids UUID[];
    v_deleted_logistics_count INT;
    v_deleted_costs_count INT;
    v_result JSONB;
BEGIN
    -- 首先，根据项目名称找到项目ID
    SELECT id INTO v_project_id FROM public.projects WHERE name = p_project_name;

    -- 如果找不到项目ID，则返回错误
    IF v_project_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '找不到名为 "' || p_project_name || '" 的项目',
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
    END IF;

    -- 第1步：找出所有属于该项目的运单记录ID
    SELECT array_agg(id)
    INTO v_deleted_logistics_ids
    FROM public.logistics_records
    WHERE project_id = v_project_id;

    -- 如果没有找到任何运单记录，则返回提示
    IF v_deleted_logistics_ids IS NULL OR array_length(v_deleted_logistics_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', '项目 "' || p_project_name || '" 下没有找到任何运单记录，无需删除',
            'deleted_logistics_count', 0,
            'deleted_costs_count', 0
        );
    END IF;

    -- 第2步：使用捕获到的ID，删除所有相关的【物流合作方成本】记录
    WITH deleted_rows AS (
        DELETE FROM public.logistics_partner_costs
        WHERE logistics_record_id = ANY(v_deleted_logistics_ids)
        RETURNING 1
    )
    SELECT count(*) INTO v_deleted_costs_count FROM deleted_rows;

    -- 第3步：使用相同的ID数组，删除所有【运单记录】本身
    WITH deleted_rows AS (
        DELETE FROM public.logistics_records
        WHERE id = ANY(v_deleted_logistics_ids)
        RETURNING 1
    )
    SELECT count(*) INTO v_deleted_logistics_count FROM deleted_rows;

    -- 第4步：返回执行结果
    RETURN jsonb_build_object(
        'success', true,
        'message', '删除操作成功完成',
        'project_name', p_project_name,
        'deleted_logistics_count', v_deleted_logistics_count,
        'deleted_costs_count', v_deleted_costs_count
    );

EXCEPTION WHEN OTHERS THEN
    -- 如果发生任何错误，返回错误信息
    RETURN jsonb_build_object(
        'success', false,
        'error', '删除操作失败: ' || SQLERRM,
        'deleted_logistics_count', 0,
        'deleted_costs_count', 0
    );
END;
$$;

-- 3. 添加函数注释
COMMENT ON FUNCTION public.delete_waybills_by_project(TEXT) IS 
'按项目删除所有运单记录
- 删除指定项目下的所有运单记录
- 同时删除相关的物流合作方成本记录
- 返回删除统计信息';

-- 4. 验证函数创建成功
SELECT 'delete_waybills_by_project function created successfully' as status;

-- 5. 测试函数是否正常工作（使用一个存在的项目名称）
SELECT public.delete_waybills_by_project('可口可乐') as test_result;

COMMIT;

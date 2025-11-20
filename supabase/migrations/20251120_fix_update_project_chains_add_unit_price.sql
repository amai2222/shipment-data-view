-- ============================================================================
-- 修复 update_project_chains_incremental 函数：添加 unit_price 支持
-- 日期：2025-11-20
-- 问题：定价法的单价无法保存
-- 原因：INSERT INTO project_partners 时缺少 unit_price 字段
-- 解决：在 INSERT 语句中添加 unit_price 字段
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_project_chains_incremental(
    p_project_id UUID,
    p_project_data JSONB,
    p_changed_chains JSONB[],
    p_deleted_chain_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_chain JSONB;
    v_chain_id UUID;
    v_partner JSONB;
    v_updated_chains INTEGER := 0;
    v_deleted_chains INTEGER := 0;
    v_updated_partners INTEGER := 0;
    v_deleted_partners INTEGER := 0;
    i INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '开始增量更新项目链路';
    RAISE NOTICE '项目ID: %', p_project_id;
    RAISE NOTICE '变更链路数: %', array_length(p_changed_chains, 1);
    RAISE NOTICE '删除链路数: %', array_length(p_deleted_chain_ids, 1);
    RAISE NOTICE '========================================';
    
    -- 第1步：更新项目基本信息
    UPDATE public.projects
    SET 
        name = p_project_data->>'name',
        start_date = (p_project_data->>'start_date')::DATE,
        end_date = (p_project_data->>'end_date')::DATE,
        manager = p_project_data->>'manager',
        loading_address = p_project_data->>'loading_address',
        unloading_address = p_project_data->>'unloading_address',
        finance_manager = p_project_data->>'finance_manager',
        planned_total_tons = (p_project_data->>'planned_total_tons')::NUMERIC,
        project_status = p_project_data->>'project_status',
        cargo_type = p_project_data->>'cargo_type',
        effective_quantity_type = COALESCE(
            (p_project_data->>'effective_quantity_type')::public.effective_quantity_type,
            'min_value'::public.effective_quantity_type
        ),
        updated_at = NOW()
    WHERE id = p_project_id;
    
    RAISE NOTICE '✓ 已更新项目基本信息';
    
    -- 第2步：删除被移除的链路
    IF p_deleted_chain_ids IS NOT NULL AND array_length(p_deleted_chain_ids, 1) > 0 THEN
        DELETE FROM public.project_partners
        WHERE chain_id = ANY(p_deleted_chain_ids);
        
        GET DIAGNOSTICS v_deleted_partners = ROW_COUNT;
        
        DELETE FROM public.partner_chains
        WHERE id = ANY(p_deleted_chain_ids);
        
        GET DIAGNOSTICS v_deleted_chains = ROW_COUNT;
        
        RAISE NOTICE '✓ 已删除 % 条链路，包含 % 个合作方配置', v_deleted_chains, v_deleted_partners;
    END IF;
    
    -- 第3步：处理变更的链路
    IF p_changed_chains IS NOT NULL THEN
        FOREACH v_chain IN ARRAY p_changed_chains
        LOOP
            v_chain_id := (v_chain->>'id')::UUID;
            
            IF v_chain_id IS NULL THEN
                -- 3.1 新增链路
                INSERT INTO public.partner_chains (
                    project_id,
                    chain_name,
                    description,
                    is_default,
                    billing_type_id,
                    user_id
                ) VALUES (
                    p_project_id,
                    v_chain->>'chain_name',
                    v_chain->>'description',
                    COALESCE((v_chain->>'is_default')::BOOLEAN, FALSE),
                    COALESCE((v_chain->>'billing_type_id')::BIGINT, 1),
                    auth.uid()
                ) RETURNING id INTO v_chain_id;
                
                RAISE NOTICE '✓ 新增链路: % (ID: %)', v_chain->>'chain_name', v_chain_id;
                v_updated_chains := v_updated_chains + 1;
            ELSE
                -- 3.2 更新现有链路
                UPDATE public.partner_chains
                SET 
                    chain_name = v_chain->>'chain_name',
                    description = COALESCE(v_chain->>'description', ''),
                    is_default = COALESCE((v_chain->>'is_default')::BOOLEAN, FALSE),
                    billing_type_id = COALESCE((v_chain->>'billing_type_id')::BIGINT, 1),
                    updated_at = NOW()
                WHERE id = v_chain_id
                  AND (
                    chain_name IS DISTINCT FROM (v_chain->>'chain_name') OR
                    description IS DISTINCT FROM COALESCE(v_chain->>'description', '') OR
                    is_default IS DISTINCT FROM COALESCE((v_chain->>'is_default')::BOOLEAN, FALSE) OR
                    billing_type_id IS DISTINCT FROM COALESCE((v_chain->>'billing_type_id')::BIGINT, 1)
                  );
                
                IF FOUND THEN
                    RAISE NOTICE '✓ 更新链路基本信息: % (ID: %)', v_chain->>'chain_name', v_chain_id;
                ELSE
                    RAISE NOTICE '- 链路基本信息未变化: % (ID: %)', v_chain->>'chain_name', v_chain_id;
                END IF;
                
                v_updated_chains := v_updated_chains + 1;
            END IF;
            
            -- 3.3 更新该链路的合作方配置
            -- 删除该链路的所有旧合作方配置（会触发 DELETE 触发器）
            DELETE FROM public.project_partners
            WHERE chain_id = v_chain_id;
            
            GET DIAGNOSTICS v_deleted_partners = ROW_COUNT;
            
            IF v_deleted_partners > 0 THEN
                RAISE NOTICE '  - 删除该链路的 % 个旧合作方配置', v_deleted_partners;
            END IF;
            
            -- ✅ 修复：插入新的合作方配置时添加 unit_price 字段
            FOR i IN 0..jsonb_array_length(v_chain->'partners')-1
            LOOP
                v_partner := v_chain->'partners'->i;
                
                INSERT INTO public.project_partners (
                    project_id,
                    chain_id,
                    partner_id,
                    level,
                    tax_rate,
                    calculation_method,
                    profit_rate,
                    unit_price,  -- ✅ 添加 unit_price 字段
                    user_id
                ) VALUES (
                    p_project_id,
                    v_chain_id,
                    (v_partner->>'partner_id')::UUID,
                    (v_partner->>'level')::INTEGER,
                    COALESCE((v_partner->>'tax_rate')::NUMERIC, 0),
                    COALESCE(v_partner->>'calculation_method', 'tax'),
                    COALESCE((v_partner->>'profit_rate')::NUMERIC, 0),
                    COALESCE((v_partner->>'unit_price')::NUMERIC, 0),  -- ✅ 添加 unit_price 值
                    auth.uid()
                );
                
                v_updated_partners := v_updated_partners + 1;
            END LOOP;
            
            RAISE NOTICE '  ✓ 插入 % 个新合作方配置', jsonb_array_length(v_chain->'partners');
        END LOOP;
    END IF;
    
    -- 第4步：返回结果
    RAISE NOTICE '========================================';
    RAISE NOTICE '增量更新完成：';
    RAISE NOTICE '  - 更新链路: % 条', v_updated_chains;
    RAISE NOTICE '  - 删除链路: % 条', v_deleted_chains;
    RAISE NOTICE '  - 更新合作方配置: % 个', v_updated_partners;
    RAISE NOTICE '========================================';
    
    RETURN jsonb_build_object(
        'success', true,
        'message', format('成功更新 %s 条链路，删除 %s 条链路，更新 %s 个合作方配置', 
                         v_updated_chains, v_deleted_chains, v_updated_partners),
        'updated_chains', v_updated_chains,
        'deleted_chains', v_deleted_chains,
        'updated_partners', v_updated_partners
    );
END;
$$;

COMMENT ON FUNCTION public.update_project_chains_incremental IS '增量更新项目链路配置（支持 unit_price 字段）- 修复定价法单价保存问题';

-- ============================================================================
-- 验证
-- ============================================================================

-- ✅ update_project_chains_incremental 函数已修复
-- ✅ 现在可以正确保存定价法的单价了
-- 
-- 修复内容：
--   1. 在 INSERT INTO project_partners 中添加 unit_price 字段
--   2. 从 JSONB 中提取 unit_price 值并保存到数据库


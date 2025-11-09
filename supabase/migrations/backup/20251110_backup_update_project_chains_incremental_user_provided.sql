-- ============================================================
-- 备份：update_project_chains_incremental 函数（用户提供的当前版本）
-- ============================================================
-- 备份时间: 2025-11-10
-- 备份来源: 用户从数据库提供的当前函数体
-- ============================================================
-- 
-- ⚠️ 注意：此文件仅用于备份，不要直接执行
-- 如需恢复，请手动复制函数定义到新的迁移文件中
-- ============================================================

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
    
    -- ============================================================
    -- 第1步：更新项目基本信息
    -- ============================================================
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
        -- 🔧 修复：添加显式类型转换
        effective_quantity_type = COALESCE(
            (p_project_data->>'effective_quantity_type')::public.effective_quantity_type,
            'min_value'::public.effective_quantity_type
        ),
        updated_at = NOW()
    WHERE id = p_project_id;
    
    RAISE NOTICE '✓ 已更新项目基本信息';
    
    -- ============================================================
    -- 第2步：删除被移除的链路
    -- ============================================================
    IF p_deleted_chain_ids IS NOT NULL AND array_length(p_deleted_chain_ids, 1) > 0 THEN
        -- 先删除链路的合作方配置（会触发重算）
        DELETE FROM public.project_partners
        WHERE chain_id = ANY(p_deleted_chain_ids);
        
        GET DIAGNOSTICS v_deleted_partners = ROW_COUNT;
        
        -- 再删除链路本身
        DELETE FROM public.partner_chains
        WHERE id = ANY(p_deleted_chain_ids);
        
        GET DIAGNOSTICS v_deleted_chains = ROW_COUNT;
        
        RAISE NOTICE '✓ 已删除 % 条链路，包含 % 个合作方配置', v_deleted_chains, v_deleted_partners;
    END IF;
    
    -- ============================================================
    -- 第3步：处理变更的链路
    -- ============================================================
    IF p_changed_chains IS NOT NULL THEN
        FOREACH v_chain IN ARRAY p_changed_chains
        LOOP
            v_chain_id := (v_chain->>'id')::UUID;
            
            IF v_chain_id IS NULL THEN
                -- ========================================
                -- 3.1 新增链路
                -- ========================================
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
                -- ========================================
                -- 3.2 更新现有链路（只在数据变化时更新）
                -- ========================================
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
                    RAISE NOTICE '✓ 更新链路基本信息: %', v_chain->>'chain_name';
                ELSE
                    RAISE NOTICE '- 链路基本信息未变化: %', v_chain->>'chain_name';
                END IF;
                
                v_updated_chains := v_updated_chains + 1;
            END IF;
            
            -- ========================================
            -- 3.3 更新该链路的合作方配置
            -- ========================================
            
            -- 删除该链路的所有旧合作方配置（会触发 DELETE 触发器）
            DELETE FROM public.project_partners
            WHERE chain_id = v_chain_id;
            
            GET DIAGNOSTICS v_deleted_partners = ROW_COUNT;
            
            IF v_deleted_partners > 0 THEN
                RAISE NOTICE '  - 删除该链路的 % 个旧合作方配置', v_deleted_partners;
            END IF;
            
            -- 插入新的合作方配置（会触发 INSERT 触发器）
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
                    user_id
                ) VALUES (
                    p_project_id,
                    v_chain_id,
                    (v_partner->>'partner_id')::UUID,
                    (v_partner->>'level')::INTEGER,
                    COALESCE((v_partner->>'tax_rate')::NUMERIC, 0),
                    COALESCE(v_partner->>'calculation_method', 'tax'),
                    COALESCE((v_partner->>'profit_rate')::NUMERIC, 0),
                    auth.uid()
                );
                
                v_updated_partners := v_updated_partners + 1;
            END LOOP;
            
            RAISE NOTICE '  ✓ 插入 % 个新合作方配置', jsonb_array_length(v_chain->'partners');
        END LOOP;
    END IF;
    
    -- ============================================================
    -- 第4步：返回结果
    -- ============================================================
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

COMMENT ON FUNCTION public.update_project_chains_incremental IS '增量更新项目链路配置（只更新变更的链路，避免触发不必要的重算）- 用户提供的当前版本备份';

-- ============================================================
-- 备份说明
-- ============================================================
-- 
-- 此函数的主要问题：
-- 1. UPDATE 语句的 WHERE 条件使用了 IS DISTINCT FROM 检查
-- 2. 这可能导致类型转换问题或条件判断失败
-- 3. 即使前端检测到变化，后端也可能因为条件不满足而不执行 UPDATE
-- 
-- 修复方案（见 20251110_fix_chain_update_logic.sql）：
-- - 移除 WHERE 条件中的 IS DISTINCT FROM 检查
-- - 无条件执行 UPDATE（因为前端已经检测到变化）
-- 
-- ============================================================


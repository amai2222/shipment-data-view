-- ============================================================================
-- 创建 save_project_with_chains_fixed 函数（支持 unit_price）
-- 日期：2025-11-20
-- 功能：保存新项目及其链路和合作方配置
-- 支持：unit_price 字段，用于定价法计算
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_project_with_chains_fixed(
    project_id_in UUID,
    project_data JSONB,
    chains_data JSONB[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_project_id UUID;
    v_chain JSONB;
    v_chain_id UUID;
    v_partner JSONB;
    i INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '开始保存项目';
    RAISE NOTICE '========================================';
    
    -- 插入或更新项目
    IF project_id_in IS NULL THEN
        -- 新建项目
        INSERT INTO public.projects (
            name,
            start_date,
            end_date,
            manager,
            loading_address,
            unloading_address,
            finance_manager,
            planned_total_tons,
            project_status,
            cargo_type,
            effective_quantity_type,
            user_id
        ) VALUES (
            project_data->>'name',
            (project_data->>'start_date')::DATE,
            (project_data->>'end_date')::DATE,
            project_data->>'manager',
            project_data->>'loading_address',
            project_data->>'unloading_address',
            project_data->>'finance_manager',
            (project_data->>'planned_total_tons')::NUMERIC,
            project_data->>'project_status',
            project_data->>'cargo_type',
            COALESCE((project_data->>'effective_quantity_type')::public.effective_quantity_type, 'min_value'::public.effective_quantity_type),
            auth.uid()
        )
        RETURNING id INTO v_project_id;
        
        RAISE NOTICE '✓ 新建项目成功: %', v_project_id;
    ELSE
        -- 更新现有项目
        v_project_id := project_id_in;
        
        UPDATE public.projects
        SET 
            name = project_data->>'name',
            start_date = (project_data->>'start_date')::DATE,
            end_date = (project_data->>'end_date')::DATE,
            manager = project_data->>'manager',
            loading_address = project_data->>'loading_address',
            unloading_address = project_data->>'unloading_address',
            finance_manager = project_data->>'finance_manager',
            planned_total_tons = (project_data->>'planned_total_tons')::NUMERIC,
            project_status = project_data->>'project_status',
            cargo_type = project_data->>'cargo_type',
            effective_quantity_type = COALESCE(
                (project_data->>'effective_quantity_type')::public.effective_quantity_type,
                'min_value'::public.effective_quantity_type
            ),
            updated_at = NOW()
        WHERE id = v_project_id;
        
        RAISE NOTICE '✓ 更新项目成功: %', v_project_id;
    END IF;
    
    -- 保存链路和合作方
    FOREACH v_chain IN ARRAY chains_data
    LOOP
        -- 插入链路
        INSERT INTO public.partner_chains (
            project_id,
            chain_name,
            description,
            is_default,
            billing_type_id,
            user_id
        ) VALUES (
            v_project_id,
            v_chain->>'chain_name',
            COALESCE(v_chain->>'description', ''),
            COALESCE((v_chain->>'is_default')::BOOLEAN, FALSE),
            COALESCE((v_chain->>'billing_type_id')::BIGINT, 1),
            auth.uid()
        )
        RETURNING id INTO v_chain_id;
        
        RAISE NOTICE '✓ 新增链路: % (ID: %)', v_chain->>'chain_name', v_chain_id;
        
        -- 插入合作方配置（包含 unit_price）
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
                v_project_id,
                v_chain_id,
                (v_partner->>'partner_id')::UUID,
                (v_partner->>'level')::INTEGER,
                COALESCE((v_partner->>'tax_rate')::NUMERIC, 0),
                COALESCE(v_partner->>'calculation_method', 'tax'),
                COALESCE((v_partner->>'profit_rate')::NUMERIC, 0),
                COALESCE((v_partner->>'unit_price')::NUMERIC, 0),  -- ✅ 添加 unit_price 值
                auth.uid()
            );
        END LOOP;
        
        RAISE NOTICE '  ✓ 插入 % 个合作方配置', jsonb_array_length(v_chain->'partners');
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '项目保存完成';
    RAISE NOTICE '========================================';
    
    RETURN jsonb_build_object(
        'success', true,
        'project_id', v_project_id,
        'message', '项目保存成功'
    );
END;
$$;

COMMENT ON FUNCTION public.save_project_with_chains_fixed IS '保存项目及其链路和合作方配置（支持 unit_price 字段）- 用于新建和编辑项目';

-- ============================================================================
-- 验证
-- ============================================================================

-- ✅ save_project_with_chains_fixed 函数已创建
-- ✅ 支持定价法的单价保存
-- 
-- 功能：
--   1. 新建或更新项目基本信息
--   2. 保存链路配置
--   3. 保存合作方配置（包含 unit_price）


-- ============================================================================
-- 修复 get_projects_with_details_fixed 函数，添加 unit_price 字段支持
-- 创建日期：2025-11-20
-- 功能：确保函数返回 project_partners 的 unit_price 字段
-- 统一命名：使用 _1120 后缀
-- ============================================================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.get_projects_with_details_fixed();
DROP FUNCTION IF EXISTS public.get_projects_with_details_fixed_1120();

-- 创建新函数（使用 _1120 后缀），包含 unit_price 字段
CREATE OR REPLACE FUNCTION public.get_projects_with_details_fixed_1120()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
    v_projects JSONB;
    v_chains JSONB;
    v_partners JSONB;
BEGIN
    -- 获取所有项目
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'startDate', p.start_date,
            'endDate', p.end_date,
            'manager', p.manager,
            'loadingAddress', p.loading_address,
            'unloadingAddress', p.unloading_address,
            'financeManager', p.finance_manager,
            'plannedTotalTons', p.planned_total_tons,
            'projectStatus', p.project_status,
            'cargoType', p.cargo_type,
            'effectiveQuantityType', p.effective_quantity_type,
            'createdAt', p.created_at
        )
        ORDER BY p.name
    ), '[]'::jsonb)
    INTO v_projects
    FROM public.projects p;

    -- 获取所有链路（按项目ID分组）
    SELECT COALESCE(jsonb_object_agg(
        project_id::text,
        chains_array
    ), '{}'::jsonb)
    INTO v_chains
    FROM (
        SELECT 
            pc.project_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', pc.id,
                    'chainName', pc.chain_name,
                    'description', pc.description,
                    'billingTypeId', pc.billing_type_id,
                    'isDefault', pc.is_default,
                    'createdAt', pc.created_at
                )
                ORDER BY pc.created_at
            ) as chains_array
        FROM public.project_chains pc
        GROUP BY pc.project_id
    ) sub;

    -- 获取所有合作方（包含 unit_price 字段，按项目ID分组）
    SELECT COALESCE(jsonb_object_agg(
        project_id::text,
        partners_array
    ), '{}'::jsonb)
    INTO v_partners
    FROM (
        SELECT 
            pp.project_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', pp.id,
                    'chainId', pp.chain_id,
                    'partnerId', pp.partner_id,
                    'level', pp.level,
                    'taxRate', COALESCE(pp.tax_rate, 0),
                    'calculationMethod', COALESCE(pp.calculation_method, 'tax'),
                    'profitRate', COALESCE(pp.profit_rate, 0),
                    'unitPrice', COALESCE(pp.unit_price, 0),  -- ✅ 添加 unit_price 字段
                    'partnerName', p.name,
                    'createdAt', pp.created_at
                )
                ORDER BY pp.chain_id, pp.level
            ) as partners_array
        FROM public.project_partners pp
        LEFT JOIN public.partners p ON pp.partner_id = p.id
        GROUP BY pp.project_id
    ) sub;

    -- 组合结果
    v_result := jsonb_build_object(
        'projects', v_projects,
        'chains', v_chains,
        'partners', v_partners
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_projects_with_details_fixed_1120() IS 
'获取所有项目及其链路和合作方详情（包含 unit_price 字段，_1120版本）
返回格式：
{
  "projects": [...],
  "chains": { "project_id": [...] },
  "partners": { "project_id": [...] }
}';

-- 验证函数
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 函数 get_projects_with_details_fixed_1120 已创建';
    RAISE NOTICE '✅ 已添加 unit_price 字段支持';
    RAISE NOTICE '✅ 统一使用 _1120 后缀命名';
    RAISE NOTICE '========================================';
END $$;


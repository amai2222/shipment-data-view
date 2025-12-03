-- ============================================================================
-- 修复车辆轨迹ID同步权限检查
-- 创建日期：2025-12-03
-- 功能：将 sync_vehicle_tracking_ids 函数的权限检查从 has_function_permission 改为 has_menu_permission
-- ============================================================================
-- 问题：sync_vehicle_tracking_ids 函数使用了 has_function_permission('contracts.vehicle_tracking')
--       但 contracts.vehicle_tracking 是菜单权限，不是功能权限，导致权限检查失败
-- 解决：改为使用 has_menu_permission('contracts.vehicle_tracking')
-- ============================================================================

-- ============================================================================
-- 修复 sync_vehicle_tracking_ids 函数的权限检查
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_vehicle_tracking_ids(
    p_vehicle_mappings JSONB,
    p_dept_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mapping JSONB;
    v_license_plate TEXT;
    v_external_id TEXT;
    v_vehicle_desc TEXT;
    v_updated_count INTEGER := 0;
    v_inserted_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_result JSONB;
BEGIN
    -- 检查权限（使用菜单权限，因为同步车辆ID是车辆轨迹查询功能的一部分）
    IF NOT public.has_menu_permission('contracts.vehicle_tracking') THEN
        RAISE EXCEPTION '权限不足：您没有同步车辆ID的权限。请联系管理员在权限管理中分配 "contracts.vehicle_tracking" 菜单权限。';
    END IF;

    -- 遍历传入的映射数据
    FOR v_mapping IN SELECT * FROM jsonb_array_elements(p_vehicle_mappings)
    LOOP
        BEGIN
            v_license_plate := v_mapping->>'serialno';
            v_external_id := v_mapping->>'id';
            v_vehicle_desc := v_mapping->>'desc';

            -- 验证数据
            IF v_license_plate IS NULL OR v_external_id IS NULL THEN
                v_error_count := v_error_count + 1;
                v_errors := array_append(v_errors, format('缺少必需字段: serialno=%s, id=%s', v_license_plate, v_external_id));
                CONTINUE;
            END IF;

            INSERT INTO public.vehicle_tracking_id_mappings (
                license_plate,
                external_tracking_id,
                vehicle_desc,
                dept_id,
                updated_at,
                last_synced_at
            )
            VALUES (
                v_license_plate,
                v_external_id,
                v_vehicle_desc,
                p_dept_id,
                NOW(),
                NOW()
            )
            ON CONFLICT (license_plate) DO UPDATE SET
                external_tracking_id = EXCLUDED.external_tracking_id,
                vehicle_desc = EXCLUDED.vehicle_desc,
                dept_id = EXCLUDED.dept_id,
                updated_at = NOW(),
                last_synced_at = NOW();

            IF FOUND THEN
                v_updated_count := v_updated_count + 1;
            ELSE
                v_inserted_count := v_inserted_count + 1;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_errors := array_append(v_errors, format('处理车牌号 %s 时出错: %s', v_license_plate, SQLERRM));
        END;
    END LOOP;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'updated', v_updated_count,
        'inserted', v_inserted_count,
        'errors', v_error_count,
        'error_messages', v_errors,
        'total', jsonb_array_length(p_vehicle_mappings)
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION sync_vehicle_tracking_ids IS '同步外部轨迹系统的车辆ID映射关系到 vehicle_tracking_id_mappings 表（使用菜单权限检查：has_menu_permission(''contracts.vehicle_tracking'')）';

-- ============================================================================
-- 修复 RLS 策略的权限检查
-- ============================================================================

-- 删除旧的策略
DROP POLICY IF EXISTS "允许有权限用户管理车辆轨迹ID映射" ON public.vehicle_tracking_id_mappings;

-- 创建新的策略（使用菜单权限）
CREATE POLICY "允许有权限用户管理车辆轨迹ID映射"
ON public.vehicle_tracking_id_mappings
FOR ALL
TO authenticated
USING (
    public.has_menu_permission('contracts.vehicle_tracking')
);

-- ============================================================================
-- 验证修复
-- ============================================================================

-- 检查函数定义
DO $$
BEGIN
    RAISE NOTICE '✅ sync_vehicle_tracking_ids 函数已更新为使用 has_menu_permission';
    RAISE NOTICE '✅ RLS 策略已更新为使用 has_menu_permission';
    RAISE NOTICE '';
    RAISE NOTICE '请确保您的角色拥有 contracts.vehicle_tracking 菜单权限';
    RAISE NOTICE '可以通过以下 SQL 检查：';
    RAISE NOTICE '  SELECT role, menu_permissions FROM role_permission_templates WHERE ''contracts.vehicle_tracking'' = ANY(menu_permissions);';
END $$;


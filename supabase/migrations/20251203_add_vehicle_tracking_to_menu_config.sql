-- ============================================================================
-- 添加车辆轨迹查询菜单到 menu_config 表
-- 创建日期：2025-12-03
-- 功能：在 menu_config 表中添加 contracts.vehicle_tracking 菜单项
-- ============================================================================

-- 检查并添加车辆轨迹查询菜单
INSERT INTO public.menu_config (
    key,
    parent_key,
    title,
    url,
    icon,
    order_index,
    is_group,
    is_active,
    required_permissions,
    description
)
SELECT 
    'contracts.vehicle_tracking',
    'contracts_group',  -- 父菜单：合同管理分组
    '车辆轨迹查询',
    '/contracts/vehicle-tracking',
    'Route',  -- Lucide React 图标名称
    22,  -- 排序索引（在合同列表之后）
    false,  -- 不是分组
    true,  -- 启用
    ARRAY['contracts.vehicle_tracking']::text[],  -- 所需权限
    '查询车辆轨迹信息'
WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_config 
    WHERE key = 'contracts.vehicle_tracking'
);

-- 如果菜单已存在但被禁用，则启用它
UPDATE public.menu_config
SET 
    is_active = true,
    updated_at = NOW()
WHERE key = 'contracts.vehicle_tracking'
  AND is_active = false;

-- 验证插入结果
DO $$
DECLARE
    v_menu_exists BOOLEAN;
    v_menu_active BOOLEAN;
BEGIN
    SELECT 
        EXISTS(SELECT 1 FROM public.menu_config WHERE key = 'contracts.vehicle_tracking'),
        COALESCE((SELECT is_active FROM public.menu_config WHERE key = 'contracts.vehicle_tracking'), false)
    INTO v_menu_exists, v_menu_active;
    
    IF v_menu_exists AND v_menu_active THEN
        RAISE NOTICE '✅ 车辆轨迹查询菜单已成功添加到 menu_config 表';
    ELSIF v_menu_exists AND NOT v_menu_active THEN
        RAISE WARNING '⚠️ 车辆轨迹查询菜单存在但被禁用';
    ELSE
        RAISE WARNING '❌ 车辆轨迹查询菜单添加失败';
    END IF;
END $$;

-- 自动同步管理员权限（触发自动同步函数）
DO $$
BEGIN
    PERFORM auto_sync_admin_menu_permissions();
    RAISE NOTICE '✅ 管理员菜单权限已自动同步';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '⚠️ 自动同步管理员权限失败: %', SQLERRM;
END $$;

-- 添加注释
COMMENT ON TABLE public.menu_config IS '动态菜单配置表（包含车辆轨迹查询菜单）';


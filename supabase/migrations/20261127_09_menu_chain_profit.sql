-- ============================================================================
-- 用途：
--   1) 注册「链路毛利」菜单（finance.chain_profit），让新增页面 /finance/chain-profit
--      能出现在侧边栏并可被路由守卫放行；
--   2) 给 admin / finance 角色模板补齐该菜单权限。
--
-- 风险等级：低
--   - 只写 menu_config（菜单字典）与 role_permission_templates（权限模板）；
--   - 不触碰任何业务数据、金额、运单、成本行；
--   - 幂等：可重复执行，ON CONFLICT + 数组去重判断。
--
-- 前置依赖：
--   - 20261127_08_chain_profit_report.sql（提供 3 个报表 RPC，页面数据来源）
--   - 前端已发布含 /finance/chain-profit 路由的版本
--   - 若菜单不出现，先确认 menu_config.parent_key='finance' 的分组记录是否存在
--
-- 回滚方式：见文件末尾注释
-- 执行位置：Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- 第 1 段：注册菜单
--   注意 menu_config 的列名是 title（不是 name），且有 CHECK：
--   分组必须 url IS NULL，非分组必须 url IS NOT NULL
-- ============================================================================
INSERT INTO public.menu_config (
    key, parent_key, title, url, icon, order_index, is_active, is_group, description, required_permissions
)
VALUES (
    'finance.chain_profit',
    'finance',
    '链路毛利',
    '/finance/chain-profit',
    'TrendingUp',
    95,
    true,
    false,
    '按链路汇总中科应收/应付与毛利，含层级结构与账龄',
    ARRAY['finance.chain_profit']
)
ON CONFLICT (key) DO UPDATE
SET title        = EXCLUDED.title,
    url          = EXCLUDED.url,
    icon         = EXCLUDED.icon,
    parent_key   = EXCLUDED.parent_key,
    description  = EXCLUDED.description,
    is_active    = true,
    updated_at   = now();

-- ============================================================================
-- 第 2 段：给 admin / finance 角色模板补权限
--   只追加、不覆盖；已有该 key 则保持原数组不变
-- ============================================================================
UPDATE public.role_permission_templates
SET menu_permissions = CASE
        WHEN COALESCE(menu_permissions, ARRAY[]::text[]) @> ARRAY['finance.chain_profit']::text[]
            THEN menu_permissions
        ELSE array_append(COALESCE(menu_permissions, ARRAY[]::text[]), 'finance.chain_profit')
    END,
    updated_at = now()
WHERE role::text IN ('admin', 'finance');

-- ============================================================================
-- 第 3 段：只读校验（可单独执行）
-- ============================================================================
-- 3.1 菜单是否注册成功
SELECT key, parent_key, title, url, order_index, is_active, required_permissions
FROM public.menu_config
WHERE key = 'finance.chain_profit';

-- 3.2 角色模板是否已包含该权限
SELECT role::text AS role, 'finance.chain_profit' = ANY(COALESCE(menu_permissions, ARRAY[]::text[])) AS has_perm
FROM public.role_permission_templates
WHERE role::text IN ('admin', 'finance')
ORDER BY role::text;

-- 3.3 父分组是否存在（不存在则侧边栏不会显示该菜单）
SELECT key, title, is_group
FROM public.menu_config
WHERE key = 'finance';

-- ============================================================================
-- 回滚（手工执行）
-- ============================================================================
-- 1) 从角色模板移除权限
-- UPDATE public.role_permission_templates
-- SET menu_permissions = array_remove(menu_permissions, 'finance.chain_profit'),
--     updated_at = now()
-- WHERE role::text IN ('admin','finance');
--
-- 2) 删除菜单
-- DELETE FROM public.menu_config WHERE key = 'finance.chain_profit';
--
-- 说明：回滚不影响任何业务数据与金额。
-- ============================================================================

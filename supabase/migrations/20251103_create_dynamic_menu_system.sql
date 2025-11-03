-- ============================================================================
-- 动态菜单系统数据库迁移
-- ============================================================================
-- 功能：将菜单结构从硬编码改为数据库配置
-- 目的：实现完全可配置的菜单系统，支持后台管理
-- ============================================================================
-- 创建时间：2025-11-03
-- ============================================================================

BEGIN;

-- ==========================================
-- 第一步：创建菜单配置表
-- ==========================================

CREATE TABLE IF NOT EXISTS public.menu_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,           -- 菜单唯一标识，如 'dashboard.transport'
    parent_key TEXT,                     -- 父菜单key，如 'dashboard_group'
    title TEXT NOT NULL,                 -- 菜单显示名称
    url TEXT,                            -- 菜单路由
    icon TEXT,                           -- 图标名称（Lucide React）
    order_index INTEGER NOT NULL DEFAULT 0,  -- 排序索引
    is_active BOOLEAN DEFAULT true,      -- 是否启用
    is_group BOOLEAN DEFAULT false,      -- 是否为分组（父菜单）
    description TEXT,                    -- 描述
    required_permissions TEXT[],         -- 所需权限（可多个）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 约束
    CONSTRAINT menu_config_parent_check CHECK (
        (is_group = true AND url IS NULL) OR (is_group = false AND url IS NOT NULL)
    )
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_menu_config_parent_key ON public.menu_config(parent_key);
CREATE INDEX IF NOT EXISTS idx_menu_config_order ON public.menu_config(order_index);
CREATE INDEX IF NOT EXISTS idx_menu_config_active ON public.menu_config(is_active);

-- 添加注释
COMMENT ON TABLE public.menu_config IS '动态菜单配置表';
COMMENT ON COLUMN public.menu_config.key IS '菜单唯一标识符';
COMMENT ON COLUMN public.menu_config.parent_key IS '父菜单key，NULL表示顶级菜单';
COMMENT ON COLUMN public.menu_config.is_group IS '是否为分组（父菜单），分组没有url';
COMMENT ON COLUMN public.menu_config.required_permissions IS '访问此菜单所需的权限键数组';

-- ==========================================
-- 第二步：启用 RLS
-- ==========================================

ALTER TABLE public.menu_config ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "menu_config_select_policy" ON public.menu_config;
DROP POLICY IF EXISTS "menu_config_insert_policy" ON public.menu_config;
DROP POLICY IF EXISTS "menu_config_update_policy" ON public.menu_config;
DROP POLICY IF EXISTS "menu_config_delete_policy" ON public.menu_config;

-- 所有已认证用户都可以读取菜单配置
CREATE POLICY "menu_config_select_policy"
ON public.menu_config
FOR SELECT
TO authenticated
USING (is_active = true);

-- 只有管理员可以修改菜单配置
CREATE POLICY "menu_config_insert_policy"
ON public.menu_config
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "menu_config_update_policy"
ON public.menu_config
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "menu_config_delete_policy"
ON public.menu_config
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ==========================================
-- 第三步：创建更新时间戳触发器
-- ==========================================

CREATE OR REPLACE FUNCTION update_menu_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_menu_config_updated_at ON public.menu_config;

CREATE TRIGGER trigger_update_menu_config_updated_at
    BEFORE UPDATE ON public.menu_config
    FOR EACH ROW
    EXECUTE FUNCTION update_menu_config_updated_at();

-- ==========================================
-- 第四步：插入当前菜单配置数据
-- ==========================================

-- 清空旧数据（如果存在）
TRUNCATE TABLE public.menu_config;

-- 数据看板分组
INSERT INTO public.menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('dashboard_group', NULL, '数据看板', NULL, 'BarChart3', 10, true, true, ARRAY['dashboard']),
('dashboard.transport', 'dashboard_group', '运输看板', '/dashboard/transport', 'Truck', 11, false, true, ARRAY['dashboard.transport']),
('dashboard.financial', 'dashboard_group', '财务看板', '/dashboard/financial', 'Banknote', 12, false, true, ARRAY['dashboard.financial']),
('dashboard.project', 'dashboard_group', '项目看板', '/dashboard/project', 'PieChart', 13, false, true, ARRAY['dashboard.project']),
('dashboard.shipper', 'dashboard_group', '货主看板', '/dashboard/shipper', 'TreePine', 14, false, true, ARRAY['dashboard.shipper']);

-- 合同管理分组
INSERT INTO public.menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('contracts_group', NULL, '合同管理', NULL, 'FileText', 20, true, true, ARRAY['contracts']),
('contracts.list', 'contracts_group', '合同列表', '/contracts', 'FileText', 21, false, true, ARRAY['contracts.list']);

-- 信息维护分组
INSERT INTO public.menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('maintenance_group', NULL, '信息维护', NULL, 'Database', 30, true, true, ARRAY['maintenance']),
('maintenance.projects', 'maintenance_group', '项目管理', '/projects', 'Package', 31, false, true, ARRAY['maintenance.projects']),
('maintenance.drivers', 'maintenance_group', '司机管理', '/drivers', 'Truck', 32, false, true, ARRAY['maintenance.drivers']),
('maintenance.locations', 'maintenance_group', '地点管理', '/locations', 'MapPin', 33, false, true, ARRAY['maintenance.locations']),
('maintenance.locations_enhanced', 'maintenance_group', '地点管理（增强版）', '/locations-enhanced', 'MapPin', 34, false, true, ARRAY['maintenance.locations_enhanced']),
('maintenance.partners', 'maintenance_group', '合作方管理', '/partners', 'Users', 35, false, true, ARRAY['maintenance.partners']),
('maintenance.partners_hierarchy', 'maintenance_group', '货主层级管理', '/partners/hierarchy', 'TreePine', 36, false, true, ARRAY['maintenance.partners']);

-- 业务管理分组
INSERT INTO public.menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('business_group', NULL, '业务管理', NULL, 'FileText', 40, true, true, ARRAY['business']),
('business.entry', 'business_group', '运单管理', '/business-entry', 'Plus', 41, false, true, ARRAY['business.entry']),
('business.scale', 'business_group', '磅单管理', '/scale-records', 'Weight', 42, false, true, ARRAY['business.scale']),
('business.invoice_request', 'business_group', '开票申请', '/invoice-request', 'FileText', 43, false, true, ARRAY['business.invoice_request']),
('business.payment_request', 'business_group', '付款申请', '/payment-request', 'DollarSign', 44, false, true, ARRAY['business.payment_request']);

-- 财务管理分组
INSERT INTO public.menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('finance_group', NULL, '财务管理', NULL, 'Calculator', 50, true, true, ARRAY['finance']),
('finance.reconciliation', 'finance_group', '对账管理', '/finance/reconciliation', 'Calculator', 51, false, true, ARRAY['finance.reconciliation']),
('finance.payment_invoice', 'finance_group', '付款开票', '/finance/payment-invoice', 'CreditCard', 52, false, true, ARRAY['finance.payment_invoice']),
('finance.payment_requests', 'finance_group', '付款申请列表', '/payment-requests-list', 'ClipboardList', 53, false, true, ARRAY['finance.payment_requests']),
('finance.invoice_request_management', 'finance_group', '开票申请管理', '/invoice-request-management', 'FileText', 54, false, true, ARRAY['finance.invoice_request_management']);

-- 审核管理分组
INSERT INTO public.menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('audit_group', NULL, '审核管理', NULL, 'CheckCircle2', 60, true, true, ARRAY['audit']),
('audit.invoice', 'audit_group', '开票审核', '/audit/invoice', 'FileText', 61, false, true, ARRAY['audit.invoice', 'audit']),
('audit.payment', 'audit_group', '付款审核', '/audit/payment', 'DollarSign', 62, false, true, ARRAY['audit.payment', 'audit']);

-- 数据维护分组
INSERT INTO public.menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('data_maintenance_group', NULL, '数据维护', NULL, 'Database', 70, true, true, ARRAY['data_maintenance']),
('data_maintenance.waybill', 'data_maintenance_group', '运单数据维护', '/data-maintenance/waybill', 'FileText', 71, false, true, ARRAY['data_maintenance.waybill']),
('data_maintenance.waybill_enhanced', 'data_maintenance_group', '运单维护（增强版）', '/data-maintenance/waybill-enhanced', 'FileText', 72, false, true, ARRAY['data_maintenance.waybill_enhanced']);

-- 设置分组
INSERT INTO public.menu_config (key, parent_key, title, url, icon, order_index, is_group, is_active, required_permissions) VALUES
('settings_group', NULL, '系统设置', NULL, 'Settings', 80, true, true, ARRAY['settings']),
('settings.users', 'settings_group', '用户管理', '/settings/users', 'Users', 81, false, true, ARRAY['settings.users']),
('settings.permissions', 'settings_group', '权限配置', '/settings/permissions', 'Shield', 82, false, true, ARRAY['settings.permissions']),
('settings.contract_permissions', 'settings_group', '合同权限管理', '/settings/contract-permissions', 'Shield', 83, false, true, ARRAY['settings.contract_permissions']),
('settings.role_templates', 'settings_group', '角色模板', '/settings/role-templates', 'Shield', 84, false, true, ARRAY['settings.role_templates']),
('settings.integrated', 'settings_group', '集成权限管理', '/settings/integrated', 'Shield', 85, false, true, ARRAY['settings.integrated']),
('settings.audit_logs', 'settings_group', '操作日志', '/settings/audit-logs', 'History', 86, false, true, ARRAY['settings.audit_logs']),
('settings.menu_config', 'settings_group', '菜单配置', '/settings/menu-config', 'Menu', 87, false, true, ARRAY['settings.menu_config']);

-- ==========================================
-- 第五步：验证数据插入
-- ==========================================

DO $$
DECLARE
    v_total_menus INTEGER;
    v_groups INTEGER;
    v_items INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_menus FROM public.menu_config;
    SELECT COUNT(*) INTO v_groups FROM public.menu_config WHERE is_group = true;
    SELECT COUNT(*) INTO v_items FROM public.menu_config WHERE is_group = false;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 动态菜单系统创建成功';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '菜单统计：';
    RAISE NOTICE '  - 总菜单数: %', v_total_menus;
    RAISE NOTICE '  - 分组数: %', v_groups;
    RAISE NOTICE '  - 菜单项数: %', v_items;
    RAISE NOTICE '';
    RAISE NOTICE 'RLS 策略：';
    RAISE NOTICE '  - SELECT: 所有已认证用户可读取';
    RAISE NOTICE '  - INSERT/UPDATE/DELETE: 仅管理员可操作';
    RAISE NOTICE '';
    RAISE NOTICE '下一步：';
    RAISE NOTICE '  1. 修改前端代码使用动态菜单';
    RAISE NOTICE '  2. 创建菜单配置管理界面';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==========================================
-- 查看菜单结构
-- ==========================================

-- 按层级显示菜单结构
SELECT 
    CASE 
        WHEN is_group THEN '📁 ' || title
        ELSE '  📄 ' || title
    END AS menu_structure,
    key,
    url,
    icon,
    order_index,
    array_to_string(required_permissions, ', ') AS permissions
FROM public.menu_config
ORDER BY order_index;


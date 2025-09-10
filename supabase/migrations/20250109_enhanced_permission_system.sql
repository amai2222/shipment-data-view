-- 增强权限系统数据库迁移
-- 创建时间: 2025-01-09

-- 扩展角色权限模板表
ALTER TABLE public.role_permission_templates 
ADD COLUMN IF NOT EXISTS project_permissions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS data_permissions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS color text DEFAULT 'bg-gray-500';

-- 扩展用户权限表
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS project_permissions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS data_permissions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS inherit_role boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS custom_settings jsonb DEFAULT '{}';

-- 创建用户项目关联表
CREATE TABLE IF NOT EXISTS public.user_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role text DEFAULT 'member', -- member, admin, viewer
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  
  -- 确保每个用户在每个项目中只有一条记录
  UNIQUE(user_id, project_id)
);

-- 创建权限审计日志表
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('grant', 'revoke', 'modify', 'inherit')),
  permission_type text NOT NULL CHECK (permission_type IN ('menu', 'function', 'project', 'data')),
  permission_key text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 启用RLS
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 用户项目关联表策略
CREATE POLICY "Admins can manage all user projects" 
ON public.user_projects 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Users can view their own project assignments" 
ON public.user_projects 
FOR SELECT 
USING (auth.uid() = user_id);

-- 权限审计日志策略
CREATE POLICY "Admins can view all audit logs" 
ON public.permission_audit_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Users can view their own audit logs" 
ON public.permission_audit_logs 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = target_user_id);

CREATE POLICY "Admins can create audit logs" 
ON public.permission_audit_logs 
FOR INSERT 
WITH CHECK (is_admin());

-- 创建更新时间触发器
CREATE TRIGGER update_user_projects_updated_at
  BEFORE UPDATE ON public.user_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 插入默认角色权限模板
INSERT INTO public.role_permission_templates (
  role, 
  name, 
  description, 
  color, 
  menu_permissions, 
  function_permissions, 
  project_permissions, 
  data_permissions, 
  is_system
) VALUES 
-- 系统管理员
('admin', '系统管理员', '拥有系统所有权限，可以管理用户和权限', 'bg-red-500', 
 ARRAY['dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project', 'dashboard.quantity',
       'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
       'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests', 'business.contracts',
       'finance', 'finance.reconciliation', 'finance.payment_invoice',
       'settings', 'settings.users', 'settings.permissions'],
 ARRAY['data', 'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
       'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
       'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
       'system', 'system.manage_users', 'system.manage_roles', 'system.view_logs', 'system.backup'],
 ARRAY['project_access', 'project.view_all', 'project.manage', 'project.admin',
       'project_data', 'project_data.view_financial', 'project_data.edit_financial', 'project_data.view_operational', 'project_data.edit_operational'],
 ARRAY['data_scope', 'data.all', 'data.own', 'data.team', 'data.project',
       'data_operations', 'data.create', 'data.edit', 'data.delete', 'data.export'],
 true),

-- 财务人员
('finance', '财务人员', '负责财务相关操作，包括付款审批、发票管理等', 'bg-blue-500',
 ARRAY['dashboard', 'dashboard.financial', 'dashboard.project',
       'maintenance', 'maintenance.partners',
       'business', 'business.payment_request', 'business.payment_requests', 'business.contracts',
       'finance', 'finance.reconciliation', 'finance.payment_invoice'],
 ARRAY['data', 'data.view', 'data.export',
       'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
       'scale_records', 'scale_records.view'],
 ARRAY['project_access', 'project.view_all',
       'project_data', 'project_data.view_financial', 'project_data.edit_financial'],
 ARRAY['data_scope', 'data.all',
       'data_operations', 'data.export'],
 true),

-- 业务人员
('business', '业务人员', '负责业务管理，包括项目管理、合同管理等', 'bg-green-500',
 ARRAY['dashboard', 'dashboard.transport', 'dashboard.project',
       'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
       'business', 'business.entry', 'business.scale', 'business.contracts',
       'finance', 'finance.reconciliation'],
 ARRAY['data', 'data.create', 'data.edit', 'data.export',
       'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view',
       'finance', 'finance.view_cost'],
 ARRAY['project_access', 'project.view_assigned', 'project.manage',
       'project_data', 'project_data.view_operational', 'project_data.edit_operational'],
 ARRAY['data_scope', 'data.team',
       'data_operations', 'data.create', 'data.edit', 'data.export'],
 true),

-- 操作员
('operator', '操作员', '负责日常操作，包括数据录入、磅单管理等', 'bg-yellow-500',
 ARRAY['dashboard', 'dashboard.transport',
       'maintenance', 'maintenance.drivers', 'maintenance.locations',
       'business', 'business.entry', 'business.scale'],
 ARRAY['data', 'data.create',
       'scale_records', 'scale_records.create', 'scale_records.view'],
 ARRAY['project_access', 'project.view_assigned',
       'project_data', 'project_data.view_operational'],
 ARRAY['data_scope', 'data.own',
       'data_operations', 'data.create'],
 true),

-- 合作方
('partner', '合作方', '外部合作伙伴，只能查看相关数据', 'bg-purple-500',
 ARRAY['dashboard', 'dashboard.transport'],
 ARRAY['data', 'data.view'],
 ARRAY['project_access', 'project.view_assigned'],
 ARRAY['data_scope', 'data.own'],
 true),

-- 查看者
('viewer', '查看者', '只能查看数据，不能进行任何修改操作', 'bg-gray-500',
 ARRAY['dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project',
       'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
       'business', 'business.contracts',
       'finance', 'finance.reconciliation'],
 ARRAY['data', 'data.view',
       'scale_records', 'scale_records.view',
       'finance', 'finance.view_cost'],
 ARRAY['project_access', 'project.view_all',
       'project_data', 'project_data.view_financial', 'project_data.view_operational'],
 ARRAY['data_scope', 'data.all',
       'data_operations'],
 true)

ON CONFLICT (role) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  menu_permissions = EXCLUDED.menu_permissions,
  function_permissions = EXCLUDED.function_permissions,
  project_permissions = EXCLUDED.project_permissions,
  data_permissions = EXCLUDED.data_permissions,
  updated_at = now();

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_project_id ON public.user_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON public.user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project_id ON public.user_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_id ON public.permission_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at ON public.permission_audit_logs(created_at);

-- 创建函数：记录权限变更日志
CREATE OR REPLACE FUNCTION log_permission_change(
  p_user_id uuid,
  p_action text,
  p_permission_type text,
  p_permission_key text,
  p_target_user_id uuid DEFAULT NULL,
  p_target_project_id uuid DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.permission_audit_logs (
    user_id,
    action,
    permission_type,
    permission_key,
    target_user_id,
    target_project_id,
    old_value,
    new_value,
    reason,
    created_by
  ) VALUES (
    p_user_id,
    p_action,
    p_permission_type,
    p_permission_key,
    p_target_user_id,
    p_target_project_id,
    p_old_value,
    p_new_value,
    p_reason,
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：自动记录权限变更
CREATE OR REPLACE FUNCTION trigger_log_permission_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 记录用户权限变更
  IF TG_TABLE_NAME = 'user_permissions' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM log_permission_change(
        NEW.user_id,
        'grant',
        'user',
        'permission_set',
        NEW.user_id,
        NEW.project_id,
        NULL,
        to_jsonb(NEW),
        'User permission created'
      );
    ELSIF TG_OP = 'UPDATE' THEN
      PERFORM log_permission_change(
        NEW.user_id,
        'modify',
        'user',
        'permission_set',
        NEW.user_id,
        NEW.project_id,
        to_jsonb(OLD),
        to_jsonb(NEW),
        'User permission modified'
      );
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM log_permission_change(
        OLD.user_id,
        'revoke',
        'user',
        'permission_set',
        OLD.user_id,
        OLD.project_id,
        to_jsonb(OLD),
        NULL,
        'User permission deleted'
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为权限表创建审计触发器
DROP TRIGGER IF EXISTS audit_user_permissions ON public.user_permissions;
CREATE TRIGGER audit_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION trigger_log_permission_change();

-- 创建函数：获取用户有效权限
CREATE OR REPLACE FUNCTION get_user_effective_permissions(
  p_user_id uuid,
  p_project_id uuid DEFAULT NULL
) RETURNS TABLE (
  menu_permissions text[],
  function_permissions text[],
  project_permissions text[],
  data_permissions text[]
) AS $$
DECLARE
  user_role app_role;
  user_perm_record RECORD;
  role_template RECORD;
BEGIN
  -- 获取用户角色
  SELECT role INTO user_role FROM public.profiles WHERE id = p_user_id;
  
  -- 获取用户特定权限
  SELECT * INTO user_perm_record 
  FROM public.user_permissions 
  WHERE user_id = p_user_id 
    AND (p_project_id IS NULL AND project_id IS NULL OR project_id = p_project_id);
  
  -- 获取角色模板
  SELECT * INTO role_template 
  FROM public.role_permission_templates 
  WHERE role = user_role;
  
  -- 如果用户有特定权限且不继承角色权限
  IF user_perm_record.id IS NOT NULL AND NOT user_perm_record.inherit_role THEN
    RETURN QUERY SELECT 
      user_perm_record.menu_permissions,
      user_perm_record.function_permissions,
      user_perm_record.project_permissions,
      user_perm_record.data_permissions;
  ELSE
    -- 合并角色权限和用户特定权限
    IF user_perm_record.id IS NOT NULL THEN
      RETURN QUERY SELECT 
        COALESCE(role_template.menu_permissions, '{}') || user_perm_record.menu_permissions,
        COALESCE(role_template.function_permissions, '{}') || user_perm_record.function_permissions,
        COALESCE(role_template.project_permissions, '{}') || user_perm_record.project_permissions,
        COALESCE(role_template.data_permissions, '{}') || user_perm_record.data_permissions;
    ELSE
      RETURN QUERY SELECT 
        COALESCE(role_template.menu_permissions, '{}'),
        COALESCE(role_template.function_permissions, '{}'),
        COALESCE(role_template.project_permissions, '{}'),
        COALESCE(role_template.data_permissions, '{}');
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

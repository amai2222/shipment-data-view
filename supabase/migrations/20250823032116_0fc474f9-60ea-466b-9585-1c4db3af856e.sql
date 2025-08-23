-- 创建用户权限表，用于存储用户级别的权限配置
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE, -- 项目级权限，NULL表示全局权限
  menu_permissions text[] DEFAULT '{}', -- 菜单权限数组
  function_permissions text[] DEFAULT '{}', -- 功能权限数组
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  
  -- 确保每个用户在每个项目下只有一条记录
  UNIQUE(user_id, project_id)
);

-- 创建角色权限模板表，用于存储角色默认权限配置
CREATE TABLE public.role_permission_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  menu_permissions text[] DEFAULT '{}',
  function_permissions text[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- 每个角色只有一个模板
  UNIQUE(role)
);

-- 启用RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_templates ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Admins can manage all user permissions" 
ON public.user_permissions 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all role templates" 
ON public.role_permission_templates 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "All authenticated users can view role templates" 
ON public.role_permission_templates 
FOR SELECT 
USING (true);

-- 创建更新时间触发器
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_role_permission_templates_updated_at
  BEFORE UPDATE ON public.role_permission_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 插入默认角色权限模板
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions) VALUES
('admin', 
 '{dashboard.transport,dashboard.financial,dashboard.project,info.projects,info.drivers,info.locations,info.partners,business.entry,business.payment_request,business.payment_list,finance.reconciliation,finance.payment_invoice,settings.users,settings.permissions}',
 '{data.create,data.edit,data.delete,data.export,data.import,finance.view_cost,finance.approve_payment,finance.generate_invoice,finance.reconcile,system.manage_users,system.manage_roles,system.view_logs,system.backup}'
),
('finance', 
 '{dashboard.transport,dashboard.financial,dashboard.project,info.drivers,info.locations,info.partners,business.payment_request,business.payment_list,finance.reconciliation,finance.payment_invoice}',
 '{data.export,finance.view_cost,finance.approve_payment,finance.generate_invoice,finance.reconcile}'
),
('business', 
 '{dashboard.transport,dashboard.project,info.projects,info.drivers,info.locations,info.partners,business.entry,business.payment_request,business.payment_list}',
 '{data.create,data.edit,data.export,data.import}'
),
('operator', 
 '{dashboard.transport,info.drivers,info.locations,business.entry}',
 '{data.create,data.edit}'
),
('partner', 
 '{dashboard.transport}',
 '{}'
),
('viewer', 
 '{dashboard.transport,dashboard.financial,dashboard.project,info.drivers,info.locations,info.partners}',
 '{data.export}'
);
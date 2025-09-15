  -- 为 user_permissions 表添加缺失的字段
  ALTER TABLE public.user_permissions 
  ADD COLUMN IF NOT EXISTS project_permissions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_permissions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS inherit_role boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_settings jsonb DEFAULT '{}';

  -- 为 role_permission_templates 表添加缺失的字段
  ALTER TABLE public.role_permission_templates 
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS color text DEFAULT 'bg-blue-500',
  ADD COLUMN IF NOT EXISTS project_permissions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_permissions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;

  -- 更新现有记录的 name 和 description 字段
  UPDATE public.role_permission_templates SET 
    name = CASE 
      WHEN role = 'admin' THEN '系统管理员'
      WHEN role = 'finance' THEN '财务人员'
      WHEN role = 'business' THEN '业务人员'
      WHEN role = 'operator' THEN '操作员'
      WHEN role = 'partner' THEN '合作方'
      ELSE '查看者'
    END,
    description = CASE 
      WHEN role = 'admin' THEN '拥有系统所有权限'
      WHEN role = 'finance' THEN '负责财务相关操作'
      WHEN role = 'business' THEN '负责业务录入和管理'
      WHEN role = 'operator' THEN '执行日常操作'
      WHEN role = 'partner' THEN '合作方用户'
      ELSE '只能查看数据'
    END,
    color = CASE 
      WHEN role = 'admin' THEN 'bg-red-500'
      WHEN role = 'finance' THEN 'bg-green-500'
      WHEN role = 'business' THEN 'bg-blue-500'
      WHEN role = 'operator' THEN 'bg-yellow-500'
      WHEN role = 'partner' THEN 'bg-purple-500'
      ELSE 'bg-gray-500'
    END,
    is_system = true
  WHERE name IS NULL;